"""Delegation chain verification (AAT -01), implemented from the normative order.

Verifies the root against configured trust anchors, then each parent->child link:
signature, issuer thumbprint, parent binding, depth and ceiling monotonicity,
temporal narrowing, and capability/constraint narrowing. Every failure yields a
canonical Denial. This performs no proof-of-possession check — see pop.py.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from . import crypto
from .constraints import is_constraint, is_permitted_pair, subsumes
from .reasons import Denial, denial

MAX_CHAIN_LENGTH = 16
MAX_TOKEN_BYTES = 16 * 1024
MAX_IAT_SKEW_SECONDS = 30
MAX_TOKEN_LIFETIME_SECONDS = 90 * 24 * 3600
MAX_DELEGATION_DEPTH = 8
MAX_CONSTRAINT_DEPTH = 8

AAT_DETAIL_TYPE = "attenuating_agent_token"


@dataclass(frozen=True)
class VerifiedChain:
    tokens: list[dict]
    leaf_tools: dict[str, dict]
    leaf_holder: str
    expires_at: int
    depth: int


def _tool_grants(payload: dict) -> Optional[dict[str, dict]]:
    details = payload.get("authorization_details")
    if not isinstance(details, list):
        return None
    matching = [d for d in details if isinstance(d, dict) and d.get("type") == AAT_DETAIL_TYPE]
    if len(matching) != 1:
        return None
    tools = matching[0].get("tools")
    if not isinstance(tools, dict):
        return None
    return tools


def _looks_like_payload(v: Any) -> bool:
    return (
        isinstance(v, dict)
        and isinstance(v.get("jti"), str)
        and isinstance(v.get("iss"), str)
        and isinstance(v.get("iat"), (int, float))
        and isinstance(v.get("exp"), (int, float))
        and isinstance(v.get("del_depth"), (int, float))
        and isinstance(v.get("del_max_depth"), (int, float))
        and isinstance(v.get("cnf"), dict)
        and isinstance(v["cnf"].get("jwk"), dict)
        and isinstance(v.get("authorization_details"), list)
    )


def _peek_jti(token: str) -> Optional[str]:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    raw = crypto.b64url_decode(parts[1])
    if raw is None:
        return None
    try:
        import json

        payload = json.loads(raw)
    except ValueError:
        return None
    jti = payload.get("jti") if isinstance(payload, dict) else None
    return jti if isinstance(jti, str) else None


def _is_uri(value: str) -> bool:
    from urllib.parse import urlparse

    try:
        parsed = urlparse(value)
        return bool(parsed.scheme and (parsed.netloc or parsed.path))
    except ValueError:
        return False


def _constraint_depth(value: Any, seen: int = 0) -> int:
    if seen > MAX_CONSTRAINT_DEPTH + 1 or not isinstance(value, dict):
        return seen
    nested = value.get("constraints")
    if not isinstance(nested, list):
        return seen + 1
    return max((_constraint_depth(c, seen + 1) for c in nested), default=seen + 1)


def _exceeds_constraint_depth(tools: dict[str, dict]) -> bool:
    for constraints in tools.values():
        for c in constraints.values():
            if _constraint_depth(c) > MAX_CONSTRAINT_DEPTH:
                return True
    return False


def _check_temporal(payload: dict, now: int, index: int) -> list[Denial]:
    out: list[Denial] = []
    if payload["exp"] <= now:
        out.append(denial("expired", "chain", "Token has expired.", token_index=index))
    if payload["iat"] > now + MAX_IAT_SKEW_SECONDS:
        out.append(
            denial("not_yet_valid", "chain", "Token was issued too far in the future.", token_index=index)
        )
    return out


def _verify_narrowing(parent_tools: dict, child_tools: dict, index: int) -> list[Denial]:
    out: list[Denial] = []
    for tool, child_constraints in child_tools.items():
        parent_constraints = parent_tools.get(tool)
        if parent_constraints is None:
            out.append(
                denial("tool_not_delegated", "chain", f'Tool "{tool}" was not granted by the parent.', token_index=index, tool=tool)
            )
            continue
        parent_keys = list(parent_constraints.keys())
        parent_unconstrained = len(parent_keys) == 0
        if not parent_unconstrained:
            child_keys = list(child_constraints.keys())
            same = len(child_keys) == len(parent_keys) and all(k in child_constraints for k in parent_keys)
            if not same:
                out.append(
                    denial("argument_key_set_mismatch", "chain", f'Constraint map for tool "{tool}" must name exactly the same arguments as the parent.', token_index=index, tool=tool)
                )
                continue
        for argument, child_c in child_constraints.items():
            if not is_constraint(child_c):
                out.append(
                    denial("constraint_type_unrecognized", "chain", f'Constraint for "{tool}.{argument}" is malformed or of an unknown type.', token_index=index, tool=tool, argument=argument)
                )
                continue
            if parent_unconstrained:
                continue
            parent_c = parent_constraints.get(argument)
            if parent_c is None:
                continue
            if not is_constraint(parent_c):
                out.append(
                    denial("constraint_type_unrecognized", "chain", f'Parent constraint for "{tool}.{argument}" is malformed or of an unknown type.', token_index=index, tool=tool, argument=argument)
                )
                continue
            if not is_permitted_pair(parent_c["constraint_type"], child_c["constraint_type"]):
                out.append(
                    denial("constraint_type_not_permitted", "chain", f'Narrowing "{tool}.{argument}" from {parent_c["constraint_type"]} to {child_c["constraint_type"]} is not a permitted pair.', token_index=index, tool=tool, argument=argument)
                )
                continue
            if not subsumes(parent_c, child_c):
                out.append(
                    denial("constraint_expansion", "chain", f'Constraint on "{tool}.{argument}" is broader than the parent permits.', token_index=index, tool=tool, argument=argument)
                )
    return out


def verify_chain(tokens: list[str], trust_anchors: list[dict], now: int) -> tuple[Optional[VerifiedChain], list[Denial]]:
    if len(tokens) == 0:
        return None, [denial("chain_empty", "chain", "No tokens were presented.")]
    if len(tokens) > MAX_CHAIN_LENGTH:
        return None, [denial("chain_too_long", "chain", "Chain exceeds the limit.")]
    for i, t in enumerate(tokens):
        if not isinstance(t, str) or len(t) > MAX_TOKEN_BYTES:
            return None, [denial("token_too_large", "chain", "Token exceeds the permitted size.", token_index=i)]

    # Cycle detection first (step 2), before signature work.
    seen: set[str] = set()
    for i, t in enumerate(tokens):
        jti = _peek_jti(t)
        if jti is None:
            return None, [denial("token_malformed", "chain", "Token is not a valid compact JWS.", token_index=i)]
        if jti in seen:
            return None, [denial("chain_cycle_detected", "chain", "A token instance repeats in the chain.", token_index=i)]
        seen.add(jti)

    # --- Root ---
    if len(trust_anchors) == 0:
        return None, [denial("untrusted_root", "chain", "No trust anchors were configured.", token_index=0)]
    root_token = tokens[0]
    import json

    parts = root_token.split(".")
    if len(parts) != 3:
        return None, [denial("token_malformed", "chain", "Root token is not a valid compact JWS.", token_index=0)]
    raw = crypto.b64url_decode(parts[1])
    try:
        root = json.loads(raw) if raw is not None else None
    except ValueError:
        root = None
    if not _looks_like_payload(root):
        return None, [denial("token_malformed", "chain", "Root token is missing required claims.", token_index=0)]

    root_verified = any(crypto.verify_compact_jws(root_token, a) is not None for a in trust_anchors)
    if not root_verified:
        if not crypto.alg_permitted(root_token):
            return None, [denial("algorithm_not_permitted", "chain", "Root token algorithm is not permitted.", token_index=0)]
        return None, [denial("untrusted_root", "chain", "Root token is not signed by any configured trust anchor.", token_index=0)]

    if crypto.contains_private_key_material(root["cnf"]["jwk"]):
        return None, [denial("private_key_material", "chain", "Token cnf.jwk contains private key material.", token_index=0)]
    if len(root["jti"]) == 0:
        return None, [denial("token_malformed", "chain", "Root jti must be non-empty.", token_index=0)]
    if not _is_uri(root["iss"]):
        return None, [denial("token_malformed", "chain", "Root iss must be a URI.", token_index=0)]
    if root["del_depth"] != 0:
        return None, [denial("root_depth_invalid", "chain", "Root token must have del_depth 0.", token_index=0)]
    if root.get("par_hash") is not None:
        return None, [denial("par_hash_present_on_root", "chain", "Root token must not carry par_hash.", token_index=0)]
    if not isinstance(root["del_max_depth"], int) or root["del_max_depth"] < 0:
        return None, [denial("delegation_ceiling_invalid", "chain", "Root del_max_depth must be a non-negative integer.", token_index=0)]
    if root["del_max_depth"] > MAX_DELEGATION_DEPTH:
        return None, [denial("delegation_ceiling_invalid", "chain", "Root del_max_depth exceeds the implementation limit.", token_index=0)]

    temporal = _check_temporal(root, now, 0)
    if temporal:
        return None, temporal
    if root["exp"] <= root["iat"]:
        return None, [denial("expiry_not_after_issuance", "chain", "Root exp must be after iat.", token_index=0)]
    if root["exp"] > root["iat"] + MAX_TOKEN_LIFETIME_SECONDS:
        return None, [denial("lifetime_exceeded", "chain", "Root token lifetime exceeds the permitted maximum.", token_index=0)]

    root_tools = _tool_grants(root)
    if root_tools is None:
        return None, [denial("authorization_details_invalid", "chain", "Root token must carry exactly one attenuating_agent_token entry.", token_index=0)]
    if _exceeds_constraint_depth(root_tools):
        return None, [denial("constraint_too_deep", "chain", "A constraint tree exceeds the permitted nesting depth.", token_index=0)]

    verified = [(root, root_tools, crypto.jwk_thumbprint_uri(root["cnf"]["jwk"]))]

    # --- Derived tokens ---
    for index in range(1, len(tokens)):
        child_token = tokens[index]
        parent_payload, _parent_tools, parent_holder = verified[index - 1]
        child = crypto.verify_compact_jws(child_token, parent_payload["cnf"]["jwk"])
        if child is None:
            if not crypto.alg_permitted(child_token):
                return None, [denial("algorithm_not_permitted", "chain", "Derived token algorithm is not permitted.", token_index=index)]
            return None, [denial("invalid_signature", "chain", "Signature verification failed.", token_index=index)]
        if not _looks_like_payload(child):
            return None, [denial("token_malformed", "chain", "Derived token is missing required claims.", token_index=index)]
        if crypto.contains_private_key_material(child["cnf"]["jwk"]):
            return None, [denial("private_key_material", "chain", "Token cnf.jwk contains private key material.", token_index=index)]
        if len(child["jti"]) == 0:
            return None, [denial("token_malformed", "chain", "Token jti must be non-empty.", token_index=index)]
        if not (isinstance(child["del_depth"], int) and isinstance(child["del_max_depth"], int)):
            return None, [denial("token_malformed", "chain", "Depth claims must be integers.", token_index=index)]
        if child["iss"] != parent_holder:
            return None, [denial("issuer_thumbprint_mismatch", "chain", "Derived token issuer does not match the parent holder key's thumbprint URI.", token_index=index)]
        if child.get("par_hash") is None:
            return None, [denial("par_hash_missing", "chain", "Derived token must carry par_hash.", token_index=index)]
        if child["par_hash"] != crypto.parent_hash(tokens[index - 1]):
            return None, [denial("par_hash_mismatch", "chain", "par_hash does not bind to the presented parent.", token_index=index)]
        if child["del_depth"] != parent_payload["del_depth"] + 1:
            return None, [denial("delegation_depth_invalid", "chain", "del_depth must increment by exactly one.", token_index=index)]
        if child["del_depth"] > parent_payload["del_max_depth"]:
            return None, [denial("delegation_depth_exceeded", "chain", "del_depth exceeds the maximum the parent permits.", token_index=index)]
        if child["del_depth"] > MAX_DELEGATION_DEPTH:
            return None, [denial("delegation_depth_exceeded", "chain", "del_depth exceeds the implementation limit.", token_index=index)]
        if child["del_depth"] > child["del_max_depth"]:
            return None, [denial("depth_exceeds_own_ceiling", "chain", "del_depth exceeds the token own del_max_depth.", token_index=index)]
        if child["del_max_depth"] > parent_payload["del_max_depth"]:
            return None, [denial("delegation_ceiling_raised", "chain", "Derived token raises del_max_depth above the parent.", token_index=index)]

        temporal = _check_temporal(child, now, index)
        if temporal:
            return None, temporal
        if child["exp"] > parent_payload["exp"]:
            return None, [denial("expiry_exceeds_parent", "chain", "Derived token outlives its parent.", token_index=index)]
        if child["exp"] <= child["iat"]:
            return None, [denial("expiry_not_after_issuance", "chain", "Token exp must be after iat.", token_index=index)]
        if child["iat"] < parent_payload["iat"]:
            return None, [denial("issued_before_parent", "chain", "Derived token was issued before its parent.", token_index=index)]

        child_tools = _tool_grants(child)
        if child_tools is None:
            return None, [denial("authorization_details_invalid", "chain", "Derived token must carry exactly one attenuating_agent_token entry.", token_index=index)]
        if _exceeds_constraint_depth(child_tools):
            return None, [denial("constraint_too_deep", "chain", "A constraint tree exceeds the permitted nesting depth.", token_index=index)]

        narrowing = _verify_narrowing(_parent_tools, child_tools, index)
        if narrowing:
            return None, narrowing

        verified.append((child, child_tools, crypto.jwk_thumbprint_uri(child["cnf"]["jwk"])))

    leaf_payload, leaf_tools, leaf_holder = verified[-1]
    if len(verified) != leaf_payload["del_depth"] + 1:
        return None, [denial("chain_length_mismatch", "chain", "Chain length does not match the leaf delegation depth.", token_index=len(verified) - 1)]

    return (
        VerifiedChain(
            tokens=[v[0] for v in verified],
            leaf_tools=leaf_tools,
            leaf_holder=leaf_holder,
            expires_at=leaf_payload["exp"],
            depth=leaf_payload["del_depth"],
        ),
        [],
    )

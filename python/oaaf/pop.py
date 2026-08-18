"""Proof-of-possession verification (AAT -01).

Binds a presentation to the leaf holder's key and to the exact argument map of
one invocation. Argument binding is compared as RFC 8785 canonical bytes.
"""

from __future__ import annotations

from typing import Optional

from . import crypto
from .reasons import Denial, denial
from .verify import VerifiedChain

POP_FRESHNESS_SECONDS = 300


def verify_pop(
    pop: str,
    chain: VerifiedChain,
    tool: str,
    args: dict,
    now: int,
) -> list[Denial]:
    if not isinstance(pop, str) or len(pop) == 0:
        return [denial("pop_missing", "pop", "No proof of possession was presented.")]
    if not crypto.alg_permitted(pop):
        return [denial("algorithm_not_permitted", "pop", "Proof-of-possession algorithm is not permitted.")]

    leaf = chain.tokens[-1]
    jwk = leaf["cnf"]["jwk"]
    if jwk.get("kty") != "OKP":
        return [denial("holder_key_invalid", "pop", "Leaf holder key is not an OKP key.")]

    payload = crypto.verify_compact_jws(pop, jwk)
    if payload is None:
        return [denial("pop_signature_invalid", "pop", "Proof of possession is not signed by the leaf holder key.")]
    if not _looks_like_pop(payload):
        return [denial("pop_malformed", "pop", "Proof of possession is missing required claims.")]

    out: list[Denial] = []
    if payload["aat_id"] != leaf["jti"]:
        out.append(denial("pop_token_mismatch", "pop", "Proof of possession names a different leaf token."))
    if payload["aat_tool"] != tool:
        out.append(denial("pop_tool_mismatch", "pop", "Proof of possession names a different tool.", tool=tool))
    if abs(payload["iat"] - now) > POP_FRESHNESS_SECONDS:
        out.append(denial("pop_stale", "pop", "Proof of possession is outside the freshness window."))
    if crypto.jcs(payload["hta"]) != crypto.jcs(args):
        out.append(denial("pop_binding_mismatch", "pop", "Proof of possession is bound to a different argument map.", tool=tool))
    return out


def pop_audience(pop: str) -> Optional[str]:
    parts = pop.split(".")
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
    aud = payload.get("aat_aud") if isinstance(payload, dict) else None
    return aud if isinstance(aud, str) else None


def _looks_like_pop(v: dict) -> bool:
    return (
        isinstance(v.get("jti"), str)
        and isinstance(v.get("iat"), (int, float))
        and isinstance(v.get("aat_id"), str)
        and isinstance(v.get("aat_tool"), str)
        and isinstance(v.get("hta"), dict)
    )

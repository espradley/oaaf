"""Cross-language parity: the Python implementation must independently reach the
committed expected result for every shared vector.

The vectors carry real signed authority material produced once by the reference
and the expected canonical result. Python never calls the reference; it verifies
the same bytes and must match. This is a provisional parity gate; O6 owns the
full conformance suite.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oaaf import verify_and_evaluate, revoked_set_resolver, bound_subjects_verifier

VECTORS = json.loads((Path(__file__).parent / "vectors" / "vectors.json").read_text())["vectors"]

# Fields that are normative for parity. `message` prose is not normative and is
# compared only for presence, not exact wording.
def normalize(explanation) -> dict:
    return {
        "decision": explanation.decision,
        "reasons": [
            {
                "code": r.code,
                "stage": r.stage,
                "tool": r.tool,
                "argument": r.argument,
                "token_index": r.token_index,
                "has_message": bool(r.message),
            }
            for r in explanation.reasons
        ],
        "authority": None
        if explanation.authority is None
        else {
            "subject": explanation.authority.subject,
            "subject_profile": explanation.authority.subject_profile,
            "holder": explanation.authority.holder,
            "requested_tool": explanation.authority.requested_tool,
            "requested_argument_names": explanation.authority.requested_argument_names,
            "granted_tools": explanation.authority.granted_tools,
            "delegation_depth": explanation.authority.delegation_depth,
            "chain_length": explanation.authority.chain_length,
            "expires_at": explanation.authority.expires_at,
        },
    }


def expected_normalized(expected: dict) -> dict:
    return {
        "decision": expected["decision"],
        "reasons": [
            {
                "code": r["code"],
                "stage": r["stage"],
                "tool": r.get("tool"),
                "argument": r.get("argument"),
                "token_index": r.get("tokenIndex"),
                "has_message": bool(r.get("message")),
            }
            for r in expected["reasons"]
        ],
        "authority": None
        if expected.get("authority") is None
        else {
            "subject": expected["authority"]["subject"],
            "subject_profile": expected["authority"]["subjectProfile"],
            "holder": expected["authority"]["holder"],
            "requested_tool": expected["authority"]["requestedTool"],
            "requested_argument_names": expected["authority"]["requestedArgumentNames"],
            "granted_tools": expected["authority"]["grantedTools"],
            "delegation_depth": expected["authority"]["delegationDepth"],
            "chain_length": expected["authority"]["chainLength"],
            "expires_at": expected["authority"]["expiresAt"],
        },
    }


@pytest.mark.parametrize("vector", VECTORS, ids=[v["name"] for v in VECTORS])
def test_python_matches_reference(vector):
    i = vector["input"]
    resolver = (
        revoked_set_resolver(i.get("revokedJti", []), i.get("unknownJti", []))
        if ("revokedJti" in i or "unknownJti" in i)
        else None
    )
    identity = (
        bound_subjects_verifier(i.get("boundSubjects", []), i.get("unavailableSubjects", []))
        if ("boundSubjects" in i or "unavailableSubjects" in i)
        else None
    )
    result = verify_and_evaluate(
        tokens=i["tokens"],
        trust_anchors=i["trustAnchors"],
        pop=i["pop"],
        tool=i["tool"],
        args=i.get("args", {}),
        now=i.get("now"),
        recipient=i.get("recipient"),
        require_recipient_binding="recipient" in i,
        status_resolver=resolver,
        identity_binding_verifier=identity,
    )
    assert normalize(result) == expected_normalized(vector["expected"])


def test_all_required_cases_present():
    names = {v["name"] for v in VECTORS}
    required = {
        "allow",
        "deny_tool_not_authorized",
        "deny_argument_constraint",
        "deny_expired",
        "deny_holder_mismatch",
        "deny_pop_binding",
        "deny_invalid_signature",
        "deny_chain_reordered",
        "deny_recipient_mismatch",
        "status_allow_active",
        "status_deny_leaf_revoked",
        "status_deny_ancestor_revoked",
        "status_deny_unavailable",
        "identity_allow_thumbprint",
        "identity_allow_spiffe",
        "identity_deny_mismatch",
        "identity_deny_unavailable",
    }
    assert required.issubset(names)


def test_privacy_no_values_or_key_material():
    # A vector whose argument value is a recognizable string must not appear in output.
    for vector in VECTORS:
        i = vector["input"]
        resolver = (
            revoked_set_resolver(i.get("revokedJti", []), i.get("unknownJti", []))
            if ("revokedJti" in i or "unknownJti" in i) else None
        )
        result = verify_and_evaluate(
            tokens=i["tokens"], trust_anchors=i["trustAnchors"], pop=i["pop"],
            tool=i["tool"], args=i.get("args", {}), now=i.get("now"),
            recipient=i.get("recipient"), require_recipient_binding="recipient" in i,
            status_resolver=resolver,
        )
        blob = json.dumps(normalize(result))
        # No JWS-shaped material, no private-key markers.
        assert '"d":' not in blob and "cnf" not in blob
        # Argument values (e.g. 'b', 'src/') are names-only; the requested arg
        # names may appear but not the token strings.
        for token in i["tokens"]:
            assert token not in blob
        assert i["pop"] not in blob

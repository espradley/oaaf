"""Adversarial security — Python side (O6E).

The corpus already carries the attacks as deny vectors. This asserts that every
security-invariant deny vector in a profile the Python implementation claims
(Core, Status, Identity, PDP) actually fails closed here — the Python half of the
adversarial evidence in spec/0.1/conformance/security.md. The TypeScript
security.test.ts adds active mutation families on top; Python does not implement
the MCP/A2A bindings and does not claim those attack families.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oaaf import verify_and_evaluate, revoked_set_resolver, bound_subjects_verifier

ROOT = Path(__file__).resolve().parents[2] / "spec" / "0.1" / "conformance"
CATALOG = json.loads((ROOT / "requirements.json").read_text())
CORPUS = json.loads((ROOT / "vectors" / "corpus.json").read_text())

SECURITY_INVARIANTS = {r["id"] for r in CATALOG["requirements"] if r["security_invariant"]}
PY_PROFILES = {"Core", "Status", "Identity", "PDP"}

# Deny vectors, in a Python-claimed profile, that carry a security-invariant requirement.
ATTACK_VECTORS = [
    v
    for v in CORPUS["vectors"]
    if v["profile"] in PY_PROFILES
    and v["expected_decision"] == "deny"
    and any(r in SECURITY_INVARIANTS for r in v["requirements"])
]


def run(v):
    i = v["input"]
    status_resolver = (
        revoked_set_resolver(i.get("revoked_jti", []), i.get("unknown_jti", []))
        if ("revoked_jti" in i or "unknown_jti" in i)
        else None
    )
    identity = (
        bound_subjects_verifier(i.get("bound_subjects", []), i.get("unavailable_subjects", []))
        if ("bound_subjects" in i or "unavailable_subjects" in i)
        else None
    )
    return verify_and_evaluate(
        tokens=i["tokens"],
        trust_anchors=i["trust_anchors"],
        pop=i["pop"],
        tool=i["tool"],
        args=i.get("args", {}),
        now=i.get("now"),
        status_resolver=status_resolver,
        identity_binding_verifier=identity,
    )


def test_there_are_adversarial_vectors():
    # Sanity: the Python-claimed security surface is materially exercised.
    assert len(ATTACK_VECTORS) >= 15


@pytest.mark.parametrize("vector", ATTACK_VECTORS, ids=[v["vector_id"] for v in ATTACK_VECTORS])
def test_security_attack_fails_closed(vector):
    result = run(vector)
    assert result.decision == "DENY"
    assert result.reasons[0].code == vector["expected_normative_reason"]


def test_no_secret_value_leaks_in_python():
    """CORE-EXPL-003 adversarial: an argument value must not appear in the decision."""
    privacy = [v for v in CORPUS["vectors"] if "CORE-EXPL-003" in v["requirements"]]
    assert privacy
    for v in privacy:
        result = run(v)
        blob = json.dumps(
            {
                "decision": result.decision,
                "reasons": [
                    {"code": r.code, "message": r.message, "tool": r.tool, "argument": r.argument}
                    for r in result.reasons
                ],
            }
        )
        for value in v["input"].get("args", {}).values():
            assert str(value) not in blob

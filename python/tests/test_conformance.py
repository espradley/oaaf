"""Portable conformance corpus — Python side (O6B).

The Python implementation consumes the SAME language-neutral corpus the TypeScript
reference does, for the profiles it implements: Core, Status, and Identity. It does
not implement the A2A binding, so — exactly as the conformance-class model intends —
it skips A2A-profile vectors. It never calls the reference; it verifies the same
signed bytes and must produce each vector's portable contract.

The portable contract asserted here is `expected_decision` +
`expected_normative_reason` (plus subject/holder on allow, which O6A makes
normative). Stage labels, locator fields, and message wording are non-normative and
are not compared — an independent implementation is free to differ on them.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oaaf import verify_and_evaluate, revoked_set_resolver, bound_subjects_verifier

CORPUS = json.loads(
    (Path(__file__).resolve().parents[2] / "spec" / "0.1" / "conformance" / "vectors" / "corpus.json").read_text()
)
# Profiles this implementation claims. A2A is deliberately absent.
SUPPORTED_PROFILES = {"Core", "Status", "Identity"}
VECTORS = [v for v in CORPUS["vectors"] if v["profile"] in SUPPORTED_PROFILES]


def run(vector) -> object:
    i = vector["input"]
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


@pytest.mark.parametrize("vector", VECTORS, ids=[v["vector_id"] for v in VECTORS])
def test_python_satisfies_portable_contract(vector):
    result = run(vector)

    # decision
    assert result.decision == ("ALLOW" if vector["expected_decision"] == "allow" else "DENY")

    # normative reason (first reason for a deny; none for an allow)
    primary = result.reasons[0].code if result.reasons else None
    assert primary == vector["expected_normative_reason"]

    # subject/holder canonicalization is normative (CORE-SUBJ) — check on allow
    if vector["expected_decision"] == "allow" and vector["reference"].get("authority"):
        ref_auth = vector["reference"]["authority"]
        assert result.authority is not None
        assert result.authority.subject == ref_auth["subject"]
        assert result.authority.holder == ref_auth["holder"]


def test_core_profile_is_materially_covered():
    """Sanity: the corpus this implementation runs actually exercises Core broadly."""
    core = [v for v in VECTORS if v["profile"] == "Core"]
    assert len(core) >= 20
    # The central thesis vector must be present and be a deny.
    widening = next(v for v in core if v["vector_id"] == "core-narrow-widening-tool")
    assert widening["expected_decision"] == "deny"


def test_privacy_vectors_leak_no_values():
    """CORE-EXPL-003: an argument value must not appear in the serialized decision."""
    for vector in VECTORS:
        if "CORE-EXPL-003" not in vector["requirements"]:
            continue
        result = run(vector)
        blob = json.dumps(
            {
                "decision": result.decision,
                "reasons": [
                    {"code": r.code, "message": r.message, "tool": r.tool, "argument": r.argument}
                    for r in result.reasons
                ],
            }
        )
        for value in vector["input"].get("args", {}).values():
            assert str(value) not in blob

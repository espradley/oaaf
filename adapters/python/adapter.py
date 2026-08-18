#!/usr/bin/env python3
"""Reference conformance adapter — Python (O6C).

Speaks the oaaf-conform JSON-lines protocol (spec/0.1/conformance/runner.md) over
stdin/stdout, answering vectors with the OAAF Python implementation. It claims the
profiles that implementation supports — Core, Status, Identity — and does NOT claim
A2A, so the runner reports A2A as unclaimed rather than failed.

This adapter uses the `oaaf` package because it IS the reference Python
implementation. A third-party adapter would use its own implementation; the runner
requires no OAAF code.
"""

import json
import sys

from oaaf import verify_and_evaluate, revoked_set_resolver, bound_subjects_verifier

PROFILES = ["Core", "Status", "Identity"]


def say(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def evaluate(v):
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
    result = verify_and_evaluate(
        tokens=i["tokens"],
        trust_anchors=i["trust_anchors"],
        pop=i["pop"],
        tool=i["tool"],
        args=i.get("args", {}),
        now=i.get("now"),
        status_resolver=status_resolver,
        identity_binding_verifier=identity,
    )
    output = json.dumps(
        {
            "decision": result.decision,
            "reasons": [
                {"code": r.code, "message": r.message, "tool": r.tool, "argument": r.argument}
                for r in result.reasons
            ],
        }
    )
    return {
        "type": "result",
        "vector_id": v["vector_id"],
        "decision": result.decision.lower(),
        "reason": result.reasons[0].code if result.reasons else None,
        "output": output,
    }


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        msg = json.loads(line)
        if msg["type"] == "hello":
            say({"type": "hello", "adapter": "oaaf-python", "profiles": PROFILES})
        elif msg["type"] == "evaluate":
            say(evaluate(msg))
        elif msg["type"] == "bye":
            break


if __name__ == "__main__":
    main()

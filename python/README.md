# oaaf (Python)

An **independent** Python implementation of the Open Agent Authority Framework's authority
contract. TypeScript ([`@oaaf/sdk`](../packages/typescript/)) and this package are two
implementations of the same normative behavior — authority verification and evaluation,
the canonical reason codes, and the `DecisionExplanation` — not a port of one to the other.

> **Status: early (pre-v1, `0.x`).** Not published to PyPI. The RFCs and adopted standards
> are the specification; both implementations answer to them.

## Install (local)

```bash
pip install -e .        # from this directory
# or build artifacts:
pip install build && python -m build
```

Requires **Python 3.11+**. Runtime dependencies: `cryptography` (Ed25519/JWS) and
`rfc8785` (RFC 8785 JSON canonicalization). No network access is needed at runtime.

## Use

```python
from oaaf import verify_and_evaluate

result = verify_and_evaluate(
    tokens=tokens,            # AAT delegation chain, root first (compact JWS strings)
    trust_anchors=anchors,    # public JWKs trusted as root issuers
    pop=pop,                  # proof-of-possession JWT
    tool="repo.read",
    args={"path": "src/"},
    now=1_780_000_001,        # optional; defaults to current time
)

if result.decision == "ALLOW":
    ...  # result.authority is an AuthoritySummary
else:
    for r in result.reasons:  # each: code, stage, message, tool?, argument?, token_index?
        print(r.code, r.stage, r.tool, r.argument)
```

## Implementation-independence promise

This implementation is built from OAAF's published contracts and standards basis, not by
translating TypeScript internals. For the same signed authority material and requested
operation it reproduces the same:

- ALLOW / DENY decision
- canonical reason code(s)
- verification/evaluation stage
- tool / argument-name / token-index locators
- `AuthoritySummary` semantics

with the same privacy properties: **names, never values** — no argument values, token
bytes, signatures, PoP material, or keys.

That equivalence is enforced by the cross-language parity vectors in
[`tests/vectors`](tests/vectors), which carry real signed material verified independently
by both implementations.

## Relationship to the TypeScript reference

`@oaaf/sdk` is the reference implementation, not the specification. Where this
implementation and the reference disagree, the RFCs and adopted standards decide, and the
disagreement is a contract defect to surface — not something to paper over with a
compatibility shim.

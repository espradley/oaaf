# oaaf (Python)

An **independent** Python implementation of the Open Agent Authority Framework's authority
contract. TypeScript ([`@oaaf/sdk`](../packages/typescript/)) and this package are two
implementations of the same normative behavior — authority verification and evaluation,
the canonical reason codes, and the `DecisionExplanation` — not a port of one to the other.

> **Status: early (pre-v1, `0.x`).** Published on PyPI as `oaaf`. The RFCs and adopted
> standards are the specification; both implementations answer to them.

## Install

```bash
pip install oaaf
```

For local development from this directory: `pip install -e .`.

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

# Optional revocation (RFC-0004): pass a status resolver; every chain member is
# checked, fail-closed on unknown. Without one, verification is expiry-only.
from oaaf import revoked_set_resolver
# verify_and_evaluate(..., status_resolver=revoked_set_resolver({"revoked-jti"}))

if result.decision == "ALLOW":
    ...  # result.authority is an AuthoritySummary
else:
    for r in result.reasons:  # each: code, stage, message, tool?, argument?, token_index?
        print(r.code, r.stage, r.tool, r.argument)
```

## Existing PDP interoperability

OAAF can sit in front of an existing policy engine rather than replacing it
([RFC-0006](../rfcs/0006-pdp-interoperability.md)). `to_authority_context` turns a
verified authority into the canonical, PDP-neutral authority context — names, never values
— which an AuthZEN/OPA/Cedar PDP consumes as context. `authority_verified=True` is OAAF's
authority decision, not a policy permit; the PDP still decides.

```python
from oaaf import verify_chain, to_authority_context

chain, denials = verify_chain(tokens, trust_anchors, now)
if chain is not None:
    oaaf = to_authority_context(chain, tool, args)
    # hand `oaaf` to your PDP as context; it owns the policy decision.
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

That equivalence is enforced by the language-neutral
[portable conformance corpus](../spec/0.1/conformance/vectors/README.md), which carries real
signed material both implementations verify independently. Python runs the Core, Status, and
Identity profiles; it does not claim the A2A binding, and skips those vectors.

## Relationship to the TypeScript reference

`@oaaf/sdk` is the reference implementation, not the specification. Where this
implementation and the reference disagree, the RFCs and adopted standards decide, and the
disagreement is a contract defect to surface — not something to paper over with a
compatibility shim.

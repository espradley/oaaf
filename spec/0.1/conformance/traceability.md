# Traceability — requirements ↔ vectors

Two directions of traceability, both required by the O6A brief: every existing shared
vector maps to the requirement(s) it exercises, and every requirement records whether a
vector covers it. The gap column is the concrete work list handed to O6B.

> The 18 shared TS/Python vectors are **evidence and seeds**, not the O6 conformance
> suite. O6B owns the final, versioned corpus; this mapping tells it where to start and
> what is missing. A vector without a requirement, or a testable `MUST` without a planned
> vector, is a defect this table exists to prevent.

## Existing shared vectors → requirements

| Vector                                  | Exercises                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `allow`                                 | `CORE-CRYPTO-001`, `CORE-CHAIN-001`, `CORE-CRYPTO-003`, `CORE-POP-001`, `CORE-CONSTR-003`, `CORE-SUBJ-001`, `CORE-DEC-001`, `CORE-EXPL-001` |
| `deny_tool_not_authorized`              | `CORE-CONSTR-003`, `CORE-EXPL-002`                                                                                                          |
| `deny_argument_constraint`              | `CORE-CONSTR-002`, `CORE-EXPL-002`                                                                                                          |
| `deny_expired`                          | `CORE-TIME-001`                                                                                                                             |
| `deny_holder_mismatch`                  | `CORE-POP-003`                                                                                                                              |
| `deny_pop_binding`                      | `CORE-POP-001`, `CORE-POP-003`                                                                                                              |
| `deny_invalid_signature`                | `CORE-CRYPTO-001`                                                                                                                           |
| `deny_chain_reordered`                  | `CORE-CHAIN-001`                                                                                                                            |
| `deny_recipient_mismatch`               | `A2A-003`                                                                                                                                   |
| `status_allow_active`                   | `STATUS-001`, `STATUS-006`                                                                                                                  |
| `status_deny_leaf_revoked`              | `STATUS-002`                                                                                                                                |
| `status_deny_ancestor_revoked`          | `STATUS-004`                                                                                                                                |
| `status_deny_unavailable`               | `STATUS-003`                                                                                                                                |
| `identity_allow_thumbprint`             | `CORE-SUBJ-001`, `CORE-SUBJ-002`                                                                                                            |
| `identity_allow_spiffe`                 | `CORE-SUBJ-001`, `IDENT-003`                                                                                                                |
| `identity_allow_spiffe_issuer_asserted` | `IDENT-003`                                                                                                                                 |
| `identity_deny_mismatch`                | `IDENT-001`                                                                                                                                 |
| `identity_deny_unavailable`             | `IDENT-002`                                                                                                                                 |

All 18 map to at least one requirement; there are **no orphan vectors**.

## Requirements → coverage (the O6B gap list)

Coverage kinds: **V** = a shared vector already exercises it; **G** = gap, O6B must add a
vector; **D** = design/structural requirement certified by inspection or an API-shape
check rather than a data vector (noted where mechanical testing does not apply).

| Requirement        | Kind | Covered by / O6B action                                                                    |
| ------------------ | ---- | ------------------------------------------------------------------------------------------ |
| `CORE-TRUST-001`   | G    | **gap** — O6B to add a vector                                                              |
| `CORE-TRUST-002`   | G    | **gap** — O6B to add a vector                                                              |
| `CORE-CRYPTO-001`  | V    | `allow`, `deny_invalid_signature`                                                          |
| `CORE-CRYPTO-002`  | G    | **gap** — O6B to add a vector                                                              |
| `CORE-CRYPTO-003`  | V    | `allow`                                                                                    |
| `CORE-CRYPTO-004`  | G    | **gap** — O6B to add a vector                                                              |
| `CORE-CRYPTO-005`  | G    | **gap** — O6B to add a vector                                                              |
| `CORE-CHAIN-001`   | V    | `allow`, `deny_chain_reordered`                                                            |
| `CORE-CHAIN-002`   | G    | **gap** — O6B to add a vector                                                              |
| `CORE-CHAIN-003`   | G    | **gap** — O6B to add a vector                                                              |
| `CORE-DELEG-001`   | G    | **gap** — O6B to add a vector                                                              |
| `CORE-DELEG-002`   | G    | **gap** — O6B to add a vector                                                              |
| `CORE-NARROW-001`  | G    | **gap** — O6B to add a vector                                                              |
| `CORE-NARROW-002`  | G    | **gap** — O6B to add a vector                                                              |
| `CORE-NARROW-003`  | G    | **gap** — O6B to add a vector                                                              |
| `CORE-NARROW-004`  | G    | **gap** — O6B to add a vector                                                              |
| `CORE-CONSTR-001`  | G    | **gap** — O6B to add a vector                                                              |
| `CORE-CONSTR-002`  | V    | `deny_argument_constraint`                                                                 |
| `CORE-CONSTR-003`  | V    | `allow`, `deny_tool_not_authorized`                                                        |
| `CORE-CONSTR-004`  | G    | **gap** — O6B to add a vector                                                              |
| `CORE-TIME-001`    | V    | `deny_expired`                                                                             |
| `CORE-TIME-002`    | G    | **gap** — O6B to add a vector                                                              |
| `CORE-TIME-003`    | G    | **gap** — O6B to add a vector                                                              |
| `CORE-POP-001`     | V    | `allow`, `deny_pop_binding`                                                                |
| `CORE-POP-002`     | D    | design/structural — certified by inspection; not a data vector                             |
| `CORE-POP-003`     | V    | `deny_holder_mismatch`, `deny_pop_binding`                                                 |
| `CORE-POP-004`     | D    | design/structural — certified by inspection; not a data vector                             |
| `CORE-SUBJ-001`    | V    | `allow`, `identity_allow_thumbprint`, `identity_allow_spiffe`                              |
| `CORE-SUBJ-002`    | V    | `identity_allow_thumbprint`                                                                |
| `CORE-DEC-001`     | V    | `allow`                                                                                    |
| `CORE-DEC-002`     | G    | **gap** — O6B to add a vector                                                              |
| `CORE-DEC-003`     | D    | design/structural — certified by inspection; not a data vector (not mechanically testable) |
| `CORE-DEC-004`     | G    | **gap** — O6B to add a vector                                                              |
| `CORE-EXPL-001`    | V    | `allow`                                                                                    |
| `CORE-EXPL-002`    | V    | `deny_tool_not_authorized`, `deny_argument_constraint`                                     |
| `CORE-EXPL-003`    | G    | **gap** — O6B to add a vector                                                              |
| `CORE-EXPL-004`    | D    | design/structural — certified by inspection; not a data vector (not mechanically testable) |
| `CORE-NEUTRAL-001` | D    | design/structural — certified by inspection; not a data vector (not mechanically testable) |
| `CORE-NEUTRAL-002` | D    | design/structural — certified by inspection; not a data vector (not mechanically testable) |
| `CORE-NEUTRAL-003` | D    | design/structural — certified by inspection; not a data vector (not mechanically testable) |
| `CORE-NEUTRAL-004` | D    | design/structural — certified by inspection; not a data vector (not mechanically testable) |
| `CORE-NEUTRAL-005` | D    | design/structural — certified by inspection; not a data vector (not mechanically testable) |
| `STATUS-001`       | V    | `status_allow_active`                                                                      |
| `STATUS-002`       | V    | `status_deny_leaf_revoked`                                                                 |
| `STATUS-003`       | V    | `status_deny_unavailable`                                                                  |
| `STATUS-004`       | V    | `status_deny_ancestor_revoked`                                                             |
| `STATUS-005`       | G    | **gap** — O6B to add a vector                                                              |
| `STATUS-006`       | V    | `status_allow_active`                                                                      |
| `IDENT-001`        | V    | `identity_deny_mismatch`                                                                   |
| `IDENT-002`        | V    | `identity_deny_unavailable`                                                                |
| `IDENT-003`        | V    | `identity_allow_spiffe`, `identity_allow_spiffe_issuer_asserted`                           |
| `IDENT-004`        | G    | **gap** — O6B to add a vector                                                              |
| `IDENT-005`        | D    | design/structural — certified by inspection; not a data vector (not mechanically testable) |
| `MCP-001`          | G    | **gap** — O6B to add a vector                                                              |
| `MCP-002`          | D    | design/structural — certified by inspection; not a data vector                             |
| `MCP-003`          | D    | design/structural — certified by inspection; not a data vector                             |
| `A2A-001`          | G    | **gap** — O6B to add a vector                                                              |
| `A2A-002`          | G    | **gap** — O6B to add a vector                                                              |
| `A2A-003`          | V    | `deny_recipient_mismatch`                                                                  |
| `A2A-004`          | D    | design/structural — certified by inspection; not a data vector                             |
| `PDP-001`          | D    | design/structural — certified by inspection; not a data vector (not mechanically testable) |
| `PDP-002`          | G    | **gap** — O6B to add a vector                                                              |
| `PDP-003`          | D    | design/structural — certified by inspection; not a data vector (not mechanically testable) |
| `PDP-004`          | G    | **gap** — O6B to add a vector                                                              |

## O6B coverage-gap summary

- Requirements exercised by an existing vector: **22**
- Design/structural (inspection, not a vector): **15**
- **Gaps for O6B to close: 27**

Highest-value gaps (security invariants with no current vector):

- `CORE-TRUST-001` — Verification MUST require an explicit trust-anchor set. Its absence is a configuration error, never a permissive default, and there MUST NOT be a mode that returns an authorization decision without one.
- `CORE-TRUST-002` — The root token MUST be verified against a configured trust anchor, not against its own cnf.jwk. A self-signed root that matches no anchor MUST be rejected.
- `CORE-CRYPTO-002` — An unsecured token (alg "none") MUST NOT be accepted, and a token MUST be verified only under a signature algorithm the pinned AAT profile permits; algorithm substitution MUST be rejected.
- `CORE-CRYPTO-004` — A cnf.jwk MUST NOT contain private key material; a confirmation key carrying a private component MUST be rejected.
- `CORE-CHAIN-003` — A derived token's par_hash MUST match its parent, and a root token MUST NOT carry par_hash; either violation MUST deny.
- `CORE-DELEG-001` — A derived token MUST NOT raise del_max_depth above its parent's value; the ceiling is monotonic down the chain.
- `CORE-DELEG-002` — A token whose delegation depth exceeds the effective ceiling MUST deny.
- `CORE-NARROW-001` — A verifier MUST reject a delegation that grants authority (a tool) absent from its parent. Authority may only narrow across a delegation, never widen.
- `CORE-NARROW-002` — A derived constraint on a tool MUST NOT expand the parent's constraint; a derived clause MUST admit only a subset of the parent's permitted invocations.
- `CORE-NARROW-003` — For a constrained tool under a closed-world key set, a derived token MUST name exactly the same argument keys as its parent; adding or dropping a key MUST deny.
- `CORE-NARROW-004` — An unrecognized constraint type, or a subsumption pair the profile does not permit, MUST deny (fail closed) rather than be treated as satisfied.
- `CORE-CONSTR-001` — A constrained argument is required: a request that omits an argument the leaf authority constrains MUST deny.
- `CORE-TIME-003` — A derived token's validity window MUST NOT exceed its parent's; a later expiry or an earlier issuance than the parent MUST deny.
- `CORE-DEC-002` — Unknown, malformed, or unverifiable required authority MUST NOT degrade into ALLOW.
- `CORE-DEC-004` — Where the same authority material is accepted through more than one supported binding, the canonical authority decision MUST NOT change because of the transport.
- `CORE-EXPL-003` — An explanation MUST NOT include key material, raw token bytes, signatures, proof-of-possession material, or argument values the caller did not already supply.
- `STATUS-005` — A resolver backed by a bounded-freshness status artifact MUST treat an artifact past its freshness as unknown, not as its last-known contents.
- `IDENT-004` — An OIDC subject MUST be composed with its issuer into a collision-safe URI; a bare sub MUST NOT be used alone across issuers.
- `MCP-001` — OAAF authority MUST be enforced as a precondition before the COAZ AuthZEN request is constructed; on any OAAF denial the PEP MUST refuse immediately and MUST NOT proceed to the PDP.
- `A2A-001` — A skill gated by OAAF MUST declare the OAAF extension required; if the extension was not activated, the agent MUST refuse the operation and MUST NOT perform it.
- `A2A-002` — Before any consequential operation on a gated skill, the agent MUST verify OAAF authority; a request lacking verifiable authority material MUST deny.
- `PDP-002` — The authority context MUST be derived only from a verified authority; its authorityVerified marker states OAAF's authority decision, not that the action is permitted.
- `PDP-004` — The authority context MUST carry names, never values, matching the privacy rule of the explanation.

Notably, the project's central thesis requirement `CORE-NARROW-001` (a delegation MUST NOT
grant authority absent from its parent — no widening) has **no dedicated static vector
yet**: the existing `allow` chain narrows correctly and `deny_tool_not_authorized` covers a
leaf overreach, but a child token that _widens_ its parent's tool set is not yet a shared
fixture. O6B should treat it as a first vector to add.

Binding and PDP profiles (`MCP-001`, `A2A-001`, `A2A-002`, `PDP-002`, `PDP-004`) are
exercised today only by in-implementation tests, not shared cross-language vectors; O6D
owns binding conformance and will promote them.

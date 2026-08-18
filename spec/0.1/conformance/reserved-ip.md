# Reserved-IP assessment

Per [CHARTER §Reserved concepts](../../../CHARTER.md), OAAF must not publicly define a set of
reserved DigitalStack execution-control concepts until an explicit IP review has completed.
This assessment runs that boundary over **every** requirement in
[`requirements.json`](requirements.json).

## Result: PASS — no reserved concept is normalized

The conformance specification is entirely about **authority validity** — is a presented
delegated authority cryptographically valid, in scope, unrevoked (if status is claimed), and
held by the right key/subject? It says nothing about **execution control**.

| Reserved concept                                               | Appears in any requirement? | Why not                                                                            |
| -------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------- |
| Logical execution continuity                                   | No                          | No requirement references execution, continuation, or session lifecycle.           |
| Worker supersession algorithms                                 | No                          | No requirement selects, ranks, or replaces a worker.                               |
| Recovery detection / authority transfer / execution takeover   | No                          | Trust-anchor rotation (RFC-0004) is key invalidation, not recovery.                |
| Retry / continuation authority behavior                        | No                          | Requirements evaluate a single presented authority; they do not drive retries.     |
| Workforce recovery state machines                              | No                          | No state machine over a workforce is defined.                                      |
| Rules for when an authority version/freshness value advances   | No                          | See the freshness note below — deliberately excluded.                              |
| Automatic grant-lifecycle changes from runtime/workforce state | No                          | Grants are bounded by `exp` and external revocation truth, never by runtime state. |
| Authority ↔ scheduling / capacity / readiness interactions     | No                          | No requirement references scheduling, capacity, or readiness.                      |

## The two adjacent surfaces, and why they stay clear

- **Status/revocation (`STATUS-*`)** conveys _external_ revocation truth (a `jti` is active,
  revoked, or unknown) supplied by a deployment's resolver. It is **not** the reserved
  "freshness/version advances" concept: the conformance spec defines _how a verifier consumes_
  a three-valued status answer, and explicitly does **not** define _when or why_ any freshness
  or version value changes. That determination remains reserved. Should OAAF ever expose a
  freshness value, CHARTER already constrains it to an opaque, externally-supplied input —
  which is a future RFC, not part of this specification.
- **PDP interoperability (`PDP-*`)** stops at conveying verified authority facts. `PDP-001`
  makes the boundary normative: OAAF decides authority validity; the organization's PDP decides
  policy. Workforce orchestration, worker selection, and execution lifecycle sit **above** the
  PDP, entirely outside OAAF.

## Conclusion

Conformance applies to **authority, not execution control**. No requirement in this
specification normalizes, standardizes, or even names a reserved execution-continuity concept.
The boundary in CHARTER and [ADR-0001](../../../docs/adr/0001-oaaf-digitalstack360-separation.md)
/ [ADR-0002](../../../docs/adr/0002-reserved-execution-continuity-semantics.md) is preserved.

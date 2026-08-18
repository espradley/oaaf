# Standards reconciliation & v1 dependency readiness

OAAF is deliberately built on standards moving at different speeds. Before a v1 freeze the
question is not "did any draft get a new revision?" but:

> **Can OAAF freeze a v1 interoperability contract on these dependencies without freezing
> obsolete, unstable, or accidentally OAAF-invented behavior?**

This document records a **fresh primary-source audit** (August 2026) and classifies every
external dependency for v1. It does not upgrade anything: a newer revision is not adopted
merely because it exists — normative behavior is compared first.

## Classification key

| Outcome                 | Meaning                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| **STABLE**              | Published / final; suitable to underpin OAAF v1 directly.         |
| **PINNED**              | A draft OAAF can safely profile at a specific, archived revision. |
| **EXPERIMENTAL**        | Useful but kept outside required Core/v1 guarantees.              |
| **REPLACE / RECONCILE** | Upstream changed enough that OAAF must adapt before freeze.       |

## Compatibility matrix

| Dependency                                 | OAAF v1 target                                     | Audited state (Aug 2026)                                                                                  | Outcome          | Role in OAAF            |
| ------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------- |
| **AuthZEN Authorization API**              | 1.0 Final                                          | **Final Specification** (approved Jan 2026, published Mar 2026; not subject to revision)                  | **STABLE**       | Decision model          |
| **AAT**                                    | `draft-niyikiza-oauth-attenuating-agent-tokens-01` | `-01` latest; individual draft, **no formal standing**, active, expires 17 Dec 2026; **no `-02` exists**  | **PINNED**       | Delegated authority     |
| **A2A**                                    | 1.0.1                                              | v1.0 (Apr 2026) stable core; **1.0.1** (May 2026) adds the extension mechanism; Linux Foundation-governed | **STABLE**       | Agent binding           |
| **COAZ (MCP profile)**                     | AuthZEN MCP Tool-Authorization profile             | Advanced from an individual "Draft 1" to an **official AuthZEN WG Draft**                                 | **PINNED**       | MCP binding             |
| **SPIFFE JWT-SVID**                        | applicable stable specs                            | Stable                                                                                                    | **STABLE**       | Identity                |
| **WIMSE Workload Identifier**              | `draft-ietf-wimse-identifier-03`                   | `-03`, WIMSE **WG-adopted**, active (expires 7 Jan 2027)                                                  | **EXPERIMENTAL** | Identity                |
| **Token Status List**                      | pinned draft state                                 | `-21`, **in the RFC Editor Queue** (Standards Track; approved, awaiting RFC number)                       | **EXPERIMENTAL** | Status                  |
| **JOSE / JWS / EdDSA (RFC 8037)**          | applicable RFCs                                    | Published RFCs                                                                                            | **STABLE**       | Crypto                  |
| **JWT (RFC 7519)**                         | RFC 7519                                           | Published                                                                                                 | **STABLE**       | Token envelope / `sub`  |
| **`cnf` (RFC 7800)**                       | RFC 7800                                           | Published                                                                                                 | **STABLE**       | PoP key confirmation    |
| **JCS (RFC 8785)**                         | RFC 8785                                           | Published                                                                                                 | **STABLE**       | Canonicalization        |
| **JWK Thumbprint / URI (RFC 7638 / 9278)** | RFCs 7638, 9278                                    | Published                                                                                                 | **STABLE**       | Issuer link / holder id |

**No dependency is `REPLACE / RECONCILE`.** Every movement since OAAF pinned is a
_stabilization_, not a break: AuthZEN reached Final, A2A shipped its extension mechanism, COAZ
became a WG Draft, and Token Status List entered the RFC Editor Queue.

## The one real risk: AAT

Everything OAAF Core rests on for **crypto (JOSE RFCs), the decision model (AuthZEN Final), and
identity (SPIFFE)** is on stable, published ground. The single draft the **Core** thesis depends
on is **AAT `-01`**, an individual Internet-Draft with no formal standing that expires
17 December 2026.

- **No `-02` exists**, so there is nothing to compare or upgrade to. The "do not auto-upgrade a
  draft" rule is moot for now, and the pin remains correct.
- Should an `-02` appear, O6F's rule stands: **compare normative behavior first** — attenuation,
  PoP, claim shapes, subsumption, chain verification — and produce an explicit compatibility
  analysis before changing anything. A revision that changes any of those is a **new profile
  version** (fixtures are already namespaced by revision), not a silent bump.

## Profile-decision reconciliation

For every OAAF fail-closed interpretation or PROFILE decision: did upstream since clarify it?

| OAAF decision                                                    | Upstream since?                                     | Reconciliation                                                                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AAT→AuthZEN request mapping (RFC-0001)                           | AuthZEN reached **Final** — request shape unchanged | **Keep explicit.** Still an OAAF profile; the target is now more stable, not different.                                                                                 |
| OAAF reason codes (AAT defines none)                             | AAT `-01` unchanged; still defines no error codes   | **Keep explicit.** OAAF-owned by necessity.                                                                                                                             |
| Fail-closed trust anchors; PoP-required-for-enforcement          | AAT `-01` algorithm unchanged                       | **Keep explicit.** Derived from AAT `-01`, still valid.                                                                                                                 |
| Semantic resource binding deferred (R2, pending MCP metadata)    | COAZ MCP profile advanced to WG Draft               | **Still deferred.** Revisit against COAZ's `x-coaz-mapping` in a post-v1 RFC, not now.                                                                                  |
| Revocation via a resolver contract, not a wire format (RFC-0004) | Token Status List entered the **RFC Editor Queue**  | **Keep the abstraction.** When it publishes as an RFC, a concrete Status wire profile becomes a _post-v1 promotion opportunity_; the resolver contract does not change. |
| Identity via `sub` URI; SPIFFE stable, WIMSE experimental        | No conflicting upstream change                      | **Keep explicit.** WIMSE stays experimental until it stabilizes.                                                                                                        |

**No conflicts and no obsolete workarounds** were found — OAAF is not carrying historical
patches for ambiguities upstream has since resolved. Two forward opportunities are noted
(Status List → RFC, COAZ → WG Draft) but neither forces a v1 change.

## v1-readiness test: if every draft disappeared tomorrow

_How much of OAAF Core remains independently well-defined if AAT `-01`, COAZ, WIMSE, and Token
Status List all vanished from their archives?_

- **The verification _semantics_ survive completely.** OAAF's [requirement catalog](requirements.json)
  (64 requirements, 44 security invariants), the [portable corpus](vectors/corpus.json) of 51
  real signed vectors with expected outcomes, the [security certification](security.md), and the
  RFC-0001 conformance notes define chain order, thumbprint linkage, monotonic delegation depth,
  closed-world key sets, constraint subsumption, PoP binding, and fail-closed behavior **without
  reference to the AAT text**. These are OAAF-owned and archival-permanent.
- **The decision, crypto, and identity layers do not disappear** — AuthZEN 1.0 Final, the JOSE/JWT
  RFCs, and SPIFFE are stable published standards.
- **The gap is the token _wire format_.** OAAF pins the AAT `-01` claim shape (`authorization_details`
  with the AAT type, `del_depth` / `del_max_depth` / `par_hash` / `cnf`, the constraint grammar)
  **by reference plus fixtures**, not in a standalone OAAF document. If the AAT draft lapsed, the
  exact claim shape would be recoverable from the corpus (the vectors are real tokens) and the
  requirements, but not from a single normative OAAF wire-format spec.

**Verdict:** Core does **not** collapse if the drafts vanish — the semantics and most layers are
self-standing — but Core is **not yet fully self-contained** either, because the AAT `-01` wire
format lives by reference. That is the strong-but-honest position:

> **Recommendation for O6G/O6H:** add an explicit _profiled AAT-`-01` claim-shape appendix_ to the
> spec, so a pinned AAT-`-01`-compatible token format is permanently implementable **from OAAF's
> own archived artifacts alone**, independent of whether the individual draft is ever republished.
> This converts "Core depends on a draft that might expire" into "Core profiles a frozen,
> self-archived revision" — a materially stronger footing to call v1.

## Summary for v1

- **Freeze-ready today:** AuthZEN 1.0 Final, A2A 1.0.1, SPIFFE, and all JOSE/JWT/JCS/thumbprint
  RFCs — the decision, binding, identity, and crypto foundations are STABLE.
- **Freeze with a pin:** AAT `-01` and COAZ, as explicitly profiled draft revisions.
- **Keep out of Core v1 guarantees:** WIMSE and Token Status List remain EXPERIMENTAL, isolated
  to optional profiles.
- **One pre-freeze action recommended (not a blocker):** the profiled AAT claim-shape appendix,
  so Core is implementable from OAAF's archive alone.

Sources for the audit are cited in the commit; primary sources are the IETF Datatracker document
pages and the OpenID Foundation / Linux Foundation announcements.

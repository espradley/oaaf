# What is OAAF 1.0?

The definitive, human-readable answer to _"what exactly constitutes OAAF 1.0?"_ — so no one has
to reconstruct it from git history. The authoritative machine-readable version is the
[freeze manifest](manifest.json) (status: **frozen**); this page narrates it.

> **OAAF Core 1.0 is a frozen interoperability contract, not a software release.** An
> implementation in any language conforms by satisfying the artifacts below. Publishing 1.0.0 of
> the reference packages is a separate, deliberate step — the contract and the SDK/package
> versions are [decoupled](compatibility.md).

## The artifact set

| #   | Artifact                                                                  | What it fixes                                                                                                                                                |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Core requirements** — [requirements.json](requirements.json)            | The 64 normative requirements (44 security invariants) that define Core and the five profiles.                                                               |
| 2   | **AAT compatibility profile** — [aat-profile.md](aat-profile.md)          | The frozen AAT-`-01` claim subset, relationships, constraint grammar, and PoP requirements — so the token format is implementable from OAAF's archive alone. |
| 3   | **Normative reason codes** — [reason-codes.json](reason-codes.json)       | The 19 core-normative + 8 profile-normative codes that are the interoperability contract; 26 diagnostics are implementation-specific.                        |
| 4   | **Portable corpus** — [vectors/corpus.json](vectors/corpus.json)          | 51 language-neutral static vectors (real signed tokens + expected outcomes), consumable without OAAF code.                                                   |
| 5   | **Conformance runner protocol** — [runner.md](runner.md)                  | The language-agnostic adapter protocol an implementation uses to prove conformance; the runner emits self-declared evidence with corpus + manifest hashes.   |
| 6   | **Optional profile definitions** — [classification.md](classification.md) | Status, Identity, MCP, A2A, PDP — what each requires and where it is experimental.                                                                           |
| 7   | **Security certification artifact** — [security.md](security.md)          | Every security invariant mapped to its attack family and adversarial evidence (41 attacks).                                                                  |
| 8   | **Compatibility policy** — [compatibility.md](compatibility.md)           | 1.x vs 2.0 rules, draft-backed-profile nuance, and contract-vs-SDK-API separation.                                                                           |
| 9   | **Freeze manifest** — [manifest.json](manifest.json)                      | The machine-readable artifact set with sha256 hashes; `check:manifest` fails on drift.                                                                       |

Supporting (non-normative) documents: [standards.md](standards.md),
[standards-readiness.md](standards-readiness.md), [traceability.md](traceability.md),
[reserved-ip.md](reserved-ip.md).

## Conformance classes

One mandatory **Core** (portable authority verification — crypto, trust anchors, delegation,
attenuation, constraints, expiry, PoP, canonical subject, fail-closed, and the privacy-safe
decision/reason contract) plus five optional profiles: **Status**, **Identity**, **MCP**,
**A2A**, **PDP**. Unqualified "OAAF-conformant" means Core.

## Standards footing

Frozen on **stable** ground — AuthZEN Authorization API 1.0 Final, A2A 1.0.1, SPIFFE, and the
JOSE/JWT/JCS/JWK-Thumbprint RFCs — with the delegated-authority core pinned to AAT `-01` (now
self-contained via artifact 2). Experimental upstream work (WIMSE, Token Status List) stays
isolated to optional profiles. Full audit: [standards-readiness.md](standards-readiness.md).

## The self-containment guarantee

With artifacts 1–9 plus the stable standards they reference, an independent developer can
implement OAAF Core 1.0 **from OAAF's permanent artifacts alone** — even if every draft OAAF
profiles were to lapse. That is what makes this a freezeable v1 contract rather than a snapshot
of one implementation.

## What OAAF 1.0 is not

Not a certification program (conformance is self-declared and self-verifiable, never
"OAAF-certified"), not an SDK release, and not a home for reserved execution-control concepts
(continuity, supersession, recovery, fencing, freshness-as-execution-control remain out of scope
per [reserved-ip.md](reserved-ip.md) / ADR-0002).

# Roadmap

> **OAAF is a vendor-neutral, standards-first, transport-neutral authority
> interoperability layer.** It makes portable, delegable, verifiable authority work across
> agent and tool protocols by profiling existing standards rather than defining a
> competing wire format ([ADR-0003](docs/adr/0003-implement-existing-authority-standards.md)).

This file is the canonical program record. When it disagrees with an older document, this
file is right and the older one is history.

## What OAAF is

- portable subject identity binding
- scoped, narrowable authority
- delegation lineage and provenance
- resource and argument constraints
- expiry
- verification and evaluation
- basic revocation interoperability (planned, O5C)
- enforcement bindings (MCP, A2A)
- explainability
- conformance (planned, O6)

## What OAAF is not

Not an identity provider, authorization server, policy engine, credential vault, agent
framework, orchestrator, workflow engine, or execution platform. Those are products built
_on_ OAAF — including DigitalStack360. See [CHARTER.md](CHARTER.md).

## Reserved boundary

OAAF does not become the home for DigitalStack's proprietary execution-control semantics —
logical execution continuity, recovery/supersession, worker/workforce orchestration,
scheduling, readiness, execution lifecycle automation, or launch/relaunch semantics. This
boundary is technical and binds everyone, including Edwin Digital
([ADR-0002](docs/adr/0002-reserved-execution-continuity-semantics.md),
[GOVERNANCE.md](GOVERNANCE.md)).

---

## Status at a glance

| Phase       | Goal                                                 | Status                   |
| ----------- | ---------------------------------------------------- | ------------------------ |
| O1–O1.6     | Foundation + standards-first repositioning           | ✅ Complete              |
| O2          | AAT verification + AuthZEN enforcement core          | ✅ Complete              |
| O3A         | MCP / COAZ binding                                   | ✅ Complete              |
| O3B         | A2A binding                                          | ✅ Complete              |
| O3C         | Cross-transport authority proof                      | ✅ Complete              |
| O4 (audit)  | Explainability / evidence / tooling assessment       | ✅ Complete              |
| O4A         | Structured, privacy-safe explanations                | ✅ Complete              |
| O4B         | Cross-transport explanation equivalence              | ✅ Complete              |
| O4C         | Local authority inspector                            | ✅ Complete              |
| O4D         | Signed portable decision receipts                    | 🧊 Parked / non-blocking |
| O4.5        | OSS governance readiness                             | ✅ Complete              |
| O5A         | Distribution + TypeScript package readiness          | ✅ Complete              |
| O5B         | Independent Python implementation                    | ✅ Complete              |
| O5C         | Revocation interoperability                          | ✅ Complete              |
| O5D         | Identity / workload interoperability                 | ✅ Complete              |
| O5E         | Existing PDP / authorization interoperability        | ✅ Complete              |
| O5F         | Outsider adoption journey                            | ✅ Engineering-ready¹    |
| O6A         | Normative conformance specification                  | ✅ Complete              |
| O6B         | Conformance vectors                                  | ⏸️ Planned               |
| O6C         | Cross-language conformance                           | ⏸️ Planned               |
| O6D         | Binding / protocol conformance                       | ⏸️ Planned               |
| O6E         | Security conformance                                 | ⏸️ Planned               |
| O6F         | Upstream standards participation                     | ⏸️ Planned               |
| O6G         | Competitive collision audit                          | ⏸️ Planned               |
| O6H         | v1 compatibility / readiness contract                | ⏸️ Planned               |
| **O6 exit** | **OAAF v1 technical foundation / freeze**            | 🎯                       |
| O7A         | Integration target research                          | ⏸️ After O6 freeze       |
| O7B         | OAAF-maintained reference bridges                    | ⏸️ After O6 freeze       |
| O7C         | Maintainer validation                                | ⏸️ After O6 freeze       |
| O7D         | Upstream integration PRs                             | ⏸️ After O6 freeze       |
| O7E         | First external integrations                          | ⏸️ After O6 freeze       |
| **O7 exit** | **OAAF demonstrated inside external OSS ecosystems** | 🎯                       |

**Parallel tracks** (not part of the technical O-series): **A** — adoption/external
validation; **F** — funding readiness; **DS-OAAF** — DigitalStack commercial integration.
See [Parallel tracks](#parallel-tracks).

---

## O1–O1.6 — Foundation and standards-first repositioning ✅

Established OAAF as a standalone, vendor-neutral open-source project with a hard boundary
against DigitalStack: the [charter](CHARTER.md) scope rule and litmus test, a
dependency-boundary guard enforced in CI, neutral vocabulary, governance, and the
[RFC](rfcs/README.md) and [ADR](docs/adr/README.md) processes. A standards review
([ADR-0003](docs/adr/0003-implement-existing-authority-standards.md)) then repositioned
OAAF from "define an authority protocol" to "implement and profile existing standards" —
the decision the rest of the program is built on.

## O2 — AAT verification + AuthZEN enforcement core ✅

The authority kernel. Verifies a delegated authority chain as
[Attenuating Authorization Tokens](https://datatracker.ietf.org/doc/draft-niyikiza-oauth-attenuating-agent-tokens/)
(`-01`, pinned) — signatures, temporal validity, delegation depth, parent binding,
capability and constraint narrowing, closed-world arguments, and proof of possession — and
maps the result to an [AuthZEN 1.0](https://openid.net/specs/authorization-api-1_0.html)
decision ([RFC-0001](rfcs/0001-aat-authzen-enforcement-profile.md)). Fails closed;
trust anchors required ([ADR-0004](docs/adr/0004-fail-closed-configuration.md)).

## O3A — MCP / COAZ binding ✅

OAAF authority enforced at an MCP tool boundary as a precondition before the COAZ/AuthZEN
decision ([RFC-0002](rfcs/0002-mcp-coaz-binding.md)). The finding that shaped it: COAZ's
information model is closed to `params` and `token`, so OAAF cannot be a COAZ input — it is
a precondition the enforcement point applies before the PDP is called.

## O3B — A2A binding ✅

OAAF authority carried through A2A's extension mechanism and enforced before consequential
work ([RFC-0003](rfcs/0003-a2a-binding.md)). A2A 1.0.1 explicitly leaves authorization
scope to an extension (§7.6.4); OAAF supplies it, reusing the O2 core verbatim rather than
forking the authority model. Publishable [extension definition](docs/a2a-extension/oaaf-authority-v1.md).

## O3C — Cross-transport authority proof ✅

One authority chain and one proof of possession, enforced identically through both the MCP
and A2A adapters, certified in CI. The authority is not owned by the transport. Runnable:
`npm run demo:cross`.

## O4 — Explainability, evidence, developer tooling

### O4 audit ✅

Established that the core already knew why each decision happened, but the adapters
discarded the locator fields and `explain()` exposed argument values. Scoped the work into
O4A–D. Full audit: [docs/O4-audit.md](docs/O4-audit.md).

### O4A — Structured, privacy-safe explanations ✅

One shared `DecisionExplanation` contract derived from the existing pipeline: reasons with
their full locators (names, never values), a minimal authority summary, and both adapters
carrying the same information. No authorization behavior changed.

### O4B — Cross-transport explanation equivalence ✅

Extended the O3C proof to the explanation: the same authority material yields an equivalent
`DecisionExplanation` through both adapters, certified in CI
([docs/explanation-equivalence.md](docs/explanation-equivalence.md)). The step 0 audit also
removed a second, accidental explanation vocabulary before it became public.

### O4C — Local authority inspector ✅

A small, local, offline way for an outsider to inspect a decision and understand it,
consuming the canonical pipeline rather than implementing authorization:
`npm run inspect -- --example allow`. Privacy-safe by default; exit codes distinguish
ALLOW / DENY / tool error. See [examples/inspector](examples/inspector/).

### O4D — Signed portable decision receipts 🧊 Parked / non-blocking

**Parked, and explicitly not required for O4/O5/O6 progression.** The relevant
signed-receipt standards work
([draft-farley-acta-signed-receipts](https://datatracker.ietf.org/doc/draft-farley-acta-signed-receipts/))
is still evolving, and there is no external evidence yet that a receipt format is needed.
O4D may be revived by standards stabilization, adopter demand, or conformance/upstream
evidence — not by speculative engineering. When built, it would profile an existing
receipt standard, not invent an OAAF-specific format.

## O4.5 — OSS governance readiness ✅

Made OAAF credible for another project to depend on: an honest founder-led governance
model, a working private security-reporting channel, a
[versioning and compatibility policy](docs/versioning-and-compatibility.md), an
[extension policy](docs/extensions.md), issue/PR templates, CODEOWNERS, and verified
GitHub settings (private vulnerability reporting, branch protection, Dependabot). Vendor
neutrality is explicit: an outside maintainer can contribute on equal footing, and no
contribution can force reserved execution-control IP into OAAF.

---

## O5 — Ecosystem and implementation readiness

### O5A — Distribution and TypeScript package readiness ✅

`@oaaf/sdk` is genuinely consumable as an external package:

- publish-ready `@oaaf/sdk` with intentional public subpath exports (`.`, `/mcp`, `/a2a`,
  `/authzen`, `/testing`)
- Node 20 **and** 22 certified in CI
- ESM-only, documented and justified
- a downstream packed-artifact certification: pack → install into a throwaway project →
  compile against the shipped declarations → run ALLOW/DENY/explanation and both bindings,
  all via public paths
- clean LICENSE / NOTICE / package contents; no test material or secrets shipped

Not published: the `@oaaf` npm namespace remains a pending ownership step. The artifact is
certified publish-ready under that name.

### O5B — Independent Python implementation ✅

A second implementation (`oaaf`, in `python/`) built from OAAF's published contracts and
standards basis, not by porting TypeScript internals:

- independent verify / evaluate / PoP / explanation, its own JCS and Ed25519 stack
- reproduces the same ALLOW/DENY, reason codes, stage, locators, and `AuthoritySummary`
  semantics, with the same **names, never values** privacy properties
- certified by shared cross-language parity vectors carrying real signed material verified
  independently by both implementations, on Python 3.11 and 3.12 in CI

### O5C — Revocation interoperability ✅

Revocation is production-credible without OAAF operating a revocation service. OAAF
**consumes** revocation truth via a transport-neutral `StatusResolver` contract
([RFC-0004](rfcs/0004-authority-status-revocation.md), Token Status List basis): every chain
member is checked, fail-closed on unknown. OAAF defines the contract; it does not host the
status infrastructure. Certified in both implementations.

### O5D — Identity / workload interoperability ✅

An adopter brings established identity (SPIFFE/WIMSE, OIDC) rather than an OAAF identity
provider ([RFC-0005](rfcs/0005-external-subject-identity-binding.md)). The proof is that four
concepts stay separate and bound, not merged: subject identity (`sub`) ≠ authentication
credential (external SVID/OIDC) ≠ proof-of-possession key (`cnf.jwk`) ≠ authority (grant). A
transport-neutral `IdentityBindingVerifier` optionally confirms the subject↔holder binding,
fail-closed. No new credential invented; certified in both implementations.

### O5E — Existing PDP / authorization interoperability ✅

An organization keeps its existing PDP (AuthZEN, OPA, Cedar, OpenFGA) and uses OAAF **in
front of it** ([RFC-0006](rfcs/0006-pdp-interoperability.md)). Two decisions, two owners:
OAAF verifies delegated authority (Decision 1, fails closed) and conveys the **verified
facts** as the canonical, PDP-neutral **authority context** (`toAuthorityContext` /
`to_authority_context`, names-never-values); the existing PDP makes the organization's policy
decision (Decision 2). AuthZEN is the canonical seam (`context.oaaf`, unified across the MCP
binding and the AuthZEN mapping); OPA/Cedar are documented adapters and OpenFGA a documented
weaker fit — none a runtime dependency. Hard boundary held: **the PDP owns policy; OAAF owns
verified authority.** Demonstrated by [`examples/pdp-coexistence`](examples/pdp-coexistence/)
(including a valid-authority / org-policy-deny case) and available in both implementations.

### O5F — Outsider adoption journey ✅ Engineering-ready · ⬜ Externally certified

The complete path a person outside Edwin Digital follows — DISCOVER → TRY → INSTALL → VERIFY
→ ADOPT → CONTRIBUTE — is real, runnable, and CI-verified, and mapped end to end in
[docs/adoption-journey.md](docs/adoption-journey.md).

**Two states, deliberately distinct:**

- **Engineering-ready ✅** — everything an outsider needs exists and works:
  - **Distribution:** honest install story. `@oaaf/sdk` install is documented with a working
    pre-publish path (packed artifact / git ref); the packed artifact is certified on every
    change (`npm run check:package`); a one-sitting [release runbook](docs/releasing.md) and a
    shipped [CHANGELOG](packages/typescript/CHANGELOG.md) make first publish mechanical once
    the `@oaaf` npm scope is owned (the sole remaining owner action).
  - **Adopter path:** a voluntary [adopter declaration](.github/ISSUE_TEMPLATE/adopter.md) and
    an [ADOPTERS.md](ADOPTERS.md) that is empty by design — entries require self-identification
    _and_ independent verification; no names are manufactured.
  - **Observable without telemetry:** [docs/adoption-signals.md](docs/adoption-signals.md)
    enumerates external signals (GitHub traffic, stars/forks, issues/PRs, npm downloads and
    dependents once published, code-search integrations). The SDK has **no phone-home**,
    enforced by `npm run check:telemetry`, not merely promised.
- **Externally certified ⬜** — the journey is only truly proven when an _actual outsider_
  completes it. This is not self-certifiable: maintainers cannot claim it by role-playing an
  outsider, so it is left unclaimed until a real, independent user does it and says so. That
  is the evidence the funding objective ultimately cares about.

¹ Engineering-ready: the outsider journey exists and is CI-verified. External certification —
an independent user actually completing it — is deliberately unclaimed and is not
self-certifiable.

## O6 — Conformance, standards, and v1 readiness

### O6A — Normative conformance specification ✅

Defines what "OAAF-conformant" means for an **independent** implementation — derived from
adopted standards, the RFCs, public contracts, certified invariants, and security
requirements, **not** from "behaves like the TypeScript implementation." The reference impls
are evidence, not the definition. Lives in
[spec/0.1/conformance/](spec/0.1/conformance/README.md), pre-v1 (O6H owns the v1 freeze).

- **Conformance classes:** one mandatory **Core** plus five optional profiles — **Status**,
  **Identity**, **MCP**, **A2A**, **PDP**. Delegation, attenuation, and proof of possession
  are inside Core (the thesis), not certification-bingo add-ons.
- **64 requirements** with stable IDs (`CORE-NARROW-001`, `STATUS-003`, …) as the traceability
  spine; 44 are security invariants for O6E. Canonical machine-readable catalog in
  [`requirements.json`](spec/0.1/conformance/requirements.json), guarded by
  `npm run check:conformance` (unique IDs, known classes, no dangling or orphan references).
- **U/O/B/R/E/X classification** separates upstream-normative, OAAF-normative, binding,
  reference-only, experimental, and out-of-scope behavior; reason codes (19 normative vs ~26
  reference-only diagnostics), stages (reference-only), and explanation fields are each
  classified. Experimental upstream work (Token Status List, WIMSE) is isolated to optional
  profiles so it cannot become a mandatory v1 requirement.
- **Traceability:** all 18 shared vectors mapped to requirements (no orphans), with a
  27-requirement O6B gap list — including the notable gap that the central no-widening thesis
  (`CORE-NARROW-001`) has no dedicated static vector yet.
- **Self-verifiable claim format** (`OAAF Core 0.1 conformant · Profiles: …`); no certification
  authority, badge, or registry. Reserved-IP assessment: **PASS** — conformance covers
  authority, not execution control.

### O6B — Conformance vectors ⏸️

Versioned, implementation-independent fixtures: positive, negative, and adversarial. Exact
vector contents are not frozen here.

### O6C — Cross-language conformance ⏸️

Certify the TypeScript and Python implementations against the same normative vectors and
expected outcomes.

### O6D — Binding / protocol conformance ⏸️

Certify MCP/COAZ and A2A authority behavior, including the transport-neutral invariants.

### O6E — Security conformance ⏸️

Security-critical and adversarial cases — chain truncation, reordering, authority widening,
malformed signatures, holder/recipient mismatch, PoP failures, expired/revoked authority,
constraint boundaries, malformed input, unsupported required extensions, and privacy-safe
explanation behavior. Kept high-level here; exact cases are not pre-frozen.

### O6F — Upstream standards participation ⏸️

Determine which findings and conventions to propose upstream, and which stay OAAF-specific
implementation behavior.

### O6G — Competitive collision audit ⏸️

A fresh, repo-level evaluation of the **then-current** closest projects and standards
before v1 — deliberately not a hard-coded competitor list, because the landscape moves.
It must answer objectively: what they do that OAAF does not; what OAAF does that they do
not; where OAAF is complementary vs competitive; whether any OAAF behavior has been
superseded by better upstream work; and whether OAAF still has a technically defensible
reason to exist.

### O6H — v1 compatibility / readiness contract ⏸️

Decide whether the technical foundation is ready to become OAAF v1 and freeze the
compatibility guarantees adopters may rely on.

### O6 exit — OAAF v1 technical foundation / freeze 🎯

Normative behavior documented, independent implementations possible, conformance exists,
standards positioning reassessed, compatibility promises explicit. This does **not** mean
development stops. New core semantics after the freeze must be justified by external
adoption evidence, interoperability defects, security findings, upstream standards changes,
or conformance findings — not speculative engineering momentum.

## O7 — Ecosystem bridges

Begins only **after** the O6 technical freeze. O7 proves ecosystem fit, not new authority
semantics.

### O7A — Integration target research ⏸️

Research and rank external OSS projects by architectural fit, ecosystem/adoption value,
integration difficulty, maintainer receptiveness, and competitive overlap.

### O7B — OAAF-maintained reference bridges ⏸️

Build working integrations on the OAAF side first, using each external project's real
public API where practical. The bridge adapts to the ecosystem; OAAF core does not mutate
merely to accommodate each target.

### O7C — Maintainer validation ⏸️

Take working bridges to maintainers for technical review and validation.

### O7D — Upstream integration PRs ⏸️

Where a maintainer wants upstream support, contribute the smallest native-looking optional
integration appropriate to their project.

### O7E — First external integrations ⏸️

Exit is evidence-based, not code-count-based. Current target, refinable as ecosystem
conditions become clear:

- ~5 working external reference bridges
- 3 substantive maintainer conversations
- 2 maintainers validating an integration approach
- at least 1 upstream PR merged **or** 1 external project independently OAAF-conformant

### O7 exit — OAAF demonstrated inside external OSS ecosystems 🎯

---

## Parallel tracks

These run alongside the technical O-series and are not part of it.

### Adoption — A-series

External validation and adoption. Current objective (**A0.3**):

- 10 substantive external technical conversations
- 3 external people actually run OAAF
- 1 external project seriously evaluates an integration

Stars and impressions do not satisfy these criteria. A-series may proceed in parallel with
technical work.

### Funding — F-series

Funding readiness. Kept separate from technical implementation; no funding-specific
functionality belongs in OAAF core.

### DS-OAAF — DigitalStack commercial integration

A separate commercial track. DigitalStack360 may consume OAAF; OAAF never depends on it,
and the reserved execution-control boundary above applies.

## How this file changes

Roadmap changes do not require an RFC. The protocol/normative decisions inside each phase
do — see [rfcs/README.md](rfcs/README.md).

# Roadmap

> **OAAF is an open interoperability toolkit for carrying, enforcing, and testing
> delegated authority across agent and tool protocols.**

OAAF implements and profiles existing authority standards rather than defining a
competing wire format. The reasoning is in
[ADR-0003](docs/adr/0003-implement-existing-authority-standards.md).

```text
              EXISTING STANDARDS
 Identity        Delegation        Decisions        Evidence
SPIFFE/etc.         AAT             AuthZEN          receipts
    │                │                 │                │
    └────────────────┴─────────────────┴────────────────┘
                             │
                             ▼
                         OAAF
                ┌─────────────────────┐
                │ bindings            │
                │ enforcement         │
                │ adapters            │
                │ explainability      │
                │ conformance         │
                └──────────┬──────────┘
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
                MCP                 A2A
                 │                   │
                 ▼                   ▼
               Tool                Agent
```

Programs, not dates. This is a small project; committing to a calendar it cannot keep
would be its own kind of dishonesty.

Each program has an explicit exit condition — a program is not finished because time
passed — and an **ecosystem evidence** section. That second part is deliberate. A
toolkit nobody installs is not an open-source project, and each phase should leave
behind something an outsider can point at: a package they installed, an integration
they shipped, an issue they filed.

## Phases

| Phase   | Goal                                                                  | Status             |
| ------- | --------------------------------------------------------------------- | ------------------ |
| O1      | OSS foundation + DigitalStack boundary                                | ✅ Closed          |
| O1.5    | Standards and competitive review                                      | ✅ Closed          |
| O1.6    | Standards-first repositioning + public framing                        | ✅ Closed          |
| O2      | AAT verification + AuthZEN enforcement profile                        | ✅ Closed          |
| O2.5    | Finding retracted; conformance closed; fail-closed principle recorded | ✅ Closed          |
| O3A     | MCP / COAZ binding                                                    | ✅ Closed          |
| O3B     | A2A binding                                                           | ⬅ Next             |
| O3C     | Agent delegation demo                                                 | Planned            |
| O4      | Evidence, explainability, developer tooling (O4A–C ✅; O4D parked)    | ✅ Active complete |
| O4.5    | Open-source contribution + repository governance readiness            | Planned — gates O5 |
| O5      | Public launch: stars, users, contributors, integrations               | Blocked by O4.5    |
| O6      | Conformance suite + upstream standards participation                  | Planned            |
| DS-OAAF | DigitalStack consumption + proprietary execution layer                | Separate           |

## O1 — Foundation and boundary ✅

Establish the repository, architecture vocabulary, contribution model, and the hard
product boundary before building anything, so that later work has something to drift
against.

- Standalone open-source repository; neutral vocabulary; fast CI
- [Charter](CHARTER.md): scope rule, litmus test, in/out of scope, reserved concepts
- Dependency boundary, mechanically enforced in CI
- Governance, security policy, contribution model, Apache 2.0, [RFC framework](rfcs/README.md)
- [ADR-0001](docs/adr/0001-oaaf-digitalstack360-separation.md) — DigitalStack360 separation
- [ADR-0002](docs/adr/0002-reserved-execution-continuity-semantics.md) — reserved execution-continuity semantics

**Ecosystem evidence created:** a repository an external developer can clone and
validate with no vendor knowledge and no account — the precondition for every phase
that follows.

## O1.5 — Standards and competitive review ✅

Before writing a schema, establish whether a vendor-neutral mechanism already existed
for attaching narrowable authority, provenance, constraints, and evidence to an
agent-to-agent or agent-to-tool request.

It largely did. Classifying each candidate concept against existing work found nearly
every primitive available to adopt or profile, and none requiring invention — while
finding no running code connecting the pieces and no conformance suite.

**Ecosystem evidence created:** none directly, and that was the point. The phase existed
to avoid producing a redundant specification, which is the cheapest thing this project
could have got wrong.

## O1.6 — Standards implementation strategy ✅

Record the repositioning and realign the project around it.

- [ADR-0003](docs/adr/0003-implement-existing-authority-standards.md) — implement and
  profile existing standards rather than define a competing wire format
- This roadmap
- Realign public framing and `spec/0.1` from original protocol to profile

_Exit condition:_ the repository describes what OAAF actually intends to build, with no
document still claiming an original protocol.

**Ecosystem evidence created:** credibility. A project whose stated purpose matches its
artifacts is one an outside reviewer can evaluate honestly.

## O2 — Working enforcement point ✅

Verify a delegated authority chain, decide, and explain — using existing standards, with
no new wire format.

- AAT `-01` chain verification: signatures, temporal validity, delegation depth, parent
  binding, capability narrowing, and the full constraint subsumption matrix
- Proof-of-possession verification with RFC 8785 canonical argument binding
- AuthZEN 1.0 request mapping and decision, frozen by
  [RFC-0001](rfcs/0001-aat-authzen-enforcement-profile.md)
- A reason code on every denial, and a human-readable explanation
- Runnable quickstart: `npm run demo`

A follow-up conformance review against the draft's full normative text corrected
several gaps in the first implementation, including verifying the root against a
configured trust anchor rather than against itself.

**Ecosystem evidence created:** a package that does something real, and a quickstart
that runs with no account or service.

## O3A — MCP / COAZ binding ✅

**Goal: prove OAAF authority can be enforced at an MCP tool boundary using the current
COAZ/AuthZEN model, without inventing an OAAF-specific authorization path where an
upstream standard already exists.**

Pinned: COAZ-MCP binding Draft 1 (2026-02-13), AuthZEN Authorization API 1.0 (Final),
MCP 2026-07-28.

The central finding was architectural, not editorial: COAZ's information model is
closed to two input variables, `params` and `token`, and an AAT chain is neither. OAAF
cannot be a COAZ input — it is a precondition the enforcement point applies before a
COAZ request is ever built, denying immediately and unconditionally on failure rather
than surfacing a failed verification as a fact for policy to notice. Read against the
obligations profile's raw normative text before deciding: obligations are strictly
response-side (PDP→PEP) compliance instructions and do not model inbound evidence, so
they were not used.

- [RFC-0002](rfcs/0002-mcp-coaz-binding.md) freezes the integration: COAZ's default
  `tools/call` mapping is reused unmodified; OAAF contributes an additional MUST step in
  COAZ-MCP's own PEP algorithm, plus an optional `context.oaaf` fact for policy.
- RFC-0001 stays transport-neutral and unmodified; RFC-0002 does not reuse its
  agent-as-subject mapping, because COAZ anchors `subject.id` to the validated
  principal and places the agent in `context.agent`.
- Seven cases proved end to end: valid mapped authority allows; missing capability
  denies; argument mismatch denies; expired authority denies; untrusted root denies;
  private-key `cnf.jwk` denies; a request whose COAZ-facing fields are entirely
  well-formed still denies without valid OAAF authority.

**Ecosystem evidence created:** a working integration with a standard actively being
developed by the OpenID Foundation, and a documented architectural finding — that
authority verification and request-mapping standards can compose without either
redefining the other — that is itself useful to anyone else attempting the same
composition.

## O3B — A2A binding

**Goal: an A2A agent author can place scoped, delegated authority around a delegated
task with only a few lines of integration code.**

- A2A binding published as a URI-identified A2A extension
- Applies the same structural rule as O3A: A2A owns its own message semantics; OAAF
  contributes authority verification and proof

This is the second half of the seam the standards review identified — specifications
that are individually sound, with nothing yet connecting them across the A2A transport.

_Exit condition:_ an independent developer protects an A2A task, exercises an allowed
and a denied call, and understands the denial without reading the underlying
specifications.

**Ecosystem evidence created:** a distribution path through the A2A ecosystem; a
concrete external integration opportunity; a third-party use case specific enough to
appear in someone else's release notes.

## O3C — Cross-transport delegation demo ✅

**Goal: one runnable proof that the same delegated authority chain is enforced identically
through both the MCP and A2A adapters — that authority is not owned by the transport.**

Reduced to a proof-and-communication scope after O3B, since the per-transport delegation
demos already existed. The `examples/cross-transport` demo mints one chain (Alice → Bob,
narrowed to `repo.read`) and one proof of possession, feeds the identical material through
`enforceOaafPrecondition` (MCP) and `enforceA2aAuthority` (A2A), and shows equal allow/deny
outcomes down to the reason code. A CI test asserts the equivalence so a future change that
made the transports diverge fails the build. No new core semantics; reserved-IP gate clean.

_Exit condition:_ met — `npm run demo:cross` runs from a clean clone, both transports decide
identically, and the README carries the shareable diagram.

**Ecosystem evidence created:** the first artifact that demonstrates OAAF's core claim —
portable authority — actually crossing a transport boundary, not just being verified
within one.

## O4 — Explainability and evidence verification

Only high-value developer experience. The test for inclusion is whether its absence
costs a real user real time.

- Verify signed decision receipts, including offline
- Explain a denial in terms of the authority actually presented
- `oaaf evaluate`, `oaaf explain`, `oaaf inspect`

`oaaf doctor` is added only if users demonstrate a need.

```text
DENIED

Subject
  agent:developer

Requested
  github.merge_pull_request

Authority
  github.read
  github.write
  github.create_pull_request

Reason
  capability_not_granted
```

_Exit condition:_ a developer debugging an unexpected denial resolves it from tool
output alone.

**Ecosystem evidence created:** lower adoption friction, and materially easier support
and retention — most projects lose users at the first confusing failure, not at install.

## O4.5 — Open-source contribution and repository governance readiness

**Hard gate. O5 does not begin until this phase is certified complete.** Reasoning in
[ADR-0005](docs/adr/0005-governance-readiness-gate.md).

Verifies the mechanisms for receiving external contributors and reports actually work,
rather than launching and discovering gaps live:

- Security reporting channel confirmed working (tracked in the
  [pre-launch checklist](docs/pre-launch-checklist.md))
- RFC process exercised by, or credibly open to, a non-founder author
- DCO sign-off, branch protections, and required CI checks verified against a real pull
  request
- Repository namespace and `@oaaf` npm scope decisions resolved
- CODE_OF_CONDUCT.md's enforcement contact confirmed reachable
- GOVERNANCE.md re-read against what O1 through O4 actually did, corrected if practice
  has drifted from description

This gates process readiness, not protocol maturity — it does not require the
conformance suite (O6) or a stable spec version.

_Exit condition:_ every item above is verified, not merely documented, with an explicit
note wherever a genuine external example was not yet available.

**Ecosystem evidence created:** none directly — this phase spends effort to make sure
the evidence O5 collects afterward is collected by processes already known to work.

## O5 — Public launch and ecosystem

A first-class program, not an afterthought. Implementation work that nobody adopts
produces no ecosystem, and ecosystem evidence does not appear on its own.

Tracked signals: GitHub stars · independent users · external issues and discussions ·
external contributors · MCP integrations · agent-framework integrations · organizations
evaluating OAAF · design collaborators · future collaboration-letter candidates

```text
GitHub visitor
      ↓
     Star
      ↓
   Try OAAF
      ↓
 Actual usage
      ↓
 Issue / feedback
      ↓
 Integration
      ↓
 Contribution
      ↓
 Design collaboration
```

Each stage converts far worse than the one before, which is why O2 through O4 come
first: launching before the install-to-decision path is short wastes the only first
impression available.

Operational prerequisites are tracked in the
[pre-launch checklist](docs/pre-launch-checklist.md).

_Exit condition:_ independent users exist who were not prompted by us, and at least one
external integration we did not write.

**Ecosystem evidence created:** stars, users, contributors, integrations, and
collaboration relationships — the accumulated public record of a project other people
actually use.

## O6 — Conformance and upstream participation

The payoff phase for a standards-first project.

```bash
npx oaaf conform ./my-agent
```

```text
OAAF Interop
AAT delegation                  PASS
Authority narrowing             PASS
AuthZEN decision mapping        PASS
MCP binding                     PASS
A2A authority extension         PASS
Evidence receipt verification   PASS
6/6 compatible
```

- Conformance suite runnable against any implementation
- Adversarial suite as a first-class artifact: narrowing violations, replay, forged
  lineage, malformed input
- Interoperability testing contributed upstream to the groups defining the underlying
  standards, several of which actively solicit exactly this
- Published threat model
- A neutral `STANDARDS.md` describing what OAAF implements and why

Participation here is contribution, not competition. Helping a standard succeed is a
better position than asking anyone to choose between standards.

_Exit condition:_ a third party runs the conformance suite against their own
implementation and gets a meaningful pass or fail — and at least one finding is
contributed back upstream.

**Ecosystem evidence created:** relationships with organizations participating in the
relevant standards work; interoperability events; credibility with standards-literate
reviewers, who are the quickest to dismiss a project that reinvents solved problems.

## DS-OAAF — DigitalStack integration

A separate future track. **Not started, and not to be started yet.**

DigitalStack360 may consume OAAF primitives. It retains, as proprietary: context, work
intake, prioritization, scheduling, capacity, readiness, workforce orchestration,
continuation and retry intelligence, recovery, execution-control state machines,
commercial governance, analytics, cost, and managed execution.

The dependency direction is fixed and enforced in CI: DigitalStack360 may depend on
OAAF; OAAF must never depend on DigitalStack360. See
[ADR-0001](docs/adr/0001-oaaf-digitalstack360-separation.md).

## Explicitly not on the roadmap

Not "later" — out of scope by [charter](CHARTER.md), and belonging to products built on
OAAF:

workforce scheduling · queueing · prioritization · capacity management · project or
organizational context · memory and RAG · task decomposition · agent planning ·
workflow orchestration · provider and model routing · commercial approval workflows ·
enterprise governance UI · cost management · billing · operational dashboards ·
customer analytics · managed execution infrastructure

Separately, a set of execution-continuity concepts is
[reserved pending IP review](CHARTER.md#reserved-concepts). Reserved is not the same as
out of scope, but the practical effect today is the same: OAAF does not define them.

Also not on the roadmap: an original authority wire format. See
[ADR-0003](docs/adr/0003-implement-existing-authority-standards.md).

## How this changes

Roadmap changes do not require an RFC. Decisions about what OAAF implements, profiles,
extends, or invents do.

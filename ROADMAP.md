# Roadmap

Programs, not dates. This is a small project; committing to a calendar it cannot keep
would be its own kind of dishonesty.

Each program has an explicit exit condition — a program is not finished because time
passed — and an **ecosystem evidence** section. That second part is deliberate. OAAF is
not being built only to produce protocol artifacts. A specification nobody installs is
not an open-source project, and each phase should leave behind something an outsider
can point at: a package they installed, an integration they shipped, an issue they
filed.

## O1 — Foundation and boundary ✅

Establish the repository, architecture vocabulary, contribution model, and the hard
product boundary _before_ building the authority kernel — so that later work has
something to drift against.

- Standalone open-source repository
- [Charter](CHARTER.md): scope rule, litmus test, in/out of scope, reserved concepts
- Neutral domain vocabulary
- Dependency boundary, mechanically enforced in CI
- Enforcement point concept
- Problem-first [README](README.md)
- Governance, security policy, contribution model, Apache 2.0
- [RFC framework](rfcs/README.md)
- Fast CI
- [ADR-0001](docs/adr/0001-oaaf-digitalstack360-separation.md) — explicit DigitalStack360 separation

**Ecosystem evidence created:** a repository an external developer can encounter,
clone, and validate with no vendor knowledge and no account — the precondition for
every phase that follows.

## O2 — Minimum useful authority _(next)_

**Goal: an external TypeScript developer can install OAAF and make a useful scoped
allow/deny decision locally in under ten minutes.**

That sentence is the specification for this phase. Anything not required to reach it
is out of scope for O2.

Scope:

- subject, capability, resource, constraints
- the grant object
- validity and expiration
- deterministic local evaluation
- a structured allow/deny decision
- an understandable denial reason

The golden path must require **no** account, database, hosted service, API key, cloud
infrastructure, or DigitalStack.

```bash
npm install @oaaf/sdk
```

followed by a very small TypeScript example.

Explicitly not in O2: a sophisticated policy language. If evaluation starts needing its
own grammar, the design has gone wrong.

_Exit condition:_ a developer who has never seen this repository installs the package,
follows the quickstart, and gets a correct deny with a reason they understand — without
reading the specification.

**Ecosystem evidence created:** an installable package on npm; a runnable quickstart;
the first point at which independent users can exist at all. Until something is
installable, there is nothing to adopt and no adoption to measure.

## O3 — MCP guard

**Goal: an MCP server maintainer can place scoped authority around a tool with only a
few lines of integration code.**

Target developer: someone maintaining an MCP server or agent framework who needs to
control what autonomous agents may do and does not want to build an authorization
system.

Conceptually:

```ts
server.tool(
  'github.merge_pull_request',
  oaaf.guard({
    capability: 'github.pull_request.merge',
  }),
  handler,
);
```

The exact API is not frozen by this example.

_Exit condition:_ an independent developer can protect an MCP tool, exercise both an
allowed and a denied call, and understand the denial without reading the full protocol
specification.

**Ecosystem evidence created:** a distribution path through the MCP ecosystem; a
concrete external integration opportunity rather than a hypothetical one; a third-party
use case specific enough to be described in someone else's release notes.

## O4 — Developer experience and explainability

Only high-value developer experience. The test for including something here is whether
its absence costs a real user real time.

Likely surface:

```text
oaaf evaluate
oaaf explain
oaaf inspect
```

`oaaf doctor` is added only if actual users demonstrate a need for it.

Explainability is the point. A denial should answer itself:

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

_Exit condition:_ a developer debugging an unexpected denial resolves it from the tool
output alone.

**Ecosystem evidence created:** lower adoption friction, and materially easier support
and retention — most projects lose users at the first confusing failure, not at the
install step.

## O5 — Public launch and ecosystem

A first-class program, not an afterthought. Protocol work that nobody adopts produces
no ecosystem, and ecosystem evidence is not a by-product that appears on its own.

Tracked signals:

- GitHub stars
- independent users
- external issues and discussions
- external contributors
- MCP integrations
- agent-framework integrations
- organizations evaluating OAAF
- design collaborators
- future collaboration-letter candidates

The funnel being built:

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

Each stage has a much lower conversion rate than the one before it, which is why O2
through O4 exist first: launching before the install-to-decision path is short wastes
the only first impression available.

Operational prerequisites for this phase are tracked in the
[pre-launch checklist](docs/pre-launch-checklist.md).

_Exit condition:_ independent users exist who are not prompted by us, and at least one
external integration we did not write.

**Ecosystem evidence created:** stars, users, contributors, integrations, and
collaboration relationships — the accumulated public record of a project that other
people actually use.

## O6 — Standards and IP review

Before expanding into advanced protocol semantics, classify every substantial proposed
primitive:

| Classification | Meaning                                                          |
| -------------- | ---------------------------------------------------------------- |
| `ADOPT`        | Use an existing standard directly.                               |
| `PROFILE`      | Constrain or apply an existing standard to the OAAF use case.    |
| `EXTEND`       | Add narrowly missing semantics to something that already exists. |
| `INVENT`       | Create a genuinely new primitive — only when justified.          |

**The goal is to invent as little as possible.** `INVENT` is the classification that
requires an argument; the others are the expected answers.

OAAF does not attempt to replace OAuth, MCP authorization, SPIFFE, AuthZEN, OPA, Cedar,
OpenFGA, or existing IAM systems. Where they solve the problem, OAAF adopts or profiles
them.

This program also carries the intellectual-property review that governs the
[reserved concepts](CHARTER.md#reserved-concepts). Until that review
completes, those concepts stay out of public OAAF semantics.

_Exit condition:_ every primitive in the specification carries a classification, and
each `INVENT` carries a written justification for why an existing standard was
insufficient.

**Ecosystem evidence created:** credibility with standards-literate reviewers, who are
precisely the people whose adoption matters most and who are quickest to dismiss a
protocol that reinvents solved problems.

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
[reserved pending IP review](CHARTER.md#reserved-concepts). Reserved
is not the same as out of scope, but the practical effect today is the same: OAAF does
not define them.

If OAAF starts growing any of the above, the charter has failed and the right response
is to remove them.

## How this changes

Roadmap changes do not require an RFC. The protocol decisions inside each program do.

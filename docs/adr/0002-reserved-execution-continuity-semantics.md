# ADR-0002: Reserved execution-continuity semantics

- **Status:** Accepted
- **Date:** 2026-08-18
- **Deciders:** Edwin Digital LLC (initial maintainer)
- **Relates to:** [ADR-0001](0001-oaaf-digitalstack360-separation.md)

## Context

[ADR-0001](0001-oaaf-digitalstack360-separation.md) fixed the dependency direction
between OAAF and DigitalStack360 and drew an ownership boundary. It did not settle a
harder question that sits directly on that boundary: what happens to authority when a
worker is replaced.

The early framing of this project leaned on a compelling example. A worker holds
authority, disconnects, is replaced, reconnects, and attempts to act — with a grant
that is still cryptographically valid but no longer authoritative. Solving that made
OAAF look novel, and it was the first example a reader encountered.

Two problems with leading on it.

**It is not cleared for publication.** The machinery that determines _when_ a worker
has been superseded, _how_ recovery is detected, _when_ authority transfers, and _what_
causes an authority version to advance is differentiated execution-control
architecture. Publishing the semantics under an Apache 2.0 license is effectively
irreversible — a specification, once implemented against, cannot be withdrawn. That
decision needs an intellectual-property review, and the review has not happened.

**It is the wrong first problem.** Recovery and continuity are problems for
organizations already running fleets of long-lived autonomous workers. That population
is small today. The much larger population — MCP server maintainers, agent framework
authors, tool gateway operators — has a simpler and more immediate problem: an agent
holds a credential broader than the action it is attempting, and nothing is positioned
to notice. Leading with continuity optimized OAAF's novelty at the cost of its
addressable audience.

## Decision

**A defined set of execution-continuity concepts is reserved: excluded from public OAAF
semantics until an explicit intellectual-property review completes.**

Reserved:

- logical execution continuity
- worker supersession algorithms
- recovery detection, recovery authority transfer, execution takeover
- retry and continuation authority behavior
- workforce recovery state machines
- rules determining when an authority version or freshness value advances
- automatic grant-lifecycle changes driven by runtime or workforce state
- interactions between authority and scheduling, capacity, or readiness

**Reserved is not the same as out of scope.** The
[out-of-scope list](../../CHARTER.md#out-of-scope) contains things that do not belong in
an authority protocol on principle. These are things that might legitimately belong,
but which cannot be published yet. The practical effect today is identical; the
reasoning is not, and the distinction determines what happens after the review.

**Public positioning leads with scoped authority instead.** The first example a reader
encounters is a capability check:

```text
Agent requests:   github.merge_pull_request
Authority permits: github.read, github.write, github.create_pull_request
Decision:         DENY
Reason:           capability_not_granted
```

**A generic extension point remains available later.** OAAF may eventually let an
enforcement point consume an externally supplied freshness or version value and refuse
an action when that value is not current, treating the value as opaque input. OAAF
would not define the logic producing it. That is the shape that keeps the
interoperability layer open without opening the operational intelligence: the protocol
carries the check, the operator's system decides the answer.

## Consequences

**Accepted costs.**

- OAAF is less differentiated in its first public form. Scoped capability checking is
  a well-understood problem, and the reaction from some readers will be that this is
  authorization with extra steps. That is a fair reading of the initial surface.
- The near-term roadmap loses its most memorable demo.
- Contributors will independently propose the reserved concepts, because they are
  genuinely interesting problems. Each proposal costs a maintainer an explanation, and
  the explanation cannot be fully candid about why.
- If the review later clears these concepts, OAAF will be adding them to a protocol
  already in use rather than designing them in from the start — which is harder.

**Benefits.**

- The published surface is defensible without a pending legal question hanging over it.
- Positioning now matches the largest available audience rather than the most
  technically interesting one, which is the correct trade for a project that needs
  independent adoption to matter at all.
- The minimum useful path — install, grant, evaluate, deny with a reason — is far
  shorter than the continuity path, which directly serves the ten-minute goal on the
  roadmap.
- Reserving explicitly, in public, is more honest than quietly omitting the topic. A
  reader can see that a boundary exists and where it runs.

**Enforcement.**

- The reserved list lives in [CHARTER.md](../../CHARTER.md#reserved-concepts).
- The [RFC process](../../rfcs/README.md) records these as deferred questions; an RFC
  proposing one is closed with a pointer rather than debated on its merits.
- The [roadmap](../../ROADMAP.md) carries the review as a named program and commits no
  near-term phase to implementing the reserved semantics.

Unlike the dependency boundary in ADR-0001, this one has no mechanical guard. A
contributor cannot accidentally import execution-continuity semantics; they can only
propose them, and that is caught by review. The documentation is the enforcement.

## Alternatives considered

**Publish the continuity semantics anyway.** The strongest technical differentiator,
and the most interesting protocol work. Rejected because it is irreversible and
un-reviewed — the ordering is wrong, not necessarily the destination.

**Say nothing about continuity at all.** Simpler, and avoids drawing attention to a
gap. Rejected because a reader who has run agent fleets will notice the omission
immediately, and discovering an undisclosed boundary is worse for trust than being told
one exists.

**Define the extension point now, without the semantics.** Tempting — it looks like the
neutral half. Rejected for this phase: designing an extension point without a concrete
consumer produces a shape that fits nothing, and the only available consumer is the
system whose semantics are under review.

# ADR-0001: OAAF and DigitalStack360 separation

- **Status:** Accepted
- **Date:** 2026-08-18
- **Deciders:** Edwin Digital LLC (initial maintainer)

## Context

OAAF originates at Edwin Digital LLC, which also builds DigitalStack360 — a commercial
platform for operating an AI workforce. OAAF exists because the authority problem
encountered while building that platform is not specific to it: any system running
autonomous agents against consequential tools faces the same questions about identity,
scope, delegation, revocation, and audit.

Two failure modes threaten a project in this position, and they pull in opposite
directions.

**Drift toward a community edition.** OAAF gradually absorbs orchestration, context,
scheduling, and governance features until it is a weaker copy of the commercial
product. External adopters correctly conclude it is a funnel rather than
infrastructure, and do not adopt. The commercial differentiation erodes at the same
time. Both sides lose.

**Drift toward vendor capture.** OAAF stays narrow but encodes one product's
assumptions — its tenancy model, its session semantics, its vocabulary. It remains
technically open and practically unusable by anyone else. Interoperability, the entire
point, never materializes.

Both are gradual. Neither happens through a single bad decision; they happen through a
sequence of individually reasonable ones. So the separation needs to be structural,
written down, and mechanically checked — not a matter of remembering to be careful.

## Decision

**OAAF is a vendor-neutral authority interoperability layer. DigitalStack360 is a
commercial workforce and control-plane implementation that may consume OAAF
primitives.**

The dependency direction is fixed:

```text
        OAAF
          ^
          |
   DigitalStack360
```

DigitalStack360 may depend on OAAF. OAAF must never depend on DigitalStack360 — not at
build time, not at runtime, not at test time, and not in its assumptions.

Specifically:

- OAAF imports no DigitalStack package, calls no DigitalStack API, requires no
  DigitalStack database, and uses no DigitalStack auth or session model.
- OAAF schemas contain no DigitalStack tenant or project assumptions.
- OAAF examples, tests, and releases work independently.
- Protocol concepts, type names, schema fields, and enum values use neutral
  vocabulary. Product terminology may appear only in a clearly-labelled downstream
  integration example.
- DigitalStack360's execution host is _an example_ of an enforcement point, never a
  privileged one. The protocol grants no implementation special standing.

## Ownership boundary

| OAAF owns                                                   | DigitalStack360 owns                          |
| ----------------------------------------------------------- | --------------------------------------------- |
| Subject and issuer identity                                 | Organizational and project context            |
| Authority grants, capabilities, resources, constraints      | Work intake and task decomposition            |
| Delegation, narrowing, and lineage                          | Prioritization, scheduling, capacity          |
| Revocation and expiry                                       | Workforce coordination and readiness          |
| Verification and authorization decisions                    | Continuation and retry intelligence           |
| Portable audit evidence                                     | Recovery and execution-control state machines |
| Protocol schemas, conformance, enforcement-point interfaces | Commercial governance, analytics, cost        |
| Conformance suite and test vectors                          | Hosted operations and managed execution       |

A third category sits between them: the execution-continuity concepts that this ADR
does **not** assign to OAAF. They are reserved pending intellectual-property review —
see [ADR-0002](0002-reserved-execution-continuity-semantics.md).

The dividing line is the [litmus test in the charter](../../CHARTER.md#the-litmus-test):
OAAF answers _"is this actor authorized to perform this action under this authority?"_
DigitalStack360 answers _"what should happen next, who should do it, and how should
the organization operate?"_

## Consequences

**Accepted costs.**

- Some work is duplicated. DigitalStack360 will implement adapters and mappings that
  would be unnecessary in a merged codebase.
- OAAF cannot take shortcuts that assume a DigitalStack-shaped world, even when that
  world is the only current consumer. This will occasionally make OAAF's design harder
  than it needs to be for its first user.
- Protocol changes move at RFC speed rather than product speed. When the commercial
  roadmap wants a protocol change quickly, the process still applies.
- OAAF must be justified on its own merits. If nobody outside Edwin Digital adopts it,
  that is real information about the protocol, and the charter's answer is to narrow
  or stop — not to quietly fold it back into the product.

**Benefits.**

- OAAF is credible to adopt for organizations that will never be DigitalStack360
  customers, which is a precondition for it being a protocol at all.
- The commercial moat is clarified rather than eroded: the defensible value was never
  the authority object format, it is the context, orchestration, and operations built
  above it.
- Scope arguments have an answer that does not depend on who is in the room.

**Enforcement.**

- [`scripts/check-dependency-boundary.mjs`](../../scripts/check-dependency-boundary.mjs)
  fails CI on any forbidden dependency or import.
- The boundary is stated in [CHARTER.md](../../CHARTER.md) and in the README.
- The guard checks build edges, not prose. These documents name DigitalStack360
  deliberately, in order to explain the boundary; that is the intended use.

The guard catches the crude violation — an import, a dependency. It cannot catch the
subtle one, which is a schema field that quietly assumes one product's model. That
remains a review responsibility, and it is the reason the vocabulary rule exists.

## Alternatives considered

**Keep OAAF internal until v1.0.** Safer against premature design lock-in, but it
forfeits the external design review that is the main reason to do this in the open. An
authority model reviewed only by its first consumer will encode that consumer's
assumptions, which is precisely the failure this ADR exists to prevent.

**Open-source the whole platform.** Removes the boundary problem by removing the
commercial product. Not a viable business decision, and it would produce a large
undifferentiated codebase rather than a protocol anyone can implement independently.

**Rely on maintainer judgement without a mechanical check.** This is what everyone
intends to do, and it is how the drift happens. The guard costs about a hundred lines
and turns a matter of vigilance into a build failure.

# ADR-0003: Implement existing authority standards rather than define a competing wire format

- **Status:** Accepted
- **Date:** 2026-08-18
- **Deciders:** Edwin Digital LLC (initial maintainer)
- **Relates to:** [ADR-0001](0001-oaaf-digitalstack360-separation.md), [ADR-0002](0002-reserved-execution-continuity-semantics.md)

## Context

OAAF was founded on the premise that agent systems lack a portable way to express and
verify the authority under which an action is taken, and that OAAF would define the
object carrying it — a grant schema, a delegation model, an evidence format.

Before writing that schema, an internal standards review examined whether a
vendor-neutral mechanism already existed for attaching narrowable authority,
provenance, constraints, and evidence to an agent-to-agent or agent-to-tool request.

It does, across several bodies of work:

| Layer                                | Existing work                                                                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workload and agent identity          | SPIFFE / WIMSE, with X.509-SVID and JWT-SVID credential formats                                                                                                                                                                             |
| Attenuating delegation               | Attenuating Authorization Tokens — offline derivation of strictly narrower authority, with formal monotonicity invariants for depth, TTL, capability, and constraint subsumption, plus cryptographic parent binding and proof of possession |
| Authorization decisions              | OpenID Foundation AuthZEN Authorization API 1.0, a published standard separating policy decision points from enforcement points                                                                                                             |
| MCP tool authorization               | AuthZEN COAZ, a working group draft mapping MCP tool invocations into AuthZEN authorization requests                                                                                                                                        |
| Resource and audience scoping        | OAuth 2.1 with RFC 8707 Resource Indicators and RFC 9728 Protected Resource Metadata, already required by MCP authorization                                                                                                                 |
| Capability and constraint expression | RFC 9396 Rich Authorization Requests; RFC 8693 Token Exchange for cross-domain chaining                                                                                                                                                     |
| Portable evidence                    | Signed decision receipts — independently verifiable without contacting the issuer                                                                                                                                                           |
| Agent-to-agent transport             | A2A, which carries a URI-identified extension mechanism any party may define and publish                                                                                                                                                    |

Classifying each concept in the candidate OAAF envelope against this work produced a
clear result: nearly every primitive is available to adopt or profile, and none
required inventing.

That is a good outcome, not a disappointing one. The charter's litmus test asks whether
a primitive is required for an independent system to represent, delegate, revoke,
verify, or audit authority. It never asked whether OAAF invented it. Discovering that
the primitives exist means the interoperability problem is closer to solved than
assumed — and moves the useful work somewhere else.

What the review did **not** find was running code connecting these pieces. The
attenuating-token work explicitly declines to define a transport binding. The MCP
profile work does not extend to A2A. No conformance suite exists against which two
independent implementations can demonstrate they agree.

That seam — between specifications that are individually sound and an agent developer
who needs them to work together — is where OAAF can contribute something that does not
already exist.

## Decision

**OAAF will implement and profile existing authority standards rather than define a
competing authority-envelope wire format.**

The revised thesis:

> OAAF is an open interoperability toolkit for carrying, enforcing, and testing
> delegated authority across agent and tool protocols.

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

OAAF's deliverable is running code in five areas:

- **Bindings** — carrying an attenuated authority chain over MCP and over A2A, the
  latter as a published, URI-identified A2A extension
- **Enforcement** — a working enforcement point that verifies a presented chain and
  produces a decision
- **Adapters** — connecting identity, delegation, decision, and evidence
  implementations that were not designed against each other
- **Explainability** — making a denial answerable without reading a specification
- **Conformance** — a suite that lets an independent implementation demonstrate
  compatibility

The intended developer experience is a command, not a document:

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

Where OAAF must express something a standard does not, the order of preference is
**adopt, then profile, then extend, then invent** — and inventing requires a written
argument for why the existing options were insufficient.

## Consequences

**Accepted costs.**

- **OAAF is no longer a protocol.** It is a toolkit. The name remains accurate about
  the subject matter and is now imprecise about the artifact. Renaming is not proposed;
  the framing must simply be stated honestly wherever OAAF describes itself.
- **`spec/0.1` becomes a profile.** It documents which standards OAAF implements, which
  options it selects, and how they compose — not an original wire format. That is a
  demotion in ambition and an improvement in usefulness.
- **Upstream dependency.** Several adopted specifications are Internet-Drafts that may
  change or expire. OAAF inherits that instability, must track revisions, and must be
  explicit about which revision it targets. A profile of a moving target needs
  versioning discipline that an independent format would not.
- **Some primitives will be inconvenient.** Standards designed for adjacent problems
  will not fit perfectly. The temptation to fork rather than profile will recur, and
  each instance must be argued rather than assumed.
- **Less obviously novel.** "We implement other people's standards well" is a harder
  first sentence than "we invented a protocol." It is also more likely to be true.

**Benefits.**

- The contribution is running code and tests, which is harder to produce and harder to
  dismiss than a specification.
- OAAF helps existing standards succeed rather than asking anyone to choose between
  them. That is a materially better position from which to approach the groups doing
  the underlying work, several of which actively solicit implementation feedback and
  interoperability testing.
- Collaborators become the people whose standards OAAF implements — a stronger and more
  durable relationship than recruiting adopters for a competing format.
- Every `ADOPT` classification reduces the surface OAAF must design, secure, and
  defend. For a small project, that is the difference between a maintainable scope and
  an aspirational one.

**Unchanged.**

- The [dependency boundary](0001-oaaf-digitalstack360-separation.md) is untouched.
  DigitalStack360 may depend on OAAF; OAAF must never depend on DigitalStack360.
- The [reserved concepts](0002-reserved-execution-continuity-semantics.md) remain
  reserved. Nothing in this decision releases them, and the outstanding
  intellectual-property review remains outstanding.
- The charter's scope rule and litmus test stand as written. This decision changes what
  OAAF _builds_, not what OAAF is _for_.

## Alternatives considered

**Define the authority envelope as originally planned.** Rejected. The review found the
primitives already specified, in some cases in more mechanical detail than OAAF had
reached. Publishing another format would duplicate solved work and place OAAF in
competition with standards activity it would rather support.

**Narrow to evidence and conformance only.** Concede identity, envelope, and decisions;
own portable evidence and cross-implementation testing. A defensible minimum, and the
smallest honest surface. Rejected as too thin: signed receipt formats are themselves
being specified, leaving a position that could be eliminated by a single upstream
document.

**Continue as a protocol and reconcile later.** Rejected as the most expensive option.
Protocol semantics become progressively harder to withdraw once implementations exist,
and this review is the cheapest point at which to change direction — before a schema
was written, not after.

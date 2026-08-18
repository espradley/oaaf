# OAAF RFCs

Changes to what OAAF adopts, profiles, extends, or invents go through an RFC.
Everything else does not.

The point is not process for its own sake. OAAF's job is to make existing standards
work together, so the consequential decisions are which standard to follow, which
options to select, and where a gap genuinely requires something new. Those decisions
become expensive to reverse once implementations exist, and an RFC forces the reasoning
to be written down while changing course is still cheap.

Every RFC carries a classification:

| Class     | Meaning                                                          |
| --------- | ---------------------------------------------------------------- |
| `ADOPT`   | Use an existing standard directly.                               |
| `PROFILE` | Constrain or apply an existing standard to the OAAF use case.    |
| `EXTEND`  | Add narrowly missing semantics to something that already exists. |
| `INVENT`  | Create something genuinely new — only when justified.            |

`INVENT` is the classification that requires an argument. The others are the expected
answers. See [ADR-0003](../docs/adr/0003-implement-existing-authority-standards.md).

## When you need an RFC

**Yes:**

- adopting a standard, or changing which one OAAF follows
- changing a profile: which options OAAF selects, or how standards compose
- changing the shape or meaning of a grant, decision, or evidence record
- changing delegation or revocation semantics
- changing conformance requirements
- changing the scope rule or the boundary in [CHARTER.md](../CHARTER.md)

**No:**

- bug fixes, tests, documentation, tooling, CI
- SDK ergonomics that do not change the wire format
- examples and integrations

If you are unsure, open an issue and ask. Asking is cheaper than either mistake.

## Process

1. Copy [`0000-template.md`](0000-template.md) to `rfcs/0000-my-proposal.md`. Leave the
   number at `0000`.
2. Open a pull request. Discussion happens there.
3. A maintainer assigns the next free number when the RFC is accepted, and it is
   merged with status `Accepted`.

An RFC may be merged as `Rejected` or `Withdrawn` when the reasoning is worth keeping.
Recording why an idea was declined saves the next person from re-proposing it.

Anyone may open an RFC. Maintainer status is not required, and it is explicitly not
required to argue that something should be _removed_ from scope.

Acceptance means the design is agreed. It is not a promise of an implementation date.

## Statuses

| Status        | Meaning                                      |
| ------------- | -------------------------------------------- |
| `Draft`       | Under discussion.                            |
| `Accepted`    | Agreed. Implementation may proceed.          |
| `Implemented` | Landed and released; names the spec version. |
| `Rejected`    | Declined, with reasoning retained.           |
| `Withdrawn`   | Abandoned by the author.                     |
| `Superseded`  | Replaced; names the successor RFC.           |

## Index

| RFC                                             | Title                              | Class     | Status   |
| ----------------------------------------------- | ---------------------------------- | --------- | -------- |
| [0001](0001-aat-authzen-enforcement-profile.md) | AAT to AuthZEN Enforcement Profile | `PROFILE` | Accepted |
| [0002](0002-mcp-coaz-binding.md)                | MCP / COAZ Binding                 | `PROFILE` | Accepted |

## Anticipated RFCs

These are the decisions the next program needs. They are scoped to the **minimum useful
local authority flow** — what is required for a developer to install the SDK and get a
correct, explainable allow/deny decision without a service. Nothing below has been
designed yet, and the numbering is provisional.

| RFC      | Subject                                     |
| -------- | ------------------------------------------- |
| RFC-0001 | Grant representation                        |
| RFC-0002 | Capability and resource representation      |
| RFC-0003 | Constraints, validity, and expiration       |
| RFC-0004 | Deterministic evaluation and decision shape |
| RFC-0005 | Delegation and authority narrowing          |

Presentation and verification are in scope only to the extent the golden path requires
them. Hosted authority-state infrastructure is explicitly not an early RFC question:
defining a service before anyone has used the local path would be designing for a user
who does not exist yet.

Do not treat an entry above as reserved. If you want to write one, say so in an issue
first so two people do not draft the same thing.

## Deferred RFC questions

Some questions that look foundational are deliberately **not** open for public design
work yet:

- execution identity as distinct from subject identity, where tied to freshness or
  versioning
- current execution version or freshness values
- stale-worker detection and recovery
- supersession semantics
- runtime- or workforce-driven authority changes

These fall under the
[reserved concepts](../CHARTER.md#reserved-concepts) and are held
for the standards and IP review program on the [roadmap](../ROADMAP.md). An RFC
proposing one will be closed with a pointer here rather than debated on its merits —
the blocker is not the design, it is that the review has not happened.

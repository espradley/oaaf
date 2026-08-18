# Architecture Decision Records

ADRs record decisions that shape the project and would otherwise be re-litigated every
few months by people who were not in the room.

They differ from [RFCs](../../rfcs/README.md) by subject, not by weight. An RFC
proposes a change to what OAAF implements. An ADR records a decision about the
_project_ —
its boundaries, structure, or tooling.

An ADR is immutable once accepted. When a decision changes, write a new ADR that
supersedes the old one and leave the original in place; the reasoning that turned out
to be wrong is often the most useful part.

## Index

| ADR                                                     | Title                                                                             | Status   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| [0001](0001-oaaf-digitalstack360-separation.md)         | OAAF and DigitalStack360 separation                                               | Accepted |
| [0002](0002-reserved-execution-continuity-semantics.md) | Reserved execution-continuity semantics                                           | Accepted |
| [0003](0003-implement-existing-authority-standards.md)  | Implement existing authority standards rather than define a competing wire format | Accepted |
| [0004](0004-fail-closed-configuration.md)               | Security-critical configuration is required, not defaulted                        | Accepted |
| [0005](0005-governance-readiness-gate.md)               | Repository governance readiness is a hard gate before public launch               | Accepted |

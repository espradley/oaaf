# OAAF Specification 0.1

- **Status:** Draft — under active design. Not stable, not implemented.
- **Spec version:** `0.1`

## Contents

| Document                           | Status                                       |
| ---------------------------------- | -------------------------------------------- |
| [architecture.md](architecture.md) | Draft — actors, enforcement point, lifecycle |

## Not yet written

The normative protocol surface is deliberately absent. Each item below lands through
the [RFC process](../../rfcs/README.md) rather than by accretion, so that the reasoning
behind each decision is recorded while it is still cheap to change:

- `authority-grant.schema.json` — the grant object (RFC-0001, RFC-0002)
- constraints, validity, and expiration (RFC-0003)
- deterministic evaluation and the decision shape (RFC-0004)
- delegation and narrowing rules (RFC-0005)
- `audit-event.schema.json` — portable evidence
- conformance requirements

## Versioning

A tagged spec version is not silently edited. Corrections that change meaning produce a
new version. SDK versions move independently: several SDK releases may target one spec
version.

An implementation that encounters an unrecognized spec version must refuse the
exchange rather than guess at its meaning. OAAF fails closed.

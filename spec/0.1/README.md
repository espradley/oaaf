# OAAF Specification 0.1

- **Status:** Draft profile — under active design. Partially implemented (see the SDK); not stable.
- **Spec version:** `0.1`

## Contents

| Document                           | Status                                       |
| ---------------------------------- | -------------------------------------------- |
| [architecture.md](architecture.md) | Draft — actors, enforcement point, lifecycle |

## Not yet written

OAAF defines no wire format of its own. What belongs here is a **profile**: which
standards OAAF follows, which options it selects, how they compose, and which revisions
it targets. Each item below lands through the [RFC process](../../rfcs/README.md), so
the reasoning is recorded while changing course is still cheap:

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

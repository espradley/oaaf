# ADR-0005: Repository governance readiness is a hard gate before public launch

- **Status:** Accepted
- **Date:** 2026-08-18
- **Deciders:** Edwin Digital LLC (initial maintainer)

## Context

The roadmap sequences toward O5, public launch — the phase where OAAF actively seeks
stars, users, external issues, and contributors. Everything before O5 has been building
toward a repository that is _technically_ sound: a verified authority kernel, a
standards-first profile, a dependency boundary enforced in CI.

None of that is the same thing as a repository that is _ready to receive external
people_. A contributor's first PR, a stranger's security report, and a maintainer's
first non-founder decision each exercise process that has not been tested yet — the RFC
process has one accepted RFC and no external author, the security policy's reporting
channel has never received a report, and the DCO sign-off flow has never seen a
contributor who didn't already work here.

Launching before that process is exercised risks the worst kind of first impression: an
external contributor's first interaction with the project is also the project's first
time handling one, and both parties learn the gaps in public. This decision exists to
make sure that ordering doesn't happen by default.

## Decision

**A new phase, O4.5, sits between O4 and O5: open-source contribution and repository
governance readiness. It is a hard gate — O5 does not begin until O4.5 is certified
complete.**

O4.5 verifies the process is real, not merely documented:

- The security reporting channel is confirmed working, per the item already tracked in
  [docs/pre-launch-checklist.md](../pre-launch-checklist.md).
- The RFC process has been exercised by someone who is not a founding maintainer, or a
  credible path for that exists.
- The DCO sign-off flow, branch protections, and required CI checks are verified against
  a real pull request, not just described in CONTRIBUTING.md.
- The repository namespace and `@oaaf` npm scope decisions, deferred since O1, are
  resolved — see the pre-launch checklist.
- CODE_OF_CONDUCT.md's enforcement contact is confirmed reachable.
- The governance model in GOVERNANCE.md is re-read against what O1 through O4 actually
  did, and corrected if practice has drifted from what it describes.

This is deliberately a gate on _process_, not on protocol maturity. O4.5 does not
require the conformance suite (that is O6) or a stable spec version. It requires that
when a stranger shows up, the mechanisms for receiving them work.

## Consequences

**Accepted costs.**

- O5 is delayed by however long O4.5 takes to certify. For a project whose funding
  strategy depends partly on demonstrating external adoption, delaying the start of
  adoption-seeking is a real cost, not a formality.
- Some O4.5 items — a real external RFC, a real external PR — cannot be manufactured on
  demand and may require waiting for organic interest that public launch itself would
  normally generate. This is a chicken-and-egg tension the phase has to navigate rather
  than solve outright; where a genuine external example isn't available, O4.5 close-out
  should say so explicitly rather than treat a founder-simulated example as equivalent.

**Benefits.**

- The project's first real external interactions happen against processes that have
  already been checked, not discovered live.
- It converts several items that would otherwise be silent assumptions — "the security
  channel probably works," "the DCO flow is probably fine" — into things that were
  actually verified, consistent with the standards-first project's own insistence on
  verifying against primary sources rather than assuming.
- It gives O5's "public launch" a clean, defensible start date rather than a fuzzy one.

## Scope

O4.5 is about the mechanisms of contribution and governance, not about the protocol.
Protocol conformance, standards fidelity, and upstream participation remain owned by O6
and are unaffected by this gate.

## Alternatives considered

**No dedicated phase — fold readiness checks into O5 itself.** Rejected: it would make
"launch" and "verify we can handle launch" the same activity, which reintroduces the
exact ordering problem this ADR exists to avoid — discovering a broken process at the
moment a stranger is using it.

**Treat it as a checklist item, not a roadmap phase.** The existing
[pre-launch checklist](../pre-launch-checklist.md) already carries some of this ground —
namespace, security reporting. Rejected as insufficient on its own: a checklist has no
exit criterion and nothing blocks on it. A roadmap phase with a stated hard-gate
relationship to O5 makes the dependency explicit and load-bearing rather than aspirational.

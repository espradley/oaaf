# Adoption signals — measuring use without telemetry

OAAF needs to answer _"who is using this?"_ without putting surveillance in the SDK. The
answer is: **every adoption signal OAAF relies on is observed from the outside.** Nothing is
collected by the software an adopter installs.

## No telemetry

The installed `@oaaf/sdk` never contacts the network. It has no analytics, no usage
reporting, no license check, no "call home" — by design, and enforced:

- Its only runtime dependencies are `jose` (crypto) and `canonicalize` (JSON) — neither
  opens a socket.
- `npm run check:telemetry` fails CI if the shipped SDK source ever gains a network-capable
  import (`http`, `https`, `net`, `dns`, `undici`, `node-fetch`, …) or a runtime network
  primitive (`fetch`, `WebSocket`, `sendBeacon`, …). See
  [`scripts/check-no-telemetry.mjs`](../scripts/check-no-telemetry.mjs).

If a networked feature is ever genuinely needed, it is an RFC and an explicit, documented
opt-in — never a default, and never silent.

## What is observed instead

All of these are external, public, and require no cooperation from the SDK:

| Signal                            | Where it is observed                                                                                                       | What it indicates                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Repository traffic                | GitHub → Insights → Traffic (views, unique clones)                                                                         | discovery and hands-on trials              |
| Stars / forks / watchers          | GitHub repo                                                                                                                | interest and intent to track               |
| Issues opened                     | GitHub Issues, esp. `interoperability` / `adopter` labels                                                                  | real integration friction and declared use |
| Pull requests                     | GitHub PRs                                                                                                                 | contribution                               |
| npm downloads _(once published)_  | npmjs.com package page / npm registry API                                                                                  | installs of the SDK                        |
| npm dependents _(once published)_ | npmjs "Dependents" / ecosystem search                                                                                      | packages built on OAAF                     |
| Reverse dependencies in code      | GitHub code search for `@oaaf/sdk`                                                                                         | integrations in public repos               |
| Voluntary self-identification     | [adopter issue template](https://github.com/espradley/oaaf/issues/new?template=adopter.md) → [ADOPTERS.md](../ADOPTERS.md) | named, verified adopters                   |

## The two kinds of evidence

- **Ambient signals** (traffic, stars, downloads) show _that_ adoption is happening and
  roughly how much. They are anonymous and require no action from adopters.
- **Named evidence** (a filed adopter declaration, a public integration, a contributed PR)
  shows _who_ — and only ever because that person chose to be visible.

For the funding objective, the second kind is what matters: an independent evaluator,
integration, contributor, or adopter who voluntarily surfaces. That evidence accrues in
public and is not manufacturable by the maintainers.

## Boundary

This document is public and describes only externally-observable signals. Internal
competitive/adoption analysis lives in `docs/adoption/`, which is intentionally excluded
from the repository. The distinction is deliberate: the _mechanism_ for observing adoption
is open; private strategy is not.

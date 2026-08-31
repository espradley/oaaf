# The outsider adoption journey

This document certifies the path a person **outside Edwin Digital** follows to go from
never having heard of OAAF to depending on it — and, if they choose, identifying themselves
as an adopter. Every step below is real, runnable, and CI-verified today.

> ## Two states
>
> **Engineering ready — ✅.** Everything an outsider needs to complete the journey exists,
> works, and is verified in CI. This document is the map, and it is honest.
>
> **Externally certified — ⬜ (not self-certifiable).** The journey is only truly proven
> when an actual outsider completes it. OAAF's maintainers cannot mark this state by
> role-playing an outsider; it is claimed only when a real, independent user has done it and
> said so. It is deliberately left unclaimed here.

```text
DISCOVER ─► TRY ─► INSTALL ─► VERIFY ─► ADOPT ─► CONTRIBUTE
```

## DISCOVER — understand what OAAF is

Start at the [README](../README.md): the problem, the model, the core principle, and — just
as important — [what OAAF is not](../README.md#what-oaaf-is-not). The one-paragraph version:

> OAAF decides whether presented delegated authority is **valid**. Your organization's PDP
> decides whether policy **permits** the action. OAAF is not another OPA/Cedar/AuthZEN/OpenFGA.

The [CHARTER](../CHARTER.md) draws the boundary; it is enforced in CI, not just asserted.

## TRY — see authority enforced, no integration code

Clone the repo and run any of these. They need Node.js 20+, no account, no network, no
credentials:

```bash
npm install
npm run demo          # a delegated agent refused a path it gave up
npm run demo:mcp      # OAAF as a precondition on an MCP tools/call (RFC-0002)
npm run demo:mcp-filesystem  # OAAF guarding a real MCP filesystem server
npm run demo:a2a      # OAAF enforcement over an A2A message (RFC-0003)
npm run demo:cross    # the same authority, same result, across transports (RFC-0003C)
npm run demo:pdp      # OAAF in front of an existing PDP (RFC-0006)
npm run inspect -- --example allow    # inspect one decision locally, offline
```

Trying is the only stage that involves the monorepo. **Adopting does not** — see INSTALL.

## INSTALL — add OAAF to _your_ project

An outsider integrates the published package; they do **not** clone this monorepo to build
against it. See [`@oaaf/sdk` install](../packages/typescript/README.md#install).

```bash
npm install @oaaf/sdk
```

`oaaf` is published on PyPI too (`pip install oaaf`). The published artifact is re-certified in
CI on every change (`npm run check:package`), so what an outsider installs is exactly what the
tests run against. Releasing a new version is documented in [releasing](releasing.md).

## VERIFY — confirm it does what it claims

- Run the SDK's own gate: `npm run check` (dependency boundary, no-telemetry guard, format,
  typecheck, tests).
- The behavior is the same across two independent implementations — the TypeScript reference
  and the [Python implementation](../python/README.md) — certified against
  [portable conformance corpus](../spec/0.1/conformance/vectors/README.md). That is the beginning of an
  implementation-independent conformance corpus (O6).
- The SDK contacts no network: the [no-telemetry guarantee](adoption-signals.md#no-telemetry)
  is enforced by `npm run check:telemetry`, not merely promised.
- Prove an implementation conformant **without adopting ours**: the
  [conformance runner](../spec/0.1/conformance/runner.md) drives any implementation (in any
  language, via a small adapter) against the portable corpus and reports self-declared
  `CONFORMANT` / `NOT CONFORMANT`. `npm run conform` runs it against the reference adapter.

## ADOPT — use it, and optionally say so

Adoption needs no permission and no announcement. If you _choose_ to be counted, self-identify
via the [adopter issue template](https://github.com/espradley/oaaf/issues/new?template=adopter.md)
("We're evaluating / using OAAF"). Voluntary self-identification is the only way onto
[ADOPTERS.md](../ADOPTERS.md), and entries are independently verified — no names are added by
maintainers on an adopter's behalf.

How adoption is observed without any telemetry in the SDK is documented in
[adoption signals](adoption-signals.md).

## CONTRIBUTE — improve the standard

- [CONTRIBUTING](../CONTRIBUTING.md) — how to propose changes and the bar for them.
- An interoperability gap OAAF cannot express →
  [interoperability bug](https://github.com/espradley/oaaf/issues/new?template=interop_bug.md).
- A normative change → the [RFC process](../rfcs/README.md) and
  [rfc-intent template](https://github.com/espradley/oaaf/issues/new?template=rfc_intent.md).
- [GOVERNANCE](../GOVERNANCE.md) and [CODE_OF_CONDUCT](../CODE_OF_CONDUCT.md) apply throughout.

## What this journey is not

It is not a growth funnel and there is no tracking in it. OAAF does not phone home at any
step; the SDK has no analytics. The point of certifying the journey is that a motivated
outsider can complete it unaided — the evidence of adoption then appears in public, external
signals, not in data the SDK collected about them.

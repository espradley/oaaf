# Extension policy

OAAF integrates with transports and external systems, so it must be clear about how
extensions work: how they are named, when they belong in OAAF versus a separate project,
and what they may and may not do. This is policy; it does not build a registry or a
discovery service (O5/O6 may formalize discovery later if a real need appears).

## What an extension is here

An extension adds behavior around OAAF's authority evaluation without changing the
authority model itself — a transport binding (MCP, A2A), an adapter to another system, or
a profile that constrains how OAAF is used in a particular setting.

Extensions do **not** define new authority semantics. Delegation, narrowing, proof of
possession, and the decision itself are OAAF's core, changed only through the
[RFC process](../rfcs/README.md).

## Naming and identification

- An extension that is part of OAAF is defined by an RFC and, where a transport requires
  a URI (as A2A does), carries an OAAF-namespaced identifier — currently `oaaf.dev/...`
  — that identifies the _specification_, not an implementation endpoint.
- An extension maintained outside OAAF uses its own namespace, never an OAAF one. This
  keeps "an OAAF extension" and "an extension that works with OAAF" distinct.
- Extension identifiers are versioned. A breaking change to an extension mints a new
  version identifier (e.g. a new `/vN` URI); it does not silently redefine the old one.

## Core versus external

An extension belongs **in OAAF core** when:

- it is a binding to a widely-used transport or standard that many consumers need, and
- it stays strictly inside portable authority (it does not drag in vendor-specific or
  execution-control semantics — see the [reserved concepts](../CHARTER.md#reserved-concepts)), and
- the maintainers accept the long-term burden of keeping it conformant.

An extension belongs in a **separate package or project** when:

- it is specific to one vendor, product, or deployment, or
- it carries semantics outside OAAF's charter, or
- it would expand OAAF's maintenance surface beyond what the charter's scope discipline
  allows.

When in doubt, it starts outside core. Moving in later is an RFC; moving out is easy.

## Required versus optional

- An extension may be **optional** (a consumer opts in) or **required** (a consumer must
  honor it for a gated operation), where the transport provides that distinction.
- Where an operation is gated on OAAF authority, the extension **must** be declared
  required by whatever mechanism the transport offers (for A2A, `required: true` in the
  Agent Card), and absence or non-activation **must fail closed** — the operation is
  refused, never processed without the authority check. This is the same fail-closed rule
  as [ADR-0004](adr/0004-fail-closed-configuration.md).

## Namespace collision avoidance

- OAAF-defined identifiers live under an OAAF namespace; nothing else does.
- Metadata keys an extension writes into a transport's data structures are namespaced by
  the extension's identifier (as RFC-0003 does with `oaaf.dev/a2a/authority/v1/chain`),
  so two extensions cannot collide on a bare key.

## Scope boundary

Every extension, core or external, stays inside portable authority. An extension must not
introduce execution state, work lifecycle, scheduling, worker selection, recovery, or any
other [reserved concept](../CHARTER.md#reserved-concepts). An extension that would require
those does not belong in OAAF and cannot be made to by calling itself an extension.

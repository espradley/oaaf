# OAAF Charter

This charter defines what the Open Agent Authority Framework is for, what belongs
inside it, and — more importantly — what does not. It is the document to reach for
when someone proposes a feature and the honest answer is "maybe."

It is deliberately restrictive. A protocol that accepts every good idea becomes a
platform, and a platform is not what this project is trying to be.

## Purpose

OAAF is an open, vendor-neutral protocol and reference toolkit for representing and
verifying the authority under which an autonomous actor performs an action.

The core principle:

> The model may decide what it wants to do. The authority layer decides what it is
> permitted to do.

Authority should survive the replacement of a model or provider. It must not survive
revocation or expiration.

## The scope rule

> A primitive belongs in OAAF when it is required for an independent system to
> represent, delegate, revoke, verify, or audit the authority under which an
> agent, workload, service, or delegated human performs an action.

The words "independent system" carry weight. If a primitive is only coherent inside
one vendor's product, it is not a protocol primitive.

## The litmus test

When a proposal is ambiguous, ask which question it answers.

- If it answers **"is this actor authorized to perform this action under this
  authority?"** — it may belong in OAAF.
- If it answers **"what should happen next, who should do it, how should work be
  coordinated, or how should an organization operate its AI workforce?"** — it does
  not belong in OAAF.

The test is about the _question_, not the _feature_. Rate limiting expressed as a
constraint on a grant answers the first question. Rate limiting expressed as a
scheduler backpressure policy answers the second. Same words, different protocol.

## In scope

OAAF should own:

| Area             | Concepts                                                                     |
| ---------------- | ---------------------------------------------------------------------------- |
| Identity         | subject identity, issuer identity                                            |
| Authority        | authority grants, capabilities, resource scopes, constraints, grant validity |
| Lineage          | delegation, authority narrowing, grant lineage                               |
| Invalidation     | revocation, expiry                                                           |
| Evaluation       | authority verification, authorization decisions                              |
| Accountability   | portable audit evidence                                                      |
| Interoperability | protocol schemas, conformance behavior, enforcement-point interfaces         |

## Out of scope

OAAF must **not** become responsible for:

- determining which worker should perform a task
- workforce scheduling, queueing, prioritization, capacity management
- project context, organizational context
- memory / RAG
- task decomposition, agent planning, workflow orchestration
- provider or model routing
- commercial approval workflows
- enterprise governance UI
- cost management, billing
- operational dashboards, customer analytics
- managed execution infrastructure

These are real, valuable capabilities. They belong to **products built on OAAF** —
including DigitalStack360. They do not belong to the protocol.

Note the asymmetry that keeps this honest: OAAF may define a constraint expressing
_"this action requires approval above a risk threshold."_ It must not define the
approval workflow, the approver hierarchy, the notification, or the UI. The protocol
carries the requirement; the product satisfies it.

## The OAAF Enforcement Point

An **OAAF Enforcement Point** is the component positioned immediately before a
consequential action that:

1. verifies the presented authority,
2. evaluates the requested capability, resource, and constraints against current
   authority state, and
3. refuses execution unless the resulting decision permits it.

An enforcement point does **not** decide what an agent should do. It determines
whether the intended action is authorized. The distinction matters: an enforcement
point that starts choosing actions has become an orchestrator, and OAAF has drifted.

This is an architectural abstraction, not a required hosted product. Anything sitting
in front of a consequential action can be one:

- MCP middleware
- an agent runtime
- a tool gateway
- a shell wrapper
- a Git proxy
- a browser automation gateway
- an API gateway
- a database or tool proxy
- a commercial execution host, including DigitalStack360's

The last entry is an example of an enforcement point, not a privileged one. OAAF must
never grant a specific implementation special standing in the protocol.

A consequence worth stating plainly: OAAF assumes the agent may be prompt-injected,
compromised, or simply wrong. The enforcement point must never rely on agent
self-restraint, and must fail closed — unverifiable, expired, revoked, or malformed
authority denies the action.

## Reserved concepts

Distinct from the out-of-scope list above. The concepts below are not rejected on
principle; they are **reserved**, meaning OAAF does not define them publicly until an
explicit intellectual-property review has completed. Treat a proposal touching any of
them as blocked rather than debatable.

- logical execution continuity
- worker supersession algorithms
- recovery detection, recovery authority transfer, execution takeover
- retry and continuation authority behavior
- workforce recovery state machines
- rules determining when an authority version or freshness value advances
- automatic grant-lifecycle changes driven by runtime or workforce state
- interactions between authority and scheduling, capacity, or readiness

The reasoning is straightforward. These semantics are entangled with differentiated
execution-control architecture that has not been cleared for publication. Opening the
interoperability layer does not require opening the operational intelligence built
above it, and publishing these prematurely would be difficult to reverse.

OAAF may **later** expose a generic extension point through which an enforcement point
consumes an externally supplied freshness or version value and refuses an action when
that value is not current. Such an extension point would treat the value as opaque
input. OAAF would not define the machinery deciding when or why the value changes;
that determination belongs to whatever system is operating the work.

This reservation is revisited in the standards and IP review program on the
[roadmap](ROADMAP.md).

## Relationship to DigitalStack360

Two statements govern this relationship, and neither is negotiable within v0.x.

> **OAAF is not DigitalStack360 Community Edition.**

OAAF is not a stripped-down build of a commercial product, a lead-generation funnel,
or a staging ground for features that will later be paywalled. It is infrastructure
that must be worth adopting by people who will never buy anything from Edwin Digital
LLC.

> **DigitalStack360 may depend on OAAF. OAAF must never depend on DigitalStack360.**

```text
        OAAF
          ^
          |
   DigitalStack360
```

Never the inverse. In practice this means:

- OAAF imports no DigitalStack package.
- OAAF calls no DigitalStack API.
- OAAF requires no DigitalStack database.
- OAAF uses no DigitalStack auth or session model.
- OAAF schemas contain no DigitalStack tenant or project assumptions.
- OAAF examples are runnable independently.
- OAAF tests are runnable independently.
- OAAF releases are possible independently.

This is enforced mechanically, not by good intentions:
[`scripts/check-dependency-boundary.mjs`](scripts/check-dependency-boundary.mjs) fails
CI on any forbidden dependency or import. See
[ADR-0001](docs/adr/0001-oaaf-digitalstack360-separation.md) for the reasoning.

## Vocabulary

The protocol is defined in vendor-neutral terms:

```text
subject      issuer       grant        authority    capability
resource     constraint   delegation   decision     evidence
verifier     enforcement point
```

Protocol-level concepts must not depend on vendor or product vocabulary — terms such
as _ticket_, _workforce_, _AI employee_, _project queue_, or product feature names.
Such terms may appear in a downstream integration example clearly marked as one; they
must never define a protocol concept, schema field, type name, or enum value.

Resource identifiers must be equally neutral. A resource selector names a repository,
a path, or an environment — not a vendor's tenancy model.

## Amending this charter

The scope rule and the two DigitalStack360 statements are the stable core. Changing
them requires an RFC and an explicit maintainer decision recorded in an ADR. Adding a
concept to the in-scope table requires an RFC that argues it against the litmus test.

Narrowing OAAF is always cheaper than widening it. When in doubt, leave it out.

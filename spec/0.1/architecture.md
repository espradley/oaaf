# OAAF Architecture

- **Status:** Draft
- **Spec version:** `0.1`

This document describes the architectural model — the actors, where they sit, and what
each is responsible for. It is not the wire protocol. Object shapes, field names, and
evaluation rules are normative material that arrives through the
[RFC process](../../rfcs/README.md); nothing here should be read as fixing them.

## The problem being solved

Most agent systems express permission as application configuration, an API credential,
or a tool allow-list. Each answers _"can this process reach this API?"_ None answers
_"is this actor authorized to perform this action, right now, under an authority that
can be pointed to afterward?"_

The gap is visible the moment the two diverge:

```text
Agent requests:
  github.merge_pull_request

Presented authority permits:
  github.read
  github.write
  github.create_pull_request

Decision:
  DENY

Reason:
  capability_not_granted
```

The credential could merge. The authority could not. Nothing in a token, an allow-list,
or a session flag distinguishes those two facts, which is the space OAAF occupies.

It shows up in three recurring places:

- **Scope.** Credentials are issued to a process, not to an intent. An agent handed a
  repository token to fix a typo can also force-push to a release branch, and no
  artifact in the system records that it was never supposed to.
- **Handoff.** When one agent delegates to another, the second agent's authority is
  usually implicit. There is no machine-verifiable statement that it is no broader than
  the first agent's.
- **Audit.** Logs record that an action happened. They rarely prove which authority
  permitted it, or that a refusal occurred at all.

## Actors

```text
  ┌──────────┐  issues   ┌──────────────────┐
  │  Issuer  │──────────>│ Authority Grant  │
  └──────────┘           └──────────────────┘
       │                          │ presented by
       │ maintains                ▼
       ▼                    ┌──────────┐
┌──────────────────┐        │ Subject  │
│ Authority State  │        └──────────┘
│ revocations      │              │ requests action
└──────────────────┘              ▼
       ▲               ┌────────────────────────┐
       │               │   Enforcement Point    │
       └───────────────│  ┌──────────────────┐  │
          consults     │  │     Verifier     │  │
                       │  └──────────────────┘  │
                       └────────────────────────┘
                            │              │
                       ALLOW│DENY          │ emits
                            ▼              ▼
                        ┌────────┐   ┌──────────┐
                        │  Tool  │   │ Evidence │
                        └────────┘   └──────────┘
```

### Subject

The durable identity authority is granted to. A subject is deliberately _not_
synonymous with a model session or an operating-system process: it may be a named AI
worker, a workload identity, a service account, or a delegated human.

Binding authority to a session would mean authority dies and resurrects with the
session, which makes it impossible to reason about independently of the runtime that
happens to be hosting the agent.

### Issuer

The entity permitted to create grants. An issuer is trusted by verifiers through a
configured trust relationship; establishing that relationship is deployment
configuration, not something OAAF invents.

### Authority grant

The central object: a statement that a subject may perform certain capabilities
against certain resources, under certain constraints, for a bounded time, within a
lineage.

The grant is a _claim_, not a decision. It is presented; it is not obeyed.

### Authority state

Facts that change after a grant is issued and that the grant cannot carry within
itself — principally revocation. A grant is a snapshot; authority state is the present
tense.

The minimum useful flow does not require authority state to be remote. A grant with a
validity window can be evaluated entirely locally, and that is the deliberate starting
point: OAAF should be useful before it is networked.

### Enforcement point

The component positioned immediately before a consequential action. It:

1. verifies the presented authority,
2. evaluates the requested capability, resource, and constraints against current
   authority state, and
3. refuses execution unless the resulting decision permits it.

**The enforcement point does not decide what an agent should do. It determines whether
the intended action is authorized.** An enforcement point that starts selecting or
sequencing actions has become an orchestrator, and OAAF has drifted past its charter.

It is an architectural role, not a product. Anything sitting in front of a
consequential action can play it: MCP middleware, an agent runtime, a tool gateway, a
shell wrapper, a Git proxy, a browser automation gateway, an API gateway, a database
proxy, or a commercial execution host.

The role matters more than the placement. What makes something an enforcement point is
that the action cannot occur without passing through it. A check the agent can route
around is advice, not enforcement.

### Verifier

The evaluation logic inside an enforcement point: given a presented authority, a
requested action, and current authority state, produce a decision. Factored out
separately because it must be embeddable — an SDK function, a sidecar, or a remote
service — and because independent implementations of it are what conformance testing
exists to compare.

Evaluation is deterministic. The same authority, action, and state must produce the
same decision everywhere, or the protocol is not portable.

### Decision

A structured allow or deny, carrying a reason a developer can act on. A denial that
says only `false` forces whoever hit it to read the specification; a denial that says
`capability_not_granted` and names the missing capability usually does not.

Denial reasons are protocol surface, not a debugging convenience. They are what makes
an enforcement point's behavior explainable to the person operating the agent.

### Evidence

A portable record linking subject, authority, requested action, decision, reason, and
result. Evidence is emitted for denials as well as allows: a denial is frequently the
more interesting event, and a log recording only successes cannot demonstrate that a
control worked.

## Authority lifecycle

| Stage        | What happens                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------- |
| **Issue**    | An issuer creates a grant for a subject.                                                        |
| **Present**  | The subject presents the grant, or a reference to it, when requesting a consequential action.   |
| **Evaluate** | The verifier combines capability, resource, constraints, validity window, and revocation state. |
| **Execute**  | The tool performs the action only after an allow decision.                                      |
| **Audit**    | Evidence is emitted linking the action to the authority that permitted it.                      |
| **Delegate** | A subject with delegation rights creates a strictly narrower child grant.                       |
| **Renew**    | Authority is reissued with a new expiry.                                                        |
| **Revoke**   | The issuer invalidates a grant.                                                                 |

## Delegation

A child agent must never gain authority merely because another agent asked it to act.
Delegation is constrained narrowing: the parent must hold delegation rights, and the
child grant must be provably no broader than the parent along every dimension —
capabilities, resources, constraints, and expiry.

Lineage remains traceable to an originating issuer, so that "who ultimately authorized
this?" is answerable from the evidence alone.

## Trust and failure model

**Assumed hostile.** The agent presenting authority may be prompt-injected,
compromised, or malicious. No part of evaluation may depend on agent self-restraint,
and no claim an agent makes about itself may be trusted without verification.

**Fail closed.** Authority that is unverifiable, expired, revoked, malformed, or of an
unrecognized spec version denies the consequential action. Ambiguity is a denial, not a
judgement call.

**Least privilege through narrowing.** Delegation only ever narrows. There is no
protocol path by which authority widens.

**Secret minimization.** Grants reference named permissions and secret handles. They do
not carry credential material.

**Policy separation.** OAAF conveys authority and the facts needed to evaluate it.
Organizations layer proprietary policy above that interface; the protocol does not
attempt to express every policy anyone might want, and is explicitly not a general
policy language.

## Relationship to existing standards

OAAF intends to invent as little as possible. Where an existing standard solves a
problem, the intent is to adopt or profile it rather than compete with it — OAuth,
SPIFFE, MCP authorization, AuthZEN, OPA, Cedar, OpenFGA, and existing IAM systems are
integration targets, not things to replace.

OAAF does not replace workload identity or enterprise RBAC. It sits above them: those
systems establish who a subject is, and OAAF expresses what that subject may do for a
specific purpose, with delegation and portable evidence.

This classification is done deliberately rather than by instinct; see the standards and
IP review program on the [roadmap](../../ROADMAP.md).

## Reserved

Some execution-oriented concepts — continuity, supersession, recovery, takeover, and
the machinery determining when an authority freshness value changes — are **reserved**
and deliberately not specified here. See
[the charter](../../CHARTER.md#reserved-concepts).

OAAF may later define a generic extension point for externally supplied freshness or
version information, treating that value as opaque input. It will not define the logic
that produces it.

## What this is not

OAAF does not decide what an agent should attempt. Planning, routing, scheduling, and
coordination sit above the authority layer and are out of scope by charter.

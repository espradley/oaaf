# PDP interoperability

OAAF sits **in front of** an existing authorization / policy-decision system — AuthZEN, OPA,
Cedar, OpenFGA — not instead of it. OAAF verifies delegated authority and hands the existing
PDP the **verified facts** as policy-evaluation context; the PDP makes the organization's
policy decision on top. The normative contract is
[RFC-0006](../rfcs/0006-pdp-interoperability.md).

> **Keep your policy engine. OAAF carries the verified authority into it.**
>
> OAAF answers _"is this delegated authority valid and in scope?"_ Your PDP answers
> _"does org policy permit it?"_ Two decisions, two owners.

## Two decisions, not one

```text
  external identity ─► OAAF authority (verify · attenuate · revocation · identity)
                          │  DECISION 1: is this authority valid and in scope?
                          │  (OAAF's; fails closed; a precondition)
                          ▼
                    enforcement point
                          │  conveys VERIFIED AUTHORITY FACTS as context
                          ▼
              existing PDP (AuthZEN / OPA / Cedar / OpenFGA)
                          │  DECISION 2: does org policy permit this?
                          │  (the organization's; OAAF does not make it)
                          ▼
                        action
```

**Decision 1** is OAAF's and already exists (the O3A precondition): is the delegated
authority cryptographically valid, unrevoked, correctly narrowed, held by the right key, for
the right identity? It fails closed. **Decision 2** is the organization's policy decision,
made by its PDP using OAAF's facts plus everything else it knows — time, tenant, environment,
risk. OAAF supplies inputs to Decision 2; it never makes it.

## The canonical authority context

OAAF exposes the verified-authority facts a PDP might consult as one transport-neutral,
PDP-neutral object — the **authority context**. It is the existing `AuthoritySummary` plus a
marker that these facts come from a _verified_ authority:

| Field                            | Fact                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `authorityVerified`              | `true` — OAAF verified the chain, PoP, revocation, and identity binding as configured |
| `subject`, `subjectProfile`      | the verified subject and its identity profile (RFC-0005)                              |
| `holder`                         | the proof-of-possession key thumbprint                                                |
| `grantedTools`                   | the capabilities the leaf authority holds after narrowing                             |
| `delegationDepth`, `chainLength` | the delegation shape                                                                  |
| `expiresAt`                      | the effective expiry                                                                  |

Names, never values — the same privacy rule as the explanation. A PDP receives _what
authority was verified_, not the raw tokens or argument values.

`authorityVerified: true` is a statement about OAAF's Decision 1, **not** a claim that the
action is permitted. An integration that treats the presence of the context as permission has
skipped Decision 2.

### Building it

Both implementations produce the same object from a verified authority:

```ts
// TypeScript — @oaaf/sdk
import { verifyAuthority, toAuthorityContext } from '@oaaf/sdk';

const verified = await verifyAuthority({ tokens, trustAnchors, pop, tool, args });
if (verified.ok) {
  const context = toAuthorityContext(verified.authority); // { authorityVerified: true, subject, ... }
}
```

```python
# Python — oaaf
from oaaf import verify_chain, to_authority_context

chain, denials = verify_chain(tokens, trust_anchors, now)
if chain is not None:
    context = to_authority_context(chain, tool, args)  # authority_verified=True, subject, ...
```

## AuthZEN is the canonical interface

AuthZEN (RFC-0001) already separates the enforcement point (PEP) from the policy decision
point (PDP) — exactly this architecture. OAAF's AuthZEN Access Evaluation request carries the
authority context in `context.oaaf`, so an AuthZEN-compatible PDP reads it natively. This is
the first-class seam; the other engines are documented adapters.

```jsonc
{
  "subject": { "type": "identity", "id": "spiffe://company.example/agents/bob" },
  "action": { "name": "tools/call" },
  "resource": { "type": "tool", "id": "repo.read" },
  "context": {
    "oaaf": {
      "authorityVerified": true,
      "subject": "spiffe://company.example/agents/bob",
      "subjectProfile": "spiffe",
      "holder": "…thumbprint…",
      "requestedTool": "repo.read",
      "requestedArgumentNames": ["path"],
      "grantedTools": ["repo.read"],
      "delegationDepth": 1,
      "chainLength": 2,
      "expiresAt": 1755500000,
    },
  },
}
```

## Other PDPs are adapters, not dependencies

The same fact set maps into other engines' inputs. These are **examples**, not first-class
protocol dependencies — OAAF takes no runtime dependency on any of them:

| Engine         | Input model                                                 | Authority context goes to                                 | Fit                                                                        |
| -------------- | ----------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| **AuthZEN**    | subject / action / resource / **context**                   | `context.oaaf`                                            | canonical                                                                  |
| **OPA** (Rego) | arbitrary `input` JSON                                      | `input.oaaf`, read as `input.oaaf.grantedTools[_]` etc.   | direct                                                                     |
| **Cedar**      | principal / action / resource / **context** (record)        | `context` attributes                                      | direct                                                                     |
| **OpenFGA**    | relationship tuples (ReBAC); ABAC via **contextual tuples** | contextual tuples derived from `subject` + `grantedTools` | weakest — relationship model, not attribute context; documented, not built |

The common seam across all four is an attribute/context bag, which the first three accept
natively. OpenFGA's relationship model is a poorer fit; the authority context can seed
contextual tuples, but OAAF does not ship an OpenFGA adapter.

A sample Rego rule reading the context OAAF supplies (the policy is the org's, not OAAF's):

```rego
package org.tools

default allow := false

allow if {
    input.oaaf.authorityVerified                 # OAAF verified the authority (Decision 1)
    input.oaaf.requestedTool in input.oaaf.grantedTools
    input.oaaf.delegationDepth <= 1              # org policy — OAAF knows nothing of this rule
}
```

## The hard boundary

OAAF conveys **verified authority facts**. It does **not** evaluate organizational policy,
define a policy language, store policies, decide the final allow/deny on the organization's
behalf, or become an AuthZEN PDP, OPA, Cedar, or OpenFGA. If a change would require OAAF to
encode what an organization's policy _should be_, it is out of scope. **The PDP owns policy;
OAAF owns verified authority.**

## Runnable example

[`examples/pdp-coexistence`](../examples/pdp-coexistence/) runs both decisions end to end
against a stub org PDP (no external engine required):

```bash
npm run demo:pdp
```

It shows an allow (authority valid **and** org policy satisfied) and a deny where OAAF's
authority is cryptographically valid but the org PDP rejects it on a depth rule OAAF knows
nothing about — proof that OAAF fed facts while the PDP owned the decision, and neither
replaced the other.

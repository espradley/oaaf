---
rfc: 0006
title: PDP Interoperability — Conveying Verified Authority as Policy Context
status: Accepted
classification: PROFILE
authors: OAAF maintainers
created: 2026-08-18
supersedes: none
---

# RFC-0006: PDP Interoperability — Conveying Verified Authority as Policy Context

## Summary

Lets an organization keep its existing authorization/policy-decision system (AuthZEN, OPA,
Cedar, OpenFGA) and use OAAF **in front of it**, not instead of it. OAAF verifies delegated
authority and conveys the **verified facts** as policy-evaluation context; the existing PDP
makes the organization's policy decision on top. OAAF does not become the policy engine.

## Motivation

The enterprise-adoption failure mode is: _"We already use OPA / Cedar / AuthZEN / OpenFGA."_
→ _"Great, replace it."_ OAAF must never be that answer. An organization has already
invested in a policy system that encodes its rules; OAAF's job is to hand that system a
verified, attenuated, delegated-authority fact set it could not otherwise compute, and let
it decide.

## Two decisions, not one

This is the whole architecture:

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
authority cryptographically valid, unrevoked, correctly narrowed, held by the right key,
for the right identity? It fails closed. **Decision 2** is the organization's policy
decision, made by its PDP using OAAF's facts plus everything else it knows (time, tenant,
environment, risk). OAAF supplies inputs to Decision 2; it never makes it.

## Charter fit

Answers _"is this actor authorized to perform this action under this authority?"_ — Decision
1 — and then feeds that answer, as facts, to a system answering a broader policy question.
Introduces no organizational policy semantics. Classification: **PROFILE** of the AuthZEN
context mechanism plus documented adapters for other PDP input models.

## The canonical authority context

OAAF exposes the verified-authority facts a PDP might consult as one transport-neutral,
PDP-neutral object — the **authority context**. It is the existing `AuthoritySummary` plus
a marker that these facts come from a _verified_ authority:

| Field                            | Fact                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `authorityVerified`              | `true` — OAAF verified the chain, proof of possession, revocation, and identity binding as configured |
| `subject`, `subjectProfile`      | the verified subject and its identity profile (RFC-0005)                                              |
| `holder`                         | the proof-of-possession key thumbprint                                                                |
| `grantedTools`                   | the capabilities the leaf authority holds after narrowing                                             |
| `delegationDepth`, `chainLength` | the delegation shape                                                                                  |
| `expiresAt`                      | the effective expiry                                                                                  |

Names, never values — the same privacy rule as the explanation. A PDP receives _what
authority was verified_, not the raw tokens or argument values.

## AuthZEN is the canonical interface

AuthZEN (already adopted, RFC-0001) separates the enforcement point (PEP) from the policy
decision point (PDP), which is exactly this architecture. OAAF's AuthZEN Access Evaluation
request carries the authority context in `context.oaaf`; an AuthZEN-compatible PDP reads it
natively. This is the first-class, canonical seam.

The `context.oaaf` shape is now unified: it is the canonical authority context everywhere
(previously the AuthZEN mapping and the MCP binding built slightly different shapes; they
are reconciled to one).

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

## The hard boundary

OAAF conveys **verified authority facts**. It does **not**:

- evaluate organizational policy
- define a policy language
- store policies
- decide the final allow/deny on the organization's behalf
- become an AuthZEN PDP, OPA, Cedar, or OpenFGA

If a change would require OAAF to encode what an organization's policy _should be_, it is
out of scope. The PDP owns policy; OAAF owns verified authority.

This also keeps the DigitalStack boundary clean: the open project stays interoperability
infrastructure, and richer commercial governance can sit above it in a product without OAAF
absorbing that job.

## Security considerations

- The authority context is only meaningful for an authority OAAF **verified**. It is
  produced from a `VerifiedAuthority`, so a PDP cannot be handed facts about an unverified
  chain (the precondition denies first).
- `authorityVerified: true` is a statement about OAAF's Decision 1, not a claim that the
  action is permitted — the PDP must still decide. An integration that treats the presence
  of the context as permission has skipped Decision 2.
- Names, never values: the context carries no token bytes, signatures, PoP material, keys,
  or argument values, so passing it to a PDP does not widen the disclosure surface.

## Privacy considerations

Subject identifiers in the context can themselves be sensitive (RFC-0005); a PDP and its
logs inherit that sensitivity. No new material is exposed beyond what the explanation
already carries.

## Compatibility

Additive. `context.oaaf` is unified to the canonical authority context — a pre-release shape
reconciliation with no external consumers; documented here. No new reason codes, no new
stage, no authority-semantics change. The authority context is available in TypeScript and
Python (both already produce the `AuthoritySummary` it is built from).

## Alternatives considered

- **OAAF evaluates policy itself.** Rejected — it is the policy engine this RFC exists to
  _not_ become, and it would force organizations to abandon their existing PDP.
- **First-class OPA/Cedar/OpenFGA integrations in core.** Rejected — four runtime
  dependencies for a mapping that is a small attribute bag. AuthZEN is canonical; the rest
  are example adapters.
- **A new OAAF policy context format.** Rejected — the `AuthoritySummary` already is the fact
  set; a PDP's own context mechanism carries it.

## Unresolved questions

- Whether to ship a runnable OPA/Cedar example that invokes the real engine (currently the
  mapping is documented and demonstrated with a stub PDP to avoid a heavy dependency).
- A canonical OpenFGA contextual-tuple derivation, if relationship-model demand appears.

## Prior art

RFC-0001 (AuthZEN adoption, PEP/PDP separation), RFC-0002 (`context.oaaf` as a PDP fact
carrier). AuthZEN Authorization API. OPA/Rego, Cedar (PARC), OpenFGA contextual tuples.

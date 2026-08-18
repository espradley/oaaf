---
rfc: 0002
title: MCP / COAZ Binding
status: Accepted
classification: PROFILE
authors: OAAF maintainers
created: 2026-08-18
supersedes: none
---

# RFC-0002: MCP / COAZ Binding

## Summary

RFC-0001 profiles OAAF's AAT-verified authority into a transport-neutral AuthZEN
Access Evaluation request. This RFC defines how OAAF integrates with the Model Context
Protocol specifically, where OpenID's COAZ-MCP binding already defines the canonical
mapping from an MCP request into an AuthZEN request.

**RFC-0001 stays transport-neutral and is not amended.** This RFC does not replace it;
it defines a second, MCP-specific integration that reuses OAAF's verification layer
(`verifyAuthority`, `VerifiedAuthority`) but does **not** reuse RFC-0001's
`subject`/`resource` mapping, because COAZ's mapping is incompatible with it in a way
that matters — see below.

The central finding of this RFC is architectural, not editorial: **OAAF cannot be a
COAZ input.** COAZ's information model is closed to exactly two input variables,
`params` and `token`, and an AAT chain is neither. OAAF's contribution at an MCP
boundary is therefore a verification step the enforcement point performs, not a field
inside the request COAZ constructs.

## Motivation

An MCP server maintainer or gateway operator adopting OAAF should not have to choose
between AAT-attenuated delegation and COAZ's MCP authorization model. Both should work
together, because COAZ already solves the problem of mapping an MCP tool call into an
authorization question, and OAAF already solves the problem of verifying delegated,
narrowed authority. Neither should be re-derived by the other.

## Charter fit

Answers _"is this actor authorized to perform this action under this authority?"_ — the
authority half is OAAF's verified chain; COAZ supplies the request/decision half.
Introduces no scheduling, coordination, or workforce concept. Classification: `PROFILE`
of two adopted standards, composed at their existing extension points.

## Pinned revisions

| Standard                  | Revision                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------- |
| COAZ-MCP binding          | `authzen-coaz-mcp-binding-1_0`, **Draft 1**, 2026-02-13 (OpenID AuthZEN Working Group) |
| COAZ framework            | `authzen-coaz-framework-1_0`                                                           |
| AuthZEN Authorization API | **1.0, Final Specification**                                                           |
| MCP                       | 2026-07-28                                                                             |
| AAT                       | `draft-niyikiza-oauth-attenuating-agent-tokens-01` (unchanged from RFC-0001)           |

COAZ-MCP is a **Working Group Draft**, not yet final. OAAF's support is pinned to Draft
1 and is reviewed when a new COAZ-MCP revision publishes, the same discipline RFC-0001
applies to AAT.

## The architectural finding

COAZ-MCP's information model (§4) exposes exactly two input variables to mapping
expressions:

> `params`: … the `params` object of the MCP JSON-RPC request …
> `token`: … the complete set of decoded claims of the JWT-formatted … OAuth access
> token used to authorize the request.

COAZ's default `tools/call` mapping:

```jsonc
{
  "evaluation": {
    "subject": { "type": "identity", "id": "$token.sub" },
    "context": { "agent": "$token.?client_id" },
    "action": { "name": "tools/call" },
    "resource": { "type": "tool", "id": "$params.name" },
  },
}
```

Two consequences follow directly.

**Subject is the human principal, not the agent.** COAZ anchors `subject.id` to
`$token.sub` from the validated OAuth access token, and its PEP Behavior algorithm
(step 5) requires the PEP to verify that anchoring and treat a mismatch as a mapping
error. RFC-0001 makes the _agent_ the subject, using the AAT leaf holder's JWK
Thumbprint URI. These are not reconcilable by picking one: COAZ's anchoring is
normative for MCP, so for this binding **the principal is the subject and the agent
identity is carried in `context.agent`** — which is what COAZ's own default mapping
already does. RFC-0001's agent-as-subject model remains correct for its own
transport-neutral scope; it simply doesn't apply here.

**An AAT chain has nowhere to go inside COAZ's request.** It is not the OAuth access
token (`token`) — AAT is a different credential format entirely, with no `sub` claim.
It is not an MCP method parameter (`params`) — embedding it there would place delegation
material inside the tool's own argument surface, which is exactly the tool-argument
namespace OAAF's own closed-world constraint checking (RFC-0001, AAT §4.5 step 6b)
would then have to distinguish from real arguments. Both are the wrong place, for the
same reason: they would require OAAF to redefine what COAZ's `subject`, `action`, or
`resource` mean, which the structural rule below forbids.

## Design

### Structural rule

> **COAZ owns the MCP-to-authorization request mapping. OAAF owns portable authority and
> proof of authorization. OAAF MUST NOT redefine MCP request semantics — subject,
> action, or resource — that COAZ already defines, unless a concrete interoperability
> gap is demonstrated against the normative draft.**

No gap was found. COAZ's default mapping is used unmodified.

### OAAF as a PEP precondition, not a COAZ input

COAZ-MCP's PEP Behavior (§9) already enumerates a numbered sequence of MUST steps: parse
the method, select a mapping, validate the token, construct the request, call the PDP,
enforce the response. OAAF integrates as an **additional MUST step**, inserted before
the request is constructed — analogous to, and running alongside, the PEP's existing
requirement to validate the access token before using its claims:

1. **(COAZ steps 1–3, unmodified.)**
2. **OAAF precondition.** If the tool being invoked is configured as requiring OAAF
   authority, the PEP extracts the presented AAT chain and proof of possession and calls
   `verifyAuthority`. On any denial, the PEP **MUST** refuse the message immediately —
   returning a JSON-RPC error carrying the OAAF reason code — and **MUST NOT** proceed to
   construct or send an AuthZEN request. The PDP is never consulted about a request that
   lacked valid OAAF authority.
3. **(COAZ steps 4–6, unmodified.)** The PEP constructs the AuthZEN request using COAZ's
   default or declared mapping, exactly as COAZ-MCP specifies.
4. **Context contribution (optional).** The PEP MAY add a `context.oaaf` member to the
   constructed request, summarizing the _already-verified_ authority — leaf holder
   identity, delegation depth, granted tools — as an additional fact for the PDP's
   policy to consult. This is additive: AuthZEN's core specification states that
   request-side `context` semantics are "an implementation concern … outside the scope
   of this specification," and COAZ's own declared-mapping examples already populate
   `context` with implementation-specific keys (`context.case` alongside
   `context.agent`).
5. **(COAZ step 7, unmodified.)** The PEP enforces the PDP's decision as COAZ specifies.

Step 2 is why this is not an AuthZEN obligation: obligations are response-side (PDP→PEP)
compliance instructions, evaluated by the obligations profile's own normative types —
`step-up`, `notification`, `session_termination`, `custom` — none of which model an
inbound authority proof. OAAF's contribution is evidence available _before_ the request
is built, not an instruction attached _after_ a decision. Read against the raw
normative text, obligations do not fit and were not used.

Step 2 is also why this is not a COAZ context expression: COAZ's expression language
evaluates `$token` and `$params` fields the PEP already has. It has no mechanism to
invoke external verification logic as part of constructing a request. `context.oaaf` in
step 4 is populated procedurally by the PEP after OAAF verification succeeds, not
computed by a COAZ mapping expression.

### Why the precondition denies before calling the PDP, not after

Folding a failed OAAF verification into `context.oaaf` and calling the PDP anyway — and
trusting the PDP's policy to notice and deny — would make the security guarantee
contingent on that policy being configured correctly. That is exactly the pattern
[ADR-0004](../docs/adr/0004-fail-closed-configuration.md) exists to prevent: a
guarantee that is one missing policy rule away from silently not holding. OAAF's
precondition is therefore a structural gate the PEP enforces itself, matching how
`trustAnchors` and proof of possession are already non-optional in `verifyAuthority`.

### Transport carriage

Neither AAT, MCP, nor COAZ-MCP define how an AAT chain reaches an MCP request. MCP's
authorization specification carries the OAuth access token as
`Authorization: Bearer <access-token>`, per OAuth 2.1 §5.1.1, on HTTP-based transports.
This binding defines a sibling convention for the same transports:

| Header                     | Carries                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| `OAAF-Authority-Chain`     | The AAT delegation chain, as a JSON array of compact JWS strings, root first |
| `OAAF-Proof-Of-Possession` | The compact PoP JWT for this invocation                                      |

Kept deliberately separate from `Authorization`: an AAT chain is not an OAuth token and
must not be conflated with one, and COAZ's `token` input variable continues to mean
exactly what COAZ-MCP defines.

**Out of scope for this revision:** the stdio MCP transport has no header concept and is
not addressed here. Which tools require OAAF authority is deployment configuration,
supplied to the PEP the same way `trustAnchors` already is — it is not a new protocol
declaration (such as an `x-oaaf-authority` field in `tools/list`), which would be new
protocol surface this RFC does not propose.

## Security considerations

- **Fails closed**, per [ADR-0004](../docs/adr/0004-fail-closed-configuration.md): a
  missing or failing OAAF precondition denies before the PDP is consulted, unconditionally.
- **No bypass through `context`.** `context.oaaf` is additive information for policy to
  consult; it is never the mechanism that grants access. Access is granted only when
  both the OAAF precondition and the PDP's decision permit.
- **Subject/action/resource are untouched.** This binding does not weaken or reinterpret
  what COAZ already verifies about the calling principal or the requested tool.
- **Header carriage is HTTP-transport-only** and MUST be protected by the same
  transport security COAZ-MCP already requires (TLS) for the `Authorization` header.
- **A gateway-as-PEP and a server-as-PEP deployment carry the same trust assumption
  COAZ-MCP already makes**: whichever party acts as PEP must honestly enforce the
  precondition. This binding does not add a new trust assumption beyond COAZ's own.

## Compatibility

Purely additive to a COAZ-MCP-conformant deployment. A PEP without the OAAF extension
behaves exactly as COAZ-MCP specifies. An OAAF-aware PEP adds one mandatory step and one
optional `context` member; it does not alter the `evaluation`/`evaluations` request
shape COAZ-MCP defines, and does not require the PDP to understand OAAF at all —
`context.oaaf`, if present, is ordinary supplementary context a PDP is free to ignore.

## Alternatives considered

**Carry the AAT chain as an AuthZEN obligation.** Rejected after reading the obligations
profile's raw normative text: obligations are strictly response-side (PDP→PEP),
conditioning or accompanying a decision already made. Nothing in the design overview,
the Obligation object, or the four normative obligation types models inbound evidence
supplied before a decision.

**Embed the AAT chain inside the OAuth access token's claims.** Would let COAZ's `token`
input variable see it "for free" via an expression like `$token.oaaf_chain`, without new
transport plumbing. Rejected for now: it requires the token issuer (not the MCP client)
to embed AAT material, coupling two independently-issued credential systems inside one
token, and COAZ's own anchoring check (step 5) already governs everything inside
`token` — mixing an unrelated credential into it invites exactly the kind of scope
creep RFC-0001 already declined for the resource mapping. Worth reconsidering once real
deployments show a need.

**Reuse RFC-0001's mapping (agent-as-subject) for MCP too.** Rejected: it would violate
COAZ's own subject-anchoring requirement and produce AuthZEN requests a
COAZ-MCP-conformant PDP or auditor would not recognize as conformant.

## Unresolved questions

- A standardized declaration mechanism for "this tool requires OAAF authority," should
  deployment-supplied configuration prove insufficient at scale.
- stdio transport carriage.
- Whether `context.oaaf` should carry a hash or reference to the verified chain, for
  audit correlation, once RFC-0001's evidence work matures.

## Prior art

RFC-0001 (this project). COAZ-MCP's own precedent of adding implementation-specific
`context` keys (`context.agent`, `context.case`) to a request without protocol
amendment.

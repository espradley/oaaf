---
rfc: 0003
title: A2A Binding
status: Accepted
classification: EXTEND
authors: OAAF maintainers
created: 2026-08-18
supersedes: none
---

# RFC-0003: A2A Binding

## Summary

RFC-0001 profiles OAAF's AAT-verified authority into a transport-neutral decision.
RFC-0002 binds that to MCP through COAZ. This RFC binds it to the Agent2Agent (A2A)
protocol, so that one agent can delegate narrowed authority to another over A2A and the
receiving agent can verify it before doing consequential work.

A2A already provides the mechanism. §7.6.4 of the A2A specification states that the
protocol "does not define the scope, representation, validity, or revocation semantics of
the authorization decision or credential" and that these "MUST be defined by the agent's
implementation, by the credential issuer, or by an A2A extension" — with the check
performed "before the operation is performed." OAAF supplies exactly that, as an A2A
extension, carrying authority in the already-adopted AAT format. Nothing new goes on the
wire that is not either A2A's own extension/metadata machinery or an AAT object.

Classification is **EXTEND**: the one thing OAAF adds is the _meaning_ of "this A2A
request carries delegated OAAF authority, verify it before consequential work" — the
definition A2A itself asks an extension to provide. Everything else is ADOPT or PROFILE.

## Motivation

A2A authenticates callers (§7, `securitySchemes`: API key, HTTP auth, OAuth2, OIDC, mTLS)
and deliberately leaves _authorization_ implementation-specific (§7.5). That leaves the
delegated-authority problem OAAF exists to solve unaddressed by A2A itself: an
authenticated Agent A may still be attempting something narrower than its authority
permits, or delegating to Agent B without a verifiable statement that B's authority is no
broader than A's.

An A2A agent maintainer adopting OAAF should not have to choose between A2A's interaction
model and AAT's delegation model. This RFC lets them compose.

## Charter fit

Answers _"is this actor authorized to perform this action under this authority?"_ — the
authority half is OAAF's verified AAT chain; A2A carries it and identifies the operation.
Introduces no scheduling, coordination, worker selection, or workforce concept; see the
reserved-IP section. Classification: EXTEND, minimally, at the point A2A leaves open.

## Pinned revisions

| Standard           | Revision                                                                     |
| ------------------ | ---------------------------------------------------------------------------- |
| A2A                | **1.0.1** (released 2026-05-28), the current stable release                  |
| OAAF A2A extension | `/v1` (this document)                                                        |
| AAT                | `draft-niyikiza-oauth-attenuating-agent-tokens-01` (unchanged from RFC-0001) |

A2A 1.0.0 → 1.0.1 was diffed against every O3B-relevant surface. §7 (authentication and
authorization) and §3.2.5 (metadata) are byte-identical between the two releases; §4.6
(extensions) changed only an example's `Content-Type` to `application/a2a+json`, a
media-type refinement with no effect on extension declaration, activation, or metadata
carriage; and `ExtensionSupportRequiredError` — the rejection this binding relies on — is
present and unchanged in both. O3B therefore targets current stable (1.0.1) with no loss.

## The extension

### Identity

- **URI:** `https://oaaf.dev/a2a/authority/v1` (interim, OAAF-namespaced). If this binding
  is pursued through A2A's official extension governance, it would move to the canonical
  `https://a2a-protocol.org/extensions/...` namespace; the URI identifies _this
  specification_, not any implementation endpoint, and HTTP access to it is not expected.
- Versioning: a breaking change to the extension mints a new `/vN` URI. AAT revision
  support is stated separately, as in RFC-0001.

### Declaration

An OAAF-aware **Agent B** declares support in its Agent Card, within
`capabilities.extensions`, as an `AgentExtension`:

```json
{
  "uri": "https://oaaf.dev/a2a/authority/v1",
  "description": "Requires delegated OAAF authority (AAT) for consequential skills.",
  "required": true
}
```

For any skill that performs a consequential action gated on delegated authority, the
extension **MUST** be declared `required: true`. This is the fail-closed hinge (see
Security).

### Activation

Per A2A §4.6, Agent A activates the extension by listing its URI in the `A2A-Extensions`
service parameter (an HTTP header on HTTP bindings). Agent B echoes activated extensions
in its response.

If a request targets a gated skill and the extension was not activated, Agent B **MUST**
reject the request with `ExtensionSupportRequiredError` (A2A's own error for a required
extension the client did not declare) and **MUST NOT** perform the operation. Absence of
activation is never a soft-open.

### Authority carriage

Authority material travels in the `metadata` map of the A2A `Message`, under keys
namespaced by the extension URI, exactly as A2A requires extensions to carry custom data
(§4.6 forbids adding fields to core structures):

| Metadata key                              | Value                                                                | Source    |
| ----------------------------------------- | -------------------------------------------------------------------- | --------- |
| `https://oaaf.dev/a2a/authority/v1/chain` | AAT delegation chain — JSON array of compact JWS strings, root first | AAT `-01` |
| `https://oaaf.dev/a2a/authority/v1/pop`   | Proof-of-possession JWT, compact JWS                                 | AAT `-01` |

No other OAAF material is carried. Trust anchors are **not** carried — they are Agent B's
configuration (ADR-0004). No new OAAF authority object is defined; both values are AAT
objects.

### Operation mapping

Agent B maps the incoming A2A invocation to the AAT verification request:

| AAT verification input | A2A source                                                |
| ---------------------- | --------------------------------------------------------- |
| `tool`                 | The invoked skill's `id` (A2A `AgentSkill.id`)            |
| `args`                 | The operation's caller-supplied parameters for that skill |

This mapping is a transport profile, kept out of the generic O2 authority core. A skill
`id` is a stable string identifier, which is what AAT's `tools` map keys against; the
`args` are the same closed-world argument set AAT constrains. Where a skill's parameters
are not a flat map, the binding uses the skill's declared input schema to produce the
argument map deterministically; a skill whose parameters cannot be so mapped is out of
scope for gating under this revision and MUST NOT be declared OAAF-gated.

## Recipient binding

To defeat cross-recipient replay — Agent B's presented authority captured and replayed at
Agent C — the proof of possession **MUST** be bound to the intended recipient:

- The PoP's optional `aat_aud` claim, when present, **MUST** equal Agent B's stable A2A
  identity (the identity Agent B verifies for itself; e.g. its Agent Card `url` origin, or
  a deployment-configured recipient identifier).
- Agent B **MUST** reject a request whose PoP carries an `aat_aud` that does not match its
  own recipient identity, with denial reason `pop_recipient_mismatch`.
- Reaching a particular endpoint is **not** sufficient recipient binding on its own; the
  cryptographic `aat_aud` check is what binds the authority to B.

Whether `aat_aud` is _required_ (versus optional) is a deployment policy: a deployment
that expects recipient-bound proofs configures Agent B to require it, and a PoP lacking
`aat_aud` is then denied. The binding fails closed on mismatch in all cases; it fails
closed on _absence_ when the deployment requires audience binding.

## Caller identity vs authority holder

A2A authentication (§7) establishes _who sent the request at the transport layer_. AAT
establishes _who holds the delegated authority_ (the leaf `cnf.jwk`) and _who proved
possession_ (the PoP signer). These are distinct concerns and this binding keeps them
distinct:

- The **PoP holder and the AAT leaf holder MUST correspond** — this is already enforced by
  the O2 core (the PoP must verify under the leaf `cnf.jwk`). This is non-negotiable and
  transport-independent.
- The **A2A-authenticated caller identity and the AAT holder MAY differ**, and the binding
  does not require them to match. The reason: A2A auth identifies the _connecting party_
  (which may be a gateway, a relay, or the agent itself), while AAT identifies the _holder
  of delegated authority_. Requiring them to be the same entity would break legitimate
  gateway and relay topologies A2A explicitly supports.
- A deployment that _does_ want them to correspond (for example, to prevent a relay from
  presenting authority it does not hold) MAY configure Agent B to require that the
  A2A-authenticated caller identity equals the AAT leaf holder's identity, denying with
  `caller_holder_mismatch` on failure. This is opt-in policy, not a default, and OAAF
  defines no workforce or org identity semantics to support it beyond the identity
  comparison itself.

The binding never weakens the mandatory PoP↔leaf correspondence. What it leaves to
deployment policy is only the _optional_ additional tie between transport identity and
authority holder.

## Verification order (the precondition)

For a request targeting an OAAF-gated skill, Agent B **MUST**, before any consequential
processing:

1. Confirm the extension was activated (else `ExtensionSupportRequiredError`).
2. Extract the chain and PoP from `Message.metadata` (else deny — missing authority).
3. Run the O2 core: `verifyAuthority` (chain verification against configured trust
   anchors, holder binding, proof of possession) then `evaluate` (requested skill and
   arguments within the delegated authority).
4. Enforce recipient binding and any configured caller/holder correspondence.
5. Only if all pass, proceed to normal A2A task processing.

On any failure, Agent B refuses before the operation and performs no consequential work.
The denial is expressed with A2A's own error/task-rejection semantics — this binding does
not define a parallel OAAF task lifecycle and does not take ownership of A2A's task state
machine.

## Security considerations

- **Fails closed** (ADR-0004). Missing activation, missing authority, malformed material,
  failed verification, out-of-scope operation, or recipient mismatch all deny before the
  operation.
- **The gated-skill hinge.** A skill that performs a consequential action gated on
  authority MUST declare the extension `required: true`. A deployment that gates a skill
  in policy but forgets to mark it required has a configuration error, not a soft-open;
  Agent B MUST still refuse a consequential request lacking verified authority. This is
  the A2A analogue of RFC-0002's "deny before the PDP."
- **Holder binding and forwarding.** Only the leaf holder can mint a usable PoP (§7.6.3 of
  A2A recommends exactly this). A chain forwarded through intermediaries is inert without
  the holder's private key.
- **Replay.** Per-invocation PoP (`jti`, freshness window, `hta` argument binding) bounds
  reuse. Cross-recipient replay is bound by `aat_aud`. **What OAAF does not provide:**
  stateful `jti` replay tracking across requests is a deployment responsibility (AAT
  states this, and OAAF does not add it); the freshness window narrows but does not
  eliminate a replay inside the window. This is documented, not claimed as fully solved.
- **Chain truncation / reordering.** AAT's depth, `par_hash`, and monotonic-narrowing
  checks reject a truncated or reordered chain.
- **Downgrade.** Stripping the extension to skip the check is refused by the
  `required: true` declaration plus the gated-skill hinge.
- **Confused deputy.** Authority is scoped to capabilities/resources; Agent B cannot use
  the delegated authority beyond its grant.

| Concern                                                                 | Handled by                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------- |
| Delegation, narrowing, holder binding, PoP, chain integrity             | AAT                                             |
| Transport, caller authentication, task lifecycle, extension negotiation | A2A                                             |
| Verify-before-consequential-work, recipient binding, gated-skill hinge  | OAAF profile (this RFC)                         |
| Cross-request `jti` replay tracking; issuance; revocation               | Out of scope — documented, not silently patched |

## Compatibility

Additive to an A2A deployment. An agent without the extension behaves as plain A2A. An
OAAF-aware Agent B adds one required extension and one precondition step; it does not
change A2A message shapes, does not add core-structure fields (all data is in `metadata`),
and does not require the _caller_ to run `@oaaf/sdk` — only to place two AAT values in
metadata and activate the extension, which any A2A implementation can do.

## Alternatives considered

**Reuse an existing A2A security scheme (OAuth2 scopes, etc.).** Rejected: those
authenticate the caller; none represent attenuated, delegated, holder-bound capability.
Adopting flat OAuth scopes would abandon AAT delegation.

**Carry authority in HTTP headers below A2A.** Rejected as the primary design: header-only
carriage is invisible to A2A's Agent Card declaration and activation negotiation, so a
participant could not discover or require it. Metadata is the standards-native home. (A
header MAY additionally carry the material as a binding detail, but the semantics are the
extension.)

**Define a new OAAF authority object for A2A.** Rejected: AAT already is the authority
object, adopted in O2. A second one would fork the model across transports — the thing
RFC-0002 and this RFC both exist to avoid.

## Unresolved questions

- Submission of this extension through A2A's official governance, and the resulting
  canonical URI.
- Whether the operation mapping should consult a skill's declared input schema in more
  structured cases; deferred until a real skill shape demands it.
- gRPC and other non-HTTP A2A bindings' service-parameter transmission for `A2A-Extensions`
  (A2A defines it per binding); this revision targets HTTP+JSON.

## Prior art

RFC-0001 and RFC-0002 (this project). A2A's Secure Passport sample extension, which
establishes the pattern of signed data in `Message.metadata` declared through the Agent
Card — the same carriage mechanism, applied to context rather than delegated authority.

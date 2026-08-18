# O3B Scope — A2A Binding

- **Status:** Proposed. Scope pass only — no implementation.
- **Date:** 2026-08-18

**North star.** An independently implemented A2A participant can receive an A2A request
carrying OAAF-compatible delegated authority and enforce that authority before accepting
consequential work.

**Headline conclusion.** An OAAF A2A binding is warranted, and it is an **EXTEND** — but
a small one. A2A's specification explicitly declines to define the _scope,
representation, validity, or revocation_ of an authorization decision and names "an A2A
extension" as the sanctioned mechanism to supply them (§7.6.4). OAAF fills exactly that
hole, reusing A2A's own extension, metadata, and activation machinery unchanged, and
carrying the authority in the already-adopted AAT format. No new wire authority format,
no new transport, and — critically — no new verification core: O3A's `verifyAuthority`,
`VerifiedAuthority`, PoP, reason codes, and explanation are reused verbatim.

## 1. A2A specification targeted

| Item          | Value                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specification | Agent2Agent (A2A) Protocol                                                                                                                                            |
| Version       | **1.0.0** — latest released, stable (not a draft)                                                                                                                     |
| Source read   | `docs/specification.md`, `docs/topics/extensions.md`, `docs/definitions.md`, Secure Passport sample spec — all raw from `github.com/a2aproject/A2A` and `a2a-samples` |
| Governance    | Contributed to the Linux Foundation; formal extension governance with a canonical `https://a2a-protocol.org/extensions/` URI namespace                                |

A2A being at a released 1.0.0 is a materially better footing than AAT `-01` or COAZ
Draft 1. The extension mechanism, `metadata` carriage, and `A2A-Extensions` activation
are all in the stable core. O3B pins A2A 1.0.0; the OAAF extension it defines carries its
own `/v1` version in its URI, per A2A governance.

## 2. Relevant normative requirements

**Extension mechanism (§4.6, extensions.md).**

- Extensions are identified by a **URI** and declared in the Agent Card under
  `capabilities.extensions` as `AgentExtension` objects (`uri`, `description`,
  `required`, `params`).
- Extensions **MUST NOT** change core data structures or add enum values; custom data
  **MUST** live in the `metadata` map on core objects (`Message`, `Artifact`, …), keyed
  by the extension URI.
- **Activation** is negotiated: the client sends the `A2A-Extensions` service parameter
  (an HTTP header on HTTP bindings) listing URIs it activates; the agent echoes the
  activated set in its response.
- An extension **MAY** be `required: true`. If a client does not activate a required
  extension or fails to follow it, the agent **should reject the request with an error**.

**Authorization (§7).**

- A2A handles _authentication_ at the protocol layer via `securitySchemes` (API key,
  HTTP auth, OAuth2, OIDC, mTLS) — these establish _who the caller is_, not _what they
  may do_ (§7.3–7.5).
- _Authorization_ is explicitly **implementation-specific** (§7.5): "Authorization logic
  is implementation-specific."
- **§7.6.4 is the load-bearing clause.** "The A2A protocol does not define the scope,
  representation, validity, or revocation semantics of the authorization decision or
  credential… The meaning and scope of any resulting authorization decision or credential
  **MUST be defined by the agent's implementation, by the credential issuer, or by an A2A
  extension**." And: "If an implementation requires authorization for specific
  operations, it is responsible for defining how the authorized operation is identified
  and how that authorization is checked **before the operation is performed**."
- **§7.6.3** already recommends OAAF's exact security posture: "Credentials SHOULD be
  bound to the agent which originated the request, such that only this agent is able to
  use the credentials… propagating through a chain of A2A requests are only usable by the
  requesting agent."
- **§13.1** requires authorization checks on every operation, before any work that could
  leak resource existence.

The combination is unusually favourable: A2A leaves delegated-authority semantics
undefined, sanctions an extension to supply them, mandates that the check happen _before
the operation_, and independently recommends holder-bound credentials — which is
precisely what AAT's `cnf` + proof-of-possession already provides.

## 3. Classification: ADOPT / PROFILE / EXTEND / INVENT

| Concern                                                                                                 | Class                 | Basis                                                       |
| ------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| Transport, messaging, task lifecycle                                                                    | **ADOPT**             | A2A 1.0.0 core, untouched                                   |
| Extension identification, declaration, activation                                                       | **ADOPT**             | A2A extension mechanism + `A2A-Extensions` + Agent Card     |
| Authority carriage location                                                                             | **ADOPT**             | `Message.metadata` keyed by the OAAF extension URI          |
| Delegated authority format                                                                              | **ADOPT**             | AAT `-01` (already adopted in O2)                           |
| Holder binding / proof of possession                                                                    | **ADOPT**             | AAT PoP; aligns with A2A §7.6.3                             |
| Caller authentication                                                                                   | **ADOPT**             | A2A `securitySchemes` — unchanged, orthogonal to OAAF       |
| **Meaning of "this A2A request carries delegated OAAF authority, verify it before consequential work"** | **EXTEND**            | A2A §7.6.4 leaves this undefined and points to an extension |
| Recipient/audience binding of authority to Agent B                                                      | **PROFILE**           | AAT PoP `aat_aud` profiled onto the A2A recipient identity  |
| New authority wire format                                                                               | **INVENT — rejected** | Not needed; AAT exists                                      |
| New transport                                                                                           | **INVENT — rejected** | Not needed; A2A metadata carries it                         |

**Nothing lands in INVENT.** The single EXTEND is the definition A2A itself asks an
extension to provide.

## 4. Recommended carriage architecture

**Option A — an OAAF A2A extension — recommended.**

- URI (provisional): `https://a2a-protocol.org/extensions/oaaf-authority/v1` if pursued
  through A2A official governance, or an interim OAAF-namespaced URI until then.
- Declared by an OAAF-aware **Agent B** in its Agent Card, `required: true` for skills
  that demand delegated authority.
- **Activated** by Agent A via the `A2A-Extensions` header.
- The AAT chain and PoP travel in `Message.metadata`, under keys namespaced by the
  extension URI (e.g. `<uri>/chain`, `<uri>/pop`), exactly as A2A extensions are required
  to carry custom data and as the Secure Passport sample already does for signed context.
- Agent B, before beginning consequential processing, runs the OAAF precondition. On
  failure it rejects — using the required-extension rejection path (§Required Extensions)
  or a task-level failure — and does not perform the operation.

**Rejected alternatives.**

- **Option B — reuse an existing A2A security/auth mechanism.** Rejected: A2A's
  `securitySchemes` authenticate the caller; none represent _delegated, attenuated
  capability_. §7.5 makes authorization implementation-specific, so there is no native
  carriage to profile. Adopting OAuth2 scopes would mean re-introducing the flat-scope
  model OAAF exists to improve on, and abandoning AAT delegation.
- **Option C — transport-layer authority (HTTP headers below A2A).** Partially rejected.
  The chain/PoP _may_ additionally ride in an HTTP header as a binding detail, but the
  _semantics_ must be an A2A extension so that A2A participants can discover it in the
  Agent Card, negotiate activation, and mark it `required`. Header-only carriage is
  invisible to A2A's own negotiation and forwarding model, so it cannot be the primary
  design. A2A metadata is the standards-native home.
- **Option D — none discovered** that is smaller than Option A.

## 5. Authority-material mapping

| Material                         | Source standard              | Why needed                                                   | A2A carriage                                                  | Class   |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- | ------- |
| AAT delegation chain (root→leaf) | AAT `-01`                    | The delegated authority itself                               | `Message.metadata["<uri>/chain"]` — JSON array of compact JWS | ADOPT   |
| Proof of possession (PoP JWT)    | AAT `-01`                    | Proves the sender holds the leaf key for this invocation     | `Message.metadata["<uri>/pop"]`                               | ADOPT   |
| Trust anchors                    | AAT / RFC-0001               | Root-issuer keys the verifier trusts                         | **Not carried** — Agent B configuration, per ADR-0004         | ADOPT   |
| Recipient/audience               | AAT PoP `aat_aud` (optional) | Binds the proof to Agent B, defeating cross-recipient replay | Inside the PoP; Agent B's A2A identity is the expected value  | PROFILE |
| Requested operation + arguments  | AAT PoP `aat_tool` + `hta`   | Binds the proof to the specific A2A skill/operation invoked  | Derived from the A2A `Message`/skill and its parameters       | PROFILE |
| Caller authentication            | A2A `securitySchemes`        | Who Agent A is at the transport layer                        | A2A-native, unchanged                                         | ADOPT   |

No new wire-level field is required. The two PROFILE rows reuse existing AAT PoP fields;
the only design work is stating what A2A value fills `aat_aud` and how an A2A skill call
maps to `aat_tool`/`hta` — the same shape of mapping RFC-0002 did for MCP, and a
candidate for RFC-0003.

**Flag:** the `aat_tool`/`hta` ↔ A2A-skill mapping is the one genuine open design
question, analogous to the resource-mapping decision in RFC-0001/O3A. It should be
resolved in the O3B RFC against concrete A2A skill/message shapes, not pre-committed here.

## 6. Agent-to-agent delegation model

AAT already expresses A→B delegation with no new OAAF semantics:

- **What identifies Agent A** — the holder key (`cnf.jwk`) of the parent grant; its JWK
  Thumbprint URI is A's authority identity (and, in AAT, the derived token's `iss`).
- **What identifies Agent B** — the holder key (`cnf.jwk`) of the delegated child grant.
- **What binds authority to B** — the child token names B's key in `cnf`; only B's
  private key can produce a valid PoP for it.
- **Proof of possession** — B signs a per-invocation PoP JWT with its leaf key; O3A's
  verifier checks it.
- **How B proves it is the intended holder** — the PoP signature verifies under the leaf
  `cnf.jwk`, and the chain proves that leaf was validly delegated from a trusted root.
- **Replay prevention** — PoP is per-invocation (`jti`, freshness window, `hta` argument
  binding); a captured PoP does not authorize a different call, and a captured _chain_
  without B's private key produces no usable PoP.
- **Cross-recipient replay** — `aat_aud` binds the proof to the intended recipient.

| Concern                                                                      | Owner                                     |
| ---------------------------------------------------------------------------- | ----------------------------------------- |
| Delegation, narrowing, holder binding, PoP, replay                           | **AAT** (already solved)                  |
| Transport, message identity, task/context identifiers, caller authentication | **A2A**                                   |
| Verifying the above and refusing before consequential work                   | **OAAF profile** (O3A core, reused)       |
| Why B was chosen, whether B should take over, what happens to A after        | **Out of scope** — see §Reserved-IP audit |

## 7. Relationship to O2 / O3A — no fork

The whole point. O3B reuses the O2/O3A core and adds only an A2A adapter:

```text
                     OAAF CORE  (O2)
     verifyAuthority · VerifiedAuthority · PoP · reason codes · explain
                          │  (transport-agnostic)
              ┌───────────┴───────────┐
              ▼                       ▼
     MCP / COAZ adapter        A2A adapter
     (O3A, RFC-0002)           (O3B, RFC-0003)
     extract from MCP          extract from A2A
     tools/call + headers      Message.metadata
     deny → JSON-RPC error     deny → A2A error / task-reject
```

| Component                                        | Reused from O2/O3A | A2A-specific                                               |
| ------------------------------------------------ | ------------------ | ---------------------------------------------------------- |
| `verifyAuthority`, `VerifiedAuthority`           | ✅ verbatim        | —                                                          |
| PoP verification, JCS binding                    | ✅ verbatim        | —                                                          |
| Reason codes, `explain`                          | ✅ verbatim        | —                                                          |
| Precondition-before-consequential-work invariant | ✅ same principle  | —                                                          |
| Material extraction                              | —                  | from `Message.metadata` vs MCP headers                     |
| Denial shape                                     | —                  | A2A error / required-extension rejection vs JSON-RPC error |
| Operation identity for PoP                       | —                  | A2A skill/message vs MCP tool name                         |

The A2A adapter is a sibling of `mcp/coaz.ts`, e.g. `a2a/binding.ts`, calling the same
`verifyAuthority`/`evaluate`. If O3B ends up duplicating verification logic, the design
has gone wrong.

## 8. Precondition principle under A2A

O3A's invariant — enforcement is a precondition a downstream policy cannot accidentally
ignore — transfers cleanly, and A2A's own text supports it:

```text
A2A SendMessage (OAAF extension active)
        ↓
OAAF authority verification  (before any consequential processing)
        ↓
   valid & in scope? ── no ──► reject: required-extension error / task failure;
        │                       the operation is never performed (§7.6.4, §13.1)
       yes
        ↓
normal A2A task processing
```

§7.6.4 ("checked before the operation is performed") and §13.1 ("before any database
queries or operations that could leak information") both mandate a pre-operation check,
so the precondition is not merely compatible with A2A — it is what A2A already asks an
authorization-bearing implementation to do.

**One mismatch to respect.** A2A is asynchronous and task-oriented; there is no single
synchronous PEP call as in MCP. The precondition therefore attaches to _message
acceptance into consequential processing_, and a denial is naturally expressed as an A2A
error or a task transition to a failed/rejected state — not a synchronous allow/deny
return. O3B must not force MCP's synchronous shape onto A2A. It also must **not** touch
`TASK_STATE_AUTH_REQUIRED` semantics: that is A2A's own in-task authorization state
machine, and OAAF verifying a presented authority is a different thing from A2A
requesting one.

## 9. Interoperability requirement

For an independent A2A implementation to honour OAAF without importing `@oaaf/sdk`, O3B
must produce, or at least specify:

- **An OAAF RFC** (RFC-0003) defining the A2A binding: the extension URI, the metadata
  keys, the activation expectation, the operation-identity mapping, and the
  before-consequential-work rule. Transport-neutral, like RFC-0001/0002.
- **An A2A extension definition** in A2A's own format (URI, `params` schema, metadata
  schema, flow), suitable for eventual submission through A2A extension governance.
- **Conformance fixtures**: signed chains + PoPs + A2A message envelopes, reusable by O6,
  namespaced by revision alongside the existing AAT fixtures.
- **Transport-neutral tests** asserting that a conformant verifier reaches the same
  allow/deny as the reference.

Create these during implementation, not during scope — except any minimal fixture needed
to resolve the operation-identity mapping question in §5.

## 10. Security / threat analysis

| Threat                                                                       | Handled by                        | Mechanism                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authority substitution (swap in a different chain)                           | AAT                               | Signature + trust-anchor verification; unrelated chain fails                                                                                                                                                                        |
| Recipient/audience confusion (B's authority replayed at C)                   | AAT PoP + OAAF profile            | `aat_aud` bound to recipient; **flag:** binding `aat_aud` to a concrete A2A identity is an O3B design decision                                                                                                                      |
| Replay (same request re-sent)                                                | AAT                               | PoP `jti` + freshness window + `hta` binding                                                                                                                                                                                        |
| PoP binding (proof reused for a different call)                              | AAT                               | `aat_tool` + `hta` JCS byte-equality                                                                                                                                                                                                |
| Authority-chain truncation (drop links to widen)                             | AAT                               | Depth/`par_hash`/monotonic-narrowing checks; a truncated chain fails linkage                                                                                                                                                        |
| Authority-chain reordering                                                   | AAT                               | `par_hash` links each child to a specific parent; reordering breaks the hash chain                                                                                                                                                  |
| Unsupported-extension downgrade (strip the extension to skip the check)      | A2A + OAAF profile                | `required: true` in the Agent Card; a skill needing authority **MUST** reject a request that did not activate it (§Required Extensions). **Flag:** this is the critical fail-closed hinge — see below                               |
| Optional-vs-required behaviour                                               | A2A + OAAF profile                | OAAF-gated skills declare the extension `required`; data-only use is never `required`                                                                                                                                               |
| Forwarding through an agent chain                                            | AAT (holder binding) + A2A §7.6.3 | Only the holder can mint a usable PoP; a forwarded chain is inert without B's key                                                                                                                                                   |
| Confused deputy (B uses A's authority for B's own ends)                      | AAT scope + OAAF                  | Authority is scoped to capabilities/resources; B cannot exceed the delegated grant                                                                                                                                                  |
| A2A identity ≠ authority holder (authenticated caller is not the key holder) | OAAF profile                      | **Flag:** O3B must specify whether/how the A2A-authenticated caller identity must correspond to the AAT holder. Candidate: require the PoP holder to match, and treat A2A auth as an orthogonal transport gate. Resolve in RFC-0003 |

**Fail-closed hinge (most important).** The downgrade threat is the one place a standards
gap could silently weaken the guarantee: if an OAAF-gated skill does _not_ mark the
extension `required`, a client can simply not activate it and skip authority entirely.
Per ADR-0004, O3B **MUST** specify that any skill requiring delegated authority declares
the extension `required: true`, and that Agent B refuses a consequential request lacking
verified authority regardless of activation state. Absence of the extension on a gated
skill is a configuration error, not a soft-open. This mirrors O3A's "deny before the PDP"
and the `trustAnchors`-required decision.

Two ambiguities to resolve in RFC-0003, failing closed until resolved: (a) exact
`aat_aud` ↔ A2A-recipient binding, (b) required correspondence between A2A-authenticated
caller and AAT holder. Neither is patched with proprietary semantics.

## 11. DigitalStack reserved-IP audit (ADR-0002)

**Clean.** O3B is authority delegation A→B, not workforce handoff or recovery. Explicit
exclusions, all confirmed absent from this scope:

- logical execution continuity · worker supersession · takeover · recovery · retries ·
  execution fencing · continuation authority · scheduling · readiness · capacity · worker
  selection · DigitalStack context transfer — **none present.**

Boundary statements for O3B:

- An A2A request **may** delegate authority from A to B. OAAF verifies that delegation.
- OAAF **must not** decide _why_ B was selected (A2A/the caller does), _whether_ B should
  take over work, or _what happens to A_ afterward.
- A2A's `TASK_STATE_AUTH_REQUIRED`, task continuity, and multi-turn task chaining are
  **A2A's** state machine. OAAF reads a presented authority and refuses or permits; it
  does not drive task lifecycle.
- No freshness/version/fence input is added to the verifier (the reserved extension point
  from ADR-0002 stays closed).

## 12. Demo design (design only)

Provisional; capability names to be reconciled with the RFC-0003 operation mapping.

```text
Alice holds authority:  repo.read, repo.write, repo.merge
        │  delegates review to Bob over A2A, narrowed:
        ▼
Bob receives:           repo.read, repo.comment
        │
Bob → repo.read   over A2A  → OAAF precondition PASS → ALLOW (work proceeds)
Bob → repo.merge  over A2A  → OAAF precondition DENY → reason: tool_not_delegated
                                (request never enters consequential processing)
```

Runs as `npm run demo:a2a`, in-process, no account/service/issuer, using
`@oaaf/sdk/testing` for local authority exactly as the MCP demo does. It should make
narrowing visible without requiring the reader to understand AAT internals — the same
bar A0.2 set for the MCP demo, including a visible "consequential work not entered" line
on the deny path (the A2A analogue of O3A's "PDP never called"). If the architecture
holds up, this becomes O3C's shareable delegation demo.

## 13. Proposed package / file changes (for implementation, not now)

```text
packages/typescript/src/
  a2a/
    binding.ts        extract chain/PoP from Message.metadata; call verifyAuthority;
                      shape a denial as an A2A error / task-reject
    extension.ts      the AgentExtension descriptor + metadata key constants
examples/a2a-delegation/   runnable demo (npm run demo:a2a)
rfcs/0003-a2a-binding.md    the transport-neutral A2A binding profile
tests/ ... a2a fixtures     signed chains + PoP + A2A message envelopes
```

No change to `aat/`, `authzen/`, `decide.ts`, `reasons.ts`, or `explain.ts` is
anticipated. If one becomes necessary, that is a signal to re-examine the design.

## 14. Proposed public API (illustrative, not frozen)

```ts
// a2a/binding.ts
enforceA2aAuthority(input: {
  message: A2aMessage;                       // the incoming A2A Message
  trustAnchors: readonly Jwk[];              // required (ADR-0004)
  recipient: string;                         // Agent B identity, for aat_aud binding
  operation: { tool: string; args: ToolArguments }; // mapped from the A2A skill call
  now?: number;
}): Promise<
  | { ok: true; authority: VerifiedAuthority }
  | { ok: false; error: A2aAuthorityError }  // shaped for an A2A error / task failure
>;
```

Same shape as `enforceOaafPrecondition`, differing only in extraction and denial
representation — reinforcing the no-fork design.

## 15. Implementation slices (when authorized)

| Slice | Content                                                                                 |
| ----- | --------------------------------------------------------------------------------------- |
| 1     | RFC-0003: extension URI, metadata keys, activation, operation mapping, fail-closed rule |
| 2     | `a2a/extension.ts` + metadata extraction; reuse `verifyAuthority`                       |
| 3     | Denial shaping to A2A error / required-extension rejection                              |
| 4     | `aat_aud` recipient binding + A2A-identity-vs-holder rule (the two flagged ambiguities) |
| 5     | Test matrix incl. downgrade/truncation/reorder/recipient-confusion                      |
| 6     | `examples/a2a-delegation` + `npm run demo:a2a`                                          |
| 7     | Conformance fixtures + A2A extension definition artifact                                |

## 16. O3B exit criteria

1. An independent developer verifies delegated authority on an incoming A2A message and
   refuses an out-of-scope call **before** consequential processing, with an
   understandable reason.
2. The verification core is reused, not reimplemented — no duplication of `verifyAuthority`.
3. A gated skill marks the extension `required` and refuses unauthorized calls regardless
   of activation state (fail-closed hinge).
4. `npm run demo:a2a` runs from a clean clone with no account/service/issuer.
5. RFC-0003 is transport-neutral enough that a non-`@oaaf/sdk` A2A implementation could
   conform.
6. No new wire authority format; the two PROFILE mappings and two flagged ambiguities are
   recorded and resolved in RFC-0003, failing closed until then.
7. Reserved-IP audit re-run at close and clean.
8. `npm run check` green; boundary intact; docs state A2A 1.0.0 and the OAAF extension
   `/v1` as pinned.

## Recommendation

Proceed to O3B implementation. The research supports it: A2A explicitly invites an
extension to define delegated-authority semantics, the carriage and delegation are fully
covered by mechanisms already adopted, and the verification core is reused wholesale. The
work is genuinely small — an adapter, an RFC, an extension definition, and a demo — and
the one real design question (operation-identity mapping) plus two security ambiguities
(recipient binding, caller-vs-holder correspondence) are well-scoped and must fail closed
until RFC-0003 settles them.

This is not a case where the standard already does OAAF's job. A2A authenticates callers
and deliberately leaves delegated authorization to an extension; OAAF supplies the
attenuated, holder-bound, verifiable authority that fills that gap.

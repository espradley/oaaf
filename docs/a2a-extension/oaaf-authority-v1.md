# OAAF Authority — A2A Extension Definition (v1)

A publishable A2A extension definition, in A2A's own terms. An A2A implementation in any
language can honour this without importing `@oaaf/sdk`; it needs only to verify AAT
tokens and follow the order below. The normative rationale is in
[RFC-0003](../../rfcs/0003-a2a-binding.md).

- **Extension URI:** `https://oaaf.dev/a2a/authority/v1` (interim; identifies this
  specification, not an endpoint — HTTP access is not expected)
- **Targeted A2A version:** 1.0.1
- **Type:** Profile Extension (adds a required precondition; adds no new RPC method)
- **Authority format:** Attenuating Authorization Tokens,
  `draft-niyikiza-oauth-attenuating-agent-tokens-01`

## Agent Card declaration

An agent that gates consequential skills on delegated authority declares, in
`capabilities.extensions`:

```json
{
  "uri": "https://oaaf.dev/a2a/authority/v1",
  "description": "Requires delegated OAAF authority (AAT) for consequential skills.",
  "required": true
}
```

Any skill performing a consequential action gated on delegated authority MUST be covered
by a `required: true` declaration of this extension.

## Activation

The calling agent activates the extension by including the URI in the `A2A-Extensions`
service parameter (an HTTP header on HTTP+JSON bindings). The receiving agent echoes
activated extensions in its response, per A2A §4.6.

If a request targets a gated skill without activating the extension, the receiving agent
MUST reject with `ExtensionSupportRequiredError` and MUST NOT perform the operation.

## Authority carriage

Two values travel in the A2A `Message.metadata` map (A2A forbids adding fields to core
structures; extension data lives in `metadata`):

| Metadata key                              | Value                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `https://oaaf.dev/a2a/authority/v1/chain` | AAT delegation chain: a JSON array of compact-JWS strings, root first |
| `https://oaaf.dev/a2a/authority/v1/pop`   | Proof-of-possession JWT (compact JWS) for this invocation             |

Trust anchors (the root issuer keys the receiver trusts) are NOT carried; they are the
receiving agent's configuration.

## Verification order (before consequential work)

1. If the skill is gated and the extension was not activated →
   `ExtensionSupportRequiredError`, stop.
2. Read the chain and PoP from metadata; if absent or malformed → deny, stop.
3. Verify the AAT chain against configured trust anchors: signatures, temporal validity,
   delegation depth, parent binding (`par_hash`), monotonic capability/constraint
   narrowing. (See RFC-0001 / AAT §7.)
4. Verify proof of possession: the PoP is signed by the leaf `cnf.jwk`, names the leaf
   token (`aat_id`), names the invoked skill (`aat_tool`), and its `hta` is JCS-canonical
   equal to the argument map.
5. Recipient binding: if the PoP carries `aat_aud`, it MUST equal the receiving agent's
   own identity; mismatch → deny. A deployment MAY require `aat_aud` to be present.
6. Evaluate the requested skill and arguments against the verified authority; out of scope
   → deny.
7. Only if all pass, proceed to normal A2A processing.

Any failure denies before the operation, expressed with A2A's error / task-rejection
semantics. This extension does not define a task lifecycle.

## Operation mapping

- AAT `tool` ← the invoked skill's `id` (A2A `AgentSkill.id`).
- AAT `args` ← the skill's caller-supplied parameters.

A skill whose parameters cannot be mapped to a flat argument map MUST NOT be declared
OAAF-gated under this version.

## Identity

- **Delegating agent (Alice):** the holder key of the parent grant; its JWK Thumbprint
  URI is its authority identity.
- **Receiving agent (Bob):** the holder key of the delegated child grant. Only Bob's
  private key can mint a valid PoP.
- **A2A-authenticated caller vs authority holder:** these MAY differ (A2A auth identifies
  the connecting party; AAT identifies the authority holder). A deployment MAY require
  them to correspond. The PoP-holder ↔ AAT-leaf-holder correspondence is always required
  and is enforced by step 4.

## Security considerations

- Fail closed: missing activation, missing/malformed authority, failed verification,
  out-of-scope operation, or recipient mismatch all deny before the operation.
- Holder binding defeats forwarding: a chain relayed through intermediaries is inert
  without the holder's key (aligns with A2A §7.6.3).
- Replay: bounded per-invocation by PoP `jti`, freshness, and `hta` binding, and across
  recipients by `aat_aud`. Stateful cross-request `jti` tracking is a deployment
  responsibility this extension does not provide.
- Chain truncation and reordering are rejected by AAT's linkage and depth checks.

## Non-goals

This extension is not an authorization protocol, not a token format (it carries AAT), and
not a transport (it uses A2A). It does not decide which agent should act, does not transfer
or recover work, and defines no scheduling, continuity, or workforce semantics.

---
rfc: 0001
title: AAT to AuthZEN Enforcement Profile
status: Accepted
classification: PROFILE
authors: OAAF maintainers
created: 2026-08-18
supersedes: none
---

# RFC-0001: AAT to AuthZEN Enforcement Profile

## Summary

OAAF verifies a delegation chain expressed as Attenuating Authorization Tokens and
returns an authorization decision expressed in the AuthZEN Authorization API. The two
standards do not share an information model, so a mapping is required. This RFC freezes
that mapping for O2.

**This is an OAAF profile. It is not a requirement of AAT or of AuthZEN, and neither
specification is modified or extended by it.** Nothing defined here appears on the wire.

## Motivation

AAT describes authority as **tools and their argument constraints**. AuthZEN describes
an authorization question as **subject, action, resource, and context**, and requires
`subject.id`, `action.name`, `resource.type`, and `resource.id`.

AAT supplies a clean value for exactly one of those:

| AuthZEN requires                | AAT provides                                           |
| ------------------------------- | ------------------------------------------------------ |
| `action.name`                   | tool name                                              |
| `subject.id`                    | nothing — AAT intentionally omits `sub`                |
| `resource.type` / `resource.id` | nothing — resources exist only as argument constraints |

Without an agreed mapping, two OAAF implementations reading the same token could produce
different AuthZEN requests. That would defeat the purpose of using a standard decision
contract at all.

## Charter fit

This answers _"is this actor authorized to perform this action under this authority?"_ —
the first branch of the [litmus test](../CHARTER.md#the-litmus-test). It introduces no
scheduling, coordination, or workforce concept.

Classification is **PROFILE**: both underlying primitives are adopted unchanged; OAAF
constrains how they compose.

## Design

### Pinned revisions

| Standard           | Revision                                                          | Notes                                               |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------------------- |
| AAT                | `draft-niyikiza-oauth-attenuating-agent-tokens-01` (15 June 2026) | Individual Internet-Draft, expires 17 December 2026 |
| AuthZEN            | Authorization API 1.0 (March 2026)                                | Published, Standards Track                          |
| JCS                | RFC 8785                                                          | Used by AAT for proof-of-possession binding         |
| JWK Thumbprint URI | RFC 9278 / RFC 7638                                               | Used by AAT as derived-token `iss`                  |

OAAF's support is tied to these revisions until deliberately upgraded.

### Mapping

```text
AAT                              AuthZEN
────────────────────────────────────────────────────────
leaf tool name              ->   action.name
leaf holder identity        ->   subject.id
  (JWK thumbprint URI of
   verified leaf cnf.jwk)
"tool"                      ->   resource.type
leaf tool name              ->   resource.id
tool arguments              ->   action.properties.arguments
chain metadata              ->   context
verification outcome        ->   decision (boolean)
reason code + message       ->   context (on the response)
```

Normatively, for OAAF implementations:

1. `subject.type` MUST be the string `"agent"`.
2. `subject.id` MUST be the JWK Thumbprint URI of the **verified leaf** `cnf.jwk`,
   in the form `urn:ietf:params:oauth:jwk-thumbprint:sha-256:…`. This value is
   AAT-native: the draft already uses exactly this form as the `iss` of a derived
   token. OAAF does not invent an identifier.
3. `action.name` MUST be the requested tool name.
4. `resource.type` MUST be the string `"tool"`, and `resource.id` MUST be the requested
   tool name.
5. Arguments MUST be carried in `action.properties.arguments`, not in `resource`.
6. The request MUST be derived only from **verified** material. An implementation MUST
   NOT construct an AuthZEN request from an unverified or partially verified chain.
7. `decision` MUST be `false` whenever verification fails for any reason.

### Why resource duplicates action

Setting `resource.id` to the tool name is deliberately boring, and it is degenerate:
resource carries no information beyond action.

The alternative — inferring a semantic resource from a designated argument, so that
`read_file(path="/data/q3.pdf")` maps to `{ type: "file", id: "/data/q3.pdf" }` — is
more useful and more AuthZEN-idiomatic. It is rejected for O2 because AAT carries no
tool metadata saying which argument names a resource. That knowledge would have to come
from local configuration, which means two deployments could map the same token to
different AuthZEN requests. Determinism is worth more than expressiveness here.

**The tool-as-resource mapping is the minimum interoperable profile, not OAAF's final
answer for semantic resources.** A follow-up RFC should revisit it against MCP tool
metadata and argument schemas, where the information needed to do it properly actually
exists.

### Proof of possession

Full enforcement requires the complete AAT verification algorithm, including the
proof-of-possession step that binds a presentation to the leaf holder's key and to the
exact argument map.

1. The enforcement entry point MUST verify PoP.
2. There MUST NOT be an option that disables PoP verification while still presenting the
   result as an authorization decision.
3. A chain-only operation MAY exist for inspection, testing, and conformance work. It
   MUST be named so that its limitation is evident, MUST NOT produce an AuthZEN
   decision, and MUST be documented as not constituting enforcement.

The reasoning is narrow: a verifier that can be configured to skip PoP will eventually
be configured that way in production, and would then advertise AAT conformance it does
not have.

### Decision reasons

AAT specifies a uniform DENY and defines no error codes. AuthZEN reserves the response
`context` for supplementary information including reasons. OAAF therefore defines reason
codes and carries them in `context`.

Each reason code MUST correspond to exactly one normative check in AAT verification or
in this profile, so that the vocabulary stays traceable to a source requirement rather
than accumulating.

Reason codes are stable identifiers. Adding one is a minor change; renaming or removing
one is breaking.

## Conformance notes

AAT -01 specifies its verification algorithm in full, including several checks that are
easy to miss on a first reading and that an implementation must not skip:

- **The root is verified against a configured trust anchor**, not against its own
  `cnf.jwk`. A root token is a claim, not a trust root; verifying it against itself
  would accept any self-signed root and the chain would prove nothing about who granted
  the authority.
- **`del_max_depth` is monotonic** (invariant I2, step 4g). A delegate cannot raise the
  ceiling its issuer set, so a root's depth bound continues to bind for the whole chain.
- **Closed-world key sets must match exactly** (step 4p2). When a parent constrains a
  tool, a derived token must name the same argument keys — adding one produces
  invocations the parent would reject as unknown, and dropping one produces invocations
  omitting a parent-required argument. Neither is a subset of the parent's invocation
  set.
- **A constrained argument is required, not merely permitted** (step 6b). An omitted
  argument would otherwise slip past every constraint on it.
- **`cnf.jwk` must not carry private key material.** A confirmation claim conveys a
  public key, and an AAT is designed to be passed around.
- **`all` subsumption requires a distinct derived clause per parent clause**, with
  backtracking; a single derived clause must not satisfy two parent clauses.
- **A wildcard parent may be narrowed to any constraint type**, while a derived
  `wildcard` is valid only under a `wildcard` parent.

OAAF implements each of these. They are recorded here because an implementation that
omits any one of them will appear to work against well-formed inputs while failing to
enforce the invariant the draft relies on.

## Security considerations

- **Trust anchors are required.** Verification MUST require an explicit trust-anchor
  set; absence is a configuration error, not a warning condition. A root token is a
  claim, not a trust root, and verifying it against its own `cnf.jwk` would establish
  only internal self-consistency. There MUST NOT be a mode that returns an authorization
  decision without one. See [ADR-0004](../docs/adr/0004-fail-closed-configuration.md).
- **Fails closed.** Any verification failure, unrecognized constraint type, or
  unpermitted subsumption pair produces a deny.
- **No unverified material reaches the decision.** Subject identity is taken from the
  verified leaf key, never from a self-asserted claim.
- **Algorithm confusion.** `alg: "none"` is rejected; `EdDSA` is verified only against
  an OKP key with an Ed25519 or Ed448 curve.
- **Replay.** AAT states that stateful `jti` tracking is a deployment responsibility.
  This profile does not add replay protection, and OAAF documents that gap rather than
  implying coverage.
- **Revocation.** AAT does not mitigate revocation. Neither does this profile. Authority
  is bounded by `exp` alone.
- **Reason disclosure.** Reason codes describe why the presented authority was
  insufficient. They MUST NOT include key material, raw token bytes, or argument values
  from constraints the caller did not already supply.

## Compatibility

First profile; nothing to break. AAT support is pinned to `-01`. A future revision is a
new profile version, not a silent behaviour change — fixtures are namespaced by revision
so that both can exist side by side.

## Alternatives considered

**Infer a semantic resource from arguments (R2).** More useful, rejected for O2 as
non-deterministic without tool metadata. Deferred to an MCP-informed RFC.

**Define an OAAF decision format instead of AuthZEN.** Rejected — it would be the
competing wire format that
[ADR-0003](../docs/adr/0003-implement-existing-authority-standards.md) exists to avoid.

**Omit `resource` and send only subject and action.** Rejected: AuthZEN requires
`resource`, and a profile that emits invalid requests is not a profile.

## Unresolved questions

- Semantic resource binding (R2), pending MCP metadata.
- Whether `context` should carry the full verified chain summary or only its shape. O2
  carries a summary; a richer form may be wanted once evidence receipts land.

## Prior art

OAuth 2.0 Rich Authorization Requests (RFC 9396) for structured authority; macaroons and
Biscuit for attenuation; SPIFFE/WIMSE for workload identity; XACML's PEP/PDP separation,
which AuthZEN modernises.

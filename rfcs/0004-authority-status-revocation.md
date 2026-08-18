---
rfc: 0004
title: Authority Status and Revocation Profile
status: Accepted (experimental — depends on moving drafts)
classification: PROFILE
authors: OAAF maintainers
created: 2026-08-18
supersedes: none
---

# RFC-0004: Authority Status and Revocation Profile

## Summary

Lets an OAAF verifier reject otherwise-valid authority that has been revoked before its
natural expiry, **without OAAF operating any revocation service**. The verifier consumes a
current-status _truth_ produced elsewhere; OAAF defines only the verifier-side contract for
consuming it and failing closed.

The mechanism is a small, transport-neutral abstraction — a **status resolver** — that
answers one question about a token identity: _active, revoked, or unknown?_ Every token in
a presented chain is checked, so revoking an ancestor invalidates its descendants for free.

## Motivation

OAAF's offline verification is a strength, and AAT trades per-token revocation for exactly
that (AAT §8.9). But an authority framework that can never invalidate authority before
expiry is not production-credible. The gap is real; the risk is that closing it turns OAAF
into a control plane. This profile closes it while staying a verifier.

AAT §8.9 anticipates precisely this: _"A companion document may define lineage-scoped
cascading revocation. In such a model, revocation is enforced by the enforcement point that
accepts the affected chain, not by requiring the root AS to track derived tokens… Revoking
a token invalidates that token and its descendants in the same lineage… Revocation
transport, storage, distribution, consistency, token-status, and introspection mechanisms
are deployment and control-plane concerns outside the scope."_ This RFC is that companion
document for OAAF, and it holds that boundary.

## Charter fit

Answers _"is this actor authorized to perform this action under this authority?"_ — an
authority that has been revoked is not. Introduces no scheduling, worker selection, or
lifecycle machinery; cascading is achieved by checking chain members, not by a propagation
algorithm. Classification: **PROFILE** of AAT's revocation extension point plus existing
external status standards.

## Standards basis and status

| Standard                  | Version / status                                                                     | Role here                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| AAT                       | `draft-niyikiza-oauth-attenuating-agent-tokens-01`, §8.9                             | Delegates cascading revocation to a companion profile, enforced verifier-side, keyed on `jti`                                        |
| Token identifier          | AAT `jti` (REQUIRED, RECOMMENDED UUIDv7)                                             | The stable per-token identity a status source keys on                                                                                |
| Token Status List         | `draft-ietf-oauth-status-list-21` (June 2026, IETF OAuth WG, Standards-Track intent) | A candidate **external** status mechanism a resolver may wrap. A moving draft — deliberately **not** baked into OAAF's wire contract |
| OAuth Token Introspection | RFC 7662 (stable)                                                                    | A candidate **external** status source a resolver may query — the AS, not OAAF                                                       |
| OAuth Token Revocation    | RFC 7009 (stable)                                                                    | Issuer/AS-side revocation _initiation_ — outside OAAF; relevant to issuer architecture only                                          |

**This profile is labeled experimental** because the strongest external status mechanism
for JOSE tokens (Token Status List) is still an Internet-Draft. OAAF therefore does **not**
freeze a status wire format. It freezes only the verifier-facing resolver contract, which
is stable regardless of which external mechanism produces the truth.

## Design

### The status resolver

A deployment supplies a resolver — a function the verifier calls for each token in the
chain:

```text
resolve(token_id, issuer, now)  ->  "active" | "revoked" | "unknown"
```

- `token_id` is the token's `jti`.
- `issuer` is the token's `iss` (the root issuer URI, or a derived token's parent-thumbprint
  URI), so a resolver can scope its truth by issuer.
- `now` is the evaluation instant.

The resolver is where a deployment plugs in its own truth: a Token Status List it fetched
and verified, an RFC 7662 introspection call, a signed revocation set on disk, an in-memory
set. **OAAF defines the contract, not the source.** Whatever the source, its answer
collapses to one of three values; mechanism-specific failures (a malformed status list, a
bad signature, a stale artifact, an unreachable endpoint) are the resolver's concern and it
reports them as `unknown`.

### Verifier behavior

After a chain verifies cryptographically and is within its validity window, and if a
resolver is configured:

1. For **each token in the chain**, call the resolver with that token's `jti` and `iss`.
2. If any is `revoked` → DENY with `authority_revoked`, locating the token by index.
3. If any is `unknown` → DENY with `status_unavailable` (fail closed).
4. Only if every token is `active` does evaluation proceed.

Checking every member is what makes revocation cascade: a revoked root or intermediate is
present in the chain, so the chain is refused — invalidating all descendants that depend on
it, exactly as AAT §8.9 describes, with no separate propagation logic.

### Default and modes

- **No resolver configured → expiry-only.** Unchanged current behavior; fully offline. This
  is the default and is backward compatible.
- **Resolver configured → revocation enforced, fail closed.** `unknown` denies.
- **Optional-status mode** (`allow_unknown_status`) MAY be set by a deployment that wants
  revocation checked when the source is reachable but is willing to proceed when it is not.
  This weakens the guarantee and is documented as such; it is never the default.

### Granularity

| Level                          | Mechanism                                  | Notes                                                                                                          |
| ------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Issuer / root-key invalidation | **Remove the trust anchor** (existing)     | Not token revocation — AAT §8.9 names trust-anchor rotation as the response to root-key compromise             |
| Individual token               | Resolver returns `revoked` for that `jti`  | The `jti` is the standards-grounded identifier                                                                 |
| Delegation subtree             | Falls out of checking every chain member   | Revoking an ancestor `jti` fails every chain that contains it; unrelated independent delegations are untouched |
| Subject-wide / issuer-wide     | **External** identity/authorization system | Belongs to the issuer/AS, not the OAAF verifier                                                                |

## Security considerations

- **Fail closed** (ADR-0004): required status that cannot be established denies. A network
  timeout, a malformed status artifact, an untrusted status signer, an unsupported
  mechanism, or a stale artifact all become `unknown` at the resolver and DENY at the
  verifier. None is silently treated as active.
- **Revoked ancestor, valid descendant** is handled: the ancestor is in the chain and is
  checked.
- **Status rollback / stale artifact**: a resolver that wraps a bounded-freshness signed
  status artifact must treat an expired artifact as `unknown`, not as its last-known
  contents. OAAF's core cannot enforce this inside the resolver, so it is stated as a
  resolver requirement and exercised by a fixture.
- **Forged status / signer confusion**: verifying the status artifact's signature is the
  resolver's responsibility; a verification failure is `unknown`. OAAF's core trusts the
  resolver's three-valued answer, not raw status bytes.
- **Expiry is not revocation** and the two produce distinct reason codes (`expired` vs
  `authority_revoked`); neither is overloaded to mean the other.

## Privacy considerations

Status checking introduces correlation and network-exposure risks that offline verification
does not have. These are **resolver** concerns, documented so a deployment chooses
knowingly:

- An **online** resolver reveals to the status source which token — and by extension which
  agent/resource — is being checked, and when. A bounded-freshness **signed status list**
  avoids per-check disclosure (the verifier fetches a batch artifact, not a per-token
  query), which is why Token Status List is the preferred external mechanism when available.
- Token `jti`s and status-list indices are correlation surfaces; a resolver that logs or
  caches them creates an authority-history trail. OAAF's core neither logs nor persists.
- The explanation never exposes status infrastructure: no status tokens, list contents,
  URLs, credentials, or internal status-service errors — only the canonical reason code and
  a token index.

## Compatibility

Additive. Existing consumers that pass no resolver see no behavior change (expiry-only).
Two new reason codes (`authority_revoked`, `status_unavailable`) and one new verification
stage (`status`) are additive and compatibility-sensitive; both are implemented in
TypeScript and Python from day one.

## Alternatives considered

- **An OAAF revocation/status server.** Rejected outright — it is the control plane the
  charter and this phase exist to avoid.
- **Bake in Token Status List wire format now.** Rejected: it is a `-21` Internet-Draft.
  Freezing it into OAAF's contract would couple OAAF to a moving target. The resolver
  abstraction lets a deployment use TSL today via an adapter without OAAF standardizing it.
- **Token hashes as identifiers.** Rejected: AAT already defines `jti`. Introducing hashes
  would add a collision/canonicalization/correlation surface for no benefit.
- **Short-lived tokens as "revocation".** Not revocation, and not presented as such — a
  documented risk-control complement (AAT §8.9), not a substitute.

## Unresolved questions

- Whether to ship a first-class Token Status List resolver adapter once the draft
  stabilizes. Deferred until TSL is closer to final.
- A canonical way to express `issuer` for a derived token in a resolver query (its `iss` is
  the parent thumbprint URI); this profile passes it through unmodified.

## Prior art

AAT §8.9 (the extension point). Token Status List (`draft-ietf-oauth-status-list`). OAuth
Token Introspection (RFC 7662). OAuth Token Revocation (RFC 7009).

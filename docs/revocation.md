# Revocation and authority status

OAAF can reject authority that has been invalidated before its natural expiry — **without
operating any revocation service**. This is verifier-side status enforcement; the truth
about what is revoked comes from your infrastructure, not from OAAF. The normative contract
is [RFC-0004](../rfcs/0004-authority-status-revocation.md).

> **Experimental.** The strongest external status mechanism for JOSE tokens
> ([Token Status List](https://datatracker.ietf.org/doc/draft-ietf-oauth-status-list/)) is
> still an Internet-Draft, so OAAF freezes only the verifier-facing resolver contract, not a
> status wire format.

## What OAAF does

Given a **status resolver** you supply, the verifier checks every token in a chain and
refuses the request if any is revoked or of unknown status:

```text
chain verifies cryptographically
  + within its validity window
  + resolver says every chain member is active
  = authority may proceed
```

Because every member is checked, revoking an ancestor invalidates its descendants — exactly
what AAT §8.9 describes — with no propagation machinery.

## What OAAF does not do

It does not issue authority, revoke authority, persist status, distribute revocation
events, schedule anything, or operate a status/introspection endpoint. If OAAF ran the
thing that revokes everyone's agents, it would be a control plane. It is a verifier.

## The resolver contract

```ts
// TypeScript
type StatusResolver = (tokenId: string, issuer: string, now: number)
  => 'active' | 'revoked' | 'unknown' | Promise<...>;
```

```python
# Python
StatusResolver = Callable[[str, str, int], Literal["active", "revoked", "unknown"]]
```

`tokenId` is the token's `jti`; `issuer` its `iss`. Your resolver is where a Token Status
List you fetched and verified, an RFC 7662 introspection call, or a signed revocation set on
disk turns into one of three answers. A mechanism-specific failure — a malformed list, a bad
signature, a stale artifact, an unreachable endpoint — is **your resolver's** concern and it
reports `unknown`.

Both packages ship `revokedSetResolver(revoked, unknown?)` / `revoked_set_resolver(...)` — a
convenience over an in-memory set, useful for tests and simple deployments. It is not a
Token Status List implementation.

## Deployment modes

| Mode                         | How                                                                                      | Revocation latency             | Network                    |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ | -------------------------- |
| **Expiry-only** (default)    | No resolver                                                                              | none — bounded by token expiry | none, fully offline        |
| **Bounded-freshness status** | Resolver over a signed status artifact (e.g. a Token Status List) refreshed periodically | bounded by artifact lifetime   | batch fetch, not per-check |
| **Online status**            | Resolver queries a live source (e.g. RFC 7662 introspection)                             | immediate                      | per-check                  |

Short token lifetimes remain a complementary risk control (AAT §8.9) — they bound exposure,
but they are **not** revocation and OAAF does not present them as such.

## Fail-closed

When a resolver is configured, a status of `unknown` **denies** (`status_unavailable`). A
network timeout, malformed status, untrusted status signer, stale artifact, or unsupported
mechanism all become `unknown` and therefore deny — none is silently treated as active. A
deployment that wants to proceed when the source is merely unreachable may set
`allowUnknownStatus` / `allow_unknown_status`; this weakens the guarantee and is never the
default. Trust-anchor removal remains the response to issuer/root-key compromise.

## Granularity

- **Issuer / root key** → remove the trust anchor (existing mechanism; not token revocation).
- **A specific token** → resolver returns `revoked` for its `jti`.
- **A delegation subtree** → revoke the ancestor's `jti`; every chain containing it fails.
  Independent delegations by the same holder are untouched.
- **Subject-wide / issuer-wide** → belongs to your identity/authorization system, not the
  OAAF verifier.

## Reason codes

| Code                 | Stage    | Meaning                                                         |
| -------------------- | -------- | --------------------------------------------------------------- |
| `authority_revoked`  | `status` | A chain member's status is revoked (the token index locates it) |
| `status_unavailable` | `status` | Required status could not be established; fail closed           |

Distinct from `expired`. Neither is overloaded to mean the other.

## Privacy

Status checking adds correlation and network-exposure risk that offline verification does
not. These are resolver choices, so choose knowingly:

- An **online** resolver reveals to the status source which token — and which agent/resource
  — is being checked, and when. A **bounded-freshness signed status list** avoids per-check
  disclosure by fetching a batch artifact, which is why it is preferred where available.
- `jti`s and status-list indices are correlation surfaces; a resolver that logs or caches
  them builds an authority-history trail. OAAF's core neither logs nor persists.
- The explanation never exposes status infrastructure — no status tokens, list contents,
  URLs, credentials, or internal errors; only the reason code and a token index.

## Security

Threats and how the design handles them: a revoked token accepted because a resolver failed
open (fail closed by default); stale status accepted indefinitely (resolver must treat an
expired artifact as `unknown`); forged status list or signer confusion (the resolver
verifies the artifact; failure → `unknown`); revoked ancestor with a valid descendant
(every member checked); network timeout read as active (→ `unknown` → deny). See
[RFC-0004](../rfcs/0004-authority-status-revocation.md) for the full analysis.

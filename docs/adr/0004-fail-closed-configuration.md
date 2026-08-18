# ADR-0004: Security-critical configuration is required, not defaulted

- **Status:** Accepted
- **Date:** 2026-08-18
- **Deciders:** Edwin Digital LLC (initial maintainer)
- **Relates to:** [ADR-0003](0003-implement-existing-authority-standards.md), [RFC-0001](../../rfcs/0001-aat-authzen-enforcement-profile.md)

## Context

The first implementation of chain verification checked the root token's signature
against the key carried inside that same token. It looked correct and passed its tests,
because a well-formed chain is internally consistent regardless of who signed the root.

It answered the wrong question. The verifier established:

> This chain is internally self-consistent.

when what an enforcement point needs is:

> This chain terminates in an issuer I explicitly trust.

Anyone could mint a self-signed root granting themselves anything, and verification
would succeed. The gap was found by reading the draft's normative verification
algorithm, which verifies the root against a configured trust anchor set.

The fix made `trustAnchors` a required parameter. That raised a general question worth
settling once: when configuration is security-critical, should its absence be a runtime
warning with a permissive default, or a contract violation?

A permissive default is the more familiar choice. It makes the first call easier, keeps
tutorials shorter, and produces a library that appears to work immediately. It also
reproduces exactly the failure above — a verifier that appears to validate authority
while proving nothing about who granted it — and it does so silently, in the deployments
least likely to notice.

## Decision

**OAAF APIs fail closed when omitting configuration would silently weaken the authority
guarantee. Security-critical configuration is represented in the type or API contract
wherever practical, rather than deferred to a runtime warning or a permissive default.**

Applied first to trust anchors:

> Verification MUST require an explicit trust-anchor set. Absence of trust anchors is a
> configuration error, not a warning condition.

Consequences for the API surface:

- `verifyDelegationChain` and `verifyAuthority` require `trustAnchors`. Omission is a
  compile error; an empty set is denied at runtime with `untrusted_root`.
- There is no permissive mode, no `skipTrustAnchors`, and no default anchor set.
- A diagnostic path that validates structure and signatures **without** establishing
  trusted authority may be added if a real need appears. It must be named so its limits
  are unmistakable — `inspectUntrustedChain` or `verifyStructureOnly` — must state
  plainly that it does not establish trusted authority, and must never return an
  authorization decision. It is not being added speculatively.

This extends the existing rule that proof of possession cannot be disabled while still
returning a decision. Both come from the same reasoning: a weakening that is one
parameter away will eventually be one parameter away in production.

## Scope

The principle applies wherever configuration determines whether a guarantee holds.
Anticipated cases:

| Area                  | The weakening a default would hide                              |
| --------------------- | --------------------------------------------------------------- |
| Revocation sources    | "Not revoked" meaning "never checked"                           |
| Freshness windows     | Unbounded acceptance of stale material                          |
| Issuer policy         | Any issuer treated as authoritative                             |
| Evidence verification | Unverified evidence treated as proof                            |
| MCP and A2A bindings  | An enforcement point that can be bypassed by not configuring it |

It does not apply to configuration that is merely operational — limits, timeouts, log
verbosity — where a documented default is appropriate and its absence weakens nothing.

## Consequences

**Accepted costs.**

- The first call is longer, and the quickstart must introduce trust anchors before it can
  show anything working. That is a real adoption cost paid at the worst moment, on first
  contact.
- Required parameters are breaking changes when added later, so each new one must be
  introduced deliberately and early.
- Some callers will find it pedantic, particularly in tests and local experiments, where
  the anchor is a key they generated seconds earlier.

**Benefits.**

- The secure configuration is the only configuration, so it cannot be omitted by
  oversight, by copying an example, or under deadline.
- Conformance becomes testable: an implementation can be checked against an unknown or
  self-signed root and must refuse it.
- The API contract matches the normative semantics being implemented, rather than
  offering a convenience mode that quietly diverges from them. For a project whose value
  proposition is faithful implementation of other people's standards, that alignment is
  the product.

**Timing.** Taken while nothing is published. Once npm packages, documentation,
examples, and third-party adapters exist, tightening a permissive default is a breaking
change with an installed base and an argument attached.

## Alternatives considered

**Optional with a runtime warning.** Easier first call; preserves the failure mode. A
warning is only seen by someone reading logs at the moment of misconfiguration, which is
not when this class of mistake is made or noticed.

**Optional, but deny at runtime when absent.** Equivalent security, worse ergonomics: the
failure moves from compile time to the first request, and the type signature no longer
documents the requirement.

**A non-empty tuple type for anchors.** Would make an empty literal a compile error too.
Rejected: anchors are usually loaded from configuration at runtime as a plain array, and
the tuple type would push callers toward casts — weakening the guarantee it was meant to
strengthen. Required-ness is enforced by the type; non-emptiness is enforced at runtime
and tested.

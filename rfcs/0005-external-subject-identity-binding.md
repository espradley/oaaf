---
rfc: 0005
title: External Subject Identity Binding
status: Accepted (SPIFFE/OIDC stable; WIMSE experimental)
classification: PROFILE
authors: OAAF maintainers
created: 2026-08-18
supersedes: none
---

# RFC-0005: External Subject Identity Binding

## Summary

Lets OAAF bind authority to an identity established by an **external** system — SPIFFE,
WIMSE, an OIDC provider — instead of assuming the subject is a key thumbprint. OAAF becomes
an authority layer that consumes verified identity; it does not become an identity provider,
credential issuer, or registry.

The mechanism is deliberately small and standards-grounded: a token MAY carry the JWT
`sub` claim holding an external subject identifier URI, while `cnf.jwk` remains the
proof-of-possession key. The trusted issuer binds the two by signing a grant that names
both. Four things that were one field become four distinct, securely-bound concepts.

## Motivation

Today OAAF's subject _is_ the leaf holder's JWK thumbprint (RFC-0001). That conflates who a
workload **is** with the key it **signs with**. Real deployments already have an identity
system — SPIFFE gives a workload `spiffe://trust-domain/path`, WIMSE gives `wimse://...`, an
IdP gives an OIDC `sub`. OAAF should carry authority _for that identity_, not require every
workload to be known only by a key hash, and not ask anyone to adopt an "OAAF Agent ID."

## Charter fit

Answers _"is this actor authorized to perform this action under this authority?"_ — now the
_actor_ can be an externally verified identity. Introduces no identity issuance,
registration, attestation, or lifecycle. Classification: **PROFILE** using the JWT-standard
`sub` (RFC 7519) plus each identity system's own URI form, with optional external
verification.

## The four concepts, kept distinct

The single most important outcome of this RFC is that these stop being one field:

| Concept                       | What it is                                      | Where it lives                                     | Who establishes it           |
| ----------------------------- | ----------------------------------------------- | -------------------------------------------------- | ---------------------------- |
| **Subject identity**          | _who_ the workload is                           | the token's `sub` (a URI)                          | the external identity system |
| **Authentication credential** | how the workload proved identity to that system | an SVID / OIDC token — **external, never in OAAF** | the identity system          |
| **Proof-of-possession key**   | what the holder signs invocations with          | `cnf.jwk`                                          | the holder                   |
| **Authority**                 | _what_ the subject may do                       | the AAT grant                                      | the authority issuer         |

They are bound, not merged: the trusted **authority issuer** signs a grant carrying both
`sub` (identity) and `cnf.jwk` (PoP key), asserting "the holder of this key is this
subject, and I grant them this authority." PoP proves possession of `cnf.jwk`. An optional
**identity-binding verifier** independently confirms the subject↔holder binding when the
identity provider is a different principal than the authority issuer.

## Standards basis and status

| Source                    | Version / status                                             | `sub` form                                          | Role                                                 |
| ------------------------- | ------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------- |
| JWT                       | RFC 7519                                                     | `sub` (any string/URI)                              | The standard subject claim OAAF reads                |
| PoP key                   | RFC 7800 `cnf`                                               | —                                                   | Already used by AAT; unchanged                       |
| SPIFFE JWT-SVID           | stable spec                                                  | `sub` = `spiffe://trust-domain/path` (RFC 3986 URI) | Directly bindable                                    |
| WIMSE Workload Identifier | `draft-ietf-wimse-identifier-03` (6 Jul 2026, IETF WIMSE WG) | `sub` = `wimse://trust-domain/path`                 | Bindable, **experimental** (draft)                   |
| OIDC subject              | stable                                                       | collision-safe `iss` + `sub`                        | Bindable via a URI-composed subject                  |
| AAT                       | `draft-niyikiza-...-01`                                      | omits `sub`; carries `cnf.jwk`                      | Additional claims permitted; this profile adds `sub` |

Every one of these puts the identity in `sub` as a URI. OAAF therefore invents **no**
identifier scheme; it reads `sub`.

## Design

### Canonical subject

- If the leaf token carries a valid `sub`, the canonical OAAF subject **is** that `sub`.
- If it does not, the canonical subject is the leaf holder's JWK Thumbprint URI, exactly as
  before. **Backward compatible**: existing key-only deployments are unchanged.

The holder (the `cnf.jwk` thumbprint) is _always_ available and distinct from the subject,
so an explanation can show both "who" and "which key."

### Identity source / profile

Derived from the `sub` URI scheme — `spiffe`, `wimse`, `https` (OIDC), or a thumbprint URN —
not from a hard-coded enum in the core. A future identity system that mints URIs needs no
OAAF release; an adapter maps its verified identity into a `sub`.

### Optional identity-binding verifier

A deployment MAY supply a verifier — resolver-style, like RFC-0004's status resolver:

```text
verify_identity_binding(subject, holder_thumbprint, now) -> "bound" | "mismatch" | "unavailable"
```

It is where a SPIFFE/WIMSE/OIDC-aware deployment confirms — using its own infrastructure —
that the `sub` genuinely corresponds to the holder key (e.g. by validating a JWT-SVID whose
`sub` is that identity and whose confirmation key is `cnf.jwk`). OAAF defines the
three-valued contract, not the verification.

- **No verifier configured** → the issuer's signed assertion of `sub` is trusted (the same
  trust model as an IdP asserting `sub`). This is the default.
- **Verifier configured** → `mismatch` denies with `subject_identity_mismatch`; `unavailable`
  denies with `identity_binding_unavailable` (fail closed) unless the deployment opts into a
  documented weaker mode.

### PoP is unchanged

Proof of possession always binds to `cnf.jwk`. A string subject never weakens it: the
subject names _who_, the PoP proves _possession of the key the issuer bound to that subject_.
Subject ≠ PoP key.

### Delegation across identity namespaces

Each token carries its own optional `sub`. Alice (`spiffe://company.example/agents/alice`,
key A) may delegate to Bob (`spiffe://company.example/agents/bob`, key B) — or to a subject
in a different namespace — because the binding is per-token and the parent signs the child.
Cross-**domain** trust is not implied by a syntactically valid identifier: trust anchors and
the identity-binding verifier remain the arbiters, and OAAF makes no cross-organizational
trust promise on the strength of a URI.

## Trust model

| Principal                                                 | Trusted to                                               |
| --------------------------------------------------------- | -------------------------------------------------------- |
| Identity provider / workload infra (SPIFFE, WIMSE, IdP)   | Establish the subject identity                           |
| Authority issuer (a trust anchor, or a delegating holder) | Issue authority and bind a subject to a holder key       |
| Holder                                                    | Prove possession of `cnf.jwk` where required             |
| Recipient                                                 | Verify authority is intended for it (RFC-0003 `aat_aud`) |

These may be different operators. The default trusts the authority issuer's subject
assertion; a deployment that separates identity provider from authority issuer supplies the
binding verifier.

## Reason codes

Two new, in both languages, stage `identity`:

| Code                           | Meaning                                                                 |
| ------------------------------ | ----------------------------------------------------------------------- |
| `subject_identity_mismatch`    | The binding verifier says the subject does not correspond to the holder |
| `identity_binding_unavailable` | A required identity binding could not be established (fail closed)      |

Distinct from `pop_signature_invalid` (possession), `caller_holder_mismatch` (transport
caller vs holder), and `pop_recipient_mismatch` (recipient). None is overloaded.

## Security considerations

- **Fail closed**: a required binding that is `unavailable` (external verifier down,
  malformed/untrusted identity evidence, unsupported mechanism) denies.
- **Subject substitution / issuer confusion**: the `sub` is only as trustworthy as the
  signature over it; a forged grant fails chain verification, and an issuer OAAF does not
  trust is not a trust anchor.
- **Cross-issuer `sub` collision**: OIDC subjects MUST be composed with their issuer into a
  collision-safe URI; a bare `sub` is ambiguous across issuers and is not used alone.
- **SPIFFE trust-domain confusion / syntactically-valid-but-untrusted IDs**: a valid
  `spiffe://` URI is not trust; the binding verifier (or the issuer's own trust-domain
  scoping) decides, and cross-domain federation is a deployment concern, not an OAAF promise.
- **Identity ↔ PoP mismatch**: kept separate by construction; PoP always checks `cnf.jwk`.
- **Identity downgrade (required → optional)**: required binding is a deployment setting; its
  absence denies, it is never silently optional.
- **Stale identity credential**: the external verifier's concern — a stale credential yields
  `unavailable`, which denies.

## Privacy considerations

Subject identifiers can themselves be sensitive and correlatable — a `spiffe://` path can
reveal an organization's internal structure. The explanation exposes the `sub` and the
profile (its scheme) but **never** an SVID, JWT credential, certificate, OIDC token,
authorization header, key material, or attestation document. A deployment that treats
subject identifiers as sensitive should scope where explanations are logged.

## Compatibility

Additive and backward compatible. No `sub` → subject is the thumbprint, as today. The
`AuthoritySummary` gains a `holder` field (the PoP-key thumbprint, always) and a
`subjectProfile`; existing consumers that read `subject` see the thumbprint unless a `sub`
is present. Two new reason codes and one new stage, both languages.

## Alternatives considered

- **An OAAF Agent ID / identity registry.** Rejected — it is the identity provider this RFC
  exists to _not_ become, and it would make composing with SPIFFE/WIMSE/OIDC impossible.
- **Verify SVIDs/OIDC tokens in OAAF core.** Rejected as a requirement: that couples OAAF to
  each credential format and network. Offered instead as the deployment's binding verifier.
- **Keep subject == thumbprint and put identity elsewhere.** Rejected: `sub` is the
  standard, and every target system already uses it.

## Unresolved questions

- A first-class WIMSE workload-credential verifier once the drafts stabilize (currently an
  external binding-verifier concern).
- Whether to define a canonical OIDC `iss`+`sub` composition URI or leave it to the adapter
  (this RFC leaves it to the adapter, requiring only that the composed value be collision-safe).

## Prior art

SPIFFE JWT-SVID (`sub` = SPIFFE ID). WIMSE Workload Identifier
(`draft-ietf-wimse-identifier`). JWT `sub` (RFC 7519), PoP `cnf` (RFC 7800). RFC-0001 (the
thumbprint subject this profile generalizes), RFC-0003 (recipient binding), RFC-0004 (the
resolver pattern reused here).

# OAAF Core AAT-`-01` compatibility profile

This is the **profile** of Attenuating Authorization Tokens that OAAF Core requires for
interoperability — the freeze surface that lets an independent implementation reproduce OAAF
Core behavior from OAAF's own permanent artifacts, without hunting down an expired
Internet-Draft.

> **Standards-first, not a republish.** [AAT](standards-readiness.md) defines the underlying
> token mechanism. This document does **not** restate or claim AAT as an OAAF-owned format; it
> freezes the **subset and relationships** that OAAF Core 1.0 depends on, pinned to
> `draft-niyikiza-oauth-attenuating-agent-tokens-01`. Where this profile and the AAT draft
> speak to the same claim, AAT is authoritative on the mechanism and OAAF is authoritative only
> on what OAAF Core requires of it. The permanent, executable statement of these requirements is
> the [conformance corpus](vectors/corpus.json) — real signed tokens with expected outcomes.

## Pinned revision

`AAT_DRAFT_REVISION = "01"`. Support is pinned, not "latest". A future AAT revision is a **new
profile version** decided deliberately (see [compatibility.md](compatibility.md)); it never
silently redefines what OAAF Core 1.0 meant.

## Token envelope

Each authority token is a compact JWS (`header.payload.signature`), signed with an OKP key
using `EdDSA` (Ed25519). `alg: "none"` and any non-permitted algorithm MUST be rejected
(`CORE-CRYPTO-002`). Signature verification precedes any use of the claims (`CORE-CRYPTO-001`).

## Required claims (authority token)

| Claim                   | Type       | On root    | On derived | Meaning / OAAF Core requirement                                                                                                              |
| ----------------------- | ---------- | ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `jti`                   | string     | REQUIRED   | REQUIRED   | Token id; the status key (`STATUS-001`). RECOMMENDED UUIDv7.                                                                                 |
| `iss`                   | string URI | REQUIRED   | REQUIRED   | Root: the issuer URI, matched to a trust anchor. Derived: the JWK Thumbprint URI of the **parent** `cnf.jwk` (`CORE-CRYPTO-003`).            |
| `iat`                   | number     | REQUIRED   | REQUIRED   | Issued-at (seconds since epoch).                                                                                                             |
| `exp`                   | number     | REQUIRED   | REQUIRED   | Expiry. Derived `exp` MUST NOT exceed the parent's (`CORE-TIME-003`).                                                                        |
| `cnf`                   | `{ jwk }`  | REQUIRED   | REQUIRED   | RFC 7800 confirmation of the holder public key. MUST NOT contain private key material (`CORE-CRYPTO-004`).                                   |
| `del_depth`             | number     | `0`        | parent+1   | Delegation depth. Leaf depth MUST NOT exceed the effective ceiling (`CORE-DELEG-002`).                                                       |
| `del_max_depth`         | number     | REQUIRED   | REQUIRED   | Delegation ceiling. Monotonic: derived MUST NOT exceed the parent's (`CORE-DELEG-001`).                                                      |
| `authorization_details` | array      | REQUIRED   | REQUIRED   | Exactly one entry of `type: "attenuating_agent_token"` carrying `tools` (below).                                                             |
| `par_hash`              | string     | **absent** | REQUIRED   | base64url-nopad SHA-256 of the parent token's JWS signing input. MUST be absent on a root and present on a derived token (`CORE-CHAIN-003`). |
| `sub`                   | string URI | optional   | optional   | External subject identity (RFC-0005). When absent, the canonical subject is the holder thumbprint (`CORE-SUBJ-001`).                         |

The `authorization_details` entry has `type = "attenuating_agent_token"` and
`tools: { <toolName>: <ToolConstraints> }`. Exactly one such entry is required; zero or several
is a structural failure.

## Claim relationships (the chain)

For a chain presented root → leaf:

- **Trust anchor:** the root is verified against a configured trust anchor, never its own
  `cnf.jwk` (`CORE-TRUST-001`, `CORE-TRUST-002`).
- **Parent linkage:** each derived token's `iss` equals the JWK Thumbprint URI
  (`urn:ietf:params:oauth:jwk-thumbprint:sha-256:…`, RFC 7638/9278) of its parent's `cnf.jwk`,
  and its `par_hash` equals the SHA-256 of the parent's signing input (`CORE-CHAIN-001`,
  `CORE-CHAIN-003`, `CORE-CRYPTO-003`).
- **Monotonic ceiling:** `del_max_depth` never increases down the chain (`CORE-DELEG-001`).
- **Window containment:** a derived token's validity window lies within its parent's
  (`CORE-TIME-003`).
- **Attenuation only:** a derived token's tools/constraints admit a subset of the parent's
  permitted invocations — no new tool, no broadened constraint, exact argument-key-set match
  under the closed-world model (`CORE-NARROW-001..004`).

## Constraint representation

A `ToolConstraints` is `{ <argumentName>: <Constraint> }`; an empty map authorizes the tool
unconstrained. A `Constraint` has a `constraint_type` and type-specific members:

| `constraint_type` | Members                        | Admits                                    |
| ----------------- | ------------------------------ | ----------------------------------------- |
| `exact`           | `value`                        | one exact value                           |
| `one_of`          | `values[]`                     | any listed value                          |
| `not_one_of`      | `excluded[]`                   | any value not excluded                    |
| `range`           | `min?`, `max?`, `*_inclusive?` | numbers within the range                  |
| `contains`        | `required[]`                   | collections containing all required items |
| `subset`          | `allowed[]`                    | collections within the allowed set        |
| `wildcard`        | —                              | any value                                 |
| `all`             | `constraints[]`                | values satisfying every sub-constraint    |
| `any`             | `constraints[]`                | values satisfying some sub-constraint     |

Subsumption between a parent and a derived constraint follows AAT `-01` §4.5, which is
**closed-world**: any (parent type, derived type) pair not explicitly permitted MUST be
rejected (`CORE-NARROW-004`), and an unrecognized `constraint_type` MUST be rejected rather than
ignored. A **constrained argument is required** — omitting it MUST deny (`CORE-CONSTR-001`).

## Proof of possession

A presentation carries a PoP JWS signed by the leaf holder key, with payload:

| Claim      | Meaning                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| `aat_id`   | `jti` of the presented leaf token.                                                            |
| `aat_tool` | the tool being invoked.                                                                       |
| `hta`      | the argument map, compared by **RFC 8785 (JCS)** canonical byte equality (`CORE-CRYPTO-005`). |
| `iat`      | issued-at.                                                                                    |
| `jti`      | PoP token id.                                                                                 |
| `aat_aud`  | optional enforcement-point audience (A2A recipient binding, `A2A-003`).                       |

Enforcement MUST verify PoP, binding the presentation to the verified leaf holder key and the
exact argument map (`CORE-POP-001`, `CORE-POP-003`). There MUST NOT be a mode that returns an
authorization decision with PoP verification disabled (`CORE-POP-002`).

## Permanent test fixtures

The normative, executable expression of this profile is the [portable corpus](vectors/corpus.json):
51 real signed tokens with expected decisions and reason codes, tagged with the requirement IDs
above and consumable without any OAAF code. An implementation that reproduces the corpus outcomes
and passes the [adversarial suite](security.md) implements this profile, regardless of the AAT
draft's archival status.

## Self-containment statement

With this profile plus the [requirement catalog](requirements.json), the [corpus](vectors/corpus.json),
the [reason-code freeze](reason-codes.json), and the stable standards those reference (AuthZEN 1.0
Final, JOSE/JWT/JCS/JWK-Thumbprint RFCs, SPIFFE), OAAF Core is implementable from OAAF's permanent
artifacts alone — the [v1-readiness gap identified in O6F](standards-readiness.md#v1-readiness-test-if-every-draft-disappeared-tomorrow)
is closed.

# Normative-surface classification

This document answers the central O6A question: **which observable behaviors are actually
OAAF, and which merely happen to exist in the reference implementations?** Every behavior
OAAF exposes is classified as one of:

| Code  | Meaning                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------- |
| **U** | **Upstream normative** — defined by an adopted external standard; OAAF requires its use.       |
| **O** | **OAAF normative** — behavior OAAF itself defines that a conformant implementation reproduces. |
| **B** | **Binding normative** — required only when conformance is claimed for a specific binding.      |
| **R** | **Reference behavior** — useful behavior of the TS/Python impls, NOT required for conformance. |
| **E** | **Experimental** — depends on unstable upstream work; not an unconditional v1 requirement.     |
| **X** | **Explicitly out of scope.**                                                                   |

## Behavior matrix

### Authority

| Behavior                                                                          | Class | Requirement(s)                       | Note                                                                                                                                                                                                |
| --------------------------------------------------------------------------------- | ----- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token/authority representation (AAT `-01`)                                        | U     | `CORE-CRYPTO-001`                    | OAAF adopts AAT; it defines no wire format.                                                                                                                                                         |
| Delegation chain, root→leaf order                                                 | U/O   | `CORE-CHAIN-001`, `CORE-CHAIN-003`   | AAT defines it; OAAF requires verifying it.                                                                                                                                                         |
| Attenuation / narrowing (no widening)                                             | U/O   | `CORE-NARROW-001`, `CORE-NARROW-002` | The thesis. Enforced, not optional.                                                                                                                                                                 |
| Closed-world argument key-set match                                               | U     | `CORE-NARROW-003`                    | AAT step 4p2.                                                                                                                                                                                       |
| Delegation depth monotonicity + bound                                             | U     | `CORE-DELEG-001`, `CORE-DELEG-002`   | AAT invariant I2.                                                                                                                                                                                   |
| Argument constraints, required-when-constrained                                   | U     | `CORE-CONSTR-001`, `CORE-CONSTR-002` | AAT step 6b.                                                                                                                                                                                        |
| Tool/operation authority at the leaf                                              | U/O   | `CORE-CONSTR-003`, `CORE-CONSTR-004` |                                                                                                                                                                                                     |
| Expiry and validity-window containment                                            | U     | `CORE-TIME-001`…`CORE-TIME-003`      |                                                                                                                                                                                                     |
| Trust anchors required; root vs anchor                                            | O     | `CORE-TRUST-001`, `CORE-TRUST-002`   | OAAF's fail-closed profile rule (ADR-0004).                                                                                                                                                         |
| **AAT→AuthZEN request field mapping** (subject.type=`agent`, resource=tool, etc.) | O     | see standards.md                     | OAAF profile (RFC-0001); normative for producing an AuthZEN request, but a Core verifier need not emit AuthZEN at all. Classified **O**, scoped to implementations that expose an AuthZEN decision. |

### Cryptography

| Behavior                                        | Class | Requirement(s)                | Note                                       |
| ----------------------------------------------- | ----- | ----------------------------- | ------------------------------------------ |
| Signature verification (EdDSA/JWS)              | U     | `CORE-CRYPTO-001`             | JOSE/AAT.                                  |
| `alg:none` / algorithm-confusion rejection      | U/O   | `CORE-CRYPTO-002`             | OAAF states it as a MUST.                  |
| JWK thumbprint URI (RFC 7638/9278) issuer link  | U     | `CORE-CRYPTO-003`             |                                            |
| RFC 8785 (JCS) canonicalization for PoP binding | U     | `CORE-CRYPTO-005`             | Upstream algorithm; OAAF requires its use. |
| No private key material in `cnf.jwk`            | U/O   | `CORE-CRYPTO-004`             |                                            |
| Proof of possession                             | U/O   | `CORE-POP-001`…`CORE-POP-003` | AAT; OAAF forbids a decision without it.   |
| Recipient/audience binding (`aat_aud`)          | B     | `A2A-003`                     | Binding concern (A2A).                     |

### Status / revocation

| Behavior                                      | Class | Requirement(s)             | Note                                                                                                                                                         |
| --------------------------------------------- | ----- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resolver contract (active/revoked/unknown)    | O     | `STATUS-001`               | OAAF-defined verifier-facing contract.                                                                                                                       |
| `jti` as the status key                       | U     | `STATUS-001`               | AAT `jti` (RECOMMENDED UUIDv7).                                                                                                                              |
| Revoked → deny; unknown → deny (fail closed)  | O     | `STATUS-002`, `STATUS-003` |                                                                                                                                                              |
| Ancestor revocation cascade                   | O     | `STATUS-004`               | Falls out of checking every member.                                                                                                                          |
| Required-status fail-closed default           | O     | `STATUS-003`, `STATUS-006` |                                                                                                                                                              |
| **Status wire mechanism** (Token Status List) | E     | —                          | Draft; **not frozen**. OAAF freezes only the resolver contract, so the whole `Status` class is an **optional profile**, and its wire format is experimental. |

### Identity

| Behavior                                                                      | Class | Requirement(s)                   | Note                                                                                        |
| ----------------------------------------------------------------------------- | ----- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| Four concepts kept distinct (subject / auth credential / PoP key / authority) | O     | `CORE-SUBJ-001`, `CORE-SUBJ-002` | The O5D result.                                                                             |
| Canonical subject = leaf `sub` (URI) else holder thumbprint                   | O     | `CORE-SUBJ-001`                  | Core, even without a verifier.                                                              |
| External identity establishment (SPIFFE JWT-SVID, OIDC)                       | U     | `IDENT-004`                      | Established by the identity system, not OAAF.                                               |
| Identity-binding verifier contract (bound/mismatch/unavailable)               | O     | `IDENT-001`, `IDENT-002`         | OAAF-defined; optional profile.                                                             |
| Caller ≠ holder (transport caller vs AAT holder)                              | B     | `A2A-004`                        | A2A binding.                                                                                |
| Recipient identity                                                            | B     | `A2A-003`                        | A2A binding.                                                                                |
| **WIMSE `wimse://` subject**                                                  | E     | `IDENT-005`                      | `draft-ietf-wimse-identifier-03`; **experimental**. Bindable but not a v1-mandatory scheme. |

### PDP interoperability

| Behavior                                                                       | Class | Requirement(s) | Note                                        |
| ------------------------------------------------------------------------------ | ----- | -------------- | ------------------------------------------- |
| Invariant: OAAF decides authority validity; PDP decides policy                 | O     | `PDP-001`      | Load-bearing.                               |
| Authority context from a verified authority only; `authorityVerified` ≠ permit | O     | `PDP-002`      |                                             |
| AuthZEN as canonical carrier; other engines documented adapters                | O     | `PDP-003`      | No engine is a Core dependency.             |
| Authority context: names, never values                                         | O     | `PDP-004`      |                                             |
| OPA/Cedar/OpenFGA adapter mappings                                             | R     | —              | Documented examples, not required behavior. |

### Explanation

| Behavior                                    | Class | Requirement(s)             | Note                                                                                        |
| ------------------------------------------- | ----- | -------------------------- | ------------------------------------------------------------------------------------------- |
| `decision` ALLOW/DENY                       | O     | `CORE-EXPL-001`            |                                                                                             |
| At least one reason code on DENY            | O     | `CORE-EXPL-001`            |                                                                                             |
| Normative reason code for a named check     | O     | `CORE-EXPL-002`            | See reason-code classification below.                                                       |
| Privacy-safe omission (names, never values) | O     | `CORE-EXPL-003`            | Security invariant.                                                                         |
| `stage` field                               | R     | —                          | Reference organization; SHOULD, not MUST.                                                   |
| Locators (`tool`, `argument`, `tokenIndex`) | R     | `CORE-EXPL-004`            | Useful; MAY.                                                                                |
| `AuthoritySummary` shape                    | R/O   | `CORE-SUBJ-002`, `PDP-004` | The subject/holder split and names-not-values are normative; the object shape is reference. |
| Human-readable `message` wording            | R     | `CORE-EXPL-004`            | Never byte-normative; MUST be privacy-safe if present.                                      |
| Additional diagnostic fields                | R     | `CORE-EXPL-004`            | MAY, without breaking conformance.                                                          |

### Bindings

| Behavior                                    | Class | Requirement(s)       | Note                                                                                                    |
| ------------------------------------------- | ----- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| MCP/COAZ precondition-before-PDP            | B     | `MCP-001`, `MCP-002` |                                                                                                         |
| A2A required-extension + verify-before-act  | B     | `A2A-001`, `A2A-002` |                                                                                                         |
| Cross-transport **authority** equivalence   | O     | `CORE-DEC-004`       | Core: semantics MUST NOT change by transport.                                                           |
| Cross-transport **explanation** equivalence | R     | —                    | Certified between the reference impls (O4B); a reference property, not required of an independent impl. |

### Distribution

| Behavior                                   | Class | Requirement(s)     | Note                                                                                                  |
| ------------------------------------------ | ----- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| Language/library/object-model independence | O     | `CORE-NEUTRAL-005` | O5B proved it; conformance requires it be possible.                                                   |
| TS/Python parity                           | R     | —                  | Evidence of independence, not a requirement on a third impl.                                          |
| Package name, runtime, module format       | R     | —                  | Reference packaging; never normative.                                                                 |
| No-telemetry / no phone-home               | R     | —                  | A property of the reference SDK (enforced by `check:telemetry`), not a portable protocol requirement. |

## Reason-code classification

There are 53 reason codes. Interoperability does **not** require an implementation to
reproduce all 53 internal distinctions; it requires a DENY with a code that names the failed
check for the checks that are normative. Codes are classified so O6H can freeze a minimal set
rather than carry all 53 as permanent compatibility baggage.

- **Normative (Core)** — a denial from this check MUST carry this code (`CORE-EXPL-002`):
  `untrusted_root`, `invalid_signature`, `algorithm_not_permitted`, `private_key_material`,
  `issuer_thumbprint_mismatch`, `tool_not_delegated`, `constraint_expansion`,
  `argument_key_set_mismatch`, `tool_not_authorized`, `argument_missing`,
  `argument_constraint_violated`, `argument_not_permitted`, `expired`,
  `expiry_exceeds_parent`, `delegation_depth_exceeded`, `delegation_ceiling_raised`,
  `pop_missing`, `pop_signature_invalid`, `pop_binding_mismatch`.
- **Normative (profile)** — required only when the class is claimed:
  `authority_revoked`, `status_unavailable` (Status); `subject_identity_mismatch`,
  `identity_binding_unavailable` (Identity); `extension_not_activated`,
  `authority_material_missing`, `caller_holder_mismatch`, `pop_recipient_mismatch` (A2A).
- **Reference-only diagnostic** — an implementation MUST still deny, but MAY use a coarser
  code or its own finer granularity: `chain_empty`, `chain_too_long`,
  `chain_cycle_detected`, `token_malformed`, `token_too_large`,
  `authorization_details_invalid`, `par_hash_present_on_root`, `par_hash_missing`,
  `par_hash_mismatch`, `holder_key_invalid`, `not_yet_valid`, `issued_before_parent`,
  `expiry_not_after_issuance`, `lifetime_exceeded`, `delegation_depth_invalid`,
  `delegation_ceiling_invalid`, `depth_exceeds_own_ceiling`, `chain_length_mismatch`,
  `root_depth_invalid`, `constraint_type_unrecognized`, `constraint_type_not_permitted`,
  `constraint_too_deep`, `pop_malformed`, `pop_token_mismatch`, `pop_tool_mismatch`,
  `pop_stale`.

> **Recommendation for O6H:** freeze only the ~19 Core-normative and profile-normative codes
> as compatibility-sensitive; treat the ~26 reference-only distinctions as non-normative
> diagnostics that may evolve. Do not rename or remove anything now (`CORE-EXPL` is stated in
> terms of "the code for the check," and renaming a shipped code is breaking).

## Stage classification

The seven stages (`chain`, `leaf`, `pop`, `evaluation`, `status`, `identity`, `a2a`) are a
**reference-only diagnostic** field (**R**). They are useful and SHOULD be provided where
applicable, but an independent implementation MAY organize verification differently and is not
required to reproduce these labels. Stages are not an interoperability contract.

## Experimental-feature treatment

| Feature                        | Upstream basis                     | v1 treatment                                                               |
| ------------------------------ | ---------------------------------- | -------------------------------------------------------------------------- |
| Status wire mechanism          | Token Status List (Internet-Draft) | **Optional profile**; wire format not frozen; resolver contract is stable. |
| WIMSE `wimse://` subject       | `draft-ietf-wimse-identifier-03`   | **Experimental** within the Identity profile; not a mandatory scheme.      |
| Signed portable receipts (O4D) | evolving                           | **Out of scope (X)** for v1 conformance — parked.                          |

No draft-dependent behavior is allowed to become a mandatory Core requirement. The Status and
Identity profiles are opt-in precisely so that unstable upstream work stays isolated from the
unqualified "OAAF-conformant" claim.

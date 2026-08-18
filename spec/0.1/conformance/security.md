# Security / adversarial certification

Every OAAF **security invariant** must survive deliberate attempts to violate it. This artifact
is the traceability spine from O6A's security-invariant requirement IDs to their adversarial
evidence — derived from the [requirement catalog](requirements.json), not from implementation
internals.

> **Reserved space stays out.** Per [ADR-0002](../../../docs/adr/0002-reserved-execution-continuity-semantics.md),
> this attacks the authority system OAAF publishes — never continuity, supersession, recovery, or
> execution fencing. "Freshness" as an execution-control concept is out of scope here.

## Evidence chain

```
normative security invariant   (requirements.json, security_invariant: true)
        |
static conformance vector      (corpus.json — the attack captured as a fixture)
        |
adversarial mutation test      (security.test.ts — a family of active attacks, fail-closed)
        |
TS result  +  Python result (Core/Status/Identity/PDP)  +  binding-equivalence
```

The adversarial suite ([security.test.ts](../../../packages/typescript/src/__tests__/security.test.ts))
runs **41 attacks** across the families below, each mutating a valid baseline toward the
attacker's goal and requiring a DENY. Where the corpus already proves an invariant with a static
vector, that vector is reused as evidence rather than duplicated.

## Attack families

### Authority widening

**Adversarial goal:** Add tools, broaden constraints, add/drop argument keys, raise or exceed delegation depth.

| Requirement       | Corpus vector(s)                                                                        | Adversarial evidence       | Languages   |
| ----------------- | --------------------------------------------------------------------------------------- | -------------------------- | ----------- |
| `CORE-NARROW-001` | `core-narrow-widening-tool`                                                             | attack: authority widening | TS + Python |
| `CORE-NARROW-002` | `core-narrow-constraint-widened`, `core-narrow-constraint-type-not-permitted`           | attack: authority widening | TS + Python |
| `CORE-NARROW-003` | `core-narrow-argument-key-set-mismatch`                                                 | attack: authority widening | TS + Python |
| `CORE-NARROW-004` | `core-narrow-constraint-type-not-permitted`, `core-narrow-constraint-type-unrecognized` | attack: authority widening | TS + Python |
| `CORE-DELEG-001`  | `core-deleg-ceiling-raised`                                                             | attack: authority widening | TS + Python |
| `CORE-DELEG-002`  | `core-deleg-depth-exceeded`                                                             | attack: authority widening | TS + Python |

### Constraint enforcement

**Adversarial goal:** Invoke outside the granted constraints — omit a required argument, violate a value, or call an unauthorized tool.

| Requirement       | Corpus vector(s)                                         | Adversarial evidence           | Languages   |
| ----------------- | -------------------------------------------------------- | ------------------------------ | ----------- |
| `CORE-CONSTR-001` | `core-constr-argument-missing`                           | attack: constraint enforcement | TS + Python |
| `CORE-CONSTR-002` | `core-constr-argument-violated`                          | attack: constraint enforcement | TS + Python |
| `CORE-CONSTR-003` | `core-constr-tool-not-authorized`, `core-allow-baseline` | attack: constraint enforcement | TS + Python |

### Chain integrity

**Adversarial goal:** Reorder, truncate, splice a foreign token, forge the parent hash, substitute the root.

| Requirement       | Corpus vector(s)                                                | Adversarial evidence    | Languages   |
| ----------------- | --------------------------------------------------------------- | ----------------------- | ----------- |
| `CORE-CHAIN-001`  | `core-chain-reordered`, `core-allow-baseline`                   | attack: chain integrity | TS + Python |
| `CORE-CHAIN-003`  | `core-chain-par-hash-missing`                                   | attack: chain integrity | TS + Python |
| `CORE-CRYPTO-003` | `core-crypto-issuer-thumbprint-mismatch`, `core-allow-baseline` | attack: chain integrity | TS + Python |

### Cryptography

**Adversarial goal:** Wrong signer, alg:none, private-key material, malformed/unrelated anchor, empty anchor set.

| Requirement       | Corpus vector(s)                                       | Adversarial evidence | Languages   |
| ----------------- | ------------------------------------------------------ | -------------------- | ----------- |
| `CORE-CRYPTO-001` | `core-crypto-invalid-signature`, `core-allow-baseline` | attack: cryptography | TS + Python |
| `CORE-CRYPTO-002` | `core-crypto-alg-none-rejected`                        | attack: cryptography | TS + Python |
| `CORE-CRYPTO-004` | `core-crypto-private-key-material`                     | attack: cryptography | TS + Python |
| `CORE-CRYPTO-005` | `core-pop-argument-binding-mismatch`                   | attack: cryptography | TS + Python |
| `CORE-TRUST-001`  | `core-trust-untrusted-root`                            | attack: cryptography | TS + Python |
| `CORE-TRUST-002`  | `core-trust-untrusted-root`                            | attack: cryptography | TS + Python |

### Proof of possession

**Adversarial goal:** Stolen token with wrong holder, forged PoP, altered request binding, missing PoP.

| Requirement    | Corpus vector(s)                                                 | Adversarial evidence        | Languages   |
| -------------- | ---------------------------------------------------------------- | --------------------------- | ----------- |
| `CORE-POP-001` | `core-pop-argument-binding-mismatch`, `core-pop-missing`         | attack: proof of possession | TS + Python |
| `CORE-POP-003` | `core-pop-holder-mismatch`, `core-pop-argument-binding-mismatch` | attack: proof of possession | TS + Python |

### Identity binding

**Adversarial goal:** Valid authority with a substituted subject; required binding unavailable; cross-issuer/URI confusion.

| Requirement | Corpus vector(s)                                        | Adversarial evidence         | Languages   |
| ----------- | ------------------------------------------------------- | ---------------------------- | ----------- |
| `IDENT-001` | `identity-allow-spiffe-bound`, `identity-deny-mismatch` | attack: identity binding     | TS + Python |
| `IDENT-002` | `identity-deny-unavailable`                             | attack: identity binding     | TS + Python |
| `IDENT-004` | —                                                       | by construction / inspection | TS + Python |
| `IDENT-005` | —                                                       | by construction / inspection | TS + Python |

### Recipient binding

**Adversarial goal:** Present a valid authority to an unintended MCP/A2A recipient.

| Requirement | Corpus vector(s)              | Adversarial evidence         | Languages |
| ----------- | ----------------------------- | ---------------------------- | --------- |
| `A2A-003`   | `a2a-deny-recipient-mismatch` | attack: recipient binding    | TS        |
| `A2A-004`   | —                             | by construction / inspection | TS        |

### Temporal validity

**Adversarial goal:** Expired, not-yet-valid, child outliving parent.

| Requirement     | Corpus vector(s)                  | Adversarial evidence      | Languages   |
| --------------- | --------------------------------- | ------------------------- | ----------- |
| `CORE-TIME-001` | `core-time-expired`               | attack: temporal validity | TS + Python |
| `CORE-TIME-003` | `core-time-expiry-exceeds-parent` | attack: temporal validity | TS + Python |

### Revocation / status

**Adversarial goal:** Revoked leaf, revoked ancestor (cascade), unknown status (fail closed), stale artifact.

| Requirement  | Corpus vector(s)               | Adversarial evidence         | Languages   |
| ------------ | ------------------------------ | ---------------------------- | ----------- |
| `STATUS-001` | `status-allow-active`          | attack: revocation/status    | TS + Python |
| `STATUS-002` | `status-deny-leaf-revoked`     | attack: revocation/status    | TS + Python |
| `STATUS-003` | `status-deny-unavailable`      | attack: revocation/status    | TS + Python |
| `STATUS-004` | `status-deny-ancestor-revoked` | attack: revocation/status    | TS + Python |
| `STATUS-005` | —                              | by construction / inspection | TS + Python |

### Transport equivalence

**Adversarial goal:** An attack denied through one binding cannot succeed through another.

| Requirement    | Corpus vector(s)                                         | Adversarial evidence          | Languages                |
| -------------- | -------------------------------------------------------- | ----------------------------- | ------------------------ |
| `CORE-DEC-004` | `equiv-allow-core`, `equiv-allow-mcp`                    | attack: transport equivalence | TS (binding-equivalence) |
| `MCP-001`      | `equiv-allow-mcp`, `equiv-widening-mcp`                  | attack: transport equivalence | TS                       |
| `A2A-001`      | `a2a-deny-extension-not-activated`                       | attack: transport equivalence | TS                       |
| `A2A-002`      | `a2a-deny-authority-material-missing`, `equiv-allow-a2a` | attack: transport equivalence | TS                       |

### PDP boundary

**Adversarial goal:** OAAF-valid authority does not bypass an organizational DENY.

| Requirement | Corpus vector(s)                                                        | Adversarial evidence         | Languages   |
| ----------- | ----------------------------------------------------------------------- | ---------------------------- | ----------- |
| `PDP-001`   | —                                                                       | by construction / inspection | TS + Python |
| `PDP-002`   | `pdp-allow-authority-context-verified`, `pdp-deny-no-authority-context` | attack: PDP boundary         | TS + Python |

### Privacy

**Adversarial goal:** Secret argument/credential/key material cannot leak through explanations or context.

| Requirement     | Corpus vector(s)                       | Adversarial evidence | Languages   |
| --------------- | -------------------------------------- | -------------------- | ----------- |
| `CORE-EXPL-003` | `core-expl-privacy-safe`               | attack: privacy      | TS + Python |
| `PDP-004`       | `pdp-allow-authority-context-verified` | attack: privacy      | TS + Python |

### Subject canonicalization

**Adversarial goal:** A subject cannot be forged independently of the signed grant.

| Requirement     | Corpus vector(s)                                           | Adversarial evidence     | Languages   |
| --------------- | ---------------------------------------------------------- | ------------------------ | ----------- |
| `CORE-SUBJ-001` | `core-allow-baseline`, `identity-allow-thumbprint-subject` | attack: identity binding | TS + Python |

### Fail-closed / parser robustness

**Adversarial goal:** Malformed, cyclic, oversized, or unverifiable inputs fail closed; no ALLOW by degradation.

| Requirement    | Corpus vector(s)       | Adversarial evidence         | Languages   |
| -------------- | ---------------------- | ---------------------------- | ----------- |
| `CORE-DEC-001` | `core-allow-baseline`  | attack: parser robustness    | TS + Python |
| `CORE-DEC-002` | `core-token-malformed` | attack: parser robustness    | TS + Python |
| `CORE-DEC-003` | —                      | by construction / inspection | TS + Python |
| `CORE-POP-002` | —                      | by construction / inspection | TS + Python |

## Completeness

All **44** security-invariant requirements are represented above and referenced by this
document. `npm run check:conformance` fails if any `security_invariant` requirement is missing
here. A few structural invariants (`CORE-POP-002` no-PoP-disable, `CORE-DEC-003` unrecognized
version, `IDENT-004/005`, `STATUS-005`, `A2A-004`) are certified by construction and inspection
rather than a data mutation, and are marked as such.

## Cross-language and binding scope

- **TypeScript** runs every family — it implements all six profiles.
- **Python** runs the families within the profiles it implements (Core, Status, Identity, PDP),
  via the same corpus deny vectors and the conformance runner. It does not implement MCP/A2A, so
  recipient-binding and cross-binding attacks are TS-only — and the conformance-class model makes
  that an explicit non-claim, not a hidden gap.
- **Binding equivalence is itself an attack surface:** the transport-equivalence family proves an
  attack denied on one binding is denied on the others, so an attacker cannot choose a weaker path.

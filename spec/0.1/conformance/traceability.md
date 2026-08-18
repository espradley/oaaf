# Traceability — requirements ↔ vectors

Regenerated from the corpus and the catalog; do not hand-edit the tables.

> Corpus: [vectors/corpus.json](vectors/corpus.json) (schema in [vectors/README.md](vectors/README.md)),
> executed by the [runner](runner.md). Coverage is enforced by `npm run check:conformance`
> (the O6B north star + O6D equivalence-group consistency).

## Corpus vectors → requirements (51 vectors)

| Vector                                      | Profile  | Eq. group      | Decision | Normative reason                | Requirements                                                                                                                                |
| ------------------------------------------- | -------- | -------------- | -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `core-narrow-widening-tool`                 | Core     | —              | deny     | `tool_not_delegated`            | `CORE-NARROW-001`, `CORE-EXPL-002`                                                                                                          |
| `core-narrow-constraint-widened`            | Core     | —              | deny     | `constraint_expansion`          | `CORE-NARROW-002`                                                                                                                           |
| `core-narrow-constraint-type-not-permitted` | Core     | —              | deny     | `constraint_type_not_permitted` | `CORE-NARROW-002`, `CORE-NARROW-004`                                                                                                        |
| `core-narrow-argument-key-set-mismatch`     | Core     | —              | deny     | `argument_key_set_mismatch`     | `CORE-NARROW-003`                                                                                                                           |
| `core-narrow-constraint-type-unrecognized`  | Core     | —              | deny     | `constraint_type_unrecognized`  | `CORE-NARROW-004`                                                                                                                           |
| `core-trust-untrusted-root`                 | Core     | —              | deny     | `untrusted_root`                | `CORE-TRUST-001`, `CORE-TRUST-002`                                                                                                          |
| `core-crypto-issuer-thumbprint-mismatch`    | Core     | —              | deny     | `issuer_thumbprint_mismatch`    | `CORE-CRYPTO-003`                                                                                                                           |
| `core-chain-par-hash-missing`               | Core     | —              | deny     | `par_hash_missing`              | `CORE-CHAIN-003`                                                                                                                            |
| `core-crypto-invalid-signature`             | Core     | —              | deny     | `invalid_signature`             | `CORE-CRYPTO-001`                                                                                                                           |
| `core-crypto-alg-none-rejected`             | Core     | —              | deny     | `algorithm_not_permitted`       | `CORE-CRYPTO-002`                                                                                                                           |
| `core-crypto-private-key-material`          | Core     | —              | deny     | `private_key_material`          | `CORE-CRYPTO-004`                                                                                                                           |
| `core-chain-reordered`                      | Core     | —              | deny     | `untrusted_root`                | `CORE-CHAIN-001`                                                                                                                            |
| `core-chain-empty`                          | Core     | —              | deny     | `chain_empty`                   | `CORE-CHAIN-002`                                                                                                                            |
| `core-token-malformed`                      | Core     | —              | deny     | `token_malformed`               | `CORE-DEC-002`                                                                                                                              |
| `core-pop-holder-mismatch`                  | Core     | —              | deny     | `pop_signature_invalid`         | `CORE-POP-003`                                                                                                                              |
| `core-pop-argument-binding-mismatch`        | Core     | —              | deny     | `pop_binding_mismatch`          | `CORE-POP-001`, `CORE-POP-003`, `CORE-CRYPTO-005`                                                                                           |
| `core-pop-signature-invalid`                | Core     | —              | deny     | `pop_signature_invalid`         | `CORE-POP-003`                                                                                                                              |
| `core-pop-missing`                          | Core     | —              | deny     | `pop_missing`                   | `CORE-POP-001`                                                                                                                              |
| `core-time-expired`                         | Core     | —              | deny     | `expired`                       | `CORE-TIME-001`                                                                                                                             |
| `core-time-not-yet-valid`                   | Core     | —              | deny     | `not_yet_valid`                 | `CORE-TIME-002`                                                                                                                             |
| `core-time-expiry-exceeds-parent`           | Core     | —              | deny     | `expiry_exceeds_parent`         | `CORE-TIME-003`                                                                                                                             |
| `core-deleg-ceiling-raised`                 | Core     | —              | deny     | `delegation_ceiling_raised`     | `CORE-DELEG-001`                                                                                                                            |
| `core-deleg-depth-exceeded`                 | Core     | —              | deny     | `delegation_depth_exceeded`     | `CORE-DELEG-002`                                                                                                                            |
| `core-constr-argument-missing`              | Core     | —              | deny     | `argument_missing`              | `CORE-CONSTR-001`                                                                                                                           |
| `core-constr-argument-violated`             | Core     | —              | deny     | `argument_constraint_violated`  | `CORE-CONSTR-002`                                                                                                                           |
| `core-constr-tool-not-authorized`           | Core     | —              | deny     | `tool_not_authorized`           | `CORE-CONSTR-003`, `CORE-EXPL-001`                                                                                                          |
| `core-expl-privacy-safe`                    | Core     | —              | deny     | `argument_constraint_violated`  | `CORE-EXPL-003`                                                                                                                             |
| `core-allow-baseline`                       | Core     | —              | allow    | `—`                             | `CORE-CRYPTO-001`, `CORE-CHAIN-001`, `CORE-CRYPTO-003`, `CORE-POP-001`, `CORE-CONSTR-003`, `CORE-SUBJ-001`, `CORE-DEC-001`, `CORE-EXPL-001` |
| `status-allow-active`                       | Status   | —              | allow    | `—`                             | `STATUS-001`, `STATUS-006`                                                                                                                  |
| `status-deny-leaf-revoked`                  | Status   | —              | deny     | `authority_revoked`             | `STATUS-002`                                                                                                                                |
| `status-deny-ancestor-revoked`              | Status   | —              | deny     | `authority_revoked`             | `STATUS-004`                                                                                                                                |
| `status-deny-unavailable`                   | Status   | —              | deny     | `status_unavailable`            | `STATUS-003`                                                                                                                                |
| `identity-allow-thumbprint-subject`         | Core     | —              | allow    | `—`                             | `CORE-SUBJ-001`, `CORE-SUBJ-002`                                                                                                            |
| `identity-allow-spiffe-bound`               | Identity | —              | allow    | `—`                             | `CORE-SUBJ-001`, `IDENT-001`                                                                                                                |
| `identity-allow-spiffe-issuer-asserted`     | Core     | —              | allow    | `—`                             | `IDENT-003`                                                                                                                                 |
| `identity-deny-mismatch`                    | Identity | —              | deny     | `subject_identity_mismatch`     | `IDENT-001`                                                                                                                                 |
| `identity-deny-unavailable`                 | Identity | —              | deny     | `identity_binding_unavailable`  | `IDENT-002`                                                                                                                                 |
| `a2a-deny-recipient-mismatch`               | A2A      | —              | deny     | `pop_recipient_mismatch`        | `A2A-003`                                                                                                                                   |
| `a2a-deny-extension-not-activated`          | A2A      | —              | deny     | `extension_not_activated`       | `A2A-001`                                                                                                                                   |
| `a2a-deny-authority-material-missing`       | A2A      | —              | deny     | `authority_material_missing`    | `A2A-002`                                                                                                                                   |
| `equiv-allow-core`                          | Core     | equiv-allow    | allow    | `—`                             | `CORE-DEC-004`                                                                                                                              |
| `equiv-allow-mcp`                           | MCP      | equiv-allow    | allow    | `—`                             | `CORE-DEC-004`, `MCP-001`                                                                                                                   |
| `equiv-allow-a2a`                           | A2A      | equiv-allow    | allow    | `—`                             | `CORE-DEC-004`, `A2A-002`                                                                                                                   |
| `equiv-widening-core`                       | Core     | equiv-widening | deny     | `tool_not_delegated`            | `CORE-DEC-004`                                                                                                                              |
| `equiv-widening-mcp`                        | MCP      | equiv-widening | deny     | `tool_not_delegated`            | `CORE-DEC-004`, `MCP-001`                                                                                                                   |
| `equiv-widening-a2a`                        | A2A      | equiv-widening | deny     | `tool_not_delegated`            | `CORE-DEC-004`, `A2A-002`                                                                                                                   |
| `equiv-expired-core`                        | Core     | equiv-expired  | deny     | `expired`                       | `CORE-DEC-004`                                                                                                                              |
| `equiv-expired-mcp`                         | MCP      | equiv-expired  | deny     | `expired`                       | `CORE-DEC-004`, `MCP-001`                                                                                                                   |
| `equiv-expired-a2a`                         | A2A      | equiv-expired  | deny     | `expired`                       | `CORE-DEC-004`, `A2A-002`                                                                                                                   |
| `pdp-allow-authority-context-verified`      | PDP      | —              | allow    | `—`                             | `PDP-002`, `PDP-004`                                                                                                                        |
| `pdp-deny-no-authority-context`             | PDP      | —              | deny     | `tool_not_delegated`            | `PDP-002`                                                                                                                                   |

## Transport equivalence (CORE-DEC-004)

Each group runs an identical authority input through multiple bindings and must reach the
same normative outcome. The guard rejects a group that disagrees or spans only one profile.

| Group            | Bindings     | Outcome                   |
| ---------------- | ------------ | ------------------------- |
| `equiv-allow`    | A2A/Core/MCP | allow                     |
| `equiv-widening` | A2A/Core/MCP | deny `tool_not_delegated` |
| `equiv-expired`  | A2A/Core/MCP | deny `expired`            |

## Requirements → coverage

**V** = ≥1 portable vector. **D** = design/structural (inspection or an API/impl check). **G** = open gap.

| Requirement        | Class    | Sec. | Kind | Covered by / note                                                                              |
| ------------------ | -------- | ---- | ---- | ---------------------------------------------------------------------------------------------- |
| `CORE-TRUST-001`   | Core     | ●    | V    | `core-trust-untrusted-root`                                                                    |
| `CORE-TRUST-002`   | Core     | ●    | V    | `core-trust-untrusted-root`                                                                    |
| `CORE-CRYPTO-001`  | Core     | ●    | V    | `core-crypto-invalid-signature`, `core-allow-baseline`                                         |
| `CORE-CRYPTO-002`  | Core     | ●    | V    | `core-crypto-alg-none-rejected`                                                                |
| `CORE-CRYPTO-003`  | Core     | ●    | V    | `core-crypto-issuer-thumbprint-mismatch`, `core-allow-baseline`                                |
| `CORE-CRYPTO-004`  | Core     | ●    | V    | `core-crypto-private-key-material`                                                             |
| `CORE-CRYPTO-005`  | Core     | ·    | V    | `core-pop-argument-binding-mismatch`                                                           |
| `CORE-CHAIN-001`   | Core     | ●    | V    | `core-chain-reordered`, `core-allow-baseline`                                                  |
| `CORE-CHAIN-002`   | Core     | ·    | V    | `core-chain-empty`                                                                             |
| `CORE-CHAIN-003`   | Core     | ●    | V    | `core-chain-par-hash-missing`                                                                  |
| `CORE-DELEG-001`   | Core     | ●    | V    | `core-deleg-ceiling-raised`                                                                    |
| `CORE-DELEG-002`   | Core     | ●    | V    | `core-deleg-depth-exceeded`                                                                    |
| `CORE-NARROW-001`  | Core     | ●    | V    | `core-narrow-widening-tool`                                                                    |
| `CORE-NARROW-002`  | Core     | ●    | V    | `core-narrow-constraint-widened`, `core-narrow-constraint-type-not-permitted`                  |
| `CORE-NARROW-003`  | Core     | ●    | V    | `core-narrow-argument-key-set-mismatch`                                                        |
| `CORE-NARROW-004`  | Core     | ●    | V    | `core-narrow-constraint-type-not-permitted`, `core-narrow-constraint-type-unrecognized`        |
| `CORE-CONSTR-001`  | Core     | ●    | V    | `core-constr-argument-missing`                                                                 |
| `CORE-CONSTR-002`  | Core     | ●    | V    | `core-constr-argument-violated`                                                                |
| `CORE-CONSTR-003`  | Core     | ●    | V    | `core-constr-tool-not-authorized`, `core-allow-baseline`                                       |
| `CORE-CONSTR-004`  | Core     | ·    | G    | open gap                                                                                       |
| `CORE-TIME-001`    | Core     | ●    | V    | `core-time-expired`                                                                            |
| `CORE-TIME-002`    | Core     | ·    | V    | `core-time-not-yet-valid`                                                                      |
| `CORE-TIME-003`    | Core     | ●    | V    | `core-time-expiry-exceeds-parent`                                                              |
| `CORE-POP-001`     | Core     | ●    | V    | `core-pop-argument-binding-mismatch`, `core-pop-missing`, `core-allow-baseline`                |
| `CORE-POP-002`     | Core     | ●    | D    | design/structural — certified by inspection                                                    |
| `CORE-POP-003`     | Core     | ●    | V    | `core-pop-holder-mismatch`, `core-pop-argument-binding-mismatch`, `core-pop-signature-invalid` |
| `CORE-POP-004`     | Core     | ·    | D    | design/structural — certified by inspection                                                    |
| `CORE-SUBJ-001`    | Core     | ·    | V    | `core-allow-baseline`, `identity-allow-thumbprint-subject`, `identity-allow-spiffe-bound`      |
| `CORE-SUBJ-002`    | Core     | ·    | V    | `identity-allow-thumbprint-subject`                                                            |
| `CORE-DEC-001`     | Core     | ●    | V    | `core-allow-baseline`                                                                          |
| `CORE-DEC-002`     | Core     | ●    | V    | `core-token-malformed`                                                                         |
| `CORE-DEC-003`     | Core     | ●    | D    | design/structural — certified by inspection                                                    |
| `CORE-DEC-004`     | Core     | ●    | V    | `equiv-allow-core`, `equiv-allow-mcp`, `equiv-allow-a2a`…                                      |
| `CORE-EXPL-001`    | Core     | ·    | V    | `core-constr-tool-not-authorized`, `core-allow-baseline`                                       |
| `CORE-EXPL-002`    | Core     | ·    | V    | `core-narrow-widening-tool`                                                                    |
| `CORE-EXPL-003`    | Core     | ●    | V    | `core-expl-privacy-safe`                                                                       |
| `CORE-EXPL-004`    | Core     | ·    | D    | design/structural — certified by inspection                                                    |
| `CORE-NEUTRAL-001` | Core     | ·    | D    | design/structural — certified by inspection                                                    |
| `CORE-NEUTRAL-002` | Core     | ·    | D    | design/structural — certified by inspection                                                    |
| `CORE-NEUTRAL-003` | Core     | ·    | D    | design/structural — certified by inspection                                                    |
| `CORE-NEUTRAL-004` | Core     | ·    | D    | design/structural — certified by inspection                                                    |
| `CORE-NEUTRAL-005` | Core     | ·    | D    | design/structural — certified by inspection                                                    |
| `STATUS-001`       | Status   | ●    | V    | `status-allow-active`                                                                          |
| `STATUS-002`       | Status   | ●    | V    | `status-deny-leaf-revoked`                                                                     |
| `STATUS-003`       | Status   | ●    | V    | `status-deny-unavailable`                                                                      |
| `STATUS-004`       | Status   | ●    | V    | `status-deny-ancestor-revoked`                                                                 |
| `STATUS-005`       | Status   | ●    | D    | design/structural — certified by inspection                                                    |
| `STATUS-006`       | Status   | ·    | V    | `status-allow-active`                                                                          |
| `IDENT-001`        | Identity | ●    | V    | `identity-allow-spiffe-bound`, `identity-deny-mismatch`                                        |
| `IDENT-002`        | Identity | ●    | V    | `identity-deny-unavailable`                                                                    |
| `IDENT-003`        | Identity | ·    | V    | `identity-allow-spiffe-issuer-asserted`                                                        |
| `IDENT-004`        | Identity | ●    | D    | design/structural — certified by inspection                                                    |
| `IDENT-005`        | Identity | ●    | D    | design/structural — certified by inspection                                                    |
| `MCP-001`          | MCP      | ●    | V    | `equiv-allow-mcp`, `equiv-widening-mcp`, `equiv-expired-mcp`                                   |
| `MCP-002`          | MCP      | ·    | D    | design/structural — certified by inspection                                                    |
| `MCP-003`          | MCP      | ·    | D    | design/structural — certified by inspection                                                    |
| `A2A-001`          | A2A      | ●    | V    | `a2a-deny-extension-not-activated`                                                             |
| `A2A-002`          | A2A      | ●    | V    | `a2a-deny-authority-material-missing`, `equiv-allow-a2a`, `equiv-widening-a2a`…                |
| `A2A-003`          | A2A      | ●    | V    | `a2a-deny-recipient-mismatch`                                                                  |
| `A2A-004`          | A2A      | ●    | D    | design/structural — certified by inspection                                                    |
| `PDP-001`          | PDP      | ●    | D    | design/structural — certified by inspection                                                    |
| `PDP-002`          | PDP      | ●    | V    | `pdp-allow-authority-context-verified`, `pdp-deny-no-authority-context`                        |
| `PDP-003`          | PDP      | ·    | D    | design/structural — certified by inspection                                                    |
| `PDP-004`          | PDP      | ●    | V    | `pdp-allow-authority-context-verified`                                                         |

## Coverage summary

- Requirements with ≥1 portable vector: **46**
- Design/structural (inspection): **17**
- Open gaps: **1** — `CORE-CONSTR-004`

**North star:** of 27 Core security invariants, 25 have a portable vector
and 2 are design-only. Every Core security invariant that can be a static vector
has one — enforced in CI.

## Remaining gaps

- `CORE-CONSTR-004` — A request carrying an argument the leaf authority does not permit for the tool MUST deny. In the closed-world argument model this denies as `token_malformed`; a distinct `argument_not_permitted` vector is a later corpus-growth candidate, not a conformance blocker.

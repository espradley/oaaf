# Portable conformance corpus

`corpus.json` is a **language-neutral** set of static conformance vectors (O6B). An
independent implementation consumes it **without importing any OAAF code**: verify the signed
tokens with your own crypto, apply the resolver/verifier inputs, and check the decision and
normative reason against what each vector declares.

It is the raw material for a future `oaaf conform` runner. The schema below carries **no
TypeScript or Python object shapes** — it is snake_case JSON and nothing else.

> The 18 original shared vectors are the ancestor of this corpus; O6B extended them into a
> requirement-tagged corpus that materially covers the security-relevant Core requirements.
> This is not yet frozen — O6C runs it across implementations, and O6H owns the v1 freeze.

## File shape

```jsonc
{
  "corpus_version": "0.1",
  "spec_version": "0.1",
  "generated_for_now": 1780000000, // the evaluation epoch the fixtures were minted against
  "vectors": [/* … */],
}
```

## Vector schema

Each vector is an object with these fields. The first seven are the **normative contract**;
`reference` is advisory.

| Field                       | Type               | Meaning                                                                                                                                                                                                                                       |
| --------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vector_id`                 | string             | Stable, unique identifier.                                                                                                                                                                                                                    |
| `requirements`              | string[]           | The [O6A requirement IDs](../requirements.json) this vector exercises (`CORE-NARROW-001`, …).                                                                                                                                                 |
| `profile`                   | string             | The conformance class: `Core`, `Status`, `Identity`, `MCP`, `A2A`, or `PDP`.                                                                                                                                                                  |
| `expected_decision`         | `"allow"`/`"deny"` | The required outcome.                                                                                                                                                                                                                         |
| `expected_normative_reason` | string \| null     | For a deny, the normative reason code the failed check produces; `null` for an allow.                                                                                                                                                         |
| `input`                     | object             | The input artifacts (below).                                                                                                                                                                                                                  |
| `notes`                     | string             | Human explanation of what the vector proves.                                                                                                                                                                                                  |
| `reference`                 | object             | **Advisory** — the reference implementation's full `DecisionExplanation` (decision, reasons with non-normative stage/locators/message, and authority summary). Useful for a stronger regression check; **not** part of the portable contract. |

### `input`

| Field                            | Type     | Profile  | Meaning                                                                           |
| -------------------------------- | -------- | -------- | --------------------------------------------------------------------------------- |
| `tokens`                         | string[] | all      | The AAT delegation chain, root first, as compact JWS strings.                     |
| `trust_anchors`                  | object[] | all      | Public JWKs trusted as root issuers. An empty array means "no anchor configured." |
| `pop`                            | string   | all      | The proof-of-possession JWS (empty string = none presented).                      |
| `tool`                           | string   | all      | The requested tool / operation.                                                   |
| `args`                           | object   | all      | The requested arguments (names → values).                                         |
| `now`                            | number   | all      | The evaluation instant (seconds since epoch).                                     |
| `revoked_jti`                    | string[] | Status   | `jti`s a status resolver reports as revoked.                                      |
| `unknown_jti`                    | string[] | Status   | `jti`s a status resolver reports as unknown (fail-closed).                        |
| `bound_subjects`                 | string[] | Identity | subjects an identity-binding verifier reports as bound.                           |
| `unavailable_subjects`           | string[] | Identity | subjects the verifier reports as unavailable (fail-closed).                       |
| `recipient`                      | string   | A2A      | This agent's stable A2A identity (for `aat_aud` recipient binding).               |
| `a2a_extension_activated`        | boolean  | A2A      | Whether the client activated the required OAAF extension.                         |
| `a2a_authority_material_present` | boolean  | A2A      | Whether the incoming message carried OAAF authority material.                     |

The Status/Identity/A2A fields appear only on vectors of that profile. A `Core` vector has
none of them.

## How to consume it

1. **Filter by the profiles you implement.** A `Core`-only implementation runs the `Core`
   vectors; add `Status`/`Identity`/`A2A`/`PDP` vectors only for the profiles you claim. (The
   OAAF Python implementation, for instance, runs Core + Status + Identity and skips A2A — it
   does not claim the A2A profile.)
2. **Reconstruct the decision** from `input` using your own verifier: verify each token's
   signature, enforce the chain/attenuation/PoP/expiry rules, and apply the resolver/verifier
   inputs where present.
3. **Assert** your `decision` equals `expected_decision` and, for a deny, that the reason you
   produce for the failed check equals `expected_normative_reason`. Reason-code granularity
   beyond the normative set, stage labels, and message wording are **not** compared (see the
   [classification](../classification.md)).
4. **Privacy vectors** (tagged `CORE-EXPL-003`) additionally require that no argument value
   from `input.args` appears anywhere in your serialized decision output.

## Regenerating

The corpus is produced by [`scripts/gen-conformance-corpus.mjs`](../../../../scripts/gen-conformance-corpus.mjs)
(`npm run gen:corpus`). Generation is **self-validating**: each vector's declared intent is
checked against the reference, so a wrong expectation fails the build. The committed
`corpus.json` is prettier-ignored because it is generated, signed material.

## Coverage

Which requirements the corpus covers, and the remaining gaps, are tracked in
[../traceability.md](../traceability.md), and enforced by
[`scripts/check-conformance-spec.mjs`](../../../../scripts/check-conformance-spec.mjs): every
Core security-invariant requirement that can be expressed as a static vector MUST have at
least one.

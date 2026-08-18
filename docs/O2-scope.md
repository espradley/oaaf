# O2 Scope — First standards-based enforcement path

- **Status:** Proposed. Not approved, not implemented.
- **Date:** 2026-08-18

**Canonical question.** Given a delegated authority token conforming to
`draft-niyikiza-oauth-attenuating-agent-tokens-01`, can OAAF verify the chain, map the
requested action into an AuthZEN-compatible authorization request and decision, and
return a developer-understandable result — without introducing a new wire format?

**Answer from the source reading: yes, with one substantive design decision that must be
made deliberately.** AAT and AuthZEN do not share an information model. Bridging them
requires a _mapping profile_. No new wire field is required, and nothing new goes on the
wire — but the mapping is a normative choice and belongs in an RFC, not in an
implementation detail.

## 1. Normative requirements from AAT -01 relevant to O2

**Pinned revision:** `draft-niyikiza-oauth-attenuating-agent-tokens-01`, 15 June 2026,
expires 17 December 2026. Individual submission, Standards Track intent, no working
group.

### Token claims

| Claim                   | Presence     | Notes                                                                       |
| ----------------------- | ------------ | --------------------------------------------------------------------------- |
| `jti`                   | REQUIRED     | Unique token identifier; used for cycle detection                           |
| `iss`                   | REQUIRED     | Root: issuer URI. Derived: JWK thumbprint URI of parent's `cnf.jwk`         |
| `iat` / `exp`           | REQUIRED     | NumericDate                                                                 |
| `cnf`                   | REQUIRED     | Object with `jwk` member — holder's public key                              |
| `del_depth`             | REQUIRED     | Root MUST be 0                                                              |
| `del_max_depth`         | REQUIRED     | Ceiling for the chain                                                       |
| `authorization_details` | REQUIRED     | Exactly one entry of type `attenuating_agent_token`, carrying a `tools` map |
| `par_hash`              | Derived only | base64url-nopad SHA-256 of parent's signing input. MUST be absent on root   |
| `sub`                   | **Absent**   | Intentionally omitted by the draft. Consequential — see §2                  |

`tools` maps a tool name to an argument-constraint set. `{}` authorizes the tool
unconstrained.

### Verifier algorithm (eight steps, all MUST)

1. Empty chain → DENY.
2. Enforce token size limits; detect token-instance cycles by `jti`.
3. Root checks: `del_depth == 0`, `par_hash` absent, `exp > now`,
   `iat <= now + MAX_IAT_SKEW`, exactly one `attenuating_agent_token` entry.
4. For each adjacent parent→child pair:
   - child signature verifies under `parent.cnf.jwk`
   - `child.iss == jwk_thumbprint_uri(parent.cnf.jwk)`
   - `child.del_depth == parent.del_depth + 1`
   - `child.del_depth <= parent.del_max_depth`
   - `child.exp <= parent.exp`
   - `child.iat >= parent.iat`
   - capability monotonicity: `tools(child) ⊆ tools(parent)`
   - constraint subsumption per §4.5
   - `child.par_hash == base64url-nopad(SHA-256(parent signing input))`
5. Chain-level validity.
6. Leaf: requested tool present in leaf `tools`. **Closed-world argument mode** — if the
   tool's constraint map is non-empty and a supplied argument name is absent from it,
   DENY.
7. PoP: signature verifies under leaf `cnf.jwk`; `aat_id == leaf.jti`;
   `aat_tool ==` invoked tool; `hta` JCS-canonicalized byte-equal to the JCS-canonical
   args map.
8. Decision.

### Cryptography

- Ed25519 signing/verification MUST be supported; other algorithms MAY be.
- `alg: "none"` MUST be rejected.
- Algorithm/key-type consistency MUST be enforced — `EdDSA` verifies only against an OKP
  key with `crv` of `Ed25519` or `Ed448`. This is the algorithm-confusion defence and is
  a test case, not a footnote.
- PoP payload MUST be JCS-canonical (RFC 8785) before signing.

### Constraint types and subsumption

`exact` · `range` · `one_of` · `not_one_of` · `contains` · `subset` · `wildcard` ·
`all` · `any`.

Derived constraints MUST be at least as restrictive: `range` bounds tighten, `one_of`
narrows to a subset, `not_one_of` grows to a superset, `all` preserves every parent
clause and may add more, `any` requires every derived clause to be subsumed by some
parent clause.

**Any (parent type, derived type) pair not explicitly permitted MUST be rejected.** The
subsumption matrix is closed-world. This is the highest-risk implementation surface in
O2 and deserves exhaustive pairwise tests.

### Explicitly not mitigated by AAT -01

Revocation (§8.9), stateful `jti` replay tracking, requester-identity mapping, transport
binding. O2 inherits these as non-goals and must document them rather than quietly
paper over them.

## 2. AuthZEN mapping — and the one design decision

**AuthZEN Authorization API 1.0**, published Standards Track, March 2026.

Request: `subject` (REQUIRED `type`, `id`; OPTIONAL `properties`), `action` (REQUIRED
`name`; OPTIONAL `properties`), `resource` (REQUIRED `type`, `id`; OPTIONAL
`properties`), `context` (OPTIONAL). Response: `decision` (REQUIRED **boolean**),
`context` (OPTIONAL — reasons, obligations, advice).

### The impedance mismatch

AAT is **tool + arguments**. AuthZEN is **subject + action + resource**. They do not
correspond:

| AuthZEN requires                | AAT provides                                                        |
| ------------------------------- | ------------------------------------------------------------------- |
| `subject.id`                    | Nothing. `sub` is intentionally omitted                             |
| `resource.type` / `resource.id` | Nothing. Resources are expressed as _argument constraints on tools_ |
| `action.name`                   | Tool name — clean match                                             |

So OAAF must synthesize a subject and a resource. **Flagging this per instruction before
inventing anything.** Two mitigating facts: no new wire field is required — this is a
local mapping into an existing standard's request shape — and the subject value is
available from AAT-native material rather than invented.

### Proposed mapping

| Element             | Source                                          | Treatment                                                                                            |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `subject.type`      | `"agent"`                                       | PROFILE                                                                                              |
| `subject.id`        | JWK thumbprint URI of leaf `cnf.jwk`            | PROFILE — AAT already uses this exact form as derived-token `iss`, so it is AAT-native, not invented |
| `action.name`       | AAT tool name                                   | ADOPT                                                                                                |
| `action.properties` | Tool arguments                                  | PROFILE                                                                                              |
| `resource`          | See below                                       | **Decision required**                                                                                |
| `context`           | Chain metadata: depth, leaf `jti`, chain length | PROFILE                                                                                              |
| `decision`          | Boolean from verification                       | ADOPT                                                                                                |
| `context.reason*`   | OAAF reason code + message                      | PROFILE — AuthZEN explicitly reserves `context` for reasons                                          |

**Resource — two options.**

_R1 (recommended for O2):_ `resource = { type: "tool", id: <toolName> }`. Honest about
the fact that AAT has no resource concept. Degenerate — resource duplicates action — but
faithful, requires no configuration, and never misrepresents authority.

_R2 (defer to O3):_ designate a resource-bearing argument per tool, so `read_file` with
`path` maps to `resource = { type: "file", id: "/data/q3.pdf" }`. More useful and more
AuthZEN-idiomatic, but requires per-tool configuration that AAT does not carry — meaning
two deployments could map the same token differently. That is an interoperability
hazard and needs an RFC.

Recommendation: implement R1 in O2; open an RFC for R2 alongside the MCP binding, where
real tool metadata exists to inform it.

### Mapping table (requested format)

| OAAF implementation need | Standard source     | Exact construct                                             | O2 treatment                      |
| ------------------------ | ------------------- | ----------------------------------------------------------- | --------------------------------- |
| Delegated authority      | AAT -01             | `authorization_details[type=attenuating_agent_token].tools` | ADOPT                             |
| Parent binding           | AAT -01             | `par_hash`, `iss` = parent JWK thumbprint URI               | ADOPT                             |
| Delegation depth         | AAT -01             | `del_depth`, `del_max_depth`                                | ADOPT                             |
| Capability narrowing     | AAT -01 §4.5        | `tools(child) ⊆ tools(parent)`                              | ADOPT                             |
| Constraint narrowing     | AAT -01 §4.5        | subsumption matrix                                          | ADOPT                             |
| Validity window          | AAT -01             | `iat`, `exp`, `MAX_IAT_SKEW`                                | ADOPT                             |
| Request binding          | AAT -01             | PoP JWT `aat_id`, `aat_tool`, `hta` + JCS                   | ADOPT                             |
| Holder key               | AAT -01             | `cnf.jwk`                                                   | ADOPT                             |
| Signing                  | AAT -01             | Ed25519 / EdDSA, reject `alg:none`                          | ADOPT                             |
| Canonicalization         | RFC 8785            | JCS                                                         | ADOPT                             |
| Thumbprint URI           | RFC 9278 / RFC 7638 | `urn:ietf:params:oauth:jwk-thumbprint:sha-256:…`            | ADOPT                             |
| Authorization request    | AuthZEN 1.0         | subject / action / resource / context                       | ADOPT                             |
| Decision                 | AuthZEN 1.0         | `decision` boolean                                          | ADOPT                             |
| Decision reasons         | AuthZEN 1.0         | response `context`                                          | ADOPT container, PROFILE contents |
| Subject synthesis        | —                   | JWK thumbprint URI as `subject.id`                          | **PROFILE — flagged**             |
| Resource synthesis       | —                   | R1 tool-as-resource                                         | **PROFILE — flagged**             |
| Developer explanation    | OAAF                | local presentation layer                                    | Implementation                    |

Nothing requires an INVENT.

## 3. Package and file structure

```text
packages/typescript/src/
  index.ts                    public surface
  aat/
    claims.ts                 AAT -01 claim types
    constraints.ts            constraint types + subsumption matrix
    verify.ts                 eight-step chain verification
    pop.ts                    PoP JWT verification, JCS binding
  authzen/
    types.ts                  AuthZEN 1.0 request/response types
    map.ts                    verified chain + request -> AuthZEN request
  decide.ts                   orchestration
  reasons.ts                  reason codes, one per failure point
  explain.ts                  human-readable rendering
tests/
  fixtures/aat-01/            signed chains, reusable by O3 and O6
  conformance/               stage-level assertions
  adversarial/               forgery, expansion, replay, confusion
```

Fixtures live under a revision-named directory from day one so that AAT -02 fixtures sit
beside -01 rather than replacing them.

## 4. Public API — recommendation and rejected alternatives

**Shape A — one call.** `oaaf.verifyAndEvaluate({ chain, pop, tool, args })`.
Minimal ceremony; matches the sketch. Rejected as the _only_ surface: it fuses two
independently useful operations, forces MCP and A2A bindings to re-enter through the
front door, and gives the conformance suite nothing to assert against but a final
boolean.

**Shape B — AuthZEN-first.** `oaaf.evaluate(accessEvaluationRequest, { chain, pop })`.
Highest standards fidelity and drop-in for anyone already speaking AuthZEN. Rejected as
primary: the caller must construct the AuthZEN request before OAAF has verified the
chain, which inverts the dependency — subject and resource are _derived from_ the
verified leaf.

**Shape C — two stages plus sugar (recommended).**

```ts
const chain = await oaaf.verifyChain({ tokens, pop, tool, args, now? });
const decision = oaaf.evaluate(chain, { tool, args });
// sugar over both:
const result = await oaaf.verifyAndEvaluate({ tokens, pop, tool, args });
```

Chosen against the stated criteria: minimal ceremony via the sugar; fidelity because
each stage owns one standard; MCP/A2A reuse because a binding calls `verifyChain` once
per request and can cache; testability because the conformance suite asserts on
verification stages rather than a fused result; explainability because failures carry the
stage that produced them.

The example in the kickoff is not frozen. Two likely departures: `token` becomes
`tokens` (AAT is a chain, not a token), and `pop` is required — see below.

**Open decision — is PoP mandatory?** AAT step 7 requires it, and without it the leaf
holder is not proven. Recommendation: **required by default**, with an explicit
`chainOnly: true` mode that is documented as _not_ full AAT enforcement and refuses to
run outside tests. Making PoP optional silently would ship a verifier that looks
conformant and is not.

## 5. Dependencies

Verified empirically, not from memory.

| Package        | Version | License    | Why                                                                            |
| -------------- | ------- | ---------- | ------------------------------------------------------------------------------ |
| `jose`         | 6.2.9   | MIT        | JWS/JWT, EdDSA, `calculateJwkThumbprintUri`, `importJWK`. Zero transitive deps |
| `canonicalize` | 4.0.0   | Apache-2.0 | RFC 8785 JCS. ESM-only, ships types — matches our ESM package                  |

Confirmed by execution: Ed25519 keygen → sign → verify round-trips under `jose`;
`alg` reports `EdDSA`; JWK is `OKP`/`Ed25519`; thumbprint URI emits
`urn:ietf:params:oauth:jwk-thumbprint:sha-256:…`, byte-matching AAT's derived-token
`iss` form. `canonicalize` sorts keys and handles non-ASCII correctly.

`npm audit`: **0 vulnerabilities.** Total install: 3 packages including root. No
hand-rolled cryptography — all signature and thumbprint operations go through `jose`.

## 6. Test matrix

Structured as conformance stages so it can migrate into the O6 suite unchanged.

**Structural** — empty chain · oversized token · `jti` cycle · missing required claim ·
more than one `attenuating_agent_token` entry · `par_hash` present on root · `par_hash`
absent on derived.

**Cryptographic** — valid root · invalid signature · `alg: "none"` · algorithm
confusion (EdDSA header against non-OKP key) · wrong parent key · `iss` not equal to
parent thumbprint URI.

**Temporal** — expired · `iat` beyond skew · `child.exp > parent.exp` ·
`child.iat < parent.iat` · clock-skew boundary.

**Depth** — `del_depth != parent + 1` · `del_depth > del_max_depth` · root
`del_depth != 0` · valid one-hop · valid multi-hop (three links, confirmed supported by
`del_max_depth`).

**Narrowing** — tool-set expansion · every permitted constraint-subsumption pair ·
representative violations per type (`range` widening, `one_of` superset, `not_one_of`
shrinking, `all` dropping a clause, `any` unsubsumed clause) · unrecognized constraint
type MUST reject · disallowed parent/derived type pair MUST reject.

**Leaf and request** — tool absent from leaf · closed-world unknown argument ·
argument violating constraint · valid authorized request.

**PoP** — valid · bad signature · `aat_id` mismatch · `aat_tool` mismatch · `hta`
mismatch after canonicalization · `hta` key-order variation MUST still match (canonical
equality, not textual).

**Mapping** — deterministic AuthZEN request for identical input · decision boolean
correct in both directions · reason code present on every deny path.

Every deny test asserts a _specific_ reason code. A test that only asserts "denied"
would pass against a verifier that denies everything.

## 7. Reason codes

AAT -01 defines no error codes — it specifies a uniform DENY. Reason codes are therefore
OAAF's, and each must correspond to exactly one normative check so the vocabulary is
traceable rather than invented.

Corrections to the draft list in the kickoff, now that the source has been read:

| Proposed                   | Status                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `invalid_signature`        | Keep                                                                                                                           |
| `expired`                  | Keep; add `not_yet_valid` for `iat` skew                                                                                       |
| `parent_binding_invalid`   | Split — `par_hash_mismatch`, `issuer_thumbprint_mismatch`                                                                      |
| `delegation_depth_invalid` | Keep                                                                                                                           |
| `capability_not_delegated` | Rename `tool_not_delegated` — AAT's unit is a tool                                                                             |
| `constraint_expansion`     | Keep; add `constraint_type_not_permitted`, `constraint_type_unrecognized`                                                      |
| `resource_not_authorized`  | **Drop.** AAT has no resource concept. Replace with `argument_constraint_violated` and `argument_not_permitted` (closed-world) |

Plus: `chain_empty`, `chain_cycle_detected`, `token_too_large`, `algorithm_not_permitted`,
`pop_signature_invalid`, `pop_binding_mismatch`, `tool_not_authorized`.

## 8. Golden-path demo

A single file, no network, no service. Generate a root token authorizing `read_file`
constrained to two paths; derive a child narrowing to one path; verify; then attempt the
excluded path and print the explanation. Runs under `npm run demo` in seconds.

The demo doubles as the README quickstart, so the ten-minute claim is continuously
tested rather than asserted.

## 9. Out of scope

Hosted authority service · database · account system · token issuer beyond test fixtures
and demo helpers · MCP binding · A2A binding · generic IAM integration · policy language
· UI · DigitalStack adapter · revocation infrastructure · reserved execution-continuity
semantics · proprietary recovery or fencing logic · R2 resource mapping · HTTP transport
· published npm release.

## 10. Risks of implementing an Internet-Draft

1. **Expiry inside the delivery window.** -01 expires **17 December 2026**, roughly four
   months out. It may lapse, be replaced, or be withdrawn while O2 is in flight.
   _Mitigation:_ pin the revision in code and docs, keep the verifier behind a stable
   internal interface, and treat AAT support as one adapter rather than the architecture.
2. **Individual submission, no working group.** No adoption guarantee.
   _Mitigation:_ Shape C already isolates AAT behind `verifyChain`; a different
   delegation format becomes a sibling module, not a rewrite.
3. **Sole implementation risk.** If OAAF is the only implementation, "conformance" is
   self-referential. _Mitigation:_ publish fixtures as the durable artifact — they retain
   value even if our verifier is replaced.
4. **Subsumption matrix ambiguity.** A closed-world type matrix has many pairs; the draft
   may be under-specified at edges. _Mitigation:_ fail closed on any unlisted pair, log
   the pair, and file the ambiguity upstream — early substantive feedback to the author is
   exactly the upstream participation O6 wants.
5. **AuthZEN is stable, AAT is not** — an asymmetry worth exploiting. Keep the AuthZEN
   side clean so that a delegation-format swap never disturbs the decision contract.

## 11. Upgrade strategy for AAT -02+

- Export `AAT_DRAFT_REVISION = '01'`; refuse chains the verifier cannot claim to support.
- Namespace modules and fixtures by revision (`aat/`, `fixtures/aat-01/`).
- Support current and previous revision simultaneously once -02 exists.
- Diff -01 → -02, then update fixtures _before_ code, so the test suite shows exactly what
  changed.
- Record the upgrade as an ADR when behaviour changes.
- Treat revision support as a documented compatibility statement, not an implementation
  detail — this is the versioning discipline ADR-0003 warned a profile would need.

## 12. Implementation slices

| Slice | Content                                                              | Verification                                  |
| ----- | -------------------------------------------------------------------- | --------------------------------------------- |
| 1     | AAT claim types, constraint types, fixture generator                 | Types compile; fixtures mint and re-verify    |
| 2     | Single-token verification: signature, claims, temporal, `alg` policy | Cryptographic + temporal tests                |
| 3     | Chain verification: depth, `par_hash`, `iss` thumbprint, cycles      | Structural + depth tests                      |
| 4     | Subsumption matrix                                                   | Full pairwise narrowing suite — largest slice |
| 5     | Leaf, closed-world arguments, PoP with JCS                           | Leaf + PoP tests                              |
| 6     | AuthZEN mapping and decision                                         | Mapping determinism tests                     |
| 7     | Reason codes and explanation rendering                               | Every deny path asserts its code              |
| 8     | Golden-path demo, README quickstart                                  | Ten-minute path walked end to end             |

Slice 4 is where the schedule risk sits. Slices 1–3 are mechanical.

## 13. Exit criteria

1. A developer who has never seen the repository runs the quickstart and gets a correct
   deny with an understandable reason, in under ten minutes, with no account or service.
2. Every AAT -01 verifier MUST from §1 has at least one passing test.
3. Every deny path returns a specific reason code; no bare booleans escape.
4. The AuthZEN request and response conform to 1.0 — validated against the published
   schema, not merely shaped like it.
5. Fixtures are revision-namespaced and consumable by O3 and O6 without modification.
6. No new wire format. The two flagged PROFILE mappings are recorded in an RFC.
7. `npm run check` green; `npm audit` clean; boundary guard intact.
8. Documentation states plainly that OAAF implements AAT **-01 specifically**, that AAT
   is an unadopted Internet-Draft, and that O2 provides no revocation and no replay
   protection.

## Reserved-IP boundary check

**Nothing in O2 crosses it.** AAT -01 contains no continuity, supersession, recovery, or
takeover semantics; revocation is explicitly out of its scope; `exp`/TTL is ordinary
validity, not fencing.

One live temptation to name in advance: while building step 5 it will feel natural to add
a "freshness" or "current version" input to the verifier. **That is the reserved extension
point.** O2 must not add any such parameter, even an optional one, until the IP review in
ADR-0002 has completed.

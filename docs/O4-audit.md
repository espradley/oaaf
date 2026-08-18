# O4 Audit — Evidence, Explainability, Developer Tooling

- **Status:** Audit and design only. No O4 implementation. Awaiting approval of the slice plan.
- **Date:** 2026-08-18

**O4 objective (restated).** Make OAAF's _existing_ authority decisions understandable and
diagnosable by an outside developer, without expanding the authority model. Evidence +
explainability + tooling, not a new authorization model.

## 1. Current-state capability inventory

What each surface produces, discards, and exposes.

| Surface                   | Produces today                                                                    | Discards / missing                                                                                                                                             | Public?                 |
| ------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `verifyAuthority`         | `{ok:true, authority}` or `{ok:false, denials[]}`                                 | On success, no record of _which_ checks passed                                                                                                                 | Public                  |
| `evaluate`                | `Decision{allowed, denials[], request?, response}`                                | On **allow**, records nothing about _what_ was satisfied — only that it was                                                                                    | Public                  |
| `Denial`                  | `code, stage, message, tokenIndex?, tool?, argument?`                             | — (this is the richest diagnostic object)                                                                                                                      | Public                  |
| `VerificationStage`       | `'chain'                                                                          | 'leaf'                                                                                                                                                         | 'pop'                   | 'evaluation' | 'a2a'` | Answers "at what stage did failure occur" | Public |
| `ReasonCode`              | 49 stable codes, one per normative check                                          | —                                                                                                                                                              | Public (`REASON_CODES`) |
| `VerifiedDelegationChain` | `aatRevision, tokens, leafTools, leafHolder, expiresAt, depth`                    | Per-token issuer/subject detail is on `tokens` but not summarized                                                                                              | Public                  |
| `explain()`               | Text: decision, subject, requested tool+args, chain shape, leaf permits, reasons  | **Text only** (no structured form); needs `authority`, so a _verification_ failure renders only "DENIED + reasons" with no context; **prints argument values** | Public                  |
| AAT verify                | Full step-by-step checks, each mapped to a reason code                            | Intermediate per-step results are computed then dropped — only first failure surfaces                                                                          | Internal                |
| Constraint/subsumption    | Precise per-argument narrowing decisions                                          | Which constraint matched on **allow** is not retained                                                                                                          | Internal                |
| PoP verify                | `pop_*` denials                                                                   | —                                                                                                                                                              | via core                |
| AuthZEN mapping           | `AccessEvaluationRequest` + `AccessEvaluationResponse{decision, context.reasons}` | —                                                                                                                                                              | Public                  |
| MCP adapter               | `JsonRpcError{code, message, data.reasons[]}`                                     | **Drops `tokenIndex`, `tool`, `argument`** from each denial                                                                                                    | Public                  |
| A2A adapter               | `A2aAuthorityError{code, message, data.reasons[]}`                                | **Drops `tokenIndex`, `tool`, `argument`** — identically to MCP                                                                                                | Public                  |
| Demos                     | Human-readable ALLOW/DENY with reasons                                            | —                                                                                                                                                              | —                       |
| Evidence/receipt          | **None.** The word "evidence" appears only in comments                            | No decision receipt of any kind exists                                                                                                                         | —                       |

**Two structural observations.**

1. The core `Denial` is richer than anything an integrator can see. Both adapters flatten
   it to `{code, stage, message}`, dropping the `tokenIndex`/`tool`/`argument` locators —
   the exact fields that answer "which authority/constraint caused this." The best
   diagnostic data is produced and then thrown away at the transport boundary.
2. The pipeline is **denial-centric**. On allow, it records only `allowed:true`. There is
   no positive statement of _what authority was exercised_ — which matters for evidence
   (recording that an allowed action was authorized) far more than for debugging.

## 2. Gaps, ranked

1. **Adapter reason loss (highest).** MCP and A2A discard `tokenIndex`/`tool`/`argument`.
   An integrator debugging a denial over either transport cannot tell _which_ token or
   _which_ argument failed without dropping into the core. Cheap to fix, high value, and
   it is the difference between "denied" and "denied because token 1 narrowed `path` away."
2. **No structured explanation.** `explain()` is text only. Integrators want a
   machine-readable decision explanation to log, assert on, and render themselves. The
   data exists; only a stable serializable shape is missing.
3. **Verification-failure context is thin.** When `verifyAuthority` fails there is no
   `VerifiedAuthority`, so `explain()` cannot show subject/chain/leaf. A partial,
   safe "what we could parse" context would make chain failures diagnosable.
4. **No portable decision evidence.** Nothing records "this authority was evaluated to
   this decision at this time" in a form a third party can keep. Whether this is _needed_
   is a genuine question — see §6, slice O4B.
5. **No cross-transport explanation invariant.** O3 proved decisions match; nothing
   asserts the _explanations_ match. Low-effort to add once explanation is structured.
6. **Positive-path opacity.** On allow, the satisfied constraints are not retained. Needed
   only if evidence must state _why_ allowed, not just _that_ allowed.

## 3. Standards findings (exact versions)

| Standard                    | Version / revision                                                                | Relevance to O4                                                                                                                                                                                                                                                                             | Status                                    |
| --------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| AuthZEN Authorization API   | **1.0, Final** (March 2026)                                                       | Response `context` carries reasons; the spec's own convention is `reason_admin` / `reason_user` (Figure 11, non-normative). OAAF already puts reasons in `context`/`data.reasons`; O4 explanation should align to this shape.                                                               | Published                                 |
| COAZ-MCP binding            | **Draft 1** (2026-02-13)                                                          | Defines the request mapping; **no** decision receipt or evidence type.                                                                                                                                                                                                                      | WG draft                                  |
| A2A                         | **1.0.1**                                                                         | "receipt" appears only as HTTP-2xx acknowledgement (§ push notifications) — unrelated to decision evidence. No decision-evidence type.                                                                                                                                                      | Released                                  |
| AuthZEN Obligations profile | current                                                                           | Response-side PDP→PEP instructions; **no** evidence/receipt type.                                                                                                                                                                                                                           | WG draft                                  |
| Signed Decision Receipts    | **draft-farley-acta-signed-receipts-02**, Active (individual; -01 now "replaced") | Portable, Ed25519 + RFC 8785 signed receipt of an M2M access-control decision — decision-maker identity, tool/resource, result, timestamp; independently verifiable; MCP-oriented. A close fit, using the **same crypto primitives OAAF already has** (`jose` Ed25519, `canonicalize` JCS). | Individual I-D, moving (advanced -01→-02) |
| RFC 8785 (JCS)              | RFC                                                                               | Already a dependency (PoP binding). Any receipt would reuse it.                                                                                                                                                                                                                             | Published                                 |
| RFC 8032 (Ed25519)          | RFC                                                                               | Already used via `jose`.                                                                                                                                                                                                                                                                    | Published                                 |

**Reading.** The _explanation_ representation has an upstream convention to align to
(AuthZEN `reason_admin`/`reason_user`). A _portable receipt_ has a candidate standard
(draft-farley-02) that fits and reuses our primitives — but it is an individual draft that
just moved a revision, so building to it now means pinning `-02` and accepting churn, per
the same discipline used for AAT `-01`. Neither MCP/COAZ nor A2A defines decision evidence,
so that space is genuinely open.

## 4. Security / privacy risks

- **Argument values.** `explain()` prints `JSON.stringify(value)` for each argument.
  Acceptable for a _local_ developer tool run against one's own request, but a **receipt or
  logged structure must not embed argument values by default** — they may carry PII,
  secrets, or resource paths. Reasons should reference argument _names_ (as the core
  already does), not values.
- **No token/key leakage today.** Verified: denial messages interpolate argument _names_
  and structural facts, never token bytes, `cnf.jwk`, or PoP material. This property must
  be preserved by any new explanation/evidence surface.
- **Subject identifier.** `leafHolder` is a JWK Thumbprint URI — a hash of a public key,
  not PII, and safe to record; but a receipt should treat it as an identifier subject to
  the consumer's retention policy.
- **Receipt integrity / replay.** A _signed_ receipt that says "allowed" must not be
  replayable as authorization. It records a past decision; it is not a bearer grant. If
  built, it must be self-describing as evidence-of-decision, never as a credential.
- **Over-claiming.** A receipt must not imply OAAF proved the _operation happened_ — OAAF
  evaluates authority; it does not observe execution. This is both a correctness and an
  IP-boundary constraint.
- **Fail-closed under diagnostics.** Any explanation/evidence code must be strictly
  downstream of the decision. It must never gate, soften, or alter authorization, and a
  failure to _produce_ an explanation must never turn a deny into an allow.

## 5. Reserved-IP assessment (ADR-0002)

Baseline scan of `src/` is clean (the only matches are the substring `fenc` inside
"defence in depth"). O4 as scoped stays inside portable authority:

- **In scope:** evidence that _an authority decision occurred_ — subject, requested action,
  decision, reason, stage, timestamp of evaluation.
- **Out of scope, unchanged:** execution continuity, recovery, supersession, stale-execution
  fencing, workforce orchestration, worker selection, scheduling, execution readiness,
  lifecycle/launch automation, DigitalStack execution state.

The tempting boundary case is a receipt timestamp or an "execution result" field. A receipt
may state _when the authority was evaluated_; it must **not** state or imply _when/whether
the operation executed_ — that is execution evidence, which OAAF cannot produce and which
edges toward reserved lifecycle territory. Slice designs below hold this line explicitly.

## 6. Proposed O4 decomposition

Four slices, each independently valuable and shippable. The order front-loads the cheap,
high-value developer wins and defers the one genuine "do we even need this" decision.

### O4A — Structured decision explanation

- **Problem.** `explain()` is text-only and the adapters flatten denials, so an integrator
  cannot programmatically answer "what decision, why, at what stage, which constraint."
- **Existing substrate.** `Denial` (already carries code/stage/message/tokenIndex/tool/
  argument), `ReasonCode`, `VerificationStage`, `Decision`, `explain()`.
- **Proposed change.** A stable, serializable `DecisionExplanation` object derived from the
  existing `Decision` — decision, per-reason `{code, stage, message, tokenIndex?, tool?,
argument?}`, and a safe summary of the requested action and the authority's shape
  (subject thumbprint, depth, granted tool names — **no argument values, no token bytes**).
  `explain()` becomes a renderer over it. Adapters stop flattening: their `reasons[]` carry
  the full locator fields.
- **Standards basis.** Reason placement aligns to AuthZEN 1.0 `context` conventions
  (`reason_admin`/`reason_user`); the structure itself is OAAF-specific but adds no
  authority semantics.
- **Security/privacy.** Argument _names_ only, never values; no key/token material; subject
  as thumbprint. Downstream of the decision — never alters it.
- **Tests.** Every reason code round-trips into a `DecisionExplanation`; adapters preserve
  locator fields; explanation contains no argument value or token substring (asserted).
- **Exit.** An integrator can obtain a structured explanation from a `Decision`, over MCP
  and A2A, with the same information the core has; `explain()` output is unchanged text.
- **IP boundary.** Pure description of an authority decision. No execution concept.

### O4B — Cross-transport explanation equivalence

- **Problem.** O3 proved decisions match across transports; nothing guarantees the
  _explanations_ do, so the two adapters could drift into competing diagnostic shapes.
- **Existing substrate.** O4A's `DecisionExplanation`; the O3 cross-transport test harness.
- **Proposed change.** No new API — a **CI invariant**: same chain + PoP + operation yields
  an equivalent `DecisionExplanation` (same decision, same ordered reason codes/stages/
  locators) through both adapters.
- **Standards basis.** N/A — an OAAF consistency guarantee.
- **Security/privacy.** None new.
- **Tests.** Extend `cross-transport.test.ts` to assert explanation equivalence, not just
  decision equivalence.
- **Exit.** The equivalence is asserted in CI; divergence fails the build.
- **IP boundary.** Consistency of description only.

### O4C — Local decision inspector (developer tooling)

- **Problem.** To debug, an integrator must write code against the SDK. There is no
  "paste your authority, see the stages and the decision" tool.
- **Existing substrate.** `verifyDelegationChain`, `verifyAuthority`, `evaluate`, O4A
  explanation, `@oaaf/sdk/testing` for constructing inputs locally.
- **Proposed change.** A tiny local CLI/example (`npm run inspect` or an `examples/`
  script) that takes authority inputs and prints stages → decision → reasons → the relevant
  constraint/delegation explanation. Runs locally, no DigitalStack, no account, no service,
  no web app.
- **Standards basis.** N/A — tooling over public inputs/outputs.
- **Security/privacy.** Local only; reuses O4A's safe explanation (no value/material leak).
  Reads inputs the operator already holds.
- **Tests.** The inspector renders a known ALLOW and a known DENY deterministically.
- **Exit.** An outsider can diagnose an integration from the inspector without reading OAAF
  internals or any RFC.
- **IP boundary.** Observes and explains a decision; does nothing execution-related.

### O4D — Portable decision evidence _(recommend: DEFER / decide explicitly)_

- **Problem.** There is no artifact a third party can keep proving "this authority was
  evaluated to this decision at this time." Whether integrators actually need this is
  **unvalidated** — no evaluator has asked for it.
- **Existing substrate.** O4A explanation; `jose` (Ed25519) and `canonicalize` (RFC 8785)
  already present; draft-farley-acta-signed-receipts-**02** as a candidate profile.
- **Proposed change (if pursued).** A `DecisionReceipt` profiling draft-farley-02, pinned to
  `-02`: signed (Ed25519), JCS-canonicalized, carrying subject thumbprint, requested action
  (names only), decision, reason, stage, and **evaluation** timestamp. Producer: the
  enforcement point. Consumer: an auditor / counterparty. Proves: _an authority evaluation
  occurred with this result_. Does **not** prove: the operation executed, or that the
  subject is a particular real-world person.
- **Standards basis.** PROFILE of draft-farley-02 (individual I-D — moving); reuses RFC 8785
  / RFC 8032, both already dependencies.
- **Security/privacy.** Names not values; thumbprint subject; **must be self-describing as
  evidence-of-decision, not a bearer credential**; replay of a receipt must never authorize
  anything; canonicalization + version field required.
- **Tests.** Round-trip verify; tamper → invalid; a receipt cannot be presented as authority.
- **Exit.** A third party verifies a receipt offline and reads a correct, non-over-claiming
  decision record.
- **IP boundary.** Evidence of _authority evaluation_ only — never execution evidence or
  lifecycle state.
- **Recommendation.** **Do not build O4D in the first O4 pass.** Reasons: (a) the objective's
  six developer questions are fully served by O4A–O4C; (b) the candidate standard is an
  individual draft that just churned a revision — pinning to a moving target has a cost we
  should pay only against real demand; (c) A0.3 will tell us whether anyone wants portable
  receipts before we profile one. Keep it specified and ready; gate it on evaluator signal.

## 7. Exit criteria (consolidated)

| Slice             | Objectively done when                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O4A               | Structured `DecisionExplanation` available from a `Decision`; adapters carry full locator fields; asserted free of argument values and token material; `explain()` text unchanged |
| O4B               | Cross-transport explanation equivalence asserted in CI                                                                                                                            |
| O4C               | An outsider diagnoses an ALLOW and a DENY locally, no internals, no service                                                                                                       |
| O4D (if approved) | Offline-verifiable receipt that states the decision without over-claiming; unforgeable; not usable as a credential                                                                |

Every slice: full typecheck/test/format/boundary gate, reserved-IP gate clean, clean-clone
`npm ci`, all existing demos runnable, CI green.

## 8. Files / API surfaces likely to change

- `packages/typescript/src/explain.ts` — refactor to render a structured explanation
- `packages/typescript/src/decide.ts` — expose a `DecisionExplanation` builder (no change to
  `verifyAuthority`/`evaluate` decision logic)
- `packages/typescript/src/mcp/coaz.ts`, `a2a/binding.ts` — stop flattening denial locators
- `packages/typescript/src/reasons.ts` — possibly a small helper; codes unchanged
- `packages/typescript/src/__tests__/cross-transport.test.ts` — explanation-equivalence assertion
- `examples/` — an inspector example (O4C)
- `rfcs/` + `docs/` — a receipt profile only if O4D is approved
- **No change** to AAT verification, subsumption, PoP, or the decision outcome of any input.

## 9. Recommend we explicitly NOT build

- **O4D signed receipts in the first pass** — defer to evaluator demand (§6).
- **A hosted/web inspector** — the user excluded it; local only.
- **A new decision model or parallel result type** — reuse `Decision`/`Denial`.
- **Any positive-path constraint recording** beyond what evidence needs — adds surface with
  no debugging value; revisit only if O4D is approved and requires "why allowed."
- **Any execution-result or lifecycle field** in explanation or evidence — reserved-IP line.
- **Renaming or renumbering reason codes** — they are stable public API.

## 10. Design constraints honored

- **Fail-closed explainability.** All proposed work is strictly downstream of the decision;
  no diagnostic path can alter authorization, and failure to explain never softens a deny.
- **Transport equivalence preserved and extended** (O4B).
- **No standard reinvented** where one exists (AuthZEN reason conventions; draft-farley for
  the deferred receipt), and external specs pinned by revision, never "latest."

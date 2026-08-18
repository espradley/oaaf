# The conformance runner and adapter protocol

`oaaf conform` (today: [`scripts/oaaf-conform.mjs`](../../../scripts/oaaf-conform.mjs)) runs the
[portable corpus](vectors/README.md) against **any** implementation and reports whether it
satisfies the requested OAAF conformance profiles.

The implementation under test is an **adapter** — a subprocess in any language. The runner
never imports the implementation, and the implementation never imports the runner or any OAAF
SDK. That is the point of O6C:

```text
        OAAF normative spec
                │
                ▼
          portable corpus.json
                │
     ┌──────────┼──────────┐
     ▼          ▼          ▼
    TS        Python    Go / Rust / Java …
  adapter    adapter      adapter
     │          │          │
     └──────────┼──────────┘
                ▼
         conformance result   (self-declared, self-verifiable)
```

## Not a certification authority

The runner produces **self-declared, self-verifiable** evidence. A PASS means _"this
implementation satisfied this corpus,"_ not _"OAAF certifies this implementation."_ Output
says so explicitly and names the corpus version and hash. OAAF issues no badge, registry
entry, or certificate — consistent with the [conformance spec](README.md#conformance-claim-format).

## Usage

```bash
node scripts/oaaf-conform.mjs --adapter "<command>" [--profile Core,Status] [--json] [--corpus <path>]
```

- `--adapter` — the command that starts your adapter (spawned as a subprocess).
- `--profile` — comma-separated profiles to judge (case-insensitive). Default: every profile
  the adapter claims.
- `--json` — machine-readable output (see below). Otherwise human output.
- `--corpus` — path to a corpus file. Default: the bundled `vectors/corpus.json`.

Exit codes: **0** = CONFORMANT, **1** = NOT CONFORMANT, **2** = runner/protocol error.

Human output on success ends with a tasteful, optional star nudge. **`--json` output is
pristine** — the report object and nothing else: no telemetry, no promotion, no participation
prompt, no implementation-specific diagnostics contaminating the contract.

```text
OAAF Core + Status + Identity 0.1
Corpus 0.1 (sha256:ae11f06af3a5…)
37 applicable vectors
37 passed
0 failed

CONFORMANT
(self-declared, self-verified against the corpus above — OAAF does not certify)
```

## Adapter protocol (v0.1)

The runner and adapter exchange **JSON Lines** over the adapter's stdin/stdout — one JSON
object per line, strict request/response. The adapter writes only protocol messages to stdout
(logging goes to stderr).

1. **Hello.** Runner → adapter:

   ```json
   { "type": "hello", "runner": "0.1", "corpus_version": "0.1" }
   ```

   Adapter → runner, declaring the profiles it claims:

   ```json
   { "type": "hello", "adapter": "my-impl", "profiles": ["Core", "Status"] }
   ```

   A profile the adapter does not list is treated as **not claimed**: the runner will not send
   its vectors, and judging that profile yields NOT CONFORMANT (you cannot be conformant for a
   profile you do not implement — but you lose nothing by not claiming it).

2. **Evaluate.** For each applicable vector, runner → adapter:

   ```json
   {
     "type": "evaluate",
     "vector_id": "core-narrow-widening-tool",
     "profile": "Core",
     "requirements": ["CORE-NARROW-001"],
     "input": {/* the vector input */}
   }
   ```

   Adapter → runner:

   ```json
   {
     "type": "result",
     "vector_id": "core-narrow-widening-tool",
     "decision": "deny",
     "reason": "tool_not_delegated",
     "output": "<optional serialized decision>"
   }
   ```
   - `decision` — `"allow"` or `"deny"`.
   - `reason` — the normative reason code for a deny; `null` for an allow.
   - `output` — optional. If provided for a privacy vector (`CORE-EXPL-003`), the runner
     additionally checks that no argument value from the input appears in it.

3. **Bye.** Runner → adapter: `{"type":"bye"}`; the adapter exits.

The `input` object is exactly the corpus vector `input` (schema in
[vectors/README.md](vectors/README.md)). The adapter verifies the tokens with its own crypto
and applies the resolver/verifier inputs itself.

## What is compared

Only the **portable normative contract**: `decision`, and for a deny the
`expected_normative_reason`. Reason granularity beyond the normative set, stage labels,
locators, and message wording are **not** compared (see [classification.md](classification.md)) —
an independent implementation is free to differ on them.

## Machine output (`--json`)

```json
{
  "runner": "0.1",
  "corpus": { "version": "0.1", "sha256": "…" },
  "profiles_requested": ["Core"],
  "profiles_claimed": ["Core", "Status", "Identity"],
  "profiles_unclaimed": [],
  "applicable": 30,
  "passed": 30,
  "failed": 0,
  "result": "CONFORMANT",
  "self_declared": true,
  "failures": []
}
```

## Reference adapters

Two reference adapters demonstrate the protocol across languages and are exercised in CI:

- [`adapters/typescript/adapter.mjs`](../../../adapters/typescript/adapter.mjs) — claims Core,
  Status, Identity, A2A. Run: `npm run conform`.
- [`adapters/python/adapter.py`](../../../adapters/python/adapter.py) — claims Core, Status,
  Identity, and **declines A2A**, so the runner reports A2A as unclaimed rather than failed.

Both use their respective OAAF implementations because they _are_ those implementations. A
third-party adapter would wrap its own implementation instead — the runner requires no OAAF
code inside the adapter.

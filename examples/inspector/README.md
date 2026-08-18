# OAAF authority inspector

A small, local, offline way to inspect an OAAF authority decision and understand it —
without writing integration code. It runs the existing OAAF pipeline and renders the
canonical decision explanation; it implements no authorization of its own.

Needs Node.js 20+. From the repository root:

```bash
npm run inspect -- --example allow
npm run inspect -- --example deny-undelegated
npm run inspect -- --example deny-argument
```

## What you see

**ALLOW:**

```text
ALLOWED

Subject
  urn:ietf:params:oauth:jwk-thumbprint:sha-256:jo1J…

Requested
  repo.read
    path

Chain
  root → hop 1

Leaf permits
  repo.read

Argument values are intentionally omitted for privacy.
```

**DENY — an operation the holder was never delegated:**

```text
DENIED
…
Reason
  tool_not_authorized
    Tool "repo.merge" is not permitted by this authority.
    at tool repo.merge
```

**DENY — an argument outside the delegated authority** (note the value never appears):

```text
Reason
  argument_constraint_violated
    Argument "path" does not satisfy the constraint on "repo.read".
    at tool repo.read, argument path
```

## Inspecting your own decision

A "case" is exactly the public input to the OAAF pipeline:

```jsonc
{
  "tokens": ["<root JWS>", "<derived JWS>"], // AAT chain, root first
  "pop": "<proof-of-possession JWS>",
  "trustAnchors": [{ "kty": "OKP", "crv": "Ed25519", "x": "…" }],
  "tool": "repo.read",
  "args": { "path": "src/" },
  "now": 1780000001, // optional evaluation time
}
```

Supply it by file or stdin — never as a command-line flag, so signed material stays out
of your shell history and process list:

```bash
npm run inspect -- --case ./case.json
cat case.json | npm run inspect
```

## Machine-readable output

`--json` emits the **canonical `DecisionExplanation`** — the same structure the SDK
produces, not a CLI-specific schema:

```bash
npm run inspect -- --example deny-argument --json
```

## Exit codes

| Code | Meaning                                            |
| ---- | -------------------------------------------------- |
| `0`  | Inspection succeeded, authority **ALLOW**          |
| `1`  | Inspection succeeded, authority **DENY**           |
| `2`  | Malformed invocation or internal inspector failure |

`1` (a real DENY) is never blurred with `2` (the tool could not run), so CI can tell an
authorization denial apart from a broken invocation.

## Privacy and safety

Local and offline by default. The inspector:

- prints **names, never values** — no argument values, tokens, signatures, PoP material, or keys;
- sends nothing over the network;
- persists nothing and keeps no history.

It necessarily _reads_ signed authority and PoP material to evaluate a real decision, but
it never echoes it. Supplying that material by file or stdin (not as a CLI argument) keeps
it out of shell history and the process list — a deliberate tradeoff, not a secret-manager.

## What it does not do

It shows authority — subject, requested and granted authority, delegation depth,
constraints, and why a decision came out as it did. It shows nothing about execution:
whether an operation ran, completed, retried, or was recovered are not OAAF concerns and
appear nowhere. It mints no receipt and proves only that a decision was _reached_, not
that anything _happened_.

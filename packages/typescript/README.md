# @oaaf/sdk

TypeScript SDK for the [Open Agent Authority Framework](https://github.com/espradley/oaaf).

Verify a delegated authority chain, decide whether a requested tool call is permitted,
and explain the answer.

> **Status: early (pre-v1, `0.x`).** Not yet published to npm — the artifact is
> certified publish-ready under the name `@oaaf/sdk`; the `@oaaf` scope is a pending
> ownership step. OAAF profiles Internet-Drafts that may change — see [Standards](#standards)
> and the [versioning policy](../../docs/versioning-and-compatibility.md).

## Install

```bash
npm install @oaaf/sdk
```

## Runtime and module format

|                          |                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Node.js                  | **20 and 22**, tested in CI on both                                                |
| Module format            | **ESM only** (`"type": "module"`). No CommonJS build                               |
| Browsers / edge runtimes | Not targeted or tested; Node is the supported runtime                              |
| TypeScript               | Complete `.d.ts` declarations ship; tested against TS 5 with `NodeNext` resolution |

ESM-only is deliberate: OAAF is 2026 agent infrastructure, its one crypto dependency
(`jose`) is ESM-first, and a dual CJS build would add maintenance surface for no current
adopter. If a concrete CJS consumer appears, that is an RFC, not an assumption.

## Public API — import paths

Import only these documented paths. Nothing under `dist/` internal to them is public.

| Path                | What                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `@oaaf/sdk`         | Core: `verifyAuthority`, `evaluate`, `verifyAndEvaluate`, `toExplanation`, `explain`, and the authority/explanation/reason types |
| `@oaaf/sdk/mcp`     | MCP / COAZ binding (RFC-0002): `enforceOaafPrecondition`, `enforceAndMapToCoaz`, `explainMcpResult`                              |
| `@oaaf/sdk/a2a`     | A2A binding (RFC-0003): `enforceA2aAuthority`, `explainA2aResult`, the extension constants                                       |
| `@oaaf/sdk/authzen` | AuthZEN request/response mapping and types                                                                                       |
| `@oaaf/sdk/testing` | Local authority minting for evaluation, tests, and demos — **not a production issuer**                                           |

### Stability

Pre-v1, all of this may still change, but deliberately and documented (see the
[versioning policy](../../docs/versioning-and-compatibility.md)):

- **Core** (`@oaaf/sdk`) and the **explanation contract** are the most settled.
- The **MCP and A2A bindings** track draft standards (COAZ-MCP Draft 1, A2A 1.0.1) and
  move with them — treat them as the most likely to change.
- `@oaaf/sdk/testing` is for evaluation and tests. It is **not** a production
  token-issuance service, and building one is out of OAAF's scope.

## Use

```ts
import { verifyAndEvaluate, explain } from '@oaaf/sdk';

const decision = await verifyAndEvaluate({
  tokens, // AAT delegation chain, root first
  trustAnchors, // public keys trusted as root issuers
  pop, // proof-of-possession JWT
  tool: 'read_file',
  args: { path: '/data/q4.pdf' },
});

if (!decision.allowed) {
  console.log(explain(decision));
}
```

```text
DENIED

Requested
  read_file
    path = "/data/q4.pdf"

Chain
  root → hop 1

Leaf permits
  read_file (constrained: path)

Reason
  argument_constraint_violated
    Argument "path" does not satisfy the constraint on "read_file".
    at tool read_file, argument path
```

The full runnable version is in
[`examples/quickstart`](../../examples/quickstart/index.js) — `npm run demo`.

## API

| Export                  | Purpose                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| `verifyAuthority`       | Full verification, including proof of possession. The enforcement entry point |
| `evaluate`              | Decide, given verified authority                                              |
| `verifyAndEvaluate`     | Convenience composition of the two                                            |
| `explain`               | Render a decision for a human                                                 |
| `verifyDelegationChain` | **Chain only.** Inspection, testing, and conformance work — _not_ enforcement |

`verifyDelegationChain` performs no proof-of-possession check and produces no decision.
There is deliberately no option to disable proof of possession while still returning a
decision: a verifier that can be configured to skip it will eventually be configured
that way in production, and would then claim conformance it does not have.

## Standards

OAAF defines no wire format. It implements:

| Concern           | Standard                                           |
| ----------------- | -------------------------------------------------- |
| Delegation chain  | `draft-niyikiza-oauth-attenuating-agent-tokens-01` |
| Decision contract | OpenID AuthZEN Authorization API 1.0               |
| Argument binding  | RFC 8785 JSON Canonicalization                     |
| Holder identity   | RFC 9278 JWK Thumbprint URI                        |

AAT support is **pinned to revision -01**, not to "latest". AAT is an individual
Internet-Draft with no working group; it may change, lapse, or be replaced, and OAAF's
behaviour is tied to that revision until deliberately upgraded.

The mapping between AAT and AuthZEN is an OAAF profile, frozen by
[RFC-0001](../../rfcs/0001-aat-authzen-enforcement-profile.md). It is not a requirement
of either standard.

## Understanding a decision (structured explanation)

Every decision can be rendered for a person or inspected as data. `explain()` gives text;
`toExplanation()` gives a structured, privacy-safe `DecisionExplanation`.

**A DENY, rendered** — the locator tells you exactly which token and argument failed:

```text
DENIED

Subject
  urn:ietf:params:oauth:jwk-thumbprint:sha-256:Jl0v…

Requested
  read_file
    path

Chain
  root → hop 1

Leaf permits
  read_file

Reason
  argument_constraint_violated
    Argument "path" does not satisfy the constraint on "read_file".
    at tool read_file, argument path
```

Note **`path`** appears as a name; its value never does. The requested path — which may be
a customer record or a secret — is intentionally omitted.

**The same DENY, structured** (`toExplanation(decision, authority)`):

```jsonc
{
  "decision": "DENY",
  "reasons": [
    {
      "code": "argument_constraint_violated",
      "stage": "evaluation",
      "message": "Argument \"path\" does not satisfy the constraint on \"read_file\".",
      "tool": "read_file",
      "argument": "path", // name only — no value
    },
  ],
  "authority": {
    "subject": "urn:ietf:params:oauth:jwk-thumbprint:sha-256:Jl0v…",
    "requestedTool": "read_file",
    "requestedArgumentNames": ["path"], // names only
    "grantedTools": ["read_file"],
    "delegationDepth": 1,
    "chainLength": 2,
    "expiresAt": 1780003600,
  },
}
```

Before O4A, the MCP and A2A adapters flattened each reason to `{code, stage, message}` and
dropped `tool`, `argument`, and `tokenIndex` — so a caller could see _that_ a request was
denied but not _which_ token or argument caused it. Both adapters now carry the full
locator set, from one shared model.

### What is standards-aligned vs OAAF-specific

Reasons are placed following AuthZEN Authorization API 1.0's `context` convention (its
`reason_admin` / `reason_user` distinction): OAAF's stable `code` is the machine reason and
`message` is developer-facing detail. The `DecisionExplanation` structure itself is
OAAF-specific and adds no authorization semantics — using it does not make OAAF a PDP or
require AuthZEN.

### Privacy

Explanations carry **names, never values**: argument names, tool names, stages, reason
codes, and the subject's public-key thumbprint. They never carry argument values, resource
contents, token bytes, signatures, PoP material, or keys. This holds for `explain()`,
`toExplanation()`, and both transport adapters, and is asserted in the test suite.

## Trust anchors

`trustAnchors` is required, and there is no way to omit it.

A root token is a claim, not a trust root. Verified against its own `cnf.jwk`, a chain
establishes only that it is internally self-consistent — anyone could mint a self-signed
root granting themselves anything and it would verify. With an anchor set, verification
establishes that the chain terminates in an issuer you explicitly trust. Those are
different guarantees, and only the second is worth having.

So there is no permissive mode, no default anchor set, and no flag to skip the check.
Omission is a compile error; an empty set is denied with `untrusted_root`. This is the
same reasoning that makes proof of possession non-optional — see
[ADR-0004](../../docs/adr/0004-fail-closed-configuration.md).

## Bindings at a glance

```ts
// MCP: enforce OAAF authority before the COAZ/AuthZEN decision
import { enforceOaafPrecondition } from '@oaaf/sdk/mcp';

// A2A: enforce OAAF authority on an incoming agent message
import { enforceA2aAuthority } from '@oaaf/sdk/a2a';
```

Both return the same canonical explanation via `explainMcpResult` / `explainA2aResult`
(see [cross-transport equivalence](../../docs/explanation-equivalence.md)).

## MCP / COAZ

`@oaaf/sdk` also implements [RFC-0002](../../rfcs/0002-mcp-coaz-binding.md): an
integration with COAZ, OpenID's MCP tool-authorization binding for AuthZEN. For a
runnable version of the snippet below, see
[examples/mcp-tool-guard](../../examples/mcp-tool-guard/) (`npm run demo:mcp`).

COAZ owns the MCP-to-authorization-request mapping; OAAF does not redefine it.
`enforceOaafPrecondition` is inserted as an additional step in COAZ-MCP's own PEP
algorithm, applied _before_ a COAZ request is constructed. On failure it returns a
JSON-RPC error and the request is never built; on success it returns the verified
authority and a `context.oaaf` fragment the caller may merge into COAZ's request.

```ts
import { enforceAndMapToCoaz } from '@oaaf/sdk';

const result = await enforceAndMapToCoaz({
  tokens,
  trustAnchors,
  pop,
  tool: 'read_file',
  args: { path: '/data/q3.pdf' },
  principal, // COAZ's own input: $token.sub
  agent, // COAZ's own input: $token.?client_id
});

if (!result.ok) {
  // JSON-RPC error, per COAZ-MCP — no AuthZEN request was ever built.
  return result.error;
}

// result.request is COAZ's default tools/call mapping, unmodified in
// subject/action/resource, with context.oaaf added.
```

## What this does not do

- **No revocation.** AAT does not mitigate it and neither does OAAF. Authority is
  bounded by `exp` alone.
- **No replay protection.** AAT makes stateful `jti` tracking a deployment
  responsibility.
- **No MCP or A2A binding yet.** Those are the next phase.

## License

[Apache 2.0](../../LICENSE)

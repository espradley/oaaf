# @oaaf/sdk

TypeScript SDK for the [Open Agent Authority Framework](https://github.com/espradley/oaaf).

Verify a delegated authority chain, decide whether a requested tool call is permitted,
and explain the answer.

> **Status: early.** Not published to npm yet. OAAF implements an Internet-Draft that
> may change — see [Standards](#standards).

## Install

```bash
npm install @oaaf/sdk
```

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

## Trust anchors

`trustAnchors` is required. A root token is a claim, not a trust root: without an
anchor set, anyone can mint a self-signed root and the chain proves nothing about who
granted the authority. The draft verifies the root against a configured trust anchor,
and so does this.

## What this does not do

- **No revocation.** AAT does not mitigate it and neither does OAAF. Authority is
  bounded by `exp` alone.
- **No replay protection.** AAT makes stateful `jti` tracking a deployment
  responsibility.
- **No MCP or A2A binding yet.** Those are the next phase.

## License

[Apache 2.0](../../LICENSE)

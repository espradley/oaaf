# OAAF as an MCP tool guard

A runnable example for MCP server and gateway maintainers. No prior knowledge of
AAT or AuthZEN required. Needs Node.js 20+ and nothing else — no account, no service.

From the repository root (not this directory):

```bash
npm install
npm run demo:mcp
```

You will see one MCP `tools/call` allowed and one denied — and, crucially, the
denied one stops before the authorization PDP is ever called.

## What you are looking at

An MCP gateway authorizes a `tools/call` the normal way: it maps the call into an
AuthZEN request and asks a PDP. OAAF adds one check _before_ that:

```text
MCP tools/call
      ↓
OAAF delegated-authority precondition
      ↓
   valid? ──── no ───►  DENY — the PDP is never called
      │
     yes
      ↓
COAZ / AuthZEN request  ──►  PDP  ──►  ALLOW / DENY
      ↓
   tool executes
```

Both calls in the demo are structurally valid MCP requests. The difference is the
_delegated authority_: an agent was granted read access to two files, then
delegated a narrower authority — one file only — to a sub-agent. The sub-agent's
call to the file it kept is allowed; its call to the file it gave up is denied,
even though the original grant would have permitted it.

The mock PDP prints a line every time it is consulted. Watch it stay silent on the
denied request.

## Questions an evaluator asks

**What is OAAF checking?** Delegated authority — that the caller actually holds a
valid, sufficiently-scoped, cryptographically-verifiable grant for this exact tool
and these exact arguments.

**What happens when it fails?** The request is denied before the authorization PDP
is called. OAAF fails closed.

**What are COAZ and AuthZEN doing?** The normal MCP authorization path — mapping
the call into an authorization request and deciding it — which runs _after_ OAAF's
precondition succeeds. OAAF does not change that mapping.

**Is OAAF replacing MCP authorization?** No.

**Is OAAF replacing AuthZEN?** No. It sits in front of it.

**Is OAAF inventing another token format?** No. Delegation chains are
[Attenuating Authorization Tokens](https://datatracker.ietf.org/doc/draft-niyikiza-oauth-attenuating-agent-tokens/),
an existing IETF draft.

**Do I need DigitalStack, an account, a service, or a database?** No. This example
runs entirely in-process.

**Why does the demo mint authority locally?** Only to make evaluation
self-contained. The example creates a test issuer key so you can experience the
full flow without deploying one. OAAF does not provide or require a production
token-issuance service — that is intentionally outside its scope. The minting
helpers live under [`@oaaf/sdk/testing`](../../packages/typescript/src/testing/mint.ts)
and are for evaluation and tests, not production issuance.

## Evaluate it in your own server

1. Identify one consequential MCP tool.
2. Put OAAF authority enforcement before your existing PDP / tool-execution path.
3. Supply a delegated AAT authority chain and a proof-of-possession JWT.
4. Verify OAAF denies an unauthorized call _before_ your PDP executes.
5. Verify a valid call maps into your normal COAZ / AuthZEN path.
6. Tell us where the integration was awkward — that feedback is the point right now.

This is not yet a one-line drop-in. Steps 2 and 3 in particular still require you
to wire OAAF into your request path and to obtain authority chains by hand. If any
of it is more painful than it should be, [open an issue](https://github.com/espradley/oaaf/issues)
— we are actively looking for exactly that friction.

## The details, if you want them

- [RFC-0002](../../rfcs/0002-mcp-coaz-binding.md) — the MCP / COAZ binding, and why
  OAAF is a PEP precondition rather than a COAZ input.
- [RFC-0001](../../rfcs/0001-aat-authzen-enforcement-profile.md) — the
  transport-neutral AAT → AuthZEN profile.
- [`@oaaf/sdk` README](../../packages/typescript/README.md) — the API surface.

# Same authority, two transports

The OAAF thesis in one runnable file. Needs Node.js 20+ and nothing else.

From the repository root (not this directory):

```bash
npm install
npm run demo:cross
```

## The claim

**The authority is not owned by the transport.**

One delegation chain — Alice grants Bob a narrowed authority, `repo.read` only — and one
proof of possession per operation, fed through _both_ the MCP adapter and the A2A adapter.
The allow/deny outcome is identical on both, down to the reason code.

```text
                    SAME AUTHORITY CHAIN
              Alice ──delegates──▶ Bob (repo.read only)
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
             MCP                       A2A
        Agent → Tool              Agent → Agent
        (RFC-0002)                (RFC-0003)
              │                         │
      ┌───────┴───────┐         ┌───────┴───────┐
      ▼               ▼         ▼               ▼
  repo.read       repo.merge  repo.read     repo.merge
   ALLOW            DENY        ALLOW          DENY
      └───────────────┬─────────────────────────┘
                      ▼
        identical decisions, identical reasons
```

`repo.merge` is denied on both because Alice never delegated it to Bob — even though
Alice herself holds it. The transport changes; the authority decision does not.

## Why this matters

Most systems bind permission to the transport or the credential: an MCP token, an A2A
auth scheme, an API key. OAAF binds it to the _delegated authority_ the agent carries. The
same verified chain produces the same decision whether the agent is calling a tool over
MCP or handing work to another agent over A2A.

This example imports two adapters (`enforceOaafPrecondition` for MCP,
`enforceA2aAuthority` for A2A) that call the _same_ verification core. It adds no new
authority semantics — it only shows the existing ones are transport-independent.

## Details

- MCP binding: [RFC-0002](../../rfcs/0002-mcp-coaz-binding.md)
- A2A binding: [RFC-0003](../../rfcs/0003-a2a-binding.md)
- The equivalence is also asserted in CI (`cross-transport.test.ts`), so a future change
  that made the transports diverge would fail the build.

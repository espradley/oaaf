# OAAF delegated authority over A2A

A runnable example of one agent delegating narrowed authority to another over the
Agent2Agent (A2A) protocol, with the receiving agent verifying it before doing work.
Needs Node.js 20+ and nothing else.

From the repository root (not this directory):

```bash
npm install
npm run demo:a2a
```

## The story

Alice holds broad authority over a repository — read, comment, merge. She delegates a
**narrower** authority to Bob over A2A: read and comment, but not merge. Bob then makes
two A2A calls, and Bob's agent runs the OAAF precondition before any consequential work:

```text
Alice   authority: repo.read, repo.comment, repo.merge
   │  delegates to Bob over A2A, narrowed:
   ▼
Bob     authority: repo.read, repo.comment          (merge dropped)
   │
   ├── repo.read   → OAAF precondition PASS → Bob's handler runs → ALLOW
   └── repo.merge  → OAAF precondition DENY → handler never runs
                     reason: tool_not_authorized
```

Alice _could_ merge. Bob cannot, because that authority was never delegated. Bob's agent
refuses before running any handler — the demo prints the handler line only when it
actually executes, so you can watch it stay silent on the denied call.

## Where OAAF sits

A2A's specification (§7.6.4) says the protocol does not define the scope or validity of an
authorization decision and that this "MUST be defined by… an A2A extension," checked
"before the operation is performed." OAAF is that extension. Authority travels in the A2A
`Message.metadata`, the extension is declared in the Agent Card and activated by the
caller, and Bob's agent verifies it as a precondition.

```text
A2A request (OAAF extension activated, AAT authority in metadata)
      ↓
OAAF precondition  — chain valid? holder bound? PoP valid? action within authority?
      ↓
   valid? ── no ──► reject before consequential work
      │
     yes
      ↓
normal A2A processing
```

## What OAAF is and is not doing here

**Is:** verifying that Bob holds authority delegated from Alice, that it is narrowed
correctly, that Bob proved possession, and that the requested skill is within it.

**Is not:** deciding _why_ Bob was chosen, whether Bob _takes over_ Alice's work, or what
happens to Alice afterward. That is agent orchestration, and it is outside OAAF. OAAF
checks the delegation of authority; it does not coordinate the work.

## Details

- [RFC-0003](../../rfcs/0003-a2a-binding.md) — the A2A binding, and why OAAF is an A2A
  extension enforced as a precondition.
- [A2A extension definition](../../docs/a2a-extension/oaaf-authority-v1.md) —
  implementable by a Go / Python / Java developer without `@oaaf/sdk`.
- The demo uses [`@oaaf/sdk/testing`](../../packages/typescript/src/testing/mint.ts) to
  mint local authority so the flow is self-contained. Production issuance is intentionally
  outside OAAF's scope.

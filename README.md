# OAAF — Open Agent Authority Framework

**Give AI agents only the authority they need. Prove it when they act.**

OAAF is an open interoperability framework for carrying, enforcing, and verifying delegated
authority across AI agents and tools.

```text
Agent requests:
  github.merge_pull_request

Credentials:
  valid GitHub access ✓

Delegated authority:
  github.read
  github.write
  github.create_pull_request

Decision:
  DENY

Reason:
  tool_not_authorized
```

**The credential could merge. The authority could not.** That is the simple problem OAAF
solves — and OAAF does not introduce another competing authorization protocol to do it.

## Try OAAF in 30 seconds

No account. No hosted service. No API key.

```bash
git clone https://github.com/espradley/oaaf.git
cd oaaf
npm install
npm run demo:cross
```

`demo:cross` enforces the **same delegated authority** across both an MCP tool call and an A2A
agent handoff — allowing what was delegated and denying what was not:

```text
              SAME AUTHORITY
          Alice → Bob
      narrowed to repo.read
               │
        ┌──────┴──────┐
        ▼             ▼
       MCP           A2A
  Agent → Tool   Agent → Agent
  read   ALLOW   read   ALLOW
  merge  DENY    merge  DENY
```

The authority does not belong to MCP. It does not belong to A2A. It does not belong to a
particular agent framework. It travels with the agent's authority, and OAAF verifies it the same
way regardless of the transport it arrives on.

## Add it to your project

The clone above is for **trying** OAAF. To **use** it, install the published package:

```bash
# TypeScript / JavaScript
npm install @oaaf/sdk

# Python
pip install oaaf
```

If you maintain an MCP server or gateway, start with
[examples/mcp-tool-guard](examples/mcp-tool-guard/) — it answers "where does OAAF sit in my
request path?" in about five minutes. For a real MCP server process, run
[`examples/mcp-filesystem-guard`](examples/mcp-filesystem-guard/) against the open-source
filesystem server.

## Why this exists

Agent systems today express what an agent may do with an **API key**, an **OAuth token**, a
**service account**, a **tool allow-list**, or **application config**. Those describe what the
credential or process _can access_. They do not answer the question that matters for an
autonomous agent:

> **What is this agent authorized to do for this delegated task?**

Credentials are issued to the process, not to the intent — so an agent almost always holds
broader access than the task in front of it requires. Delegation makes it concrete:

```text
Agent Alice
authority:
  repo.read
  repo.write
  repo.merge
        │ delegates review
        ▼
Agent Bob
authority:
  repo.read
  repo.comment

repo.read     → ALLOW
repo.comment  → ALLOW
repo.merge    → DENY   (Bob was never delegated it)
```

OAAF verifies that Bob's presented authority genuinely narrows from Alice's, cryptographically,
before anything consequential happens. It says nothing about _why_ Bob was chosen, what happens
next, or how the work is coordinated — those are not authority questions.

## The core principle

> **The model may decide what it wants to do. The authority layer decides what it is permitted
> to do.**

OAAF assumes the agent may be prompt-injected, compromised, buggy, confused, or simply operating
with credentials broader than its delegated authority. The enforcement point never relies on the
agent restraining itself, and it **fails closed**: authority that is unverifiable, expired,
revoked, or malformed denies the action.

## The enforcement model

```text
Agent requests action
        │
        ▼
OAAF Enforcement Point
        │
        ├── verify delegated authority
        ├── verify proof of possession
        ├── verify identity binding
        ├── enforce narrowing / attenuation
        ├── evaluate constraints
        ├── check status / revocation
        └── produce verified authority facts
        │
    VALID / DENY
        │
        ▼
Existing authorization / PDP
        │
    ALLOW / DENY
        │
        ▼
Consequential action
```

An **enforcement point** is whatever sits immediately before a consequential action — MCP
middleware, a tool gateway, an A2A agent, an agent runtime, an API gateway, a Git proxy. It is an
architectural role, not a hosted OAAF service you have to buy or run.

## OAAF does not replace your existing authorization system

OAAF sits **in front of** your policy engine, not instead of it. Two questions, two owners:

```text
OAAF asks:                          Your organization asks:
"Is the delegated authority         "Does our policy permit
 valid?"                             this action?"

        OAAF
   authorityVerified = true
        │
        ▼
   Organization PDP
        │
        ▼
       DENY          ← legitimate
```

A valid authority chain can still be denied on policy — that is intentional. OAAF conveys
**verified authority facts** into the request context; the organization's PDP still owns the
policy decision. OAAF profiles [AuthZEN](https://openid.net/wg/authzen/) as the decision model
here rather than competing with it, and works alongside OPA, Cedar, and other engines
([RFC-0006](rfcs/0006-pdp-interoperability.md)).

## MCP and A2A

OAAF covers the two boundaries agents actually cross:

```text
Agent → Tool     MCP    (RFC-0002, COAZ / AuthZEN)
Agent → Agent    A2A    (RFC-0003, A2A extension)
```

The underlying **authority semantics are transport-independent** — the same chain verifies the
same way — while each **binding is standards-specific**. OAAF does not assume MCP and A2A share
an authorization model; it maps each into its own binding and preserves the authority decision
across both (certified as [transport equivalence](spec/0.1/conformance/security.md)).

## Standards-first

OAAF introduces no wire format of its own. Most of the primitives already exist; OAAF makes them
work together across an agent boundary.

```text
EXISTING STANDARDS
──────────────────────────────────────────
Identity        SPIFFE / WIMSE / OIDC
Delegation      Attenuating Authorization Tokens (AAT)
Decisions       AuthZEN
MCP auth        COAZ
Evidence        Signed receipts
A2A transport   A2A extensions
                  │
                  ▼
OAAF
──────────────────────────────────────────
Profiles · Bindings · Enforcement · Verification
Explainability · Conformance · Developer tooling
```

Where a standard already solves something, OAAF adopts or profiles it — the reasoning is in
[ADR-0003](docs/adr/0003-implement-existing-authority-standards.md), and how OAAF engages with
each standard (and how to raise an interoperability discrepancy) is in
[docs/standards.md](docs/standards.md).

## OAAF Core 1.0 — a frozen interoperability contract

The **OAAF Core 1.0 interoperability contract is frozen**, and defined **independently of** the
TypeScript and Python reference implementations — so a Go, Rust, or Java implementation can
target it without importing any OAAF code. The frozen artifact set
([What is OAAF 1.0?](spec/0.1/conformance/oaaf-1.0.md), hash-pinned by a
[freeze manifest](spec/0.1/conformance/manifest.json)):

- normative [Core requirements](spec/0.1/conformance/requirements.json);
- [AAT compatibility profile](spec/0.1/conformance/aat-profile.md);
- normative [reason codes](spec/0.1/conformance/reason-codes.json);
- [portable conformance corpus](spec/0.1/conformance/vectors/README.md);
- implementation-independent [runner protocol](spec/0.1/conformance/runner.md);
- optional [profile definitions](spec/0.1/conformance/classification.md);
- adversarial [security evidence](spec/0.1/conformance/security.md);
- [compatibility policy](spec/0.1/conformance/compatibility.md);
- the [freeze manifest](spec/0.1/conformance/manifest.json).

> The **contract** is Core 1.0 (frozen). The reference **packages** are versioned separately
> (`@oaaf/sdk` and `oaaf` are `0.x`) — see the [compatibility policy](spec/0.1/conformance/compatibility.md).

## Conformance — implementation-independent

Any implementation — in any language — proves conformance without importing OAAF code, by
answering a small adapter protocol over the portable corpus:

```bash
node scripts/oaaf-conform.mjs --adapter "<your adapter>" --profile Core
```

Representative output:

```text
OAAF Core + Status + Identity + A2A + MCP + PDP 0.1
Corpus 0.1 (sha256:…)
Manifest 1.0 frozen (sha256:…)
51 applicable vectors
51 passed
0 failed
CONFORMANT
(self-declared, self-verified against the corpus above)
```

Conformance is **self-declared and self-verifiable**. OAAF does not certify implementations and
operates no certification authority — the machine-readable output (`--json`) is clean evidence a
reader can reproduce. Both the TypeScript and Python reference implementations pass the corpus.

## Security posture

- **OAAF has adversarial security certification derived from its normative security invariants**
  — 41 attacks tied back to the 44 security invariants, in every attack family: authority
  widening, chain manipulation, cryptographic attacks, proof-of-possession failures,
  identity/recipient substitution, validity/revocation behavior, transport-equivalence attacks,
  privacy leakage, and malformed inputs
  ([security certification](spec/0.1/conformance/security.md)).
- **OAAF has not yet undergone an independent professional third-party security audit.**

Those are two different claims, and both are stated plainly. To report a vulnerability, see
[SECURITY.md](SECURITY.md) (private reporting).

## Identity, kept separate

OAAF does not conflate four things that agent systems usually merge into one:

```text
WHO IS THE ACTOR?              subject                (SPIFFE / WIMSE / OIDC)
HOW WAS IT AUTHENTICATED?      external credential    (an SVID / OIDC token — never in OAAF)
WHO POSSESSES THIS AUTHORITY?  proof-of-possession key
WHAT MAY IT DO?                authority              (the delegated grant)
```

Identity providers establish _who_ the actor is; OAAF verifies _what authority_ the actor
presents and that it is bound to the right key. Workload-identity systems are complementary, not
replaced ([RFC-0005](rfcs/0005-external-subject-identity-binding.md)).

## Who this is for

- **MCP server maintainers** — scope authority around consequential tools; a request that exceeds
  its delegated authority is denied before the tool runs.
- **A2A implementers** — make the narrowing across an agent handoff cryptographically verifiable.
- **Agent framework / runtime authors** — a transport-neutral place to enforce what an agent may do.
- **Tool gateway / proxy maintainers** — enforce delegated authority at the boundary you already own.
- **Security / IAM teams** — evaluate what autonomous agents may actually do, with fail-closed defaults.

## What OAAF is not

- Not another authorization wire protocol
- Not an agent framework
- Not a model
- Not an IAM replacement (it sits above workload identity and integrates with it)
- Not an orchestration engine, a workflow engine, or a scheduler
- Not an AI-workforce product
- Not DigitalStack360, and not an open-source edition of it

OAAF deliberately does **not** decide which agent should do the work, what happens next, how work
is prioritized, how much capacity exists, when execution should recover, who should take over, or
what organizational context to supply. Those are real problems that belong to products built on
top of OAAF. The boundary is written down in [CHARTER.md](CHARTER.md) and enforced in CI.

## Runnable demos

All run from a fresh clone, offline, with no credentials:

```bash
npm run demo         # a delegated agent refused a path it gave up
npm run demo:mcp     # OAAF as a precondition on an MCP tools/call
npm run demo:mcp-filesystem  # OAAF guarding a real MCP filesystem server
npm run demo:a2a     # OAAF enforcement over an A2A message
npm run demo:cross   # the same authority, same result, across transports
npm run demo:pdp     # OAAF in front of an existing PDP (valid authority, org still denies)

npm run inspect -- --example allow             # exit 0 (ALLOW)
npm run inspect -- --example deny-argument      # prints the denial; exit 1 (DENY), by design
```

The inspector exits `0` for ALLOW and `1` for DENY — a non-zero exit on a `deny-*` example is the
decision, not an error.

## Project maturity

| Area                           | Current state                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| OAAF Core                      | **1.0 interoperability contract frozen** ([what that means](spec/0.1/conformance/oaaf-1.0.md))                       |
| TypeScript SDK                 | Published as [`@oaaf/sdk`](https://www.npmjs.com/package/@oaaf/sdk) (`0.x`)                                          |
| Python                         | Published as [`oaaf`](https://pypi.org/project/oaaf/) (`0.x`)                                                        |
| MCP / COAZ                     | Implemented and conformance-tested ([RFC-0002](rfcs/0002-mcp-coaz-binding.md))                                       |
| A2A                            | Implemented and conformance-tested ([RFC-0003](rfcs/0003-a2a-binding.md))                                            |
| PDP interoperability           | AuthZEN-compatible authority context; existing-PDP coexistence ([RFC-0006](rfcs/0006-pdp-interoperability.md))       |
| Identity                       | SPIFFE / WIMSE / OIDC-compatible identity-binding model ([RFC-0005](rfcs/0005-external-subject-identity-binding.md)) |
| Revocation / status            | Implemented with profile-specific semantics ([RFC-0004](rfcs/0004-authority-status-revocation.md))                   |
| Conformance                    | Portable corpus + implementation-independent [runner](spec/0.1/conformance/runner.md)                                |
| Cross-language                 | TypeScript + Python reference implementations                                                                        |
| Security                       | Normative security-invariant + [adversarial suite](spec/0.1/conformance/security.md)                                 |
| Independent professional audit | Not yet performed                                                                                                    |
| External adopters              | Early stage — independent evidence still being built ([ADOPTERS.md](ADOPTERS.md) is empty by design)                 |
| Governance                     | Founder-led, public [RFC process](rfcs/README.md)                                                                    |

## Contributing

OAAF wants interoperability reports, standards-interpretation feedback, independent conformance
adapters, real integration examples, security findings, documentation improvements, and
implementations in additional languages.

- [CONTRIBUTING.md](CONTRIBUTING.md) · [RFC process](rfcs/README.md) ·
  [docs/standards.md](docs/standards.md) ·
  [Discussions](https://github.com/espradley/oaaf/discussions)
- Open [`help wanted`](https://github.com/espradley/oaaf/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
  issues include an independent Go/Rust conformance adapter, AuthZEN interop testing, and a
  real-world MCP integration.

## Using OAAF?

- ⭐ Star the project if it is useful.
- 🧩 Tell us what you're integrating.
- 🐛 Report interoperability problems.
- 🤝 Contribute an implementation, adapter, test, or standards finding.
- 📣 Using OAAF in a real project? Consider the voluntary [adopter process](ADOPTERS.md).

No telemetry, no phone-home, no install-time promotional hooks — participation is voluntary, and
a star is a visibility signal, not adoption certification.

## Governance and policies

Maintained by Edwin Digital LLC, founder-led today and designed to evolve:
[GOVERNANCE](GOVERNANCE.md) · [CONTRIBUTING](CONTRIBUTING.md) · [SECURITY](SECURITY.md) ·
[versioning & compatibility](docs/versioning-and-compatibility.md) ·
[standards](docs/standards.md) · [adoption journey](docs/adoption-journey.md).

## License

[Apache License 2.0](LICENSE). Maintained by Edwin Digital LLC as initial steward.

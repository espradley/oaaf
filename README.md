# OAAF — Open Agent Authority Framework

OAAF is an open interoperability framework for carrying, enforcing, and verifying
delegated authority across AI agents and tools.

It makes existing identity, authorization, delegation, and evidence standards practical
across MCP, A2A, and agent runtimes without introducing another competing authorization
protocol.

> **Status: early.** OAAF is being built in the open and is not yet implemented.
> Nothing here is production-ready or security-audited. See
> [Project maturity](#project-maturity) before you plan around it.

## The problem

**Your AI agent has credentials. But is it actually authorized to make this request,
delegate this work, or call this tool?**

Agent frameworks are getting good at planning, tool use, and coordination. Permissions
have not kept up. Most systems still express what an agent may do as application
config, an API key, or a tool allow-list. That works until the agent has broader
credentials than the task requires — which is nearly always, because credentials are
issued to the process, not to the intent.

```text
Agent requests:
  github.merge_pull_request

Presented authority permits:
  github.read
  github.write
  github.create_pull_request

Decision:
  DENY

Reason:
  capability_not_granted
```

The agent held a valid GitHub token the whole time. The token could merge. The
_authority_ could not, and something had to be positioned to notice the difference.

## Where OAAF sits

The primitives for this mostly exist already. Identity, attenuating delegation,
authorization decisions, and portable evidence are each being standardized by people
who have been doing this longer than we have.

What does not exist is running code that makes them work together across an agent
boundary. That is OAAF.

```text
EXISTING STANDARDS
────────────────────────────────
Identity        SPIFFE / WIMSE
Delegation      Attenuating authorization tokens
Decisions       AuthZEN
MCP auth        COAZ
Evidence        Signed receipts
A2A transport   A2A extensions
                  │
                  ▼
OAAF
────────────────────────────────
Profiles
Bindings
Enforcement
Verification
Explainability
Conformance
Developer tooling
             ┌────┴────┐
             ▼         ▼
            MCP       A2A
             │         │
             ▼         ▼
           Tools     Agents
```

OAAF defines no wire format of its own. Where a standard already solves something, OAAF
adopts or profiles it; the reasoning is in
[ADR-0003](docs/adr/0003-implement-existing-authority-standards.md).

## The model

```text
Agent requests action
        │
        ▼
OAAF Enforcement Point
        │
        ├── verify authority
        ├── evaluate capability
        ├── evaluate resource/constraints
        └── produce evidence
        │
   ALLOW / DENY
        │
        ▼
       Tool
```

An **enforcement point** is whatever sits immediately before a consequential action:
MCP middleware, a tool gateway, a shell wrapper, a Git proxy, an API gateway, an agent
runtime. It is an architectural role, not a product you have to buy or host.

## The core principle

> **The model may decide what it wants to do. The authority layer decides what it is
> permitted to do.**

OAAF assumes the agent may be prompt-injected, compromised, or simply wrong. The
enforcement point never relies on the agent restraining itself, and it fails closed:
authority that is unverifiable, expired, revoked, or malformed denies the action.

## Who this is for

OAAF is aimed at the infrastructure layer — the people who end up owning this problem
whether or not they wanted to:

- **MCP server maintainers** who expose consequential tools and need scoped authority
  around them
- **A2A agent authors** who delegate work across an agent boundary and need the
  narrowing to be verifiable
- **Tool gateway and proxy operators** enforcing what reaches a downstream system
- **Security and IAM teams** evaluating what autonomous agents may do

If you are building any of these, the alternative to OAAF is wiring several
specifications together yourself. That is the comparison OAAF has to win.

## What OAAF is not

- **Not another authorization protocol.** OAAF implements and profiles existing
  standards rather than competing with them.
- Not an agent framework
- Not a model
- Not an orchestration engine
- Not an IAM replacement — OAAF sits above workload identity and integrates with it
- Not a workflow product
- Not DigitalStack360, and not an open-source edition of it

OAAF deliberately says nothing about which agent should do a task, in what order work
should happen, or how an organization should run its AI workforce. Those are real
problems; they belong to products built on top of OAAF. The boundary is written down in
[CHARTER.md](CHARTER.md) and is enforced in CI.

## Repository layout

```text
spec/0.1/              how OAAF profiles existing standards
packages/typescript/   @oaaf/sdk — TypeScript SDK
rfcs/                  proposals for what OAAF adopts, profiles, extends, or invents
docs/adr/              architecture decision records
scripts/               repository checks, including the dependency boundary guard
```

Directories from the planned structure — `reference/`, `examples/`, `tests/` — are
absent until there is something real to put in them. Empty scaffolding is not progress.

## Getting started

Requires Node.js 20 or newer. Nothing else — no account, no hosted service, no
credentials.

```bash
npm install
npm run check
```

`npm run check` runs the dependency boundary guard, the format check, the typecheck,
and the test suite.

The SDK is currently a skeleton. The next milestone is verifying a delegated authority
token, mapping the requested action into an AuthZEN-compatible decision, and returning
a result a developer can act on — locally, with no service. See the
[roadmap](ROADMAP.md).

## Project maturity

Honest accounting of where this stands:

|                    |                                                                         |
| ------------------ | ----------------------------------------------------------------------- |
| Standards profile  | Direction set; specific revisions not yet pinned.                       |
| TypeScript SDK     | Skeleton only. Not yet published to npm.                                |
| MCP / A2A bindings | Not started.                                                            |
| Conformance suite  | Not started.                                                            |
| Security review    | None. No formal audit, no certification, no threat model published yet. |
| External adopters  | None yet.                                                               |
| Governance         | Founder-led. See [GOVERNANCE.md](GOVERNANCE.md).                        |

If you are evaluating OAAF for production use: it is too early. If you are interested
in shaping how these standards fit together before that calcifies, this is the useful
moment.

## Contributing

Design critique is worth more than code right now, particularly from people who have
operated agent systems or IAM infrastructure in anger — and especially from anyone
working on the standards OAAF builds on. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[rfcs/README.md](rfcs/README.md).

To report a security issue, see [SECURITY.md](SECURITY.md).

## License

[Apache License 2.0](LICENSE). Maintained by Edwin Digital LLC as initial steward.

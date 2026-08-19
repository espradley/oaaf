# OAAF — Open Agent Authority Framework

OAAF is an open interoperability framework for carrying, enforcing, and verifying
delegated authority across AI agents and tools.

It makes existing identity, authorization, delegation, and evidence standards practical
across MCP, A2A, and agent runtimes without introducing another competing authorization
protocol.

> **Status: Core 1.0 interoperability contract frozen; reference implementations published.**
> A frozen, implementation-independent conformance contract, TypeScript ([`@oaaf/sdk`](https://www.npmjs.com/package/@oaaf/sdk))
> and Python ([`oaaf`](https://pypi.org/project/oaaf/)) implementations, a portable
> [conformance corpus](spec/0.1/conformance/vectors/README.md) and a [cross-language runner](spec/0.1/conformance/runner.md).
> It is **not** independently security-audited and has no production adopters yet — see
> [Project maturity](#project-maturity) before you plan around it.

<!-- prettier-ignore -->
> **For standards maintainers (AuthZEN · A2A · MCP · IETF):** OAAF _profiles_ your work rather
> than competing with it. Frozen [Core 1.0 contract](spec/0.1/conformance/oaaf-1.0.md) ·
> [AAT→AuthZEN profile](rfcs/0001-aat-authzen-enforcement-profile.md) ·
> [MCP/COAZ](rfcs/0002-mcp-coaz-binding.md) · [A2A extension](rfcs/0003-a2a-binding.md) ·
> [standards & how to engage](docs/standards.md).

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

**See it work in one command** — an MCP `tools/call` allowed, and a structurally valid
one denied before the authorization PDP is ever consulted:

```bash
npm install
npm run demo:mcp
```

If you maintain an MCP server or gateway, start with
[examples/mcp-tool-guard](examples/mcp-tool-guard/) — it answers "where does OAAF sit
in my request path?" in about five minutes.

**The core idea in one demo** — the _same_ delegated authority enforced identically across
both an MCP tool call and an A2A agent handoff:

```text
        SAME AUTHORITY CHAIN  (Alice → Bob, narrowed to repo.read)
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
         MCP                   A2A
     Agent → Tool          Agent → Agent
     read ALLOW · merge DENY   read ALLOW · merge DENY
```

`npm run demo:cross` runs it. The authority is not owned by the transport — that is what
OAAF is for.

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
  around them — there is a runnable [MCP tool-guard example](examples/mcp-tool-guard/)
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

To see authority actually enforced — a delegated agent refused a path it gave up:

```bash
npm run demo
```

The SDK verifies an AAT `-01` delegation chain, maps the request into an AuthZEN 1.0
decision, and explains any denial. See [`@oaaf/sdk`](packages/typescript/README.md) and
the [quickstart](examples/quickstart/index.js).

**Inspect a decision locally** — see an ALLOW and two DENYs, and why, with no integration
code:

```bash
npm run inspect -- --example allow
npm run inspect -- --example deny-argument
```

The [authority inspector](examples/inspector/) is local, offline, and privacy-safe by
default (names, never values).

### Adding OAAF to your own project

The steps above use this monorepo to _try_ OAAF. **Adopting** it does not — you install the
published SDK into your own project:

```bash
npm install @oaaf/sdk
```

`@oaaf/sdk` is published on npm (and `oaaf` on PyPI). The whole path from discovering OAAF to
depending on it is mapped, step by step, in the
[outsider adoption journey](docs/adoption-journey.md).

## The standards underneath

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

## Project maturity

Honest accounting of where this stands:

|                       |                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core contract         | **OAAF Core 1.0 — frozen.** [What is OAAF 1.0?](spec/0.1/conformance/oaaf-1.0.md), hash-pinned by a [freeze manifest](spec/0.1/conformance/manifest.json).   |
| Standards profile     | AAT `-01` (pinned, self-contained via the [AAT profile](spec/0.1/conformance/aat-profile.md)) and AuthZEN 1.0 **Final**. See [standards](docs/standards.md). |
| TypeScript SDK        | Published on npm as [`@oaaf/sdk`](https://www.npmjs.com/package/@oaaf/sdk).                                                                                  |
| Python implementation | Independent; published on PyPI as [`oaaf`](https://pypi.org/project/oaaf/).                                                                                  |
| MCP / COAZ binding    | Shipped (O3A): an enforcement precondition in front of the COAZ/AuthZEN path.                                                                                |
| A2A binding           | Shipped (O3B): OAAF authority as an A2A extension, verified before work.                                                                                     |
| PDP interoperability  | Shipped (O5E): conveys verified authority to an existing PDP; the PDP still owns policy.                                                                     |
| Identity / revocation | External subject identity binding (SPIFFE/OIDC/WIMSE) and a status/revocation resolver contract.                                                             |
| Conformance suite     | Portable conformance corpus (51 vectors) + implementation-independent [runner](spec/0.1/conformance/runner.md); TypeScript and Python both certified.        |
| Security testing      | Adversarial security certification against OAAF's normative invariants — 41 attacks ([security.md](spec/0.1/conformance/security.md)).                       |
| Independent audit     | **Not performed.** No independent professional security audit has taken place.                                                                               |
| External adopters     | None yet ([ADOPTERS.md](ADOPTERS.md) is empty by design — verified, voluntary entries only).                                                                 |
| Governance            | Founder-led. See [GOVERNANCE.md](GOVERNANCE.md).                                                                                                             |

The interoperability contract is frozen and the implementations are published, but OAAF has not
had an independent security audit and has no production adopters yet. If you are interested in
shaping how these standards fit together — or in implementing the contract independently — this
is the useful moment.

## Governance and policies

OAAF is maintained by Edwin Digital LLC, founder-led today and designed to evolve. How
decisions are made, how normative changes go through RFCs, how versions and compatibility
work, and how to report a vulnerability are written down:
[GOVERNANCE](GOVERNANCE.md) · [CONTRIBUTING](CONTRIBUTING.md) · [SECURITY](SECURITY.md) ·
[versioning & compatibility](docs/versioning-and-compatibility.md) ·
[extensions](docs/extensions.md) · [adoption journey](docs/adoption-journey.md) ·
[adopters](ADOPTERS.md).

## Contributing

Design critique is worth more than code right now, particularly from people who have
operated agent systems or IAM infrastructure in anger — and especially from anyone
working on the standards OAAF builds on. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[rfcs/README.md](rfcs/README.md).

To report a security issue, see [SECURITY.md](SECURITY.md).

## License

[Apache License 2.0](LICENSE). Maintained by Edwin Digital LLC as initial steward.

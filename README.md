# OAAF — Open Agent Authority Framework

**Your AI agent has credentials. But is it actually allowed to do this?**

OAAF is an open protocol for proving what an AI agent is allowed to do, and for making
that authority portable, delegable, revocable, and auditable across agent runtimes.

> **Status: early specification.** The protocol is being designed in the open and is
> not yet implemented. Nothing here is production-ready, security-audited, or stable.
> See [Project maturity](#project-maturity) before you plan around it.

## The problem

Agent frameworks are getting good at planning, tool use, and coordination. Permissions
have not kept up. Most systems still express what an agent may do as application
config, an API key, or a tool allow-list. That works until the agent has broader
credentials than the task requires — which is nearly always, because credentials are
issued to the process, not to the intent.

An API key answers _"can this process reach the API?"_ It does not answer _"is this
actor authorized to perform this action, right now, under authority someone can point
to afterward?"_

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

OAAF is aimed first at the infrastructure layer — the people who end up owning this
problem whether or not they wanted to:

- **MCP server maintainers** who expose consequential tools and need scoped
  authority around them
- **Agent framework authors** who need an authorization primitive that is not
  reinvented per integration
- **Tool gateway and proxy operators** enforcing what reaches a downstream system
- **Security and IAM teams** evaluating what autonomous agents may do

If you are building any of these, the alternative to OAAF is writing an authorization
system yourself. That is the comparison OAAF has to win.

## What OAAF is not

- Not an agent framework
- Not a model
- Not an orchestration engine
- Not an IAM replacement — OAAF sits above workload identity and integrates with it
- Not a workflow product
- Not DigitalStack360, and not an open-source edition of it

OAAF deliberately says nothing about which agent should do a task, in what order work
should happen, or how an organization should run its AI workforce. Those are real
problems; they belong to products built on top of OAAF. The boundary is written down
in [CHARTER.md](CHARTER.md) and is enforced in CI.

It also aims to invent as little as possible. Where OAuth, SPIFFE, MCP authorization,
AuthZEN, OPA, Cedar, or OpenFGA already solve a problem, OAAF intends to adopt or
profile them rather than compete with them.

## Repository layout

```text
spec/0.1/              protocol specification and architecture
packages/typescript/   @oaaf/sdk — TypeScript SDK
rfcs/                  protocol change proposals
docs/adr/              architecture decision records
scripts/               repository checks, including the dependency boundary guard
```

Directories from the planned structure — `reference/`, `examples/`, `tests/` — are
absent until there is something real to put in them. Empty scaffolding is not
progress.

## Getting started

Requires Node.js 20 or newer. Nothing else — no account, no hosted service, no
credentials.

```bash
npm install
npm run check
```

`npm run check` runs the dependency boundary guard, the format check, the typecheck,
and the test suite.

Today the SDK exposes only the spec version it targets. Protocol types arrive through
the RFC process rather than by accretion — see [rfcs/README.md](rfcs/README.md). The
goal for the next phase is that `npm install @oaaf/sdk` followed by a short TypeScript
example gets you a real allow/deny decision locally in under ten minutes; see the
[roadmap](ROADMAP.md).

## Project maturity

Honest accounting of where this stands:

|                                        |                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Specification                          | Draft. Core concepts identified; wire format not settled.               |
| TypeScript SDK                         | Skeleton only. Not yet published to npm.                                |
| Reference verifier / authority service | Not started.                                                            |
| Conformance suite                      | Not started.                                                            |
| Security review                        | None. No formal audit, no certification, no threat model published yet. |
| External adopters                      | None yet.                                                               |
| Governance                             | Founder-led. See [GOVERNANCE.md](GOVERNANCE.md).                        |

If you are evaluating OAAF for production use: it is too early. If you are interested
in shaping an authority model before it calcifies, this is the useful moment.

## Contributing

Design critique is worth more than code right now, particularly from people who have
operated agent systems or IAM infrastructure in anger. See
[CONTRIBUTING.md](CONTRIBUTING.md) and [rfcs/README.md](rfcs/README.md).

To report a security issue, see [SECURITY.md](SECURITY.md).

## License

[Apache License 2.0](LICENSE). Maintained by Edwin Digital LLC as initial steward.

# Contributing to OAAF

Thanks for considering it. This is an early project, and the most valuable
contribution right now is not code — it is someone with real operational scars telling
us where the authority model breaks.

## What is most useful right now

1. **Design critique.** Does the grant/capability/constraint model survive contact
   with your system? Where does it fall apart? Open an issue or an RFC.
2. **Adversarial thinking.** How would you defeat a verifier built to this spec?
   Delegation widening, replay, revocation bypass, and lineage forgery are the
   interesting attacks.
3. **Interoperability reports.** If the model cannot express something your agent
   runtime needs, that is a specification bug and we want to hear it.
4. **Scope pushback.** If something in the repository is drifting past
   [CHARTER.md](CHARTER.md), say so. That is a real contribution and it is welcome
   from anyone.

Code contributions are welcome. A small, focused fix or a well-scoped adapter is easy to
review; a large change to authorization behavior should start as an issue or an RFC (see
below) so the design is agreed before the code exists.

## Before you build something large

Open an issue first. This is not bureaucracy: OAAF's scope is deliberately narrow, and
we would rather tell you "that belongs in a layer above OAAF" in a two-line issue
comment than after you have written a thousand lines.

**Small fix vs normative change.** A typo, a doc fix, a test, or a bug fix that preserves
behavior is an ordinary pull request — no RFC. A change to authorization behavior —
delegation, narrowing, constraint subsumption, proof of possession, the reason codes, the
explanation contract, or a transport binding — is normative and goes through the
[RFC process](rfcs/README.md). When unsure which one you have, open an issue and ask.

## Development

Requires Node.js 20 or newer. Nothing else — no account, no hosted service, no
credentials. If any step here requires access to a third-party service, that is a bug;
please report it.

```bash
npm install
npm run check
```

`npm run check` runs everything CI runs:

| Command                  | Purpose                     |
| ------------------------ | --------------------------- |
| `npm run check:boundary` | Dependency boundary guard   |
| `npm run format:check`   | Prettier                    |
| `npm run typecheck`      | TypeScript, including tests |
| `npm test`               | Vitest                      |

`npm run format` fixes formatting. `npm run test:watch` reruns tests as you edit.

The full check should finish in seconds. If it starts taking minutes, that is a
problem worth reporting.

## The dependency boundary

OAAF must build, test, and release with no knowledge of any downstream commercial
product. `npm run check:boundary` enforces this and fails CI on violation. If it fires
on your change, the fix is to remove the dependency, not to add an exemption. See
[CHARTER.md](CHARTER.md) and [ADR-0001](docs/adr/0001-oaaf-digitalstack360-separation.md).

The same rule applies to vocabulary. OAAF concepts, type names, profile fields, and
enum values use the neutral vocabulary in the charter — never vendor or product terms.

## The reserved-IP boundary

Some execution-control concepts — continuity, supersession, recovery, fencing, scheduling,
worker selection, and the like — are reserved and must not enter OAAF. See
[ADR-0002](docs/adr/0002-reserved-execution-continuity-semantics.md) and the charter's
[reserved concepts](CHARTER.md#reserved-concepts). A contribution that would model any of
them belongs in a product built on OAAF, not in OAAF.

## Compatibility

Compatibility-sensitive surfaces — public APIs, reason codes, the explanation contract,
and the bindings — are changed deliberately, documented, and tested, even pre-v1. If your
change touches one, say so in the PR and follow
[versioning-and-compatibility.md](docs/versioning-and-compatibility.md).

## Pull requests

- Branch from `main`.
- Keep the change focused. One concern per PR.
- Add tests for behavior changes.
- Run `npm run check` before pushing.
- Sign off your commits with `git commit -s`, certifying the
  [Developer Certificate of Origin](https://developercertificate.org/). There is no
  CLA.

Commit messages: a short imperative subject line, and a body explaining _why_ when the
reason is not obvious. No required prefix scheme.

## Security-sensitive changes

Changes to cryptography, verification, delegation, scope/constraint subsumption, proof of
possession, canonicalization, revocation, or a transport binding get extra review scrutiny
and must carry adversarial tests, not just happy-path ones. See
[GOVERNANCE.md](GOVERNANCE.md) for how that review works today and how it grows.

To report a _vulnerability_, do not use issues or pull requests — see
[SECURITY.md](SECURITY.md).

## Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Rigorous
critique of designs is welcome; hostility toward people is not.

## AI-assisted contributions

Using an AI assistant to help write a contribution is fine. What matters is that **you own
the contribution regardless of how it was produced**: you understand the code you submit,
you are responsible for its correctness, its tests, its security, and its license and
provenance, and your `Signed-off-by` (the DCO, below) applies to it exactly as it would to
hand-written code. Do not submit code you do not understand or cannot stand behind.

## License

Contributions are licensed under the [Apache License 2.0](LICENSE), certified by your
`Signed-off-by` line ([DCO](https://developercertificate.org/); `git commit -s`). There is
no CLA.

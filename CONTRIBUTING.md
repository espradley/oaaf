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

Code contributions are welcome too — but the protocol surface is intentionally
undefined until the relevant RFC lands, so a large implementation PR right now is
likely to be premature.

## Before you build something large

Open an issue first. This is not bureaucracy: OAAF's scope is deliberately narrow, and
we would rather tell you "that belongs in a layer above OAAF" in a two-line issue
comment than after you have written a thousand lines.

Protocol changes go through the [RFC process](rfcs/README.md).

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

The same rule applies to vocabulary. Protocol concepts, type names, schema fields, and
enum values use the neutral vocabulary in the charter — never vendor or product terms.

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

## Security

Do not report vulnerabilities through issues or pull requests. See
[SECURITY.md](SECURITY.md).

## Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Rigorous
critique of designs is welcome; hostility toward people is not.

## License

Contributions are licensed under the [Apache License 2.0](LICENSE).

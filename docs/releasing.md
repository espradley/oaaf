# Releasing `@oaaf/sdk`

`@oaaf/sdk` is published on npm and `oaaf` on PyPI. Publishing a new version is a deliberate,
owner-performed action, not an automated one. This runbook keeps it a short mechanical
checklist. (Moving publishing to Trusted Publishing / OIDC from CI is tracked separately as
REL-1 on the [roadmap](../ROADMAP.md).)

## Pre-publish gate (already enforced in CI)

Every change already runs these; run them locally before a release too:

```bash
npm run check           # boundary, no-telemetry, governance, format, typecheck, tests
npm run check:package   # pack the SDK, install it into a throwaway project, use it via public paths
```

`check:package` is the important one for release: it certifies the _packed artifact_ an
outsider would download — not the monorepo — compiles against the shipped declarations and
runs ALLOW/DENY, both bindings, and the explanation through public import paths only.

## Publish

```bash
# from packages/typescript, after `npm run build` at the repo root
npm publish --access public
```

Then verify the published artifact is what CI certified:

```bash
npm view @oaaf/sdk version
# in a fresh directory:
npm install @oaaf/sdk && node -e "import('@oaaf/sdk').then(m => console.log(Object.keys(m).length, 'exports'))"
```

## After publish

- Update [`packages/typescript/CHANGELOG.md`](../packages/typescript/CHANGELOG.md) with the
  released version.
- Update the SDK README install note and the
  [adoption journey](adoption-journey.md#install--add-oaaf-to-your-project) to drop the
  "pending scope" caveat.
- Tag the release in git.

## Versioning

Follows the [versioning and compatibility policy](versioning-and-compatibility.md). The SDK
is pre-1.0; public API stability is documented there, and normative behavior changes go
through the [RFC process](../rfcs/README.md).

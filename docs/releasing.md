# Releasing `@oaaf/sdk`

Publishing is a deliberate, owner-performed action, not an automated one. This runbook
makes it a short mechanical checklist so that "the SDK is on npm" becomes a one-sitting task
the moment the `@oaaf` scope is owned.

## Prerequisite: own the `@oaaf` npm scope

The single blocker to a first publish. The package is `@oaaf/sdk` with
`publishConfig.access = "public"`; publishing requires an npm account that owns the `@oaaf`
organization/scope. This is a human ownership step (it needs npm credentials) and is tracked
in the [pre-launch checklist](pre-launch-checklist.md). Until it is done, the SDK is
installable only from a packed tarball or a git reference (see the SDK README).

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

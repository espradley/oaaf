# Pre-launch checklist

Operational items to settle before or shortly after OAAF is publicly promoted. None
block the foundation work; all are cheap now and awkward later.

A working list, not a governance document. Items are removed once done.

## Before public promotion

### GitHub security settings — done

Private vulnerability reporting, secret scanning, Dependabot alerts and security updates,
and branch protection on `main` are enabled and verified. The
[repository settings](repository-settings.md) doc records the verified state and the
remaining manual actions (npm scope, required review once a second maintainer exists).

### Confirm CI passes on GitHub Actions

Not only locally. `npm ci` on Linux is the one step that cannot be fully exercised on a
maintainer's machine.

## Deferred decisions

### Repository ownership and namespace

OAAF currently lives at `espradley/oaaf`, a personal namespace, while the copyright is
held by Edwin Digital LLC and the project is positioned as vendor-neutral
infrastructure.

An organization namespace reads better for a project inviting external contribution and
would make later governance transitions cleaner. Moving a repository is inexpensive
while nobody depends on the URL, and progressively more disruptive afterward — package
metadata, documentation links, integration references, and any published `@oaaf/*`
package all point at it.

Recorded as a branding and governance decision to make deliberately. Explicitly **not**
a blocker for the first release.

### npm organization for the `@oaaf` scope — ✅ done

Resolved: `@oaaf/sdk` is published on npm (and `oaaf` on PyPI). The first-publish blocker is
gone. Future publishing hardening (Trusted Publishing / OIDC) is tracked as REL-1 on the
roadmap.

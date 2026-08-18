# Pre-launch checklist

Operational items to settle before or shortly after OAAF is publicly promoted. None
block the foundation work; all are cheap now and awkward later.

A working list, not a governance document. Items are removed once done.

## Before public promotion

### Verify GitHub private vulnerability reporting is enabled

[SECURITY.md](../SECURITY.md) and [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) both
direct reporters to `https://github.com/espradley/oaaf/security/advisories/new`. That
URL returns 404 unless private vulnerability reporting is switched on under
Settings → Code security → Private vulnerability reporting.

A security policy whose only reporting channel is broken is worse than no policy: it
converts a private report into a public issue.

Deliberately not solved by inventing an email address — a published security contact
that bounces has the same failure mode.

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

### npm organization for the `@oaaf` scope

Needed before the first package publish. Should be resolved together with the namespace
decision above rather than separately.

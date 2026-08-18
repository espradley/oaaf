# Repository settings

Governance lives in files, but some of it lives in GitHub settings that a file cannot
assert. This records what is **verified enabled** versus what still needs a **manual
action**, so nothing is claimed complete that is not. Each "verified" line was checked
against the GitHub API, not assumed.

## Verified enabled

| Setting                         | State   | How it helps                                                                                      |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| Default branch                  | `main`  | —                                                                                                 |
| Visibility                      | public  | An outsider can inspect everything                                                                |
| Secret scanning                 | enabled | Catches committed credentials                                                                     |
| Dependabot vulnerability alerts | enabled | Flags vulnerable dependencies                                                                     |
| Dependabot security updates     | enabled | Opens fix PRs for vulnerable dependencies                                                         |
| Private vulnerability reporting | enabled | Makes the [SECURITY.md](../SECURITY.md) advisory link real                                        |
| Branch protection on `main`     | enabled | Requires the CI `Check (20)` and `Check (22)` jobs to pass; blocks force-push and branch deletion |

Branch protection is set with admin enforcement **off**, so the solo maintainer can still
push directly today. When a second maintainer exists, admin enforcement and required pull
request review should be turned on — see the pending list.

## Pending manual actions

These require a decision or a step that is deliberately not automated:

- [ ] **`@oaaf` npm scope + repository namespace.** Still under a personal namespace;
      moving to an organization is a branding/governance decision (tracked in the
      [pre-launch checklist](pre-launch-checklist.md)). Needed before the first package
      publish.
- [ ] **Required PR review + admin enforcement on `main`.** Turn on once a second
      maintainer exists; requiring review now would only block the sole maintainer.
- [ ] **Release provenance / signed releases.** Not set up. Revisit when the package is
      first published; npm provenance via CI is the likely mechanism.
- [ ] **CODEOWNERS review enforcement.** `.github/CODEOWNERS` exists, but "require review
      from code owners" is only meaningful once review is required — same gate as above.

## Re-checking

The verified list can be re-confirmed at any time with the GitHub API, e.g.
`gh api repos/espradley/oaaf` and `gh api repos/espradley/oaaf/branches/main/protection`.
Do not mark an item verified without checking it.

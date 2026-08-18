# Governance

OAAF is founder-led during v0.x. This document says so plainly rather than describing
a committee that does not exist.

## Current model

Edwin Digital LLC is the initial maintainer and trademark steward. Maintainers make
final decisions on scope, releases, and security response.

This is a deliberate choice, not an aspiration to permanence. A three-tier steering
structure with working groups and elected seats, created before there are external
contributors, is theater — it adds friction for the first contributor while
protecting nobody. The structure should grow when there are people to govern.

## How decisions get made

| Change                                                                               | Mechanism                                |
| ------------------------------------------------------------------------------------ | ---------------------------------------- |
| Bug fix, docs, tests, tooling                                                        | Pull request, one maintainer approval    |
| A change to what OAAF adopts, profiles, extends, or invents                          | [RFC](rfcs/README.md), then pull request |
| Change to the scope rule or the DigitalStack360 boundary in [CHARTER.md](CHARTER.md) | RFC plus an [ADR](docs/adr/README.md)    |
| Security-sensitive change                                                            | See below                                |

Anyone may open an RFC. Maintainer status is not required to propose a change, and it
is explicitly not required to argue that something is out of scope.

## Scope discipline

The most common way a project like this fails is not one bad decision. It is
fifty reasonable ones that each seemed useful. Maintainers are expected to apply the
litmus test in [CHARTER.md](CHARTER.md) and to reject in-scope-adjacent proposals
even when the implementation is good and offered for free.

"Would be useful" is not an argument for inclusion. "An independent system cannot
represent, verify, or audit authority without it" is.

## Security-sensitive changes

Once at least two maintainers exist, changes to signing, verification, delegation
narrowing, or revocation require **two maintainer approvals**. Until then,
such changes are held for external review before release rather than approved by a
single person on a short timeline.

Vulnerability reports follow [SECURITY.md](SECURITY.md).

## Versioning and compatibility

- The specification and the SDKs are versioned separately. Several SDK releases may
  target one spec version.
- Packages follow semantic versioning. Pre-1.0, breaking changes may occur in minor
  releases and are called out in release notes.
- A spec version, once tagged, is not silently edited. Corrections that change meaning
  produce a new version.

## Contributor licensing

Contributions are accepted under the [Developer Certificate of Origin](https://developercertificate.org/),
signalled with a `Signed-off-by` line (`git commit -s`). No CLA. A CLA would be
friction with no benefit at this stage; if counsel later advises otherwise, the change
will be announced before it takes effect.

## Becoming a maintainer

There is no application process yet. Sustained, high-quality contribution —
particularly design review and adversarial testing — is the path. When external
maintainers are added, this document will describe the process that was actually used.

## Pending governance decisions

Repository ownership and the `@oaaf` npm scope are currently under a personal
namespace. Moving them to an organization is a branding and governance decision to be
made deliberately, and is tracked in the
[pre-launch checklist](docs/pre-launch-checklist.md). It does not block the first
release.

## A future steering group

A Technical Steering Group will be formed when there are real external contributors
with a stake in the outcome — not before. When that happens it will be established by
RFC, and the concentration of authority described above will be reduced accordingly.

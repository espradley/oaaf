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

A normative RFC is expected to work through a fixed set of questions — problem, standards
research, alternatives, security, interoperability, compatibility, reserved-IP, and
test/conformance implications — before a maintainer records a disposition. The
[RFC template](rfcs/0000-template.md) carries that checklist. An **RFC** freezes a
normative or architectural contract; an **ADR** records an implementation or project
decision; an ordinary **pull request** is non-normative maintenance.

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

## Releases and versioning

Today, the maintainer cuts releases. There is no automated release pipeline yet; a
release is a reviewed, tested commit, tagged, with the package published manually once the
`@oaaf` npm scope exists (tracked in the [pre-launch checklist](docs/pre-launch-checklist.md)).

How versions move — package vs contract vs binding, and what counts as patch/minor/major
— is defined in [versioning-and-compatibility.md](docs/versioning-and-compatibility.md).
The short version: several package releases may target one contract version; a tagged
contract version is not silently edited; and compatibility-sensitive behavior is changed
deliberately, documented, and tested even pre-v1.

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

## Project identity and "OAAF-conformant"

OAAF is an Edwin Digital LLC open-source effort, and Edwin Digital is the initial
trademark steward for the name. That stewardship exists to prevent one thing: an
incompatible implementation implying it is _official_ or _OAAF-maintained_ when it is not.

It is explicitly **not** meant to prevent independent implementations. The intended
end-state is that anyone can build a conformant implementation and describe it as
**"OAAF-conformant"** (once the O6 conformance suite exists to define that), without
implying it is the official one. "Works with OAAF" and "OAAF-conformant" are open to
anyone; "the official OAAF implementation" is not a claim a third party should make.

Any formal trademark registration or legal step is out of scope here and would be a
separate decision with counsel. This section states intent, not a legal filing.

## Technical governance is vendor-neutral

Edwin Digital maintains OAAF, but the technical decision rules above do not privilege
Edwin Digital's commercial interests. A maintainer from another company can contribute,
open RFCs, and argue scope on equal footing — the litmus test in
[CHARTER.md](CHARTER.md) is the arbiter, not any vendor's roadmap.

The one hard boundary is technical, not commercial: the
[reserved execution-control concepts](docs/adr/0002-reserved-execution-continuity-semantics.md)
stay out of OAAF. That is a scope boundary that applies to _everyone_, including Edwin
Digital — it is not a mechanism for Edwin Digital to veto contributions it simply dislikes.
A maintainer may reject a contribution for being out of charter scope, insecure, or
untested; "it competes with our product" is not a valid reason and the governance does not
provide for it.

Extensions and bindings follow the [extension policy](docs/extensions.md).

## A future steering group

A Technical Steering Group will be formed when there are real external contributors
with a stake in the outcome — not before. When that happens it will be established by
RFC, and the concentration of authority described above will be reduced accordingly.

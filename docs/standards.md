# Standards OAAF profiles, and how to engage

OAAF **implements and profiles existing standards; it does not replace them.** There is no OAAF
wire format. OAAF's job is to make identity, authorization, delegation, and status standards work
together for delegated authority across AI agents and tools — and to say precisely, in public,
which options it selects and how they compose.

This page is for maintainers of those standards. If you work on AuthZEN, A2A, MCP, an IETF OAuth
draft, or a workload-identity spec, this is how OAAF uses your work and how to raise an issue with
how it does so.

## What OAAF adopts and profiles

| Standard                                | How OAAF uses it                                                                                                | Where                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **AuthZEN Authorization API 1.0**       | The decision model. OAAF maps a verified authority into an AuthZEN request; the PDP decides.                    | [RFC-0001](../rfcs/0001-aat-authzen-enforcement-profile.md)                                                        |
| **AAT** (`draft-…-agent-tokens-01`)     | The delegated-authority token and verification mechanism OAAF verifies.                                         | [RFC-0001](../rfcs/0001-aat-authzen-enforcement-profile.md), [AAT profile](../spec/0.1/conformance/aat-profile.md) |
| **COAZ** (AuthZEN MCP profile)          | The MCP→AuthZEN mapping. OAAF inserts an authority precondition before it; it does not redefine the mapping.    | [RFC-0002](../rfcs/0002-mcp-coaz-binding.md)                                                                       |
| **A2A 1.0.1**                           | The agent transport. OAAF authority is carried as an A2A extension, verified before work.                       | [RFC-0003](../rfcs/0003-a2a-binding.md)                                                                            |
| **SPIFFE / WIMSE / OIDC**               | External subject identity. OAAF binds authority to an identity these establish; it is not an identity provider. | [RFC-0005](../rfcs/0005-external-subject-identity-binding.md)                                                      |
| **Token Status List / RFC 7009 / 7662** | External status/revocation truth OAAF consumes via a resolver contract; OAAF operates no revocation service.    | [RFC-0004](../rfcs/0004-authority-status-revocation.md)                                                            |
| **JOSE / JWT / JCS / JWK Thumbprint**   | Signatures, canonicalization, and key identity.                                                                 | [AAT profile](../spec/0.1/conformance/aat-profile.md)                                                              |

The exact pinned versions, their stability, and OAAF's v1 classification (STABLE / PINNED /
EXPERIMENTAL) are in the [standards-readiness audit](../spec/0.1/conformance/standards-readiness.md).

## Where the conformance evidence lives

OAAF's behavior is defined by observable requirements, not by its reference code:

- [Requirement catalog](../spec/0.1/conformance/requirements.json) — the normative requirements.
- [Portable corpus](../spec/0.1/conformance/vectors/README.md) — language-neutral vectors any
  implementation can consume without OAAF code.
- [Conformance runner](../spec/0.1/conformance/runner.md) — drives any implementation via a small
  adapter protocol and reports self-declared results.
- [Security certification](../spec/0.1/conformance/security.md) — adversarial evidence per
  security invariant.
- [What is OAAF 1.0?](../spec/0.1/conformance/oaaf-1.0.md) — the frozen artifact set.

## How to raise an interoperability discrepancy

If OAAF profiles a standard in a way you think is wrong, incomplete, or diverges from the
standard's intent:

1. Open an [interoperability issue](https://github.com/espradley/oaaf/issues/new?template=interop_bug.md)
   (or a [standards / profile question](https://github.com/espradley/oaaf/issues/new?template=standards_question.md)
   if it's a question rather than a defect). Cite the standard section.
2. For a change to what OAAF adopts or how it composes standards, the
   [RFC process](../rfcs/README.md) is the venue — an RFC records the reasoning while changing
   course is still cheap.
3. Interoperability questions and standards interpretation are also welcome as
   [Discussions](https://github.com/espradley/oaaf/discussions).

## How OAAF handles upstream ambiguity

Where a standard is silent or ambiguous, OAAF makes an explicit, documented **profile** decision
(recorded in the relevant RFC) and, for security-sensitive gaps, **fails closed**. These
decisions are not hidden conventions — they are written down precisely so upstream can correct
them.

**Upstream corrections take precedence.** When a standard OAAF profiles later clarifies or
resolves something OAAF had to decide for itself, OAAF aligns with upstream, within the
[compatibility policy](../spec/0.1/conformance/compatibility.md) (additive alignment is a 1.x
change; a change that would break a previously-conformant implementation is a 2.0 change). OAAF's
[standards reconciliation](../spec/0.1/conformance/standards-readiness.md) re-checks this against
primary sources.

## What OAAF is not asking of you

OAAF is not proposing a competing standard and is not asking any standards body to adopt an
OAAF format. If a convention OAAF invented turns out to belong upstream, the right outcome is for
it to move upstream and for OAAF to profile it — not for OAAF to keep it. Engagement here is about
making the profile correct, not promoting the project.

## Contact

- Technical / interoperability question → a [GitHub issue](https://github.com/espradley/oaaf/issues/new/choose)
  or [Discussion](https://github.com/espradley/oaaf/discussions).
- A normative change → an [RFC](../rfcs/README.md).
- A security vulnerability → **privately**, per [SECURITY.md](../SECURITY.md) — not a public issue.

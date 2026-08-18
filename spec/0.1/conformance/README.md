# OAAF Conformance Specification

- **Conformance spec version:** `0.1` (pre-v1)
- **Status:** Draft — normative but not frozen. **This is not v1.** The v1 freeze is O6H's decision.
- **Normative language:** the key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD,
  SHOULD NOT, RECOMMENDED, MAY, and OPTIONAL are to be interpreted as described in
  BCP 14 ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119),
  [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they appear in
  capitals.

## What this document is

This specification defines what it means for an **independent** implementation to be
**OAAF-conformant**. It is written so that an implementation can satisfy it without using
the OAAF TypeScript SDK or Python package, without copying their internal architecture, and
without any OAAF-hosted service.

> **The reference implementations are evidence, not the definition.**
>
> Conformance is defined by observable behavior derived from adopted standards, the OAAF
> RFCs, the project's public contracts, the interoperability invariants already certified,
> the security requirements, and the documented compatibility commitments. "Behaves like the
> TypeScript implementation" is explicitly **not** the definition — that would defeat the
> purpose of a conformance program.

Every normative requirement lives in the machine-readable catalog
[`requirements.json`](requirements.json), each with a stable ID. The companion documents:

| Document                                 | Purpose                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`requirements.json`](requirements.json) | Canonical requirement catalog (the traceability spine).                                                                             |
| [classification.md](classification.md)   | The U/O/B/R/E/X normative-surface matrix; reason-code, stage, and explanation-field classification; experimental-feature treatment. |
| [standards.md](standards.md)             | Exact adopted-standard versions, status, and what OAAF inherits vs profiles.                                                        |
| [traceability.md](traceability.md)       | Existing shared vectors mapped to requirements, and the O6B coverage-gap list.                                                      |
| [reserved-ip.md](reserved-ip.md)         | Reserved-DigitalStack-IP assessment over every requirement.                                                                         |

## Requirement identifiers

Requirements use `PREFIX-GROUP-NNN`, e.g. `CORE-NARROW-001`, `STATUS-003`, `A2A-001`. The
prefix names the conformance class; the group names the behavior area; the number is stable.
IDs never encode a reference-implementation filename. They are the spine that O6B (vectors),
O6C (cross-language), O6D (bindings), and O6E (security) will trace back to.

Adding a requirement ID is a minor change; renaming or removing one is breaking, exactly as
for reason codes. O6H owns any renumbering at the v1 freeze.

## Conformance classes

Conformance is claimed per class. There is one mandatory class and five optional profiles, so
an implementation can be truthful about what it does without "certification bingo."

| Class        | Prefix   | What it covers                                                                                                                                                                                                                                                                                                          | Required for unqualified "OAAF-conformant"? |
| ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Core**     | `CORE`   | Portable authority verification and evaluation of a presented authority against a requested operation — cryptographic verification, trust anchors, delegation, attenuation/narrowing, constraints, expiry, proof of possession, canonical subject, fail-closed decision, and the privacy-safe decision/reason contract. | **Yes**                                     |
| **Status**   | `STATUS` | Revocation/status enforcement via the resolver contract (RFC-0004).                                                                                                                                                                                                                                                     | No — profile                                |
| **Identity** | `IDENT`  | External subject identity binding via the verifier contract (RFC-0005).                                                                                                                                                                                                                                                 | No — profile                                |
| **MCP**      | `MCP`    | The MCP/COAZ binding (RFC-0002).                                                                                                                                                                                                                                                                                        | No — profile                                |
| **A2A**      | `A2A`    | The A2A binding (RFC-0003).                                                                                                                                                                                                                                                                                             | No — profile                                |
| **PDP**      | `PDP`    | Existing-PDP interoperability / authority-context production (RFC-0006).                                                                                                                                                                                                                                                | No — profile                                |

Delegation, attenuation, and proof of possession are **inside Core**, not separate classes:
verifiable delegated, attenuated authority is OAAF's thesis, and RFC-0001 makes proof of
possession inseparable from enforcement. A single non-delegated token is simply a
one-element chain.

The privacy-safe **decision and reason contract** is Core; the exact explanation _shape_
(locators, stage labels, message wording) is not (see [classification.md](classification.md)).

## Mandatory Core

An implementation may call itself **`OAAF Core 0.1 conformant`** — and, unqualified,
**`OAAF-conformant`** — only if it satisfies every `MUST`/`MUST NOT` requirement in the
`Core` class of [`requirements.json`](requirements.json). In summary, Core requires:

- explicit trust anchors, with the root verified against an anchor, never against itself
  (`CORE-TRUST-001`, `CORE-TRUST-002`);
- cryptographic verification of every chain member, with algorithm-confusion and
  private-key-material rejected, and parent-thumbprint issuer linkage
  (`CORE-CRYPTO-001`…`CORE-CRYPTO-005`);
- root-to-leaf chain integrity (`CORE-CHAIN-001`…`CORE-CHAIN-003`);
- monotonic delegation depth and bounds (`CORE-DELEG-001`, `CORE-DELEG-002`);
- **no authority widening** across a delegation, and constraint narrowing only
  (`CORE-NARROW-001`…`CORE-NARROW-004`);
- constraint enforcement, including required-when-constrained arguments
  (`CORE-CONSTR-001`…`CORE-CONSTR-004`);
- expiry and validity-window containment (`CORE-TIME-001`…`CORE-TIME-003`);
- proof of possession that cannot be disabled while still returning a decision
  (`CORE-POP-001`…`CORE-POP-004`);
- a canonical subject distinct from the holder key (`CORE-SUBJ-001`, `CORE-SUBJ-002`);
- fail-closed decisions and transport-invariant semantics
  (`CORE-DEC-001`…`CORE-DEC-004`);
- a privacy-safe decision/reason contract (`CORE-EXPL-001`…`CORE-EXPL-004`);
- neutrality: no required transport, identity provider, PDP, hosted service, or shared code
  with a reference implementation (`CORE-NEUTRAL-001`…`CORE-NEUTRAL-005`).

Optional external infrastructure is never mandatory: Core is fully offline and expiry-bounded
unless a profile is claimed.

## Fail-closed doctrine

OAAF fails closed, and this is normative. Unknown, malformed, or unverifiable **required**
authority MUST NOT become ALLOW (`CORE-DEC-001`, `CORE-DEC-002`). Where a profile is claimed,
its unavailable-input case is specified as a denial: required status unavailable denies
(`STATUS-003`), a required identity binding unavailable denies (`IDENT-002`), an unsupported
required A2A extension refuses (`A2A-001`), and an invalid proof of possession denies
(`CORE-POP-003`). A profile that is _not_ claimed imposes none of these — fail-closed applies
to required inputs, and does not make optional profiles accidentally mandatory.

## Observable behavior, not algorithms

Requirements are stated as observable inputs, outputs, and security behavior. For example,
`CORE-NARROW-001` says _"a verifier MUST reject a delegation that grants authority absent from
its parent"_ — not _"use the verifyChain() algorithm."_ Independent implementations are free
to structure code differently; they must reach the same observable result.

## Neutrality guarantees

Core conformance is independent of transport (`CORE-NEUTRAL-001`), identity provider
(`CORE-NEUTRAL-002`), PDP (`CORE-NEUTRAL-003`), and any hosted service including revocation
(`CORE-NEUTRAL-004`). External identity systems establish identity; OAAF binds authority. A
PDP decides policy; OAAF decides authority validity (`PDP-001`). Status truth comes from a
deployment's resolver, not an OAAF service (`STATUS-006`).

## Conformance claim format

Conformance is **self-declared and self-verifiable**. OAAF operates no certification
authority, badge server, registry, approval process, or trademark-licensing gate for the
word "conformant." A claim names the classes satisfied and the conformance-spec version:

```text
OAAF Core 0.1 conformant
Profiles: Status 0.1, MCP 0.1
```

Unqualified **"OAAF-conformant"** means **Core**. An implementation that also satisfies a
profile's `MUST` requirements adds it to the `Profiles:` line. A claim MUST NOT assert a
profile whose `MUST` requirements are unmet, and MUST NOT imply "official OAAF
implementation" unless it actually is one — consistent with the project's governance and
trademark policy. OAAF does not "approve" an implementation merely because it makes a claim;
the claim is verifiable against this specification and (from O6B onward) the published
vectors.

## Relationship to the vector suite

This document defines _requirements_. [O6B](../../../ROADMAP.md) will turn them into versioned
fixtures. Every planned vector traces to one or more requirement IDs, and every testable
`MUST` should have a planned certification method; [traceability.md](traceability.md) records
the current mapping and the gaps O6B must close. The existing shared vectors are excellent
seeds — mapped here, **not** promoted to the final suite.

## Status of this specification

Draft, pre-v1, and deliberately not frozen. It may change as O6B–O6G proceed. The
experimental parts (Status wire mechanism, WIMSE identity) are isolated in
[classification.md](classification.md) and [standards.md](standards.md) so that unstable
upstream work cannot silently become a mandatory v1 requirement.

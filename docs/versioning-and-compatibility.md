# Versioning and compatibility

OAAF versions several different things, and they move independently. This document says
what each is, how it changes, and what compatibility a consumer can rely on before v1.0.

## The version streams

| Stream                         | What it versions                                                                                        | Where it lives                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Package version**            | The `@oaaf/sdk` npm package                                                                             | `packages/typescript/package.json`      |
| **Contract version**           | OAAF's normative authority profile — the meaning of a decision, the reason codes, the explanation shape | the accepted [RFCs](../rfcs/README.md)  |
| **Transport binding version**  | Each binding's own revision (e.g. the A2A extension `/v1`)                                              | the binding's RFC and its extension URI |
| **Adopted-standard revisions** | The exact upstream revisions OAAF profiles (AAT `-01`, AuthZEN 1.0, COAZ-MCP Draft 1, A2A 1.0.1)        | pinned in each RFC, never "latest"      |
| **Conformance-suite version**  | The cross-implementation test vectors                                                                   | O6 — does not exist yet                 |

Several package releases may target one contract version. A binding may revise without
the package's major version changing, and vice versa. When they interact, the RFC for the
change states which streams move.

## Semantic versioning of the package

`@oaaf/sdk` follows [SemVer](https://semver.org/). Pre-1.0, the leading `0.` means the
public surface is still settling — but see the pre-v1 principle below; "pre-1.0" is not a
license to break things carelessly.

**Patch** — no compatibility impact:

- a bug fix that preserves normative semantics
- a documentation correction
- a privacy-safe diagnostic fix that does not change a decision or an explanation field

**Minor** — additive, backward-compatible:

- a new public API that does not change existing behavior
- a new optional adapter or example
- an additive reason field or explanation field that existing consumers can ignore
- a new reason _code_ (additive; existing codes keep their meaning)

**Major** — breaking:

- a breaking change to a public TypeScript API
- an incompatible change to normative authority behavior (a decision that flips)
- a change to the _meaning_ of an existing reason code
- an incompatible change to the authority representation or the explanation contract

Adding a reason code is minor. Renaming or repurposing one is major.

## The pre-v1 principle

> Pre-v1 changes may occur, but compatibility-sensitive behavior is changed
> **deliberately, documented, and tested** — never casually.

Concretely, before v1.0:

- A change that would be "major" under SemVer may still ship in a `0.x` minor, because
  that is what `0.x` means. But it is called out in the release notes, it has a test that
  pins the new behavior, and — if it is normative — it went through an RFC.
- The 49 reason codes are treated as compatibility-sensitive now, not only after v1.
  Adding one is routine; changing one requires a deliberate, documented decision.
- The explanation contract (`DecisionExplanation` and its fields) is treated the same
  way: additive is routine, a shape change is deliberate and documented.

O6H owns the eventual decision to declare v1.0. This document does not declare it.

## What compatibility covers

The surfaces a consumer may build against, and how each is treated pre-v1:

| Surface                                      | Treatment                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| Public TypeScript APIs (`@oaaf/sdk` exports) | SemVer; breaking changes are deliberate and noted                            |
| Reason codes                                 | Compatibility-sensitive; additive is routine, meaning-changes are deliberate |
| Explanation contract (`DecisionExplanation`) | Additive is routine; shape changes are deliberate and documented             |
| Authority profile behavior (RFC-0001)        | Normative; changes go through an RFC                                         |
| MCP binding (RFC-0002)                       | Normative; changes go through an RFC; pinned to COAZ-MCP Draft 1             |
| A2A binding (RFC-0003)                       | Normative; changes go through an RFC; the extension carries its own `/v1`    |
| An eventual Python implementation            | Must match the same contract version; the contract is the shared truth       |
| An eventual conformance contract (O6)        | Versioned separately; the arbiter of "OAAF-conformant"                       |

## Deprecation

When a public surface is to be removed or changed incompatibly:

1. The replacement lands first, so there is a migration path before anything is removed.
2. The old surface is marked deprecated in code (a doc comment) and in the release notes,
   with what to use instead.
3. Removal happens in a later release — a major release once v1.0 exists — not in the
   same change that introduces the replacement.

Pre-v1, this sequence is followed for anything a consumer could reasonably have built
against; it is not a promise of indefinite support for every internal detail.

## Adopted-standard drift

OAAF profiles external standards, several of them still drafts. When an upstream revision
changes:

- OAAF stays pinned to the revision named in the relevant RFC until a deliberate upgrade.
- Upgrading is an RFC change (it is normative), which records the diff that mattered and
  re-pins the revision — the discipline used when A2A moved 1.0.0 → 1.0.1.
- OAAF never tracks "latest" implicitly.

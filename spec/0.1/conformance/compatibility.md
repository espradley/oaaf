# OAAF compatibility contract

Three things version **independently**, and conflating them is how interop projects break their
own promises. This document freezes how each one changes.

```
OAAF normative interoperability contract   ≠   @oaaf/sdk (TypeScript API)   ≠   oaaf (Python API)
```

## 1. The normative conformance contract

What "OAAF Core 1.0 conformant" means: the `Core`-class requirements in
[requirements.json](requirements.json), the frozen [reason-code set](reason-codes.json), the
[AAT-`-01` profile](aat-profile.md), and the [corpus](vectors/corpus.json). Profiles (`Status`,
`Identity`, `MCP`, `A2A`, `PDP`) version alongside it.

### Versioning

| Change                                                                                                                                                                                    | Version step                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Add a requirement, add a profile, add a normative reason code, add corpus vectors, add an optional claim                                                                                  | **1.x** (backward-compatible) |
| Rename/remove a normative reason code, change an existing requirement's meaning, tighten Core in a way that fails a previously-conformant implementation, change the AAT profile revision | **2.0** (breaking)            |

A 1.x implementation MUST remain 1.0-conformant. Diagnostic (non-normative) reason codes and
stage labels are **not** part of the contract and may change without a version step.

### Draft-backed profiles need extra care

OAAF Core is pinned to AAT `-01`. A future **AAT `-02` profile is a distinct artifact** — it does
**not** silently redefine what OAAF Core 1.0 meant. Concretely:

- OAAF Core 1.0 permanently means "the AAT `-01` profile" ([aat-profile.md](aat-profile.md)).
- An AAT `-02` compatibility profile, if ever created, ships as **OAAF Core 2.0** (or a clearly
  distinct `Core` revision), with its own corpus namespaced by AAT revision. Both can coexist.
- The same rule governs any draft-backed profile (Status/Token Status List, Identity/WIMSE): a
  new upstream revision is adopted only by an explicit new profile version, never in place.

This is what lets "conformant to OAAF Core 1.0" stay meaningful even after the underlying drafts
move.

## 2. Conformance claim syntax

A claim is **self-declared and self-verifiable**. OAAF operates no certification authority,
badge, or registry (see [README](README.md#conformance-claim-format)). The v1 syntax:

```
OAAF Core 1.0 conformant
Profiles: Identity 1.0, MCP 1.0, PDP 1.0
Corpus: sha256:<corpus hash>
Manifest: sha256:<manifest hash>
```

- **Line 1** names the mandatory class and contract version. Unqualified "OAAF-conformant" means
  Core.
- **Profiles** lists only the optional profiles whose `MUST` requirements are met — never a
  profile that is unclaimed or unmet.
- **Corpus / Manifest** pin the exact artifacts the claim was verified against, so a reader can
  reproduce it. The [runner](runner.md) emits these hashes; a claim without them is unverifiable.
- A claim MUST NOT imply "official OAAF implementation" or "OAAF-certified." OAAF does not approve
  implementations; the claim is checkable against the published artifacts.

## 3. The reference SDK APIs

`@oaaf/sdk` (TypeScript) and `oaaf` (Python) are **implementations**, and their public APIs
follow **their own semver**, decoupled from the conformance contract:

- An SDK **minor/patch** release may refactor function signatures, add helpers, or change
  ergonomics **without** changing the normative contract — it stays OAAF Core 1.0 conformant.
- An SDK **major** release may break its API while still targeting the same OAAF contract
  version; conversely, the contract can advance to 1.1 and an SDK adopt it in a minor release.
- SDK version numbers therefore MUST NOT be read as OAAF contract versions. The authoritative
  statement of what contract an artifact targets is the [manifest](manifest.json), not a package
  version.

This separation means the SDKs can evolve at implementation speed while the interoperability
contract changes only deliberately.

## What is explicitly out of scope of every version step

Reserved DigitalStack execution-control concepts (continuity, supersession, recovery, fencing,
freshness-as-execution-control) remain outside the contract entirely — see
[reserved-ip.md](reserved-ip.md) and ADR-0002. No OAAF version introduces them.

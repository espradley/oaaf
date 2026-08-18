# @oaaf/sdk

TypeScript SDK for the [Open Agent Authority Framework](https://github.com/espradley/oaaf).

> **Status: skeleton.** This package intentionally contains almost no code. It exists
> to establish the build, type, and test architecture. It is not published to npm yet.

## Why it is empty

OAAF adopts existing standards for authority, delegation, decisions, and evidence
rather than defining its own — see
[ADR-0003](../../docs/adr/0003-implement-existing-authority-standards.md). Which
standards, at which revisions, is still being settled through the
[RFC process](../../rfcs/README.md).

Shipping types before that is settled would bake in the wrong shapes, and a published
type is much harder to change than a proposal. The verification and decision surface
arrives with the first enforcement point; see the [roadmap](../../ROADMAP.md).

## What exists today

```ts
import { OAAF_SPEC_VERSION, isSupportedSpecVersion } from '@oaaf/sdk';

OAAF_SPEC_VERSION; // '0.1'

isSupportedSpecVersion('0.1'); // true
isSupportedSpecVersion('0.2'); // false — refuse rather than guess
```

Spec versions are independent of this package's version: several SDK releases may
target one spec version.

## License

[Apache 2.0](../../LICENSE)

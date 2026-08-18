# @oaaf/sdk

TypeScript SDK for the [Open Agent Authority Framework](https://github.com/espradley/oaaf).

> **Status: skeleton.** This package intentionally contains almost no code. It exists
> to establish the build, type, and test architecture. It is not published to npm yet.

## Why it is empty

OAAF's protocol types — authority grants, capabilities, resources, constraints,
delegation, decisions, and evidence — are deliberately not defined
here.

Writing them now would freeze protocol semantics before they have been argued through
the [RFC process](../../rfcs/README.md), and a type that ships is much harder to change
than a proposal that has not. The protocol surface arrives with RFC-0001 onward; see
the [roadmap](../../ROADMAP.md).

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

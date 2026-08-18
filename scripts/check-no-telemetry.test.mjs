import { describe, expect, it } from 'vitest';

import { findNetworkUse, isNetworkSpecifier } from './check-no-telemetry.mjs';

describe('isNetworkSpecifier', () => {
  it('flags network-capable modules, node:-prefixed and subpathed', () => {
    for (const specifier of [
      'http',
      'node:https',
      'node:net',
      'dns/promises',
      'undici',
      'node-fetch',
      'axios',
      'ws',
    ]) {
      expect(isNetworkSpecifier(specifier), specifier).toBe(true);
    }
  });

  it('allows crypto/JSON deps, relative paths, and non-network builtins', () => {
    for (const specifier of [
      'jose',
      'canonicalize',
      './identity.js',
      '../reasons.js',
      'node:crypto',
      'node:util',
      // contains "net" as a substring but is not the net module
      'network-fixtures',
    ]) {
      expect(isNetworkSpecifier(specifier), specifier).toBe(false);
    }
  });
});

describe('findNetworkUse', () => {
  it('detects imports and runtime network primitives', () => {
    expect(findNetworkUse("import https from 'node:https';")).toHaveLength(1);
    expect(findNetworkUse("const x = await import('undici');")).toHaveLength(1);
    expect(findNetworkUse('await fetch("https://x.example");')).toHaveLength(1);
    expect(findNetworkUse('new WebSocket(url);')).toHaveLength(1);
    expect(findNetworkUse('navigator.sendBeacon(u, d);')).toHaveLength(1);
  });

  it('does not flag identifier URLs or crypto imports', () => {
    expect(findNetworkUse("export const URI = 'https://oaaf.dev/a2a/authority/v1';")).toEqual([]);
    expect(findNetworkUse("import { CompactSign } from 'jose';")).toEqual([]);
    expect(findNetworkUse("import { canonicalize } from 'canonicalize';")).toEqual([]);
  });
});

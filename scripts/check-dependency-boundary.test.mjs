import { describe, expect, it } from 'vitest';

import {
  findForbiddenDependencies,
  findForbiddenImports,
  isForbiddenSpecifier,
} from './check-dependency-boundary.mjs';

describe('isForbiddenSpecifier', () => {
  it('rejects forbidden packages and their subpaths', () => {
    for (const specifier of [
      'digitalstack',
      'digitalstack360',
      'dstack',
      '@digitalstack/runtime-host',
      '@digitalstack/runtime-host/client',
      'DigitalStack',
    ]) {
      expect(isForbiddenSpecifier(specifier), specifier).toBe(true);
    }
  });

  it('allows unrelated packages, relative paths, and node builtins', () => {
    for (const specifier of [
      'vitest',
      '@oaaf/sdk',
      './index.js',
      '../shared/util.js',
      'node:fs',
      // Not a substring match: these merely contain a forbidden word.
      'digitalstack-lookalike',
      '@notdigitalstack/thing',
    ]) {
      expect(isForbiddenSpecifier(specifier), specifier).toBe(false);
    }
  });
});

describe('findForbiddenImports', () => {
  it('detects static, dynamic, side-effect, and require forms', () => {
    const source = [
      "import { a } from '@digitalstack/runtime-host';",
      "const b = await import('digitalstack360');",
      "import 'dstack';",
      "const c = require('@dstack/core');",
    ].join('\n');

    expect(findForbiddenImports(source).sort()).toEqual([
      '@digitalstack/runtime-host',
      '@dstack/core',
      'digitalstack360',
      'dstack',
    ]);
  });

  it('ignores prose that merely names the commercial product', () => {
    const source = '// DigitalStack360 may depend on OAAF; OAAF must never depend on it.';
    expect(findForbiddenImports(source)).toEqual([]);
  });
});

describe('findForbiddenDependencies', () => {
  it('flags forbidden packages across every dependency field', () => {
    const manifest = {
      dependencies: { '@digitalstack/runtime-host': '^1.0.0', vitest: '^2.0.0' },
      devDependencies: { dstack: '*' },
      peerDependencies: {},
    };

    expect(findForbiddenDependencies(manifest)).toEqual([
      { field: 'dependencies', name: '@digitalstack/runtime-host' },
      { field: 'devDependencies', name: 'dstack' },
    ]);
  });

  it('passes a clean manifest', () => {
    expect(findForbiddenDependencies({ dependencies: { typescript: '^5.7.2' } })).toEqual([]);
  });
});

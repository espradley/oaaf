#!/usr/bin/env node
/**
 * OAAF no-telemetry / no-phone-home guard (O5F).
 *
 * An outsider must be able to install and run `@oaaf/sdk` with the confidence
 * that it never contacts the network — no usage reporting, no license check, no
 * "call home." OAAF measures adoption from *outside* (GitHub traffic, npm
 * downloads, integration issues), never from telemetry baked into the SDK.
 *
 * This guard makes that property enforced rather than merely promised: it fails
 * if the shipped SDK source gains a network-capable import or a runtime network
 * primitive. It scans what an outsider actually installs — `packages/typescript/src`
 * (the source the published `dist/` is built from) — excluding tests, which do
 * not ship.
 *
 * It is deliberately narrow. It bans network *reachability* in the SDK, not the
 * word "http": RFC/extension identifier URLs are strings, not calls, and are
 * fine. A build edge that could open a socket is not.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The shipped SDK source. Tests and build output are not published. */
const SCAN_ROOT = path.join('packages', 'typescript', 'src');
const IGNORED_DIRECTORIES = new Set(['__tests__', 'node_modules', 'dist', 'coverage']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs']);

/**
 * Node built-ins and packages that can open a network connection. Matched as a
 * whole module specifier (optionally `node:`-prefixed), never as a substring.
 */
export const NETWORK_MODULES = [
  'http',
  'https',
  'http2',
  'net',
  'tls',
  'dgram',
  'dns',
  'undici',
  'node-fetch',
  'axios',
  'got',
  'ws',
  'request',
  'superagent',
];

/** Runtime network primitives reachable without an import. */
const NETWORK_GLOBALS = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bnavigator\s*\.\s*sendBeacon\b/,
];

const IMPORT_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** Reduce a specifier to its bare module name, stripping `node:` and subpaths. */
function moduleNameOf(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
  const withoutNode = specifier.startsWith('node:') ? specifier.slice(5) : specifier;
  const segments = withoutNode.split('/');
  return withoutNode.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

/** True when a specifier resolves to a network-capable module. */
export function isNetworkSpecifier(specifier) {
  const name = moduleNameOf(specifier);
  return name !== null && NETWORK_MODULES.includes(name.toLowerCase());
}

/** Collect network findings (imports + globals) in a source file's text. */
export function findNetworkUse(source) {
  const found = [];
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      if (isNetworkSpecifier(match[1])) found.push(`imports network module "${match[1]}"`);
    }
  }
  for (const pattern of NETWORK_GLOBALS) {
    if (pattern.test(source)) found.push(`uses network primitive ${pattern.source}`);
  }
  return found;
}

async function* walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

async function main() {
  const violations = [];
  const scanDir = path.join(REPO_ROOT, SCAN_ROOT);
  for await (const file of walk(scanDir)) {
    const relative = path.relative(REPO_ROOT, file);
    for (const finding of findNetworkUse(await readFile(file, 'utf8'))) {
      violations.push(`${relative}: ${finding}`);
    }
  }

  if (violations.length > 0) {
    console.error('OAAF no-telemetry guard failed — the SDK gained network reachability:\n');
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      '\nThe installed SDK must never contact the network. OAAF measures adoption from\n' +
        'outside (see docs/adoption-signals.md), not via telemetry. If a network feature\n' +
        'is genuinely required, it is an RFC and an explicit, documented opt-in — never a\n' +
        'default, and never silent.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('OAAF no-telemetry guard intact: the SDK has no network reachability.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

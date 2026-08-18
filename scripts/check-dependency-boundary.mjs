#!/usr/bin/env node
/**
 * OAAF dependency boundary check.
 *
 * OAAF must be buildable, testable, and releasable with no knowledge of any
 * downstream commercial consumer. DigitalStack360 may depend on OAAF; OAAF must
 * never depend on DigitalStack360.
 *
 *     OAAF                 DigitalStack360
 *       ^         never          ^
 *       |                        |
 *   DigitalStack360            OAAF
 *      (ok)                   (banned)
 *
 * This guard is deliberately narrow. It checks two things:
 *
 *   1. No package manifest declares a dependency on a forbidden package.
 *   2. No source file imports or requires a forbidden module.
 *
 * It does NOT ban the *words* — CHARTER.md, this file, and the ADR all discuss
 * DigitalStack360 by name in order to explain the boundary. Prose is fine; a
 * build edge is not.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Module/package names OAAF must never depend on. Matched against a whole
 * package specifier or its npm scope, never as a loose substring.
 */
export const FORBIDDEN_PACKAGES = [
  'digitalstack',
  'digitalstack360',
  'dstack',
  '@digitalstack',
  '@dstack',
  '@edwindigital',
];

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'coverage']);

/**
 * Files exempt from the *import* scan.
 *
 * Exactly one file qualifies: this guard's own test, whose fixtures must
 * contain forbidden specifiers as string data in order to prove the guard
 * detects them. The exemption is a named path, not a pattern — tests in
 * general are scanned, because a forbidden dependency smuggled in through a
 * test file is still a forbidden dependency.
 */
const IMPORT_SCAN_EXEMPT_FILES = new Set([
  path.join('scripts', 'check-dependency-boundary.test.mjs'),
]);

/**
 * Reduce a package specifier to the installable package name, dropping any
 * subpath: `@digitalstack/runtime-host/client` -> `@digitalstack/runtime-host`.
 */
function packageNameOf(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) {
    return null;
  }
  const segments = specifier.split('/');
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

/** True when `specifier` resolves to a package OAAF is forbidden to depend on. */
export function isForbiddenSpecifier(specifier) {
  const name = packageNameOf(specifier);
  if (name === null) return false;
  const lowered = name.toLowerCase();
  const scope = lowered.startsWith('@') ? lowered.split('/')[0] : null;
  return FORBIDDEN_PACKAGES.some((banned) => lowered === banned || scope === banned);
}

const IMPORT_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** Collect forbidden module specifiers imported by a source file's text. */
export function findForbiddenImports(source) {
  const found = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (isForbiddenSpecifier(specifier)) found.add(specifier);
    }
  }
  return [...found];
}

/** Collect forbidden dependency names declared by a parsed package manifest. */
export function findForbiddenDependencies(manifest) {
  const found = [];
  for (const field of DEPENDENCY_FIELDS) {
    const block = manifest[field];
    if (!block || typeof block !== 'object') continue;
    for (const name of Object.keys(block)) {
      if (isForbiddenSpecifier(name)) found.push({ field, name });
    }
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
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function main() {
  const violations = [];

  for await (const file of walk(REPO_ROOT)) {
    const relative = path.relative(REPO_ROOT, file);

    if (path.basename(file) === 'package.json') {
      let manifest;
      try {
        manifest = JSON.parse(await readFile(file, 'utf8'));
      } catch (error) {
        violations.push(`${relative}: unreadable package manifest (${error.message})`);
        continue;
      }
      for (const { field, name } of findForbiddenDependencies(manifest)) {
        violations.push(`${relative}: ${field} declares forbidden package "${name}"`);
      }
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(file))) continue;
    if (IMPORT_SCAN_EXEMPT_FILES.has(relative)) continue;

    for (const specifier of findForbiddenImports(await readFile(file, 'utf8'))) {
      violations.push(`${relative}: imports forbidden module "${specifier}"`);
    }
  }

  if (violations.length > 0) {
    console.error('OAAF dependency boundary violated:\n');
    for (const violation of violations) console.error(`  - ${violation}`);
    console.error(
      '\nOAAF must stand alone. DigitalStack360 may depend on OAAF; OAAF must never\n' +
        'depend on DigitalStack360. See CHARTER.md and docs/adr/0001-oaaf-digitalstack360-separation.md.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('OAAF dependency boundary intact.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

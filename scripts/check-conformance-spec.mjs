#!/usr/bin/env node
/**
 * OAAF conformance-spec structural guard (O6A).
 *
 * The conformance specification's value is its traceability: a requirement ID is
 * the spine that will connect O6A requirement → O6B vector → O6C/D/E result. A
 * dangling ID reference or a duplicate ID silently breaks that spine, so this
 * guard makes the catalog mechanically self-consistent. It checks structure, not
 * meaning:
 *
 *   1. requirements.json is well-formed: unique IDs, each matching the ID scheme,
 *      each in a declared conformance class, each with a BCP-14 keyword, a
 *      statement, and at least one source.
 *   2. Every requirement-ID token that appears in the conformance prose exists in
 *      the catalog (no dangling references).
 *   3. Every catalogued requirement is referenced by at least one prose document
 *      (no orphan requirements nobody traces).
 *
 * It does NOT judge whether a requirement is correct — that is human review.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_DIR = path.join('spec', '0.1', 'conformance');
const CATALOG = path.join(SPEC_DIR, 'requirements.json');

/** A requirement ID: CLASS(-GROUP)*-NNN, e.g. CORE-NARROW-001, STATUS-003, MCP-001. */
export const ID_PATTERN = /\b[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3}\b/g;
const ID_EXACT = /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3}$/;
const BCP14 = new Set([
  'MUST',
  'MUST NOT',
  'REQUIRED',
  'SHALL',
  'SHALL NOT',
  'SHOULD',
  'SHOULD NOT',
  'RECOMMENDED',
  'MAY',
  'OPTIONAL',
]);

async function* markdownFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* markdownFiles(full);
    else if (entry.isFile() && entry.name.endsWith('.md')) yield full;
  }
}

export function validateCatalog(catalog) {
  const errors = [];
  const classes = new Set(catalog.classes ?? []);
  if (classes.size === 0) errors.push('catalog declares no conformance classes');
  if (!classes.has(catalog.mandatoryClass)) {
    errors.push(`mandatoryClass "${catalog.mandatoryClass}" is not a declared class`);
  }
  const seen = new Set();
  for (const r of catalog.requirements ?? []) {
    if (!ID_EXACT.test(r.id ?? '')) errors.push(`bad requirement id: ${JSON.stringify(r.id)}`);
    if (seen.has(r.id)) errors.push(`duplicate requirement id: ${r.id}`);
    seen.add(r.id);
    if (!classes.has(r.class)) errors.push(`${r.id}: unknown class "${r.class}"`);
    if (!BCP14.has(r.keyword)) errors.push(`${r.id}: non-BCP-14 keyword "${r.keyword}"`);
    if (!r.statement || typeof r.statement !== 'string') errors.push(`${r.id}: missing statement`);
    if (!Array.isArray(r.source) || r.source.length === 0) errors.push(`${r.id}: missing source`);
    // An ID must carry its class's declared prefix (CORE-… for Core, IDENT-… etc.).
    const prefix = (catalog.classPrefixes ?? {})[r.class];
    if (prefix && r.id && !r.id.startsWith(prefix + '-')) {
      errors.push(`${r.id}: id prefix does not match class "${r.class}" (expected ${prefix}-…)`);
    }
  }
  return { errors, ids: seen };
}

async function main() {
  const raw = await readFile(path.join(REPO_ROOT, CATALOG), 'utf8');
  let catalog;
  try {
    catalog = JSON.parse(raw);
  } catch (e) {
    console.error(`conformance catalog is not valid JSON: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  const { errors, ids } = validateCatalog(catalog);
  const referenced = new Set();

  for await (const file of markdownFiles(path.join(REPO_ROOT, SPEC_DIR))) {
    const text = await readFile(file, 'utf8');
    const rel = path.relative(REPO_ROOT, file);
    for (const token of text.match(ID_PATTERN) ?? []) {
      referenced.add(token);
      if (!ids.has(token)) errors.push(`${rel}: references unknown requirement id "${token}"`);
    }
  }

  for (const id of ids) {
    if (!referenced.has(id)) errors.push(`orphan requirement (never referenced in prose): ${id}`);
  }

  if (errors.length > 0) {
    console.error('OAAF conformance-spec guard failed:\n');
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `OAAF conformance-spec guard intact: ${ids.size} requirements across ` +
      `${catalog.classes.length} classes, all IDs unique, referenced, and in scope.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

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
 *   4. The portable corpus is well-formed and traces to real requirements, and every
 *      Core security-invariant requirement that can be a static vector has at least one
 *      (the O6B north star, enforced).
 *
 * It does NOT judge whether a requirement is correct — that is human review.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_DIR = path.join('spec', '0.1', 'conformance');
const CATALOG = path.join(SPEC_DIR, 'requirements.json');
const CORPUS = path.join(SPEC_DIR, 'vectors', 'corpus.json');

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

  // --- Portable corpus validation (O6B) ---
  let corpus;
  try {
    corpus = JSON.parse(await readFile(path.join(REPO_ROOT, CORPUS), 'utf8'));
  } catch (e) {
    errors.push(`conformance corpus is missing or not valid JSON: ${e.message}`);
    corpus = { vectors: [] };
  }
  const classes = new Set(catalog.classes ?? []);
  const covered = new Map(); // requirement id -> vector count
  const seenVectorIds = new Set();
  for (const v of corpus.vectors ?? []) {
    const where = `corpus vector ${v.vector_id ?? '(no id)'}`;
    if (!v.vector_id) errors.push(`${where}: missing vector_id`);
    if (seenVectorIds.has(v.vector_id)) errors.push(`${where}: duplicate vector_id`);
    seenVectorIds.add(v.vector_id);
    if (!classes.has(v.profile)) errors.push(`${where}: unknown profile "${v.profile}"`);
    if (v.expected_decision !== 'allow' && v.expected_decision !== 'deny') {
      errors.push(`${where}: expected_decision must be allow|deny`);
    }
    if (v.expected_decision === 'deny' && !v.expected_normative_reason) {
      errors.push(`${where}: a deny vector must carry expected_normative_reason`);
    }
    if (v.expected_decision === 'allow' && v.expected_normative_reason !== null) {
      errors.push(`${where}: an allow vector must have expected_normative_reason null`);
    }
    if (!Array.isArray(v.requirements) || v.requirements.length === 0) {
      errors.push(`${where}: must tag at least one requirement`);
    }
    for (const rid of v.requirements ?? []) {
      if (!ids.has(rid)) errors.push(`${where}: references unknown requirement "${rid}"`);
      covered.set(rid, (covered.get(rid) ?? 0) + 1);
    }
    if (
      v.expected_authority_verified !== undefined &&
      typeof v.expected_authority_verified !== 'boolean'
    ) {
      errors.push(`${where}: expected_authority_verified must be a boolean`);
    }
  }

  // Transport equivalence (CORE-DEC-004): every vector in an equivalence group must
  // agree on the normative outcome, and a group must span at least two profiles (else
  // it proves no equivalence).
  const groups = new Map();
  for (const v of corpus.vectors ?? []) {
    if (!v.equivalence_group) continue;
    if (!groups.has(v.equivalence_group)) groups.set(v.equivalence_group, []);
    groups.get(v.equivalence_group).push(v);
  }
  for (const [group, members] of groups) {
    const outcomes = new Set(
      members.map((m) => `${m.expected_decision}/${m.expected_normative_reason ?? '-'}`),
    );
    if (outcomes.size > 1) {
      errors.push(
        `equivalence group "${group}" disagrees on outcome: ${[...outcomes].join(' vs ')}`,
      );
    }
    const profiles = new Set(members.map((m) => m.profile));
    if (profiles.size < 2) {
      errors.push(
        `equivalence group "${group}" spans only one profile (${[...profiles]}) — proves no transport equivalence`,
      );
    }
  }

  // Every security-invariant requirement must have adversarial evidence recorded in the
  // security certification (O6E), so the security artifact stays complete against the catalog.
  const securityDoc = path.join(REPO_ROOT, SPEC_DIR, 'security.md');
  let securityText = '';
  try {
    securityText = await readFile(securityDoc, 'utf8');
  } catch {
    errors.push('security.md is missing (O6E security certification)');
  }
  const securityRefs = new Set(securityText.match(ID_PATTERN) ?? []);
  for (const r of catalog.requirements ?? []) {
    if (r.security_invariant === true && !securityRefs.has(r.id)) {
      errors.push(`security invariant ${r.id} has no adversarial evidence recorded in security.md`);
    }
  }

  // North star: every Core security-invariant requirement that can be a static
  // vector MUST have at least one.
  for (const r of catalog.requirements ?? []) {
    const mustHaveVector =
      r.class === 'Core' && r.security_invariant === true && r.portable_vector !== false;
    if (mustHaveVector && !(covered.get(r.id) > 0)) {
      errors.push(
        `north-star gap: Core security-invariant ${r.id} has no portable vector ` +
          `(mark portable_vector:false in the catalog if it genuinely cannot be one)`,
      );
    }
  }

  if (errors.length > 0) {
    console.error('OAAF conformance-spec guard failed:\n');
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `OAAF conformance-spec guard intact: ${ids.size} requirements across ` +
      `${catalog.classes.length} classes; ${corpus.vectors.length} portable vectors; ` +
      `all IDs unique, referenced, in scope, and Core security invariants vector-covered.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

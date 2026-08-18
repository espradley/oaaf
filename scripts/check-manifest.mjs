#!/usr/bin/env node
/**
 * OAAF freeze-manifest guard (O6G).
 *
 * Verifies the committed manifest still matches reality: every normative artifact's recorded
 * sha256 equals the file's current hash, and the frozen reason-code set matches the
 * implementation's reason-code list exactly. A drift here means the freeze manifest is stale —
 * regenerate with `node scripts/gen-manifest.mjs`.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sha256Of, buildManifest } from './gen-manifest.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = 'spec/0.1/conformance';

function reasonCodesFromSource() {
  const src = readFileSync(path.join(REPO_ROOT, 'packages/typescript/src/reasons.ts'), 'utf8');
  return new Set([...src.matchAll(/^ {2}'([a-z_]+)',/gm)].map((m) => m[1]));
}

function main() {
  const errors = [];

  // 1. Manifest hashes match current files.
  let committed;
  try {
    committed = JSON.parse(readFileSync(path.join(REPO_ROOT, SPEC, 'manifest.json'), 'utf8'));
  } catch (e) {
    console.error(
      `manifest.json missing or invalid: ${e.message} — run node scripts/gen-manifest.mjs`,
    );
    process.exitCode = 1;
    return;
  }
  const fresh = buildManifest();
  for (const [name, { path: rel }] of Object.entries(fresh.core)) {
    const want = sha256Of(rel);
    const got = committed.core?.[name]?.sha256;
    if (got !== want) {
      errors.push(`manifest.core.${name} sha256 is stale (${rel}) — regenerate the manifest`);
    }
  }

  // 2. Frozen reason-code set matches the implementation exactly.
  const impl = reasonCodesFromSource();
  const frozen = JSON.parse(readFileSync(path.join(REPO_ROOT, SPEC, 'reason-codes.json'), 'utf8'));
  const frozenSet = new Set(frozen.codes.map((c) => c.code));
  for (const c of impl)
    if (!frozenSet.has(c))
      errors.push(
        `reason code "${c}" is in the implementation but not classified in reason-codes.json`,
      );
  for (const c of frozenSet)
    if (!impl.has(c))
      errors.push(
        `reason code "${c}" is classified in reason-codes.json but not in the implementation`,
      );

  if (errors.length > 0) {
    console.error('OAAF freeze-manifest guard failed:\n');
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `OAAF freeze-manifest intact: ${Object.keys(fresh.core).length} normative artifacts hashed, ` +
      `${frozenSet.size} reason codes classified and in sync with the implementation.`,
  );
}

main();

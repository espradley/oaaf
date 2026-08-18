#!/usr/bin/env node
/**
 * Generate the OAAF v1 freeze manifest (O6G).
 *
 * The manifest is the single machine-readable statement of exactly which artifacts constitute
 * OAAF Core and its profiles — so an implementer (or the conformance runner) can determine what
 * "OAAF Core 1.0" is without interpreting git history. It records each normative artifact's
 * sha256. `check:manifest` re-computes those hashes and fails if the committed manifest drifts.
 *
 * Status is `release-candidate` until O6H stamps the freeze; the target is 1.0.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = 'spec/0.1/conformance';

export function sha256Of(relPath) {
  const bytes = readFileSync(path.join(REPO_ROOT, relPath));
  return createHash('sha256').update(bytes).digest('hex');
}

/** The normative artifacts that define OAAF Core + profiles. */
export const CORE_ARTIFACTS = {
  requirements: `${SPEC}/requirements.json`,
  corpus: `${SPEC}/vectors/corpus.json`,
  reason_codes: `${SPEC}/reason-codes.json`,
  aat_profile: `${SPEC}/aat-profile.md`,
};

export function buildManifest() {
  const core = {};
  for (const [name, rel] of Object.entries(CORE_ARTIFACTS)) {
    core[name] = { path: rel, sha256: sha256Of(rel) };
  }
  core.aat_profile.revision = '01';
  return {
    oaaf_version: '1.0',
    status: 'release-candidate',
    spec_version: '0.1',
    note:
      'The definitive artifact set for OAAF Core 1.0 and its profiles. status is ' +
      'release-candidate until the O6H freeze. Hashes are sha256 of the referenced files; ' +
      'check:manifest fails if any drifts. See compatibility.md for the versioning contract.',
    core,
    profiles: { status: '1.0', identity: '1.0', mcp: '1.0', a2a: '1.0', pdp: '1.0' },
    standards: {
      aat: 'draft-niyikiza-oauth-attenuating-agent-tokens-01',
      authzen: 'Authorization API 1.0 (Final)',
      a2a: '1.0.1',
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = buildManifest();
  writeFileSync(
    path.join(REPO_ROOT, SPEC, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  console.log('wrote spec/0.1/conformance/manifest.json');
  for (const [k, v] of Object.entries(manifest.core)) {
    console.log(`  ${k}: sha256:${v.sha256.slice(0, 16)}…`);
  }
}

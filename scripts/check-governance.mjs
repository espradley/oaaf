#!/usr/bin/env node
/**
 * Governance readiness check.
 *
 * Small and proportionate: asserts the required governance files exist and that the
 * package license matches the repository license. It does not police prose. Wired into
 * `npm run check` so a governance file cannot be deleted without CI noticing.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_FILES = [
  'LICENSE',
  'NOTICE',
  'README.md',
  'CHARTER.md',
  'GOVERNANCE.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'ROADMAP.md',
  'docs/versioning-and-compatibility.md',
  'docs/extensions.md',
  'docs/repository-settings.md',
  'rfcs/README.md',
  'rfcs/0000-template.md',
  'docs/adr/README.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/CODEOWNERS',
];

const EXPECTED_LICENSE = 'Apache-2.0';

const problems = [];

for (const rel of REQUIRED_FILES) {
  if (!existsSync(path.join(root, rel))) problems.push(`missing required file: ${rel}`);
}

for (const manifest of ['package.json', 'packages/typescript/package.json']) {
  const p = path.join(root, manifest);
  if (!existsSync(p)) continue;
  const license = JSON.parse(readFileSync(p, 'utf8')).license;
  if (license !== EXPECTED_LICENSE) {
    problems.push(
      `${manifest}: license is ${JSON.stringify(license)}, expected ${EXPECTED_LICENSE}`,
    );
  }
}

if (problems.length > 0) {
  console.error('Governance check failed:\n');
  for (const p of problems) console.error(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log(`Governance files present; license ${EXPECTED_LICENSE} consistent.`);
}

import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it, beforeAll } from 'vitest';

const run = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = path.join(repoRoot, 'scripts', 'oaaf-conform.mjs');
const corpus = path.join(repoRoot, 'spec', '0.1', 'conformance', 'vectors', 'corpus.json');

let dir;

/** A mock adapter that reads the corpus and echoes each vector's expected answer. */
function conformantAdapter(profiles) {
  return `
import readline from 'node:readline';
import { readFileSync } from 'node:fs';
const corpus = JSON.parse(readFileSync(${JSON.stringify(corpus)}, 'utf8'));
const byId = new Map(corpus.vectors.map((v) => [v.vector_id, v]));
const say = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  if (!line.trim()) continue;
  const m = JSON.parse(line);
  if (m.type === 'hello') say({ type: 'hello', profiles: ${JSON.stringify(profiles)} });
  else if (m.type === 'evaluate') {
    const v = byId.get(m.vector_id);
    say({ type: 'result', vector_id: m.vector_id, decision: v.expected_decision, reason: v.expected_normative_reason });
  } else if (m.type === 'bye') break;
}
`;
}

/** A mock adapter that always answers allow (wrong for deny vectors). */
const brokenAdapter = `
import readline from 'node:readline';
const say = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  if (!line.trim()) continue;
  const m = JSON.parse(line);
  if (m.type === 'hello') say({ type: 'hello', profiles: ['Core'] });
  else if (m.type === 'evaluate') say({ type: 'result', vector_id: m.vector_id, decision: 'allow', reason: null });
  else if (m.type === 'bye') break;
}
`;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'oaaf-conform-'));
  writeFileSync(
    path.join(dir, 'good.mjs'),
    conformantAdapter(['Core', 'Status', 'Identity', 'A2A']),
  );
  writeFileSync(path.join(dir, 'core-only.mjs'), conformantAdapter(['Core']));
  writeFileSync(path.join(dir, 'broken.mjs'), brokenAdapter);
});

async function conform(adapterFile, extra = []) {
  try {
    const { stdout } = await run('node', [
      runner,
      '--adapter',
      `node ${path.join(dir, adapterFile)}`,
      ...extra,
    ]);
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.code, stdout: e.stdout ?? '' };
  }
}

describe('oaaf conform runner', () => {
  it('reports CONFORMANT (exit 0) for a conformant adapter', async () => {
    const { code, stdout } = await conform('good.mjs');
    expect(code).toBe(0);
    expect(stdout).toContain('CONFORMANT');
    expect(stdout).not.toContain('NOT CONFORMANT');
    expect(stdout).toContain('OAAF does not certify');
  });

  it('reports NOT CONFORMANT (exit 1) for a broken adapter', async () => {
    const { code, stdout } = await conform('broken.mjs', ['--profile', 'Core']);
    expect(code).toBe(1);
    expect(stdout).toContain('NOT CONFORMANT');
    expect(stdout).toContain('core-narrow-widening-tool');
  });

  it('reports NOT CONFORMANT when a requested profile is unclaimed', async () => {
    const { code, stdout } = await conform('core-only.mjs', ['--profile', 'Core,A2A']);
    expect(code).toBe(1);
    expect(stdout).toContain('does not claim: A2A');
  });

  it('human output nudges to star only on success', async () => {
    const good = await conform('good.mjs');
    expect(good.stdout).toContain('starring the project');
    const bad = await conform('broken.mjs', ['--profile', 'Core']);
    expect(bad.stdout).not.toContain('starring the project');
  });

  it('--json output is pristine: no promo, nudge, or prose', async () => {
    const { code, stdout } = await conform('good.mjs', ['--json']);
    expect(code).toBe(0);
    const report = JSON.parse(stdout); // must be pure JSON, nothing else
    expect(report.result).toBe('CONFORMANT');
    expect(report.self_declared).toBe(true);
    expect(report.corpus.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(stdout).not.toContain('★');
    expect(stdout).not.toContain('starring');
    expect(stdout).not.toContain('certify');
  });
});

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

/**
 * O4C certification: the real inspector artifact, spawned as an outsider would
 * run it. These assert the developer-facing output, not an internal function —
 * privacy, correctness against the canonical decision, and exit codes.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const inspector = path.join(repoRoot, 'examples', 'inspector', 'inspect.js');

/** Run the inspector; return stdout, stderr, and exit code (never throws). */
function runInspector(args: string[]): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync('node', [inspector, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', code: 0 };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', code: e.status ?? -1 };
  }
}

beforeAll(() => {
  // The inspector imports the built @oaaf/sdk; ensure dist exists regardless of
  // test-run order.
  execFileSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'ignore' });
}, 60_000);

const SECRET = 'secret/customer-1234.ts';

describe('inspector — exit codes', () => {
  it('ALLOW → 0', () => {
    expect(runInspector(['--example', 'allow']).code).toBe(0);
  });
  it('DENY → 1', () => {
    expect(runInspector(['--example', 'deny-undelegated']).code).toBe(1);
    expect(runInspector(['--example', 'deny-argument']).code).toBe(1);
  });
  it('malformed invocation → 2 (never blurred with DENY)', () => {
    expect(runInspector(['--example', 'nonsense']).code).toBe(2);
    expect(runInspector(['--bogus-flag']).code).toBe(2);
  });
});

describe('inspector — correctness against the canonical decision', () => {
  it('ALLOW renders the authority summary', () => {
    const { stdout } = runInspector(['--example', 'allow']);
    expect(stdout).toContain('ALLOWED');
    expect(stdout).toContain('repo.read');
  });

  it('DENY names the reason, stage, and locators', () => {
    const { stdout } = runInspector(['--example', 'deny-argument', '--json']);
    const explanation = JSON.parse(stdout) as {
      decision: string;
      reasons: Array<{ code: string; stage: string; tool?: string; argument?: string }>;
      authority?: { requestedTool: string; grantedTools: string[] };
    };
    expect(explanation.decision).toBe('DENY');
    expect(explanation.reasons[0]?.code).toBe('argument_constraint_violated');
    expect(explanation.reasons[0]?.stage).toBe('evaluation');
    expect(explanation.reasons[0]?.tool).toBe('repo.read');
    expect(explanation.reasons[0]?.argument).toBe('path');
  });

  it('--json emits exactly the canonical DecisionExplanation shape (no CLI-specific schema)', () => {
    const { stdout } = runInspector(['--example', 'allow', '--json']);
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(['authority', 'decision', 'reasons']);
    const authority = parsed['authority'] as Record<string, unknown>;
    expect(Object.keys(authority).sort()).toEqual([
      'chainLength',
      'delegationDepth',
      'expiresAt',
      'grantedTools',
      'holder',
      'requestedArgumentNames',
      'requestedTool',
      'subject',
      'subjectProfile',
    ]);
  });
});

describe('inspector — privacy', () => {
  it('never prints the argument value, in text or JSON', () => {
    for (const args of [
      ['--example', 'deny-argument'],
      ['--example', 'deny-argument', '--json'],
    ]) {
      const { stdout, stderr } = runInspector(args);
      expect(stdout.includes(SECRET), `leak in stdout for ${args.join(' ')}`).toBe(false);
      expect(stderr.includes(SECRET), `leak in stderr for ${args.join(' ')}`).toBe(false);
    }
  });

  it('never prints token, signature, or PoP material', () => {
    const { stdout } = runInspector(['--example', 'allow', '--json']);
    // A compact JWS: long base64url runs separated by dots. None should appear.
    expect(/[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\./.test(stdout)).toBe(false);
    // The only urn:...thumbprint identifier is the safe subject; assert no `cnf`
    // or private-key markers leak.
    for (const marker of ['"d":', '"cnf"', 'BEGIN', 'signature']) {
      expect(stdout.includes(marker)).toBe(false);
    }
  });

  it('text output states that values are omitted', () => {
    const { stdout } = runInspector(['--example', 'deny-argument']);
    expect(stdout.toLowerCase()).toContain('omitted');
  });
});

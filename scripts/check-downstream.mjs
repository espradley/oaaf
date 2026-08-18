#!/usr/bin/env node
/**
 * Downstream-consumer certification (O5A).
 *
 * Packs @oaaf/sdk, installs the resulting tarball into a throwaway project that
 * knows nothing about this repository, and certifies that a real external
 * consumer can:
 *   - import only documented public paths (no deep/dist imports),
 *   - compile against the shipped type declarations with tsc,
 *   - run a minimal ALLOW, a minimal DENY, and read the structured explanation,
 *   - use the MCP and A2A bindings from their public subpaths.
 *
 * This certifies the artifact users receive, not source-tree imports.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(repoRoot, 'packages', 'typescript');

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
}

const work = mkdtempSync(path.join(tmpdir(), 'oaaf-downstream-'));
let failed = null;
try {
  // 1. Build + pack the SDK.
  run('npm', ['run', 'build'], repoRoot);
  run('npm', ['pack', '--pack-destination', work], pkgDir);
  const tarball = readdirSync(work).find((f) => f.endsWith('.tgz'));
  if (!tarball) throw new Error('npm pack produced no tarball');

  // 2. A fresh consumer project that installs the packed artifact.
  const consumer = path.join(work, 'consumer');
  run('mkdir', ['-p', consumer]);
  writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify({ name: 'consumer', private: true, type: 'module', version: '1.0.0' }, null, 2),
  );
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      path.join(work, tarball),
      'typescript@5',
      '@types/node@20',
    ],
    consumer,
  );

  // 3. A consumer program using ONLY documented public import paths.
  const program = `
import { verifyAndEvaluate, verifyAuthority, evaluate, toExplanation, explain } from '@oaaf/sdk';
import { enforceOaafPrecondition, explainMcpResult } from '@oaaf/sdk/mcp';
import { enforceA2aAuthority, explainA2aResult } from '@oaaf/sdk/a2a';
import { toAccessEvaluationRequest } from '@oaaf/sdk/authzen';
import { generateHolderKey, mintRootToken, mintDerivedToken, mintPop } from '@oaaf/sdk/testing';
import type { DecisionExplanation, VerifiedAuthority } from '@oaaf/sdk';

const NOW = 1_780_000_000, HOUR = 3600;

async function makeChain(leafTools: Record<string, Record<string, unknown>>) {
  const issuerKey = await generateHolderKey();
  const alice = await generateHolderKey();
  const bob = await generateHolderKey();
  const root = await mintRootToken({
    issuer: 'https://a.example', issuerKey, holder: alice,
    tools: { 'repo.read': {}, 'repo.merge': {} },
    issuedAt: NOW, expiresAt: NOW + HOUR, maxDepth: 2, jti: 'r',
  });
  const derived = await mintDerivedToken({
    parentToken: root, parentKey: alice,
    parentPayload: { del_depth: 0, del_max_depth: 2, exp: NOW + HOUR, iat: NOW },
    holder: bob, tools: leafTools as never,
    issuedAt: NOW, expiresAt: NOW + HOUR / 2, jti: 'd',
  });
  return { tokens: [root, derived], trustAnchors: [issuerKey.publicJwk], bob };
}

async function main() {
  // ALLOW
  const a = await makeChain({ 'repo.read': {} });
  const popA = await mintPop({ leafKey: a.bob, leafJti: 'd', tool: 'repo.read', args: {}, issuedAt: NOW });
  const allow = await verifyAndEvaluate({ tokens: a.tokens, trustAnchors: a.trustAnchors, pop: popA, tool: 'repo.read', args: {}, now: NOW + 1 });
  if (!allow.allowed) throw new Error('expected ALLOW');

  // DENY (merge was never delegated) + structured explanation
  const popD = await mintPop({ leafKey: a.bob, leafJti: 'd', tool: 'repo.merge', args: {}, issuedAt: NOW });
  const deny = await verifyAndEvaluate({ tokens: a.tokens, trustAnchors: a.trustAnchors, pop: popD, tool: 'repo.merge', args: {}, now: NOW + 1 });
  if (deny.allowed) throw new Error('expected DENY');
  const ex: DecisionExplanation = toExplanation(deny);
  if (ex.decision !== 'DENY' || ex.reasons[0]?.code !== 'tool_not_authorized') throw new Error('bad explanation');

  // MCP + A2A bindings via their public subpaths
  const mcp = await enforceOaafPrecondition({ tokens: a.tokens, trustAnchors: a.trustAnchors, pop: popA, tool: 'repo.read', args: {}, now: NOW + 1 });
  const a2a = await enforceA2aAuthority({
    message: { metadata: { 'https://oaaf.dev/a2a/authority/v1/chain': a.tokens, 'https://oaaf.dev/a2a/authority/v1/pop': popA } },
    activatedExtensionUris: ['https://oaaf.dev/a2a/authority/v1'],
    trustAnchors: a.trustAnchors, skillId: 'repo.read', args: {}, recipient: 'https://b.example', now: NOW + 1,
  });
  const mcpEx = explainMcpResult(mcp), a2aEx = explainA2aResult(a2a);
  if (JSON.stringify(mcpEx) !== JSON.stringify(a2aEx)) throw new Error('binding explanations diverged');

  void verifyAuthority; void evaluate; void explain; void toAccessEvaluationRequest;
  void (undefined as unknown as VerifiedAuthority);
  console.log('DOWNSTREAM_OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
`;
  writeFileSync(path.join(consumer, 'program.ts'), program);
  writeFileSync(
    path.join(consumer, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2022',
          strict: true,
          types: ['node'],
          noEmit: false,
          outDir: 'out',
        },
        include: ['program.ts'],
      },
      null,
      2,
    ),
  );

  // 4. Downstream TypeScript compilation against the shipped declarations.
  run(path.join(consumer, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], consumer);

  // 5. Run the compiled program.
  const out = execFileSync('node', ['out/program.js'], { cwd: consumer, encoding: 'utf8' });
  if (!out.includes('DOWNSTREAM_OK')) throw new Error(`consumer did not report OK:\n${out}`);

  console.log(
    'Downstream consumer certification passed (pack, install, tsc, ALLOW, DENY, explanation, MCP, A2A).',
  );
} catch (error) {
  failed = error;
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failed) {
  console.error(
    'Downstream certification FAILED:\n',
    failed.stdout ?? '',
    failed.stderr ?? '',
    failed.message ?? '',
  );
  process.exit(1);
}

/**
 * Generate shared cross-language conformance vectors (O5B).
 *
 * Each vector holds real signed authority material (produced once, here) plus the
 * expected canonical result computed by the TypeScript reference. The vectors are
 * committed as static JSON; both the TypeScript and the Python implementations
 * verify the SAME bytes independently and must reach the committed expected
 * result. Neither implementation calls the other at test time.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  verifyAndEvaluate,
  verifyAuthority,
  toExplanation,
} from '../packages/typescript/dist/index.js';
import { enforceA2aAuthority, explainA2aResult } from '../packages/typescript/dist/a2a/binding.js';
import {
  generateHolderKey,
  mintRootToken,
  mintDerivedToken,
  mintPop,
} from '../packages/typescript/dist/testing/mint.js';

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'python',
  'tests',
  'vectors',
);
mkdirSync(OUT, { recursive: true });

const NOW = 1_780_000_000;
const HOUR = 3600;
const RECIPIENT = 'https://recipient.example';

/** Canonical expected result via the reference core path. */
async function coreExpected(input) {
  const decision = await verifyAndEvaluate(input);
  const v = await verifyAuthority(input);
  const explanation = toExplanation(decision, v.ok ? v.authority : undefined);
  return explanation;
}

/** Build a root+derived chain; leaf tools default to a narrowed read. */
async function chain({ rootTools, leafTools, maxDepth = 2 }) {
  const issuerKey = await generateHolderKey();
  const alice = await generateHolderKey();
  const bob = await generateHolderKey();
  const root = await mintRootToken({
    issuer: 'https://authority.example',
    issuerKey,
    holder: alice,
    tools: rootTools,
    issuedAt: NOW,
    expiresAt: NOW + HOUR,
    maxDepth,
    jti: 'root',
  });
  const derived = await mintDerivedToken({
    parentToken: root,
    parentKey: alice,
    parentPayload: { del_depth: 0, del_max_depth: maxDepth, exp: NOW + HOUR, iat: NOW },
    holder: bob,
    tools: leafTools,
    issuedAt: NOW,
    expiresAt: NOW + HOUR / 2,
    jti: 'derived',
  });
  return { tokens: [root, derived], trustAnchors: [issuerKey.publicJwk], bob };
}

const vectors = [];
function record(name, input, expected, note) {
  vectors.push({ name, note, input, expected });
}

// --- ALLOW ---
{
  const c = await chain({
    rootTools: { 'repo.read': {}, 'repo.merge': {} },
    leafTools: { 'repo.read': {} },
  });
  const pop = await mintPop({
    leafKey: c.bob,
    leafJti: 'derived',
    tool: 'repo.read',
    args: { path: 'src/' },
    issuedAt: NOW,
  });
  const input = {
    tokens: c.tokens,
    trustAnchors: c.trustAnchors,
    pop,
    tool: 'repo.read',
    args: { path: 'src/' },
    now: NOW + 1,
  };
  record('allow', input, await coreExpected(input), 'valid delegated authority');
}

// --- DENY: unauthorized tool (merge held by root, not delegated) ---
{
  const c = await chain({
    rootTools: { 'repo.read': {}, 'repo.merge': {} },
    leafTools: { 'repo.read': {} },
  });
  const pop = await mintPop({
    leafKey: c.bob,
    leafJti: 'derived',
    tool: 'repo.merge',
    args: {},
    issuedAt: NOW,
  });
  const input = {
    tokens: c.tokens,
    trustAnchors: c.trustAnchors,
    pop,
    tool: 'repo.merge',
    args: {},
    now: NOW + 1,
  };
  record(
    'deny_tool_not_authorized',
    input,
    await coreExpected(input),
    'child never delegated repo.merge',
  );
}

// --- DENY: argument constraint ---
{
  const c = await chain({
    rootTools: { 'repo.read': { path: { constraint_type: 'one_of', values: ['a', 'b'] } } },
    leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
  });
  const pop = await mintPop({
    leafKey: c.bob,
    leafJti: 'derived',
    tool: 'repo.read',
    args: { path: 'b' },
    issuedAt: NOW,
  });
  const input = {
    tokens: c.tokens,
    trustAnchors: c.trustAnchors,
    pop,
    tool: 'repo.read',
    args: { path: 'b' },
    now: NOW + 1,
  };
  record(
    'deny_argument_constraint',
    input,
    await coreExpected(input),
    'value outside narrowed constraint',
  );
}

// --- DENY: expiry ---
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const pop = await mintPop({
    leafKey: c.bob,
    leafJti: 'derived',
    tool: 'repo.read',
    args: {},
    issuedAt: NOW,
  });
  const input = {
    tokens: c.tokens,
    trustAnchors: c.trustAnchors,
    pop,
    tool: 'repo.read',
    args: {},
    now: NOW + HOUR + 100,
  };
  record('deny_expired', input, await coreExpected(input), 'evaluated after expiry');
}

// --- DENY: holder mismatch (PoP signed by a stranger) ---
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const impostor = await generateHolderKey();
  const pop = await mintPop({
    leafKey: impostor,
    leafJti: 'derived',
    tool: 'repo.read',
    args: {},
    issuedAt: NOW,
  });
  const input = {
    tokens: c.tokens,
    trustAnchors: c.trustAnchors,
    pop,
    tool: 'repo.read',
    args: {},
    now: NOW + 1,
  };
  record('deny_holder_mismatch', input, await coreExpected(input), 'PoP not signed by leaf holder');
}

// --- DENY: invalid PoP (bound to different args) ---
{
  const c = await chain({
    rootTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
    leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
  });
  const pop = await mintPop({
    leafKey: c.bob,
    leafJti: 'derived',
    tool: 'repo.read',
    args: { path: 'a' },
    issuedAt: NOW,
  });
  const input = {
    tokens: c.tokens,
    trustAnchors: c.trustAnchors,
    pop,
    tool: 'repo.read',
    args: { path: 'a', extra: 'x' },
    now: NOW + 1,
  };
  record(
    'deny_pop_binding',
    input,
    await coreExpected(input),
    'PoP hta does not match requested args',
  );
}

// --- DENY: invalid signature (tamper root) ---
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const tampered = [`${c.tokens[0].slice(0, -4)}AAAA`, c.tokens[1]];
  const pop = await mintPop({
    leafKey: c.bob,
    leafJti: 'derived',
    tool: 'repo.read',
    args: {},
    issuedAt: NOW,
  });
  const input = {
    tokens: tampered,
    trustAnchors: c.trustAnchors,
    pop,
    tool: 'repo.read',
    args: {},
    now: NOW + 1,
  };
  record('deny_invalid_signature', input, await coreExpected(input), 'root signature tampered');
}

// --- DENY: chain reordering ---
{
  const c = await chain({
    rootTools: { 'repo.read': {} },
    leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
  });
  const reordered = [c.tokens[1], c.tokens[0]];
  const pop = await mintPop({
    leafKey: c.bob,
    leafJti: 'derived',
    tool: 'repo.read',
    args: { path: 'a' },
    issuedAt: NOW,
  });
  const input = {
    tokens: reordered,
    trustAnchors: c.trustAnchors,
    pop,
    tool: 'repo.read',
    args: { path: 'a' },
    now: NOW + 1,
  };
  record('deny_chain_reordered', input, await coreExpected(input), 'leaf presented before root');
}

// --- DENY: recipient/audience mismatch (A2A binding path) ---
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const pop = await mintPop({
    leafKey: c.bob,
    leafJti: 'derived',
    tool: 'repo.read',
    args: {},
    issuedAt: NOW,
    overrides: { aat_aud: 'https://someone-else.example' },
  });
  const a2a = await enforceA2aAuthority({
    message: {
      metadata: {
        'https://oaaf.dev/a2a/authority/v1/chain': c.tokens,
        'https://oaaf.dev/a2a/authority/v1/pop': pop,
      },
    },
    activatedExtensionUris: ['https://oaaf.dev/a2a/authority/v1'],
    trustAnchors: c.trustAnchors,
    skillId: 'repo.read',
    args: {},
    recipient: RECIPIENT,
    now: NOW + 1,
  });
  const input = {
    tokens: c.tokens,
    trustAnchors: c.trustAnchors,
    pop,
    tool: 'repo.read',
    args: {},
    now: NOW + 1,
    recipient: RECIPIENT,
  };
  record(
    'deny_recipient_mismatch',
    input,
    explainA2aResult(a2a),
    'PoP aat_aud bound to a different recipient',
  );
}

writeFileSync(
  path.join(OUT, 'vectors.json'),
  JSON.stringify({ generatedForNow: NOW, vectors }, null, 2) + '\n',
);
console.log(`wrote ${vectors.length} vectors to python/tests/vectors/vectors.json`);
for (const v of vectors)
  console.log(
    `  ${v.name}: ${v.expected.decision}${v.expected.reasons[0] ? ' ' + v.expected.reasons[0].code : ''}`,
  );

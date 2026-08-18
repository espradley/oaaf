/**
 * One authority chain, two transports.
 *
 * This is the whole OAAF thesis in one file: the authority is not owned by the
 * transport. We mint a single delegation chain (Alice → Bob, narrowed to
 * repo.read) and a single proof of possession per operation, then feed the
 * *exact same* authority material through both the MCP adapter and the A2A
 * adapter. The allow/deny outcome is identical on both.
 *
 * No account, no service, no issuer. Run with:  npm run demo:cross
 */

import { enforceOaafPrecondition, explainMcpResult } from '@oaaf/sdk'; // MCP / COAZ adapter (RFC-0002)
import {
  enforceA2aAuthority,
  explainA2aResult,
  METADATA_KEY_CHAIN,
  METADATA_KEY_POP,
  OAAF_A2A_EXTENSION_URI,
} from '@oaaf/sdk'; // A2A adapter (RFC-0003)
import { generateHolderKey, mintDerivedToken, mintPop, mintRootToken } from '@oaaf/sdk/testing';

const NOW = Math.floor(Date.now() / 1000);
const HOUR = 3600;

// --- ONE authority chain: Alice (broad) delegates a narrower grant to Bob ---
const issuerKey = await generateHolderKey();
const aliceKey = await generateHolderKey();
const bobKey = await generateHolderKey();

const aliceGrant = await mintRootToken({
  issuer: 'https://authority.example',
  issuerKey,
  holder: aliceKey,
  tools: { 'repo.read': {}, 'repo.merge': {} }, // Alice can read AND merge
  issuedAt: NOW,
  expiresAt: NOW + HOUR,
  maxDepth: 2,
  jti: 'alice-grant',
});

const bobGrant = await mintDerivedToken({
  parentToken: aliceGrant,
  parentKey: aliceKey,
  parentPayload: { del_depth: 0, del_max_depth: 2, exp: NOW + HOUR, iat: NOW },
  holder: bobKey,
  tools: { 'repo.read': {} }, // Bob gets read ONLY — merge is not delegated
  issuedAt: NOW,
  expiresAt: NOW + HOUR / 2,
  jti: 'bob-grant',
});

// The one chain and one set of trust anchors used for BOTH transports.
const chain = [aliceGrant, bobGrant];
const trustAnchors = [issuerKey.publicJwk];

/** Run one operation's identical (chain, pop) through MCP, then A2A. */
async function acrossBothTransports(operation, args) {
  // A single proof of possession for this operation — reused verbatim by both.
  const pop = await mintPop({
    leafKey: bobKey,
    leafJti: 'bob-grant',
    tool: operation,
    args,
    issuedAt: NOW,
  });

  // --- MCP adapter ---
  const mcp = await enforceOaafPrecondition({
    tokens: chain,
    trustAnchors,
    pop,
    tool: operation,
    args,
    now: NOW + 1,
  });

  // --- A2A adapter --- same chain, same pop, wrapped in an A2A message ---
  const a2a = await enforceA2aAuthority({
    message: { metadata: { [METADATA_KEY_CHAIN]: chain, [METADATA_KEY_POP]: pop } },
    activatedExtensionUris: [OAAF_A2A_EXTENSION_URI],
    trustAnchors,
    skillId: operation,
    args,
    recipient: 'https://bob.agents.example',
    now: NOW + 1,
  });

  // The canonical, transport-neutral explanation from each adapter (O4B).
  const mcpEx = explainMcpResult(mcp);
  const a2aEx = explainA2aResult(a2a);
  const sameExplanation = JSON.stringify(mcpEx) === JSON.stringify(a2aEx);

  const detail = (e) =>
    e.decision === 'ALLOW'
      ? `ALLOW  subject=${e.authority.subject.slice(0, 24)}… tool=${e.authority.requestedTool} depth=${e.authority.delegationDepth}`
      : `DENY   ${e.reasons[0].code}${e.reasons[0].tool ? ` tool=${e.reasons[0].tool}` : ''}`;

  console.log(`\n  ${operation}(${JSON.stringify(args)})`);
  console.log(`    MCP  (Agent → Tool):   ${detail(mcpEx)}`);
  console.log(`    A2A  (Agent → Agent):  ${detail(a2aEx)}`);
  console.log(`    → explanation ${sameExplanation ? 'equivalent' : 'DIVERGED'}`);
  return sameExplanation;
}

console.log('═'.repeat(64));
console.log('  Same authority chain (Alice → Bob, narrowed to repo.read)');
console.log('  Same proof of possession — through two different transports');
console.log('═'.repeat(64));

const a = await acrossBothTransports('repo.read', { path: 'src/' });
const b = await acrossBothTransports('repo.merge', { branch: 'main' });

console.log(`\n${'═'.repeat(64)}`);
if (a && b) {
  console.log('  Both operations produced an equivalent explanation on both transports —');
  console.log('  same decision, same reason, same locators, same authority summary.');
  console.log('  The explanation belongs to the authority evaluation, not the transport.');
} else {
  console.log('  DIVERGENCE — the transports disagreed. This should never happen.');
  process.exitCode = 1;
}
console.log('═'.repeat(64));

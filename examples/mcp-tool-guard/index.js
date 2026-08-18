/**
 * OAAF as an MCP tool guard.
 *
 * A gateway sits in front of an MCP server. Before it authorizes a `tools/call`
 * the normal way — mapping it into an AuthZEN request and asking a PDP — it
 * checks one more thing: does the caller actually hold delegated authority for
 * this exact tool and these exact arguments?
 *
 * That check is OAAF. It runs *before* the PDP. If it fails, the request is
 * denied and the PDP is never asked. This example makes that visible: the mock
 * PDP announces itself every time it is called, so you can see it stay silent on
 * the denied request.
 *
 * No account, no service, no database. Run with:  npm run demo:mcp
 */

import { enforceAndMapToCoaz } from '@oaaf/sdk';
import { generateHolderKey, mintDerivedToken, mintPop, mintRootToken } from '@oaaf/sdk/testing';

// ---------------------------------------------------------------------------
// A stand-in for whatever AuthZEN PDP the MCP deployment already uses. It
// permits everything — the point is only to show WHEN it is consulted. In a
// denied request, you will not see this line.
// ---------------------------------------------------------------------------
async function mockPdp(request) {
  console.log(`    → PDP called for ${request.action.name} on ${request.resource.id} → permit`);
  return { decision: true };
}

// ---------------------------------------------------------------------------
// Local test authority. This stands in for an issuer so you can run the whole
// flow without deploying one. OAAF does not provide or require a production
// token-issuance service — see the README.
// ---------------------------------------------------------------------------
const NOW = Math.floor(Date.now() / 1000);
const HOUR = 3600;

const issuerKey = await generateHolderKey(); // the trust anchor
const agentKey = await generateHolderKey(); // the delegating agent
const subAgentKey = await generateHolderKey(); // the agent that will call the tool

// The issuer grants the agent read access to two files.
const rootToken = await mintRootToken({
  issuer: 'https://authority.example',
  issuerKey,
  holder: agentKey,
  tools: {
    read_file: {
      path: { constraint_type: 'one_of', values: ['/reports/q3.pdf', '/reports/q4.pdf'] },
    },
  },
  issuedAt: NOW,
  expiresAt: NOW + HOUR,
  maxDepth: 2,
  jti: 'grant-root',
});

// The agent delegates a NARROWER authority to a sub-agent: one file only.
const delegatedToken = await mintDerivedToken({
  parentToken: rootToken,
  parentKey: agentKey,
  parentPayload: { del_depth: 0, del_max_depth: 2, exp: NOW + HOUR, iat: NOW },
  holder: subAgentKey,
  tools: { read_file: { path: { constraint_type: 'exact', value: '/reports/q3.pdf' } } },
  issuedAt: NOW,
  expiresAt: NOW + HOUR / 2,
  jti: 'grant-delegated',
});

const authorityChain = [rootToken, delegatedToken];
const trustAnchors = [issuerKey.publicJwk];

/**
 * One MCP `tools/call`, guarded by OAAF then (if it survives) authorized by the
 * PDP — exactly the sequence an OAAF-aware MCP gateway performs.
 */
async function handleToolCall({ label, toolName, args }) {
  console.log(`\n${'─'.repeat(68)}`);
  console.log(`MCP tools/call  →  ${toolName}(${JSON.stringify(args)})`);
  console.log(`${label}`);
  console.log('─'.repeat(68));

  // The sub-agent proves possession of its delegated authority for this call.
  const pop = await mintPop({
    leafKey: subAgentKey,
    leafJti: 'grant-delegated',
    tool: toolName,
    args,
    issuedAt: NOW,
  });

  // OAAF precondition: verify delegated authority BEFORE building a PDP request.
  const guard = await enforceAndMapToCoaz({
    tokens: authorityChain,
    trustAnchors,
    pop,
    tool: toolName,
    args,
    principal: 'urn:example:user:alice', // COAZ's $token.sub — unrelated to OAAF
    agent: 'agent:sub-worker-7', // COAZ's $token.?client_id
  });

  if (!guard.ok) {
    console.log('OAAF precondition: DENY');
    for (const r of guard.error.data.reasons) console.log(`  reason: ${r.code} — ${r.message}`);
    console.log('  the PDP is never called; the request stops here.');
    return;
  }

  console.log('OAAF precondition: PASS — delegated authority verified');
  console.log('  handing COAZ/AuthZEN request to the PDP:');
  const decision = await mockPdp(guard.request);
  console.log(`  final: ${decision.decision ? 'ALLOW — tool executes' : 'DENY'}`);
}

// ALLOW: the sub-agent calls the file it was delegated.
await handleToolCall({
  label: 'ALLOW — the caller holds delegated authority for this exact call',
  toolName: 'read_file',
  args: { path: '/reports/q3.pdf' },
});

// DENY: the sub-agent calls the file it was NOT delegated. The root authority
// permits it; the delegated chain does not. COAZ-facing structure is identical
// and perfectly valid — but the request never reaches the PDP.
await handleToolCall({
  label: 'DENY — the root grant allowed this path, but the delegation gave it up',
  toolName: 'read_file',
  args: { path: '/reports/q4.pdf' },
});

console.log(`\n${'─'.repeat(68)}`);
console.log('The denied call had valid MCP/COAZ structure. OAAF stopped it because');
console.log('the delegated authority was insufficient — before any PDP was consulted.');
console.log('─'.repeat(68));

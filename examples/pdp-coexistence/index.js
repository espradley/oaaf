/**
 * OAAF in front of an existing policy engine (PDP) — RFC-0006.
 *
 * Two decisions, not one:
 *   1. OAAF verifies delegated authority (its decision; fails closed).
 *   2. The organization's existing PDP applies org policy using OAAF's verified
 *      facts (the PDP's decision; OAAF does not make it).
 *
 * OAAF conveys the authority context; the PDP owns policy. This example uses a
 * tiny stub PDP so it runs with no external engine — a real deployment would send
 * the AuthZEN request to AuthZEN/OPA/Cedar/OpenFGA instead.
 *
 * No account, no service, no issuer. Run with:  npm run demo:pdp
 */

import { verifyAuthority, evaluate, toAuthorityContext } from '@oaaf/sdk';
import { generateHolderKey, mintDerivedToken, mintPop, mintRootToken } from '@oaaf/sdk/testing';

const NOW = Math.floor(Date.now() / 1000);
const HOUR = 3600;

// --- A stub organizational PDP. This stands in for AuthZEN/OPA/Cedar/OpenFGA. ---
// It encodes ORG policy — OAAF does not. Here: this org only permits authority
// delegated at most once (delegationDepth <= 1), and only for subjects it lists.
const ORG_ALLOWED_SUBJECTS = new Set(['spiffe://company.example/agents/bob']);
function orgPdp(authorityContext) {
  if (!authorityContext.authorityVerified)
    return { decision: false, reason: 'authority not verified' };
  if (authorityContext.delegationDepth > 1) {
    return { decision: false, reason: 'org policy: delegation depth exceeds 1' };
  }
  if (!ORG_ALLOWED_SUBJECTS.has(authorityContext.subject)) {
    return {
      decision: false,
      reason: `org policy: subject ${authorityContext.subject} not permitted`,
    };
  }
  return { decision: true, reason: 'org policy satisfied' };
}

// --- Build a chain: Alice delegates repo.read to Bob (a SPIFFE subject) ---
const issuerKey = await generateHolderKey();
const aliceKey = await generateHolderKey();
const bobKey = await generateHolderKey();
const root = await mintRootToken({
  issuer: 'https://authority.example',
  issuerKey,
  holder: aliceKey,
  tools: { 'repo.read': {} },
  issuedAt: NOW,
  expiresAt: NOW + HOUR,
  maxDepth: 3,
  jti: 'root',
});
const bobGrant = await mintDerivedToken({
  parentToken: root,
  parentKey: aliceKey,
  parentPayload: { del_depth: 0, del_max_depth: 3, exp: NOW + HOUR, iat: NOW },
  holder: bobKey,
  tools: { 'repo.read': {} },
  issuedAt: NOW,
  expiresAt: NOW + HOUR / 2,
  jti: 'bob',
  overrides: { sub: 'spiffe://company.example/agents/bob' },
});

async function request({ label, tokens, key, jti }) {
  const args = { path: 'src/' };
  const pop = await mintPop({ leafKey: key, leafJti: jti, tool: 'repo.read', args, issuedAt: NOW });

  console.log(`\n${'─'.repeat(70)}`);
  console.log(label);
  console.log('─'.repeat(70));

  // DECISION 1 — OAAF authority (the precondition).
  const verified = await verifyAuthority({
    tokens,
    trustAnchors: [issuerKey.publicJwk],
    pop,
    tool: 'repo.read',
    args,
    now: NOW + 1,
  });
  if (!verified.ok) {
    console.log(`  OAAF authority: DENY (${verified.denials[0].code}) — the PDP is never called`);
    return;
  }
  const decision = evaluate(verified.authority);
  if (!decision.allowed) {
    console.log(`  OAAF authority: DENY (${decision.denials[0].code})`);
    return;
  }
  console.log('  OAAF authority: PASS');

  // OAAF conveys the verified facts; the PDP decides on org policy.
  const context = toAuthorityContext(verified.authority);
  console.log(
    `    → authority context: subject=${context.subject} depth=${context.delegationDepth} granted=${context.grantedTools.join(',')}`,
  );

  // DECISION 2 — the organization's PDP.
  const policy = orgPdp(context);
  console.log(`  Org PDP policy: ${policy.decision ? 'PERMIT' : 'DENY'} — ${policy.reason}`);
  console.log(`  Final: ${policy.decision ? 'ALLOW — tool executes' : 'DENY'}`);
}

// Bob reads — authority valid AND org policy satisfied.
await request({
  label: 'Bob (depth 1, permitted subject) reads',
  tokens: [root, bobGrant],
  key: bobKey,
  jti: 'bob',
});

// Bob delegates once more to Charlie; OAAF authority is still valid, but the org
// PDP denies on depth policy — OAAF did not make that call.
const charlieKey = await generateHolderKey();
const charlieGrant = await mintDerivedToken({
  parentToken: bobGrant,
  parentKey: bobKey,
  parentPayload: { del_depth: 1, del_max_depth: 3, exp: NOW + HOUR / 2, iat: NOW },
  holder: charlieKey,
  tools: { 'repo.read': {} },
  issuedAt: NOW,
  expiresAt: NOW + HOUR / 4,
  jti: 'charlie',
  overrides: { sub: 'spiffe://company.example/agents/charlie' },
});
await request({
  label: 'Charlie (depth 2) reads — valid authority, but org policy denies',
  tokens: [root, bobGrant, charlieGrant],
  key: charlieKey,
  jti: 'charlie',
});

console.log(`\n${'─'.repeat(70)}`);
console.log("OAAF verified the delegated authority in both cases. The organization's");
console.log('PDP made the policy call — including denying a cryptographically valid');
console.log('authority on a depth rule OAAF knows nothing about. OAAF fed facts; the');
console.log('PDP owned policy. Neither replaced the other.');
console.log('─'.repeat(70));

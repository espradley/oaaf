/**
 * OAAF delegated authority over A2A.
 *
 * Alice holds broad authority over a repo. She delegates a NARROWER authority to
 * Bob over A2A — read and comment, but not merge. Bob then makes two A2A calls.
 * Before Bob's agent does any consequential work, it runs the OAAF precondition.
 *
 * The permitted call proceeds. The non-delegated one is refused before Bob's
 * handler ever runs — and the demo makes that visible: the handler prints a line
 * only when it actually executes.
 *
 * No account, no service, no issuer. Run with:  npm run demo:a2a
 *
 * Note: OAAF verifies the A→B delegation of authority. It does not decide why Bob
 * was chosen, whether Bob takes over Alice's work, or what happens to Alice — that
 * is outside OAAF entirely.
 */

import { enforceA2aAuthority } from '@oaaf/sdk';
import { METADATA_KEY_CHAIN, METADATA_KEY_POP, OAAF_A2A_EXTENSION_URI } from '@oaaf/sdk';
import { generateHolderKey, mintDerivedToken, mintPop, mintRootToken } from '@oaaf/sdk/testing';

const NOW = Math.floor(Date.now() / 1000);
const HOUR = 3600;
const BOB_AGENT = 'https://bob.agents.example';

// --- Local test authority (stands in for an issuer; not a production service) ---
const issuerKey = await generateHolderKey();
const aliceKey = await generateHolderKey();
const bobKey = await generateHolderKey();

// The issuer grants Alice broad authority over the repo.
const aliceGrant = await mintRootToken({
  issuer: 'https://authority.example',
  issuerKey,
  holder: aliceKey,
  tools: {
    'repo.read': {},
    'repo.comment': {},
    'repo.merge': {},
  },
  issuedAt: NOW,
  expiresAt: NOW + HOUR,
  maxDepth: 2,
  jti: 'alice-grant',
});

// Alice delegates a NARROWER authority to Bob: read and comment only.
const bobGrant = await mintDerivedToken({
  parentToken: aliceGrant,
  parentKey: aliceKey,
  parentPayload: { del_depth: 0, del_max_depth: 2, exp: NOW + HOUR, iat: NOW },
  holder: bobKey,
  tools: { 'repo.read': {}, 'repo.comment': {} }, // repo.merge deliberately dropped
  issuedAt: NOW,
  expiresAt: NOW + HOUR / 2,
  jti: 'bob-grant',
});

const chain = [aliceGrant, bobGrant];
const trustAnchors = [issuerKey.publicJwk];

// Bob's actual work handler. It prints ONLY when it runs — so you can see it stay
// silent on the denied call.
function bobPerforms(skillId, args) {
  console.log(`    ▶ Bob's handler executes: ${skillId}(${JSON.stringify(args)})`);
}

/** One A2A request from Alice's client to Bob, guarded by the OAAF precondition. */
async function bobReceivesA2aRequest({ label, skillId, args }) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`A2A request → Bob:  ${skillId}(${JSON.stringify(args)})`);
  console.log(label);
  console.log('─'.repeat(70));

  // Bob proves possession of his delegated authority for this exact call, bound
  // to himself as the recipient.
  const pop = await mintPop({
    leafKey: bobKey,
    leafJti: 'bob-grant',
    tool: skillId,
    args,
    issuedAt: NOW,
    overrides: { aat_aud: BOB_AGENT },
  });

  // The A2A Message carries the authority in metadata, per RFC-0003.
  const message = {
    metadata: {
      [METADATA_KEY_CHAIN]: chain,
      [METADATA_KEY_POP]: pop,
    },
  };

  // Bob's agent enforces OAAF authority BEFORE doing any consequential work.
  const guard = await enforceA2aAuthority({
    message,
    activatedExtensionUris: [OAAF_A2A_EXTENSION_URI], // Alice activated it
    trustAnchors,
    skillId,
    args,
    recipient: BOB_AGENT,
    requireRecipientBinding: true,
  });

  if (!guard.ok) {
    console.log('OAAF precondition: DENY');
    for (const r of guard.error.data.reasons) console.log(`  reason: ${r.code} — ${r.message}`);
    console.log('  Bob does no consequential work; the request stops here.');
    return;
  }

  console.log('OAAF precondition: PASS — delegated authority verified');
  bobPerforms(skillId, args);
}

// Bob reads — within his delegated authority.
await bobReceivesA2aRequest({
  label: 'ALLOW — read was delegated to Bob',
  skillId: 'repo.read',
  args: { path: 'src/' },
});

// Bob attempts to merge — Alice held that authority, but did NOT delegate it.
await bobReceivesA2aRequest({
  label: 'DENY — Alice can merge, but did not delegate merge to Bob',
  skillId: 'repo.merge',
  args: { branch: 'main' },
});

console.log(`\n${'─'.repeat(70)}`);
console.log("Alice's authority included repo.merge. Bob's delegated authority did not,");
console.log("so Bob's agent refused the merge before running any handler — verified,");
console.log('not assumed. OAAF checked the delegation; it did not orchestrate the work.');
console.log('─'.repeat(70));

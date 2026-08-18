/**
 * OAAF quickstart.
 *
 * An agent is granted read access to two reports. It delegates a narrower
 * authority to a sub-agent — one report only. The sub-agent then tries to read
 * the other one.
 *
 * No account, no service, no network. Run with: npm run demo
 */

import { evaluate, explain, verifyAuthority } from '@oaaf/sdk';
import { generateHolderKey, mintDerivedToken, mintPop, mintRootToken } from '@oaaf/sdk/testing';

const NOW = Math.floor(Date.now() / 1000);
const HOUR = 3600;
const LEAF_JTI = 'grant-1-delegated';

// 1. An issuer grants an agent read access to two reports.
//    The issuer key is the trust anchor; the agent key is the holder.
const issuerKey = await generateHolderKey();
const agent = await generateHolderKey();
const rootToken = await mintRootToken({
  issuer: 'https://authority.example',
  issuerKey,
  holder: agent,
  tools: {
    read_file: {
      path: { constraint_type: 'one_of', values: ['/data/q3.pdf', '/data/q4.pdf'] },
    },
  },
  issuedAt: NOW,
  expiresAt: NOW + HOUR,
  maxDepth: 2,
  jti: 'grant-1',
});

// 2. The agent delegates a narrower authority: one report only.
const subAgent = await generateHolderKey();
const derivedToken = await mintDerivedToken({
  parentToken: rootToken,
  parentKey: agent,
  parentPayload: { del_depth: 0, del_max_depth: 2, exp: NOW + HOUR, iat: NOW },
  holder: subAgent,
  tools: { read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } } },
  issuedAt: NOW,
  expiresAt: NOW + HOUR / 2,
  jti: LEAF_JTI,
});

const chain = [rootToken, derivedToken];

/** Present the chain and a fresh proof of possession for one invocation. */
async function attempt(path) {
  const args = { path };
  const pop = await mintPop({
    leafKey: subAgent,
    leafJti: LEAF_JTI,
    tool: 'read_file',
    args,
    issuedAt: NOW,
  });

  console.log(`\n${'─'.repeat(64)}`);
  console.log(`read_file(path="${path}")`);
  console.log('─'.repeat(64));

  const verification = await verifyAuthority({
    tokens: chain,
    trustAnchors: [issuerKey.publicJwk],
    pop,
    tool: 'read_file',
    args,
  });

  if (!verification.ok) {
    console.log('DENIED — authority did not verify');
    for (const d of verification.denials) console.log(`  ${d.code}: ${d.message}`);
    return;
  }

  console.log(explain(evaluate(verification.authority), verification.authority));
}

// 3. The report the sub-agent was delegated.
await attempt('/data/q3.pdf');

// 4. The report it was not. The ROOT authority permits this path;
//    the delegated chain does not.
await attempt('/data/q4.pdf');

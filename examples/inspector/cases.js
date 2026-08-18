/**
 * Built-in example cases for the inspector.
 *
 * Each mints a fresh, self-contained authority case in memory using
 * @oaaf/sdk/testing, so a developer gets useful output with zero setup and no
 * signed material on disk or in shell history. These are illustrations, not
 * conformance vectors (O6 owns those).
 */

import { generateHolderKey, mintDerivedToken, mintPop, mintRootToken } from '@oaaf/sdk/testing';

const HOUR = 3600;

/** A case is exactly the public input to the OAAF pipeline. */
async function build({ leafTools, tool, args, secondArgs }) {
  // Fixed evaluation instant so cases are deterministic and never "expired now".
  const NOW = 1_780_000_000;

  const issuerKey = await generateHolderKey();
  const aliceKey = await generateHolderKey();
  const bobKey = await generateHolderKey();

  // Alice holds broad authority; delegates a narrowed grant to Bob.
  const aliceGrant = await mintRootToken({
    issuer: 'https://authority.example',
    issuerKey,
    holder: aliceKey,
    tools: { 'repo.read': {}, 'repo.merge': {}, 'repo.comment': {} },
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
    tools: leafTools,
    issuedAt: NOW,
    expiresAt: NOW + HOUR / 2,
    jti: 'bob-grant',
  });

  const pop = await mintPop({
    leafKey: bobKey,
    leafJti: 'bob-grant',
    tool,
    args: secondArgs ?? args,
    issuedAt: NOW,
  });

  return {
    tokens: [aliceGrant, bobGrant],
    trustAnchors: [issuerKey.publicJwk],
    pop,
    tool,
    args,
    now: NOW + 1,
  };
}

/** The three built-in cases the inspector can demonstrate. */
export const EXAMPLES = {
  // Bob was delegated repo.read; he reads. → ALLOW
  allow: () =>
    build({
      leafTools: { 'repo.read': {} },
      tool: 'repo.read',
      args: { path: 'src/' },
    }),

  // Alice can merge, but did not delegate it to Bob. → DENY tool_not_authorized
  'deny-undelegated': () =>
    build({
      leafTools: { 'repo.read': {} },
      tool: 'repo.merge',
      args: { branch: 'main' },
      // PoP must bind the actually-requested tool.
      secondArgs: { branch: 'main' },
    }),

  // Bob's read is narrowed to one path; he requests another.
  // → DENY argument_constraint_violated (name shown, value never)
  'deny-argument': () =>
    build({
      leafTools: {
        'repo.read': { path: { constraint_type: 'exact', value: 'src/allowed.ts' } },
      },
      tool: 'repo.read',
      args: { path: 'secret/customer-1234.ts' },
    }),
};

export const EXAMPLE_NAMES = Object.keys(EXAMPLES);

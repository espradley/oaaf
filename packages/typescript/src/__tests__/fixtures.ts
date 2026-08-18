/**
 * Shared fixture builders for AAT -01.
 *
 * Structured so O3 bindings and the O6 conformance suite can consume them
 * unchanged: every helper returns tokens and keys rather than assertions.
 */

import {
  generateHolderKey,
  mintDerivedToken,
  mintPop,
  mintRootToken,
  type Keypair,
} from '../testing/mint.js';
import type { ToolConstraints } from '../aat/claims.js';

export const NOW = 1_780_000_000;
export const HOUR = 3600;
export const ISSUER = 'https://authority.example';

export const EXAMPLE_TOOLS: Record<string, ToolConstraints> = {
  read_file: {
    path: { constraint_type: 'one_of', values: ['/data/q3.pdf', '/data/q4.pdf'] },
  },
  search_index: {},
};

export interface Chain {
  tokens: string[];
  keys: Keypair[];
  leafJti: string;
  maxDepth: number;
  /** Public keys trusted as root issuers, for `verifyDelegationChain`. */
  trustAnchors: Record<string, unknown>[];
}

/** Root-only chain. */
export async function buildRoot(
  tools: Record<string, ToolConstraints> = EXAMPLE_TOOLS,
  overrides: { issuedAt?: number; expiresAt?: number; maxDepth?: number } = {},
): Promise<Chain> {
  const issuerKey = await generateHolderKey();
  const holder = await generateHolderKey();
  const jti = 'root-1';
  const token = await mintRootToken({
    issuer: ISSUER,
    issuerKey,
    holder,
    tools,
    issuedAt: overrides.issuedAt ?? NOW,
    expiresAt: overrides.expiresAt ?? NOW + HOUR,
    maxDepth: overrides.maxDepth ?? 3,
    jti,
  });
  return {
    tokens: [token],
    keys: [holder],
    leafJti: jti,
    maxDepth: overrides.maxDepth ?? 3,
    trustAnchors: [issuerKey.publicJwk],
  };
}

/** Append one derived token narrowing the current leaf. */
export async function extend(
  chain: Chain,
  tools: Record<string, ToolConstraints>,
  overrides: Parameters<typeof mintDerivedToken>[0]['overrides'] = undefined,
  temporal: { issuedAt?: number; expiresAt?: number } = {},
): Promise<Chain> {
  const parentKey = chain.keys[chain.keys.length - 1] as Keypair;
  const parentToken = chain.tokens[chain.tokens.length - 1] as string;
  const holder = await generateHolderKey();
  const depth = chain.keys.length - 1;
  const jti = `derived-${depth + 1}`;

  const token = await mintDerivedToken({
    parentToken,
    parentKey,
    parentPayload: {
      del_depth: depth,
      del_max_depth: chain.maxDepth,
      exp: NOW + HOUR,
      iat: NOW,
    },
    holder,
    tools,
    issuedAt: temporal.issuedAt ?? NOW,
    expiresAt: temporal.expiresAt ?? NOW + HOUR,
    jti,
    ...(overrides === undefined ? {} : { overrides }),
  });

  return {
    tokens: [...chain.tokens, token],
    keys: [...chain.keys, holder],
    leafJti: jti,
    maxDepth: chain.maxDepth,
    trustAnchors: chain.trustAnchors,
  };
}

/** Mint a proof of possession for a chain's leaf. */
export async function popFor(
  chain: Chain,
  tool: string,
  args: Record<string, unknown> = {},
  overrides: Parameters<typeof mintPop>[0]['overrides'] = undefined,
): Promise<string> {
  return mintPop({
    leafKey: chain.keys[chain.keys.length - 1] as Keypair,
    leafJti: chain.leafJti,
    tool,
    args,
    issuedAt: NOW,
    ...(overrides === undefined ? {} : { overrides }),
  });
}

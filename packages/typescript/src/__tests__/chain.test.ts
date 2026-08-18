import { describe, expect, it } from 'vitest';
import { CompactSign } from 'jose';

import { verifyDelegationChain, MAX_DELEGATION_DEPTH } from '../aat/verify.js';
import { decodeBase64Url, encodeBase64Url } from '../base64url.js';
import { generateHolderKey, mintRootToken, type Keypair } from '../testing/mint.js';
import type { ReasonCode } from '../reasons.js';
import { buildRoot, extend, EXAMPLE_TOOLS, HOUR, ISSUER, NOW, type Chain } from './fixtures.js';

/** Decode a base64url JSON segment. */
function decodeJson(segment: string): Record<string, unknown> {
  const bytes = decodeBase64Url(segment);
  if (bytes === null) throw new Error('segment is not base64url');
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

function encodeJson(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** Re-sign an arbitrary payload, so a test exercises the claim, not the signature. */
async function resign(payload: unknown, key: Keypair, alg = 'EdDSA'): Promise<string> {
  return new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg })
    .sign(key.privateKey);
}

/** Build a root token whose payload has been mutated after minting. */
async function tamperedRoot(
  mutate: (payload: Record<string, unknown>) => void,
): Promise<{ tokens: string[]; trustAnchors: Record<string, unknown>[] }> {
  const issuerKey = await generateHolderKey();
  const holder = await generateHolderKey();
  const token = await mintRootToken({
    issuer: ISSUER,
    issuerKey,
    holder,
    tools: EXAMPLE_TOOLS,
    issuedAt: NOW,
    expiresAt: NOW + HOUR,
    jti: 'root-1',
  });
  const payload = decodeJson(token.split('.')[1] as string);
  mutate(payload);
  return { tokens: [await resign(payload, issuerKey)], trustAnchors: [issuerKey.publicJwk] };
}

async function expectDenied(
  chain: { tokens: string[]; trustAnchors: Record<string, unknown>[] },
  code: ReasonCode,
  now = NOW + 1,
) {
  const result = await verifyDelegationChain(chain.tokens, {
    trustAnchors: chain.trustAnchors,
    now,
  });
  expect(result.ok, `expected denial ${code}`).toBe(false);
  if (result.ok) return;
  expect(result.denials.map((d) => d.code)).toContain(code);
}

async function expectAllowed(chain: Chain, now = NOW + 1) {
  const result = await verifyDelegationChain(chain.tokens, {
    trustAnchors: chain.trustAnchors,
    now,
  });
  if (!result.ok) throw new Error(`unexpected denial: ${result.denials.map((d) => d.code).join()}`);
  return result.chain;
}

describe('trust anchors', () => {
  it('accepts a root signed by a configured anchor', async () => {
    const chain = await buildRoot();
    const verified = await expectAllowed(chain);
    expect(verified.depth).toBe(0);
    expect(verified.leafHolder).toMatch(/^urn:ietf:params:oauth:jwk-thumbprint:sha-256:/);
  });

  it('denies a root signed by an unknown key', async () => {
    const chain = await buildRoot();
    const stranger = await generateHolderKey();
    await expectDenied(
      { tokens: chain.tokens, trustAnchors: [stranger.publicJwk] },
      'untrusted_root',
    );
  });

  it('denies when no anchors are configured', async () => {
    const chain = await buildRoot();
    await expectDenied({ tokens: chain.tokens, trustAnchors: [] }, 'untrusted_root');
  });

  it('accepts when the anchor is one of several', async () => {
    const chain = await buildRoot();
    const other = await generateHolderKey();
    const result = await verifyDelegationChain(chain.tokens, {
      trustAnchors: [other.publicJwk, ...chain.trustAnchors],
      now: NOW + 1,
    });
    expect(result.ok).toBe(true);
  });
});

describe('structure', () => {
  it('denies an empty chain', async () => {
    await expectDenied({ tokens: [], trustAnchors: [] }, 'chain_empty');
  });

  it('denies an over-long chain', async () => {
    const chain = await buildRoot();
    await expectDenied(
      { tokens: Array.from({ length: 32 }, () => 'x.y.z'), trustAnchors: chain.trustAnchors },
      'chain_too_long',
    );
  });

  it('denies a malformed token', async () => {
    const chain = await buildRoot();
    await expectDenied(
      { tokens: ['not-a-jws'], trustAnchors: chain.trustAnchors },
      'token_malformed',
    );
  });

  it('denies a root missing a required claim', async () => {
    await expectDenied(await tamperedRoot((p) => delete p['del_depth']), 'token_malformed');
  });

  it('denies a root carrying par_hash', async () => {
    await expectDenied(
      await tamperedRoot((p) => {
        p['par_hash'] = 'abc';
      }),
      'par_hash_present_on_root',
    );
  });

  it('denies a root whose iss is not a URI', async () => {
    await expectDenied(
      await tamperedRoot((p) => {
        p['iss'] = 'not a uri';
      }),
      'token_malformed',
    );
  });

  it('denies an empty jti', async () => {
    await expectDenied(
      await tamperedRoot((p) => {
        p['jti'] = '';
      }),
      'token_malformed',
    );
  });

  it('denies cnf.jwk carrying private key material', async () => {
    await expectDenied(
      await tamperedRoot((p) => {
        (p['cnf'] as Record<string, unknown>)['jwk'] = {
          kty: 'OKP',
          crv: 'Ed25519',
          x: 'AAAA',
          d: 'SECRET',
        };
      }),
      'private_key_material',
    );
  });

  it('denies more than one attenuating_agent_token entry', async () => {
    await expectDenied(
      await tamperedRoot((p) => {
        p['authorization_details'] = [
          { type: 'attenuating_agent_token', tools: {} },
          { type: 'attenuating_agent_token', tools: {} },
        ];
      }),
      'authorization_details_invalid',
    );
  });

  it('denies a constraint nested past the depth limit', async () => {
    let nested: unknown = { constraint_type: 'wildcard' };
    for (let i = 0; i < 12; i += 1) nested = { constraint_type: 'all', constraints: [nested] };
    await expectDenied(
      await tamperedRoot((p) => {
        p['authorization_details'] = [
          { type: 'attenuating_agent_token', tools: { deep: { arg: nested } } },
        ];
      }),
      'constraint_too_deep',
    );
  });
});

describe('cryptography', () => {
  it('denies a tampered signature', async () => {
    const chain = await buildRoot();
    await expectDenied(
      {
        tokens: [`${(chain.tokens[0] as string).slice(0, -4)}AAAA`],
        trustAnchors: chain.trustAnchors,
      },
      'untrusted_root',
    );
  });

  it('denies alg: none', async () => {
    const chain = await buildRoot();
    const parts = (chain.tokens[0] as string).split('.');
    await expectDenied(
      {
        tokens: [`${encodeJson({ alg: 'none' })}.${parts[1]}.`],
        trustAnchors: chain.trustAnchors,
      },
      'algorithm_not_permitted',
    );
  });

  it('denies an algorithm outside the allowlist', async () => {
    const chain = await buildRoot();
    const parts = (chain.tokens[0] as string).split('.');
    await expectDenied(
      {
        tokens: [`${encodeJson({ alg: 'HS256' })}.${parts[1]}.${parts[2]}`],
        trustAnchors: chain.trustAnchors,
      },
      'algorithm_not_permitted',
    );
  });

  it('denies EdDSA against a non-OKP anchor (algorithm confusion)', async () => {
    const chain = await buildRoot();
    await expectDenied(
      { tokens: chain.tokens, trustAnchors: [{ kty: 'oct', k: 'AAAA' }] },
      'algorithm_not_permitted',
    );
  });
});

describe('temporal', () => {
  it('denies an expired token', async () => {
    await expectDenied(await buildRoot(), 'expired', NOW + HOUR + 10);
  });

  it('denies a token issued beyond the skew window', async () => {
    const chain = await buildRoot(EXAMPLE_TOOLS, { issuedAt: NOW + 600, expiresAt: NOW + HOUR });
    await expectDenied(chain, 'not_yet_valid', NOW);
  });

  it('denies exp not after iat', async () => {
    await expectDenied(
      await tamperedRoot((p) => {
        p['exp'] = p['iat'];
      }),
      'expiry_not_after_issuance',
      NOW - 10,
    );
  });

  it('denies a lifetime beyond the permitted maximum', async () => {
    await expectDenied(
      await tamperedRoot((p) => {
        p['exp'] = (p['iat'] as number) + 400 * 24 * 3600;
      }),
      'lifetime_exceeded',
    );
  });

  it('denies a child outliving its parent', async () => {
    const root = await buildRoot();
    const chain = await extend(
      root,
      { read_file: EXAMPLE_TOOLS['read_file'] as never },
      undefined,
      {
        expiresAt: NOW + HOUR * 5,
      },
    );
    await expectDenied(chain, 'expiry_exceeds_parent');
  });
});

describe('delegation', () => {
  it('accepts a valid one-hop attenuation', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const verified = await expectAllowed(chain);
    expect(verified.depth).toBe(1);
    expect(Object.keys(verified.leafTools)).toEqual(['read_file']);
  });

  it('accepts a valid multi-hop attenuation', async () => {
    const root = await buildRoot();
    const hop1 = await extend(root, {
      read_file: { path: { constraint_type: 'one_of', values: ['/data/q3.pdf'] } },
    });
    const hop2 = await extend(hop1, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    expect((await expectAllowed(hop2)).depth).toBe(2);
  });

  it('denies a broken parent binding', async () => {
    const root = await buildRoot();
    const chain = await extend(
      root,
      { read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } } },
      { par_hash: 'not-the-parent-hash' },
    );
    await expectDenied(chain, 'par_hash_mismatch');
  });

  it('denies a wrong issuer thumbprint', async () => {
    const root = await buildRoot();
    const chain = await extend(
      root,
      { read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } } },
      { iss: 'urn:ietf:params:oauth:jwk-thumbprint:sha-256:wrong' },
    );
    await expectDenied(chain, 'issuer_thumbprint_mismatch');
  });

  it('denies a depth that does not increment by one', async () => {
    const root = await buildRoot();
    const chain = await extend(
      root,
      { read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } } },
      { del_depth: 5 },
    );
    await expectDenied(chain, 'delegation_depth_invalid');
  });

  it('denies a derived token raising the delegation ceiling', async () => {
    const root = await buildRoot(EXAMPLE_TOOLS, { maxDepth: 1 });
    const chain = await extend(
      root,
      { read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } } },
      { del_max_depth: 99 },
    );
    await expectDenied(chain, 'delegation_ceiling_raised');
  });

  it('denies a root ceiling above the implementation limit', async () => {
    await expectDenied(
      await tamperedRoot((p) => {
        p['del_max_depth'] = MAX_DELEGATION_DEPTH + 1;
      }),
      'delegation_ceiling_invalid',
    );
  });

  it('denies a depth beyond the token own ceiling', async () => {
    const root = await buildRoot(EXAMPLE_TOOLS, { maxDepth: 3 });
    const chain = await extend(
      root,
      { read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } } },
      { del_max_depth: 0 },
    );
    await expectDenied(chain, 'depth_exceeds_own_ceiling');
  });

  it('denies a repeated token instance', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    await expectDenied(
      { tokens: [...chain.tokens, chain.tokens[1] as string], trustAnchors: chain.trustAnchors },
      'chain_cycle_detected',
    );
  });
});

describe('narrowing', () => {
  it('denies a tool the parent never granted', async () => {
    const root = await buildRoot();
    await expectDenied(await extend(root, { delete_file: {} }), 'tool_not_delegated');
  });

  it('denies widening a constraint', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: {
        path: {
          constraint_type: 'one_of',
          values: ['/data/q3.pdf', '/data/q4.pdf', '/etc/passwd'],
        },
      },
    });
    await expectDenied(chain, 'constraint_expansion');
  });

  it('denies a derived wildcard under a narrower parent', async () => {
    const root = await buildRoot();
    const chain = await extend(root, { read_file: { path: { constraint_type: 'wildcard' } } });
    await expectDenied(chain, 'constraint_type_not_permitted');
  });

  it('denies an unrecognized constraint type', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'regex', pattern: '.*' } as never },
    });
    await expectDenied(chain, 'constraint_type_unrecognized');
  });

  it('denies adding an argument key to a constrained tool', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: {
        path: { constraint_type: 'exact', value: '/data/q3.pdf' },
        encoding: { constraint_type: 'exact', value: 'utf8' },
      },
    });
    await expectDenied(chain, 'argument_key_set_mismatch');
  });

  it('denies dropping an argument key from a constrained tool', async () => {
    // Closed-world semantics make the key set the invocation shape, so
    // omission is not narrowing — it produces a disjoint invocation set.
    const root = await buildRoot();
    await expectDenied(await extend(root, { read_file: {} }), 'argument_key_set_mismatch');
  });

  it('allows introducing keys under an open-world parent', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      search_index: { query: { constraint_type: 'exact', value: 'q3' } },
    });
    await expectAllowed(chain);
  });

  it('allows omitting a tool, which narrows', async () => {
    const root = await buildRoot();
    const chain = await extend(root, { search_index: {} });
    expect(Object.keys((await expectAllowed(chain)).leafTools)).toEqual(['search_index']);
  });
});

describe('chain consistency', () => {
  it('denies a chain length that disagrees with leaf depth', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    // Present only the leaf: its del_depth is 1 but the chain length is 1.
    await expectDenied(
      { tokens: [chain.tokens[1] as string], trustAnchors: chain.trustAnchors },
      'untrusted_root',
    );
  });

  it('accepts a single-token chain at depth 0', async () => {
    expect((await expectAllowed(await buildRoot())).depth).toBe(0);
  });
});

describe('determinism', () => {
  it('produces the same verified authority for the same input', async () => {
    const chain = await buildRoot();
    const a = await expectAllowed(chain);
    const b = await expectAllowed(chain);
    expect(a.leafHolder).toBe(b.leafHolder);
    expect(JSON.stringify(a.leafTools)).toBe(JSON.stringify(b.leafTools));
  });
});

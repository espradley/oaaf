import { describe, expect, it } from 'vitest';

import { verifyDelegationChain } from '../aat/verify.js';
import { decodeBase64Url, encodeBase64Url } from '../base64url.js';
import { generateHolderKey, mintDerivedToken, mintRootToken } from '../testing/mint.js';
import type { ReasonCode } from '../reasons.js';
import { buildRoot, extend, EXAMPLE_TOOLS, HOUR, ISSUER, NOW } from './fixtures.js';

/** Decode a base64url JSON segment. Test helper; no Node-specific API. */
function decodeJson(segment: string): Record<string, unknown> {
  const bytes = decodeBase64Url(segment);
  if (bytes === null) throw new Error('segment is not base64url');
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

/** Encode a value as a base64url JSON segment. */
function encodeJson(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** Assert a denial with the given code was produced. */
async function expectDenied(tokens: string[], code: ReasonCode, now = NOW + 1) {
  const result = await verifyDelegationChain(tokens, { now });
  expect(result.ok, `expected denial ${code}`).toBe(false);
  if (result.ok) return;
  expect(result.denials.map((d) => d.code)).toContain(code);
}

describe('structure', () => {
  it('denies an empty chain', async () => {
    await expectDenied([], 'chain_empty');
  });

  it('denies an over-long chain', async () => {
    const result = await verifyDelegationChain(
      Array.from({ length: 32 }, () => 'x.y.z'),
      {
        now: NOW + 1,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.denials[0]?.code).toBe('chain_too_long');
  });

  it('denies a malformed token', async () => {
    await expectDenied(['not-a-jws'], 'token_malformed');
  });

  it('denies a root missing required claims', async () => {
    const holder = await generateHolderKey();
    const token = await mintRootToken({
      issuer: ISSUER,
      holder,
      tools: EXAMPLE_TOOLS,
      issuedAt: NOW,
      expiresAt: NOW + HOUR,
    });
    // Strip a required claim by re-signing a truncated payload.
    const bad = await mintRootToken({
      issuer: ISSUER,
      holder,
      tools: EXAMPLE_TOOLS,
      issuedAt: NOW,
      expiresAt: NOW + HOUR,
    });
    expect(token.length).toBeGreaterThan(0);
    const parts = bad.split('.');
    const payload = decodeJson(parts[1] as string);
    delete payload['del_depth'];
    const tampered = `${parts[0]}.${encodeJson(payload)}.${parts[2]}`;
    await expectDenied([tampered], 'token_malformed');
  });

  it('denies a root carrying par_hash', async () => {
    const holder = await generateHolderKey();
    const token = await mintRootToken({
      issuer: ISSUER,
      holder,
      tools: EXAMPLE_TOOLS,
      issuedAt: NOW,
      expiresAt: NOW + HOUR,
    });
    const parts = token.split('.');
    const payload = decodeJson(parts[1] as string);
    payload['par_hash'] = 'abc';
    // Re-sign so the failure is the claim, not the signature.
    const resigned = await mintRootToken({
      issuer: ISSUER,
      holder,
      tools: EXAMPLE_TOOLS,
      issuedAt: NOW,
      expiresAt: NOW + HOUR,
    });
    expect(resigned).toBeTruthy();
    const { CompactSign } = await import('jose');
    const tampered = await new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
      .setProtectedHeader({ alg: 'EdDSA' })
      .sign(holder.privateKey);
    await expectDenied([tampered], 'par_hash_present_on_root');
  });
});

describe('cryptography', () => {
  it('accepts a valid root token', async () => {
    const chain = await buildRoot();
    const result = await verifyDelegationChain(chain.tokens, { now: NOW + 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.chain.depth).toBe(0);
      expect(result.chain.leafHolder).toMatch(/^urn:ietf:params:oauth:jwk-thumbprint:sha-256:/);
      expect(Object.keys(result.chain.leafTools).sort()).toEqual(['read_file', 'search_index']);
    }
  });

  it('denies a tampered signature', async () => {
    const chain = await buildRoot();
    const token = chain.tokens[0] as string;
    const tampered = `${token.slice(0, -4)}AAAA`;
    await expectDenied([tampered], 'invalid_signature');
  });

  it('denies alg: none', async () => {
    const holder = await generateHolderKey();
    const parts = (
      await mintRootToken({
        issuer: ISSUER,
        holder,
        tools: EXAMPLE_TOOLS,
        issuedAt: NOW,
        expiresAt: NOW + HOUR,
      })
    ).split('.');
    const header = encodeJson({ alg: 'none' });
    await expectDenied([`${header}.${parts[1]}.`], 'algorithm_not_permitted');
  });

  it('denies an algorithm outside the permitted set', async () => {
    const holder = await generateHolderKey();
    const parts = (
      await mintRootToken({
        issuer: ISSUER,
        holder,
        tools: EXAMPLE_TOOLS,
        issuedAt: NOW,
        expiresAt: NOW + HOUR,
      })
    ).split('.');
    const header = encodeJson({ alg: 'HS256' });
    await expectDenied([`${header}.${parts[1]}.${parts[2]}`], 'algorithm_not_permitted');
  });

  it('denies EdDSA against a non-OKP key (algorithm confusion)', async () => {
    const holder = await generateHolderKey();
    const token = await mintRootToken({
      issuer: ISSUER,
      holder,
      tools: EXAMPLE_TOOLS,
      issuedAt: NOW,
      expiresAt: NOW + HOUR,
    });
    const parts = token.split('.');
    const payload = decodeJson(parts[1] as string);
    (payload['cnf'] as Record<string, unknown>)['jwk'] = { kty: 'oct', k: 'AAAA' };
    const { CompactSign } = await import('jose');
    const tampered = await new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
      .setProtectedHeader({ alg: 'EdDSA' })
      .sign(holder.privateKey);
    await expectDenied([tampered], 'algorithm_not_permitted');
  });
});

describe('temporal', () => {
  it('denies an expired token', async () => {
    const chain = await buildRoot();
    await expectDenied(chain.tokens, 'expired', NOW + HOUR + 10);
  });

  it('denies a token issued beyond the skew window', async () => {
    const chain = await buildRoot(EXAMPLE_TOOLS, {
      issuedAt: NOW + 600,
      expiresAt: NOW + HOUR,
    });
    await expectDenied(chain.tokens, 'not_yet_valid', NOW);
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
    await expectDenied(chain.tokens, 'expiry_exceeds_parent');
  });
});

describe('delegation', () => {
  it('accepts a valid one-hop attenuation', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const result = await verifyDelegationChain(chain.tokens, { now: NOW + 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.chain.depth).toBe(1);
      expect(Object.keys(result.chain.leafTools)).toEqual(['read_file']);
    }
  });

  it('accepts a valid multi-hop attenuation', async () => {
    const root = await buildRoot();
    const hop1 = await extend(root, {
      read_file: { path: { constraint_type: 'one_of', values: ['/data/q3.pdf'] } },
    });
    const hop2 = await extend(hop1, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const result = await verifyDelegationChain(hop2.tokens, { now: NOW + 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.chain.depth).toBe(2);
  });

  it('denies a broken parent binding', async () => {
    const root = await buildRoot();
    const chain = await extend(
      root,
      { read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } } },
      { par_hash: 'not-the-parent-hash' },
    );
    await expectDenied(chain.tokens, 'par_hash_mismatch');
  });

  it('denies a wrong issuer thumbprint', async () => {
    const root = await buildRoot();
    const chain = await extend(
      root,
      { read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } } },
      { iss: 'urn:ietf:params:oauth:jwk-thumbprint:sha-256:wrong' },
    );
    await expectDenied(chain.tokens, 'issuer_thumbprint_mismatch');
  });

  it('denies a depth that does not increment by one', async () => {
    const root = await buildRoot();
    const chain = await extend(
      root,
      { read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } } },
      { del_depth: 5 },
    );
    await expectDenied(chain.tokens, 'delegation_depth_invalid');
  });

  it('denies a chain exceeding del_max_depth', async () => {
    const root = await buildRoot(EXAMPLE_TOOLS, { maxDepth: 1 });
    const hop1 = await extend(root, {
      read_file: { path: { constraint_type: 'one_of', values: ['/data/q3.pdf'] } },
    });
    const hop2 = await extend(hop1, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    // maxDepth is carried from the root; hop2 sits at depth 2 against a max of 1.
    const result = await verifyDelegationChain(hop2.tokens, { now: NOW + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.denials.map((d) => d.code)).toContain('delegation_depth_exceeded');
    }
  });

  it('denies a derived token that raises the delegation ceiling', async () => {
    // Not an explicit AAT -01 invariant. Without it, a child declares a larger
    // del_max_depth and the root's ceiling stops binding after one hop.
    const root = await buildRoot(EXAMPLE_TOOLS, { maxDepth: 1 });
    const chain = await extend(
      root,
      { read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } } },
      { del_max_depth: 99 },
    );
    await expectDenied(chain.tokens, 'delegation_ceiling_raised');
  });

  it('denies a repeated token instance', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const withCycle = [...chain.tokens, chain.tokens[1] as string];
    await expectDenied(withCycle, 'chain_cycle_detected');
  });
});

describe('narrowing', () => {
  it('denies a tool the parent never granted', async () => {
    const root = await buildRoot();
    const chain = await extend(root, { delete_file: {} });
    await expectDenied(chain.tokens, 'tool_not_delegated');
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
    await expectDenied(chain.tokens, 'constraint_expansion');
  });

  it('denies an unpermitted constraint type pair', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'wildcard' } },
    });
    await expectDenied(chain.tokens, 'constraint_type_not_permitted');
  });

  it('denies an unrecognized constraint type', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'regex', pattern: '.*' } as never },
    });
    await expectDenied(chain.tokens, 'constraint_type_unrecognized');
  });

  it('denies constraining an argument the parent left uncovered', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: {
        path: { constraint_type: 'exact', value: '/data/q3.pdf' },
        encoding: { constraint_type: 'exact', value: 'utf8' },
      },
    });
    await expectDenied(chain.tokens, 'argument_not_delegated');
  });

  it('allows narrowing under a parent that left the tool unconstrained', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      search_index: { query: { constraint_type: 'exact', value: 'q3' } },
    });
    const result = await verifyDelegationChain(chain.tokens, { now: NOW + 1 });
    expect(result.ok).toBe(true);
  });

  it('allows omitting a tool, which narrows', async () => {
    const root = await buildRoot();
    const chain = await extend(root, { search_index: {} });
    const result = await verifyDelegationChain(chain.tokens, { now: NOW + 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result.chain.leafTools)).toEqual(['search_index']);
  });
});

describe('authorization_details', () => {
  it('denies a token without exactly one attenuating_agent_token entry', async () => {
    const holder = await generateHolderKey();
    const { CompactSign } = await import('jose');
    const payload = {
      jti: 'root-1',
      iss: ISSUER,
      iat: NOW,
      exp: NOW + HOUR,
      cnf: { jwk: holder.publicJwk },
      del_depth: 0,
      del_max_depth: 3,
      authorization_details: [
        { type: 'attenuating_agent_token', tools: {} },
        { type: 'attenuating_agent_token', tools: {} },
      ],
    };
    const token = await new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
      .setProtectedHeader({ alg: 'EdDSA' })
      .sign(holder.privateKey);
    await expectDenied([token], 'authorization_details_invalid');
  });
});

describe('determinism', () => {
  it('produces the same verified authority for the same input', async () => {
    const chain = await buildRoot();
    const a = await verifyDelegationChain(chain.tokens, { now: NOW + 1 });
    const b = await verifyDelegationChain(chain.tokens, { now: NOW + 1 });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.chain.leafHolder).toBe(b.chain.leafHolder);
      expect(JSON.stringify(a.chain.leafTools)).toBe(JSON.stringify(b.chain.leafTools));
    }
  });
});

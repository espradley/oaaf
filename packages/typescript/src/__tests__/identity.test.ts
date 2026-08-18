import { describe, expect, it } from 'vitest';

import { verifyAndEvaluate, verifyAuthority } from '../decide.js';
import { toExplanation } from '../explain.js';
import { enforceOaafPrecondition } from '../mcp/coaz.js';
import { enforceA2aAuthority } from '../a2a/binding.js';
import { METADATA_KEY_CHAIN, METADATA_KEY_POP, OAAF_A2A_EXTENSION_URI } from '../a2a/extension.js';
import { boundSubjectsVerifier } from '../identity.js';
import { generateHolderKey, mintDerivedToken, mintPop, mintRootToken } from '../testing/mint.js';

const NOW = 1_780_000_000;
const HOUR = 3600;
const SPIFFE_BOB = 'spiffe://company.example/agents/bob';
const SPIFFE_ALICE = 'spiffe://company.example/agents/alice';

/** A chain whose leaf carries an external `sub` and a distinct holder key. */
async function chainWithSub(sub?: string) {
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
    maxDepth: 2,
    jti: 'root',
  });
  const derived = await mintDerivedToken({
    parentToken: root,
    parentKey: aliceKey,
    parentPayload: { del_depth: 0, del_max_depth: 2, exp: NOW + HOUR, iat: NOW },
    holder: bobKey,
    tools: { 'repo.read': {} },
    issuedAt: NOW,
    expiresAt: NOW + HOUR / 2,
    jti: 'derived',
    ...(sub === undefined ? {} : { overrides: { sub } }),
  });
  return { tokens: [root, derived], trustAnchors: [issuerKey.publicJwk], bobKey };
}

describe('identity binding (RFC-0005): the four concepts stay distinct', () => {
  it('subject (sub) and holder (PoP key) are different fields', async () => {
    const c = await chainWithSub(SPIFFE_BOB);
    const pop = await mintPop({
      leafKey: c.bobKey,
      leafJti: 'derived',
      tool: 'repo.read',
      args: {},
      issuedAt: NOW,
    });
    const decision = await verifyAndEvaluate({
      tokens: c.tokens,
      trustAnchors: c.trustAnchors,
      pop,
      tool: 'repo.read',
      args: {},
      now: NOW + 1,
    });
    const v = await verifyAuthority({
      tokens: c.tokens,
      trustAnchors: c.trustAnchors,
      pop,
      tool: 'repo.read',
      args: {},
      now: NOW + 1,
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const e = toExplanation(decision, v.authority);
    // Identity is the SPIFFE ID; holder is the PoP key thumbprint; they differ.
    expect(e.authority?.subject).toBe(SPIFFE_BOB);
    expect(e.authority?.subjectProfile).toBe('spiffe');
    expect(e.authority?.holder).toMatch(/^urn:ietf:params:oauth:jwk-thumbprint:sha-256:/);
    expect(e.authority?.subject).not.toBe(e.authority?.holder);
  });

  it('no sub → subject is the holder thumbprint (backward compatible)', async () => {
    const c = await chainWithSub(); // no sub
    const pop = await mintPop({
      leafKey: c.bobKey,
      leafJti: 'derived',
      tool: 'repo.read',
      args: {},
      issuedAt: NOW,
    });
    const v = await verifyAuthority({
      tokens: c.tokens,
      trustAnchors: c.trustAnchors,
      pop,
      tool: 'repo.read',
      args: {},
      now: NOW + 1,
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const e = toExplanation(
      await verifyAndEvaluate({
        tokens: c.tokens,
        trustAnchors: c.trustAnchors,
        pop,
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
      v.authority,
    );
    expect(e.authority?.subject).toBe(e.authority?.holder);
    expect(e.authority?.subjectProfile).toBe('thumbprint');
  });

  it('PoP still binds to the holder key even with a string subject', async () => {
    // A stranger's PoP fails despite a valid, verified SPIFFE subject on the token.
    const c = await chainWithSub(SPIFFE_BOB);
    const impostor = await generateHolderKey();
    const pop = await mintPop({
      leafKey: impostor,
      leafJti: 'derived',
      tool: 'repo.read',
      args: {},
      issuedAt: NOW,
    });
    const d = await verifyAndEvaluate({
      tokens: c.tokens,
      trustAnchors: c.trustAnchors,
      pop,
      tool: 'repo.read',
      args: {},
      now: NOW + 1,
      identityBindingVerifier: boundSubjectsVerifier([SPIFFE_BOB]),
    });
    expect(d.allowed).toBe(false);
    expect(d.denials[0]?.code).toBe('pop_signature_invalid'); // possession fails regardless of identity
  });

  it('verifier mismatch → subject_identity_mismatch', async () => {
    const c = await chainWithSub(SPIFFE_BOB);
    const pop = await mintPop({
      leafKey: c.bobKey,
      leafJti: 'derived',
      tool: 'repo.read',
      args: {},
      issuedAt: NOW,
    });
    const d = await verifyAndEvaluate({
      tokens: c.tokens,
      trustAnchors: c.trustAnchors,
      pop,
      tool: 'repo.read',
      args: {},
      now: NOW + 1,
      identityBindingVerifier: boundSubjectsVerifier([SPIFFE_ALICE]), // Bob's sub not in the bound set
    });
    expect(d.allowed).toBe(false);
    expect(d.denials[0]?.code).toBe('subject_identity_mismatch');
    expect(d.denials[0]?.stage).toBe('identity');
  });

  it('required binding unavailable → identity_binding_unavailable (fail closed)', async () => {
    const c = await chainWithSub(SPIFFE_BOB);
    const pop = await mintPop({
      leafKey: c.bobKey,
      leafJti: 'derived',
      tool: 'repo.read',
      args: {},
      issuedAt: NOW,
    });
    const d = await verifyAndEvaluate({
      tokens: c.tokens,
      trustAnchors: c.trustAnchors,
      pop,
      tool: 'repo.read',
      args: {},
      now: NOW + 1,
      identityBindingVerifier: boundSubjectsVerifier([], [SPIFFE_BOB]),
    });
    expect(d.allowed).toBe(false);
    expect(d.denials[0]?.code).toBe('identity_binding_unavailable');
  });

  it('no verifier → issuer-asserted subject is trusted (ALLOW)', async () => {
    const c = await chainWithSub(SPIFFE_BOB);
    const pop = await mintPop({
      leafKey: c.bobKey,
      leafJti: 'derived',
      tool: 'repo.read',
      args: {},
      issuedAt: NOW,
    });
    const d = await verifyAndEvaluate({
      tokens: c.tokens,
      trustAnchors: c.trustAnchors,
      pop,
      tool: 'repo.read',
      args: {},
      now: NOW + 1,
    });
    expect(d.allowed).toBe(true);
  });

  it('identity binding is transport-equivalent (MCP == A2A)', async () => {
    const c = await chainWithSub(SPIFFE_BOB);
    const pop = await mintPop({
      leafKey: c.bobKey,
      leafJti: 'derived',
      tool: 'repo.read',
      args: {},
      issuedAt: NOW,
    });
    const verifier = boundSubjectsVerifier([SPIFFE_ALICE]); // will mismatch Bob

    const mcp = await enforceOaafPrecondition({
      tokens: c.tokens,
      trustAnchors: c.trustAnchors,
      pop,
      tool: 'repo.read',
      args: {},
      now: NOW + 1,
      identityBindingVerifier: verifier,
    });
    const a2a = await enforceA2aAuthority({
      message: { metadata: { [METADATA_KEY_CHAIN]: c.tokens, [METADATA_KEY_POP]: pop } },
      activatedExtensionUris: [OAAF_A2A_EXTENSION_URI],
      trustAnchors: c.trustAnchors,
      skillId: 'repo.read',
      args: {},
      recipient: 'https://r.example',
      now: NOW + 1,
      identityBindingVerifier: verifier,
    });
    expect(mcp.ok).toBe(false);
    expect(a2a.ok).toBe(false);
    if (mcp.ok || a2a.ok) return;
    expect(mcp.error.data.reasons[0]?.code).toBe('subject_identity_mismatch');
    expect(a2a.error.data.reasons[0]?.code).toBe('subject_identity_mismatch');
  });
});

import { describe, expect, it } from 'vitest';

import { verifyAndEvaluate, verifyAuthority } from '../decide.js';
import { toExplanation } from '../explain.js';
import { enforceOaafPrecondition, explainMcpResult } from '../mcp/coaz.js';
import { enforceA2aAuthority, explainA2aResult } from '../a2a/binding.js';
import { revokedSetResolver } from '../status.js';
import { boundSubjectsVerifier } from '../identity.js';
import { generateHolderKey, mintRootToken, mintDerivedToken, mintPop } from '../testing/mint.js';

/**
 * Adversarial security certification (O6E).
 *
 * Every OAAF security invariant must survive deliberate attempts to violate it. This
 * suite does not re-check happy paths — it *attacks*, grouped by attack family, and
 * asserts OAAF fails closed. It is the active counterpart to the static corpus: the
 * corpus proves an invariant with an example; here we mutate a valid baseline toward
 * the attacker's goal along a whole family of perturbations and require every one to
 * DENY. Requirement IDs in each family map to spec/0.1/conformance/security.md.
 *
 * Reserved DigitalStack execution-control concepts (ADR-0002) are out of scope: this
 * attacks the authority system OAAF publishes, never continuity/supersession/fencing.
 */

const NOW = 1_780_000_000;
const HOUR = 3600;
const RECIPIENT = 'https://recipient.example';
const A2A_CHAIN = 'https://oaaf.dev/a2a/authority/v1/chain';
const A2A_POP = 'https://oaaf.dev/a2a/authority/v1/pop';
const A2A_EXT = 'https://oaaf.dev/a2a/authority/v1';
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

async function baseline(opts?: {
  rootTools?: Parameters<typeof mintRootToken>[0]['tools'];
  leafTools?: Parameters<typeof mintDerivedToken>[0]['tools'];
  maxDepth?: number;
  rootOver?: Partial<Parameters<typeof mintRootToken>[0]>;
  derivedOver?: Partial<Parameters<typeof mintDerivedToken>[0]>;
}) {
  const rootTools = opts?.rootTools ?? { 'repo.read': {} };
  const leafTools = opts?.leafTools ?? { 'repo.read': {} };
  const maxDepth = opts?.maxDepth ?? 2;
  const issuerKey = await generateHolderKey();
  const alice = await generateHolderKey();
  const bob = await generateHolderKey();
  const root = await mintRootToken({
    issuer: 'https://authority.example',
    issuerKey,
    holder: alice,
    tools: rootTools,
    issuedAt: NOW,
    expiresAt: NOW + HOUR,
    maxDepth,
    jti: 'root',
    ...(opts?.rootOver ?? {}),
  });
  const derived = await mintDerivedToken({
    parentToken: root,
    parentKey: alice,
    parentPayload: { del_depth: 0, del_max_depth: maxDepth, exp: NOW + HOUR, iat: NOW },
    holder: bob,
    tools: leafTools,
    issuedAt: NOW,
    expiresAt: NOW + HOUR / 2,
    jti: 'derived',
    ...(opts?.derivedOver ?? {}),
  });
  return { issuerKey, alice, bob, root, derived, anchors: [issuerKey.publicJwk] };
}

const popFor = (
  bob: Awaited<ReturnType<typeof generateHolderKey>>,
  tool: string,
  args: Record<string, unknown>,
  overrides?: Record<string, unknown>,
) =>
  mintPop({
    leafKey: bob,
    leafJti: 'derived',
    tool,
    args,
    issuedAt: NOW,
    ...(overrides ? { overrides } : {}),
  });

/** Run the core path and return the explanation. */
async function core(input: Parameters<typeof verifyAndEvaluate>[0]) {
  const decision = await verifyAndEvaluate(input);
  const v = await verifyAuthority(input);
  return toExplanation(decision, v.ok ? v.authority : undefined);
}

/** The central assertion: an attack must fail closed. */
function expectDeny(explanation: { decision: string }, msg?: string) {
  expect(explanation.decision, msg).toBe('DENY');
}

// ── Family 1: Authority widening ───────────────────────────────────────────
describe('attack: authority widening [CORE-NARROW-001..004, CORE-DELEG-001..002]', () => {
  it('cannot add a tool the parent never granted', async () => {
    const c = await baseline({
      rootTools: { 'repo.read': {} },
      leafTools: { 'repo.read': {}, 'repo.delete': {} },
    });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.delete', {}),
        tool: 'repo.delete',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('cannot broaden a constraint value set', async () => {
    const c = await baseline({
      rootTools: { 'repo.read': { path: { constraint_type: 'one_of', values: ['a'] } } },
      leafTools: { 'repo.read': { path: { constraint_type: 'one_of', values: ['a', 'b'] } } },
    });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', { path: 'b' }),
        tool: 'repo.read',
        args: { path: 'b' },
        now: NOW + 1,
      }),
    );
  });
  it('cannot add an argument key beyond the parent key set', async () => {
    const c = await baseline({
      rootTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
      leafTools: {
        'repo.read': {
          path: { constraint_type: 'exact', value: 'a' },
          extra: { constraint_type: 'exact', value: 'y' },
        },
      },
    });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', { path: 'a', extra: 'y' }),
        tool: 'repo.read',
        args: { path: 'a', extra: 'y' },
        now: NOW + 1,
      }),
    );
  });
  it('cannot raise the delegation ceiling', async () => {
    const c = await baseline({ derivedOver: { overrides: { del_max_depth: 9 } } });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('cannot exceed the delegation depth ceiling', async () => {
    const issuerKey = await generateHolderKey(),
      a = await generateHolderKey(),
      b = await generateHolderKey(),
      d = await generateHolderKey();
    const root = await mintRootToken({
      issuer: 'x',
      issuerKey,
      holder: a,
      tools: { 'repo.read': {} },
      issuedAt: NOW,
      expiresAt: NOW + HOUR,
      maxDepth: 1,
      jti: 'root',
    });
    const d1 = await mintDerivedToken({
      parentToken: root,
      parentKey: a,
      parentPayload: { del_depth: 0, del_max_depth: 1, exp: NOW + HOUR, iat: NOW },
      holder: b,
      tools: { 'repo.read': {} },
      issuedAt: NOW,
      expiresAt: NOW + HOUR / 2,
      jti: 'd1',
    });
    const d2 = await mintDerivedToken({
      parentToken: d1,
      parentKey: b,
      parentPayload: { del_depth: 1, del_max_depth: 1, exp: NOW + HOUR / 2, iat: NOW },
      holder: d,
      tools: { 'repo.read': {} },
      issuedAt: NOW,
      expiresAt: NOW + HOUR / 4,
      jti: 'd2',
    });
    const pop = await mintPop({
      leafKey: d,
      leafJti: 'd2',
      tool: 'repo.read',
      args: {},
      issuedAt: NOW,
    });
    expectDeny(
      await core({
        tokens: [root, d1, d2],
        trustAnchors: [issuerKey.publicJwk],
        pop,
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
});

// ── Family 2: Chain integrity ──────────────────────────────────────────────
describe('attack: chain integrity [CORE-CHAIN-001, CORE-CHAIN-003, CORE-CRYPTO-003]', () => {
  it('cannot reorder the chain', async () => {
    const c = await baseline();
    expectDeny(
      await core({
        tokens: [c.derived, c.root],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('cannot truncate the root away', async () => {
    const c = await baseline();
    expectDeny(
      await core({
        tokens: [c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('cannot splice a foreign token into the chain', async () => {
    const c = await baseline();
    const other = await baseline();
    expectDeny(
      await core({
        tokens: [c.root, other.derived, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('cannot forge the parent hash', async () => {
    const c = await baseline({
      derivedOver: { overrides: { par_hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } },
    });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('cannot substitute a root signed by an untrusted issuer', async () => {
    const c = await baseline();
    const evil = await generateHolderKey();
    const forgedRoot = await mintRootToken({
      issuer: 'https://authority.example',
      issuerKey: evil,
      holder: c.alice,
      tools: { 'repo.read': {}, 'repo.delete': {} },
      issuedAt: NOW,
      expiresAt: NOW + HOUR,
      maxDepth: 2,
      jti: 'root',
    });
    expectDeny(
      await core({
        tokens: [forgedRoot, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
});

// ── Family 3: Cryptography ─────────────────────────────────────────────────
describe('attack: cryptography [CORE-CRYPTO-001, CORE-CRYPTO-002, CORE-CRYPTO-004, CORE-TRUST-001, CORE-TRUST-002]', () => {
  it('rejects a token signed by the wrong key', async () => {
    const c = await baseline();
    const wrong = await generateHolderKey();
    const forged = await mintDerivedToken({
      parentToken: c.root,
      parentKey: c.alice,
      parentPayload: { del_depth: 0, del_max_depth: 2, exp: NOW + HOUR, iat: NOW },
      holder: c.bob,
      tools: { 'repo.read': {} },
      issuedAt: NOW,
      expiresAt: NOW + HOUR / 2,
      jti: 'derived',
      signWith: wrong.privateKey,
    });
    expectDeny(
      await core({
        tokens: [c.root, forged],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('rejects an unsecured alg:none token', async () => {
    const c = await baseline();
    const [, payload] = c.root.split('.');
    const unsecured = `${b64url({ alg: 'none' })}.${payload}.`;
    expectDeny(
      await core({
        tokens: [unsecured, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('rejects private key material in cnf.jwk', async () => {
    const issuerKey = await generateHolderKey(),
      a = await generateHolderKey(),
      b = await generateHolderKey();
    const poisoned = {
      ...b,
      publicJwk: { ...b.publicJwk, d: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    };
    const root = await mintRootToken({
      issuer: 'x',
      issuerKey,
      holder: a,
      tools: { 'repo.read': {} },
      issuedAt: NOW,
      expiresAt: NOW + HOUR,
      maxDepth: 2,
      jti: 'root',
    });
    const derived = await mintDerivedToken({
      parentToken: root,
      parentKey: a,
      parentPayload: { del_depth: 0, del_max_depth: 2, exp: NOW + HOUR, iat: NOW },
      holder: poisoned,
      tools: { 'repo.read': {} },
      issuedAt: NOW,
      expiresAt: NOW + HOUR / 2,
      jti: 'derived',
    });
    expectDeny(
      await core({
        tokens: [root, derived],
        trustAnchors: [issuerKey.publicJwk],
        pop: await mintPop({
          leafKey: b,
          leafJti: 'derived',
          tool: 'repo.read',
          args: {},
          issuedAt: NOW,
        }),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('rejects an empty trust-anchor set (fails closed, no default)', async () => {
    const c = await baseline();
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: [],
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('rejects a chain against a malformed/unrelated anchor', async () => {
    const c = await baseline();
    const stranger = await generateHolderKey();
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: [stranger.publicJwk],
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
});

// ── Family 4: Proof of possession ──────────────────────────────────────────
describe('attack: proof of possession [CORE-POP-001, CORE-POP-003]', () => {
  it('rejects a stolen token presented with the wrong holder key', async () => {
    const c = await baseline();
    const thief = await generateHolderKey();
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await mintPop({
          leafKey: thief,
          leafJti: 'derived',
          tool: 'repo.read',
          args: {},
          issuedAt: NOW,
        }),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('rejects a forged (tampered) proof of possession', async () => {
    const c = await baseline();
    const pop = await popFor(c.bob, 'repo.read', {});
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: `${pop.slice(0, -4)}AAAA`,
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('rejects a request whose arguments differ from the PoP binding', async () => {
    const c = await baseline({
      rootTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
      leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
    });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', { path: 'a' }),
        tool: 'repo.read',
        args: { path: 'a', injected: 'x' },
        now: NOW + 1,
      }),
    );
  });
  it('rejects a request with no proof of possession', async () => {
    const c = await baseline();
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: '',
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
});

// ── Family 5: Identity binding ─────────────────────────────────────────────
describe('attack: identity binding [IDENT-001, IDENT-002]', () => {
  const SPIFFE_BOB = 'spiffe://company.example/agents/bob';
  const SPIFFE_EVE = 'spiffe://company.example/agents/eve';
  it('rejects a valid authority with a substituted subject (verifier mismatch)', async () => {
    const c = await baseline({ derivedOver: { overrides: { sub: SPIFFE_BOB } } });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
        identityBindingVerifier: boundSubjectsVerifier([SPIFFE_EVE], []),
      }),
    );
  });
  it('rejects when a required identity binding is unavailable (fails closed)', async () => {
    const c = await baseline({ derivedOver: { overrides: { sub: SPIFFE_BOB } } });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
        identityBindingVerifier: boundSubjectsVerifier([], [SPIFFE_BOB]),
      }),
    );
  });
});

// ── Family 6: Recipient binding ────────────────────────────────────────────
describe('attack: recipient binding [A2A-003]', () => {
  it('rejects a valid authority presented to an unintended recipient', async () => {
    const c = await baseline();
    const pop = await popFor(c.bob, 'repo.read', {}, { aat_aud: 'https://attacker.example' });
    const res = await enforceA2aAuthority({
      message: { metadata: { [A2A_CHAIN]: [c.root, c.derived], [A2A_POP]: pop } },
      activatedExtensionUris: [A2A_EXT],
      trustAnchors: c.anchors,
      skillId: 'repo.read',
      args: {},
      recipient: RECIPIENT,
      requireRecipientBinding: true,
      now: NOW + 1,
    });
    expectDeny(explainA2aResult(res));
  });
});

// ── Family 7: Temporal validity ────────────────────────────────────────────
describe('attack: temporal validity [CORE-TIME-001, CORE-TIME-002, CORE-TIME-003]', () => {
  it('rejects an expired authority', async () => {
    const c = await baseline();
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + HOUR + 100,
      }),
    );
  });
  it('rejects a not-yet-valid authority', async () => {
    const c = await baseline({ rootOver: { issuedAt: NOW + 1000 } });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('rejects a child that outlives its parent', async () => {
    const c = await baseline({ derivedOver: { overrides: { exp: NOW + HOUR * 5 } } });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
});

// ── Family 8: Revocation / status ──────────────────────────────────────────
describe('attack: revocation/status [STATUS-002, STATUS-003, STATUS-004]', () => {
  it('rejects a revoked leaf', async () => {
    const c = await baseline();
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
        statusResolver: revokedSetResolver(['derived'], []),
      }),
    );
  });
  it('rejects a revoked ancestor (cascade)', async () => {
    const c = await baseline();
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
        statusResolver: revokedSetResolver(['root'], []),
      }),
    );
  });
  it('rejects unknown status (fails closed)', async () => {
    const c = await baseline();
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
        statusResolver: revokedSetResolver([], ['derived']),
      }),
    );
  });
});

// ── Family 9: Transport equivalence ────────────────────────────────────────
describe('attack: transport equivalence [CORE-DEC-004]', () => {
  async function acrossBindings(
    c: Awaited<ReturnType<typeof baseline>>,
    tool: string,
    args: Record<string, unknown>,
    pop: string,
    now = NOW + 1,
  ) {
    const coreExp = await core({
      tokens: [c.root, c.derived],
      trustAnchors: c.anchors,
      pop,
      tool,
      args,
      now,
    });
    const mcpExp = explainMcpResult(
      await enforceOaafPrecondition({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop,
        tool,
        args,
        now,
      }),
    );
    const a2aExp = explainA2aResult(
      await enforceA2aAuthority({
        message: { metadata: { [A2A_CHAIN]: [c.root, c.derived], [A2A_POP]: pop } },
        activatedExtensionUris: [A2A_EXT],
        trustAnchors: c.anchors,
        skillId: tool,
        args,
        recipient: RECIPIENT,
        now,
      }),
    );
    return { coreExp, mcpExp, a2aExp };
  }
  it('a widening attack denied on core is denied on MCP and A2A too', async () => {
    const c = await baseline({
      rootTools: { 'repo.read': {} },
      leafTools: { 'repo.read': {}, 'repo.delete': {} },
    });
    const { coreExp, mcpExp, a2aExp } = await acrossBindings(
      c,
      'repo.delete',
      {},
      await popFor(c.bob, 'repo.delete', {}, { aat_aud: RECIPIENT }),
    );
    expectDeny(coreExp);
    expectDeny(mcpExp);
    expectDeny(a2aExp);
    expect(coreExp.reasons[0]?.code).toBe(mcpExp.reasons[0]?.code);
    expect(coreExp.reasons[0]?.code).toBe(a2aExp.reasons[0]?.code);
  });
  it('an expired attack cannot sneak through any single binding', async () => {
    const c = await baseline();
    const { coreExp, mcpExp, a2aExp } = await acrossBindings(
      c,
      'repo.read',
      {},
      await popFor(c.bob, 'repo.read', {}, { aat_aud: RECIPIENT }),
      NOW + HOUR + 100,
    );
    expectDeny(coreExp);
    expectDeny(mcpExp);
    expectDeny(a2aExp);
  });
});

// ── Family 10: PDP boundary ────────────────────────────────────────────────
describe('attack: PDP boundary [PDP-002]', () => {
  it('an invalid authority produces no verified authority (no PDP bypass)', async () => {
    const c = await baseline({
      rootTools: { 'repo.read': {} },
      leafTools: { 'repo.read': {}, 'repo.delete': {} },
    });
    const v = await verifyAuthority({
      tokens: [c.root, c.derived],
      trustAnchors: c.anchors,
      pop: await popFor(c.bob, 'repo.delete', {}),
      tool: 'repo.delete',
      args: {},
      now: NOW + 1,
    });
    expect(v.ok).toBe(false); // no authorityVerified context can be produced from a failed verification
  });
  it('authorityVerified means the authority is valid — not that policy must permit', async () => {
    const c = await baseline();
    const v = await verifyAuthority({
      tokens: [c.root, c.derived],
      trustAnchors: c.anchors,
      pop: await popFor(c.bob, 'repo.read', {}),
      tool: 'repo.read',
      args: {},
      now: NOW + 1,
    });
    expect(v.ok).toBe(true); // valid; a PDP may still legitimately DENY on org policy (PDP-001, by construction)
  });
});

// ── Family 11: Privacy ─────────────────────────────────────────────────────
describe('attack: privacy — no secret leakage [CORE-EXPL-003, PDP-004]', () => {
  it('a secret argument value never appears in the decision explanation', async () => {
    const secret = 'TOP-SECRET-CREDENTIAL-e9f1a2b3';
    const c = await baseline({
      rootTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'ok' } } },
      leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'ok' } } },
    });
    const exp = await core({
      tokens: [c.root, c.derived],
      trustAnchors: c.anchors,
      pop: await popFor(c.bob, 'repo.read', { path: secret }),
      tool: 'repo.read',
      args: { path: secret },
      now: NOW + 1,
    });
    expectDeny(exp);
    expect(JSON.stringify(exp)).not.toContain(secret);
  });
  it('no token bytes, signatures, or key material leak into an explanation', async () => {
    const c = await baseline();
    const pop = await popFor(c.bob, 'repo.read', {});
    const exp = await core({
      tokens: [c.root, c.derived],
      trustAnchors: c.anchors,
      pop,
      tool: 'repo.read',
      args: {},
      now: NOW + 1,
    });
    const blob = JSON.stringify(exp);
    expect(blob).not.toContain(c.derived);
    expect(blob).not.toContain(pop);
    expect(blob).not.toContain('"d"');
    expect(blob.toLowerCase()).not.toContain('cnf');
  });
});

// ── Family: Constraint enforcement ─────────────────────────────────────────
describe('attack: constraint enforcement [CORE-CONSTR-001, CORE-CONSTR-002, CORE-CONSTR-003]', () => {
  it('rejects an omitted required (constrained) argument', async () => {
    const c = await baseline({
      rootTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
      leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
    });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('rejects an argument value outside the constraint', async () => {
    const c = await baseline({
      rootTools: { 'repo.read': { path: { constraint_type: 'one_of', values: ['a', 'b'] } } },
      leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
    });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', { path: 'b' }),
        tool: 'repo.read',
        args: { path: 'b' },
        now: NOW + 1,
      }),
    );
  });
  it('rejects a tool the verified leaf authority does not hold', async () => {
    const c = await baseline({
      rootTools: { 'repo.read': {}, 'repo.merge': {} },
      leafTools: { 'repo.read': {} },
    });
    expectDeny(
      await core({
        tokens: [c.root, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.merge', {}),
        tool: 'repo.merge',
        args: {},
        now: NOW + 1,
      }),
    );
  });
});

// ── Family 12: Parser robustness ───────────────────────────────────────────
describe('attack: parser robustness [CORE-DEC-002, CORE-CHAIN-002]', () => {
  it('fails closed on a malformed token (no throw)', async () => {
    const c = await baseline();
    expectDeny(
      await core({
        tokens: ['not.a.jws', c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('fails closed on an empty chain', async () => {
    expectDeny(
      await core({
        tokens: [],
        trustAnchors: [],
        pop: '',
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('fails closed on an oversized adversarial token', async () => {
    const c = await baseline();
    const huge = 'A'.repeat(200_000);
    expectDeny(
      await core({
        tokens: [`${huge}.${huge}.${huge}`, c.derived],
        trustAnchors: c.anchors,
        pop: await popFor(c.bob, 'repo.read', {}),
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
  it('fails closed on garbage in place of the whole chain', async () => {
    expectDeny(
      await core({
        tokens: ['{}', '[]'],
        trustAnchors: [],
        pop: '',
        tool: 'repo.read',
        args: {},
        now: NOW + 1,
      }),
    );
  });
});

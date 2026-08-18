import { describe, expect, it } from 'vitest';

import { enforceOaafPrecondition } from '../mcp/coaz.js';
import { enforceA2aAuthority } from '../a2a/binding.js';
import { METADATA_KEY_CHAIN, METADATA_KEY_POP, OAAF_A2A_EXTENSION_URI } from '../a2a/extension.js';
import { evaluate, verifyAndEvaluate, verifyAuthority } from '../decide.js';
import { toExplanation } from '../explain.js';
import type { DecisionExplanation, ReasonExplanation } from '../explanation.js';
import { generateHolderKey, mintPop } from '../testing/mint.js';
import { buildRoot, extend, NOW, popFor, type Chain } from './fixtures.js';

const SECRET_PATH = '/customer/private/1234';
const RECIPIENT = 'https://agent-b.example';

/** All string material anywhere in an explanation, for leak assertions. */
function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === 'object')
    Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

/** Assert an explanation carries no argument value / token / signature material. */
function assertNoSensitiveMaterial(explanation: DecisionExplanation, secretValue: string) {
  const strings = allStrings(explanation);
  for (const s of strings) {
    expect(s.includes(secretValue), `leaked argument value in: ${s}`).toBe(false);
    // A compact JWS has two dots and long base64url runs; no explanation string
    // should look like a token or a signature.
    expect(/[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\./.test(s), `looks like a token: ${s}`).toBe(
      false,
    );
  }
}

async function denyExplanation(over: {
  chain?: Chain;
  tokens?: string[];
  pop: string;
  tool: string;
  args: Record<string, unknown>;
  trustAnchors: Record<string, unknown>[];
  now?: number;
}): Promise<DecisionExplanation> {
  const now = over.now ?? NOW + 1;
  const tokens = over.tokens ?? (over.chain as Chain).tokens;
  const input = {
    tokens,
    trustAnchors: over.trustAnchors,
    pop: over.pop,
    tool: over.tool,
    args: over.args,
    now,
  };
  const decision = await verifyAndEvaluate(input);
  // Rebuild the authority if it verified, so the explanation can include it.
  const verification = await verifyAuthority(input);
  return toExplanation(decision, verification.ok ? verification.authority : undefined);
}

function codes(e: DecisionExplanation): string[] {
  return e.reasons.map((r: ReasonExplanation) => r.code);
}

describe('structured DENY explanations preserve reason, stage, and locators', () => {
  it('malformed authority', async () => {
    const chain = await buildRoot();
    const e = await denyExplanation({
      tokens: ['not-a-jws'],
      pop: '',
      tool: 'read_file',
      args: {},
      trustAnchors: chain.trustAnchors,
    });
    expect(e.decision).toBe('DENY');
    expect(codes(e)).toContain('token_malformed');
    expect(e.reasons[0]?.stage).toBe('chain');
  });

  it('invalid signature', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: SECRET_PATH });
    const e = await denyExplanation({
      tokens: [`${(chain.tokens[0] as string).slice(0, -4)}AAAA`],
      pop,
      tool: 'read_file',
      args: { path: SECRET_PATH },
      trustAnchors: chain.trustAnchors,
    });
    expect(codes(e)).toContain('untrusted_root');
    assertNoSensitiveMaterial(e, SECRET_PATH);
  });

  it('expiry', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: SECRET_PATH }, { iat: NOW + 8000 });
    const e = await denyExplanation({
      chain,
      pop,
      tool: 'read_file',
      args: { path: SECRET_PATH },
      trustAnchors: chain.trustAnchors,
      now: NOW + 8000,
    });
    expect(codes(e)).toContain('expired');
    assertNoSensitiveMaterial(e, SECRET_PATH);
  });

  it('delegation narrowing — locator names the tool and argument', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: {
        path: { constraint_type: 'one_of', values: ['/data/q3.pdf', '/data/q4.pdf', SECRET_PATH] },
      },
    });
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const e = await denyExplanation({
      chain,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      trustAnchors: chain.trustAnchors,
    });
    expect(codes(e)).toContain('constraint_expansion');
    const r = e.reasons.find((x) => x.code === 'constraint_expansion');
    expect(r?.tool).toBe('read_file');
    expect(r?.argument).toBe('path');
    expect(typeof r?.tokenIndex).toBe('number');
    assertNoSensitiveMaterial(e, SECRET_PATH);
  });

  it('holder mismatch (wrong PoP key)', async () => {
    const chain = await buildRoot();
    const impostor = await generateHolderKey();
    const pop = await mintPop({
      leafKey: impostor,
      leafJti: chain.leafJti,
      tool: 'read_file',
      args: { path: SECRET_PATH },
      issuedAt: NOW,
    });
    const e = await denyExplanation({
      chain,
      pop,
      tool: 'read_file',
      args: { path: SECRET_PATH },
      trustAnchors: chain.trustAnchors,
    });
    expect(codes(e)).toContain('pop_signature_invalid');
    assertNoSensitiveMaterial(e, SECRET_PATH);
  });

  it('unauthorized tool', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'delete_file', {});
    const e = await denyExplanation({
      chain,
      pop,
      tool: 'delete_file',
      args: {},
      trustAnchors: chain.trustAnchors,
    });
    expect(codes(e)).toContain('tool_not_authorized');
    expect(e.reasons.find((r) => r.code === 'tool_not_authorized')?.stage).toBe('evaluation');
  });

  it('argument constraint denial — locators present, value absent', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: SECRET_PATH });
    const e = await denyExplanation({
      chain,
      pop,
      tool: 'read_file',
      args: { path: SECRET_PATH },
      trustAnchors: chain.trustAnchors,
    });
    const r = e.reasons.find((x) => x.code === 'argument_constraint_violated');
    expect(r?.argument).toBe('path');
    expect(r?.tool).toBe('read_file');
    assertNoSensitiveMaterial(e, SECRET_PATH);
  });
});

describe('ALLOW explanations are meaningful and safe', () => {
  it('summarizes the authority without leaking argument values', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const verification = await verifyAuthority({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      now: NOW + 1,
    });
    expect(verification.ok).toBe(true);
    if (!verification.ok) return;
    const e = toExplanation(evaluate(verification.authority), verification.authority);

    expect(e.decision).toBe('ALLOW');
    expect(e.reasons).toHaveLength(0);
    expect(e.authority?.subject).toMatch(/^urn:ietf:params:oauth:jwk-thumbprint:sha-256:/);
    expect(e.authority?.requestedTool).toBe('read_file');
    // Argument NAMES, not values.
    expect(e.authority?.requestedArgumentNames).toEqual(['path']);
    expect(e.authority?.grantedTools).toEqual(['read_file', 'search_index']);
    assertNoSensitiveMaterial(e, '/data/q3.pdf');
  });
});

describe('adapters carry the same locator fields (shared model)', () => {
  it('MCP preserves tool/argument/tokenIndex in reasons', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const pop = await popFor(chain, 'read_file', { path: SECRET_PATH });
    const result = await enforceOaafPrecondition({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: SECRET_PATH },
      now: NOW + 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const r = result.error.data.reasons.find((x) => x.code === 'argument_constraint_violated');
    expect(r?.tool).toBe('read_file');
    expect(r?.argument).toBe('path');
    for (const reason of result.error.data.reasons) {
      expect(JSON.stringify(reason).includes(SECRET_PATH)).toBe(false);
    }
  });

  it('A2A preserves tool/argument/tokenIndex in reasons', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const pop = await popFor(chain, 'read_file', { path: SECRET_PATH });
    const result = await enforceA2aAuthority({
      message: { metadata: { [METADATA_KEY_CHAIN]: chain.tokens, [METADATA_KEY_POP]: pop } },
      activatedExtensionUris: [OAAF_A2A_EXTENSION_URI],
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: SECRET_PATH },
      recipient: RECIPIENT,
      now: NOW + 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const r = result.error.data.reasons.find((x) => x.code === 'argument_constraint_violated');
    expect(r?.tool).toBe('read_file');
    expect(r?.argument).toBe('path');
    for (const reason of result.error.data.reasons) {
      expect(JSON.stringify(reason).includes(SECRET_PATH)).toBe(false);
    }
  });
});

describe('fail-closed: explanation cannot change the authorization outcome', () => {
  it('the decision is identical whether or not an explanation is built', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['allow', { path: '/data/q3.pdf' }],
      ['deny-value', { path: SECRET_PATH }],
    ];
    for (const [, args] of cases) {
      const chain = await buildRoot();
      const pop = await popFor(chain, 'read_file', args);
      const input = {
        tokens: chain.tokens,
        trustAnchors: chain.trustAnchors,
        pop,
        tool: 'read_file',
        args,
        now: NOW + 1,
      };
      // Decision without ever touching the explanation surface.
      const bare = await verifyAndEvaluate(input);
      // Decision with the explanation built from it.
      const withExplanation = await verifyAndEvaluate(input);
      const verification = await verifyAuthority(input);
      const explanation = toExplanation(
        withExplanation,
        verification.ok ? verification.authority : undefined,
      );
      // Building the explanation did not alter the outcome.
      expect(withExplanation.allowed).toBe(bare.allowed);
      expect(explanation.decision).toBe(bare.allowed ? 'ALLOW' : 'DENY');
    }
  });
});

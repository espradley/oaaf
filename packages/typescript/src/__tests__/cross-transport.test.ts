import { describe, expect, it } from 'vitest';

import { enforceOaafPrecondition, explainMcpResult } from '../mcp/coaz.js';
import { enforceA2aAuthority, explainA2aResult } from '../a2a/binding.js';
import type { DecisionExplanation } from '../explanation.js';
import { METADATA_KEY_CHAIN, METADATA_KEY_POP, OAAF_A2A_EXTENSION_URI } from '../a2a/extension.js';
import { generateHolderKey, mintPop } from '../testing/mint.js';
import { buildRoot, extend, NOW, popFor } from './fixtures.js';

/**
 * The O3C claim, protected by CI: the same authority chain and the same proof of
 * possession, fed through the MCP adapter and the A2A adapter, decide identically.
 * If the two transports ever diverge, this fails.
 */
async function bothTransports(
  chain: Awaited<ReturnType<typeof buildRoot>>,
  tool: string,
  args: Record<string, unknown>,
) {
  const pop = await popFor(chain, tool, args);

  const mcp = await enforceOaafPrecondition({
    tokens: chain.tokens,
    trustAnchors: chain.trustAnchors,
    pop,
    tool,
    args,
    now: NOW + 1,
  });

  const a2a = await enforceA2aAuthority({
    message: { metadata: { [METADATA_KEY_CHAIN]: chain.tokens, [METADATA_KEY_POP]: pop } },
    activatedExtensionUris: [OAAF_A2A_EXTENSION_URI],
    trustAnchors: chain.trustAnchors,
    skillId: tool,
    args,
    recipient: 'https://recipient.example',
    now: NOW + 1,
  });

  return { mcp: mcp.ok, a2a: a2a.ok };
}

describe('authority is not owned by the transport', () => {
  it('allows an in-scope call identically on MCP and A2A', async () => {
    const chain = await buildRoot();
    const { mcp, a2a } = await bothTransports(chain, 'read_file', { path: '/data/q3.pdf' });
    expect(mcp).toBe(true);
    expect(a2a).toBe(true);
    expect(mcp).toBe(a2a);
  });

  it('denies a narrowed-away call identically on MCP and A2A', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    // The root permitted q4; the delegated leaf does not. Same on both transports.
    const { mcp, a2a } = await bothTransports(chain, 'read_file', { path: '/data/q4.pdf' });
    expect(mcp).toBe(false);
    expect(a2a).toBe(false);
    expect(mcp).toBe(a2a);
  });

  it('denies an undelegated tool identically on MCP and A2A', async () => {
    const chain = await buildRoot();
    const { mcp, a2a } = await bothTransports(chain, 'delete_file', {});
    expect(mcp).toBe(false);
    expect(a2a).toBe(false);
    expect(mcp).toBe(a2a);
  });
});

// ---------------------------------------------------------------------------
// O4B: the explanation is a property of the authority decision, not the
// transport. The SAME chain + PoP + operation must yield an equivalent
// DecisionExplanation through both adapters.
//
// Equivalence is defined over the canonical DecisionExplanation only. The
// transport envelopes — the JSON-RPC numeric code, the A2A numeric code, the
// transport-level `message`, and MCP's PDP-facing `context` — are legitimately
// transport-derived and are excluded explicitly by using the canonical
// extractors `explainMcpResult` / `explainA2aResult`, which strip exactly those
// wrappers. Nothing else is normalized away: if an adapter drops or mutates a
// canonical field, the deep-equal below fails.
// ---------------------------------------------------------------------------

/** Run one operation's identical (chain, pop) through both adapters, return both explanations. */
async function explainBothTransports(
  chain: Awaited<ReturnType<typeof buildRoot>>,
  tool: string,
  args: Record<string, unknown>,
  popOverrides?: Parameters<typeof popFor>[3],
): Promise<{ mcp: DecisionExplanation; a2a: DecisionExplanation }> {
  const pop = await popFor(chain, tool, args, popOverrides);

  const mcp = await enforceOaafPrecondition({
    tokens: chain.tokens,
    trustAnchors: chain.trustAnchors,
    pop,
    tool,
    args,
    now: NOW + 1,
  });

  const a2a = await enforceA2aAuthority({
    message: { metadata: { [METADATA_KEY_CHAIN]: chain.tokens, [METADATA_KEY_POP]: pop } },
    activatedExtensionUris: [OAAF_A2A_EXTENSION_URI],
    trustAnchors: chain.trustAnchors,
    skillId: tool,
    args,
    recipient: 'https://recipient.example',
    now: NOW + 1,
  });

  return { mcp: explainMcpResult(mcp), a2a: explainA2aResult(a2a) };
}

const SECRET = '/customer/private/9999';

/** Every string anywhere in an explanation, for privacy assertions. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

describe('O4B: explanation is transport-equivalent', () => {
  it('ALLOW — summaries are identical across MCP and A2A', async () => {
    const chain = await buildRoot();
    const { mcp, a2a } = await explainBothTransports(chain, 'read_file', { path: '/data/q3.pdf' });
    expect(mcp.decision).toBe('ALLOW');
    expect(mcp).toEqual(a2a); // full DecisionExplanation, incl. AuthoritySummary
  });

  it('unauthorized operation — DENY, reason, stage, tool locator identical', async () => {
    const chain = await buildRoot();
    const { mcp, a2a } = await explainBothTransports(chain, 'delete_file', {});
    expect(mcp.decision).toBe('DENY');
    expect(mcp).toEqual(a2a);
    expect(mcp.reasons[0]?.code).toBe('tool_not_authorized');
  });

  it('argument constraint denial — equivalent, and no value on either side', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const { mcp, a2a } = await explainBothTransports(chain, 'read_file', { path: SECRET });
    expect(mcp).toEqual(a2a);
    const r = mcp.reasons.find((x) => x.code === 'argument_constraint_violated');
    expect(r?.tool).toBe('read_file');
    expect(r?.argument).toBe('path');
    for (const side of [mcp, a2a]) {
      for (const str of strings(side)) expect(str.includes(SECRET)).toBe(false);
    }
  });

  it('expired authority — equivalent explanation on both', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' }, { iat: NOW + 8000 });
    const mcp = explainMcpResult(
      await enforceOaafPrecondition({
        tokens: chain.tokens,
        trustAnchors: chain.trustAnchors,
        pop,
        tool: 'read_file',
        args: { path: '/data/q3.pdf' },
        now: NOW + 8000,
      }),
    );
    const a2a = explainA2aResult(
      await enforceA2aAuthority({
        message: { metadata: { [METADATA_KEY_CHAIN]: chain.tokens, [METADATA_KEY_POP]: pop } },
        activatedExtensionUris: [OAAF_A2A_EXTENSION_URI],
        trustAnchors: chain.trustAnchors,
        skillId: 'read_file',
        args: { path: '/data/q3.pdf' },
        recipient: 'https://recipient.example',
        now: NOW + 8000,
      }),
    );
    expect(mcp).toEqual(a2a);
    expect(mcp.reasons.map((r) => r.code)).toContain('expired');
  });

  it('identity/PoP failure — equivalent explanation on both', async () => {
    const chain = await buildRoot();
    const impostor = await generateHolderKey();
    const pop = await mintPop({
      leafKey: impostor,
      leafJti: chain.leafJti,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      issuedAt: NOW,
    });
    const mcp = explainMcpResult(
      await enforceOaafPrecondition({
        tokens: chain.tokens,
        trustAnchors: chain.trustAnchors,
        pop,
        tool: 'read_file',
        args: { path: '/data/q3.pdf' },
        now: NOW + 1,
      }),
    );
    const a2a = explainA2aResult(
      await enforceA2aAuthority({
        message: { metadata: { [METADATA_KEY_CHAIN]: chain.tokens, [METADATA_KEY_POP]: pop } },
        activatedExtensionUris: [OAAF_A2A_EXTENSION_URI],
        trustAnchors: chain.trustAnchors,
        skillId: 'read_file',
        args: { path: '/data/q3.pdf' },
        recipient: 'https://recipient.example',
        now: NOW + 1,
      }),
    );
    expect(mcp).toEqual(a2a);
    expect(mcp.reasons.map((r) => r.code)).toContain('pop_signature_invalid');
  });

  it('delegation-chain failure (reordering) — equivalent explanation on both', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const reordered = { ...chain, tokens: [chain.tokens[1] as string, chain.tokens[0] as string] };
    const { mcp, a2a } = await explainBothTransports(reordered, 'read_file', {
      path: '/data/q3.pdf',
    });
    expect(mcp.decision).toBe('DENY');
    expect(mcp).toEqual(a2a);
  });

  it('privacy omission is equivalent — neither transport leaks where the other suppresses', async () => {
    const chain = await buildRoot();
    const { mcp, a2a } = await explainBothTransports(chain, 'read_file', { path: SECRET });
    // Same set of strings modulo ordering; neither contains the value.
    for (const side of [mcp, a2a]) {
      for (const str of strings(side)) expect(str.includes(SECRET)).toBe(false);
    }
    expect(mcp).toEqual(a2a);
  });
});

import { describe, expect, it } from 'vitest';

import { enforceOaafPrecondition } from '../mcp/coaz.js';
import { enforceA2aAuthority } from '../a2a/binding.js';
import { METADATA_KEY_CHAIN, METADATA_KEY_POP, OAAF_A2A_EXTENSION_URI } from '../a2a/extension.js';
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

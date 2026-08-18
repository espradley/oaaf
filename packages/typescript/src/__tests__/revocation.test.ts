import { describe, expect, it } from 'vitest';

import { enforceOaafPrecondition } from '../mcp/coaz.js';
import { enforceA2aAuthority } from '../a2a/binding.js';
import { METADATA_KEY_CHAIN, METADATA_KEY_POP, OAAF_A2A_EXTENSION_URI } from '../a2a/extension.js';
import { verifyAndEvaluate } from '../decide.js';
import { revokedSetResolver, type StatusResolver } from '../status.js';
import { buildRoot, extend, NOW, popFor } from './fixtures.js';

const AT = NOW + 1;

describe('revocation (RFC-0004)', () => {
  it('no resolver → expiry-only, unchanged (ALLOW)', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const d = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      now: AT,
    });
    expect(d.allowed).toBe(true);
  });

  it('resolver reports leaf revoked → DENY authority_revoked', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const d = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      now: AT,
      statusResolver: revokedSetResolver([chain.leafJti]),
    });
    expect(d.allowed).toBe(false);
    expect(d.denials[0]?.code).toBe('authority_revoked');
    expect(d.denials[0]?.stage).toBe('status');
  });

  it('revoked ancestor invalidates the delegation (cascading)', async () => {
    const root = await buildRoot(); // root jti 'root-1'
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const d = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      now: AT,
      statusResolver: revokedSetResolver(['root-1']), // the root token
    });
    expect(d.allowed).toBe(false);
    expect(d.denials[0]?.code).toBe('authority_revoked');
    expect(d.denials[0]?.tokenIndex).toBe(0); // the ancestor
  });

  it('required status unknown → DENY status_unavailable (fail closed)', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const unavailable: StatusResolver = () => 'unknown';
    const d = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      now: AT,
      statusResolver: unavailable,
    });
    expect(d.allowed).toBe(false);
    expect(d.denials[0]?.code).toBe('status_unavailable');
  });

  it('allowUnknownStatus lets an unknown status proceed (documented weaker mode)', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const d = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      now: AT,
      statusResolver: () => 'unknown',
      allowUnknownStatus: true,
    });
    expect(d.allowed).toBe(true);
  });

  it('revocation is transport-equivalent across MCP and A2A', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const resolver = revokedSetResolver([chain.leafJti]);

    const mcp = await enforceOaafPrecondition({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      now: AT,
      statusResolver: resolver,
    });
    const a2a = await enforceA2aAuthority({
      message: { metadata: { [METADATA_KEY_CHAIN]: chain.tokens, [METADATA_KEY_POP]: pop } },
      activatedExtensionUris: [OAAF_A2A_EXTENSION_URI],
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
      recipient: 'https://r.example',
      now: AT,
      statusResolver: resolver,
    });

    expect(mcp.ok).toBe(false);
    expect(a2a.ok).toBe(false);
    if (mcp.ok || a2a.ok) return;
    expect(mcp.error.data.reasons[0]?.code).toBe('authority_revoked');
    expect(a2a.error.data.reasons[0]?.code).toBe('authority_revoked');
  });

  it('expiry and revocation stay distinct', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    // Expired: distinct reason even with a resolver that would revoke.
    const d = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      now: NOW + 3600 + 100,
      statusResolver: revokedSetResolver([chain.leafJti]),
    });
    expect(d.denials[0]?.code).toBe('expired'); // chain temporal check fires first
  });
});

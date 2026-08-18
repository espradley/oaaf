import { describe, expect, it } from 'vitest';

import {
  buildCoazToolCallRequest,
  enforceAndMapToCoaz,
  enforceOaafPrecondition,
  JSONRPC_AUTHORIZATION_DENIED,
} from '../mcp/coaz.js';
import { generateHolderKey } from '../testing/mint.js';
import { buildRoot, extend, NOW, popFor } from './fixtures.js';

const PRINCIPAL = 'urn:example:user:alice';
const AGENT = 'agent-42';

describe('COAZ default mapping (unmodified by OAAF)', () => {
  it('matches the shape COAZ-MCP defines for tools/call', () => {
    const request = buildCoazToolCallRequest({
      subject: PRINCIPAL,
      tool: 'read_file',
      agent: AGENT,
    });
    expect(request).toEqual({
      subject: { type: 'identity', id: PRINCIPAL },
      action: { name: 'tools/call' },
      resource: { type: 'tool', id: 'read_file' },
      context: { agent: AGENT },
    });
  });

  it('omits context.agent when no agent claim is available, per $token.?client_id', () => {
    const request = buildCoazToolCallRequest({ subject: PRINCIPAL, tool: 'read_file' });
    expect(request.context).toEqual({});
  });
});

describe('RFC-0002 seven cases', () => {
  it('1. valid mapped authority allows', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const result = await enforceAndMapToCoaz({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      principal: PRINCIPAL,
      agent: AGENT,
      now: NOW + 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // COAZ owns subject/action/resource; OAAF contributes only context.oaaf.
    expect(result.request.subject).toEqual({ type: 'identity', id: PRINCIPAL });
    expect(result.request.action).toEqual({ name: 'tools/call' });
    expect(result.request.resource).toEqual({ type: 'tool', id: 'read_file' });
    expect(result.request.context['agent']).toBe(AGENT);
    // context.oaaf now derives from the canonical AuthoritySummary vocabulary.
    const oaaf = result.request.context['oaaf'] as Record<string, unknown>;
    expect(oaaf['subject']).toMatch(/^urn:ietf:params:oauth:jwk-thumbprint:sha-256:/);
    expect(oaaf['grantedTools']).toEqual(['read_file', 'search_index']);
    expect(oaaf['requestedTool']).toBe('read_file');
  });

  it('2. missing capability denies', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'delete_file', {});
    const result = await enforceAndMapToCoaz({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'delete_file',
      args: {},
      principal: PRINCIPAL,
      now: NOW + 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(JSONRPC_AUTHORIZATION_DENIED);
    const reasons = result.error.data?.['reasons'] as Array<{ code: string }>;
    expect(reasons.map((r) => r.code)).toContain('tool_not_authorized');
    // MCP-001: on an OAAF denial the PEP refuses BEFORE the PDP — no AuthZEN request
    // is constructed. The failure branch carries an error and never a request.
    expect('request' in result).toBe(false);
  });

  it('3. resource/argument mismatch denies', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/etc/passwd' });
    const result = await enforceOaafPrecondition({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/etc/passwd' },
      now: NOW + 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const reasons = result.error.data?.['reasons'] as Array<{ code: string }>;
    expect(reasons.map((r) => r.code)).toContain('argument_constraint_violated');
  });

  it('4. expired authority denies', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' }, { iat: NOW + 4000 });
    const result = await enforceOaafPrecondition({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      now: NOW + 4000, // beyond the root's 1-hour expiry
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const reasons = result.error.data?.['reasons'] as Array<{ code: string }>;
    expect(reasons.map((r) => r.code)).toContain('expired');
  });

  it('5. untrusted root denies', async () => {
    const chain = await buildRoot();
    const stranger = await generateHolderKey();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const result = await enforceOaafPrecondition({
      tokens: chain.tokens,
      trustAnchors: [stranger.publicJwk], // not the chain's actual issuer
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      now: NOW + 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const reasons = result.error.data?.['reasons'] as Array<{ code: string }>;
    expect(reasons.map((r) => r.code)).toContain('untrusted_root');
  });

  it('6. malformed/private-key cnf denies', async () => {
    // A root whose cnf.jwk carries private key material must be refused before
    // any capability question is even asked.
    const { CompactSign } = await import('jose');
    const issuerKey = await generateHolderKey();
    const payload = {
      jti: 'root-priv',
      iss: 'https://authority.example',
      iat: NOW,
      exp: NOW + 3600,
      cnf: { jwk: { kty: 'OKP', crv: 'Ed25519', x: 'AAAA', d: 'SECRET-PRIVATE-SCALAR' } },
      del_depth: 0,
      del_max_depth: 3,
      authorization_details: [{ type: 'attenuating_agent_token', tools: { read_file: {} } }],
    };
    const token = await new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
      .setProtectedHeader({ alg: 'EdDSA' })
      .sign(issuerKey.privateKey);

    const result = await enforceOaafPrecondition({
      tokens: [token],
      trustAnchors: [issuerKey.publicJwk],
      pop: '',
      tool: 'read_file',
      args: {},
      now: NOW + 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const reasons = result.error.data?.['reasons'] as Array<{ code: string }>;
    expect(reasons.map((r) => r.code)).toContain('private_key_material');
  });

  it('7. a valid COAZ request without valid OAAF authority still denies', async () => {
    // COAZ's own inputs (principal, agent, tool) are perfectly well-formed —
    // this is what a request would look like if OAAF were skipped entirely.
    // The precondition must deny before any such request is even built.
    const chain = await buildRoot();
    const result = await enforceAndMapToCoaz({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop: '', // no proof of possession presented
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      principal: PRINCIPAL,
      agent: AGENT,
      now: NOW + 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(JSONRPC_AUTHORIZATION_DENIED);
    const reasons = result.error.data?.['reasons'] as Array<{ code: string }>;
    expect(reasons.map((r) => r.code)).toContain('pop_missing');
  });
});

describe('the precondition runs before any PDP call could occur', () => {
  it('never produces a request when verification fails', async () => {
    // enforceOaafPrecondition returns only an error on failure — there is no
    // path that returns both a denial and a constructible AuthZEN request.
    const chain = await buildRoot();
    const result = await enforceOaafPrecondition({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop: '',
      tool: 'read_file',
      args: {},
      now: NOW + 1,
    });
    expect(result.ok).toBe(false);
    expect('context' in result).toBe(false);
  });

  it('a delegated leaf cannot exceed authority the root already narrowed away', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const pop = await popFor(chain, 'read_file', { path: '/data/q4.pdf' });
    const result = await enforceOaafPrecondition({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q4.pdf' },
      now: NOW + 1,
    });
    expect(result.ok).toBe(false);
  });
});

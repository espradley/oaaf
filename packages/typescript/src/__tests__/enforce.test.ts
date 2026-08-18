import { describe, expect, it } from 'vitest';

import { evaluate, verifyAndEvaluate, verifyAuthority } from '../decide.js';
import { explain } from '../explain.js';
import { OAAF_RESOURCE_TYPE, OAAF_SUBJECT_TYPE } from '../authzen/map.js';
import { generateHolderKey, mintPop } from '../testing/mint.js';
import { buildRoot, extend, NOW, popFor } from './fixtures.js';

const AT = { now: NOW + 1 };

describe('proof of possession', () => {
  it('accepts a valid proof', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const result = await verifyAuthority({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      ...AT,
    });
    expect(result.ok).toBe(true);
  });

  it('denies a missing proof', async () => {
    const chain = await buildRoot();
    const result = await verifyAuthority({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop: '',
      tool: 'read_file',
      args: {},
      ...AT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.denials[0]?.code).toBe('pop_missing');
  });

  it('denies a proof signed by the wrong key', async () => {
    const chain = await buildRoot();
    const impostor = await generateHolderKey();
    const pop = await mintPop({
      leafKey: impostor,
      leafJti: chain.leafJti,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      issuedAt: NOW,
    });
    const result = await verifyAuthority({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      ...AT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.denials[0]?.code).toBe('pop_signature_invalid');
  });

  it('denies a proof naming a different leaf token', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' }, { aat_id: 'other' });
    const result = await verifyAuthority({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      ...AT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.denials.map((d) => d.code)).toContain('pop_token_mismatch');
  });

  it('denies a proof naming a different tool', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'search_index', {});
    const result = await verifyAuthority({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: {},
      ...AT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.denials.map((d) => d.code)).toContain('pop_tool_mismatch');
  });

  it('denies a proof bound to different arguments', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const result = await verifyAuthority({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q4.pdf' },
      ...AT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.denials.map((d) => d.code)).toContain('pop_binding_mismatch');
  });

  it('matches arguments by canonical form, not key order', async () => {
    const chain = await buildRoot({
      report: { a: { constraint_type: 'wildcard' }, b: { constraint_type: 'wildcard' } },
    });
    const pop = await popFor(chain, 'report', { b: 2, a: 1 });
    const result = await verifyAuthority({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'report',
      args: { a: 1, b: 2 },
      ...AT,
    });
    expect(result.ok).toBe(true);
  });
});

describe('evaluation', () => {
  it('allows an authorized request', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const decision = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      ...AT,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.response.decision).toBe(true);
    expect(decision.denials).toHaveLength(0);
  });

  it('denies a tool the authority does not grant', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'delete_file', {});
    const decision = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'delete_file',
      args: {},
      ...AT,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.denials.map((d) => d.code)).toContain('tool_not_authorized');
  });

  it('denies an argument violating its constraint', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/etc/passwd' });
    const decision = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/etc/passwd' },
      ...AT,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.denials.map((d) => d.code)).toContain('argument_constraint_violated');
  });

  it('denies an unknown argument under closed-world mode', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf', encoding: 'utf8' });
    const decision = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf', encoding: 'utf8' },
      ...AT,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.denials.map((d) => d.code)).toContain('argument_not_permitted');
  });

  it('allows any argument when the tool is unconstrained', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'search_index', { query: 'anything' });
    const decision = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'search_index',
      args: { query: 'anything' },
      ...AT,
    });
    expect(decision.allowed).toBe(true);
  });

  it('denies a request the leaf gave up through delegation', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const pop = await popFor(chain, 'read_file', { path: '/data/q4.pdf' });
    const decision = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q4.pdf' },
      ...AT,
    });
    // The root permitted q4; the delegated leaf does not.
    expect(decision.allowed).toBe(false);
    expect(decision.denials.map((d) => d.code)).toContain('argument_constraint_violated');
  });
});

describe('AuthZEN mapping', () => {
  it('maps a verified authority into a conformant request', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const verification = await verifyAuthority({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      ...AT,
    });
    expect(verification.ok).toBe(true);
    if (!verification.ok) return;

    const decision = evaluate(verification.authority);
    const request = decision.request;
    expect(request).toBeDefined();
    expect(request?.subject.type).toBe(OAAF_SUBJECT_TYPE);
    expect(request?.subject.id).toMatch(/^urn:ietf:params:oauth:jwk-thumbprint:sha-256:/);
    expect(request?.action.name).toBe('read_file');
    expect(request?.resource.type).toBe(OAAF_RESOURCE_TYPE);
    expect(request?.resource.id).toBe('read_file');
    expect(request?.action.properties?.['arguments']).toEqual({ path: '/data/q3.pdf' });
  });

  it('carries reasons in the response context on a denial', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'delete_file', {});
    const decision = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'delete_file',
      args: {},
      ...AT,
    });
    expect(decision.response.decision).toBe(false);
    const reasons = decision.response.context?.['reasons'] as Array<{ code: string }>;
    expect(Array.isArray(reasons)).toBe(true);
    expect(reasons[0]?.code).toBe('tool_not_authorized');
  });

  it('produces no request when verification fails', async () => {
    const chain = await buildRoot();
    const decision = await verifyAndEvaluate({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop: '',
      tool: 'read_file',
      args: {},
      ...AT,
    });
    expect(decision.request).toBeUndefined();
    expect(decision.response.decision).toBe(false);
  });

  it('is deterministic for identical input', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const input = {
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      ...AT,
    };
    const a = await verifyAndEvaluate(input);
    const b = await verifyAndEvaluate(input);
    expect(JSON.stringify(a.request)).toBe(JSON.stringify(b.request));
    expect(JSON.stringify(a.response)).toBe(JSON.stringify(b.response));
  });
});

describe('explanation', () => {
  it('names the reason, the request, and what the leaf permits', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const pop = await popFor(chain, 'read_file', { path: '/data/q4.pdf' });
    const verification = await verifyAuthority({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'read_file',
      args: { path: '/data/q4.pdf' },
      ...AT,
    });
    expect(verification.ok).toBe(true);
    if (!verification.ok) return;

    const decision = evaluate(verification.authority);
    const text = explain(decision, verification.authority);

    expect(text).toContain('DENIED');
    expect(text).toContain('argument_constraint_violated');
    expect(text).toContain('read_file');
    expect(text).toContain('root → hop 1');
    expect(text).toContain('Leaf permits');
  });

  it('renders an allow without reasons', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'search_index', {});
    const verification = await verifyAuthority({
      tokens: chain.tokens,
      trustAnchors: chain.trustAnchors,
      pop,
      tool: 'search_index',
      args: {},
      ...AT,
    });
    expect(verification.ok).toBe(true);
    if (!verification.ok) return;
    const text = explain(evaluate(verification.authority), verification.authority);
    expect(text).toContain('ALLOWED');
    expect(text).not.toContain('Reason');
  });
});

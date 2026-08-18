import { describe, expect, it } from 'vitest';

import {
  enforceA2aAuthority,
  A2A_EXTENSION_SUPPORT_REQUIRED,
  A2A_AUTHORIZATION_DENIED,
} from '../a2a/binding.js';
import { METADATA_KEY_CHAIN, METADATA_KEY_POP, OAAF_A2A_EXTENSION_URI } from '../a2a/extension.js';
import { generateHolderKey, mintPop } from '../testing/mint.js';
import { buildRoot, extend, NOW, popFor, type Chain } from './fixtures.js';

const RECIPIENT = 'https://agent-b.example';
const ACTIVATED = [OAAF_A2A_EXTENSION_URI];

/** Build an A2A message carrying a chain + PoP in metadata, as RFC-0003 defines. */
function messageWith(chain: Chain, pop: string) {
  return {
    metadata: {
      [METADATA_KEY_CHAIN]: chain.tokens,
      [METADATA_KEY_POP]: pop,
    },
  };
}

type EnforceInput = Parameters<typeof enforceA2aAuthority>[0];

/** Fill in the constant fields; each test supplies the varying ones (and MAY override now). */
async function enforce(over: Omit<EnforceInput, 'activatedExtensionUris' | 'recipient'>) {
  return enforceA2aAuthority({
    activatedExtensionUris: ACTIVATED,
    recipient: RECIPIENT,
    now: NOW + 1,
    ...over,
  });
}

describe('A2A precondition — accept path', () => {
  it('valid authority + valid PoP → accepted', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const result = await enforce({
      message: messageWith(chain, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.authority.chain.leafHolder).toMatch(/^urn:ietf/);
  });
});

describe('A2A precondition — deny paths', () => {
  it('missing required extension → ExtensionSupportRequiredError, denied', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const result = await enforceA2aAuthority({
      message: messageWith(chain, pop),
      activatedExtensionUris: [], // not activated
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
      recipient: RECIPIENT,
      now: NOW + 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(A2A_EXTENSION_SUPPORT_REQUIRED);
    expect(result.error.data.reasons[0]?.code).toBe('extension_not_activated');
  });

  it('missing authority metadata → denied', async () => {
    const chain = await buildRoot();
    const result = await enforce({
      message: { metadata: {} }, // no chain/pop keys
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(A2A_AUTHORIZATION_DENIED);
    expect(result.error.data.reasons[0]?.code).toBe('authority_material_missing');
  });

  it('malformed authority material → denied', async () => {
    const chain = await buildRoot();
    const result = await enforce({
      message: { metadata: { [METADATA_KEY_CHAIN]: 'not-an-array', [METADATA_KEY_POP]: 5 } },
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.data.reasons[0]?.code).toBe('authority_material_missing');
  });

  it('invalid signature → denied', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const tampered = { ...chain, tokens: [`${(chain.tokens[0] as string).slice(0, -4)}AAAA`] };
    const result = await enforce({
      message: messageWith(tampered, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.data.reasons.map((r) => r.code)).toContain('untrusted_root');
  });

  it('expired authority → denied', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' }, { iat: NOW + 8000 });
    const result = await enforce({
      message: messageWith(chain, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
      now: NOW + 8000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.data.reasons.map((r) => r.code)).toContain('expired');
  });

  it('authority-chain truncation → denied', async () => {
    // A two-hop chain presented with only the leaf: linkage/length checks reject it.
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const truncated = { ...chain, tokens: [chain.tokens[1] as string] };
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const result = await enforce({
      message: messageWith(truncated, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
    });
    expect(result.ok).toBe(false);
  });

  it('reordered chain → denied', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const reordered = { ...chain, tokens: [chain.tokens[1] as string, chain.tokens[0] as string] };
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' });
    const result = await enforce({
      message: messageWith(reordered, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
    });
    expect(result.ok).toBe(false);
  });

  it('wrong holder / PoP signed by the wrong key → denied', async () => {
    const chain = await buildRoot();
    const impostor = await generateHolderKey();
    const pop = await mintPop({
      leafKey: impostor,
      leafJti: chain.leafJti,
      tool: 'read_file',
      args: { path: '/data/q3.pdf' },
      issuedAt: NOW,
    });
    const result = await enforce({
      message: messageWith(chain, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.data.reasons.map((r) => r.code)).toContain('pop_signature_invalid');
  });

  it('wrong recipient / audience → denied', async () => {
    const chain = await buildRoot();
    const pop = await popFor(
      chain,
      'read_file',
      { path: '/data/q3.pdf' },
      {
        aat_aud: 'https://some-other-agent.example',
      },
    );
    const result = await enforce({
      message: messageWith(chain, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.data.reasons.map((r) => r.code)).toContain('pop_recipient_mismatch');
  });

  it('recipient binding required but absent → denied', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' }); // no aat_aud
    const result = await enforce({
      message: messageWith(chain, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
      requireRecipientBinding: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.data.reasons.map((r) => r.code)).toContain('pop_recipient_mismatch');
  });

  it('matching recipient → accepted', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'read_file', { path: '/data/q3.pdf' }, { aat_aud: RECIPIENT });
    const result = await enforce({
      message: messageWith(chain, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q3.pdf' },
      requireRecipientBinding: true,
    });
    expect(result.ok).toBe(true);
  });

  it('requested operation outside delegated authority → denied', async () => {
    const root = await buildRoot();
    const chain = await extend(root, {
      read_file: { path: { constraint_type: 'exact', value: '/data/q3.pdf' } },
    });
    const pop = await popFor(chain, 'read_file', { path: '/data/q4.pdf' });
    const result = await enforce({
      message: messageWith(chain, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: { path: '/data/q4.pdf' }, // root allowed q4; delegation gave it up
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.data.reasons.map((r) => r.code)).toContain('argument_constraint_violated');
  });

  it('valid A2A authentication but invalid OAAF authority → denied', async () => {
    // "Authenticated" is modelled by the extension being activated and a
    // well-formed message; the authority itself is absent.
    const chain = await buildRoot();
    const result = await enforce({
      message: { metadata: {} },
      trustAnchors: chain.trustAnchors,
      skillId: 'read_file',
      args: {},
    });
    expect(result.ok).toBe(false);
  });

  it('skill not in the delegated authority → denied', async () => {
    const chain = await buildRoot();
    const pop = await popFor(chain, 'delete_file', {});
    const result = await enforce({
      message: messageWith(chain, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'delete_file',
      args: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.data.reasons.map((r) => r.code)).toContain('tool_not_authorized');
  });
});

describe('A2A precondition — no fork of the core', () => {
  it('reuses AAT verification: a chain valid under verifyAuthority is valid here', async () => {
    // Same fixture the chain tests use; the A2A path must not diverge.
    const chain = await buildRoot();
    const pop = await popFor(chain, 'search_index', { q: 'anything' });
    const result = await enforce({
      message: messageWith(chain, pop),
      trustAnchors: chain.trustAnchors,
      skillId: 'search_index',
      args: { q: 'anything' },
    });
    // search_index is unconstrained in the fixture → any args allowed.
    expect(result.ok).toBe(true);
  });
});

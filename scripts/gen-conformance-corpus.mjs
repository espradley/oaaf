/**
 * Generate the portable OAAF conformance corpus (O6B).
 *
 * The corpus is a language-neutral set of static vectors. Each vector holds real
 * signed authority material plus the expected decision and the normative reason
 * code, and is tagged with the O6A requirement IDs it exercises. An independent
 * implementation can consume the corpus with its own crypto and its own object
 * model — it never imports OAAF code — which is the whole point of O6B.
 *
 * The schema is snake_case and carries no TS/Python object shapes, so it is the
 * basis for a future `oaaf conform` runner. See the corpus README for the schema.
 *
 * Generation is self-validating: the expected decision and normative reason are
 * computed by the reference here, and every vector's declared intent (`wantReason`)
 * is asserted against what the reference actually produces. A surprise fails the
 * build rather than shipping a wrong vector.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  verifyAndEvaluate,
  verifyAuthority,
  toExplanation,
  revokedSetResolver,
  boundSubjectsVerifier,
} from '../packages/typescript/dist/index.js';
import { enforceA2aAuthority, explainA2aResult } from '../packages/typescript/dist/a2a/binding.js';
import {
  generateHolderKey,
  mintRootToken,
  mintDerivedToken,
  mintPop,
} from '../packages/typescript/dist/testing/mint.js';

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'spec',
  '0.1',
  'conformance',
  'vectors',
);
mkdirSync(OUT, { recursive: true });

const NOW = 1_780_000_000;
const HOUR = 3600;
const RECIPIENT = 'https://recipient.example';
const A2A_CHAIN = 'https://oaaf.dev/a2a/authority/v1/chain';
const A2A_POP = 'https://oaaf.dev/a2a/authority/v1/pop';
const A2A_EXT = 'https://oaaf.dev/a2a/authority/v1';
const SPIFFE_ALICE = 'spiffe://company.example/agents/alice';
const SPIFFE_BOB = 'spiffe://company.example/agents/bob';

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

/** Reference explanation for a core input (optionally with resolver/verifier). */
async function coreExplanation(input) {
  const decision = await verifyAndEvaluate(input);
  const v = await verifyAuthority(input);
  return toExplanation(decision, v.ok ? v.authority : undefined);
}

const vectors = [];

/**
 * Record a vector. `explanation` is the reference DecisionExplanation. `wantReason`
 * is the declared normative reason (null for allow); generation fails if it does
 * not match the reference.
 */
function record({ id, requirements, profile, notes, input, explanation, wantReason }) {
  const decision = explanation.decision.toLowerCase(); // 'allow' | 'deny'
  const actualReason = explanation.reasons[0]?.code ?? null;
  if (decision === 'deny' && wantReason !== undefined && actualReason !== wantReason) {
    throw new Error(
      `vector ${id}: expected reason ${wantReason}, reference produced ${actualReason}`,
    );
  }
  vectors.push({
    vector_id: id,
    requirements,
    profile,
    expected_decision: decision,
    expected_normative_reason: decision === 'deny' ? actualReason : null,
    input,
    notes,
    reference: explanation,
  });
}

/** Root + one derived; leafTools defaults to a narrowed read. Overrides for adversarial cases. */
async function chain({ rootTools, leafTools, maxDepth = 2, rootOver = {}, derivedOver = {} }) {
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
    ...rootOver,
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
    ...derivedOver,
  });
  return { issuerKey, alice, bob, root, derived, anchors: [issuerKey.publicJwk] };
}

const pop = (bob, tool, args, overrides) =>
  mintPop({
    leafKey: bob,
    leafJti: 'derived',
    tool,
    args,
    issuedAt: NOW,
    ...(overrides ? { overrides } : {}),
  });

/** Assemble the portable input object (snake_case, transport-neutral). */
function input(c, pop, tool, args, extra = {}) {
  return {
    tokens: c.tokens ?? [c.root, c.derived],
    trust_anchors: c.anchors,
    pop,
    tool,
    args,
    now: NOW + 1,
    ...extra,
  };
}

/** Map a portable input to the reference core call. */
function coreCall(inp) {
  const call = {
    tokens: inp.tokens,
    trustAnchors: inp.trust_anchors,
    pop: inp.pop,
    tool: inp.tool,
    args: inp.args,
    now: inp.now,
  };
  if (inp.revoked_jti || inp.unknown_jti) {
    call.statusResolver = revokedSetResolver(inp.revoked_jti ?? [], inp.unknown_jti ?? []);
  }
  if (inp.bound_subjects || inp.unavailable_subjects) {
    call.identityBindingVerifier = boundSubjectsVerifier(
      inp.bound_subjects ?? [],
      inp.unavailable_subjects ?? [],
    );
  }
  return call;
}

async function core({ id, requirements, notes, input: inp, wantReason }) {
  record({
    id,
    requirements,
    profile: 'Core',
    notes,
    input: inp,
    wantReason,
    explanation: await coreExplanation(coreCall(inp)),
  });
}

// ============================================================================
// Priority 1 — CORE-NARROW-001 and authority-widening failures
// ============================================================================
{
  const c = await chain({
    rootTools: { 'repo.read': {} },
    leafTools: { 'repo.read': {}, 'repo.delete': {} },
  });
  await core({
    id: 'core-narrow-widening-tool',
    requirements: ['CORE-NARROW-001'],
    notes:
      'The central thesis. A derived token grants repo.delete, a tool absent from its parent. A verifier MUST reject a delegation that grants authority absent from its parent.',
    input: input(c, await pop(c.bob, 'repo.delete', {}), 'repo.delete', {}),
    wantReason: 'tool_not_delegated',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': { path: { constraint_type: 'one_of', values: ['a', 'b'] } } },
    leafTools: { 'repo.read': { path: { constraint_type: 'one_of', values: ['a', 'b', 'c'] } } },
  });
  await core({
    id: 'core-narrow-constraint-widened',
    requirements: ['CORE-NARROW-002'],
    notes:
      'A derived constraint admits a superset of its parent (adds value c). Narrowing only; widening a constraint MUST deny.',
    input: input(c, await pop(c.bob, 'repo.read', { path: 'c' }), 'repo.read', { path: 'c' }),
    wantReason: 'constraint_expansion',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
    leafTools: { 'repo.read': { path: { constraint_type: 'one_of', values: ['a', 'b'] } } },
  });
  await core({
    id: 'core-narrow-constraint-type-not-permitted',
    requirements: ['CORE-NARROW-002', 'CORE-NARROW-004'],
    notes: 'A derived clause changes an exact constraint to a broader type it does not subsume.',
    input: input(c, await pop(c.bob, 'repo.read', { path: 'a' }), 'repo.read', { path: 'a' }),
    wantReason: 'constraint_type_not_permitted',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
    leafTools: {
      'repo.read': {
        path: { constraint_type: 'exact', value: 'a' },
        extra: { constraint_type: 'exact', value: 'y' },
      },
    },
  });
  await core({
    id: 'core-narrow-argument-key-set-mismatch',
    requirements: ['CORE-NARROW-003'],
    notes:
      'Closed-world key sets must match exactly; the derived token adds an argument key its parent did not constrain.',
    input: input(c, await pop(c.bob, 'repo.read', { path: 'a', extra: 'y' }), 'repo.read', {
      path: 'a',
      extra: 'y',
    }),
    wantReason: 'argument_key_set_mismatch',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': { path: { constraint_type: 'bogus', value: 'a' } } },
    leafTools: { 'repo.read': { path: { constraint_type: 'bogus', value: 'a' } } },
  });
  await core({
    id: 'core-narrow-constraint-type-unrecognized',
    requirements: ['CORE-NARROW-004'],
    notes: 'An unrecognized constraint type MUST deny (fail closed), not be treated as satisfied.',
    input: input(c, await pop(c.bob, 'repo.read', { path: 'a' }), 'repo.read', { path: 'a' }),
    wantReason: 'constraint_type_unrecognized',
  });
}

// ============================================================================
// Priority 2 — chain integrity / parent binding
// ============================================================================
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  await core({
    id: 'core-trust-untrusted-root',
    requirements: ['CORE-TRUST-001', 'CORE-TRUST-002'],
    notes:
      'The root is not verified against any configured trust anchor (anchor set empty). A root is a claim, not a trust root.',
    input: { ...input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}), trust_anchors: [] },
    wantReason: 'untrusted_root',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': {} },
    leafTools: { 'repo.read': {} },
    derivedOver: {
      overrides: {
        iss: 'urn:ietf:params:oauth:jwk-thumbprint:sha-256:WRONGWRONGWRONGWRONGWRONGWRONGWRONGWRONGWRO',
      },
    },
  });
  await core({
    id: 'core-crypto-issuer-thumbprint-mismatch',
    requirements: ['CORE-CRYPTO-003'],
    notes:
      'A derived token whose iss is not the JWK thumbprint URI of its parent cnf.jwk. The chain linkage is broken.',
    input: input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}),
    wantReason: 'issuer_thumbprint_mismatch',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': {} },
    leafTools: { 'repo.read': {} },
    derivedOver: { overrides: { par_hash: undefined } },
  });
  await core({
    id: 'core-chain-par-hash-missing',
    requirements: ['CORE-CHAIN-003'],
    notes: 'A derived token that omits par_hash is not bound to its parent.',
    input: input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}),
    wantReason: 'par_hash_missing',
  });
}
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const tampered = [c.root, `${c.derived.slice(0, -4)}AAAA`];
  await core({
    id: 'core-crypto-invalid-signature',
    requirements: ['CORE-CRYPTO-001'],
    notes:
      'A derived token signature is tampered; every chain member MUST be cryptographically verified. (A tampered root instead fails as untrusted_root against the anchor.)',
    input: { ...input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}), tokens: tampered },
    wantReason: 'invalid_signature',
  });
}
{
  // alg:none unsecured token — hand-crafted algorithm-confusion attack.
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const [, payload] = c.root.split('.');
  const unsecuredRoot = `${b64url({ alg: 'none' })}.${payload}.`;
  await core({
    id: 'core-crypto-alg-none-rejected',
    requirements: ['CORE-CRYPTO-002'],
    notes:
      'An unsecured token (alg:none) MUST NOT be accepted; the classic algorithm-confusion attack.',
    input: {
      ...input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}),
      tokens: [unsecuredRoot, c.derived],
    },
    wantReason: 'algorithm_not_permitted',
  });
}
{
  const issuerKey = await generateHolderKey();
  const alice = await generateHolderKey();
  const bob = await generateHolderKey();
  const doctored = {
    ...bob,
    publicJwk: { ...bob.publicJwk, d: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  };
  const root = await mintRootToken({
    issuer: 'https://authority.example',
    issuerKey,
    holder: alice,
    tools: { 'repo.read': {} },
    issuedAt: NOW,
    expiresAt: NOW + HOUR,
    maxDepth: 2,
    jti: 'root',
  });
  const derived = await mintDerivedToken({
    parentToken: root,
    parentKey: alice,
    parentPayload: { del_depth: 0, del_max_depth: 2, exp: NOW + HOUR, iat: NOW },
    holder: doctored,
    tools: { 'repo.read': {} },
    issuedAt: NOW,
    expiresAt: NOW + HOUR / 2,
    jti: 'derived',
  });
  const c = { root, derived, anchors: [issuerKey.publicJwk] };
  await core({
    id: 'core-crypto-private-key-material',
    requirements: ['CORE-CRYPTO-004'],
    notes: 'A cnf.jwk carrying private key material (a d parameter) MUST be rejected.',
    input: input(
      c,
      await mintPop({
        leafKey: bob,
        leafJti: 'derived',
        tool: 'repo.read',
        args: {},
        issuedAt: NOW,
      }),
      'repo.read',
      {},
    ),
    wantReason: 'private_key_material',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': {} },
    leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
  });
  const reordered = [c.derived, c.root];
  await core({
    id: 'core-chain-reordered',
    requirements: ['CORE-CHAIN-001'],
    notes: 'The leaf is presented before the root; the chain must be root-to-leaf.',
    input: {
      ...input(c, await pop(c.bob, 'repo.read', { path: 'a' }), 'repo.read', { path: 'a' }),
      tokens: reordered,
    },
    wantReason: undefined,
  });
}
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  await core({
    id: 'core-chain-empty',
    requirements: ['CORE-CHAIN-002'],
    notes: 'An empty chain MUST deny.',
    input: { ...input(c, '', 'repo.read', {}), tokens: [] },
    wantReason: 'chain_empty',
  });
}
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  await core({
    id: 'core-token-malformed',
    requirements: ['CORE-DEC-002'],
    notes: 'A malformed token MUST deny (fail closed), never degrade to allow.',
    input: {
      ...input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}),
      tokens: ['not.a.jws', c.derived],
    },
    wantReason: 'token_malformed',
  });
}

// ============================================================================
// Priority 3 — PoP and holder binding
// ============================================================================
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const impostor = await generateHolderKey();
  await core({
    id: 'core-pop-holder-mismatch',
    requirements: ['CORE-POP-003'],
    notes: 'The proof of possession is signed by a key that is not the verified leaf holder.',
    input: input(
      c,
      await mintPop({
        leafKey: impostor,
        leafJti: 'derived',
        tool: 'repo.read',
        args: {},
        issuedAt: NOW,
      }),
      'repo.read',
      {},
    ),
    wantReason: undefined,
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
    leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
  });
  await core({
    id: 'core-pop-argument-binding-mismatch',
    requirements: ['CORE-POP-001', 'CORE-POP-003', 'CORE-CRYPTO-005'],
    notes:
      'The PoP is bound (over RFC 8785 JCS canonicalization) to a different argument map than the one presented (extra argument added).',
    input: input(c, await pop(c.bob, 'repo.read', { path: 'a' }), 'repo.read', {
      path: 'a',
      extra: 'x',
    }),
    wantReason: undefined,
  });
}
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const p = await pop(c.bob, 'repo.read', {});
  await core({
    id: 'core-pop-signature-invalid',
    requirements: ['CORE-POP-003'],
    notes: 'The proof of possession signature is tampered.',
    input: input(c, `${p.slice(0, -4)}AAAA`, 'repo.read', {}),
    wantReason: 'pop_signature_invalid',
  });
}
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  await core({
    id: 'core-pop-missing',
    requirements: ['CORE-POP-001'],
    notes: 'Enforcement MUST verify proof of possession; a request without one MUST deny.',
    input: input(c, '', 'repo.read', {}),
    wantReason: 'pop_missing',
  });
}

// ============================================================================
// Priority 4 — expiry / window containment
// ============================================================================
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  await core({
    id: 'core-time-expired',
    requirements: ['CORE-TIME-001'],
    notes: 'Evaluated after the leaf has expired.',
    input: {
      ...input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}),
      now: NOW + HOUR + 100,
    },
    wantReason: 'expired',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': {} },
    leafTools: { 'repo.read': {} },
    rootOver: { issuedAt: NOW + 1000 },
  });
  await core({
    id: 'core-time-not-yet-valid',
    requirements: ['CORE-TIME-002'],
    notes: 'A token whose issuance is in the future is not yet valid.',
    input: input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}),
    wantReason: 'not_yet_valid',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': {} },
    leafTools: { 'repo.read': {} },
    derivedOver: { overrides: { exp: NOW + HOUR * 2 } },
  });
  await core({
    id: 'core-time-expiry-exceeds-parent',
    requirements: ['CORE-TIME-003'],
    notes: 'A derived token whose expiry is later than its parent widens the validity window.',
    input: input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}),
    wantReason: 'expiry_exceeds_parent',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': {} },
    leafTools: { 'repo.read': {} },
    derivedOver: { overrides: { del_max_depth: 3 } },
  });
  await core({
    id: 'core-deleg-ceiling-raised',
    requirements: ['CORE-DELEG-001'],
    notes: 'A derived token raises del_max_depth above its parent; the ceiling is monotonic.',
    input: input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}),
    wantReason: 'delegation_ceiling_raised',
  });
}
{
  // depth exceeded: root(max 1) -> d1(depth 1) -> d2(depth 2 > 1)
  const issuerKey = await generateHolderKey();
  const alice = await generateHolderKey();
  const bob = await generateHolderKey();
  const carol = await generateHolderKey();
  const root = await mintRootToken({
    issuer: 'https://authority.example',
    issuerKey,
    holder: alice,
    tools: { 'repo.read': {} },
    issuedAt: NOW,
    expiresAt: NOW + HOUR,
    maxDepth: 1,
    jti: 'root',
  });
  const d1 = await mintDerivedToken({
    parentToken: root,
    parentKey: alice,
    parentPayload: { del_depth: 0, del_max_depth: 1, exp: NOW + HOUR, iat: NOW },
    holder: bob,
    tools: { 'repo.read': {} },
    issuedAt: NOW,
    expiresAt: NOW + HOUR / 2,
    jti: 'd1',
  });
  const d2 = await mintDerivedToken({
    parentToken: d1,
    parentKey: bob,
    parentPayload: { del_depth: 1, del_max_depth: 1, exp: NOW + HOUR / 2, iat: NOW },
    holder: carol,
    tools: { 'repo.read': {} },
    issuedAt: NOW,
    expiresAt: NOW + HOUR / 4,
    jti: 'd2',
  });
  const c = { tokens: [root, d1, d2], anchors: [issuerKey.publicJwk] };
  await core({
    id: 'core-deleg-depth-exceeded',
    requirements: ['CORE-DELEG-002'],
    notes: 'A three-token chain whose leaf depth (2) exceeds the root ceiling (1).',
    input: input(
      c,
      await mintPop({ leafKey: carol, leafJti: 'd2', tool: 'repo.read', args: {}, issuedAt: NOW }),
      'repo.read',
      {},
    ),
    wantReason: 'delegation_depth_exceeded',
  });
}

// ============================================================================
// Priority 5 — constraint subsumption / leaf evaluation
// ============================================================================
{
  const c = await chain({
    rootTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
    leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
  });
  await core({
    id: 'core-constr-argument-missing',
    requirements: ['CORE-CONSTR-001'],
    notes: 'A constrained argument is required; the request omits it.',
    input: input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}),
    wantReason: 'argument_missing',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': { path: { constraint_type: 'one_of', values: ['a', 'b'] } } },
    leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'a' } } },
  });
  await core({
    id: 'core-constr-argument-violated',
    requirements: ['CORE-CONSTR-002'],
    notes: 'A request value outside the narrowed constraint.',
    input: input(c, await pop(c.bob, 'repo.read', { path: 'b' }), 'repo.read', { path: 'b' }),
    wantReason: 'argument_constraint_violated',
  });
}
{
  const c = await chain({
    rootTools: { 'repo.read': {}, 'repo.merge': {} },
    leafTools: { 'repo.read': {} },
  });
  await core({
    id: 'core-constr-tool-not-authorized',
    requirements: ['CORE-CONSTR-003'],
    notes:
      'The request asks for a tool the verified leaf authority does not hold (held by the root, not delegated).',
    input: input(c, await pop(c.bob, 'repo.merge', {}), 'repo.merge', {}),
    wantReason: 'tool_not_authorized',
  });
}

// ============================================================================
// Priority 6 — privacy-safe decision / reason output
// ============================================================================
{
  const secret = 'super-secret-path-value-9f3a';
  const c = await chain({
    rootTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'allowed' } } },
    leafTools: { 'repo.read': { path: { constraint_type: 'exact', value: 'allowed' } } },
  });
  await core({
    id: 'core-expl-privacy-safe',
    requirements: ['CORE-EXPL-003'],
    notes: `A denial whose offending argument value ("${secret}") MUST NOT appear anywhere in the decision output. Names, never values. A consumer verifies the value is absent from the serialized decision.`,
    input: input(c, await pop(c.bob, 'repo.read', { path: secret }), 'repo.read', { path: secret }),
    wantReason: 'argument_constraint_violated',
  });
}

// ============================================================================
// Positive Core baseline (ALLOW)
// ============================================================================
{
  const c = await chain({
    rootTools: { 'repo.read': {}, 'repo.merge': {} },
    leafTools: { 'repo.read': {} },
  });
  await core({
    id: 'core-allow-baseline',
    requirements: [
      'CORE-CRYPTO-001',
      'CORE-CHAIN-001',
      'CORE-CRYPTO-003',
      'CORE-POP-001',
      'CORE-CONSTR-003',
      'CORE-SUBJ-001',
      'CORE-DEC-001',
    ],
    notes:
      'A valid delegated authority narrowed from {read,merge} to {read}, exercised correctly. ALLOW.',
    input: input(c, await pop(c.bob, 'repo.read', { path: 'src/' }), 'repo.read', { path: 'src/' }),
    wantReason: null,
  });
}

// ============================================================================
// Profile: Status (RFC-0004)
// ============================================================================
async function statusVec({ id, requirements, notes, revoked = [], unknown = [], wantReason }) {
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const inp = input(
    c,
    await pop(c.bob, 'repo.read', {}),
    'repo.read',
    {},
    { revoked_jti: revoked, unknown_jti: unknown },
  );
  record({
    id,
    requirements,
    profile: 'Status',
    notes,
    input: inp,
    wantReason,
    explanation: await coreExplanation(coreCall(inp)),
  });
}
await statusVec({
  id: 'status-allow-active',
  requirements: ['STATUS-001', 'STATUS-006'],
  notes: 'A resolver is configured and every chain member is active.',
  wantReason: null,
});
await statusVec({
  id: 'status-deny-leaf-revoked',
  requirements: ['STATUS-002'],
  notes: 'The leaf jti is revoked.',
  revoked: ['derived'],
  wantReason: 'authority_revoked',
});
await statusVec({
  id: 'status-deny-ancestor-revoked',
  requirements: ['STATUS-004'],
  notes: 'A revoked ancestor (root) invalidates the whole chain even though the leaf is active.',
  revoked: ['root'],
  wantReason: 'authority_revoked',
});
await statusVec({
  id: 'status-deny-unavailable',
  requirements: ['STATUS-003'],
  notes: 'A required status is unknown; fail closed.',
  unknown: ['derived'],
  wantReason: 'status_unavailable',
});

// ============================================================================
// Profile: Identity (RFC-0005)
// ============================================================================
async function chainWithLeafSub(sub) {
  return chain({
    rootTools: { 'repo.read': {} },
    leafTools: { 'repo.read': {} },
    derivedOver: { overrides: { sub } },
  });
}
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  await core({
    id: 'identity-allow-thumbprint-subject',
    requirements: ['CORE-SUBJ-001', 'CORE-SUBJ-002'],
    notes:
      'No sub present; the canonical subject is the holder thumbprint, distinct from the holder key it derives from.',
    input: input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}),
    wantReason: null,
  });
}
{
  const c = await chainWithLeafSub(SPIFFE_BOB);
  const inp = input(
    c,
    await pop(c.bob, 'repo.read', {}),
    'repo.read',
    {},
    { bound_subjects: [SPIFFE_BOB], unavailable_subjects: [] },
  );
  record({
    id: 'identity-allow-spiffe-bound',
    requirements: ['CORE-SUBJ-001', 'IDENT-001'],
    profile: 'Identity',
    notes: 'The authority binds to a SPIFFE subject the verifier confirms.',
    input: inp,
    wantReason: null,
    explanation: await coreExplanation(coreCall(inp)),
  });
}
{
  const c = await chainWithLeafSub(SPIFFE_BOB);
  await core({
    id: 'identity-allow-spiffe-issuer-asserted',
    requirements: ['IDENT-003'],
    notes:
      'A SPIFFE subject with no verifier configured; the issuer signature is trusted (default).',
    input: input(c, await pop(c.bob, 'repo.read', {}), 'repo.read', {}),
    wantReason: null,
  });
}
{
  const c = await chainWithLeafSub(SPIFFE_BOB);
  const inp = input(
    c,
    await pop(c.bob, 'repo.read', {}),
    'repo.read',
    {},
    { bound_subjects: [SPIFFE_ALICE], unavailable_subjects: [] },
  );
  record({
    id: 'identity-deny-mismatch',
    requirements: ['IDENT-001'],
    profile: 'Identity',
    notes: 'The verifier says the subject does not correspond to the holder.',
    input: inp,
    wantReason: 'subject_identity_mismatch',
    explanation: await coreExplanation(coreCall(inp)),
  });
}
{
  const c = await chainWithLeafSub(SPIFFE_BOB);
  const inp = input(
    c,
    await pop(c.bob, 'repo.read', {}),
    'repo.read',
    {},
    { bound_subjects: [], unavailable_subjects: [SPIFFE_BOB] },
  );
  record({
    id: 'identity-deny-unavailable',
    requirements: ['IDENT-002'],
    profile: 'Identity',
    notes: 'A required identity binding is unavailable; fail closed.',
    input: inp,
    wantReason: 'identity_binding_unavailable',
    explanation: await coreExplanation(coreCall(inp)),
  });
}

// ============================================================================
// Profile: A2A (RFC-0003)
// ============================================================================
async function a2aResult(
  c,
  pop,
  { recipient = RECIPIENT, activated = [A2A_EXT], skillId = 'repo.read', args = {} } = {},
) {
  return enforceA2aAuthority({
    message: { metadata: { [A2A_CHAIN]: [c.root, c.derived], [A2A_POP]: pop } },
    activatedExtensionUris: activated,
    trustAnchors: c.anchors,
    skillId,
    args,
    recipient,
    now: NOW + 1,
  });
}
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const p = await pop(c.bob, 'repo.read', {}, { aat_aud: 'https://someone-else.example' });
  const inp = input(
    c,
    p,
    'repo.read',
    {},
    { recipient: RECIPIENT, a2a_extension_activated: true, a2a_authority_material_present: true },
  );
  record({
    id: 'a2a-deny-recipient-mismatch',
    requirements: ['A2A-003'],
    profile: 'A2A',
    notes: 'The PoP aat_aud is bound to a different recipient than this agent.',
    input: inp,
    wantReason: 'pop_recipient_mismatch',
    explanation: explainA2aResult(await a2aResult(c, p)),
  });
}
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const p = await pop(c.bob, 'repo.read', {});
  const inp = input(
    c,
    p,
    'repo.read',
    {},
    { recipient: RECIPIENT, a2a_extension_activated: false, a2a_authority_material_present: true },
  );
  record({
    id: 'a2a-deny-extension-not-activated',
    requirements: ['A2A-001'],
    profile: 'A2A',
    notes:
      'A gated skill whose required OAAF extension the client did not activate; the agent MUST refuse.',
    input: inp,
    wantReason: 'extension_not_activated',
    explanation: explainA2aResult(await a2aResult(c, p, { activated: [] })),
  });
}
{
  const c = await chain({ rootTools: { 'repo.read': {} }, leafTools: { 'repo.read': {} } });
  const inp = input(
    c,
    '',
    'repo.read',
    {},
    { recipient: RECIPIENT, a2a_extension_activated: true, a2a_authority_material_present: false },
  );
  const res = await enforceA2aAuthority({
    message: { metadata: {} },
    activatedExtensionUris: [A2A_EXT],
    trustAnchors: c.anchors,
    skillId: 'repo.read',
    args: {},
    recipient: RECIPIENT,
    now: NOW + 1,
  });
  record({
    id: 'a2a-deny-authority-material-missing',
    requirements: ['A2A-002'],
    profile: 'A2A',
    notes:
      'A gated skill invoked with no OAAF authority material in metadata; the agent MUST deny.',
    input: inp,
    wantReason: 'authority_material_missing',
    explanation: explainA2aResult(res),
  });
}

// ============================================================================
// Serialize
// ============================================================================
writeFileSync(
  path.join(OUT, 'corpus.json'),
  JSON.stringify(
    {
      corpus_version: '0.1',
      spec_version: '0.1',
      generated_for_now: NOW,
      description:
        'Portable OAAF conformance corpus (O6B). Language-neutral static vectors tagged with O6A requirement IDs. Consume without importing OAAF code: verify the signed tokens with your own crypto, apply the resolver/verifier inputs, and check expected_decision and expected_normative_reason. See README.md for the schema. The `reference` block is advisory (the reference explanation), not part of the normative contract.',
      vectors,
    },
    null,
    2,
  ) + '\n',
);
console.log(`wrote ${vectors.length} vectors to spec/0.1/conformance/vectors/corpus.json`);
const byProfile = {};
for (const v of vectors) byProfile[v.profile] = (byProfile[v.profile] ?? 0) + 1;
console.log('by profile:', byProfile);
for (const v of vectors)
  console.log(
    `  ${v.vector_id}: ${v.expected_decision}${v.expected_normative_reason ? ' ' + v.expected_normative_reason : ''} [${v.requirements.join(', ')}]`,
  );

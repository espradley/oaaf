/**
 * Chain verification for AAT -01.
 *
 * Implements the draft's verification algorithm. Every check produces a
 * specific denial rather than a bare boolean, so a caller can always say which
 * requirement failed.
 *
 * This module verifies the *chain*. It does not verify proof of possession and
 * therefore does not by itself constitute enforcement — see `pop.ts` and
 * RFC-0001.
 */

import { calculateJwkThumbprintUri, importJWK, compactVerify, decodeProtectedHeader } from 'jose';

import { decodeBase64Url, sha256Base64Url } from '../base64url.js';
import { denial, type Denial } from '../reasons.js';
import {
  extractToolGrants,
  type AatPayload,
  type ToolConstraints,
  AAT_DRAFT_REVISION,
} from './claims.js';
import { isConstraint, isPermittedPair, subsumes, type Constraint } from './constraints.js';

/** Limits. Deliberately conservative; the draft requires bounds, not these values. */
export const MAX_CHAIN_LENGTH = 16;
export const MAX_TOKEN_BYTES = 16 * 1024;
/** §4.4 recommends 30 seconds. */
export const MAX_IAT_SKEW_SECONDS = 30;
/** §4.4 recommends 90 days as an upper bound. */
export const MAX_TOKEN_LIFETIME_SECONDS = 90 * 24 * 3600;
export const MAX_DELEGATION_DEPTH = 8;
export const MAX_CONSTRAINT_DEPTH = 8;

/** Algorithms this build accepts. The draft mandates Ed25519 support. */
const PERMITTED_ALGORITHMS: ReadonlySet<string> = new Set(['EdDSA']);
const PERMITTED_EDDSA_CURVES: ReadonlySet<string> = new Set(['Ed25519', 'Ed448']);

/** A verified link in the chain. */
export interface VerifiedToken {
  payload: AatPayload;
  tools: Record<string, ToolConstraints>;
  /** JWK Thumbprint URI of this token's holder key. */
  holder: string;
}

/**
 * A verified delegation chain.
 *
 * Deliberately not raw decoded JWTs: callers that reinterpret partially
 * verified token internals get authority wrong. What is exposed here has
 * passed every chain-level check.
 */
export interface VerifiedDelegationChain {
  readonly aatRevision: typeof AAT_DRAFT_REVISION;
  /** Root-to-leaf. */
  readonly tokens: readonly VerifiedToken[];
  /** Authority the leaf actually holds, after all narrowing. */
  readonly leafTools: Record<string, ToolConstraints>;
  /** JWK Thumbprint URI of the leaf holder key. Subject identity per RFC-0001. */
  readonly leafHolder: string;
  /** Effective expiry — the leaf's, which the chain guarantees is the earliest. */
  readonly expiresAt: number;
  readonly depth: number;
}

export type ChainResult =
  { ok: true; chain: VerifiedDelegationChain } | { ok: false; denials: Denial[] };

export interface VerifyChainOptions {
  /**
   * Public keys trusted as root issuers.
   *
   * Required. A root token is a claim, not a trust root: without an anchor set
   * anyone can mint a self-signed root and the chain proves nothing. The draft
   * verifies the root "against a key in trust_anchors", and so does this.
   */
  trustAnchors: readonly Record<string, unknown>[];
  /** Seconds since epoch. Injectable so temporal behaviour is testable. */
  now?: number;
  maxChainLength?: number;
}

function fail(...denials: Denial[]): ChainResult {
  return { ok: false, denials };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * True when a JWK carries private key material.
 *
 * A `cnf` claim must convey a public key. A token embedding `d`, `p`, or `q`
 * has leaked a private key into a credential that is passed around by design.
 */
function containsPrivateKeyMaterial(jwk: Record<string, unknown>): boolean {
  return ['d', 'p', 'q', 'dp', 'dq', 'qi'].some((member) => member in jwk);
}

function isUri(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Nesting depth of a constraint tree, counting the outermost node as 1. */
function constraintDepth(value: unknown, seen = 0): number {
  if (seen > MAX_CONSTRAINT_DEPTH + 1) return seen;
  if (!isPlainObject(value)) return seen;
  const nested = value['constraints'];
  if (!Array.isArray(nested)) return seen + 1;
  return Math.max(...nested.map((child) => constraintDepth(child, seen + 1)), seen + 1);
}

/** Deepest constraint tree across every tool in a grant map. */
function exceedsConstraintDepth(tools: Record<string, ToolConstraints>): boolean {
  for (const constraints of Object.values(tools)) {
    for (const constraint of Object.values(constraints)) {
      if (constraintDepth(constraint) > MAX_CONSTRAINT_DEPTH) return true;
    }
  }
  return false;
}

/** Shape check. Does not trust anything; only decides whether checks can run. */
function looksLikeAatPayload(value: unknown): value is AatPayload {
  if (!isPlainObject(value)) return false;
  return (
    typeof value['jti'] === 'string' &&
    typeof value['iss'] === 'string' &&
    typeof value['iat'] === 'number' &&
    typeof value['exp'] === 'number' &&
    typeof value['del_depth'] === 'number' &&
    typeof value['del_max_depth'] === 'number' &&
    isPlainObject(value['cnf']) &&
    isPlainObject((value['cnf'] as Record<string, unknown>)['jwk']) &&
    Array.isArray(value['authorization_details'])
  );
}

/**
 * Verify a signature and return the payload.
 *
 * Rejects `alg: "none"` and any algorithm outside the permitted set, and
 * requires the key type to match the algorithm — the algorithm-confusion
 * defence the draft calls for.
 */
async function verifySignature(
  token: string,
  jwk: Record<string, unknown>,
): Promise<{ ok: true; payload: unknown } | { ok: false; denial: Denial }> {
  let header: { alg?: string };
  try {
    header = decodeProtectedHeader(token);
  } catch {
    return { ok: false, denial: denial('token_malformed', 'chain', 'Token header is not valid.') };
  }

  const alg = header.alg;
  if (typeof alg !== 'string' || !PERMITTED_ALGORITHMS.has(alg)) {
    return {
      ok: false,
      denial: denial(
        'algorithm_not_permitted',
        'chain',
        `Signature algorithm ${JSON.stringify(alg ?? null)} is not permitted; expected EdDSA.`,
      ),
    };
  }

  // Algorithm/key-type consistency: EdDSA verifies only against OKP Ed25519/Ed448.
  if (jwk['kty'] !== 'OKP' || !PERMITTED_EDDSA_CURVES.has(String(jwk['crv']))) {
    return {
      ok: false,
      denial: denial(
        'algorithm_not_permitted',
        'chain',
        'EdDSA requires an OKP key with an Ed25519 or Ed448 curve.',
      ),
    };
  }

  try {
    const key = await importJWK(jwk, alg);
    const { payload } = await compactVerify(token, key);
    return { ok: true, payload: JSON.parse(new TextDecoder().decode(payload)) as unknown };
  } catch {
    return {
      ok: false,
      denial: denial('invalid_signature', 'chain', 'Signature verification failed.'),
    };
  }
}

/** base64url-nopad SHA-256 of a token's JWS signing input (header.payload). */
async function parentHash(token: string): Promise<string> {
  return sha256Base64Url(token.slice(0, token.lastIndexOf('.')));
}

/**
 * Verify that a child's tool grants narrow its parent's.
 *
 * Omission narrows: a tool or argument the child leaves out becomes
 * unreachable, because the leaf check runs closed-world. Addition widens and is
 * refused.
 */
function verifyNarrowing(
  parentTools: Record<string, ToolConstraints>,
  childTools: Record<string, ToolConstraints>,
  tokenIndex: number,
): Denial[] {
  const denials: Denial[] = [];

  for (const [tool, childConstraints] of Object.entries(childTools)) {
    const parentConstraints = parentTools[tool];
    if (parentConstraints === undefined) {
      denials.push(
        denial('tool_not_delegated', 'chain', `Tool "${tool}" was not granted by the parent.`, {
          tokenIndex,
          tool,
        }),
      );
      continue;
    }

    // §4.5 / step 4p2-4p3: when the parent constrains a tool, closed-world
    // semantics make the key set the invocation shape. Adding a key produces
    // invocations the parent would reject as unknown; dropping one produces
    // invocations omitting a parent-required argument. Either way the derived
    // invocation set is disjoint from the parent's, not a subset — so the key
    // sets must match exactly. An open-world parent (empty map) may be
    // narrowed to any key set.
    const parentKeys = Object.keys(parentConstraints);
    const parentUnconstrained = parentKeys.length === 0;

    if (!parentUnconstrained) {
      const childKeys = Object.keys(childConstraints);
      const sameKeySet =
        childKeys.length === parentKeys.length && parentKeys.every((k) => k in childConstraints);
      if (!sameKeySet) {
        denials.push(
          denial(
            'argument_key_set_mismatch',
            'chain',
            `Constraint map for tool "${tool}" must name exactly the same arguments as the parent.`,
            { tokenIndex, tool },
          ),
        );
        continue;
      }
    }

    for (const [argument, childConstraint] of Object.entries(childConstraints)) {
      if (!isConstraint(childConstraint)) {
        denials.push(
          denial(
            'constraint_type_unrecognized',
            'chain',
            `Constraint for "${tool}.${argument}" is malformed or of an unknown type.`,
            { tokenIndex, tool, argument },
          ),
        );
        continue;
      }

      if (parentUnconstrained) continue;

      const parentConstraint = parentConstraints[argument];
      // Unreachable after the key-set check above; retained so a future change
      // to that check cannot silently skip subsumption.
      if (parentConstraint === undefined) continue;

      if (!isConstraint(parentConstraint)) {
        denials.push(
          denial(
            'constraint_type_unrecognized',
            'chain',
            `Parent constraint for "${tool}.${argument}" is malformed or of an unknown type.`,
            { tokenIndex, tool, argument },
          ),
        );
        continue;
      }

      if (!isPermittedPair(parentConstraint.constraint_type, childConstraint.constraint_type)) {
        denials.push(
          denial(
            'constraint_type_not_permitted',
            'chain',
            `Narrowing "${tool}.${argument}" from ${parentConstraint.constraint_type} to ${childConstraint.constraint_type} is not a permitted pair in AAT -${AAT_DRAFT_REVISION}.`,
            { tokenIndex, tool, argument },
          ),
        );
        continue;
      }

      if (!subsumes(parentConstraint as Constraint, childConstraint)) {
        denials.push(
          denial(
            'constraint_expansion',
            'chain',
            `Constraint on "${tool}.${argument}" is broader than the parent permits.`,
            { tokenIndex, tool, argument },
          ),
        );
      }
    }
  }

  return denials;
}

/**
 * Verify a delegation chain, root first.
 *
 * **This is not enforcement.** It performs no proof-of-possession check and
 * makes no authorization decision. Use it for inspection, testing, and
 * conformance work; use `verifyAuthority` to enforce.
 */
export async function verifyDelegationChain(
  tokens: readonly string[],
  options: VerifyChainOptions,
): Promise<ChainResult> {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const maxLength = options.maxChainLength ?? MAX_CHAIN_LENGTH;

  if (tokens.length === 0) {
    return fail(denial('chain_empty', 'chain', 'No tokens were presented.'));
  }
  if (tokens.length > maxLength) {
    return fail(
      denial(
        'chain_too_long',
        'chain',
        `Chain of ${tokens.length} exceeds the limit of ${maxLength}.`,
      ),
    );
  }

  for (const [index, token] of tokens.entries()) {
    if (typeof token !== 'string' || token.length > MAX_TOKEN_BYTES) {
      return fail(
        denial('token_too_large', 'chain', 'Token exceeds the permitted size.', {
          tokenIndex: index,
        }),
      );
    }
  }

  // Step 2: detect token-instance cycles before any signature work, as the
  // draft's ordering requires. Payloads are read unverified here purely to
  // collect `jti`; nothing else is trusted from them.
  const seenJti = new Set<string>();
  for (const [index, token] of tokens.entries()) {
    const jti = peekJti(token);
    if (jti === null) {
      return fail(
        denial('token_malformed', 'chain', 'Token is not a valid compact JWS.', {
          tokenIndex: index,
        }),
      );
    }
    if (seenJti.has(jti)) {
      return fail(
        denial('chain_cycle_detected', 'chain', 'A token instance repeats in the chain.', {
          tokenIndex: index,
        }),
      );
    }
    seenJti.add(jti);
  }

  const verified: VerifiedToken[] = [];

  // --- Root ---------------------------------------------------------------
  const rootToken = tokens[0] as string;
  let rootPayloadRaw: unknown;
  try {
    const parts = rootToken.split('.');
    if (parts.length !== 3) throw new Error('not a compact JWS');
    const decoded = decodeBase64Url(parts[1] as string);
    if (decoded === null) throw new Error('payload is not base64url');
    rootPayloadRaw = JSON.parse(new TextDecoder().decode(decoded)) as unknown;
  } catch {
    return fail(
      denial('token_malformed', 'chain', 'Root token is not a valid compact JWS.', {
        tokenIndex: 0,
      }),
    );
  }

  if (!looksLikeAatPayload(rootPayloadRaw)) {
    return fail(
      denial('token_malformed', 'chain', 'Root token is missing required claims.', {
        tokenIndex: 0,
      }),
    );
  }

  // Step 3b: the root signature is verified against a configured trust anchor.
  // Verifying it against its own `cnf.jwk` would accept any self-signed root
  // and the chain would prove nothing about who granted the authority.
  if (options.trustAnchors.length === 0) {
    return fail(
      denial('untrusted_root', 'chain', 'No trust anchors were configured.', { tokenIndex: 0 }),
    );
  }

  let rootVerified = false;
  let lastAnchorDenial: Denial | null = null;
  for (const anchor of options.trustAnchors) {
    const attempt = await verifySignature(rootToken, anchor);
    if (attempt.ok) {
      rootVerified = true;
      break;
    }
    lastAnchorDenial = attempt.denial;
  }
  if (!rootVerified) {
    return fail(
      lastAnchorDenial?.code === 'algorithm_not_permitted'
        ? { ...lastAnchorDenial, tokenIndex: 0 }
        : denial(
            'untrusted_root',
            'chain',
            'Root token is not signed by any configured trust anchor.',
            { tokenIndex: 0 },
          ),
    );
  }

  const root = rootPayloadRaw;

  if (containsPrivateKeyMaterial(root.cnf.jwk)) {
    return fail(
      denial('private_key_material', 'chain', 'Token cnf.jwk contains private key material.', {
        tokenIndex: 0,
      }),
    );
  }
  if (root.jti.length === 0) {
    return fail(
      denial('token_malformed', 'chain', 'Root jti must be non-empty.', { tokenIndex: 0 }),
    );
  }
  if (!isUri(root.iss)) {
    return fail(denial('token_malformed', 'chain', 'Root iss must be a URI.', { tokenIndex: 0 }));
  }
  if (!Number.isInteger(root.del_max_depth) || root.del_max_depth < 0) {
    return fail(
      denial(
        'delegation_ceiling_invalid',
        'chain',
        'Root del_max_depth must be a non-negative integer.',
        {
          tokenIndex: 0,
        },
      ),
    );
  }
  if (root.del_max_depth > MAX_DELEGATION_DEPTH) {
    return fail(
      denial(
        'delegation_ceiling_invalid',
        'chain',
        `Root del_max_depth exceeds the implementation limit of ${MAX_DELEGATION_DEPTH}.`,
        { tokenIndex: 0 },
      ),
    );
  }

  if (root.del_depth !== 0) {
    return fail(
      denial('root_depth_invalid', 'chain', 'Root token must have del_depth 0.', { tokenIndex: 0 }),
    );
  }
  if (root.par_hash !== undefined) {
    return fail(
      denial('par_hash_present_on_root', 'chain', 'Root token must not carry par_hash.', {
        tokenIndex: 0,
      }),
    );
  }

  const rootTemporal = checkTemporal(root, now, 0);
  if (rootTemporal.length > 0) return { ok: false, denials: rootTemporal };

  if (root.exp <= root.iat) {
    return fail(
      denial('expiry_not_after_issuance', 'chain', 'Root exp must be after iat.', {
        tokenIndex: 0,
      }),
    );
  }
  if (root.exp > root.iat + MAX_TOKEN_LIFETIME_SECONDS) {
    return fail(
      denial('lifetime_exceeded', 'chain', 'Root token lifetime exceeds the permitted maximum.', {
        tokenIndex: 0,
      }),
    );
  }

  const rootTools = extractToolGrants(root);
  if (rootTools === null) {
    return fail(
      denial(
        'authorization_details_invalid',
        'chain',
        'Root token must carry exactly one attenuating_agent_token entry with a tools map.',
        { tokenIndex: 0 },
      ),
    );
  }

  if (exceedsConstraintDepth(rootTools)) {
    return fail(
      denial(
        'constraint_too_deep',
        'chain',
        'A constraint tree exceeds the permitted nesting depth.',
        {
          tokenIndex: 0,
        },
      ),
    );
  }

  verified.push({
    payload: root,
    tools: rootTools,
    holder: await calculateJwkThumbprintUri(
      root.cnf.jwk as Parameters<typeof calculateJwkThumbprintUri>[0],
    ),
  });

  // --- Derived tokens -----------------------------------------------------
  for (let index = 1; index < tokens.length; index += 1) {
    const childToken = tokens[index] as string;
    const parent = verified[index - 1] as VerifiedToken;

    const childVerification = await verifySignature(childToken, parent.payload.cnf.jwk);
    if (!childVerification.ok) {
      return fail({ ...childVerification.denial, tokenIndex: index });
    }

    const childRaw = childVerification.payload;
    if (!looksLikeAatPayload(childRaw)) {
      return fail(
        denial('token_malformed', 'chain', 'Derived token is missing required claims.', {
          tokenIndex: index,
        }),
      );
    }
    const child = childRaw;

    if (containsPrivateKeyMaterial(child.cnf.jwk)) {
      return fail(
        denial('private_key_material', 'chain', 'Token cnf.jwk contains private key material.', {
          tokenIndex: index,
        }),
      );
    }
    if (child.jti.length === 0) {
      return fail(
        denial('token_malformed', 'chain', 'Token jti must be non-empty.', { tokenIndex: index }),
      );
    }
    if (!Number.isInteger(child.del_depth) || !Number.isInteger(child.del_max_depth)) {
      return fail(
        denial('token_malformed', 'chain', 'Depth claims must be integers.', { tokenIndex: index }),
      );
    }

    if (child.iss !== parent.holder) {
      return fail(
        denial(
          'issuer_thumbprint_mismatch',
          'chain',
          "Derived token issuer does not match the parent holder key's thumbprint URI.",
          { tokenIndex: index },
        ),
      );
    }

    if (child.par_hash === undefined) {
      return fail(
        denial('par_hash_missing', 'chain', 'Derived token must carry par_hash.', {
          tokenIndex: index,
        }),
      );
    }
    const expectedHash = await parentHash(tokens[index - 1] as string);
    if (child.par_hash !== expectedHash) {
      return fail(
        denial('par_hash_mismatch', 'chain', 'par_hash does not bind to the presented parent.', {
          tokenIndex: index,
        }),
      );
    }

    if (child.del_depth !== parent.payload.del_depth + 1) {
      return fail(
        denial('delegation_depth_invalid', 'chain', 'del_depth must increment by exactly one.', {
          tokenIndex: index,
        }),
      );
    }
    if (child.del_depth > parent.payload.del_max_depth) {
      return fail(
        denial(
          'delegation_depth_exceeded',
          'chain',
          'del_depth exceeds the maximum the parent permits.',
          { tokenIndex: index },
        ),
      );
    }

    // Step 4f.
    if (child.del_depth > MAX_DELEGATION_DEPTH) {
      return fail(
        denial(
          'delegation_depth_exceeded',
          'chain',
          `del_depth exceeds the implementation limit of ${MAX_DELEGATION_DEPTH}.`,
          { tokenIndex: index },
        ),
      );
    }

    // Step 4m.
    if (child.del_depth > child.del_max_depth) {
      return fail(
        denial(
          'depth_exceeds_own_ceiling',
          'chain',
          'del_depth exceeds the token own del_max_depth.',
          {
            tokenIndex: index,
          },
        ),
      );
    }

    // Step 4g: delegation ceilings are monotonic, so a delegate cannot raise
    // the bound its issuer set.
    if (child.del_max_depth > parent.payload.del_max_depth) {
      return fail(
        denial(
          'delegation_ceiling_raised',
          'chain',
          'Derived token raises del_max_depth above the value its parent permits.',
          { tokenIndex: index },
        ),
      );
    }

    const temporal = checkTemporal(child, now, index);
    if (temporal.length > 0) return { ok: false, denials: temporal };

    if (child.exp > parent.payload.exp) {
      return fail(
        denial('expiry_exceeds_parent', 'chain', 'Derived token outlives its parent.', {
          tokenIndex: index,
        }),
      );
    }
    if (child.exp <= child.iat) {
      return fail(
        denial('expiry_not_after_issuance', 'chain', 'Token exp must be after iat.', {
          tokenIndex: index,
        }),
      );
    }
    if (child.iat < parent.payload.iat) {
      return fail(
        denial('issued_before_parent', 'chain', 'Derived token was issued before its parent.', {
          tokenIndex: index,
        }),
      );
    }

    const childTools = extractToolGrants(child);
    if (childTools === null) {
      return fail(
        denial(
          'authorization_details_invalid',
          'chain',
          'Derived token must carry exactly one attenuating_agent_token entry with a tools map.',
          { tokenIndex: index },
        ),
      );
    }

    if (exceedsConstraintDepth(childTools)) {
      return fail(
        denial(
          'constraint_too_deep',
          'chain',
          'A constraint tree exceeds the permitted nesting depth.',
          {
            tokenIndex: index,
          },
        ),
      );
    }

    const narrowing = verifyNarrowing(parent.tools, childTools, index);
    if (narrowing.length > 0) return { ok: false, denials: narrowing };

    verified.push({
      payload: child,
      tools: childTools,
      holder: await calculateJwkThumbprintUri(
        child.cnf.jwk as Parameters<typeof calculateJwkThumbprintUri>[0],
      ),
    });
  }

  const leaf = verified[verified.length - 1] as VerifiedToken;

  // Step 5, defence in depth: a mismatch means the chain was assembled wrongly.
  if (verified.length !== leaf.payload.del_depth + 1) {
    return fail(
      denial(
        'chain_length_mismatch',
        'chain',
        'Chain length does not match the leaf delegation depth.',
        { tokenIndex: verified.length - 1 },
      ),
    );
  }

  return {
    ok: true,
    chain: {
      aatRevision: AAT_DRAFT_REVISION,
      tokens: verified,
      leafTools: leaf.tools,
      leafHolder: leaf.holder,
      expiresAt: leaf.payload.exp,
      depth: leaf.payload.del_depth,
    },
  };
}

/**
 * Read `jti` from an unverified token, for cycle detection only.
 *
 * Nothing else may be trusted from this: the signature has not been checked.
 */
function peekJti(token: string): string | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const decoded = decodeBase64Url(parts[1] as string);
  if (decoded === null) return null;
  try {
    const payload: unknown = JSON.parse(new TextDecoder().decode(decoded));
    if (typeof payload !== 'object' || payload === null) return null;
    const jti = (payload as { jti?: unknown }).jti;
    return typeof jti === 'string' ? jti : null;
  } catch {
    return null;
  }
}

function checkTemporal(payload: AatPayload, now: number, tokenIndex: number): Denial[] {
  const denials: Denial[] = [];
  if (payload.exp <= now) {
    denials.push(denial('expired', 'chain', 'Token has expired.', { tokenIndex }));
  }
  if (payload.iat > now + MAX_IAT_SKEW_SECONDS) {
    denials.push(
      denial('not_yet_valid', 'chain', 'Token was issued too far in the future.', { tokenIndex }),
    );
  }
  return denials;
}

/**
 * Proof-of-possession verification for AAT -01.
 *
 * PoP binds a presentation to the leaf holder's private key and to the exact
 * argument map of one invocation. Without it, a chain is only evidence that
 * authority was issued — not that the presenter holds it.
 */

import canonicalize from 'canonicalize';
import { compactVerify, decodeProtectedHeader, importJWK } from 'jose';

import { denial, type Denial } from '../reasons.js';
import type { PopPayload, ToolArguments } from './claims.js';
import type { VerifiedDelegationChain } from './verify.js';

const PERMITTED_ALGORITHMS: ReadonlySet<string> = new Set(['EdDSA']);

/** Clock tolerance for a proof of possession, in seconds. */
export const POP_FRESHNESS_SECONDS = 300;

export type PopResult = { ok: true } | { ok: false; denials: Denial[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function looksLikePopPayload(value: unknown): value is PopPayload {
  if (!isPlainObject(value)) return false;
  return (
    typeof value['jti'] === 'string' &&
    typeof value['iat'] === 'number' &&
    typeof value['aat_id'] === 'string' &&
    typeof value['aat_tool'] === 'string' &&
    isPlainObject(value['hta'])
  );
}

/**
 * Verify a PoP JWT against a verified chain, a tool, and an argument map.
 *
 * Argument binding is compared as JCS-canonical bytes, so key order and
 * insignificant formatting differences do not matter while any change of value
 * does.
 */
export async function verifyProofOfPossession(
  pop: string,
  chain: VerifiedDelegationChain,
  tool: string,
  args: ToolArguments,
  now: number = Math.floor(Date.now() / 1000),
): Promise<PopResult> {
  if (typeof pop !== 'string' || pop.length === 0) {
    return {
      ok: false,
      denials: [denial('pop_missing', 'pop', 'No proof of possession was presented.')],
    };
  }

  let header: { alg?: string };
  try {
    header = decodeProtectedHeader(pop);
  } catch {
    return {
      ok: false,
      denials: [denial('pop_malformed', 'pop', 'Proof-of-possession header is not valid.')],
    };
  }

  const alg = header.alg;
  if (typeof alg !== 'string' || !PERMITTED_ALGORITHMS.has(alg)) {
    return {
      ok: false,
      denials: [
        denial(
          'algorithm_not_permitted',
          'pop',
          `Proof-of-possession algorithm ${JSON.stringify(alg ?? null)} is not permitted; expected EdDSA.`,
        ),
      ],
    };
  }

  const leaf = chain.tokens[chain.tokens.length - 1];
  if (leaf === undefined) {
    return { ok: false, denials: [denial('chain_empty', 'pop', 'Chain has no leaf token.')] };
  }

  const jwk = leaf.payload.cnf.jwk;
  if (jwk['kty'] !== 'OKP') {
    return {
      ok: false,
      denials: [denial('holder_key_invalid', 'pop', 'Leaf holder key is not an OKP key.')],
    };
  }

  let payload: unknown;
  try {
    const key = await importJWK(jwk, alg);
    const verified = await compactVerify(pop, key);
    payload = JSON.parse(new TextDecoder().decode(verified.payload)) as unknown;
  } catch {
    return {
      ok: false,
      denials: [
        denial(
          'pop_signature_invalid',
          'pop',
          'Proof of possession is not signed by the leaf holder key.',
        ),
      ],
    };
  }

  if (!looksLikePopPayload(payload)) {
    return {
      ok: false,
      denials: [denial('pop_malformed', 'pop', 'Proof of possession is missing required claims.')],
    };
  }

  const denials: Denial[] = [];

  if (payload.aat_id !== leaf.payload.jti) {
    denials.push(
      denial('pop_token_mismatch', 'pop', 'Proof of possession names a different leaf token.'),
    );
  }
  if (payload.aat_tool !== tool) {
    denials.push(
      denial('pop_tool_mismatch', 'pop', 'Proof of possession names a different tool.', { tool }),
    );
  }
  // Step 7g: a proof is bound to one invocation, so an old one must not be
  // replayable indefinitely.
  if (Math.abs(payload.iat - now) > POP_FRESHNESS_SECONDS) {
    denials.push(
      denial('pop_stale', 'pop', 'Proof of possession is outside the freshness window.'),
    );
  }

  if (canonicalize(payload.hta) !== canonicalize(args)) {
    denials.push(
      denial(
        'pop_binding_mismatch',
        'pop',
        'Proof of possession is bound to a different argument map.',
        { tool },
      ),
    );
  }

  return denials.length > 0 ? { ok: false, denials } : { ok: true };
}

/**
 * Denial reason codes.
 *
 * AAT -01 specifies a uniform DENY and defines no error codes, so these are
 * OAAF's. Each corresponds to exactly one normative check, which keeps the
 * vocabulary traceable to a requirement instead of accumulating over time.
 *
 * Codes are stable identifiers: adding one is a minor change, renaming or
 * removing one is breaking.
 *
 * Reasons say why the presented authority was insufficient. They MUST NOT
 * carry key material, raw token bytes, or values the caller did not supply.
 */

export const REASON_CODES = [
  // Structure
  'chain_empty',
  'chain_too_long',
  'chain_cycle_detected',
  'token_malformed',
  'token_too_large',
  'authorization_details_invalid',
  'par_hash_present_on_root',
  'par_hash_missing',

  // Cryptography
  'invalid_signature',
  'algorithm_not_permitted',
  'untrusted_root',
  'private_key_material',
  'issuer_thumbprint_mismatch',
  'par_hash_mismatch',
  'holder_key_invalid',

  // Temporal
  'expired',
  'not_yet_valid',
  'expiry_exceeds_parent',
  'issued_before_parent',
  'expiry_not_after_issuance',
  'lifetime_exceeded',

  // Delegation
  'delegation_depth_invalid',
  'delegation_depth_exceeded',
  'delegation_ceiling_raised',
  'delegation_ceiling_invalid',
  'depth_exceeds_own_ceiling',
  'chain_length_mismatch',
  'root_depth_invalid',

  // Narrowing
  'tool_not_delegated',
  'constraint_expansion',
  'constraint_type_unrecognized',
  'constraint_type_not_permitted',
  'argument_key_set_mismatch',
  'constraint_too_deep',

  // Leaf and request
  'tool_not_authorized',
  'argument_not_permitted',
  'argument_missing',
  'argument_constraint_violated',

  // Proof of possession
  'pop_missing',
  'pop_malformed',
  'pop_signature_invalid',
  'pop_token_mismatch',
  'pop_tool_mismatch',
  'pop_binding_mismatch',
  'pop_stale',
  'pop_recipient_mismatch',

  // A2A binding (RFC-0003)
  'extension_not_activated',
  'authority_material_missing',
  'caller_holder_mismatch',
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

/** Stage of verification that produced a denial. */
export type VerificationStage = 'chain' | 'leaf' | 'pop' | 'evaluation' | 'a2a';

/** A single denial, tied to the check that produced it. */
export interface Denial {
  code: ReasonCode;
  stage: VerificationStage;
  /** Human-readable, safe to log and to show a developer. */
  message: string;
  /** Zero-based index into the presented chain, where a token is implicated. */
  tokenIndex?: number;
  /** Tool the denial concerns, where applicable. */
  tool?: string;
  /** Argument name the denial concerns, where applicable. */
  argument?: string;
}

export function denial(
  code: ReasonCode,
  stage: VerificationStage,
  message: string,
  detail: Omit<Denial, 'code' | 'stage' | 'message'> = {},
): Denial {
  return { code, stage, message, ...detail };
}

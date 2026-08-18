/**
 * OAAF authority enforcement over A2A — RFC-0003.
 *
 * A2A §7.6.4 leaves the scope, representation, and validity of an authorization
 * decision to "an A2A extension," and requires the check "before the operation
 * is performed." This is that extension's enforcement: a precondition an A2A
 * agent runs on an incoming Message before it does consequential work.
 *
 * It reuses the O2 core wholesale — `verifyAuthority` then `evaluate`. There is
 * no second verifier and no A2A-specific authority model. What is A2A-specific
 * is only: extraction from `Message.metadata`, the required-extension and
 * recipient checks, and shaping a denial as an A2A error rather than a decision.
 */

import type { ToolArguments } from '../aat/claims.js';
import { decodeBase64Url } from '../base64url.js';
import type { StatusResolver } from '../status.js';
import type { IdentityBindingVerifier } from '../identity.js';
import { evaluate, verifyAuthority, type VerifiedAuthority } from '../decide.js';
import { denial, type Denial } from '../reasons.js';
import {
  explainDecision,
  explainReasons,
  type DecisionExplanation,
  type ReasonExplanation,
} from '../explanation.js';
import {
  extractChain,
  extractPop,
  isExtensionActivated,
  OAAF_A2A_EXTENSION_URI,
  type A2aMessage,
} from './extension.js';

/**
 * A2A error code for a required extension the client did not activate.
 *
 * A2A defines `ExtensionSupportRequiredError`; this is its JSON-RPC code
 * (A2A §3.3.2 error mapping). The binding uses A2A's own error rather than
 * inventing one.
 */
export const A2A_EXTENSION_SUPPORT_REQUIRED = -32007;

/** A2A error code for an authorization denial (maps to a task rejection). */
export const A2A_AUTHORIZATION_DENIED = -32001;

/** An error shaped for an A2A error response / task rejection. */
export interface A2aAuthorityError {
  code: number;
  message: string;
  data: { reasons: ReasonExplanation[] };
}

function toA2aError(code: number, denials: readonly Denial[]): A2aAuthorityError {
  const primary = denials[0];
  return {
    code,
    message: primary === undefined ? 'Authorization denied.' : primary.message,
    // Full locator fields preserved via the shared explanation model (O4A).
    data: { reasons: explainReasons(denials) },
  };
}

export interface A2aAuthorityInput {
  /** The incoming A2A Message. Authority material is read from its metadata. */
  message: A2aMessage;
  /** URIs the client activated via the `A2A-Extensions` header, already parsed. */
  activatedExtensionUris: readonly string[];
  /** Public keys trusted as root issuers. Required (ADR-0004). */
  trustAnchors: readonly Record<string, unknown>[];
  /** The invoked A2A skill id — becomes the AAT `tool` (RFC-0003 operation mapping). */
  skillId: string;
  /** The skill's caller-supplied arguments — become the AAT `args`. */
  args?: ToolArguments;
  /**
   * This agent's stable A2A identity. When the PoP carries `aat_aud`, it must
   * equal this; a mismatch is denied (recipient binding, RFC-0003).
   */
  recipient: string;
  /**
   * Require the PoP to carry a matching `aat_aud`. Deployment policy: when true,
   * a PoP without `aat_aud` is denied. Default false — mismatch is still denied
   * whenever `aat_aud` is present.
   */
  requireRecipientBinding?: boolean;
  now?: number;
  /** Revocation/status resolver (RFC-0004); transport-neutral, same as the core. */
  statusResolver?: StatusResolver;
  allowUnknownStatus?: boolean;
  /** External subject identity-binding verifier (RFC-0005); transport-neutral. */
  identityBindingVerifier?: IdentityBindingVerifier;
  allowUnknownIdentity?: boolean;
}

export type A2aAuthorityResult =
  { ok: true; authority: VerifiedAuthority } | { ok: false; error: A2aAuthorityError };

/**
 * Enforce OAAF delegated authority on an incoming A2A message.
 *
 * On success the caller proceeds to normal A2A task processing. On failure the
 * caller MUST NOT perform the operation and returns the A2A error / rejects the
 * task. The verification order follows RFC-0003.
 */
export async function enforceA2aAuthority(input: A2aAuthorityInput): Promise<A2aAuthorityResult> {
  // 1. Required-extension activation. A2A's own error; the operation is refused.
  if (!isExtensionActivated(input.activatedExtensionUris)) {
    return {
      ok: false,
      error: toA2aError(A2A_EXTENSION_SUPPORT_REQUIRED, [
        denial(
          'extension_not_activated',
          'a2a',
          `The ${OAAF_A2A_EXTENSION_URI} extension is required for this skill and was not activated.`,
        ),
      ]),
    };
  }

  // 2. Extract authority material from metadata.
  const tokens = extractChain(input.message);
  const pop = extractPop(input.message);
  if (tokens === null || pop === null) {
    return {
      ok: false,
      error: toA2aError(A2A_AUTHORIZATION_DENIED, [
        denial(
          'authority_material_missing',
          'a2a',
          'The request did not carry a valid OAAF authority chain and proof of possession in metadata.',
        ),
      ]),
    };
  }

  const args = input.args ?? {};

  // 3. O2 core: verify the chain + proof of possession.
  const verification = await verifyAuthority({
    tokens,
    trustAnchors: input.trustAnchors,
    pop,
    tool: input.skillId,
    args,
    ...(input.now === undefined ? {} : { now: input.now }),
    ...(input.statusResolver === undefined ? {} : { statusResolver: input.statusResolver }),
    ...(input.allowUnknownStatus === undefined
      ? {}
      : { allowUnknownStatus: input.allowUnknownStatus }),
    ...(input.identityBindingVerifier === undefined
      ? {}
      : { identityBindingVerifier: input.identityBindingVerifier }),
    ...(input.allowUnknownIdentity === undefined
      ? {}
      : { allowUnknownIdentity: input.allowUnknownIdentity }),
  });
  if (!verification.ok) {
    return { ok: false, error: toA2aError(A2A_AUTHORIZATION_DENIED, verification.denials) };
  }

  // 4. Recipient binding (RFC-0003). Enforced here because `aat_aud` is a
  //    transport-audience concern the generic core does not evaluate.
  const recipientDenial = checkRecipient(
    pop,
    input.recipient,
    input.requireRecipientBinding ?? false,
  );
  if (recipientDenial !== null) {
    return { ok: false, error: toA2aError(A2A_AUTHORIZATION_DENIED, [recipientDenial]) };
  }

  // 5. Evaluate the requested skill + arguments against the verified authority.
  const decision = evaluate(verification.authority);
  if (!decision.allowed) {
    return { ok: false, error: toA2aError(A2A_AUTHORIZATION_DENIED, decision.denials) };
  }

  return { ok: true, authority: verification.authority };
}

/**
 * Read the PoP's `aat_aud` and compare to the expected recipient.
 *
 * The PoP has already been cryptographically verified by `verifyAuthority`, so
 * reading its claim here is reading verified material. Returns a denial or null.
 */
function checkRecipient(pop: string, recipient: string, required: boolean): Denial | null {
  const claim = readPopAudience(pop);
  if (claim === undefined) {
    return required
      ? denial(
          'pop_recipient_mismatch',
          'a2a',
          'Recipient binding is required but the proof of possession carries no aat_aud.',
        )
      : null;
  }
  if (claim !== recipient) {
    return denial(
      'pop_recipient_mismatch',
      'a2a',
      'The proof of possession is bound to a different recipient than this agent.',
    );
  }
  return null;
}

/** Read `aat_aud` from a compact-JWS PoP payload. Undefined if absent/unreadable. */
function readPopAudience(pop: string): string | undefined {
  const parts = pop.split('.');
  if (parts.length !== 3) return undefined;
  const decoded = decodeBase64Url(parts[1] as string);
  if (decoded === null) return undefined;
  try {
    const payload = JSON.parse(new TextDecoder().decode(decoded)) as { aat_aud?: unknown };
    return typeof payload.aat_aud === 'string' ? payload.aat_aud : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The canonical, transport-neutral {@link DecisionExplanation} for an A2A
 * authority result (O4B).
 *
 * Strips the A2A error envelope — the numeric `code` and transport-level
 * `message` — leaving only OAAF's explanation, so it is directly comparable to
 * `explainMcpResult` for the same authority input.
 */
export function explainA2aResult(result: A2aAuthorityResult): DecisionExplanation {
  if (result.ok) return explainDecision(true, [], result.authority);
  return { decision: 'DENY', reasons: result.error.data.reasons };
}

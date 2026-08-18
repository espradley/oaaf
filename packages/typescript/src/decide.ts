/**
 * Enforcement: verify presented authority, then decide.
 *
 * Two entry points, deliberately shaped so the weaker one cannot be mistaken
 * for the stronger:
 *
 *   verifyAuthority()  full AAT verification including proof of possession
 *   evaluate()         decide, given already-verified authority
 *
 * There is no option to skip proof of possession while still producing a
 * decision. A verifier that can be configured to skip it will eventually be
 * configured that way in production, and would then advertise conformance it
 * does not have. For inspection and conformance work that genuinely needs the
 * chain alone, `verifyDelegationChain` is exported under a name that says so.
 */

import { satisfies, type Constraint } from './aat/constraints.js';
import { isConstraint } from './aat/constraints.js';
import type { ToolArguments } from './aat/claims.js';
import { verifyProofOfPossession } from './aat/pop.js';
import { verifyDelegationChain, type VerifiedDelegationChain } from './aat/verify.js';
import { toAccessEvaluationRequest, toAccessEvaluationResponse } from './authzen/map.js';
import type { AccessEvaluationRequest, AccessEvaluationResponse } from './authzen/types.js';
import { denial, type Denial } from './reasons.js';
import type { StatusResolver } from './status.js';
import type { IdentityBindingVerifier } from './identity.js';

/** Authority that has passed every AAT check, including proof of possession. */
export interface VerifiedAuthority {
  readonly chain: VerifiedDelegationChain;
  readonly tool: string;
  readonly args: ToolArguments;
}

export interface VerifyAuthorityInput {
  /** Delegation chain, root first. */
  tokens: readonly string[];
  /**
   * Public keys trusted as root issuers. Required: a root token is a claim,
   * not a trust root.
   */
  trustAnchors: readonly Record<string, unknown>[];
  /** Proof-of-possession JWT. Required — see the module note. */
  pop: string;
  tool: string;
  args?: ToolArguments;
  now?: number;
  /**
   * Optional revocation/status resolver (RFC-0004). When provided, every token
   * in the chain is checked; a revoked token denies with `authority_revoked`
   * and an unknown status denies with `status_unavailable` (fail closed), unless
   * `allowUnknownStatus` is set. When absent, verification is expiry-only.
   */
  statusResolver?: StatusResolver;
  /** Proceed when a status is unknown rather than denying. Weakens the guarantee. */
  allowUnknownStatus?: boolean;
  /**
   * Optional external subject identity-binding verifier (RFC-0005). When the leaf
   * carries an external `sub`, this confirms it corresponds to the holder key.
   * `mismatch` denies with `subject_identity_mismatch`; `unavailable` denies with
   * `identity_binding_unavailable` (fail closed) unless `allowUnknownIdentity`.
   * When absent, the issuer's signed `sub` assertion is trusted.
   */
  identityBindingVerifier?: IdentityBindingVerifier;
  /** Proceed when an identity binding is unavailable rather than denying. Weakens the guarantee. */
  allowUnknownIdentity?: boolean;
}

export type VerifyAuthorityResult =
  { ok: true; authority: VerifiedAuthority } | { ok: false; denials: Denial[] };

export interface Decision {
  readonly allowed: boolean;
  readonly denials: readonly Denial[];
  /** The AuthZEN request this decision answers. Absent when verification failed. */
  readonly request?: AccessEvaluationRequest;
  readonly response: AccessEvaluationResponse;
}

/**
 * Verify a presented delegation chain and proof of possession.
 *
 * This is the enforcement entry point. It performs the complete AAT
 * verification algorithm; a success means the presenter holds the leaf key and
 * the chain narrows correctly from its root.
 */
export async function verifyAuthority(input: VerifyAuthorityInput): Promise<VerifyAuthorityResult> {
  const args = input.args ?? {};

  const now = input.now ?? Math.floor(Date.now() / 1000);
  const chainResult = await verifyDelegationChain(input.tokens, {
    trustAnchors: input.trustAnchors,
    now,
  });
  if (!chainResult.ok) return { ok: false, denials: chainResult.denials };

  // Revocation / status (RFC-0004): check every token in the chain, so a revoked
  // ancestor invalidates its descendants. Fail closed on unknown by default.
  if (input.statusResolver !== undefined) {
    for (const [i, token] of chainResult.chain.tokens.entries()) {
      const status = await input.statusResolver(token.payload.jti, token.payload.iss, now);
      if (status === 'revoked') {
        return {
          ok: false,
          denials: [
            denial('authority_revoked', 'status', 'Authority has been revoked.', { tokenIndex: i }),
          ],
        };
      }
      if (status === 'unknown' && input.allowUnknownStatus !== true) {
        return {
          ok: false,
          denials: [
            denial(
              'status_unavailable',
              'status',
              'Required revocation status could not be established.',
              { tokenIndex: i },
            ),
          ],
        };
      }
    }
  }

  // External subject identity binding (RFC-0005): when the leaf carries an
  // external `sub` and a verifier is configured, confirm it corresponds to the
  // holder key. PoP (below) is unchanged and always binds to cnf.jwk.
  const chain = chainResult.chain;
  if (input.identityBindingVerifier !== undefined && chain.leafSubject !== chain.leafHolder) {
    const binding = await input.identityBindingVerifier(chain.leafSubject, chain.leafHolder, now);
    if (binding === 'mismatch') {
      return {
        ok: false,
        denials: [
          denial(
            'subject_identity_mismatch',
            'identity',
            'The external subject does not correspond to the holder key.',
          ),
        ],
      };
    }
    if (binding === 'unavailable' && input.allowUnknownIdentity !== true) {
      return {
        ok: false,
        denials: [
          denial(
            'identity_binding_unavailable',
            'identity',
            'Required external identity binding could not be established.',
          ),
        ],
      };
    }
  }

  const popResult = await verifyProofOfPossession(
    input.pop,
    chainResult.chain,
    input.tool,
    args,
    input.now,
  );
  if (!popResult.ok) return { ok: false, denials: popResult.denials };

  return { ok: true, authority: { chain: chainResult.chain, tool: input.tool, args } };
}

/**
 * Decide whether verified authority permits the requested invocation.
 *
 * Argument checking is closed-world: when a tool carries any constraints, an
 * argument absent from its constraint map is refused rather than ignored.
 */
export function evaluate(authority: VerifiedAuthority): Decision {
  const { chain, tool, args } = authority;
  const denials: Denial[] = [];

  const constraints = chain.leafTools[tool];
  if (constraints === undefined) {
    denials.push(
      denial(
        'tool_not_authorized',
        'evaluation',
        `Tool "${tool}" is not permitted by this authority.`,
        {
          tool,
        },
      ),
    );
    return decisionOf(false, denials, undefined);
  }

  const constrained = Object.keys(constraints).length > 0;

  // Step 6b: under closed-world semantics a constrained argument is required,
  // not merely permitted. Omitting one would otherwise slip past every
  // constraint on it.
  if (constrained) {
    for (const argument of Object.keys(constraints)) {
      if (!(argument in args)) {
        denials.push(
          denial(
            'argument_missing',
            'evaluation',
            `Argument "${argument}" is constrained by this authority and must be supplied.`,
            { tool, argument },
          ),
        );
      }
    }
  }

  for (const [argument, value] of Object.entries(args)) {
    const constraint = constraints[argument];

    if (constraint === undefined) {
      if (constrained) {
        denials.push(
          denial(
            'argument_not_permitted',
            'evaluation',
            `Argument "${argument}" is not covered by the constraints on "${tool}".`,
            { tool, argument },
          ),
        );
      }
      continue;
    }

    if (!isConstraint(constraint)) {
      denials.push(
        denial(
          'constraint_type_unrecognized',
          'evaluation',
          `Constraint on "${tool}.${argument}" is malformed or of an unknown type.`,
          { tool, argument },
        ),
      );
      continue;
    }

    if (!satisfies(constraint as Constraint, value)) {
      denials.push(
        denial(
          'argument_constraint_violated',
          'evaluation',
          `Argument "${argument}" does not satisfy the constraint on "${tool}".`,
          { tool, argument },
        ),
      );
    }
  }

  const request = toAccessEvaluationRequest(chain, tool, args);
  return decisionOf(denials.length === 0, denials, request);
}

function decisionOf(
  allowed: boolean,
  denials: Denial[],
  request: AccessEvaluationRequest | undefined,
): Decision {
  return {
    allowed,
    denials,
    ...(request === undefined ? {} : { request }),
    response: toAccessEvaluationResponse(allowed, denials),
  };
}

/** Convenience composition of `verifyAuthority` and `evaluate`. */
export async function verifyAndEvaluate(input: VerifyAuthorityInput): Promise<Decision> {
  const verification = await verifyAuthority(input);
  if (!verification.ok) {
    return {
      allowed: false,
      denials: verification.denials,
      response: toAccessEvaluationResponse(false, verification.denials),
    };
  }
  return evaluate(verification.authority);
}

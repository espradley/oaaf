/**
 * Claim types for `draft-niyikiza-oauth-attenuating-agent-tokens-01`.
 *
 * Member names follow the draft exactly. Where the draft is silent, the type is
 * left permissive rather than guessed at — an over-specified type would reject
 * tokens the draft allows.
 */

import type { Constraint } from './constraints.js';

/** The AAT draft revision this module implements. Support is pinned, not "latest". */
export const AAT_DRAFT_REVISION = '01';

/** Confirmation claim (RFC 7800 shape) carrying the holder's public key. */
export interface Cnf {
  jwk: Record<string, unknown>;
}

/** Argument name to constraint. An empty map authorizes the tool unconstrained. */
export type ToolConstraints = Record<string, Constraint>;

/** `authorization_details` entry type defined by the draft. */
export const AAT_AUTHORIZATION_DETAIL_TYPE = 'attenuating_agent_token';

export interface AatAuthorizationDetail {
  type: typeof AAT_AUTHORIZATION_DETAIL_TYPE;
  tools: Record<string, ToolConstraints>;
}

/**
 * AAT payload.
 *
 * Note the absence of `sub`: the draft intentionally omits it. Subject identity
 * is derived from the verified `cnf.jwk` — see RFC-0001.
 */
export interface AatPayload {
  jti: string;
  iss: string;
  iat: number;
  exp: number;
  cnf: Cnf;
  del_depth: number;
  del_max_depth: number;
  authorization_details: AatAuthorizationDetail[];
  /** Derived tokens only. MUST be absent on a root token. */
  par_hash?: string;
}

/** Proof-of-possession JWT payload binding a presentation to one invocation. */
export interface PopPayload {
  jti: string;
  iat: number;
  /** `jti` of the presented leaf token. */
  aat_id: string;
  /** Tool being invoked. */
  aat_tool: string;
  /** Optional enforcement-point audience. */
  aat_aud?: string;
  /** Argument map, compared by JCS-canonical byte equality. */
  hta: Record<string, unknown>;
}

/** Tool arguments supplied with an invocation. */
export type ToolArguments = Record<string, unknown>;

/**
 * Extract the single `attenuating_agent_token` entry.
 *
 * The draft requires exactly one. Zero or several is a structural failure, not a
 * case to be tolerated by taking the first.
 */
export function extractToolGrants(payload: AatPayload): Record<string, ToolConstraints> | null {
  const details = payload.authorization_details;
  if (!Array.isArray(details)) return null;
  const matching = details.filter((entry) => entry?.type === AAT_AUTHORIZATION_DETAIL_TYPE);
  if (matching.length !== 1) return null;
  const tools = matching[0]?.tools;
  if (!tools || typeof tools !== 'object' || Array.isArray(tools)) return null;
  return tools;
}

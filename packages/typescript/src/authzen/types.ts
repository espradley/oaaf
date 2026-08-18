/**
 * AuthZEN Authorization API 1.0 types.
 *
 * Transcribed from the published specification. OAAF adopts this contract
 * unchanged; only the mapping into it is OAAF's (RFC-0001).
 */

export interface AuthZenSubject {
  type: string;
  id: string;
  properties?: Record<string, unknown>;
}

export interface AuthZenAction {
  name: string;
  properties?: Record<string, unknown>;
}

export interface AuthZenResource {
  type: string;
  id: string;
  properties?: Record<string, unknown>;
}

/** Access Evaluation Request. `context` is optional. */
export interface AccessEvaluationRequest {
  subject: AuthZenSubject;
  action: AuthZenAction;
  resource: AuthZenResource;
  context?: Record<string, unknown>;
}

/**
 * Access Evaluation Response.
 *
 * `decision` is a boolean in AuthZEN 1.0 — not an enum. Reasons travel in the
 * optional `context`.
 */
export interface AccessEvaluationResponse {
  decision: boolean;
  context?: Record<string, unknown>;
}

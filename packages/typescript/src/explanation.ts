/**
 * Structured, privacy-safe decision explanation — O4A.
 *
 * OAAF already knows why a decision happened; the transport adapters were
 * throwing away the locator fields (`tokenIndex`, `tool`, `argument`) that make
 * a denial diagnosable. This module is the one shared explanation contract that
 * `explain()`, the MCP adapter, and the A2A adapter all derive from:
 *
 *     core decision  →  DecisionExplanation  →  transport adapter
 *
 * It is observational only. Nothing here participates in the authorization
 * decision; it describes a decision already made.
 *
 * Privacy rule: **names, never values.** Argument names, tool names, stages,
 * reason codes, and the subject's public-key thumbprint are safe to expose.
 * Argument values, resource contents, token bytes, signatures, PoP material,
 * and keys are not, and never appear here.
 */

import type { VerifiedAuthority } from './decide.js';
import { subjectProfile } from './identity.js';
import type { Denial, ReasonCode, VerificationStage } from './reasons.js';

/**
 * One reason a decision came out as it did. The full locator set the core
 * produces, carried intact rather than flattened away.
 *
 * `message` is developer-facing detail (aligned with AuthZEN's `reason_admin`
 * semantics — see the module note in the SDK README). It is already safe: the
 * core builds messages from names and structural facts, never from values.
 */
export interface ReasonExplanation {
  /** Stable machine-readable reason. One of the 49 `REASON_CODES`. */
  code: ReasonCode;
  /** The verification stage that produced this reason. */
  stage: VerificationStage;
  /** Safe human-readable detail — names and structure, never values. */
  message: string;
  /** Tool/capability the reason concerns, when applicable. */
  tool?: string;
  /** Argument *name* the reason concerns, when applicable. Never a value. */
  argument?: string;
  /** Position in the presented chain implicated by the reason, when applicable. */
  tokenIndex?: number;
}

/**
 * A small, non-sensitive summary of the authority a decision was evaluated
 * against. Present only when a verified authority is available (i.e. the chain
 * and proof of possession verified); a verification *failure* has no authority
 * to summarize.
 *
 * Every field is authority-specific, transport-neutral, and unrelated to
 * execution. No values, no token material.
 */
export interface AuthoritySummary {
  /** Canonical subject: the external identity (`sub`, RFC-0005) if present, else the holder thumbprint. */
  subject: string;
  /** Identity profile of the subject — its URI scheme (e.g. `spiffe`, `wimse`, `thumbprint`). */
  subjectProfile: string;
  /** The proof-of-possession key identity (holder thumbprint); always present, distinct from subject. */
  holder: string;
  /** The tool/capability that was requested. */
  requestedTool: string;
  /** The *names* of the arguments supplied with the request. Never their values. */
  requestedArgumentNames: string[];
  /** Tools the verified leaf authority actually permits, after all narrowing. */
  grantedTools: string[];
  /** Delegation depth of the leaf (0 = root, no delegation). */
  delegationDepth: number;
  /** Number of tokens in the chain (root through leaf). */
  chainLength: number;
  /** Effective expiry (seconds since epoch) — the leaf's, the earliest in the chain. */
  expiresAt: number;
}

/** The structured explanation of one authorization decision. */
export interface DecisionExplanation {
  /** The outcome. Mirrors the decision; does not compute it. */
  decision: 'ALLOW' | 'DENY';
  /** Why. Empty on a clean allow. */
  reasons: ReasonExplanation[];
  /** The authority evaluated, when one verified. Absent on a verification failure. */
  authority?: AuthoritySummary;
}

/**
 * Map core denials to explanation reasons, preserving every locator field.
 *
 * This is the function both adapters use so that MCP and A2A expose the same
 * information rather than each flattening it their own way.
 */
export function explainReasons(denials: readonly Denial[]): ReasonExplanation[] {
  return denials.map((d) => ({
    code: d.code,
    stage: d.stage,
    message: d.message,
    ...(d.tool === undefined ? {} : { tool: d.tool }),
    ...(d.argument === undefined ? {} : { argument: d.argument }),
    ...(d.tokenIndex === undefined ? {} : { tokenIndex: d.tokenIndex }),
  }));
}

/**
 * Summarize a verified authority. Names and safe identifiers only.
 *
 * Deliberately minimal: enough to make an ALLOW meaningful (who, what was asked,
 * what is permitted, how deep the delegation, when it expires) and nothing more.
 * No verification history, no constraint snapshots, no token dumps.
 */
export function summarizeAuthority(authority: VerifiedAuthority): AuthoritySummary {
  return {
    subject: authority.chain.leafSubject,
    subjectProfile: subjectProfile(authority.chain.leafSubject),
    holder: authority.chain.leafHolder,
    requestedTool: authority.tool,
    requestedArgumentNames: Object.keys(authority.args),
    grantedTools: Object.keys(authority.chain.leafTools).sort(),
    delegationDepth: authority.chain.depth,
    chainLength: authority.chain.tokens.length,
    expiresAt: authority.chain.expiresAt,
  };
}

/**
 * Build the structured explanation for a decision.
 *
 * `allowed` and `denials` come straight from the already-computed decision;
 * `authority` is included only when verification produced one. This never
 * changes the decision — it describes it.
 */
export function explainDecision(
  allowed: boolean,
  denials: readonly Denial[],
  authority?: VerifiedAuthority,
): DecisionExplanation {
  return {
    decision: allowed ? 'ALLOW' : 'DENY',
    reasons: explainReasons(denials),
    ...(authority === undefined ? {} : { authority: summarizeAuthority(authority) }),
  };
}

/**
 * The canonical authority context (RFC-0006): the verified-authority facts an
 * external PDP consults when making the organization's policy decision. It is
 * the {@link AuthoritySummary} plus a marker that these facts come from an
 * authority OAAF verified. Names, never values.
 *
 * OAAF conveys this to the PDP; the PDP owns the policy decision. The presence of
 * `authorityVerified: true` states OAAF's authority decision, not that the action
 * is permitted.
 */
export interface AuthorityContext extends AuthoritySummary {
  readonly authorityVerified: true;
}

/** Build the canonical authority context from a verified authority (RFC-0006). */
export function toAuthorityContext(authority: VerifiedAuthority): AuthorityContext {
  return { authorityVerified: true, ...summarizeAuthority(authority) };
}

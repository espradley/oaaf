/**
 * `@oaaf/sdk` — verify delegated authority, decide, and explain.
 *
 * OAAF implements and profiles existing standards rather than defining its own
 * wire format:
 *
 *   - Delegation chains follow `draft-niyikiza-oauth-attenuating-agent-tokens-01`.
 *     Support is pinned to that revision, not to "latest".
 *   - Decisions follow the OpenID AuthZEN Authorization API 1.0.
 *   - The mapping between them is frozen by RFC-0001.
 *
 * Typical use:
 *
 * ```ts
 * const decision = await verifyAndEvaluate({ tokens, pop, tool, args });
 * if (!decision.allowed) console.log(explain(decision));
 * ```
 *
 * What this does not do: revocation and replay protection are outside AAT -01
 * and outside OAAF. Authority is bounded by `exp` alone.
 */

export { AAT_DRAFT_REVISION, AAT_AUTHORIZATION_DETAIL_TYPE } from './aat/claims.js';
export type {
  AatAuthorizationDetail,
  AatPayload,
  Cnf,
  PopPayload,
  ToolArguments,
  ToolConstraints,
} from './aat/claims.js';

export { isConstraint, isPermittedPair, satisfies, subsumes } from './aat/constraints.js';
export type {
  AllConstraint,
  AnyConstraint,
  Constraint,
  ConstraintType,
  ContainsConstraint,
  ExactConstraint,
  NotOneOfConstraint,
  OneOfConstraint,
  RangeConstraint,
  SubsetConstraint,
  WildcardConstraint,
} from './aat/constraints.js';

/**
 * Chain-only verification, for inspection, testing, and conformance work.
 *
 * **This is not enforcement.** It performs no proof-of-possession check and
 * produces no authorization decision. Use `verifyAuthority` or
 * `verifyAndEvaluate` to enforce.
 */
export { verifyDelegationChain, MAX_CHAIN_LENGTH, MAX_IAT_SKEW_SECONDS } from './aat/verify.js';
export type {
  ChainResult,
  VerifiedDelegationChain,
  VerifiedToken,
  VerifyChainOptions,
} from './aat/verify.js';

export { verifyProofOfPossession } from './aat/pop.js';

export { evaluate, verifyAndEvaluate, verifyAuthority } from './decide.js';
export type {
  Decision,
  VerifiedAuthority,
  VerifyAuthorityInput,
  VerifyAuthorityResult,
} from './decide.js';

export {
  OAAF_RESOURCE_TYPE,
  OAAF_SUBJECT_TYPE,
  toAccessEvaluationRequest,
  toAccessEvaluationResponse,
} from './authzen/map.js';
export type {
  AccessEvaluationRequest,
  AccessEvaluationResponse,
  AuthZenAction,
  AuthZenResource,
  AuthZenSubject,
} from './authzen/types.js';

export { explain, renderExplanation, toExplanation } from './explain.js';
export { explainDecision, explainReasons, summarizeAuthority } from './explanation.js';
export type { AuthoritySummary, DecisionExplanation, ReasonExplanation } from './explanation.js';

/**
 * MCP / COAZ integration — RFC-0002. COAZ owns the request mapping; these
 * exports are the OAAF precondition step and, for demonstration, COAZ's own
 * unmodified default `tools/call` mapping.
 */
/**
 * A2A binding — RFC-0003. OAAF delegated authority carried through A2A's
 * extension mechanism and enforced as a precondition before consequential work.
 */
export {
  enforceA2aAuthority,
  explainA2aResult,
  A2A_EXTENSION_SUPPORT_REQUIRED,
  A2A_AUTHORIZATION_DENIED,
} from './a2a/binding.js';
export type { A2aAuthorityInput, A2aAuthorityResult, A2aAuthorityError } from './a2a/binding.js';
export {
  OAAF_A2A_EXTENSION_URI,
  OAAF_AGENT_EXTENSION,
  METADATA_KEY_CHAIN,
  METADATA_KEY_POP,
  isExtensionActivated,
  extractChain,
  extractPop,
} from './a2a/extension.js';
export type { A2aMessage } from './a2a/extension.js';

export { explainMcpResult } from './mcp/coaz.js';
export {
  buildCoazToolCallRequest,
  enforceAndMapToCoaz,
  enforceOaafPrecondition,
  COAZ_ACTION_NAME,
  COAZ_RESOURCE_TYPE,
  JSONRPC_AUTHORIZATION_DENIED,
} from './mcp/coaz.js';
export type {
  CoazToolCallRequest,
  JsonRpcError,
  OaafPrecondition,
  OaafPreconditionInput,
} from './mcp/coaz.js';

export { denial, REASON_CODES } from './reasons.js';
export type { Denial, ReasonCode, VerificationStage } from './reasons.js';

/** Specification versions this SDK understands. */
export type SpecVersion = '0.1';

/** The OAAF profile version this SDK targets. */
export const OAAF_SPEC_VERSION = '0.1' satisfies SpecVersion;

const SUPPORTED_SPEC_VERSIONS: readonly string[] = [OAAF_SPEC_VERSION];

/**
 * Narrow an arbitrary string to a profile version this SDK supports.
 *
 * An unsupported version is a reason to refuse the exchange rather than to
 * guess at its meaning — OAAF fails closed.
 */
export function isSupportedSpecVersion(value: string): value is SpecVersion {
  return SUPPORTED_SPEC_VERSIONS.includes(value);
}

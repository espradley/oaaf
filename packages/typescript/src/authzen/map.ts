/**
 * AAT to AuthZEN mapping, frozen by RFC-0001.
 *
 *   leaf tool name        -> action.name
 *   leaf holder identity  -> subject.id   (JWK Thumbprint URI, AAT-native)
 *   "tool"                -> resource.type
 *   leaf tool name        -> resource.id
 *   tool arguments        -> action.properties.arguments
 *
 * `resource` deliberately duplicates `action`. AAT carries no resource concept,
 * and inferring one from a designated argument would require per-deployment
 * configuration that AAT does not carry — two deployments could then map the
 * same token differently. Determinism is worth more than expressiveness here.
 * Semantic resource binding is deferred to an MCP-informed RFC.
 */

import type { ToolArguments } from '../aat/claims.js';
import { subjectProfile } from '../identity.js';
import type { VerifiedDelegationChain } from '../aat/verify.js';
import type { Denial } from '../reasons.js';
import type { AccessEvaluationRequest, AccessEvaluationResponse } from './types.js';

export const OAAF_SUBJECT_TYPE = 'agent';
export const OAAF_RESOURCE_TYPE = 'tool';

/**
 * Build an AuthZEN request from a **verified** chain.
 *
 * Takes a `VerifiedDelegationChain` rather than raw tokens by design: an
 * unverified chain must never reach a decision, and requiring the verified type
 * makes that a compile-time property rather than a review comment.
 */
export function toAccessEvaluationRequest(
  chain: VerifiedDelegationChain,
  tool: string,
  args: ToolArguments,
): AccessEvaluationRequest {
  return {
    subject: { type: OAAF_SUBJECT_TYPE, id: chain.leafHolder },
    action: { name: tool, properties: { arguments: args } },
    resource: { type: OAAF_RESOURCE_TYPE, id: tool },
    // context.oaaf carries the canonical authority context (RFC-0006) for the PDP.
    context: {
      oaaf: {
        authorityVerified: true,
        subject: chain.leafSubject,
        subjectProfile: subjectProfile(chain.leafSubject),
        holder: chain.leafHolder,
        requestedTool: tool,
        requestedArgumentNames: Object.keys(args),
        grantedTools: Object.keys(chain.leafTools).sort(),
        delegationDepth: chain.depth,
        chainLength: chain.tokens.length,
        expiresAt: chain.expiresAt,
      },
    },
  };
}

/** Build an AuthZEN response. Denials travel in `context`, per the spec. */
export function toAccessEvaluationResponse(
  decision: boolean,
  denials: readonly Denial[] = [],
): AccessEvaluationResponse {
  if (decision) return { decision: true };
  return {
    decision: false,
    context: {
      reasons: denials.map((d) => ({
        code: d.code,
        stage: d.stage,
        message: d.message,
        ...(d.tool === undefined ? {} : { tool: d.tool }),
        ...(d.argument === undefined ? {} : { argument: d.argument }),
        ...(d.tokenIndex === undefined ? {} : { tokenIndex: d.tokenIndex }),
      })),
    },
  };
}

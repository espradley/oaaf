/**
 * MCP / COAZ integration — RFC-0002.
 *
 * COAZ-MCP already defines how an MCP `tools/call` maps into an AuthZEN request:
 *
 *   { subject: { type: "identity", id: $token.sub },
 *     context: { agent: $token.?client_id },
 *     action:  { name: "tools/call" },
 *     resource: { type: "tool", id: $params.name } }
 *
 * That mapping is COAZ's, not OAAF's, and this module does not touch it — see
 * RFC-0002's structural rule. COAZ's information model has exactly two input
 * variables, `params` and `token`, and an AAT chain is neither: it is not the
 * OAuth access token COAZ reads as `token`, and putting it in `params` would
 * plant delegation material inside the tool's own argument surface.
 *
 * So OAAF cannot be a COAZ input. It is a precondition the PEP enforces before
 * a COAZ request is ever built. On failure, the PEP denies immediately and
 * never calls the PDP — folding a failed verification into `context` and
 * trusting the PDP's policy to notice would make the guarantee contingent on
 * that policy being configured correctly, exactly what ADR-0004 forbids.
 */

import { evaluate, verifyAuthority, type VerifiedAuthority } from '../decide.js';
import type { ToolArguments } from '../aat/claims.js';
import type { Denial } from '../reasons.js';

/** COAZ's default `tools/call` mapping (COAZ-MCP §Default Mappings — Tools). */
export const COAZ_ACTION_NAME = 'tools/call';
export const COAZ_RESOURCE_TYPE = 'tool';

/**
 * The AuthZEN Access Evaluation request COAZ's default `tools/call` mapping
 * produces, before any OAAF contribution.
 *
 * This is COAZ's shape, reproduced only far enough to demonstrate the
 * integration — a full CEL-expression engine for declared mappings
 * (`x-authzen-mapping`) is COAZ implementation territory, not OAAF's, per the
 * structural rule in RFC-0002.
 */
export interface CoazToolCallRequest {
  subject: { type: 'identity'; id: string };
  action: { name: typeof COAZ_ACTION_NAME };
  resource: { type: typeof COAZ_RESOURCE_TYPE; id: string };
  context: Record<string, unknown> & { agent?: string };
}

/** Build COAZ's default `tools/call` mapping from its two input variables. */
export function buildCoazToolCallRequest(input: {
  /** `$token.sub` — the validated principal. */
  subject: string;
  /** `$params.name` — the tool being invoked. */
  tool: string;
  /** `$token.?client_id`, optional per COAZ's own mapping. */
  agent?: string;
}): CoazToolCallRequest {
  return {
    subject: { type: 'identity', id: input.subject },
    action: { name: COAZ_ACTION_NAME },
    resource: { type: COAZ_RESOURCE_TYPE, id: input.tool },
    context: input.agent === undefined ? {} : { agent: input.agent },
  };
}

/** A JSON-RPC 2.0 error, per COAZ-MCP's error-transport requirement. */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

/** JSON-RPC error code for an authorization denial (COAZ-MCP §Error Handling). */
export const JSONRPC_AUTHORIZATION_DENIED = -32001;

function toJsonRpcError(denials: readonly Denial[]): JsonRpcError {
  const primary = denials[0];
  return {
    code: JSONRPC_AUTHORIZATION_DENIED,
    message: primary === undefined ? 'Authorization denied.' : primary.message,
    data: {
      reasons: denials.map((d) => ({ code: d.code, stage: d.stage, message: d.message })),
    },
  };
}

export interface OaafPreconditionInput {
  /** AAT delegation chain, root first — carried via `OAAF-Authority-Chain`. */
  tokens: readonly string[];
  /** Proof of possession — carried via `OAAF-Proof-Of-Possession`. */
  pop: string;
  trustAnchors: readonly Record<string, unknown>[];
  tool: string;
  args: ToolArguments;
  now?: number;
}

export type OaafPrecondition =
  | { ok: true; authority: VerifiedAuthority; context: Record<string, unknown> }
  | { ok: false; error: JsonRpcError };

/**
 * The OAAF precondition step inserted into COAZ-MCP's PEP algorithm.
 *
 * On success, returns the verified authority and a `context.oaaf` fragment the
 * caller MAY merge into the COAZ-constructed request (RFC-0002 step 4). On
 * failure, returns a JSON-RPC error the PEP MUST return immediately, without
 * constructing or sending any AuthZEN request.
 *
 * This function performs full enforcement — chain verification, proof of
 * possession, and capability/constraint evaluation — matching
 * `verifyAndEvaluate`. It is not a chain-only check.
 */
export async function enforceOaafPrecondition(
  input: OaafPreconditionInput,
): Promise<OaafPrecondition> {
  const verification = await verifyAuthority({
    tokens: input.tokens,
    trustAnchors: input.trustAnchors,
    pop: input.pop,
    tool: input.tool,
    args: input.args,
    ...(input.now === undefined ? {} : { now: input.now }),
  });

  if (!verification.ok) {
    return { ok: false, error: toJsonRpcError(verification.denials) };
  }

  const decision = evaluate(verification.authority);
  if (!decision.allowed) {
    return { ok: false, error: toJsonRpcError(decision.denials) };
  }

  return {
    ok: true,
    authority: verification.authority,
    context: {
      oaaf: {
        holder: verification.authority.chain.leafHolder,
        delegationDepth: verification.authority.chain.depth,
        capabilities: Object.keys(verification.authority.chain.leafTools).sort(),
      },
    },
  };
}

/**
 * Full RFC-0002 integration: enforce the OAAF precondition, then — only on
 * success — construct the COAZ default `tools/call` request with `context.oaaf`
 * merged in.
 *
 * `principal` and `agent` are COAZ's own inputs (`$token.sub`,
 * `$token.?client_id`) and are unrelated to, and unverified by, OAAF — they are
 * accepted here only to assemble the request COAZ-MCP already defines.
 */
export async function enforceAndMapToCoaz(
  input: OaafPreconditionInput & { principal: string; agent?: string },
): Promise<{ ok: true; request: CoazToolCallRequest } | { ok: false; error: JsonRpcError }> {
  const precondition = await enforceOaafPrecondition(input);
  if (!precondition.ok) return precondition;

  const request = buildCoazToolCallRequest({
    subject: input.principal,
    tool: input.tool,
    ...(input.agent === undefined ? {} : { agent: input.agent }),
  });
  request.context = { ...request.context, ...precondition.context };

  return { ok: true, request };
}

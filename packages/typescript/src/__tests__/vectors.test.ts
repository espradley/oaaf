import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { verifyAndEvaluate, verifyAuthority } from '../decide.js';
import { toExplanation } from '../explain.js';
import { enforceA2aAuthority, explainA2aResult } from '../a2a/binding.js';
import { enforceOaafPrecondition, explainMcpResult } from '../mcp/coaz.js';
import type { DecisionExplanation } from '../explanation.js';
import { revokedSetResolver } from '../status.js';
import { boundSubjectsVerifier } from '../identity.js';

/**
 * The reference side of the portable conformance corpus (O6B). The reference runs
 * every vector in the language-neutral corpus and must produce each vector's
 * declared portable contract (expected_decision + expected_normative_reason) as
 * well as its advisory full `reference` explanation. The Python suite consumes the
 * SAME corpus for the profiles it implements; neither calls the other.
 */

const A2A_CHAIN = 'https://oaaf.dev/a2a/authority/v1/chain';
const A2A_POP = 'https://oaaf.dev/a2a/authority/v1/pop';
const A2A_EXT = 'https://oaaf.dev/a2a/authority/v1';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const corpusPath = path.join(repoRoot, 'spec', '0.1', 'conformance', 'vectors', 'corpus.json');

interface VectorInput {
  tokens: string[];
  trust_anchors: Record<string, unknown>[];
  pop: string;
  tool: string;
  args?: Record<string, unknown>;
  now?: number;
  revoked_jti?: string[];
  unknown_jti?: string[];
  bound_subjects?: string[];
  unavailable_subjects?: string[];
  recipient?: string;
  a2a_extension_activated?: boolean;
  a2a_authority_material_present?: boolean;
}
interface Vector {
  vector_id: string;
  requirements: string[];
  profile: string;
  expected_decision: 'allow' | 'deny';
  expected_normative_reason: string | null;
  expected_authority_verified?: boolean;
  input: VectorInput;
  notes: string;
  reference: DecisionExplanation;
}

const { vectors } = JSON.parse(readFileSync(corpusPath, 'utf8')) as { vectors: Vector[] };

function normalize(e: DecisionExplanation) {
  return {
    decision: e.decision,
    reasons: e.reasons.map((r) => ({
      code: r.code,
      stage: r.stage,
      tool: r.tool ?? null,
      argument: r.argument ?? null,
      tokenIndex: r.tokenIndex ?? null,
    })),
    authority: e.authority ?? null,
  };
}

async function runVector(v: Vector): Promise<DecisionExplanation> {
  const i = v.input;
  const now = i.now;
  const statusResolver =
    i.revoked_jti !== undefined || i.unknown_jti !== undefined
      ? revokedSetResolver(i.revoked_jti ?? [], i.unknown_jti ?? [])
      : undefined;
  const identityBindingVerifier =
    i.bound_subjects !== undefined || i.unavailable_subjects !== undefined
      ? boundSubjectsVerifier(i.bound_subjects ?? [], i.unavailable_subjects ?? [])
      : undefined;

  if (v.profile === 'MCP') {
    const res = await enforceOaafPrecondition({
      tokens: i.tokens,
      trustAnchors: i.trust_anchors,
      pop: i.pop,
      tool: i.tool,
      args: i.args ?? {},
      ...(now === undefined ? {} : { now }),
      ...(statusResolver === undefined ? {} : { statusResolver }),
      ...(identityBindingVerifier === undefined ? {} : { identityBindingVerifier }),
    });
    return explainMcpResult(res);
  }

  if (v.profile === 'A2A') {
    const activated = i.a2a_extension_activated === false ? [] : [A2A_EXT];
    const metadata =
      i.a2a_authority_material_present === false ? {} : { [A2A_CHAIN]: i.tokens, [A2A_POP]: i.pop };
    const a2a = await enforceA2aAuthority({
      message: { metadata },
      activatedExtensionUris: activated,
      trustAnchors: i.trust_anchors,
      skillId: i.tool,
      args: i.args ?? {},
      recipient: i.recipient ?? 'https://recipient.example',
      requireRecipientBinding: true,
      ...(now === undefined ? {} : { now }),
    });
    return explainA2aResult(a2a);
  }

  const common = {
    tokens: i.tokens,
    trustAnchors: i.trust_anchors,
    pop: i.pop,
    tool: i.tool,
    args: i.args ?? {},
    ...(now === undefined ? {} : { now }),
    ...(statusResolver === undefined ? {} : { statusResolver }),
    ...(identityBindingVerifier === undefined ? {} : { identityBindingVerifier }),
  };
  const decision = await verifyAndEvaluate(common);
  const auth = await verifyAuthority(common);
  return toExplanation(decision, auth.ok ? auth.authority : undefined);
}

describe('portable conformance corpus (reference side)', () => {
  for (const v of vectors) {
    it(`${v.vector_id}`, async () => {
      const result = await runVector(v);

      // Portable normative contract: decision + normative reason.
      expect(result.decision).toBe(v.expected_decision === 'allow' ? 'ALLOW' : 'DENY');
      const primaryReason = result.reasons[0]?.code ?? null;
      expect(primaryReason).toBe(v.expected_normative_reason);

      // PDP: authorityVerified reflects the OAAF authority decision, not a permit.
      if (v.expected_authority_verified !== undefined) {
        expect(result.decision === 'ALLOW').toBe(v.expected_authority_verified);
      }

      // Advisory regression: the reference's full explanation is stable.
      expect(normalize(result)).toEqual(normalize(v.reference));

      // Privacy vectors: no argument value may appear in the serialized decision.
      if (v.requirements.includes('CORE-EXPL-003')) {
        const serialized = JSON.stringify(result);
        for (const value of Object.values(v.input.args ?? {})) {
          expect(serialized).not.toContain(String(value));
        }
      }
    });
  }
});

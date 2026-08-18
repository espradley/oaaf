import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { verifyAndEvaluate, verifyAuthority } from '../decide.js';
import { toExplanation } from '../explain.js';
import { enforceA2aAuthority, explainA2aResult } from '../a2a/binding.js';
import type { DecisionExplanation } from '../explanation.js';

/**
 * The reference side of the cross-language parity gate (O5B). The same shared
 * vectors that the Python suite verifies are verified here against the
 * reference. Neither implementation calls the other; both answer to the
 * committed expected result. Keeps the reference honest against its own vectors
 * and guarantees the fixtures stay self-consistent.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const vectorsPath = path.join(repoRoot, 'python', 'tests', 'vectors', 'vectors.json');
const { vectors } = JSON.parse(readFileSync(vectorsPath, 'utf8')) as {
  vectors: Array<{ name: string; input: Record<string, unknown>; expected: DecisionExplanation }>;
};

/** Compare only the normative fields; message prose is not normative. */
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

async function evaluateVector(input: Record<string, unknown>): Promise<DecisionExplanation> {
  const i = input as {
    tokens: string[];
    trustAnchors: Record<string, unknown>[];
    pop: string;
    tool: string;
    args?: Record<string, unknown>;
    now?: number;
    recipient?: string;
  };
  // The recipient case exercises the A2A binding path (aat_aud binding).
  if (i.recipient !== undefined) {
    const a2a = await enforceA2aAuthority({
      message: {
        metadata: {
          'https://oaaf.dev/a2a/authority/v1/chain': i.tokens,
          'https://oaaf.dev/a2a/authority/v1/pop': i.pop,
        },
      },
      activatedExtensionUris: ['https://oaaf.dev/a2a/authority/v1'],
      trustAnchors: i.trustAnchors,
      skillId: i.tool,
      args: i.args ?? {},
      recipient: i.recipient,
      requireRecipientBinding: true,
      ...(i.now === undefined ? {} : { now: i.now }),
    });
    return explainA2aResult(a2a);
  }
  const decision = await verifyAndEvaluate({
    tokens: i.tokens,
    trustAnchors: i.trustAnchors,
    pop: i.pop,
    tool: i.tool,
    args: i.args ?? {},
    ...(i.now === undefined ? {} : { now: i.now }),
  });
  const v = await verifyAuthority({
    tokens: i.tokens,
    trustAnchors: i.trustAnchors,
    pop: i.pop,
    tool: i.tool,
    args: i.args ?? {},
    ...(i.now === undefined ? {} : { now: i.now }),
  });
  return toExplanation(decision, v.ok ? v.authority : undefined);
}

describe('cross-language vectors (reference side)', () => {
  for (const vector of vectors) {
    it(`reference matches expected: ${vector.name}`, async () => {
      const result = await evaluateVector(vector.input);
      expect(normalize(result)).toEqual(normalize(vector.expected));
    });
  }
});

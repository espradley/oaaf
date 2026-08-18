#!/usr/bin/env node
/**
 * Reference conformance adapter — TypeScript/Node (O6C).
 *
 * Speaks the oaaf-conform JSON-lines protocol (spec/0.1/conformance/runner.md) over
 * stdin/stdout, answering vectors with the OAAF TypeScript SDK. It claims every
 * profile the SDK implements.
 *
 * This adapter happens to use @oaaf/sdk because it IS the reference implementation.
 * A third-party adapter would use its own implementation instead — the runner does
 * not require the OAAF SDK; only this reference adapter chooses to use it.
 */

import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'packages',
  'typescript',
  'dist',
);
const {
  verifyAndEvaluate,
  verifyAuthority,
  toExplanation,
  revokedSetResolver,
  boundSubjectsVerifier,
} = await import(path.join(dist, 'index.js'));
const { enforceA2aAuthority, explainA2aResult } = await import(
  path.join(dist, 'a2a', 'binding.js')
);

const A2A_CHAIN = 'https://oaaf.dev/a2a/authority/v1/chain';
const A2A_POP = 'https://oaaf.dev/a2a/authority/v1/pop';
const A2A_EXT = 'https://oaaf.dev/a2a/authority/v1';
const PROFILES = ['Core', 'Status', 'Identity', 'A2A'];

function say(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

async function evaluate(v) {
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

  let explanation;
  if (v.profile === 'A2A') {
    const activated = i.a2a_extension_activated === false ? [] : [A2A_EXT];
    const metadata =
      i.a2a_authority_material_present === false ? {} : { [A2A_CHAIN]: i.tokens, [A2A_POP]: i.pop };
    const res = await enforceA2aAuthority({
      message: { metadata },
      activatedExtensionUris: activated,
      trustAnchors: i.trust_anchors,
      skillId: i.tool,
      args: i.args ?? {},
      recipient: i.recipient ?? 'https://recipient.example',
      requireRecipientBinding: true,
      ...(now === undefined ? {} : { now }),
    });
    explanation = explainA2aResult(res);
  } else {
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
    explanation = toExplanation(decision, auth.ok ? auth.authority : undefined);
  }
  return {
    type: 'result',
    vector_id: v.vector_id,
    decision: explanation.decision.toLowerCase(),
    reason: explanation.reasons[0]?.code ?? null,
    output: JSON.stringify(explanation),
  };
}

const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  if (!line.trim()) continue;
  const msg = JSON.parse(line);
  if (msg.type === 'hello') say({ type: 'hello', adapter: 'oaaf-typescript', profiles: PROFILES });
  else if (msg.type === 'evaluate') say(await evaluate(msg));
  else if (msg.type === 'bye') break;
}

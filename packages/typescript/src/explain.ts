/**
 * Rendering a decision for a human — a thin text view over the structured
 * {@link DecisionExplanation} (O4A).
 *
 * A developer who hits an unexpected denial should resolve it from this output
 * without reading a specification: what was asked, what the authority permits,
 * and which check refused it. It shows argument *names* only — never values, so
 * the same rendering is safe to log.
 */

import type { Decision, VerifiedAuthority } from './decide.js';
import { explainDecision, type AuthoritySummary, type DecisionExplanation } from './explanation.js';

/**
 * The structured explanation for a decision.
 *
 * Prefer this when a program needs to inspect or assert on the result; use
 * {@link explain} to render it for a person.
 */
export function toExplanation(
  decision: Decision,
  authority?: VerifiedAuthority,
): DecisionExplanation {
  return explainDecision(decision.allowed, decision.denials, authority);
}

/**
 * Render a decision as text.
 *
 * `authority` is optional: a verification failure has no verified authority to
 * describe, so only the outcome and reasons are shown.
 */
export function explain(decision: Decision, authority?: VerifiedAuthority): string {
  return renderExplanation(toExplanation(decision, authority));
}

/** Render a structured explanation as text. */
export function renderExplanation(explanation: DecisionExplanation): string {
  const lines: string[] = [];

  lines.push(explanation.decision === 'ALLOW' ? 'ALLOWED' : 'DENIED');
  lines.push('');

  const authority = explanation.authority;
  if (authority !== undefined) {
    lines.push('Subject');
    lines.push(`  ${authority.subject}`);
    lines.push('');
    lines.push('Requested');
    lines.push(`  ${authority.requestedTool}`);
    // Argument names only — values are intentionally omitted.
    for (const name of authority.requestedArgumentNames) {
      lines.push(`    ${name}`);
    }
    lines.push('');
    lines.push('Chain');
    lines.push(`  ${describeChain(authority)}`);
    lines.push('');
    lines.push('Leaf permits');
    if (authority.grantedTools.length === 0) {
      lines.push('  (nothing)');
    } else {
      for (const tool of authority.grantedTools) {
        lines.push(`  ${tool}`);
      }
    }
    lines.push('');
  }

  if (explanation.reasons.length > 0) {
    lines.push(explanation.reasons.length === 1 ? 'Reason' : 'Reasons');
    for (const r of explanation.reasons) {
      const where = [
        r.tool === undefined ? undefined : `tool ${r.tool}`,
        r.argument === undefined ? undefined : `argument ${r.argument}`,
        r.tokenIndex === undefined ? undefined : `token ${r.tokenIndex}`,
      ]
        .filter((part): part is string => part !== undefined)
        .join(', ');

      lines.push(`  ${r.code}`);
      lines.push(`    ${r.message}`);
      if (where.length > 0) lines.push(`    at ${where}`);
    }
  }

  return lines.join('\n').trimEnd();
}

function describeChain(authority: AuthoritySummary): string {
  if (authority.chainLength === 1) return 'root (no delegation)';
  const hops = Array.from({ length: authority.chainLength - 1 }, (_, i) => `hop ${i + 1}`);
  return ['root', ...hops].join(' → ');
}

/**
 * Human-readable rendering of a decision.
 *
 * A developer who hits an unexpected denial should be able to resolve it from
 * this output without reading a specification: what was asked, what the
 * authority actually permits, and which check refused it.
 */

import type { Decision } from './decide.js';
import type { VerifiedAuthority } from './decide.js';

/**
 * Render a decision as text.
 *
 * `authority` is optional because a decision may exist without one — if
 * verification failed, there is no verified authority to describe.
 */
export function explain(decision: Decision, authority?: VerifiedAuthority): string {
  const lines: string[] = [];

  lines.push(decision.allowed ? 'ALLOWED' : 'DENIED');
  lines.push('');

  if (authority !== undefined) {
    lines.push('Subject');
    lines.push(`  ${authority.chain.leafHolder}`);
    lines.push('');
    lines.push('Requested');
    lines.push(`  ${authority.tool}`);
    const args = Object.entries(authority.args);
    if (args.length > 0) {
      for (const [name, value] of args) {
        lines.push(`    ${name} = ${JSON.stringify(value)}`);
      }
    }
    lines.push('');
    lines.push('Chain');
    lines.push(`  ${describeChain(authority)}`);
    lines.push('');
    lines.push('Leaf permits');
    const tools = Object.keys(authority.chain.leafTools).sort();
    if (tools.length === 0) {
      lines.push('  (nothing)');
    } else {
      for (const tool of tools) {
        lines.push(`  ${tool}${describeConstraints(authority, tool)}`);
      }
    }
    lines.push('');
  }

  if (decision.denials.length > 0) {
    lines.push(decision.denials.length === 1 ? 'Reason' : 'Reasons');
    for (const d of decision.denials) {
      const where = [
        d.tool === undefined ? undefined : `tool ${d.tool}`,
        d.argument === undefined ? undefined : `argument ${d.argument}`,
        d.tokenIndex === undefined ? undefined : `token ${d.tokenIndex}`,
      ]
        .filter((part): part is string => part !== undefined)
        .join(', ');

      lines.push(`  ${d.code}`);
      lines.push(`    ${d.message}`);
      if (where.length > 0) lines.push(`    at ${where}`);
    }
  }

  return lines.join('\n').trimEnd();
}

function describeChain(authority: VerifiedAuthority): string {
  const length = authority.chain.tokens.length;
  if (length === 1) return 'root (no delegation)';
  const hops = Array.from({ length: length - 1 }, (_, i) => `hop ${i + 1}`);
  return ['root', ...hops].join(' → ');
}

function describeConstraints(authority: VerifiedAuthority, tool: string): string {
  const constraints = authority.chain.leafTools[tool];
  if (constraints === undefined) return '';
  const names = Object.keys(constraints).sort();
  if (names.length === 0) return ' (unconstrained)';
  return ` (constrained: ${names.join(', ')})`;
}

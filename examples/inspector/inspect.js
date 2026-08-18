/**
 * OAAF local authority inspector.
 *
 * Runs the existing OAAF verification/evaluation pipeline on public inputs and
 * renders the canonical DecisionExplanation (O4A/O4B). It implements no
 * authorization logic of its own — it calls verifyAndEvaluate/verifyAuthority
 * and displays the result.
 *
 * Local and offline. It sends nothing, persists nothing, and prints no argument
 * values, tokens, signatures, PoP material, or keys.
 *
 * Usage:
 *   npm run inspect -- --example allow
 *   npm run inspect -- --example deny-undelegated --json
 *   npm run inspect -- --case ./case.json
 *   cat case.json | npm run inspect
 *
 * A "case" is the public input to the pipeline:
 *   { tokens: string[], pop: string, trustAnchors: object[],
 *     tool: string, args?: object, now?: number }
 *
 * Sensitive material (tokens, pop) is read from a file or stdin, never from a
 * command-line flag, to keep it out of shell history and the process list.
 *
 * Exit codes:
 *   0  inspection succeeded, authority ALLOW
 *   1  inspection succeeded, authority DENY
 *   2  malformed invocation or internal inspector failure
 */

import { readFileSync } from 'node:fs';

import { toExplanation, renderExplanation, verifyAndEvaluate, verifyAuthority } from '@oaaf/sdk';
import { EXAMPLES, EXAMPLE_NAMES } from './cases.js';

const EXIT_ALLOW = 0;
const EXIT_DENY = 1;
const EXIT_ERROR = 2;

function fail(message) {
  process.stderr.write(`inspector: ${message}\n`);
  process.exit(EXIT_ERROR);
}

function parseArgs(argv) {
  const opts = { json: false, example: null, caseFile: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--example') opts.example = argv[(i += 1)];
    else if (a === '--case') opts.caseFile = argv[(i += 1)];
    else if (a === '--help' || a === '-h') opts.help = true;
    else fail(`unknown argument: ${a}`);
  }
  return opts;
}

function usage() {
  process.stdout.write(
    [
      'OAAF local authority inspector',
      '',
      'Usage:',
      '  --example <name>   inspect a built-in case; names: ' + EXAMPLE_NAMES.join(', '),
      '  --case <file>      inspect a case JSON file',
      '  (stdin)            inspect a case JSON piped in',
      '  --json             emit the canonical DecisionExplanation as JSON',
      '',
      'Exit: 0 ALLOW, 1 DENY, 2 malformed/internal error.',
      '',
    ].join('\n'),
  );
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

async function resolveCase(opts) {
  if (opts.example !== null) {
    const make = EXAMPLES[opts.example];
    if (make === undefined) {
      fail(`unknown example "${opts.example}"; try one of: ${EXAMPLE_NAMES.join(', ')}`);
    }
    return make();
  }
  const raw = opts.caseFile !== null ? readFileSync(opts.caseFile, 'utf8') : readStdin();
  if (raw.trim() === '') {
    fail('no case supplied; use --example <name>, --case <file>, or pipe a case on stdin');
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`case is not valid JSON: ${error.message}`);
  }
  if (
    !Array.isArray(parsed.tokens) ||
    typeof parsed.pop !== 'string' ||
    typeof parsed.tool !== 'string'
  ) {
    fail('case must contain tokens[], pop, tool (and trustAnchors[], args?, now?)');
  }
  return parsed;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    process.exit(EXIT_ALLOW);
  }

  const testCase = await resolveCase(opts);

  const input = {
    tokens: testCase.tokens,
    trustAnchors: testCase.trustAnchors ?? [],
    pop: testCase.pop,
    tool: testCase.tool,
    args: testCase.args ?? {},
    ...(testCase.now === undefined ? {} : { now: testCase.now }),
  };

  // The pipeline decides. The inspector only renders — it never reinterprets.
  let decision;
  let verification;
  try {
    decision = await verifyAndEvaluate(input);
    verification = await verifyAuthority(input);
  } catch (error) {
    fail(`internal error while evaluating authority: ${error.message}`);
  }

  const explanation = toExplanation(decision, verification.ok ? verification.authority : undefined);

  if (opts.json) {
    process.stdout.write(JSON.stringify(explanation, null, 2) + '\n');
  } else {
    process.stdout.write(renderExplanation(explanation) + '\n');
    process.stdout.write('\nArgument values are intentionally omitted for privacy.\n');
  }

  process.exit(explanation.decision === 'ALLOW' ? EXIT_ALLOW : EXIT_DENY);
}

await main();

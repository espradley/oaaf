#!/usr/bin/env node
/**
 * oaaf conform — the cross-language conformance runner (O6C).
 *
 * The runner drives an *adapter* (any implementation, in any language) against the
 * portable corpus and reports whether the implementation satisfies the requested
 * OAAF conformance profiles. The adapter is a subprocess speaking a small JSON-lines
 * protocol (see spec/0.1/conformance/runner.md); it does NOT import any OAAF SDK,
 * which is the whole point — an independent Go/Rust/Java implementation can be driven
 * exactly the same way as the reference TypeScript and Python implementations.
 *
 * The runner produces self-declared, self-verifiable evidence. It is NOT a
 * certification authority: a PASS says "this implementation satisfied this corpus,"
 * not "OAAF certifies this implementation." Machine output (--json) is pristine — no
 * telemetry, no promotion, no participation prompt. A tasteful star nudge appears only
 * in human output, only on success.
 *
 * Usage:
 *   node scripts/oaaf-conform.mjs --adapter "<command>" [--profile Core,Status] [--json] [--corpus <path>]
 *
 * Exit codes: 0 = CONFORMANT, 1 = NOT CONFORMANT, 2 = runner/protocol error.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CORPUS = path.join(REPO_ROOT, 'spec', '0.1', 'conformance', 'vectors', 'corpus.json');
const RUNNER_VERSION = '0.1';
const KNOWN_PROFILES = ['Core', 'Status', 'Identity', 'MCP', 'A2A', 'PDP'];
const REPO_URL = 'https://github.com/espradley/oaaf';

function parseArgs(argv) {
  const args = { profile: null, json: false, corpus: DEFAULT_CORPUS, adapter: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--adapter') args.adapter = argv[++i];
    else if (a === '--corpus') args.corpus = argv[++i];
    else if (a === '--profile') args.profile = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

/** Canonicalize a comma-separated profile list (case-insensitive) to known names. */
function resolveProfiles(spec) {
  if (!spec) return null; // null => all profiles the adapter claims
  const wanted = spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const resolved = [];
  for (const w of wanted) {
    const match = KNOWN_PROFILES.find((p) => p.toLowerCase() === w.toLowerCase());
    if (!match) fail(`unknown profile "${w}" (known: ${KNOWN_PROFILES.join(', ')})`);
    resolved.push(match);
  }
  return resolved;
}

function fail(message) {
  process.stderr.write(`oaaf conform: ${message}\n`);
  process.exit(2);
}

/** A lock-step JSON-lines channel to the adapter subprocess. */
class Adapter {
  constructor(command) {
    this.child = spawn(command, { shell: true, stdio: ['pipe', 'pipe', 'inherit'] });
    this.child.on('error', (e) => fail(`could not start adapter: ${e.message}`));
    this.queue = [];
    this.rl = readline.createInterface({ input: this.child.stdout });
    this.rl.on('line', (line) => {
      const pending = this.queue.shift();
      if (!pending) return;
      try {
        pending.resolve(JSON.parse(line));
      } catch {
        pending.reject(new Error(`adapter emitted non-JSON line: ${line.slice(0, 200)}`));
      }
    });
    this.child.on('exit', (code) => {
      while (this.queue.length)
        this.queue.shift().reject(new Error(`adapter exited (code ${code})`));
    });
  }
  request(obj) {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.child.stdin.write(JSON.stringify(obj) + '\n');
    });
  }
  close() {
    try {
      this.child.stdin.write(JSON.stringify({ type: 'bye' }) + '\n');
      this.child.stdin.end();
    } catch {
      /* already gone */
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.adapter) {
    process.stdout.write(
      'Usage: node scripts/oaaf-conform.mjs --adapter "<command>" [--profile Core,Status] [--json] [--corpus <path>]\n',
    );
    process.exit(args.adapter ? 0 : 2);
  }

  const requested = resolveProfiles(args.profile);
  const corpusBytes = readFileSync(args.corpus);
  const corpus = JSON.parse(corpusBytes.toString('utf8'));
  const corpusHash = createHash('sha256').update(corpusBytes).digest('hex');

  const adapter = new Adapter(args.adapter);
  const hello = await adapter
    .request({ type: 'hello', runner: RUNNER_VERSION, corpus_version: corpus.corpus_version })
    .catch((e) => fail(e.message));
  if (!hello || hello.type !== 'hello' || !Array.isArray(hello.profiles)) {
    fail('adapter did not return a valid hello with a profiles array');
  }
  const claimed = hello.profiles.filter((p) => KNOWN_PROFILES.includes(p));

  // Which profiles are we judging? Requested ∩ known; default to what the adapter claims.
  const targetProfiles = requested ?? claimed;
  const unclaimed = targetProfiles.filter((p) => !claimed.includes(p));

  // Only run vectors for profiles the adapter both was asked for AND claims. A
  // requested-but-unclaimed profile makes the run NOT CONFORMANT on its own; we do
  // not test an implementation on a profile it does not implement.
  const judgedProfiles = targetProfiles.filter((p) => claimed.includes(p));
  const applicable = corpus.vectors.filter((v) => judgedProfiles.includes(v.profile));
  const failures = [];
  let passed = 0;

  for (const v of applicable) {
    let res;
    try {
      res = await adapter.request({
        type: 'evaluate',
        vector_id: v.vector_id,
        profile: v.profile,
        requirements: v.requirements,
        input: v.input,
      });
    } catch (e) {
      failures.push({
        vector_id: v.vector_id,
        requirements: v.requirements,
        reason: `adapter error: ${e.message}`,
      });
      continue;
    }
    const decisionOk = res?.decision === v.expected_decision;
    const reasonOk =
      v.expected_decision === 'allow'
        ? true
        : (res?.reason ?? null) === v.expected_normative_reason;
    // Privacy vectors: if the adapter returns its serialized output, no arg value may appear.
    let privacyOk = true;
    if (v.requirements.includes('CORE-EXPL-003') && typeof res?.output === 'string') {
      privacyOk = Object.values(v.input.args ?? {}).every(
        (val) => !res.output.includes(String(val)),
      );
    }
    if (decisionOk && reasonOk && privacyOk) {
      passed++;
    } else {
      failures.push({
        vector_id: v.vector_id,
        requirements: v.requirements,
        expected: { decision: v.expected_decision, reason: v.expected_normative_reason },
        actual: { decision: res?.decision ?? null, reason: res?.reason ?? null },
        ...(privacyOk ? {} : { privacy: 'argument value leaked into decision output' }),
      });
    }
  }
  adapter.close();

  const conformant = failures.length === 0 && unclaimed.length === 0 && applicable.length > 0;
  const report = {
    runner: RUNNER_VERSION,
    corpus: { version: corpus.corpus_version, sha256: corpusHash },
    profiles_requested: targetProfiles,
    profiles_claimed: claimed,
    profiles_unclaimed: unclaimed,
    applicable: applicable.length,
    passed,
    failed: failures.length,
    result: conformant ? 'CONFORMANT' : 'NOT CONFORMANT',
    self_declared: true,
    failures,
  };

  if (args.json) {
    // Pristine machine output: report object only, nothing else on stdout.
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    printHuman(report);
  }
  process.exit(conformant ? 0 : 1);
}

function printHuman(r) {
  const out = [];
  out.push(`OAAF ${r.profiles_requested.join(' + ')} ${r.corpus.version}`);
  out.push(`Corpus ${r.corpus.version} (sha256:${r.corpus.sha256.slice(0, 12)}…)`);
  out.push(`${r.applicable} applicable vectors`);
  out.push(`${r.passed} passed`);
  out.push(`${r.failed} failed`);
  if (r.profiles_unclaimed.length) {
    out.push(`not claimed by adapter: ${r.profiles_unclaimed.join(', ')}`);
  }
  out.push('');
  out.push(r.result);
  if (r.result === 'CONFORMANT') {
    // Self-declared, not certified.
    out.push('(self-declared, self-verified against the corpus above — OAAF does not certify)');
  } else {
    for (const f of r.failures.slice(0, 20)) {
      if (f.expected) {
        out.push(
          `  ✗ ${f.vector_id}: expected ${f.expected.decision}/${f.expected.reason ?? '—'}, ` +
            `got ${f.actual.decision ?? '?'}/${f.actual.reason ?? '—'}`,
        );
      } else {
        out.push(`  ✗ ${f.vector_id}: ${f.reason ?? f.privacy}`);
      }
    }
    if (r.profiles_unclaimed.length) {
      out.push(`  ✗ adapter does not claim: ${r.profiles_unclaimed.join(', ')}`);
    }
  }
  process.stdout.write(out.join('\n') + '\n');
  // Tasteful nudge: human output only, success only, never in --json.
  if (r.result === 'CONFORMANT') {
    process.stdout.write(`\n★ OAAF helped? Consider starring the project: ${REPO_URL}\n`);
  }
}

await main();

/**
 * OAAF guarding a real MCP server process.
 *
 * This example starts the open-source MCP filesystem server over stdio and
 * inserts the OAAF precondition before a real `tools/call`.
 *
 * Run with: npm run demo:mcp-filesystem
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { enforceAndMapToCoaz } from '@oaaf/sdk';
import { generateHolderKey, mintDerivedToken, mintPop, mintRootToken } from '@oaaf/sdk/testing';

const NOW = Math.floor(Date.now() / 1000);
const HOUR = 3600;
const READ_FILE = 'read_file';

const root = await mkdtemp(path.join(tmpdir(), 'oaaf-mcp-filesystem-'));
const publicReport = path.join(root, 'reports', 'q3.txt');
const privateReport = path.join(root, 'reports', 'q4.txt');

async function mockPdp(request) {
  console.log(`    -> PDP called for ${request.action.name} on ${request.resource.id} -> permit`);
  return { decision: true };
}

async function createAuthority() {
  const issuerKey = await generateHolderKey();
  const agentKey = await generateHolderKey();
  const workerKey = await generateHolderKey();

  const rootToken = await mintRootToken({
    issuer: 'https://authority.example',
    issuerKey,
    holder: agentKey,
    tools: {
      [READ_FILE]: {
        path: { constraint_type: 'one_of', values: [publicReport, privateReport] },
      },
    },
    issuedAt: NOW,
    expiresAt: NOW + HOUR,
    maxDepth: 2,
    jti: 'filesystem-root',
  });

  const delegatedToken = await mintDerivedToken({
    parentToken: rootToken,
    parentKey: agentKey,
    parentPayload: { del_depth: 0, del_max_depth: 2, exp: NOW + HOUR, iat: NOW },
    holder: workerKey,
    tools: {
      [READ_FILE]: {
        path: { constraint_type: 'exact', value: publicReport },
      },
    },
    issuedAt: NOW,
    expiresAt: NOW + HOUR / 2,
    jti: 'filesystem-worker',
  });

  return {
    chain: [rootToken, delegatedToken],
    trustAnchors: [issuerKey.publicJwk],
    workerKey,
  };
}

async function connectFilesystemServer() {
  const serverEntry = fileURLToPath(
    import.meta.resolve('@modelcontextprotocol/server-filesystem/dist/index.js'),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry, root],
  });
  const client = new Client({ name: 'oaaf-filesystem-guard-demo', version: '0.0.0' });
  await client.connect(transport);
  return client;
}

async function guardedRead({ client, authority, label, file }) {
  console.log(`\n${'-'.repeat(72)}`);
  console.log(`MCP tools/call -> ${READ_FILE}(${JSON.stringify({ path: file })})`);
  console.log(label);
  console.log('-'.repeat(72));

  const args = { path: file };
  const pop = await mintPop({
    leafKey: authority.workerKey,
    leafJti: 'filesystem-worker',
    tool: READ_FILE,
    args,
    issuedAt: NOW,
  });

  const guard = await enforceAndMapToCoaz({
    tokens: authority.chain,
    trustAnchors: authority.trustAnchors,
    pop,
    tool: READ_FILE,
    args,
    principal: 'urn:example:user:alice',
    agent: 'agent:filesystem-worker',
  });

  if (!guard.ok) {
    console.log('OAAF precondition: DENY');
    for (const reason of guard.error.data.reasons) {
      console.log(`  reason: ${reason.code} - ${reason.message}`);
    }
    console.log('  the real MCP server is not called.');
    return;
  }

  console.log('OAAF precondition: PASS');
  await mockPdp(guard.request);
  const result = await client.callTool({ name: READ_FILE, arguments: args });
  const text = result.content.find((item) => item.type === 'text')?.text ?? '';
  console.log(`  filesystem server returned: ${JSON.stringify(text.trim())}`);
}

let client;
try {
  await mkdir(path.join(root, 'reports'), { recursive: true });
  await writeFile(publicReport, 'Q3 fleet uptime: 99.95%\n');
  await writeFile(privateReport, 'Q4 incident plan: restricted\n');

  client = await connectFilesystemServer();
  const tools = await client.listTools();
  console.log(
    `Connected to @modelcontextprotocol/server-filesystem with ${tools.tools.length} tools.`,
  );

  const authority = await createAuthority();
  await guardedRead({
    client,
    authority,
    label: 'ALLOW - delegated authority includes this exact file',
    file: publicReport,
  });
  await guardedRead({
    client,
    authority,
    label: 'DENY - the filesystem server could read it, but this delegation cannot',
    file: privateReport,
  });
} finally {
  await client?.close();
  await rm(root, { recursive: true, force: true });
}

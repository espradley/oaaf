# OAAF in front of a real MCP filesystem server

This example starts the open-source
`@modelcontextprotocol/server-filesystem` package over stdio, then places the
OAAF delegated-authority precondition before a real `read_file` call.

From the repository root:

```bash
npm install
npm run demo:mcp-filesystem
```

The demo creates a temporary directory with two files and grants the worker
authority for only one of them. The allowed call reaches the real filesystem
MCP server. The denied call stops before `client.callTool()`, even though the
server is mounted over a directory that contains both files.

The PDP is deliberately permissive and prints when it is called, so the boundary
is visible:

```text
OAAF precondition: PASS
    -> PDP called for tools/call on read_file -> permit
    filesystem server returned: "Q3 fleet uptime: 99.95%"

OAAF precondition: DENY
  reason: ...
  the real MCP server is not called.
```

This is still an evaluation example, not production issuance. The authority
tokens are minted locally with `@oaaf/sdk/testing` so the guard can be tried
without a hosted issuer, account, service, or database.

# Changelog

All notable changes to `@oaaf/sdk` are documented here. The project is pre-1.0; see the
[versioning and compatibility policy](../../docs/versioning-and-compatibility.md).

## Unreleased

Not yet published to npm — the `@oaaf` scope is a pending ownership step (see
[docs/releasing.md](../../docs/releasing.md)). The packed artifact is certified publish-ready
in CI on every change (`npm run check:package`).

### Added

- AAT `-01` delegation-chain verification and AuthZEN 1.0 enforcement core.
- MCP / COAZ binding (RFC-0002) and A2A binding (RFC-0003), with certified cross-transport
  equivalence (RFC-0003C / O4B).
- Structured, privacy-safe decision explanations — names, never values (O4A).
- Revocation interoperability via a transport-neutral `StatusResolver` (RFC-0004).
- External subject identity binding via `IdentityBindingVerifier` (RFC-0005).
- Existing-PDP interoperability: `toAuthorityContext` / the canonical authority context and
  unified `context.oaaf` (RFC-0006).
- Public subpath exports: `.`, `/mcp`, `/a2a`, `/authzen`, `/testing`.

---
name: Interoperability bug
about: OAAF profiles a standard in a way that is wrong, incomplete, or diverges from its intent
labels: interop
---

<!-- For an SDK crash or a plainly wrong decision, "Bug report" fits better. Use this when the
issue is how OAAF *profiles or composes a standard* (AuthZEN, AAT, A2A, COAZ/MCP, SPIFFE, etc.).
For a security bypass, STOP and report privately per SECURITY.md. -->

**Standard and section**

Which standard, and the exact section/claim OAAF handles incorrectly.

**What OAAF does**

The current behavior — link the relevant [RFC](../../rfcs/README.md), requirement ID, or
[corpus vector](../../spec/0.1/conformance/vectors/README.md) if you can.

**What the standard requires / intends**

Why OAAF's profiling diverges.

**Impact on interoperability**

What breaks, or what a conformant-per-the-standard implementation would do differently.

**Environment**

- OAAF / `@oaaf/sdk` / `oaaf` version or commit:

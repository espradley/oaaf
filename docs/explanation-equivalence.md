# Cross-transport explanation equivalence (O4B)

O3C proved the authorization _decision_ is a property of the authority, not the
transport. O4B extends that to the _explanation_: for the same authority material and
requested operation, the MCP and A2A adapters produce an equivalent
`DecisionExplanation`.

## The invariant

> For the same authority chain, proof of possession, and requested operation:
>
> `explainMcpResult(mcpResult)` deep-equals `explainA2aResult(a2aResult)`

Certified in CI (`cross-transport.test.ts`). If a future adapter change drops or mutates
a canonical explanation field, the deep-equality fails and the build breaks.

## What equivalence is defined over

The canonical `DecisionExplanation` only:

- `decision` — `ALLOW` / `DENY`
- `reasons[]` — each `{ code, stage, message, tool?, argument?, tokenIndex? }`
- `authority?` — the `AuthoritySummary`: `subject`, `requestedTool`,
  `requestedArgumentNames`, `grantedTools`, `delegationDepth`, `chainLength`, `expiresAt`

Every field is authority-derived. There are **zero transport-derived fields inside
`DecisionExplanation`**.

## What is deliberately excluded (transport wrappers)

The comparison uses the canonical extractors `explainMcpResult` / `explainA2aResult`,
which strip exactly the legitimate transport envelope and nothing else:

| Excluded                                                  | Why it may differ                                                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| JSON-RPC numeric `code` (MCP) vs A2A numeric `code`       | Transport error-code space                                                                                                    |
| Transport-level `message` (the envelope's summary line)   | Transport presentation; the per-reason `message` inside `reasons[]` is compared and must match                                |
| MCP's PDP-facing `context` (the AuthZEN request fragment) | RFC-0002 wrapper for the PDP, not the developer explanation — and it now reuses the same `AuthoritySummary` vocabulary anyway |

This exclusion is **explicit and minimal**: the extractors remove only these wrappers.
Nothing normalizes away a substantive difference — the extractors do not, for example,
sort or rename reason fields.

## A note on transport-specific reasons

Some denials are legitimately transport-specific _preconditions_, not authority
evaluations — A2A's `extension_not_activated`, `authority_material_missing`, and
`pop_recipient_mismatch` have no MCP equivalent. The equivalence claim is over inputs both
adapters evaluate the same way: a shared authority failure (bad signature, expiry,
narrowing, unauthorized tool, argument constraint, chain integrity) produces the same
canonical reason from the same core denial. Transport-specific preconditions are outside
the equivalence claim by construction, because they describe the transport step, not the
authority.

## Privacy equivalence

Both transports expose the same privacy-safe explanation: names, never values. Neither
leaks argument values, token bytes, signatures, PoP material, or keys where the other
suppresses them — asserted per representative case.

## Scope

This is authority-evaluation equivalence only. It says nothing about execution — whether
an operation ran, completed, retried, or was recovered. Those are not OAAF concerns and
appear in no explanation field.

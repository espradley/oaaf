/**
 * `@oaaf/sdk` — TypeScript SDK for the Open Agent Authority Framework.
 *
 * This package is intentionally almost empty.
 *
 * OAAF's protocol types — authority grants, capabilities, resources,
 * constraints, delegation, decisions, and evidence — are
 * deliberately *not* defined here yet. Defining them prematurely would freeze
 * protocol semantics before they have been argued through the RFC process.
 *
 * What exists today is the build, type, and test architecture, plus the spec
 * version this SDK targets. Protocol surface arrives via RFC-0001 onward.
 *
 * See `rfcs/README.md` for the RFC process and `spec/0.1/architecture.md` for
 * the architectural model.
 */

/** Specification versions this SDK understands. */
export type SpecVersion = '0.1';

/**
 * The OAAF specification version this SDK targets.
 *
 * Spec versions are independent of the SDK's own package version: several SDK
 * releases may target one spec version.
 */
export const OAAF_SPEC_VERSION = '0.1' satisfies SpecVersion;

const SUPPORTED_SPEC_VERSIONS: readonly string[] = [OAAF_SPEC_VERSION];

/**
 * Narrow an arbitrary string to a spec version this SDK supports.
 *
 * Callers reading a version off the wire should treat an unsupported version as
 * a reason to refuse the exchange rather than to guess at its meaning — OAAF
 * fails closed.
 */
export function isSupportedSpecVersion(value: string): value is SpecVersion {
  return SUPPORTED_SPEC_VERSIONS.includes(value);
}

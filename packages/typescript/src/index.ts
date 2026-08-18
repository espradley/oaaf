/**
 * `@oaaf/sdk` — TypeScript SDK for the Open Agent Authority Framework.
 *
 * This package is intentionally almost empty.
 *
 * OAAF adopts existing standards for authority, delegation, decisions, and
 * evidence rather than defining its own. Which standards, at which revisions,
 * is still being settled through the RFC process, so no types for them are
 * published here yet — shipping the wrong shapes is much harder to undo than
 * leaving them unwritten.
 *
 * What exists today is the build, type, and test architecture, plus the
 * profile version this SDK targets. The verification and decision surface
 * arrives with the first enforcement point.
 *
 * See `docs/adr/0003-implement-existing-authority-standards.md` for the
 * decision, `rfcs/README.md` for the RFC process, and
 * `spec/0.1/architecture.md` for the architectural model.
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

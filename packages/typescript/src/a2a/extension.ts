/**
 * The OAAF A2A extension descriptor — RFC-0003.
 *
 * Constants an A2A agent uses to declare, activate, and carry OAAF delegated
 * authority. These are the extension's identity and its metadata contract; the
 * verification behaviour lives in `binding.ts`.
 *
 * A2A version targeted: 1.0.1.
 */

/** The extension URI. Identifies this specification, not an endpoint. */
export const OAAF_A2A_EXTENSION_URI = 'https://oaaf.dev/a2a/authority/v1';

/** Metadata key carrying the AAT delegation chain (JSON array of compact JWS). */
export const METADATA_KEY_CHAIN = `${OAAF_A2A_EXTENSION_URI}/chain`;

/** Metadata key carrying the proof-of-possession JWT (compact JWS). */
export const METADATA_KEY_POP = `${OAAF_A2A_EXTENSION_URI}/pop`;

/**
 * The `AgentExtension` object an OAAF-aware agent places in its Agent Card under
 * `capabilities.extensions`. Gated skills require it.
 */
export const OAAF_AGENT_EXTENSION = {
  uri: OAAF_A2A_EXTENSION_URI,
  description: 'Requires delegated OAAF authority (AAT) for consequential skills.',
  required: true,
} as const;

/**
 * Minimal shape of an A2A Message this binding reads. Only the parts O3B needs;
 * the full A2A Message has more.
 */
export interface A2aMessage {
  /** Extension data lives here, keyed by URI (A2A §4.6). */
  metadata?: Record<string, unknown>;
}

/**
 * Did the client activate this extension?
 *
 * Activation is the `A2A-Extensions` service parameter (an HTTP header),
 * a comma-separated list of URIs. Pass the already-parsed list.
 */
export function isExtensionActivated(activatedExtensionUris: readonly string[]): boolean {
  return activatedExtensionUris.includes(OAAF_A2A_EXTENSION_URI);
}

/** Extract the AAT chain from a Message's metadata. Null if absent or malformed. */
export function extractChain(message: A2aMessage): string[] | null {
  const value = message.metadata?.[METADATA_KEY_CHAIN];
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === 'string')) return null;
  return value as string[];
}

/** Extract the PoP JWT from a Message's metadata. Null if absent or malformed. */
export function extractPop(message: A2aMessage): string | null {
  const value = message.metadata?.[METADATA_KEY_POP];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

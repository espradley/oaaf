/**
 * External subject identity binding — RFC-0005.
 *
 * OAAF binds authority to an identity established elsewhere (SPIFFE, WIMSE, an
 * OIDC provider); it is not an identity provider. A token may carry a `sub`
 * claim holding an external subject identifier URI; `cnf.jwk` remains the
 * proof-of-possession key. When the identity provider is a different principal
 * than the authority issuer, a deployment supplies a verifier that confirms the
 * subject corresponds to the holder key.
 */

export type IdentityBinding = 'bound' | 'mismatch' | 'unavailable';

/**
 * Confirm that an external subject corresponds to the holder key.
 *
 * @param subject          the token's `sub` (an external identity URI)
 * @param holderThumbprint the holder key's JWK Thumbprint URI (the PoP key)
 * @param now              evaluation time, seconds since epoch
 */
export type IdentityBindingVerifier = (
  subject: string,
  holderThumbprint: string,
  now: number,
) => IdentityBinding | Promise<IdentityBinding>;

/** The identity profile of a subject URI — its scheme — for safe display. */
export function subjectProfile(subject: string): string {
  const i = subject.indexOf(':');
  if (i <= 0) return 'unknown';
  const scheme = subject.slice(0, i).toLowerCase();
  if (scheme === 'urn' && subject.startsWith('urn:ietf:params:oauth:jwk-thumbprint')) {
    return 'thumbprint';
  }
  return scheme;
}

/** True when a string is a usable subject identifier URI (has a scheme). */
export function isSubjectUri(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

/**
 * A convenience verifier over sets of subjects the deployment has confirmed, and
 * optionally subjects whose binding is unavailable. Everything else mismatches.
 * Models the essential output of any identity check; not a SPIFFE/WIMSE verifier.
 */
export function boundSubjectsVerifier(
  bound: Iterable<string>,
  unavailable: Iterable<string> = [],
): IdentityBindingVerifier {
  const boundSet = new Set(bound);
  const unavailableSet = new Set(unavailable);
  return (subject) => {
    if (unavailableSet.has(subject)) return 'unavailable';
    if (boundSet.has(subject)) return 'bound';
    return 'mismatch';
  };
}

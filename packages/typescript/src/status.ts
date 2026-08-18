/**
 * Authority status / revocation — RFC-0004.
 *
 * OAAF does not operate a revocation service. A deployment supplies a resolver
 * that answers, for one token identity, whether it is currently active, revoked,
 * or of unknown status. The verifier checks every token in a chain, so revoking
 * an ancestor invalidates its descendants. Failing to establish a required
 * status denies (fail closed).
 *
 * The resolver's *source* — a Token Status List it verified, an RFC 7662
 * introspection call, a signed set on disk — is out of scope here; OAAF defines
 * only this three-valued contract.
 */

export type TokenStatus = 'active' | 'revoked' | 'unknown';

/**
 * Resolve the current status of one token.
 *
 * @param tokenId the token's `jti`
 * @param issuer  the token's `iss` (root issuer URI, or a derived token's parent
 *                thumbprint URI)
 * @param now     evaluation time, seconds since epoch
 */
export type StatusResolver = (
  tokenId: string,
  issuer: string,
  now: number,
) => TokenStatus | Promise<TokenStatus>;

/**
 * A convenience resolver over a set of revoked `jti`s, and optionally a set whose
 * status is unknown (unreachable/stale source). Everything else is active.
 *
 * This models the essential output of any status mechanism; it is not a Token
 * Status List implementation.
 */
export function revokedSetResolver(
  revoked: Iterable<string>,
  unknown: Iterable<string> = [],
): StatusResolver {
  const revokedSet = new Set(revoked);
  const unknownSet = new Set(unknown);
  return (tokenId) => {
    if (revokedSet.has(tokenId)) return 'revoked';
    if (unknownSet.has(tokenId)) return 'unknown';
    return 'active';
  };
}

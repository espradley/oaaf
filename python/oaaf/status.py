"""Authority status / revocation contract (RFC-0004).

A deployment supplies a resolver answering, for one token identity, whether it is
active, revoked, or of unknown status. OAAF does not operate a revocation
service; it defines only this three-valued verifier-side contract. The verifier
checks every token in a chain, so a revoked ancestor invalidates its descendants.
"""

from __future__ import annotations

from typing import Callable, Iterable, Literal

TokenStatus = Literal["active", "revoked", "unknown"]

# resolve(token_id, issuer, now) -> "active" | "revoked" | "unknown"
StatusResolver = Callable[[str, str, int], TokenStatus]


def revoked_set_resolver(
    revoked: Iterable[str], unknown: Iterable[str] = ()
) -> StatusResolver:
    """A resolver over a set of revoked jtis and an optional unknown-status set.

    Models the essential output of any status mechanism; not a Token Status List
    implementation.
    """
    revoked_set = set(revoked)
    unknown_set = set(unknown)

    def resolve(token_id: str, issuer: str, now: int) -> TokenStatus:
        if token_id in revoked_set:
            return "revoked"
        if token_id in unknown_set:
            return "unknown"
        return "active"

    return resolve

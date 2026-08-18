"""External subject identity binding (RFC-0005).

OAAF binds authority to an identity established elsewhere (SPIFFE, WIMSE, OIDC);
it is not an identity provider. A token may carry a `sub` claim holding an
external subject identifier URI; `cnf.jwk` remains the proof-of-possession key.
"""

from __future__ import annotations

import re
from typing import Callable, Iterable, Literal

IdentityBinding = Literal["bound", "mismatch", "unavailable"]

# verify(subject, holder_thumbprint, now) -> "bound" | "mismatch" | "unavailable"
IdentityBindingVerifier = Callable[[str, str, int], IdentityBinding]

_URI = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")


def is_subject_uri(value: object) -> bool:
    return isinstance(value, str) and bool(_URI.match(value))


def subject_profile(subject: str) -> str:
    """The identity profile of a subject URI — its scheme — for safe display."""
    i = subject.find(":")
    if i <= 0:
        return "unknown"
    scheme = subject[:i].lower()
    if scheme == "urn" and subject.startswith("urn:ietf:params:oauth:jwk-thumbprint"):
        return "thumbprint"
    return scheme


def bound_subjects_verifier(
    bound: Iterable[str], unavailable: Iterable[str] = ()
) -> IdentityBindingVerifier:
    """A verifier over confirmed subjects and optionally unavailable ones."""
    bound_set = set(bound)
    unavailable_set = set(unavailable)

    def verify(subject: str, holder_thumbprint: str, now: int) -> IdentityBinding:
        if subject in unavailable_set:
            return "unavailable"
        if subject in bound_set:
            return "bound"
        return "mismatch"

    return verify

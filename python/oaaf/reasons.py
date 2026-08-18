"""Canonical OAAF reason codes and verification stages.

These are the normative, language-independent identifiers a denial carries. They
are identical to the reference implementation's; a Python-specific reason name
would be a conformance defect, not a convenience.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

Stage = Literal["chain", "leaf", "pop", "evaluation", "a2a", "status", "identity"]

# The 49 canonical reason codes. Order mirrors the reference for readability only;
# membership and spelling are what matter.
REASON_CODES: tuple[str, ...] = (
    # structure
    "chain_empty",
    "chain_too_long",
    "chain_cycle_detected",
    "token_malformed",
    "token_too_large",
    "authorization_details_invalid",
    "par_hash_present_on_root",
    "par_hash_missing",
    # cryptography
    "invalid_signature",
    "algorithm_not_permitted",
    "untrusted_root",
    "private_key_material",
    "issuer_thumbprint_mismatch",
    "par_hash_mismatch",
    "holder_key_invalid",
    # temporal
    "expired",
    "not_yet_valid",
    "expiry_exceeds_parent",
    "issued_before_parent",
    "expiry_not_after_issuance",
    "lifetime_exceeded",
    # delegation
    "delegation_depth_invalid",
    "delegation_depth_exceeded",
    "delegation_ceiling_raised",
    "delegation_ceiling_invalid",
    "depth_exceeds_own_ceiling",
    "chain_length_mismatch",
    "root_depth_invalid",
    # narrowing
    "tool_not_delegated",
    "constraint_expansion",
    "constraint_type_unrecognized",
    "constraint_type_not_permitted",
    "argument_key_set_mismatch",
    "constraint_too_deep",
    # leaf / request
    "tool_not_authorized",
    "argument_not_permitted",
    "argument_missing",
    "argument_constraint_violated",
    # proof of possession
    "pop_missing",
    "pop_malformed",
    "pop_signature_invalid",
    "pop_token_mismatch",
    "pop_tool_mismatch",
    "pop_binding_mismatch",
    "pop_stale",
    "pop_recipient_mismatch",
    # revocation / status (RFC-0004)
    "authority_revoked",
    "status_unavailable",
    # external subject identity binding (RFC-0005)
    "subject_identity_mismatch",
    "identity_binding_unavailable",
    # a2a binding
    "extension_not_activated",
    "authority_material_missing",
    "caller_holder_mismatch",
)


@dataclass(frozen=True)
class Denial:
    """One reason a decision came out as it did — locators are names, never values."""

    code: str
    stage: Stage
    message: str
    token_index: Optional[int] = None
    tool: Optional[str] = None
    argument: Optional[str] = None


def denial(
    code: str,
    stage: Stage,
    message: str,
    *,
    token_index: Optional[int] = None,
    tool: Optional[str] = None,
    argument: Optional[str] = None,
) -> Denial:
    return Denial(code, stage, message, token_index, tool, argument)

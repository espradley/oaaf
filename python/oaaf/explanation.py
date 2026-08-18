"""The canonical, privacy-safe DecisionExplanation — names, never values."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .reasons import Denial
from .identity import subject_profile
from .verify import VerifiedChain


@dataclass(frozen=True)
class ReasonExplanation:
    code: str
    stage: str
    message: str
    tool: Optional[str] = None
    argument: Optional[str] = None
    token_index: Optional[int] = None


@dataclass(frozen=True)
class AuthoritySummary:
    subject: str
    subject_profile: str
    holder: str
    requested_tool: str
    requested_argument_names: list[str]
    granted_tools: list[str]
    delegation_depth: int
    chain_length: int
    expires_at: int


@dataclass(frozen=True)
class DecisionExplanation:
    decision: str  # "ALLOW" | "DENY"
    reasons: list[ReasonExplanation] = field(default_factory=list)
    authority: Optional[AuthoritySummary] = None


def explain_reasons(denials: list[Denial]) -> list[ReasonExplanation]:
    return [
        ReasonExplanation(
            code=d.code,
            stage=d.stage,
            message=d.message,
            tool=d.tool,
            argument=d.argument,
            token_index=d.token_index,
        )
        for d in denials
    ]


def summarize_authority(chain: VerifiedChain, tool: str, args: dict) -> AuthoritySummary:
    return AuthoritySummary(
        subject=chain.leaf_subject,
        subject_profile=subject_profile(chain.leaf_subject),
        holder=chain.leaf_holder,
        requested_tool=tool,
        requested_argument_names=list(args.keys()),
        granted_tools=sorted(chain.leaf_tools.keys()),
        delegation_depth=chain.depth,
        chain_length=len(chain.tokens),
        expires_at=chain.expires_at,
    )


@dataclass(frozen=True)
class AuthorityContext:
    """The canonical authority context (RFC-0006): the verified-authority facts an
    external PDP consults when making the organization's policy decision.

    OAAF conveys this to the PDP; the PDP owns the policy decision. `authority_verified`
    states OAAF's authority decision, not that the action is permitted.
    """

    authority_verified: bool
    subject: str
    subject_profile: str
    holder: str
    requested_tool: str
    requested_argument_names: list[str]
    granted_tools: list[str]
    delegation_depth: int
    chain_length: int
    expires_at: int


def to_authority_context(chain: VerifiedChain, tool: str, args: dict) -> AuthorityContext:
    """Build the canonical authority context from a verified authority (RFC-0006)."""
    summary = summarize_authority(chain, tool, args)
    return AuthorityContext(
        authority_verified=True,
        subject=summary.subject,
        subject_profile=summary.subject_profile,
        holder=summary.holder,
        requested_tool=summary.requested_tool,
        requested_argument_names=summary.requested_argument_names,
        granted_tools=summary.granted_tools,
        delegation_depth=summary.delegation_depth,
        chain_length=summary.chain_length,
        expires_at=summary.expires_at,
    )

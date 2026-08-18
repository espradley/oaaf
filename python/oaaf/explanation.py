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

"""OAAF — independent Python implementation of the authority contract.

TypeScript (@oaaf/sdk) and this package are two implementations of the same
normative behavior: authority verification and evaluation, the canonical reason
codes, and the DecisionExplanation. Neither is the specification; the RFCs and
adopted standards are.
"""

from .decide import verify_and_evaluate
from .explanation import (
    AuthoritySummary,
    DecisionExplanation,
    ReasonExplanation,
)
from .reasons import REASON_CODES, Denial
from .status import revoked_set_resolver, StatusResolver, TokenStatus
from .verify import VerifiedChain, verify_chain

__all__ = [
    "verify_and_evaluate",
    "verify_chain",
    "VerifiedChain",
    "DecisionExplanation",
    "ReasonExplanation",
    "AuthoritySummary",
    "REASON_CODES",
    "Denial",
    "revoked_set_resolver",
    "StatusResolver",
    "TokenStatus",
]
__version__ = "0.1.0"

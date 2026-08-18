"""Enforcement: verify presented authority, then decide.

verify_and_evaluate is the enforcement entry point — full chain verification,
proof of possession, optional recipient binding, then evaluation. It fails
closed and returns a canonical DecisionExplanation.
"""

from __future__ import annotations

from typing import Optional

from .constraints import is_constraint, satisfies
from .explanation import (
    AuthoritySummary,
    DecisionExplanation,
    ReasonExplanation,
    explain_reasons,
    summarize_authority,
)
from .pop import pop_audience, verify_pop
from .reasons import Denial, denial
from .status import StatusResolver
from .verify import VerifiedChain, verify_chain


def _evaluate(chain: VerifiedChain, tool: str, args: dict) -> list[Denial]:
    constraints = chain.leaf_tools.get(tool)
    if constraints is None:
        return [denial("tool_not_authorized", "evaluation", f'Tool "{tool}" is not permitted by this authority.', tool=tool)]

    constrained = len(constraints) > 0
    out: list[Denial] = []
    if constrained:
        for argument in constraints:
            if argument not in args:
                out.append(denial("argument_missing", "evaluation", f'Argument "{argument}" is constrained by this authority and must be supplied.', tool=tool, argument=argument))
    for argument, value in args.items():
        c = constraints.get(argument)
        if c is None:
            if constrained:
                out.append(denial("argument_not_permitted", "evaluation", f'Argument "{argument}" is not covered by the constraints on "{tool}".', tool=tool, argument=argument))
            continue
        if not is_constraint(c):
            out.append(denial("constraint_type_unrecognized", "evaluation", f'Constraint on "{tool}.{argument}" is malformed or of an unknown type.', tool=tool, argument=argument))
            continue
        if not satisfies(c, value):
            out.append(denial("argument_constraint_violated", "evaluation", f'Argument "{argument}" does not satisfy the constraint on "{tool}".', tool=tool, argument=argument))
    return out


def _check_recipient(pop: str, recipient: str, required: bool) -> Optional[Denial]:
    aud = pop_audience(pop)
    if aud is None:
        if required:
            return denial("pop_recipient_mismatch", "a2a", "Recipient binding is required but the proof of possession carries no aat_aud.")
        return None
    if aud != recipient:
        return denial("pop_recipient_mismatch", "a2a", "The proof of possession is bound to a different recipient than this agent.")
    return None


def verify_and_evaluate(
    tokens: list[str],
    trust_anchors: list[dict],
    pop: str,
    tool: str,
    args: Optional[dict] = None,
    now: Optional[int] = None,
    recipient: Optional[str] = None,
    require_recipient_binding: bool = False,
    status_resolver: Optional[StatusResolver] = None,
    allow_unknown_status: bool = False,
) -> DecisionExplanation:
    """Full enforcement, returning the canonical explanation. Fails closed."""
    import time

    args = args or {}
    now = now if now is not None else int(time.time())

    chain, chain_denials = verify_chain(tokens, trust_anchors, now)
    if chain is None:
        return DecisionExplanation(decision="DENY", reasons=explain_reasons(chain_denials))

    # Revocation / status (RFC-0004): check every chain member; fail closed on unknown.
    if status_resolver is not None:
        for i, token in enumerate(chain.tokens):
            status = status_resolver(token["jti"], token["iss"], now)
            if status == "revoked":
                return DecisionExplanation(
                    decision="DENY",
                    reasons=explain_reasons([denial("authority_revoked", "status", "Authority has been revoked.", token_index=i)]),
                )
            if status == "unknown" and not allow_unknown_status:
                return DecisionExplanation(
                    decision="DENY",
                    reasons=explain_reasons([denial("status_unavailable", "status", "Required revocation status could not be established.", token_index=i)]),
                )

    pop_denials = verify_pop(pop, chain, tool, args, now)
    if pop_denials:
        return DecisionExplanation(decision="DENY", reasons=explain_reasons(pop_denials))

    if recipient is not None:
        rec = _check_recipient(pop, recipient, require_recipient_binding)
        if rec is not None:
            return DecisionExplanation(decision="DENY", reasons=explain_reasons([rec]))

    eval_denials = _evaluate(chain, tool, args)
    summary = summarize_authority(chain, tool, args)
    if eval_denials:
        return DecisionExplanation(decision="DENY", reasons=explain_reasons(eval_denials), authority=summary)
    return DecisionExplanation(decision="ALLOW", reasons=[], authority=summary)

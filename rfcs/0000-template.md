---
rfc: 0000
title: <short descriptive title>
status: Draft
authors: <name or handle>
created: <YYYY-MM-DD>
supersedes: <RFC number, or none>
---

# RFC-0000: <title>

## Summary

One paragraph. What changes, in plain language.

## Motivation

What problem does this solve? Who has it? What breaks or stays impossible without
this?

Concrete failure cases are much more persuasive than abstractions. If you have hit
this in a real system, describe what happened.

## Charter fit

Answer the [litmus test](../CHARTER.md#the-litmus-test) explicitly.

Does this answer _"is this actor authorized to perform this action under this
authority?"_ — or does it answer _"what should happen next, who should do it, how
should work be coordinated?"_

If the answer is not clearly the first, argue the case here. An RFC that skips this
section will be sent back.

## Design

The proposal itself. Include:

- concepts introduced or changed
- data shapes, with examples
- how an enforcement point evaluates this
- what a verifier must reject, and what it may ignore
- interaction with delegation and revocation

Show a worked example. Abstract schemas hide ambiguity that examples expose.

## Security considerations

Required — this is an authority protocol.

- What can an attacker attempt against this design?
- What happens on malformed, missing, or ambiguous input? Confirm it fails closed.
- Can it be replayed? Widened through delegation? Made to survive revocation or
  expiry?
- What does it assume about the trust root, clocks, or transport?
- Does it expand what a compromised or prompt-injected agent can accomplish?

## Compatibility

Effect on existing implementations and spec versions. Is this a breaking change? Can
an older verifier safely encounter this, or must it refuse?

## Alternatives considered

What else was on the table, and why this instead. Include "do nothing" and say what it
costs.

## Unresolved questions

What is deliberately left open, and what would settle it.

## Prior art

Related work in IAM, capability systems, distributed systems, or other agent
protocols. Borrowing a solved design is a feature, not a weakness.

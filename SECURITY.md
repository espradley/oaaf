# Security Policy

OAAF enforces authority. A flaw here is not a bug that produces wrong output —
it is a flaw that lets an action happen which should have been refused. We would
rather hear about a suspected problem and be wrong than not hear about it.

## Reporting a vulnerability

**Please do not open a public issue for a suspected vulnerability.**

Report privately by opening a
[security advisory](https://github.com/espradley/oaaf/security/advisories/new) on this
repository. That channel is visible only to maintainers.

Private vulnerability reporting is enabled on this repository, so that link works. If for
any reason it does not, open an issue saying only that you have a security report to make
— with no details — and a maintainer will arrange a private channel.

Useful reports usually include:

- what an attacker gains — the action that becomes possible and the authority that
  should have prevented it
- the conditions required, and how realistic they are
- a proof of concept, a failing test, or a concrete sequence of steps
- affected versions or commits

You are welcome to report anonymously. If you would like credit for the finding, say
so and we will name you in the advisory.

## What to expect

|                              |                                      |
| ---------------------------- | ------------------------------------ |
| Acknowledgement              | within 3 business days               |
| Initial assessment           | within 10 business days              |
| Fix or documented mitigation | target 90 days, coordinated with you |

These are the current commitments of a small, founder-led project. They are targets,
not a contractual SLA, and we would rather state modest numbers we can meet than
impressive ones we cannot.

We will keep you informed as the assessment progresses, credit you unless you prefer
otherwise, and publish an advisory when a fix ships.

## Scope

**In scope** — anything that causes an action to be permitted when it should be
refused, or that leaks what the explanation surface is meant to withhold:

- **signature verification bypass** — accepting a forged, tampered, or unsigned token
- **scope widening** — an action permitted beyond the authority actually granted
- **delegation attenuation failure** — a child grant broader than its parent
- **chain validation bypass** — accepting a truncated, reordered, or mis-linked chain
- **proof-of-possession bypass** — acting without the holder's key, or replaying a proof
- **recipient / holder confusion** — authority accepted by or for the wrong party
- **revocation bypass** — revoked authority surviving a configured status resolver, or a resolver failure treated as active ([revocation](docs/revocation.md))
- **malformed-input authorization bypass** — a verifier that fails _open_ on malformed,
  ambiguous, or unverifiable input instead of denying
- **explanation / privacy leak** — an explanation exposing argument values, token bytes,
  signatures, proof-of-possession material, or keys
- **conformance defect** — behavior that lets two implementations disagree about a
  security-relevant decision
- flaws in an RFC or the specification itself, not only in the code

**Out of scope for now**, because they do not yet exist: hosted infrastructure, the
reference authority service, and production deployment configurations.

Also out of scope: an agent behaving badly _within_ the authority it was correctly
granted, and portable signed receipts, which OAAF does not yet produce. OAAF's job is to enforce the boundary of a grant, not to make the grant wise.
An over-broad grant that permits exactly what it says is a policy problem, not a
vulnerability — though if OAAF makes over-broad grants the path of least resistance,
that _is_ worth reporting as a design flaw.

## Security posture

Stated plainly, because a security policy that implies more assurance than exists is
itself a hazard:

- OAAF has **not** been independently audited.
- It holds **no** security certification of any kind.
- The profile and its bindings are **early** and still moving; several adopted standards
  are themselves drafts, pinned by revision.
- No part of this project should be relied upon as a production security control
  today.

The design intent is to fail closed — authority that is unverifiable, expired,
revoked, or malformed must deny the action — and to assume the agent presenting
authority may be prompt-injected, compromised, or malicious. Verification must never
depend on agent self-restraint. Where the implementation does not yet meet that
intent, that is a bug worth reporting.

## Supported versions

Pre-1.0, only the latest release receives fixes. There are no long-term support
branches.

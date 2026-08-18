# Identity and workload interoperability

OAAF can bind authority to an identity established by an existing system — SPIFFE, WIMSE,
an OIDC provider — **without becoming an identity provider**. The normative contract is
[RFC-0005](../rfcs/0005-external-subject-identity-binding.md).

> **Bring your identity. OAAF carries the authority.**
>
> Identity says _who_ the workload is. OAAF authority says _what_ that subject may do.

## Four things that used to be one

Before O5D, OAAF's subject was the holder's key thumbprint — identity and PoP key were the
same field. RFC-0005 separates four distinct, securely-bound concepts:

| Concept                       | What it is                                                       | Where                                              |
| ----------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| **Subject identity**          | who the workload is (e.g. `spiffe://company.example/agents/bob`) | the token's `sub`                                  |
| **Authentication credential** | how the workload proved that to its identity system              | an SVID / OIDC token — **external, never in OAAF** |
| **Proof-of-possession key**   | what the holder signs invocations with                           | `cnf.jwk`                                          |
| **Authority**                 | what the subject may do                                          | the AAT grant                                      |

They are _bound_, not merged: the trusted authority issuer signs a grant carrying both the
`sub` and the `cnf.jwk`; PoP proves possession of that key; an optional verifier
independently confirms the subject↔holder binding. A string subject never weakens PoP — a
stranger's proof still fails even for a perfectly valid, verified subject.

## Existing model → external identity model

```text
Existing (still supported, default):
  cnf.jwk ── thumbprint ──► subject

External identity (RFC-0005):
  SPIFFE / WIMSE / OIDC establishes the subject
        │  sub = spiffe://company.example/agents/bob
        ▼
  OAAF grant: { sub, cnf.jwk, authority }   (issuer binds them, signs)
        │
        ▼
  subject = spiffe://…/bob     holder = <cnf.jwk thumbprint>   (distinct)
```

## Standards this binds to

| System                    | `sub` form                                                     | Status               |
| ------------------------- | -------------------------------------------------------------- | -------------------- |
| SPIFFE JWT-SVID           | `spiffe://trust-domain/path`                                   | stable               |
| WIMSE Workload Identifier | `wimse://trust-domain/path` (`draft-ietf-wimse-identifier-03`) | experimental (draft) |
| OIDC                      | a collision-safe `iss`+`sub` URI                               | stable               |
| (none)                    | JWK thumbprint URI                                             | default, unchanged   |

Every one uses the JWT-standard `sub`, so OAAF invents no identifier scheme — it reads
`sub`. WIMSE support is experimental because its drafts are moving.

## The identity-binding verifier

When the identity provider is a different principal than the authority issuer, a deployment
supplies a verifier:

```ts
// TypeScript
type IdentityBindingVerifier = (subject, holderThumbprint, now)
  => 'bound' | 'mismatch' | 'unavailable' | Promise<...>;
```

```python
# Python
IdentityBindingVerifier = Callable[[str, str, int], Literal["bound", "mismatch", "unavailable"]]
```

It is where a SPIFFE/WIMSE/OIDC-aware deployment confirms the subject genuinely corresponds
to the holder key, using its own infrastructure. OAAF defines the three-valued contract, not
the verification. Both packages ship `boundSubjectsVerifier` / `bound_subjects_verifier` —
a convenience over a confirmed-subjects set, for tests and simple deployments; it is not a
SPIFFE/WIMSE verifier.

- **No verifier** → the issuer's signed `sub` assertion is trusted (like an IdP asserting
  `sub`). Default.
- **Verifier + `mismatch`** → `subject_identity_mismatch`.
- **Verifier + `unavailable`** → `identity_binding_unavailable` (fail closed) unless the
  deployment opts into a documented weaker mode.

## Trust model

| Principal                            | Trusted to                                         |
| ------------------------------------ | -------------------------------------------------- |
| Identity provider (SPIFFE/WIMSE/IdP) | establish the subject                              |
| Authority issuer                     | issue authority and bind a subject to a holder key |
| Holder                               | prove possession of `cnf.jwk`                      |
| Recipient                            | verify authority is intended for it (RFC-0003)     |

These may be different operators. A project that owns identity can say _"we establish who
the agent is; OAAF carries what it may do"_ — and plug in, rather than compete.

## What OAAF does not do

No registration, provisioning, attestation, credential issuance, certificate authority,
SVID rotation, OAuth/OIDC server, login, user database, agent inventory, or identity
dashboard. An identity may _name_ an actor; OAAF does not decide whether that actor should
receive work.

## Reason codes

| Code                           | Stage      | Meaning                                                         |
| ------------------------------ | ---------- | --------------------------------------------------------------- |
| `subject_identity_mismatch`    | `identity` | The verifier says the subject does not correspond to the holder |
| `identity_binding_unavailable` | `identity` | Required binding could not be established; fail closed          |

Distinct from `pop_signature_invalid` (possession), `caller_holder_mismatch` (transport
caller vs holder), `pop_recipient_mismatch` (recipient). The O3B distinction holds:
caller↔holder correspondence is topology-dependent (relays are legitimate);
PoP-holder↔authority-holder correspondence is security-critical and always enforced.

## Privacy

Subject identifiers can themselves be sensitive — a `spiffe://` path can reveal internal
structure. The explanation exposes the `sub` and its profile (scheme) but **never** an SVID,
JWT credential, certificate, OIDC token, authorization header, key material, or attestation
document. Scope where explanations are logged if subject identifiers are sensitive.

## Security

Threats assessed in [RFC-0005](../rfcs/0005-external-subject-identity-binding.md): subject
substitution, issuer confusion, cross-issuer `sub` collision, SPIFFE trust-domain confusion,
syntactically-valid-but-untrusted IDs, identity↔PoP and caller↔holder confusion, stale
credentials, verifier-failure-read-as-verified, identity downgrade, and mixed providers
across delegation. Required identity that cannot be established fails closed.

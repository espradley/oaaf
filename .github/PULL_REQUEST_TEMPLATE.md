<!-- A typo or a focused bug fix needs almost none of this. A change to authorization
behavior needs all of it. Delete what does not apply. -->

## What and why

<!-- One or two sentences. Link the issue/RFC if there is one. -->

## Checklist

- [ ] `npm run check` passes locally (real exit code, not grepped output)
- [ ] Tests added for behavior changes (adversarial ones for security-sensitive code)
- [ ] Commits signed off (`git commit -s`, DCO)

## Impact

- **Compatibility:** none / additive / breaking — if not "none", see
  [versioning-and-compatibility.md](../docs/versioning-and-compatibility.md)
- **Standards / normative:** none / this needs an [RFC](../rfcs/README.md)
- **Security:** none / touches crypto, verification, delegation, subsumption, PoP,
  canonicalization, or a binding (extra review + adversarial tests)
- **Reserved-IP:** confirmed this introduces none of the
  [reserved concepts](../CHARTER.md#reserved-concepts)

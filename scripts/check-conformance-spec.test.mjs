import { describe, expect, it } from 'vitest';

import { validateCatalog, ID_PATTERN } from './check-conformance-spec.mjs';

const base = {
  classes: ['Core', 'Status'],
  classPrefixes: { Core: 'CORE', Status: 'STATUS' },
  mandatoryClass: 'Core',
};

const ok = (r) => ({
  id: 'CORE-NARROW-001',
  class: 'Core',
  keyword: 'MUST NOT',
  statement: 'x',
  source: ['RFC-0001'],
  ...r,
});

describe('validateCatalog', () => {
  it('accepts a well-formed catalog', () => {
    const { errors } = validateCatalog({ ...base, requirements: [ok()] });
    expect(errors).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    const { errors } = validateCatalog({ ...base, requirements: [ok(), ok()] });
    expect(errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('rejects an unknown class', () => {
    const { errors } = validateCatalog({
      ...base,
      requirements: [ok({ id: 'FOO-BAR-001', class: 'Foo' })],
    });
    expect(errors.some((e) => e.includes('unknown class'))).toBe(true);
  });

  it('rejects a non-BCP-14 keyword', () => {
    const { errors } = validateCatalog({ ...base, requirements: [ok({ keyword: 'must' })] });
    expect(errors.some((e) => e.includes('non-BCP-14'))).toBe(true);
  });

  it('rejects an id whose prefix does not match its class', () => {
    const { errors } = validateCatalog({
      ...base,
      requirements: [ok({ id: 'STATUS-001', class: 'Core' })],
    });
    expect(errors.some((e) => e.includes('id prefix'))).toBe(true);
  });

  it('rejects a missing source', () => {
    const { errors } = validateCatalog({ ...base, requirements: [ok({ source: [] })] });
    expect(errors.some((e) => e.includes('missing source'))).toBe(true);
  });

  it('rejects a mandatoryClass that is not declared', () => {
    const { errors } = validateCatalog({ ...base, mandatoryClass: 'Nope', requirements: [ok()] });
    expect(errors.some((e) => e.includes('mandatoryClass'))).toBe(true);
  });
});

describe('ID_PATTERN', () => {
  it('matches real ids and not scheme placeholders', () => {
    const found = 'see CORE-NARROW-001 and STATUS-003 but not CORE-GROUP-NNN'.match(ID_PATTERN);
    expect(found).toEqual(['CORE-NARROW-001', 'STATUS-003']);
  });
});

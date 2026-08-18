import { describe, expect, it } from 'vitest';

import {
  isConstraint,
  isPermittedPair,
  satisfies,
  subsumes,
  type Constraint,
} from '../aat/constraints.js';

describe('constraint recognition', () => {
  it('accepts every type defined by AAT -01', () => {
    const constraints: Constraint[] = [
      { constraint_type: 'exact', value: 'a' },
      { constraint_type: 'range', min: 0, max: 10 },
      { constraint_type: 'one_of', values: ['a'] },
      { constraint_type: 'not_one_of', excluded: ['b'] },
      { constraint_type: 'contains', required: ['x'] },
      { constraint_type: 'subset', allowed: ['x', 'y'] },
      { constraint_type: 'wildcard' },
      { constraint_type: 'all', constraints: [{ constraint_type: 'wildcard' }] },
      { constraint_type: 'any', constraints: [{ constraint_type: 'wildcard' }] },
    ];
    for (const c of constraints) expect(isConstraint(c), c.constraint_type).toBe(true);
  });

  it('rejects unknown and malformed types', () => {
    for (const value of [
      { constraint_type: 'regex', pattern: '.*' },
      { constraint_type: 'one_of' },
      { constraint_type: 'one_of', values: 'not-an-array' },
      { constraint_type: 'all', constraints: [{ constraint_type: 'nope' }] },
      null,
      'wildcard',
      [],
    ]) {
      expect(isConstraint(value)).toBe(false);
    }
  });
});

describe('satisfies', () => {
  it('evaluates each constraint type against argument values', () => {
    expect(satisfies({ constraint_type: 'wildcard' }, 'anything')).toBe(true);
    expect(satisfies({ constraint_type: 'exact', value: '/a' }, '/a')).toBe(true);
    expect(satisfies({ constraint_type: 'exact', value: '/a' }, '/b')).toBe(false);
    expect(satisfies({ constraint_type: 'one_of', values: ['a', 'b'] }, 'b')).toBe(true);
    expect(satisfies({ constraint_type: 'one_of', values: ['a'] }, 'z')).toBe(false);
    expect(satisfies({ constraint_type: 'not_one_of', excluded: ['exe'] }, 'pdf')).toBe(true);
    expect(satisfies({ constraint_type: 'not_one_of', excluded: ['exe'] }, 'exe')).toBe(false);
    expect(satisfies({ constraint_type: 'contains', required: ['id'] }, ['id', 'name'])).toBe(true);
    expect(satisfies({ constraint_type: 'contains', required: ['id'] }, ['name'])).toBe(false);
    expect(satisfies({ constraint_type: 'subset', allowed: ['r', 'w'] }, ['r'])).toBe(true);
    expect(satisfies({ constraint_type: 'subset', allowed: ['r'] }, ['r', 'w'])).toBe(false);
  });

  it('honours range bounds and inclusivity', () => {
    const inclusive: Constraint = { constraint_type: 'range', min: 0, max: 10 };
    expect(satisfies(inclusive, 0)).toBe(true);
    expect(satisfies(inclusive, 10)).toBe(true);
    expect(satisfies(inclusive, 11)).toBe(false);

    const exclusive: Constraint = {
      constraint_type: 'range',
      min: 0,
      max: 10,
      min_inclusive: false,
      max_inclusive: false,
    };
    expect(satisfies(exclusive, 0)).toBe(false);
    expect(satisfies(exclusive, 10)).toBe(false);
    expect(satisfies(exclusive, 5)).toBe(true);
  });

  it('rejects non-numeric values for range', () => {
    expect(satisfies({ constraint_type: 'range', min: 0 }, 'five')).toBe(false);
    expect(satisfies({ constraint_type: 'range', min: 0 }, Number.NaN)).toBe(false);
  });

  it('composes all and any', () => {
    const both: Constraint = {
      constraint_type: 'all',
      constraints: [
        { constraint_type: 'range', min: 0, max: 100 },
        { constraint_type: 'not_one_of', excluded: [50] },
      ],
    };
    expect(satisfies(both, 20)).toBe(true);
    expect(satisfies(both, 50)).toBe(false);
    expect(satisfies(both, 200)).toBe(false);

    const either: Constraint = {
      constraint_type: 'any',
      constraints: [
        { constraint_type: 'exact', value: 'admin' },
        { constraint_type: 'exact', value: 'moderator' },
      ],
    };
    expect(satisfies(either, 'admin')).toBe(true);
    expect(satisfies(either, 'guest')).toBe(false);
  });

  it('compares object values structurally, not by key order', () => {
    const c: Constraint = { constraint_type: 'exact', value: { a: 1, b: 2 } };
    expect(satisfies(c, { b: 2, a: 1 })).toBe(true);
  });
});

describe('permitted subsumption pairs', () => {
  // Transcribed from AAT -01 section 4.5. The matrix is closed-world.
  const permitted: Array<[string, string]> = [
    ['exact', 'exact'],
    ['range', 'exact'],
    ['one_of', 'exact'],
    ['wildcard', 'exact'],
    ['range', 'range'],
    ['one_of', 'one_of'],
    ['not_one_of', 'not_one_of'],
    ['wildcard', 'wildcard'],
    ['all', 'all'],
    ['any', 'any'],
  ];

  it('permits exactly the pairs the draft lists', () => {
    for (const [parent, derived] of permitted) {
      expect(isPermittedPair(parent as never, derived as never), `${parent}>${derived}`).toBe(true);
    }
  });

  it('rejects pairs outside the table, including not_one_of to one_of', () => {
    const rejected: Array<[string, string]> = [
      ['not_one_of', 'one_of'],
      ['exact', 'one_of'],
      ['exact', 'wildcard'],
      ['one_of', 'wildcard'],
      ['one_of', 'range'],
      ['range', 'one_of'],
      ['all', 'any'],
      ['any', 'all'],
      // Recorded in RFC-0001 as suspected under-specification. Implemented as
      // written: closed-world, so these are refused.
      ['wildcard', 'one_of'],
      ['wildcard', 'range'],
      ['contains', 'contains'],
      ['subset', 'subset'],
    ];
    for (const [parent, derived] of rejected) {
      expect(isPermittedPair(parent as never, derived as never), `${parent}>${derived}`).toBe(
        false,
      );
    }
  });
});

describe('subsumption', () => {
  it('accepts narrowing within permitted pairs', () => {
    expect(
      subsumes(
        { constraint_type: 'one_of', values: ['a', 'b', 'c'] },
        { constraint_type: 'one_of', values: ['a'] },
      ),
    ).toBe(true);
    expect(
      subsumes(
        { constraint_type: 'one_of', values: ['a', 'b'] },
        { constraint_type: 'exact', value: 'b' },
      ),
    ).toBe(true);
    expect(
      subsumes(
        { constraint_type: 'range', min: 0, max: 100 },
        { constraint_type: 'range', min: 10, max: 50 },
      ),
    ).toBe(true);
    expect(
      subsumes(
        { constraint_type: 'range', min: 0, max: 100 },
        { constraint_type: 'exact', value: 5 },
      ),
    ).toBe(true);
    expect(
      subsumes(
        { constraint_type: 'not_one_of', excluded: ['exe'] },
        { constraint_type: 'not_one_of', excluded: ['exe', 'sh'] },
      ),
    ).toBe(true);
    expect(subsumes({ constraint_type: 'wildcard' }, { constraint_type: 'exact', value: 1 })).toBe(
      true,
    );
  });

  it('refuses widening', () => {
    expect(
      subsumes(
        { constraint_type: 'one_of', values: ['a'] },
        { constraint_type: 'one_of', values: ['a', 'b'] },
      ),
    ).toBe(false);
    expect(
      subsumes(
        { constraint_type: 'one_of', values: ['a'] },
        { constraint_type: 'exact', value: 'z' },
      ),
    ).toBe(false);
    expect(
      subsumes(
        { constraint_type: 'range', min: 10, max: 50 },
        { constraint_type: 'range', min: 0, max: 100 },
      ),
    ).toBe(false);
    expect(
      subsumes(
        { constraint_type: 'not_one_of', excluded: ['exe', 'sh'] },
        { constraint_type: 'not_one_of', excluded: ['exe'] },
      ),
    ).toBe(false);
    expect(
      subsumes(
        { constraint_type: 'range', min: 0, max: 10 },
        { constraint_type: 'exact', value: 99 },
      ),
    ).toBe(false);
  });

  it('treats an unbounded derived range as widening a bounded parent', () => {
    expect(
      subsumes({ constraint_type: 'range', min: 0, max: 10 }, { constraint_type: 'range', min: 0 }),
    ).toBe(false);
  });

  it('refuses a derived range that loosens only inclusivity', () => {
    expect(
      subsumes(
        { constraint_type: 'range', min: 0, max: 10, max_inclusive: false },
        { constraint_type: 'range', min: 0, max: 10, max_inclusive: true },
      ),
    ).toBe(false);
    expect(
      subsumes(
        { constraint_type: 'range', min: 0, max: 10, max_inclusive: true },
        { constraint_type: 'range', min: 0, max: 10, max_inclusive: false },
      ),
    ).toBe(true);
  });

  it('requires every parent clause to survive in a derived all', () => {
    const parent: Constraint = {
      constraint_type: 'all',
      constraints: [
        { constraint_type: 'range', min: 0, max: 100 },
        { constraint_type: 'one_of', values: ['a', 'b'] },
      ],
    };
    const narrower: Constraint = {
      constraint_type: 'all',
      constraints: [
        { constraint_type: 'range', min: 10, max: 20 },
        { constraint_type: 'exact', value: 'a' },
      ],
    };
    const dropped: Constraint = {
      constraint_type: 'all',
      constraints: [{ constraint_type: 'range', min: 10, max: 20 }],
    };
    expect(subsumes(parent, narrower)).toBe(true);
    expect(subsumes(parent, dropped)).toBe(false);
  });

  it('requires every derived any clause to sit inside a parent clause', () => {
    const parent: Constraint = {
      constraint_type: 'any',
      constraints: [
        { constraint_type: 'exact', value: 'admin' },
        { constraint_type: 'exact', value: 'moderator' },
      ],
    };
    const narrower: Constraint = {
      constraint_type: 'any',
      constraints: [{ constraint_type: 'exact', value: 'admin' }],
    };
    // Adding an alternative the parent never granted is widening.
    const widened: Constraint = {
      constraint_type: 'any',
      constraints: [
        { constraint_type: 'exact', value: 'admin' },
        { constraint_type: 'exact', value: 'root' },
      ],
    };
    expect(subsumes(parent, narrower)).toBe(true);
    expect(subsumes(parent, widened)).toBe(false);
  });

  it('rejects unknown constraint types on either side', () => {
    const unknown = { constraint_type: 'regex', pattern: '.*' } as unknown as Constraint;
    expect(subsumes(unknown, { constraint_type: 'wildcard' })).toBe(false);
    expect(subsumes({ constraint_type: 'wildcard' }, unknown)).toBe(false);
  });
});

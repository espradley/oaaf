/**
 * Argument constraints and the subsumption matrix from AAT -01 §4.5.
 *
 * Two rules govern everything here.
 *
 * The matrix is **closed-world**: the draft states that any (parent type,
 * derived type) pair not explicitly permitted MUST be rejected. So this module
 * enumerates the permitted pairs and rejects everything else, including pairs
 * that look harmless.
 *
 * Unrecognized constraint types are rejected rather than ignored. A constraint
 * that cannot be understood cannot be shown to narrow anything.
 *
 * Two ambiguities in -01 are handled here by failing closed; both are recorded
 * in RFC-0001 and should be raised with the draft author. See PERMITTED_PAIRS
 * and `subsumesAny` for the specifics.
 */

export type ConstraintType =
  'exact' | 'range' | 'one_of' | 'not_one_of' | 'contains' | 'subset' | 'wildcard' | 'all' | 'any';

export interface ExactConstraint {
  constraint_type: 'exact';
  value: unknown;
}

export interface RangeConstraint {
  constraint_type: 'range';
  min?: number;
  max?: number;
  min_inclusive?: boolean;
  max_inclusive?: boolean;
}

export interface OneOfConstraint {
  constraint_type: 'one_of';
  values: unknown[];
}

export interface NotOneOfConstraint {
  constraint_type: 'not_one_of';
  excluded: unknown[];
}

export interface ContainsConstraint {
  constraint_type: 'contains';
  required: unknown[];
}

export interface SubsetConstraint {
  constraint_type: 'subset';
  allowed: unknown[];
}

export interface WildcardConstraint {
  constraint_type: 'wildcard';
}

export interface AllConstraint {
  constraint_type: 'all';
  constraints: Constraint[];
}

export interface AnyConstraint {
  constraint_type: 'any';
  constraints: Constraint[];
}

export type Constraint =
  | ExactConstraint
  | RangeConstraint
  | OneOfConstraint
  | NotOneOfConstraint
  | ContainsConstraint
  | SubsetConstraint
  | WildcardConstraint
  | AllConstraint
  | AnyConstraint;

const KNOWN_TYPES: ReadonlySet<string> = new Set<ConstraintType>([
  'exact',
  'range',
  'one_of',
  'not_one_of',
  'contains',
  'subset',
  'wildcard',
  'all',
  'any',
]);

/** True when `value` is a structurally valid constraint of a type this build knows. */
export function isConstraint(value: unknown): value is Constraint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const type = (value as { constraint_type?: unknown }).constraint_type;
  if (typeof type !== 'string' || !KNOWN_TYPES.has(type)) return false;

  const c = value as Record<string, unknown>;
  switch (type) {
    case 'one_of':
      return Array.isArray(c['values']);
    case 'not_one_of':
      return Array.isArray(c['excluded']);
    case 'contains':
      return Array.isArray(c['required']);
    case 'subset':
      return Array.isArray(c['allowed']);
    case 'all':
    case 'any':
      return Array.isArray(c['constraints']) && c['constraints'].every(isConstraint);
    case 'exact':
      return 'value' in c;
    case 'range':
      return (
        (c['min'] === undefined || typeof c['min'] === 'number') &&
        (c['max'] === undefined || typeof c['max'] === 'number')
      );
    default:
      return true;
  }
}

/**
 * Structural equality by JSON value.
 *
 * Constraint values are JSON, so key order is not significant; sorting keys
 * before comparison avoids treating `{a:1,b:2}` and `{b:2,a:1}` as different
 * permitted values.
 */
function jsonEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function includesValue(list: readonly unknown[], value: unknown): boolean {
  return list.some((entry) => jsonEqual(entry, value));
}

function isSubsetOf(inner: readonly unknown[], outer: readonly unknown[]): boolean {
  return inner.every((entry) => includesValue(outer, entry));
}

// ---------------------------------------------------------------------------
// Evaluation: does an argument value satisfy a constraint?
// ---------------------------------------------------------------------------

/** Evaluate a supplied argument value against a constraint. */
export function satisfies(constraint: Constraint, value: unknown): boolean {
  switch (constraint.constraint_type) {
    case 'wildcard':
      return true;
    case 'exact':
      return jsonEqual(constraint.value, value);
    case 'one_of':
      return includesValue(constraint.values, value);
    case 'not_one_of':
      return !includesValue(constraint.excluded, value);
    case 'range':
      return satisfiesRange(constraint, value);
    case 'contains':
      return Array.isArray(value) && isSubsetOf(constraint.required, value);
    case 'subset':
      return Array.isArray(value) && isSubsetOf(value, constraint.allowed);
    case 'all':
      return constraint.constraints.every((inner) => satisfies(inner, value));
    case 'any':
      return constraint.constraints.some((inner) => satisfies(inner, value));
  }
}

function satisfiesRange(constraint: RangeConstraint, value: unknown): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const minInclusive = constraint.min_inclusive ?? true;
  const maxInclusive = constraint.max_inclusive ?? true;
  if (constraint.min !== undefined) {
    if (minInclusive ? value < constraint.min : value <= constraint.min) return false;
  }
  if (constraint.max !== undefined) {
    if (maxInclusive ? value > constraint.max : value >= constraint.max) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Subsumption: is a derived constraint no broader than its parent?
// ---------------------------------------------------------------------------

/**
 * Permitted (parent type, derived type) pairs, transcribed from AAT -01 §4.5.
 *
 * Deliberately no more permissive than the draft's table. Two consequences are
 * surprising and are believed to be under-specification rather than intent:
 *
 *   - No pair lists `contains` or `subset` as a *parent* type, so a parent
 *     constraint of either kind cannot be restated in a derived token at all.
 *   - `wildcard` may only be narrowed to `exact` or `wildcard` — not to
 *     `one_of` or `range`, which would be the natural narrowings.
 *
 * Both are filed in RFC-0001 for upstream clarification. Until the draft says
 * otherwise, the closed-world rule is explicit and failing closed is never the
 * unsafe direction: a child may always omit the argument or the tool instead.
 */
const PERMITTED_PAIRS: ReadonlySet<string> = new Set([
  'exact>exact',
  'range>exact',
  'one_of>exact',
  'wildcard>exact',
  'range>range',
  'one_of>one_of',
  'not_one_of>not_one_of',
  'wildcard>wildcard',
  'all>all',
  'any>any',
]);

/** True when the (parent, derived) type pair appears in the draft's table. */
export function isPermittedPair(parent: ConstraintType, derived: ConstraintType): boolean {
  return PERMITTED_PAIRS.has(`${parent}>${derived}`);
}

/**
 * True when `derived` is no broader than `parent`.
 *
 * Rejects unknown types, unpermitted type pairs, and any case whose narrowing
 * cannot be demonstrated.
 */
export function subsumes(parent: Constraint, derived: Constraint): boolean {
  if (!isConstraint(parent) || !isConstraint(derived)) return false;
  if (!isPermittedPair(parent.constraint_type, derived.constraint_type)) return false;

  switch (parent.constraint_type) {
    case 'exact':
      return derived.constraint_type === 'exact' && jsonEqual(parent.value, derived.value);

    case 'wildcard':
      // Only 'exact' and 'wildcard' reach here; both are narrowings of wildcard.
      return true;

    case 'one_of':
      if (derived.constraint_type === 'exact') return includesValue(parent.values, derived.value);
      if (derived.constraint_type === 'one_of') return isSubsetOf(derived.values, parent.values);
      return false;

    case 'not_one_of':
      // Narrowing means excluding at least as much.
      return (
        derived.constraint_type === 'not_one_of' && isSubsetOf(parent.excluded, derived.excluded)
      );

    case 'range':
      if (derived.constraint_type === 'exact') return satisfiesRange(parent, derived.value);
      if (derived.constraint_type === 'range') return rangeSubsumes(parent, derived);
      return false;

    case 'all':
      return derived.constraint_type === 'all' && subsumesAll(parent, derived);

    case 'any':
      return derived.constraint_type === 'any' && subsumesAny(parent, derived);

    case 'contains':
    case 'subset':
      // No permitted pair names these as a parent type; unreachable via the
      // pair check above, and rejected here too rather than falling through.
      return false;
  }
}

/** A derived range must sit inside the parent range, inclusivity included. */
function rangeSubsumes(parent: RangeConstraint, derived: RangeConstraint): boolean {
  const parentMinInc = parent.min_inclusive ?? true;
  const derivedMinInc = derived.min_inclusive ?? true;
  const parentMaxInc = parent.max_inclusive ?? true;
  const derivedMaxInc = derived.max_inclusive ?? true;

  if (parent.min !== undefined) {
    // An unbounded derived lower end cannot be inside a bounded parent one.
    if (derived.min === undefined) return false;
    if (derived.min < parent.min) return false;
    // Equal bounds: derived must not be more permissive at the boundary.
    if (derived.min === parent.min && derivedMinInc && !parentMinInc) return false;
  }

  if (parent.max !== undefined) {
    if (derived.max === undefined) return false;
    if (derived.max > parent.max) return false;
    if (derived.max === parent.max && derivedMaxInc && !parentMaxInc) return false;
  }

  return true;
}

/**
 * Conjunction. The parent permits the intersection of its clauses, so every
 * parent clause must still be enforced by some derived clause. Extra derived
 * clauses only narrow further and are allowed.
 */
function subsumesAll(parent: AllConstraint, derived: AllConstraint): boolean {
  return parent.constraints.every((parentClause) =>
    derived.constraints.some((derivedClause) => subsumes(parentClause, derivedClause)),
  );
}

/**
 * Disjunction. The parent permits the union of its clauses, so narrowing holds
 * when every *derived* clause falls inside some parent clause.
 *
 * Descriptions of -01 §4.5 are not consistent about this direction. The
 * opposite reading — every parent clause subsumed by some derived clause —
 * would permit a derived token to add alternatives the parent never granted,
 * which is widening. The narrowing-preserving direction is implemented here and
 * the discrepancy is recorded in RFC-0001.
 */
function subsumesAny(parent: AnyConstraint, derived: AnyConstraint): boolean {
  return derived.constraints.every((derivedClause) =>
    parent.constraints.some((parentClause) => subsumes(parentClause, derivedClause)),
  );
}

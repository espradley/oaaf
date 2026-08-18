"""Argument constraints and the subsumption matrix (AAT -01 section 4.5).

Implemented from the normative rules, not translated from the reference. Two
rules govern: the permitted (parent, derived) type pairs are closed-world (any
pair not explicitly permitted is rejected), and an unrecognized constraint type
is rejected rather than ignored.
"""

from __future__ import annotations

import json
from typing import Any

KNOWN_TYPES = {
    "exact",
    "range",
    "one_of",
    "not_one_of",
    "contains",
    "subset",
    "wildcard",
    "all",
    "any",
}


def is_constraint(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    t = value.get("constraint_type")
    if not isinstance(t, str) or t not in KNOWN_TYPES:
        return False
    if t == "one_of":
        return isinstance(value.get("values"), list)
    if t == "not_one_of":
        return isinstance(value.get("excluded"), list)
    if t == "contains":
        return isinstance(value.get("required"), list)
    if t == "subset":
        return isinstance(value.get("allowed"), list)
    if t in ("all", "any"):
        cs = value.get("constraints")
        return isinstance(cs, list) and all(is_constraint(c) for c in cs)
    if t == "exact":
        return "value" in value
    if t == "range":
        return (value.get("min") is None or _is_num(value["min"])) and (
            value.get("max") is None or _is_num(value["max"])
        )
    return True


def _is_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _json_equal(a: Any, b: Any) -> bool:
    return _stable(a) == _stable(b)


def _stable(v: Any) -> str:
    return json.dumps(v, sort_keys=True, separators=(",", ":"))


def _includes(lst: list[Any], value: Any) -> bool:
    return any(_json_equal(x, value) for x in lst)


def _subset_of(inner: list[Any], outer: list[Any]) -> bool:
    return all(_includes(outer, x) for x in inner)


def satisfies(constraint: dict, value: Any) -> bool:
    """Does a supplied argument value satisfy a constraint?"""
    t = constraint["constraint_type"]
    if t == "wildcard":
        return True
    if t == "exact":
        return _json_equal(constraint["value"], value)
    if t == "one_of":
        return _includes(constraint["values"], value)
    if t == "not_one_of":
        return not _includes(constraint["excluded"], value)
    if t == "range":
        return _satisfies_range(constraint, value)
    if t == "contains":
        return isinstance(value, list) and _subset_of(constraint["required"], value)
    if t == "subset":
        return isinstance(value, list) and _subset_of(value, constraint["allowed"])
    if t == "all":
        return all(satisfies(c, value) for c in constraint["constraints"])
    if t == "any":
        return any(satisfies(c, value) for c in constraint["constraints"])
    return False


def _satisfies_range(constraint: dict, value: Any) -> bool:
    if not _is_num(value):
        return False
    min_inc = constraint.get("min_inclusive", True)
    max_inc = constraint.get("max_inclusive", True)
    lo, hi = constraint.get("min"), constraint.get("max")
    if lo is not None and (value < lo if min_inc else value <= lo):
        return False
    if hi is not None and (value > hi if max_inc else value >= hi):
        return False
    return True


def is_permitted_pair(parent: str, derived: str) -> bool:
    """Permitted (parent, derived) type pairs, per section 4.5 (closed-world)."""
    if parent == "wildcard":
        return True
    if derived == "wildcard":
        return False
    if derived == "exact":
        return parent in ("exact", "range", "one_of", "wildcard")
    return parent == derived


def subsumes(parent: dict, derived: dict) -> bool:
    """True when a derived constraint is no broader than its parent."""
    if not is_constraint(parent) or not is_constraint(derived):
        return False
    if not is_permitted_pair(parent["constraint_type"], derived["constraint_type"]):
        return False
    if parent["constraint_type"] == "wildcard":
        return True

    dt = derived["constraint_type"]
    if dt == "exact":
        return _exact_subsumed_by(parent, derived["value"])
    if dt == "range":
        return parent["constraint_type"] == "range" and _range_subsumes(parent, derived)
    if dt == "one_of":
        return parent["constraint_type"] == "one_of" and _subset_of(
            derived["values"], parent["values"]
        )
    if dt == "not_one_of":
        return parent["constraint_type"] == "not_one_of" and _subset_of(
            parent["excluded"], derived["excluded"]
        )
    if dt == "contains":
        return parent["constraint_type"] == "contains" and _subset_of(
            parent["required"], derived["required"]
        )
    if dt == "subset":
        return parent["constraint_type"] == "subset" and _subset_of(
            derived["allowed"], parent["allowed"]
        )
    if dt == "all":
        return parent["constraint_type"] == "all" and _subsumes_all(parent, derived)
    if dt == "any":
        return parent["constraint_type"] == "any" and _subsumes_any(parent, derived)
    return False


def _exact_subsumed_by(parent: dict, value: Any) -> bool:
    t = parent["constraint_type"]
    if t == "exact":
        return _json_equal(parent["value"], value)
    if t == "range":
        return _satisfies_range(parent, value)
    if t == "one_of":
        return _includes(parent["values"], value)
    return False


def _range_subsumes(parent: dict, derived: dict) -> bool:
    p_min_inc = parent.get("min_inclusive", True)
    d_min_inc = derived.get("min_inclusive", True)
    p_max_inc = parent.get("max_inclusive", True)
    d_max_inc = derived.get("max_inclusive", True)
    if parent.get("min") is not None:
        if derived.get("min") is None or derived["min"] < parent["min"]:
            return False
        if derived["min"] == parent["min"] and d_min_inc and not p_min_inc:
            return False
    if parent.get("max") is not None:
        if derived.get("max") is None or derived["max"] > parent["max"]:
            return False
        if derived["max"] == parent["max"] and d_max_inc and not p_max_inc:
            return False
    return True


def _subsumes_all(parent: dict, derived: dict) -> bool:
    used: set[int] = set()

    def match(idx: int) -> bool:
        if idx == len(parent["constraints"]):
            return True
        p_clause = parent["constraints"][idx]
        for i, d_clause in enumerate(derived["constraints"]):
            if i in used or not subsumes(p_clause, d_clause):
                continue
            used.add(i)
            if match(idx + 1):
                return True
            used.discard(i)
        return False

    return match(0)


def _subsumes_any(parent: dict, derived: dict) -> bool:
    if len(derived["constraints"]) == 0:
        return False
    return all(
        any(subsumes(p, d) for p in parent["constraints"]) for d in derived["constraints"]
    )

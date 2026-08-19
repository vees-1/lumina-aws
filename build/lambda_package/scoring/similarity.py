"""Resnik, Lin, and Jaccard HPO similarity functions.

All functions operate on pre-loaded dicts to avoid repeated DB queries:
  ic        : {hpo_id -> information_content}
  ancestors : {hpo_id -> frozenset of ancestor IDs (includes the term itself)}
"""


def resnik(a: str, b: str, ic: dict[str, float], ancestors: dict[str, frozenset]) -> float:
    """IC of the Most Informative Common Ancestor (MICA)."""
    anc_a = ancestors.get(a)
    anc_b = ancestors.get(b)
    if anc_a is None or anc_b is None:
        return 0.0
    common = anc_a & anc_b
    if not common:
        return 0.0
    return max(ic.get(c, 0.0) for c in common)


def lin(a: str, b: str, ic: dict[str, float], ancestors: dict[str, frozenset]) -> float:
    """Lin similarity: 2*IC(MICA) / (IC(a) + IC(b)).  Falls back to Resnik when denominator is 0."""
    mica_ic = resnik(a, b, ic, ancestors)
    ic_a = ic.get(a, 0.0)
    ic_b = ic.get(b, 0.0)
    denom = ic_a + ic_b
    if denom == 0.0:
        return mica_ic  # Resnik fallback for root-adjacent terms
    return 2.0 * mica_ic / denom


def jaccard(a: str, b: str, ancestors: dict[str, frozenset]) -> float:
    """Jaccard over ancestor sets — used as fallback when IC is unavailable."""
    anc_a = ancestors.get(a, frozenset())
    anc_b = ancestors.get(b, frozenset())
    union = anc_a | anc_b
    if not union:
        return 1.0 if a == b else 0.0
    return len(anc_a & anc_b) / len(union)

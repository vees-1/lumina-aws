"""Scoring engine tests.

Smoke test: Dravet syndrome (ORPHA:33069) should rank #1 when queried
with its specific phenotypes: focal-onset seizure, myoclonus, developmental regression.
Note: generic "Seizure" (HP:0001250) correctly scores below diseases that specifically
list that term — Lin similarity penalizes broad→specific mismatches by design.
"""


import pytest
from scoring.ranker import ScoringIndex
from scoring.similarity import jaccard, lin, resnik


@pytest.fixture(scope="module")
def index():
    from ingest.db import DB_PATH
    if not DB_PATH.exists():
        pytest.skip("orpha.sqlite not found — run ingest first")
    return ScoringIndex.load()


# ── Similarity unit tests ─────────────────────────────────────────────────────

def test_resnik_self_similarity(index):
    """resnik(a, a) == IC(a)."""
    hpo_id = "HP:0001250"  # Seizure
    result = resnik(hpo_id, hpo_id, index.ic, index.ancestors)
    assert abs(result - index.ic[hpo_id]) < 1e-6


def test_lin_self_similarity(index):
    """lin(a, a) == 1.0 for any term with IC > 0."""
    result = lin("HP:0001250", "HP:0001250", index.ic, index.ancestors)
    assert abs(result - 1.0) < 1e-6


def test_lin_asymmetry_parent_child(index):
    """lin(parent, child) < 1.0 because MICA IC < average IC."""
    # HP:0001250 Seizure is ancestor of HP:0007359 Focal-onset seizure
    result = lin("HP:0001250", "HP:0007359", index.ic, index.ancestors)
    assert 0.0 < result < 1.0


def test_resnik_unrelated_terms(index):
    """Unrelated terms share only HP:0000001 (root, IC≈0) or nothing."""
    # HP:0001250 Seizure vs HP:0000252 Macrocephaly — very different branches
    result = resnik("HP:0001250", "HP:0000252", index.ic, index.ancestors)
    assert result < 0.5


def test_jaccard_identical_terms(index):
    """jaccard(a, a) == 1.0."""
    result = jaccard("HP:0001250", "HP:0001250", index.ancestors)
    assert abs(result - 1.0) < 1e-6


def test_jaccard_parent_child_is_partial(index):
    """jaccard(parent, child) < 1.0 because child has more ancestors."""
    result = jaccard("HP:0001250", "HP:0007359", index.ancestors)
    assert 0.0 < result < 1.0


def test_unknown_term_returns_zero(index):
    """Completely unknown HPO IDs return 0 without crashing."""
    result = lin("HP:9999999", "HP:0001250", index.ic, index.ancestors)
    assert result == 0.0


# ── Ranker unit tests ─────────────────────────────────────────────────────────

def test_empty_query_returns_empty(index):
    assert index.rank([]) == []


def test_unknown_hpo_ids_filtered(index):
    """Query with only unknown IDs returns empty list."""
    result = index.rank([("HP:9999999", 0.9)])
    assert result == []


def test_rank_returns_correct_count(index):
    query = [("HP:0007359", 0.9)]
    results = index.rank(query, top_k=5)
    assert len(results) <= 5


def test_rank_results_are_sorted_descending(index):
    query = [("HP:0007359", 0.9), ("HP:0001336", 0.8)]
    results = index.rank(query, top_k=10)
    scores = [r.score for r in results]
    assert scores == sorted(scores, reverse=True)


def test_confidence_bounded_0_100(index):
    query = [("HP:0007359", 0.9), ("HP:0001336", 0.8)]
    results = index.rank(query, top_k=5)
    for r in results:
        assert 0.0 <= r.confidence <= 100.0


def test_rank_result_has_contributing_terms(index):
    query = [("HP:0007359", 0.9)]
    results = index.rank(query, top_k=1)
    assert len(results) == 1
    assert isinstance(results[0].contributing_terms, list)


def test_top1_confidence_is_100(index):
    """Top-1 result should always have confidence == 100.0 (it's the reference)."""
    query = [("HP:0007359", 0.9), ("HP:0001336", 0.8)]
    results = index.rank(query, top_k=5)
    assert results[0].confidence == 100.0


# ── Dravet smoke test ─────────────────────────────────────────────────────────

def test_dravet_ranks_top1_with_specific_terms(index):
    """ORPHA:33069 must be rank #1 for Dravet's characteristic phenotype trio."""
    query = [
        ("HP:0007359", 0.95),  # Focal-onset seizure — Very frequent in Dravet
        ("HP:0001336", 0.85),  # Myoclonus — Frequent in Dravet
        ("HP:0002376", 0.90),  # Developmental regression — Very frequent in Dravet
    ]
    results = index.rank(query, top_k=5)
    assert results, "Ranker returned no results"
    assert results[0].orpha_code == 33069, (
        f"Expected ORPHA:33069 (Dravet) at rank #1, got ORPHA:{results[0].orpha_code} ({results[0].name})"
    )


def test_dravet_in_top5_with_four_terms(index):
    """ORPHA:33069 in top-5 when adding a 4th Dravet term."""
    query = [
        ("HP:0007359", 0.95),  # Focal-onset seizure
        ("HP:0001336", 0.85),  # Myoclonus
        ("HP:0002376", 0.90),  # Developmental regression
        ("HP:0000729", 0.70),  # Autistic behavior
    ]
    results = index.rank(query, top_k=5)
    codes = [r.orpha_code for r in results]
    assert 33069 in codes, f"ORPHA:33069 not in top-5: {codes}"


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_single_term_query_works(index):
    results = index.rank([("HP:0001250", 1.0)], top_k=5)
    assert len(results) > 0


def test_low_confidence_query_still_ranks(index):
    results = index.rank([("HP:0007359", 0.01)], top_k=5)
    assert len(results) > 0
    # Order should be the same regardless of confidence scalar
    results_high = index.rank([("HP:0007359", 1.0)], top_k=5)
    codes_low = [r.orpha_code for r in results]
    codes_high = [r.orpha_code for r in results_high]
    assert codes_low == codes_high

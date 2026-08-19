"""Post-extraction ontology name validation."""

from __future__ import annotations

import re

_STOP_WORDS = frozenset(
    [
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "of",
        "in",
        "with",
        "and",
        "or",
        "to",
        "for",
        "on",
        "at",
        "by",
        "from",
        "as",
    ]
)


def _keywords(text: str) -> frozenset[str]:
    words = re.findall(r"[a-z]+", text.lower())
    return frozenset(w for w in words if w not in _STOP_WORDS and len(w) > 2)


def validate_terms(
    terms: list,  # list[HPOTerm]
    ic: dict[str, float],  # hpo_id -> ic score (passed from app state)
    hpo_names: dict[str, str],  # hpo_id -> name
) -> list:
    """Reduce confidence of terms where HPO name shares no keywords with reported source."""
    result = []
    for term in terms:
        hpo_name = hpo_names.get(term.hpo_id, "")
        if hpo_name and term.source:
            name_kw = _keywords(hpo_name)
            source_kw = _keywords(term.source)
            if name_kw and source_kw and not name_kw & source_kw:
                # Zero overlap — penalise
                term = term.model_copy(update={"confidence": round(term.confidence * 0.5, 3)})
        result.append(term)
    return result

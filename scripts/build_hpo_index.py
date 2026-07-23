"""Build and cache the HPO semantic embedding index.

Run once (or whenever the HPO vocabulary changes):
    uv run python scripts/build_hpo_index.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure packages are resolvable when run from repo root
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "scoring"))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "ingest"))

from ingest.db import get_engine
from ingest.models import HPOTerm as HPOTermModel
from scoring.embeddings import _embedder
from sqlmodel import Session, select


def load_hpo_vocab(engine) -> list[tuple[str, str]]:
    with Session(engine) as s:
        terms = s.exec(
            select(HPOTermModel)
            .where(HPOTermModel.ic.isnot(None))
            .order_by(HPOTermModel.ic.desc())
        ).all()
    return [(t.hpo_id, t.name) for t in terms]


def main() -> None:
    engine = get_engine()
    vocab = load_hpo_vocab(engine)
    if not vocab:
        print("No HPO terms found in DB — run ingest first.", file=sys.stderr)
        sys.exit(1)
    print(f"Building HPO embedding index for {len(vocab)} terms...")
    _embedder.build_index(vocab)
    print(f"Built HPO embedding index: {len(vocab)} terms. Saved to hpo_embeddings.json")


if __name__ == "__main__":
    main()

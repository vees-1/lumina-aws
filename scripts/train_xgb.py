"""Train the XGBoost disease classifier and save to packages/scoring/xgb_model.pkl.

Usage:
    cd apps/api && uv run python ../../scripts/train_xgb.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure packages are importable when run via uv from apps/api
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "scoring"))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "ingest"))

from ingest.db import get_engine
from ingest.models import DiseasePhenotype, HPOTerm
from scoring.ml_ranker import XGBoostRanker
from sqlmodel import Session, func, select


def main() -> None:
    engine = get_engine()

    # Quick stats for the summary line
    with Session(engine) as session:
        n_diseases: int = session.exec(
            select(func.count(func.distinct(DiseasePhenotype.orpha_code)))
            .where(DiseasePhenotype.frequency_weight > 0.0)
        ).one()
        n_hpo: int = session.exec(
            select(func.count(func.distinct(DiseasePhenotype.hpo_id)))
            .where(DiseasePhenotype.frequency_weight > 0.0)
        ).one()

    print(f"Training XGBoost on {n_diseases} diseases × {n_hpo} HPO features …")

    ranker = XGBoostRanker()
    ranker.train(engine)

    print(f"Trained on {n_diseases} diseases, {n_hpo} HPO features. Saved to xgb_model.pkl")


if __name__ == "__main__":
    main()

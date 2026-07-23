#!/usr/bin/env python3
"""
Lumina eval harness — runs demo cases through the full scoring pipeline
and reports top-1 accuracy, top-5 accuracy, and MRR.

Usage:
    cd /path/to/nexus2.0
    uv run python scripts/eval.py
    uv run python scripts/eval.py --top-k 10 --verbose
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Path setup — must run from project root (nexus2.0/)
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PACKAGES_DIR = PROJECT_ROOT / "packages"
DB_PATH = PROJECT_ROOT / "data" / "orpha.sqlite"

if not PACKAGES_DIR.exists():
    print(
        f"ERROR: packages/ directory not found at {PACKAGES_DIR}\n"
        "       Run this script from the project root: uv run python scripts/eval.py",
        file=sys.stderr,
    )
    sys.exit(1)

sys.path.insert(0, str(PACKAGES_DIR))

try:
    from scoring.ranker import ScoringIndex
except ImportError as exc:
    print(
        f"ERROR: Could not import scoring.ranker: {exc}\n"
        "       Make sure packages/scoring/ is installed or the packages/ directory is on the path.\n"
        "       Run: cd /path/to/nexus2.0 && uv run python scripts/eval.py",
        file=sys.stderr,
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Demo cases — mirrors apps/web/src/lib/demo-cases.ts exactly
# Each entry: name, orpha_code, hpo_terms [(hpo_id, confidence)]
# ---------------------------------------------------------------------------
DEMO_CASES: list[dict] = [
    {
        "name": "Dravet syndrome",
        "orpha_code": 34587,
        "hpo_terms": [
            ("HP:0002373", 0.95),
            ("HP:0001250", 0.92),
            ("HP:0001263", 0.80),
            ("HP:0010819", 0.75),
        ],
    },
    {
        "name": "Marfan syndrome",
        "orpha_code": 558,
        "hpo_terms": [
            ("HP:0001519", 0.90),
            ("HP:0000316", 0.72),
            ("HP:0001083", 0.88),
            ("HP:0002616", 0.93),
        ],
    },
    {
        "name": "Gaucher disease type 1",
        "orpha_code": 77259,
        "hpo_terms": [
            ("HP:0001903", 0.85),
            ("HP:0001744", 0.95),
            ("HP:0002240", 0.80),
            ("HP:0100512", 0.90),
        ],
    },
    {
        "name": "Phenylketonuria",
        "orpha_code": 716,
        "hpo_terms": [
            ("HP:0001249", 0.78),
            ("HP:0000729", 0.70),
            ("HP:0001047", 0.82),
            ("HP:0011968", 0.75),
        ],
    },
    {
        "name": "Turner syndrome",
        "orpha_code": 881,
        "hpo_terms": [
            ("HP:0004322", 0.92),
            ("HP:0000047", 0.78),
            ("HP:0001629", 0.70),
            ("HP:0000851", 0.68),
        ],
    },
    {
        "name": "Rett syndrome",
        "orpha_code": 778,
        "hpo_terms": [
            ("HP:0002333", 0.93),
            ("HP:0000733", 0.95),
            ("HP:0002360", 0.77),
            ("HP:0001276", 0.72),
        ],
    },
    {
        "name": "Neurofibromatosis type 1",
        "orpha_code": 636,
        "hpo_terms": [
            ("HP:0000957", 0.95),
            ("HP:0009732", 0.88),
            ("HP:0009736", 0.65),
            ("HP:0000407", 0.70),
        ],
    },
    {
        "name": "Duchenne muscular dystrophy",
        "orpha_code": 98896,
        "hpo_terms": [
            ("HP:0003236", 0.95),
            ("HP:0001324", 0.92),
            ("HP:0003701", 0.90),
            ("HP:0003325", 0.85),
        ],
    },
    {
        "name": "Pompe disease",
        "orpha_code": 365,
        "hpo_terms": [
            ("HP:0001639", 0.93),
            ("HP:0003236", 0.82),
            ("HP:0001263", 0.78),
            ("HP:0002194", 0.80),
        ],
    },
    {
        "name": "Williams syndrome",
        "orpha_code": 904,
        "hpo_terms": [
            ("HP:0001629", 0.80),
            ("HP:0001263", 0.85),
            ("HP:0000316", 0.75),
            ("HP:0000219", 0.78),
        ],
    },
    {
        "name": "Fabry disease",
        "orpha_code": 324,
        "hpo_terms": [
            ("HP:0002719", 0.65),
            ("HP:0001654", 0.73),
            ("HP:0000790", 0.87),
            ("HP:0003056", 0.92),
        ],
    },
    {
        "name": "Cystic fibrosis",
        "orpha_code": 586,
        "hpo_terms": [
            ("HP:0006528", 0.93),
            ("HP:0002099", 0.70),
            ("HP:0001508", 0.88),
            ("HP:0000508", 0.60),
        ],
    },
]


# ---------------------------------------------------------------------------
# Table helpers
# ---------------------------------------------------------------------------
COL_DISEASE = 35
COL_ORPHA   = 10
COL_RANK    = 10
COL_TOP1    = 8


def _box_top() -> str:
    return (
        "┌"
        + "─" * (COL_DISEASE + 2)
        + "┬"
        + "─" * (COL_ORPHA + 2)
        + "┬"
        + "─" * (COL_RANK + 2)
        + "┬"
        + "─" * (COL_TOP1 + 2)
        + "┐"
    )


def _box_sep() -> str:
    return (
        "├"
        + "─" * (COL_DISEASE + 2)
        + "┼"
        + "─" * (COL_ORPHA + 2)
        + "┼"
        + "─" * (COL_RANK + 2)
        + "┼"
        + "─" * (COL_TOP1 + 2)
        + "┤"
    )


def _box_bot() -> str:
    return (
        "└"
        + "─" * (COL_DISEASE + 2)
        + "┴"
        + "─" * (COL_ORPHA + 2)
        + "┴"
        + "─" * (COL_RANK + 2)
        + "┴"
        + "─" * (COL_TOP1 + 2)
        + "┘"
    )


def _row(disease: str, orpha: str, rank: str, top1: str) -> str:
    return (
        "│ "
        + disease.ljust(COL_DISEASE)
        + " │ "
        + orpha.ljust(COL_ORPHA)
        + " │ "
        + rank.ljust(COL_RANK)
        + " │ "
        + top1.ljust(COL_TOP1)
        + " │"
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Lumina eval harness")
    parser.add_argument(
        "--top-k",
        type=int,
        default=10,
        help="Number of candidates to retrieve per query (default: 10)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print top-3 candidates for each case",
    )
    parser.add_argument(
        "--db",
        type=str,
        default=str(DB_PATH),
        help=f"Path to orpha.sqlite (default: {DB_PATH})",
    )
    parser.add_argument(
        "--json",
        dest="output_json",
        action="store_true",
        help="Output results as JSON instead of a table",
    )
    args = parser.parse_args()

    # Load index
    db = args.db
    if not Path(db).exists():
        print(
            f"ERROR: Database not found at {db}\n"
            "       Run the ingest pipeline first: uv run python -m ingest.pipeline",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Loading scoring index from {db} ...", end=" ", flush=True)
    t0 = time.perf_counter()
    index = ScoringIndex.load(db)
    elapsed_load = time.perf_counter() - t0
    print(f"done ({elapsed_load:.2f}s)")

    # Run evaluations
    rows: list[dict] = []
    t_eval = time.perf_counter()

    for case in DEMO_CASES:
        name: str = case["name"]
        expected_orpha: int = case["orpha_code"]
        hpo_terms: list[tuple[str, float]] = case["hpo_terms"]

        results = index.rank(hpo_terms, top_k=args.top_k)
        ranked_codes = [r.orpha_code for r in results]

        # Determine rank of expected disease (1-indexed; None if not found)
        try:
            rank = ranked_codes.index(expected_orpha) + 1
        except ValueError:
            rank = None

        top1 = rank == 1
        top3 = rank is not None and rank <= 3
        top5 = rank is not None and rank <= 5
        rr   = (1.0 / rank) if rank is not None else 0.0

        row = {
            "name": name,
            "orpha_code": expected_orpha,
            "rank": rank,
            "top1": top1,
            "top3": top3,
            "top5": top5,
            "rr": rr,
        }

        if args.verbose:
            row["candidates"] = [
                {"orpha_code": r.orpha_code, "name": r.name, "confidence": r.confidence}
                for r in results[:3]
            ]

        rows.append(row)

    elapsed_eval = time.perf_counter() - t_eval

    # ------------------------------------------------------------------
    # JSON output
    # ------------------------------------------------------------------
    if args.output_json:
        summary = {
            "top1_accuracy": sum(r["top1"] for r in rows) / len(rows),
            "top3_accuracy": sum(r["top3"] for r in rows) / len(rows),
            "top5_accuracy": sum(r["top5"] for r in rows) / len(rows),
            "mrr": sum(r["rr"] for r in rows) / len(rows),
            "n": len(rows),
            "cases": rows,
        }
        print(json.dumps(summary, indent=2))
        return

    # ------------------------------------------------------------------
    # Table output
    # ------------------------------------------------------------------
    print()
    print(_box_top())
    print(_row("Disease", "Expected", "Got rank", "Top-1?"))
    print(_box_sep())

    for row in rows:
        rank_str = str(row["rank"]) if row["rank"] is not None else f">{args.top_k}"
        top1_str = "✓" if row["top1"] else "✗"
        print(_row(row["name"], str(row["orpha_code"]), rank_str, top1_str))

        if args.verbose and "candidates" in row:
            for i, cand in enumerate(row["candidates"], 1):
                label = f"  #{i} {cand['name'][:30]} ({cand['confidence']:.1f})"
                print("│ " + label.ljust(COL_DISEASE + COL_ORPHA + COL_RANK + COL_TOP1 + 9) + " │")

    print(_box_bot())

    n = len(rows)
    top1_n  = sum(r["top1"] for r in rows)
    top3_n  = sum(r["top3"] for r in rows)
    top5_n  = sum(r["top5"] for r in rows)
    mrr     = sum(r["rr"]   for r in rows) / n

    print()
    print(f"Top-1 accuracy:  {top1_n}/{n}  ({100 * top1_n / n:.1f}%)")
    print(f"Top-3 accuracy:  {top3_n}/{n}  ({100 * top3_n / n:.1f}%)")
    print(f"Top-5 accuracy:  {top5_n}/{n}  ({100 * top5_n / n:.1f}%)")
    print(f"MRR:             {mrr:.3f}")
    print()
    print(f"Evaluated {n} cases in {elapsed_eval:.2f}s  (index load: {elapsed_load:.2f}s)")


if __name__ == "__main__":
    main()

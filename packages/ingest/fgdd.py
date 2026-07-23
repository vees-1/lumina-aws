"""Load FGDD facial phenotype data into orpha.sqlite."""

import csv
from collections import defaultdict

from sqlmodel import Session, delete

from ingest.db import DATA_DIR, init_db
from ingest.models import FacialDiseasePhenotype

FGDD_DIR = DATA_DIR / "fgdd" / "data"
FGDD_CSV = FGDD_DIR / "FGDD.csv"
DISEASES_CSV = FGDD_DIR / "diseases.csv"
RELATION_CSV = FGDD_DIR / "relation_sample_phenotype.csv"


def _load_disease_map() -> dict[str, tuple[int | None, str]]:
    """Map patient_id → (disease_id, disease_name) from FGDD.csv last two columns."""
    mapping: dict[str, tuple[int | None, str]] = {}
    with open(FGDD_CSV, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            pid = row.get("patient_id", "").strip()
            did_raw = row.get("Disease_id", "").strip().rstrip(".0")
            did = int(did_raw) if did_raw.isdigit() else None
            dname = row.get("Disease_name", "").strip()
            if pid:
                mapping[pid] = (did, dname)
    return mapping


def load_fgdd(session: Session) -> int:
    session.exec(delete(FacialDiseasePhenotype))
    session.commit()

    patient_disease = _load_disease_map()

    # Count (disease_id, disease_name, hpo_id) occurrences from relation_sample_phenotype.csv
    counts: dict[tuple[int | None, str, str], int] = defaultdict(int)
    with open(RELATION_CSV, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            sid = row.get("sid", "").strip()
            hpo_id = row.get("pid", "").strip()
            if not sid or not hpo_id:
                continue
            disease_info = patient_disease.get(sid)
            if disease_info is None:
                continue
            did, dname = disease_info
            counts[(did, dname, hpo_id)] += 1

    rows = [
        FacialDiseasePhenotype(disease_id=did, disease_name=dname, hpo_id=hpo_id, count=cnt)
        for (did, dname, hpo_id), cnt in counts.items()
    ]

    session.add_all(rows)
    session.commit()
    print(f"  facial_disease_phenotype: {len(rows)} disease-phenotype pairs")
    return len(rows)


def run():
    print("Loading FGDD facial phenotypes...")
    engine = init_db()
    with Session(engine) as session:
        load_fgdd(session)
    print("FGDD done.")


if __name__ == "__main__":
    run()

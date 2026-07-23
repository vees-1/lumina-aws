"""Load ClinVar gene→disease mapping into orpha.sqlite."""

import csv

from sqlmodel import Session, delete

from ingest.db import DATA_DIR, init_db
from ingest.models import ClinVarGeneDisease

CLINVAR_TSV = DATA_DIR / "clinvar" / "gene_condition_source_id"


def load_clinvar(session: Session) -> int:
    session.exec(delete(ClinVarGeneDisease))
    session.commit()

    rows = []
    with open(CLINVAR_TSV, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        for row in reader:
            gene_id_raw = row.get("GeneID", "").strip()
            gene_id = int(gene_id_raw) if gene_id_raw.isdigit() else None
            gene_symbol = row.get("AssociatedGenes", "").strip() or row.get("RelatedGenes", "").strip()
            if not gene_symbol:
                continue
            mim_raw = row.get("DiseaseMIM", "").strip()
            disease_mim = int(mim_raw) if mim_raw.isdigit() else None
            rows.append(
                ClinVarGeneDisease(
                    gene_id=gene_id,
                    gene_symbol=gene_symbol,
                    concept_id=row.get("ConceptID", "").strip(),
                    disease_name=row.get("DiseaseName", "").strip(),
                    source_name=row.get("SourceName", "").strip() or None,
                    source_id=row.get("SourceID", "").strip() or None,
                    disease_mim=disease_mim,
                )
            )

    session.add_all(rows)
    session.commit()
    print(f"  clinvar_gene_disease: {len(rows)} records")
    return len(rows)


def run():
    print("Loading ClinVar gene-disease map...")
    engine = init_db()
    with Session(engine) as session:
        load_clinvar(session)
    print("ClinVar done.")


if __name__ == "__main__":
    run()

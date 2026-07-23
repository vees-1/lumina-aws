"""Ingest smoke tests — assert row counts, sample lookups, FK consistency."""

import pytest
from ingest.db import DB_PATH, get_engine
from ingest.models import (
    ClinVarGeneDisease,
    CrossRef,
    Disease,
    DiseaseGene,
    DiseasePhenotype,
    FacialDiseasePhenotype,
    HPOAncestor,
    HPOTerm,
    Prevalence,
)
from sqlmodel import Session, func, select


@pytest.fixture(scope="module")
def session():
    if not DB_PATH.exists():
        pytest.skip("orpha.sqlite not found — run ingest first")
    engine = get_engine()
    with Session(engine) as s:
        yield s


# ── Row count assertions ──────────────────────────────────────────────────────

def test_disease_count(session):
    count = session.exec(select(func.count()).select_from(Disease)).one()
    assert count > 10_000, f"Expected >10000 diseases, got {count}"


def test_disease_phenotype_count(session):
    count = session.exec(select(func.count()).select_from(DiseasePhenotype)).one()
    assert count > 100_000, f"Expected >100000 disease-phenotype rows, got {count}"


def test_disease_gene_count(session):
    count = session.exec(select(func.count()).select_from(DiseaseGene)).one()
    assert count > 5_000, f"Expected >5000 disease-gene rows, got {count}"


def test_prevalence_count(session):
    count = session.exec(select(func.count()).select_from(Prevalence)).one()
    assert count > 10_000, f"Expected >10000 prevalence rows, got {count}"


def test_hpo_term_count(session):
    count = session.exec(select(func.count()).select_from(HPOTerm)).one()
    assert count > 15_000, f"Expected >15000 HPO terms, got {count}"


def test_hpo_ancestor_count(session):
    count = session.exec(select(func.count()).select_from(HPOAncestor)).one()
    assert count > 100_000, f"Expected >100000 ancestor pairs, got {count}"


def test_clinvar_count(session):
    count = session.exec(select(func.count()).select_from(ClinVarGeneDisease)).one()
    assert count > 10_000, f"Expected >10000 ClinVar records, got {count}"


def test_facial_phenotype_count(session):
    count = session.exec(select(func.count()).select_from(FacialDiseasePhenotype)).one()
    assert count > 1_000, f"Expected >1000 facial phenotype rows, got {count}"


# ── Sample lookups ────────────────────────────────────────────────────────────

def test_dravet_exists(session):
    """ORPHA:33069 — Dravet syndrome must be in the disease table."""
    disease = session.get(Disease, 33069)
    assert disease is not None, "Dravet syndrome (ORPHA:33069) not found"
    assert "Dravet" in disease.name


def test_dravet_has_seizure_phenotype(session):
    """Dravet (ORPHA:33069) must have at least one seizure-related HPO term."""
    rows = session.exec(
        select(DiseasePhenotype).where(
            DiseasePhenotype.orpha_code == 33069,
            DiseasePhenotype.hpo_id.in_(["HP:0001250", "HP:0007359", "HP:0001327"]),
        )
    ).all()
    assert len(rows) > 0, "No seizure HPO term linked to Dravet syndrome"


def test_seizure_hpo_term_has_ic(session):
    """HP:0001250 must have a non-null IC value."""
    term = session.get(HPOTerm, "HP:0001250")
    assert term is not None, "HPO term HP:0001250 not found"
    assert term.ic is not None and term.ic > 0, "IC for HP:0001250 is missing or zero"


def test_seizure_has_ancestors(session):
    """HP:0001250 must have at least 3 ancestors (HPO graph loaded)."""
    rows = session.exec(
        select(HPOAncestor).where(HPOAncestor.hpo_id == "HP:0001250")
    ).all()
    assert len(rows) >= 3, f"Expected ≥3 ancestors for HP:0001250, got {len(rows)}"


def test_scn1a_in_clinvar(session):
    """SCN1A (Dravet gene) must appear in clinvar_gene_disease."""
    rows = session.exec(
        select(ClinVarGeneDisease).where(ClinVarGeneDisease.gene_symbol == "SCN1A")
    ).all()
    assert len(rows) > 0, "SCN1A not found in clinvar_gene_disease"


def test_cross_refs_for_dravet(session):
    """Dravet syndrome must have at least one cross-reference."""
    rows = session.exec(
        select(CrossRef).where(CrossRef.orpha_code == 33069)
    ).all()
    assert len(rows) > 0, "No cross-refs found for ORPHA:33069"


# ── FK consistency ────────────────────────────────────────────────────────────

def test_disease_phenotype_orpha_codes_exist(session):
    """Every orpha_code in disease_phenotype must exist in disease."""
    orphas_in_dp = session.exec(
        select(DiseasePhenotype.orpha_code).distinct()
    ).all()
    orphas_in_disease = set(
        session.exec(select(Disease.orpha_code)).all()
    )
    missing = [c for c in orphas_in_dp if c not in orphas_in_disease]
    assert len(missing) == 0, f"{len(missing)} orpha_codes in disease_phenotype missing from disease"


def test_disease_gene_orpha_codes_exist(session):
    """Every orpha_code in disease_gene must exist in disease."""
    orphas_in_dg = session.exec(
        select(DiseaseGene.orpha_code).distinct()
    ).all()
    orphas_in_disease = set(
        session.exec(select(Disease.orpha_code)).all()
    )
    missing = [c for c in orphas_in_dg if c not in orphas_in_disease]
    assert len(missing) == 0, f"{len(missing)} orpha_codes in disease_gene missing from disease"

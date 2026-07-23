"""VCF → HPO terms via ClinVar significance + gene→disease→HPO lookup."""

from __future__ import annotations

import gzip
import os
import re
import tempfile

from ingest.models import ClinVarGeneDisease, DiseasePhenotype
from sqlmodel import Session, select

from extractors.models import HPOTerm

_PATHOGENIC = {"pathogenic", "likely_pathogenic", "pathogenic/likely_pathogenic"}
_HIGH_CONFIDENCE = 0.9


class VcfExtractionError(ValueError):
    """Raised when a VCF is readable but cannot produce HPO terms."""


def _parse_clnsig(info: dict) -> set[str]:
    raw = info.get("CLNSIG", "")
    if isinstance(raw, (list, tuple)):
        raw = raw[0] if raw else ""
    return {s.strip().lower().replace(" ", "_") for s in re.split(r"[,|;&]", str(raw)) if s.strip()}


def _parse_clnsigconf(info: dict) -> set[str]:
    raw = info.get("CLNSIGCONF", "")
    if isinstance(raw, (list, tuple)):
        raw = raw[0] if raw else ""
    normalized = str(raw).replace("(", "|").replace(")", "|")
    return {
        s.strip().lower().replace(" ", "_") for s in re.split(r"[,|;&/]", normalized) if s.strip()
    }


def _parse_gene_symbols(info: dict) -> list[str]:
    """Extract gene symbols from GENEINFO field: 'GENE1:1234|GENE2:5678'."""
    symbols: set[str] = set()
    for key in ("GENEINFO", "SYMBOL", "GENE", "Gene.refGene"):
        raw = info.get(key, "")
        if isinstance(raw, (list, tuple)):
            raw = raw[0] if raw else ""
        for part in str(raw).replace(",", "|").split("|"):
            gene = part.split(":")[0].strip()
            if gene and gene not in {".", "NA"}:
                symbols.add(gene)

    for key in ("ANN", "CSQ"):
        raw = info.get(key, "")
        if isinstance(raw, (list, tuple)):
            raw = ",".join(str(item) for item in raw)
        for annotation in str(raw).split(","):
            fields = annotation.split("|")
            for idx in (3, 4):
                if len(fields) > idx and re.fullmatch(r"[A-Za-z0-9.-]{2,20}", fields[idx]):
                    symbols.add(fields[idx])
    return sorted(symbols)


def _has_pathogenic_signal(info: dict) -> bool:
    clnsig = _parse_clnsig(info)
    if _PATHOGENIC & clnsig:
        return True
    clnsigconf = _parse_clnsigconf(info)
    if {"pathogenic", "likely_pathogenic"} & clnsigconf:
        return True
    raw_impact = " ".join(str(info.get(key, "")) for key in ("IMPACT", "ANN", "CSQ"))
    return bool(re.search(r"\b(HIGH|MODERATE|pathogenic|likely_pathogenic)\b", raw_impact, re.I))


def extract_vcf(vcf_bytes: bytes, db_engine) -> list[HPOTerm]:
    """Extract high-confidence HPO terms from a VCF file.

    Pipeline: pathogenic variants → gene symbols → ClinVar disease lookup →
    disease-phenotype table → HPO terms (confidence 0.9).
    """
    try:
        import cyvcf2
    except ImportError:
        return []

    raw_vcf = vcf_bytes
    if raw_vcf.startswith(b"\x1f\x8b"):
        try:
            raw_vcf = gzip.decompress(raw_vcf)
        except Exception:
            raw_vcf = vcf_bytes

    with tempfile.NamedTemporaryFile(suffix=".vcf", delete=False) as tmp:
        tmp.write(raw_vcf)
        tmp_path = tmp.name

    genes_found: set[str] = set()
    try:
        vcf = cyvcf2.VCF(tmp_path)
        for variant in vcf:
            info = dict(variant.INFO)
            if _has_pathogenic_signal(info):
                genes_found.update(_parse_gene_symbols(info))
    except Exception as exc:
        raise VcfExtractionError("Could not parse this VCF file.") from exc
    finally:
        os.unlink(tmp_path)

    if not genes_found:
        raise VcfExtractionError("VCF parsed, but no pathogenic gene annotations were found.")

    with Session(db_engine) as session:
        # gene → diseases from ClinVar
        orpha_codes: set[int] = set()
        gene_to_disease: dict[str, list[str]] = {}
        for gene in genes_found:
            rows = session.exec(
                select(ClinVarGeneDisease).where(ClinVarGeneDisease.gene_symbol == gene)
            ).all()
            if rows:
                gene_to_disease[gene] = [r.disease_name for r in rows]

        # Map ClinVar disease names to orpha codes via disease table
        # (ClinVar doesn't have orpha codes directly — use gene→disease_gene→orpha)
        from ingest.models import DiseaseGene

        for gene in genes_found:
            dg_rows = session.exec(select(DiseaseGene).where(DiseaseGene.gene_symbol == gene)).all()
            for dg in dg_rows:
                orpha_codes.add(dg.orpha_code)

        if not orpha_codes:
            raise VcfExtractionError(
                "VCF parsed, but no pathogenic gene-to-disease mapping was found."
            )

        # Get HPO phenotypes for all matched diseases
        seen: dict[str, HPOTerm] = {}
        for orpha_code in orpha_codes:
            dp_rows = session.exec(
                select(DiseasePhenotype).where(DiseasePhenotype.orpha_code == orpha_code)
            ).all()
            for dp in dp_rows:
                if dp.hpo_id not in seen and dp.frequency_weight >= 0.5:
                    gene_source = next(iter(genes_found))
                    seen[dp.hpo_id] = HPOTerm(
                        hpo_id=dp.hpo_id,
                        confidence=_HIGH_CONFIDENCE * dp.frequency_weight,
                        source=gene_source,
                        assertion="present",
                        source_type="vcf",
                    )

    results = list(seen.values())
    if not results:
        raise VcfExtractionError(
            "VCF parsed, but no disease phenotypes were mapped from its pathogenic genes."
        )
    return results

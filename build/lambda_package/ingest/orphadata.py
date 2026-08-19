"""Parse Orphanet XML files into orpha.sqlite."""


from lxml import etree
from sqlmodel import Session, delete

from ingest.db import DATA_DIR, init_db
from ingest.models import CrossRef, Disease, DiseaseGene, DiseasePhenotype, Prevalence

ORPHADATA = DATA_DIR / "orphadata"

PRODUCT1 = ORPHADATA / "Rare diseases and classifications" / "Cross-referencing of rare diseases" / "XML" / "en_product1.xml"
PRODUCT4 = ORPHADATA / "Rare diseases with associated phenotypes" / "en_product4.xml"
PRODUCT6 = ORPHADATA / "Genes associated with rare diseases" / "en_product6.xml"
PRODUCT9_PREV = ORPHADATA / "Epidemiological data" / "Rare disease epidemiology" / "en_product9_prev.xml"

FREQUENCY_WEIGHTS: dict[str, float] = {
    "Obligate (100%)": 1.0,
    "Very frequent (99-80%)": 0.895,
    "Frequent (79-30%)": 0.545,
    "Occasional (29-5%)": 0.17,
    "Very rare (<4-1%)": 0.025,
    "Excluded (0%)": 0.0,
}


def _text(el, tag: str) -> str:
    child = el.find(tag)
    return child.text.strip() if child is not None and child.text else ""


def load_product1(session: Session) -> int:
    session.exec(delete(CrossRef))
    session.exec(delete(Disease))
    session.commit()

    tree = etree.parse(str(PRODUCT1))
    diseases, cross_refs = [], []

    for disorder in tree.findall(".//Disorder"):
        code_el = disorder.find("OrphaCode")
        if code_el is None:
            continue
        orpha_code = int(code_el.text)
        name = _text(disorder, "Name")
        dt_el = disorder.find("DisorderType")
        disorder_type = _text(dt_el, "Name") if dt_el is not None else ""
        dg_el = disorder.find("DisorderGroup")
        disorder_group = _text(dg_el, "Name") if dg_el is not None else ""

        diseases.append(Disease(orpha_code=orpha_code, name=name, disorder_type=disorder_type, disorder_group=disorder_group))

        for ref in disorder.findall(".//ExternalReference"):
            source = _text(ref, "Source")
            reference = _text(ref, "Reference")
            rel_el = ref.find("DisorderMappingRelation")
            relation = _text(rel_el, "Name") if rel_el is not None else ""
            cross_refs.append(CrossRef(orpha_code=orpha_code, source=source, reference=reference, mapping_relation=relation))

    session.add_all(diseases)
    session.add_all(cross_refs)
    session.commit()
    print(f"  product1: {len(diseases)} diseases, {len(cross_refs)} cross-refs")
    return len(diseases)


def load_product4(session: Session) -> int:
    session.exec(delete(DiseasePhenotype))
    session.commit()

    tree = etree.parse(str(PRODUCT4))
    rows = []

    for disorder in tree.findall(".//Disorder"):
        code_el = disorder.find("OrphaCode")
        if code_el is None:
            continue
        orpha_code = int(code_el.text)

        for assoc in disorder.findall(".//HPODisorderAssociation"):
            hpo_el = assoc.find("HPO")
            freq_el = assoc.find("HPOFrequency")
            if hpo_el is None:
                continue
            hpo_id = _text(hpo_el, "HPOId")
            hpo_term = _text(hpo_el, "HPOTerm")
            freq_label = _text(freq_el, "Name") if freq_el is not None else ""
            weight = FREQUENCY_WEIGHTS.get(freq_label, 0.1)
            rows.append(DiseasePhenotype(orpha_code=orpha_code, hpo_id=hpo_id, hpo_term=hpo_term, frequency_label=freq_label, frequency_weight=weight))

    session.add_all(rows)
    session.commit()
    print(f"  product4: {len(rows)} disease-phenotype associations")
    return len(rows)


def load_product6(session: Session) -> int:
    session.exec(delete(DiseaseGene))
    session.commit()

    tree = etree.parse(str(PRODUCT6))
    rows = []

    for disorder in tree.findall(".//Disorder"):
        code_el = disorder.find("OrphaCode")
        if code_el is None:
            continue
        orpha_code = int(code_el.text)

        for assoc in disorder.findall(".//DisorderGeneAssociation"):
            gene_el = assoc.find("Gene")
            if gene_el is None:
                continue
            symbol = _text(gene_el, "Symbol")
            gene_name = _text(gene_el, "Name")
            ensembl_id = None
            for ext_ref in gene_el.findall(".//ExternalReference"):
                if _text(ext_ref, "Source") == "Ensembl":
                    ensembl_id = _text(ext_ref, "Reference")
                    break
            rows.append(DiseaseGene(orpha_code=orpha_code, gene_symbol=symbol, gene_name=gene_name, ensembl_id=ensembl_id))

    session.add_all(rows)
    session.commit()
    print(f"  product6: {len(rows)} disease-gene associations")
    return len(rows)


def load_product9_prev(session: Session) -> int:
    session.exec(delete(Prevalence))
    session.commit()

    tree = etree.parse(str(PRODUCT9_PREV))
    rows = []

    for disorder in tree.findall(".//Disorder"):
        code_el = disorder.find("OrphaCode")
        if code_el is None:
            continue
        orpha_code = int(code_el.text)

        for prev in disorder.findall(".//Prevalence"):
            pt_el = prev.find("PrevalenceType")
            prev_type = _text(pt_el, "Name") if pt_el is not None else ""
            prev_class_el = prev.find("PrevalenceClass")
            prev_class = prev_class_el.text.strip() if prev_class_el is not None and prev_class_el.text else None
            val_el = prev.find("ValMoy")
            val_moy = float(val_el.text) if val_el is not None and val_el.text else None
            geo_el = prev.find("PrevalenceGeographic")
            geo = _text(geo_el, "Name") if geo_el is not None else ""
            rows.append(Prevalence(orpha_code=orpha_code, prevalence_type=prev_type, prevalence_class=prev_class, val_moy=val_moy, geographic=geo))

    session.add_all(rows)
    session.commit()
    print(f"  product9_prev: {len(rows)} prevalence records")
    return len(rows)


def run():
    print("Loading orphadata...")
    engine = init_db()
    with Session(engine) as session:
        load_product1(session)
        load_product4(session)
        load_product6(session)
        load_product9_prev(session)
    print("orphadata done.")


if __name__ == "__main__":
    run()

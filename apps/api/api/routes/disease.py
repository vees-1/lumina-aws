import re

from fastapi import APIRouter, HTTPException, Query, Request
from ingest.models import CrossRef, Disease, DiseaseGene, DiseasePhenotype, Prevalence
from pydantic import BaseModel
from sqlmodel import Session, col, select

router = APIRouter(prefix="/disease", tags=["disease"])

_LANG_ALIASES = {
    "en": "en",
    "en-us": "en",
    "en-gb": "en",
    "fr": "fr",
    "fr-fr": "fr",
    "es": "es",
    "es-es": "es",
    "de": "de",
    "de-de": "de",
    "hi": "hi",
    "hi-in": "hi",
    "ja": "ja",
    "ja-jp": "ja",
    "zh": "zh",
    "zh-cn": "zh",
    "zh-tw": "zh",
}

_SUMMARY_TEXT = {
    "en": {
        "x-linked dominant": "X-linked dominant",
        "x-linked recessive": "X-linked recessive",
        "x-linked": "X-linked",
        "autosomal dominant": "Autosomal dominant",
        "autosomal recessive": "Autosomal recessive",
        "mitochondrial": "Mitochondrial",
        "prenatal": "Prenatal",
        "congenital": "Congenital",
        "neonatal": "Neonatal",
        "infancy": "Infancy",
        "childhood": "Childhood",
        "juvenile": "Juvenile",
        "adolescence": "Adolescence",
        "adult": "Adult",
        "late onset": "Late onset",
        "early onset": "Early onset",
        "targeted": "Targeted molecular confirmation of {genes}",
        "panel": "Targeted molecular panel including {genes}",
        "phenotype_panel": "Phenotype-directed molecular panel including {genes}",
        "clinical_workup": "Clinical genetics workup with phenotype-directed molecular confirmation",
        "prevalence_value": "{type}: {value}{suffix}",
        "prevalence_class": "{type}: {value}{suffix}",
        "prevalence_type": "{type}{suffix}",
    },
    "fr": {
        "x-linked dominant": "Liée à l'X dominante",
        "x-linked recessive": "Liée à l'X récessive",
        "x-linked": "Liée à l'X",
        "autosomal dominant": "Autosomique dominante",
        "autosomal recessive": "Autosomique récessive",
        "mitochondrial": "Mitochondriale",
        "prenatal": "Prénatale",
        "congenital": "Congénitale",
        "neonatal": "Néonatale",
        "infancy": "Petite enfance",
        "childhood": "Enfance",
        "juvenile": "Juvénile",
        "adolescence": "Adolescence",
        "adult": "Adulte",
        "late onset": "Début tardif",
        "early onset": "Début précoce",
        "targeted": "Confirmation moléculaire ciblée de {genes}",
        "panel": "Panel moléculaire ciblé incluant {genes}",
        "phenotype_panel": "Panel moléculaire orienté par le phénotype incluant {genes}",
        "clinical_workup": "Bilan de génétique clinique avec confirmation moléculaire orientée par le phénotype",
        "prevalence_value": "{type}: {value}{suffix}",
        "prevalence_class": "{type}: {value}{suffix}",
        "prevalence_type": "{type}{suffix}",
    },
    "es": {
        "x-linked dominant": "Ligada al X dominante",
        "x-linked recessive": "Ligada al X recesiva",
        "x-linked": "Ligada al X",
        "autosomal dominant": "Autosómica dominante",
        "autosomal recessive": "Autosómica recesiva",
        "mitochondrial": "Mitocondrial",
        "prenatal": "Prenatal",
        "congenital": "Congénita",
        "neonatal": "Neonatal",
        "infancy": "Lactancia",
        "childhood": "Infancia",
        "juvenile": "Juvenil",
        "adolescence": "Adolescencia",
        "adult": "Adulto",
        "late onset": "Inicio tardío",
        "early onset": "Inicio temprano",
        "targeted": "Confirmación molecular dirigida de {genes}",
        "panel": "Panel molecular dirigido que incluye {genes}",
        "phenotype_panel": "Panel molecular dirigido por el fenotipo que incluye {genes}",
        "clinical_workup": "Estudio de genética clínica con confirmación molecular dirigida por el fenotipo",
        "prevalence_value": "{type}: {value}{suffix}",
        "prevalence_class": "{type}: {value}{suffix}",
        "prevalence_type": "{type}{suffix}",
    },
    "de": {
        "x-linked dominant": "X-chromosomal-dominant",
        "x-linked recessive": "X-chromosomal-rezessiv",
        "x-linked": "X-chromosomal",
        "autosomal dominant": "Autosomal-dominant",
        "autosomal recessive": "Autosomal-rezessiv",
        "mitochondrial": "Mitochondrial",
        "prenatal": "Pränatal",
        "congenital": "Kongenital",
        "neonatal": "Neonatal",
        "infancy": "Säuglingsalter",
        "childhood": "Kindheit",
        "juvenile": "Juvenil",
        "adolescence": "Adoleszenz",
        "adult": "Erwachsen",
        "late onset": "Später Beginn",
        "early onset": "Früher Beginn",
        "targeted": "Gezielte molekulare Bestätigung von {genes}",
        "panel": "Gezieltes molekulares Panel einschließlich {genes}",
        "phenotype_panel": "Phänotypgesteuertes molekulares Panel einschließlich {genes}",
        "clinical_workup": "Klinisch-genetische Abklärung mit phänotypgesteuerter molekularer Bestätigung",
        "prevalence_value": "{type}: {value}{suffix}",
        "prevalence_class": "{type}: {value}{suffix}",
        "prevalence_type": "{type}{suffix}",
    },
    "hi": {
        "x-linked dominant": "X-लिंक्ड प्रभावी",
        "x-linked recessive": "X-लिंक्ड अप्रभावी",
        "x-linked": "X-लिंक्ड",
        "autosomal dominant": "ऑटोसोमल प्रभावी",
        "autosomal recessive": "ऑटोसोमल अप्रभावी",
        "mitochondrial": "माइटोकॉन्ड्रियल",
        "prenatal": "जन्म-पूर्व",
        "congenital": "जन्मजात",
        "neonatal": "नवजात",
        "infancy": "शैशवावस्था",
        "childhood": "बचपन",
        "juvenile": "किशोरावस्था",
        "adolescence": "किशोरावस्था",
        "adult": "वयस्क",
        "late onset": "देर से शुरू",
        "early onset": "जल्दी शुरू",
        "targeted": "{genes} की लक्षित आणविक पुष्टि",
        "panel": "{genes} सहित लक्षित आणविक पैनल",
        "phenotype_panel": "फेनोटाइप-निर्देशित आणविक पैनल जिसमें {genes} शामिल हैं",
        "clinical_workup": "फेनोटाइप-निर्देशित आणविक पुष्टि के साथ नैदानिक आनुवंशिकी मूल्यांकन",
        "prevalence_value": "{type}: {value}{suffix}",
        "prevalence_class": "{type}: {value}{suffix}",
        "prevalence_type": "{type}{suffix}",
    },
    "ja": {
        "x-linked dominant": "X連鎖優性",
        "x-linked recessive": "X連鎖劣性",
        "x-linked": "X連鎖",
        "autosomal dominant": "常染色体優性",
        "autosomal recessive": "常染色体劣性",
        "mitochondrial": "ミトコンドリア",
        "prenatal": "出生前",
        "congenital": "先天性",
        "neonatal": "新生児期",
        "infancy": "乳児期",
        "childhood": "小児期",
        "juvenile": "若年期",
        "adolescence": "思春期",
        "adult": "成人",
        "late onset": "遅発",
        "early onset": "早発",
        "targeted": "{genes}の標的分子確認",
        "panel": "{genes}を含む標的分子パネル",
        "phenotype_panel": "{genes}を含む表現型主導の分子パネル",
        "clinical_workup": "表現型主導の分子確認を伴う臨床遺伝学的評価",
        "prevalence_value": "{type}: {value}{suffix}",
        "prevalence_class": "{type}: {value}{suffix}",
        "prevalence_type": "{type}{suffix}",
    },
    "zh": {
        "x-linked dominant": "X连锁显性",
        "x-linked recessive": "X连锁隐性",
        "x-linked": "X连锁",
        "autosomal dominant": "常染色体显性",
        "autosomal recessive": "常染色体隐性",
        "mitochondrial": "线粒体",
        "prenatal": "产前",
        "congenital": "先天性",
        "neonatal": "新生儿期",
        "infancy": "婴儿期",
        "childhood": "儿童期",
        "juvenile": "少年期",
        "adolescence": "青春期",
        "adult": "成人",
        "late onset": "迟发",
        "early onset": "早发",
        "targeted": "{genes}的靶向分子确认",
        "panel": "包含{genes}的靶向分子面板",
        "phenotype_panel": "包含{genes}的表型导向分子面板",
        "clinical_workup": "进行表型导向分子确认的临床遗传学评估",
        "prevalence_value": "{type}: {value}{suffix}",
        "prevalence_class": "{type}: {value}{suffix}",
        "prevalence_type": "{type}{suffix}",
    },
}


def _normalize_lang(lang: str | None) -> str:
    if not lang:
        return "en"
    return _LANG_ALIASES.get(
        lang.strip().lower(), _LANG_ALIASES.get(lang.strip().lower().split("-")[0], "en")
    )


def _text(lang: str, key: str) -> str:
    bundle = _SUMMARY_TEXT.get(lang, _SUMMARY_TEXT["en"])
    return bundle.get(key, _SUMMARY_TEXT["en"].get(key, key))


class DiseaseSummary(BaseModel):
    orpha_code: int
    name: str
    disorder_type: str
    disorder_group: str


class DiseaseSearchResult(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[DiseaseSummary]


@router.get("/search", response_model=DiseaseSearchResult)
async def search_diseases(
    request: Request,
    q: str = Query(default="", description="Search by name or ORPHA code"),
    disorder_type: str = Query(default="", description="Filter by disorder type"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    lang: str | None = Query(default=None, description="Optional locale for human-readable labels"),
) -> DiseaseSearchResult:
    engine = request.app.state.db_engine
    with Session(engine) as s:
        stmt = select(Disease)
        if q.strip():
            term = q.strip()
            if term.isdigit():
                stmt = stmt.where(Disease.orpha_code == int(term))
            else:
                stmt = stmt.where(col(Disease.name).ilike(f"%{term}%"))
        if disorder_type.strip():
            stmt = stmt.where(Disease.disorder_type == disorder_type.strip())

        all_rows = s.exec(stmt.order_by(col(Disease.name))).all()
        total = len(all_rows)
        offset = (page - 1) * page_size
        page_rows = all_rows[offset : offset + page_size]

        return DiseaseSearchResult(
            total=total,
            page=page,
            page_size=page_size,
            results=[
                DiseaseSummary(
                    orpha_code=d.orpha_code,
                    name=d.name,
                    disorder_type=d.disorder_type,
                    disorder_group=d.disorder_group,
                )
                for d in page_rows
            ],
        )


class PhenotypeItem(BaseModel):
    hpo_id: str
    hpo_term: str
    frequency_label: str
    frequency_weight: float


class GeneItem(BaseModel):
    gene_symbol: str
    gene_name: str
    ensembl_id: str | None


class PrevalenceItem(BaseModel):
    prevalence_type: str
    prevalence_class: str | None
    val_moy: float | None
    geographic: str


class ClinicalSummary(BaseModel):
    inheritance: str | None
    confirmatory_workup: str | None
    typical_age_of_onset: str | None
    prevalence_summary: str | None


class DiseaseDetail(BaseModel):
    orpha_code: int
    name: str
    disorder_type: str
    disorder_group: str
    icd10: list[str]
    omim: list[str]
    phenotypes: list[PhenotypeItem]
    genes: list[GeneItem]
    prevalence: list[PrevalenceItem]
    clinical_summary: ClinicalSummary


_INHERITANCE_PATTERNS: list[tuple[str, str]] = [
    ("x-linked dominant", "X-linked dominant"),
    ("x-linked recessive", "X-linked recessive"),
    ("x-linked", "X-linked"),
    ("autosomal dominant", "Autosomal dominant"),
    ("autosomal recessive", "Autosomal recessive"),
    ("mitochondrial", "Mitochondrial"),
    ("maternal inheritance", "Mitochondrial"),
]

_ONSET_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bprenatal\b|\bfetal\b"), "Prenatal"),
    (re.compile(r"\bcongenital\b"), "Congenital"),
    (re.compile(r"\bneonatal\b"), "Neonatal"),
    (re.compile(r"\binfantile\b|\binfancy\b"), "Infancy"),
    (re.compile(r"\bchildhood\b"), "Childhood"),
    (re.compile(r"\bjuvenile\b"), "Juvenile"),
    (re.compile(r"\badolescent\b"), "Adolescence"),
    (re.compile(r"\badult\b"), "Adult"),
    (re.compile(r"\blate[- ]onset\b"), "Late onset"),
    (re.compile(r"\bearly[- ]onset\b"), "Early onset"),
]


def _dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def _derive_inheritance(disease: Disease, phenotypes: list[PhenotypeItem], lang: str) -> str | None:
    haystacks = [
        disease.name,
        disease.disorder_type,
        disease.disorder_group,
        *[p.hpo_term for p in phenotypes[:25]],
    ]
    for text in haystacks:
        lowered = text.lower()
        for needle, label in _INHERITANCE_PATTERNS:
            if needle in lowered:
                return _text(lang, label.lower())
    return None


def _derive_age_of_onset(phenotypes: list[PhenotypeItem], lang: str) -> str | None:
    for phenotype in phenotypes:
        lowered = phenotype.hpo_term.lower()
        for pattern, label in _ONSET_PATTERNS:
            if pattern.search(lowered):
                return _text(lang, label.lower())
    return None


def _join_gene_symbols(symbols: list[str]) -> str:
    if len(symbols) == 1:
        return symbols[0]
    if len(symbols) == 2:
        return f"{symbols[0]} and {symbols[1]}"
    return f"{', '.join(symbols[:-1])}, and {symbols[-1]}"


def _derive_confirmatory_workup(genes: list[GeneItem], omim: list[str], lang: str) -> str | None:
    gene_symbols = _dedupe_preserve_order([gene.gene_symbol for gene in genes if gene.gene_symbol])
    if gene_symbols:
        if len(gene_symbols) == 1:
            return _text(lang, "targeted").format(genes=gene_symbols[0])
        focus = gene_symbols[:3]
        if len(gene_symbols) > 3:
            return _text(lang, "phenotype_panel").format(genes=_join_gene_symbols(focus))
        return _text(lang, "panel").format(genes=_join_gene_symbols(focus))
    if omim:
        return _text(lang, "clinical_workup")
    return None


def _prevalence_sort_key(item: PrevalenceItem) -> tuple[int, int, int, float]:
    geographic_rank = {
        "worldwide": 0,
        "united states": 1,
        "europe": 2,
    }
    type_rank = {
        "point prevalence": 0,
        "prevalence at birth": 1,
        "annual incidence": 2,
    }
    geographic = item.geographic.strip().lower()
    prevalence_type = item.prevalence_type.strip().lower()
    has_numeric_value = 0 if item.val_moy and item.val_moy > 0 else 1
    return (
        has_numeric_value,
        geographic_rank.get(geographic, 3),
        type_rank.get(prevalence_type, 3),
        -(item.val_moy or 0),
    )


def _derive_prevalence_summary(prevalence: list[PrevalenceItem], lang: str) -> str | None:
    if not prevalence:
        return None

    best = sorted(prevalence, key=_prevalence_sort_key)[0]
    suffix = f" ({best.geographic})" if best.geographic else ""
    if best.val_moy is not None and best.val_moy > 0:
        return _text(lang, "prevalence_value").format(
            type=best.prevalence_type, value=f"{best.val_moy:g}", suffix=suffix
        )
    if best.prevalence_class:
        return _text(lang, "prevalence_class").format(
            type=best.prevalence_type, value=best.prevalence_class, suffix=suffix
        )
    return (
        _text(lang, "prevalence_type").format(type=best.prevalence_type, suffix=suffix)
        if best.prevalence_type
        else None
    )


@router.get("/{orpha_code}", response_model=DiseaseDetail)
async def get_disease(
    orpha_code: int,
    request: Request,
    lang: str | None = Query(default=None, description="Optional locale for human-readable labels"),
) -> DiseaseDetail:
    engine = request.app.state.db_engine
    with Session(engine) as s:
        disease = s.get(Disease, orpha_code)
        if disease is None:
            raise HTTPException(status_code=404, detail=f"ORPHA:{orpha_code} not found")

        cross_refs = s.exec(select(CrossRef).where(CrossRef.orpha_code == orpha_code)).all()
        icd10 = [r.reference for r in cross_refs if r.source in ("ICD-10", "ICD-11")]
        omim = [r.reference for r in cross_refs if r.source == "OMIM"]

        phenotypes = [
            PhenotypeItem(
                hpo_id=p.hpo_id,
                hpo_term=p.hpo_term,
                frequency_label=p.frequency_label,
                frequency_weight=p.frequency_weight,
            )
            for p in s.exec(
                select(DiseasePhenotype)
                .where(DiseasePhenotype.orpha_code == orpha_code)
                .order_by(DiseasePhenotype.frequency_weight.desc())
            ).all()
        ]

        genes = [
            GeneItem(gene_symbol=g.gene_symbol, gene_name=g.gene_name, ensembl_id=g.ensembl_id)
            for g in s.exec(select(DiseaseGene).where(DiseaseGene.orpha_code == orpha_code)).all()
        ]

        prevalence = [
            PrevalenceItem(
                prevalence_type=p.prevalence_type,
                prevalence_class=p.prevalence_class,
                val_moy=p.val_moy,
                geographic=p.geographic,
            )
            for p in s.exec(select(Prevalence).where(Prevalence.orpha_code == orpha_code)).all()
        ]

        lang = _normalize_lang(lang or request.query_params.get("locale"))
        clinical_summary = ClinicalSummary(
            inheritance=_derive_inheritance(disease, phenotypes, lang),
            confirmatory_workup=_derive_confirmatory_workup(genes, omim, lang),
            typical_age_of_onset=_derive_age_of_onset(phenotypes, lang),
            prevalence_summary=_derive_prevalence_summary(prevalence, lang),
        )

    return DiseaseDetail(
        orpha_code=disease.orpha_code,
        name=disease.name,
        disorder_type=disease.disorder_type,
        disorder_group=disease.disorder_group,
        icd10=icd10,
        omim=omim,
        phenotypes=phenotypes,
        genes=genes,
        prevalence=prevalence,
        clinical_summary=clinical_summary,
    )

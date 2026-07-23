
from sqlmodel import Field, SQLModel


class Disease(SQLModel, table=True):
    __tablename__ = "disease"
    orpha_code: int = Field(primary_key=True)
    name: str
    disorder_type: str = ""
    disorder_group: str = ""


class CrossRef(SQLModel, table=True):
    __tablename__ = "cross_ref"
    id: int | None = Field(default=None, primary_key=True)
    orpha_code: int = Field(index=True)
    source: str
    reference: str
    mapping_relation: str = ""


class DiseasePhenotype(SQLModel, table=True):
    __tablename__ = "disease_phenotype"
    id: int | None = Field(default=None, primary_key=True)
    orpha_code: int = Field(index=True)
    hpo_id: str = Field(index=True)
    hpo_term: str
    frequency_label: str
    frequency_weight: float  # 0.0–1.0


class DiseaseGene(SQLModel, table=True):
    __tablename__ = "disease_gene"
    id: int | None = Field(default=None, primary_key=True)
    orpha_code: int = Field(index=True)
    gene_symbol: str = Field(index=True)
    gene_name: str = ""
    ensembl_id: str | None = None


class Prevalence(SQLModel, table=True):
    __tablename__ = "prevalence"
    id: int | None = Field(default=None, primary_key=True)
    orpha_code: int = Field(index=True)
    prevalence_type: str
    prevalence_class: str | None = None
    val_moy: float | None = None
    geographic: str = ""


class HPOTerm(SQLModel, table=True):
    __tablename__ = "hpo_term"
    hpo_id: str = Field(primary_key=True)
    name: str
    definition: str | None = None
    ic: float | None = None  # information content (Orphanet-based)


class HPOAncestor(SQLModel, table=True):
    __tablename__ = "hpo_ancestor"
    id: int | None = Field(default=None, primary_key=True)
    hpo_id: str = Field(index=True)
    ancestor_id: str = Field(index=True)


class ClinVarGeneDisease(SQLModel, table=True):
    __tablename__ = "clinvar_gene_disease"
    id: int | None = Field(default=None, primary_key=True)
    gene_id: int | None = None
    gene_symbol: str = Field(index=True)
    concept_id: str
    disease_name: str
    source_name: str | None = None
    source_id: str | None = None
    disease_mim: int | None = None


class FacialDiseasePhenotype(SQLModel, table=True):
    __tablename__ = "facial_disease_phenotype"
    id: int | None = Field(default=None, primary_key=True)
    disease_id: int | None = None  # FGDD internal ID
    disease_name: str
    hpo_id: str = Field(index=True)
    count: int = 1  # patients with this phenotype-disease pair

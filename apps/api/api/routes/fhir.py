import uuid
from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/fhir", tags=["fhir"])

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

_FHIR_TEXT = {
    "en": {
        "unconfirmed": "Unconfirmed",
        "lab_report": "Laboratory report",
        "diagnosis": "Diagnosis",
        "vital_signs": "Vital signs",
        "title": "Lumina Rare Disease Differential Diagnosis Report",
        "differential": "Differential Diagnoses",
        "phenotypes": "Observed Phenotypes (HPO)",
    },
    "fr": {
        "unconfirmed": "Non confirmé",
        "lab_report": "Compte rendu de laboratoire",
        "diagnosis": "Diagnostic",
        "vital_signs": "Constantes vitales",
        "title": "Rapport de diagnostic différentiel des maladies rares Lumina",
        "differential": "Diagnostics différentiels",
        "phenotypes": "Phénotypes observés (HPO)",
    },
    "es": {
        "unconfirmed": "No confirmado",
        "lab_report": "Informe de laboratorio",
        "diagnosis": "Diagnóstico",
        "vital_signs": "Signos vitales",
        "title": "Informe de diagnóstico diferencial de enfermedades raras de Lumina",
        "differential": "Diagnósticos diferenciales",
        "phenotypes": "Fenotipos observados (HPO)",
    },
    "de": {
        "unconfirmed": "Nicht bestätigt",
        "lab_report": "Laborbericht",
        "diagnosis": "Diagnose",
        "vital_signs": "Vitalzeichen",
        "title": "Lumina Bericht zur Differenzialdiagnose seltener Erkrankungen",
        "differential": "Differenzialdiagnosen",
        "phenotypes": "Beobachtete Phänotypen (HPO)",
    },
    "hi": {
        "unconfirmed": "अपुष्ट",
        "lab_report": "प्रयोगशाला रिपोर्ट",
        "diagnosis": "निदान",
        "vital_signs": "महत्वपूर्ण संकेत",
        "title": "Lumina दुर्लभ रोग विभेदक निदान रिपोर्ट",
        "differential": "विभेदक निदान",
        "phenotypes": "देखे गए फेनोटाइप (HPO)",
    },
    "ja": {
        "unconfirmed": "未確認",
        "lab_report": "検査報告書",
        "diagnosis": "診断",
        "vital_signs": "バイタルサイン",
        "title": "Lumina 希少疾患鑑別診断レポート",
        "differential": "鑑別診断",
        "phenotypes": "観察された表現型 (HPO)",
    },
    "zh": {
        "unconfirmed": "未确认",
        "lab_report": "实验室报告",
        "diagnosis": "诊断",
        "vital_signs": "生命体征",
        "title": "Lumina 罕见病鉴别诊断报告",
        "differential": "鉴别诊断",
        "phenotypes": "观察到的表型（HPO）",
    },
}


def _normalize_lang(lang: str | None) -> str:
    if not lang:
        return "en"
    return _LANG_ALIASES.get(
        lang.strip().lower(), _LANG_ALIASES.get(lang.strip().lower().split("-")[0], "en")
    )


def _t(lang: str, key: str) -> str:
    bundle = _FHIR_TEXT.get(lang, _FHIR_TEXT["en"])
    return bundle.get(key, _FHIR_TEXT["en"].get(key, key))


class DiagnosisItem(BaseModel):
    orpha_code: int
    name: str
    confidence: float
    contributing_terms: list[str]


class HPOTermItem(BaseModel):
    hpo_id: str
    label: str = ""
    confidence: float


class FHIRExportRequest(BaseModel):
    diagnoses: list[DiagnosisItem]
    hpo_terms: list[HPOTermItem]
    case_id: str
    lang: str | None = None
    locale: str | None = None


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.post("/export")
async def export_fhir(body: FHIRExportRequest) -> JSONResponse:
    now = _now()
    bundle_id = _uuid()
    composition_id = _uuid()
    lang = _normalize_lang(body.lang or body.locale)

    # Build Condition resources
    condition_entries = []
    condition_refs = []
    for dx in body.diagnoses:
        cond_id = _uuid()
        condition_refs.append({"reference": f"urn:uuid:{cond_id}"})

        evidence = []
        for hpo_id in dx.contributing_terms:
            evidence.append(
                {
                    "code": [
                        {
                            "coding": [
                                {
                                    "system": "http://purl.obolibrary.org/obo/hp.owl",
                                    "code": hpo_id,
                                }
                            ]
                        }
                    ]
                }
            )

        condition_entries.append(
            {
                "fullUrl": f"urn:uuid:{cond_id}",
                "resource": {
                    "resourceType": "Condition",
                    "id": cond_id,
                    "verificationStatus": {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                                "code": "unconfirmed",
                                "display": _t(lang, "unconfirmed"),
                            }
                        ]
                    },
                    "code": {
                        "coding": [
                            {
                                "system": "http://www.orpha.net",
                                "code": f"ORPHA:{dx.orpha_code}",
                                "display": dx.name,
                            }
                        ],
                        "text": dx.name,
                    },
                    "evidence": evidence if evidence else [],
                    "extension": [
                        {
                            "url": "http://lumina.ai/fhir/StructureDefinition/diagnosis-confidence",
                            "valueDecimal": round(dx.confidence, 2),
                        }
                    ],
                },
            }
        )

    # Build Observation resources for HPO terms
    observation_entries = []
    observation_refs = []
    for term in body.hpo_terms:
        obs_id = _uuid()
        observation_refs.append({"reference": f"urn:uuid:{obs_id}"})
        observation_entries.append(
            {
                "fullUrl": f"urn:uuid:{obs_id}",
                "resource": {
                    "resourceType": "Observation",
                    "id": obs_id,
                    "status": "final",
                    "code": {
                        "coding": [
                            {
                                "system": "http://purl.obolibrary.org/obo/hp.owl",
                                "code": term.hpo_id,
                                "display": term.label if term.label else term.hpo_id,
                            }
                        ]
                    },
                    "valueBoolean": True,
                },
            }
        )

    # Composition resource
    composition = {
        "fullUrl": f"urn:uuid:{composition_id}",
        "resource": {
            "resourceType": "Composition",
            "id": composition_id,
            "status": "preliminary",
            "type": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": "11502-2",
                        "display": _t(lang, "lab_report"),
                    }
                ]
            },
            "date": now,
            "title": _t(lang, "title"),
            "identifier": {
                "system": "http://lumina.ai/cases",
                "value": body.case_id,
            },
            "author": [
                {
                    "display": "Lumina Clinical AI",
                }
            ],
            "section": [
                {
                    "title": _t(lang, "differential"),
                    "code": {
                        "coding": [
                            {
                                "system": "http://loinc.org",
                                "code": "29548-5",
                                "display": _t(lang, "diagnosis"),
                            }
                        ]
                    },
                    "entry": condition_refs,
                },
                {
                    "title": _t(lang, "phenotypes"),
                    "code": {
                        "coding": [
                            {
                                "system": "http://loinc.org",
                                "code": "8716-3",
                                "display": _t(lang, "vital_signs"),
                            }
                        ]
                    },
                    "entry": observation_refs,
                },
            ],
        },
    }

    bundle = {
        "resourceType": "Bundle",
        "id": bundle_id,
        "type": "document",
        "timestamp": now,
        "entry": [composition] + condition_entries + observation_entries,
    }

    return JSONResponse(content=bundle)

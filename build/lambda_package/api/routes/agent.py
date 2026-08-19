import json
import os
import re
from base64 import b64decode
from io import BytesIO
from typing import Literal
from xml.sax.saxutils import escape

from fastapi import APIRouter
from fastapi.responses import Response, StreamingResponse
from PIL import Image, ImageFile
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus import (
    Image as ReportLabImage,
)
from scoring.ranker import RankResult

router = APIRouter(prefix="/agent", tags=["agent"])
ImageFile.LOAD_TRUNCATED_IMAGES = True

_MODEL_NEXT = "llama-3.3-70b-versatile"
_MODEL_LETTER = "llama-3.3-70b-versatile"

_LANG_NAMES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "zh": "Chinese (Simplified)",
    "ja": "Japanese",
}

_REFERRAL_FIELD_LABELS: dict[str, dict[str, str]] = {
    "en": {
        "patient_name": "Patient name",
        "patient_dob": "Patient DOB",
        "referring_physician": "Referring physician",
        "referring_clinic": "Referring clinic",
        "recipient_specialist": "Recipient specialist",
        "recipient_hospital": "Recipient hospital",
        "urgency": "Urgency",
        "none": "None provided",
        "metadata_header": "Referral metadata",
        "context_header": "Patient context JSON",
        "diagnoses_header": "Top diagnoses",
        "evidence_header": "Evidence summary",
    },
    "de": {
        "patient_name": "Patientenname",
        "patient_dob": "Geburtsdatum",
        "referring_physician": "Überweisende/r Arzt/Ärztin",
        "referring_clinic": "Überweisende Einrichtung",
        "recipient_specialist": "Empfangende/r Facharzt/Fachärztin",
        "recipient_hospital": "Empfangende Klinik",
        "urgency": "Dringlichkeit",
        "none": "Keine Angaben",
        "metadata_header": "Überweisungsangaben",
        "context_header": "Patientenkontext (JSON)",
        "diagnoses_header": "Top-Diagnosen",
        "evidence_header": "Evidenzzusammenfassung",
    },
    "es": {
        "patient_name": "Nombre del paciente",
        "patient_dob": "Fecha de nacimiento",
        "referring_physician": "Médico remitente",
        "referring_clinic": "Clínica remitente",
        "recipient_specialist": "Especialista receptor",
        "recipient_hospital": "Hospital receptor",
        "urgency": "Urgencia",
        "none": "Sin datos",
        "metadata_header": "Metadatos de derivación",
        "context_header": "Contexto del paciente (JSON)",
        "diagnoses_header": "Diagnósticos principales",
        "evidence_header": "Resumen de evidencia",
    },
    "fr": {
        "patient_name": "Nom du patient",
        "patient_dob": "Date de naissance",
        "referring_physician": "Médecin adresseur",
        "referring_clinic": "Clinique adresseuse",
        "recipient_specialist": "Spécialiste destinataire",
        "recipient_hospital": "Hôpital destinataire",
        "urgency": "Urgence",
        "none": "Aucune donnée",
        "metadata_header": "Métadonnées d'adressage",
        "context_header": "Contexte patient (JSON)",
        "diagnoses_header": "Diagnostics principaux",
        "evidence_header": "Résumé des preuves",
    },
    "hi": {
        "patient_name": "रोगी का नाम",
        "patient_dob": "जन्म तिथि",
        "referring_physician": "रेफर करने वाले चिकित्सक",
        "referring_clinic": "रेफर करने वाला क्लिनिक",
        "recipient_specialist": "प्राप्तकर्ता विशेषज्ञ",
        "recipient_hospital": "प्राप्तकर्ता अस्पताल",
        "urgency": "अग्रता",
        "none": "कोई जानकारी उपलब्ध नहीं",
        "metadata_header": "रेफरल मेटाडेटा",
        "context_header": "रोगी संदर्भ (JSON)",
        "diagnoses_header": "शीर्ष निदान",
        "evidence_header": "प्रमाण सारांश",
    },
    "ja": {
        "patient_name": "患者氏名",
        "patient_dob": "生年月日",
        "referring_physician": "紹介元医師",
        "referring_clinic": "紹介元クリニック",
        "recipient_specialist": "紹介先専門医",
        "recipient_hospital": "紹介先病院",
        "urgency": "緊急度",
        "none": "情報なし",
        "metadata_header": "紹介メタデータ",
        "context_header": "患者コンテキスト (JSON)",
        "diagnoses_header": "主要診断",
        "evidence_header": "根拠サマリー",
    },
    "zh": {
        "patient_name": "患者姓名",
        "patient_dob": "出生日期",
        "referring_physician": "转诊医生",
        "referring_clinic": "转诊机构",
        "recipient_specialist": "接收专科医生",
        "recipient_hospital": "接收医院",
        "urgency": "紧急程度",
        "none": "未提供",
        "metadata_header": "转诊元数据",
        "context_header": "患者上下文 (JSON)",
        "diagnoses_header": "主要诊断",
        "evidence_header": "证据摘要",
    },
}

_URGENCY_TEXT: dict[str, dict[str, str]] = {
    "en": {"routine": "Routine", "urgent": "Urgent", "emergency": "Emergency"},
    "de": {"routine": "Routine", "urgent": "Dringend", "emergency": "Notfall"},
    "es": {"routine": "Rutinaria", "urgent": "Urgente", "emergency": "Emergencia"},
    "fr": {"routine": "Routinière", "urgent": "Urgente", "emergency": "Urgence vitale"},
    "hi": {"routine": "सामान्य", "urgent": "अत्यावश्यक", "emergency": "आपातकाल"},
    "ja": {"routine": "通常", "urgent": "緊急", "emergency": "救急"},
    "zh": {"routine": "常规", "urgent": "紧急", "emergency": "急诊"},
}

_LETTER_TEMPLATES: dict[str, dict[str, str]] = {
    "en": {
        "title": "CLINICAL REFERRAL LETTER",
        "date": "Date",
        "re": "Re",
        "dear": "Dear Colleague,",
        "history": "PRESENTING HISTORY",
        "findings": "CLINICAL FINDINGS",
        "impression": "DIAGNOSTIC IMPRESSION",
        "investigations": "RECOMMENDED INVESTIGATIONS",
        "closing": "I would be grateful for your assessment and any further management recommendations.",
        "signoff": "Yours sincerely,",
        "clinician": "Referring Clinician",
        "unknown_patient": "The patient",
    },
    "de": {
        "title": "KLINISCHES ÜBERWEISUNGSSCHREIBEN",
        "date": "Datum",
        "re": "Betreff",
        "dear": "Sehr geehrte Kollegin, sehr geehrter Kollege,",
        "history": "VORSTELLUNGSANAMNESE",
        "findings": "KLINISCHE BEFUNDE",
        "impression": "DIAGNOSTISCHE EINSCHÄTZUNG",
        "investigations": "EMPFOHLENE UNTERSUCHUNGEN",
        "closing": "Ich wäre Ihnen für Ihre Beurteilung und weitere Therapieempfehlungen dankbar.",
        "signoff": "Mit freundlichen Grüßen",
        "clinician": "Überweisende Ärztin / überweisender Arzt",
        "unknown_patient": "Die Patientin / der Patient",
    },
    "es": {
        "title": "CARTA CLÍNICA DE DERIVACIÓN",
        "date": "Fecha",
        "re": "Asunto",
        "dear": "Estimado/a colega:",
        "history": "HISTORIA CLÍNICA",
        "findings": "HALLAZGOS CLÍNICOS",
        "impression": "IMPRESIÓN DIAGNÓSTICA",
        "investigations": "INVESTIGACIONES RECOMENDADAS",
        "closing": "Agradecería su valoración y cualquier recomendación adicional de manejo.",
        "signoff": "Atentamente,",
        "clinician": "Médico remitente",
        "unknown_patient": "El/la paciente",
    },
    "fr": {
        "title": "LETTRE CLINIQUE D'ADRESSAGE",
        "date": "Date",
        "re": "Objet",
        "dear": "Chère consœur, cher confrère,",
        "history": "HISTOIRE CLINIQUE",
        "findings": "SIGNES CLINIQUES",
        "impression": "IMPRESSION DIAGNOSTIQUE",
        "investigations": "EXAMENS RECOMMANDÉS",
        "closing": "Je vous remercie par avance pour votre évaluation et vos recommandations de prise en charge.",
        "signoff": "Bien cordialement,",
        "clinician": "Médecin adresseur",
        "unknown_patient": "Le/la patient(e)",
    },
    "hi": {
        "title": "नैदानिक रेफरल पत्र",
        "date": "तारीख",
        "re": "विषय",
        "dear": "आदरणीय सहकर्मी,",
        "history": "प्रस्तुत बीमारी का इतिहास",
        "findings": "नैदानिक निष्कर्ष",
        "impression": "नैदानिक आकलन",
        "investigations": "अनुशंसित जांचें",
        "closing": "कृपया अपना मूल्यांकन और आगे के प्रबंधन संबंधी सुझाव प्रदान करें।",
        "signoff": "सादर,",
        "clinician": "रेफर करने वाले चिकित्सक",
        "unknown_patient": "रोगी",
    },
    "ja": {
        "title": "臨床紹介状",
        "date": "日付",
        "re": "件名",
        "dear": "ご担当先生",
        "history": "現病歴",
        "findings": "臨床所見",
        "impression": "診断的印象",
        "investigations": "推奨される検査",
        "closing": "ご評価および今後の管理についてご助言いただけますと幸いです。",
        "signoff": "敬具",
        "clinician": "紹介元医師",
        "unknown_patient": "患者",
    },
    "zh": {
        "title": "临床转诊信",
        "date": "日期",
        "re": "事由",
        "dear": "尊敬的同事：",
        "history": "现病史",
        "findings": "临床表现",
        "impression": "诊断印象",
        "investigations": "建议检查",
        "closing": "恳请您评估并提供进一步诊疗建议。",
        "signoff": "此致",
        "clinician": "转诊医生",
        "unknown_patient": "患者",
    },
}

_NEXT_SYSTEM = """You are a clinical reasoning assistant for rare disease diagnosis.
Given a ranked disease list and the modalities already used, suggest which modality to try next.

Return JSON only:
{{"modality": "notes|photo|lab|vcf", "reasoning": "one sentence", "cycles_remaining": 0-2}}

Modalities: notes (clinical text), photo (clinical photo), lab (lab reports), vcf (genetics VCF)
If confidence is high enough (top-1 > 85 AND gap to top-2 > 15), return cycles_remaining: 0.
Write the "reasoning" value in {lang_name}. Keep all JSON keys in English."""

_LETTER_SYSTEM = """You are a specialist physician writing a formal clinical referral letter.

Write the entire letter in {lang_name}. Do not mix English into the prose, headings, salutation, closing, field labels, or recommendations.
Use standard Markdown for structure (# for title, ## for sections, ** for emphasis, - for lists).

Structure exactly as follows:

# {title}

**{date}**: [today's date]
**{re}**: [Patient name if known, otherwise "{unknown_patient}"]

{dear}

### Reason for Referral
[1-2 sentences stating the core suspicion and reason for specialist review.]

### Clinical History
[2 sentences on presentation and timeline.]

### Clinical Findings
- [Accepted HPO Finding 1]
- [Accepted HPO Finding 2]
- [Maximum 5 most relevant findings]

### Diagnostic Impression
[State the leading clinical impression carefully as a possibility for specialist review. Do not include confidence percentages.]

### Scorecard Differential
[List the top 10 suggested differential diagnoses compactly, one line each if possible. Mention them only in this section and nowhere else in the letter.]

### Recommended Next Steps
- [Investigation 1]
- [Investigation 2]

{closing}

{signoff}

**{clinician}**

---
Rules:
- STRICT CONCISENESS: Target 140-180 words. Must fit on a single A4 page.
- Medical Terms: Gene symbols and IDs (HPO/ORPHA) remain in standard form.
- Specialty: If no recipient specialty is provided, use the suggested specialty from the case data.
- Findings: Include only the most important accepted/present findings. Include the top 10 differential diagnoses as a compact clinical scorecard list without percentages.
- Avoid duplication: Do not repeat the top 10 differential diagnoses outside the dedicated Scorecard Differential section.
- Patient Safety: Use calm clinical language. Avoid alarming phrasing, probability claims, and raw confidence scores.
- Metadata: Include age/sex, DOB, clinician/clinic, and urgency if provided.
- Tone: Highly professional, direct, and clinical."""


class AgentNextRequest(BaseModel):
    top5: list[RankResult]
    modalities_used: list[str]
    cycle: int = 0
    lang: str = "en"


class AgentSuggestion(BaseModel):
    modality: str
    reasoning: str
    cycles_remaining: int


class LetterRequest(BaseModel):
    top5: list[RankResult]
    evidence: dict
    patient_context: dict
    lang: str = "en"
    length_preference: Literal["shorter", "fuller"] | None = None


class PatientSummaryRequest(BaseModel):
    case_data: dict
    visit_recommendation: str = "routine_specialist"
    lang: str = "en"


class PatientSummary(BaseModel):
    headline: str
    body: str
    clinical_area: str
    recommended_next_step: str
    specialist: str
    safety_note: str


class LetterPdfRequest(BaseModel):
    letter: str
    case_data: dict
    doctor_profile: dict | None = None
    submission_id: str | None = None


def _first_present(context: dict, *keys: str) -> str:
    for key in keys:
        value = context.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def _format_referral_metadata(context: dict, lang: str) -> str:
    labels = _REFERRAL_FIELD_LABELS.get(lang, _REFERRAL_FIELD_LABELS["en"])
    urgency_map = _URGENCY_TEXT.get(lang, _URGENCY_TEXT["en"])
    urgency_value = _first_present(context, "urgency").lower()
    urgency_text = urgency_map.get(urgency_value, _first_present(context, "urgency"))

    fields = [
        (labels["patient_name"], _first_present(context, "patientName", "patient_name")),
        (
            labels["patient_dob"],
            _first_present(context, "dateOfBirth", "patientDob", "patient_dob", "dob"),
        ),
        (
            labels["referring_physician"],
            _first_present(context, "referringPhysicianName", "referring_physician_name"),
        ),
        (
            labels["referring_clinic"],
            _first_present(context, "referringClinic", "referring_clinic"),
        ),
        (
            labels["recipient_specialist"],
            _first_present(context, "recipientSpecialist", "recipient_specialist"),
        ),
        (
            labels["recipient_hospital"],
            _first_present(context, "recipientHospital", "recipient_hospital"),
        ),
        (labels["urgency"], urgency_text),
    ]
    lines = [f"- {label}: {value}" for label, value in fields if value]
    return "\n".join(lines) if lines else f"- {labels['none']}"


def _letter_system(lang: str) -> str:
    lang_name = _LANG_NAMES.get(lang, "English")
    template = _LETTER_TEMPLATES.get(lang, _LETTER_TEMPLATES["en"])
    return _LETTER_SYSTEM.format(lang_name=lang_name, **template)


def _letter_generation_guidance(body: LetterRequest) -> str:
    doctor_profile = (
        body.patient_context.get("doctorProfile")
        if isinstance(body.patient_context.get("doctorProfile"), dict)
        else {}
    )
    tone = str(doctor_profile.get("letterTone") or "").strip().lower()
    instructions: list[str] = []

    if body.length_preference == "shorter":
        instructions.append(
            "Length preference: regenerate a shorter version. Target 120-150 words, tighten the history, and keep the differential list extremely compact while still fitting on one A4 page."
        )
    elif body.length_preference == "fuller":
        instructions.append(
            "Length preference: regenerate a fuller version. Target 170-210 words, add a little more clinical context, but still keep the full letter within one A4 page."
        )

    if "detailed" in tone:
        instructions.append(
            "Tone preference: provide a slightly fuller evidence-backed specialist referral tone while staying concise and professional."
        )
    elif "patient-friendly" in tone:
        instructions.append(
            "Tone preference: keep the wording calm, plain, and reassuring while preserving clinical accuracy."
        )
    elif "concise" in tone:
        instructions.append(
            "Tone preference: keep the letter crisp and tightly written for rapid specialist review."
        )

    return "\n".join(instructions)


def _case_text(case_data: dict) -> str:
    top = case_data.get("rankings", [{}])[0] if case_data.get("rankings") else {}
    terms = case_data.get("hpoTerms", []) or []
    labels = [str(term.get("label") or term.get("hpo_id") or "") for term in terms[:12]]
    return " ".join(
        [
            str(case_data.get("notes") or ""),
            str(top.get("name") or ""),
            " ".join(labels),
        ]
    ).lower()


def _guess_specialist(case_data: dict) -> str:
    text = _case_text(case_data)
    if any(
        word in text
        for word in [
            "seizure",
            "epilep",
            "regression",
            "developmental delay",
            "ataxia",
            "hypotonia",
        ]
    ):
        return "Neurology"
    if any(
        word in text
        for word in ["cardiac", "heart", "aortic", "cardiomyopathy", "arrhythmia", "qt "]
    ):
        return "Cardiology"
    if any(
        word in text
        for word in ["metabolic", "lactic", "hypogly", "hyperammon", "acidosis", "amino acid"]
    ):
        return "Metabolic genetics"
    if any(word in text for word in ["eye", "retina", "optic", "lens", "vision", "ophthalm"]):
        return "Ophthalmology"
    return "Clinical genetics"


def _visit_text(value: str) -> str:
    return {
        "urgent_clinic": "Please see a doctor urgently.",
        "nearest_clinic": "Please attend the nearest appropriate clinic or specialist service.",
        "routine_specialist": "Please book a routine specialist appointment.",
        "more_data_first": "Please upload the requested information before booking a visit.",
        "no_visit_needed": "No clinic visit is needed right now unless symptoms change.",
    }.get(value, "Please book a routine specialist appointment.")


def _fallback_patient_summary(case_data: dict, visit_recommendation: str) -> PatientSummary:
    return PatientSummary(
        headline="Doctor guidance",
        body=_visit_text(visit_recommendation),
        clinical_area="",
        recommended_next_step=_visit_text(visit_recommendation),
        specialist="",
        safety_note="Seek urgent local medical care if symptoms become severe or suddenly worsen."
        if visit_recommendation in {"urgent_clinic", "nearest_clinic"}
        else "",
    )


def _safe_join(values: list[str], fallback: str) -> str:
    cleaned = [value.strip() for value in values if value and value.strip()]
    return ", ".join(cleaned) if cleaned else fallback


def _fallback_letter(body: LetterRequest, patient_context: dict) -> str:
    doctor_profile = (
        patient_context.get("doctorProfile")
        if isinstance(patient_context.get("doctorProfile"), dict)
        else {}
    )
    today = __import__("datetime").date.today().strftime("%d %b %Y")
    patient_name = _first_present(patient_context, "patientName", "patient_name") or "the patient"
    age = _first_present(patient_context, "age")
    sex = _first_present(patient_context, "sex")
    dob = _first_present(patient_context, "dateOfBirth", "patientDob", "patient_dob", "dob")
    clinician = _first_present(
        patient_context, "referringPhysicianName", "referring_physician_name"
    ) or str(doctor_profile.get("name") or "Referring clinician")
    clinic = _first_present(patient_context, "referringClinic", "referring_clinic") or str(
        doctor_profile.get("clinic") or ""
    )
    specialist = _first_present(
        patient_context, "recipientSpecialist", "recipient_specialist"
    ) or _guess_specialist(
        {
            "rankings": [item.dict() for item in body.top5],
            "hpoTerms": body.evidence.get("hpo_terms", []),
        }
    )
    urgency = _first_present(patient_context, "urgency") or "routine"
    visit_recommendation = _first_present(
        patient_context, "visitRecommendation", "visit_recommendation"
    )
    top = body.top5[0] if body.top5 else None
    top_name = top.name if top else "a rare disease differential"
    differential_text = "\n".join(
        f"{idx + 1}. {item.name} (ORPHA:{item.orpha_code})"
        for idx, item in enumerate(body.top5[:10])
    )
    findings = []
    for term in body.evidence.get("hpo_terms", []) or []:
        if term.get("assertion", "present") == "present":
            findings.append(str(term.get("label") or term.get("hpo_id") or "clinical finding"))
    if not findings and top:
        findings = [str(item) for item in top.contributing_terms[:5]]
    findings_text = _safe_join(findings[:5], "the submitted clinical findings")
    demographics = _safe_join([age, sex, f"DOB {dob}" if dob else ""], "demographics not provided")
    clinic_line = f", {clinic}" if clinic else ""

    return (
        "# Clinical Referral Letter\n\n"
        f"**Date:** {today}\n"
        f"**To:** {specialist}\n"
        f"**Re:** {patient_name} ({demographics})\n"
        f"**From:** {clinician}{clinic_line}\n"
        f"**Visit recommendation:** {visit_recommendation.replace('_', ' ') if visit_recommendation else urgency.capitalize()} review.\n\n"
        "Dear Colleague,\n\n"
        f"I am referring {patient_name} for specialist assessment after review of submitted clinical information. "
        f"The main reason for referral is a possible {top_name} or related condition requiring expert correlation.\n\n"
        f"Relevant accepted findings include {findings_text}.\n\n"
        "### Scorecard Differential\n"
        f"{differential_text or top_name}\n\n"
        "The available history and evidence were reviewed in a "
        "doctor-supervised workflow, and the detailed ranking output is being retained for clinical interpretation.\n\n"
        "Please consider targeted examination, review of prior investigations, and appropriate confirmatory testing "
        "such as phenotype-directed genetic testing or metabolic/laboratory workup where clinically indicated.\n\n"
        "I would be grateful for your assessment and recommendations regarding diagnosis, follow-up, and whether the "
        "patient requires urgent clinic review or routine specialist care.\n\n"
        "Yours sincerely,\n\n"
        f"**{clinician}**"
    )


def _decode_data_url_bytes(value: str | None) -> bytes | None:
    if not value or not value.startswith("data:image/"):
        return None
    try:
        _, encoded = value.split(",", 1)
        image = Image.open(BytesIO(b64decode(encoded)))
        image.load()
        cleaned = BytesIO()
        image.convert("RGBA").save(cleaned, format="PNG")
        return cleaned.getvalue()
    except Exception:
        return None


def _markdown_to_pdf_text(text: str) -> str:
    escaped = escape(text)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)


def _letter_flowables(body: LetterPdfRequest, styles: dict[str, ParagraphStyle]) -> list:
    flowables: list = []
    for raw_line in body.letter.splitlines():
        line = raw_line.strip()
        if not line:
            flowables.append(Spacer(1, 4))
            continue
        if line == "---":
            flowables.append(Spacer(1, 4))
            flowables.append(
                HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#D7DEE9"))
            )
            flowables.append(Spacer(1, 6))
            continue
        if line.startswith("# "):
            flowables.append(Paragraph(_markdown_to_pdf_text(line[2:].strip()), styles["title"]))
            flowables.append(Spacer(1, 8))
            continue
        if re.match(r"^#{2,6}\s+", line):
            text = re.sub(r"^#{2,6}\s+", "", line).strip()
            flowables.append(Paragraph(_markdown_to_pdf_text(text), styles["section"]))
            flowables.append(Spacer(1, 3))
            continue
        if re.match(r"^[-*]\s+", line):
            text = re.sub(r"^[-*]\s+", "", line).strip()
            flowables.append(
                Paragraph(f"&bull;&nbsp; {_markdown_to_pdf_text(text)}", styles["bullet"])
            )
            continue
        flowables.append(Paragraph(_markdown_to_pdf_text(line), styles["body"]))
    return flowables


def _render_letter_pdf(body: LetterPdfRequest) -> bytes:
    doctor_profile = body.doctor_profile or {}
    patient_context = body.case_data.get("patientContext") or {}
    patient_id = (
        body.submission_id
        or body.case_data.get("sourceSubmissionId")
        or body.case_data.get("id")
        or "patient"
    )
    patient_name = patient_context.get("patientName") or "Patient"
    age = patient_context.get("age") or ""
    sex = patient_context.get("sex") or ""
    doctor_name = str(
        doctor_profile.get("name")
        or patient_context.get("referringPhysicianName")
        or "Referring clinician"
    )

    base_styles = getSampleStyleSheet()
    styles = {
        "brand": ParagraphStyle(
            "brand",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#1E293B"),
            spaceAfter=2,
        ),
        "meta": ParagraphStyle(
            "meta",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#6B7280"),
        ),
        "doctor": ParagraphStyle(
            "doctor",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#374151"),
        ),
        "title": ParagraphStyle(
            "title",
            parent=base_styles["Normal"],
            fontName="Times-Bold",
            fontSize=13,
            leading=16,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#1F2937"),
            spaceBefore=4,
            spaceAfter=6,
        ),
        "section": ParagraphStyle(
            "section",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12,
            textColor=colors.HexColor("#1E293B"),
            spaceBefore=4,
            spaceAfter=2,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base_styles["Normal"],
            fontName="Times-Roman",
            fontSize=10.5,
            leading=13.2,
            textColor=colors.HexColor("#111827"),
            spaceAfter=4,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=base_styles["Normal"],
            fontName="Times-Roman",
            fontSize=10.2,
            leading=12.8,
            leftIndent=10,
            textColor=colors.HexColor("#111827"),
            spaceAfter=2,
        ),
        "signature": ParagraphStyle(
            "signature",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=10,
            textColor=colors.HexColor("#4B5563"),
            alignment=TA_RIGHT,
        ),
        "signature_name": ParagraphStyle(
            "signature_name",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=11,
            textColor=colors.HexColor("#111827"),
            alignment=TA_RIGHT,
        ),
    }

    story: list = []
    story.append(
        Table(
            [
                [
                    [
                        Paragraph("LUMINA CLINICAL REFERRAL", styles["brand"]),
                        Paragraph(f"Patient ID: {escape(str(patient_id))}", styles["meta"]),
                    ],
                    [
                        Paragraph(
                            "<br/>".join(
                                escape(str(value))
                                for value in [
                                    doctor_name,
                                    doctor_profile.get("specialty")
                                    or doctor_profile.get("specialization")
                                    or "",
                                    doctor_profile.get("clinic")
                                    or patient_context.get("referringClinic")
                                    or "",
                                    doctor_profile.get("contact") or "",
                                    doctor_profile.get("license") or "",
                                ]
                                if value
                            ),
                            styles["doctor"],
                        ),
                    ],
                ]
            ],
            colWidths=[108 * mm, 72 * mm],
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("LINEBELOW", (0, 0), (-1, 0), 0.8, colors.HexColor("#111827")),
                ]
            ),
        )
    )
    story.append(Spacer(1, 8))
    demo_text = " · ".join(part for part in [str(age).strip(), str(sex).strip()] if part)
    story.append(
        Table(
            [
                [
                    Paragraph(f"Patient: {escape(str(patient_name))}", styles["meta"]),
                    Paragraph(escape(demo_text), styles["doctor"]),
                ]
            ],
            colWidths=[108 * mm, 72 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                    ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#D7DEE9")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            ),
        )
    )
    story.append(Spacer(1, 10))
    story.extend(_letter_flowables(body, styles))
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#D7DEE9")))
    story.append(Spacer(1, 6))

    signature_items: list = []
    signature_bytes = _decode_data_url_bytes(str(doctor_profile.get("signatureImage") or ""))
    if signature_bytes:
        try:
            signature = ReportLabImage(BytesIO(signature_bytes), width=38 * mm, height=12 * mm)
            signature.hAlign = "RIGHT"
            signature_items.append(signature)
            signature_items.append(Spacer(1, 2))
        except Exception:
            pass
    signature_text = str(doctor_profile.get("signature") or "").strip()
    if signature_text:
        signature_items.append(
            Paragraph(escape(signature_text).replace("\n", "<br/>"), styles["signature"])
        )
    signature_items.append(Paragraph(escape(doctor_name), styles["signature_name"]))
    if doctor_profile.get("clinic"):
        signature_items.append(
            Paragraph(escape(str(doctor_profile.get("clinic"))), styles["signature"])
        )
    story.append(
        Table(
            [[signature_items]],
            colWidths=[180 * mm],
            style=TableStyle([("ALIGN", (0, 0), (-1, -1), "RIGHT")]),
        )
    )

    def draw_watermark(canvas, doc):
        canvas.saveState()
        canvas.setTitle(str(patient_id))
        canvas.setFillColorRGB(0.04, 0.67, 0.80, alpha=0.05)
        canvas.setFont("Helvetica-Bold", 54)
        canvas.translate(A4[0] / 2, A4[1] / 2)
        canvas.rotate(28)
        canvas.drawCentredString(0, 0, "Lumina")
        canvas.restoreState()

    out = BytesIO()
    doc = SimpleDocTemplate(
        out,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=str(patient_id),
    )
    doc.build(story, onFirstPage=draw_watermark, onLaterPages=draw_watermark)
    return out.getvalue()


@router.post("/next", response_model=AgentSuggestion)
async def agent_next(body: AgentNextRequest) -> AgentSuggestion:
    from groq import AsyncGroq

    lang_name = _LANG_NAMES.get(body.lang, "English")
    top5_text = "\n".join(
        f"#{i + 1} ORPHA:{r.orpha_code} {r.name} — confidence {r.confidence:.1f}"
        for i, r in enumerate(body.top5)
    )
    user_msg = (
        f"Top-5 diagnoses:\n{top5_text}\n\n"
        f"Modalities already used: {', '.join(body.modalities_used) or 'none'}\n"
        f"Cycle: {body.cycle}/3"
    )

    try:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not configured")
        client = AsyncGroq(api_key=api_key)
        response = await client.chat.completions.create(
            model=_MODEL_NEXT,
            max_tokens=256,
            temperature=0.0,
            messages=[
                {"role": "system", "content": _NEXT_SYSTEM.format(lang_name=lang_name)},
                {"role": "user", "content": user_msg},
            ],
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw.strip())
        return AgentSuggestion(
            modality=data.get("modality", ""),
            reasoning=data.get("reasoning", ""),
            cycles_remaining=max(0, min(3, int(data.get("cycles_remaining", 0)))),
        )
    except Exception:
        return AgentSuggestion(
            modality="", reasoning="Unable to suggest next step.", cycles_remaining=0
        )


@router.post("/letter")
async def generate_letter(body: LetterRequest) -> StreamingResponse:
    from groq import AsyncGroq

    labels = _REFERRAL_FIELD_LABELS.get(body.lang, _REFERRAL_FIELD_LABELS["en"])
    patient_context = dict(body.patient_context)
    if not _first_present(patient_context, "recipientSpecialist", "recipient_specialist"):
        patient_context["recipientSpecialist"] = _guess_specialist(
            {
                "rankings": [item.dict() for item in body.top5],
                "hpoTerms": body.evidence.get("hpo_terms", []),
            }
        )
    top5_text = "\n".join(
        f"- ORPHA:{r.orpha_code} {r.name} | supporting findings: {', '.join(r.contributing_terms[:3])}"
        for r in body.top5
    )
    metadata_text = _format_referral_metadata(patient_context, body.lang)
    preference_text = _letter_generation_guidance(body)
    user_msg = (
        f"{labels['metadata_header']}:\n{metadata_text}\n\n"
        f"{labels['context_header']}:\n{json.dumps(patient_context, ensure_ascii=False, indent=2)}\n\n"
        f"{labels['diagnoses_header']}:\n{top5_text}\n\n"
        f"{labels['evidence_header']}:\n{json.dumps(body.evidence, ensure_ascii=False, indent=2)}"
    )
    if preference_text:
        user_msg += f"\n\nGeneration preferences:\n{preference_text}"

    async def stream_letter():
        try:
            api_key = os.environ.get("GROQ_API_KEY")
            if not api_key:
                yield f"data: {json.dumps({'text': _fallback_letter(body, patient_context)})}\n\n"
                return
            client = AsyncGroq(api_key=api_key)
            stream = await client.chat.completions.create(
                model=_MODEL_LETTER,
                max_tokens=1024,
                temperature=0.3,
                stream=True,
                messages=[
                    {"role": "system", "content": _letter_system(body.lang)},
                    {"role": "user", "content": user_msg},
                ],
            )
            async for chunk in stream:
                text = chunk.choices[0].delta.content or ""
                if text:
                    yield f"data: {json.dumps({'text': text})}\n\n"
        except Exception:
            yield f"data: {json.dumps({'text': _fallback_letter(body, patient_context)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream_letter(), media_type="text/event-stream")


@router.post("/patient-summary", response_model=PatientSummary)
async def generate_patient_summary(body: PatientSummaryRequest) -> PatientSummary:
    from groq import AsyncGroq

    fallback = _fallback_patient_summary(body.case_data, body.visit_recommendation)
    try:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            return fallback
        client = AsyncGroq(api_key=api_key)
        lang_name = _LANG_NAMES.get(body.lang, "English")
        specialist = _guess_specialist(body.case_data)
        response = await client.chat.completions.create(
            model=_MODEL_LETTER,
            max_tokens=420,
            temperature=0.2,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"Write patient-safe medical communication in {lang_name}. Return JSON only with keys: "
                        "headline, body, clinical_area, recommended_next_step, specialist, safety_note. "
                        "Do not include disease rankings, confidence percentages, HPO IDs, ORPHA IDs, missing findings, or technical explanations. "
                        "Use calm plain language. Keep the message very short. "
                        "Tell the patient only whether to book a visit, seek urgent care, wait for more data review, or that no visit is needed now. "
                        "Set headline to a short doctor guidance label. Keep body to one sentence. Leave clinical_area and specialist empty unless clearly needed."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "suggested_specialist": specialist,
                            "visit_recommendation": body.visit_recommendation,
                            "visit_recommendation_text": _visit_text(body.visit_recommendation),
                            "top_clinical_impression": (body.case_data.get("rankings") or [{}])[
                                0
                            ].get("name"),
                            "accepted_findings": [
                                term.get("label") or term.get("hpo_id")
                                for term in (body.case_data.get("hpoTerms") or [])
                                if term.get("assertion", "present") == "present"
                            ][:6],
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw.strip())
        return PatientSummary(
            headline=str(data.get("headline") or fallback.headline),
            body=str(data.get("body") or fallback.body),
            clinical_area=str(data.get("clinical_area") or fallback.clinical_area),
            recommended_next_step=str(
                data.get("recommended_next_step") or fallback.recommended_next_step
            ),
            specialist=str(data.get("specialist") or fallback.specialist),
            safety_note=str(data.get("safety_note") or fallback.safety_note),
        )
    except Exception:
        return fallback


@router.post("/letter-pdf")
async def generate_letter_pdf(body: LetterPdfRequest) -> Response:
    pdf_bytes = _render_letter_pdf(body)
    filename = f"{body.submission_id or body.case_data.get('sourceSubmissionId') or body.case_data.get('id') or 'referral'}.pdf"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)

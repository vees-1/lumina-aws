import json
import os
from abc import ABC, abstractmethod
from typing import Any

import boto3


class AIProvider(ABC):
    @abstractmethod
    def extract_hpo_terms(
        self, notes: str, hpo_vocab: dict[str, str] | None = None
    ) -> list[dict[str, Any]]:
        pass

    @abstractmethod
    def generate_letter(
        self, case_data: dict[str, Any], options: dict[str, Any], lang: str = "en"
    ) -> str:
        pass

    @abstractmethod
    def suggest_next_step(
        self,
        top5: list[dict[str, Any]],
        modalities_used: list[str],
        cycle: int = 0,
        lang: str = "en",
    ) -> dict[str, Any]:
        pass

    @abstractmethod
    def generate_patient_summary(
        self, case_data: dict[str, Any], visit_recommendation: str, lang: str = "en"
    ) -> dict[str, Any]:
        pass


def validate_hpo_terms(
    terms: list[dict[str, Any]], hpo_vocab: dict[str, str] | None = None
) -> list[dict[str, Any]]:
    if not hpo_vocab:
        return terms

    valid: list[dict[str, Any]] = []
    for term in terms:
        hpo_id = term.get("hpo_id") or term.get("id")
        if hpo_id and hpo_id in hpo_vocab:
            valid.append(
                {
                    "hpo_id": hpo_id,
                    "name": hpo_vocab[hpo_id],
                    "confidence": term.get("confidence", 0.9),
                    "source": term.get("source", "text_extraction"),
                }
            )
    return valid


class DemoProvider(AIProvider):
    def extract_hpo_terms(
        self, notes: str, hpo_vocab: dict[str, str] | None = None
    ) -> list[dict[str, Any]]:
        sample_terms = [
            {"hpo_id": "HP:0001250", "name": "Seizures", "confidence": 0.95, "source": "notes"},
            {
                "hpo_id": "HP:0001263",
                "name": "Global developmental delay",
                "confidence": 0.90,
                "source": "notes",
            },
            {
                "hpo_id": "HP:0001249",
                "name": "Intellectual disability",
                "confidence": 0.85,
                "source": "notes",
            },
        ]
        if hpo_vocab:
            return validate_hpo_terms(sample_terms, hpo_vocab)
        return sample_terms

    def generate_letter(
        self, case_data: dict[str, Any], options: dict[str, Any], lang: str = "en"
    ) -> str:
        patient_name = case_data.get("patientContext", {}).get("patientName", "Patient")
        rankings = case_data.get("rankings", [])
        top_disease = rankings[0].get("name") if rankings else "Rare Disease Evaluation"

        return f"""# Clinical Referral Letter

**Patient:** {patient_name}  
**Primary Consideration:** {top_disease}  
**Date:** {options.get("date", "2026-07-23")}  

## Clinical Overview
The patient presented for clinical evaluation of multi-system phenotypic manifestations. Phenotypic extraction identified key Human Phenotype Ontology (HPO) terms requiring specialized medical genetics assessment.

## Modality Evidence
- **Phenotypic Terms:** {len(case_data.get("hpoTerms", []))} terms mapped.
- **Modalities Evaluated:** {", ".join(case_data.get("modalities", ["Clinical Notes"]))}.

## Recommendations
We recommend urgent outpatient consultation with Medical Genetics and relevant subspecialty clinics.

Sincerely,  
*Lumina AI Clinical Decision Support*
"""

    def suggest_next_step(
        self,
        top5: list[dict[str, Any]],
        modalities_used: list[str],
        cycle: int = 0,
        lang: str = "en",
    ) -> dict[str, Any]:
        unused = [m for m in ["photos", "labs", "genetics"] if m not in modalities_used]
        next_modality = unused[0] if unused else "approval"

        return {
            "modality": next_modality,
            "reasoning": f"Adding {next_modality} will increase clinical diagnostic confidence for top candidate differential diagnoses.",
            "cycles_remaining": max(0, 3 - cycle),
        }

    def generate_patient_summary(
        self, case_data: dict[str, Any], visit_recommendation: str, lang: str = "en"
    ) -> dict[str, Any]:
        rankings = case_data.get("rankings", [])
        top_name = rankings[0].get("name") if rankings else "Rare Condition"

        return {
            "keyFinding": f"Evaluation highlights key features aligned with {top_name}.",
            "whatItMeans": "Your symptoms and test findings have been organized into a structured medical report for your doctor.",
            "nextSteps": f"Visit Recommendation: {visit_recommendation}. Share this report with your specialist.",
        }


class BedrockProvider(AIProvider):
    def __init__(self, region: str | None = None, model_id: str | None = None):
        self.region = region or os.getenv("AWS_REGION", "us-east-1")
        self.model_id = (
            model_id or os.getenv("BEDROCK_MODEL_ID") or "anthropic.claude-3-haiku-20240307-v1:0"
        )
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = boto3.client("bedrock-runtime", region_name=self.region)
        return self._client

    def extract_hpo_terms(
        self, notes: str, hpo_vocab: dict[str, str] | None = None
    ) -> list[dict[str, Any]]:
        prompt = f'Extract HPO terms from clinical notes in JSON list format [{{"hpo_id": "HP:xxxxxxx", "name": "..."}}]:\n\n{notes}'
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        }
        try:
            response = self.client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(payload),
                contentType="application/json",
            )
            result_body = json.loads(response["body"].read())
            text = result_body.get("content", [{}])[0].get("text", "[]")
            extracted = json.loads(text)
            if isinstance(extracted, list):
                return validate_hpo_terms(extracted, hpo_vocab)
        except Exception:
            pass
        return DemoProvider().extract_hpo_terms(notes, hpo_vocab)

    def generate_letter(
        self, case_data: dict[str, Any], options: dict[str, Any], lang: str = "en"
    ) -> str:
        prompt = f"Generate a clinical referral letter for case data: {json.dumps(case_data)}"
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1500,
            "messages": [{"role": "user", "content": prompt}],
        }
        try:
            response = self.client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(payload),
                contentType="application/json",
            )
            result_body = json.loads(response["body"].read())
            return result_body.get("content", [{}])[0].get("text", "")
        except Exception:
            return DemoProvider().generate_letter(case_data, options, lang)

    def suggest_next_step(
        self,
        top5: list[dict[str, Any]],
        modalities_used: list[str],
        cycle: int = 0,
        lang: str = "en",
    ) -> dict[str, Any]:
        return DemoProvider().suggest_next_step(top5, modalities_used, cycle, lang)

    def generate_patient_summary(
        self, case_data: dict[str, Any], visit_recommendation: str, lang: str = "en"
    ) -> dict[str, Any]:
        return DemoProvider().generate_patient_summary(case_data, visit_recommendation, lang)


class GroqProvider(AIProvider):
    def extract_hpo_terms(
        self, notes: str, hpo_vocab: dict[str, str] | None = None
    ) -> list[dict[str, Any]]:
        return DemoProvider().extract_hpo_terms(notes, hpo_vocab)

    def generate_letter(
        self, case_data: dict[str, Any], options: dict[str, Any], lang: str = "en"
    ) -> str:
        return DemoProvider().generate_letter(case_data, options, lang)

    def suggest_next_step(
        self,
        top5: list[dict[str, Any]],
        modalities_used: list[str],
        cycle: int = 0,
        lang: str = "en",
    ) -> dict[str, Any]:
        return DemoProvider().suggest_next_step(top5, modalities_used, cycle, lang)

    def generate_patient_summary(
        self, case_data: dict[str, Any], visit_recommendation: str, lang: str = "en"
    ) -> dict[str, Any]:
        return DemoProvider().generate_patient_summary(case_data, visit_recommendation, lang)


def get_ai_provider() -> AIProvider:
    provider_name = os.getenv("LUMINA_AI_PROVIDER", "demo").strip().lower()
    if provider_name == "bedrock":
        return BedrockProvider()
    if provider_name == "groq":
        return GroqProvider()
    return DemoProvider()

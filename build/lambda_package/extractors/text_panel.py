"""Multi-modality text intake → HPO terms via Groq/Llama 3.3 70B."""

from __future__ import annotations

import json
import os

from extractors.models import HPOTerm

_GROQ_MODEL = "llama-3.3-70b-versatile"

_SYSTEM = """You are a clinical decision support assistant for rare disease diagnosis.

The clinician has provided a free-text description that may include patient demographics,
clinical observations, lab results, and genetic findings.

Extract all clinical findings and map each to an HPO term.
Return a JSON array — nothing else.

Each item:
  {"hpo_id": "HP:XXXXXXX", "confidence": 0.0-1.0, "source": "relevant fragment from input", "modality": "notes|lab|genetics"}

Modality field:
- "notes" — clinical observations, symptoms, signs
- "lab" — laboratory values
- "genetics" — variant or gene mentions

Rules:
- confidence 0.9 for genetics-derived phenotypes
- confidence 0.85–0.95 for explicit clinical findings
- confidence 0.6–0.8 for inferred findings
- return [] if nothing maps to HPO terms"""


async def extract_text_panel(text: str) -> list[HPOTerm]:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return []

    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=api_key)
        response = await client.chat.completions.create(
            model=_GROQ_MODEL,
            max_tokens=2048,
            temperature=0.0,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": text},
            ],
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        items = json.loads(raw)
        results = []
        for item in items:
            if not isinstance(item, dict):
                continue
            hpo_id = item.get("hpo_id", "")
            if not hpo_id.startswith("HP:"):
                continue
            results.append(HPOTerm(
                hpo_id=hpo_id,
                confidence=max(0.0, min(1.0, float(item.get("confidence", 0.7)))),
                source=str(item.get("source", "")),
            ))
        return results
    except Exception:
        return []

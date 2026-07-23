"""Clinical photo → HPO terms via Groq Vision."""

from __future__ import annotations

import base64
import io
import json
import os

from PIL import Image

from extractors.models import HPOTerm

_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

_SYSTEM_BASE = """You are a clinical image analyst specialising in rare disease phenotyping.

Examine the clinical photograph and identify all observable clinical findings.
Map each finding to an HPO term. Return a JSON array — nothing else.

Each item:
  {"hpo_id": "HP:XXXXXXX", "confidence": 0.0-1.0, "source": "brief description of what you observed"}

Rules:
- Only report findings clearly visible in the image
- confidence 0.85–0.95 for unambiguous findings
- confidence 0.5–0.8 for subtle or uncertain findings
- Do not infer systemic findings from a single photo
- Use standard Human Phenotype Ontology terms and IDs
- Do not invent non-existent HPO IDs; backend validation will discard invalid IDs
- return [] if no clinically significant HPO-mappable findings are visible"""

_FACIAL_ADDENDUM = """
This is a facial photograph. In addition to general findings, pay close attention to:
dysmorphic facial features including but not limited to the following vocabulary:
{vocab}

Map each observable feature to its HPO term with high precision."""

_VISUAL_HPO_VOCAB = (
    ("HP:0000316", "Hypertelorism"),
    ("HP:0000369", "Low-set ears"),
    ("HP:0000286", "Epicanthus"),
    ("HP:0000431", "Wide nasal bridge"),
    ("HP:0000582", "Upslanted palpebral fissure"),
    ("HP:0000494", "Downslanted palpebral fissures"),
    ("HP:0000322", "Short philtrum"),
    ("HP:0000347", "Micrognathia"),
    ("HP:0000252", "Microcephaly"),
    ("HP:0000256", "Macrocephaly"),
    ("HP:0004322", "Short stature"),
    ("HP:0030084", "Clinodactyly"),
    ("HP:0001156", "Brachydactyly"),
    ("HP:0002650", "Scoliosis"),
    ("HP:0001382", "Joint hypermobility"),
    ("HP:0010442", "Polydactyly"),
    ("HP:0001159", "Syndactyly"),
)


def _ocr_text(image_bytes: bytes) -> str:
    try:
        import pytesseract

        img = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(img)
    except Exception:
        return ""


async def extract_photo(
    image_bytes: bytes,
    media_type: str = "image/jpeg",
    facial: bool = False,
    facial_vocab: list[str] | None = None,
    hpo_vocab: list[tuple[str, str]] | None = None,
) -> list[HPOTerm]:
    """Extract HPO terms from a clinical photograph using Groq Vision."""
    ocr_terms: list[HPOTerm] = []
    ocr_text = _ocr_text(image_bytes)
    if ocr_text.strip() and hpo_vocab:
        from extractors.notes import extract_notes

        ocr_terms = [
            term.model_copy(update={"source_type": "photo"})
            for term in await extract_notes(ocr_text, hpo_vocab)
        ]

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return ocr_terms

    try:
        from groq import AsyncGroq

        client = AsyncGroq(api_key=api_key)

        system = _SYSTEM_BASE
        visual_vocab = "\n".join(f"- {hid}: {name}" for hid, name in _VISUAL_HPO_VOCAB)
        system += f"\n\nCommon visible HPO examples:\n{visual_vocab}"
        if facial and facial_vocab:
            vocab_str = "\n".join(f"- {v}" for v in facial_vocab[:200])
            system = system + _FACIAL_ADDENDUM.format(vocab=vocab_str)

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        response = await client.chat.completions.create(
            model=_MODEL,
            max_tokens=1024,
            temperature=0.0,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{media_type};base64,{image_b64}"},
                        },
                        {
                            "type": "text",
                            "text": system
                            + "\n\nIdentify all observable clinical findings and return the JSON array.",
                        },
                    ],
                }
            ],
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        # Find JSON array in response
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start >= 0 and end > start:
            raw = raw[start:end]

        try:
            items = json.loads(raw)
        except json.JSONDecodeError:
            return ocr_terms

        results = []
        for item in items:
            if not isinstance(item, dict):
                continue
            hpo_id = item.get("hpo_id", "")
            if not hpo_id.startswith("HP:"):
                continue
            results.append(
                HPOTerm(
                    hpo_id=hpo_id,
                    confidence=max(0.0, min(1.0, float(item.get("confidence", 0.7)))),
                    source=str(item.get("source", "")),
                    source_type="photo",
                )
            )
        merged = {term.hpo_id: term for term in ocr_terms}
        for term in results:
            existing = merged.get(term.hpo_id)
            if existing is None or term.confidence > existing.confidence:
                merged[term.hpo_id] = term
        return list(merged.values())
    except Exception:
        return ocr_terms

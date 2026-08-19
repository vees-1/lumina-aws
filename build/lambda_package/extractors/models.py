from typing import Literal

from pydantic import BaseModel, model_validator


class HPOTerm(BaseModel):
    hpo_id: str  # "HP:0001250"
    confidence: float  # -1.0–1.0, where negative means explicitly absent
    source: str  # original span, finding, or gene name
    assertion: Literal["present", "absent"] | None = None
    source_type: Literal["notes", "lab", "photo", "vcf", "text_panel", "unknown"] = "unknown"
    label: str = ""
    definition: str | None = None
    review_status: Literal["pending", "accepted", "rejected"] | None = None

    @model_validator(mode="after")
    def _normalize_assertion(self) -> "HPOTerm":
        if self.assertion is None:
            self.assertion = "absent" if self.confidence < 0 else "present"
        elif self.assertion == "absent" and self.confidence > 0:
            self.confidence *= -1
        elif self.assertion == "present" and self.confidence < 0:
            self.confidence = abs(self.confidence)
        return self

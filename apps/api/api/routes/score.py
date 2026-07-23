from extractors.models import HPOTerm
from fastapi import APIRouter, Request
from pydantic import BaseModel
from scoring.ranker import GeneticEvidence, RankResult

router = APIRouter(prefix="/score", tags=["score"])

_MODALITY_CAP = {1: 40.0, 2: 55.0, 3: 65.0, 4: 80.0}


class ScoreRequest(BaseModel):
    terms: list[HPOTerm]
    top_k: int = 10
    modalities: int = 1
    genetic_evidence: list[GeneticEvidence] = []
    lang: str | None = None
    locale: str | None = None


@router.post("", response_model=list[RankResult])
async def score_case(body: ScoreRequest, request: Request) -> list[RankResult]:
    index = request.app.state.scoring_index
    results = index.rank(
        body.terms,
        top_k=body.top_k,
        genetic_evidence=body.genetic_evidence,
    )
    if not body.genetic_evidence and not any(t.review_status for t in body.terms):
        cap = _MODALITY_CAP.get(max(1, min(4, body.modalities)), 40.0)
        for r in results:
            # Backwards-compatible confidence cap for legacy clients.
            r.confidence = round(min(cap, r.score * cap), 1)
    return results

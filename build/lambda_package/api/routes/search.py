from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

router = APIRouter(prefix="/search", tags=["search"])


class HPOMatch(BaseModel):
    hpo_id: str
    name: str
    score: float


@router.get("/hpo", response_model=list[HPOMatch])
async def search_hpo(
    request: Request,
    q: str = Query(..., description="Free-text phenotype description"),
    top_k: int = Query(5, ge=1, le=20),
) -> list[HPOMatch]:
    """Fuzzy-match free text to HPO terms using semantic embeddings.

    Example: GET /search/hpo?q=trouble+walking&top_k=5
    Returns up to top_k HPO terms ranked by cosine similarity (threshold 0.72).
    Returns an empty list when the embedding index has not been built yet.
    """
    embedder = getattr(request.app.state, "hpo_embedder", None)
    if embedder is None:
        return []
    matches = embedder.match(q, top_k=top_k)
    return [
        HPOMatch(hpo_id=hpo_id, name=name, score=round(score, 4)) for hpo_id, name, score in matches
    ]

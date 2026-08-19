import traceback

from extractors.lab import LabExtractionError, extract_lab
from extractors.models import HPOTerm
from extractors.notes import extract_notes
from extractors.photo import extract_photo
from extractors.validate import validate_terms
from extractors.vcf import VcfExtractionError, extract_vcf
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

router = APIRouter(prefix="/intake", tags=["intake"])


class NotesRequest(BaseModel):
    notes: str


def _enrich_terms(
    terms: list[HPOTerm],
    request: Request,
    *,
    review_status: str | None = None,
) -> list[HPOTerm]:
    names = request.app.state.hpo_names
    definitions = getattr(request.app.state, "hpo_definitions", {})
    enriched = []
    for term in terms:
        if term.hpo_id not in names:
            continue
        updates = {
            "label": names.get(term.hpo_id, ""),
            "definition": definitions.get(term.hpo_id),
        }
        if review_status is not None:
            updates["review_status"] = review_status
        enriched.append(term.model_copy(update=updates))
    return enriched


@router.post("/text", response_model=list[HPOTerm])
async def intake_text(body: NotesRequest, request: Request) -> list[HPOTerm]:
    try:
        terms = await extract_notes(body.notes, request.app.state.hpo_vocab)
        return _enrich_terms(validate_terms(terms, {}, request.app.state.hpo_names), request)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
        )


@router.post("/photo", response_model=list[HPOTerm])
async def intake_photo(
    request: Request,
    file: UploadFile = File(...),
    facial: bool = False,
) -> list[HPOTerm]:
    try:
        image_bytes = await file.read()
        facial_vocab = request.app.state.facial_vocab if facial else None
        terms = await extract_photo(
            image_bytes,
            media_type=file.content_type or "image/jpeg",
            facial=facial,
            facial_vocab=facial_vocab,
            hpo_vocab=request.app.state.hpo_vocab,
        )
        return _enrich_terms(validate_terms(terms, {}, request.app.state.hpo_names), request)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
        )


@router.post("/lab", response_model=list[HPOTerm])
async def intake_lab(request: Request, file: UploadFile = File(...)) -> list[HPOTerm]:
    try:
        terms = await extract_lab(
            await file.read(),
            request.app.state.hpo_vocab,
            media_type=file.content_type or "image/png",
        )
        validated = validate_terms(terms, {}, request.app.state.hpo_names)
        if not validated:
            raise LabExtractionError(
                "Lab report was read, but no validated HPO lab phenotypes were found."
            )
        return _enrich_terms(validated, request)
    except LabExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
        )


@router.post("/vcf", response_model=list[HPOTerm])
async def intake_vcf(request: Request, file: UploadFile = File(...)) -> list[HPOTerm]:
    try:
        terms = extract_vcf(await file.read(), request.app.state.db_engine)
        validated = validate_terms(terms, {}, request.app.state.hpo_names)
        if not validated:
            raise VcfExtractionError("VCF parsed, but no validated HPO phenotypes were mapped.")
        return _enrich_terms(validated, request)
    except VcfExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
        )


@router.post("/text/suggest", response_model=list[HPOTerm])
async def suggest_text(body: NotesRequest, request: Request) -> list[HPOTerm]:
    terms = await intake_text(body, request)
    return _enrich_terms(terms, request, review_status="pending")


@router.post("/photo/suggest", response_model=list[HPOTerm])
async def suggest_photo(
    request: Request,
    file: UploadFile = File(...),
    facial: bool = False,
) -> list[HPOTerm]:
    terms = await intake_photo(request, file, facial)
    return _enrich_terms(terms, request, review_status="pending")


@router.post("/lab/suggest", response_model=list[HPOTerm])
async def suggest_lab(request: Request, file: UploadFile = File(...)) -> list[HPOTerm]:
    terms = await intake_lab(request, file)
    return _enrich_terms(terms, request, review_status="pending")

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from ingest.db import get_engine  # noqa: E402
from ingest.models import HPOTerm as HPOTermModel  # noqa: E402
from scoring.ranker import ScoringIndex  # noqa: E402
from sqlmodel import Session, select  # noqa: E402

from api.routes.agent import router as agent_router  # noqa: E402
from api.routes.disease import router as disease_router  # noqa: E402
from api.routes.fhir import router as fhir_router  # noqa: E402
from api.routes.intake import router as intake_router  # noqa: E402
from api.routes.score import router as score_router  # noqa: E402
from api.routes.search import router as search_router  # noqa: E402
from api.routes.submissions import router as submissions_router  # noqa: E402


def _load_hpo_vocab(engine) -> list[tuple[str, str]]:
    with Session(engine) as s:
        terms = s.exec(
            select(HPOTermModel).where(HPOTermModel.ic.isnot(None)).order_by(HPOTermModel.ic.desc())
        ).all()
    return [(t.hpo_id, t.name) for t in terms]


def _load_hpo_definitions(engine) -> dict[str, str | None]:
    with Session(engine) as s:
        terms = s.exec(select(HPOTermModel)).all()
    return {t.hpo_id: t.definition for t in terms}


def _load_hpo_names(engine) -> dict[str, str]:
    with Session(engine) as s:
        terms = s.exec(select(HPOTermModel)).all()
    return {t.hpo_id: t.name for t in terms}


def _load_facial_vocab(engine) -> list[str]:
    from ingest.models import FacialDiseasePhenotype
    from ingest.models import HPOTerm as HT

    with Session(engine) as s:
        rows = s.exec(select(FacialDiseasePhenotype.hpo_id).distinct()).all()
        hpo_ids = list(rows)
        names = []
        for hid in hpo_ids:
            term = s.get(HT, hid)
            if term:
                names.append(f"{hid}: {term.name}")
    return names


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = get_engine()
    app.state.db_engine = engine
    from api.app_db import init_app_db

    app.state.app_db_engine = init_app_db()
    app.state.scoring_index = ScoringIndex.load()
    app.state.hpo_vocab = _load_hpo_vocab(engine)
    app.state.hpo_names = _load_hpo_names(engine)
    app.state.hpo_definitions = _load_hpo_definitions(engine)
    app.state.facial_vocab = _load_facial_vocab(engine)
    from scoring.embeddings import _embedder

    if not _embedder.load_index():
        pass  # index not built yet; build with scripts/build_hpo_index.py
    app.state.hpo_embedder = _embedder
    yield


app = FastAPI(title="Lumina API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(intake_router)
app.include_router(score_router)
app.include_router(agent_router)
app.include_router(disease_router)
app.include_router(fhir_router)
app.include_router(search_router)
app.include_router(submissions_router)


@app.get("/health")
async def health():
    from sqlmodel import Session, text

    try:
        with Session(app.state.db_engine) as s:
            count = s.exec(text("SELECT COUNT(*) FROM disease")).one()
        db_status = f"{count[0]} diseases loaded"
    except Exception as e:
        db_status = f"error: {e}"
    return {"status": "ok", "version": "0.1.0", "db": db_status}

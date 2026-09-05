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

from api.jobs import jobs_router as jobs_router  # noqa: E402
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


def ensure_app_state(app: FastAPI):
    if (
        hasattr(app.state, "db_engine")
        and app.state.db_engine is not None
        and hasattr(app.state, "scoring_index")
    ):
        return
    engine = getattr(app.state, "db_engine", None) or get_engine()
    app.state.db_engine = engine
    from api.app_db import init_app_db

    if not hasattr(app.state, "app_db_engine") or app.state.app_db_engine is None:
        app.state.app_db_engine = init_app_db()
    if not hasattr(app.state, "scoring_index") or app.state.scoring_index is None:
        try:
            app.state.scoring_index = ScoringIndex.load(engine)
        except Exception:
            app.state.scoring_index = ScoringIndex({}, {}, {}, {}, {}, {})
    if not hasattr(app.state, "hpo_vocab") or app.state.hpo_vocab is None:
        try:
            app.state.hpo_vocab = _load_hpo_vocab(engine)
        except Exception:
            app.state.hpo_vocab = []
    if not hasattr(app.state, "hpo_names") or app.state.hpo_names is None:
        try:
            app.state.hpo_names = _load_hpo_names(engine)
        except Exception:
            app.state.hpo_names = {}
    if not hasattr(app.state, "hpo_definitions") or app.state.hpo_definitions is None:
        try:
            app.state.hpo_definitions = _load_hpo_definitions(engine)
        except Exception:
            app.state.hpo_definitions = {}
    if not hasattr(app.state, "facial_vocab") or app.state.facial_vocab is None:
        try:
            app.state.facial_vocab = _load_facial_vocab(engine)
        except Exception:
            app.state.facial_vocab = []
    from scoring.embeddings import _embedder

    if not _embedder.load_index():
        pass
    if not hasattr(app.state, "hpo_embedder") or app.state.hpo_embedder is None:
        app.state.hpo_embedder = _embedder


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_app_state(app)
    yield


app = FastAPI(title="Lumina API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def ensure_state_middleware(request, call_next):
    path = request.url.path
    if path == "/health":
        if not hasattr(request.app.state, "db_engine") or request.app.state.db_engine is None:
            request.app.state.db_engine = get_engine()
    elif path.startswith("/cases") or path.startswith("/submissions"):
        # Persistence-only routes do not need the large HPO/scoring indexes.
        # Loading them here makes a cold case-list request exceed the browser timeout.
        pass
    else:
        ensure_app_state(request.app)
    return await call_next(request)


app.include_router(intake_router)
app.include_router(score_router)
app.include_router(agent_router)
app.include_router(disease_router)
app.include_router(fhir_router)
app.include_router(search_router)
app.include_router(submissions_router)
app.include_router(jobs_router)


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


try:
    from mangum import Mangum

    handler = Mangum(app, lifespan="off")
except ImportError:
    handler = None

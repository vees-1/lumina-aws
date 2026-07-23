import os
from pathlib import Path

from sqlmodel import SQLModel, create_engine


# Prefer explicit env var; fall back to repo root relative to cwd
def _resolve_db_path() -> Path:
    url = os.environ.get("DATABASE_URL", "")
    if url.startswith("sqlite:///"):
        return Path(url.removeprefix("sqlite:///"))
    # Try cwd-relative data/ (works when running from repo root or apps/api)
    for candidate in [
        Path.cwd() / "data" / "orpha.sqlite",
        Path.cwd() / ".." / ".." / "data" / "orpha.sqlite",
        Path.cwd() / ".." / "data" / "orpha.sqlite",
    ]:
        if candidate.exists():
            return candidate.resolve()
    # Ultimate fallback (for ingest scripts run from packages/ingest/)
    return Path(__file__).parent.parent.parent / "data" / "orpha.sqlite"


DB_PATH = _resolve_db_path()
DATA_DIR = DB_PATH.parent


def get_engine(db_path: Path | None = None):
    path = db_path or DB_PATH
    return create_engine(f"sqlite:///{path}", echo=False)


def init_db(db_path: Path | None = None):
    from ingest import models  # noqa: F401 — registers all table metadata

    engine = get_engine(db_path)
    SQLModel.metadata.create_all(engine)
    return engine

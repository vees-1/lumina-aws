import os
from pathlib import Path

from sqlmodel import SQLModel, create_engine


# Prefer explicit env var; fall back to repo root relative to cwd
def _resolve_db_path() -> Path:
    url = os.environ.get("DATABASE_URL", "")
    if url.startswith("sqlite:///"):
        return Path(url.removeprefix("sqlite:///"))
    for candidate in [
        Path("/var/task/data/orpha.sqlite"),
        Path.cwd() / "data" / "orpha.sqlite",
        Path.cwd() / ".." / ".." / "data" / "orpha.sqlite",
        Path.cwd() / ".." / "data" / "orpha.sqlite",
        Path(__file__).parent / "data" / "orpha.sqlite",
        Path(__file__).parent.parent / "data" / "orpha.sqlite",
    ]:
        if candidate.exists():
            return candidate.resolve()
    return Path("/var/task/data/orpha.sqlite")


DB_PATH = _resolve_db_path()
DATA_DIR = DB_PATH.parent


def get_engine(db_path: Path | str | None = None):
    path = db_path or DB_PATH
    path_str = str(path)
    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME") or os.environ.get("LAMBDA_TASK_ROOT"):
        if not path_str.startswith("file:"):
            path_str = f"file:{path_str}?mode=ro"
        return create_engine(f"sqlite:///{path_str}", echo=False, uri=True)
    return create_engine(f"sqlite:///{path_str}", echo=False)


def init_db(db_path: Path | None = None):
    from ingest import models  # noqa: F401 — registers all table metadata

    engine = get_engine(db_path)
    SQLModel.metadata.create_all(engine)
    return engine

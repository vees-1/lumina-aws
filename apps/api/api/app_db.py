import os
from pathlib import Path

from sqlmodel import SQLModel, create_engine


def _resolve_app_db_path() -> Path:
    url = os.environ.get("LUMINA_APP_DATABASE_URL", "")
    if url.startswith("sqlite:///"):
        return Path(url.removeprefix("sqlite:///"))
    for candidate in [
        Path.cwd() / "data" / "lumina_app.sqlite",
        Path.cwd() / ".." / ".." / "data" / "lumina_app.sqlite",
        Path.cwd() / ".." / "data" / "lumina_app.sqlite",
    ]:
        if candidate.parent.exists():
            return candidate.resolve()
    return Path(__file__).parent.parent.parent.parent / "data" / "lumina_app.sqlite"


APP_DB_PATH = _resolve_app_db_path()
APP_DATA_DIR = APP_DB_PATH.parent
UPLOAD_DIR = APP_DATA_DIR / "uploads" / "submissions"


def get_app_engine():
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{APP_DB_PATH}", echo=False)


def _ensure_patient_submission_columns(engine) -> None:
    missing_columns = {
        "patient_summary_json": "TEXT",
        "released_letter_markdown": "TEXT",
        "released_case_id": "VARCHAR",
        "release_timestamp": "INTEGER",
        "visit_recommendation": "VARCHAR",
    }
    with engine.begin() as conn:
        existing = {
            row[1]
            for row in conn.exec_driver_sql("PRAGMA table_info(app_patient_submission)").all()
        }
        for column, sql_type in missing_columns.items():
            if column not in existing:
                conn.exec_driver_sql(
                    f"ALTER TABLE app_patient_submission ADD COLUMN {column} {sql_type}"
                )


def init_app_db():
    from api import app_models  # noqa: F401

    engine = get_app_engine()
    SQLModel.metadata.create_all(engine)
    _ensure_patient_submission_columns(engine)
    return engine

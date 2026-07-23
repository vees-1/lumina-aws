from contextlib import asynccontextmanager
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine
from sqlmodel.pool import StaticPool

from main import app


@asynccontextmanager
async def mock_lifespan(app):
    yield


@pytest.fixture(name="client")
def client_fixture(monkeypatch):
    monkeypatch.setenv("LUMINA_AUTH_MODE", "local")
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    app.state.app_db_engine = engine

    with patch.object(app.router, "lifespan_context", mock_lifespan):
        with TestClient(app) as client:
            yield client


def test_patient_submission_isolation(client):
    create_res = client.post(
        "/submissions",
        data={"notes": "Fever and rash"},
        headers={"x-lumina-user-id": "patient-1", "x-lumina-role": "patient"},
    )
    assert create_res.status_code == 200
    submission_id = create_res.json()["id"]

    get_res_p1 = client.get(
        f"/submissions/{submission_id}",
        headers={"x-lumina-user-id": "patient-1", "x-lumina-role": "patient"},
    )
    assert get_res_p1.status_code == 200
    assert get_res_p1.json()["id"] == submission_id

    get_res_p2 = client.get(
        f"/submissions/{submission_id}",
        headers={"x-lumina-user-id": "patient-2", "x-lumina-role": "patient"},
    )
    assert get_res_p2.status_code == 403
    assert get_res_p2.json()["detail"] == "Not allowed"

    get_res_doc = client.get(
        f"/submissions/{submission_id}",
        headers={"x-lumina-user-id": "doctor-1", "x-lumina-role": "doctor"},
    )
    assert get_res_doc.status_code == 200

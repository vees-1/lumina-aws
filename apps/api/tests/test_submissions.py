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


def test_patient_can_download_own_released_letter_pdf(client):
    released = {
        "id": "submission-1",
        "patientOwnerId": "patient-1",
        "status": "released_to_patient",
        "releasedLetterMarkdown": "# Referral\n\nPlease review this patient.",
    }
    with patch("api.routes.agent.get_dynamo_repo") as get_repo:
        get_repo.return_value.get_submission.return_value = released
        response = client.post(
            "/agent/letter-pdf",
            json={
                "letter": "",
                "case_data": {},
                "submission_id": "submission-1",
            },
            headers={"x-lumina-user-id": "patient-1", "x-lumina-role": "patient"},
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_patient_cannot_download_another_patients_pdf(client):
    released = {
        "id": "submission-1",
        "patientOwnerId": "patient-2",
        "status": "released_to_patient",
        "releasedLetterMarkdown": "Private letter",
    }
    with patch("api.routes.agent.get_dynamo_repo") as get_repo:
        get_repo.return_value.get_submission.return_value = released
        response = client.post(
            "/agent/letter-pdf",
            json={
                "letter": "Private letter",
                "case_data": {},
                "submission_id": "submission-1",
            },
            headers={"x-lumina-user-id": "patient-1", "x-lumina-role": "patient"},
        )

    assert response.status_code == 403


def test_case_list_returns_lightweight_records_for_all_cases(client):
    stored_cases = []
    for index in range(100):
        stored_cases.append(
            {
                "id": f"case-{index}",
                "timestamp": index,
                "caseData": {
                    "id": f"case-{index}",
                    "timestamp": index,
                    "notes": "large private clinical note " * 500,
                    "modalities": ["notes"],
                    "hpoTerms": [{"hpo_id": "HP:0001250", "confidence": 0.9, "source": "notes"}],
                    "rankings": [
                        {
                            "orpha_code": 905,
                            "name": "Wilson disease",
                            "score": 0.8,
                            "confidence": 80,
                            "contributing_terms": ["large detail " * 500],
                            "missing_terms": [],
                            "distinguishing_terms": [],
                        }
                    ],
                    "patientContext": {"patientName": f"Patient {index}", "age": "42"},
                    "referralLetterDraft": "Referral letter" if index == 0 else None,
                    "outcome": "pending",
                },
            }
        )

    with patch("api.routes.submissions.get_dynamo_repo") as get_repo:
        get_repo.return_value.list_cases.return_value = stored_cases
        response = client.get(
            "/cases",
            headers={"x-lumina-user-id": "doctor-1", "x-lumina-role": "doctor"},
        )

    assert response.status_code == 200
    cases = response.json()
    assert len(cases) == 100
    assert cases[0]["id"] == "case-0"
    assert cases[0]["rankings"][0]["name"] == "Wilson disease"
    assert cases[0]["hpoTerms"][0]["hpo_id"] == "HP:0001250"
    assert cases[0]["patientContext"] == {"patientName": "Patient 0"}
    assert cases[0]["referralLetterDraft"] == "Referral letter"
    assert "notes" not in cases[0]
    assert cases[0]["rankings"][0]["contributing_terms"] == []


def test_case_list_skips_heavy_clinical_index_initialization(client):
    with (
        patch("main.ensure_app_state") as ensure_app_state,
        patch("api.routes.submissions.get_dynamo_repo") as get_repo,
    ):
        get_repo.return_value.list_cases.return_value = []
        response = client.get(
            "/cases",
            headers={"x-lumina-user-id": "doctor-1", "x-lumina-role": "doctor"},
        )

    assert response.status_code == 200
    assert response.json() == []
    ensure_app_state.assert_not_called()


def test_doctor_created_case_defaults_to_confirmed(client):
    with patch("api.routes.submissions.get_dynamo_repo") as get_repo:
        response = client.post(
            "/cases",
            json={"case_data": {"id": "doctor-case", "hpoTerms": [], "rankings": []}},
            headers={"x-lumina-user-id": "doctor-1", "x-lumina-role": "doctor"},
        )

    assert response.status_code == 200
    assert response.json()["outcome"] == "confirmed"
    saved = get_repo.return_value.create_case.call_args.args[0]
    assert saved["submissionId"] is None
    assert saved["caseData"]["outcome"] == "confirmed"


def test_patient_originated_case_defaults_to_pending(client):
    with patch("api.routes.submissions.get_dynamo_repo") as get_repo:
        get_repo.return_value.get_submission.return_value = {
            "id": "submission-1",
            "patientOwnerId": "patient-1",
        }
        response = client.post(
            "/cases",
            json={
                "case_data": {"id": "patient-case", "hpoTerms": [], "rankings": []},
                "submission_id": "submission-1",
            },
            headers={"x-lumina-user-id": "doctor-1", "x-lumina-role": "doctor"},
        )

    assert response.status_code == 200
    assert response.json()["outcome"] == "pending"
    saved = get_repo.return_value.create_case.call_args.args[0]
    assert saved["submissionId"] == "submission-1"
    assert saved["caseData"]["sourceSubmissionId"] == "submission-1"
    assert saved["caseData"]["outcome"] == "pending"


def test_legacy_case_list_derives_status_from_source(client):
    stored_cases = [
        {"id": "doctor-case", "caseData": {"id": "doctor-case"}},
        {
            "id": "patient-case",
            "submissionId": "submission-1",
            "caseData": {"id": "patient-case"},
        },
    ]
    with patch("api.routes.submissions.get_dynamo_repo") as get_repo:
        get_repo.return_value.list_cases.return_value = stored_cases
        response = client.get(
            "/cases",
            headers={"x-lumina-user-id": "doctor-1", "x-lumina-role": "doctor"},
        )

    assert response.status_code == 200
    assert [case["outcome"] for case in response.json()] == ["confirmed", "pending"]

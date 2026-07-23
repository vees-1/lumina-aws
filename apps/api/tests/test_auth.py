from unittest.mock import patch

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from api.auth import get_current_actor

app = FastAPI()


@app.get("/protected")
def protected_route(request: Request):
    user_id, role = get_current_actor(request)
    return {"user_id": user_id, "role": role}


client = TestClient(app)


def test_missing_token_in_default_mode(monkeypatch):
    monkeypatch.delenv("LUMINA_AUTH_MODE", raising=False)
    response = client.get("/protected")
    assert response.status_code == 401
    assert "Missing or invalid Authorization header" in response.json()["detail"]


def test_old_headers_forgery_fails_in_default_mode(monkeypatch):
    monkeypatch.delenv("LUMINA_AUTH_MODE", raising=False)
    response = client.get(
        "/protected",
        headers={"x-lumina-user-id": "evil-hacker", "x-lumina-role": "doctor"},
    )
    assert response.status_code == 401
    assert "Missing or invalid Authorization header" in response.json()["detail"]


def test_local_fallback_when_enabled(monkeypatch):
    monkeypatch.setenv("LUMINA_AUTH_MODE", "local")
    response = client.get("/protected", headers={"Authorization": "Bearer local-doctor"})
    assert response.status_code == 200
    assert response.json() == {"user_id": "local-doctor", "role": "doctor"}

    response_patient = client.get(
        "/protected", headers={"Authorization": "Bearer local-patient"}
    )
    assert response_patient.status_code == 200
    assert response_patient.json() == {"user_id": "local-patient", "role": "patient"}

    response_headers = client.get(
        "/protected",
        headers={"x-lumina-user-id": "custom-user", "x-lumina-role": "patient"},
    )
    assert response_headers.status_code == 200
    assert response_headers.json() == {"user_id": "custom-user", "role": "patient"}


def test_jwt_verification_success_doctor(monkeypatch):
    monkeypatch.delenv("LUMINA_AUTH_MODE", raising=False)
    monkeypatch.setenv("COGNITO_USER_POOL_ID", "us-east-1_TestPool")
    monkeypatch.setenv("AWS_REGION", "us-east-1")

    payload = {
        "sub": "user-uuid-123",
        "cognito:groups": ["doctor"],
        "token_use": "access",
        "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool",
    }
    with patch("api.auth.verify_cognito_jwt", return_value=payload):
        response = client.get(
            "/protected", headers={"Authorization": "Bearer fake.cognito.jwt"}
        )
        assert response.status_code == 200
        assert response.json() == {"user_id": "user-uuid-123", "role": "doctor"}


def test_jwt_missing_required_group_returns_403(monkeypatch):
    monkeypatch.delenv("LUMINA_AUTH_MODE", raising=False)
    monkeypatch.setenv("COGNITO_USER_POOL_ID", "us-east-1_TestPool")

    payload = {
        "sub": "user-uuid-456",
        "cognito:groups": ["unauthorized_group"],
        "token_use": "access",
    }
    with patch("api.auth.verify_cognito_jwt", return_value=payload):
        response = client.get(
            "/protected", headers={"Authorization": "Bearer fake.cognito.jwt"}
        )
        assert response.status_code == 403
        assert "missing required role group" in response.json()["detail"]

"""API smoke tests — startup, routes, disease lookup, scoring endpoint."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from ingest.db import DB_PATH
    if not DB_PATH.exists():
        pytest.skip("orpha.sqlite not found — run ingest first")
    from main import app
    with TestClient(app) as c:
        yield c


# ── Health ────────────────────────────────────────────────────────────────────

def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "db" in data
    assert "diseases loaded" in data["db"]


# ── Disease route ─────────────────────────────────────────────────────────────

def test_disease_dravet(client):
    resp = client.get("/disease/33069")
    assert resp.status_code == 200
    data = resp.json()
    assert data["orpha_code"] == 33069
    assert "Dravet" in data["name"]
    assert len(data["phenotypes"]) > 0
    assert len(data["genes"]) > 0


def test_disease_not_found(client):
    resp = client.get("/disease/9999999")
    assert resp.status_code == 404


def test_disease_phenotypes_sorted_by_weight(client):
    resp = client.get("/disease/33069")
    weights = [p["frequency_weight"] for p in resp.json()["phenotypes"]]
    assert weights == sorted(weights, reverse=True)


def test_disease_has_cross_refs(client):
    resp = client.get("/disease/33069")
    data = resp.json()
    assert len(data["icd10"]) > 0 or len(data["omim"]) > 0


# ── Score route ───────────────────────────────────────────────────────────────

def test_score_returns_results(client):
    payload = {
        "terms": [
            {"hpo_id": "HP:0007359", "confidence": 0.95, "source": "focal seizure"},
            {"hpo_id": "HP:0001336", "confidence": 0.85, "source": "myoclonus"},
        ],
        "top_k": 5,
    }
    resp = client.post("/score", json=payload)
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) > 0
    assert results[0]["orpha_code"] == 33069


def test_score_empty_terms(client):
    resp = client.post("/score", json={"terms": [], "top_k": 5})
    assert resp.status_code == 200
    assert resp.json() == []


def test_score_result_shape(client):
    payload = {"terms": [{"hpo_id": "HP:0007359", "confidence": 0.9, "source": "test"}]}
    resp = client.post("/score", json=payload)
    r = resp.json()[0]
    assert "orpha_code" in r
    assert "name" in r
    assert "score" in r
    assert "confidence" in r
    assert "contributing_terms" in r


# ── OpenAPI docs ──────────────────────────────────────────────────────────────

def test_openapi_schema(client):
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()
    paths = schema["paths"]
    assert "/intake/text" in paths
    assert "/intake/photo" in paths
    assert "/score" in paths
    assert "/disease/{orpha_code}" in paths
    assert "/agent/next" in paths
    assert "/agent/letter" in paths

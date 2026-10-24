from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_dataset_endpoint():
    response = client.get("/api/dataset")
    assert response.status_code == 200
    assert len(response.json()["samples"]) >= 1


def test_experiment_endpoint():
    response = client.post("/api/experiments", json={"reviewers": ["mock"]})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert "mock" in body["results"]


def test_unknown_reviewer_rejected():
    response = client.post("/api/experiments", json={"reviewers": ["not-a-reviewer"]})
    assert response.status_code == 422

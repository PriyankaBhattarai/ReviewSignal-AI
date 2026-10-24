import json
import subprocess

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, get_db
from app.dataset import load_dataset
from app.evaluation import run_experiment
from app.models import Experiment
from app.schemas import ExperimentRequest


class CodeReviewRequest(BaseModel):
    code: str

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    description="Evaluate the reliability of code-review methods on a small controlled Python dataset.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/", tags=["meta"])
def root():
    return {
        "name": settings.app_name,
        "description": "A reproducible AI code review evaluation MVP.",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}


@app.get("/api/dataset", tags=["dataset"])
def dataset_info():
    data = load_dataset()
    return {
        "name": data["name"],
        "version": data["version"],
        "description": data["description"],
        "category_vocabulary": data["category_vocabulary"],
        "samples": [
            {"id": s["id"], "title": s["title"], "expected_categories": s["expected_categories"]}
            for s in data["samples"]
        ],
    }


@app.post("/api/experiments", tags=["experiments"])
def create_experiment(request: ExperimentRequest, db: Session = Depends(get_db)):
    try:
        reviewer_names = request.validate_reviewers()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result = run_experiment(reviewer_names)
    record = Experiment(
        dataset_version=result["dataset_version"],
        reviewers=reviewer_names,
        results=result["results"],
        summary={"sample_count": result["sample_count"], "dataset_name": result["dataset_name"]},
        status="completed",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return serialize_experiment(record)


@app.get("/api/experiments", tags=["experiments"])
def list_experiments(db: Session = Depends(get_db)):
    records = db.query(Experiment).order_by(Experiment.id.desc()).limit(50).all()
    return [serialize_experiment(record, include_results=False) for record in records]


@app.get("/api/experiments/{experiment_id}", tags=["experiments"])
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    record = db.get(Experiment, experiment_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    return serialize_experiment(record)


@app.get("/api/experiments/{experiment_id}/export", tags=["experiments"])
def export_experiment(experiment_id: int, db: Session = Depends(get_db)):
    record = db.get(Experiment, experiment_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    return JSONResponse(
        content=serialize_experiment(record),
        headers={"Content-Disposition": f'attachment; filename="reviewsignal-experiment-{experiment_id}.json"'},
    )


def serialize_experiment(record: Experiment, include_results: bool = True) -> dict:
    data = {
        "id": record.id,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "dataset_version": record.dataset_version,
        "reviewers": record.reviewers,
        "summary": record.summary,
        "status": record.status,
    }
    if include_results:
        data["results"] = record.results
    return data

@app.post("/api/code-review", tags=["code-review"])
def review_code(request: CodeReviewRequest):
    if len(request.code) > 100_000:
        raise HTTPException(
            status_code=413,
            detail="Code must be 100,000 characters or fewer.",
        )

    lines = request.code.splitlines()
    issues = []

    # Run Ruff for Python code-quality findings.
    try:
        ruff_result = subprocess.run(
            [
                "ruff",
                "check",
                "--output-format=json",
                "--stdin-filename",
                "submitted.py",
                "-",
            ],
            input=request.code,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Ruff is not installed in the backend environment.",
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=408,
            detail="Ruff analysis timed out.",
        )

    try:
        ruff_findings = json.loads(ruff_result.stdout or "[]")
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Could not parse the Ruff analysis results.",
        )

    for item in ruff_findings:
        code = item.get("code") or "UNKNOWN"

        issues.append({
            "tool": "Ruff",
            "line": item.get("location", {}).get("row", 1),
            "column": item.get("location", {}).get("column", 1),
            "code": code,
            "message": item.get("message", "No description available."),
            "severity": (
                "high"
                if code.startswith(("E9", "F821"))
                else "medium"
            ),
            "category": "quality",
            "fix_available": item.get("fix") is not None,
        })

    # Run Bandit for Python security findings.
    try:
        bandit_result = subprocess.run(
            [
                "bandit",
                "-f",
                "json",
                "-q",
                "-",
            ],
            input=request.code,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Bandit is not installed in the backend environment.",
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=408,
            detail="Bandit analysis timed out.",
        )

    try:
        bandit_output = json.loads(bandit_result.stdout or "{}")
        bandit_findings = bandit_output.get("results", [])
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Could not parse the Bandit analysis results.",
        )

    for item in bandit_findings:
        bandit_severity = (item.get("issue_severity") or "MEDIUM").lower()

        issues.append({
            "tool": "Bandit",
            "line": item.get("line_number", 1),
            "column": 1,
            "code": item.get("test_id") or "BANDIT",
            "message": item.get("issue_text", "Security issue detected."),
            "severity": bandit_severity,
            "category": "security",
            "fix_available": False,
        })

    return {
        "tool": "Ruff + Bandit",
        "lines_analyzed": len(lines),
        "issue_count": len(issues),
        "issues": issues,
        "quality_score": max(0, 100 - len(issues) * 5),
        "score_note": (
            "Heuristic score: starts at 100 and subtracts 5 per finding. "
            "It is not a probability that the code is correct."
        ),
    }


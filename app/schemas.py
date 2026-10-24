from pydantic import BaseModel, Field


ALLOWED_REVIEWERS = {"mock", "ruff", "bandit", "llm"}


class ExperimentRequest(BaseModel):
    reviewers: list[str] = Field(default_factory=lambda: ["mock"], min_length=1, max_length=4)

    def validate_reviewers(self):
        unknown = set(self.reviewers) - ALLOWED_REVIEWERS
        if unknown:
            raise ValueError(f"Unsupported reviewer(s): {', '.join(sorted(unknown))}")
        if len(set(self.reviewers)) != len(self.reviewers):
            raise ValueError("Reviewer names must be unique.")
        return self.reviewers


class Finding(BaseModel):
    sample_id: str
    source: str
    category: str
    severity: str
    message: str
    line: int | None = None


class ReviewerResult(BaseModel):
    reviewer: str
    available: bool
    note: str | None = None
    findings: list[Finding]
    metrics: dict

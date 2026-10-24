from dataclasses import dataclass


@dataclass
class ReviewerOutput:
    available: bool
    findings: list[dict]
    note: str | None = None


class BaseReviewer:
    name = "base"

    def review(self, sample: dict) -> ReviewerOutput:
        raise NotImplementedError

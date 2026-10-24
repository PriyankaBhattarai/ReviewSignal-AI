from app.dataset import load_dataset
from app.metrics import calculate_metrics
from app.reviewers.mock import MockReviewer
from app.reviewers.static_tools import RuffReviewer, BanditReviewer
from app.reviewers.llm import LLMReviewer

REVIEWERS = {
    "mock": MockReviewer,
    "ruff": RuffReviewer,
    "bandit": BanditReviewer,
    "llm": LLMReviewer,
}


def run_experiment(reviewer_names: list[str]) -> dict:
    dataset = load_dataset()
    vocabulary = set(dataset["category_vocabulary"])
    expected_by_sample = {
        sample["id"]: set(sample.get("expected_categories", []))
        for sample in dataset["samples"]
    }
    results = {}

    for reviewer_name in reviewer_names:
        reviewer = REVIEWERS[reviewer_name]()
        all_findings = []
        detected_by_sample = {sample["id"]: set() for sample in dataset["samples"]}
        notes = []
        available_any = False

        for sample in dataset["samples"]:
            output = reviewer.review(sample)
            available_any = available_any or output.available
            if output.note:
                notes.append(output.note)
            for finding in output.findings:
                finding["sample_id"] = sample["id"]
                all_findings.append(finding)
                detected_by_sample[sample["id"]].add(finding["category"])

        metrics = calculate_metrics(expected_by_sample, detected_by_sample, vocabulary) if available_any else {}
        results[reviewer_name] = {
            "reviewer": reviewer_name,
            "available": available_any,
            "note": "; ".join(dict.fromkeys(notes)) if notes else None,
            "findings": all_findings,
            "metrics": metrics,
        }

    return {
        "dataset_version": dataset["version"],
        "dataset_name": dataset["name"],
        "sample_count": len(dataset["samples"]),
        "results": results,
    }

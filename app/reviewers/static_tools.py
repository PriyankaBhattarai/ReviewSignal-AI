import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from app.reviewers.base import BaseReviewer, ReviewerOutput


def _run_tool(command: list[str], source: str) -> tuple[bool, list[dict], str | None]:
    if not shutil.which(command[0]):
        return False, [], f"{command[0]} is not installed; install optional tool to enable this reviewer."
    with tempfile.TemporaryDirectory(prefix="reviewsignal-") as tmp:
        path = Path(tmp) / "sample.py"
        path.write_text(source, encoding="utf-8")
        try:
            result = subprocess.run(
                command + [str(path)],
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
                cwd=tmp,
            )
        except subprocess.TimeoutExpired:
            return False, [], f"{command[0]} timed out."
        except OSError as exc:
            return False, [], f"{command[0]} could not run: {exc.__class__.__name__}."

        try:
            payload = json.loads(result.stdout or "[]")
            if isinstance(payload, dict):
                payload = payload.get("results", [])
            if not isinstance(payload, list):
                return False, [], f"{command[0]} returned an unexpected response shape."
        except json.JSONDecodeError:
            return False, [], f"{command[0]} returned an unreadable response."

        findings = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            code = str(item.get("code", item.get("test_id", ""))).upper()
            category = None
            if command[0] == "ruff":
                if code.startswith(("E", "F", "W" , "I")):
                    category = "quality"
                elif code.startswith("S"):
                    category = "security"
            else:
                category = "security"
            if category:
                findings.append({
                "sample_id": "",
                "source": command[0],
                "category": category,
                "severity": str(
                    item.get("severity", item.get("issue_severity", "medium"))
                ).lower(),
                "message": str(item.get("message", item.get("issue_text", "Finding"))),
                "line": item.get("location", {}).get("row", item.get("line_number")),
            })

    return True, findings, None


class RuffReviewer(BaseReviewer):
    name = "ruff"

    def review(self, sample: dict) -> ReviewerOutput:
        available, findings, note = _run_tool(["ruff", "check", "--output-format", "json"], sample["code"])
        for finding in findings:
            finding["sample_id"] = sample["id"]
        return ReviewerOutput(available, findings, note)


class BanditReviewer(BaseReviewer):
    name = "bandit"

    def review(self, sample: dict) -> ReviewerOutput:
        available, findings, note = _run_tool(["bandit", "-f", "json", "-q"], sample["code"])
        for finding in findings:
            finding["sample_id"] = sample["id"]
        return ReviewerOutput(available, findings, note)

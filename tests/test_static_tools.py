
from app.reviewers.static_tools import RuffReviewer, BanditReviewer


def test_ruff_detects_code_quality_issue():
    sample = {
        "id": "ruff-test",
        "code": "import os\n",
    }

    result = RuffReviewer().review(sample)

    assert result.available is True
    assert any(
        finding["source"] == "ruff"
        and finding["category"] == "quality"
        for finding in result.findings
    )


def test_bandit_detects_shell_injection_risk():
    sample = {
        "id": "bandit-test",
        "code": (
            "import subprocess\n"
            "subprocess.call(input(), shell=True)\n"
        ),
    }

    result = BanditReviewer().review(sample)

    assert result.available is True
    assert any(
        finding["source"] == "bandit"
        and finding["category"] == "security"
        and "shell=True" in finding["message"]
        for finding in result.findings
    )

def test_ruff_classifies_import_sorting_as_quality():
    sample = {
        "id": "ruff-import-test",
        "code": "import sys\nimport os\n",
    }

    result = RuffReviewer().review(sample)

    assert result.available is True
    assert any(
        finding["category"] == "quality"
        and finding["source"] == "ruff"
        and finding["message"]
        for finding in result.findings
    )

def test_bandit_findings_include_line_numbers():
    sample = {
        "id": "bandit-line-test",
        "code": (
            "import subprocess\n"
            "subprocess.call(input(), shell=True)\n"
        ),
    }

    result = BanditReviewer().review(sample)

    assert result.available is True
    assert any(
        finding["category"] == "security"
        and finding["line"] == 2
        for finding in result.findings
    )
def test_bandit_preserves_finding_severity():
    sample = {
        "id": "bandit-severity-test",
        "code": (
            "import subprocess\n"
            "subprocess.call(input(), shell=True)\n"
        ),
    }

    result = BanditReviewer().review(sample)

    assert result.available is True
    assert any(
        finding["severity"] == "high"
        and "shell=True" in finding["message"]
        for finding in result.findings
    )
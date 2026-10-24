import json
from pathlib import Path

DATASET_PATH = Path(__file__).resolve().parent.parent / "data" / "benchmark.json"


def load_dataset() -> dict:
    with DATASET_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)

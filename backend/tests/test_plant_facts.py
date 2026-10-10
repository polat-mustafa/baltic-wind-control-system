"""
The SB-510 numbers that education prose quotes, taken from the backend (evidence programme B5).

``frontend/src/data/plantFacts.json`` must equal what the models use; the frontend test
``tests/constants/plantFacts.test.ts`` then checks every lesson, panel and tour against it.
After a design change: ``FACTS_WRITE=1 python -m pytest tests/test_plant_facts.py`` and commit.
"""

import json
import os
from pathlib import Path

from app.services.plant_facts import plant_facts

FACTS_FILE = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "plantFacts.json"


def test_plant_facts_file_matches_the_backend() -> None:
    facts = plant_facts()
    if os.environ.get("FACTS_WRITE"):
        FACTS_FILE.write_text(json.dumps(facts, indent=1) + "\n", encoding="utf-8")
    assert json.loads(FACTS_FILE.read_text(encoding="utf-8")) == facts, (
        "plantFacts.json is stale: FACTS_WRITE=1 python -m pytest tests/test_plant_facts.py"
    )

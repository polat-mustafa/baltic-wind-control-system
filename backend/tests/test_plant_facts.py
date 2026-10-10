"""
The SB-510 numbers that education prose quotes, taken from the backend (evidence programme B5).

``frontend/src/data/plantFacts.json`` must equal what the models use; the frontend test
``tests/constants/plantFacts.test.ts`` then checks every lesson, panel and tour against it.
After a design change: ``FACTS_WRITE=1 python -m pytest tests/test_plant_facts.py`` and commit.
"""

import json
import os
from pathlib import Path

from app.services.p1.turbine_models import get_turbine
from app.services.p2.network_model import SB510

FACTS_FILE = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "plantFacts.json"


def plant_facts() -> dict[str, float]:
    t = get_turbine()
    return {
        "turbines": SB510.num_turbines,
        "turbine_mw": SB510.turbine_rated_mw,
        "capacity_mw": SB510.capacity_mw,
        "export_km": SB510.export_length_km,
        "reactors": SB510.num_reactors,
        "reactor_mvar": SB510.reactor_unit_mvar,
        "statcom_mvar": SB510.statcom_mvar,
        "cable_charging_mvar": round(SB510.cable_q_mvar),  # rule 7, ωCV²L, both circuits
        "rotor_diameter_m": t.rotor_diameter_m,
        "cut_in_ms": t.cut_in_ms,
        "rated_ms": t.rated_ms,
        "cut_out_ms": t.cut_out_ms,
        "min_rotor_rpm": t.min_rotor_rpm,
        "max_rotor_rpm": t.max_rotor_rpm,
    }


def test_plant_facts_file_matches_the_backend() -> None:
    facts = plant_facts()
    if os.environ.get("FACTS_WRITE"):
        FACTS_FILE.write_text(json.dumps(facts, indent=1) + "\n", encoding="utf-8")
    assert json.loads(FACTS_FILE.read_text(encoding="utf-8")) == facts, (
        "plantFacts.json is stale: FACTS_WRITE=1 python -m pytest tests/test_plant_facts.py"
    )

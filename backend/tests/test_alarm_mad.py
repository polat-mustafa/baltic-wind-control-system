"""Master alarm database: documented, and priorities identical to the HMI."""

import re
from pathlib import Path

from app.services.p3.alarm_manager import MASTER_ALARM_DATABASE, mad_tag

FAULT_CATEGORIES = Path(__file__).parents[2] / "frontend/src/constants/faultCategories.ts"


def test_every_entry_is_rationalised():
    tags = [row[0] for row in MASTER_ALARM_DATABASE]
    assert len(tags) == len(set(tags))
    for tag, name, prio, src, cause, consequence, action in MASTER_ALARM_DATABASE:
        assert prio in {"CRITICAL", "HIGH", "MEDIUM", "LOW"}
        assert all((name, src, cause, consequence, action)), tag


def test_turbine_instances_map_to_their_class():
    assert mad_tag("WTG-07.PITCH_CONTROL_FAULT") == "WTG.PITCH_CONTROL_FAULT"
    assert mad_tag("OSS-220.87B.TRIP") == "OSS-220.87B.TRIP"


def test_turbine_priorities_match_the_hmi_fault_catalogue():
    if not FAULT_CATEGORIES.exists():  # backend-only checkout
        return
    ts = FAULT_CATEGORIES.read_text(encoding="utf-8")
    hmi = dict(re.findall(r'type: "(\w+)",\s*label: "[^"]*",\s*priority: "(\w+)"', ts))
    mad = {t[4:]: p for t, _, p, *_ in MASTER_ALARM_DATABASE if t.startswith("WTG.")}
    assert hmi == mad

"""A4: Baltic Power (76 × V236-15.0 MW, PL) joins the forecast sites once it is fully online.

The bundled ENTSO-E 16.1.A series (P5 energisation panel) is refreshed monthly with
``scripts/fetch_entsoe_units.py --file-library``. While the farm is still energising its output
says nothing about forecast skill; once its recent peak reaches 90 % of 1140 MW this test fails
until the farm is added to ``real_data.sites()`` — the real V236 dataset for SB-510.
"""

import json
from pathlib import Path

from app.services.p4 import real_data

DATA = Path(__file__).resolve().parents[1] / "app/services/p5/data/baltic_power_energisation.json"
CAPACITY_MW = 1140.0
GATE = 0.9


def test_baltic_power_joins_the_forecast_sites_once_fully_online() -> None:
    days = json.loads(DATA.read_text(encoding="utf-8"))["days"]
    peak = max(d["peak_mw"] for d in days[-30:])
    assert 0 <= peak <= CAPACITY_MW * 1.02  # metered output never beats the rating
    if peak >= GATE * CAPACITY_MW:
        assert any("baltic" in k for k in real_data.sites()), (
            f"Baltic Power peaked at {peak:.0f} MW (≥ {GATE:.0%} of 1140 MW): "
            "add it as a forecast site (scripts/fetch_entsoe_units.py, entsoe_units.json)"
        )

"""Site acceptance tests of circuit 1 (services/p5/sat.py)."""

import pytest

from app.services.p5.fat import EquipmentClass, all_passed, approve_campaign, create_fat_campaign
from app.services.p5.sat import (
    CABLE1_Z1_OHM,
    OLTC_POSITIONS,
    SAT_SPECS,
    SATFATGateError,
    create_sat_campaign,
)
from tests.p5_support import approved_fats, fill_typical


def test_sat_needs_an_approved_fat_for_every_class():
    with pytest.raises(SATFATGateError, match="power_transformer, gis_220kv, protection_panel"):
        create_sat_campaign("P", [])
    fats = approved_fats()
    unapproved = create_fat_campaign("TX-OSS-01", EquipmentClass.POWER_TRANSFORMER)
    with pytest.raises(SATFATGateError, match="gis_220kv"):
        create_sat_campaign("P", [fats[0], unapproved])
    sat = create_sat_campaign("P", fats)
    assert all(c.campaign_id in sat.fat_campaign_id for c in fats)


def test_typical_results_pass_and_approve():
    sat = create_sat_campaign("P", approved_fats())
    fill_typical(sat)
    assert all_passed(sat)
    approve_campaign(sat, "PiC")


def test_design_values_come_from_the_network_model():
    assert pytest.approx(13.14, abs=0.02) == CABLE1_Z1_OHM  # 108 km × |0.0233 + j0.1194| Ω/km
    assert OLTC_POSITIONS == 21  # ±10 steps
    ids = [s.test_id for s in SAT_SPECS]
    assert len(ids) == len(set(ids)) == 17
    assert next(s for s in SAT_SPECS if s.test_id == "SAT-13").max_value == 3.0  # GOOSE TT6

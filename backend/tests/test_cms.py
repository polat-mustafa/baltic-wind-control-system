"""CMS (M12): drivetrain kinematics, spectrum energy, seeded fleet, oil samples."""

import math

import pytest

from app.services.p3 import cms


def test_gearbox_kinematics_match_the_v236_drivetrain():
    marks = dict(cms.characteristic_frequencies("GEARBOX"))
    # 3 planetary stages multiply to 48:1 → HSS = 400 rpm at 8.33 rpm rotor
    assert marks["1× HSS"] * 60 == pytest.approx(400, rel=1e-3)
    assert marks["GMF1"] == pytest.approx(8.75, abs=0.01)
    assert marks["GMF3"] == pytest.approx(133.3, abs=0.1)


def test_main_bearing_defects_are_resolved_by_the_spectrum():
    bpfo = dict(cms.characteristic_frequencies("MAIN_BEARING"))["BPFO"]
    spec = cms.get_vibration_spectrum("WTG-07", "MAIN_BEARING")
    assert spec.resolution_hz < bpfo / 20  # a 2.5 Hz line spacing could not show 1.4 Hz
    rms = math.sqrt(sum(p.amplitude_mm_s**2 for p in spec.points))
    assert rms == pytest.approx(spec.overall_rms_mm_s, rel=0.01)
    # the seeded outer-race defect dominates the spectrum
    assert spec.dominant_frequency_hz == pytest.approx(bpfo, abs=spec.resolution_hz)


def test_fleet_is_deterministic_and_carries_per_component_health():
    a = cms.get_fleet_health()
    b = cms.get_fleet_health()
    assert [t.component_health for t in a.turbines] == [t.component_health for t in b.turbines]
    wtg21 = a.turbines[20]
    assert wtg21.worst_component == "GEARBOX" and wtg21.overall_alert_level == "AMBER"
    assert len(set(wtg21.component_health.values())) > 1  # rows differ per component


def test_pitch_has_no_vibration_spectrum():
    with pytest.raises(ValueError):
        cms.get_vibration_spectrum("WTG-01", "PITCH")


def test_oil_history_is_monthly_in_the_past_with_vg320_viscosity():
    oil = cms.get_oil_analysis("WTG-21")
    times = [p.timestamp_utc for p in oil.history]
    assert times == sorted(times) and len(times) == 12
    assert all(280 < p.viscosity_cst < 360 for p in oil.history)

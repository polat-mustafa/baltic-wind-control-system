"""CMS (M12): direct-drive kinematics, spectrum energy, seeded fleet, hydraulic oil samples."""

import math

import pytest

from app.services.p3 import cms


def test_generator_lines_match_the_iea15_direct_drive():
    """100 pole pairs at 7.56 rpm → f_e 12.6 Hz; 240 slots → slot pass 30.2 Hz."""
    marks = dict(cms.characteristic_frequencies("GENERATOR"))
    assert marks["1× rotor"] * 60 == pytest.approx(7.56, abs=1e-3)
    assert marks["f_e"] == pytest.approx(12.6, abs=0.01)
    assert marks["2·f_e"] == pytest.approx(25.2, abs=0.02)
    assert marks["slot pass"] == pytest.approx(30.24, abs=0.02)
    assert "GEARBOX" not in cms.CMS_COMPONENTS


def test_main_bearing_defects_are_resolved_by_the_spectrum():
    bpfo = dict(cms.characteristic_frequencies("MAIN_BEARING"))["BPFO"]
    spec = cms.get_vibration_spectrum("WTG-07", "MAIN_BEARING")
    assert spec.resolution_hz < bpfo / 20  # a 2.5 Hz line spacing could not show 3.6 Hz
    rms = math.sqrt(sum(p.amplitude_mm_s**2 for p in spec.points))
    assert rms == pytest.approx(spec.overall_rms_mm_s, rel=0.01)
    # the seeded outer-race defect dominates the spectrum
    assert spec.dominant_frequency_hz == pytest.approx(bpfo, abs=spec.resolution_hz)


def test_generator_eccentricity_shows_at_twice_the_electrical_frequency():
    two_fe = dict(cms.characteristic_frequencies("GENERATOR"))["2·f_e"]
    spec = cms.get_vibration_spectrum("WTG-21", "GENERATOR")
    assert spec.dominant_frequency_hz == pytest.approx(two_fe, abs=spec.resolution_hz)


def test_fleet_is_deterministic_and_carries_per_component_health():
    a = cms.get_fleet_health()
    b = cms.get_fleet_health()
    assert [t.component_health for t in a.turbines] == [t.component_health for t in b.turbines]
    wtg21 = a.turbines[20]
    assert wtg21.worst_component == "GENERATOR" and wtg21.overall_alert_level == "AMBER"
    assert len(set(wtg21.component_health.values())) > 1  # rows differ per component


def test_pitch_has_no_vibration_spectrum():
    with pytest.raises(ValueError):
        cms.get_vibration_spectrum("WTG-01", "PITCH")


def test_oil_history_is_monthly_hydraulic_vg46():
    """ISO VG 46 (ISO 3448): 41.4–50.6 cSt at 40 °C."""
    oil = cms.get_oil_analysis("WTG-21")
    times = [p.timestamp_utc for p in oil.history]
    assert times == sorted(times) and len(times) == 12
    assert oil.component == "PITCH"
    assert all(41.4 < p.viscosity_cst < 50.6 for p in oil.history)

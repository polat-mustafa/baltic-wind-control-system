"""Instrument register (services/p0/sensor_register.py): counts follow the farm."""

from app.services.p0.sensor_register import get_sensor_register
from app.services.p2.network_model import SB510, design


def test_sb510_tag_count():
    """34 turbines × 10 + 6 feeder bays × 7 + 2 export circuits × 5 = 392."""
    r = get_sensor_register()
    assert (r.turbine.total_per_turbine, r.oss_bay.total_per_bay) == (10, 7)
    assert r.export_cable.total_cable_instruments == 5
    assert r.export_cable.num_circuits == SB510.num_export_cables == 2
    assert r.total_instrument_tags == 392


def test_counts_follow_the_own_project():
    spec = design((5, 5, 5, 5), 40.0)
    r = get_sensor_register(spec)
    assert r.total_turbine_locations == 20 and r.total_oss_bays == 4
    assert r.export_cable.cable_length_km == 40.0
    assert r.total_instrument_tags == 20 * 10 + 4 * 7 + spec.num_export_cables * 5

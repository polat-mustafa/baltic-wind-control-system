"""
Smoke tests for P2 HV Grid Integration API endpoints.

Tests all 7 endpoints exposed by backend/app/routers/p2.py:
- GET  /api/v1/grid/network-spec
- GET  /api/v1/grid/load-flow/{scenario}
- GET  /api/v1/grid/load-flow-all
- GET  /api/v1/grid/short-circuit/{case}
- GET  /api/v1/grid/statcom-sizing
- POST /api/v1/grid/frt/{frt_type}
- GET  /api/v1/grid/converter-comparison/{scenario}

These are integration-level smoke tests — they call the real P2 services
(Pandapower/ANDES) through the API layer. Marked as slow since they
involve power system computations.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ── Network Spec ─────────────────────────────────────────────────


def test_network_spec():
    """GET /api/v1/grid/network-spec returns 510 MW farm constants."""
    response = client.get("/api/v1/grid/network-spec")
    assert response.status_code == 200
    data = response.json()
    assert data["total_capacity_mw"] == 510.0
    assert data["num_turbines"] == 34
    assert data["array_voltage_kv"] == 66.0
    assert data["export_voltage_kv"] == 220.0
    assert data["grid_voltage_kv"] == 400.0
    assert data["export_length_km"] == 45.0


# ── Load Flow ────────────────────────────────────────────────────


@pytest.mark.slow
def test_load_flow_full_load():
    """GET /api/v1/grid/load-flow/full_load returns converged result."""
    response = client.get("/api/v1/grid/load-flow/full_load")
    assert response.status_code == 200
    data = response.json()
    assert data["scenario"] == "full_load"
    assert data["converged"] is True
    assert 0.90 <= data["v_min_pu"] <= 1.10
    assert 0.90 <= data["v_max_pu"] <= 1.10
    assert data["total_generation_mw"] > 0
    assert len(data["buses"]) > 0


@pytest.mark.slow
def test_load_flow_all_scenarios():
    """GET /api/v1/grid/load-flow-all returns 4 scenario results."""
    response = client.get("/api/v1/grid/load-flow-all")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 4
    scenarios = {r["scenario"] for r in data}
    assert scenarios == {"full_load", "partial_load", "no_load", "n_minus_1"}


def test_load_flow_invalid_scenario():
    """GET /api/v1/grid/load-flow/invalid returns 422."""
    response = client.get("/api/v1/grid/load-flow/invalid")
    assert response.status_code == 422


# ── Short-Circuit ────────────────────────────────────────────────


@pytest.mark.slow
def test_short_circuit_max():
    """GET /api/v1/grid/short-circuit/max returns IEC 60909 results."""
    response = client.get("/api/v1/grid/short-circuit/max")
    assert response.status_code == 200
    data = response.json()
    assert data["case"] == "max"
    assert data["voltage_factor_c"] == 1.1
    assert data["max_ikss_ka"] > 0
    assert len(data["bus_results"]) > 0


def test_short_circuit_invalid_case():
    """GET /api/v1/grid/short-circuit/invalid returns 422 (validation error)."""
    response = client.get("/api/v1/grid/short-circuit/invalid")
    assert response.status_code == 422


# ── STATCOM Sizing ───────────────────────────────────────────────


@pytest.mark.slow
def test_statcom_sizing():
    """GET /api/v1/grid/statcom-sizing returns compensation result."""
    response = client.get("/api/v1/grid/statcom-sizing")
    assert response.status_code == 200
    data = response.json()
    assert data["cable_q_mvar"] > 0
    assert data["statcom_rating_mvar"] > 0
    assert data["ferranti_rise_pu"] >= 0
    assert isinstance(data["compensation_adequate"], bool)


# ── FRT Simulation ───────────────────────────────────────────────


@pytest.mark.slow
def test_frt_lvrt():
    """POST /api/v1/grid/frt/lvrt returns FRT simulation result."""
    response = client.post(
        "/api/v1/grid/frt/lvrt",
        json={
            "fault_bus": "OSS_66kV",
            "fault_impedance_pu": 0.05,
            "fault_duration_s": 0.15,
            "generation_fraction": 1.0,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["frt_type"] == "lvrt"
    assert data["fault_bus"] == "OSS_66kV"
    assert isinstance(data["stayed_connected"], bool)
    assert isinstance(data["reactive_current_compliant"], bool)
    assert isinstance(data["recovery_compliant"], bool)
    assert len(data["time_series"]) > 0


# ── Converter Comparison ─────────────────────────────────────────


@pytest.mark.slow
def test_converter_comparison_strong():
    """GET /api/v1/grid/converter-comparison/strong_grid returns GFL vs GFM."""
    response = client.get("/api/v1/grid/converter-comparison/strong_grid")
    assert response.status_code == 200
    data = response.json()
    assert data["scenario"] == "strong_grid"
    assert data["gfl_result"]["converter_type"] == "gfl"
    assert data["gfm_result"]["converter_type"] == "gfm"
    assert data["gfl_result"]["scr"] > 0
    assert isinstance(data["gfm_advantage"], str)


def test_converter_comparison_invalid():
    """GET /api/v1/grid/converter-comparison/invalid returns 422 (validation error)."""
    response = client.get("/api/v1/grid/converter-comparison/invalid")
    assert response.status_code == 422

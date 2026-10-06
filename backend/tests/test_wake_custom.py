"""POST /api/v1/wind/wake-analysis-custom — PyWake AEP for user layouts."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
URL = "/api/v1/wind/wake-analysis-custom"
D = 236.0


def _run(x: list[float], y: list[float]) -> Any:
    return client.post(URL, json={"x_m": x, "y_m": y})


def _grid(n: int, spacing_d: float) -> tuple[list[float], list[float]]:
    xs, ys = [], []
    for i in range(n):
        for j in range(n):
            xs.append(i * spacing_d * D)
            ys.append(j * spacing_d * D)
    return xs, ys


def test_single_turbine_has_no_wake_loss() -> None:
    r = _run([0.0], [0.0])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["wake_loss_percent"] == 0.0
    assert body["net_aep_gwh"] == body["gross_aep_gwh"]
    # 15 MW at a CF between 0 and 1 → 0 < AEP < 131.4 GWh
    assert 0.0 < body["net_aep_gwh"] < 15.0 * 8.76
    assert 0.0 < body["capacity_factor"] < 1.0


def test_tighter_grid_loses_more_to_wakes() -> None:
    tight = _run(*_grid(3, 4.0)).json()
    wide = _run(*_grid(3, 8.0)).json()
    assert 0.0 < wide["wake_loss_percent"] < tight["wake_loss_percent"] < 40.0
    assert len(tight["per_turbine_aep_gwh"]) == 9
    assert tight["net_aep_gwh"] < tight["gross_aep_gwh"]


def test_rejects_mismatched_lengths() -> None:
    assert _run([0.0, 2000.0], [0.0]).status_code in (400, 422)


def test_rejects_overlapping_rotors() -> None:
    r = _run([0.0, 100.0], [0.0, 0.0])
    assert r.status_code in (400, 422)
    assert "rotor" in r.text


def test_rejects_too_many_turbines() -> None:
    xs = [i * 1000.0 for i in range(151)]
    assert _run(xs, [0.0] * 151).status_code == 422

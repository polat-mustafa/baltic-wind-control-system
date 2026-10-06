"""Reference turbine models (IEA Wind Task 37 tables) — data integrity and Rule 1."""

from __future__ import annotations

import csv

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import ValidationError
from app.main import app
from app.services.p1.turbine_models import (
    DATA_DIR,
    DEFAULT_TURBINE_ID,
    get_turbine,
    turbine_models,
)

IDS = ["IEA-15-240-RWT", "IEA-22-280-RWT"]


@pytest.mark.parametrize("model_id", IDS)
class TestModelData:
    def test_parameters_from_the_official_tables(self, model_id: str) -> None:
        t = get_turbine(model_id)
        expected = {
            "IEA-15-240-RWT": (15_000.0, 241.35, 150.0, 10.66),
            "IEA-22-280-RWT": (22_000.0, 284.0, 170.0, 11.13),
        }[model_id]
        assert (t.rated_kw, t.rotor_diameter_m, t.hub_height_m) == expected[:3]
        assert t.rated_ms == pytest.approx(expected[3], abs=0.01)
        assert (t.cut_in_ms, t.cut_out_ms) == (3.0, 25.0)
        assert t.license == "Apache-2.0" and "IEAWindTask37" in t.source

    def test_table_is_sorted_and_physical(self, model_id: str) -> None:
        t = get_turbine(model_id)
        assert np.all(np.diff(t.ws_ms) > 0)
        assert np.all((t.power_kw >= 0) & (t.power_kw <= t.rated_kw))
        assert np.all((t.ct >= 0) & (t.ct <= 1))
        # rated speed is the first table point at the rating
        assert t.power_kw[t.ws_ms < t.rated_ms].max() < t.rated_kw
        assert t.power_curve_kw(t.rated_ms) == pytest.approx(t.rated_kw)

    def test_rule_1(self, model_id: str) -> None:
        t = get_turbine(model_id)
        v = np.linspace(-5.0, 50.0, 2001)
        p = t.power_curve_kw(v)
        assert np.all((p >= 0) & (p <= t.rated_kw))
        assert np.all(p[(v < 3.0) | (v > 25.0)] == 0.0)
        assert np.all(t.ct_curve(v)[(v < 3.0) | (v > 25.0)] == 0.0)

    def test_power_coefficient_below_betz(self, model_id: str) -> None:
        """Cp = P / (½ρAv³) < 16/27 everywhere (ρ = 1.225 kg/m³)."""
        t = get_turbine(model_id)
        v = t.ws_ms[t.ws_ms < t.rated_ms]
        area = np.pi * (t.rotor_diameter_m / 2) ** 2
        cp = t.power_curve_kw(v) * 1e3 / (0.5 * 1.225 * area * v**3)
        assert cp.max() < 16 / 27
        assert cp.max() > 0.40  # a modern rotor in region 2

    def test_csv_matches_loaded_curve(self, model_id: str) -> None:
        with (DATA_DIR / f"{model_id}.csv").open(encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
        assert len(rows) == len(get_turbine(model_id).ws_ms) >= 40


def test_default_is_iea_15() -> None:
    assert DEFAULT_TURBINE_ID == "IEA-15-240-RWT"
    assert get_turbine().id == DEFAULT_TURBINE_ID
    assert set(turbine_models()) == set(IDS)


def test_unknown_model_is_a_validation_error() -> None:
    with pytest.raises(ValidationError, match="Unknown turbine model"):
        get_turbine("V236-15.0")


def test_turbine_spec_endpoint() -> None:
    client = TestClient(app)
    body = client.get("/api/v1/wind/turbine-spec").json()
    assert body["model_id"] == "IEA-15-240-RWT" and body["cut_out_speed_ms"] == 25.0
    big = client.get("/api/v1/wind/turbine-spec", params={"model": "IEA-22-280-RWT"}).json()
    assert big["rated_power_kw"] == 22_000.0


def test_frontend_constants_match_backend_data() -> None:
    """frontend/src/constants/turbineModels.ts is generated from the same tables."""
    import re
    from pathlib import Path

    ts_file = Path(__file__).resolve().parents[2] / "frontend/src/constants/turbineModels.ts"
    if not ts_file.exists():
        pytest.skip("frontend not checked out")
    ts = ts_file.read_text(encoding="utf-8")
    for t in turbine_models().values():
        block = ts[ts.index(f'"{t.id}": {{') :]
        block = block[: block.index("\n  },")]
        nums = {
            k: float(re.search(rf"{k}: ([\d.]+)", block).group(1))  # type: ignore[union-attr]
            for k in ("ratedKw", "rotorDiameterM", "hubHeightM", "cutInMs", "ratedMs", "cutOutMs")
        }
        assert nums == {
            "ratedKw": t.rated_kw,
            "rotorDiameterM": t.rotor_diameter_m,
            "hubHeightM": t.hub_height_m,
            "cutInMs": t.cut_in_ms,
            "ratedMs": t.rated_ms,
            "cutOutMs": t.cut_out_ms,
        }
        rows = [
            tuple(map(float, r)) for r in re.findall(r"\[([\d.]+), ([\d.]+), ([\d.]+)\]", block)
        ]
        expected = list(zip(t.ws_ms.tolist(), t.power_kw.tolist(), t.ct.tolist(), strict=True))
        assert rows == expected

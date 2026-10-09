"""P4 ramp detection scales the single-turbine forecast to the project's farm,
while the models stay trained on the reference SCADA set (no retraining)."""

from __future__ import annotations

import numpy as np
from httpx import ASGITransport, AsyncClient

from app.routers.p4 import analysis
from app.services.p4.ensemble_model import ModelForecasts


def _forecasts() -> tuple[ModelForecasts, np.ndarray]:
    t = np.arange(144, dtype=float)
    p = 7.5 + 7.0 * np.sin(t / 10.0)  # one turbine, MW, strong ramps
    arrays = {f"{m}_{q}": p.copy() for m in ("xgb", "lstm", "tft") for q in ("p10", "p50", "p90")}
    return ModelForecasts(**arrays, wind_speed_ms=np.full(144, 10.0), timestamps_utc=t * 600), p


async def test_ramps_scale_with_farm_turbines(monkeypatch):
    from app.main import app

    async def fake(**_kw):
        return _forecasts()

    monkeypatch.setattr(analysis, "_get_cached_forecasts", fake)
    url = "/api/v1/forecast/detect-ramps"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ref = (await client.post(url, json={})).json()
        own = (await client.post(url, json={"farm_turbines": 10})).json()
    ratio = own["max_ramp_rate_mw_hr"] / ref["max_ramp_rate_mw_hr"]
    assert abs(ratio - 10 / 34) < 0.02  # MW/h scale with the farm, not the training set

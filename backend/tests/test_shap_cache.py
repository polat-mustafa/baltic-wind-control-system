"""SHAP endpoint cache (routers/p4/models.py): the same request is computed once.

Retraining XGBoost and TreeSHAP takes ~100 s on a CPU; the result depends only
on the seeded request, so a second call must come from Redis without training.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.routers.p4 import models
from app.services.p4.xgboost_model import SHAPResult


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self.store[key] = value


def test_second_identical_request_is_served_from_the_cache(monkeypatch: Any) -> None:
    calls = {"train": 0}
    names = ["power_lag_1", "wind_speed"]

    async def pipeline(**_: Any) -> tuple[Any, ...]:
        x = np.zeros((20, 2))
        return x, np.zeros(20), np.zeros(20), np.zeros(20), names

    def train(*_: Any, **__: Any) -> tuple[None, list[None]]:
        calls["train"] += 1
        return None, [None, None, None]

    def shap(*_: Any, **__: Any) -> SHAPResult:
        return SHAPResult(
            shap_values=np.ones((20, 2)),
            feature_names=names,
            feature_importance={"power_lag_1": 0.7, "wind_speed": 0.3},
        )

    redis = FakeRedis()
    monkeypatch.setattr(models, "get_redis", lambda: redis)
    monkeypatch.setattr(models, "_get_pipeline_data", pipeline)
    monkeypatch.setattr(models, "train_xgboost", train)
    monkeypatch.setattr(models, "compute_shap_values", shap)

    client = TestClient(app)
    body = {"num_turbines": 34, "num_timesteps": 1000, "turbine_index": 0, "seed": 42}
    first = client.post("/api/v1/forecast/xgboost-shap", json=body)
    second = client.post("/api/v1/forecast/xgboost-shap", json=body)

    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert first.json()["top_features"][0] == "power_lag_1"
    assert calls["train"] == 1
    assert len(redis.store) == 1

"""Shared data pipeline helpers for P4 sub-routers.

Contains the SCADA → filter → features → NWP merge pipeline that is shared
across XGBoost, LSTM, TFT, ensemble, ramp, and model comparison endpoints.
Also contains cached model forecast helpers used by ensemble and analysis.
"""

from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from app.core.cache import cached
from app.services.p4.ensemble_model import (
    EnsembleConfig,
    ModelForecasts,
    apply_inverse_rmse_weighting,
    apply_skill_gate,
    compute_ensemble_forecast,
)
from app.services.p4.model_evaluation import compute_rmse, compute_skill_score
from app.services.p4.feature_engineering import FeatureConfig, engineer_features
from app.services.p4.lstm_model import LSTMConfig, predict_lstm, train_lstm
from app.services.p4.nwp_pipeline import NWPConfig, generate_nwp_dataset, merge_nwp_features
from app.services.p4.scada_generator import SCADAConfig, generate_scada_dataset
from app.services.p4.scada_quality_filters import apply_all_quality_filters
from app.services.p4.tft_model import TFTConfig, predict_tft, train_tft
from app.services.p4.xgboost_model import XGBoostConfig, predict_xgboost, train_xgboost

logger = logging.getLogger(__name__)


# ── XGBoost Helper: Data Pipeline ──────────────────────────────────


def _build_xgboost_pipeline(
    num_turbines: int,
    num_timesteps: int,
    turbine_index: int,
    seed: int | None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, list[str]]:
    """Run the full data pipeline: SCADA → filter → features → NWP merge.

    Returns (features, target_power, wind_speed, timestamps, feature_names).
    """
    config = SCADAConfig(
        num_turbines=num_turbines,
        num_timesteps=num_timesteps,
        seed=seed,
    )
    dataset = generate_scada_dataset(config)

    # Quality filtering
    filter_result = apply_all_quality_filters(
        wind_speed=dataset.wind_speed_ms,
        power=dataset.power_mw,
        status=dataset.status,
        temperature=dataset.temperature_c,
        humidity=dataset.humidity_pct,
    )

    # Feature engineering
    turbine_idx = min(turbine_index, num_turbines - 1)
    eng_features = engineer_features(
        wind_speed=dataset.wind_speed_ms,
        power=dataset.power_mw,
        wind_direction=dataset.wind_direction_deg,
        temperature=dataset.temperature_c,
        pressure=dataset.pressure_pa,
        humidity=dataset.humidity_pct,
        timestamps=dataset.timestamps,
        clean_mask=filter_result.clean_mask,
        turbine_index=turbine_idx,
        config=FeatureConfig(),
    )

    # NWP data generation and merge
    clean_mask = filter_result.clean_mask[:, turbine_idx]
    scada_wind_clean = dataset.wind_speed_ms[clean_mask, turbine_idx]
    nwp_config = NWPConfig(num_timesteps=len(scada_wind_clean), seed=seed)
    nwp_dataset = generate_nwp_dataset(
        config=nwp_config,
        scada_wind_ms=scada_wind_clean,
        timestamps=dataset.timestamps[clean_mask],
    )

    merged_features = merge_nwp_features(eng_features.feature_matrix, nwp_dataset)
    feature_names = [
        *eng_features.feature_names,
        "nwp_wind_speed_100m_ms",
        "nwp_wind_direction_100m_deg",
        "nwp_temperature_2m_c",
        "nwp_pressure_msl_pa",
        "nwp_boundary_layer_height_m",
    ]

    # Extract target: wind_speed is column 0 in feature matrix
    wind_speed = merged_features[:, 0]

    # Target power: use the clean, filtered power for this turbine
    clean_power = dataset.power_mw[clean_mask, turbine_idx]
    n_valid = eng_features.valid_timesteps
    target_power = clean_power[-n_valid:]

    # Timestamps for the valid period
    clean_ts = dataset.timestamps[clean_mask]
    timestamps = clean_ts[-n_valid:]

    return merged_features, target_power, wind_speed, timestamps, feature_names


# ── Cached Pipeline ────────────────────────────────────────────────


@cached(prefix="xgb_pipeline", ttl=300)
def _cached_xgb_pipeline(
    num_turbines: int,
    num_timesteps: int,
    turbine_index: int,
    seed: int | None,
) -> dict[str, object]:
    """Cached wrapper for the SCADA → filter → features pipeline.

    Serialises numpy arrays to lists for Redis storage.
    All 10+ endpoints share this cached result.
    """
    features, target, wind_speed, timestamps, feature_names = _build_xgboost_pipeline(
        num_turbines=num_turbines,
        num_timesteps=num_timesteps,
        turbine_index=turbine_index,
        seed=seed,
    )
    return {
        "features": features.tolist(),
        "target": target.tolist(),
        "wind_speed": wind_speed.tolist(),
        "timestamps": timestamps.tolist(),
        "feature_names": feature_names,
    }


async def _get_pipeline_data(
    num_turbines: int,
    num_timesteps: int,
    turbine_index: int,
    seed: int | None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, list[str]]:
    """Retrieve cached pipeline data, reconstructing numpy arrays."""
    raw = await _cached_xgb_pipeline(
        num_turbines=num_turbines,
        num_timesteps=num_timesteps,
        turbine_index=turbine_index,
        seed=seed,
    )
    return (
        np.array(raw["features"]),
        np.array(raw["target"]),
        np.array(raw["wind_speed"]),
        np.array(raw["timestamps"]),
        raw["feature_names"],
    )


# ── Shared Helper: Build All Model Forecasts ─────────────────────


def _build_all_model_forecasts(
    num_turbines: int,
    num_timesteps: int,
    turbine_index: int,
    horizon_steps: int,
    seed: int | None,
) -> tuple[ModelForecasts, np.ndarray]:
    """Train XGBoost, LSTM, and TFT, then return aligned forecast arrays.

    Returns (ModelForecasts, actual_power) for ensemble/evaluation use.
    """
    features, target, wind_speed, timestamps, _ = _build_xgboost_pipeline(
        num_turbines=num_turbines,
        num_timesteps=num_timesteps,
        turbine_index=turbine_index,
        seed=seed,
    )

    seed_val = seed if seed is not None else 42

    # ── Train all three models in parallel ──
    xgb_config = XGBoostConfig(seed=seed_val)
    lstm_config = LSTMConfig(seed=seed_val)
    tft_config = TFTConfig(seed=seed_val)

    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=3) as executor:
        xgb_future = executor.submit(train_xgboost, features, target, xgb_config)
        lstm_future = executor.submit(train_lstm, features, target, lstm_config)
        tft_future = executor.submit(train_tft, features, target, tft_config)

    _, xgb_models = xgb_future.result()
    _, lstm_model, lstm_norm = lstm_future.result()
    _, tft_model, tft_norm = tft_future.result()
    logger.info("Parallel training took %.1fs", time.perf_counter() - t0)

    # ── Predict with each model in parallel ──
    horizon = min(horizon_steps, features.shape[0])
    pred_features = features[-horizon:]
    pred_wind = wind_speed[-horizon:]
    pred_ts = timestamps[-horizon:]
    actual = target[-horizon:]

    lstm_horizon = min(horizon_steps + lstm_config.lookback - 1, features.shape[0])
    tft_horizon = min(horizon_steps + tft_config.lookback - 1, features.shape[0])

    with ThreadPoolExecutor(max_workers=3) as executor:
        xgb_pred_f = executor.submit(predict_xgboost, xgb_models, pred_features, pred_wind, pred_ts)
        lstm_pred_f = executor.submit(
            predict_lstm,
            lstm_model,
            features[-lstm_horizon:],
            wind_speed[-lstm_horizon:],
            lstm_norm,
            lstm_config,
            timestamps[-lstm_horizon:],
        )
        tft_pred_f = executor.submit(
            predict_tft,
            tft_model,
            features[-tft_horizon:],
            wind_speed[-tft_horizon:],
            tft_norm,
            tft_config,
            timestamps[-tft_horizon:],
        )

    xgb_forecast = xgb_pred_f.result()
    lstm_forecast = lstm_pred_f.result()
    tft_forecast = tft_pred_f.result()

    # Align all to same length (min of all outputs)
    n = min(
        len(xgb_forecast.power_p50_mw),
        len(lstm_forecast.power_p50_mw),
        len(tft_forecast.power_p50_mw),
        horizon,
    )

    forecasts = ModelForecasts(
        xgb_p10=xgb_forecast.power_p10_mw[-n:],
        xgb_p50=xgb_forecast.power_p50_mw[-n:],
        xgb_p90=xgb_forecast.power_p90_mw[-n:],
        lstm_p10=lstm_forecast.power_p10_mw[-n:],
        lstm_p50=lstm_forecast.power_p50_mw[-n:],
        lstm_p90=lstm_forecast.power_p90_mw[-n:],
        tft_p10=tft_forecast.power_p10_mw[-n:],
        tft_p50=tft_forecast.power_p50_mw[-n:],
        tft_p90=tft_forecast.power_p90_mw[-n:],
        wind_speed_ms=pred_wind[-n:],
        timestamps_utc=pred_ts[-n:],
    )

    return forecasts, actual[-n:]


# ── Cached Model Forecasts (shared across all endpoints) ─────────

_build_lock = asyncio.Lock()


@cached(prefix="forecasts", ttl=300)
def _cached_build_forecasts(
    num_turbines: int,
    num_timesteps: int,
    turbine_index: int,
    horizon_steps: int,
    seed: int | None,
) -> dict[str, object]:
    """Cached wrapper for all model forecasts — serialisable dict for Redis."""
    forecasts, actual = _build_all_model_forecasts(
        num_turbines=num_turbines,
        num_timesteps=num_timesteps,
        turbine_index=turbine_index,
        horizon_steps=horizon_steps,
        seed=seed,
    )
    return {
        "xgb_p10": forecasts.xgb_p10.tolist(),
        "xgb_p50": forecasts.xgb_p50.tolist(),
        "xgb_p90": forecasts.xgb_p90.tolist(),
        "lstm_p10": forecasts.lstm_p10.tolist(),
        "lstm_p50": forecasts.lstm_p50.tolist(),
        "lstm_p90": forecasts.lstm_p90.tolist(),
        "tft_p10": forecasts.tft_p10.tolist(),
        "tft_p50": forecasts.tft_p50.tolist(),
        "tft_p90": forecasts.tft_p90.tolist(),
        "wind_speed_ms": forecasts.wind_speed_ms.tolist(),
        "timestamps_utc": forecasts.timestamps_utc.tolist(),
        "actual": actual.tolist(),
    }


async def _get_cached_forecasts(
    num_turbines: int,
    num_timesteps: int,
    turbine_index: int,
    horizon_steps: int,
    seed: int | None,
) -> tuple[ModelForecasts, np.ndarray]:
    """Get cached model forecasts with lock to serialise first build."""
    async with _build_lock:
        raw = await _cached_build_forecasts(
            num_turbines=num_turbines,
            num_timesteps=num_timesteps,
            turbine_index=turbine_index,
            horizon_steps=horizon_steps,
            seed=seed,
        )

    forecasts = ModelForecasts(
        xgb_p10=np.asarray(raw["xgb_p10"]),
        xgb_p50=np.asarray(raw["xgb_p50"]),
        xgb_p90=np.asarray(raw["xgb_p90"]),
        lstm_p10=np.asarray(raw["lstm_p10"]),
        lstm_p50=np.asarray(raw["lstm_p50"]),
        lstm_p90=np.asarray(raw["lstm_p90"]),
        tft_p10=np.asarray(raw["tft_p10"]),
        tft_p50=np.asarray(raw["tft_p50"]),
        tft_p90=np.asarray(raw["tft_p90"]),
        wind_speed_ms=np.asarray(raw["wind_speed_ms"]),
        timestamps_utc=np.asarray(raw["timestamps_utc"]),
    )
    actual = np.asarray(raw["actual"])
    return forecasts, actual


def build_adaptive_ensemble_config(
    forecasts: ModelForecasts, actual: np.ndarray
) -> EnsembleConfig:
    """Build an ensemble config adapted to the evaluation window.

    Two stages, applied in order:
      1. **Skill gate** — drop any model failing to beat persistence (skill < 0).
      2. **Inverse-RMSE** — scale surviving weights by ``1 / RMSE²``.

    Preserves the roadmap §5.6 horizon expertise (TFT long, XGB short)
    while preventing a weak base model from pulling the ensemble below
    its best member.
    """
    skill_scores = {
        "XGBoost": compute_skill_score(actual, forecasts.xgb_p50),
        "LSTM": compute_skill_score(actual, forecasts.lstm_p50),
        "TFT": compute_skill_score(actual, forecasts.tft_p50),
    }
    rmse_scores = {
        "XGBoost": compute_rmse(actual, forecasts.xgb_p50),
        "LSTM": compute_rmse(actual, forecasts.lstm_p50),
        "TFT": compute_rmse(actual, forecasts.tft_p50),
    }
    cfg = apply_skill_gate(EnsembleConfig(), skill_scores)
    return apply_inverse_rmse_weighting(cfg, rmse_scores)


async def _cached_ensemble_predict(
    num_turbines: int,
    num_timesteps: int,
    turbine_index: int,
    horizon_steps: int,
    seed: int | None,
) -> dict[str, object]:
    """Build ensemble from cached model forecasts.

    Weights are adapted per evaluation window: first skill-gated against
    persistence (negative-skill models dropped), then scaled by inverse
    RMSE so the best performer naturally gets more weight. Protects the
    ensemble from being dragged below its best member.
    """
    forecasts, actual = await _get_cached_forecasts(
        num_turbines=num_turbines,
        num_timesteps=num_timesteps,
        turbine_index=turbine_index,
        horizon_steps=horizon_steps,
        seed=seed,
    )
    ensemble = compute_ensemble_forecast(
        forecasts, build_adaptive_ensemble_config(forecasts, actual)
    )
    n = len(ensemble.power_p50_mw)
    return {
        "power_p10_mw": [round(float(v), 4) for v in ensemble.power_p10_mw],
        "power_p50_mw": [round(float(v), 4) for v in ensemble.power_p50_mw],
        "power_p90_mw": [round(float(v), 4) for v in ensemble.power_p90_mw],
        "wind_speed_ms": [round(float(v), 4) for v in ensemble.wind_speed_ms],
        "timestamps_utc": [int(t) for t in ensemble.timestamps_utc],
        "num_steps": n,
        "weights_applied": ensemble.weights_applied,
        "total_violations": ensemble.constraint_result.total_violations,
    }

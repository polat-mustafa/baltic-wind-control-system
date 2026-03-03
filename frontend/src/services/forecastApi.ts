/**
 * Typed fetch wrapper for P4 AI Forecasting API endpoints.
 *
 * Every function maps 1:1 to a backend route in backend/app/routers/p4.py.
 * Pattern follows gridApi.ts — Vite dev proxy forwards /api.
 */

import type {
  ConstraintCheckResponse,
  EnsemblePredictResponse,
  FeatureEngineeringResponse,
  LSTMPredictResponse,
  LSTMTrainResponse,
  MCDropoutResponse,
  ModelCompareResponse,
  PowerCurveResponse,
  QualityFilterResponse,
  RampDetectResponse,
  SCADADatasetSummary,
  SHAPResponse,
  TFTAttentionResponse,
  TFTPredictResponse,
  TFTTrainResponse,
  TurbineSpec,
  XGBoostPredictResponse,
  XGBoostTrainResponse,
} from "../types/forecast";

import { post, request } from "./apiClient";

const BASE = "/api/v1/forecast";

// ── Turbine Spec ──────────────────────────────────────────────

export function getTurbineSpec(): Promise<TurbineSpec> {
  return request(`${BASE}/turbine-spec`);
}

// ── Power Curve ───────────────────────────────────────────────

export function generatePowerCurve(
  windStepMs?: number,
  airDensity?: number,
): Promise<PowerCurveResponse> {
  return post(`${BASE}/power-curve`, {
    wind_step_ms: windStepMs,
    air_density_kg_m3: airDensity,
  });
}

// ── SCADA Generation ──────────────────────────────────────────

export function generateSCADA(
  numTurbines: number,
  numTimesteps: number,
  weibullA: number,
  weibullK: number,
  seed?: number,
): Promise<SCADADatasetSummary> {
  return post(`${BASE}/generate-scada`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    weibull_a: weibullA,
    weibull_k: weibullK,
    seed,
  });
}

// ── Quality Filtering ─────────────────────────────────────────

export function runQualityFilter(
  numTurbines: number,
  numTimesteps: number,
  seed?: number,
): Promise<QualityFilterResponse> {
  return post(`${BASE}/quality-filter`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    seed,
  });
}

// ── Feature Engineering ───────────────────────────────────────

export function runFeatureEngineering(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  seed?: number,
): Promise<FeatureEngineeringResponse> {
  return post(`${BASE}/features`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    seed,
  });
}

// ── Constraint Enforcement ────────────────────────────────────

export function checkConstraints(
  predictionsMw: number[],
  windSpeedsMs?: number[],
): Promise<ConstraintCheckResponse> {
  return post(`${BASE}/check-constraints`, {
    predictions_mw: predictionsMw,
    wind_speeds_ms: windSpeedsMs,
  });
}

// ── XGBoost Training ──────────────────────────────────────────

export function trainXGBoost(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  nEstimators?: number,
  maxDepth?: number,
  learningRate?: number,
  seed?: number,
): Promise<XGBoostTrainResponse> {
  return post(`${BASE}/train-xgboost`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    n_estimators: nEstimators,
    max_depth: maxDepth,
    learning_rate: learningRate,
    seed,
  });
}

// ── XGBoost Prediction ───────────────────────────────────────

export function predictXGBoost(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  horizonSteps: number,
  seed?: number,
): Promise<XGBoostPredictResponse> {
  return post(`${BASE}/predict-xgboost`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    horizon_steps: horizonSteps,
    seed,
  });
}

// ── XGBoost SHAP ──────────────────────────────────────────────

export function getXGBoostSHAP(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  topKFeatures: number = 10,
  seed?: number,
): Promise<SHAPResponse> {
  return post(`${BASE}/xgboost-shap`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    top_k_features: topKFeatures,
    seed,
  });
}

// ── LSTM Training ─────────────────────────────────────────────

export function trainLSTM(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  lookback?: number,
  hiddenUnitsL1?: number,
  hiddenUnitsL2?: number,
  dropout?: number,
  learningRate?: number,
  epochs?: number,
  patience?: number,
  batchSize?: number,
  seed?: number,
): Promise<LSTMTrainResponse> {
  return post(`${BASE}/train-lstm`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    lookback,
    hidden_units_l1: hiddenUnitsL1,
    hidden_units_l2: hiddenUnitsL2,
    dropout,
    learning_rate: learningRate,
    epochs,
    patience,
    batch_size: batchSize,
    seed,
  });
}

// ── LSTM Prediction ───────────────────────────────────────────

export function predictLSTM(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  lookback?: number,
  mcSamples?: number,
  horizonSteps?: number,
  seed?: number,
): Promise<LSTMPredictResponse> {
  return post(`${BASE}/predict-lstm`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    lookback,
    mc_samples: mcSamples,
    horizon_steps: horizonSteps,
    seed,
  });
}

// ── MC Dropout Visualization ──────────────────────────────────

export function lstmMCDropout(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  lookback?: number,
  mcSamples?: number,
  horizonSteps?: number,
  seed?: number,
): Promise<MCDropoutResponse> {
  return post(`${BASE}/lstm-mc-dropout`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    lookback,
    mc_samples: mcSamples,
    horizon_steps: horizonSteps,
    seed,
  });
}

// ── TFT Training ──────────────────────────────────────────────

export function trainTFT(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  lookback?: number,
  hiddenSize?: number,
  numAttentionHeads?: number,
  dropout?: number,
  learningRate?: number,
  epochs?: number,
  patience?: number,
  batchSize?: number,
  seed?: number,
): Promise<TFTTrainResponse> {
  return post(`${BASE}/train-tft`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    lookback,
    hidden_size: hiddenSize,
    num_attention_heads: numAttentionHeads,
    dropout,
    learning_rate: learningRate,
    epochs,
    patience,
    batch_size: batchSize,
    seed,
  });
}

// ── TFT Prediction ────────────────────────────────────────────

export function predictTFT(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  lookback?: number,
  horizonSteps?: number,
  seed?: number,
): Promise<TFTPredictResponse> {
  return post(`${BASE}/predict-tft`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    lookback,
    horizon_steps: horizonSteps,
    seed,
  });
}

// ── TFT Attention Visualization ───────────────────────────────

export function tftAttention(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  lookback?: number,
  horizonSteps?: number,
  seed?: number,
): Promise<TFTAttentionResponse> {
  return post(`${BASE}/tft-attention`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    lookback,
    horizon_steps: horizonSteps,
    seed,
  });
}

// ── Ensemble Prediction ───────────────────────────────────────

export function predictEnsemble(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  horizonSteps: number,
  seed?: number,
): Promise<EnsemblePredictResponse> {
  return post(`${BASE}/predict-ensemble`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    horizon_steps: horizonSteps,
    seed,
  });
}

// ── Ramp Detection ────────────────────────────────────────────

export function detectRamps(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  horizonSteps: number,
  thresholdMwHr: number,
  seed?: number,
): Promise<RampDetectResponse> {
  return post(`${BASE}/detect-ramps`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    horizon_steps: horizonSteps,
    threshold_mw_hr: thresholdMwHr,
    seed,
  });
}

// ── Model Comparison ──────────────────────────────────────────

export function compareModels(
  numTurbines: number,
  numTimesteps: number,
  turbineIndex: number,
  horizonSteps: number,
  seed?: number,
): Promise<ModelCompareResponse> {
  return post(`${BASE}/compare-models`, {
    num_turbines: numTurbines,
    num_timesteps: numTimesteps,
    turbine_index: turbineIndex,
    horizon_steps: horizonSteps,
    seed,
  });
}

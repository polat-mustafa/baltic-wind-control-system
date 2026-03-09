# Lesson 015 - Temporal Fusion Transformer (TFT): Multi-Horizon Power Forecasting with Attention

!!! abstract "Lesson Navigation"
    **Previous:** [Lesson 014 - LSTM Forecasting with MC Dropout](lesson-014.md) | **Next:** [Lesson 016 - Ensemble Forecasting, Ramp Detection and Model Evaluation](lesson-016.md)

    **Phase:** P4 | **Language:** English | **Progress:** 16 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-26
> **Phase:** P4 (AI Forecasting)
> **Roadmap sections:** [Phase 4 - Section 5.6 TFT Model, Section 5.7 Quantile Regression, Section 5.10 Attention]
> **Language:** English
> **Previous lesson:** Lesson 014

---

## What You Will Learn

- Why different forecast horizons such as 1 h, 6 h, 24 h, and 48 h require different modelling strategies
- The four core components of the Temporal Fusion Transformer architecture: GRN, VSN, Multi-Head Attention, and Quantile Outputs
- How the attention mechanism answers the question, "which historical time steps influenced the forecast?"
- Why native quantile regression with pinball loss can produce P10, P50, and P90 directly, without relying on MC Dropout
- How the Variable Selection Network provides built-in feature importance without a separate SHAP workflow

---

## Section 1: Multi-Horizon Forecasting - Why One Model Is Not Enough

### Real-World Problem

A storm front is approaching across the Baltic Sea. The transmission system operator, PSE, must make different decisions at different forecast horizons:

| Horizon | Typical decision | Dominant information source |
| --- | --- | --- |
| 1-6 hours | Balancing-market actions | SCADA autocorrelation |
| 6-24 hours | Day-ahead market bidding | NWP synoptic forecast |
| 24-48 hours | Maintenance planning | Regime changes and weather-system evolution |

XGBoost treats each row independently, which makes it strong at short horizons when carefully engineered lag features exist. LSTM captures temporal structure well, especially at medium horizons. However, neither architecture is designed to decide explicitly which past features and which past time steps matter most for each forecast horizon. TFT addresses exactly that gap.

### What the Standards and Literature Say

For uncertainty-aware wind-power forecasting, two families of methods are common in this repository:

1. **MC Dropout** - used with LSTM in the previous lesson to estimate uncertainty from repeated stochastic forward passes.
2. **Quantile regression** - used in XGBoost and TFT to predict P10, P50, and P90 directly through the loss function.

The key academic reference is Lim et al. (2021), *Temporal Fusion Transformers for Interpretable Multi-horizon Time Series Forecasting*. The practical advantage of TFT is that interpretability and probabilistic forecasting are embedded into the architecture itself, rather than added as a post-processing step.

---

## Section 2: TFT Architecture - Four Core Building Blocks

### 2.1 Gated Residual Network (GRN)

The Gated Residual Network is the basic nonlinear processing block inside TFT.

```text
eta1 = W1 x + b1
eta2 = W2 · ELU(eta1) + b2
GRN(x) = LayerNorm(x + GLU(eta2))
```

The two important concepts are:

- **GLU (Gated Linear Unit)** controls how much information is allowed to pass forward.
- **Residual / skip connection** preserves gradient flow and helps training remain stable in deeper architectures.

In engineering terms, the GRN behaves like an adaptive gate. If a particular transformed signal is not useful, the network can suppress it instead of letting noise propagate through the model.

### 2.2 Variable Selection Network (VSN)

The Variable Selection Network learns the relative importance of each input feature.

```text
v_j = GRN_j(xi_j)
weights = Softmax(GRN_w(xi))
VSN(xi) = Sum_j weights_j × v_j
```

This means the model does not merely receive all features equally. It learns which variables matter most for a given forecasting context.

For offshore wind forecasting, that often means:

- at a **1 h horizon**, recent power and recent wind-speed lags dominate,
- at a **24 h horizon**, NWP wind speed and cyclical calendar features such as hour-of-day become more important.

### 2.3 Multi-Head Attention

The attention mechanism follows the transformer formulation introduced by Vaswani et al. (2017):

```text
Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) · V
```

Interpretation:

- **Query**: what information is currently needed,
- **Key**: how each historical step is represented,
- **Value**: the information stored in each historical step.

The practical benefit is interpretability. Attention weights can be extracted and visualised to show which historical periods influenced the forecast most strongly.

### 2.4 Quantile Output Heads

The output layer contains separate heads for each requested quantile.

```python
self.quantile_heads = nn.ModuleList([
    nn.Linear(hidden_size, 1),  # P10
    nn.Linear(hidden_size, 1),  # P50
    nn.Linear(hidden_size, 1),  # P90
])
```

Training uses **pinball loss**:

```text
L_tau(y, y_hat) = tau × max(y-y_hat, 0) + (1-tau) × max(y_hat-y, 0)
L_total = L_0.10 + L_0.50 + L_0.90
```

This gives a direct probabilistic forecast rather than estimating a mean first and uncertainty later.

---

## Section 3: What We Built

### New Files

- `backend/app/services/p4/tft_model.py` - full TFT implementation with GRN, VSN, attention, training, prediction, and attention extraction
- `backend/tests/test_tft_model.py` - unit and integration tests for the TFT forecasting workflow

### Updated Files

- `backend/app/services/p4/__init__.py` - module exports
- `backend/app/schemas/forecast.py` - TFT request and response schemas
- `backend/app/routers/p4.py` - new endpoints for training, inference, and attention inspection

### Architecture Summary

```text
Input (batch, lookback=72, n_features=19)
  -> Variable Selection Network
  -> LSTM encoder
  -> Multi-Head Attention
  -> Gated Residual Network
  -> Quantile heads (P10, P50, P90)
```

### API Endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/forecast/train-tft` | Train TFT with TimeSeriesSplit validation |
| `POST /api/v1/forecast/predict-tft` | Return probabilistic power forecast |
| `POST /api/v1/forecast/tft-attention` | Return attention weights and variable-selection scores |

---

## Section 4: Comparing XGBoost, LSTM, and TFT

| Attribute | XGBoost | LSTM | TFT |
| --- | --- | --- | --- |
| Architecture | Gradient-boosted trees | Recurrent neural network | LSTM + transformer-style attention |
| Best forecast window | < 6 h | 6-24 h | 12-48 h |
| Uncertainty method | Quantile regression | MC Dropout | Native quantile heads |
| Explainability | SHAP | Limited | Attention + VSN |
| Training speed | Fastest | Moderate | Slowest |
| Data requirement | Lowest | Medium | Highest |

### Ensemble Strategy

A practical system often combines all three:

```text
< 6 h:   0.50 × XGBoost + 0.30 × LSTM + 0.20 × TFT
6-24 h:  0.20 × XGBoost + 0.40 × LSTM + 0.40 × TFT
24-48 h: 0.10 × XGBoost + 0.30 × LSTM + 0.60 × TFT
```

This reflects the reality that no single model dominates every horizon equally well.

---

## Section 5: Physical Constraints

TFT outputs pass through the same physical-constraint layer used by the other forecasting models:

1. `P >= 0 MW`
2. `P <= 15.0 MW`
3. `wind speed < 3.0 m/s -> P = 0`
4. `wind speed > 31.0 m/s -> P = 0`
5. `P10 <= P50 <= P90`

These rules are not optional. They preserve engineering realism regardless of model architecture.

---

## Section 6: Test Coverage

The TFT module is covered by tests across eight categories:

| Test group | Focus |
| --- | --- |
| `TestGRN` | shape and residual behaviour |
| `TestVariableSelection` | valid weights and output shape |
| `TestMultiHeadAttention` | attention storage and normalisation |
| `TestTFTTraining` | training completion, CV folds, early stopping |
| `TestTFTPrediction` | monotonic quantiles and valid outputs |
| `TestTFTPhysicalConstraints` | cut-in and cut-out enforcement |
| `TestTFTAttention` | attention dimensions and feature labels |

---

## Interview Questions

### Question 1: How is TFT different from XGBoost and LSTM?

**Simple answer:** XGBoost is strong on tabular short-horizon forecasting, LSTM is strong on sequence learning, and TFT combines sequential learning, built-in feature selection, attention, and direct quantile prediction in one architecture.

**Technical answer:** TFT uses Variable Selection Networks for feature-wise gating, recurrent encoding for temporal context, Multi-Head Attention for long-range dependencies, and native quantile heads for direct P10/P50/P90 prediction. It therefore combines interpretability and probabilistic forecasting more natively than either XGBoost or a standard LSTM.

### Question 2: Why use pinball loss instead of MC Dropout?

**Simple answer:** Pinball loss teaches the model to predict a requested quantile directly, while MC Dropout estimates uncertainty indirectly from repeated stochastic predictions.

**Technical answer:** Pinball loss is asymmetric and quantile-specific. For example, at tau = 0.9, under-prediction is penalised much more than over-prediction. This makes the network learn the desired quantile directly, without assuming a Gaussian form for forecast uncertainty.

### Question 3: How should attention weights be interpreted?

**Simple answer:** They show which historical time steps the model relied on most heavily when producing a forecast.

**Technical answer:** Attention scores provide a time-indexed importance map. In a wind-power system, high weight on a historical block may indicate that the model is tracking the onset of a weather front, a diurnal cycle, or another persistent temporal regime.

---

## Explain It Simply

Today we added a forecasting model that can look far back in time and decide which past signals matter most for predicting future wind-farm power. Instead of only saying, "this is the expected value," it can also give a pessimistic and optimistic range, which is exactly what operators and traders need when risk matters.

## Explain It Technically

In this lesson we introduced a Temporal Fusion Transformer pipeline for multi-horizon offshore wind-power forecasting. The implementation combines variable selection, recurrent temporal encoding, attention-based interpretability, and direct quantile outputs in one model family. Compared with the previous XGBoost and LSTM implementations, TFT is the most expressive and the most computationally demanding, but it is also the most aligned with long-horizon probabilistic forecasting and feature-importance inspection.


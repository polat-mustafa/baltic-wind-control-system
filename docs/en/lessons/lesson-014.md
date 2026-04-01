# Lesson 014 - LSTM Time-Series Forecasting: Uncertainty Estimation with MC Dropout

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 013 - XGBoost Quantile Forecasting, NWP Pipeline and SHAP Explainability](lesson-013.md) | **Next:** [Lesson 015 - Temporal Fusion Transformer (TFT)](lesson-015.md) :material-arrow-right:

    **Phase:** P4 | **Language:** English | **Progress:** 15 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-26
> **Phase:** P4 (AI Forecasting)
> **Roadmap sections:** [Phase 4 - LSTM Sequence Model, MC Dropout, Time-Series Training]
> **Language:** English
> **Previous lesson:** Lesson 013

---

## What You Will Learn

- Why temporal dependencies are critical in wind power forecasting and how LSTM's gate mechanism captures them
- How to use Monte Carlo Dropout (Gal & Ghahramani, 2016) for Bayesian uncertainty estimation
- LSTM cell equations (forget/input/output gates) and MC Dropout quantile derivation
- Training of 2-layer LSTM model with PyTorch, early stopping and TimeSeriesSplit cross-validation
- Ensure fair model comparison on the same data pipeline with XGBoost

---

## Section 1: Temporal Dependencies — Why Is Sequence Important?

### Real World Problem

A weather front is moving over the North Sea towards the Baltic. At 06:00 in the morning the wind is 6 m/s, at 09:00 it is 9 m/s, at 12:00 it is 14 m/s — this is a ramp event. Since turbine power depends on the cubic law (P ∝ v³), this 2.3x wind increase translates into a ~12x power increase.

Table-based (tabular) models such as XGBoost evaluate each time step independently. Yes, we can encode historical information with lag features (t-1, t-2, t-6), but these are hand-designed "windows". LSTM, on the other hand, takes the 24-hour (144 steps) raw sequence and decides which historical information is important.

### What the Standards Say

**IEC 61400-26-1** requires uncertainty quantification for power predictions. Traditional methods (ensemble, quantile regression) train deterministic model outputs with different loss functions. MC Dropout, on the other hand, creates a stochastic ensemble by training a single model and leaving dropout active during inference:

> **MC Dropout** (Gal & Ghahramani, 2016): Running a neural network with dropout T times is an approximate Bayesian posterior sampling. Each forward pass uses a different dropout mask and chooses a different subnetwork.

This provides ensemble-level uncertainty estimation at the cost of single model training.

### What We Built

**New files:**

- `backend/app/services/p4/lstm_model.py` — PyTorch LSTM model, MC Dropout prediction, normalization
- `backend/tests/test_lstm_model.py` — 18 tests (sequence creation, training, MC dropout, prediction, physical constraints)

**Changed files:**

- `backend/app/services/p4/__init__.py` — LSTM module exports (re-exports)
- `backend/app/schemas/forecast.py` — LSTM Pydantic schemas (request/response)
- `backend/app/routers/p4.py` — 3 new endpoints (train-lstm, predict-lstm, lstm-mc-dropout)
- `backend/pyproject.toml` — Added PyTorch dependency

### Why It Matters

> **Why** do we need LSTM if XGBoost already works fine?

XGBoost sees each row independently and learns attribute interactions. LSTM, on the other hand, learns long-range dependencies in the raw time series. A 6-hour weather front pattern, a 30-minute ramp event—these are sequential structures. Real-world wind forecast systems use both approaches and create ensembles. Which one is better depends on the data set, forecast horizon, and turbine location.

---

## Section 2: LSTM Cell Mechanics — Gates

### Simple Analogy

Think of an LSTM cell as a gated store:

1. **Forget Gate)** — f_t: "How much of the old knowledge in the warehouse should I keep?" If a weather front has passed, forget about the old wind pattern.
2. **Input Gate** — i_t: "How much of the new information should I add to the warehouse?" If a new ramp event started, save this information.
3. **Output Gate** — o_t: "How much information should I give out from the warehouse?" What information is most important when making a prediction?

### Mathematical Formulation

At each time step t the LSTM cell calculates:

```
Unutma kapısı:  f_t = σ(W_f · [h_{t-1}, x_t] + b_f)
Giriş kapısı:   i_t = σ(W_i · [h_{t-1}, x_t] + b_i)
Hücre güncelleme: c̃_t = tanh(W_c · [h_{t-1}, x_t] + b_c)
Hücre durumu:   c_t = f_t ⊙ c_{t-1} + i_t ⊙ c̃_t
Çıkış kapısı:   o_t = σ(W_o · [h_{t-1}, x_t] + b_o)
Gizli durum:    h_t = o_t ⊙ tanh(c_t)
```

Here σ is the sigmoid function (output [0,1]), ⊙ is the element-wise multiplication (Hadamard), and tanh compresses the output to [-1,1].

### Architectural

```
Girdi (batch, 144, 19) → LSTM(64) → Dropout(0.2) → LSTM(32) → Dropout(0.2) → Dense(1)
```

- **144 time steps**: 24 hours × 6 steps/hour (10 minute resolution)
- **19 attributes**: 14 engineered SCADA + 5 NWP attributes
- **2 layers**: The first layer (64 units) learns low-level temporal patterns, the second layer (32 units) learns high-level abstractions

### Code Review — Model Class

```python
class WindPowerLSTM(nn.Module):
    """2-layer LSTM for wind power forecasting with MC Dropout."""

    def __init__(self, n_features, hidden_units=(64, 32), dropout=0.2):
        super().__init__()
        h1, h2 = hidden_units
        self.lstm1 = nn.LSTM(input_size=n_features, hidden_size=h1, batch_first=True)
        self.dropout1 = nn.Dropout(p=dropout)
        self.lstm2 = nn.LSTM(input_size=h1, hidden_size=h2, batch_first=True)
        self.dropout2 = nn.Dropout(p=dropout)
        self.fc = nn.Linear(h2, 1)

    def forward(self, x):
        out, _ = self.lstm1(x)      # (batch, 144, 64)
        out = self.dropout1(out)     # MC Dropout: train() modunda aktif kalır
        out, _ = self.lstm2(out)     # (batch, 144, 32)
        out = self.dropout2(out)
        out = out[:, -1, :]          # Son zaman adımının çıktısı (batch, 32)
        return self.fc(out)          # (batch, 1)
```

**Critical design decision:** We use `nn.Dropout` because in PyTorch, dropout is automatically enabled in `model.train()` mode and disabled in `model.eval()` mode. For MC Dropout, we call `model.train()` during inference — this creates a stochastic ensemble by “silencing” different neurons with each forward pass.

---

## Section 3: MC Dropout — Bayesian Uncertainty

### Theory

Gal & Ghahramani (2016) showed that running a dropout neural network T times is an approximate variational Bayesian inference. Each forward pass is a sample from the posterior distribution of model weights.

After T stochastic forward transition:

```
Ortalama:    μ = (1/T) Σ ŷ_t           — merkezi tahmin (P50)
Varyans:     σ² = (1/T) Σ (ŷ_t - μ)²  — epistemik belirsizlik
P10:         μ - 1.2816 × σ            — Gaussian %10 kantili
P90:         μ + 1.2816 × σ            — Gaussian %90 kantili
```

Here 1.2816 is the 90% z-score of the standard normal distribution.

### Why Gaussian z-score?

According to the central limit theorem, the average of sufficiently many (T ≥ 30) independent MC transitions converges to a normal distribution. We satisfy this condition by using T = 100. This allows us to calculate P10/P90 with simple z-score multiplication rather than complex quantile regression — transparent and understandable for educational purposes.

### Code Review — MC Dropout

```python
def compute_mc_dropout_detail(model, features, norm_params, config):
    # Normalize ve sequence oluştur
    norm_features = _normalize_features_with_params(features, norm_params)
    x_seq, _ = create_sequences(norm_features, dummy_target, config.lookback)
    x_tensor = torch.tensor(x_seq, dtype=torch.float32)

    # KRITIK: model.train() — dropout AKTIF kalır
    model.train()
    all_passes = []
    for _ in range(config.mc_samples):  # 100 geçiş
        with torch.no_grad():           # Gradient hesaplamıyor (hızlı)
            pred_norm = model(x_tensor).squeeze(-1).numpy()
        pred_mw = _denormalize_power(pred_norm, norm_params)
        all_passes.append(pred_mw)

    all_passes_array = np.array(all_passes)  # (100, n_steps)
    mc_mean = np.mean(all_passes_array, axis=0)
    mc_std = np.std(all_passes_array, axis=0)
```

Different neurons are "silenced" at each pass → different estimate → statistical uncertainty.

---

## Section 4: Data Pipeline — Normalization → Sequencing → Education

### Data Flow

```
Mevcut pipeline (XGBoost ile paylaşılan):
  SCADA → Kalite Filtreleri → Öznitelik Mühendisliği → NWP Birleştirme → 2D (n, 19)

LSTM'e özel adımlar:
  → Min-Max Normalizasyon [0,1] → Kayar Pencere 3D (n_seq, 144, 19) → Eğitim/Tahmin
  → MC Dropout (100 geçiş) → μ ± 1.2816σ → P10/P50/P90
  → Fiziksel Kısıtlar → Monotoniklik Zorlaması
```

### Why Normalization?

LSTM cells use sigmoid and tanh activations—both saturate in the [-1, 1] or [0, 1] range. If non-normalized wind speed (0-30 m/s) and pressure (95,000-105,000 Pa) are fed together, pressure gradients become dominant and wind speed information is lost. Min-max normalization solves this problem by setting all attributes equal to the range [0,1].

### Why Sequencing After Normalization?

Normalization parameters (min, max) are calculated from the training set. If sequencing were done later, each window would have its own min/max — inter-window inconsistency. First normalizing all the data and then splitting it into windows ensures that all time steps are at the same scale.

### Code Review — Sliding Window

```python
def create_sequences(features, target, lookback=144):
    n_samples = features.shape[0]
    if n_samples < lookback:
        return empty arrays

    n_sequences = n_samples - lookback + 1
    x = np.zeros((n_sequences, lookback, n_features))
    y = np.zeros(n_sequences)

    for i in range(n_sequences):
        x[i] = features[i : i + lookback]  # 24 saatlik pencere
        y[i] = target[i + lookback - 1]    # Pencerenin SON adımı → hedef

    return x, y
```

**Future leak protection:** `y[i]` always corresponds to the last step of the window `x[i]`. The model can never see "future" power values ​​as input.

---

## Section 5: Training — TimeSeriesSplit + Early Stop

### Cross-Validation

We use the same TimeSeriesSplit strategy as XGBoost (fair comparison):

```
Fold 1: Eğitim [0 .. N/4]     → Test [N/4 .. 2N/4]
Fold 2: Eğitim [0 .. 2N/4]    → Test [2N/4 .. 3N/4]
Fold 3: Eğitim [0 .. 3N/4]    → Test [3N/4 .. N]
```

With each fold, the training window expands and the test window slides forward. This simulates real-world retraining of the model with more data as time goes by.

### Early Stopping

```python
for epoch in range(config.epochs):  # max 100
    # Eğitim fazı
    model.train()
    for batch_x, batch_y in train_loader:
        optimizer.zero_grad()
        pred = model(batch_x).squeeze(-1)
        loss = loss_fn(pred, batch_y)  # MSE
        loss.backward()
        optimizer.step()

    # Doğrulama fazı (dropout kapalı)
    model.eval()
    with torch.no_grad():
        val_loss = loss_fn(model(x_val).squeeze(-1), y_val).item()

    # Erken durdurma kontrolü
    if val_loss < best_val_loss:
        best_val_loss = val_loss
        patience_counter = 0
    else:
        patience_counter += 1
        if patience_counter >= config.patience:  # 10 epoch sabır
            break
```

**Why stop early?** LSTMs are prone to overfitting — parameterized models can "memorize" the training data. We stop training when validation loss stops improving.

---

## Section 6: Physical Constraints — Model-Agnostic Security

The physical constraint layer is the same as XGBoost (model-agnostic design):

```python
# P10/P50/P90'a ayrı ayrı fiziksel kısıt uygula
p10 = enforce_physical_constraints(p10_raw, wind_speed)
p50 = enforce_physical_constraints(p50_raw, wind_speed)
p90 = enforce_physical_constraints(p90_raw, wind_speed)

# Monotoniklik: P10 ≤ P50 ≤ P90
p50 = np.maximum(p50, p10)
p90 = np.maximum(p90, p50)
```

IEC 61400-12-1 rules:
- 0 ≤ P ≤ 15 MW (V236 rated power)
- v < 3.0 m/s → P = 0 (below cut-in)
- v > 31.0 m/s → P = 0 (above cut-out, safety stop)

---

## Section 7: API Endpoints

Three new endpoints have been added:

| Method | Road | Purpose |
|-------|-----|-------|
| POST | `/api/v1/forecast/train-lstm` | Training with TimeSeriesSplit CV, return CV metrics |
| POST | `/api/v1/forecast/predict-lstm` | MC Dropout → P10/P50/P90 prediction |
| POST | `/api/v1/forecast/lstm-mc-dropout` | All MC transitions — uncertainty visualization data |

All endpoints use the existing `_build_xgboost_pipeline` utility function — XGBoost and LSTM are trained on the exact same data, ensuring fair model comparison.

---

## Section 8: Design Decisions

| Decision | Why |
|-------|-------|
| **PyTorch (not Keras)** | Natural dropout control with `model.train()` — essential for MC Dropout |
| **Reuse of existing data pipeline** | XGBoost vs LSTM fair comparison (same data, same attributes) |
| **Gaussian z-score quantiles** | Simple, educationally transparent (P10 = μ - 1.2816σ) |
| **Normalization → sequencing order** | All window values ​​are on the same scale |
| **Physical constraints post-processing** | Model-agnostic — same layer applied to XGBoost and LSTM |

---

## Test Scope

18 tests in 5 test classes:

| Test Class | Number of Tests | What's True |
|-------------|-------------|-------------|
| `TestSequenceCreation` | 4 | 3D shape, no future leak, window continuity, short data |
| `TestLSTMTraining` | 6 | Completion, number of folds, early stopping, finite RMSE, norm parameters, architecture |
| `TestMCDropout` | 3 | Inter-pass variance, non-negative std, number of correct passes |
| `TestLSTMPrediction` | 4 | Quantile monotonicity, no negatives, subnominal, consistent lengths |
| `TestLSTMPhysicalConstraints` | 1 | Zero power under cut-in |

---

## Question Bank

**Q1:** In which scenario is LSTM's forget gate most critical in wind energy forecasting?

<details>
<summary>Answer</summary>

During weather front transitions. A North front brought strong north wind for 6 hours, then the wind changed direction and the speed decreased. The forget gate recognizes that the old north wind pattern is no longer valid and "erases" this information from the cell state. If the forget gate does not work properly, the model will remain stuck with the old pattern and will not be able to capture the power drop during the transition. This is especially important in marine conditions because weather fronts cause rapid and dramatic wind changes.

</details>

**Q2:** Why does MC Dropout use 100 forward passes? What if it's 10 or 1000?

<details>
<summary>Answer</summary>

According to the Central Limit Theorem, the mean of T ≥ 30 independent samples converges to a normal distribution. The standard deviation estimate with T=10 is high variance — it underestimates or overestimates the true uncertainty at some time steps. T=1000 is statistically more accurate but increases inference time by 10x; The real-time SCADA system must produce a forecast every 10 minutes, so the computational budget is limited. T=100 is a good balance point between statistical stability and computational cost. In Production, this parameter is set based on hardware capacity and latency requirements.

</details>

**Q3:** Why do we normalize before sequencing and not after?

<details>
<summary>Answer</summary>

If post-sequencing normalization were done, it would present two potential problems: (1) If each array was applied its own min/max, inter-window scale inconsistency would occur — the same 10 m/s wind speed would take on different normalized values ​​in different windows. (2) Applying global min/max to all arrays solves the problem, but this unnecessarily complicates the normalization. Pre-sequencing normalization is the cleanest solution: a single min/max is calculated on the 2D matrix, then converted to 3D. All windows are automatically the same scale.

</details>

**Q4:** What is the main architectural difference between XGBoost and LSTM? Which one is preferred and when?

<details>
<summary>Answer</summary>

XGBoost is table-based — each row is an independent sample and learns feature interactions (tree splits). LSTM is sequence-based — it takes 144 consecutive time steps as a single input and makes a learned decision, via a gate mechanism, which past information is important. XGBoost is generally strong on short-term predictions with well-engineered attributes (lag, rolling average, TI) and is fast to train. LSTM is advantageous in scenarios where long-term temporal patterns (6-12 hour fronts, diurnal cycles) are critical but requires more data and GPU computing power. In Production the two are often combined as an ensemble.

</details>

**Q5:** Why do we apply the physical constraint layer as post-processing instead of embedding it in the model (loss function)?

<details>
<summary>Answer</summary>

Three reasons: (1) **Model-agnostic**: The same constraint code is applied to XGBoost, LSTM, and the future TFT model without modification. (2) **Decomposability**: During model training, constraints can disrupt the loss landscape — gradients are interrupted at constraint boundaries and training can become unstable. As post-processing, the laws of physics are deterministic and fast. (3) **Debugging**: Being able to see the model output before and after the constraint allows us to track where the model is producing physically inconsistent predictions — a valuable signal for model improvement.

</details>

**Q6:** What is the difference between `model.train()` and `model.eval()`? Why do we use `train()` in MC Dropout?

<details>
<summary>Answer</summary>

In PyTorch, `model.train()` runs layers such as dropout and batch normalization in training mode — randomly disabling dropout neurons, using batch statistics instead of batch norm running statistics. `model.eval()` disables them — the standard approach to deterministic inference. We purposely use `model.train()` in MC Dropout because we want the dropout to remain active: each forward pass “mutes” different neurons, creating a different sub-network, producing a stochastic ensemble. With `torch.no_grad()` we save memory and computation by turning off the gradient calculation — we don't need gradients, just the output variance.

</details>

### Challenge Question

**S7:** The current MC Dropout implementation measures epistemic uncertainty (model uncertainty). If you also wanted to capture aleatoric uncertainty (data noise), how would you modify the model?

<details>
<summary>Answer</summary>

The heteroscedastic regression approach is used: making the output layer of the model `Dense(2)` instead of `Dense(1)` — one output μ (mean) and the other log(σ²) (log variance). Changes the loss function to Gaussian negative log-likelihood: L = (1/2)log(σ²) + (y - μ)²/(2σ²). In this way, the model produces both forecast and data uncertainty for each time step. When combined with MC Dropout, the total uncertainty = aleatoric (model output σ²) + epistemic (MC variance). This is based on Kendall & Gal (2017) “What Uncertainties Do We Need in Bayesian Deep Learning for Computer Vision?” It is formalized in the article. In wind energy, aleatoric uncertainty comes from turbulence and measurement noise; Epistemic uncertainty comes from conditions (extreme storms, rare atmospheric events) that the model never sees in the training data.

</details>

---

## Interview Corner

### Simply Explain
*"How would you explain wind power forecasting with LSTM to a non-technical person?"*

34 giant turbines produce electricity in a wind farm. We need to know today how much electricity we will produce tomorrow — because we made a promise to the power grid. To do this, we show the computer all the data of the last 24 hours: wind speed, temperature, air pressure — every 10 minutes, 144 measurements. The computer looks at this sequence and asks, "Is the wind increasing, decreasing, is a storm approaching?" finds answers to your questions.

But giving a single prediction is risky — what if we're wrong? So we ask the computer the same question 100 times, but each time we turn off a random part of its memory (tape some of its eyes). If all 100 answers are close to each other, we say "the model is confident". If the answers are too scattered, we say, “the model is unsure — be careful.” Ultimately, we give three numbers: worst case, expected case, best case. The energy trader can make a safe bet by looking at these three numbers.

### Explain Technically
*"How would you explain the LSTM MC Dropout pipeline to an interview panel?"*

The LSTM pipeline we added to the P4 module produces a sequence-based probabilistic power forecast for a 510 MW offshore wind farm. Architecture implemented with PyTorch: 2-layer LSTM (64→32 units), 0.2 dropout between layers, last layer Dense(1). The input is a 3D tensor consisting of 19 features (14 engineered SCADA + 5 NWP) with a sliding window of 144 time steps (24 hour, 10-minute resolution).

Uncertainty measurement is achieved by MC Dropout (Gal & Ghahramani, 2016): 100 stochastic forward passes are performed, keeping the model in `train()` mode during inference. Each pass samples a different sub-network with a different dropout mask — this is an approximate variational posterior sampling. Gaussian z-scores and P10 (μ-1.2816σ), P50 (μ), P90 (μ+1.2816σ) quantiles are derived from the resulting distribution.

Data pipeline is fully shared with XGBoost (`_build_xgboost_pipeline`): SCADA generation → 5 quality filters → feature engineering → NWP compositing. This ensures a fair comparison of the two models. Min-max normalization is applied before sequencing (all windows equal scale). Future leakage is prevented during training with TimeSeriesSplit CV (expanding window). Overlearning is controlled with Adam optimizer + MSE loss + early stopping (patience=10).

The same model-agnostic physical constraint layer is applied after estimation: 0 ≤ P ≤ 15 MW, cut-in/cut-out rules (IEC 61400-12-1), and quantile monotonicity (P10 ≤ P50 ≤ P90). Pipeline comes with 3 FastAPI endpoints and is covered by 18 pytests — verifying physical and statistical consistency from array shape to MC variance.

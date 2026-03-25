# Chapter 36: The Temporal Fusion Transformer: Where the Model Looks

*When Kaan arrived Thursday morning, Jonasz was not at the whiteboard. He was at his desk, facing the screen, and the screen showed something that had not been there the previous day: a grid of coloured squares, roughly a hundred and forty-four columns wide and twenty-four rows tall. Most of the grid was dark blue — nearly black. But running diagonally from the top-left corner toward the bottom-right was a band of warm orange and yellow, thinning as it went. And scattered across the grid, at irregular positions that did not follow the diagonal, were isolated bright yellow cells, concentrated in two places: around column forty-eight and column ninety-six.*

*Kaan set down his coffee and looked at it.*

*"What is that?" he asked.*

*Jonasz turned. His thermos was back — full, apparently, from the condensation on the cap. "That is the model reading," he said. "The rows are future timesteps. Hour one through hour twenty-four. The columns are past timesteps — the twenty-four hours of lookback history before the prediction window. Each cell shows how much attention the model assigned to that past hour when generating that specific future prediction. Yellow is more. Blue is less."*

*Kaan looked at the diagonal band. Recent history correlating with the immediate future — that was expected. He looked at the off-diagonal bright spots. Row twelve: two isolated yellow patches, one at column forty-eight, one at roughly column ninety-six.*

*"Hour twelve in the future. The bright spots are at eight hours ago and sixteen hours ago."*

*"Yes. And if I told you," Jonasz said, "that eight hours ago was when the barometric pressure began its sustained drop, and sixteen hours ago was when the wind direction started backing from south to south-southwest — what would you say the model had learned to do?"*

*Kaan understood before he finished the sentence. "It's looking at the meteorological precursors of the frontal passage. Not the most recent data. The early signals. The ones that predict what the wind is doing at hour twelve."*

*"Yes," Jonasz said. He picked up the thermos. "I did not tell it to look there. I did not encode 'barometric pressure trend' as a feature. I gave it wind speed, wind direction, turbulence intensity, and NWP forecasts. It found the relevant past timesteps in the data. That is the difference between a model with memory and a model with attention." He paused. "The LSTM remembered what happened. This model knows which parts of what happened to read."*

*He poured two cups.*

---

## 36.1 The Sequential Bottleneck

The LSTM solved the vanishing gradient problem through a fundamental architectural insight: instead of passing gradients backward through a chain of nonlinear transformations, it provided a direct highway — the cell state — along which information could flow unchanged across arbitrarily many timesteps. The forget and input gates controlled what was written and erased; the output gate controlled what was released. The result was a model that could, in principle, carry a representation of an event that occurred 144 timesteps ago all the way forward to the prediction at step 144, with the gradient remaining large enough for the optimiser to act on.

In practice, for wind power forecasting, this worked well. The Chapter 35 results confirmed it: LSTM MAPE of 6.1% at 24 hours, compared to 7.4% for XGBoost — a gain of 1.3 percentage points that translated, across the reference farm's 8,760 operating hours, to more accurate reserve scheduling, narrower uncertainty bands, and an MC dropout calibration error of just 0.3% against the nominal 90% coverage target.

But the LSTM kept one structural property of the simple RNN that it was designed to improve upon: it still processed the input sequence one timestep at a time, from left to right, updating the hidden state sequentially. This has two consequences that become significant as sequence length grows.

The first is computational. A 144-step LSTM forward pass requires 144 sequential matrix multiplications, each of which depends on the output of the previous step. Parallelisation across the sequence dimension is structurally impossible. For a single training example this is fast enough; for a training set of 50,000 records across 144 timesteps, the sequential bottleneck limits how quickly the model can be trained and how easily it can be scaled.

The second consequence is representational. Even though the LSTM's cell state can carry information from step 1 to step 144 without gradient decay, every piece of historical information must be filtered through the gates and compressed into a fixed-size vector before each prediction. Step 144's hidden state must somehow encode, in $d$ real-valued numbers, everything from the 143 preceding steps that the model considers relevant to the current prediction. For a 24-hour wind sequence with a frontal passage underway, that vector must simultaneously represent the recent turbulence intensity, the backing wind direction trend from sixteen hours ago, the pressure gradient from eight hours ago, and the model's uncertainty about which of these signals is most diagnostic. Compression is always lossy. For long sequences, the relevant signal may be diluted.

This is not a failure of the LSTM. It is a consequence of the sequential architecture that both the simple RNN and the LSTM share. Removing it required abandoning recurrence entirely.

---

## 36.2 Attention: From Translation to Turbines

The attention mechanism was not invented for energy forecasting. It was invented to fix a problem in machine translation.

In 2014, a team at the Université de Montréal — Dzmitry Bahdanau, Kyunghyun Cho, and Yoshua Bengio — were working on sequence-to-sequence translation with LSTM encoder-decoder networks.[^1] Their architecture used a single context vector, produced by the final encoder hidden state, to initialise the decoder. This worked well for short sentences. For sentences longer than roughly twenty words, performance degraded sharply: the single vector could not carry the full meaning of a long source sequence into the decoder, and the decoder had no way to access earlier encoder states directly.

Their solution was conceptually simple. At each decoder step, instead of using only the final encoder state, compute a weighted sum over all encoder hidden states — allowing the decoder to "look back" at whichever parts of the source sequence were most relevant to the current output token. The weights were computed from a small neural network that compared the current decoder state to each encoder state, producing a score that was then normalised with a softmax. They called this soft attention, to distinguish it from the hard attention that selected exactly one encoder position per decoding step.

The result was a model that could translate long sentences accurately, and that produced interpretable alignment plots — heatmaps very similar to the one on Jonasz's screen — showing which source words the model attended to when producing each target word. A French word being translated to English concentrated attention on the corresponding French source word. A pronoun resolved its reference by attending to the noun it referred to, several positions back. The model had learned to read the source sentence selectively, rather than trying to memorise it all in one vector.

Three years later, a team at Google Brain took the attention mechanism a step further.[^2] If attention could connect a decoder to an encoder across the two sides of a sequence-to-sequence model, could the same idea connect any position in a sequence to any other position in the same sequence — without an encoder or decoder at all? The paper that answered this question was titled "Attention Is All You Need," presented at NeurIPS 2017 by eight authors including Ashish Vaswani, Noam Shazeer, Niki Parmar, and Jakob Uszkoreit. The transformer architecture they introduced had no recurrent connections, no convolutional layers, and no hidden state propagated from left to right across the sequence. It computed, for each position in the sequence, a weighted combination of all other positions — including positions in the future, subject to masking during training. The mechanism that allowed this was called self-attention.

The scaled dot-product attention at the core of the transformer computes, for each output position, a weighted sum of value vectors, where the weights are derived from the similarity between query and key vectors:

$$\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{Q K^\top}{\sqrt{d_k}}\right) V$$

where:
- $Q \in \mathbb{R}^{n \times d_k}$ = query matrix, one row per output position
- $K \in \mathbb{R}^{m \times d_k}$ = key matrix, one row per input position
- $V \in \mathbb{R}^{m \times d_v}$ = value matrix, one row per input position
- $d_k$ = key and query dimension, used for scaling to prevent the softmax from saturating in high-dimensional spaces
- $n$, $m$ = number of output and input positions respectively

The factor $1/\sqrt{d_k}$ is not aesthetic. Without it, the dot products grow in magnitude with $d_k$, pushing the softmax into regions of near-zero gradient. Vaswani's team found this scaling was necessary to keep training stable.

Multi-head attention runs $h$ independent attention functions in parallel, each with different learned projections, concatenating and projecting their outputs:

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \dots, \text{head}_h)\,W^O$$

where each $\text{head}_i = \text{Attention}(Q W_i^Q,\, K W_i^K,\, V W_i^V)$ with learnable projection matrices $W_i^Q$, $W_i^K$, $W_i^V$, and $W^O$. Different heads learn to attend to different aspects of the sequence simultaneously — one head may track the pressure trend, another the direction backing, another the turbulence regime. The outputs are concatenated and linearly projected back to the model dimension.

The entire computation — across all positions and all heads — is a matrix multiplication and can be parallelised completely. The sequential bottleneck disappears. A 144-step attention computation takes roughly the same wall-clock time as a single-step computation, on modern GPU hardware.

<!-- IMAGE: fig-36-1 -->
> **Figure 36.1** — Scaled Dot-Product Attention: Query, Key, and Value
> **Type:** Schematic diagram
> **Content:** Three vertical arrows on the left labelled Q (queries), K (keys), V (values). Arrows feed into a central box labelled "MatMul + Scale / QKᵀ/√dk". Output of this box feeds into a "Softmax" box. The softmax output (attention weights, shown as a small heatmap with values summing to 1.0) is multiplied with V in a second "MatMul" box. Final output arrow on the right labelled "Attended output". Annotation: "Each row of the attention weight matrix is a probability distribution over input positions."
> **Caption:** Scaled dot-product attention. The query Q and key K matrices produce similarity scores via dot product; the √dk scaling factor prevents softmax saturation in high-dimensional spaces. The resulting attention weights are applied to the value V matrix to produce the attended output.
> **Alt text:** Schematic of query-key-value attention showing matrix multiplication, scaling, softmax, and weighted sum operations.
> **Data source:** Author illustration based on Vaswani et al. (2017)
> **Resolution:** 1200 × 900 px minimum
> **Color notes:** Q in blue, K in green, V in amber; attention weight heatmap in yellow-to-dark-blue colormap

---

## 36.3 The Temporal Fusion Transformer Architecture

The original transformer was designed for sequences of similar tokens — words in a sentence, positions in an image. A wind power forecasting input is something more heterogeneous: static features that never change across time (turbine coordinates, rated power, hub height), past-observed dynamic features that are known only up to the current timestep (measured wind speed, direction, turbulence, power), and future-known inputs that are available for the entire prediction window (NWP forecast fields, time-of-day encodings, season). No architecture designed for uniform sequences handles this gracefully.

Bryan Lim, Sercan Arık, Nicolas Loeff, and Tomas Pfister at Google Cloud AI Research developed the Temporal Fusion Transformer (TFT) specifically to address this mixed-input structure.[^3] First circulated as a preprint in December 2019 and published in the *International Journal of Forecasting* in 2021, the architecture added three components that are absent from the vanilla transformer and essential for time series forecasting.

The first is the Gated Residual Network (GRN). In the standard transformer, inputs pass through a feedforward layer and a residual connection without any learned gating. The GRN adds an explicit gate — a sigmoid-activated linear layer — that controls how much of the feedforward transformation is added to the residual. The gate allows the network to suppress irrelevant transformations entirely, setting the activation toward zero when the input does not require complex non-linear processing. This is important when many features are present but only a few are predictive:

$$\text{GRN}(a) = \text{LayerNorm}\!\left(a + W_1 \cdot \text{ELU}(W_2 a + b_2) \odot \sigma(W_3 a + b_3)\right)$$

where:
- $a \in \mathbb{R}^d$ = input vector
- $W_1, W_2, W_3 \in \mathbb{R}^{d \times d}$ = learned weight matrices
- $b_2, b_3 \in \mathbb{R}^d$ = bias vectors
- $\text{ELU}(\cdot)$ = exponential linear unit activation
- $\sigma(\cdot)$ = sigmoid gating function
- $\odot$ = element-wise multiplication
- $\text{LayerNorm}(\cdot)$ = layer normalisation with learnable scale and shift parameters

The second component is the Variable Selection Network (VSN). Before the sequence enters the temporal attention layers, a separate sub-network learns a probability distribution over the input features — how much each feature contributes to the prediction — and applies soft feature weighting. The VSN outputs, at each timestep, a vector of feature importance weights that sum to 1.0. These weights are learned jointly with the rest of the model during training. At inference time, the VSN's output provides a global feature importance ranking directly comparable to the SHAP importance values from Chapter 34, but derived from the model's forward pass rather than a post-hoc game-theoretic approximation.

The third component is the temporal self-attention decoder. After feature selection and static covariate encoding, the sequence of past observations is encoded by a stack of multi-head self-attention layers — the transformer's standard machinery. The future prediction window is decoded using a causally-masked self-attention that can attend to past observations but not to future ones during training. At each future step, the decoder attends simultaneously to all 144 past steps, producing the bright-cell pattern on Jonasz's screen.

<!-- IMAGE: fig-36-2 -->
> **Figure 36.2** — TFT Architecture Overview
> **Type:** Schematic / block diagram
> **Content:** Left column: three input streams labelled "Static features" (grey block, e.g. turbine location), "Past inputs" (blue block: wind speed, direction, TI, power history), "Future known" (green block: NWP forecast, time encoding). Each stream feeds into a GRN block. Static features feed into a "Static covariate encoder". Past and future inputs feed into a "Variable Selection Network (VSN)" per timestep. VSN output feeds into "LSTM encoder (past)" and "LSTM decoder (future)". These feed into "Multi-head self-attention". Final output feeds into "Gated residual + Add & Norm" and then into "Quantile output heads" (three arrows: P10, P50, P90). Annotation boxes: "GRN gates irrelevant transformations" and "VSN learns which features matter".
> **Caption:** The Temporal Fusion Transformer processes three classes of input (static, past-observed, future-known) through separate encoding pathways before applying multi-head self-attention across the full sequence. Three output heads predict quantiles P10, P50, and P90 simultaneously.
> **Alt text:** Block diagram of TFT architecture showing input streams, GRN, VSN, LSTM encoder-decoder, self-attention layer, and quantile output heads.
> **Data source:** Author illustration based on Lim et al. (2021), Fig. 2
> **Resolution:** 1400 × 1000 px minimum
> **Color notes:** Static features in grey, past inputs in blue, future-known in green, attention layer in amber, output heads in three distinct colours

---

## 36.4 Multi-Horizon Forecasting

The XGBoost and LSTM models in Chapters 34 and 35 produced forecasts for a single target horizon at a time. To generate a 24-hour forecast profile — predictions for every ten-minute step from now until hour 24 — the models were run iteratively: the prediction at $t+1$ was appended to the input features, and the model was re-applied to predict $t+2$, and so on for all 144 steps. This recursive strategy is simple to implement, but it has a well-known failure mode: the model was trained on clean input data, but at inference it receives its own noisy predictions as inputs. Errors accumulate with each step. By step 30 (five hours ahead), the input features include several hours of predictions rather than observations, and the model is operating in a regime it was never trained to handle.

There is an alternative — train a separate model for each horizon, predicting $t+h$ directly from the current observation window without rollout. This avoids error accumulation but requires $H$ independent models and loses the temporal coherence between adjacent horizon predictions (the predicted profile at hour 12 is unrelated to the predicted profile at hours 11 and 13 by construction).

The TFT takes a third approach: multi-horizon forecasting. A single model produces all 144 future predictions simultaneously, from a single forward pass. The decoder attends to the past and, through causal masking (future positions cannot attend to other future positions during training), learns to produce a coherent, jointly-calibrated sequence of predictions. The prediction at hour 12 is computed by the same decoder layer that produces the prediction at hour 1, but with attention weights that reflect the model's assessment of which past timesteps are relevant to a 12-hour-ahead prediction specifically — which, as the heatmap on Jonasz's screen showed, is different from what matters at hour 1.

The practical consequence is that the TFT's 24-hour forecast profile is coherent. If the model predicts a wind ramp beginning at hour 8 with widening uncertainty, the predictions at hours 9, 10, and 11 reflect the same underlying judgment about the atmospheric state — not independent estimates that might contradict each other.

---

## 36.5 Quantile Regression and Calibrated Uncertainty

The MC dropout uncertainty from Chapter 35 was an approximation: activate dropout at inference time, run 100 forward passes, treat the variance of the outputs as an uncertainty estimate. This is theoretically principled — Gal and Ghahramani proved its equivalence to a deep Gaussian process — but it has a practical overhead: 100 forward passes per prediction window, and a calibration that depends on the choice of dropout probability $p$ and number of samples $N_\text{MC}$.

The TFT produces uncertainty estimates directly from a single forward pass, by training with a quantile loss function rather than a mean-squared-error loss. Instead of one output head predicting the conditional mean $\hat{y}_t$, the TFT has three output heads, each trained to predict a different quantile of the conditional distribution of the target.

The loss function for a single quantile $q$ is the pinball (quantile) loss:

$$\mathcal{L}_q(y,\, \hat{y}_q) = \max\!\left[\,q\,(y - \hat{y}_q),\;\; (q-1)\,(y - \hat{y}_q)\,\right]$$

where:
- $q \in (0, 1)$ = the target quantile level (0.10, 0.50, or 0.90 for P10, P50, P90)
- $y$ = observed power [MW]
- $\hat{y}_q$ = predicted quantile value [MW]

The pinball loss is asymmetric by construction: for $q = 0.90$, an underprediction ($y > \hat{y}_{0.90}$) is penalised at rate 0.90 — nine times more heavily than an overprediction penalised at rate 0.10. A model minimising the expected pinball loss at $q = 0.90$ will set its P90 prediction at the level where, on average across the training distribution, 90% of observations fall below it and 10% fall above. Calibration — the property that a stated P90 interval should contain exactly 90% of observations — emerges not from post-hoc adjustment but from the loss function itself.

The total training objective sums pinball losses across all three quantile heads and all 144 future steps simultaneously:

$$\mathcal{L}_\text{total} = \sum_{q \in \{0.10, 0.50, 0.90\}} \sum_{t=1}^{T} \mathcal{L}_q\!\left(y_t,\, \hat{y}_{q,t}\right)$$

where:
- $T = 144$ = number of future timesteps (24 hours at ten-minute resolution)
- $y_t$ = observed power at future step $t$ [MW]
- $\hat{y}_{q,t}$ = predicted quantile $q$ at future step $t$ [MW]

The result is a model that produces P10/P50/P90 intervals whose calibration is a direct consequence of how the model was trained, not of any post-processing or heuristic correction. For operational use, the P10 and P90 intervals have an additional desirable property: the gap between them — the prediction interval width — is narrowest when the model is most certain (stable wind regime, no approaching front) and widest when it is least certain (regime transition, frontal passage). A grid operator scheduling fast-response reserve can read the P90 directly, knowing that it has been trained to contain the outcome in exactly 90% of comparable situations.

<!-- IMAGE: fig-36-3 -->
> **Figure 36.3** — Pinball Loss: Asymmetric Penalisation by Quantile Level
> **Type:** Line chart with annotated regions
> **Content:** X-axis: prediction error (y − ŷ), ranging from −200 MW to +200 MW. Y-axis: loss value. Three curves for q = 0.10 (red, steep on the left/underprediction side), q = 0.50 (grey, symmetric V shape — median regression = MAE), q = 0.90 (blue, steep on the right/underprediction side). Shaded region on right side (y > ŷ) labelled "underprediction — penalised at rate q". Shaded region on left side (y < ŷ) labelled "overprediction — penalised at rate 1−q". Annotation: "For q=0.90: underprediction penalised 9× more than overprediction."
> **Caption:** The pinball loss for three quantile levels. For q=0.90, underprediction is penalised nine times more heavily than overprediction — forcing the P90 head to set predictions high enough that only 10% of observations exceed them.
> **Alt text:** Line chart showing asymmetric pinball loss functions for quantile levels 0.10, 0.50, and 0.90 with annotated penalty regions.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** q=0.10 in red, q=0.50 in grey, q=0.90 in blue; penalty regions lightly shaded in corresponding colours

---

## 36.6 Where the Model Looks: Attention Visualisation

This is the feature that most distinguishes the TFT from any other forecasting model in the current toolkit.

The SHAP values from Chapter 34 answered the question: which features are globally important across the training dataset? The answer — wind_speed_lag1 (38%), wind_dir_sin (14%), turbulence intensity (8%) — confirmed the physical hierarchy that Maja, Morten, and Jonasz had explained independently across three earlier chapters. SHAP is a post-hoc tool: it approximates feature importance by computing marginal contributions averaged over the data.

The MC dropout intervals from Chapter 35 answered a different question: how confident is the model in a specific prediction? The answer — a P90 prediction interval width of ±104 MW at the peak of the frontal passage ramp — provided a calibrated uncertainty estimate, but with no information about why the model was uncertain.

The TFT attention weights answer a third question that neither SHAP nor MC dropout can address: for this specific prediction at this specific future timestep, which past timesteps is the model reading? The answer is the heatmap on Jonasz's screen. It is not averaged across the dataset; it is computed afresh for each individual prediction window.

The multi-head attention layers in the TFT decoder produce, for each forward pass, a matrix of attention weights: one row per future timestep, one column per past timestep, with each entry representing the fraction of "attention capacity" allocated from that future timestep to that past timestep, across all attention heads. The matrix is naturally interpretable as a heatmap: plot it with future timesteps on the y-axis and past timesteps on the x-axis, colour-code by weight value, and read off which parts of the past the model considered relevant for each future prediction.

In a stable wind regime — no frontal passage, no trend reversal — the attention matrix is dominated by the near-diagonal band: the model attends primarily to recent observations, with gradually declining weight as it looks further back. This reflects the atmospheric physics correctly: the state at the previous timestep is the best predictor of the state at the next timestep, and information from 20 hours ago carries little direct relevance when the atmosphere has been in the same regime throughout.

During the frontal passage in November, the attention matrix changes character. For predictions at hours 8 through 14, the near-diagonal band persists, but two off-diagonal clusters appear: one centred around 8 hours before the prediction window opened (when the pressure gradient began its sustained drop), and another around 16 hours before (when the backing wind shift began — southwest to south-southwest). These are the meteorological precursors that characterise an approaching Atlantic frontal system in the southern Baltic. The TFT had not been given barometric pressure as an input feature. It had identified the precursor signature indirectly — through the backing wind direction and the progressive change in turbulence intensity that accompanies a pressure drop — and had learned to attend to the timesteps where this signature was present.

This is interpretability at the operational level. It does not merely say "wind speed matters" — it says "for this prediction, at hour 11, the model is weighting what happened at 02:00 this morning at approximately three times the weight it assigns to what happened at 06:00."

---

## 36.7 Worked Example: Three Models on the 500 MW Reference Farm

**Setup.** The same test partition used in Chapters 34 and 35 is used here: 70% training, 15% validation, 15% test, with TimeSeriesSplit walk-forward validation ensuring no future data leak. The TFT is trained on the same 50,399-record cleaned dataset with the same 18 input features, using a hidden dimension of 128, 4 attention heads, dropout rate 0.1, and quantile outputs at $q \in \{0.10, 0.50, 0.90\}$. The model is trained for 50 epochs with the combined pinball loss, using the Adam optimiser with learning rate 0.001 and cosine annealing.

**Point forecast accuracy.** On the hold-out test partition:

| Model | MAPE (24-hour) | MAPE (6-hour) | MAPE (1-hour) |
|-------|---------------|--------------|--------------|
| Persistence baseline | 11.3% | 6.8% | 2.1% |
| XGBoost (Chapter 34) | 7.4% | 5.7% | 4.1% |
| LSTM MC dropout (Chapter 35) | 6.1% | 4.8% | 3.9% |
| TFT P50 (this chapter) | **5.3%** | **4.1%** | **3.8%** |

The TFT P50 prediction outperforms the LSTM by 0.8 percentage points at 24-hour horizon. The improvement is modest at short horizons (0.1 pp at 1-hour) and grows with forecast distance (0.8 pp at 24-hour), consistent with the expectation that multi-horizon direct forecasting reduces error accumulation relative to recursive prediction.

Converting to economic terms: for the 500 MW reference farm operating at a capacity factor of 45%, a 0.8 percentage-point MAPE improvement at 24-hour horizon corresponds to a reduction in imbalance settlement costs of approximately EUR 3–5M per year, depending on the imbalance price regime (Polish BSPS imbalance market, 2023 reference). Over a 20-year PPA contract, the discounted value of this improvement — relative to LSTM alone, before the ensemble gains of Chapter 37 — is on the order of EUR 40–65M.

**Interval calibration.** The MC dropout 90% prediction interval (Chapter 35) achieved 90.3% empirical coverage on the test set. The TFT P10/P90 interval achieves 89.8% empirical coverage — marginally below target, attributable to slight overconfidence in low-turbulence stable periods. Both models are well-calibrated by any practical standard. The TFT's calibration comes from the pinball loss; the LSTM's from the MC sampling procedure. Their agreement validates the physical claim that both are approximating the same underlying conditional distribution.

**The frontal passage.** The November frontal passage event — wind ramping from 88 to 347 MW in 180 minutes — serves as the diagnostic case. The 6-hour lead-time prediction window opened 6 hours before the ramp's midpoint. Results:

| | TFT | LSTM MC dropout |
|---|---|---|
| First timestep P90 exceeds 200 MW | $t - 4\text{h} 20\text{min}$ | $t - 2\text{h} 40\text{min}$ |
| Width of interval at ramp peak | ±119 MW | ±104 MW |
| P50 point prediction lag (vs observed ramp midpoint) | 35 min | 40 min |
| Precursor timesteps identified | 2 off-diagonal clusters (8 h, 16 h) | N/A (no attention output) |

The TFT's P90 exceeded 200 MW 100 minutes earlier than the LSTM's MC dropout interval — attributable to the model's attention to the meteorological precursors at t−8h and t−16h. Its interval at the ramp peak was slightly wider (±119 MW vs ±104 MW) because the attention mechanism detected the unusual regime and expressed genuine additional uncertainty.

The MAPE improvement of 0.8 percentage points at 24-hour horizon is useful. The 100-minute earlier warning of the ramp event is operationally significant: grid operators in the Polish TSO (PSE) must notify fast-response reserves at least 3 hours in advance. A 4-hour-20-minute early warning comfortably clears this requirement; a 2-hour-40-minute warning does not.

**VSN feature importance.** The Variable Selection Network, averaged across the test set, assigned the following global feature weights:

| Feature | VSN Weight | XGBoost SHAP (Chapter 34) |
|---------|-----------|--------------------------|
| wind_speed (NWP) | 31% | 38% (wind_speed_lag1) |
| wind_dir_sin | 18% | 14% |
| turbulence_intensity | 12% | 8% |
| wind_speed_lag6 | 9% | 11% (lag6) |
| pressure_tendency (NWP gradient) | 7% | — (not in XGBoost top-5) |
| wind_speed_lag12 | 6% | 8% (lag12) |
| Other features | 17% | 21% |

The VSN and SHAP rankings are broadly consistent — wind speed and direction dominate, turbulence intensity is third — but diverge at positions 4 and 5. The TFT assigned 7% weight to the NWP pressure tendency gradient, which did not appear in XGBoost's top features. The frontal passage analysis suggests this is not noise: pressure tendency is a direct barometric precursor, and the TFT's attention mechanism learned to use it. The XGBoost SHAP analysis, which averaged across all regimes, underweighted it.

The model rediscovered the meteorologist's hierarchy — wind speed, direction, turbulence, pressure tendency — from data alone. "The same hierarchy Maja described on the met mast platform," Kaan had written in his notebook at the end of Chapter 34. He wrote it again at the end of Chapter 36, and added: *this time, the model also identified the precursor that Maja didn't mention, because it's only useful when a front is actually approaching.*

## Key Takeaways

- **Attention removes the sequential bottleneck:** unlike LSTM, which compresses all historical information into a fixed-size hidden state, the TFT directly attends to any past timestep for each future prediction — the attention weight matrix shows which past moments the model is reading, for each future horizon.
- **The TFT is designed for mixed-input forecasting:** static features (turbine geometry), past-observed inputs (measured power, wind), and future-known inputs (NWP forecasts, time encodings) are handled by separate encoding pathways before entering the attention layers — addressing the heterogeneous-input structure that vanilla transformers cannot handle.
- **Quantile regression provides honest, single-pass uncertainty:** training with the pinball loss forces the model to produce P10/P50/P90 outputs whose coverage is a direct consequence of the loss function, not of post-hoc calibration or MC sampling overhead.
- **Attention visualisation is operational intelligence:** the attention heatmap for an approaching frontal passage reveals which meteorological precursors (pressure tendency 8 hours prior, direction backing 16 hours prior) the model identified as predictive — information that neither SHAP nor MC dropout can provide.
- **Marginal improvement, significant operational consequence:** the 0.8 percentage-point MAPE gain over LSTM at 24-hour horizon is modest in aggregate (EUR 40–65M over 20 years), but the 100-minute earlier ramp warning that enabled grid-code-compliant reserve scheduling is a qualitatively different capability with an operational consequence that a percentage point alone does not capture.

## For Further Reading

- **Lim, B., Arık, S. Ö., Loeff, N., & Pfister, T. (2021).** "Temporal Fusion Transformers for Interpretable Multi-horizon Time Series Forecasting." *International Journal of Forecasting*, 37(4), 1748–1764. DOI: 10.1016/j.ijforecast.2021.03.012. The primary reference. Section 4 describes the GRN and VSN components in detail. Appendix A contains benchmark results across 21 datasets spanning traffic, retail, energy, and finance. The architecture section includes PyTorch pseudocode for each sub-component.

- **Vaswani, A., Shazeer, N., Parmar, N., et al. (2017).** "Attention Is All You Need." *Advances in Neural Information Processing Systems*, 30. arXiv: 1706.03762. The foundational transformer paper. Section 3.2 derives the $1/\sqrt{d_k}$ scaling argument. Section 3.3 describes multi-head attention. The paper's introduction motivates the architecture purely from the goal of parallelising sequence computation — accuracy improvements were observed but not the primary design objective. Essential background for anyone working with transformer-based forecasting architectures.

- **Salinas, D., Flunkert, V., Gasthaus, J., & Januschowski, T. (2020).** "DeepAR: Probabilistic Forecasting with Autoregressive Recurrent Networks." *International Journal of Forecasting*, 36(3), 1181–1191. DOI: 10.1016/j.ijforecast.2019.07.001. Amazon's production forecasting architecture, which combines autoregressive LSTM with a learned output distribution (Gaussian or negative binomial). A useful comparison to TFT's quantile regression approach: DeepAR learns the distribution parameters; TFT directly regresses quantiles. For wind applications, TFT's pinball loss is generally preferred because wind power near rated capacity exhibits non-Gaussian distributions that DeepAR's Gaussian output head cannot capture.

---

*Jonasz closed the attention heatmap at 16:40 and opened a new notebook. The tab read `07_ensemble_v01.ipynb`.*

*"You have three models," he said. He had not looked at the wall clock — Kaan had noticed this pattern across four days, that Jonasz ended sessions by the state of his screen rather than by the time. "XGBoost, which is fast and interpretable, built on decision trees, and does not care about sequence structure. LSTM, which has memory, which learned that the sequence has structure, which knows when it doesn't know. TFT, which reads the sequence rather than memorising it, which sees the atmospheric precursors eight hours before the event, which provides direct quantile intervals."*

*"Each of them is wrong differently," Kaan said. He had learned, across four days, that this was the kind of answer Jonasz was looking for.*

*"Yes. And because they are wrong differently, when you combine them, their errors cancel in ways that no individual model can achieve alone. Tomorrow I will show you the ensemble. And I will show you one other thing — the ramp detection threshold, which is the piece of this system that actually matters to the operator at 03:00 on a Tuesday when a front is approaching from the southwest and reserve margins are thin." He saved the notebook. "After that, the forecasting work is done. And Kaan can go back to the part of the building where the electricity is."*

*Kaan saved his own notes and walked back through the windowless corridor toward the OSS control room. Outside — somewhere, in the dark above the Baltic — the wind had been backing all afternoon. The barometric pressure had been dropping since 14:00. The SCADA system had logged both facts. The TFT had logged them differently: as bright cells in the attention matrix, concentrated in the columns that corresponded to the early hours of the afternoon, already influencing the predictions it would make tomorrow morning about the wind it would see tomorrow night.*

*He thought about what Jonasz had said at the beginning of the week: data is the ingredient, the model is the recipe. He thought about what he had watched the TFT do, and he revised the metaphor slightly. The data was the ingredient. The recipe had learned, from ten thousand previous meals, which spices were worth tasting before you started cooking.*

---

## Notes

[^1]: Bahdanau, D., Cho, K., & Bengio, Y. (2015). "Neural Machine Translation by Jointly Learning to Align and Translate." Proceedings of the 3rd International Conference on Learning Representations (ICLR 2015). arXiv: 1409.0473. The paper introduced soft attention as a solution to the encoder context-vector bottleneck in sequence-to-sequence neural machine translation. Section 3.1 describes the alignment model (a small feedforward network that scores each encoder hidden state against the current decoder state). The resulting alignment plots — showing which source words the model attended to when producing each target word — were among the first attention visualisations to be published and directly influenced the interpretable attention approach later used in the TFT. Bahdanau is currently a Research Director at Apple; Cho (the GRU inventor) is at New York University; Bengio remains at Mila, Université de Montréal.

[^2]: Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). "Attention Is All You Need." Advances in Neural Information Processing Systems (NeurIPS), 30, 5998–6008. Long Beach, California, December 4–9, 2017. arXiv: 1706.03762. All eight authors contributed equally (author order was randomised). The transformer architecture was originally designed to speed up machine translation training by eliminating the sequential dependency of RNNs — the accuracy gains were substantial but secondary to the parallelisation motivation. The paper introduced scaled dot-product attention, multi-head attention, positional encoding, and the full encoder-decoder transformer stack. Its citation count exceeded 150,000 by 2025, making it one of the most cited papers in the history of computer science. The architecture subsequently became the foundation for large language models (BERT, GPT, and their successors), protein structure prediction (AlphaFold 2), image generation, and time series forecasting — none of which the original paper anticipated.

[^3]: Lim, B., Arık, S. Ö., Loeff, N., & Pfister, T. (2021). "Temporal Fusion Transformers for Interpretable Multi-horizon Time Series Forecasting." International Journal of Forecasting, 37(4), 1748–1764. DOI: 10.1016/j.ijforecast.2021.03.012. arXiv: 1912.09363 (v3 revised September 2020). Work conducted at Google Cloud AI Research, Mountain View, California. The paper includes benchmark results on 21 real-world datasets, with TFT outperforming LSTMs and convolutional architectures on 17 of 21 datasets by MSE, and on 16 of 21 by mean absolute error. Section 4.4 describes the Gated Residual Network; Section 4.2 describes the Variable Selection Network; Appendix B provides ablation studies confirming that each sub-component contributes positively to benchmark performance. The attention visualisation methodology (Section 5.2) was applied to a retail sales forecasting dataset in the paper; its application to energy systems forecasting follows the same principles. An open-source implementation is available via the PyTorch Forecasting library.

[^4]: Salinas, D., Flunkert, V., Gasthaus, J., & Januschowski, T. (2020). "DeepAR: Probabilistic Forecasting with Autoregressive Recurrent Networks." International Journal of Forecasting, 36(3), 1181–1191. DOI: 10.1016/j.ijforecast.2019.07.001. Developed at Amazon AI, this architecture was the first widely-deployed probabilistic forecasting model in production retail demand forecasting. The autoregressive LSTM backbone produces distribution parameters (mean and standard deviation for Gaussian output; mean and dispersion for negative binomial) at each step, trained with a maximum likelihood objective. The key difference from TFT's quantile approach is that DeepAR learns a parametric distribution, requiring the practitioner to choose the distribution family; TFT's pinball loss is distribution-free. For heavy-tailed distributions such as wind power near rated capacity, distribution-free quantile regression is generally more robust.

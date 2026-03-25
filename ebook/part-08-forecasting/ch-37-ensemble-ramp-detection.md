# Chapter 37: Ensemble, Ramp Detection, and the Art of Being Useful

*When Kaan arrived Friday morning, Jonasz was not looking at a notebook. He was looking at a weather chart.*

*The chart filled the left monitor: a synoptic pressure map of the southern Baltic Sea, time-stepped to the current hour and projected forward in six-hour increments. A band of tightly packed isobars — the signature of a pressure gradient, wind concentrated between a blocking high over Scandinavia and a low over Denmark — was moving east-northeast. At its leading edge, drawn in a faint dotted line, was the frontal boundary.*

*Kaan looked at it. Then at the ETA timestamp in the lower corner of the chart. Six hours.*

*"It will arrive at approximately 15:00," Jonasz said, without turning around. On the right monitor, the ensemble notebook was open. The first cell had already run: the three individual model predictions and the combined ensemble output were visible, printed to four decimal places, for every hour of the next 72. "The NWP is showing a drop of 38 percent of rated capacity in a 25-minute window beginning at approximately 15:20. The individual models have different views of the magnitude. The ensemble has a different view again." He turned. His thermos was on the desk. "I want you to watch the event happen. Not from memory, later. Now, in real time, from this room and then from the control room. So you can see what the forecast was and what the sky did."*

*Kaan set his coffee down and looked at the notebook output. Three columns for three models. A fourth column, weighted. And a fifth column, below a horizontal rule, labelled P10 and P90.*

*"The P10 at t plus four hours," Jonasz said. He pointed. "188 megawatts. That is thirty-seven percent of rated capacity. Our alert threshold is forty percent — 204 megawatts. We crossed it forty-two seconds ago. The automated alert has already gone to PSE Warsaw."*

*He pulled up a second tab. Outbound IEC 60870-5-104 message log. Timestamp 09:58:17. Status: DELIVERED. Destination: PROT-PSE-WAW-01.*

*"This morning," Jonasz said, "we have a deadline."*

---

## 37.1 The Wisdom of Different Mistakes

In 1906, the city of Plymouth hosted the West of England Fat Stock and Poultry Exhibition. Among the attractions was a weight-guessing contest: an ox, to be slaughtered and dressed, and a prize for the person who came closest to guessing the final weight. The entry fee was sixpence, which kept out casual guessers and attracted serious competitors. About 800 people submitted their estimates on printed tickets. Many had professional expertise in animal weight — butchers, farmers, livestock handlers. Many did not.

Francis Galton, the statistician and polymath, obtained the 787 eligible tickets after the contest and analysed them. He was interested in whether popular judgement was trustworthy — and he expected to find that it was not. The result surprised him. The median estimate was 1,207 pounds. The actual dressed weight was 1,198 pounds. The crowd, in aggregate, was within 0.8% of the correct answer. No single individual submitted 1,198. No individual would have been expected to. But the errors, distributed across 787 guesses, were not all in the same direction — some guessed high, some low, some had systematic biases rooted in their particular experience — and when combined, those errors cancelled.[^1]

This is the ensemble principle, stated at Plymouth in 1906 and rediscovered in every forecasting discipline since.

The XGBoost model built in Chapter 34 is very good at identifying which features matter most at any given time and hour. Its errors are structural: because it treats each timestep independently, it cannot learn that wind speed at hour *n* is predictive of ramp behaviour at hour *n*+4. It also cannot propagate uncertainty through a temporal sequence. It guesses the same way every time, regardless of whether the recent sequence was unusual.

The LSTM built in Chapter 35 is very good at learning temporal dependencies. Its errors are different: because it compresses all history into a fixed-size hidden state, it sometimes loses the memory of events that occurred beyond its effective recall horizon. Its uncertainty — expressed through MC dropout — is calibrated, but it cannot distinguish *which past moments* are currently most relevant; it treats all history with approximately equal weight once the cell state has been updated.

The TFT built in Chapter 36 is very good at reading relevant past timesteps, but because it is the most complex model, it is the most sensitive to training data distribution. On an unusual event — a meteorological configuration the training set rarely saw — the TFT's attention mechanism may focus on the wrong past timesteps.

None of these failure modes are correlated. An event that misleads XGBoost (because recent feature values are misleading) may not mislead the LSTM (which has temporal context). An event that misleads the LSTM (because the history is structurally similar to a different meteorological regime) may not mislead the TFT (which attends selectively to the relevant past). When three models make uncorrelated errors, their combined prediction has lower variance than any individual model — not by being right where they are wrong, but by having different wrongs that partially cancel.

This is the ensemble principle in the language of bias and variance. The ensemble mean:

$$
\hat{y}_{\text{ens}}(h) = \sum_{k=1}^{K} w_k(h) \cdot \hat{y}_k(h)
$$

where:
- $\hat{y}_k(h)$ = predicted power from model $k$ at horizon $h$ [MW]
- $w_k(h)$ = weight assigned to model $k$ at horizon $h$ [-], with $\sum_k w_k(h) = 1$
- $K$ = number of models [-]

The weights $w_k(h)$ are not equal. They are horizon-dependent. That is the subject of the next section.

David Wolpert formalised the combination of multiple learned models in 1992, in a paper called "Stacked Generalization."[^2] Wolpert's idea was that the ensemble itself could be a learned model — a meta-learner trained on the outputs of the base models — rather than a fixed weighting scheme. The practical difference is that simple weighted averaging requires only a held-out validation set to calibrate weights; stacking requires a second-level model and is prone to its own overfitting. For wind power forecasting with three base models and a 14-month training set, the computational overhead of stacking is rarely justified. Horizon-dependent weighted averaging is sufficient.

<!-- IMAGE: fig-37-1 -->
> **Figure 37.1** — Ensemble Construction: Three Base Models Combined with Horizon-Dependent Weights
> **Type:** Schematic / architecture diagram
> **Content:** Three parallel model towers (XGBoost, LSTM, TFT), each producing a P50 output at each horizon. The outputs feed into a weight matrix W(h) — a heat map of weight vs. model vs. horizon — and combine into an ensemble P50 output. A separate quantile layer produces P10 and P90 from the spread of individual model predictions plus empirical residuals.
> **Caption:** The ensemble combines three models whose errors are structurally different. The weight matrix W(h) is trained on a held-out validation year, separately for each forecast horizon, so that XGBoost receives higher weight at short horizons and TFT at long horizons.
> **Alt text:** Architectural diagram showing three model streams flowing into a weighted combination stage producing a probabilistic ensemble output with P10, P50, and P90 quantiles.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** XGBoost in amber, LSTM in blue, TFT in green, ensemble output in deep navy

---

## 37.2 Horizon-Dependent Weights

Not all models are equally useful at all horizons. The weight matrix $w_k(h)$ captures this empirically: trained on a held-out validation year by minimising the mean absolute error of the ensemble across 8,760 prediction windows.

$$
\mathbf{w}^*(h) = \argmin_{\mathbf{w}(h) \in \Delta^K} \frac{1}{N}\sum_{t=1}^{N} \left| y_t(h) - \sum_{k=1}^{K} w_k(h) \cdot \hat{y}_{k,t}(h) \right|
$$

where:
- $\mathbf{w}(h)$ = weight vector at horizon $h$ [-], constrained to the probability simplex $\Delta^K$
- $y_t(h)$ = actual power at time $t+h$ [MW]
- $\hat{y}_{k,t}(h)$ = prediction of model $k$ at time $t$ for horizon $h$ [MW]
- $N$ = number of validation windows [-]

The result of this optimisation, applied to the reference farm's validation year, follows the pattern that intuition suggests — and that has been reproduced consistently across multiple offshore wind datasets.

At **short horizons** (0–4 hours), XGBoost receives the highest weight — typically 40–50%. The meteorological features available in the most recent SCADA data are highly predictive at short range: current wind speed, nacelle direction, turbulence intensity. Temporal history adds relatively little once those features are observed. The LSTM and TFT — which are trained to model sequences — tend to fit the training regime more carefully than the current regime and can be over-confident about mean-reversion at times when the atmosphere is actually changing regime.

At **medium horizons** (4–12 hours), the weight shifts toward LSTM and TFT. At these ranges, the most recent feature values become stale — a reading at hub height four hours ago tells you little about conditions four hours hence if a front is approaching. The temporal sequence and the NWP forecast inputs become dominant. LSTM's cell state begins to carry information about the current atmospheric trend; TFT's attention mechanism begins to identify which past features are precursors of what is coming.

At **long horizons** (12–72 hours), TFT dominates — typically 50–60% weight. The NWP forecast inputs, which TFT handles through its known-future input pathway, are the primary information source. The LSTM's fixed hidden state, compressed from all preceding history, begins to lose precision about the physical conditions that will govern the prediction window. XGBoost's weight falls to near zero: its features have no direct connection to conditions 48 hours hence.

The horizon-dependent weight table for the reference farm, trained on the validation year, looks approximately as follows:

| Horizon | XGBoost weight | LSTM weight | TFT weight |
|---------|---------------|------------|-----------|
| 0–4 h   | 0.45          | 0.30       | 0.25      |
| 4–12 h  | 0.20          | 0.45       | 0.35      |
| 12–24 h | 0.10          | 0.30       | 0.60      |
| 24–72 h | 0.05          | 0.20       | 0.75      |

The result is an ensemble that achieves a MAPE of 4.9% on the held-out test year — compared to XGBoost at 7.4%, LSTM at 6.1%, and TFT at 5.3%. The improvement over the best individual model (TFT) is modest: 0.4 percentage points. But the ensemble's probabilistic intervals are better calibrated than any individual model's output, and the coverage of the actual observations within the P10–P90 band is 91.2% — within 1.2 percentage points of the target 90% coverage.

"The individual models compete," Jonasz said. "The ensemble cooperates. It does not win by being smarter than the best model. It wins by being more reliably right than any model is consistently right alone."

---

## 37.3 Ramp Events: What Happens at 03:00 on a Tuesday

On the evening of 26 February 2008, ERCOT — the Electricity Reliability Council of Texas — entered an emergency that had never happened before in that grid's history. Wind generation in West Texas, which had been running at approximately 2,650 MW in mid-morning, underwent a sustained down-ramp through the afternoon. The ramp rate after 14:00 accelerated to roughly 400 MW per hour. As the wind fell and the evening demand peaked, the reserve margin collapsed. ERCOT activated the Emergency Energy Conservation Program. The average emergency load response — industrial customers instructed to curtail consumption immediately — was 1,137 MW. The programme lasted approximately 3.5 hours.[^3]

There were no turbine faults. No transmission lines tripped. The generation was doing exactly what the wind told it to do. The problem was that no one had told the grid it was coming.

A ramp event is defined as a rapid, sustained change in power output that exceeds a threshold fraction of rated capacity within a defined time window. The most commonly used definition — adopted by ENTSO-E and the IEA Wind Task 36 — is a change of 25% or more of rated capacity within 30 minutes, or 50% within 60 minutes. For a 510 MW farm, the 30-minute threshold is 127.5 MW. That is approximately what Jonasz was expecting today.

$$
R(t, \Delta t) = P(t) - P(t - \Delta t)
$$

where:
- $R(t, \Delta t)$ = ramp magnitude at time $t$ over window $\Delta t$ [MW]
- $P(t)$ = farm output at time $t$ [MW]
- $\Delta t$ = ramp window duration [min or h]

The sign convention: positive $R$ is an upward ramp (generation increasing); negative $R$ is a downward ramp. From a grid stability perspective, downward ramps are the more operationally consequential: an unexpected upward ramp can be accommodated by backing off thermal generation, which is a routine operation. An unexpected downward ramp requires additional generation to appear — which, at short notice, means either fast-start peakers, demand response, or emergency interconnection use.

The grid code consequence flows directly from this asymmetry. PSE's national grid operating procedure requires advance notification of expected generation changes exceeding 10% of rated capacity per 15-minute interval. For a 510 MW farm, that is 51 MW every 15 minutes — a threshold that a ramp event at 400 MW/h will breach in approximately 2 minutes. The notification must precede the event by at least three hours for PSE to pre-position spinning reserves without emergency cost penalties.

This is the operating constraint that makes ramp detection, and not mean-error minimisation, the true measure of whether a forecasting system is useful. A model with a MAPE of 3% that systematically misses ramp events is worth less — at the operating level — than a model with a MAPE of 6% that reliably signals every ramp 3.5 hours in advance.

Jonasz had understood this at ECMWF. The European Centre for Medium-Range Weather Forecasts launched its Ensemble Prediction System on 23 November 1992 — the same year that the US National Centers for Environmental Prediction launched theirs.[^4] The weather ensemble was not designed to improve the average forecast; it was designed to identify the occasions on which a single deterministic forecast was unreliable. The primary product was not the mean but the spread. A narrow spread meant the atmosphere was predictable; a wide spread meant the forecast was uncertain and the meteorologist should assign probability to multiple outcomes. The operational value was not accuracy — it was the honest quantification of ignorance.

"That is what the P10 and P90 give us," Jonasz said. "Not 'here is what will happen.' But: 'here is the range within which we are 80% confident the truth will lie.' An operator who knows the lower bound can make a rational decision about reserves. An operator who is given only a single number — even a very accurate single number — has no basis for that decision. They are guessing at the uncertainty."

<!-- IMAGE: fig-37-2 -->
> **Figure 37.2** — Ramp Event Taxonomy: Downward Ramp vs. Grid Reserve Response
> **Type:** Two-panel time series chart
> **Content:** Left panel: farm power output showing a 30-minute downward ramp from 420 MW to 280 MW (-27% Pn), with the ramp threshold (127.5 MW / 25% Pn) marked as a horizontal dashed line. Right panel: PSE reserve activation timeline showing the advance alert, spinning reserve pre-positioning, and actual reserve dispatch if alert is received 3h ahead vs. not received.
> **Caption:** A downward ramp of 25% rated capacity in 30 minutes requires 127.5 MW of reserve activation within PSE's 3-hour pre-notification window. Advance warning converts an emergency event into a planned reserve dispatch at a fraction of the cost.
> **Alt text:** Two time-series charts comparing farm power ramp trajectory and PSE reserve response with and without advance forecasting alert.
> **Data source:** Author illustration
> **Resolution:** 1200 × 600 px minimum
> **Color notes:** Farm power in blue, ramp threshold in dashed red, reserve pre-positioning in green, emergency activation in red

---

## 37.4 Probabilistic Ramp Detection

The key insight in probabilistic ramp detection is that the alert does not come from the P50 forecast. It comes from the tails.

When a downward ramp is possible — when the atmosphere is in a regime where a significant power reduction is consistent with the NWP inputs and the recent turbine data — the ensemble's probability distribution widens and its lower quantile falls. The P50 may still be high (because the most likely scenario is that the ramp is modest). But the P10 — the 10th percentile, the level below which the actual output will fall with 10% probability — will drop sharply.

The ramp alert logic uses this directly:

$$
\text{Alert}(h) = \mathbf{1}\!\left[\hat{P}_{10}(t+h) \leq \theta_{\text{ramp}} \cdot P_n\right]
$$

where:
- $\hat{P}_{10}(t+h)$ = ensemble 10th-percentile forecast at horizon $h$ [MW]
- $\theta_{\text{ramp}}$ = alert threshold as a fraction of rated capacity [-]
- $P_n$ = rated capacity of the farm [MW]
- $\mathbf{1}[\cdot]$ = indicator function that returns 1 if the condition is met, 0 otherwise

The threshold $\theta_{\text{ramp}}$ is an operating point decision — not a physical property of the atmosphere. Setting it low (say 30% of rated) reduces false alarms but increases missed events; setting it high (say 50%) increases alerts at the cost of more unnecessary reserve activations. The correct value depends on the economic ratio of false-alarm cost to missed-alert cost, and on the relative frequency of ramp events in the local climate.

For the reference farm, operating under PSE's two-price balancing mechanism, the false-alarm cost is the difference between the planned reserve activation cost (approximately €35/MWh for spinning reserves pre-positioned 3 hours in advance) and the avoided emergency reserve cost (approximately €220/MWh for short-notice balancing market activation). A threshold of 40% of rated capacity — tested against the validation year's ramp event catalogue — gave the best trade-off between false-alarm rate and missed-ramp rate on this farm and this grid connection.

Threshold calibration uses a receiver operating characteristic (ROC) curve: for every candidate threshold $\theta$, compute the fraction of actual ramp events that were correctly predicted (true positive rate) and the fraction of non-events that triggered false alerts (false positive rate). The optimal operating point is determined by the relative cost of the two error types and the base rate of ramp events in the local climate. At this site — approximately 18 ramp events per year meeting the 25%-Pn-in-30-minute definition — the 40% threshold produced a true positive rate of 94% and a false positive rate of 12%.

Once the alert triggers, the IEC 60870-5-104 link — discussed in Chapter 30 — carries the notification automatically. The message structure follows the PSE-mandated format: plant ID, expected nadir power, expected nadir timestamp, confidence interval width. The delivery confirmation appears in the outbound message log within milliseconds of the threshold crossing. Piotr Zawadzki, or whoever holds the duty operator role at PSE Warsaw, receives the alert on the Energy Management System display. From that moment, PSE has the information it needs to begin reserve pre-positioning.

---

## 37.5 Metrics: Measuring What We Claim to Measure

Four years at ECMWF gave Jonasz a strong opinion about forecast metrics. He held it calmly, but he held it.

"Most people use MAPE," he said. "It is a ratio. Absolute error divided by actual value. The problem is that near zero — near cut-in wind speed, at 2 AM in July — the actual value is zero or nearly zero, and dividing by it produces a number that is not informative but is very large. A model that predicts 5 MW when the farm is producing 0.3 MW has a MAPE of 1,567%. A model that predicts 240 MW when the farm is producing 510 MW has a MAPE of 53%. The second error is six times larger in absolute terms. MAPE thinks the first is thirty times worse."

The standard metric for wind power forecasting — adopted by the IEA Wind Task 36 technical report and the majority of published evaluation studies — is the Normalised Root Mean Square Error (NRMSE), where the normalisation is by rated capacity rather than by actual output:

$$
\text{NRMSE} = \frac{1}{P_n}\sqrt{\frac{1}{N}\sum_{i=1}^{N}\!\left(y_i - \hat{y}_i\right)^2}
$$

where:
- $P_n$ = rated capacity [MW]
- $y_i$ = actual power at sample $i$ [MW]
- $\hat{y}_i$ = forecast power at sample $i$ [MW]
- $N$ = number of evaluation samples [-]

The NRMSE weights large errors quadratically, which gives ramp events — the occasions when the forecast is furthest from reality — their appropriate prominence. A forecasting system that is excellent on typical conditions but poor on ramp events will show a higher NRMSE than one that is uniformly adequate, which is the correct ranking from the perspective of grid operations.

For probabilistic forecasts — the P10/P90 intervals produced by the ensemble — the correct metric is the **pinball loss** (also called the quantile loss), which measures whether the forecast quantile is correctly calibrated:

$$
\text{QL}_q(y,\,\hat{q}) =
\begin{cases}
q\,\bigl(y - \hat{q}\bigr) & \text{if } y \geq \hat{q} \\
(1-q)\,\bigl(\hat{q} - y\bigr) & \text{if } y < \hat{q}
\end{cases}
$$

where:
- $q$ = target quantile level [-] (e.g. 0.10 for P10, 0.90 for P90)
- $y$ = actual outcome [MW]
- $\hat{q}$ = forecast quantile at level $q$ [MW]

The pinball loss is asymmetric by design: for the P90 ($q = 0.90$), underprediction (actual exceeding the forecast upper bound) is penalised nine times more heavily than overprediction. A forecast quantile that is correctly calibrated will minimise the expected pinball loss. This property means that a model trained with the pinball loss — as the TFT's quantile heads were — produces calibrated intervals by construction.

The complement of the pinball loss is the **reliability diagram**: a visual check that plots the nominal coverage level on the x-axis against the empirically observed coverage on the y-axis. A perfectly calibrated ensemble falls on the 45° diagonal. Overconfident ensembles (too narrow intervals) fall below the diagonal; underconfident ones (too wide intervals) fall above it. For the reference farm's ensemble, the reliability diagram showed near-perfect calibration between P15 and P85, with slight overconfidence at P5 and P95 — a common pattern when training data undersample extreme weather events.

---

## 37.6 Worked Example: The Frontal Passage

**09:58, OSS data analytics lab. Farm output: 412 MW.**

The European Centre for Medium-Range Weather Forecasts 00:00 UTC analysis, ingested at 06:30, showed the cold front at 55.2°N, 12.8°E — advancing north-northeast at approximately 25 km/h. Hub-height wind: currently 13.2 m/s from the south-southwest. The frontal zone was forecast to produce a rapid wind direction shift (south-southwest to northwest) and a reduction in geostrophic wind speed as the front passed. Post-frontal wind: 8.4 m/s, from the northwest.

The three individual models, run at 09:45, produced the following P50 predictions for t+4h (13:45):

| Model     | P50 at t+4h | Notes |
|-----------|-------------|-------|
| XGBoost   | 368 MW      | Anchored to current high output; cannot model regime shift |
| LSTM      | 312 MW      | Detects trend from recent turbulence data; underestimates rate |
| TFT       | 268 MW      | Attends to pressure tendency at t−8h and direction backing at t−16h |

Ensemble P50, with horizon-appropriate weights (0.45 XGB, 0.30 LSTM, 0.25 TFT at h=4h):

$$
\hat{y}_{\text{ens}}(4\text{h}) = 0.45 \times 368 + 0.30 \times 312 + 0.25 \times 268 = 165.6 + 93.6 + 67.0 = 326 \text{ MW}
$$

Ensemble P10, computed from the empirical spread of model residuals on the validation year plus MC-dropout uncertainty from the LSTM:

$$
\hat{P}_{10}(4\text{h}) = 188 \text{ MW}
$$

**Alert condition:** $188 \leq 0.40 \times 510 = 204$. Alert triggered.

At 09:58:17, the IEC 104 outbound message was delivered to PSE Warsaw.

**10:47.** Piotr Zawadzki called back on the designated grid operations line. "Confirmed receipt. We are pre-positioning 150 megawatts of spinning reserve in the eastern zone. If the ramp is slower than forecast, no action required. If it meets or exceeds the P10 scenario, we have cover." Pause. "The three-hour window is sufficient." He hung up. As usual, without editorialising.

**15:22.** Farm output: 412 MW. Wind direction at hub height: 195° (south-southwest). All 34 turbines in rated operation, blades at optimum pitch.

**15:24.** Wind direction shift detected at WTG-01: 215°. Two minutes later, at WTG-09. The nacelles began yawing. As they yawed, rotor efficiency dropped — the $\cos^3$ relationship discussed in Chapter 6. Power began falling.

**15:40.** Farm output: 281 MW. Rate of change across the 18-minute window: $412 - 281 = 131$ MW, which was $131 / 510 = 25.7\%$ of rated capacity in $18$ minutes. A ramp event by definition.

**Model performance on this event:**

| Model     | Predicted P50 at t+4h | Actual at 15:40 | Absolute error |
|-----------|----------------------|-----------------|----------------|
| XGBoost   | 368 MW               | 281 MW          | 87 MW (17.1% Pn) |
| LSTM      | 312 MW               | 281 MW          | 31 MW (6.1% Pn) |
| TFT       | 268 MW               | 281 MW          | 13 MW (2.5% Pn) |
| **Ensemble** | **326 MW**        | **281 MW**      | **45 MW (8.8% Pn)** |

The TFT was the most accurate individual model on this event — it had read the pressure and direction precursors correctly, as Jonasz had shown the previous day. The ensemble was not. It was dragged upward by the XGBoost weight at h=4h. That is the honest result: on this event, on this day, the ensemble P50 performed worse than the TFT alone.

"This happens," Jonasz said. He had said nothing while Kaan stared at the table. "On specific events, a single model will outperform the ensemble. The TFT today. XGBoost during summer high-pressure periods, when the atmosphere is stable and there is no frontal dynamic. The ensemble does not win on every event. It wins on average, because across 8,760 hours per year, the situations that favour XGBoost and the situations that favour TFT are not the same situations. The weights distribute the risk. That is different from always being right."

The calibration told a different story. The actual output of 281 MW fell between the ensemble P10 (188 MW) and P90 (432 MW). That was expected — the actual should fall within the 80% interval on approximately 80% of occasions. But the alert was the thing that mattered.

**Economic consequence:**

Without the alert, PSE's standard operating assumption would have been continued output near 412 MW. At 15:40, 131 MW of unscheduled generation shortfall would have appeared. PSE would have had to activate balancing market reserves on a 15-minute notice — at the balancing market spot price for that hour and season.

$$
C_{\text{avoided}} = \Delta P_{\text{ramp}} \cdot \Delta t_{\text{reserve}} \cdot \Delta c_{\text{imb}}
$$

where:
- $\Delta P_{\text{ramp}} = 131$ MW = unplanned shortfall [MW]
- $\Delta t_{\text{reserve}} = 0.75$ h = reserve period (until adjacent unit ramped up) [h]
- $\Delta c_{\text{imb}} = 220 - 35 = 185$ €/MWh = difference between emergency balancing price and pre-positioned spinning reserve price [€/MWh]

$$
C_{\text{avoided}} = 131 \times 0.75 \times 185 = \text{€}18{,}184
$$

For a single ramp event of moderate severity on a non-peak hour. Across the 18 ramp events per year that meet the alert threshold — with varying severity, hour, and season — the annual avoided imbalance cost was approximately €320,000. Over the farm's 20-year design life: approximately €6.4 million. Against the total capital expenditure of €1,479 million, the forecasting system's operational value is modest in absolute terms. Against the cost of the forecasting infrastructure itself — which amounts to a few data scientist-years of work and standard cloud compute — it is substantial.

<!-- IMAGE: fig-37-3 -->
> **Figure 37.3** — Ramp Event: Forecast vs. Actual Power (15:00–16:30) and Ensemble Uncertainty Band
> **Type:** Time-series chart with shaded confidence band
> **Content:** Farm output (solid blue line) showing the 131 MW ramp from 15:22 to 15:40 and recovery beginning at 16:10. Ensemble P50 forecast (dashed navy), P10 lower bound (shaded light blue region), P90 upper bound (shaded light grey). Ramp alert timestamp (09:58) marked with vertical dashed line. PSE confirmation (10:47) marked. Ramp event window (15:22–15:40) highlighted in a soft amber rectangle.
> **Caption:** The ensemble P50 forecast (326 MW) was less accurate than the TFT alone (268 MW) on this event. However, the ensemble P10 (188 MW) triggered the alert 5.5 hours before the ramp onset — providing PSE with more than the required 3-hour reserve pre-positioning window.
> **Alt text:** Time-series chart of farm power output with ensemble forecast bands. Ramp event visible as steep power drop at 15:22. Forecast alert timestamp and actual ramp window highlighted.
> **Data source:** Author illustration
> **Resolution:** 1400 × 700 px minimum
> **Color notes:** Actual output dark blue, P50 forecast dashed navy, P10–P90 band shaded blue-grey, alert marker in amber, ramp window in soft amber

---

## Key Takeaways

- **Ensembles win on average, not on every event:** the ensemble combines models whose errors are structurally different — each wrong in its own way — so that errors partially cancel. On a specific event, a single model may outperform the ensemble; across hundreds of events, the ensemble consistently reduces the variance of forecast errors.
- **Horizon-dependent weighting captures different model strengths:** XGBoost dominates at 0–4 hours (recent features informative); TFT dominates at 12–72 hours (NWP and attention mechanisms informative). Equal-weight averaging is sub-optimal across all horizons simultaneously.
- **Ramp detection is the measure that matters operationally:** a model with excellent mean-error statistics but poor ramp-event detection is worth less than a model with acceptable mean-error statistics that reliably triggers reserve pre-positioning 3 hours in advance. Grid code compliance is the operational criterion.
- **P10, not P50, is the ramp alert signal:** when the ensemble's lower quantile drops below the ramp threshold, the P50 may still be high. The alert is calibrated to the tail, not the mean — reflecting the asymmetric cost of a missed downward ramp versus a false alarm.
- **NRMSE and pinball score measure what MAPE cannot:** MAPE's zero-denominator problem makes it misleading for wind power near cut-in. NRMSE normalises by rated capacity. Pinball score evaluates probabilistic interval calibration. Use both to evaluate a forecasting system; use neither alone.

## For Further Reading

- **Gneiting, T., & Raftery, A. E. (2007).** "Strictly Proper Scoring Rules, Prediction, and Estimation." *Journal of the American Statistical Association*, 102(477), 359–378. DOI: 10.1198/016214506000001437. The foundational treatment of proper scoring rules for probabilistic forecasts, including the continuous ranked probability score (CRPS) and the interval score. Section 6 discusses the relationship between pinball loss and the CRPS for single-quantile evaluation. Essential reading for anyone designing a probabilistic forecast evaluation framework.

- **Pinson, P., & Madsen, H. (2012).** "Adaptive Modelling and Forecasting of Offshore Wind Power Fluctuations with Markov-Switching Autoregressive Models." *Journal of Forecasting*, 31(4), 281–313. DOI: 10.1002/for.1194. Uses Markov regime-switching to model wind power output in distinct meteorological regimes (stable, transitional, active) — the framework that motivates why ramp events are structurally different from normal-regime errors and why standard MAPE conflates two physically distinct phenomena.

- **IEA Wind Task 36 (2019).** "Wind Power Forecasting — State-of-the-Art 2019." International Energy Agency. Available at: https://iea-wind.org/task36/. The most comprehensive industry survey of wind power forecasting methods, evaluation metrics, and operational use cases across 21 participating countries. Chapter 5 covers ramp event detection. Appendix B contains the standardised metric definitions adopted by the IEA Wind community, including the NRMSE normalisation convention.

---

*At 16:12, the farm output stabilised at 284 MW. The post-frontal westerly had established itself: clean and cold, at 8.6 m/s from 298°. All 34 nacelles had completed their yaw to the new direction. The power curve was performing exactly where Morten had predicted it would, in region two, well below rated.*

*Jonasz closed the ensemble notebook. He had not said anything for twenty minutes, and Kaan had not needed him to. They had watched the event together — the ramp alert timestamp, the PSE confirmation, the power trace falling through the prediction band, settling below the P50 but well above the P10. The forecast had not been right. It had been useful. Jonasz, apparently, considered these two distinct things.*

*"You have spent four days here," Jonasz said. He did not stand. He was still looking at the screen. "On Monday you arrived and I told you that data quality was more important than model complexity. On Tuesday I showed you that a decision tree is not useless — it is the foundation of something that is. On Wednesday I showed you that memory is not the same as attention. On Thursday I showed you what the model was reading. Today you have seen it work." He turned. "Not perfectly. But usefully. That is the distinction I want you to remember. A perfect forecast is not achievable. A useful forecast is what we build."*

*He picked up the thermos and stood. "Let me walk you back."*

*They went through the windowless corridor — past the server rack, past the door with the keypad, through the secondary fire door — and came out into the OSS main floor, where the air smelled faintly of transformer oil and the fluorescent lights were the same colour as they had been for four days, but the sound was different. There was a background electrical hum that Kaan had stopped noticing in week four and that now, coming back from the silence of the data lab, he noticed again.*

*Anders was waiting.*

*He was standing at the entrance to the control room corridor, holding a three-ring binder. It was thick — perhaps five centimetres of printed pages, interleaved with coloured tabs. He extended it toward Kaan when he saw him.*

*"Factory Acceptance Test documentation," Anders said. "Two hundred and fourteen pages. The main transformer. The export cable. The GIS. The protection relays. Every major component went through a FAT before it was shipped — tested at the manufacturer's facility against IEC standards, witnessed by a third-party inspector, signed by the commissioning engineer." He paused. "You are going to read it over the weekend. Not to memorise it. To understand what was tested and why. Because in twelve weeks, when we begin the energisation sequence, you are going to be the one responsible for verifying that what the FAT measured and what we see on our instruments agree."*

*Kaan took the binder. It was heavier than he expected.*

*"Forty-two switching steps," Anders said. "When the last one is complete, 510 megawatts will flow from these turbines to the PSE grid for the first time. You will be present for all forty-two. You will be authorised to execute some of them." He looked at the binder, then at Kaan. "Read it. Monday, 08:00. We will go through it together."*

*He walked away toward the control room. Behind Kaan, Jonasz had already turned back toward the data lab corridor.*

*Kaan stood for a moment in the main floor, the three-ring binder in his hands, the hum of the substation around him. Four days in a windowless room. Four days of data, of pipelines, of trees and gates and attention mechanisms, of probability distributions whose calibration he had learned to read as a kind of honesty about what could and could not be known.*

*And now forty-two switching steps.*

*He walked toward the control room.*

---

## Notes

[^1]: Galton, F. (1907). "Vox Populi." *Nature*, 75(1949), 450–451. DOI: 10.1038/075450a0. The paper was submitted to Nature as a short communication on the weight-guessing competition at the West of England Fat Stock and Poultry Exhibition, Plymouth, 1906. Of approximately 800 tickets issued, 787 were eligible for Galton's analysis (the remaining submissions were excluded for failing to comply with the competition format). The crowd's median estimate was 1,207 pounds; the actual slaughtered and dressed weight was 1,198 pounds — an error of 0.75%. Galton's original intent was to investigate whether democratic judgement was reliable; he admitted the result "was more creditable to the trustworthiness of a democratic judgement than might have been expected." A statistical science retrospective by Wallis (2014) re-examines the dataset and confirms the original result: the median is 1,207 lbs and the mean is approximately 1,197 lbs — the mean being even closer to the correct answer than the median. Wallis, K. F. (2014). "Revisiting Francis Galton's Forecasting Competition." *Statistical Science*, 29(3), 420–424. DOI: 10.1214/14-STS468.

[^2]: Wolpert, D. H. (1992). "Stacked Generalization." *Neural Networks*, 5(2), 241–259. DOI: 10.1016/S0893-6080(05)80023-1. Wolpert introduced the term "stacked generalisation" to describe the process of training a meta-learner on the out-of-fold predictions of multiple base learners, thereby correcting for the base learners' biases without introducing data leakage. Section 3 discusses the theoretical conditions under which stacking outperforms any single base learner — primarily when the base learners have different inductive biases and are therefore wrong in uncorrelated ways. The computational overhead of stacking (a second learning pass on meta-features) is rarely warranted for small ensembles of 2–5 models where held-out weighted averaging is statistically indistinguishable from stacking on typical energy forecasting datasets.

[^3]: North American Electric Reliability Corporation (NERC) and ERCOT (2008). "Lessons Learned: Wind Generation and ERCOT's Emergency Energy Conservation Program, February 26, 2008." Report prepared by ERCOT, with analysis contributed by NREL. Available: https://docs.nrel.gov/docs/fy08osti/43373.pdf. The report documents the full sequence: wind peaked at approximately 2,650 MW at 10:20 CST, then sustained a down-ramp accelerating after 14:00 at approximately 395 MW/h. The Emergency Energy Conservation Program was entered at Step 1 (media conservation appeal) and Step 2 (emergency interruptible load services). Average load response: 1,137 MW sustained for approximately 3.5 hours. The event was the first activation of ERCOT's EECP and led directly to changes in wind generation forecasting requirements, including mandatory real-time wind ramp alerting protocols and 20-minute advance forecast obligations for wind farms above a specified capacity threshold.

[^4]: Palmer, T. N., Molteni, F., Mureau, R., Buizza, R., Chapelet, P., & Tribbia, J. (1993). "Ensemble Prediction." In *ECMWF Seminar on Validation of Models over Europe*, Vol. 1, pp. 21–66. European Centre for Medium-Range Weather Forecasts. The ECMWF Ensemble Prediction System became operational on 23 November 1992, using 33-member ensembles with initial perturbations based on singular vectors. The US National Centers for Environmental Prediction (NCEP) launched their ensemble system — based on the "breeding of growing modes" method — in the same year. A comprehensive retrospective is provided by: Buizza, R. (2019). "The ECMWF Ensemble Prediction System: Looking Back (More Than) 25 Years and Projecting Forward 25 Years." *Quarterly Journal of the Royal Meteorological Society*, 145(S1), 12–24. DOI: 10.1002/qj.3383. The primary motivation for ensemble NWP was not improvement of mean forecast accuracy but quantification of forecast uncertainty — identifying the occasions when the atmosphere was in a sensitive initial state and small perturbations would lead to divergent outcomes. The operational product that justified the ensemble's computational cost was the spread, not the mean.

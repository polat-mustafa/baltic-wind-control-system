# Chapter 33: Data Quality Is More Important Than Model Complexity

*Jonasz Kowalski's data lab was the only room on the offshore substation without a window.*

*The previous twelve weeks had taken Kaan through spaces defined by their view: the met mast platform with fifty kilometres of grey Baltic in every direction; the nacelle at 150 metres with its oval porthole over the spinner; the OSS control room with floor-to-ceiling single-line diagrams and real-time power flows; the GIS hall, the relay room, the STATCOM bay. Each space had a physical horizon, a relationship to the sea and wind that made the engineering feel embedded in the world it was trying to manage.*

*The data lab had two monitors, a desk, a whiteboard with a formula half-erased and rewritten in a different colour, and a coffee machine that Jonasz appeared to use as his primary relationship with time. It occupied a corner of the OSS second level, between the battery room and the server room, surrounded by equipment that made no attempt at beauty. The corridor outside smelled of cooling fans and cable jacket.*

*When Kaan arrived Monday morning, Jonasz was already at his desk. On his left monitor: a scatter plot. On his right monitor: a Python terminal running a Jupyter notebook. The filename in the browser tab read `03_cleaning_pipeline_v47.ipynb`. On the upper frame of the left monitor, fixed with two pieces of tape, was a laminated card roughly two centimetres by eight. Red text on white. It said: GIGO.*

*Kaan recognised the power curve — the S-shaped relationship between hub-height wind speed and turbine output that Morten had first explained to him in Chapter 5. The shape was there. But the scatter of points outside it was wrong: clusters at zero output during wind speeds that should have been producing close to rated power; isolated readings at 14 MW at velocities where no turbine should operate; a diffuse population that seemed to belong to a different machine in a different place.*

*"You're the control engineer," Jonasz said, not looking up. "Anders said you spent three months learning what the physical systems do. Good. Now let's see if the data agrees."*

*He turned the left monitor a few degrees toward Kaan. "Fourteen months of farm-level power output against hub-height wind speed. Tell me what you see."*

*Kaan looked. The structure was right. But the anomalies were everywhere once he was looking for them.*

*"There are points that don't belong," he said.*

*"There are points the model will learn from," Jonasz said. "That is worse than points that don't belong. An obvious error gets ignored. An error that looks like data becomes a lesson."*

*He turned back to his keyboard. "Sit down. We start with the data. That is always where we start."*

---

## 33.1 SCADA Data — What You Have Versus What You Think You Have

GIGO entered the computing vocabulary in the early 1960s, attributed to programmers working with the first commercial computers who discovered that the machines were perfectly obedient and therefore perfectly useless when given incorrect input.[^1] The phrase predates machine learning by six decades and has not become less true with the passage of time.

A SCADA historian captures, at minimum, ten-minute mean values for every analogue measurement point on the farm: hub-height wind speed from the nacelle anemometer; active and reactive power; rotor speed; generator temperature; pitch angle per blade; nacelle direction; ambient temperature; and dozens of additional channels depending on turbine model and operator configuration.[^2] For a 34-turbine offshore farm at ten-minute sampling, a full year of farm-level historian data produces approximately 52,560 time steps. Fourteen months of data gives 61,320. This feels like a large dataset. After cleaning, it is frequently smaller by 15 to 20 percent.

The taxonomy of unusable data has four primary failure modes.

**Missing values** occur when readings are not recorded — communication loss between turbine and historian, sensor hardware failure, or planned maintenance outages. A well-operated farm achieves better than 98% data availability on its primary power channels; a poorly maintained historian can drop to 90%, representing 5,256 missing periods per year — equivalent to 36 complete days of absent data. In a training dataset, missing observations are treated as absent rather than zero. The distinction matters: a zero wind speed reading is a valid measurement. A not-recorded entry is an infrastructure failure. Imputing one from the other introduces a systematic bias that the model will learn and reproduce.

**Stuck sensors** are harder to identify and more damaging. A stuck sensor reports a constant value — or a value varying with implausibly small variance — over an extended period. The nacelle cup anemometer is particularly vulnerable: ice accumulation, debris fouling, or a worn bearing can cause it to under-read or stop rotating entirely while continuing to return a plausible non-zero signal. A turbine reporting 7.2 m/s for seventy-two consecutive hours while all neighbouring turbines show wind speeds varying between 4.5 and 13.8 m/s is recording a stuck anemometer, not a 600-metre-wide spatial calm. Detection is statistical: over any two-hour window, if the variance of a sensor's readings falls below a minimum physically plausible value for that site's turbulence intensity, the sensor is flagged.

The z-score approach applied to variance rather than level:

$$
z_{\text{var}} = \frac{\sigma_{x,\,\Delta t}^2 - \mu_{\sigma^2}}{\text{std}(\sigma^2)} < -z_{\text{thresh}}
$$

where:
- $\sigma_{x,\,\Delta t}^2$ = variance of sensor $x$ over rolling window $\Delta t$ (typically 2 hours) [[measurement unit squared]]
- $\mu_{\sigma^2}$, $\text{std}(\sigma^2)$ = mean and standard deviation of the variance across all windows [[measurement unit squared]]
- $z_{\text{thresh}}$ = detection threshold; typically 3.0 (flags the bottom 0.13% of variance windows) [[dimensionless]]

**Range violations** are unambiguous: wind speed below 0 m/s or above 60 m/s; active power below −0.5 MW or above 1.15 × rated; nacelle temperature below −40 °C or above 120 °C. These are hard-coded checks against the turbine manufacturer's specification and require no statistical reasoning.

**Physical inconsistency** is the most analytically important failure mode and the only one that cannot be detected by inspecting a single channel. A turbine reporting rated power at 3 m/s is individually coherent — neither value is outside its measurement range — but the combination violates the aerodynamic physics established in Chapter 5. Similarly, zero power at 15 m/s, while neighbours produce above 12 MW, is either a fault state or an anemometry error. Detecting physical inconsistency requires either cross-channel comparison or comparison against the expected physical relationship. The power curve provides the latter, as Section 33.4 describes.

Data availability across all required channels:

$$
A_{\text{data}} = \frac{N_{\text{valid}}}{N_{\text{total}}} \times 100\%
$$

where:
- $N_{\text{valid}}$ = time steps with valid readings across all required channels [dimensionless]
- $N_{\text{total}}$ = total time steps in the analysis period [dimensionless]

A well-maintained offshore historian achieves $A_{\text{data}} \geq 97\%$ before any physics-based filtering. The remaining 3% is not wasted; it is the first line of a cleaning log that will grow longer with every filter pass.

<!-- IMAGE: fig-33-01 -->
> **[Figure 33.1]** — SCADA Data Quality: Annotated Power Curve Scatter Plot
> **Type:** Scatter plot with annotated regions
> **Content:** Hub-height wind speed (x-axis, 0–25 m/s) vs. active power (y-axis, 0–16 MW, single turbine). Main population follows the manufacturer's power curve S-shape. Four anomalous populations annotated with callout boxes: (A) "Icing — output below curve at low temperature, winter clusters"; (B) "Curtailment — hard horizontal band at partial power"; (C) "Maintenance — zero output scattered across all wind speeds"; (D) "Stuck anemometer — vertical cluster at single wind speed, implausible constancy". Normal operation points in grey; anomalous populations colour-coded by failure mode.
> **Caption:** A power curve scatter plot reveals the taxonomy of data quality issues in a wind farm SCADA historian. Each failure mode leaves a distinct visual signature that automated detection rules must identify and flag before model training begins.
> **Alt text:** Scatter plot of wind speed versus turbine power output showing four distinct anomalous data populations annotated as icing, curtailment, maintenance, and stuck anemometer events.
> **Data source:** Author illustration, consistent with IEC 61400-12-1:2017 data exclusion categories.
> **Resolution:** 1400 × 900 px
> **Color notes:** Normal operation grey; icing blue; curtailment orange; maintenance red; stuck sensor purple.

---

## 33.2 The NWP Pipeline — Weather Forecasts as Raw Material

Jonasz had worked at the European Centre for Medium-Range Weather Forecasts in Reading for four years before moving into wind energy forecasting. He had arrived in 2012, when wind power prediction was transitioning from niche meteorological consulting into a service that grid operators in Germany, Denmark, and Spain were beginning to treat as essential infrastructure rather than a nice-to-have.

He described the ECMWF to anyone who had not worked there in the same sentence: "It was founded because every country in Europe was too small to solve the problem alone."

The Centre was established in 1975 by eighteen European member states who recognised that no single national meteorological service had the computing resources, data infrastructure, or scientific concentration to build a world-class numerical weather prediction system independently.[^3] Its first operational global forecasts ran in 1979 on a model with a horizontal resolution of approximately 200 km — a grid so coarse it could not distinguish Warsaw from Łódź. Today's ECMWF Integrated Forecasting System (IFS) runs at approximately 9 km horizontal resolution with a 137-level vertical structure and a data assimilation system that ingests satellite observations, radiosondes, aircraft reports, ocean buoys, and automated surface stations every six hours.

The statistic that Jonasz cited to every new data engineer was not about resolution. "A 48-hour wind speed forecast today is more accurate than a 24-hour forecast was thirty years ago," he said. "The model got better. But the model got better mostly because the data assimilation got better — more observations, better quality control of the input data, improved algorithms for merging model state with observations. The resolution improvement was visible. The data quality improvement was invisible. The invisible one did most of the work."

For wind energy, NWP data enters the pipeline in two distinct forms. **Reanalysis** products — of which ERA5 is the most widely used — are retrospective: the atmospheric state at each hour back to 1940, reconstructed by running the current model code and assimilating every observation available for each historical date, producing a consistent, globally gridded record at approximately 31 km horizontal resolution and hourly temporal resolution.[^4] ERA5 does not exist at a turbine's exact location; it must be interpolated from the four nearest grid points, with hub-height wind speed derived from the 10 m and 100 m ERA5 levels using the log law of Section 8.3.

**Operational forecasts** — the IFS, the US Global Forecast System (GFS at ~13 km), or the German ICON (~6.5 km over Europe) — produce future projections updated four times daily. For day-ahead wind power scheduling, the relevant product is the 24- to 48-hour forecast.

The complication: ERA5 and operational forecasts are not statistically equivalent. ERA5 is the best retrospective estimate of what the atmosphere did; the operational forecast is a forward projection made before those observations exist. A model trained on ERA5 will encounter operational IFS data in production that carries systematic biases — offshore sites in the southern Baltic show IFS wind speed overestimates of 3–6% under certain stability conditions, arising from differences in sea surface temperature specification and boundary-layer parameterisation.[^5] The correction is Model Output Statistics: a regression trained on historical pairs of (NWP forecast, measured observation) that removes the systematic offset.

$$
\hat{v}_{\text{corrected}}(t) = a_0 + a_1 \cdot v_{\text{NWP}}(t)
$$

where:
- $\hat{v}_{\text{corrected}}$ = bias-corrected hub-height wind speed [[m/s]]
- $v_{\text{NWP}}$ = NWP forecast wind speed interpolated to hub height via log law [[m/s]]
- $a_0$ = additive offset coefficient estimated from historical (NWP, observed) pairs [[m/s]]
- $a_1$ = multiplicative scaling coefficient (typical range offshore: 0.94–1.06) [[dimensionless]]

MOS coefficients are fitted on the same cleaned SCADA observations that form the model's training set. This means MOS cannot be trained until the data quality pipeline is complete. The order of operations is not negotiable: clean the observations first, calibrate the NWP second, train the forecast model third.

> **Standard reference:** ECMWF (2024). "IFS Documentation — Cy48r1." European Centre for Medium-Range Weather Forecasts, Reading. Part II describes the 4D-Var data assimilation system. Available at ecmwf.int/en/publications/ifs-documentation. [1]

<!-- IMAGE: fig-33-02 -->
> **[Figure 33.2]** — NWP Forecast Pipeline: From Global Grid to Feature Matrix
> **Type:** Flow diagram
> **Content:** Left: ECMWF IFS global grid at 9 km resolution (North Sea / Baltic map with grid cell overlay, farm location marked). Centre: interpolation step (bilinear horizontal + log-law vertical extrapolation to hub height). Right: MOS bias correction block (scatter plot of NWP vs. observed wind speed with regression line). Arrow continues to "Feature Engineering" block. Training path (ERA5 + clean SCADA → MOS coefficients) shown as dashed line; production inference path (IFS operational → MOS → model input) shown as solid line.
> **Caption:** The NWP pipeline interpolates global model output to turbine hub height and applies Model Output Statistics bias correction before the data enters the machine learning model. Correction coefficients are trained on clean historical observations; the same coefficients are then applied to operational forecasts at inference time.
> **Alt text:** Flow diagram showing the path from ECMWF global forecast grid through spatial interpolation and MOS bias correction to the machine learning feature matrix, with training and inference paths distinguished.
> **Data source:** Author illustration, consistent with ECMWF IFS documentation and standard MOS methodology.
> **Resolution:** 1600 × 700 px
> **Color notes:** Training path dashed blue; production inference path solid black.

---

## 33.3 Feature Engineering — Choosing What to Show the Model

The machine learning model does not receive raw meteorological data. It receives a designed set of features — transformed, encoded, and scaled representations of the available measurements — that express the physical and temporal structure of the prediction problem in a form the algorithm can use efficiently.

The distinction between raw data and features is the difference between handing a navigator a cloud photograph and handing them a synoptic weather chart. The photograph contains all the information. The chart encodes it in the form that maps onto the decisions that matter.

**Wind speed and direction** are the primary physical drivers. Hub-height wind speed from NWP (MOS-corrected) is the minimum viable feature. Direction must be encoded to preserve its circular topology: 358° is close to 2°, not far from it, and a model that receives direction as a raw integer will misrepresent the wrap-around. The standard encoding uses a sine-cosine pair:

$$
\theta_{\sin} = \sin\!\left(\frac{2\pi\,\theta}{360°}\right), \quad \theta_{\cos} = \cos\!\left(\frac{2\pi\,\theta}{360°}\right)
$$

where:
- $\theta$ = wind direction in meteorological convention (direction from which wind blows) [[degrees, 0–360]]
- $\theta_{\sin}$, $\theta_{\cos}$ = cyclic-encoded direction features [[dimensionless, −1 to 1]]

The same encoding applies to time features: hour of day uses $h_{\sin} = \sin(2\pi h / 24)$, $h_{\cos} = \cos(2\pi h / 24)$; month of year uses analogous expressions over 12. Without cyclic encoding, the model treats January and December as maximally separated in time — the opposite of the physical truth for a seasonally driven phenomenon.

**Turbulence intensity** is a regime indicator. High turbulence at a given mean wind speed produces a different power output distribution than low turbulence, for the physical reasons established in Chapter 10's wake turbulence analysis. For a ten-minute observation window:

$$
I = \frac{\sigma_v}{\bar{v}}
$$

where:
- $\sigma_v$ = standard deviation of wind speed within the ten-minute window [[m/s]]
- $\bar{v}$ = mean wind speed within the window [[m/s]]
- $I$ = turbulence intensity [[dimensionless; typical offshore range 0.04–0.18]]

Turbulence intensity above approximately 0.15 at wind speeds near rated is associated with elevated pitch system activity and reduced capacity factor relative to the smooth-inflow power curve — a regime the model needs to distinguish from below-rated operation at the same mean wind speed.

**Lag features** give the model short temporal memory. Wind power is autocorrelated: current output is correlated with output one, two, and six time steps earlier. Including $v_{t-1}$, $v_{t-2}$, and $P_{t-1}$ as features partially captures this structure. A caution: lag features including the target variable $P_{t-k}$ are only valid when past observations are genuinely available at inference time. In day-ahead forecasting, $P_{t-1}$ twenty-four hours before target time is a past observation and is available. $P_{t-1}$ one time step before the target is a future observation and must not be included.

**Normalisation** is required for neural networks (Chapters 35 and 36); for tree-based models (Chapter 34), it is optional because decision trees are invariant to monotone feature transformations. The z-score convention:

$$
\hat{x}_i = \frac{x_i - \mu_x}{\sigma_x}
$$

where:
- $x_i$ = raw feature value [[original unit]]
- $\mu_x$, $\sigma_x$ = mean and standard deviation computed on the training set [[original unit]]
- $\hat{x}_i$ = normalised feature [[dimensionless]]

The normalisation parameters are computed on the training set and applied without recomputation to validation and test sets. Normalising using statistics that include the test set constitutes data leakage — forecast error metrics would be optimistic because the scaling used future information.

---

## 33.4 The Power Curve as Filter — Recognising Normal Operation

The power curve occupies an unusual position in the data quality pipeline: it is simultaneously the target the model is trying to learn and the primary diagnostic tool for identifying which training observations to exclude.

The IEC 61400-12-1:2017 power performance standard defines data exclusion categories for the purpose of warranted power curve measurement — but those categories apply with equal force to forecast model training datasets, because the same conditions that make a period unsuitable for power curve measurement make it unsuitable for teaching a model what normal production looks like.[^6]

Six exclusion categories are relevant:

**Curtailment** — operator-commanded or grid-commanded active power limitation — is the most common. When the PPC from Chapter 24 issues an absolute limitation command, the turbines produce less than the wind resource allows. Including curtailed observations teaches the model that high wind produces low power — true in curtailed conditions, incorrect for the free-production scenario the forecast is intended to represent. The PPC dispatch commands are logged as status codes in the SCADA historian; any period where the active limitation flag is set is excluded.

**Scheduled maintenance** is the most precisely documented exclusion. The permit-to-work system from Chapter 32 provides exact timestamps: every permit, from ISSUED to CLOSED, from isolation point confirmation to reinstatement certificate, is stored in the SCADA historian as a permanent audit record. The data quality filter reads the permit log directly — an output that Kaan had not considered when Brigid was handing him padlocks four days earlier, but that Jonasz referenced as the most reliable single data source in the cleaning pipeline.

**Faults and forced outages** are flagged by turbine status register codes outside the normal operation band. Each turbine model uses a vendor-specific code scheme; the SCADA system maps these to a normalised three-state operational flag: normal, curtailed, unavailable.

**Icing events** are the dominant data quality challenge at Baltic sites from November through March. The detection criterion: ambient temperature below 2 °C combined with active power more than 15% below the reference power curve value at the measured wind speed.[^7] An unfiltered winter dataset from a southern Baltic site can contain 4–8% iced-rotor observations — observations that would teach the model that cold temperatures at moderate wind speeds produce anomalously low output, permanently biasing cold-season forecasts.

**Noise-limit curtailment and bat curtailment** — voluntary or regulatory output restriction during defined hours — use dedicated status register codes and are excluded with the general curtailment filter.

**IEC 61400-12-1 measurement exclusions** — anemometry calibration gaps, invalid measurement signal flags, periods outside the turbine's operational envelope — are detected by the range-violation filter of Section 33.1.

The working filter rule for physical inconsistency within the normal-operation band:

$$
\text{Exclude record } i \quad \text{if} \quad \bigl|P_i - P_{\text{ref}}(v_i)\bigr| > \varepsilon \cdot P_{\text{rated}} \quad \text{and} \quad \text{flag}_i = \text{Normal}
$$

where:
- $P_i$ = measured active power [[MW]]
- $P_{\text{ref}}(v_i)$ = manufacturer reference power at measured wind speed (from binned power curve table) [[MW]]
- $\varepsilon$ = exclusion threshold; typically 0.15–0.20 [[dimensionless]]
- $\text{flag}_i$ = turbine operational mode for time step $i$

The threshold $\varepsilon$ is a judgement, not a physical constant. Set too tight, it removes valid observations during high-turbulence fluctuations. Set too loose, it retains anomalies that bias the model. The standard practice is to use $\varepsilon = 0.20$ for the first automated pass and review the excluded records visually before finalising.

> **Standard reference:** IEC 61400-12-1:2017. "Wind Energy Generation Systems — Part 12-1: Power Performance Measurements of Electricity Producing Wind Turbines." IEC, Geneva. Section 7.4 specifies the data selection and exclusion criteria used as the basis for Section 33.4. [2]

<!-- IMAGE: fig-33-03 -->
> **[Figure 33.3]** — Sequential Data Quality Filter: Waterfall Chart
> **Type:** Horizontal waterfall / step chart
> **Content:** Six horizontal bars, each showing records remaining after each filter step. Top bar: "Raw historian data — 61,320 records". Subsequent bars labelled: "Missing / stuck / range removed (−3.4%)"; "Status code filter — maintenance, fault, curtailment (−9.8%)"; "Icing filter — T<2°C, power deficit >15% (−3.6%)"; "Power curve outlier filter — |P−Pref|>20%·Prated (−1.5%)". Bottom bar: "Valid training records — 50,399 (82.2%)". Each removal annotated with record count and percentage. Removal bars shown in muted red; surviving records bar in green.
> **Caption:** The sequential data quality filter removes 17.8% of raw historian records before model training. The permit-to-work log directly informs the maintenance exclusion step — a cross-system dependency that gives the forecast model access to the most accurate possible record of planned downtime.
> **Alt text:** Horizontal waterfall chart showing the progressive reduction of SCADA historian records through four sequential data quality filter stages, from 61,320 raw records to 50,399 valid training observations.
> **Data source:** Author illustration based on representative 34-turbine offshore Baltic farm dataset.
> **Resolution:** 1400 × 800 px
> **Color notes:** Removal steps muted red; final valid dataset bar green.

---

## 33.5 Worked Example — From Raw Historian to Training Dataset

**Farm and dataset parameters:**
- 34 turbines × 15 MW = 510 MW total capacity
- 14 months of ten-minute SCADA historian data
- Raw farm-level time steps: 14 × 30.4 × 24 × 6 = 61,286
- Available channels: nacelle anemometer wind speed; active power; ambient temperature; turbine status codes; NWP forecast wind speed (IFS 9 km, interpolated to farm centroid, MOS-corrected)

**Step 1 — Missing and stuck sensor filter**

Initial completeness scan: 2,109 time steps have at least one required channel absent or recorded as NaN (3.4%). Stuck-sensor detection (rolling 2-hour variance below $z_{\text{thresh}} = 3.0$): 12 additional records from Turbine 7 anemometer flagged — confirmed iced between 14–17 February, consistent with ambient temperature record of −4 °C and a SCADA alarm log entry from the turbine controller. Removed: 2,121 records.

Remaining: 59,165 (96.5% of raw).

**Step 2 — Status code filter**

Cross-reference with normalised operational flag (normal / curtailed / unavailable):
- Planned maintenance periods cross-referenced with permit log: 4,203 records (6.9%)
- Forced outages and fault states: 1,521 records (2.5%)
- Grid-commanded active power curtailment (PPC absolute limitation flag active): 486 records (0.8%)

Total removed in Step 2: 6,210 records.

Remaining: 52,955 (86.4% of raw).

**Step 3 — Icing filter**

Criterion applied November through February only: ambient temperature < 2 °C and power output < 85% of $P_{\text{ref}}(v)$.

Identified: 2,186 records (4.1% of Step 2 survivors). Consistent with documented Baltic offshore icing exposure for the site latitude.

Remaining: 50,769 (82.8% of raw).

**Step 4 — Power curve outlier filter**

Criterion: $|P_i - P_{\text{ref}}(v_i)| > 0.20 \times 15\,\text{MW} = 3\,\text{MW}$ within normal-operation flag.

Flagged: 370 records (0.7% of Step 3 survivors). Visual inspection of excluded records confirms genuine anemometry inconsistencies rather than high-turbulence legitimate operation.

**Final cleaned dataset: 50,399 records — 82.2% of raw.**

| Filter stage | Records remaining | Cumulative removed |
|---|---|---|
| Raw historian | 61,286 | — |
| After Step 1 (missing/stuck/range) | 59,165 | 3.5% |
| After Step 2 (status codes) | 52,955 | 13.6% |
| After Step 3 (icing) | 50,769 | 17.1% |
| After Step 4 (power curve) | 50,399 | 17.8% |

**Step 5 — Feature matrix construction**

For each of the 50,399 valid records, eighteen features are computed:

| Feature | Source | Encoding |
|---|---|---|
| $v$ | NWP IFS, MOS-corrected, hub height | m/s, raw |
| $\theta_{\sin}$, $\theta_{\cos}$ | NWP wind direction | Cyclic (2 features) |
| $T_{\text{amb}}$ | SCADA ambient temperature | °C, z-score |
| $I$ | SCADA 10-min σᵥ/v̄ | Dimensionless, z-score |
| $v_{t-1}$, $v_{t-2}$ | NWP lag 10 min, 20 min | m/s, z-score |
| $P_{t-1}$ | SCADA power lag 10 min | MW, z-score |
| $h_{\sin}$, $h_{\cos}$ | Hour of day | Cyclic (2 features) |
| $m_{\sin}$, $m_{\cos}$ | Month of year | Cyclic (2 features) |
| $\dot{v}$ | Wind speed rate of change | m/s per min, z-score |
| $v^2$ | Squared wind speed | m²/s², z-score |
| Offshore fetch | Wind direction in open-sea sector | Binary |
| Wake flag | Front row vs. deep array row for current direction | Binary |

Feature matrix dimensions: $50{,}399 \times 18 = 907{,}182$ elements.

**Step 6 — Impact of data cleaning on model performance**

A random forest (the algorithm family introduced in Chapter 34, presented here only as a benchmark) is trained on both the raw and cleaned datasets, with an 80/20 train/test split ordered by time to avoid leakage:

| Dataset | Training records | Test MAPE (24 h horizon) |
|---|---|---|
| Persistence baseline | — | 22.4% |
| Random forest, raw data | 49,029 | 12.1% |
| Random forest, clean data | 40,319 | **8.3%** |

The 3.8 percentage-point MAPE improvement from data cleaning alone — same algorithm, same hyperparameters — is larger than the improvement available from moving between most competing algorithm families when trained on dirty data. The chapter title is not a philosophical claim. It is a numerical result from this dataset.

**Economic value of the 3.8% MAPE improvement:**

For a 510 MW farm at 0.45 capacity factor and electricity at EUR 80/MWh, each percentage point of MAPE improvement at the day-ahead horizon avoids approximately EUR 5–8 million of annual balancing costs, depending on the imbalance pricing regime.[^8] The 3.8% gain from cleaning is worth EUR 19–30 million per year — before a single modelling decision has been made.

---

## Key Takeaways

- **Forecast model performance is bounded by training data quality, not algorithm selection.** The 3.8% MAPE reduction from the data cleaning pipeline in the worked example exceeded the gain available from algorithm choice when both models were trained on raw data. The model learns errors in its training data as faithfully as it learns signal; the difference between a useful forecast and a misleading one frequently lives in the 17.8% of records that should have been removed.

- **SCADA data has four primary failure modes: missing, stuck, range violation, and physical inconsistency.** The first three can be detected from a single channel. Physical inconsistency requires cross-channel comparison or comparison against the expected physical relationship (the power curve). None of these failure modes can be corrected — only removed or flagged. Imputing missing wind speed from a regression model creates circular dependencies with the target variable that bias evaluation metrics.

- **The permit-to-work system is a data quality resource.** Every permit closure record provides exact maintenance timestamps, isolation scope, and reinstatement confirmation — information that predates the anomaly in the SCADA historian. Using the permit log to identify and exclude planned-maintenance periods is more accurate than algorithmic detection because the permit record exists before the data shows a zero.

- **NWP data must be bias-corrected before entering the feature matrix.** Operational IFS forecasts and ERA5 reanalysis occupy different statistical universes relative to measured hub-height wind speed. MOS regression — trained on historical (NWP, observed) pairs — removes systematic bias that would otherwise become systematic forecast error. MOS must be trained on clean observations; the pipeline order is fixed.

- **Direction and time features require cyclic encoding.** Raw degrees and raw clock hours are not appropriate inputs to regression or tree-based models. The sine-cosine pair preserves the circular topology — 359° is close to 1°, December is close to January — that raw ordinal encoding destroys. A model that treats midnight and noon as equidistant from 6 a.m. has been given misinformation before training begins.

---

## For Further Reading

1. Clifton, A., Smith, A., and Fields, M.J. (2016). "Using Machine Learning to Predict Wind Turbine Power Output." *Environmental Research Letters*, 11(7), 074013. DOI: 10.1088/1748-9326/11/7/074013. This NREL paper benchmarks multiple machine learning algorithms on turbine-level power curve fitting and analyses data filtering methodology in Section 2.2, including the effect of operational mode exclusion on training set composition and the sensitivity of model error to the power curve deviation threshold. The central finding — that data quality decisions affect error metrics more strongly than algorithm selection at the turbine level — is the empirical foundation for this chapter's argument.

2. Hersbach, H., Bell, B., Berrisford, P., et al. (2020). "The ERA5 Global Reanalysis." *Quarterly Journal of the Royal Meteorological Society*, 146(730), pp. 1999–2049. DOI: 10.1002/qj.3803. The definitive description of ERA5: coverage (1940–present), horizontal resolution (31 km, 0.28° native), 137 vertical levels, hourly temporal resolution, and 4D-Var data assimilation methodology. Section 4 evaluates ERA5 performance at offshore Northern European locations. The reanalysis is freely available through the Copernicus Climate Data Store (cds.climate.copernicus.eu) and is the standard historical training dataset for Baltic offshore wind forecasting applications.

3. Pinson, P. and Madsen, H. (2012). "Adaptive Modelling and Forecasting of Offshore Wind Power Fluctuations with Markov-Switching Autoregressive Models." *Journal of Forecasting*, 31(4), pp. 281–313. DOI: 10.1002/for.1194. A foundational paper on the regime-dependent structure of offshore wind power variability. Sections 2 and 3 address the data selection problem in depth, explaining why mixed operating regimes (normal production, curtailment, maintenance) produce multimodal power distributions that violate unimodal regression assumptions. The data characterisation in these sections applies to any modelling approach, including the XGBoost and LSTM methods of Chapters 34 and 35.

---

*Jonasz printed the feature matrix summary on a single sheet — 50,399 rows, 18 columns, data types, min, max, mean, standard deviation — and taped it to the whiteboard above the half-erased formula.*

*"That is the foundation," he said. "Everything from here is built on those numbers. If the numbers are wrong, the model is wrong. If the model is wrong, the forecast is wrong. If the forecast is wrong, the grid operator receives the wrong number. And when the grid operator receives the wrong number, someone is running a gas turbine that did not need to run, or not running one that should have been." He looked at the printout. "Carbon, money, or system stability — it is always one of the three."*

*Kaan thought about the padlocks still in his jacket pocket. Brigid had handed them to him five days ago. The permit system and the data quality pipeline were, at their core, the same idea expressed in different domains: the work downstream was only as trustworthy as the conditions established before it began. You could not have a reliable maintenance record if the isolation was not verified. You could not have a reliable forecast if the training data was not clean. The problem was not complexity. The problem was always foundation.*

*"Two weeks?" he said.*

*"Sometimes three." Jonasz opened a new Jupyter notebook. The filename appeared in the browser tab: `04_xgboost_v01.ipynb`. "Tomorrow we start the first model. Tonight, read about decision trees — a single tree, not an ensemble. You need to understand one tree before you understand a hundred. Decision trees make choices the same way a relay protection engineer makes choices: at each node, they ask one question, branch on the answer, and commit to a path. By the time you understand why that is powerful and why it is not enough, you will understand why we need an ensemble."*

*Outside the data lab — somewhere, through the OSS steel — the wind was doing what it had been doing for fourteen months: varying between 2 and 22 m/s, blowing sometimes from the southwest and sometimes from the northwest and occasionally from the east, filling each ten-minute bucket with a mean and a standard deviation and a direction and a temperature. The farm had been recording all of it. Jonasz had been waiting for Kaan to be ready to do something with it.*

*The GIGO card caught the light from the left monitor: red on white, two centimetres by eight.*

---

## Notes

[^1]: The phrase "garbage in, garbage out" is documented in print from the early 1960s in US computing literature, appearing in industry newsletters and training materials for programmers working with IBM 650 and IBM 704 installations. Its most widely cited early printed occurrence is in a 1963 syndicated newspaper column by Walter Finney. No single inventor is established; the phrase appears to have emerged independently across multiple computing centres as a description of a universal discovery. For the principle's continuing relevance to machine learning, see Sculley, D., Holt, G., Golovin, D., et al. (2015). "Hidden Technical Debt in Machine Learning Systems." *Advances in Neural Information Processing Systems*, 28, pp. 2503–2511. The paper catalogues the systemic ways in which data quality problems propagate into production ML systems, including the "data dependency debt" that accumulates when cleaning pipelines are not maintained as first-class engineering artefacts.

[^2]: IEC 61400-25-2:2015. "Wind Energy Generation Systems — Part 25-2: Communications for Monitoring and Control of Wind Power Plants — Information Models." IEC, Geneva. Defines over 300 SCADA measurement points for wind turbine controllers, organised as logical nodes under IEC 61850 (Chapter 28). For a practical overview of wind farm SCADA historian architecture and data quality challenges, see Wilkinson, M., Harman, K., Spinato, F., Hendriks, B., and van Delft, T. (2010). "Measuring Wind Turbine Reliability — Results of the Reliawind Project." *Proceedings of EWEC 2010*, Warsaw. The paper reports data availability statistics across multiple European offshore fleets using the same ten-minute averaging convention applied in this chapter's worked example.

[^3]: ECMWF (2019). "ECMWF Annual Report 2019." European Centre for Medium-Range Weather Forecasts, Reading. Available at ecmwf.int. The founding Convention was signed in Brussels on 11 October 1973 and entered into force in November 1975 after ratification by the requisite number of member states. The Centre opened in Reading in 1975; experimental forecasts began in the late 1970s and operational global forecasts commenced in 1979. The 2019 Annual Report (Section 1.1) documents the progression from 200 km initial resolution to the current ~9 km IFS, placing the development in the context of ECMWF's five-year strategy for forecast skill improvement.

[^4]: Hersbach, H., Bell, B., Berrisford, P., et al. (2020). "The ERA5 Global Reanalysis." *Quarterly Journal of the Royal Meteorological Society*, 146(730), pp. 1999–2049. DOI: 10.1002/qj.3803. ERA5 superseded ERA-Interim in September 2019 as ECMWF's primary reanalysis product. It is produced under the Copernicus Climate Change Service (C3S) and is freely available through the Climate Data Store at cds.climate.copernicus.eu. The ERA5 back-extension to 1940 (released 2020) and the preliminary ERA5 Back Extension to 1950 cover the full period relevant to long-term wind resource assessment. For offshore Baltic applications, the ERA5 100 m wind speed and direction fields (parameter codes 228246, 228247) are the recommended primary inputs; the 10 m fields require extrapolation that introduces uncertainty over open-water fetch conditions.

[^5]: Hahmann, A.N., Vincent, C.L., Peña, A., Lange, J., and Hasager, C.B. (2015). "Wind Climate Estimation Using WRF Model Output: Method and Model Sensitivities over the Sea." *International Journal of Climatology*, 35(12), pp. 3422–3439. DOI: 10.1002/joc.4217. Section 4 evaluates NWP wind speed biases at offshore Baltic and North Sea sites, reporting systematic overestimation at hub height under stable stratification conditions and discussing the origin of the bias in sea surface temperature specification and surface roughness parameterisation. MOS correction methodology is discussed in the context of offshore wind energy applications. The study is part of the Wind Atlas for South and Southeast Asia (WASA) and New European Wind Atlas (NEWA) programme of work that established MOS as standard practice for European offshore wind resource characterisation.

[^6]: IEC 61400-12-1:2017. "Wind Energy Generation Systems — Part 12-1: Power Performance Measurements of Electricity Producing Wind Turbines." IEC, Geneva. Section 7.4 specifies data selection criteria for power performance measurement, including the six exclusion categories reproduced in Section 33.4. Annex B provides the air density normalisation procedure for correcting power output to reference air density (1.225 kg/m³ at sea level, 15 °C). The 2017 edition introduced the Rotor Equivalent Wind Speed (REWS) concept as an improvement over hub-height-only wind speed for characterising power curve performance under significant wind shear. For offshore applications with limited shear, hub-height wind speed and REWS are typically within 1–2%.

[^7]: IEA Wind Task 19 (2021). "Available Methods for the Assessment of Wind Turbine Icing." Technical Report TR 19.02, IEA Wind TCP. The report defines icing detection criteria for SCADA-based monitoring in Section 4.2: the 2 °C ambient temperature threshold accounts for wet-bulb cooling effects at high humidity (icing can occur at measured dry-bulb temperatures up to 3–4 °C under heavy fog or freezing drizzle conditions); the 15% power deficit threshold below the reference power curve is the recommended minimum for detection sensitivity, balancing false-positive and false-negative rates. Annual energy loss from icing for Baltic offshore sites: 0.5–4.2% depending on latitude, hub height, and blade heating system installation. Swedish and Finnish inner-Baltic sites experience the highest losses; Polish and German open-coast sites typically 0.5–1.5%.

[^8]: Pinson, P., Nielsen, H.A., Møller, J.K., Madsen, H., and Kariniotakis, G.N. (2007). "Non-Parametric Probabilistic Forecasts of Wind Power: Required Properties and Evaluation." *Wind Energy*, 10(6), pp. 497–516. DOI: 10.1002/we.230. The economic value of MAPE improvement depends on the balancing market structure. In the Polish KSE (National Power System) day-ahead market, imbalance settlement is based on a single-price mechanism with TSO-determined balancing prices; the effective cost of wind power forecast error in 2022–2023 has been estimated at EUR 5–9 per MWh of imbalance by PSE's annual balancing reports. The EUR 5–8M per percentage point of MAPE for a 510 MW farm at 0.45 CF is derived from: 510 × 0.45 × 8,760 × 0.01 × EUR 7/MWh ≈ EUR 14M/year, consistent with the range in the worked example text.

# Model cards

One card per module: what the model is for, what it assumes, where it holds, how it is
checked and what it cannot do. The cards complete [Methods & References](references.md),
which maps each method to its source, by adding validity ranges and limits.

**Terms** (ASME V&V 10-2019 / V&V 20-2009):

- **Verification**: the code solves its equations correctly. Checked against a hand
  calculation, a closed-form solution, another organisation's code, or a standard's worked
  example.
- **Validation**: the model represents reality well enough for its use. Checked against
  measured data.
- **Uncertainty**: what the result's spread is, and which inputs drive it.

Every number quoted as "Evidence" is a row of the in-app Evidence page. The rows are
regenerated from `pytest -m validation` by `backend/scripts/build_evidence.py`, and any later
test run fails if a value drifts. "Not checked" means neither verification nor validation
exists yet.

Status: 13 October 2026. Open items are tracked in `docs/engineering-audit-2026-10.md` §8.

---

## P1 — Wind resource and energy yield

| | |
|---|---|
| **Purpose** | Long-term wind climate, wakes and the AEP loss cascade with P50 / P90 for the SB-510 layout or a user's own project |
| **Model** | Site Weibull + 12-sector rose at 150 m (NEWA/ERA5); PyWake engineering wake models (Niayifar Gaussian, Bastankhah, NOJ, TurbOPark), STF2017 added turbulence, global blockage scaling; computed electrical loss and availability (P2, Lifecycle) in the cascade; RSS uncertainty components |
| **Assumptions** | Stationary climate over the project life; power-law shear; one turbine type per farm; wake models calibrated on onshore/offshore rows are transferable to 15 MW rotors |
| **Valid for** | Offshore farms on flat sea, spacings ≥ 4 D, 4–25 m/s; annual and monthly energy |
| **Verification** | Evidence `p1-turbopark-orsted`: TurbOPark equals Ørsted's reference code (max 0.0003 %). `p1-wake-floris`: farm wake loss of three model pairs within 0.42 pp of NREL FLORIS 4.2.1 |
| **Validation** | Rødsand II metered output (ENTSO-E 16.1.A), ERA5-driven chain: annual bias +1.1 % (`p1-aep-roedsand2-bias`), monthly R² 0.956, 28-month R² 0.951, worst year +5.0 %, hourly RMSE 16.8 % of capacity. Horns Rev 1 + Lillgrund row ratios: RMSE 0.083 (BPA), 0.097 (TurbOPark), 0.116 (NOJ) |
| **Uncertainty** | Wind resource, long-term, future variability, wake, turbine, non-wake components (RSS); P90 at 1 / 10 years and lifetime |
| **Known limits** | No on-site measurement or MCP; blockage is an engineering scaling, not a flow solution; curtailment (6.4 %: PSE wind redispatch 3.1 % + negative-RCE hours 3.4 %, last 12 months) uses national wind as the proxy for SB-510 and assumes the farm offers nothing at negative prices; no wake steering |

## P2 — HV grid: load flow, short circuit, cables

| | |
|---|---|
| **Purpose** | Steady-state design of the 66 kV array and 2 × 108 km 220 kV export: voltages, loading, losses, reactive capability, reactor switching, N-1, short-circuit duty, earth faults, cable ratings |
| **Model** | pandapower Newton-Raphson; export cable as an exact distributed π; 34 WTG transformers, OSS/onshore transformers, reactors, STATCOM, auxiliaries; IEC 60909 via `calc_sc` (c_max 1.10 / c_min 1.00, converter k 1.0–1.5); sequence networks and 38.1 Ω NERs; IEC 60287 per route section, IEC 60853-2 cyclic factor |
| **Assumptions** | Balanced three-phase steady state (except earth faults); positive-sequence cable data from datasheets; three-core cable geometry derived from datasheet C and L, filler resistance T2 calibrated to the 825 A datasheet rating; grid S_sc a project input (default 10 GVA) |
| **Valid for** | 50 Hz HVAC export up to ≈ 150 km; cable ratings for the four installation types modelled (buried, duct, trefoil, J-tube) |
| **Verification** | Hand calculations: IEC 60909 max/min at 220 kV (± 0.01 %), cable charging Q (± 0.1 %), π-model far-end voltage, Ferranti rise vs the exact line, NER earth-fault current (1.025). EPRI OpenDSS re-solves the 72-bus network within 8 × 10⁻⁵ pu (`p2-loadflow-opendss`). CIGRE TB 880 case 0-1: 821.78 A (`p2-iec60287-tb880`). Cyclic factor: six-hour IEC formula within 3 % of full superposition |
| **Validation** | Topology against built farms: Baltic Power's 4 export circuits reproduced by the design rule (`p2-export-circuits-baltic-power`). No measured voltages or flows (operator data not public) |
| **Uncertainty** | Not propagated. The largest drivers are grid S_sc, seabed thermal resistivity (0.7 K·m/W assumed) and the calibrated T2 |
| **Known limits** | Three-core armour losses use the IEC 60287 formula, not CIGRE TB 908 (needs the armour steel's measured complex permeability); no frequency-dependent cable model; Polish grid represented by a Thevenin equivalent |

## P2 — Harmonics, converter stability, FRT and dynamics

| | |
|---|---|
| **Purpose** | Harmonic voltages against IEC TR 61000-3-6 planning levels, filter sizing, converter–network stability, fault ride-through and frequency response for PSE NC RfG type D |
| **Model** | Detailed array harmonic network with distributed export cable; converter Norton admittance (delayed current control, damped LCL); generalized Nyquist on det(I + Z·Y); sequence-network FRT with negative-sequence injection; ANDES RMS with WECC generic models |
| **Assumptions** | Converter parameters are generic (no vendor model); background harmonic distortion at the POC from planning levels; WECC generic controls represent the turbines |
| **Valid for** | Harmonic orders 2–50; small-signal stability around the dispatched operating point; RMS phenomena (≥ 10 ms) |
| **Verification** | Nyquist encirclements equal the closed-loop right-half-plane poles in 9 / 9 cases (`p2-converter-nyquist-poles`); detailed vs lumped harmonic screen within 2.3 % to h11; ANDES LFSM-O ΔP equals the droop by hand within 0.4 MW |
| **Validation** | Grid-code criteria only (`andes-frt-iq` 1.10 pu reactive current, recovery 75 ms, LFSM-O delay 0.4 s); no measured harmonic or fault records |
| **Uncertainty** | Stability margins depend on the converter control delay and filter damping (the unstable case without the C_f damping resistor is shown) |
| **Known limits** | Generic converter data (vendor model needed); no PLL or low-frequency interaction; ANDES runs on Linux only |

## P3 — SCADA, IEC 61850 and protection

| | |
|---|---|
| **Purpose** | Teach and check the substation automation and protection of the OSS and onshore substation: IEC 61850 data model, SCL, GOOSE trips, relay settings and grading |
| **Model** | IEC 61850-7-4 / 61400-25 logical nodes; schema-valid SCD generation; GOOSE simulated over HTTP/WebSocket (*educational simulation: GOOSE is L2 Ethernet in real systems*); IDMT, distance, 87L, 87B, 51N settings from P2 fault levels |
| **Assumptions** | Ideal network timing in the simulation; relay and breaker times are typical values |
| **Valid for** | Configuration and logic training; protection grading at the modelled fault levels |
| **Verification** | SCD validates against the IEC 61850-6 XSD (0 errors); IEC 60255-151 IDMT time 2.97 s; GOOSE transfer 1.5 ms within the ≤ 3 ms trip class; grading margin 366 ms ≥ 300 ms; busbar fault current equals P2 `calc_sc` |
| **Validation** | Not checked against a real substation configuration or field timings |
| **Known limits** | No real L2 traffic or time synchronisation (PTP); SCD not tested in the OpenSCD GUI; cyber-security model (IEC 62443 zones) is descriptive |

## P4 — Power forecasting

| | |
|---|---|
| **Purpose** | Day-ahead (lead 24–47 h) probabilistic forecast of offshore wind output, compared with the TSO |
| **Model** | Gradient-boosted quantile model (nine quantiles, conformalised band), LSTM and TFT trained offline on the same folds, 1/MSE ensemble; physical limits applied after the model (ML never overrides physics) |
| **Assumptions** | Day-old NWP (ECMWF / ICON 100 m wind) represents what a forecaster had; DK2 Baltic farms represent a Baltic offshore farm |
| **Valid for** | Hourly day-ahead forecasts for farms with a measured history; not intraday or ramp-event forecasting |
| **Verification** | `TimeSeriesSplit` with a 48 h gap, never shuffled; scores computed on the same hours for every model |
| **Validation** | 16 731 measured DK2 hours: nRMSE 15.4 % of capacity vs Energinet's day-ahead 16.9 %; MSE skill vs 24 h persistence 0.82; CRPS skill vs climatology 0.62; P10–P90 coverage 84.8 % (ideal 80 %) |
| **Uncertainty** | Quantile forecasts with conformal calibration; reliability diagram |
| **Known limits** | SB-510 does not exist, so it has no history: its forecast transfers models trained on DK2 farms; curtailment hours are not separated in the target |

## P5 — Commissioning and EMT

| | |
|---|---|
| **Purpose** | First energisation of export circuit 1: switching programme with interlocks, isolation, FAT/SAT, EON/ION/FON, and the electromagnetic transients of energising the cable and transformers |
| **Model** | 63-step programme verified by load flow at each step; per-phase EMT with Dommel trapezoidal companion models (30 exact-π sections, line reactor, breaker poles, pre-insertion resistor, point-on-wave); statistical switching overvoltages → IEC 60071-2 co-ordination; transformer inrush with two-slope saturation; TOV after a cleared busbar fault |
| **Assumptions** | Positive-sequence, uncoupled phases; source = IEC 60909 Thevenin; knee 1.2 pu flux, air-core 0.30 pu, residual flux 0.8 pu; pole scatter 0–3 ms; no surge arresters (K_cd = 1) |
| **Valid for** | Energisation transients to ≈ 1 s, frequencies up to a few kHz (20 µs step, 3.6 km sections) |
| **Verification** | Ferranti ratio 1.0006 (`p5-emt-ferranti`); ringing frequency 1.018 of the analytic LC (`p5-emt-ringing`); lossless inrush peak / Specht's closed form 1.0001 (`p5-emt-inrush-specht`); IEC 60071-2 formulas asserted (U_et = 1.25·U_e2 − 0.25, K_s 1.15, Table 2) |
| **Validation** | Real energisation timeline of Baltic Power (daily output during its 2026 energisation) shown alongside; no measured switching waveforms |
| **Uncertainty** | U_e2 from 30 closings (90 phase peaks) — the 98th percentile is near the maximum at this sample size |
| **Known limits** | No frequency-dependent cable model (first milliseconds of travelling waves), no phase coupling, no arrester or arc model; own solver, not DPsim / ParaEMT / EMTP |

## Turbine physics — controller, loads and support structure

| | |
|---|---|
| **Purpose** | Time-domain behaviour of the IEA-15-240-RWT (direct drive, 5.0–7.56 rpm) under its ROSCO controller; tower fatigue; the tower + jacket natural frequency against 1P / 3P |
| **Model** | Rotor Cp/Ct table (CCBlade), 1-DOF drivetrain, ROSCO-equivalent torque and pitch PI with gain schedule; rotor coupled to the first fore-aft tower mode, IEC NTM class B Kaimal wind with coherence, rainflow + DEL; 3D Euler-Bernoulli frame FE of the ElastoDyn tower on DEME's 50 m jacket, optional piles on API p-y / t-z springs and scour |
| **Assumptions** | Rigid blades; one structural mode in the load model; jacket legs clamped at the mudline in the reference case (1 GN/m vertical spring); generic dense/loose Baltic sand for the pile cases |
| **Valid for** | Power production DLC 1.2-type fatigue in the tower fore-aft direction; first global modes (< 1 Hz) |
| **Verification** | Steady state vs the official IEA 15 MW table: rpm 0.56 %, power 1.7 %, pitch 1.3°, thrust 5.7 % at the rated knee; compiled NREL ROSCO peak rotor speed within ± 0.6 rpm on six wind cases (audit A1); ASTM E1049 rainflow example; FE pile vs Matlock–Reese 1.014 |
| **Validation** | f1 0.2236 Hz vs DEME's OpenFAST free decay 0.221 Hz (+1.2 %, `ts-jacket-f1`) — a reference model, not a measurement |
| **Uncertainty** | Foundation: piles on API springs raise f1 by ≈ 6 % and cut the 3P margin from 10.6 % to ≈ 5 %; scour changes f1 by < 1 %. Hs50 7.96 m from ERA5 is likely 10–25 % low (Björkqvist et al. 2018) without changing the frequency verdict |
| **Known limits** | No blade or drivetrain flexibility, no full DLC set, no OpenFAST comparison of loads yet; pile batter and hydrodynamic added mass not modelled |

## Digital twin — condition monitoring

| | |
|---|---|
| **Purpose** | Detect developing faults from SCADA temperatures before failure, and show the state of each turbine |
| **Model** | Normal-behaviour XGBoost models per temperature channel, EWMA control chart on the residuals (limits set in Phase I on training data only), power-curve residual binning, physics reference model (ROSCO Cp(λ, β), generator and converter losses, stator thermal model) |
| **Assumptions** | Training periods are healthy; the detector's settings carry over between farms of the same turbine family |
| **Valid for** | Thermal faults that show in SCADA 10-minute temperatures days to weeks ahead |
| **Verification** | Phase I limits derived on training data only; detector frozen before the test farm is opened |
| **Validation** | CARE to Compare (Gück et al. 2024): Farm B 5 / 6 faults detected before failure with 3 / 9 false alarms; held-out Farm C 13 / 27 detected (reported as-is) |
| **Qualification** | Against DNV-RP-A204 (digital twin qualification): the functional elements and data sources are described, the detector is validated on held-out data; no formal qualification by a third party |
| **Known limits** | Not trained on IEA 15 MW data (none exists); the vibration CMS uses generic defect frequencies, not measured spectra; remaining-useful-life prognosis is not validated |

## Lifecycle — installation, O&M and decommissioning

| | |
|---|---|
| **Purpose** | Weather-limited campaigns, availability and O&M cost over the farm's life, decommissioning plan |
| **Model** | 30-year ERA5 hindcast at the site (Hs, 10 m wind, 6-hourly); DNV-ST-N001 reference periods (T_R = T_POP + T_C, α factor); analytic availability from Carroll et al. 2016 failure rates; hourly fleet O&M replay (Poisson failures, CTV crews in daylight shifts, jack-up campaigns, energy-based availability, itemised cost) |
| **Assumptions** | Vessel limits, day rates, durations and costs are illustrative public figures; perfect weather forecast within a shift; failure rates of 3–10 MW turbines apply to 15 MW |
| **Valid for** | Planning-level availability (± a few points) and campaign duration estimates |
| **Verification** | Replay in validation mode equals the analytic model within 0.26 pp (`lc-om-vs-analytic`); NREL WOMBAT 0.13.4 on the same inputs is 2.2 pp higher (`lc-om-wombat`), explained by WOMBAT's missing response delays and paused failure clocks |
| **Validation** | Not checked against an operator's availability records (not public) |
| **Uncertainty** | Year-to-year spread from the 30 hindcast years: energy-based availability P90 88.0 % (2 CTVs × 3 crews) |
| **Known limits** | No preventive maintenance campaigns, no spare-part logistics, no SOV strategy; the hindcast is 6-hourly ERA5 (smooths short windows and peaks) |

## Site assessment

| | |
|---|---|
| **Purpose** | Screen a site for permits, depth, seabed, grid distance, ports, export route and neighbouring wakes |
| **Model** | Rule-based criteria and a weighted linear combination; shortest sea routes on the bathymetry grid; cluster wakes with TurbOPark |
| **Assumptions** | Thresholds and weights are *illustrative* (labelled in the API); open GIS layers are current |
| **Valid for** | Early screening, not permitting |
| **Verification** | TurbOPark as in P1; route lengths on the 16-neighbour grid |
| **Validation** | SB-510 re-routed to the real Baltica 9 connection point (Krzemienica) and clear of the military area — a consistency check, not a measurement |
| **Known limits** | No geotechnical or UXO survey data; neighbour layouts approximated from outlines |

# Methods & References

Each module of the platform maps to a published method or standard. This page lists **what the code
implements, where, and which primary source describes it**, so results can be checked against the
literature rather than against this project's own text.

Citation rules used here:

- Standards are cited by number and edition year where the code depends on a specific edition;
  otherwise by series. Standards are paywalled; obtain them through a university library or the
  publisher (IEC, ISO, CENELEC).
- Books and papers are cited in full bibliographic form. No secondary sources (Wikipedia, blogs) and
  no AI-generated summaries.
- Software libraries are cited by their reference paper; the exact versions are pinned in
  `backend/uv.lock` and `frontend/package-lock.json`.

## P1 — Wind resource and energy yield

| Topic | Implementation | Reference |
|---|---|---|
| Weibull fit, wind rose | `services/p1/data_processing.py`, `wind_analysis.py` | [1] ch. 2 |
| Wake deficit (Gaussian) | `services/p1/wake_model.py` (PyWake `NiayifarGaussianDeficit`, `LinearSum`) | [6], [7] |
| Wake-added turbulence | `services/p1/wake_model.py` (PyWake `STF2017TurbulenceModel`) | [8], [S1] |
| Global blockage | `services/p1/blockage.py` | [9] |
| AEP loss cascade, P50/P90 | `services/p1/aep_calculator.py` | [1], [2] |
| Power / thrust curve, cut-in/out (IEA 15 MW and 22 MW reference turbines) | `services/p1/turbine_models.py`, `app/data/turbines/`, `scripts/fetch_turbine_curves.py`, `frontend/src/constants/turbineModels.ts` | [S2], [26], [27] |

## P2 — HV grid integration

| Topic | Implementation | Reference |
|---|---|---|
| Network model, load flow | `services/p2/network_model.py`, `load_flow.py` (pandapower) | [3], [10] |
| Short-circuit currents | `services/p2/short_circuit.py` (`pandapower.shortcircuit.calc_sc`) | [S4], [10] |
| RMS dynamics, FRT | `services/p2/andes_dynamics.py`, `frt_simulation.py` (ANDES) | [4], [11], [S5] |
| Reactive power / STATCOM sizing | `services/p2/statcom_sizing.py` | [4], [5], [S5], [S6] |
| Cable current rating | `services/p2/cable_dts.py` | [S7] |
| Power quality | `services/p2/power_quality.py` | [S8], [S9] |

## P3 — SCADA and substation automation

| Topic | Implementation | Reference |
|---|---|---|
| IEC 61850 data model, logical nodes | `services/p3/iec61850_model.py` | [S10] (part 7-4) |
| GOOSE messaging (simulated over HTTP/WS) | `services/p3/goose_simulation.py` | [S10] (part 8-1) |
| SCL configuration files | `services/p3/scl_generator.py` | [S10] (part 6) |
| Wind-plant information model | `services/p3/iec61850_model.py` | [S11] |
| Telecontrol | `services/p3/` (simulated) | [S12] |
| RBAC, zones and conduits | `services/p3/rbac.py`, `security.py` | [S13] |

## P4 — Power forecasting

| Topic | Implementation | Reference |
|---|---|---|
| Gradient-boosted quantile model | `services/p4/xgboost_model.py` | [12], [13] |
| LSTM, MC-dropout uncertainty | `services/p4/lstm_model.py` | [14], [15] |
| Temporal Fusion Transformer | `services/p4/tft_model.py` | [16] |
| Explanations (SHAP) | `services/p4/xgboost_model.py` | [17] |
| Time-ordered cross-validation | `services/p4/` (scikit-learn `TimeSeriesSplit`) | [18], [19] |
| Forecast error metrics | `services/p4/model_evaluation.py` | [19], [20] |
| Physical limits on forecasts (legacy V236 curve) | `services/p4/physical_constraints.py` | [S3] |

## P5 — Commissioning

| Topic | Implementation | Reference |
|---|---|---|
| Switching programme, safe work | `services/p5/switching_programme.py` | [S14] |
| Lockout/tagout | `services/p5/loto.py` | [S15] |
| Protection relays | `services/p5/protection_relay.py` | [S16] |
| Circuit-breaker duties | `services/p5/switching_programme.py`, `sat.py` | [S17] |
| Grid-code compliance tests | `services/p5/grid_code_testing.py` | [S5], [S18] |
| Arc-flash incident energy | `services/p5/loto.py` | [S19] |

## Digital twin — condition monitoring

| Topic | Implementation | Reference |
|---|---|---|
| Processing blocks (DM/SD/HA/PA) | `services/digital_twin/` | [S20] |
| EWMA state detection | `services/digital_twin/detection.py` | [21] |
| Prognosis, remaining useful life | `services/digital_twin/prognosis.py` | [S21] |
| Power-curve residual binning | `services/digital_twin/detection.py` | [S2] |

## Site assessment — screening

| Topic | Implementation | Reference |
|---|---|---|
| Territorial sea (12 nm) and EEZ | `services/site_assessment/criteria.py` | [S25] |
| Marine spatial plans (wind farm areas) | `services/site_assessment/data/` | [S26] |
| Natura 2000 appropriate assessment trigger | `services/site_assessment/assess.py` | [S27] |
| EIA screening of wind farms (Annex II 3(i)) | `services/site_assessment/assess.py` | [S28] |
| Weighted linear combination of criteria | `services/site_assessment/suitability.py` | Standard GIS multi-criteria method; thresholds and weights are labelled *illustrative* in the API model card |
| Site wind climate: mean speed, Weibull k and A at 150 m; 12-sector rose | `services/site_assessment/wind_climate.py`, `scripts/fetch_wind_climate.py`, `routers/p1.py` (`_rose_site`) | [28], [29], [30] |

## Academy — scored missions

Mission weights and pass mark (70) are *illustrative* teaching choices, shown on every mission card.

| Topic | Implementation | Reference |
|---|---|---|
| Site selection: permit decision, depth bands, grid distance | `frontend/src/academy/scoring.ts` (uses `components/site/journey.ts`, backend `criteria.DEPTH_BANDS`) | [S25]–[S28] |
| Layout challenge: capacity, wake loss, array cable, LCOE | `frontend/src/lib/layout/evaluate.ts`, `academy/scoring.ts` | as the layout canvas (P1 wake and LCOE rows) |
| FRT compliance: PSE type-D profile, ΔIq = K·ΔU | `frontend/src/academy/frt.ts` (mirror of `services/p2/frt_simulation.py`) | [S5] Art. 16, 20; [S6] |
| First energisation order | `frontend/src/academy/sequence.ts` (condensed from `services/p5/switching_programme.py`) | [S14] |
| Digital Twin diagnosis graded against injected faults | `frontend/src/components/academy/DiagnosisMission.tsx` | [S20] |

## Lifecycle — construction, hand-over, decommissioning

Vessel limits, unit durations, deck capacity, day rates, masses and end-of-life unit costs are *illustrative*
teaching values, listed on the pages and in the API response (`assumptions`, `vessels`).

| Topic | Implementation | Reference |
|---|---|---|
| Weather-restricted operations, α factor (OP_WF = α · OP_LIM) | `backend/app/services/lifecycle/campaign.py` | [S29] |
| Synthetic sea states: Rayleigh Hs, Weibull k = 2 wind, AR(1) persistence, monthly Baltic means | `backend/app/services/lifecycle/weather.py` (monthly means of `services/p1/weather_window.py`) | Marginals as the O&M weather-window model; persistence and wind–wave correlation *illustrative* |
| Hub-height wind for the jack-up crane limit (power law, α = 0.14) | `backend/app/services/lifecycle/weather.py` | [S30] |
| As-built register: strings, OSS feeder bays, cable sections | `frontend/src/lib/lifecycle/farm.ts` (cable tree of `lib/layout/cables.ts`) | as the layout canvas |
| Removal of disused installations; publicity of what stays | `frontend/src/lib/lifecycle/decommissioning.ts` | [S25] Art. 60(3), [S31] §3.1, 3.2, 3.6 |
| National decommissioning programmes (example regime) | `frontend/src/pages/DecommissioningPage.tsx` | [S32] |
| Blade end of life, recyclable share of turbine mass | `frontend/src/lib/lifecycle/decommissioning.ts` | [24] |
| Decommissioning methods and sequence | `backend/app/services/lifecycle/campaign.py` (`remove_plan`) | [25] |

## 3D turbine viewer — overlays

| Topic | Implementation | Reference |
|---|---|---|
| Blade operating point (BEM-lite: induction from Ct, inflow angle, α) | `frontend/.../turbine3d/model/bladeField.ts` | [1] ch. 3, [2] ch. 3 |
| Blade surface pressure (thin-airfoil loading + thickness, Cp·½ρW²) | `frontend/.../turbine3d/model/bladeField.ts` | [22] ch. 4 |
| Blade kinetic heating (adiabatic-wall recovery temperature) | `frontend/.../turbine3d/model/bladeField.ts` | [23] ch. 7 |
| Flapwise bending moment from thrust | `frontend/.../turbine3d/model/bladeField.ts` | [2] ch. 6 |
| Nacelle component temperatures, thermal limits | `frontend/.../turbine3d/model/nacelleThermal.ts` | [S22], [S23] |
| Vibration zones (sensor read-outs) | `backend/app/services/turbine_physics/nacelle_subsystems.py` | [S24] |

## Books and papers

1. Manwell, J. F., McGowan, J. G., Rogers, A. L. *Wind Energy Explained: Theory, Design and Application*, 2nd ed. Wiley, 2009.
2. Burton, T., Jenkins, N., Sharpe, D., Bossanyi, E. *Wind Energy Handbook*, 2nd ed. Wiley, 2011.
3. Grainger, J. J., Stevenson, W. D. *Power System Analysis*. McGraw-Hill, 1994.
4. Kundur, P. *Power System Stability and Control*. McGraw-Hill, 1994.
5. Ackermann, T. (ed.). *Wind Power in Power Systems*, 2nd ed. Wiley, 2012.
6. Niayifar, A., Porté-Agel, F. "Analytical modeling of wind farms: A new approach for power prediction." *Energies* 9(9), 741, 2016.
7. Pedersen, M. M., et al. *PyWake — an open-source wind farm simulation tool*. DTU Wind Energy (version pinned in `backend/uv.lock`).
8. Frandsen, S. *Turbulence and turbulence-generated structural loading in wind turbine clusters*. Risø-R-1188(EN), Risø National Laboratory, 2007.
9. Nygaard, N. G., Steen, S. T., Poulsen, L., Pedersen, J. G. "Modelling cluster wakes and wind farm blockage." *Journal of Physics: Conference Series* 1618, 062072, 2020.
10. Thurner, L., et al. "pandapower — An open-source Python tool for convenient modeling, analysis, and optimization of electric power systems." *IEEE Transactions on Power Systems* 33(6), 6510–6521, 2018.
11. Cui, H., Li, F., Tomsovic, K. "Hybrid symbolic-numeric framework for power system modeling and analysis." *IEEE Transactions on Power Systems* 36(2), 1373–1384, 2021.
12. Chen, T., Guestrin, C. "XGBoost: A scalable tree boosting system." *Proc. 22nd ACM SIGKDD*, 785–794, 2016.
13. Koenker, R., Bassett, G. "Regression quantiles." *Econometrica* 46(1), 33–50, 1978.
14. Hochreiter, S., Schmidhuber, J. "Long short-term memory." *Neural Computation* 9(8), 1735–1780, 1997.
15. Gal, Y., Ghahramani, Z. "Dropout as a Bayesian approximation: Representing model uncertainty in deep learning." *Proc. ICML*, PMLR 48, 1050–1059, 2016.
16. Lim, B., Arık, S. Ö., Loeff, N., Pfister, T. "Temporal Fusion Transformers for interpretable multi-horizon time series forecasting." *International Journal of Forecasting* 37(4), 1748–1764, 2021.
17. Lundberg, S. M., Lee, S.-I. "A unified approach to interpreting model predictions." *Advances in Neural Information Processing Systems* 30, 2017.
18. Pedregosa, F., et al. "Scikit-learn: Machine learning in Python." *Journal of Machine Learning Research* 12, 2825–2830, 2011.
19. Hyndman, R. J., Athanasopoulos, G. *Forecasting: Principles and Practice*, 3rd ed. OTexts, 2021.
20. Madsen, H., Pinson, P., Kariniotakis, G., Nielsen, H. A., Nielsen, T. S. "Standardizing the performance evaluation of short-term wind power prediction models." *Wind Engineering* 29(6), 475–489, 2005.
21. Roberts, S. W. "Control chart tests based on geometric moving averages." *Technometrics* 1(3), 239–250, 1959.
22. Anderson, J. D. *Fundamentals of Aerodynamics*, 6th ed. McGraw-Hill, 2017.
23. White, F. M. *Viscous Fluid Flow*, 3rd ed. McGraw-Hill, 2006.
24. WindEurope. "Wind industry calls for Europe-wide ban on landfilling turbine blades." Press release, June 2021. https://windeurope.org/news/wind-industry-calls-for-europe-wide-ban-on-landfilling-turbine-blades/
25. Topham, E., McMillan, D. "Sustainable decommissioning of an offshore wind farm." *Renewable Energy* 102(B), 470–480, 2017. doi:10.1016/j.renene.2016.10.066
26. Gaertner, E., et al. *Definition of the IEA 15-Megawatt Offshore Reference Wind Turbine*. NREL/TP-5000-75698, 2020. Tables: github.com/IEAWindTask37/IEA-15-240-RWT, tag v1.1.18, `Documentation/IEA-15-240-RWT_tabular.xlsx` ("Rotor Performance"), Apache-2.0.
27. Zahle, F., et al. *Definition of the IEA Wind 22-Megawatt Offshore Reference Wind Turbine*. DTU Wind Report E-0243, 2024. https://doi.org/10.11581/DTU.00000317. Tables: github.com/IEAWindTask37/IEA-22-280-RWT, tag v1.1.0 ("Rotor Performance - WISDEM"), Apache-2.0.
28. Hahmann, A. N., et al. "The making of the New European Wind Atlas — Part 1: Model sensitivity." *Geoscientific Model Development* 13, 5053–5078, 2020; NEWA Mesoscale Atlas doi:10.11583/DTU.14414096.v1 (CC BY-NC 4.0).
29. Dörenkämper, M., et al. "The making of the New European Wind Atlas — Part 2: Production and evaluation." *Geoscientific Model Development* 13, 5079–5102, 2020 (microscale atlas, Weibull parameters).
30. Hersbach, H., et al. "The ERA5 global reanalysis." *Quarterly Journal of the Royal Meteorological Society* 146, 1999–2049, 2020; hourly data via the Open-Meteo archive API (CC BY 4.0).

## Standards and regulations

- **[S1]** IEC 61400-1:2019 — Wind energy generation systems — Part 1: Design requirements.
- **[S2]** IEC 61400-12-1 — Power performance measurements of electricity producing wind turbines.
- **[S3]** Vestas V236-15.0 MW product data (rated power, cut-in 3 m/s, cut-out 31 m/s) — legacy V236 approximation still used by P4, the digital twin (`digital_twin/legacy_v236_table.py`) and turbine physics.
- **[S4]** IEC 60909-0:2016 — Short-circuit currents in three-phase a.c. systems — Part 0: Calculation of currents.
- **[S5]** Commission Regulation (EU) 2016/631 — Network code on requirements for grid connection of generators (RfG).
- **[S6]** PSE S.A. — *Instrukcja Ruchu i Eksploatacji Sieci Przesyłowej* (IRiESP) and national RfG requirements.
- **[S7]** IEC 60287 series — Electric cables — Calculation of the current rating.
- **[S8]** EN 50160 — Voltage characteristics of electricity supplied by public electricity networks.
- **[S9]** IEC 61400-21-1:2019 — Measurement and assessment of electrical characteristics — Wind turbines.
- **[S10]** IEC 61850 series — Communication networks and systems for power utility automation.
- **[S11]** IEC 61400-25 series — Communications for monitoring and control of wind power plants.
- **[S12]** IEC 60870-5-104 — Telecontrol equipment and systems — Network access using standard transport profiles.
- **[S13]** IEC 62443 series — Security for industrial automation and control systems.
- **[S14]** EN 50110-1 — Operation of electrical installations — Part 1: General requirements.
- **[S15]** OSHA 29 CFR 1910.147 — The control of hazardous energy (lockout/tagout).
- **[S16]** IEC 60255 series (incl. 60255-151) — Measuring relays and protection equipment.
- **[S17]** IEC 62271-100 — High-voltage switchgear and controlgear — Part 100: Alternating-current circuit-breakers.
- **[S18]** IEC 61936-1 — Power installations exceeding 1 kV AC.
- **[S19]** IEEE 1584 — Guide for performing arc-flash hazard calculations.
- **[S20]** ISO 13374-1:2003 — Condition monitoring and diagnostics of machines — Data processing, communication and presentation — Part 1: General guidelines.
- **[S21]** ISO 13381-1:2015 — Condition monitoring and diagnostics of machines — Prognostics — Part 1: General guidelines.
- **[S22]** IEC 60034-1 — Rotating electrical machines — Part 1: Rating and performance (thermal classes).
- **[S23]** IEC 60076-11 — Power transformers — Part 11: Dry-type transformers.
- **[S24]** ISO 10816-21:2015 — Mechanical vibration — Evaluation of machine vibration by measurements on non-rotating parts — Part 21: Horizontal axis wind turbines with gearbox.
- **[S25]** United Nations Convention on the Law of the Sea (UNCLOS), 1982 — Art. 3 (territorial sea), Art. 55–57 (exclusive economic zone).
- **[S26]** Directive 2014/89/EU establishing a framework for maritime spatial planning.
- **[S27]** Council Directive 92/43/EEC on the conservation of natural habitats and of wild fauna and flora (Habitats Directive), Art. 6(3).
- **[S28]** Directive 2011/92/EU on the assessment of the effects of certain public and private projects on the environment (EIA Directive), as amended by Directive 2014/52/EU — Annex II, 3(i).
- **[S29]** DNV-ST-N001 — Marine operations and marine warranty (weather-restricted operations, operational limits and the α factor).
- **[S30]** IEC 61400-3-1:2019 — Wind energy generation systems — Part 3-1: Design requirements for fixed offshore wind turbines (normal wind profile).
- **[S31]** IMO Assembly Resolution A.672(16), 1989 — Guidelines and standards for the removal of offshore installations and structures on the continental shelf and in the exclusive economic zone.
- **[S32]** UK Energy Act 2004, Part 2 Chapter 3 (ss. 105–114) — decommissioning of offshore renewable energy installations; DECC/DESNZ guidance notes for industry.

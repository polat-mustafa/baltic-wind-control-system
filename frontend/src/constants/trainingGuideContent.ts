/**
 * Training guide content for every page in the application.
 *
 * Each guide provides a comprehensive user manual for the page:
 * purpose, step-by-step usage, panel descriptions, relevant standards,
 * and learning objectives. Displayed via the TrainingGuide component
 * (graduation-cap icon in each page header).
 */

export interface TrainingGuideSection {
  name: string;
  description: string;
}

export interface TrainingGuideStandard {
  /** Display text, e.g. "IEC 61400-1 — Wind turbine design requirements" */
  label: string;
  /** Official document / publisher URL; omit for non-web references */
  url?: string;
}

export interface TrainingGuideData {
  title: string;
  subtitle: string;
  purpose: string;
  howToUse: string[];
  sections: TrainingGuideSection[];
  standards: TrainingGuideStandard[];
  learningObjectives: string[];
}

// ── Landing Page ──────────────────────────────────────────────

export const landingGuide: TrainingGuideData = {
  title: "Wind Farm Overview",
  subtitle: "Real-time operational map of the 510 MW Baltic Sea wind farm",
  purpose:
    "The landing page is your control room overview — a single screen showing " +
    "all 34 turbines, the offshore substation, 45 km export cable, and onshore " +
    "connection point. It mirrors what operators see in real ABB Ability or " +
    "Siemens DEOP control rooms.",
  howToUse: [
    "The map loads automatically with a real-time simulation of all 34 turbines.",
    "Click any turbine to open its detail panel showing power output, wind speed, RPM, pitch angle, and status.",
    "Click the offshore substation (OSS) to see transformer loading, voltage levels, and navigate to SCADA.",
    "Click the export cable route for cable specifications, losses, and temperature data.",
    "Click the onshore substation for grid connection details and navigate to the HV Grid dashboard.",
    "Use the KPI ribbon at the top to monitor farm-wide power output, wind speed, and availability.",
    "Toggle map layers (wind field, bathymetry, wake cones, ocean waves) via the layer control panel.",
    "Use P3/P4/P5 quick-access buttons in the header for fast navigation.",
    "Click 'Control Room' to enter fullscreen mode — fills the entire viewport like a real control room.",
  ],
  sections: [
    { name: "KPI Ribbon", description: "Glassmorphic overlay at top showing total farm power (MW), average wind speed (m/s), farm availability (%), and active turbine count." },
    { name: "Turbine Markers", description: "Color-coded status indicators: green = operating, amber = warning/degraded, red = faulted/tripped, gray = offline. Each shows real-time power output on hover." },
    { name: "Offshore Substation (OSS)", description: "Central collection point where 66 kV array cables meet. Contains 66/220 kV transformer, protection relays, and IEC 61850 IEDs." },
    { name: "Export Cable", description: "45 km 220 kV submarine cable from OSS to shore. Click to see loading, losses, and thermal data." },
    { name: "Onshore Substation", description: "220/400 kV transformer connecting to the PSE national grid. Includes STATCOM and shunt reactor." },
    { name: "Layer Controls", description: "Toggle overlays: wind particle field, bathymetry depth shading, wake effect cones, ocean wave animation, and day/night cycle." },
    { name: "Alarm Ticker", description: "Scrolling alert feed showing active alarms across the farm with ISA-18.2 priority color coding." },
    { name: "Environment Panel", description: "Ambient conditions: wind speed/direction, air temperature, wave height, and visibility." },
  ],
  standards: [
    { label: "ISA-101 — Human Machine Interface design", url: "https://en.wikipedia.org/wiki/Human-machine_interface" },
    { label: "ISA-18.2 — Alarm management lifecycle", url: "https://en.wikipedia.org/wiki/Alarm_management" },
    { label: "IEC 61850 — Substation communication networks", url: "https://en.wikipedia.org/wiki/IEC_61850" },
  ],
  learningObjectives: [
    "Understand the physical layout of an offshore wind farm from turbines to grid.",
    "Read and interpret real-time operational KPIs used by control room operators.",
    "Navigate between subsystems using a map-centric control room paradigm.",
    "Recognize turbine status color codes used in industrial SCADA systems.",
  ],
};

// ── P1: Wind Resource & AEP ───────────────────────────────────

export const p1Guide: TrainingGuideData = {
  title: "P1 · Wind Resource & AEP",
  subtitle: "Energy yield assessment using PyWake wake modeling",
  purpose:
    "This dashboard simulates the full energy yield assessment pipeline " +
    "that wind farm developers use to estimate Annual Energy Production (AEP). " +
    "It uses PyWake's Gaussian wake model (Bastankhah–Porté-Agel with TI-dependent expansion), " +
    "a 12-sector wind rose with Weibull fits, and a multiplicative loss cascade to produce P50/P75/P90 estimates.",
  howToUse: [
    "Adjust the Weibull parameters (A = scale, k = shape) in the Sensitivity Panel to model different wind regimes.",
    "Set Turbulence Intensity (TI) — more turbulent air mixes wakes faster, so higher TI lowers wake losses.",
    "Enter the Electricity Price (EUR/MWh) to see revenue; LCOE and IRR are in the Farm Comparison tab.",
    "Click 'Run Analysis' to execute the full PyWake simulation on the backend.",
    "Start with the animated 'What is AEP?' explainer, then read the dashboard top-down: wind resource → wakes → cascade → layouts.",
    "Explore each panel by clicking its (i) icon for detailed explanations.",
    "Try different Weibull parameters to see how wind conditions affect AEP and LCOE.",
  ],
  sections: [
    { name: "KPI Header", description: "Net AEP (P50, with P90), wake loss, net capacity factor, revenue at the set price, and the combined (RSS) uncertainty. P90 is the figure lenders size debt on." },
    { name: "Farm Layout Map", description: "Bird's-eye view of the 34 turbine positions with the prevailing wind. Colour shows per-turbine net AEP — turbines facing the wind produce most." },
    { name: "Wind Rose", description: "12-sector rose at 150 m hub height, stacked by speed class, with the energy share outline. The same rose drives the wake model." },
    { name: "Weibull Distribution", description: "Statistical fit of wind speed probability. The shape (k) and scale (A) parameters define the curve used for energy calculations." },
    { name: "Wake Loss Panel", description: "Per-turbine wake loss, ranked, against the farm-level wake loss. Interior turbines lose most; the most exposed corner loses least." },
    { name: "AEP Cascade", description: "Waterfall from gross to net P50 (wake, blockage, electrical, availability, environmental) and the exceedance curve with P50/P75/P90/P99." },
    { name: "Layout Comparison", description: "Regular vs staggered grid through the same models, with the difference in GWh and M€ per year." },
  ],
  standards: [
    { label: "IEC 61400-1/3/12/15 — Wind turbine and wind farm design standards", url: "https://en.wikipedia.org/wiki/IEC_61400" },
    { label: "IEC 61400-12-1 — Power performance measurements", url: "https://en.wikipedia.org/wiki/IEC_61400" },
    { label: "ENTSO-E NC RfG — Requirements for generators (EU Regulation 2016/631)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0631" },
    { label: "PyWake open-source wake model (DTU Wind Energy)", url: "https://doi.org/10.5194/wes-6-627-2021" },
  ],
  learningObjectives: [
    "Fit Weibull distributions to wind data and interpret shape/scale parameters.",
    "Calculate AEP using power curves and wind speed distributions.",
    "Quantify wake losses and understand turbine spacing trade-offs.",
    "Produce P50/P75/P90 energy estimates used for project financing.",
    "Calculate LCOE and understand what drives wind farm economics.",
  ],
};

// ── P2: HV Grid Integration ──────────────────────────────────

export const p2Guide: TrainingGuideData = {
  title: "P2 · HV Grid Integration",
  subtitle: "Grid-connection studies with pandapower and transparent dynamic models",
  purpose:
    "This dashboard runs the studies a grid-connection application is built on: load flow in four operating " +
    "cases, reactive compensation against the PSE reactive range, IEC 60909 breaker duty, fault ride-through " +
    "against PSE's type-D profile and a grid-following vs grid-forming comparison after a phase jump.",
  howToUse: [
    "Click 'Run Analysis' — all studies run in parallel (a few seconds).",
    "Use the scenario tabs (diagram or loading panel) to switch between full load, part load, no load and N-1.",
    "In the FRT panel, place the fault (400 kV grid fault vs internal 66 kV fault), size it and change K — the traces redraw.",
    "In the grid-strength panel, pick strong / weak / very weak grid and the phase jump; watch the GFL PLL lose step.",
    "Open the cap icon on any panel for formulas, a worked example with these numbers, and sources.",
  ],
  sections: [
    { name: "KPI Header", description: "Power delivered to PSE and losses, farm bus voltage band, worst breaker duty, reactive range at the POC vs PSE, FRT verdict." },
    { name: "Single-line diagram", description: "The power path with live MW, loading and busbar voltages from the selected load flow; flow speed ∝ MW." },
    { name: "Voltage along the connection", description: "Voltage from PSE 400 kV to the last turbine of string 1 for all four scenarios, against the 0.95–1.05 pu planning band." },
    { name: "Thermal loading", description: "Export cables, both transformer stages and each string's head cable as a share of rating." },
    { name: "Reactive power", description: "No-load balance (260 MVAR cable charging, 240 MVAR reactors, STATCOM range) and the Q range at the POC vs PSE Art. 21(3)(c)." },
    { name: "Breaker duty", description: "IEC 60909 Ik'' and ip as a share of each busbar's breaking and making rating." },
    { name: "Fault ride-through", description: "Quasi-static phasor model: POC and terminal voltage vs the PSE profile, K-factor reactive current, power recovery within 5 s." },
    { name: "Grid-following vs grid-forming", description: "SMIB simulation after a grid phase jump: PLL synchronisation vs virtual-inertia response; SCR at POC vs at the turbines." },
  ],
  standards: [
    { label: "PSE — Wymogi ogólnego stosowania wynikające z NC RfG (18-12-2018)", url: "https://www.pse.pl/documents/20182/31216853/20181218_Wymogi_ogolnego_stosowania_OSP_i_OSD.pdf" },
    { label: "Commission Regulation (EU) 2016/631 — NC RfG", url: "https://eur-lex.europa.eu/eli/reg/2016/631/oj" },
    { label: "IEC 60909 — Short-circuit current calculations", url: "https://en.wikipedia.org/wiki/Short-circuit_current" },
    { label: "IEC 60287 — Current rating of cables", url: "https://en.wikipedia.org/wiki/IEC_60287" },
  ],
  learningObjectives: [
    "Read a load flow: where voltage rises and drops, and why reactive power moves it in HV networks.",
    "Explain the difference between the Ferranti effect and the voltage rise from uncompensated charging current.",
    "Check breaker breaking and making duty from IEC 60909 results.",
    "Judge a fault ride-through against a grid-code profile, and see what the K factor buys.",
    "Explain why a strong grid at the POC can be weak at the turbine terminals, and what grid-forming control changes.",
  ],
};

// ── P3: SCADA & Automation ────────────────────────────────────

export const p3Guide: TrainingGuideData = {
  title: "P3 · SCADA & Automation",
  subtitle: "IEC 61850 substation automation and alarm management",
  purpose:
    "This dashboard simulates a full SCADA/HMI system for the offshore substation. " +
    "It features an interactive Single Line Diagram (SLD), IEC 61850 GOOSE messaging " +
    "simulation, ISA-18.2 alarm management, Permit-to-Work safety system, and " +
    "Role-Based Access Control — all designed to ISA-101 control room standards.",
  howToUse: [
    "The dashboard loads automatically with the IEC 61850 device registry and alarm system.",
    "Select a Fault Scenario from the dropdown (e.g., busbar fault, transformer overload).",
    "Click 'Run GOOSE Sim' to inject the fault and watch GOOSE messages propagate through IEDs.",
    "Enable 'Auto-Sim' for continuous random fault injection at configurable intervals.",
    "Change your Role (L1-L5) to see how RBAC restricts access to different operations.",
    "Click equipment in the SLD to see device details and IEC 61850 logical nodes.",
    "Use the tab bar to switch between GOOSE Sim, Event Log, Permits, and RBAC panels.",
    "Click 'Control Room' for fullscreen mode with SLD + alarm sidebar layout.",
  ],
  sections: [
    { name: "Substation SLD", description: "Interactive single-line diagram showing busbars (400/220/66 kV), circuit breakers, disconnectors, transformers, and IED connections. Equipment colors follow ISA-101: green = energized, red = de-energized." },
    { name: "Alarm List", description: "Real-time alarms following ISA-18.2 lifecycle: UNACK → ACTIVE → ACK → CLEARED. Priority levels: CRITICAL (red, flashing), HIGH (orange), MEDIUM (yellow), LOW (cyan)." },
    { name: "GOOSE Simulation", description: "Visualizes IEC 61850 GOOSE publish-subscribe messaging between IEDs. Shows StNum (state changes), SqNum (retransmissions), and sub-4ms latency." },
    { name: "Event Log", description: "Chronological Sequence of Events with millisecond timestamps. Essential for post-disturbance analysis and regulatory reporting." },
    { name: "Permit-to-Work", description: "Digital PTW system: Draft → Submitted → Approved → Active → Closed. Requires LOTO verification before work begins on HV equipment." },
    { name: "RBAC Panel", description: "Role-Based Access Control matrix: Viewer (L1) = read-only, Operator (L2) = control, Engineer (L4) = configure, Admin (L5) = full access." },
    { name: "KPI Header", description: "Compact metrics: active alarms, GOOSE latency, IED status, system health percentage." },
    { name: "Control Room Mode", description: "Fullscreen view with SLD (75% width), alarm sidebar (25%), and bottom measurement ribbon showing real-time voltage/current/power per busbar." },
  ],
  standards: [
    { label: "IEC 61850 — Communication networks for power utility automation", url: "https://en.wikipedia.org/wiki/IEC_61850" },
    { label: "IEC 61850-8-1 — GOOSE protocol specification", url: "https://en.wikipedia.org/wiki/IEC_61850" },
    { label: "ISA-18.2 / IEC 62682 — Alarm management lifecycle", url: "https://en.wikipedia.org/wiki/Alarm_management" },
    { label: "ISA-101 — Human-machine interface design", url: "https://en.wikipedia.org/wiki/Human-machine_interface" },
    { label: "IEC 62443 — Industrial OT cybersecurity", url: "https://en.wikipedia.org/wiki/IEC_62443" },
    { label: "IEC 62351 — Data and communications security", url: "https://en.wikipedia.org/wiki/IEC_62351" },
    { label: "BS 6626 — Maintenance of electrical switchgear and controlgear" },
  ],
  learningObjectives: [
    "Read and interact with a substation Single Line Diagram (SLD).",
    "Understand IEC 61850 GOOSE messaging and its role in protection.",
    "Manage alarms using the ISA-18.2 lifecycle (shelve, acknowledge, clear).",
    "Operate a Permit-to-Work safety system for HV equipment.",
    "Understand role-based access control in industrial SCADA systems.",
    "Use Control Room Mode for focused operational monitoring.",
  ],
};

// ── P4: AI Forecasting ────────────────────────────────────────

export const p4Guide: TrainingGuideData = {
  title: "P4 · AI Forecasting",
  subtitle: "Wind power prediction using XGBoost, LSTM, and Temporal Fusion Transformer",
  purpose:
    "This dashboard demonstrates a full ML forecasting pipeline for wind power prediction. " +
    "Three model architectures — XGBoost (gradient boosting), LSTM (recurrent neural network), " +
    "and TFT (transformer with attention) — are trained and compared. SHAP explainability " +
    "shows which features drive predictions, and revenue impact quantifies the financial value of accurate forecasting.",
  howToUse: [
    "Select a turbine (WTG_01 to WTG_34) from the dropdown.",
    "Choose a Forecast Horizon: 24 hours (144 steps) or 48 hours (288 steps).",
    "Set the Ramp Threshold (MW/hr) — defines what constitutes a significant power ramp event.",
    "Enter a Spot Price (EUR/MWh) for revenue impact calculations.",
    "Click 'Run Forecast Analysis' to train and evaluate all three models.",
    "Watch the progress bar as models train sequentially (XGBoost → LSTM → TFT → Ensemble).",
    "Compare model performance in the dashboard panels. Click (i) on each panel for details.",
  ],
  sections: [
    { name: "KPI Header", description: "Five metrics: RMSE (root mean square error), MAE (mean absolute error), Skill Score (improvement over persistence), Capacity Factor (%), and predicted revenue impact." },
    { name: "Forecast vs Actual", description: "Time series overlay of P10/P50/P90 prediction bands against measured power output. P50 should track actuals; the P10-P90 band captures uncertainty." },
    { name: "Model Comparison", description: "Side-by-side RMSE/MAE comparison of XGBoost, LSTM, and TFT. XGBoost excels at short horizons (<6h), TFT at longer horizons (24-48h)." },
    { name: "SHAP Explainability", description: "SHapley Additive exPlanations showing feature importance. Red dots right = high values push prediction up. Wind speed is typically the dominant feature." },
    { name: "Accuracy Heatmap", description: "Error by hour-of-day and month-of-year. Reveals systematic patterns: higher errors during dawn/dusk transitions and winter storms." },
    { name: "Revenue Impact", description: "Financial value of improved forecasting vs persistence baseline. Better forecasts reduce imbalance penalties and increase day-ahead market revenue." },
  ],
  standards: [
    { label: "IEC 61400-26-2 — Production-based availability for wind turbines", url: "https://en.wikipedia.org/wiki/IEC_61400" },
    { label: "Lundberg & Lee (2017) — SHAP unified model explanations (arXiv)", url: "https://arxiv.org/abs/1705.07874" },
    { label: "Lim et al. (2021) — Temporal Fusion Transformer (arXiv)", url: "https://arxiv.org/abs/1912.09363" },
    { label: "Chen & Guestrin (2016) — XGBoost (arXiv)", url: "https://arxiv.org/abs/1603.02754" },
  ],
  learningObjectives: [
    "Compare ML architectures for time-series forecasting (boosting vs RNN vs transformer).",
    "Interpret RMSE, MAE, and Skill Score as forecast quality metrics.",
    "Use SHAP values to explain which input features drive model predictions.",
    "Evaluate forecast accuracy across different time horizons and seasons.",
    "Quantify the economic value of improved wind power forecasting.",
  ],
};

// ── P5: HV Commissioning ──────────────────────────────────────

export const p5Guide: TrainingGuideData = {
  title: "P5 · HV Commissioning Simulator",
  subtitle: "30-step switching programme with LOTO, SAT, and Grid Code compliance",
  purpose:
    "This simulator walks through the complete HV commissioning process for the " +
    "offshore substation — from first energization to grid code compliance testing. " +
    "It includes a 30-step switching programme, Lock-Out Tag-Out (LOTO) safety system, " +
    "Factory/Site Acceptance Testing (FAT/SAT), anomaly injection, and emergency response procedures.",
  howToUse: [
    "Enter a Person-in-Charge (PiC) name and click 'Create' to generate a new 30-step switching programme.",
    "Click 'Start' on a created programme to begin the commissioning sequence.",
    "Once inside the dashboard, the left panel shows the equipment state diagram (SLD) and switching steps.",
    "Use the PiC Decision Panel (right side) to approve, reject, or add comments to each step.",
    "Review the LOTO Tracker to verify isolation points are locked before work begins.",
    "Check the FAT/SAT Tracker for test completion status.",
    "Use the Anomaly Injection panel to simulate unexpected events (e.g., protection trip during energization).",
    "The Emergency Response panel provides procedures for emergency shutdown.",
    "The Grid Code Compliance panel verifies all PSE requirements are met before commercial operation.",
  ],
  sections: [
    { name: "Equipment State Diagram", description: "XYFlow-based SLD showing equipment transitioning through states: isolated (gray) → earthed (cyan) → de-energized (amber) → energized (green). Updates as switching steps execute." },
    { name: "Switching Programme Viewer", description: "30-step sequential procedure. Each step has: action description, interlocks (pre-conditions), PiC authorization, and timestamp. Steps cannot be skipped." },
    { name: "PiC Decision Panel", description: "The Person-in-Charge approves or rejects each step with mandatory comments. This is the safety gate — no step executes without PiC authorization." },
    { name: "LOTO Tracker", description: "Lock-Out Tag-Out system. Each isolation point must be locked (physical padlock) and tagged (warning label) before work begins. Verify = test de-energization." },
    { name: "Audit Trail", description: "Immutable log of all commissioning actions with timestamps, operator identity, and authorization details. Required for SAT sign-off and regulatory compliance." },
    { name: "FAT/SAT Tracker", description: "Factory Acceptance Test (at manufacturer) and Site Acceptance Test (on-site) completion status for each piece of equipment." },
    { name: "Anomaly Injection", description: "Simulate unexpected events during commissioning: protection trip, communication failure, earthing fault. Tests operator response to abnormal situations." },
    { name: "Emergency Response", description: "Emergency shutdown procedures: emergency stop sequence, evacuation protocol, and incident reporting workflow." },
    { name: "Grid Code Compliance", description: "Automated verification of PSE IRiESP + ENTSO-E NC RfG Type D requirements: FRT, frequency response, reactive power, power quality." },
  ],
  standards: [
    { label: "BS 6626 — Maintenance of electrical switchgear and controlgear" },
    { label: "DNV-ST-0145 — Offshore substations" },
    { label: "OSHA 29 CFR 1910.147 — Control of hazardous energy (LOTO)", url: "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.147" },
    { label: "IEC 62271-200 — AC metal-enclosed switchgear", url: "https://en.wikipedia.org/wiki/Switchgear" },
    { label: "PSE IRiESP — Polish transmission grid operating manual", url: "https://www.pse.pl/en/transmission-system-operator/regulatory-framework/iriesp" },
    { label: "ENTSO-E NC RfG Type D — Requirements for generators (EU Reg. 2016/631)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0631" },
  ],
  learningObjectives: [
    "Execute a 30-step HV switching programme safely and sequentially.",
    "Apply LOTO procedures for hazardous energy isolation.",
    "Understand the PiC (Person-in-Charge) authorization workflow.",
    "Distinguish FAT and SAT testing phases in commissioning.",
    "Respond to anomalies during HV equipment energization.",
    "Verify grid code compliance before commercial operation.",
  ],
};

// ── Turbine Physics ───────────────────────────────────────────

export const turbinePhysicsGuide: TrainingGuideData = {
  title: "Turbine Physics",
  subtitle: "Dynamic simulation of V236-15.0 MW aerodynamics and control",
  purpose:
    "This simulator models the real-time physics of a single V236-15.0 MW turbine: " +
    "aerodynamic torque from the Cp(TSR, pitch) surface, rotor inertia dynamics, " +
    "PI pitch controller, and yaw tracking. It lets you explore how wind changes " +
    "affect power output, rotor speed, and blade pitch angle.",
  howToUse: [
    "Select a Wind Scenario: Constant Wind, Step Response, or Oscillating Wind.",
    "For 'Constant Wind': set a single wind speed to observe steady-state behavior.",
    "For 'Step Response': set initial and final wind speeds with ramp duration to study transient response.",
    "For 'Oscillating Wind': set mean, amplitude, and period to simulate gusty conditions.",
    "Adjust Simulation Settings: timestep (dt), initial rotor speed, and air density.",
    "Click 'Run Simulation' to compute the time-domain response.",
    "Study the 4 result charts to understand turbine dynamics and control response.",
  ],
  sections: [
    { name: "KPI Header", description: "Key metrics: average power (MW), max rotor speed (rpm), mean pitch angle (deg), average Cp (power coefficient), and capacity factor (%)." },
    { name: "Power vs Time", description: "Time series of electrical power output (MW). Shows how the turbine responds to wind changes — ramp-up, rated power plateau, and pitch-limited operation." },
    { name: "Rotor Speed & Pitch", description: "Dual-axis plot: rotor speed (rpm, left axis) and blade pitch angle (deg, right axis). The PI pitch controller feathers blades above rated wind speed to limit power at 15 MW." },
    { name: "Cp Surface", description: "3D surface plot of power coefficient Cp as a function of Tip-Speed Ratio (TSR) and pitch angle. The Betz limit (0.593) is shown. Maximum Cp ≈ 0.48 at optimal TSR ≈ 8." },
    { name: "TSR-Cp-Yaw Chart", description: "Shows operating point trajectory on the Cp curve during simulation, plus yaw tracking error. Optimal operation follows the maximum-Cp ridge." },
  ],
  standards: [
    { label: "IEC 61400-1/12 — Wind turbine design and performance standards", url: "https://en.wikipedia.org/wiki/IEC_61400" },
    { label: "Betz (1920) — Maximum theoretical power coefficient Cp = 16/27 ≈ 0.593" },
    { label: "Sørensen & Larsen (2021) — Wind turbine aerodynamics (DTU Wind Energy)", url: "https://doi.org/10.11581/DTU.00000016" },
  ],
  learningObjectives: [
    "Understand the Cp(TSR, pitch) aerodynamic surface and Betz limit.",
    "Explain how PI pitch control limits power output above rated wind speed.",
    "Analyze transient response to wind speed step changes.",
    "Relate Tip-Speed Ratio (TSR) to optimal rotor operation.",
    "Understand the relationship between wind speed, rotor speed, pitch, and power.",
  ],
};

// ── Digital Twin ──────────────────────────────────────────────

export const digitalTwinGuide: TrainingGuideData = {
  title: "Digital Twin",
  subtitle: "ISO 13374-1 condition monitoring and anomaly detection",
  purpose:
    "This dashboard implements a digital twin approach to condition monitoring: " +
    "a physics-based model predicts expected turbine behavior, residuals (actual minus predicted) " +
    "are tracked with EWMA smoothing, and health scores detect degradation. " +
    "It follows the ISO 13374-1 pipeline: Data Acquisition → Detection → Assessment → Prognosis.",
  howToUse: [
    "Select a Fault Scenario: Healthy (no faults), Blade Icing, Gearbox Degradation, Pitch Malfunction, Generator Derating, or Sensor Drift.",
    "Set the number of Timesteps (each = 10 minutes) and Turbines to analyze.",
    "Click 'Run Analysis' to simulate SCADA data and compare against physics predictions.",
    "Study the health map to identify which turbines are degrading.",
    "Use the residual time series to see when anomalies first appear.",
    "Check Remaining Useful Life (RUL) estimates for degrading components.",
  ],
  sections: [
    { name: "KPI Header", description: "Key metrics: farm health score (%), anomaly count, mean residual, worst-case RUL (days), and detection accuracy." },
    { name: "Farm Health Map", description: "Grid/map view of all turbines colored by health score: green (>80%) = healthy, amber (50-80%) = warning, red (<50%) = alarm. Quickly identifies which turbines need attention." },
    { name: "Twin Comparison", description: "Side-by-side time series: physics prediction (blue) vs actual SCADA data (orange). Persistent divergence indicates a developing fault." },
    { name: "Residual Time Series", description: "Actual-minus-predicted residuals with EWMA smoothing (span=24, ~4 hours). Residuals drifting outside ±2σ trigger anomaly detection alerts." },
    { name: "Health Trend", description: "Health score over time: H = 100 × exp(-|EWMA| / σ). Weighted: 50% power, 30% RPM, 20% pitch. Declining trend indicates progressive degradation." },
    { name: "Anomaly Classification", description: "Categorizes detected anomalies by type (icing, gearbox, pitch, etc.) and severity. Uses pattern matching on residual signatures." },
  ],
  standards: [
    { label: "ISO 13374 — Condition monitoring and diagnostics of machines", url: "https://en.wikipedia.org/wiki/Condition_monitoring" },
    { label: "IEC 61400-25 — Communications for monitoring wind power plants", url: "https://en.wikipedia.org/wiki/IEC_61400" },
    { label: "Zaher et al. (2009) — Online wind turbine fault detection (survey)", url: "https://doi.org/10.1016/j.rser.2015.12.219" },
  ],
  learningObjectives: [
    "Build a digital twin using physics-based predictions vs SCADA data.",
    "Apply EWMA smoothing to detect slow-developing anomalies.",
    "Calculate health scores from weighted residual metrics.",
    "Estimate Remaining Useful Life (RUL) from health degradation trends.",
    "Classify anomaly types by residual pattern signatures.",
    "Follow the ISO 13374-1 pipeline: Data → Detection → Assessment → Prognosis.",
  ],
};

import type { InfoContent } from "../components/ui/InfoButton";

/**
 * Information content for all dashboard panels.
 * Each panel gets an (i) button in the top-right corner
 * that opens a dialog explaining the component.
 */

// ── P1 Wind Resource ──
// (Migrated to deep EducationContent under constants/education/p1/.)

// ── P2 HV Grid ──

export const voltageProfileInfo: InfoContent = {
  title: "Voltage Profile — Bus Voltage Magnitude",
  description:
    "Shows steady-state voltage at each bus in the HV network from load flow analysis. " +
    "Voltages should stay within ±5% of nominal per grid code.",
  standard: "IEC 60038 — Standard voltages + PSE IRiESP Grid Code",
  parameters: [
    { name: "66 kV array", description: "Nominal 66 kV (±5% = 62.7–69.3 kV)" },
    { name: "220 kV export", description: "Nominal 220 kV (±5%)" },
    { name: "400 kV PCC", description: "Point of Common Coupling to PSE grid" },
  ],
  interpretation:
    "Green zone = within limits. Voltages dropping below 0.95 pu indicate " +
    "cable overloading or insufficient reactive power compensation.",
};

export const cableLoadingInfo: InfoContent = {
  title: "Cable Loading — Thermal Utilization",
  description:
    "Shows current loading as percentage of rated ampacity for each cable segment. " +
    "Loading above 100% exceeds thermal limits and risks cable damage.",
  standard: "IEC 60287 — Current rating of cables",
  parameters: [
    { name: "Ampacity", description: "Maximum continuous current (ambient-adjusted)" },
    { name: "Thermal limit", description: "90°C conductor temperature" },
    { name: "Derating", description: "Applied for seabed burial depth and grouping" },
  ],
  interpretation:
    "Bars approaching 100% need attention. The two parallel export cables (45 km) are typically " +
    "the most loaded segment under full farm output.",
};

export const shortCircuitInfo: InfoContent = {
  title: "Short Circuit Analysis — Fault Current Levels",
  description:
    "Calculates maximum and minimum fault currents at each bus for protection coordination. " +
    "Protection relays must trip within these ranges.",
  standard: "IEC 60909 — Short-circuit currents in three-phase AC systems",
  parameters: [
    { name: "Ik'' (initial)", description: "Subtransient short-circuit current (kA)" },
    { name: "Ip (peak)", description: "Peak short-circuit current (kA)" },
    { name: "Breaking capacity", description: "CB must exceed calculated fault current" },
  ],
  interpretation:
    "Higher values at buses closer to the grid. Protection settings must be " +
    "coordinated to trip upstream CBs before downstream ones (selectivity).",
};

export const statcomInfo: InfoContent = {
  title: "STATCOM Sizing — Reactive Power Compensation",
  description:
    "Determines the required STATCOM capacity for voltage regulation and grid code compliance. " +
    "Includes ±120 MVAR STATCOM + 3 × 80 MVAR (N+1) shunt reactors for the ~260 MVAR charging power of the two export cables.",
  standard: "ENTSO-E NC RfG Type D + PSE IRiESP reactive power requirements",
  parameters: [
    { name: "STATCOM", description: "±120 MVAR (full 4-quadrant operation)" },
    { name: "Shunt reactors", description: "3 × 80 MVAR (N+1: one per export cable + one spare, compensates cable capacitance)" },
    { name: "Power factor", description: "0.95 lead to 0.95 lag at PCC" },
  ],
  interpretation:
    "STATCOM must maintain voltage within ±5% during normal operation " +
    "and support voltage during faults (FRT requirement).",
};

export const frtInfo: InfoContent = {
  title: "FRT Simulation — Fault Ride-Through",
  description:
    "Simulates voltage dip at PCC and verifies the wind farm stays connected " +
    "per grid code requirements (phasor model of the farm and grid impedances).",
  standard: "ENTSO-E NC RfG Article 14 — FRT capability for Type D generators",
  parameters: [
    { name: "Voltage dip", description: "0–100% retained voltage at PCC" },
    { name: "Duration", description: "Dip duration (150–700 ms typical)" },
    { name: "Recovery", description: "Must recover to 90% within 1.5 s" },
  ],
  interpretation:
    "The farm must remain connected during the dip and inject reactive current " +
    "to support grid voltage. Disconnection = grid code violation.",
};

export const converterComparisonInfo: InfoContent = {
  title: "Converter Comparison — Grid-Forming vs Grid-Following",
  description:
    "Compares voltage-source (grid-forming) and current-source (grid-following) " +
    "converter control strategies for offshore wind farm grid integration.",
  standard: "ENTSO-E NC RfG — Synthetic inertia requirements",
  interpretation:
    "Grid-forming converters can operate in weak grids and provide virtual inertia. " +
    "Grid-following is simpler but requires strong grid connection.",
};

// ── P3 SCADA ──

export const substationSldInfo: InfoContent = {
  title: "Single-Line Diagram — Export System",
  description:
    "PSE 400 kV connection point → 2 × 300 MVA onshore transformers → 2 × 45 km 220 kV export cables → " +
    "OSS 220 kV busbar (STATCOM, shunt reactors) → 2 × 300 MVA OSS transformers → split 66 kV switchboard " +
    "(section A: strings 1–3, section B: strings 4–6, bus coupler normally open).",
  standard: "IEC 60617 symbols · IEC 61850-7-2 select-before-operate · ISA-101 colours",
  parameters: [
    { name: "Breaker", description: "Filled = closed, hollow = open, red = tripped by protection" },
    { name: "SBO", description: "Click selects a breaker; Execute operates it after the RBAC and interlock checks" },
    { name: "Interlock", description: "Bus coupler closes only with one incomer open — no parallel operation of the OSS transformers" },
  ],
  interpretation:
    "Conductors are coloured by voltage level when live and grey when dead. Opening a feeder or incomer " +
    "de-energises its strings: the turbines drop to 0 MW and the plant overview follows. After a transformer " +
    "trip, section A can be restored through the bus coupler — watch the remaining transformer load.",
};

export const gooseSimInfo: InfoContent = {
  title: "GOOSE protection — IEC 61850-8-1",
  description:
    "A protection IED publishes the trip as a GOOSE message (Ethernet layer 2, multicast); every breaker bay " +
    "subscribes. The scenarios use IEC 60909 fault currents from the P2 pandapower model (OSS 220 kV Ik'' ≈ 9.1 kA).",
  standard: "IEC 61850-8-1 (GOOSE) · IEC 61850-5 (transfer time class TT6 ≤ 3 ms) · IEC 60909-0",
  parameters: [
    { name: "stNum", description: "State number — increments when the dataset changes (the trip)" },
    { name: "sqNum", description: "Sequence number — increments on every repetition of the same state" },
    { name: "Retransmission", description: "Sent at once, repeated after T0, 2·T0, 4·T0 … up to T_max (heartbeat)" },
  ],
  interpretation:
    "Clearing time = protection operate + GOOSE + trip coil + breaker opening + arcing. The 100 ms main-protection " +
    "target keeps the plant inside the PSE fault-ride-through profile (0 pu for 150 ms).",
};

export const alarmListInfo: InfoContent = {
  title: "Alarm list — ISA-18.2 alarm management",
  description:
    "Active alarms by priority. Lifecycle: UNACK → ACK → RTN; an alarm returns to normal only when its condition " +
    "clears (turbine reset, tripped breakers re-closed). Shelving hides a nuisance alarm without acknowledging it.",
  standard: "ISA-18.2 / IEC 62682 · EEMUA 191",
  parameters: [
    { name: "P1", description: "Substation protection trip — a busbar section or the whole farm lost" },
    { name: "P2", description: "Turbine stop needing a crew soon (pitch, hydraulics, vibration)" },
    { name: "P3", description: "Turbine derating or a local trip with a remote reset" },
    { name: "P4", description: "Efficiency or ageing issue for the next service visit" },
  ],
  interpretation:
    "Priority follows consequence × time to respond. More than 10 alarms in 10 minutes is an EEMUA 191 flood; " +
    "every transition is journaled for the KPIs on Engineering → Alarm Rationalisation.",
};

export const eventLogInfo: InfoContent = {
  title: "Event log — sequence of events",
  description:
    "Session record of protection steps, breaker operations, interlock refusals and turbine faults with " +
    "millisecond time stamps. The persistent record is the SOE recorder (Diagnostics).",
  standard: "IEC 61850-7-2 time stamps (1 ms class) · IEEE C37.232 (record naming)",
  interpretation:
    "Newest first. A protection sequence lasts < 100 ms, so compare milliseconds, not seconds.",
};

export const permitWorkflowInfo: InfoContent = {
  title: "Permit to Work — safety authorisation for HV work",
  description:
    "Nine-state lifecycle: requested → risk assessed → approved → isolated → LOTO applied → active → " +
    "work complete → LOTO removed → closed (cancellable while open). Every transition needs an RBAC permission " +
    "and is written to the audit trail.",
  standard: "EN 50110-1 (five safety rules) · OSHA 1910.147 (LOTO) · IEC 62351-8 roles",
  parameters: [
    { name: "Isolation", description: "Disconnect and secure against reconnection before anything else" },
    { name: "LOTO", description: "Personal locks and danger tags on every isolation point" },
    { name: "Active", description: "Absence of voltage verified, earthing applied — work may start; validity 12 h" },
  ],
  interpretation:
    "Buttons the current role may not use stay disabled (switch the role in the toolbar). " +
    "Approval needs a senior operator, isolation and LOTO an operator with ptw_isolate / ptw_loto.",
};

export const rbacInfo: InfoContent = {
  title: "RBAC — role-based access control",
  description:
    "Five roles with explicit permissions. The SCADA enforces them: switchgear needs control_switchgear " +
    "(L2+), permit approval ptw_approve (L3+), IED configuration config_ied (L4+).",
  standard: "IEC 62351-8 (roles) · IEC 62443-3-3 SR 2.1 (authorisation enforcement)",
  parameters: [
    { name: "L1 Viewer", description: "Read-only" },
    { name: "L2 Operator", description: "Acknowledge alarms, operate switchgear" },
    { name: "L3 Senior operator", description: "Approve permits, isolation, LOTO" },
    { name: "L4 Engineer", description: "IED configuration, permit lifecycle" },
    { name: "L5 Administrator", description: "Users and system administration" },
  ],
};

export const runGooseSimButtonInfo: InfoContent = {
  title: "Inject a protection fault",
  description:
    "Runs the protection sequence on the backend: fault → differential protection operates → GOOSE trip → " +
    "breakers open → arc extinguished. The breakers trip on the single-line diagram, one P1 alarm is raised and " +
    "the SOE log records the operate and opening times.",
  standard: "IEC 61850-8-1 (GOOSE) · IEC 61850-5 (TT6 ≤ 3 ms) · IEC 60909-0 (fault current)",
  parameters: [
    { name: "Busbar fault", description: "87B trips the 4 bays of the OSS 220 kV busbar — farm disconnected" },
    { name: "Transformer fault", description: "87T trips TX-OSS-01 — section A dead until transferred" },
    { name: "Cable fault", description: "87L opens both ends of export cable 1 — farm on cable 2" },
  ],
  interpretation:
    "Restore by re-closing the breakers on the single-line diagram (the alarm then returns to normal). " +
    "After the transformer trip, section A can be fed through the bus coupler — watch TX-OSS-02 loading.",
};

export const autoSimButtonInfo: InfoContent = {
  title: "Auto-simulation",
  description:
    "Injects a random turbine fault every 45–90 s (first one after ~3 s) on top of the farm simulation's own " +
    "random faults and remote resets. Turbine faults never trip substation breakers.",
  standard: "ISA-18.2 / IEC 62682 — alarm management practice",
  parameters: [
    { name: "Interval", description: "Random 45–90 s" },
    { name: "Fault classes", description: "10 turbine classes from the master alarm database" },
  ],
  interpretation:
    "Practise acknowledging and shelving. EEMUA 191 target: about 1 alarm per 10 minutes in steady operation.",
};

export const controlRoomButtonInfo: InfoContent = {
  title: "Control room mode",
  description:
    "Fullscreen workstation view: plant overview banner, the single-line diagram and a compact alarm list.",
  standard: "ISA-101 (HMI hierarchy) · EEMUA 201 (control room HMI)",
  interpretation: "Press Esc or Exit to return to the dashboard.",
};

// ── P4 Forecasting ──

export const forecastVsActualInfo: InfoContent = {
  title: "Forecast vs Actual — Prediction Accuracy",
  description:
    "Overlays model predictions (P10/P50/P90 bands) against actual measured power output. " +
    "The P50 line should track actuals closely; P10-P90 band captures uncertainty.",
  standard: "IEC 61400-26-2 — Production-based availability",
  parameters: [
    { name: "P50", description: "Median forecast (50% probability of exceedance)" },
    { name: "P10/P90", description: "Uncertainty band (80% confidence interval)" },
    { name: "RMSE", description: "Root Mean Square Error (MW)" },
  ],
  interpretation:
    "P50 should be unbiased (equal over/under predictions). " +
    "Actuals falling outside P10-P90 band more than 20% of the time indicates poor calibration. " +
    "Causality: every point is a 10-min-ahead forecast from SCADA measured up to t−1 plus the NWP " +
    "forecast for t — the measured wind at t is never an input. A skill near 1.0 against persistence " +
    "would mean the model saw the future (it would just be fitting the power curve).",
};

export const modelComparisonInfo: InfoContent = {
  title: "Model Comparison — XGBoost vs LSTM vs TFT",
  description:
    "Side-by-side comparison of three ML model architectures on the same test data. " +
    "Each model has different strengths for different forecast horizons.",
  parameters: [
    { name: "XGBoost", description: "Gradient boosting — best for short horizons (< 6h)" },
    { name: "LSTM", description: "Recurrent neural network — good for 6–24h" },
    { name: "TFT", description: "Temporal Fusion Transformer — best for 24–48h" },
    { name: "Ensemble", description: "Weighted blend of all three models" },
  ],
  interpretation:
    "Lower RMSE = better accuracy. The ensemble should outperform individual models " +
    "by combining their complementary strengths across horizons.",
};

export const shapInfo: InfoContent = {
  title: "SHAP — Feature Importance Explainability",
  description:
    "SHAP (SHapley Additive exPlanations) values show which input features " +
    "most influence the model's power predictions. Higher |SHAP| = more influence.",
  standard: "Lundberg & Lee (2017) — SHAP framework",
  parameters: [
    { name: "Wind speed", description: "Typically the dominant feature" },
    { name: "Direction", description: "Affects wake losses" },
    { name: "Temperature", description: "Air density effect on power" },
    { name: "Hour/month", description: "Temporal patterns" },
  ],
  interpretation:
    "Red dots on the right = high feature values pushing prediction UP. " +
    "Blue dots on the left = low feature values pushing prediction DOWN.",
};

export const accuracyHeatmapInfo: InfoContent = {
  title: "Uncertainty vs Lead Time — P90-P10 Spread",
  description:
    "Shows forecast uncertainty (P90-P10 spread) as a function of lead time. " +
    "A single 48 h forecast does not support an hour-of-day × horizon heatmap " +
    "(each step would map to exactly one cell), so this curve plots the quantity " +
    "the data actually supports.",
  interpretation:
    "Spread should rise monotonically: uncertainty grows with horizon because the " +
    "NWP error band widens and the lagged SCADA features become less informative. " +
    "A flat or shrinking curve suggests the quantile heads are under-dispersed.",
};

export const revenueImpactInfo: InfoContent = {
  title: "Revenue Impact — Forecast Value Assessment",
  description:
    "Quantifies the financial benefit of accurate forecasting vs persistence baseline. " +
    "Better forecasts reduce balancing costs and improve day-ahead market revenue.",
  parameters: [
    { name: "Skill score", description: "% improvement vs persistence model" },
    { name: "Imbalance cost", description: "Penalty for deviating from scheduled output" },
    { name: "Revenue gain", description: "EUR/year benefit from improved accuracy" },
  ],
};

// ── P5 Commissioning ──

export const switchingProgrammeInfo: InfoContent = {
  title: "Switching Programme — 30-Step HV Energization",
  description:
    "Step-by-step procedure for safely energizing HV equipment during commissioning. " +
    "Each step requires Person-In-Charge approval and interlock verification.",
  standard: "BS 6626 + DNV-ST-0145 — Offshore substations commissioning",
  parameters: [
    { name: "Steps", description: "30 sequential switching operations" },
    { name: "PIC", description: "Person In Charge — authorizes each step" },
    { name: "Interlocks", description: "Safety checks before each operation" },
  ],
  interpretation:
    "Green steps = completed. Current step = highlighted. " +
    "Steps cannot be skipped — each depends on the previous one.",
};

export const equipmentSldInfo: InfoContent = {
  title: "Equipment SLD — Commissioning State Diagram",
  description:
    "Shows the current energization state of all HV equipment during commissioning. " +
    "Equipment transitions through: isolated → earthed → de-energized → energized.",
  standard: "IEC 62271-200 — AC metal-enclosed switchgear",
  interpretation:
    "Gray = isolated, cyan = earthed, amber = de-energized, green = energized. " +
    "Follow the switching programme sequence to energize equipment safely.",
};

export const auditTrailInfo: InfoContent = {
  title: "Audit Trail — Commissioning Event Log",
  description:
    "Immutable record of all commissioning actions with timestamps, " +
    "operator identity, and authorization details.",
  standard: "DNV-ST-0145 — Offshore substations documentation",
  interpretation:
    "Every action is logged for regulatory compliance. " +
    "The audit trail is required for Site Acceptance Test (SAT) sign-off.",
};

export const lotoInfo: InfoContent = {
  title: "LOTO — Lock-Out Tag-Out Safety System",
  description:
    "Ensures HV equipment is safely isolated before maintenance work begins. " +
    "Each isolation point must be locked and tagged by authorized personnel.",
  standard: "OSHA 29 CFR 1910.147 — Control of hazardous energy",
  parameters: [
    { name: "Lock", description: "Physical padlock preventing re-energization" },
    { name: "Tag", description: "Warning label identifying lock owner and reason" },
    { name: "Verify", description: "Test that equipment is de-energized after isolation" },
  ],
};

export const protectionSettingsInfo: InfoContent = {
  title: "Protection Settings — Relay Configuration",
  description:
    "Configuration parameters for protective relays (overcurrent, distance, " +
    "differential) that detect faults and trip circuit breakers.",
  standard: "IEC 60255 — Measuring relays and protection equipment",
  parameters: [
    { name: "Pickup", description: "Current/voltage threshold to start timing" },
    { name: "Time dial", description: "Delay before tripping (coordination)" },
    { name: "Curve type", description: "IEC Standard Inverse, Very Inverse, etc." },
  ],
};

export const complianceInfo: InfoContent = {
  title: "Grid Code Compliance — PSE IRiESP Verification",
  description:
    "Automated verification that the wind farm meets all Polish grid code requirements " +
    "before commercial operation is permitted.",
  standard: "PSE IRiESP + ENTSO-E NC RfG Type D",
  parameters: [
    { name: "FRT", description: "Fault Ride-Through capability" },
    { name: "Frequency response", description: "Primary frequency regulation" },
    { name: "Reactive power", description: "Power factor range at PCC" },
    { name: "Power quality", description: "Harmonics, flicker, voltage steps" },
  ],
};

// ── P2 New Modules ──

export const ppcDashboardInfo: InfoContent = {
  title: "PPC — Power Plant Controller",
  description:
    "The Power Plant Controller is the top-level control system that dispatches all 34 turbines " +
    "and the STATCOM in response to TSO (PSE) setpoints. It enforces ramp-rate limits, " +
    "maintains reactive power compliance, and reports state to the SCADA system.",
  standard: "ENTSO-E NC RfG Type D + PSE IRiESP — Grid code for offshore wind ≥ 75 MW",
  parameters: [
    { name: "Power Reference", description: "Follow TSO MW setpoint directly" },
    { name: "Delta Control", description: "Hold a spinning reserve headroom below available capacity" },
    { name: "Absolute Limitation", description: "Cap output regardless of wind (curtailment)" },
    { name: "Ramp Rate Control", description: "Limit MW/min rate of change" },
  ],
  interpretation:
    "PASS = setpoint accuracy ±5%, ramp rate ≤10%Pn/min up / ≤20%Pn/min down, PCC voltage 0.95–1.05 pu. " +
    "WTG pro-rata dispatch means each turbine receives a share proportional to its available capacity.",
};

export const ppcRampChartInfo: InfoContent = {
  title: "Active Power Ramp Response",
  description:
    "Time-series showing how the wind farm tracks a new TSO power setpoint. " +
    "Three traces: Available (what wind provides), Setpoint (TSO demand), Actual (what is dispatched).",
  standard: "PSE IRiESP §6.2 — Ramp-rate limits: ↑10%Pn/min, ↓20%Pn/min, emergency 2%Pn/s",
  parameters: [
    { name: "Ramp time", description: "Seconds to reach steady-state within ±5% of setpoint" },
    { name: "10%Pn/min ↑", description: "Max 51 MW/min ramp-up (510 MW × 10%)" },
    { name: "20%Pn/min ↓", description: "Max 102 MW/min ramp-down (curtailment)" },
  ],
  interpretation:
    "The vertical dotted line marks ramp_time. Setpoint – Actual gap should close within tolerance. " +
    "If Actual lags Setpoint significantly, the ramp-rate limiter is the constraint.",
};

export const ppcVoltageQInfo: InfoContent = {
  title: "PCC Voltage & Reactive Power",
  description:
    "Dual-axis chart showing PCC voltage (left, pu) and reactive power output (right, MVAR) over the simulation horizon. " +
    "Reactive power mode determines how Q is controlled (PI voltage, fixed Q, power factor, or Q(V) droop).",
  standard: "ENTSO-E NC RfG Type D — Q range ±120 MVAR at PCC; PSE IRiESP voltage band 0.95–1.05 pu",
  parameters: [
    { name: "V_pcc", description: "Voltage at point of common coupling (220 kV bus)" },
    { name: "Q", description: "Net reactive power injection (+ = capacitive, – = inductive)" },
    { name: "±120 MVAR", description: "STATCOM range; WTGs contribute additional ±Q" },
  ],
  interpretation:
    "Red dashed lines at 0.95 / 1.05 pu are PSE limits. Voltage should stay inside these bounds at all times. " +
    "Q swings are normal — the PPC adjusts reactive power to regulate voltage.",
};

export const ppcDispatchInfo: InfoContent = {
  title: "WTG Pro-Rata Dispatch",
  description:
    "Stacked bar chart showing each turbine's dispatched MW vs curtailed MW. " +
    "Dispatch uses a pro-rata algorithm: P_i = P_target × (P_avail_i / ΣP_avail).",
  parameters: [
    { name: "Dispatched", description: "MW actually commanded to the turbine (green)" },
    { name: "Curtailed", description: "MW withheld to meet TSO setpoint (amber)" },
    { name: "15 MW line", description: "Rated power per V236-15.0 MW turbine" },
  ],
  interpretation:
    "All bars should reach the rated line under full-wind, no-curtailment conditions. " +
    "Uniform curtailment across turbines = fair pro-rata sharing. Uneven bars indicate availability differences.",
};

export const protectionDashboardInfo: InfoContent = {
  title: "Protection Relay Coordination — M05",
  description:
    "Coordinates overcurrent protection relays from WTG feeder level through OSS to the 220 kV export cable. " +
    "Selectivity ensures only the faulted zone is isolated — upstream relays wait for downstream to trip first.",
  standard: "IEC 60255 — Measuring relays; IEC 60909 — Short-circuit calculations; PSE coordination rules",
  parameters: [
    { name: "Pickup (A)", description: "Minimum fault current to activate the relay" },
    { name: "TMS", description: "Time Multiplier Setting — scales the IEC inverse-time curve" },
    { name: "CTI", description: "Coordination Time Interval: ≥80 ms grading margin between zones" },
  ],
  interpretation:
    "A coordination study injects a simulated fault and checks the relay trip sequence. " +
    "The FIRST relay to trip should be the one closest to the fault. Upstream relays serve as backup.",
};

export const tccCurveInfo: InfoContent = {
  title: "TCC Overlay — Time-Current Characteristic",
  description:
    "Log-log plot of operating time vs fault current multiple (I/I_n) for each protection relay. " +
    "Curves must be separated vertically (time margin) at the fault current level to ensure selectivity.",
  standard: "IEC 60255-151 — Standard inverse-time operating curves (SI, VI, EI)",
  parameters: [
    { name: "I/I_n", description: "Fault current as multiple of relay pickup current (x-axis, log)" },
    { name: "t (s)", description: "Relay operating time in seconds (y-axis, log)" },
    { name: "Red line", description: "Fault current marker — read off operating times at this x-value" },
  ],
  interpretation:
    "At the fault current marker, curves higher on the plot trip later (upstream/backup relays). " +
    "The vertical gap between adjacent curves must be ≥80 ms for proper selectivity.",
};

export const relayCoordinationInfo: InfoContent = {
  title: "Selectivity Grading Table",
  description:
    "Summary of relay grading pairs after running a coordination study. " +
    "Shows the time margin between adjacent relays at the specified fault current level.",
  parameters: [
    { name: "Grading margin", description: "Time difference between adjacent relay trips (must be ≥80 ms)" },
    { name: "PASS", description: "Margin ≥ 80 ms — acceptable selectivity" },
    { name: "FAIL", description: "Margin < 80 ms — relays may both trip, isolating too much" },
  ],
  interpretation:
    "A PASS on all grading pairs means the protection scheme will correctly isolate only the faulted zone. " +
    "If any pair FAILs, adjust TMS or pickup values and re-run the study.",
};

export const powerQualityDashboardInfo: InfoContent = {
  title: "Power Quality — M06 (IEC 61000 Series)",
  description:
    "Monitors harmonics, network resonance, and voltage flicker at the 66 kV Point of Connection. " +
    "The 66 kV bus is classified as IEC HV tier (≥35 kV threshold) — stricter limits apply.",
  standard: "IEC 61000-3-6 (harmonics HV), IEC 61000-3-7 (flicker HV), IEC 61400-21 (wind turbine PQ)",
  parameters: [
    { name: "THD", description: "Total Harmonic Distortion — limit 3% at 66 kV (IEC HV tier)" },
    { name: "H5 limit", description: "5th harmonic — 2% at 66 kV; worst offender in VSC converters" },
    { name: "Pst / Plt", description: "Short/long-term flicker severity — ≤1.0 / ≤0.65 for HV" },
  ],
  interpretation:
    "Green badges = compliant. Red badges = exceeds IEC planning level and requires mitigation (passive filter). " +
    "THD above 3% may require a notch filter at the dominant harmonic order.",
};

export const harmonicSpectrumInfo: InfoContent = {
  title: "Harmonic Spectrum — IEC 61000-3-6",
  description:
    "Bar chart of voltage harmonic magnitudes as % of fundamental (50 Hz) at the assessed bus (400 kV POC by default). " +
    "Orange dashed line = IEC planning level limit for each harmonic order.",
  standard: "IEC 61000-3-6 Table 2 — HV planning levels (≥35 kV): THD 3%, H5 2%, H7 2%, H11 1.5%, H13 1.5%",
  parameters: [
    { name: "H5 (250 Hz)", description: "5th harmonic — dominant in 6-pulse VSC converters" },
    { name: "H7 (350 Hz)", description: "7th harmonic — second largest in VSC output" },
    { name: "H11, H13", description: "Characteristic harmonics of 12-pulse rectifiers" },
  ],
  interpretation:
    "Green bars = within IEC limit. Red bars = exceeds limit and requires filtering. " +
    "THD badge in top-right shows total distortion — must stay ≤3% at 66 kV.",
};

export const resonanceScanInfo: InfoContent = {
  title: "Network Impedance Scan",
  description:
    "Frequency sweep of the Thevenin impedance seen at the 66 kV busbar (0–2500 Hz). " +
    "Parallel resonance peaks occur where impedance spikes — dangerous if a harmonic source coincides with a peak.",
  standard: "IEC 61000-3-6 Annex B — Impedance-based resonance assessment",
  parameters: [
    { name: "Cable resonance", description: "π-model cable: f_res = 1/(2π√(LC)) — falls in 200–800 Hz range for 45 km export" },
    { name: "HIGH risk", description: "Peak aligns with a WTG harmonic injection frequency" },
    { name: "MEDIUM risk", description: "Peak near a harmonic — damping may be insufficient" },
  ],
  interpretation:
    "Peaks above 200 Ω are significant. If a HIGH-risk peak coincides with H5 or H7, " +
    "a passive LC filter must detune the resonance before the farm can export.",
};

export const flickerFilterInfo: InfoContent = {
  title: "Flicker Emission — IEC 61000-3-7",
  description:
    "Flicker measures rapid voltage fluctuations (≤35 Hz) caused by turbine blade shadows, " +
    "tower wakes, and switching operations. Pst is measured over 10 minutes; Plt over 2 hours.",
  standard: "IEC 61000-3-7 Table 1 — HV planning levels: Pst ≤ 1.0, Plt ≤ 0.65",
  parameters: [
    { name: "Pst", description: "Short-term flicker (10 min) — instantaneous annoyance threshold" },
    { name: "Plt", description: "Long-term flicker (2 h) — cumulative effect of intermittent sources" },
    { name: "c_f coefficient", description: "IEC 61400-21 per-turbine flicker coefficient — site + turbine specific" },
  ],
  interpretation:
    "Values below limit = compliant (green). If Pst > 1.0, consider STATCOM voltage regulation or " +
    "installing a passive filter to damp the dominant switching frequency.",
};

// ── Landing Page ──

export const farmOverviewInfo: InfoContent = {
  title: "Wind Farm Overview — Real-Time Status Map",
  description:
    "Interactive map showing all 34 V236-15.0 MW turbines, offshore substation, " +
    "export cable, and onshore connection point. Click any element for details.",
  parameters: [
    { name: "Green turbine", description: "Operating normally" },
    { name: "Amber turbine", description: "Degraded performance or warning" },
    { name: "Red turbine", description: "Faulted or tripped" },
    { name: "Gray turbine", description: "Offline or in maintenance" },
  ],
  interpretation:
    "KPI ribbon at top shows farm-level metrics. " +
    "Click a turbine for individual status or navigate to P1-P5 dashboards for detailed analysis.",
};

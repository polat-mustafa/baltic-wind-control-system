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
    "Bars approaching 100% need attention. The export cable (45 km) is typically " +
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
    "Includes ±120 MVAR STATCOM + 50 MVAR shunt reactor for cable charging.",
  standard: "ENTSO-E NC RfG Type D + PSE IRiESP reactive power requirements",
  parameters: [
    { name: "STATCOM", description: "±120 MVAR (full 4-quadrant operation)" },
    { name: "Shunt reactor", description: "50 MVAR (compensates cable capacitance)" },
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
    "per grid code requirements. Uses ANDES dynamic simulation.",
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
  title: "Single Line Diagram — Substation Topology",
  description:
    "Interactive visualization of the offshore substation electrical topology. " +
    "Shows busbars, circuit breakers, transformers, and IEC 61850 IED connections.",
  standard: "IEC 61850 — Communication networks and systems for power utility automation",
  parameters: [
    { name: "IEDs", description: "Intelligent Electronic Devices (protection, measurement)" },
    { name: "GOOSE", description: "Generic Object Oriented Substation Event (< 4 ms)" },
    { name: "MMS", description: "Manufacturing Message Specification (reporting)" },
  ],
  interpretation:
    "Color indicates equipment state: green = energized, red = de-energized, " +
    "gray = isolated, amber = warning. Click any equipment for details.",
};

export const gooseSimInfo: InfoContent = {
  title: "GOOSE Simulation — IEC 61850 Messaging",
  description:
    "Simulates GOOSE (Generic Object Oriented Substation Event) protocol messaging " +
    "between IEDs. Shows publish-subscribe communication with < 4 ms latency.",
  standard: "IEC 61850-8-1 — GOOSE protocol specification",
  parameters: [
    { name: "StNum", description: "State number (increments on data change)" },
    { name: "SqNum", description: "Sequence number (increments on retransmission)" },
    { name: "TAL", description: "Time allowed to live (retransmit interval)" },
  ],
  interpretation:
    "Green messages = normal operation. Watch for increasing retransmission intervals " +
    "which indicate the event has stabilized (no more changes).",
};

export const alarmListInfo: InfoContent = {
  title: "Alarm List — ISA-18.2 Alarm Management",
  description:
    "Real-time alarm display following ISA-18.2 alarm management lifecycle. " +
    "Alarms are prioritized by criticality and require operator acknowledgment.",
  standard: "ISA-18.2 / IEC 62682 — Management of alarm systems for process industries",
  parameters: [
    { name: "CRITICAL", description: "Immediate danger — requires instant action" },
    { name: "HIGH", description: "Serious deviation — action required within minutes" },
    { name: "MEDIUM", description: "Warning — trending toward alarm condition" },
    { name: "LOW", description: "Advisory — informational only" },
  ],
  interpretation:
    "Unacknowledged alarms flash. Critical alarms require immediate attention. " +
    "Alarm flood (>10 per 10 min) indicates a cascading event.",
};

export const eventLogInfo: InfoContent = {
  title: "Event Log — Sequence of Events",
  description:
    "Chronological record of all events (alarms, status changes, operator actions) " +
    "with millisecond-resolution timestamps for post-event analysis.",
  standard: "IEEE C37.233 — Guide for Power System Protection Testing",
  interpretation:
    "Read bottom-to-top for chronological order. Use timestamps to reconstruct " +
    "the sequence of events during a disturbance.",
};

export const permitWorkflowInfo: InfoContent = {
  title: "Permit to Work — Safety Authorization System",
  description:
    "Digital permit-to-work system for controlling hazardous work on HV equipment. " +
    "Follows a multi-step approval workflow with LOTO isolation verification.",
  standard: "BS 6626 — Maintenance of electrical switchgear and control gear",
  parameters: [
    { name: "PTW states", description: "Draft → Submitted → Approved → Active → Closed" },
    { name: "LOTO", description: "Lock-Out Tag-Out isolation points" },
    { name: "PIC", description: "Person In Charge (safety responsibility)" },
  ],
  interpretation:
    "No work may begin until the permit reaches ACTIVE state. " +
    "All isolation points must be verified and locked before work starts.",
};

export const rbacInfo: InfoContent = {
  title: "RBAC — Role-Based Access Control",
  description:
    "Defines operator roles and permissions for the SCADA system. " +
    "Each role has specific capabilities: view, control, configure, administer.",
  standard: "IEC 62351 — Data and communications security for power systems",
  parameters: [
    { name: "Viewer", description: "Read-only access to all displays" },
    { name: "Operator", description: "Can acknowledge alarms and operate switches" },
    { name: "Engineer", description: "Can modify setpoints and protection settings" },
    { name: "Admin", description: "Full system configuration access" },
  ],
};

export const runGooseSimButtonInfo: InfoContent = {
  title: "Run GOOSE Fault Simulation",
  description:
    "Injects a synthetic fault event at the selected location and simulates the full IEC 61850 " +
    "protection response chain: relay pickup → GOOSE publish → breaker trip → SCADA alarm. " +
    "Results show protection event timeline with millisecond precision and IEC compliance check.",
  standard: "IEC 61850-8-1 §15 — GOOSE protocol performance classes",
  parameters: [
    { name: "P3 class", description: "≤4 ms GOOSE delivery time (protection class)" },
    { name: "Retransmission", description: "Exponential backoff schedule per §15.2.2" },
    { name: "Clearance time", description: "Relay pickup + GOOSE + breaker open (≤80 ms)" },
  ],
  interpretation:
    "IEC COMPLIANT badge = GOOSE latency ≤4 ms and clearance ≤80 ms. " +
    "Fault clearance must be <80 ms for 66 kV array per PSE IRiESP grid code. " +
    "Run different scenarios from the fault dropdown to test each protection zone.",
};

export const autoSimButtonInfo: InfoContent = {
  title: "Auto-Simulation Mode",
  description:
    "Continuously injects random turbine fault alarms on a 45–90 second interval. " +
    "Randomly selects a turbine (WTG-01 to WTG-34) and a fault type from 10 categories. " +
    "Critical faults have a 50% chance of tripping the associated string circuit breaker. " +
    "Use this to practice alarm management and stress-test the SCADA response.",
  standard: "ISA-18.2 / IEC 62682 — Alarm management lifecycle",
  parameters: [
    { name: "Fault interval", description: "Random 45–90 s between injections" },
    { name: "Fault types", description: "10 categories: pitch, vibration, temperature, grid, comms…" },
    { name: "Breaker trip", description: "50% probability for CRITICAL priority faults" },
    { name: "First fault", description: "Fires within ~3 s of starting" },
  ],
  interpretation:
    "Watch the alarm table fill up — practice acknowledging and shelving alarms. " +
    "EEMUA 191 benchmark: ≤1 alarm per 10 min per operator is acceptable. " +
    "Click 'Stop Auto-Sim' to halt injection. Already-active alarms remain until acknowledged.",
};

export const controlRoomButtonInfo: InfoContent = {
  title: "Control Room Mode",
  description:
    "Enters a fullscreen immersive display designed for the main control room workstation. " +
    "Shows the Substation Single Line Diagram at full width with live breaker states, " +
    "a compact alarm sidebar, and a measurement ribbon (400 kV / 220 kV / 66 kV).",
  standard: "EEMUA 201 — Alarm system usability for process control",
  parameters: [
    { name: "SLD", description: "75% width — live substation topology" },
    { name: "Alarm sidebar", description: "25% width — ISA-18.2 alarm table, compact mode" },
    { name: "Measurement ribbon", description: "Bottom bar — MW, A, kV per voltage level" },
  ],
  interpretation:
    "Use during incident response or training exercises. " +
    "Press Esc or click the Exit button to return to normal dashboard view.",
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
    "Actuals falling outside P10-P90 band more than 20% of the time indicates poor calibration.",
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
  title: "Accuracy Heatmap — Error by Hour and Month",
  description:
    "Shows prediction error (MAE or RMSE) across time-of-day and month-of-year. " +
    "Identifies systematic patterns where the model struggles.",
  interpretation:
    "Darker cells indicate higher error. Common patterns: higher error during " +
    "dawn/dusk transitions and winter storms. Use this to identify retraining needs.",
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
    "Bar chart of voltage harmonic magnitudes as % of fundamental (50 Hz) at the 66 kV POC. " +
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

export const bessDashboardInfo: InfoContent = {
  title: "BESS — Battery Energy Storage System (M08)",
  description:
    "50 MW / 200 MWh lithium iron phosphate (LFP) battery co-located at the offshore substation. " +
    "Provides frequency regulation (FCR/FFR), wind ramp smoothing, and TGE market arbitrage.",
  standard: "IEC 62933 — Grid-scale battery storage; ENTSO-E FCR requirements",
  parameters: [
    { name: "50 MW / 200 MWh", description: "Power / energy capacity — C-rate 0.25 (4h discharge)" },
    { name: "SOC window", description: "Operational state-of-charge: 10–90% (180 MWh usable)" },
    { name: "LFP chemistry", description: "Lithium Iron Phosphate — 3000 cycles to 80% SoH, safer than NMC" },
  ],
  interpretation:
    "SOC gauge shows current charge level. Green zone (10–90%) is the safe operating window. " +
    "Red zone (<10%) risks deep discharge damage; amber (>90%) limits absorb capability.",
};

export const bessStatusInfo: InfoContent = {
  title: "BESS Status — Real-Time State",
  description:
    "Real-time snapshot of the BESS operating state from the battery management system (BMS). " +
    "Shows SOC gauge, operating mode, power flow, temperature, and degradation indicators.",
  parameters: [
    { name: "SOC %", description: "State of Charge — % of 200 MWh total capacity" },
    { name: "Power MW", description: "Positive = discharging (exporting), Negative = charging" },
    { name: "SoH %", description: "State of Health — capacity remaining vs new (100% → 80% = EOL)" },
    { name: "Cycles", description: "Equivalent full cycle count — LFP EOL at 3000 cycles" },
  ],
  interpretation:
    "FREQUENCY_RESPONSE mode = FCR/FFR active. RAMP_SMOOTHING = suppressing wind ramp events. " +
    "ARBITRAGE = TGE price-driven charge/discharge. Temperature >40°C triggers thermal derating.",
};

export const bessFrequencyInfo: InfoContent = {
  title: "FCR / FFR Frequency Response",
  description:
    "Simulates the BESS response to a Nordic grid frequency disturbance event. " +
    "FCR (Frequency Containment Reserve) activates proportionally via 5% droop. " +
    "FFR (Fast Frequency Reserve) injects maximum power within 200 ms if frequency drops below 49.7 Hz.",
  standard: "ENTSO-E FCR specification: activation within 30 s; FFR: 200 ms — national variant (Nord Pool/PSE)",
  parameters: [
    { name: "5% droop", description: "FCR droop: 1 Hz deviation → 20% rated power response" },
    { name: "49.7 Hz", description: "FFR threshold — full 50 MW injection activated instantaneously" },
    { name: "Nadir", description: "Minimum frequency reached before FCR/FFR arrests the decline" },
  ],
  interpretation:
    "The frequency trace (blue, left axis) should recover after the nadir. " +
    "BESS power (green dashed, right axis) shows discharge burst. FFR ✓ = full burst activated.",
};

export const bessDegradationInfo: InfoContent = {
  title: "Battery Degradation — 20-Year SoH Projection",
  description:
    "Projects State of Health (SoH%) over the 20-year project lifetime using a rain-flow cycle counting model. " +
    "LFP chemistry: 3000 equivalent full cycles to reach 80% SoH (end-of-life threshold).",
  parameters: [
    { name: "SoH 100%", description: "New battery — full 200 MWh capacity" },
    { name: "SoH 80%", description: "End-of-life (EOL) — battery replacement triggered" },
    { name: "EOL year", description: "Year when SoH reaches 80% based on dispatch cycle count" },
    { name: "LCOE contribution", description: "€/MWh cost allocated to battery replacement in project LCOE" },
  ],
  interpretation:
    "Steeper slope = more aggressive cycling. If EOL year < 10, the BESS is over-cycled — " +
    "reduce daily cycle depth or increase SOC window to extend battery life.",
};

export const cableDtsDashboardInfo: InfoContent = {
  title: "Cable DTS — Distributed Temperature Sensing (M10)",
  description:
    "Monitors temperature along the full 45 km export cable using an IEC 60287 thermal model. " +
    "DTS uses Raman backscatter in fibre optic cable to measure temperature every ~10 m. " +
    "Enables dynamic ampacity rating — increasing cable capacity in cold weather.",
  standard: "IEC 60287 — Current rating of cables; IEC 60840 — HV cable joint limits",
  parameters: [
    { name: "Static rating", description: "800 A — IEC 60287 at 15°C ambient, seabed burial" },
    { name: "J-tube factor", description: "1.4× thermal resistance in air (worse than seabed)" },
    { name: "Warning >70°C", description: "XLPE insulation approaching thermal limit" },
    { name: "Critical >90°C", description: "Maximum conductor temperature — trip if sustained" },
  ],
  interpretation:
    "Adjust current and ambient temperature sliders to model seasonal conditions. " +
    "Dynamic rating increases in winter (cold seabed) and decreases in summer.",
};

export const dtsThermalMapInfo: InfoContent = {
  title: "45 km Cable Temperature Heat Map",
  description:
    "Colour-coded strip showing temperature distribution along the full export cable route. " +
    "Left = offshore substation (0 km); Right = onshore substation (45 km). " +
    "Hover over any segment to see exact temperature and loading percentage.",
  parameters: [
    { name: "Blue (<30°C)", description: "Cold zone — seabed ambient, well below limits" },
    { name: "Green (30–60°C)", description: "Normal operating range for loaded cable" },
    { name: "Amber (60–80°C)", description: "Warning zone — approaching 70°C alarm threshold" },
    { name: "Red (>80°C)", description: "Critical zone — exceeds IEC 60287 thermal limit" },
  ],
  interpretation:
    "The J-tube section (first 0.2 km from OSS) runs in air, giving it the highest temperature. " +
    "White dashed vertical lines mark active hotspot locations.",
};

export const dtsProfileInfo: InfoContent = {
  title: "DTS Temperature Profile — Distance vs Temperature",
  description:
    "Line chart of cable conductor temperature vs distance along the 45 km export route. " +
    "IEC 60287 thermal model: T = T_amb + I² × R_AC × R_thermal × zone_factor.",
  standard: "IEC 60287-1-1 — Current rating equations for cables",
  parameters: [
    { name: "R_thermal", description: "2.989 K·m/W (calibrated for XLPE 630mm² cable in seabed)" },
    { name: "Warning 70°C", description: "Amber dashed line — sustained operation requires review" },
    { name: "Critical 90°C", description: "Red dashed line — XLPE max conductor temperature" },
  ],
  interpretation:
    "Temperature peaks at the J-tube and onshore transition zones where zone_factor = 1.4. " +
    "Vertical marker lines indicate hotspot locations identified by the DTS algorithm.",
};

export const dtsRatingInfo: InfoContent = {
  title: "Dynamic Ampacity Rating",
  description:
    "Calculates the current-carrying capacity of the cable based on real-time ambient temperature. " +
    "Dynamic rating formula: I_dyn = I_static × √((90 − T_amb) / (90 − 15)). " +
    "Winter gives +7%, summer −5% vs static 800 A baseline.",
  standard: "IEC 60287 — Dynamic rating; IEC 60853 — Cyclic and emergency current ratings",
  parameters: [
    { name: "Static rating", description: "800 A — IEC 60287 reference (15°C ambient)" },
    { name: "Dynamic rating", description: "Adjusted for actual ambient temperature" },
    { name: "Headroom", description: "Dynamic − actual current = available thermal margin" },
    { name: "Utilisation %", description: "Actual current / Dynamic rating × 100" },
  ],
  interpretation:
    "Green = <75% utilisation (comfortable). Amber = 75–90% (approaching limit). " +
    "Red = >90% — reduce load or force thermal review. Hotspot list shows worst-case locations.",
};

export const marketDashboardInfo: InfoContent = {
  title: "Market Integration — M11 (TGE / PSE / CfD)",
  description:
    "Optimises the wind farm's participation across three Polish energy markets: " +
    "TGE day-ahead spot market, PSE ancillary services (BSP contracts), and CfD support (OZMB 2024 scheme).",
  standard: "TGE market rules + PSE IRIESP §8 ancillary services + OZMB 2024 offshore wind CfD",
  parameters: [
    { name: "TGE DA", description: "Warsaw day-ahead market — 24h bid submitted by 11:00 D-1" },
    { name: "CfD (OZMB)", description: "Polish offshore wind CfD — ~80 €/MWh strike price (2024 round)" },
    { name: "PSE BSP", description: "Balancing Service Provider — FCR-N, FCR-D, aFRR, mFRR contracts" },
    { name: "BESS arbitrage", description: "Charge at negative/low prices, discharge at peak prices" },
  ],
  interpretation:
    "Total annual revenue = DA market + CfD top-up + ancillary BSP − imbalance penalties. " +
    "CfD strike price compensates when DA market < 80 €/MWh; farm pays back when DA > 80 €/MWh.",
};

export const daBidInfo: InfoContent = {
  title: "Day-Ahead Bid Schedule — TGE",
  description:
    "24-hour bid volume submitted to the TGE (Towarowa Giełda Energii) day-ahead market. " +
    "Red bars indicate hours where the DA price is negative — optimal strategy is to curtail and avoid cost.",
  parameters: [
    { name: "Bid volume (MWh)", description: "Energy offered per hour — left axis (blue bars)" },
    { name: "DA price (€/MWh)", description: "Cleared market price — right axis (amber line)" },
    { name: "Curtailment hours", description: "Red bars: revenue ≤ 0 → bid = 0 (curtail or BESS charge)" },
  ],
  interpretation:
    "Negative DA prices are increasingly common (high solar saturation in Poland). " +
    "BESS arbitrage option charges during negative hours and discharges during the 6 most expensive hours. " +
    "This improves net revenue by €500k–1M/year depending on price volatility.",
};

export const revenueWaterfallInfo: InfoContent = {
  title: "Annual Revenue Breakdown — Waterfall Chart",
  description:
    "Decomposed view of the wind farm's annual revenue from all sources minus costs. " +
    "Each bar shows the incremental contribution (green = adds, red = subtracts).",
  parameters: [
    { name: "DA Market", description: "TGE day-ahead revenue (largest component)" },
    { name: "CfD Support", description: "Polish OZMB 2024 support — top-up when market < 80 €/MWh" },
    { name: "Ancillary", description: "PSE BSP contract value (FCR-N, aFRR, mFRR)" },
    { name: "Imbalance", description: "Cost of deviating from scheduled output (red = cost)" },
    { name: "Net Revenue", description: "Total sum — blue bar" },
  ],
  interpretation:
    "EBITDA is shown in top-right. €/MWh figure = Net Revenue ÷ Annual Generation. " +
    "A 1% MAPE improvement in forecasting reduces imbalance costs by ~2M €/year.",
};

export const ancillaryServicesInfo: InfoContent = {
  title: "Ancillary Services Portfolio — PSE BSP",
  description:
    "Balancing Service Provider (BSP) contracts with PSE (Polish TSO) for frequency regulation services. " +
    "The wind farm + BESS provides a portfolio of services simultaneously.",
  standard: "PSE IRiESP §8 — Ancillary services; ENTSO-E FCR/aFRR/mFRR product specifications",
  parameters: [
    { name: "FCR-N", description: "Frequency Containment Reserve (BESS — ±2.5 MW per 0.1 Hz deviation)" },
    { name: "FCR-D", description: "Fast frequency response from BESS (FFR, activates at 49.7 Hz)" },
    { name: "aFRR", description: "Automatic frequency restoration — WTG delta control (30–200 s response)" },
    { name: "mFRR", description: "Manual frequency restoration — operator-commanded ramp" },
  ],
  interpretation:
    "Availability price (€/MW/h) is paid regardless of activation. " +
    "BSP contract value ≈3.5 M€/year represents ~5% of total project revenue — valuable low-risk income.",
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

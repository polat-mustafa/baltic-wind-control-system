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

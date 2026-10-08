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
    "Bars approaching 100% need attention. The two parallel export cables (76.5 km) are typically " +
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
    "Includes ±120 MVAR STATCOM + 4 × 120 MVAR shunt reactors (one per export cable at each end) for the ~442 MVAR " +
    "charging power of the two export cables.",
  standard: "ENTSO-E NC RfG Type D + PSE IRiESP reactive power requirements",
  parameters: [
    { name: "STATCOM", description: "±120 MVAR (full 4-quadrant operation)" },
    { name: "Shunt reactors", description: "4 × 120 MVAR: one per export cable onshore and one at the OSS, so each cable end carries half the charging current; sized so one can be out" },
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
    "PSE 400 kV connection point → 2 × 300 MVA onshore transformers → 2 × 76.5 km 220 kV export cables → " +
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

export const p5SldInfo: InfoContent = {
  title: "Circuit 1 single-line diagram",
  description:
    "Export circuit 1 from the live onshore 220 kV busbar to strings 1–3. Colours come from " +
    "the backend's zone analysis: a conductor is live (voltage colour), earthed (magenta) or " +
    "isolated (grey). Breakers are squares (filled = closed); disconnectors and earth " +
    "switches are blades (in line = closed). A padlock marks an isolation lock; the pulsing " +
    "frame marks the device of the current step.",
  standard: "IEC 60617 (symbols), ISA-101 (HMI colours)",
  interpretation:
    "Devices are operated only through the programme, so every operation passes the " +
    "interlocks. Section B (TX-OSS-02, strings 4–6) stays earthed: it belongs to the circuit 2 " +
    "programme.",
};

export const p5StepInfo: InfoContent = {
  title: "Current step",
  description:
    "Steps run strictly in order. Checks and declarations are confirmed by the Person in " +
    "Control (PiC); isolation steps remove a safety lock; switching steps operate one device " +
    "through the interlocks; verification steps are evaluated on the load flow of the live " +
    "network; gates read the SAT and PSE notification status; at a hold point the PiC " +
    "decides GO or NO-GO.",
  parameters: [
    { name: "ILK-001", description: "No closing that would connect a live section to an earth (also the earth at the far end of the cable)" },
    { name: "ILK-002", description: "No earthing of a live section" },
    { name: "ILK-003", description: "Disconnectors only off-load (series breaker open)" },
    { name: "ILK-004", description: "A device under an isolation lock cannot be operated" },
    { name: "ILK-005", description: "Turbines can only be released onto an energised string" },
  ],
  interpretation:
    "A refused step stays pending and is logged with the interlock or check that stopped it; " +
    "clear the cause and execute it again. Emergency trip opens every closed breaker.",
};

export const p5NetworkInfo: InfoContent = {
  title: "Network readings",
  description:
    "Steady-state load flow (pandapower) of whatever is live after the last step, built from " +
    "the P2 network data (SB-510): 2 × 300 MVA onshore transformers (OLTC at neutral), 76.5 km 1000 mm² cable " +
    "(190 nF/km, 825 A) with its 120 Mvar onshore line reactor, 120 Mvar OSS reactor, ±120 Mvar STATCOM at 1.00 pu, " +
    "TX-OSS-01 (vk 12.5 %, i0 0.05 %), graded 66 kV array cables.",
  parameters: [
    { name: "Charging", description: "Q = ωCU²l ≈ 221 Mvar at 220 kV → ≈ 580 A per phase at 1 pu, with no load" },
    { name: "Ferranti", description: "Open end above the sending end by 1/cos(βl) ≈ 1.021 (βl ≈ 0.20 rad)" },
    { name: "Q sign", description: "Generator convention: + = generating; the reactors read negative" },
  ],
  interpretation:
    "Verification steps use a 0.95–1.05 pu operating band (project); equipment limits are " +
    "Um = 245 / 72.5 kV. Transients — switching surges and transformer inrush — are not " +
    "load-flow quantities and are not shown. Released turbines are set to 15 MW each as a " +
    "loading check; real output follows the wind.",
};

export const p5IsolationInfo: InfoContent = {
  title: "Isolation register",
  description:
    "While circuit 1 is under construction it is kept dead by the safety measures of " +
    "EN 50110-1: disconnect, secure against reconnection (disconnectors locked open), verify " +
    "absence of voltage, earth and short-circuit (earth switches locked closed). Each lock " +
    "carries a danger tag.",
  standard: "EN 50110-1:2013 §6.2; IEC 61936-1",
  interpretation:
    "Only the Person in Control may remove a lock — normally through the programme's " +
    "isolation steps. A lock can be re-applied when its device is back in its secured position.",
};

export const p5FatInfo: InfoContent = {
  title: "Factory acceptance tests",
  description:
    "Routine tests at the manufacturer's works, from the template of the equipment class. " +
    "Transformer limits are the IEC 60076-1 Table 1 tolerances on the design values: ratio " +
    "±0.5 %, impedance ±7.5 % (vk ≥ 10 %), each loss +15 %, no-load current +30 %; induced " +
    "voltage test with PD ≤ 250 pC at 1.58 Ur/√3 (IEC 60076-3).",
  standard: "IEC 60076-1/-3/-18, IEC 62271-1/-203, IEC 60255-151, IEC 61850-5",
  interpretation:
    "Limits marked 'project' are purchase-specification values, not figures from a standard. " +
    "A failed test can be repeated after repair; a campaign is approved only when every test passes.",
};

export const p5SatInfo: InfoContent = {
  title: "Site acceptance tests — circuit 1",
  description:
    "After installation and before energisation: cables tested in place, the transformer " +
    "compared with its factory fingerprints (ratio, FRA, DGA), instrument transformers and " +
    "relays proven by injection, the 87L scheme end-to-end over its channel, GOOSE timing " +
    "(TT6 ≤ 3 ms), SCADA point by point.",
  standard: "IEC 60229, IEC 60840, IEC 60076-1/-18, IEC 61869-2/-3, IEC 61850-5, EN 50522",
  interpretation:
    "The cable's main-insulation test is done in the programme as IEC 62067's alternative: " +
    "24 h at U0 = 127 kV. The SAT opens only when every equipment class has an approved FAT.",
};

export const p5GridCodeInfo: InfoContent = {
  title: "Operational notification — EON, ION, FON",
  description:
    "NC RfG (EU) 2016/631. EON (Art. 34): energise the internal network, issued once the " +
    "protection and control settings are agreed. ION (Art. 35): generate for at most 24 " +
    "months while the data and study review of Art. 35(3) is completed. FON (Art. 36): " +
    "normal operation after the compliance tests, with models and studies updated to " +
    "measured values.",
  parameters: [
    { name: "Classification", description: "Connection point onshore (PSE 400 kV) → onshore type D PPM, Art. 23(1)" },
    { name: "Tests", description: "Art. 47 + 48(2)–(9): LFSM-O/U, FSM, P control, Q capability, V / Q / PF control" },
    { name: "Simulations", description: "Art. 54–56: fault-ride-through, fast fault current, post-fault recovery" },
  ],
  interpretation:
    "EON is a gate before cable 1 is energised and ION before the turbines are released; " +
    "FON can only be submitted once the programme is complete. PSE parameters match the P2 studies.",
};

export const p5EmergencyInfo: InfoContent = {
  title: "Emergency procedures",
  description:
    "Each procedure acts on the programme. TRIP (internal arc, unexpected voltage): every " +
    "closed breaker and turbine group opens and the programme is aborted. SUSPEND (SF6 loss, " +
    "communication loss, medical, person overboard): switching stops, the plant stays as it " +
    "is, and the Person in Control resumes when the cause is cleared.",
  standard: "EN 50110-1, IEC 62271-4 (SF6 handling), IEC 62271-203, SOLAS Ch. III",
  interpretation:
    "IEEE 1584 arc-flash calculations cover 208 V–15 kV only and are not used for the " +
    "66/220 kV switchgear, whose internal-arc classification limits the hazard instead.",
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
    { name: "Cable resonance", description: "π-model cable: f_res = 1/(2π√(LC)) — SB-510 (76.5 km): ≈ 135 Hz and ≈ 965 Hz seen from OSS 66 kV" },
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

// ── Layout canvas (/develop/layout) ──

export const layoutGridToolInfo: InfoContent = {
  title: "Grid fill — regular or staggered rows",
  description:
    "Fills the site with turbines on a grid: spacing along the rows and between them in rotor diameters (D), the row bearing, " +
    "and an optional half-spacing shift of every other row (staggered). Positions closer than half a rotor to the boundary are dropped; " +
    "with 'Skip' on, positions in constraint areas or outside the plan's energy basins are left out too.",
  parameters: [
    { name: "Along / between rows", description: "Centre-to-centre spacing in D (here D = 241 m, IEA 15 MW reference turbine)" },
    { name: "Row bearing", description: "Direction of the rows, degrees clockwise from north" },
  ],
  interpretation:
    "Put the wider spacing along the prevailing wind (west–southwest in the southern Baltic): wakes are longest downwind. " +
    "Typical offshore spacings are 5–10 D; the 4 D warning on the canvas is a teaching default, not a rule.",
};

export const layoutResultsInfo: InfoContent = {
  title: "Live results — screening numbers",
  description:
    "Recomputed whenever the layout changes. Wake loss and net AEP come from a fast Bastankhah–Gaussian model (k* = 0.05, " +
    "sum-of-squares superposition, Ct and power from the IEA 15 MW tables) over the site's 12-sector wind rose and Weibull speeds.",
  standard: "Bastankhah & Porté-Agel (2014); Niayifar & Porté-Agel (2016) for k*",
  parameters: [
    { name: "Wake loss", description: "1 − net / (N × one free turbine), wake only [%]" },
    { name: "Net AEP (live)", description: "Energy after wakes only [GWh/yr]; availability and electrical losses come later" },
    { name: "Power density", description: "Installed MW per km² of the drawn site" },
    { name: "Wind at 150 m", description: "Site climate from NEWA + ERA5 when assessed, else a labelled approximation" },
  ],
  interpretation:
    "Within about 0.5 percentage points of PyWake on regular grids (tests/lib/layout.test.ts). Use it to compare options quickly; " +
    "run PyWake for the reference number.",
};

export const layoutPyWakeInfo: InfoContent = {
  title: "Reference AEP — PyWake",
  description:
    "Runs DTU's PyWake on the backend for these exact positions: Niayifar Gaussian deficit, STF2017 added turbulence, " +
    "linear superposition, the same wind rose and turbine. In an online project each run is stored with the project.",
  standard: "PyWake (DTU Wind Energy, MIT licence)",
  interpretation:
    "The run belongs to one layout: after a move it is greyed out until you run it again. The screening model and PyWake " +
    "should agree within about a percentage point of wake loss.",
};

export const layoutCostInfo: InfoContent = {
  title: "Cost estimate and LCOE",
  description:
    "CAPEX lines per MW or per km from the editable inputs, foundations by the site's deepest water (jacket beyond 40 m), " +
    "array cable length from the routed tree, and the export route length × the 220 kV circuits the farm needs (same rule as the Grid design).",
  parameters: [
    { name: "LCOE", description: "(CAPEX × CRF + OPEX) / AEP [€/MWh]" },
    { name: "CRF", description: "r(1 + r)^n / ((1 + r)^n − 1), WACC r over lifetime n" },
    { name: "AEP", description: "PyWake when fresh, else the live estimate, minus 7.8 % electrical, availability and environmental losses (P1 cascade defaults)" },
  ],
  interpretation:
    "Defaults are the NREL Cost of Wind Energy Review 2024 fixed-bottom reference (U.S. North Atlantic, 2023 USD) and ORBIT cable prices, " +
    "converted at 1.0813 $/€; each input shows its source. Replace them with quotes for your market before comparing with real projects.",
};

export const layoutChecklistInfo: InfoContent = {
  title: "Layout checklist",
  description:
    "Live checks of the layout: the site screening report from Site & Permits and the checks the canvas runs in the browser " +
    "(site boundary, constraint areas, energy basins of the Polish maritime spatial plan, spacing, substation, cables, water depth, PyWake run).",
  parameters: [
    { name: "HV Grid", description: "Checks that open the Grid stage of an own project (≥ 1 turbine, OSS, none outside, in a constraint or < 4 D)" },
    { name: "Water depth", description: "EMODnet bathymetry at each turbine, mapped to the screening depth bands (monopile / jacket / floating)" },
  ],
  interpretation:
    "Screening only: a pass here is not a permit. Confirm the plan (SIPAM), the 2021 MSP regulation (Dz.U. 2021 poz. 935) and " +
    "the seabed with the competent authority and site surveys.",
};

export const layoutSuggestInfo: InfoContent = {
  title: "Move suggestions",
  description:
    "Takes the ten turbines with the highest wake loss and tries moving each by ½, 1 and 2 D in eight compass directions. " +
    "A move must keep the turbine inside the site, out of constraint areas, inside an energy basin, ≥ 4 D from the others, " +
    "clear of existing subsea cables by the screening buffer, and its own array cables must not cross others.",
  parameters: [
    { name: "AEP change", description: "Exact for the screening model: only the wakes the moved turbine casts and receives are recomputed" },
    { name: "Cables", description: "Length change of the moved turbine's own cable segments, strings unchanged" },
    { name: "LCOE change", description: "From the AEP and cable changes with the cost inputs; the best move per turbine is kept" },
    { name: "PyWake", description: "The top five are re-run with PyWake against the current layout (POST /api/v1/wind/wake-moves)" },
  ],
  interpretation:
    "Gains are a few tenths of a percent each — real money over 25 years, but below the fast model's accuracy (about 0.5 " +
    "percentage points of wake loss), so PyWake decides: confirmed moves come first, the rest are marked. On a tuned layout such " +
    "as SB-510 PyWake finds at most a few hundredths of a percent per move. Moves are single-turbine and greedy — after applying " +
    "one, search again; a full optimiser (e.g. TOPFARM) moves all turbines together.",
};

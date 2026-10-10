import type { InfoContent } from "../components/ui/InfoButton";

/**
 * Information content for all dashboard panels.
 * Each panel gets an (i) button in the top-right corner
 * that opens a dialog explaining the component.
 */

// P1 and P2 panels use the deep EducationContent in constants/education/.

// ── P3 SCADA ──

export const substationSldInfo: InfoContent = {
  title: "Single-Line Diagram — Export System",
  description:
    "PSE 400 kV connection point → 2 × 300 MVA onshore transformers → 2 × 108 km 220 kV export cables → " +
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
    "subscribes. The scenarios use IEC 60909 fault currents from the P2 pandapower model (OSS 220 kV Ik'' ≈ 7.8 kA).",
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
    "the P2 network data (SB-510): 2 × 300 MVA onshore transformers (OLTC pre-set 3 steps down), 108 km 1000 mm² cable " +
    "(190 nF/km, 825 A) with its 180 Mvar onshore line reactor, 180 Mvar OSS reactor, ±120 Mvar STATCOM at 1.00 pu, " +
    "TX-OSS-01 (vk 12.5 %, i0 0.05 %), graded 66 kV array cables.",
  parameters: [
    { name: "Charging", description: "Q = ωCU²l ≈ 312 Mvar at 220 kV → ≈ 820 A per phase at 1 pu, with no load" },
    { name: "Ferranti", description: "Open end above the sending end by 1/cos(βl) ≈ 1.043 (βl ≈ 0.29 rad)" },
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

// ── Control room ──

export const farmOverviewInfo: InfoContent = {
  title: "Wind Farm Overview — Real-Time Status Map",
  description:
    "Interactive map showing all 34 × 15 MW turbines, offshore substation, " +
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

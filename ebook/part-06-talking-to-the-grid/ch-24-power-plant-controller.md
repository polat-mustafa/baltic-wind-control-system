# Chapter 24: The Power Plant Controller: Dispatching 510 MW

*Rafael Díaz was at the PPC control desk when Kaan arrived, and the first thing Kaan noticed was not the monitor cluster but the photograph above it. It was a printed time-series chart, framed under glass — generation by source across twenty-four hours, with a blue band representing wind that, just before six in the morning, had climbed to occupy more than half the chart. A handwritten note in ink at the bottom right corner: Por esto. 08/11/2009, 05:50.*

*"For this reason," Kaan said aloud, reading the Spanish.*

*"That is the night wind covered 53.7 percent of Spanish electricity demand." Rafael glanced up. He was early forties, compact, with the precise gestures of someone who had spent years manipulating control system diagrams. He was entering a sequence of active power setpoints into the dispatch interface — 450, 480, 400, 350, 510 — pausing a few seconds between each one to let the farm simulation step through its response. "It lasted six minutes at that level. Red Eléctrica had eleven thousand megawatts of wind connected to the grid. All of it operating. All of it dispatchable."*

*Kaan looked at the chart. "Dispatchable meaning they could tell the wind farms to reduce output?"*

*"Instantly. Or within fifteen minutes, technically — that was the contractual window. But the setpoints went out continuously, every twelve seconds via the control centre." He pressed Enter. On screen, the simulated farm stepped from 350 to 510 MW in seventy-three seconds, tracking a ramp rate the display labelled POWER_REFERENCE MODE / RAMP RATE: 20% Pn/min. "Before that control centre existed, you could not have run wind at 53 percent. You would have needed to curtail — waste the power — because there was no way to tell thirty different farms, spread across six hundred kilometres of Castile and Aragón, to hold steady while the system adjusted." He pushed back from the keyboard. "That is why the Power Plant Controller exists. Not because engineers wanted one. Because Spain proved the grid would break without it."*

*He turned to face Kaan fully. He had spent four years at Red Eléctrica in Madrid before moving to the developer side, and he talked about the Spanish grid the way other engineers talked about a first employer: with a specific mixture of affection and critical distance.*

*"Anders told me you understood the FRT simulation in about forty minutes," he said.*

*"I understand what happened during the fault," Kaan said. "I don't understand who decided what to do after."*

*"That," Rafael said, pointing at the screen, "is exactly the right question."*

---

## 24.1 Why Wind Farms Need a Central Brain

For most of the 1990s, the answer to "how much power is a wind farm producing?" was: whatever the wind gives. Turbines were small — the industry benchmark was 500 kW through the decade, rising to 2 MW by 2000 — and they connected to distribution networks where a few megawatts of uncontrolled generation was invisible against the background of synchronised power stations. The turbines ran at their aerodynamic maximum. If the grid operator wanted to know how much they were producing, they read the aggregate metering at the substation. There was no setpoint. There was no control loop. There was, in the language that grid engineers use, no dispatchability.

By 2004, this was beginning to cause problems. The Danish TSOs — Eltra in the west, Elkraft in the east, both soon to become Energinet — had connected large offshore wind farms to their 150 kV networks. Horns Rev I (160 MW) had been online since 2002. Nysted (165 MW) since 2003. Together with the onshore fleet, wind was approaching 20% of installed capacity in western Denmark. On windy nights with low overnight demand, wind could produce more than 100% of Danish demand — the excess was exported to Norway and Sweden, but the interconnector capacity was finite. Eltra needed a mechanism to tell wind farms to reduce output when export capacity was exhausted. The requirement appeared in their December 2004 grid code document TF 3.2.5: wind farms above 10 MW, when requested, must reduce output to a specified reference power level within 5 seconds and hold within ±10% for as long as the constraint lasted.[1]

This was the first time any grid code, anywhere, had required active power setpoint control from a wind farm. The Danish engineers called it the reference mode requirement. Today it is called the Power Plant Controller, and every large wind farm in Europe is legally required to have one.

The Spanish experience showed why the scale of ambition had to expand further. Spain's wind fleet grew rapidly through the 2000s: 6,000 MW in 2002, 12,000 MW in 2006, 20,000 MW by 2010. By 2006, Red Eléctrica de España — REE, the Spanish TSO — had more wind capacity under its supervision than any other transmission operator in the world, and no centralised way to manage it. Active power setpoints, where they existed, were bilateral agreements between individual farm operators and REE, enforced manually. In 2007, Spanish grid operators recorded 87 incidents in which wind farms across the country simultaneously reduced output by more than 100 MW, each triggered by voltage disturbances propagating across the network. In every case, individual turbine protection relays — following exactly the pre-FRT logic that E.ON Netz had identified as a systemic risk in Germany in 2003 — had responded to local conditions without any awareness of the systemic effect.[2]

REE's response was to build something that had never existed: a dedicated control centre for renewable energy. The Centro de Control de Energías Renovables — CECRE — opened in Madrid in 2006 and became the first facility in the world designed specifically for real-time supervisory control of renewable generation. By the time Royal Decree 661/2007 formalised the mandatory obligation in May 2007, CECRE was supervising 448 wind facilities covering approximately 15,500 MW of installed capacity. Every facility above 10 MW was required to connect to one of 23 intermediate Generation Control Centres — the CGCs — which relayed setpoints from CECRE and reported telemetry back every 12 seconds. When the system needed a curtailment — a congested export corridor, a frequency support event, a grid restoration sequence — REE could instruct 15,000 MW of wind to reduce output within 15 minutes, confirmed by telemetry, enforced by contract.[3]

The November 2009 record — wind at 53.7% of Spanish demand at 05:50 on the 8th — was possible only because CECRE existed. A 50% wind penetration on an isolated grid, without dispatchable control, is a frequency management problem. With it, the system operator has the tools to maintain balance. The photograph above Rafael's desk is not a curiosity. It is a proof of concept.

Commission Regulation (EU) 2016/631 — the Network Code on Requirements for Generators — codified this lesson into European law. Article 22 requires all Type D power-generating facilities to have active power control capability, reactive power control capability, and the ability to respond to TSO setpoints in real time.[4] Offshore wind farms qualify as Type D on two independent grounds: rated capacity ≥ 75 MW, and connection voltage ≥ 110 kV. The Power Plant Controller is the device that makes these requirements technically possible.

---

## 24.2 PPC Architecture: Three Levels of Authority

The Power Plant Controller sits at the middle layer of a three-level control hierarchy. Understanding the hierarchy is essential before understanding what the PPC does.

**Level 1: TSO (PSE, for this project).** The Transmission System Operator issues active power setpoints, reactive power targets, and ramp rate constraints to the PPC. Setpoints arrive via SCADA link — typically IEC 60870-5-104 over a leased telecommunications line — at intervals of 1–5 minutes during normal operation, or continuously during active constraint management. The TSO sees the farm as a single entity: one bus, one injection point, one metering connection. It does not know, or care, how many turbines are operating or what their individual outputs are.

**Level 2: PPC.** The Power Plant Controller executes the TSO setpoint against the physical reality of 34 turbines and one STATCOM. It runs a control cycle every 1–5 seconds: reads telemetry from all turbines and the STATCOM (wind speed, available power, current output, grid voltage, frequency, fault status), runs the dispatch algorithm, calculates individual setpoints for each device, and sends those setpoints downstream via the SCADA system. The PPC also enforces ramp rate limits, manages state transitions, and coordinates reactive power between the STATCOM and the WTG converters.

**Level 3: Individual turbine controller and STATCOM.** Each turbine's onboard controller executes its setpoint independently, closing its own loop — adjusting pitch, managing converter current, tracking the PPC setpoint — at 100–200 millisecond update rates. The STATCOM's internal controller responds faster still, with the outer power/voltage loop updated every 10–20 ms and the VSC switching at 1–2 kHz.

This hierarchy explains why the FRT response in Chapter 23 appeared to "step around" the PPC. During a fault, the inner current loop of each converter reacted in 5 ms — six orders of magnitude faster than the PPC's 1–5 second cycle. The PPC, during those 140 ms, could not meaningfully issue a new setpoint. It stepped back, allowed the converter-level FRT response to execute, detected fault clearance via telemetry, and then re-issued a recovery setpoint once voltage had stabilised. The hierarchy is not a chain of command in which every instruction passes through every level. It is a division of timescales: fast physics to the inner loops; operational dispatch to the PPC; grid policy to the TSO.

The available power that each turbine can supply — the denominator of the dispatch calculation — is not measured directly. It is estimated from the current hub-height wind speed and the turbine's aerodynamic model:

$$P_{\text{avail},i} = \min\!\left(C_P(\lambda_i, \beta_i) \cdot \frac{1}{2}\rho\pi R^2 v_{\text{hub},i}^3,\; P_{\text{rated}}\right)$$

where:
- $C_P(\lambda_i, \beta_i)$ = power coefficient at current tip speed ratio $\lambda_i$ and blade pitch angle $\beta_i$ [–]
- $\rho$ = air density [kg/m³], measured at the met mast and assumed uniform across the farm
- $R$ = rotor radius [m]; $R = 118$ m for the V236-15.0 MW turbine
- $v_{\text{hub},i}$ = hub-height wind speed at turbine $i$, estimated from the nacelle anemometer [m/s]
- $P_{\text{rated}}$ = rated power per turbine [MW]; $P_{\text{rated}} = 15$ MW

In practice, the available power estimate carries uncertainty — nacelle anemometers are disturbed by the rotor wake, and the power curve has a scatter band of ±5–8% at mid-wind speeds. The PPC uses these estimates for dispatch allocation and available-capacity reporting to the TSO; the turbine's own pitch controller handles the physical limit. If the PPC dispatches more than a turbine can deliver, the turbine delivers its maximum and reports the shortfall via telemetry. The PPC adjusts the distribution on the next cycle.

<!-- IMAGE: fig-24-01 -->
> **Figure 24.1** — PPC Three-Level Control Hierarchy
> **Type:** Block diagram (hierarchical, three nested levels)
> **Content:** Three nested boxes. Outer (blue): TSO / PSE, labelled "Active power setpoint (MW), reactive power target (MVAR), ramp rate constraint (MW/min) — via IEC 60870-5-104 SCADA link every 1–5 min". Middle (grey): Power Plant Controller, with internal sub-blocks: measurement layer, available power estimator, mode selector, dispatch engine (active + reactive), ramp limiter, state machine. Inner (green): 34 WTG turbines (represented as 34 identical sub-elements in a grid) and STATCOM block, connected to PPC by bidirectional arrows: downward "P_i setpoint (MW), Q_i setpoint (MVAR) — every 1–5 s"; upward "P, Q, status telemetry — every 1 s". Arrow from PPC upward to TSO: "P_total, Q_total, P_avail, state — every 12 s".
> **Caption:** The three-level control hierarchy: the TSO issues a single setpoint to one injection point; the PPC dispatches that setpoint across 34 turbines and one STATCOM; each device executes its inner control loop independently.
> **Alt text:** Nested block diagram showing TSO at top issuing setpoints to PPC in the middle, which dispatches to 34 turbines and one STATCOM at the bottom, with telemetry flowing upward at each level.
> **Data source:** Author illustration after Energinet TF 3.2.5 (2004) and IEC 61400-25 architecture.
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** TSO box in blue, PPC in grey, turbines/STATCOM in green. Downward (control) arrows solid; upward (telemetry) arrows dashed.

---

## 24.3 Active Power Modes

The PPC does not have one way of thinking about power. It has four modes, each representing a different relationship between the farm's output and the grid's needs. Understanding which mode applies — and why — is as important as the mathematics.

**POWER_REFERENCE mode.** The most common operating mode. The TSO sends a numerical setpoint — "produce 420 MW" — and the PPC dispatches to match it, subject to the ramp rate constraint. Used during normal operation when the TSO wants a specific power level: generation scheduling, congestion management, or balance control. The setpoint may update every few minutes during routine operation or continuously during a frequency support event.

**DELTA_CONTROL mode.** The farm is required to operate at a specified margin below its available power, maintaining a reserve of upward flexibility at all times. If available power is 490 MW and the TSO requires a 50 MW reserve margin, the farm produces 440 MW and can increase to 490 MW on a 5-second command. Delta control is a frequency reserve product — the farm is paid to hold capacity in reserve rather than to produce it. NC RfG Article 15(2)(a) requires this capability for all Type B and above generators.

$$P_{\text{ref},\delta} = P_{\text{avail}} - \Delta P_{\text{reserve}}$$

where:
- $P_{\text{ref},\delta}$ = farm active power setpoint in delta-control mode [MW]
- $P_{\text{avail}} = \sum_{i=1}^{N} P_{\text{avail},i}$ = total available power from all $N$ turbines in service [MW]
- $\Delta P_{\text{reserve}}$ = upward reserve margin specified by the TSO [MW]

**ABSOLUTE_LIMITATION mode.** A hard ceiling on farm output, independent of wind conditions. Used when grid congestion limits the maximum power that can be transmitted on the export cable or the onshore network, or when the TSO needs to prevent generation from exceeding a safe level. If the ceiling is 350 MW and the wind would allow 510 MW, the turbines are deliberately curtailed. This mode involves real economic cost — curtailed energy is lost CfD revenue — and PSE is contractually required to compensate the farm for TSO-mandated curtailment above an agreed threshold.

**RAMP_RATE_CONTROL mode.** The farm increases or decreases output at a controlled rate, independent of the absolute target. Used during planned connection sequences, after fault restoration, or during scheduled curtailment. The PPC enforces ramp rates regardless of mode, but in RAMP_RATE_CONTROL the rate itself is the primary control parameter.

All four modes operate through the same physical constraint: the ramp rate limiter.

$$\left|\frac{\Delta P}{\Delta t}\right| \leq r_{\text{ramp}} \cdot P_n$$

where:
- $\Delta P / \Delta t$ = rate of change of farm active power output measured at the 220 kV connection point [MW/s]
- $r_{\text{ramp}}$ = ramp rate coefficient [s⁻¹]; PSE IRiESP specifies $r_{\text{up}} = 10\% P_n \text{ min}^{-1}$, $r_{\text{down}} = 20\% P_n \text{ min}^{-1}$, $r_{\text{emerg}} = 2\% P_n \text{ s}^{-1}$
- $P_n$ = rated power of the wind power plant [MW]

For a 510 MW plant: ramp-up at 51 MW/min (0.85 MW/s); ramp-down at 102 MW/min (1.70 MW/s); emergency ramp-down at 10.2 MW/s — from full power to zero in under 51 seconds.

The asymmetry between ramp-up and ramp-down rates is deliberate. Increasing generation is conservative for frequency stability — extra generation is generally beneficial. Reducing generation, particularly during a frequency recovery event, must be controlled more carefully to avoid re-triggering the deviation it was designed to support. The 2:1 ratio reflects this asymmetry.

<!-- IMAGE: fig-24-02 -->
> **Figure 24.2** — Active Power Mode Transitions and Ramp Rate Behaviour
> **Type:** State transition diagram (left) with time trace inset (right)
> **Content:** Left panel: four rounded boxes (POWER_REFERENCE, DELTA_CONTROL, ABSOLUTE_LIMITATION, RAMP_RATE_CONTROL) with arrows showing allowed transitions and trigger conditions (TSO command, constraint trigger, frequency event, manual operator override). Right panel: time trace showing P(t) for a curtailment from 480 MW to 380 MW — TSO setpoint steps at t = 0 (green), ramp-limited actual output descends linearly over 60 s at 100 MW/min (orange), measured output follows with turbine lag, settling at 379.9 MW by t = 75 s (blue).
> **Caption:** PPC active power mode transitions and ramp rate enforcement: a 100 MW curtailment command executes over 60 seconds at the PSE-mandated 20% Pn/min rate.
> **Alt text:** A state transition diagram of four active power modes with arrows, and a time trace showing ramp-limited response to a curtailment setpoint step.
> **Data source:** Author illustration; ramp rates from PSE IRiESP (current edition, pse.pl).
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Mode boxes in light blue, transition arrows in dark grey, time trace: setpoint in green, ramp-limited in orange, measured in blue.

---

## 24.4 Pro-Rata Dispatch: The Fair-Share Algorithm

Once the PPC has determined the farm's power target — whether from a TSO setpoint, a delta-control margin, or a ramp sequence — it must divide that target among 34 turbines. This is the dispatch problem, and it has an elegant solution.

The simplest approach is equal division: give every turbine the same setpoint. If the target is 340 MW and there are 34 turbines, each gets 10 MW. But equal division fails whenever any turbine cannot deliver its share — low local wind, a pitch system fault, a maintenance derate, or a converter limitation. If turbine 17 is limited to 5 MW and the equal-division setpoint is 10 MW, the farm delivers 329 MW instead of 340 MW, and the shortfall must be redistributed on the next cycle.

The correct approach is proportional dispatch: allocate power in proportion to each turbine's currently available capacity.

$$P_i = P_{\text{target}} \cdot \frac{P_{\text{avail},i}}{\displaystyle\sum_{j=1}^{N} P_{\text{avail},j}}$$

where:
- $P_i$ = active power setpoint issued to turbine $i$ [MW]
- $P_{\text{target}}$ = farm-level power target from the PPC [MW]
- $P_{\text{avail},i}$ = estimated available power from turbine $i$ at current wind conditions [MW]
- $N$ = number of turbines in service [–]

Turbine $i$ contributes a fraction of the target equal to its fraction of the farm's total available power. If turbine 17 has only 33% of the average available power because it is running in DERATED state, it receives 33% of the average setpoint. The farm always meets its total target — subject to ramp limits and the constraint that no turbine is dispatched above its available power.

This algorithm has three important consequences. First, it is self-balancing: a turbine lightly loaded by low local wind receives a low setpoint; a turbine in good wind receives a higher one. The farm's internal inequality is preserved, not magnified. Second, it is fault-tolerant: if turbine 23 drops out mid-cycle, its $P_{\text{avail},23}$ falls to zero in the next telemetry update, and its share is automatically redistributed to the remaining turbines within one PPC cycle. Third, it minimises losses from deliberate curtailment: when the farm is forced below available power, each turbine is loaded at the same fraction of its capacity, keeping all turbines operating in a similar aerodynamic regime rather than running some at full power and switching others off — which would cause unnecessary thermal cycling and reduce blade life.

The Danish engineers who first specified this approach in TF 3.2.5 called it pro-rata dispatch. The mathematics is proportional allocation applied to electrical engineering, and it appeared in grid code documentation before it appeared in any academic paper on wind farm control.

<!-- IMAGE: fig-24-03 -->
> **Figure 24.3** — Pro-Rata Dispatch Visualisation
> **Type:** Paired horizontal bar chart (34 turbines)
> **Content:** Horizontal bars for each of 34 turbines (arranged vertically, T01–T34). For each turbine, two bars side by side: blue bar = available power; green bar = dispatched setpoint. Three derated turbines (T07, T18, T31) show shorter blue bars (9.5 MW available) and proportionally shorter green bars (7.41 MW setpoint) compared to normal turbines (14.8 MW available, 11.54 MW setpoint). Derated turbines labelled "DERATED — pitch inspection". Target line at 380 MW total shown as annotation. Scale: 0–16 MW per turbine.
> **Caption:** Pro-rata dispatch for a 380 MW farm target across 34 turbines, with three turbines in derated state: each turbine receives a setpoint proportional to its available power, and the farm target is met exactly.
> **Alt text:** Horizontal bar chart showing available power in blue and dispatched setpoint in green for 34 turbines, with three shorter bars for derated turbines clearly visible.
> **Data source:** Worked example from section 24.7.
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Available power in blue, dispatched setpoint in green, derated turbine labels in red.

---

## 24.5 Reactive Power Modes and STATCOM Coordination

The PPC's reactive power control mirrors its active power control in structure: four modes, a dispatch algorithm, and a coordination layer that manages the relationship between the STATCOM — fast, high-capacity, expensive per MVAR — and the 34 WTG converters, which are slower but distributed across the collector ring.

**Q_V_DROOP mode** (default for offshore substations). The PPC measures the voltage at the 220 kV connection point and adjusts the farm's total reactive output to maintain it within a target band. The droop characteristic — introduced in Chapter 22 for the STATCOM's internal controller — applies here at the farm level:

$$Q(V) = Q_{\text{ref}} - k_V \cdot \left(V - V_{\text{ref}}\right) \cdot Q_{\text{max}}$$

where:
- $Q(V)$ = farm reactive power output at measured voltage $V$ [MVAR]
- $Q_{\text{ref}}$ = reactive power target at reference voltage [MVAR]; typically $Q_{\text{ref}} = 0$ MVAR
- $k_V$ = voltage droop gain [MVAR/pu]; PSE IRiESP specifies $k_V$ such that a 5% voltage deviation produces 100% reactive power response
- $V$ = measured voltage at the 220 kV point of connection [pu]
- $V_{\text{ref}}$ = voltage setpoint [pu]; typically $V_{\text{ref}} = 1.00$ pu
- $Q_{\text{max}}$ = maximum reactive power of the farm [MVAR]; $Q_{\text{max}} = 170$ MVAR (WTG converters + STATCOM combined at full active power)

At normal voltage the farm produces its reference reactive power. As voltage rises, Q decreases (the farm absorbs); as voltage falls, Q increases (the farm injects). The characteristic is the same physics as the STATCOM's internal droop from Chapter 20 — but applied at the farm boundary, with the PPC translating the farm-level Q command into individual device setpoints.

**VOLTAGE_CONTROL mode.** A PI controller replaces the droop: the PPC minimises the error between measured voltage and voltage setpoint. Faster than droop for small deviations but requires careful anti-windup design to prevent integrator saturation during faults.

**REACTIVE_POWER mode.** A fixed Q setpoint from the TSO. Used during commissioning tests, during market-based reactive power procurement, or during post-fault restoration when the TSO specifies the exact reactive injection needed.

**POWER_FACTOR mode.** The farm maintains a fixed power factor at the point of connection regardless of active power level. Used when the Grid Connection Agreement specifies a power factor target rather than a voltage or reactive power target.

In all four modes, the PPC faces the same coordination question: how to split the total reactive power command between the STATCOM and the 34 WTG converters. The priority rule is simple: the STATCOM responds first, because it is faster and its response does not reduce the turbines' active power capability. The WTG converters provide the remainder, distributed pro-rata by available power:

$$Q_{\text{WTG},i} = \left(Q_{\text{cmd}} - Q_{\text{STATCOM}}\right) \cdot \frac{P_{\text{avail},i}}{\displaystyle\sum_{j=1}^{N} P_{\text{avail},j}}$$

where:
- $Q_{\text{WTG},i}$ = reactive power setpoint for WTG turbine $i$ [MVAR]
- $Q_{\text{cmd}}$ = total reactive power command at the 220 kV point of connection [MVAR]
- $Q_{\text{STATCOM}}$ = reactive power currently delivered by the STATCOM [MVAR]

The physical limit on WTG converter reactive power is set by the converter's apparent power rating: at a given active power $P_i$, the turbine can supply at most $Q_{\text{avail},i} = \sqrt{S_{\text{rated}}^2 - P_i^2}$ MVAR. At full active power (P = 15 MW, S = 16.7 MVA at pf = 0.9), this is approximately ±7.2 MVAR per turbine. At reduced active power during curtailment, the reactive capability increases — a deliberately curtailed farm has more reactive flexibility than a fully loaded one. This is one reason PSE will sometimes request simultaneous curtailment and reactive support: the two requests are not in conflict. They ask the farm to move along its capability curve.

---

## 24.6 The State Machine: How the PPC Knows Where It Is

The PPC does not operate in a single continuous mode. It moves between states, and each state change has a cause, a confirmation condition, and consequences for the dispatch algorithm.

**STOPPED.** All turbines at standstill or below cut-in wind speed. The PPC receives telemetry but issues no setpoints. Output: 0 MW, 0 MVAR.

**STARTING.** Turbines are completing their start-up sequence — idling up to operational speed, connecting converters, ramping to minimum stable power. The PPC begins issuing low setpoints (5–10% of rated power per turbine) and ramps upward. Duration: 3–8 minutes depending on wind conditions.

**AVAILABLE.** The PPC has sufficient capacity to meet its TSO setpoint: active power target ≤ available power. All dispatch algorithms operate normally. This is the normal daytime operating state during good wind.

**RUNNING.** A sub-state of AVAILABLE: the farm is actively tracking its setpoint within tolerance. PSE IRiESP requires the tracking error to remain within 5% of rated power:

$$\varepsilon_P = \frac{\left|P_{\text{measured}} - P_{\text{setpoint}}\right|}{P_n} \leq 5\%$$

where $\varepsilon_P$ is the setpoint tracking error [pu or %], $P_{\text{measured}}$ is the farm output at the 220 kV metering point [MW], and $P_n$ is the plant rated power [MW]. If tracking error exceeds 5% for more than 10 seconds, the state transitions to DERATED.

**DERATED.** Available power is below the TSO setpoint, due to insufficient wind, turbine outages, or a scheduled maintenance curtailment. The PPC continues dispatching to its maximum available output and reports the deficit to PSE. A DERATED state is not a failure — it may simply mean the wind has dropped. PSE monitors the DERATED state and adjusts the active power schedule accordingly.

**FAULT.** One or more PPC-critical systems have failed — loss of communication to more than a defined threshold of turbines, loss of the STATCOM supervisory channel, or a protection relay trip at the 220 kV connection point. The PPC initiates an automatic ramp-down at the standard ramp-down rate (20% Pn/min) and alerts the grid operator. The farm does not disconnect immediately; it ramps to zero unless the fault is resolved within the timeout window.

**EMERGENCY_STOP.** Immediate cessation of output at the emergency ramp-down rate: 2% Pn/s = 10.2 MW/s for a 510 MW plant. Used during declared electrical emergencies, PSE system emergency curtailment commands, or offshore substation protection trips. At 10.2 MW/s, a 510 MW farm reaches zero in under 51 seconds. All 34 turbines simultaneously pitch to feather; their converters disconnect from the collector ring in sequence.

During the FRT simulation in Chapter 23, the state machine remained in RUNNING throughout. The individual converter FRT responses were sub-second events invisible to the 1–5 second PPC cycle. When voltage recovered, the state machine confirmed RUNNING status from telemetry and issued the recovery setpoint. The 449 MW result — 1 MW short of the 450 MW requirement — was a transient aerodynamic lag, not a state machine failure.

"The state machine is not the fast part of the PPC," Rafael told Kaan, closing the state diagram on his screen. "It is the memory. It remembers what the farm is doing and why, so that when conditions change, the response is consistent."

---

## 24.7 Worked Example: PPC Dispatch During Curtailment

**Scenario:** A 500 MW reference farm (34 × 15 MW) is operating in POWER_REFERENCE mode with a TSO setpoint of 480 MW. Wind conditions give 31 turbines an available power of 14.8 MW each, and 3 turbines — undergoing scheduled pitch-actuator inspection — a derated available power of 9.5 MW each.

Total available: $31 \times 14.8 + 3 \times 9.5 = 458.8 + 28.5 = 487.3$ MW. Current output: 480 MW.

PSE sends a new setpoint: **380 MW**, effective immediately, duration approximately 2 hours. Reason: congestion on the 400 kV onshore export corridor. Simultaneously, PSE requests reactive support: **Q = +60 MVAR** at the 220 kV point of connection.

**Step 1: Ramp calculation.**

Required reduction: $480 - 380 = 100$ MW.

PSE ramp-down rate: $20\% \times 500 \text{ MW} \cdot \text{min}^{-1} = 100 \text{ MW/min} = 1.667 \text{ MW/s}$.

Ramp duration: $100 \text{ MW} \div 1.667 \text{ MW/s} = 60.0$ seconds.

The PPC issues the 380 MW target at $t = 0$. The ramp limiter holds the instantaneous setpoint at 480 MW and decreases at 1.667 MW/s, reaching 380 MW at $t = 60$ s.

**Step 2: Pro-rata dispatch at 380 MW.**

Fraction per normal turbine: $14.8 / 487.3 = 0.03036$.
Fraction per derated turbine: $9.5 / 487.3 = 0.01950$.

Individual setpoints:
- Normal turbines (31 units): $P_i = 380 \times 0.03036 = 11.54$ MW each
- Derated turbines (3 units): $P_i = 380 \times 0.01950 = 7.41$ MW each

Verification: $31 \times 11.54 + 3 \times 7.41 = 357.7 + 22.2 = 379.9$ MW $\approx 380$ MW. Farm setpoint met within 0.02%.

**Step 3: Reactive power dispatch.**

STATCOM primary response: $Q_{\text{STATCOM}} = 50$ MVAR. (Sized at ±120 MVAR and capable of responding in 18 ms as demonstrated in Chapter 20. This leaves margin within the STATCOM rating.)

Remaining reactive from WTG converters: $60 - 50 = 10$ MVAR, allocated pro-rata.

- Normal turbine: $Q_{\text{WTG},i} = 10 \times (14.8 / 487.3) = 0.304$ MVAR
- Derated turbine: $Q_{\text{WTG},i} = 10 \times (9.5 / 487.3) = 0.195$ MVAR

Check: $31 \times 0.304 + 3 \times 0.195 = 9.42 + 0.59 = 10.01$ MVAR. Total Q at 220 kV: $50 + 10 = 60$ MVAR.

At reduced active power ($P_i = 11.54$ MW), each normal turbine's available reactive capacity is:
$Q_{\text{avail}} = \sqrt{16.7^2 - 11.54^2} = \sqrt{278.9 - 133.2} = 12.07$ MVAR. Required 0.304 MVAR is well within this limit. No converter overload.

**Step 4: Compliance verification.**

| Parameter | PSE Requirement | Calculated / Dispatched | Status |
|---|---|---|---|
| Active power setpoint | 380.0 MW | 379.9 MW | **PASS** (0.02% error; within ±5%) |
| Ramp-down rate | ≤ 100 MW/min | 100 MW/min | **PASS** (at limit) |
| Reactive support | +60.0 MVAR | +60.01 MVAR | **PASS** (< 0.1 MVAR error) |
| Per-turbine limit | ≤ $P_{\text{avail},i}$ | All setpoints within available power | **PASS** |
| Reactive per turbine | ≤ $Q_{\text{avail},i}$ | Max 0.304 MVAR vs 12.07 MVAR limit | **PASS** |
| Farm state | RUNNING | RUNNING (tracking error 0.02%) | **PASS** |

**Step 5: Revenue impact of curtailment.**

Curtailed energy during the 2-hour event:
$100 \text{ MW} \times \left(\frac{60}{3600} \text{ h ramp} + 2.0 \text{ h sustained}\right) = 100 \times 2.017 = 201.7$ MWh.

At a CfD strike price of €90/MWh, the lost revenue is approximately **€18,150 per curtailment event**. If 40 such events occur annually due to grid congestion on the export corridor, the annual curtailment cost reaches **€726,000** — a figure that will appear in the farm's annual operational report and motivate future transmission capacity planning. The cost of the curtailment is borne initially by the developer; the mechanism for TSO compensation (if the curtailment was TSO-instructed) is defined in the Grid Connection Agreement.

<!-- IMAGE: fig-24-04 -->
> **Figure 24.4** — PPC Curtailment Response: Active and Reactive Power Traces
> **Type:** Time series (dual-axis, multi-trace)
> **Content:** Primary vertical axis (left): active power 0–520 MW. Time axis: 0–120 seconds. Three active power traces: (1) TSO setpoint — green step from 480 MW to 380 MW at t=0; (2) PPC ramp-limiter output — orange, linear ramp from 480 MW to 380 MW over exactly 60 s; (3) farm measured output at 220 kV — blue, tracking orange with 5–10 s turbine pitch lag, settling at 379.9 MW by t = 75 s. Secondary vertical axis (right): reactive power 0–80 MVAR. Single trace (red): stepping from 0 to ~50 MVAR within 0.5 s (STATCOM), then smoothly to 60 MVAR within 2 s as WTG Q dispatch completes. Annotations: "STATCOM primary response" at t ≈ 0.5 s; "WTG Q dispatch complete" at t ≈ 2 s; "Ramp complete" at t = 60 s; "Settled" at t = 75 s.
> **Caption:** PPC curtailment response to a 100 MW setpoint step: active power follows the 20% Pn/min ramp limit and settles within 75 seconds; reactive support from STATCOM and WTG converters reaches 60 MVAR within 2 seconds of the command.
> **Alt text:** A dual-axis time-series chart showing farm active power stepping from 480 MW to 380 MW over 60 seconds following a ramp-limited curtailment command, with reactive power stepping almost instantly to 60 MVAR.
> **Data source:** Worked example from section 24.7.
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** TSO setpoint green, ramp-limited output orange, measured output blue, reactive power red. Dual vertical axes clearly labelled.

---

## Key Takeaways

- **The PPC exists because Spain proved a grid cannot run at 53% wind without it.** Denmark's TF 3.2.5 (2004) created the first legal requirement for active power setpoint control. REE's CECRE (2006) built the first centralised renewable energy control system in the world — 448 wind facilities, 15,500 MW, telemetry every 12 seconds. NC RfG Article 22 (2016) made it European law. The progression from Danish grid code to Spanish control centre to European regulation took twelve years.

- **The TSO sees one bus; the PPC manages 34.** The three-level hierarchy separates timescales: the TSO issues a target every few minutes; the PPC dispatches to turbines every 1–5 seconds; each turbine closes its own inner loop every 100–200 ms. A fault response that takes 5 ms belongs to the turbine level. A setpoint that updates every 15 minutes belongs to the TSO level. The PPC is the translator between them.

- **Pro-rata dispatch is the correct fair-share algorithm.** Equal division fails when turbines have unequal availability. Proportional allocation — each turbine receives a setpoint equal to its fraction of total available power — is self-balancing, fault-tolerant, and minimises aerodynamic stress during curtailment. The denominator is total available power; the farm target is always met at plant level.

- **Ramp rates are asymmetric by design.** PSE specifies ramp-up at 10% Pn/min and ramp-down at 20% Pn/min. The 2:1 ratio reflects the different risk profiles: reducing generation too slowly prolongs a congestion or frequency event; increasing generation too quickly is inherently conservative. Emergency ramp-down at 2% Pn/s — zero from full power in 51 seconds — is reserved for declared grid emergencies.

- **Deliberate curtailment expands reactive capacity.** At reduced active power, each WTG converter's available reactive headroom increases: $Q_{\text{avail}} = \sqrt{S^2 - P^2}$. A curtailed farm is a more flexible reactive power asset than a fully loaded one. TSO requests for simultaneous curtailment and reactive support are not contradictory — they ask the farm to move along its capability curve, not off it.

---

## For Further Reading

- **Energinet.dk (2004).** *Technical Regulation TF 3.2.5: Wind turbines connected to grids with voltages above 100 kV.* Energinet.dk, Fredericia, Denmark, December 2004. Available at energinet.dk. The founding document for active power control requirements from large wind farms — the first grid code anywhere to require setpoint tracking, delta control, and ramp rate compliance. Engineers new to grid code compliance should read this document alongside NC RfG Chapter IV (Articles 18–24) to see how a 2004 Danish requirement propagated into 2016 European law with only minor modifications to the conceptual framework.

- **Juberias, G., Romero, R., Carpio, J. & Villafáfila, R. (2009).** "New Trends in Power Quality Monitoring." *IEEE Instrumentation and Measurement Magazine*, Vol. 12, No. 4, pp. 19–25. DOI: 10.1109/MIM.2009.5248287. Describes CECRE's technical architecture: the 12-second telemetry cycle, the CGC intermediary layer, and REE's real-time constraint management system. One of the few English-language papers explaining how Spain's centralised control system works operationally rather than conceptually. The architecture — hierarchical aggregation through intermediate control centres, setpoints via standard SCADA protocols, compliance confirmed by telemetry — maps directly onto modern virtual power plant designs for aggregated distributed energy resources.

- **Aho, J., Buckspan, A., Laks, J., Fleming, P., Jeong, Y., Dunne, F., Churchfield, M., Pao, L. & Johnson, K. (2012).** "A tutorial of wind turbine control for supporting grid frequency through active power control." *Proceedings of the 2012 American Control Conference*, Montréal, June 2012. DOI: 10.1109/ACC.2012.6315180. Covers all four active power modes described in this chapter — power reference, delta control, ramp control, and inertial response — with mathematical derivations applicable to any wind turbine size. The tutorial's treatment of delta control (section IV) and the transition between power reference and frequency response (section V) provides the theoretical grounding for Chapters 24 and 25 of this book. NREL open-source code implementing these controllers is available at github.com/NREL/FLORIS.

---

*Two hours after the dispatch test, Rafael was called to a protection coordination meeting with Sigrid and Stefan. He left Kaan at the PPC workstation with a running simulation: the farm in DELTA_CONTROL mode, holding a 50 MW reserve margin below available power.*

*Kaan watched the turbine setpoints move. Wind gusted across the farm — the available power estimate climbed from 487 MW to 493 MW, and the PPC adjusted every setpoint proportionally within one cycle: five seconds. The 50 MW margin held. From the TSO's perspective, the farm looked like a thermal generator with 50 MW of spinning reserve.*

*He looked at the photograph above Rafael's desk. November 2009. Eleven thousand megawatts of Spanish wind, a control centre in Madrid receiving telemetry every twelve seconds, a grid operator with the ability to call any of it back within fifteen minutes. The photograph was not a record of wind power's triumph over the grid. It was a record of wind power submitting to it — agreeing to be dispatchable, agreeing to hold reserves, agreeing to behave like a power station rather than a weather phenomenon.*

*That was the deal. The grid would accept wind at 53.7 percent of demand. In return, the wind had to accept that someone would always have their hand on the dial.*

*A notification appeared at the top of the PPC screen. Not from the simulation. From the OSS SCADA system. The alert text was brief: FREQUENCY ALERT — 49.82 Hz — PSE NETWORK — MEASURED AT 220 kV BUS.*

*Kaan checked the time. The LFSM-U threshold was 49.8 Hz. The frequency was still falling.*

*He reached for his radio. Then stopped. A hand appeared on the doorframe — Anders, stepping in without knocking.*

*"Don't touch anything," Anders said. "A thermal plant tripped in eastern Poland. Approximately 1,100 MW. Watch what the PPC does in the next thirty seconds."*

*On screen, the active power setpoint for the farm — currently 430 MW in delta mode — had not moved. The LFSM-U response was built into the PPC's automatic control: frequency below threshold, droop gain applied, farm allowed to increase toward available power. The setpoint was rising. Slowly.*

*But something else was also happening, something faster. The individual turbine power traces, visible in the bottom panel, were moving. Not slowly. Instantly.*

*"That is not the PPC," Kaan said.*

*"No," Anders said. He pulled up a chair. "That is stored kinetic energy — the mass of thirty-four rotors, released directly into the grid in the first five hundred milliseconds. Before the LFSM response has had time to move ten megawatts, this has already moved forty." He settled in. "Chapter 25. But tonight, watch. The PPC will catch up. And then you will understand why both are necessary — and why the grid code requires them at different timescales."*

---

## Notes

[1] Energinet TF 3.2.5 (2004) — first active power control requirement: Energinet.dk (2004). *Technical Regulation TF 3.2.5: Wind turbines connected to grids with voltages above 100 kV.* Fredericia, Denmark, December 2004. Available at energinet.dk. Section 6.3 specifies that wind farms must be capable of reducing output to a specified reference power level within 5 seconds of receiving the setpoint and holding within ±10% for sustained periods. The document also introduced delta control (fixed margin below available power), power gradient (ramp rate) constraint adjustable by TSO between 10% and 100% of rated power per minute, and balance control mode. This was the first technical regulation anywhere in the world to require active power setpoint compliance from a grid-connected wind farm. The concepts were later incorporated without significant modification into NC RfG Articles 15 and 22 (2016). The document was superseded internally within Energinet by successive TF revisions, but the 2004 text is available in the Energinet document archive.

[2] Spain's 87 mass-disconnection events in 2007: The figure of 87 incidents in 2007 in which more than 100 MW was lost from simultaneous LVRT-protection disconnections appears in Spanish regulatory impact assessments from 2008 cited in: Martínez, I., Etxegarai, A. & Eguia, P. (2007). "Experiences with the Implementation of Wind Energy P.O. 12.3 in Spain." *European Wind Energy Conference (EWEC)*, Milan, Italy, 2007. The events were the primary motivating evidence for the P.O. 12.3 compliance timeline — mandatory voltage-ride-through certification by 1 January 2010. Note that P.O. 12.3 (BOE-A-2006-18485, October 2006) addresses fault ride-through requirements for wind farms, not real-time active power dispatch; the dispatch mechanism is a separate obligation created by Royal Decree 661/2007 and implemented through CECRE. Engineers researching Spanish grid code history should distinguish carefully between these two instruments.

[3] CECRE — operational details and regulatory framework: Red Eléctrica de España (2021). *CECRE celebrates 15 years of commitment to the safe integration of green energy.* Redeia press release, 16 June 2021. Available: redeia.com. Specific operational figures (448 wind facilities, 23 CGC nodes, 12-second telemetry cycle, 15-minute setpoint compliance window) from: Juberias, G. et al. (2009). DOI: 10.1109/MIM.2009.5248287 (full citation in Further Reading). Mandatory obligation: Real Decreto 661/2007, de 25 de mayo, por el que se regula la actividad de producción de energía eléctrica en régimen especial. *Boletín Oficial del Estado*, No. 126, 26 May 2007. CECRE began operating in 2006 on a voluntary coordination basis and obtained mandatory supervisory authority over all special-regime generators above 10 MW upon RD 661/2007 coming into force. The November 8, 2009 wind record (53.7% of Spanish demand, 05:50 instantaneous) is documented in contemporary REE operational reports and cited in news coverage from REVE/evwind.es (8 November 2009) and Windpower Monthly.

[4] NC RfG active power control requirements: Commission Regulation (EU) 2016/631, Articles 15(2)(a) (delta control required for Type B and above), Article 22 (active power control capability for Type C and D), and Article 23 (synchronisation and reconnection, which governs the STARTING state machine transition). The ramp rate requirement — TSO-adjustable between 10% and 100% of rated power per minute — appears in Article 15(2)(c) for Type B and above. PSE's specification of 10% Pn/min up and 20% Pn/min down represents a national parameterisation within the bounds permitted under Article 22(1)(a). The PSE IRiESP ramp rate values cited in this chapter (10% up, 20% down, 2% Pn/s emergency) should be verified against the current edition of the IRiESP at pse.pl, as these parameters are subject to revision with each IRiESP update.

[5] Pro-rata dispatch and available power estimation: The pro-rata dispatch algorithm for wind farm active power control is described in: Aho, J. et al. (2012). DOI: 10.1109/ACC.2012.6315180 (full citation in Further Reading). The available power estimation formula (section 24.2) follows the IEC 61400-12-1:2017 power curve measurement methodology, extended to instantaneous estimation using nacelle-mounted anemometry. Uncertainty in nacelle anemometer measurements at mid-wind speeds (±5–8%) is quantified in: Bardal, L.M. & Sætran, L.R. (2016). "Influence of turbulence intensity on wind turbine power curves." *Energy Procedia*, Vol. 137, pp. 553–558. DOI: 10.1016/j.egypro.2017.10.384. For a derivation of the pro-rata dispatch optimality conditions under turbine availability constraints, see: Spudic, V., Baotic, M. & Peric, N. (2010). "Wind turbine power references in coordinated control of wind farms." *Automatika*, Vol. 51, No. 3, pp. 237–251. Available: automatika.fer.hr.

[6] STATCOM/WTG reactive coordination and curtailment capability expansion: The STATCOM-primary, WTG-secondary priority rule for reactive dispatch is standard practice in offshore substations equipped with FACTS devices, described in: Muljadi, E., Gevorgian, V. & Hossain-Babu, S. (2012). "Power plant model verification for wind and solar generation." *NREL Technical Report* TP-5500-55958, November 2012. Available: nrel.gov. The reactive capability expansion during curtailment ($Q_{\text{avail}} = \sqrt{S^2 - P^2}$) follows from the converter capability curve defined in IEC 61400-21-1:2019, Section 5.4 (converter active/reactive power capability). PSE IRiESP specifies that reactive power tracking accuracy at the 220 kV metering point must be maintained within ±2 MVAR under steady-state conditions and within ±5 MVAR during transient events lasting less than 30 seconds.

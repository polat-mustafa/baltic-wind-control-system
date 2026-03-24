# Chapter 22: Grid Codes: The Constitution of the Power System

*Anders was on a video call when Kaan arrived. The OSS control room was dim at 09:15 — the north-facing windows had not found the morning light yet — and the glow of Anders's monitor filled the near corner with pale blue. On the screen, a man in a formal shirt sat at a desk in what looked like a large open-plan office. Behind him, a wall-mounted display showed a single-line diagram of something Kaan could not identify at this distance: a network of nodes and transmission lines, some shaded green, one flashing amber.*

*Kaan sat in the observer's chair near the door and did not speak.*

*Anders was talking quietly, switching between Polish and English in a way that suggested the Polish was for precision and the English for technical terms that had never been translated because they did not need to be. "Weryfikacja rampingu. Test response. Annex D." He had a printed document open with two columns of numbers, and he ran his finger down the right column while the man in Warsaw spoke.*

*Twenty-three minutes later the call ended. Anders closed the laptop with one hand and reached for his coffee with the other.*

*"You understood nothing," he said.*

*"About thirty percent," Kaan said. "Maybe."*

*"Thirty percent is generous." There was no edge in it. Anders had the particular patience of people who have been explaining things for a long time and have stopped expecting it to happen all at once. He opened his tablet and set it flat between them. On screen: Commission Regulation (EU) 2016/631 of 14 April 2016 establishing a network code on requirements for grid connection of generators. A PDF. Ninety-seven pages, bookmarked at Article 13.*

*"That was the PSE grid compliance team in Warsaw. They want confirmation that the Power Plant Controller setpoint response test was performed to the schedule in Annex D of the connection agreement. Which means they want a signed test report. Which means I need Elif to countersign a document she signed last week and filed in the commissioning package before the compliance package." He paused. "It is that kind of morning."*

*Kaan looked at the title on the tablet. "Is this what the call was about?"*

*"Partly. They also wanted to confirm our position on LFSM-U — underfrequency response. The European network code does not mandate it for Type D generators. It is national discretion. PSE exercises that discretion." He turned the tablet around. "So we comply."*

*"What is LFSM-U?"*

*"Sit down," Anders said. "We will begin at the beginning."*

---

## 22.1 Why Voltages Need Rules

The largest accidental synchronised cascade in European power system history began with a ship.

On the evening of 4 November 2006, the cruise ship *Norwegian Pearl* was making its way down the Ems River in northwestern Germany, being towed from the Meyer-Werft shipyard at Papenburg toward the North Sea. Meyer-Werft builds some of the largest cruise ships in the world at a site 40 kilometres inland, and launching a completed vessel requires threading it through a river and under a series of high-voltage power line crossings. The operation occurs several times a year. For each one, the operators of the crossing lines apply for and receive permission to temporarily de-energise the relevant circuits during the transit window.

On 4 November, E.ON Netz — the high-voltage transmission operator for the region — had a planned permission to open the 380 kV Landesbergen-Wehrendorf line to allow the ship's passage. At 22:10:11 CET, they executed the switching operation. It was legal. It was routine. It was correctly performed.

Seventeen seconds later, the Continental European synchronous grid had split into three asynchronous islands. In the western island — covering France, Spain, Portugal, and part of Germany — frequency dropped to below 49 Hz before automatic load shedding arrested the fall. Over ten million homes lost power. Restoration took hours.[1]

No individual error had occurred. E.ON Netz had done exactly what their plan permitted. But the plan had been developed in isolation. Two adjacent transmission system operators — RWE in Germany and operators in Belgium and the Netherlands — had not been consulted about the combined effect of the switching operation given the prevailing power flows across the border on that particular evening. N-1 contingency analysis, if run for the region as a whole, would have shown that the system was operating dangerously close to its stability limits. But cross-border coordination was not mandatory. The grid code governing E.ON Netz's operations did not require consultation with neighbouring TSOs before a planned outage. So none happened.[2]

The investigation, led by the UCTE — Union for the Coordination of Transmission of Electricity — identified the root cause not as operator error but as the structural absence of coordinated requirements across national boundaries. The grid was continental. The rules were national. The report was submitted to the European Commission in January 2007. What followed was years of consultation, working groups, and legal drafting — and eventually, Commission Regulation (EU) 2016/631, the Network Code on Requirements for Grid Connection of Generators, which entered into force on 17 May 2016.[3]

"The accident happened," Anders said, "because the grid code was national and the grid was continental. The regulation fixed the mismatch." He turned a page. "Every requirement in this document — every voltage band, every frequency range, every reactive margin — is an engineering response to something that went wrong or could go wrong. It is not bureaucracy. It is crystallised incident reports."

The idea that technical standards are encoded experience is not unique to electrical engineering. Building codes that require specific seismic detailing were written after buildings fell. Aviation fuel reserve rules were written after aircraft ran dry. Grid codes are the same genre: they are the power system's attempt to prevent future versions of events it has already survived.

What makes the power system's case distinctive is scale and indivisibility. There is one Continental European synchronous zone, spanning 24 countries and over 700 GW of generation, all rotating in electrical synchrony. Every generator, every large load, every transmission switching operation affects everyone else. The voltage at the 220 kV bus of an offshore wind farm in the Baltic Sea is one small contribution to the same continuous electromagnetic field that lights apartments in Lisbon and factories in Bucharest. When the resource is shared and the consequences are collective, the rules must be binding.

<!-- IMAGE: fig-22-01 -->
> **Figure 22.1** — The Continental European synchronous zone and the three islands formed during the 4 November 2006 disturbance
> **Type:** geographic map
> **Content:** Political map of Europe with the Continental European synchronous area shaded blue. Major 400 kV transmission corridors shown as grey lines. Three coloured regions show the islands that formed at 22:10:28 CET: West island (France, Spain, Portugal, western Germany) in yellow; Central island (central Germany, Austria, Switzerland) in orange; Southeast island (Italy, Balkans, Greece) in red. Small inset at lower-left: the Ems River crossing near Papenburg with Norwegian Pearl's route and the Landesbergen-Wehrendorf line marked. Arrow indicates switching point. Legend shows: synchronous zone boundary, major transmission corridors, three 2006 islands.
> **Caption:** The Continental European synchronous zone (24 countries, approximately 700 GW generation capacity) and the three asynchronous islands that formed during the 4 November 2006 cascade disturbance, which lasted approximately 27 minutes before resynchronisation. The event originated at the Landesbergen-Wehrendorf 380 kV line crossing on the Ems River.
> **Alt text:** Map of Continental Europe showing the synchronous grid boundary and the three islands that formed during the 2006 blackout, with an inset showing the Ems River switching location.
> **Data source:** UCTE Final Report (January 2007), adapted
> **Resolution:** 1600 × 1200 px minimum
> **Color notes:** Synchronous zone in light blue; three islands in yellow/orange/red; blackout initiation point marked with red star.

---

## 22.2 The Regulatory Hierarchy

Grid codes operate at three levels, and the hierarchy matters as much as the content.

**Level 1: EU Network Codes**

Commission Regulation (EU) 2016/631 — NC RfG — is directly applicable EU law. It does not need to be transposed into national legislation. From the date of application, it overrides any conflicting provision in a national grid code throughout the European Union.[3]

NC RfG is one of three European network codes covering electricity connections. The others are Commission Regulation (EU) 2016/1388 (Demand Connection Code) and Commission Regulation (EU) 2016/1447 (HVDC Connection Code). For an offshore AC wind farm connecting at 220 kV, NC RfG governs. When the export connection goes HVDC — as many future Baltic projects will — the HVDC code applies to the converter station.

NC RfG specifies minimum requirements: the floor below which no member state may go. It explicitly permits national grid codes to impose stricter requirements. Most do.

**Level 2: National Grid Code — PSE IRiESP**

The Polish transmission system operator's operational document is the *Instrukcja Ruchu i Eksploatacji Sieci Przesyłowej* — the Transmission Network Operation and Exploitation Instructions, universally called IRiESP. Published by PSE (Polskie Sieci Elektroenergetyczne) and updated periodically, IRiESP applies all NC RfG requirements and adds Poland-specific parameters: ramp rate limits, emergency active power reduction speeds, and the requirement for LFSM-U that Anders mentioned to the Warsaw team.[4]

IRiESP cannot be weaker than NC RfG. It can require more. PSE requires more.

**Level 3: Grid Connection Agreement**

At the project level, the developer and PSE sign a binding Grid Connection Agreement that specifies: the Point of Common Coupling (the 220 kV busbar at the onshore substation); the Maximum Contracted Power; any project-specific derogations (none for this farm); and the compliance demonstration schedule in its annexes — the document that generated the morning's call.

The agreement is where the abstract requirements of NC RfG and IRiESP become concrete obligations with dates, test procedures, and signatures. Every requirement in the regulation is crystallised into a test in Annex D, and every test produces a signed report that PSE audits before issuing the Final Operating Notification (FON) — the document that says the farm may operate commercially.

> **Standard reference:** Commission Regulation (EU) 2016/631, Article 4 (scope and applicability), Article 5 (Type classification), Articles 13–22 (Type D requirements). Implemented in Poland under: PSE IRiESP, Chapter 7 (Generation units), Section 7.4 (Requirements for wind power plants at transmission voltage level). [3][4]

<!-- IMAGE: fig-22-02 -->
> **Figure 22.2** — The three-level regulatory hierarchy for grid connection of offshore wind farms in Poland
> **Type:** nested rectangle diagram
> **Content:** Three concentric rectangles, outermost to innermost. Outer: "EU Network Code — NC RfG — Commission Regulation (EU) 2016/631 — in force 17 May 2016" with note "Minimum floor — directly applicable EU law — cannot be weakened at national level." Middle: "National Grid Code — PSE IRiESP (Poland)" with note "Stricter than EU floor — adds LFSM-U, specific ramp rates (10%/20% Pn/min), emergency reduction (2% Pn/s), SCADA connectivity requirements." Inner: "Grid Connection Agreement — project-specific bilateral contract" with note "Specifies PCC, Maximum Contracted Power, compliance test schedule (Annex D), FON conditions." Two-headed arrows between layers labelled "can be stricter, not weaker."
> **Caption:** The three-level regulatory hierarchy for offshore wind farm grid connection in Poland. Each level adds requirements above the floor set by the level above; no level may reduce the requirements of the level above it.
> **Alt text:** Nested rectangle diagram showing EU Network Code as outer layer, national grid code as middle layer, and project connection agreement as inner layer, with annotations showing the stricter-not-weaker relationship.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** EU level in blue; national level in amber; project level in green.

---

## 22.3 Type D: The Premium Classification

NC RfG divides all power-generating modules into four types based on maximum capacity and connection voltage. The classification determines which requirements apply.

| Type | Capacity threshold (Continental Europe) | Additional voltage criterion |
|------|----------------------------------------|------------------------------|
| A | ≥ 0.8 kW | — |
| B | ≥ 1 MW | — |
| C | ≥ 50 MW | — |
| D | ≥ 75 MW, or any capacity connecting at ≥ 110 kV | |

A 15 kW residential solar inverter is Type A. A 2 MW battery storage unit is Type B. A 60 MW onshore wind farm is Type C. A 510 MW offshore wind farm connecting at 220 kV is Type D under two independent criteria simultaneously: it is far above 75 MW, and its connection voltage is seven times the 110 kV threshold.[5]

The distinction matters because Type D requirements are the most demanding in the regulation. Type D must satisfy everything required of Types A, B, and C, and in addition must demonstrate:

- A defined reactive power capability over the full active power operating range
- Fault ride-through capability during zero-voltage faults at the connection point
- Frequency-responsive active power control in overfrequency mode (LFSM-O), and underfrequency mode (LFSM-U) if the national code requires it
- The ability to receive and execute active and reactive power setpoints from the TSO via a Power Plant Controller
- Post-fault active power recovery to pre-fault levels within a defined time window
- Synthetic inertia or fast frequency response capability, if the national code requires it

"The phrase 'Type D,'" Anders said, "means that you have made a commitment. You are not a load. You are not a small distributed generator that can disappear without notice. You are a large source of active and reactive power on the transmission network, and the TSO is depending on you to behave in a predictable way under all conditions — including the most difficult ones." He looked at the tablet. "Every chapter from here to Chapter 27 is one item on that list."

<!-- IMAGE: fig-22-03 -->
> **Figure 22.3** — NC RfG Type classification summary for the Continental European synchronous area
> **Type:** structured table with highlighted row
> **Content:** Five-column table: Type, Capacity threshold (Continental Europe), Voltage criterion, Key requirements added at this type, Example installation. Type A row: 0.8 kW, any, LFSM-O only, residential PV. Type B row: 1 MW, any, adds voltage operating range. Type C row: 50 MW, any, adds reactive capability. Type D row: 75 MW or ≥110 kV, adds FRT, LFSM-U (national discretion), PPC, synthetic inertia (national discretion), offshore wind farm; row highlighted in green. Footnote: "Thresholds shown are Continental European maxima; national TSOs may specify lower thresholds."
> **Caption:** NC RfG Type classification for power-generating modules in the Continental European synchronous area. The 510 MW reference farm qualifies as Type D under both the capacity criterion (510 MW >> 75 MW) and the voltage criterion (220 kV >> 110 kV).
> **Alt text:** Table showing NC RfG Type A through D classification, with capacity thresholds, voltage criteria, key added requirements, and example installations. Type D row is highlighted.
> **Data source:** Commission Regulation (EU) 2016/631, Article 5 and national implementing notifications
> **Resolution:** 1200 × 600 px minimum
> **Color notes:** Type D row highlighted green; other rows in alternating light grey and white.

---

## 22.4 Voltage Range and Reactive Capability

The power system exercises two fundamental control variables at every bus: active power and reactive power. Active power determines whether there is enough energy to meet demand. Reactive power determines whether voltages are within acceptable bounds. A generator that can control both is far more valuable to a TSO than one that can only control active power — and NC RfG Article 21 reflects that value by mandating reactive capability across a defined operating range for Type D generators.

The link between reactive power and power factor was established in Chapter 16. From the complex power relationship $S = P + jQ$ and the definition $pf = P/|S| = \cos\phi$, it follows that:

$$Q = P \cdot \tan\!\left(\cos^{-1}(pf)\right) = P \cdot \frac{\sqrt{1 - pf^2}}{pf}$$

where:
- $Q$ = reactive power [MVAR] — positive (inductive/lagging) means the generator absorbs reactive power from the network; negative (capacitive/leading) means it injects reactive power
- $P$ = active power output [MW]
- $pf$ = power factor at the connection point (dimensionless, 0 to 1)

NC RfG Article 21 requires that a Type D generator be capable of operating at any power factor between $pf_{min,lag}$ and $pf_{min,lead}$ at the connection point, at all active power levels above a minimum threshold. PSE IRiESP specifies $pf_{min} = 0.95$ (both lagging and leading) at the 220 kV connection point.[6] The maximum reactive power requirement at rated active output is therefore:

$$Q_{max} = P_n \cdot \tan\!\left(\cos^{-1}(pf_{min})\right)$$

where:
- $Q_{max}$ = required reactive power range (symmetric) [MVAR]
- $P_n$ = rated active power at the connection point [MW]
- $pf_{min}$ = minimum required power factor = 0.95

For a 500 MW reference farm:

$$Q_{max} = 500 \times \tan\!\left(\cos^{-1}(0.95)\right) = 500 \times 0.3287 = 164 \text{ MVAR}$$

The farm must therefore be capable of absorbing up to 164 MVAR (STATCOM operating inductively, suppressing the no-load Ferranti voltage rise) and injecting up to 164 MVAR (STATCOM operating capacitively, supporting voltage during fault recovery). The ±120 MVAR STATCOM combined with ±50 MVAR of WTG converter reactive capability gives ±170 MVAR total — 6 MVAR above the NC RfG requirement.

This is not coincidence. The STATCOM sizing exercise in Chapter 20 was driven by three simultaneous boundary conditions: no-load Ferranti absorption, FRT reactive current injection, and rated-power reactive capability. The NC RfG $pf = 0.95$ requirement was the binding condition at rated power. The regulation and the equipment sizing are two views of the same engineering problem.

**The Q(V) Droop Mode**

Beyond the static power factor requirement, NC RfG and PSE IRiESP both recognise that voltage regulation is most effective when the generator's reactive output responds dynamically to voltage deviations at the connection point — injecting more reactive power when voltage falls, absorbing more when voltage rises. This Q(V) droop characteristic takes the form:

$$Q = Q_{ref} - k_V \cdot (V - V_{ref})$$

where:
- $Q_{ref}$ = reactive power setpoint at the reference voltage [MVAR]
- $k_V$ = voltage droop gain [MVAR/kV] — positive means increased Q injection as voltage falls
- $V$ = measured voltage at the connection point [kV]
- $V_{ref}$ = voltage reference setpoint [kV]

The Power Plant Controller (Chapter 24) selects between the fixed power factor mode, the fixed reactive power mode, and the Q(V) droop mode based on the TSO's operating instruction. In normal operation, PSE typically requests Q(V) droop mode. During a fault, the converter switches to maximum reactive current injection regardless of the Q(V) setpoint — which is the subject of Chapter 23.

<!-- IMAGE: fig-22-04 -->
> **Figure 22.4** — PQ capability diagram for the 500 MW reference farm at rated active power
> **Type:** PQ capability chart
> **Content:** Horizontal axis: active power P [MW], 0 to 510. Vertical axis: reactive power Q [MVAR], −180 to +180. Inductive absorption is positive Q (upper half); capacitive injection is negative Q (lower half). The NC RfG required envelope is a trapezoidal grey region: at Pn = 500 MW, required range is ±164 MVAR; at P = 0, a reduced reactive capability requirement applies. The actual farm capability envelope (STATCOM ±120 MVAR + WTG ±50 MVAR) is a larger green region. The pf = 0.95 lagging and leading lines are drawn as dashed lines from the origin. A small bracket at Pn annotates "164 MVAR required / 170 MVAR available / 6 MVAR margin."
> **Caption:** PQ capability diagram for a 500 MW offshore wind farm. The grey region represents the NC RfG Type D required reactive power envelope at the 220 kV connection point (pf = 0.95 minimum, PSE IRiESP). The green region is the available capability (STATCOM ±120 MVAR plus WTG converter ±50 MVAR). At rated output, the available reactive capability exceeds the NC RfG minimum by 6 MVAR.
> **Alt text:** PQ diagram with active power on the horizontal axis and reactive power on the vertical axis, showing the NC RfG required envelope in grey and the larger available capability envelope in green.
> **Data source:** Author illustration; NC RfG Article 21; PSE IRiESP Section 7.4
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Required envelope grey; available capability green; pf reference lines dashed black; margin annotation in orange.

---

## 22.5 Frequency Response: LFSM-O and LFSM-U

Grid frequency is the power system's universal clock. In a synchronous AC network, every generator connected to the grid rotates at exactly the same electrical speed — 50 Hz in continental Europe. When mechanical power injected into the grid exactly matches electrical power consumed, frequency holds at 50 Hz. When a large generating unit trips and consumption briefly exceeds generation, frequency falls. When a large load disconnects and generation briefly exceeds consumption, frequency rises.

The amplitude of any frequency deviation, and the speed of recovery, depend on two things: the total rotational inertia of all connected synchronous machines (which resists the change), and the ability of generators to adjust their active power output within seconds to restore the balance. NC RfG Article 13 requires Type D generators to operate continuously across the range 47.5–51.5 Hz — this is not merely a survival requirement but an operating range across which the generator must maintain full controllability.

**Limited Frequency Sensitive Mode — Overfrequency (LFSM-O)**

When frequency rises above the nominal, generation is temporarily exceeding consumption somewhere in the grid. Left uncorrected, frequency continues to rise until generator protections begin to trip — which would make the imbalance worse. NC RfG Article 13(2) requires that all Type D generators reduce active power output when frequency exceeds a threshold:

$$\Delta P_{LFSM\text{-}O} = -P_0 \cdot \frac{f - f_1}{f_n \cdot \sigma}$$

where:
- $\Delta P_{LFSM\text{-}O}$ = active power change due to LFSM-O [MW] — negative means reduction
- $P_0$ = active power output immediately before the frequency deviation [MW]
- $f$ = measured grid frequency [Hz]
- $f_1$ = LFSM-O activation threshold = 50.2 Hz (above the 200 mHz deadband)
- $f_n = 50$ Hz = nominal frequency
- $\sigma$ = droop coefficient (dimensionless) = 0.05 (5%), specified by PSE IRiESP

The deadband: for $|f - 50| \leq 200$ mHz, no response is required and the generator operates normally. LFSM-O only activates for $f > 50.2$ Hz.

**Limited Frequency Sensitive Mode — Underfrequency (LFSM-U)**

NC RfG does not mandate LFSM-U for Type D generators — it classifies underfrequency response as national discretion. PSE exercises that discretion, and IRiESP requires that the farm be capable of increasing active power output (when operating below maximum available generation) when frequency falls below 49.8 Hz:

$$\Delta P_{LFSM\text{-}U} = +P_{avail} \cdot \frac{f_2 - f}{f_n \cdot \sigma}$$

where:
- $\Delta P_{LFSM\text{-}U}$ = active power increase [MW] — positive means increase
- $P_{avail} = P_{max,available} - P_0$ = available headroom above current output [MW]
- $f_2$ = LFSM-U activation threshold = 49.8 Hz
- All other variables as above

LFSM-U requires the farm to maintain a controlled headroom — a deliberate underproduction — so that it has capacity to increase output when the TSO needs it. This is distinct from synthetic inertia. LFSM is a sustained steady-state response that holds for seconds to minutes. Synthetic inertia is a burst response in the first hundreds of milliseconds after a frequency event. They address different timescales of the frequency control problem. PSE IRiESP requires both from Type D generators above 50 MW connecting at transmission voltage. Synthetic inertia is covered in Chapter 25.

"The key distinction," Anders said, looking up, "is timescale. LFSM activates over seconds and sustains the response for minutes. Synthetic inertia activates in under a second and provides a burst that decays. They work together — the burst arrests the initial drop, the sustained response restores the balance." He closed the frequency page. "But LFSM-U only works if the farm is not already at its aerodynamic maximum. If the wind is blowing at rated speed and every turbine is at full output, there is no headroom to give. This is why PSE sometimes issues a curtailment order — not to waste energy, but to buy reserve."

<!-- IMAGE: fig-22-05 -->
> **Figure 22.5** — LFSM-O and LFSM-U frequency response characteristics
> **Type:** line chart
> **Content:** Horizontal axis: grid frequency f [Hz], from 47.5 to 51.5. Vertical axis: active power change ΔP [% of P₀ or P_avail], from −30% to +15%. Nominal frequency 50 Hz shown as dashed vertical black line. Deadband region (49.8–50.2 Hz) shaded light grey. LFSM-O region (f > 50.2 Hz): red line sloping downward from (50.2, 0%) to (51.5, −26%), labelled "LFSM-O: 5% droop, activates at 50.2 Hz." LFSM-U region (f < 49.8 Hz): blue line sloping upward from (49.8, 0%) to (49.0, +8%), labelled "LFSM-U: 5% droop, limited by P_avail." Continuous operating limit at 47.5 Hz shown as solid vertical red line at left. The 50.2 Hz and 49.8 Hz deadband edges annotated with dashed vertical lines. Note at bottom: "LFSM-U operates on available headroom only — response amplitude varies with operating point."
> **Caption:** LFSM-O (overfrequency, red) and LFSM-U (underfrequency, blue) active power response characteristics for a Type D generator with 5% droop and ±200 mHz deadband. LFSM-O is mandatory under NC RfG; LFSM-U is required by PSE IRiESP. Both operate on a sustained timescale (seconds to minutes), distinct from the sub-second synthetic inertia response (Chapter 25).
> **Alt text:** Line chart showing linear active power reduction above 50.2 Hz (LFSM-O in red) and linear active power increase below 49.8 Hz (LFSM-U in blue), with a 400 mHz deadband centred on 50 Hz.
> **Data source:** Commission Regulation (EU) 2016/631, Article 13; PSE IRiESP Section 7.4
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** LFSM-O in red; LFSM-U in blue; deadband in light grey; nominal frequency dashed black; operating limits in solid red at 47.5 Hz and 51.5 Hz.

---

## 22.6 The PSE IRiESP Layer

Poland's IRiESP adds specific numerical requirements above the NC RfG floor that reflect the operational characteristics of the Polish transmission system. The PSE system is a large but relatively isolated corner of the Continental European synchronous zone — cross-border interconnections exist with Germany, the Czech Republic, Slovakia, and the Baltic states, but the internal Polish network is not as heavily meshed as the core Central European grid, and the increasing penetration of offshore wind on the Baltic coast concentrates variability in a region where the network has historically relied on thermal generation.

The key IRiESP parameters for an offshore wind farm connecting at 220 kV are:

**Active power ramp rate limits**

The maximum rate at which the farm may increase or decrease active power output during normal operation, expressed as a fraction of rated output per minute:

$$\dot{P}_{up} \leq r_{up} \cdot P_n \qquad \dot{P}_{down} \leq r_{down} \cdot P_n$$

where:
- $\dot{P}_{up}$ = maximum upward ramp rate [MW/min]
- $\dot{P}_{down}$ = maximum downward ramp rate [MW/min]
- $r_{up}$ = 10% per minute (PSE IRiESP) → $\dot{P}_{up} \leq 0.10 \times 500 = 50$ MW/min
- $r_{down}$ = 20% per minute (PSE IRiESP) → $\dot{P}_{down} \leq 0.20 \times 500 = 100$ MW/min
- Emergency reduction on TSO command: 2% $P_n$/s = 10 MW/s

The asymmetry — downward ramp twice as fast as upward — reflects grid operational reality. When curtailment is ordered, the TSO wants rapid compliance. When wind conditions improve, the grid needs time to accommodate the new generation without overloading adjacent transmission corridors.

**Frequency response parameters**
- Deadband: ±200 mHz (matching NC RfG Article 13 default)
- Droop: 5% (PSE specifies the exact value; NC RfG allows national specification within defined bounds)
- LFSM-U required: activates at $f < 49.8$ Hz

**Setpoint accuracy and response time**
- Active power setpoint accuracy: ±5% $P_n$ = ±25 MW
- Reactive power setpoint accuracy: ±2 MVAR
- Normal setpoint response time: within 30 seconds
- Emergency setpoint response time: within 10 seconds

**Power Plant Controller requirement**

PSE IRiESP explicitly requires that a Power Plant Controller be installed and operational for any wind farm above 50 MW connecting at transmission voltage. The PPC must receive and execute both active power and reactive power/voltage setpoints from PSE's Energy Management System. This is the subject of Chapter 24. The call this morning was about the PPC ramp test in Annex D. When the ramp test signed document exists, one more box on the compliance matrix closes.

---

## 22.7 Worked Example: NC RfG Type D Compliance Matrix

The compliance demonstration for an offshore wind farm connecting at 220 kV under NC RfG Type D consists of verifying each technical requirement against the farm's design parameters. The table below addresses six key requirements to illustrate the verification logic. The full compliance package takes several hundred pages of simulation reports, commissioning test procedures, and signed test results.

**Requirement 1: Voltage Operating Range**

NC RfG Article 13 requires continuous operation at the connection point between 0.85 pu and 1.05 pu. At 220 kV: 0.85 × 220 = 187 kV (minimum), 1.05 × 220 = 231 kV (continuous maximum), 1.10 × 220 = 242 kV (limited duration per IRiESP).

GIS switchgear rating: IEC 62271-100, 245 kV rated. Equipment operational minimum: 0.78 pu (172 kV). Equipment exceeds NC RfG continuous minimum (0.85 pu) by 7 percentage points. **PASS.**

**Requirement 2: Reactive Capability at Rated Power**

$$Q_{req} = 500 \times \tan\!\left(\cos^{-1}(0.95)\right) = 500 \times 0.3287 = 164 \text{ MVAR}$$

Available: STATCOM ±120 MVAR + WTG converters ±50 MVAR = **±170 MVAR**. Margin = +6 MVAR (3.7%). **PASS.**

**Requirement 3: LFSM-O at f = 50.5 Hz**

Frequency deviation above deadband: $\Delta f = 50.5 - 50.2 = 0.3$ Hz. At $P_0 = 500$ MW:

$$\Delta P = -500 \times \frac{0.3}{50 \times 0.05} = -500 \times 0.12 = -60 \text{ MW}$$

The PPC must reduce farm output from 500 MW to 440 MW when $f$ reaches 50.5 Hz. Full curtailment headroom (500 MW) is available. **PASS.**

**Requirement 4: Ramp Rate Compliance**

PPC ramp limiter configured with: upward 50 MW/min (10% $P_n$/min), downward 100 MW/min (20% $P_n$/min), emergency downward 10 MW/s. These parameters are software-configurable and were set and verified during PPC commissioning — the Annex D test. **PASS.**

**Requirement 5: Frequency Operating Range**

The WTG converters (Type 4, full-power IGBT topology) maintain controlled operation across 47.5–51.5 Hz without tripping. This is verified by Vestas's NC RfG type certification — a Declaration of Performance under EU 2016/631 submitted as part of the compliance documentation. **PASS** (delegated to WTG type certificate).

**Requirement 6: Fault Ride-Through**

NC RfG Article 20 requires Type D generators to remain connected during a zero-voltage fault at the connection point for a duration specified by the TSO — for PSE, 140 ms at 0 pu, followed by voltage recovery over the next 250 ms. The WTG and STATCOM must remain connected and inject maximum reactive current during the fault.

This requirement is sufficiently complex to require its own chapter. **See Chapter 23.**

### Compliance Summary

| Requirement | NC RfG / IRiESP Requirement | Design Value | Margin | Status |
|---|---|---|---|---|
| Continuous voltage range | 0.85–1.05 pu (187–231 kV) | 0.78–1.10 pu (equipment) | +7% below min | **PASS** |
| Reactive capability at $P_n$ | ±164 MVAR | ±170 MVAR | +6 MVAR | **PASS** |
| LFSM-O at $f$ = 50.5 Hz | −60 MW reduction | −500 MW available | Full headroom | **PASS** |
| Ramp rate (up / down) | 50 / 100 MW/min | 50 / 100 MW/min (PPC) | Zero (exact match) | **PASS** |
| Frequency operating range | 47.5–51.5 Hz | Certified by type test | WTG certificate | **PASS** |
| Fault ride-through | 0 pu for 140 ms + recovery | See Chapter 23 | → Ch 23 | **→** |

Five requirements verified analytically. The sixth requires dynamic simulation and a live commissioning test — and a chapter of its own.

---

## Key Takeaways

- **Grid codes are binding law, not guidelines.** Commission Regulation (EU) 2016/631 is directly applicable EU legislation that overrides conflicting national provisions. National grid codes (PSE IRiESP) can impose stricter requirements but cannot relax the EU floor. The project-level Grid Connection Agreement translates all of it into enforceable obligations with test dates and signatures.

- **Type D is the most demanding classification** and applies to any generator ≥ 75 MW or connecting at ≥ 110 kV in Continental Europe. At 510 MW and 220 kV, this farm qualifies under both criteria simultaneously. Chapters 23–27 address the six Type D requirements that cannot be verified with a single formula.

- **The reactive requirement drove the STATCOM size.** The NC RfG pf = 0.95 requirement at rated power translates to ±164 MVAR at the connection point. The STATCOM was sized to satisfy this requirement (plus FRT current injection and no-load Ferranti absorption) in Chapter 20. The regulation and the equipment sizing are inseparable.

- **LFSM is a sustained response; synthetic inertia is a burst response.** LFSM-O and LFSM-U provide proportional power reduction or increase over seconds to minutes. Synthetic inertia provides a fast burst in the first hundreds of milliseconds. Both are required by PSE IRiESP; they address different timescales of the frequency control problem. Chapter 25 covers the burst.

- **The 2006 European blackout wrote several of these requirements.** The cascade began with a correctly executed, legally permissible switching operation that E.ON Netz had every right to perform. Over ten million homes lost power because the rules were national and the grid was continental. NC RfG's mandatory cross-border consistency requirements are a direct consequence of what the UCTE investigation found.

---

## For Further Reading

- **Commission Regulation (EU) 2016/631** of 14 April 2016 establishing a network code on requirements for grid connection of generators. *Official Journal of the European Union*, L 112, 27.04.2016, pp. 1–68. Available in full from EUR-Lex (https://eur-lex.europa.eu/eli/reg/2016/631/oj). The definitive regulatory text. Article 5 covers Type classification; Articles 13–22 cover Type D requirements; Annex III contains the default voltage-reactive characteristic tables. Engineers working on offshore grid connection compliance in the EU should read Articles 3–5 and 13–22 before reviewing any compliance documentation — they are moderately dense but entirely readable once the physical concepts behind them are understood.

- **UCTE (2007).** *Final Report — System Disturbance on 4 November 2006.* Union for the Coordination of Transmission of Electricity (now ENTSO-E), Brussels, January 2007. Available from the ENTSO-E website. The complete investigation report into the European blackout. Section 2 reconstructs the event timeline in one-second resolution; Section 4 analyses the cause in terms of N-1 contingency analysis failure and absent cross-TSO coordination; Section 5 lists the recommendations that became the basis for NC RfG. Understanding why the regulation takes its specific form requires reading this report alongside the regulation.

- **Kundur, P. (1994).** *Power System Stability and Control.* McGraw-Hill, New York. ISBN 0-07-035958-X. Chapter 7 covers frequency control in interconnected power systems — the droop characteristic, area control error, and the relationship between generator inertia and frequency nadir following a generation loss. Chapter 11 covers voltage-reactive power control and the derivation of generator capability curves. Despite its age, this remains the standard graduate reference for the control concepts underlying the NC RfG technical requirements. The regulation encodes what Kundur analyses.

---

*They reached Requirement 6 just before noon. Anders had filled two A4 sheets. Kaan had filled three — one of which was largely questions that he had not yet found the right moment to ask.*

*"These five pass," Anders said, capping his pen. "The sixth — the fault ride-through — you cannot verify with a table and a formula. You have to simulate it, and then you have to demonstrate it with a live commissioning test, and then you have to file a fifty-page report with PSE that says what happened and how it compares to the simulation."*

*Kaan looked at his list. The phrase "fault ride-through" appeared seven times in his notes, each time accompanied by an arrow pointing at a question he had not yet finished writing.*

*"What actually happens," he said, "when the voltage drops to zero at the connection point?"*

*"The converter sees an absence of voltage reference," Anders said. "The DC link is still charged. The IGBT transistors are still switching. But the AC terminal voltage has collapsed, and the current controller — which is running at a sampling rate of several kilohertz — has to decide what to inject into a grid that is momentarily not there." He paused. "The decision is not made by logic in the traditional sense. It is made by a current controller operating faster than any relay in this building."*

*Outside, the afternoon sea was grey-green and heavy. The maintenance vessel that had been running between turbines five and six all morning had turned toward the OSS and was approaching the service quay. The inspection on turbine five was finished.*

*Kaan had started to know the turbines by number. Turbine five was the one with the longest array cable run — 6.2 kilometres from the first string junction box, the longest individual segment in the collector network. He had not known why he knew that. He had just accumulated it.*

*"Tomorrow," Anders said, "we run the simulation. I will explain what the converter does during those 140 milliseconds, and then you will watch what actually happens on the screen." He stacked the compliance sheets and set them beside the laptop. The PSE call notes were on top, Annex D circled in red.*

*"Bring something to write on," he said. "You will need it. The simulation generates approximately 200 data points in 150 milliseconds, and half of them will surprise you."*

*Kaan added "FRT simulation" to his list — item fourteen — and underlined it twice.*

---

## Notes

[1] The 4 November 2006 European power system disturbance: primary source is UCTE (2007). *Final Report — System Disturbance on 4 November 2006.* Union for the Coordination of Transmission of Electricity, Brussels, January 2007. DOI: not applicable (institutional report). Available: https://www.entsoe.eu/fileadmin/user_upload/_library/publications/ce/otherreports/Final-Report-20070130.pdf. Confirmed details per the final report: E.ON Netz opened the 380 kV Landesbergen-Wehrendorf line at 22:10:11 CET on Saturday 4 November 2006 to allow the cruise ship *Norwegian Pearl* (under construction at Meyer-Werft shipyard, Papenburg, being towed to the North Sea) to pass under the line on the Ems River — a routine planned operation occurring approximately 6–10 times per year. The UCTE grid split into three asynchronous islands at 22:10:28 CET, 17 seconds after the line opening. Over 10 million customers lost supply in at least nine countries, primarily in France and Italy. The cause was the absence of mandatory N-1 contingency coordination across TSO boundaries — not a procedural error by E.ON Netz operators, who followed their approved procedures correctly. The UCTE was subsequently absorbed into ENTSO-E (European Network of Transmission System Operators for Electricity) under Regulation (EC) 714/2009, effective 3 March 2011.

[2] Cascade analysis and recommendations: UCTE (2007), Section 4. The report found that three factors contributed to the severity: (1) the system was operating in an N-1 insecure state due to high transit flows that were not visible to E.ON Netz's local contingency analysis; (2) there was no mandatory notification or coordination requirement before planned outages affecting neighbouring TSO control areas; (3) the cascade tripped generation in Germany and France that exacerbated rather than arrested the frequency deviation in the West island. Section 5 contains twelve recommendations that became the basis for Commission Regulation (EU) 2017/1485 (Guideline on Electricity Transmission System Operation, GL SO&C) and NC RfG.

[3] Commission Regulation (EU) 2016/631 of 14 April 2016 establishing a network code on requirements for grid connection of generators (NC RfG). *Official Journal of the European Union*, L 112, 27 April 2016, pp. 1–68. Entered into force 17 May 2016. Available: https://eur-lex.europa.eu/eli/reg/2016/631/oj/eng. The regulation was developed by ENTSO-E under mandate from the European Commission following the adoption of the Third Energy Package (Directive 2009/72/EC). The development process ran from 2012 to 2015; the Commission adopted the regulation on 14 April 2016 with application dates staggered by Type classification. Type D requirements have been applicable since 17 May 2019, three years after the regulation entered into force, to allow member states to complete national implementation.

[4] PSE Instrukcja Ruchu i Eksploatacji Sieci Przesyłowej (IRiESP). Polskie Sieci Elektroenergetyczne S.A., Warsaw. Current edition available from https://www.pse.pl. The document is published in Polish; an English summary of wind farm connection requirements is available from PSE's international publications portal. The specific requirements cited in this chapter — ramp rates (10% Pn/min upward, 20% Pn/min downward), emergency reduction speed (2% Pn/s), frequency deadband (±200 mHz), LFSM-U threshold (49.8 Hz), droop (5%), setpoint accuracy (±5% Pn active, ±2 MVAR reactive), and PPC mandatory requirement for farms ≥50 MW at transmission voltage — are found in IRiESP Chapter 7 (Generation units), Section 7.4 (Requirements for wind power plants connected at transmission voltage level), current edition. Engineers should verify against the current edition as the document is periodically revised.

[5] NC RfG Type D classification thresholds: Commission Regulation (EU) 2016/631, Article 5, and national implementing notifications submitted to the European Commission. For the Continental European synchronous area, the maximum allowable Type D capacity threshold is 75 MW — national TSOs may specify lower thresholds (making the Type D classification apply to smaller generators) but not higher. Poland (PSE) specifies thresholds consistent with the EU maxima. Source: ENTSO-E (2019). *Overview of Transmission Tariffs in Europe: Synthesis 2019* and national implementing notifications; tracking available at https://www.entsoe.eu/network_codes/rfg/national-implementation. The separate voltage criterion — any generator connecting at ≥110 kV is Type D regardless of capacity — applies in addition to the capacity threshold; a 1 MW generator connecting directly to a 110 kV bus would be Type D. This is relevant for small embedded generators in HV distribution systems but not typical for offshore wind farms.

[6] Reactive power capability requirements: Commission Regulation (EU) 2016/631, Article 21(3)(a)(ii) sets the EU minimum requirement as a power factor between 0.925 lagging and 0.925 leading at the connection point at rated active power for Type D generators. PSE IRiESP Section 7.4 tightens this to 0.95 lagging and 0.95 leading at the 220 kV connection point for offshore farms — consistent with the NC RfG principle that national codes may be stricter. Note that 0.95 is numerically more restrictive than 0.925 in the sense that $\tan(\cos^{-1}(0.95)) = 0.329 < \tan(\cos^{-1}(0.925)) = 0.398$: the 0.95 requirement demands less reactive capability per MW of active power. The PSE requirement is actually less reactive-power-intensive than the EU minimum at rated active power, but PSE additionally requires the Q(V) droop mode and a wider reactive capability at partial load. The full PQ diagram envelope, not just the power factor at rated power, must be demonstrated as part of the compliance documentation.

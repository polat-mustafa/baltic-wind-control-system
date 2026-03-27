# Chapter 47: The Horizon

*The conference hall in Copenhagen had the characteristic acoustics of any large event venue: carpet that absorbed footsteps, a ceiling that distributed sound unevenly, and a faint hum from the air conditioning that became noticeable only in the pauses between sentences. Kaan had catalogued all of this during the three minutes between being handed the wireless clicker and walking to the edge of the stage.*

*On the screen behind him: a map of the North Sea and the Baltic, with existing HVDC transmission corridors drawn in orange and proposed future corridors in yellow. The yellow outnumbered the orange by approximately four to one.*

*"I want to be honest with you," he said, to the two hundred people in the room. "Two years ago, I arrived on an offshore service vessel in the Baltic Sea knowing that wind turbines rotate and that rotating things generate electricity. That was approximately the limit of my knowledge."*

*A few people smiled. Most were too young to find the admission surprising.*

*"What I know now is not everything. What I know now is one machine: thirty-four turbines, 510 megawatts, forty-five kilometres of export cable, sixty-six kilovolt arrays, a STATCOM, a power plant controller, a protection system, a SCADA network, a compliance certificate, and a reef. But the machine I described is not the machine most of you will spend your careers working on."*

*He advanced the slide.*

*"The machine you will spend your careers working on looks like this."*

*The screen changed: the North Sea Energy Island concept, an offshore hub surrounded by transmission corridors to six countries and wind farms totalling a projected 200 gigawatts of capacity. In the corner of the slide — he had photographed the original margin note and used it in every presentation he had given since month eighteen — four words in Anders's handwriting: floating, HVDC, hydrogen, 40 MW.*

*The audience did not laugh. They were engineers. They recognised those words as a specification, not an aspiration.*

---

## 47.1 HVDC-VSC and the Long-Distance Offshore Grid

The engineering constraint that governs the offshore energy transition is one that readers of Chapters 14 and 20 have already met in a different context.

A submarine AC cable generates reactive power proportional to its capacitance, its length, and the square of its voltage. The 45 km, 220 kV export cable in this reference project produces approximately 116 MVAR of reactive charging current — managed by the STATCOM and shunt reactor combination described in Chapter 20. That is a workable figure.

Now scale the problem. A 2 GW offshore wind farm at 90 m water depth, connecting to shore from a position 300 km offshore. The export cable is 525 kV XLPE submarine, shunt capacitance 0.18 µF/km:

$$Q_c = V_{LL}^2 \cdot \omega \cdot C_0 \cdot L = (525{,}000)^2 \times 2\pi \times 50 \times 0.18 \times 10^{-6} \times 300 = \mathbf{1{,}564}\ \text{MVAR}$$

where:
- $V_{LL}$ = line-to-line voltage [V]
- $\omega = 2\pi f$ = angular frequency [rad/s]
- $C_0$ = cable shunt capacitance per unit length [F/m]
- $L$ = cable length [m]

The cable generates 1,564 MVAR of reactive power from its own capacitance — before a single turbine produces a single watt of active power. The charging current this represents (approximately 1,720 A per phase) flows through the cable conductor in addition to the active-power load current (approximately 2,315 A per phase at rated output). The combined current per phase exceeds the thermal ampacity of any 2,000 mm² submarine cable in shallow-water burial. At 300 km, a single 525 kV AC cable cannot physically deliver 2 GW of active power because the charging current fills the available conductor capacity before the load current can.

This is not a cost problem. It is a physical impossibility — for AC.

High-voltage direct current eliminates the reactive power problem entirely. In a DC circuit there is no frequency, no reactive power, and no capacitive charging current. The cable's capacitance is charged once at start-up to a static DC voltage and remains there. Every electron that travels the 300 km carries active power, not reactive cycling.

The technology that makes this practical for offshore wind is the **Voltage Source Converter** (VSC), and the circuit topology that dominates new installations is the **Modular Multilevel Converter** (MMC). The MMC was first described by Rainer Marquardt at the Bundeswehr University Munich in 2001. A three-phase MMC consists of six arms, each constructed from a series string of **submodule** cells — capacitor-plus-switch pairs that are individually inserted or bypassed. By controlling which submodules are inserted at each instant, the converter synthesises a staircase approximation of a sine wave using hundreds of small voltage steps. The resulting output is so clean harmonically that the large AC filters required by older thyristor-based converters are unnecessary.[^1]

The losses in a modern MMC-HVDC converter station are approximately 0.5–1% of rated power:

$$P_{loss,VSC} = k_{VSC} \cdot P_{rated}$$

where:
- $k_{VSC}$ = converter station loss factor, typically 0.005–0.010 [-]
- $P_{rated}$ = rated power transfer [W]

For a 2 GW link with two converter stations (offshore and onshore), total converter losses are approximately 20–40 MW at full load — 1–2% of capacity. Combined with cable resistive losses (approximately 1–1.5% for 300 km of 2,000 mm² cable), total HVDC system losses are approximately 2–3.5%.

The **break-even distance** at which HVDC becomes cheaper than AC — accounting for the fixed cost premium of two converter stations — is approximately 80–100 km for submarine cables at current market prices. Every major deep-water offshore development being planned in the North Sea, the Celtic Sea, and the Norwegian Sea exceeds this threshold.

> **Standard reference:** IEC 62747:2014, "Terminology for voltage-sourced converters (VSC) for HVDC systems." Clause 3 defines VSC, MMC, submodule, and arm inductance. IEC TS 62786:2017 covers grid connection of inverter-based resources including HVDC converter stations. CIGRÉ Technical Brochure TB 492 "Voltage Source Converter (VSC) HVDC for Power Transmission — Economic Aspects and Comparison with Other AC and DC Technologies" (2012) provides the comparative cost framework.

The first offshore VSC-HVDC installation to connect a wind farm was BorWin1 in Germany — 400 MW, approximately 200 km of cable (125 km offshore, 75 km onshore) at 150 kV, connecting the BARD Offshore 1 wind farm to the mainland grid at Diele. The offshore converter platform was energised in 2009; persistent reliability problems with the converters delayed full commercial operation until 2012, contributing to the financial difficulties that eventually ended in BARD Energy's insolvency. It demonstrated the physical feasibility of offshore VSC-HVDC at scale and accelerated the cost reduction that has since made it the default architecture for long-distance offshore connections.[^2]

<!-- IMAGE: fig-47-01 -->
> **Figure 47.1** — HVDC Break-Even Distance: AC versus HVDC Total Cost
> **Type:** Line chart (cost versus cable length)
> **Content:** X-axis: submarine cable route length, 0–600 km. Y-axis: total transmission system cost, normalised to 1.0 at the HVDC break-even point. Two curves: (1) "AC HVAC 525 kV": starts lower than HVDC at short distances (no converter stations), increases non-linearly as reactive compensation platforms are added every 70–80 km; circles or triangles mark each compensation station at 80, 160, and 240 km. (2) "VSC-HVDC ±525 kV": starts higher (fixed converter station cost), then increases approximately linearly with cable length. Crossover point clearly annotated at approximately 85 km. Shaded region to the right of crossover: "HVDC preferred." Three project reference points plotted: reference case 45 km (in "AC preferred" zone, labelled "this project"); BorWin1 200 km (in "HVDC zone," labelled); hypothetical 2 GW deep-water extension 300 km (labelled, well into HVDC zone).
> **Caption:** Break-even distance analysis for offshore HVDC versus AC transmission at 2 GW. The converter station cost premium (approximately EUR 100–120M per station at current market rates) is recovered over approximately 80–85 km of submarine cable, beyond which HVDC offers lower total cost because the cost of reactive compensation platforms dominates the AC case. Every proposed offshore wind development beyond 100 km from shore in the North Sea region uses VSC-HVDC as the connection architecture.
> **Alt text:** Line chart showing AC and HVDC transmission costs versus cable distance, with crossover at approximately 85 km beyond which HVDC is preferred.
> **Data source:** Author illustration based on CIGRÉ TB 492 (2012), ENTSO-E TYNDP (2024), and IEA market data
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** AC curve in orange, HVDC curve in blue; break-even crossover marked with a dashed vertical line; project reference points as labelled circles

The world's first HVDC link — not VSC, but the foundational technology from which everything else descended — was commissioned on 20 September 1954. It connected the Swedish mainland to the island of Gotland using a 98 km submarine cable and converters built by ASEA in Västerås, rated at 20 MW. That company became ABB. Then, following further consolidation, it became Hitachi Energy. The engineer who commissioned the STATCOM on this reference project — Johan Carlsson, described in Chapter 20 — came from Västerås. The thread runs seventy years long, and it begins with one cable in the Baltic.

---

## 47.2 Multi-Terminal DC Grids and Offshore Energy Islands

A point-to-point HVDC link between one wind farm and one onshore connection point is an engineering problem with a known solution. A **multi-terminal DC** (MTDC) grid — multiple offshore wind farms, multiple countries, multiple voltage levels, power flowing in any direction at any time — requires something that point-to-point HVDC does not: the ability to isolate a fault on the DC network without de-energising the entire system.

In an AC circuit, fault current crosses zero twice per cycle. The protection relay waits for a zero crossing and the arc extinguishes naturally; the circuit breaker achieves isolation in 35–100 ms depending on the relay characteristic. In a DC circuit there is no zero crossing. A fault on a DC busbar causes current to rise at a rate determined only by cable inductance — reaching destructive levels in a few milliseconds — and the circuit breaker must interrupt it without the assistance of any natural extinguishing mechanism.

For decades, this constraint meant that HVDC faults required de-energising the entire affected DC system. Acceptable for a point-to-point link (one farm offline); catastrophic for a meshed grid (every farm on the faulted network offline simultaneously).

The breakthrough was ABB's hybrid DC circuit breaker, announced in 2012 and demonstrated in a live test at ABB's high-power laboratory in Ludvika, Sweden, in January 2013. The device combines a mechanical ultra-fast disconnector (carrying load current in normal operation) with a fully rated semiconductor bypass (carrying current during the interruption and absorbing the arc energy). The mechanical branch opens in approximately 2 ms; the complete interruption from fault detection to current zero is accomplished in approximately 5 milliseconds.[^3]

The 5 ms HVDC clearance time compared to the 35 ms achieved by the primary protection relay in Chapter 26's worked example: in a meshed DC grid, protection must be an order of magnitude faster than in an equivalent AC system, because DC fault energy accumulates without the current-limiting effect of inductive reactance at power frequency.

In a two-terminal VSC-HVDC system, power flow is determined by the DC voltage difference between the two converter stations:

$$P_{transfer} = \frac{(V_{DC,1} - V_{DC,2})}{R_{DC}} \cdot V_{DC,2}$$

where:
- $P_{transfer}$ = active power transferred from bus 1 to bus 2 [W]
- $V_{DC,1}$ = DC voltage at the exporting converter station [V]
- $V_{DC,2}$ = DC voltage at the importing converter station [V]
- $R_{DC}$ = DC cable resistance [Ω]

The key insight is the contrast with AC: in an AC system, power flow is controlled by the phase angle between two voltage phasors (Chapter 18, equation 18.4). In a DC system, power flow is controlled by the voltage magnitude difference. In a multi-terminal DC grid, each converter station adjusts its voltage setpoint to control the direction and magnitude of power flow — a software action, not a topological one. Power can be rerouted between multiple connection points without opening or closing any circuit breaker, simply by adjusting converter voltage setpoints in a coordinated control system.

> **Standard reference:** IEC 63253:2023, "HVDC grid systems and DC-connected power park modules — Guideline and parameter basis for specification." Parts 1–3 cover terminology, system studies, and protection respectively. CIGRÉ Technical Brochure TB 533 "Protection of Multi-terminal and Distribution DC Systems" (2013) remains the foundational reference for DC grid protection philosophy.

The Bornholm Energy Island — a Danish national project targeting first connection by 2030 — will be the first European test of MTDC grid control and protection at operational scale. The hub is planned to connect wind farms from Denmark, Germany, and Belgium to an offshore AC/DC converter platform, with bidirectional power flow depending on market prices in each country. It is not the 200 GW North Sea supergrid that the maps show in yellow. It is the first experiment that will determine whether such a supergrid is operable — and what the protection system looks like when something goes wrong.

---

## 47.3 Floating Wind at Scale

The V236-15.0 MW turbines in this reference project stand on fixed-bottom monopiles in 42 m of water. The Baltic Sea site represents a moderate installation depth. The North Atlantic, the Norwegian Sea, the Celtic Sea, and much of the Pacific coastline have vast offshore wind resource in water depths of 60–300 m, where monopile foundations become structurally impractical and jacket structures become prohibitively expensive.

Floating platforms break the depth constraint by replacing the foundation with a mooring system. The platform is ballasted and buoyant; chain or cable moorings provide horizontal restraint without requiring a foundation driven to the seabed. Three archetypes have reached commercial scale:

**SPAR buoy:** A long vertical cylinder, 100–120 m below the waterline, ballasted at the base. The deep draft places the centre of buoyancy well above the centre of gravity, providing inherent pitch and roll stability without active control. Hywind Scotland (2017, 30 MW, five turbines, 29 km off Peterhead) was the world's first commercial floating wind farm and uses this concept; Hywind Tampen (first power November 2022, 88 MW, eleven turbines, 140 km offshore, supplying power to Equinor oil platforms in the Norwegian North Sea) is the largest commercial application to date. The limitation is draft: a SPAR platform cannot be towed to port for major maintenance without specialised heavy-lift vessels.

**Semi-submersible:** Three or four surface columns connected by pontoons, with distributed waterplane area providing the restoring moment without deep draft. The platform can be towed to port for turbine replacement — a significant operational advantage over the SPAR for a 25-year asset. WindFloat Atlantic (2020, 25 MW, Portugal) and Provence Grand Large (2023, 25.2 MW, France) use this configuration.

**Tension Leg Platform (TLP):** A buoyant hull with slightly more displacement than needed for neutral buoyancy; the excess buoyancy is held down by vertical tendons anchored to the seabed. The result is very stiff pitch and roll behaviour — ideal for large turbines where dynamic rotor loading amplifies nacelle motion — but the installation requires pre-installed anchors and is sensitive to extreme sea conditions during installation.

The dominant engineering challenge for floating wind is not the platform. It is the **dynamic export cable** — a power cable that must accommodate the platform's continuous motion (±20 m horizontal excursion, ±3° pitch, 3–6 m heave amplitude at significant wave height) while maintaining electrical integrity under fatigue loading for a 25–30 year design life. The J-tube cable entry used for fixed-bottom installations does not accommodate this motion. The standard current approach — a lazy-wave catenary with subsurface buoyancy elements — manages the cable curvature within acceptable bend radius limits, but the fatigue database for dynamic high-voltage power cables under combined motion and electrical load is thin compared to the oil and gas sector's extensive experience with flexible risers at lower voltages.[^4]

The **natural period** of a floating platform is a critical design parameter. For stability, the platform's natural periods in heave, pitch, and roll must lie outside the dominant wave energy range of the site (typically 5–15 seconds for North Atlantic swell). The heave natural period:

$$T_n^{heave} = 2\pi \sqrt{\frac{M_{total} + A_{33}}{k_{heave}}}$$

where:
- $T_n^{heave}$ = heave natural period [s]
- $M_{total}$ = total system mass (platform + ballast + turbine) [kg]
- $A_{33}$ = added mass in heave, approximately $0.5 \rho_{water} V_{displaced}$ for a vertical cylinder [kg]
- $k_{heave} = \rho_{water} \cdot g \cdot A_{waterplane}$ = hydrostatic restoring stiffness [N/m]

For a SPAR with a 12 m diameter cylinder, displaced mass 6,000 tonnes (including turbine and RNA), waterplane area 113 m², the heave natural period is approximately 28–34 seconds — well outside the 5–15 second wave spectrum peak. The SPAR's design philosophy is to push all natural periods into a low-excitation regime, not to fight wave loads with structural stiffness.

<!-- IMAGE: fig-47-02 -->
> **Figure 47.2** — Floating Wind Platform Archetypes: SPAR, Semi-Submersible, TLP
> **Type:** Comparative schematic (three side-by-side cross-sections with water depth scale)
> **Content:** Left (SPAR): vertical cylinder 100–120 m draft; turbine at top; three catenary chains extending to seabed anchors; ballast shown at base. Centre (semi-submersible): three-column surface platform at 25–35 m draft; tower from central column; catenary chains; pontoon connections between columns. Right (TLP): low-draft buoyant hull; vertical tendons to seabed; tower above hull. Water depth scale bar (100–200 m range) alongside each. Real project labels: "Hywind Tampen (2022)" for SPAR; "WindFloat Atlantic (2020)" for semi-sub; "GICON-SOF" for TLP. Annotations: SPAR draft (100–120 m); semi-sub column spacing (40–70 m); TLP tendon length = water depth.
> **Caption:** Three floating wind platform archetypes. Each resolves the depth-versus-stability trade-off differently. SPAR buoys use deep draft for gravitational stability, limiting installation flexibility. Semi-submersibles use distributed waterplane area for stability with modest draft, enabling tow-to-port maintainability. TLPs use vertical tendons to provide the stiffest motion response but require pre-installed seabed anchors. All three platforms have been demonstrated at commercial scale as of 2023.
> **Alt text:** Side-by-side schematic comparison of SPAR buoy, semi-submersible, and TLP floating wind platform configurations, with a water depth scale bar from 50 to 250 m.
> **Data source:** Author illustration based on IRENA (2023) and IEA Wind TCP Task 49 reference designs
> **Resolution:** 1400 × 900 px minimum
> **Color notes:** Platform steel in grey; catenary mooring in dark grey; vertical tendons in orange; water in blue gradient; turbine towers in white

"The forty-megawatt turbine," Kaan told the audience, pausing briefly to let the figure register, "does not exist today. The largest commercial turbines in production as I speak are in the fifteen to eighteen megawatt range. But the economics of floating platforms are unusually sensitive to turbine size, and not in the direction most people expect. For a fixed-bottom installation, the foundation cost is a relatively stable fraction of CAPEX regardless of turbine size — the monopile scales with the overturning moment, but it is a single structure. For a floating platform, you have one platform per turbine, and the platform cost is dominated by its mass and the complexity of its mooring system. Putting a forty-megawatt turbine on one floating platform instead of three fifteen-megawatt turbines means one set of mooring cables, one dynamic export cable, one maintenance campaign per turbine per year, one set of corrosion protection — instead of three. The economics force the turbine to be as large as the aerodynamics and structural engineering allow."

---

## 47.4 Grid-Forming Inverters and the Low-Inertia Transition

Kaan had spent three months of Year One working with Lars Mikkelsen on the SSO event from Chapter 27. The 12.3 Hz oscillation had been stabilised by reducing the PLL bandwidth from 10 Hz to 4 Hz. The fix had worked. But Lars had said something in the relay room the morning after that Kaan had written in the margin of his commissioning notebook:

*Every GFL converter we commission is a quiet vote for the grid we are trying to replace.*

The grid-following (GFL) converter requires an external voltage reference. It measures the grid's voltage phasor at its point of connection and injects current at a controlled phase angle relative to it. When the grid has many large synchronous generators, the voltage reference is strong, stiff, and stable. As synchronous generation decreases — as wind and solar replace coal and gas — the voltage reference softens. The GFL converter's PLL loop must track a less certain reference with more aggressive settings, at the cost of stability in weak-grid conditions. Below a short-circuit ratio of approximately 2.0 (Chapter 27, equation 27.2), the GFL converter can oscillate against the grid's own impedance.

The **grid-forming** (GFM) converter synthesises a voltage phasor rather than following one. Using a virtual synchronous generator control law — or any of several equivalent architectures — the GFM converter acts as a voltage source that other devices, including the grid, can synchronise to. A grid with predominantly GFL converters is a room where everyone is following everyone else with a time delay. A grid with GFM converters is a room with a conductor.

The virtual inertia response of a GFM converter uses the same energy relationship introduced in Chapter 25 for rotor-based synthetic inertia:

$$\Delta P_{GFM} = -\frac{2H_{virt} \cdot S_n}{\omega_n} \cdot \frac{d\omega}{dt}$$

where:
- $\Delta P_{GFM}$ = active power contribution from virtual inertia [W]
- $H_{virt}$ = virtual inertia constant (set by the control engineer, not by rotating mass) [s]
- $S_n$ = converter rated apparent power [VA]
- $\omega_n$ = nominal angular frequency [rad/s]
- $d\omega/dt$ = rate of change of angular frequency [rad/s²]

This is equation (25.5) from Chapter 25. The GFM converter implements it as a programmable control law rather than as a consequence of rotating inertia. The difference is that $H_{virt}$ can be set to any value, adjusted in real time, and coordinated with the frequency droop response (LFSM-U from Chapter 22) and the reactive voltage droop (Chapter 22, equation 22.3) into a single coherent control structure. A GFM converter can provide virtual inertia, frequency droop, and voltage support simultaneously, with timescales and gains that are chosen by the engineer rather than determined by the machine's physical constants.[^5]

> **Standard reference:** No IEC standard for GFM converter grid connection requirements existed at the time of writing. ENTSO-E's High Penetration of Power Electronic Interfaced Power Sources (HPoPEIPS) Technical Report (December 2017) and the MIGRATE project deliverables (2016–2020) provide the technical basis. National Grid ESO's System Operability Framework (2022) and the Great Britain Grid Code modification GC0100 (2020) represent the first national regulatory framework explicitly differentiating grid-following and grid-forming converter behaviours. Other TSOs are expected to follow as synchronous generation retires.

The first procurement of grid-forming capability as a contracted service — rather than as a voluntary feature of new equipment — was National Grid ESO's Black Start tender in 2020. Battery storage systems at Minety (100 MW) and Grendon (50 MW) were contracted specifically for GFM Black Start capability: the ability to re-energise a section of the 400 kV transmission network from a de-energised state, without a synchronous generator reference, using converter-synthesised voltage as the reference from which the network rebuilds. This capability had previously been considered physically impossible for inverter-based resources.

<!-- IMAGE: fig-47-03 -->
> **Figure 47.3** — Grid-Following versus Grid-Forming Converter Control Architecture
> **Type:** Block diagram (two side-by-side control structures)
> **Content:** Left (GFL): block labelled "Grid Voltage Measurement" → "PLL (Phase-Locked Loop)" → "Current Reference Generator" → "Inner Current Controller" → "VSC Output"; arrow from grid to PLL and back to VSC output (feedback from external reference). Right (GFM): block labelled "Virtual Synchronous Generator (VSG) Model" with inputs Pref, Qref → "Virtual rotor angle θ_virt" → "Voltage Reference Generator (Vd, Vq)" → "Inner Current/Voltage Controller" → "VSC Output"; arrow from VSC back to VSG model (local feedback loop; no mandatory grid measurement). Key annotation: "GFL: measures the grid, follows it. GFM: synthesises a grid, lets others follow it." Second annotation on the PLL block (GFL side): "Stability limit: SCR < 2 → oscillation risk (Ch 27)". Second annotation on the VSG block (GFM side): "Stable at any SCR ≥ 1; provides virtual inertia H_virt on demand."
> **Caption:** Grid-following (left) versus grid-forming (right) converter control architecture. The GFL converter uses a phase-locked loop to synchronise with the existing grid voltage — a fundamentally reactive architecture that requires a strong external reference. The GFM converter synthesises its own voltage reference using a virtual synchronous generator model and provides a stable voltage source that other devices can synchronise to. In a power system with declining synchronous generation, the GFM architecture eliminates the weak-grid instability problem identified in Chapter 27.
> **Alt text:** Side-by-side block diagrams comparing grid-following converter control (with PLL feedback from grid) and grid-forming converter control (with virtual synchronous generator model providing internal reference).
> **Data source:** Author illustration based on d'Arco & Suul (2014) and ENTSO-E HPoPEIPS (2017)
> **Resolution:** 1200 × 900 px minimum
> **Color notes:** GFL blocks in orange (signal tracking, reactive); GFM blocks in blue (signal generation, active); feedback loops in grey; key stability annotations in red

The GFM transition will not be fast. The current fleet of GFL converters — including all 34 turbines in this reference project, all STATCOM units commissioned over the past decade, and the majority of existing grid-scale batteries — will operate until end of life. The transition happens at the margin: each new installation that includes GFM capability reduces the system's dependence on the remaining synchronous machines. Lars Mikkelsen's quiet vote, cast turbine by turbine, converter by converter, over fifteen to twenty years, eventually produces a grid majority — at which point the oscillation modes of Chapter 27 are not just mitigated but structurally absent.

---

## 47.5 Green Hydrogen and Sector Coupling

In June of Year Two, the farm had been curtailed — active power limited to 280 MW for eleven hours by a PSE network constraint. The SCADA system logged 248 MWh of curtailed energy: not generated, not sold, not stored. Curtailed.

The event had produced two reactions. Erik Svensson noted it in the operations report as a cost: EUR 11,160 at the CfD reference price. Kaan noted it as a question: what would have happened if there had been an electrolyser connected to the platform?

**Hydrogen electrolysis** splits water into hydrogen and oxygen using electrical energy. In a **proton exchange membrane** (PEM) electrolyser — currently the leading technology for variable-input applications — a solid polymer membrane separates anode and cathode. At the anode, water is oxidised to oxygen and protons; the protons pass through the membrane; at the cathode, protons and electrons combine to form hydrogen gas. The process occurs at pressures up to 30–80 bar, reducing the need for external compression.

The specific energy consumption — the electrical energy required to produce one kilogram of hydrogen — is set by the electrochemical cell voltage and Faraday's law:

$$e_{H_2} = \frac{n \cdot F \cdot E_{cell}}{M_{H_2}}$$

where:
- $e_{H_2}$ = specific energy consumption [J/kg]
- $n$ = number of electrons transferred per molecule (= 2 for H₂) [-]
- $F$ = Faraday constant, 96,485 C/mol
- $E_{cell}$ = actual cell voltage (thermodynamic minimum: 1.23 V; practical PEM at rated load: 1.8–2.0 V) [V]
- $M_{H_2}$ = molar mass of hydrogen, 0.002016 kg/mol

At $E_{cell}$ = 1.85 V (representative PEM at rated load, 2024 generation stacks):

$$e_{H_2} = \frac{2 \times 96{,}485 \times 1.85}{0.002016} = \frac{357{,}395}{0.002016} = 177\ \text{MJ/kg} = \mathbf{49.2}\ \text{kWh/kg}$$

The Higher Heating Value of hydrogen is 39.4 kWh/kg (141.8 MJ/kg). An electrolyser consuming 49.2 kWh/kg achieves an HHV efficiency of 39.4 / 49.2 = **80%**. Advanced stacks at full load in 2024–2026 are achieving 52–55 kWh/kg; at partial load (variable wind input), efficiency falls to 65–75%.[^6]

The **levelised cost of hydrogen** (LCOH) follows the same present-value structure as the LCOE from Chapter 12:

$$LCOH = \frac{CAPEX_{ELZ} \cdot CRF + OPEX_{ELZ}}{m_{H_2,annual}}$$

where:
- $CAPEX_{ELZ}$ = electrolyser capital cost [EUR]
- $CRF$ = capital recovery factor [yr⁻¹]
- $OPEX_{ELZ}$ = annual operating cost [EUR/yr]
- $m_{H_2,annual}$ = annual hydrogen mass production [kg/yr]

The dominant variable in the LCOH is the cost of electricity. For curtailed energy at zero marginal price, the electricity input is essentially free — the cost of hydrogen becomes almost purely the electrolyser capital cost and maintenance. This is the logic behind the offshore co-located hydrogen concept: an electrolysis system connected directly to an offshore wind farm is the only configuration where the input electricity is simultaneously very cheap (curtailed or constrained generation) and demonstrably zero-carbon (meeting the EU Delegated Regulation's additionality and temporal correlation requirements for Renewable Fuels of Non-Biological Origin).[^7]

<!-- IMAGE: fig-47-04 -->
> **Figure 47.4** — Offshore Wind to Green Hydrogen: Value Chain
> **Type:** Flow diagram (left to right)
> **Content:** Starting point: wind turbine array (34 × turbine icons). Arrow to: offshore substation hub. From the substation, two output paths diverge. Upper path: "AC/HVDC export → onshore grid → electricity market and consumers" (blue arrows). Lower path: "DC direct feed → offshore PEM electrolysis platform → compressed H₂ at 30–80 bar" → two options: (a) "submarine H₂ pipeline → onshore distribution and storage"; (b) "liquefaction or ammonia synthesis → tanker shipping → deep industrial markets (green steel, ammonia, shipping fuel)." At the decision branch: "Split optimised in real time: electricity price vs green H₂ price." Dashed boundary box around the electrolysis platform labelled "Near-term horizon — no commercial-scale offshore deployments as of 2026." Colour code: electricity path in blue; hydrogen path in green; end-use boxes in warm orange.
> **Caption:** Offshore wind power-to-hydrogen value chain in the co-located configuration. By connecting the electrolyser directly to the offshore substation's DC bus, conversion losses from AC–DC transformation and cable transmission to shore are reduced or eliminated. Green hydrogen produced offshore can be transported via repurposed subsea gas infrastructure or by liquid hydrogen and ammonia carriers to industrial markets where direct electrification is impractical or uneconomical.
> **Alt text:** Flow diagram showing offshore wind power divided between grid export (upper path) and offshore electrolysis for green hydrogen production (lower path), with storage and end-use options at the right.
> **Data source:** Author illustration based on IEA (2023) and Hydrogen Europe Offshore Roadmap (2022)
> **Resolution:** 1400 × 900 px minimum
> **Color notes:** Electricity flow in blue; hydrogen flow in green; end-use applications in orange; dashed boundary for near-future elements

The NorthH2 project — a consortium of Shell, Gasunie, Groningen Seaports, and RWE, the Netherlands — announced in 2021 a concept for 10 GW of North Sea wind connected to 4 GW of offshore electrolysis, producing approximately 800,000–1,000,000 tonnes of green hydrogen per year through repurposed subsea gas pipeline infrastructure. The project economics required an LCOH below EUR 2.50/kg, contingent on electrolyser costs falling from EUR 700/kW (2021) toward EUR 200/kW by 2030 — a learning rate that historical analysis of PEM manufacturing suggests is achievable, but only at deployment volumes that require the green hydrogen market to exist before the infrastructure to produce it is built. The chicken-and-egg problem of new energy systems, present in every transition.

Whether green hydrogen becomes the medium of exchange for offshore wind energy that the grid cannot absorb — whether Anders's margin note proves a decade of investment or a decade of advocacy — depends on two variables that physics cannot determine: the rate of electrolyser cost reduction, and the willingness of European industry to pay a green premium for steel and ammonia. Both are uncertain. The engineering is not.

---

## 47.X Worked Example: Three Questions for a 2 GW Deep-Water Extension

This reference project's export system — 45 km, 220 kV AC — was sized for 510 MW at this location. A proposed extension: a 2 GW wind farm at 90 m water depth, 300 km offshore. Three questions:

**Question 1: Can the extension connect with AC at 300 km?**

At 300 km, 525 kV XLPE cable ($C_0$ = 0.18 µF/km):

$$Q_c = (525 \times 10^3)^2 \times 2\pi \times 50 \times 0.18 \times 10^{-6} \times 300 = \mathbf{1{,}564}\ \text{MVAR}$$

Charging current per phase at 525 kV: $I_c = Q_c / (\sqrt{3} \times 525\ \text{kV}) = 1{,}564 \times 10^6 / 909{,}327 = 1{,}720$ A

Load current for 2 GW at pf = 0.95: $I_L = 2{,}000 \times 10^6 / (\sqrt{3} \times 525 \times 10^3 \times 0.95) = 2{,}315$ A

Total rms conductor current: $I_{total} = \sqrt{I_L^2 + I_c^2} = \sqrt{(2{,}315)^2 + (1{,}720)^2} = \sqrt{5{,}359{,}225 + 2{,}958{,}400} = \mathbf{2{,}884}$ A

Thermal ampacity of 2,000 mm² submarine cable in buried installation: approximately 1,600–1,800 A.

The conductor current at 300 km for 2 GW of active power exceeds the cable's thermal rating by 60–80% before a single reactive compensation platform is added. **AC at 300 km for 2 GW is not merely expensive — the cable cannot carry the current.** HVDC is not an economic optimisation. It is the physically required answer.

---

**Question 2: What does HVDC cost and what losses does it introduce?**

Specification: bipolar ±525 kV VSC, 2 × 2,000 mm² copper conductors.

- Current per pole at 2 GW: $I = 1{,}000 \times 10^6 / 525{,}000 = \mathbf{1{,}905}$ A
- DC cable resistance per pole at operating temperature (~70°C): $R = 0.010\ \Omega\text{/km} \times 300\ \text{km} = 3.0\ \Omega$
- Cable losses per pole: $P_{loss,pole} = (1{,}905)^2 \times 3.0 = \mathbf{10.9}\ \text{MW}$
- Total cable losses (both poles): $2 \times 10.9 = \mathbf{21.8}\ \text{MW}\ (1.09\%\ \text{of rated})$
- Converter losses (two stations at $k_{VSC}$ = 0.007 each): $2 \times 0.007 \times 1{,}000\ \text{MW} = \mathbf{28.0}\ \text{MW}\ (1.40\%\ \text{of rated})$
- **Total HVDC system losses: 49.8 MW = 2.5% of 2 GW rated capacity**

At EUR 45/MWh and 90% load factor (7,884 operating hours/year):

Annual energy loss cost: $49.8\ \text{MW} \times 7{,}884\ \text{h} \times 45\ \text{EUR/MWh} = \mathbf{EUR}\ 17.7\text{M/yr}$

Converter station capital cost (2 × EUR 110M): EUR 220M. At a net present value of the annual loss cost over 35 years (WACC 5.73%): EUR 17.7M × 13.9 = EUR 246M. The converter stations cost EUR 220M and save the engineer from building reactive compensation platforms while making a system that is physically impossible into one that works. The comparison is not between two economic options. It is between a cost and a prerequisite.

---

**Question 3: How much hydrogen from the Year Two curtailment event?**

Curtailed energy: 248 MWh (11 hours at an average of 22.5 MW, PSE network constraint).

PEM electrolyser at partial load (variable wind input): efficiency 52 kWh/kg (HHV basis).

$$m_{H_2} = \frac{248{,}000\ \text{kWh}}{52\ \text{kWh/kg}} = \mathbf{4{,}769}\ \text{kg of green hydrogen}$$

Market value at EUR 5.00/kg (green H₂ with certificate, optimistic early-market estimate):

$$V_{H_2} = 4{,}769 \times 5.00 = \mathbf{EUR}\ 23{,}845}$$

Compare to curtailed revenue: EUR 11,160 at the CfD reference price. The hydrogen option recovers 2.1× the lost generation value — from energy that would otherwise have been absorbed as heat in the pitch actuators. The capital cost of a 25 MW electrolyser unit (EUR 350/kW, EUR 8.75M) sized for curtailment events of this scale pays back in approximately 8–10 years at this curtailment frequency. The economics are marginal. They will not be marginal in 2035.

| Scenario | Energy source | Cost of electricity | H₂ production (kg) | H₂ value (EUR) | Net margin |
|---|---|---|---|---|---|
| Curtailment-only | Curtailed MWh | ~EUR 0/MWh | 4,769 | 23,845 | EUR 23,845 |
| Dedicated bilateral | 500 MW at EUR 30/MWh | EUR 7,440 | 4,769 | 23,845 | EUR 16,405 |
| Grid at spot (high) | EUR 90/MWh | EUR 22,320 | 4,769 | 23,845 | EUR 1,525 |

The table is the hydrogen business case. The winner is whoever controls the electricity cost.

---

## Key Takeaways

- **HVDC VSC with MMC converters is the required technology for the offshore supergrid, not an optional enhancement.** For transmission distances above approximately 80–100 km, the reactive charging current of AC cables consumes available conductor capacity before useful active power can be delivered. HVDC eliminates reactive power generation entirely. The MMC topology achieves converter losses of 0.5–1% per station with low harmonic output. BorWin1 (2009) proved the concept; Dogger Bank (2024) proved the economics at 1.2 GW scale. Every proposed offshore wind project beyond 100 km uses VSC-HVDC as its default architecture.

- **Multi-terminal DC grids require DC circuit breakers that can interrupt fault current in approximately 5 ms without a natural zero crossing.** These breakers now exist commercially, first demonstrated by ABB in 2013 and deployed at the Zhangbei MTDC project in China (2020). The Bornholm Energy Island, targeting 2030 connection, will be the first European test of MTDC grid control and protection. The physics of DC fault clearing is not an obstacle; it is an engineering problem with a known solution, waiting for deployment at European scale.

- **Floating wind platforms remove the water depth barrier and unlock the majority of global offshore wind resource.** The three archetypes — SPAR, semi-submersible, TLP — each offer different trade-offs between stability, installation complexity, and maintenance access. Platform costs are declining steeply from approximately EUR 3–4M/MW in 2022 toward projected EUR 1.5–2M/MW by 2030. The economic incentive to use the largest possible turbine on each platform is stronger for floating than for fixed-bottom, because mooring and dynamic cable costs are shared over one turbine's rated output. The path from 15 MW to larger turbines is determined by this platform-sharing economics, not by aerodynamics alone.

- **Grid-forming inverters convert the power electronics transition from a source of instability into a source of stability.** Grid-following converters require a strong grid reference and become less stable as synchronous generation retires; grid-forming converters synthesise their own voltage reference and remain stable at any short-circuit ratio above 1. The GFM transition occurs at the margin — each new converter specified with GFM capability reduces the system's dependence on synchronous inertia — and is driven more by grid code requirements than by hardware availability. National Grid ESO's 2020 Black Start procurement was the first; it will not be the last.

- **Green hydrogen connects offshore wind to the industrial sectors that cannot be directly electrified.** The LCOH from curtailed offshore wind electricity is at the edge of economic viability with current electrolyser costs; with dedicated below-market bilateral contracts, it reaches EUR 2.50–3.50/kg by 2030 on reasonable learning-rate projections. Green steel, green ammonia, and zero-emission shipping fuel require green hydrogen at scale, and offshore wind is the only source of zero-carbon electricity available in sufficient volume and at sufficient cost for the industrial quantities these markets require. The engineering value chain from wind to hydrogen to industrial feedstock is complete. The missing components are commercial-scale deployment, repurposed pipeline infrastructure, and industrial buyers who will pay a green premium.

---

## For Further Reading

- **Nami, A., Liang, J., Dijkhuizen, F., & Demetriades, G. D. (2016).** "Modular multilevel converters for HVDC applications: Review on converter cells and functionalities." *IEEE Transactions on Power Electronics*, 30(1), pp. 18–36. DOI: 10.1109/TPEL.2015.2510251. The comprehensive technical review of MMC topologies, submodule types, and control architectures, written by researchers closely involved with ABB's HVDC Light development. Covers both half-bridge (minimum losses) and full-bridge (DC fault blocking capability) submodule variants, the trade-offs between them, and the control requirements for bipolar offshore HVDC. The most widely cited single reference for MMC technology; required reading for anyone specifying an offshore HVDC connection.

- **IRENA (2023).** *Floating Offshore Wind: Outlook, Challenges and Opportunities.* International Renewable Energy Agency, Abu Dhabi. Available at irena.org. The most complete current global overview of floating wind development status, platform technology comparison, supply chain requirements, and 2030–2050 deployment scenarios. Chapter 3 covers cost trajectory analysis from 2022 projections with learning rate derivations; Chapter 4 covers the dynamic cable engineering challenge in detail. The Annex contains a complete project inventory through 2022.

- **IEA (2023).** *Hydrogen.* IEA, Paris. Available at iea.org. The IEA's annual hydrogen market review covers global electrolyser deployment, green hydrogen cost trajectories, and the policy landscape across major markets. The 2023 edition introduced a dedicated chapter on offshore co-located hydrogen covering the Norwegian, Danish, Dutch, and German national programmes. The online data tool provides the underlying cost assumptions for LCOH projections. Chapter 4 ("Offshore Hydrogen") and the accompanying data file are the standard reference for techno-economic analysis of offshore wind-to-hydrogen systems.

---

*The questions after the presentation were good ones.*

*A woman in the third row — early thirties, with the measured tiredness of someone whose project was almost in the ground but not quite — asked about the practical implications of GFM converter specifications for projects currently under construction. He answered as honestly as he could: the grid codes had not caught up with the technology, procurement specifications were inconsistent across TSOs, and the best current approach was to include GFM capability as a technical requirement in the connection agreement and allow the turbine manufacturer to determine the implementation. It was not a satisfying answer. It was a correct one.*

*Near the back, a student stood up — tall, with an orange safety vest folded over the back of his chair, unworn, still creased from the packaging. He asked the question that Kaan had asked Anders, in different words, on the second day of his first offshore assignment:*

*"How do you know what to prioritise when everything is changing at once?"*

*Kaan thought about this for a moment, in front of two hundred people.*

*"You understand the physics first," he said. "The physics doesn't change at once. The economics change at once. The regulations change at once. The technology changes at once. But the reason the cable generates reactive power hasn't changed since the cable's capacitance was first measured in 1888. If you understand why things behave the way they do, the new technologies don't replace your knowledge. They give you new things to apply it to."*

*He clicked to the last slide. It was not a summary. It was the photograph of Anders's margin note — four words in blue ballpoint beside the FAT binder's final chapter list: floating, HVDC, hydrogen, 40 MW.*

*"This was written by a senior engineer I worked alongside for two years. He didn't give it to me as a reading list. He gave it to me as evidence that the machine we had just commissioned was not the final answer. It was the first one."*

*He stepped away from the podium and into the noise of an audience that had already moved on to their next conversation. Outside the conference centre windows, the harbour was visible: container ships, a tanker, and — on the horizon, visible only if you knew what you were looking for — the white towers of a fixed-bottom wind farm, the ones that had been turning for six years and would continue for twenty more.*

*Tomorrow was the last chapter.*

---

## Notes

[^1]: Rainer Marquardt first described the Modular Multilevel Converter topology at a symposium of the German IEEE Industrial Electronics Society (ETG) in 2001 and published the foundational analysis as: Marquardt, R., & Lesnicar, A. (2003). "A new modular voltage source inverter topology." *Proceedings of the European Conference on Power Electronics and Applications* (EPE 2003), Toulouse. His institutional affiliation was the Bundeswehr University Munich (Universität der Bundeswehr München), not the Technical University of Munich; the two institutions are frequently confused in secondary literature. The first commercial MMC deployment was the Trans Bay Cable project in San Francisco, commissioned 2010 by Siemens Energy; the first offshore wind application was the BorWin2 link (Germany, 2015), using Siemens' HVDC Plus platform.

[^2]: BorWin1 technical details: HVDC BARD 1, ±150 kV, 400 MW, 125 km offshore submarine cable + 75 km onshore land cable, connecting BARD Offshore 1 (400 MW, 80 × BARD 5.0 MW turbines) to the Diele substation. Offshore converter platform energised November 2009; persistent converter failures (BARD Engineering attributed to DC insulation problems in the cable system) delayed stable full-power operation until 2012–2013. BARD Engineering GmbH filed for insolvency in 2013; the wind farm was subsequently sold. Technical account: CIGRÉ Technical Brochure TB 631 "Submarine Power Cables" (2015) Section 5.3.2; financial account: Bundesnetzagentur Monitoringbericht (2014) p. 187.

[^3]: ABB hybrid DC circuit breaker: Häfner, J., & Jacobson, B. (2011). "Proactive Hybrid HVDC Breakers — A Key Innovation for Reliable HVDC Grids." *CIGRÉ International Symposium on Future of Power Systems*, Bologna, Paper 0264. The device was demonstrated on 9 January 2013 at ABB's HVDC testing facility in Ludvika, Sweden, interrupting 9 kA at 320 kV DC in approximately 5 ms (total time from fault detection to current interruption, including ultra-fast disconnector opening at ~2 ms and main breaker IGBT commutation). The first field deployment was at the Chinese Zhangbei ±500 kV MTDC project (four-terminal, 3,000 MW, commissioned 2020), using DC circuit breakers from the China XD Group. See Zhang, L., et al. (2020). "The world's first ±500 kV offshore multi-terminal DC wind power transmission project." *Journal of Modern Power Systems and Clean Energy*, 8(5), pp. 951–965. DOI: 10.35188/UNU-WIDER/2020/868-3.

[^4]: Floating wind dynamic cables: the primary design standard is DNV-RP-0360 "Subsea Power Cables in Shallow Water" (2021), which covers static and dynamic submarine power cable design, installation, and inspection. For floating wind-specific dynamic cable analysis: Karlsen, S. (ed.) (2022). "Dynamic Power Cables for Floating Offshore Wind — Status and Challenges." *IEA Wind TCP Task 49 Technical Report.* IEA Wind, Vienna. The report identifies the cumulative fatigue life calculation under combined wave-induced platform motion, vessel excursion, and current loading as the critical design verification challenge with the thinnest empirical basis. Hywind Tampen (Equinor, 2022) and WindFloat Atlantic (EDPR, 2020) are the primary sources of field experience data at current commercial cable ratings (66–132 kV, 630–1,200 mm²).

[^5]: GFM virtual inertia control: d'Arco, S., & Suul, J. A. (2014). "Equivalence of virtual synchronous machines and frequency-droops for converter-based microgrids." *IEEE Transactions on Smart Grid*, 5(1), pp. 394–395. DOI: 10.1109/TSG.2013.2288000. The mathematical equivalence between virtual synchronous generator control (described in this section), matching control (Denis et al. 2018), and virtual oscillator control (Johnson et al. 2016) is established in Colombino, M., et al. (2019). "Global Phase and Magnitude Synchronization of Coupled Oscillators With Application to the Control of Grid-Forming Power Inverters." *IEEE Transactions on Automatic Control*, 64(11). The GFM Black Start capability demonstration: National Grid ESO (2020). "Black Start from Non-Traditional Technologies — Demonstration at Kilsby, July 2020." *ESO Insights Report.* available at nationalgrideso.com.

[^6]: PEM electrolyser specific energy: the thermodynamic minimum at 25°C for water electrolysis is 39.4 kWh/kg H₂ (HHV) = 286 kJ/mol, corresponding to a cell voltage of 1.48 V. The practical cell voltage includes overpotential terms (ohmic, activation, concentration) that raise it to 1.7–2.0 V at useful current densities. The 49.2 kWh/kg figure for $E_{cell}$ = 1.85 V is consistent with commercial PEM stacks at rated current density (~2 A/cm²). Advanced PEM stacks from Nel Hydrogen, ITM Power, and Siemens Energy (Silyzer 300, 2023) achieve 52–55 kWh/kg at rated load with stack degradation of approximately 1–2% per year. Source: IRENA (2020). *Green Hydrogen Cost Reduction.* IRENA, Abu Dhabi, Chapter 3. NorthH2 project costs: Gasunie et al. (2021). *NorthH2: Large-scale Production of Green Hydrogen.* Available at gasunie.nl.

[^7]: EU regulatory framework for green hydrogen additionality: European Commission Delegated Regulation (EU) 2023/1184 of 10 February 2023 "supplementing Directive (EU) 2018/2001 of the European Parliament and of the Council by establishing a Union methodology setting out detailed rules for the production of renewable liquid and gaseous transport fuels of non-biological origin." Articles 4–6 define the additionality requirement (new renewable electricity generation capacity), geographical correlation (same bidding zone or adjacent zone), and temporal correlation (hourly matching from 2030, with transitional monthly matching to 2029). Compliance with these three criteria is required for electrolytic hydrogen to be certified as Renewable Fuel of Non-Biological Origin (RFNBO) under the EU taxonomy.

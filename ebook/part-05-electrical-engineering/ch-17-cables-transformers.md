# Chapter 17: Cables, Transformers, and the Equipment That Carries Power

*Kaan had expected something like the outdoor switchyards he had seen in textbook photographs — a forest of ceramic insulators standing three metres tall, connected by bare overhead conductors, with arc gaps and disconnectors arranged in rows across a fenced yard open to the sky. The kind of equipment that looks electrified, where the scale of the insulation tells you something visceral about the voltage it is holding back.*

*The GIS hall of the offshore substation did not look like that.*

*The hall occupied most of the upper module: a room about twenty metres long and eight wide, white-painted steel walls, industrial LED lighting, a floor clean enough to suggest it had never been used. Down the centre of the room ran two parallel rows of grey steel cylinders, each about the diameter of a large oil drum, connected to each other by flanged joints and right-angle bends at chest height. Horizontal runs, vertical risers, T-junctions where branches split away to transformer bays. The assembly looked like the industrial plumbing of a chemical plant rather than the nerve centre of a 220,000-volt transmission system. Each cylinder had a nameplate: 220 kV BUS A. LINE BAY 1. LINE BAY 2. TRANSFORMER BAY 1. Green indicator panels glowed on each bay. A pressure gauge showed 0.42 bar above atmospheric. The room was cool, dry, and very quiet.*

*Stefan Bauer was waiting for them by the door. He was in his mid-forties, German, from Siemens Energy's high-voltage switchgear division, and he had spent the previous three weeks supervising the installation and pre-commissioning tests of the equipment in this hall. He carried a rubber-coated flashlight. Nothing else.*

*"No metal tools inside," he said to Kaan, by way of greeting. "All SF6 compartments are sealed and leak-tested. But we keep the habit." He held up the rubber flashlight and then pointed to the indicator panels. "Green means sealed and at rated pressure. If any panel turns amber, leave the hall and radio the control room. The gas is not toxic at these concentrations, but a pressurised leak in an enclosed space is not pleasant — SF6 is five times heavier than air and it displaces oxygen at floor level."*

*He paused for a moment.*

*"There are no accidents in rooms like this one," he said. "There are only preparations and consequences."*

*Anders, standing slightly behind Kaan, gave a faint smile. "Stefan has been commissioning GIS for twenty years," he said. "He knows which questions to answer before they are asked."*

*Stefan gave a short nod and began walking between the rows of cylinders. "The first question," he said, "is always: why does 220,000 volts fit in a steel tube the width of a man's arm? The answer is the gas."*

---

## 17.1 What Happens Inside the Cable: The Pi-Model

Chapter 14 described the submarine cable as a seven-layer containment system — conductor, XLPE insulation, metallic screen, lead sheath, steel wire armour, and outer serving — and explained how it is manufactured and laid on the seabed. Chapter 16 introduced the per-unit system for representing impedances in a normalised network. This chapter brings them together: what are the electrical properties of the cable, and how do engineers represent them in a power system calculation?

A real cable is not a simple resistor. Along every metre of its length, current experiences resistance and inductance in the conductor, and voltage faces capacitance and leakage conductance between the conductor and the grounded metallic sheath. The cable is, electrically, a distributed-parameter transmission line — the same class of system that governs signal propagation in telegraph lines and long-distance telephone cables. The exact travelling-wave analysis is only needed for high-frequency phenomena (switching transients, lightning surges). For steady-state load flow and fault studies, the cable is well represented by a **lumped pi-model**: the total series impedance concentrated in a single middle branch, and the total shunt admittance divided equally between two end shunts. The model takes its name from the Greek letter π, which its circuit diagram resembles.

The pi-model parameters for a cable of length $L$ are:

$$
Z_{\pi} = (R + j\omega L) \cdot L, \qquad \frac{Y_{\pi}}{2} = \frac{(G + j\omega C) \cdot L}{2}
$$

where:
- $Z_{\pi}$ = total series impedance [Ω], capturing conductor resistance $R$ [Ω/m] and inductance $L_c$ [H/m]
- $Y_{\pi}$ = total shunt admittance [S], capturing insulation leakage conductance $G$ [S/m] (very small, usually neglected) and capacitance $C$ [F/m]
- $\omega = 2\pi f$ = angular frequency [rad/s]
- $L$ = cable route length [m]

Each half-shunt ($Y_\pi/2$) is placed at the sending and receiving terminals, connecting bus voltage to ground. Because $G \approx 0$ for XLPE, the shunt is purely capacitive: a susceptance $B_C = \omega C L$. In the load flow equations, each half-shunt injects reactive power $Q_c = V^2 \cdot \omega C L / 2$ into its terminal bus — reactive power that the bus must absorb, contributing to the Ferranti effect discussed in Chapter 4.

The submarine cable's shunt capacitance is much larger than that of an overhead line at the same voltage. A 220 kV XLPE submarine cable has a capacitance of approximately 0.19–0.22 μF/km; an overhead line at 220 kV has roughly 0.01 μF/km. The reason is geometric: the XLPE insulation between the conductor and the grounded metallic sheath is only about 21 mm thick, with a relative permittivity of εr ≈ 2.3. Close spacing, high-permittivity dielectric, large area: the structure of a capacitor, running for forty-five kilometres along the seabed. This capacitance generates reactive power whether or not any active power flows — which is why offshore substations require reactive compensation even when the wind farm is running at full output.

Cross-linked polyethylene replaced paper-oil insulation as the dominant high-voltage cable technology over roughly the period 1970–2000. XLPE was first developed at the General Electric Research Laboratory in Schenectady, New York, in 1963, targeting improved thermal performance over standard polyethylene. [1] The first commercial applications appeared at medium voltage in Japan around 1967, [2] and the technology was extended progressively to 66 kV, 132 kV, and 220 kV as manufacturing processes improved. For submarine cables at transmission voltage, XLPE has one decisive advantage over the earlier paper-oil cables: it does not require the pressurised oil-feed system that paper cables need to suppress void formation. An XLPE cable on the seabed is a sealed, self-contained insulation system.

<!-- IMAGE: fig-17-01 -->
> **Figure 17.1** — Lumped pi-model for a submarine cable
> **Type:** circuit diagram
> **Content:** A horizontal branch showing the total series impedance Z_π = R_total + jX_total (resistor and inductor in series). At each end of this branch, a vertical shunt leg connects to ground, each labelled Y_π/2 = jB_C/2 (capacitor symbol). Sending-end voltage V_S on the left, receiving-end voltage V_R on the right, sending current I_S entering from left. A second smaller comparison diagram shows an overhead line pi-model at the same scale — the series branch is visually similar, but the shunt capacitors are much smaller (annotated "~10× smaller than cable"). Key parameter values annotated: typical 220 kV XLPE cable: R = 0.021 Ω/km, X = 0.095 Ω/km, C = 0.21 μF/km.
> **Caption:** The lumped pi-model for a submarine cable. The shunt capacitive susceptance (B_C) dominates — for a 45 km 220 kV XLPE cable it injects roughly 20 MVAR per end at rated voltage, compared to negligible values for an equivalent overhead line.
> **Alt text:** Electrical circuit diagram of a pi-model with series impedance in the middle horizontal branch and two shunt capacitors connecting to ground at each end. Comparison inset shows the smaller shunt capacitance of an overhead line at the same scale.
> **Data source:** Author illustration. Parameter values from IEC 60287 and Prysmian technical data for 220 kV XLPE submarine cable.
> **Resolution:** 1200 × 600 px minimum
> **Color notes:** Series branch in blue; shunt capacitors in orange; comparison inset in grey

---

## 17.2 IEC 60287: Ampacity and the Thermal Circuit

A cable carrying current heats up. The current through the conductor resistance generates heat ($P = I^2 R$ per metre), which must flow outward through the XLPE insulation, the metallic screen, the lead sheath, the steel armour, the outer serving, the seabed sediment, and ultimately into the seawater above. If the temperature at the conductor centre exceeds 90°C — the rated continuous operating temperature for XLPE at working voltage — the insulation begins to degrade. Not suddenly; the degradation is cumulative, advancing with every hour above the threshold until the insulation fails years earlier than the design life.

The maximum continuous current a cable can carry — its **ampacity** — is therefore a thermal limit, not an electrical one. The question "how much current?" becomes "how much heat can I move through these materials to the environment without the conductor temperature exceeding 90°C?"

The engineering framework for answering that question was established in 1957, when J.H. Neher and M.H. McGrath of the General Electric Company published a paper in AIEE Transactions that became one of the most cited documents in power cable engineering: "The Calculation of the Temperature Rise and Load Capability of Cable Systems." [3] Neher and McGrath showed that the thermal problem is exactly analogous to an electrical circuit: temperature difference corresponds to voltage, heat flow rate to current, and thermal resistance to electrical resistance. The conductor is the heat source; the seabed and seawater are the heat sink. Between them, each material layer is a thermal resistor.

The simplified ampacity formula, derived from the thermal circuit analogy, is:

$$
I = \sqrt{\frac{\Delta\Theta_{\max}}{R_{ac} \cdot T_{\text{total}}}}
$$

where:
- $I$ = maximum continuous current (ampacity) [A]
- $\Delta\Theta_{\max}$ = maximum permissible conductor temperature rise above ambient [°C] — for a submarine XLPE cable: 90°C (conductor limit) minus 5°C (typical deep seabed temperature) = 85°C
- $R_{ac}$ = AC resistance of conductor per unit length [Ω/m], higher than DC resistance due to skin and proximity effects
- $T_{\text{total}}$ = total thermal resistance from conductor surface to ambient [K·m/W], the sum of four component resistances defined by IEC 60287 [4]

The four thermal resistance components ($T_1$ through $T_4$ in IEC 60287 notation) account for: the insulation and bedding layers, the metallic screens and sheaths, the armour and outer serving, and the external medium (soil or seawater). For submarine cables, $T_4$ — the thermal resistance of the surrounding seabed — is often the largest single term and the most difficult to calculate. Seabed sediment thermal conductivity varies from approximately 0.5 W/(m·K) for soft clay to 2.0 W/(m·K) for wet sand; choosing the wrong value can overestimate the cable's rated current by 10–15%, leading to a cable that runs above its design temperature in service.

The fun fact about offshore cable routing is that geotechnical surveys are as much about thermal conductivity as they are about seabed stability. The same borehole cores that tell the foundation engineer about soil shear strength tell the cable engineer whether the seabed can conduct the cable's heat away efficiently enough.

The Neher-McGrath thermal circuit method was standardised internationally as IEC 60287 in 1969 and has been updated several times since, most recently as IEC 60287:2023. The physical insight at its core — that ampacity is a thermal limit, and the thermal problem is an electrical analogue — has not changed in sixty-eight years.

<!-- IMAGE: fig-17-02 -->
> **Figure 17.2** — Thermal circuit analogy for cable ampacity (IEC 60287 model)
> **Type:** two-panel thermal-electrical analogy diagram
> **Content:** Left panel (physical cable cross-section): concentric rings labelled from inside out — Conductor (source of heat, temperature Θ_c), XLPE Insulation (thermal resistance T1), Metallic Screen and Lead Sheath (T2), Armour and Serving (T3), Seabed Sediment (T4), Seawater (ambient temperature Θ_amb = 5°C). Right panel (equivalent thermal circuit): heat source Q = I²·R_ac at centre, connecting through four thermal resistors T1, T2, T3, T4 in series to ambient Θ_amb. Temperature drops ΔΘ1 through ΔΘ4 labelled across each resistor. Total temperature budget: Θ_c − Θ_amb = 85°C. Analogy labels: "Q [W/m] ↔ I [A]" and "ΔΘ [°C] ↔ ΔV [V]" and "T [K·m/W] ↔ R [Ω]".
> **Caption:** The thermal circuit analogy (IEC 60287). Heat from I²R losses flows through four thermal resistances to the ambient seawater. Maximum ampacity is set by the 85°C temperature budget across all four resistors.
> **Alt text:** Left panel shows cable cross-section with concentric insulation layers labelled T1 through T4. Right panel shows equivalent thermal circuit with four resistors in series, a heat source at one end, and ambient temperature at the other.
> **Data source:** Author illustration after Neher & McGrath (1957) and IEC 60287:2023.
> **Resolution:** 1200 × 700 px minimum
> **Color notes:** Thermal resistors in red-orange graduated from hot (centre) to cool (outer); ambient block in blue

> **Standard reference:** IEC 60287-1-1:2023, "Electric cables — Calculation of the current rating — Part 1-1: Current rating equations (100% load factor) and calculation of losses." Clause 1 (scope), Clause 2 (symbols), Clause 3 (current rating equations for cables in free air or buried in ground). The four thermal resistance components T1–T4 are defined in IEC 60287-2-1:2023, "Thermal resistance — Part 2-1: Calculation of thermal resistance."

---

## 17.3 Transformer Equivalent Circuit

Chapter 4 introduced the ideal transformer: a device that exchanges voltage for current in proportion to its turns ratio, with no losses and no impedance of its own. An ideal transformer is a boundary condition, a convenient fiction that clarifies the physics without describing any real machine. The 250 MVA, 66/220 kV transformers in the offshore substation weigh approximately 280 tonnes each, contain 18,000 litres of mineral oil, and are specified to operate continuously for thirty years. They are not ideal.

A practical transformer differs from the ideal in three ways:

**Magnetising current.** The iron core requires a small current to maintain the alternating magnetic flux, even with no load connected. This magnetising current — typically 0.5–1% of rated current — produces the no-load losses ($P_{Fe}$, the iron losses), which flow continuously as long as the transformer is energised. A transformer sitting on standby at midnight, carrying no active power, is still consuming iron losses. For a 250 MVA unit, $P_{Fe}$ is approximately 150 kW — roughly the total annual household electricity consumption of 70 homes, running continuously, every day of the transformer's life.

**Leakage flux.** Not all the magnetic flux from the primary winding threads through the secondary. Some flux leaks through paths that do not link both coils, producing leakage inductances in both windings. This leakage reactance limits the fault current the transformer can supply and causes a voltage drop under load.

**Winding resistance.** Both windings have finite DC resistance, producing load-dependent copper losses ($P_{Cu} = I^2 R$) that heat the conductors and the oil.

The standard **T-equivalent circuit**, referred to the primary side, captures all three effects in a single circuit diagram:

$$
\mathbf{Z}_{\text{eq}} = (R_1 + R_2') + j(X_1 + X_2')
$$

where:
- $R_1, R_2'$ = primary and referred-secondary winding resistances [Ω]
- $X_1, X_2'$ = primary and referred-secondary leakage reactances [Ω]
- Primed quantities denote secondary values referred to the primary by the turns ratio squared: $Z_2' = Z_2 \cdot (N_1/N_2)^2$
- A parallel shunt branch ($X_m \| R_{Fe}$) at the input terminal represents the magnetising branch — in power system studies this is almost always neglected, because $X_m$ is typically 100× larger than $X_{\text{eq}}$

The one number that matters in practice — the number that appears in every load flow study, every fault calculation, every protection setting sheet — is the **short-circuit (leakage) impedance** in per unit on the transformer's own rating:

$$
Z_{\text{sc,pu}} = \frac{V_{\text{sc}}}{V_{\text{rated}}}
$$

where $V_{\text{sc}}$ is the voltage applied to the primary that drives rated current through the short-circuited secondary in the standard factory short-circuit test. For a 250 MVA, 66/220 kV main power transformer, $Z_{\text{sc,pu}}$ typically lies between 0.12 and 0.16 pu — meaning the transformer limits fault currents to between 6 and 8 times its rated value. This single number controls the magnitude of every fault that can occur on either side of the transformer, and it is the dominant impedance in the load flow model of the offshore network. [4]

**Vector groups** define how the primary and secondary windings are connected (star or delta) and the phase shift between primary and secondary voltages. The standard IEC notation uses a capital letter for the higher-voltage winding (Y = star, D = delta), a lowercase letter for the lower-voltage winding, and a clock-hour number (0, 1, 5, 6, 11) for the phase angle shift in multiples of 30°.

The main power transformer in an offshore substation stepping 66 kV to 220 kV is almost always specified as **Dyn11**: delta winding on the 66 kV side, earthed star on the 220 kV side, 30° lag. The delta on the 66 kV side is not chosen for its electrical convenience — it is chosen because it traps zero-sequence fault currents within the delta loop. A single-phase-to-earth fault in an array cable drives zero-sequence current that circulates in the delta and cannot penetrate into the 220 kV system. The earthed star on the 220 kV side provides the neutral connection point required for the earth-fault protection relay on the export cable. The vector group is a protection engineering decision, not a transformer engineering decision. [5]

<!-- IMAGE: fig-17-03 -->
> **Figure 17.3** — T-equivalent circuit of a practical power transformer
> **Type:** electrical equivalent circuit diagram
> **Content:** Left terminal V1 (primary). A series branch: R1 in series with jX1 (primary resistance and leakage reactance). At the midpoint, a shunt branch connects down to ground containing jXm (magnetising reactance) in parallel with R_Fe (iron loss resistance), labelled "Magnetising branch (neglected in power system studies — Xm >> Zeq)". Then R2' in series with jX2' (referred secondary resistance and leakage reactance). Right terminal V2' (referred secondary voltage). An ideal transformer symbol N1:N2 as the final stage converting to actual secondary terminal V2. Below the circuit: annotation box: "In practice: Zeq = Req + jXeq; characterised by short-circuit test. Zsc,pu = Vsc/Vrated ≈ 0.12–0.16 pu."
> **Caption:** T-equivalent circuit of a practical transformer referred to the primary. The magnetising branch accounts for no-load losses; the series leakage impedance Z_eq limits fault currents and causes voltage regulation under load. In power system studies, the shunt branch is neglected.
> **Alt text:** Electrical circuit diagram showing transformer T-equivalent with primary series impedance, shunt magnetizing branch in the middle, secondary referred series impedance, and ideal transformer symbol at the output.
> **Data source:** Author illustration after Glover, Sarma & Overbye (2017), Chapter 3.
> **Resolution:** 1200 × 600 px minimum
> **Color notes:** Primary circuit in blue; shunt magnetising branch in green; secondary referred circuit in orange; ideal transformer in grey

> **Standard reference:** IEC 60076-1:2011, "Power transformers — Part 1: General" — Clause 3.4 (vector group notation and designation rules), Clause 8.9 (short-circuit impedance measurement). IEC 60076-8:2024, "Power transformers — Part 8: Application guide" — Clause 4.4 (vector group selection for offshore and industrial applications).

---

## 17.4 Gas-Insulated Switchgear

"To interrupt 220 kilovolts," Stefan Bauer said, placing his hand lightly on one of the cylinder flanges, "you need to quench an arc. When a circuit breaker opens under load, the current does not simply stop. It flashes across the gap as a plasma arc — the arc root at tens of thousands of degrees. You must cool and extinguish that arc faster than it can re-ignite. In oil, in air, in vacuum — each medium works differently. In this system, the medium is that gas."

He tapped the cylinder.

Sulphur hexafluoride, SF6, was first synthesised in 1900 by the French chemist Henri Moissan and his colleague Paul Lebeau at the Faculté de Pharmacie de Paris, by reacting elemental fluorine — which Moissan had isolated and would win the Nobel Prize for in 1906 — with sulphur. Their initial findings appeared in Comptes Rendus in two brief notes; a more detailed account followed in 1902. [6] The result was a dense, colourless, odourless, chemically inert gas, five times heavier than air, that did nothing remarkable at room temperature and pressure. Its electrical properties were not investigated for another four decades.

In the late 1940s, engineers at Westinghouse discovered that SF6 had an extraordinary ability to arrest electrical arcs. At atmospheric pressure, SF6 has a dielectric breakdown strength of 2.5 to 3 times that of air. [7] At the 0.4–0.5 MPa pressures used inside GIS equipment, the effective insulating performance is several times higher still — enough to reduce a 220 kV clearance from approximately 1.8 metres in air to roughly 40 millimetres in pressurised SF6. Inside the grey steel cylinders of the offshore substation, a voltage of 311 kV peak was held back by a gap smaller than the width of three fingers.

The first commercial gas-insulated switchgear installations appeared in 1966 and 1967, in parallel from several manufacturers working independently. Delle-Alsthom in France delivered a 245 kV system known as the Fluobloc to Paris city-centre substations, where the dense urban environment made an outdoor switchyard impossible. Brown Boveri & Cie in Switzerland installed a 170 kV system in Zurich for the same reason. [8] Japanese manufacturers followed by 1968. Within a decade, GIS had become the universal choice for any substation where space was constrained — underground city-centre facilities, industrial plants, and, beginning in the early 2000s, offshore platforms. The offshore substation is the limiting case: it is physically small, continuously exposed to the marine environment, and cannot accommodate the large outdoor insulation clearances that AIS requires. GIS is not chosen for performance. It is chosen because AIS does not fit.

There is a problem with SF6, and it is not an engineering problem. SF6 has a global warming potential of 24,300 times that of CO2 over 100 years, as assessed by the IPCC Sixth Assessment Report in 2021. [9] The commonly cited figure of "23,500" in older industry literature is the AR5 value (2013); the current standard is 24,300. Even very small leaks — a defective flange gasket, a poorly sealed service port — release a gas that will persist in the atmosphere for thousands of years and carry a warming impact per kilogram that dwarfs methane. The European F-Gas Regulation (EU) 2024/573 restricts SF6 use in new switchgear beginning in 2028 for medium voltage and 2031 for certain high-voltage categories.

All major manufacturers now offer fluorine-free alternatives: C4-nitrile blends with CO2, purified dry air at elevated pressure, and nitrogen-CO2 mixtures. These alternatives achieve 75–90% of SF6's dielectric performance, resulting in slightly larger equipment or somewhat higher gas pressures, but the basic GIS architecture is preserved. The equipment in this offshore substation was installed in 2023, under the regulations in force at the time. The next generation will be different.

<!-- IMAGE: fig-17-04 -->
> **Figure 17.4** — GIS vs air-insulated switchgear: footprint comparison at 220 kV
> **Type:** plan-view comparison diagram (drawn to the same scale)
> **Content:** Left (AIS — air-insulated switchgear): Plan view of a 220 kV outdoor AIS arrangement for four bays (two transformer bays, two feeder bays). Ceramic bushings shown as circles (~800 mm diameter at base); minimum phase-to-phase air clearance of 1,800 mm; minimum phase-to-ground clearance 3,200 mm; steel gantry structures. Total footprint: approximately 60 × 30 m = 1,800 m² for four bays. Right (GIS): Plan view of the equivalent 220 kV GIS in the OSS hall. Steel cylinder bays at head height, 1,500 mm bay width, GIS hall dimensions 20 × 8 m = 160 m² for four bays. Scale bar at bottom. Annotation arrow: "~11× footprint reduction". A small inset shows the offshore substation jacket plan, with the GIS hall footprint outlined in red — illustrating that AIS would exceed the entire OSS deck area.
> **Caption:** At 220 kV, GIS reduces the switchgear footprint by approximately 11-fold compared to equivalent AIS. For an offshore substation where the deck area costs several thousand euros per square metre of structural steel, GIS is the only practical option.
> **Alt text:** Two plan-view diagrams to the same scale. Left shows large outdoor AIS layout with insulators and wide air gaps spanning 60 × 30 metres. Right shows compact GIS layout inside a 20 × 8 metre hall. Scale bar present.
> **Data source:** Author illustration. Clearance data from IEC 61936-1:2021 (outdoor AIS) and IEC 62271-203:2011 (GIS). Footprint representative of real 220 kV OSS GIS installations.
> **Resolution:** 1400 × 700 px minimum
> **Color notes:** AIS layout in light grey with red clearance indicators; GIS layout in blue-grey; hall outline in dark blue; inset in white

---

## 17.5 Switchgear Ratings and Selection

Every switchgear component — circuit breaker, disconnector, earthing switch, busbar — carries a nameplate that defines the conditions under which it is designed to operate. These ratings are standardised by the IEC 62271 family of standards and represent the minimum acceptable performance envelope for safe and reliable operation. [10]

**Rated voltage ($U_r$):** The maximum line-to-line RMS voltage for which the equipment is designed. For a 220 kV nominal system, the standard rated voltage is **245 kV** — the next IEC 60038 standard value above 220 kV, providing 11% headroom for voltage excursions above nominal under light-load or Ferranti conditions. The insulation system, the gas pressure, and the electrode geometry are all designed around 245 kV, not 220 kV.

**Rated insulation level:** Three withstand voltages define the insulation capability. For 245 kV rated GIS per IEC 62271-203:
- Power-frequency withstand: 395 kV (rms, applied for 1 minute)
- Switching impulse withstand: 850 kV (peak, 250/2500 μs waveshape)
- Lightning impulse withstand: 1,050 kV (peak, 1.2/50 μs waveshape) [11]

These values are far above the operating voltage. They represent the rare but extreme overvoltages caused by lightning strikes to the onshore substation, switching operations that generate travelling waves on the export cable, and fault arc voltages. The insulation must survive all three categories, independently.

**Rated normal current ($I_r$):** The continuous current the equipment carries without exceeding the permissible temperature rise. Standard IEC 62271 values at 220 kV: 1,600 A, 2,000 A, 2,500 A, 3,150 A. The farm's 500 MW at 220 kV and 0.95 pf draws approximately 1,380 A — so the minimum practical rating is **2,000 A**, giving a 45% thermal margin for system growth or reactive compensation mode.

**Rated short-circuit current ($I_{sc}$):** The maximum fault current the breaker must interrupt without failure. This is the most demanding rating — it determines the mechanical and thermal design of the breaking chamber and the contact geometry. Standard values for 245 kV GIS: 31.5 kA, 40 kA, 50 kA. The actual fault current at the offshore 220 kV busbar is calculated by the IEC 60909 method (Chapter 19), but preliminary estimates indicate a range of 20–35 kA for typical Baltic Sea grid connections.

The peak short-circuit current — the asymmetrical first-peak that occurs in the first half-cycle, before the decaying DC offset has had time to disappear — can substantially exceed the symmetrical RMS value:

$$
\hat{i}_{\text{peak}} = \kappa \cdot \sqrt{2} \cdot I_{sc}
$$

where:
- $\hat{i}_{\text{peak}}$ = asymmetrical peak short-circuit current [A]
- $\kappa$ = asymmetry factor [-], dependent on the network X/R ratio; typically 1.2–1.7 for HV networks (IEC 60909, Annex B)
- $I_{sc}$ = symmetrical short-circuit current (RMS) [A]

For a network X/R ratio of 10 (typical for a cable-connected offshore substation), $\kappa \approx 1.52$, giving a peak of approximately $1.52 \times \sqrt{2} \times I_{sc} \approx 2.15 \cdot I_{sc}$. The busbar, its supports, and the breaker contacts must withstand this first-peak force mechanically, even if the breaker does not open on the first cycle. The **rated peak withstand current** (typically 2.5× the rated short-circuit current for standard equipment) must exceed this value.

The breaking time — from the protection relay trip command to current interruption — is approximately 60–80 ms for modern SF6 breakers at 245 kV: 20–30 ms for breaker opening plus 40–50 ms for arc extinction. This corresponds to 3–4 cycles at 50 Hz. Faster breakers are available but require greater mechanical energy and more frequent servicing.

> **Standard reference:** IEC 62271-100:2021, "High-voltage switchgear and controlgear — Part 100: Alternating-current circuit-breakers" — Clause 4 (rated characteristics), Clause 6.5 (short-circuit current making and breaking capability tests). IEC 62271-203:2011, "Gas-insulated metal-enclosed switchgear for rated voltages above 52 kV" — Clause 5 (rated characteristics specific to GIS). IEC 60038:2009, Table 3 (standard voltages above 100 kV).

<!-- IMAGE: fig-17-05 -->
> **Figure 17.5** — Asymmetrical short-circuit current waveform and breaker timing
> **Type:** annotated waveform diagram
> **Content:** A short-circuit current waveform from t = 0 (fault inception) showing: the symmetrical AC component (sinusoidal envelope, amplitude I_sc·√2), superimposed on a decaying DC offset that starts at maximum and decays with time constant τ = X/(R·ω). The asymmetrical envelope is drawn: the first peak i_peak = κ√2·I_sc is prominently annotated (in red). The DC offset is shown decaying to near zero over 3–4 cycles. A shaded grey window from t ≈ 20 ms to t ≈ 80 ms (0 + relay time to breaker opening + arc extinction) is labelled "Breaker opens and interrupts current in this window". Horizontal axis: time in ms and cycles. Vertical axis: current in kA. Dashed horizontal lines at ±I_sc·√2 (symmetrical peak) and ±i_peak (asymmetrical peak).
> **Caption:** The asymmetrical short-circuit current. The first-peak (red) governs mechanical busbar design; the decayed current at the moment of arc extinction governs the breaker's thermal duty. The circuit-breaker must interrupt within 3–4 cycles of the fault inception.
> **Alt text:** Short-circuit current waveform showing asymmetric oscillation with decaying DC offset from fault inception, with the first peak annotated as i_peak and a shaded window indicating the breaker opening interval between 20 and 80 milliseconds.
> **Data source:** Author illustration. Waveform shape per IEC 60909:2016 Annex B.
> **Resolution:** 1400 × 700 px minimum
> **Color notes:** Symmetrical AC envelope in blue; DC offset in orange; asymmetrical peak in red; breaker window shaded grey

---

## 17.6 Worked Example: Equipment Specification for a 500 MW Offshore Substation

A 500 MW offshore wind farm connects to the transmission grid via a 220 kV export system. The offshore substation contains two 250 MVA, 66/220 kV, Dyn11 ONAN transformers (operating N-1: one carries the full farm output) and one 220 kV GIS main bay.

**Step 1: Normal load current at 220 kV**

At rated 500 MW output and 0.95 power factor, apparent power $|S| = 500/0.95 = 526$ MVA. Line current:

$$
I_L = \frac{|S|}{\sqrt{3} \cdot V_L} = \frac{526 \times 10^6}{\sqrt{3} \times 220 \times 10^3} = 1{,}380 \text{ A}
$$

GIS rated normal current selection: **2,000 A** (next standard value above 1,380 A, per IEC 62271-203).

**Step 2: Transformer secondary current at 66 kV under N-1**

With one transformer out of service, the remaining unit carries the full 526 MVA. Its rated current at 66 kV:

$$
I_{66} = \frac{526 \times 10^6}{\sqrt{3} \times 66 \times 10^3} = 4{,}600 \text{ A}
$$

The 66 kV switchgear must be rated for 4,600 A continuous. Select **5,000 A** rated current for the 66 kV bus.

**Step 3: Preliminary short-circuit current estimate at 220 kV**

Using only the transformer impedance as a first estimate ($Z_{sc} = 0.14$ pu on 250 MVA, 220 kV base):

$$
Z_{\text{base,220kV}} = \frac{(220)^2}{250} = 193.6 \text{ Ω}, \quad Z_{\text{sc}} = 0.14 \times 193.6 = 27.1 \text{ Ω}
$$

$$
I_{\text{sc,Tx}} = \frac{V_{\text{base}}/\sqrt{3}}{Z_{\text{sc}}} = \frac{220{,}000/\sqrt{3}}{27.1} = 4{,}688 \text{ A (transformer-limited only)}
$$

The PSE grid contribution through the 45 km export cable will add substantially to this — typical final IEC 60909 results for this topology indicate 20–28 kA symmetrical at the OSS 220 kV busbar. The full study is in Chapter 19. For equipment selection: **31.5 kA** rated short-circuit current. Peak withstand (κ = 1.5, X/R ≈ 8):

$$
\hat{i}_{\text{peak}} = 1.5 \times \sqrt{2} \times 31{,}500 = 66{,}823 \text{ A} \approx 67 \text{ kA}
$$

Select **80 kA peak withstand** (the standard value above 67 kA per IEC 62271-203).

**Step 4: Cable pi-model parameters for the 45 km export cable**

For a 220 kV, 800 mm² XLPE submarine cable (typical values):
- $R = 0.021$ Ω/km, $X_L = 0.095$ Ω/km, $C = 0.21$ μF/km

Pi-model total parameters:
$$
Z_\pi = (0.021 + j\,0.095) \times 45 = 0.945 + j\,4.275 \text{ Ω}
$$

$$
\frac{Y_\pi}{2} = \frac{j\omega C \cdot L}{2} = \frac{j\,2\pi \times 50 \times 0.21 \times 10^{-6} \times 45}{2} = j\,1.484 \times 10^{-3} \text{ S}
$$

Each half-shunt injects reactive power at 220 kV:

$$
Q_c = V^2 \cdot \text{Im}(Y_\pi/2) = (220 \times 10^3)^2 \times 1.484 \times 10^{-3} = 71.8 \text{ MVAR}
$$

Total cable charging: $2 \times 71.8 = 143.6$ MVAR. Of this, roughly half appears at the OSS busbar end and half at the onshore substation end. The OSS must absorb approximately **72 MVAR** of capacitive reactive power from the export cable alone, at rated voltage — before accounting for the array cable charging or the turbine converter reactive output. This 72 MVAR, combined with the array cable charging, largely determines the shunt reactor and STATCOM sizing studied in Chapter 20.

**Step 5: Equipment summary**

| Equipment | Rating Selected | Governing Parameter |
|---|---|---|
| 220 kV GIS rated voltage | 245 kV | IEC 60038 standard voltage above 220 kV nominal |
| GIS rated normal current | 2,000 A | Load current 1,380 A + margin |
| GIS rated short-circuit current | 31.5 kA | Preliminary fault study result |
| GIS peak withstand current | 80 kA | κ√2 × 31.5 kA (κ = 1.5) |
| Main transformer rating | 250 MVA (×2, N-1) | Farm rating 526 MVA N-1 |
| Transformer short-circuit impedance | 0.14 pu | IEC 60076-1 standard range |
| Transformer vector group | Dyn11 | Protection philosophy (zero-sequence blocking) |
| Export cable charging (per half-shunt) | 72 MVAR | Pi-model, 45 km, 0.21 μF/km |

---

## Key Takeaways

- **The XLPE submarine cable is modelled as a pi-circuit: a series impedance (R + jX) flanked by two shunt capacitive susceptances.** For a 45 km 220 kV cable, the total capacitive charging is approximately 144 MVAR — reactive power that flows into the network regardless of active power load. This is the origin of the Ferranti effect and the primary driver of the STATCOM sizing.

- **Ampacity is a thermal limit, not an electrical one.** The Neher-McGrath method (1957), standardised in IEC 60287, treats the cable as a heat pipe: maximum current is set by the 85°C temperature budget from conductor to seabed. Seabed sediment thermal conductivity — variable by 4× across a typical route — can shift the cable rating by 10–15%.

- **The transformer short-circuit impedance ($Z_{sc} \approx 0.12-0.16$ pu on rated MVA) is the single number used in load flow, fault, and protection calculations.** The magnetising branch is neglected in power system studies. Vector group (Dyn11) is determined by the protection philosophy — specifically, the need to block zero-sequence fault currents from propagating across voltage levels.

- **SF6 gas-insulated switchgear compresses a 1.8-metre 220 kV air clearance into 40 mm, reducing the GIS hall footprint by 11-fold compared to AIS.** For offshore substations, GIS is not a performance choice — it is a geometric necessity. SF6 carries a GWP of 24,300 (IPCC AR6), and fluorine-free alternatives are mandated in new EU switchgear from 2028–2031.

- **Each GIS bay carries four critical ratings: rated voltage (245 kV), insulation level (1,050 kV LIWV), rated current (2,000 A), and rated short-circuit current (31.5 kA / 80 kA peak).** The asymmetrical first-peak current ($\hat{i}_{peak} = \kappa\sqrt{2} \cdot I_{sc}$, reaching 67 kA) governs mechanical busbar design, even though the breaker interrupts the decayed current 60–80 ms after fault inception.

## For Further Reading

- **Neher, J.H. and McGrath, M.H. (1957).** "The Calculation of the Temperature Rise and Load Capability of Cable Systems." *AIEE Transactions, Part III — Power Apparatus and Systems*, Vol. 76, pp. 752–772, October 1957. The foundational paper for cable ampacity calculation, still readable and still the basis of IEC 60287 sixty-eight years later. Available through IEEE Xplore and archive.org. Reading the first half — the thermal circuit analogy and the four thermal resistance components — requires only undergraduate heat transfer and circuit analysis.

- **Glover, J.D., Sarma, M.S., and Overbye, T.J. (2017).** *Power Systems Analysis and Design.* 6th ed. Cengage Learning. Chapter 3 (power transformers: ideal transformer, equivalent circuit, per-unit, three-phase banks) and Chapter 5 (transmission lines and pi-model — equally applicable to cables with different parameter values) are the standard undergraduate reference for the material in this chapter. The transformer T-equivalent derivation and the short-circuit test explanation are particularly clear. ISBN: 978-1-305-63213-4.

- **Ryan, H.M. (ed.) (2004).** *High Voltage Engineering and Testing.* 2nd ed. IET Power and Energy Series Vol. 32. London: IEE. Chapter 9 (gas-insulated switchgear) gives the GIS history, SF6 physics, and design principles at graduate depth. For the current state of SF6 alternatives: Piemontese, A. et al. (2023). "Review of SF6 Alternative Gases for High-Voltage Switchgear." *IEEE Access*, Vol. 11, pp. 82,836–82,872. DOI: 10.1109/ACCESS.2023.3301254.

---

*Stefan Bauer showed them the transformer bay last. The 250 MVA unit itself was not inside the GIS hall — it sat below the upper module in a separate fire-rated bay, its steel tank painted cream-white, radiator fins extending outward from the flanks like the gills of a very large and very still fish. A conservator tank on the end of the tank contained the expansion volume for the oil. Between the conservator and the main tank, a Buchholz relay sat in the connecting pipe — a small device whose sole function was to detect the gas bubbles produced by an internal fault before the fault became catastrophic. Temperature indicators on the tank sides. A pressure relief device on the roof. A dissolved gas analysis sampling valve, a short brass fitting with a ball valve, near the base.*

*"The oil sampling valve," Stefan said, standing beside it, "is more important than any circuit breaker in this building. A transformer does not fail the way a breaker fails — suddenly, with a noise and a trip. It fails through gases dissolving in the oil. Hydrogen. Acetylene. Ethylene. Months before anything visible happens, the oil is already telling you what is wrong inside." He pointed to the valve. "That valve, analysed every three months in a laboratory, tells you whether you have six months or six years before you need to take the machine out of service."*

*Kaan noted this. He had spent the morning learning the ratings — voltages and currents and short-circuit values — and he was beginning to understand that the ratings were the beginning of the design, not the end. Every number on a nameplate pointed toward a consequence. The 245 kV rated voltage implied a 1,050 kV lightning impulse withstand, which implied an SF6 pressure of 0.42 bar, which implied a flange integrity programme and a gas monitoring system. The 0.14 pu transformer impedance implied a fault current of 7× rated, which implied a 31.5 kA circuit breaker, which implied a trip time of 60–80 ms, which implied a protection relay with a specific operating characteristic. The consequence chain ran through the entire substation.*

*"Load flow tomorrow," Anders said from the doorway. "Bring a pencil. We will trace five hundred megawatts from blade tip to the PSE grid, bus by bus, and you will see why all of this matters."*

---

## Notes

[1] XLPE insulation development at GE: General Electric Research Laboratory, Schenectady, NY, 1963. The cross-linking process thermally sets the polyethylene molecular structure, raising the continuous operating temperature from approximately 75°C (standard PE) to 90°C and improving mechanical properties. Source: Tratos Group (2023), "Cross-Linked Polyethylene (XLPE) Cables," tratosgroup.com; Elek Corporation (2022), "A Summary of Electric Power Cable History," elek.com.

[2] First commercial XLPE cable applications at medium voltage in Japan: approximately 1967, for 6–22 kV distribution cables. Extension to 66 kV and above followed progressively as manufacturing processes — particularly steam-curing and dry-curing cross-linking — were refined. Source: Prysmian Group (2024), "Why Choose XLPE Cable Insulation?" uk.prysmian.com. For a comprehensive technical history: CIGRÉ Working Group B1.40 (2015), "High Voltage Underground and Submarine Cable Technology Options for Future Transmission Networks," CIGRÉ Brochure 610.

[3] Neher, J.H. and McGrath, M.H. (1957). "The Calculation of the Temperature Rise and Load Capability of Cable Systems." *AIEE Transactions, Part III — Power Apparatus and Systems*, Vol. 76, pp. 752–772, October 1957. This paper introduced the thermal-electrical analogy (heat flux ↔ current; ΔΘ ↔ ΔV; thermal resistance ↔ R) for cable rating calculations. It remains the mathematical foundation of IEC 60287. Available through IEEE Xplore (historical archive) and archive.org. For context: Calcware Inc., "Neher-McGrath Ampacity Calculations," calcware.com (accessed March 2026).

[4] IEC 60287-1-1:2023. "Electric cables — Calculation of the current rating — Part 1-1: Current rating equations (100% load factor) and calculation of losses." IEC, Geneva. The four thermal resistance components T1–T4 are defined in IEC 60287-2-1:2023. Transformer short-circuit impedance ranges: Winders, J.J. (2002). *Power Transformers: Principles and Applications.* Marcel Dekker, Chapter 4. Typical OSS main transformer values (66/220 kV, 250 MVA ONAN): Z_sc = 0.12–0.16 pu, iron losses 120–180 kW, copper losses 550–700 kW at rated. DOI: 10.1201/9780203910214.

[5] Transformer vector group selection for offshore substations: the Dyn11 vector group is standard for OSS 66/220 kV main transformers in European offshore wind practice. The delta on the 66 kV (array) side prevents zero-sequence fault currents from single-phase-to-earth faults in the array cables from entering the 220 kV (export) system. Source: ABB Power Products (2012), "Offshore Wind Farm Substation Design Guide," ABB Technical Paper. IEC 60076-8:2024, "Power transformers — Part 8: Application guide," Clause 4.4.

[6] SF6 synthesis: Moissan, H. and Lebeau, P. (1900). "Préparation et propriétés du fluorure de soufre." *Comptes Rendus de l'Académie des Sciences*, Vol. 130, pp. 865–868 and 984–986 (two separate notes in Vol. 130). Extended account: Moissan, H. and Lebeau, P. (1902). *Annales de Chimie et de Physique*, Série 7, Vol. 26, pp. 145–213. For context: Royal Society of Chemistry (2020), "Magnificent Molecules: SF6," edu.rsc.org; Bristol University, "Molecule of the Month: SF6," chm.bris.ac.uk (accessed March 2026). Moissan received the Nobel Prize in Chemistry in 1906 for isolating fluorine (awarded for F2, not SF6).

[7] SF6 dielectric strength: At 0.1 MPa (1 bar), breakdown strength 2.5–3× air in uniform-field conditions. Schneider Electric Technical Paper CT194 (2008), "SF6 Properties, and Use in MV and HV Switchgear," studiecd.dk/cahiers_techniques. IEEE Std 1125-1993 (R2003), "IEEE Guide for Moisture Measurement and Control in SF6 Gas-Insulated Equipment," Clause 3 (SF6 properties). For GIS operating pressures (0.4–0.5 MPa): the dielectric advantage is several times greater due to the non-linear pressure-strength relationship of SF6 beyond 2 bar; exact values are geometry-dependent.

[8] First commercial GIS installations: Delle-Alsthom 245 kV "Fluobloc" system, Paris substations, 1966–1967. BBC (Brown Boveri & Cie) 170 kV GIS, Zurich underground substation, approximately 1966. Hitachi Energy corporate history cites a 1965 installation. Mitsubishi Electric built its first domestic GIS in 1968. Source: GE Vernova Library (2024), "The History of Gas-Insulated Substations," library.grid.gevernova.com; ABB News (2016), "Switzerland has pioneered more than just chocolate and watches," new.abb.com; ResearchGate — ABB GIS history figure, researchgate.net (accessed March 2026).

[9] SF6 Global Warming Potential: IPCC Sixth Assessment Report (AR6), Working Group I, *The Physical Science Basis* (2021), Chapter 7 Supplementary Material, Table 7.SM.7. GWP-100: 24,300 (AR6), superseding AR5 value of 23,500 (2013) and AR4 value of 22,800 (2007). EU regulatory basis: Regulation (EU) 2024/573 of the European Parliament and of the Council, 7 February 2024, on fluorinated greenhouse gases and repealing Regulation (EU) No 517/2014, Article 11 (restrictions on use of SF6 in switchgear). Official Journal of the European Union, L, 2024/573.

[10] IEC 62271 switchgear standards family: IEC 62271-100:2021, "Alternating-current circuit-breakers"; IEC 62271-102:2018, "Alternating current disconnectors and earthing switches"; IEC 62271-200:2011, "AC metal-enclosed switchgear for voltages above 1 kV up to and including 52 kV" (for the 66 kV array switchgear); IEC 62271-203:2011, "Gas-insulated metal-enclosed switchgear for rated voltages above 52 kV" (for the 220 kV GIS). All standards available from IEC, Geneva (iec.ch).

[11] Rated insulation levels for 245 kV GIS: IEC 60071-1:2019, "Insulation co-ordination — Part 1: Definitions, principles and rules," Table 2 (standard insulation levels for systems above 52 kV). For Um = 245 kV: LWIV = 1,050 kV (standard list II), SIWV = 850 kV. Power-frequency withstand: 395 kV (1 min). IEC 60038:2009, Table 3: 245 kV is the IEC standard highest voltage for equipment on a 220 kV nominal-voltage system.

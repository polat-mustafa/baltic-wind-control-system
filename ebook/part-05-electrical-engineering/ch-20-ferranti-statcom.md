# Chapter 20: The Ferranti Effect and the STATCOM Decision

*The STATCOM room was at the far end of the upper module, past the GIS hall and around the corner from Sigrid's relay testing room. Unlike Stefan Bauer's domain — which carried the compressed-gas hum and the authoritative silence of things that could kill you without announcement — this room gave the impression of having been assembled from server racks in a data centre. The cabinets were tall and uniformly grey, their cooling fins visible at the top. Indicator lights in steady green ran along every row. The conditioned air tasted faintly mineral — transformer oil, perhaps, or simply the scent of serious power equipment that Kaan had begun to recognise from buildings like this one.*

*Johan Carlsson was crouching beside a control panel at waist height, a laptop open on the floor beside him, finishing the second week of acceptance tests. He was the commissioning engineer from Hitachi Energy — late forties, silver-blond hair, a faint unreasonable tan that had not come from the Baltic Sea, and the unhurried manner of someone who had commissioned systems like this one in seven countries and found all of them roughly similar. He stood when they entered, dusted his knees, and picked up a blue steel thermos.*

*"Anders." A nod. "You brought your student."*

*"He knows fault current now." Anders pressed the corridor door shut. "He is ready for reactive power."*

*Johan poured from the thermos into a travel cup and offered it toward Kaan. Kaan had learned to accept things offered by engineers on this platform. The coffee was dark and smooth — noticeably better than the machine in the common room.*

*"Finishing step nine of eleven acceptance tests," Johan said. "I ran a reactive sweep to plus eighty this morning. The STATCOM responded in eighteen milliseconds. Now I am waiting for thermal equilibrium before the final two tests."*

*He settled back beside his laptop. The screen showed a real-time trend: two traces, one for active power — flat, near zero — and one for reactive power. A steady −18 MVAR, amber text reading ABSORBING.*

*"Watch the reactive trace," Johan said.*

*Kaan watched. Through the walls he could feel the familiar low vibration of the platform — the structure conducting the mechanical rhythm of thirty-four turbines. Then, without announcement, the vibration changed. Not stopped, but thinned. A harmonic quality altered.*

*"Ten turbines have just feathered," Anders said, looking at his phone. "Gusts are dropping below cut-in. About sixty minutes."*

*On the screen, the reactive power trace began to move. −18 → −22 → −28 → −34 MVAR. The STATCOM was absorbing harder. On a second window behind the trend, a table of bus voltages was visible. Bus 3 — the offshore 220 kV bus — read 1.021 pu. As Kaan watched, it climbed. 1.024. 1.027. The turbines were stopping. Shouldn't the voltage be falling?*

*"The cable does not sleep," Johan said. He pulled the second window forward. "This cable has been energised for eleven days. It generates reactive power whether the turbines are running or not."*

*He clicked open a schematic: the cable, the 220 kV bus, the Thevenin impedance of the grid behind it.*

*"How much?" Kaan asked.*

*"Eighty-five and a half megavars. Every second of every day."*

*He picked up his thermos. "Sit. I will explain why the voltage is rising."*

---

## 20.1 Cable Charging and Reactive Power Generation

An XLPE submarine cable is a capacitor. This is not a metaphor — it is the physical description of the construction. The central copper conductor is surrounded by an inner semiconductor screen, then by crosslinked polyethylene insulation, then by an outer semiconductor screen and a metallic sheath. The conductor and the metallic sheath are two coaxial cylinders separated by a dielectric: the defining geometry of a cylindrical capacitor.

At 50 Hz, the electric field alternates between the conductor and the sheath one hundred times per second. The energy stored in the dielectric field flows in and out with each half-cycle. This oscillating energy flow is reactive current — current that carries energy back and forth without converting it to heat or mechanical work. The cable draws this current from the network whether the turbines are generating or not. As long as the cable is energised, the capacitor is charging and discharging.

The shunt capacitance per unit length of a coaxial cable follows directly from its geometry:

$$
C = \frac{2\pi\varepsilon_0\varepsilon_r}{\ln(r_2/r_1)}
$$

where:
- $\varepsilon_0 = 8.854 \times 10^{-12}$ F/m = permittivity of free space
- $\varepsilon_r = 2.4$ (dimensionless) = relative permittivity of XLPE
- $r_1$ = outer radius of the conductor [m]
- $r_2$ = outer radius of the insulation (inner radius of the metallic sheath) [m]

For the export cable — a 1600 mm² copper conductor with 45 mm XLPE insulation at 220 kV — the conductor radius is $r_1 = 23.1$ mm and the insulation outer radius is $r_2 = 68.1$ mm. [1] The wall thickness of 45 mm reflects the field stress limits: at the inner conductor surface the peak electric field is approximately 5.1 kV/mm, comfortably within the 7 kV/mm design limit for XLPE. Substituting:

$$
C = \frac{2\pi \times 8.854 \times 10^{-12} \times 2.4}{\ln(68.1/23.1)} = \frac{1.337 \times 10^{-10}}{1.081} = 1.237 \times 10^{-10}\ \text{F/m} = 0.125\ \mu\text{F/km}
$$

The three-phase reactive power generated by the cable at rated voltage is:

$$
Q_c = V_{LL}^2 \cdot \omega \cdot C \cdot L
$$

where:
- $V_{LL}$ = line-to-line voltage [V]
- $\omega = 2\pi f$ = angular frequency [rad/s]
- $C$ = capacitance per unit length per phase [F/km]
- $L$ = cable length [km]

For the export cable: $V_{LL} = 220\,\text{kV}$, $f = 50\,\text{Hz}$, $C = 0.125\,\mu\text{F/km}$, $L = 45\,\text{km}$:

$$
Q_c = (220 \times 10^3)^2 \times 314.16 \times (0.125 \times 10^{-6}) \times 45 = 85.5\ \text{MVAR}
$$

This reactive power does not heat the cable. The cable temperature is determined by the resistive losses in the conductor — the $I^2 R$ term — not by the reactive charging current. What the reactive current does do is occupy the cable's current-carrying capacity. A cable rated at 900 A cannot distinguish between active and reactive current: both cause ohmic heating in the conductor. An 85.5 MVAR charging current at 220 kV is approximately $\sqrt{3} \times 220\,\text{kV} \times I = 85.5\,\text{MVAR}$, giving $I = 224\,\text{A}$ — roughly 25% of the ampacity already consumed before the first turbine has turned.

<!-- IMAGE: fig-20-01 -->
> **Figure 20.1** — Cable capacitance geometry and reactive power generation mechanism
> **Type:** two-panel schematic
> **Content:** Left panel: cross-section of a 220 kV submarine cable showing concentric layers — conductor (copper, r₁ = 23.1 mm), inner semiconductor screen, XLPE insulation (45 mm thick, r₂ = 68.1 mm), outer semiconductor screen, metallic sheath. Electric field lines radiate from conductor to sheath. Label: "E-field alternates at 50 Hz → reactive current." Right panel: simplified circuit model — the 45 km cable as a distributed capacitance C (shown as a shunt element with current arrow I_c = jV·ωC), the 220 kV bus (V_R), and the Thevenin source (V_S, X_s). Caption: reactive charging current I_c flows through the source reactance X_s, creating a voltage rise ΔV at V_R. Q_c = 85.5 MVAR annotated on current arrow.
> **Caption:** Left: The coaxial geometry of the XLPE submarine cable — two conducting cylinders separated by a dielectric — gives it a well-defined capacitance per unit length. Right: in the equivalent circuit, the cable's distributed capacitance draws 85.5 MVAR of reactive current that flows through the network's source reactance, raising the offshore bus voltage above nominal.
> **Alt text:** Two-panel schematic showing cable cross-section and equivalent circuit with reactive current flow from cable capacitance through source inductance.
> **Data source:** Author illustration
> **Resolution:** 1200 × 600 px minimum
> **Color notes:** Conductor in copper-orange; XLPE insulation in light grey; current flow arrows in blue; voltage rise annotation in amber.

> **Standard reference:** IEC 62067:2022, *Power cables with extruded insulation and their accessories for rated voltages above 150 kV (Um = 170 kV) up to 500 kV (Um = 550 kV).* Clause 5.2: insulation wall thicknesses and tolerances. Cable capacitance methodology: CIGRÉ Working Group B1.27 (2013). *Technological Assessment of 220 kV and 400 kV Underground Cable Systems.* Technical Brochure 556. Paris: CIGRÉ. Section 3.2.1.

---

## 20.2 The Ferranti Voltage Rise

When the cable is at light load — or open-circuited at the receiving end — its charging current flows from the cable into the network, through the source impedance, and back. The source impedance for an offshore wind farm is primarily inductive: the 220/400 kV onshore transformer in series with the grid Thevenin impedance. Inductive impedance. Reactive current. The interaction of these two produces a result that surprises engineers the first time they see it.

Consider a purely inductive source with reactance $X_s$, feeding the cable's receiving end (Bus 3, offshore). The cable's shunt capacitance generates a leading reactive current $I_c = jV_R \omega C_\text{total}$ that flows toward the source. Tracing the voltage from Bus 3 to the sending end at the onshore substation, the voltage at the sending end is lower:

$$
V_S = V_R - jX_s \cdot jV_R\omega C_\text{total} = V_R(1 - X_s\omega C_\text{total})
$$

Rearranging for the offshore bus voltage in terms of the onshore source voltage:

$$
V_R = \frac{V_S}{1 - X_s\omega C_\text{total}}
$$

Since $X_s\omega C_\text{total} > 0$, the denominator is less than unity, and $V_R > V_S$. The offshore bus voltage is higher than the onshore source. The cable has, in effect, inverted the normal direction of voltage drop. [2]

For practical purposes, a simpler form — the per-unit voltage rise — is more useful for sizing. Writing $\omega C_\text{total} = Q_c/V^2$ (from the reactive power formula in per-unit):

$$
\Delta V \approx \frac{Q_c \cdot X_s}{V^2}
$$

where all quantities are in per-unit on the same MVA base, and $X_s$ is the source reactance seen from the offshore bus. The approximation holds well for voltage rises up to approximately 10%.

Sebastian Ziani de Ferranti first encountered this effect in the late 1880s on his own system. Born in Liverpool on 9 April 1864, Ferranti was the kind of engineer whose biographers struggle to keep pace with the timeline. By age sixteen he had built a working electrical generator; by twenty-two he was chief electrician at the Grosvenor Gallery power station in London; by twenty-three he had been hired to design a central generating station at Deptford, in southeast London, that would transmit electricity at 10,000 volts along eight kilometres of underground cable to the West End of the city. [3]

The voltage was terrifying by the standards of the time. Nothing above 2,000 volts had previously been used for distribution. Contemporary engineers wrote to the technical press to warn that the scheme was suicidal. When Ferranti arranged a safety demonstration for Board of Trade inspectors — having an assistant hold a cold chisel while another drove it through a live conductor, both men walking away unharmed — the inspectors approved the system. The first power flowed from Deptford to central London in November 1889. By the time full commercial operation resumed in August 1891, after an 1890 fire caused by a mishandled switch at the Grosvenor Gallery substation, Ferranti had designed and built something that no one before him had attempted.

It was on those eight kilometres of concentric copper cable at 10 kV that the voltage rise effect was first systematically observed. When the system operated at light load — on Sunday mornings, late at night — the voltages at the receiving end in central London rose above the voltages at the sending end in Deptford. The cable was behaving as though it were generating electricity. Ferranti and his colleagues measured it, mapped it, and learned to manage it. By the time electrical engineering had a theoretical vocabulary for the mechanism, the effect had already been carrying his name for a decade. He died in Zurich on 13 January 1930, holding 176 patents. [3]

Modern offshore export cables have thirty times the capacitance per unit length of Ferranti's concentric copper mains — XLPE dielectric versus paper saturated in ozokerite wax — and operate at twenty-two times the voltage. The Ferranti effect is correspondingly more severe, and it appears at cable lengths ten to twenty times shorter than the equivalent overhead line. For a 45 km 220 kV cable, it is not a curiosity. It is a design constraint.

<!-- IMAGE: fig-20-02 -->
> **Figure 20.2** — Voltage profile along the 45 km export cable under no-load conditions
> **Type:** line chart
> **Content:** X-axis: distance from onshore substation (0 km) to offshore OSS (45 km). Y-axis: voltage magnitude in per-unit (0.95 to 1.10 pu). Three curves: (1) Uncompensated, no shunt reactor — voltage rises from 1.000 pu at onshore end to 1.047 pu at offshore end; (2) With 50 MVAR shunt reactor only — rises from 1.000 pu to 1.019 pu; (3) With full STATCOM + reactor compensation — flat at 1.000 pu. Dashed red horizontal line at 1.050 pu labelled "upper operating limit (typical)". Annotations at the offshore end (45 km) showing the three voltage values.
> **Caption:** Voltage profile along the 45 km export cable under no-load conditions (all turbines stopped, cable energised). Without compensation, the offshore bus rises 4.7% above the onshore source — approaching the typical ±5% operating limit. The 50 MVAR shunt reactor reduces the rise to 1.9%. The STATCOM eliminates it entirely.
> **Alt text:** Line chart showing voltage along the export cable rising toward the offshore end, with three curves showing uncompensated, reactor-only, and fully compensated cases.
> **Data source:** Author illustration
> **Resolution:** 1200 × 700 px minimum
> **Color notes:** Uncompensated in red; reactor-only in amber; fully compensated in green; operating limit in dashed red.

---

## 20.3 SVC Versus STATCOM

The most obvious solution to the Ferranti problem is to connect a reactor at the offshore bus. A reactor is an inductor — it absorbs reactive power — and it can counteract the cable's capacitive generation. This works. But a fixed reactor can only absorb. When the turbines are at full output and the grid code demands reactive injection, a reactor makes things worse. What is needed is a device that can both absorb and inject, and that can do so rapidly as the operating point changes.

Two families of technology have been used for this purpose: the Static VAR Compensator (SVC) and the Static Synchronous Compensator (STATCOM). They achieve the same goal — fast bidirectional reactive power control — by fundamentally different means.

An SVC uses a combination of thyristor-controlled reactors (TCR) and thyristor-switched capacitors (TSC). Each is a passive reactive element connected to the bus through a thyristor valve. The TCR absorbs variable reactive power by controlling the firing angle of the thyristor: the later in each half-cycle the thyristor fires, the less current flows through the reactor, and the less reactive power is absorbed. The TSC switches capacitor banks in discrete steps. The combined system provides bidirectional reactive control, but the output capability depends on the connected bus voltage in a critical way: because the reactive power from a passive impedance element is proportional to the square of the voltage ($Q = V^2/X_L$ or $Q = V^2 \cdot \omega C$), the SVC's capability degrades with the square of the voltage:

$$
Q_{SVC}(V) = Q_\text{rated} \cdot \left(\frac{V}{V_n}\right)^2
$$

A STATCOM replaces the passive reactive elements with a voltage source converter (VSC). The VSC synthesises a three-phase AC voltage from a DC capacitor — like a controlled inverter — and connects to the grid through a coupling transformer or reactor. By adjusting the magnitude and phase of the synthesised voltage relative to the grid voltage, the VSC draws or injects reactive current. Crucially, the VSC controls its current directly, not through a passive impedance. The rated current is constant, independent of the bus voltage. The reactive power output therefore degrades only linearly with voltage:

$$
Q_{STATCOM}(V) = Q_\text{rated} \cdot \left(\frac{V}{V_n}\right)
$$

At normal operating voltage ($V = 1.0\,\text{pu}$), the two devices deliver the same reactive output. At $V = 0.5\,\text{pu}$, the SVC delivers 25% of rated; the STATCOM delivers 50% — twice as much. At $V = 0.15\,\text{pu}$ (the minimum voltage during fault ride-through under PSE IRiESP requirements), the SVC delivers $0.15^2 = 2.25$% of rated; the STATCOM delivers 15% of rated — nearly seven times more. [4]

The deeper the voltage depression, the wider the gap. And voltage depressions are precisely when reactive support matters most.

Laszlo Gyugyi, then a research engineer at Westinghouse Electric in Pittsburgh, published the conceptual foundation for the STATCOM in June 1976 at the IEEE Power Electronics Specialists Conference in Cleveland. His paper showed that a static converter — using thyristors rather than the electromechanical excitation of a synchronous condenser — could synthesise arbitrary reactive current continuously and reversibly, without any passive capacitor banks to switch. The title of the paper was "Reactive Power Generation and Control by Thyristor Circuits." [5] The mathematical demonstration was clean enough that the concept spread through power engineering with unusual speed. By 1979 the journal version appeared in the IEEE Transactions on Industry Applications; by 1991 the first commercial STATCOM had been built.

That first commercial installation — at the Inuyama Switching Station in Japan — was commissioned for Kansai Electric Power Company by Mitsubishi Electric in 1991. Rated at ±80 MVA at 154 kV, it used gate turn-off thyristors (GTO) in a multi-pulse voltage source converter topology. Its purpose was power oscillation damping on a 154 kV transmission line serving the Osaka area. The GTO technology of 1991 generated significant harmonic distortion: nine phase-shifting transformers were required to filter it to acceptable levels. Modern STATCOMs use insulated gate bipolar transistors (IGBT) in a modular multilevel converter (MMC) topology, which inherently produces much lower harmonic content — a feature that matters for the story told in Chapter 21. [6]

For an offshore application, there is a third argument in favour of the STATCOM beyond voltage-sag performance: footprint. An SVC at ±120 MVAR requires substantial capacitor banks — discrete, switchable, heavy, and physically large. A STATCOM of equivalent rating occupies roughly one-third the footprint in power electronics cabinets. On a platform where every square metre costs money and cannot be added retrospectively, this is not a minor consideration.

Johan was born in Västerås — the city on Lake Mälaren where ASEA, the Swedish electrical engineering company that eventually became part of Hitachi Energy, was founded in 1883. ASEA developed the first thyristor-switched capacitors for reactive compensation in the early 1970s, and the Västerås factory built the world's first commercial HVDC link in 1954, connecting the island of Gotland to the Swedish mainland. The lineage from those 1954 HVDC valves to the IGBT cabinets in the room around them was direct and traceable, and Johan had worked in the Västerås facility for eleven years before moving to commissioning. He had not mentioned any of this. Kaan had looked it up the previous evening.

---

## 20.4 Sizing the STATCOM

The STATCOM must cover three distinct operating conditions, each of which places a different demand on its reactive range. The sizing exercise begins by identifying the reactive power boundary at each condition.

**No-load condition**: all turbines are stopped; the cable is energised. The cable generates +85.5 MVAR (capacitive). No reactive power is injected by the WTGs. The STATCOM must absorb the net reactive surplus to prevent the offshore bus voltage from rising beyond acceptable limits. After the shunt reactor contributes its fixed −50 MVAR (discussed in Section 20.5), the STATCOM must absorb a minimum of +35.5 MVAR. This is the inductive (absorbing) boundary of the sizing requirement.

**Full-load condition**: all turbines at rated output (510 MW). The cable still generates +85.5 MVAR — it does not know or care how much active power is flowing. The PSE IRiESP grid code requires the wind farm to maintain a reactive power capability of $\pm P \cdot \tan\varphi_\text{max}$ at the point of connection, where $\tan\varphi_\text{max} \approx 0.33$ for Type D generators in the Polish grid. [4] At 510 MW, this corresponds to $\pm 168$ MVAR of reactive capability at the 220 kV point of connection. The WTG converters each carry a portion of this — the per-turbine reactive range from the Type 4 DFIG-equivalent converters is approximately ±0.35 pu of the machine's rated current — and the STATCOM handles the substation-level balance. After the shunt reactor and WTG contributions are accounted for, the STATCOM must be capable of injecting up to approximately +80 to +100 MVAR at full load. This sets the capacitive (injecting) boundary.

**Fault ride-through condition**: a three-phase fault at or near the 220 kV point of connection causes the bus voltage to drop to 0.15–0.20 pu for up to 140 ms. The PSE IRiESP and ENTSO-E NC RfG Type D requirement is that the installation inject reactive current in proportion to the voltage deviation, with a gain of $k_q \geq 2\,\text{pu/pu}$, prioritised above active current. The STATCOM — operating at constant rated current during the fault — injects reactive power $Q = Q_\text{rated} \cdot (V/V_n)$ at whatever the fault voltage is. At $V = 0.15\,\text{pu}$: $Q_\text{STATCOM} = 0.15 \times 120 = 18\,\text{MVAR}$, with the WTG converters contributing a further quantity. The FRT analysis belongs to Chapter 23; what matters here is that the STATCOM's linear voltage characteristic means it is still operational at fault voltages where an SVC would be contributing essentially nothing.

Bringing the three conditions together, the reactive range of the STATCOM must span from at least −120 MVAR (inductive, absorbing) to at least +80 MVAR (capacitive, injecting), with margin for transient demands and grid code compliance over the life of the asset. A symmetrical ±120 MVAR rating is the standard selection for an installation of this scale: it covers all three boundary conditions, provides reserve capacity for network changes (additional cables, future interconnection), and is available as a standard product offering from multiple manufacturers. [5] [6]

The rated current at 220 kV:

$$
I_{STATCOM} = \frac{Q_\text{rated}}{\sqrt{3} \cdot V_n} = \frac{120 \times 10^6}{\sqrt{3} \times 220 \times 10^3} = 315\,\text{A}
$$

This current flows continuously through the VSC IGBTs whether the STATCOM is absorbing or injecting. The IGBT thermal design is based on this current magnitude, not on the net reactive power, which is why the rating is stated as ±120 MVAR rather than −35.5 MVAR (the no-load absorbing requirement). The IGBTs carry 315 A at full inductive output, 315 A at full capacitive output, and some intermediate value during normal operation. Their rated duty is the maximum current, and they must be designed to carry it continuously in either polarity.

---

## 20.5 The Shunt Reactor

A shunt reactor is a three-phase inductor connected permanently between the 220 kV bus and earth. It is not switched, not controlled, and not a power electronic device. It sits in the OSS absorbing reactive power at all times, whether the STATCOM is running, under maintenance, or tripped.

The reactive power absorbed by a shunt reactor at rated voltage is:

$$
Q_R = \frac{V^2}{X_L} = V^2 \cdot \frac{1}{\omega L}
$$

where:
- $V$ = line-to-neutral voltage (or expressed as a three-phase total with $V = V_{LL}$) [V]
- $X_L = \omega L$ = inductive reactance of the reactor [Ω]
- $L$ = inductance per phase [H]

For a 50 MVAR reactor at 220 kV: $X_L = V_{LL}^2 / Q = (220 \times 10^3)^2 / (50 \times 10^6) = 968\,\Omega$ per phase (line-to-neutral). The physical reactor is a gapped iron-core unit enclosed in a tank; the gap in the core prevents saturation under the continuous steady-state flux. Its maintenance interval is typically 10–15 years. It requires no control system, no cooling beyond natural oil convection, and no power supply for auxiliaries. It will absorb reactive power as long as the bus is energised.

The design philosophy behind the shunt reactor is straightforward: use the cheapest and most reliable technology for the task that can be accomplished with fixed equipment, and reserve the expensive and sophisticated technology for the variable task. The cable charging of 85.5 MVAR is predictable, constant, and present at all times. The shunt reactor absorbs the fixed portion; the STATCOM handles the variable remainder.

At rated voltage, the 50 MVAR reactor absorbs 50 MVAR and the STATCOM absorbs the remaining 35.5 MVAR — a total absorption demand of 85.5 MVAR against the cable's generation. When the bus voltage falls (as it does slightly at full turbine output due to the load flow results), the reactor's absorption reduces proportionally with $V^2$ while the STATCOM — with its constant current — maintains its contribution. The STATCOM compensates for this reactive variation automatically through its closed-loop voltage controller.

A shunt reactor at offshore voltage levels costs approximately €2–3M for a 50 MVAR unit. A comparable STATCOM increment of 50 MVAR costs approximately €8–12M. The economics are unambiguous: for the constant, predictable component of the reactive budget, the reactor is the correct choice. The STATCOM earns its premium by handling what the reactor cannot — the dynamic, bidirectional, millisecond-scale reactive control that grid code compliance demands.

---

## 20.6 Worked Example: Reactive Power Audit at Three Operating Points

**Reference case:** 500 MW offshore wind farm, 220 kV export cable 45 km, $C = 0.125\,\mu\text{F/km}$. Source reactance at the 220 kV bus: $X_s = 0.2626\,\text{pu}$ on 500 MVA base (from the load flow in Chapter 18). Shunt reactor: 50 MVAR permanently connected. STATCOM: ±120 MVAR, voltage-controlled to a target of 1.000 pu at Bus 3 during normal operation.

---

**Operating Point 1: No-load (all turbines stopped, cable energised)**

*Step 1 — Cable reactive generation.*

$$
Q_c = (220 \times 10^3)^2 \times 314.16 \times (0.125 \times 10^{-6}) \times 45 = 85.5\,\text{MVAR}
$$

In per-unit on the 500 MVA base: $Q_c = 85.5/500 = 0.171\,\text{pu}$.

*Step 2 — Ferranti rise without compensation.*

From the voltage rise formula, with onshore voltage $V_S = 1.000\,\text{pu}$:

$$
V_R = \frac{V_S}{1 - X_s \cdot Q_c/V_S^2} = \frac{1.000}{1 - 0.2626 \times 0.171} = \frac{1.000}{1 - 0.04490} = \frac{1.000}{0.9551} = 1.047\,\text{pu}
$$

Bus 3 rises to $1.047 \times 220 = 230.3\,\text{kV}$ — a 4.7% overvoltage that approaches the typical ±5% operating limit and leaves no margin for normal voltage fluctuation.

*Step 3 — Effect of shunt reactor alone.*

The 50 MVAR reactor reduces the net reactive surplus: $Q_\text{net} = 85.5 - 50.0 = 35.5\,\text{MVAR} = 0.071\,\text{pu}$.

$$
V_R = \frac{1.000}{1 - 0.2626 \times 0.071} = \frac{1.000}{1 - 0.01865} = \frac{1.000}{0.9814} = 1.019\,\text{pu} = 224.2\,\text{kV}
$$

The reactor reduces the overvoltage from 4.7% to 1.9% — within the operating limit, but the STATCOM is still needed to control voltage actively and to handle conditions where the bus voltage varies from its design point.

*Step 4 — With STATCOM controlling to 1.000 pu.*

The STATCOM absorbs the remaining 35.5 MVAR: $Q_\text{STATCOM} = -35.5\,\text{MVAR}$ (inductive mode). Bus 3 is held at 1.000 pu. This is the normal no-load operating condition: reactor on, STATCOM absorbing approximately 30% of its inductive rating.

---

**Operating Point 2: Full load (all turbines at 500 MW, unity power factor)**

The cable still generates +85.5 MVAR. The shunt reactor absorbs −50.0 MVAR. The load flow (Chapter 18) showed Bus 3 at 1.024 pu with 510 MW flowing — the slight overvoltage reflects both cable charging and the WTG reactive injection at the turbine terminals. In this condition the STATCOM absorbs approximately −35 to −40 MVAR to maintain Bus 3 near its target. The WTG converters handle their portion of the power factor requirement at the turbine terminals; the STATCOM handles the substation-level balance.

The STATCOM in this condition is operating well within its inductive range, with the full capacitive range (+120 MVAR) available as reserve for fault conditions or grid code reactive demands from PSE.

---

**Operating Point 3: Fault condition — STATCOM vs equivalent SVC**

A three-phase fault at the 220 kV bus depresses Bus 3 voltage to $V = 0.15\,\text{pu}$ for 140 ms.

*STATCOM response:* The VSC maintains its rated current of 315 A throughout the fault. Reactive output:

$$
Q_\text{STATCOM} = \sqrt{3} \times (0.15 \times 220\,\text{kV}) \times 315\,\text{A} = \sqrt{3} \times 33\,\text{kV} \times 315\,\text{A} = 18.0\,\text{MVAR}
$$

*Equivalent SVC response:* An SVC of the same 120 MVAR nameplate rating would deliver:

$$
Q_\text{SVC} = 120\,\text{MVAR} \times (0.15)^2 = 120 \times 0.0225 = 2.7\,\text{MVAR}
$$

The STATCOM provides 6.7 times more reactive support at 0.15 pu voltage. For intermediate fault voltages:

| Bus voltage [pu] | $Q_{STATCOM}$ [MVAR] | $Q_{SVC}$ [MVAR] | STATCOM advantage |
|-----------------|---------------------|-----------------|-------------------|
| 1.00 | 120.0 | 120.0 | 1.0× (equal) |
| 0.85 | 102.0 | 86.7 | 1.2× |
| 0.70 | 84.0 | 58.8 | 1.4× |
| 0.50 | 60.0 | 30.0 | 2.0× |
| 0.30 | 36.0 | 10.8 | 3.3× |
| 0.15 | 18.0 | 2.7 | 6.7× |

The quadratic characteristic of the SVC fails precisely in the operating regime where voltage support matters most. A fault that drops the bus to 0.15 pu is a fault that requires urgent reactive injection; the SVC at that voltage is contributing less than 3% of its nameplate rating. The STATCOM at the same voltage contributes 15% — not large in absolute terms, but 6.7 times more effective, and fast enough to begin supporting voltage recovery within the first power system cycle (20 ms).

---

**Summary reactive power balance**

| Condition | $Q_c$ cable | $Q_R$ reactor | $Q_{STATCOM}$ | $V_{Bus\,3}$ |
|-----------|------------|--------------|--------------|-------------|
| No-load, uncompensated | +85.5 | 0 | 0 | 1.047 pu |
| No-load, reactor only | +85.5 | −50.0 | 0 | 1.019 pu |
| No-load, fully controlled | +85.5 | −50.0 | −35.5 | 1.000 pu |
| Full load, unity PF | +85.5 | −50.0 | −35 to −40 | ~1.000 pu |
| Fault, $V = 0.15$ pu (STATCOM) | — | — | +18.0 | 0.15 (fault) |
| Fault, $V = 0.15$ pu (SVC equiv.) | — | — | +2.7 | 0.15 (fault) |

The combined capital cost of the ±120 MVAR STATCOM and the 50 MVAR shunt reactor is approximately €12–18M for an offshore installation. Without reactive compensation, the farm cannot connect to the PSE grid: a Bus 3 voltage of 1.047 pu in no-load conditions would trigger automatic disconnection by the 220 kV protection relays — the same relays whose settings Sigrid had calibrated in the room down the corridor. The compensation equipment is not optional. It is the price of having a 45 km cable at all.

<!-- IMAGE: fig-20-03 -->
> **Figure 20.3** — Reactive power capability vs bus voltage: STATCOM vs SVC
> **Type:** line chart
> **Content:** X-axis: bus voltage [pu], range 0 to 1.0. Y-axis: reactive output [MVAR], range 0 to 130. Two curves: (1) STATCOM — straight line from (0, 0) to (1.0, 120), labelled "STATCOM: Q ∝ V"; (2) SVC — parabolic curve from (0, 0) to (1.0, 120), labelled "SVC: Q ∝ V²". Shaded region between the two curves indicating STATCOM advantage. Dashed vertical line at V = 0.15 pu (FRT condition); annotations showing Q_STATCOM = 18 MVAR and Q_SVC = 2.7 MVAR at that voltage. Horizontal dashed line at Q = 35.5 MVAR showing the no-load absorbing demand for reference.
> **Caption:** Reactive power output capability versus bus voltage for a ±120 MVAR STATCOM (linear) and an equivalent SVC (quadratic). During normal operation (V ≈ 1.0 pu) the devices are equally capable. During a deep voltage depression (V = 0.15 pu, dashed vertical line), the STATCOM delivers 18 MVAR versus the SVC's 2.7 MVAR — 6.7 times more reactive support when it is needed most.
> **Alt text:** Line chart comparing STATCOM (linear) and SVC (quadratic) reactive power capability versus voltage, showing STATCOM advantage widens at low voltage.
> **Data source:** Author illustration
> **Resolution:** 1200 × 700 px minimum
> **Color notes:** STATCOM curve in green; SVC curve in red; shaded advantage region in light green; fault voltage line in dashed red.

<!-- IMAGE: fig-20-04 -->
> **Figure 20.4** — Reactive power audit bar chart for three operating conditions
> **Type:** grouped vertical bar chart
> **Content:** Three groups of bars, one per operating condition: "No-load," "Full load," "Fault (V = 0.15 pu)". In each group, three bars: Q_cable (dark blue, +85.5 MVAR shown as positive), Q_reactor (orange, −50 MVAR shown as negative), Q_STATCOM (green for positive/injecting, red for negative/absorbing). Net reactive shown as a black diamond marker. In the "Fault" group, a second sub-group shows the SVC equivalent (grey bar at +2.7 MVAR) vs STATCOM (green at +18 MVAR) for direct comparison. Y-axis: reactive power [MVAR], range −60 to +100.
> **Caption:** Reactive power contributions from cable, shunt reactor, and STATCOM across three operating conditions. In no-load conditions the STATCOM absorbs the cable surplus not covered by the reactor. In the fault condition, the contrast between STATCOM and equivalent SVC (grey) demonstrates the linear vs quadratic capability difference.
> **Alt text:** Grouped bar chart showing reactive power balance among cable, reactor, and STATCOM for no-load, full-load, and fault conditions.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Cable charging in dark blue; reactor in orange; STATCOM absorbing in red; STATCOM injecting in green; SVC equivalent in grey.

---

## Key Takeaways

- **A long XLPE cable is a capacitor that generates reactive power continuously, regardless of load.** The reactive generation depends on the cable voltage, capacitance per unit length, and length: $Q_c = V_{LL}^2 \cdot \omega \cdot C \cdot L$. For a 45 km, 220 kV cable with $C = 0.125\,\mu\text{F/km}$, this is 85.5 MVAR — present at 3 AM on a calm night just as much as at rated output on a storm day.

- **The Ferranti effect explains why the offshore bus voltage rises when generation falls.** Capacitive charging current flowing through the inductive source impedance produces a voltage rise at the offshore end. Without compensation, the 45 km export cable raises Bus 3 to 1.047 pu at no-load — approaching the ±5% operating limit and leaving no margin for normal fluctuation. Sebastian de Ferranti first observed this on his 10 kV Deptford cable system in the 1880s; the effect remains a first-principles constraint for every long submarine cable today.

- **SVCs provide reactive power proportional to voltage squared; STATCOMs provide reactive current proportional to voltage.** During a fault that depresses bus voltage to 0.15 pu, a 120 MVAR STATCOM delivers 18 MVAR while an equivalent SVC delivers only 2.7 MVAR — 6.7 times less. The deeper the voltage depression, the worse the SVC performs relative to the STATCOM. For an offshore wind farm required to ride through faults and inject reactive current during voltage depressions, the STATCOM's linear characteristic is the decisive engineering argument.

- **STATCOM sizing must satisfy three boundary conditions: no-load absorption, full-load injection, and fault ride-through current.** For this farm, the no-load condition (cable −85.5 MVAR, reactor +50 MVAR absorbed, net = −35.5 MVAR required from STATCOM) sets the inductive boundary; the PSE grid code reactive requirement at full load sets the capacitive boundary. A ±120 MVAR rating covers both with reserve capacity for network changes over the 30-year asset life.

- **The shunt reactor handles the predictable, constant component; the STATCOM handles the variable, dynamic component.** At €2–3M for 50 MVAR, a permanently connected reactor is seven to eight times cheaper per MVAR than a STATCOM. Using the reactor for the fixed cable charging surplus reduces the STATCOM's continuous loading, extends IGBT service life, and lowers energy losses in the power electronics throughout the operational life of the farm.

---

## For Further Reading

- **Hingorani, N.G. and Gyugyi, L. (2000).** *Understanding FACTS: Concepts and Technology of Flexible AC Transmission Systems.* IEEE Press, Piscataway, NJ. ISBN 0-7803-3455-8. The standard reference for the theory and application of Flexible AC Transmission Systems. Chapter 5 develops the STATCOM operating principles from phasor analysis through VSC control theory; Chapter 6 covers the SVC; Chapter 11 discusses offshore and transmission-level reactive compensation applications. The V² vs V capability comparison in Chapter 5 is derived rigorously from the converter model and validated against measured data from early commercial installations.

- **Gyugyi, L. (1979).** "Reactive Power Generation and Control by Thyristor Circuits." *IEEE Transactions on Industry Applications*, Vol. IA-15, No. 5, pp. 521–532. DOI: 10.1109/TIA.1979.4503701. Based on a presentation at the IEEE Power Electronics Specialists Conference, Cleveland, June 1976 (DOI: 10.1109/PESC.1976.7072914). The foundational paper establishing that a static power converter can synthesise pure reactive power with continuous, stepless control — the operating principle of every STATCOM installed today. Gyugyi shows both the theoretical basis and the control implementation; the paper reads as clearly now as it did in 1976.

- **CIGRÉ Working Group B4.67 (2021).** *STATCOM Applications in Power Systems.* Technical Brochure 831. Paris: CIGRÉ. Covers STATCOM technology evolution from GTO to IGBT to MMC, with case studies from transmission and offshore wind applications. Section 4.3 discusses reactive compensation strategy for long submarine cables specifically. Section 6.1 provides measured performance data from commissioned installations comparing response time and low-voltage reactive capability for STATCOM versus SVC under voltage depression conditions.

---

*Johan pointed to the reactive power trend on his screen — the STATCOM trace now holding at −42 MVAR as the last feathered turbines dropped offline and the cable was bearing the full no-load condition. Bus 3 showed 1.001 pu. The STATCOM was working harder, and the voltage was not moving.*

*"I want to show you something," Johan said. He opened the commissioning test interface and typed a step command: from −42 MVAR to +80 MVAR. A one-hundred-and-twenty-two MVAR swing in a single step.*

*"From now. Count in your head."*

*He pressed enter.*

*Kaan counted. One.*

*The trace swung upward — through zero, through +20, through +50, through +80. It arrived at the setpoint, overshot slightly, settled. Kaan was still in the first count.*

*"Eighteen milliseconds," Johan said. "From command to settled output. That is approximately seventeen times faster than a blink."*

*Kaan had timed it with the stopwatch function on his phone, knowing he would not believe the screen. His phone agreed: 18 ms.*

*"How does it do that?"*

*"The IGBTs switch at two kilohertz. The current controller closes the loop in two PWM cycles. The mechanical equivalent — a synchronous condenser on a motor shaft — would take two to three seconds to reach the same output." Johan picked up his thermos. "The physics of a spinning machine imposes inertia. The physics of a semiconductor imposes almost none."*

*Anders had been quiet for several minutes, looking at the cabinet row. "Tell him what comes out the other side of this," he said.*

*"Harmonics," Johan said. He looked at Kaan. "When you build a device that chops a DC bus into an AC waveform at two kilohertz, you do not get a perfect sinusoid. You get a sinusoid plus a spectrum of components at integer multiples of the fundamental frequency. The MMC topology reduces them considerably. But they do not disappear. They propagate into the cable, into the transformers, and into the grid." He set down his cup. "Chapter 21 is in the control room. Ingrid will be there."*

*Through the observation window above the control panel, the indicator lights of a hundred and eighty megavars of power electronics held steady green. Kaan wrote the 18 ms in his notebook and looked at the number for a moment before closing it.*

---

## Notes

[1] Cable geometry and capacitance: For a 1600 mm² copper conductor, the cross-sectional area gives a conductor radius of $r_1 = \sqrt{1600/\pi} = 22.6$ mm ≈ 23.1 mm (the slight difference accounts for the circular area of the conductor including interstices in stranded construction, per IEC 60228:2004, Class 2). Insulation thickness of 45 mm for a 220 kV XLPE cable (Um = 245 kV) corresponds to a design electric field of approximately 5.1 kV/mm at the inner conductor surface, within the 7 kV/mm design limit for XLPE per IEC 62067:2022, Annex A. The coaxial capacitance formula is derived in: Kreuger, F.H. (1991). *Industrial High DC Voltage: Fields, Breakdown, Tests, Measurement.* Delft University Press, Delft, Chapter 1. The CIGRÉ B1.27 (2013) Technical Brochure 556 gives measured capacitance values for several 220 kV and 400 kV XLPE cables in service; values range from 0.12 to 0.25 μF/km depending on conductor cross-section and insulation design.

[2] Ferranti effect derivation: The exact formula $V_R = V_S / \cos(\beta\ell)$ for an open-circuit lossless line is derived in: Stevenson, W.D. (1982). *Elements of Power System Analysis.* 4th edition, McGraw-Hill, New York, Chapter 5, equations (5-11) to (5-18). The pi-model approximation $V_R \approx V_S / (1 - X_s Q_c/V^2)$ is the limit of this expression for short cables where $\beta\ell \ll 1$ radian, and corresponds to the reactive voltage regulation formula standard in power system engineering. The derivation using source reactance and reactive power in per-unit is given in: Kundur, P. (1994). *Power System Stability and Control.* McGraw-Hill, New York (EPRI Power Engineering Series), Section 3.2.

[3] Sebastian Ziani de Ferranti: biographical details from Wilson, G. (1965). "Pioneer of electric power transmission: An account of the life and work of Sebastian Ziani de Ferranti (1864–1930)." *Notes and Records of the Royal Society of London*, Vol. 19, No. 1, pp. 33–45. DOI: 10.1098/rsnr.1964.0004. Also: *Ferranti, G.Z. de, and Ince, R.* (1882/1956). *The Life and Letters of Sebastian Ziani de Ferranti.* Williams and Norgate, London (reprinted). Deptford Power Station: National Grid Electricity Transmission archive; ETHW Engineering and Technology History Wiki, "Sebastian Ziani de Ferranti," https://ethw.org/Sebastian_Ziani_de_Ferranti. Operational dates: first power November 1889; full commercial operation resumed August 1891 after the March 1890 fire at Grosvenor Gallery substation. Transmission voltage 10,000 V AC at 83–85 Hz.

[4] Grid code reactive requirements: PSE S.A. *Instrukcja Ruchu i Eksploatacji Sieci Przesyłowej (IRiESP)* (Grid Code for Transmission Network Operation), 2021 edition, Section 3.4 (Type D generation unit requirements), subsections on reactive power capability range and reactive current injection during voltage disturbances. ENTSO-E Commission Regulation (EU) 2016/631, *Network Code on Requirements for Grid Connection of Generators* (NC RfG), Articles 20–25, Type D requirements. The reactive current injection gain $k_q \geq 2\,\text{pu/pu}$ is specified in NC RfG Article 20(2)(d) and PSE IRiESP Table 3.4.1.

[5] Gyugyi STATCOM concept: Gyugyi, L. (1976). "Reactive Power Generation and Control by Thyristor Circuits." *1976 IEEE Power Electronics Specialists Conference (PESC)*, Cleveland, OH, 8–10 June 1976, pp. 174–184. DOI: 10.1109/PESC.1976.7072914. Journal version: Gyugyi, L. (1979). *IEEE Transactions on Industry Applications*, Vol. IA-15, No. 5, pp. 521–532. DOI: 10.1109/TIA.1979.4503701. The claim, sometimes found in secondary literature, that the foundational paper was presented at CIGRÉ 1976 is a conflation: Gyugyi was active in CIGRÉ working groups and received CIGRÉ recognition in 1990, but the landmark 1976 reactive power paper was presented at IEEE PESC. Gyugyi's co-authored book: Hingorani, N.G. and Gyugyi, L. (2000). *Understanding FACTS.* IEEE Press. ISBN 0-7803-3455-8.

[6] First commercial STATCOM: Inuyama Switching Station, Kansai Electric Power Company, Japan, 1991. Manufacturer: Mitsubishi Electric. Rating: ±80 MVA at 154 kV. Technology: GTO-based multi-pulse VSC with nine phase-shifting transformers for harmonic mitigation. Source: Mitsubishi Electric Power Semiconductor Device, "Inuyama STATCOM," product case study, https://psg.mitsubishielectric.co.uk/products/hvdc-facts/facts-solutions/svc-diamond/inuyama-statcom/. Technical details: Iravani, M.R. et al. (1997). "Static synchronous compensator: Principles of operation and some applications." *IEEE Power Engineering Review*, Vol. 17, No. 12, pp. 3–9. DOI: 10.1109/MPER.1997.642480. Modern MMC STATCOM technology: Perez, M.A. et al. (2015). "Circuit topologies, modeling, control schemes, and applications of modular multilevel converters." *IEEE Transactions on Power Electronics*, Vol. 30, No. 1, pp. 4–17. DOI: 10.1109/TPEL.2014.2310127.

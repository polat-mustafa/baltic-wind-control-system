# Chapter 16: AC Fundamentals: Phasors, Three-Phase, and Per-Unit

*The crew transfer vessel took twelve minutes to cover the distance from the SOV to the offshore substation — twelve minutes through a short Baltic chop, with the September sun low over the water and the smell of salt and diesel in the air.*

*Kaan had watched the offshore substation from a distance for weeks. From the SOV observation deck it had the nondescript appearance of a small industrial building dropped into the sea: two pale-grey steel modules stacked on a jacket foundation, a helideck on top, a boat landing at the waterline, and a dense eruption of cable ducts, ventilation grilles, and fire suppression pipes on every surface. It looked functional and unbeautiful in the way that all high-voltage infrastructure looks functional and unbeautiful. A sign near the boat landing read, in English and Polish: RESTRICTED ACCESS — AUTHORISED PERSONNEL ONLY.*

*At the pontoon, a marine coordinator in a red survival suit took the vessel's line and held it steady while Kaan and Anders climbed the aluminium boarding ladder. The ladder was wet from spray, and Kaan's boots slipped once on the second rung. Anders was already at the top, waiting with the patient expression of someone who had climbed several thousand offshore ladders and found none of them particularly interesting.*

*The substation had a particular atmosphere as soon as they stepped through the outer door. The air was cool and dry — conditioned to prevent condensation on the high-voltage equipment — and carried a faint smell Kaan could not immediately name. Something sweet and slightly chemical, like mineral oil mixed with ozone. He would learn, over the following weeks, to associate that smell with transformers.*

*A narrow corridor ran the length of the module, lit by fluorescent strips. Doors led off to either side, each labelled with a black-on-yellow voltage plate: 66 kV SWITCHGEAR. 220 kV SWITCHGEAR. CABLE HALL. BATTERY ROOM. CONTROL ROOM. LV SYSTEMS. The 220 kV door carried an additional notice: DANGER — HIGH VOLTAGE — STRICTLY AUTHORISED PERSONNEL ONLY, above the standard IEC warning symbol: a yellow triangle enclosing a lightning bolt.*

*Anders stopped outside the control room and turned to face him.*

*"Before we look at any of these panels," he said, "tell me what two hundred and twenty kilovolts means."*

*Kaan considered. "It's the voltage on the export cable. Line-to-line."*

*"It is an RMS value." Anders held up one finger. "The actual peak voltage in the switchgear room behind that door is three hundred and eleven kilovolts. The insulation is not designed for two hundred and twenty. It is designed for three hundred and eleven." He pushed open the control room door. "That is the first thing to understand about alternating current."*

*He held the door open. Kaan stepped through.*

---

## 16.1 Why AC? The Sinusoidal Machine

There is a reason the voltage in a power system oscillates fifty times a second in Europe and sixty times a second in North America, and the reason is not historical accident — though the split between continents is. The reason is rotational geometry.

Every synchronous generator in a power system — driven by steam, water, wind, or nuclear heat — works by rotating a magnetic field past a coil of copper wire. By Faraday's law, a changing magnetic flux through the coil induces a voltage proportional to the rate of change of that flux. [1] When the rotor spins at constant angular velocity, the flux through each stator coil varies as a pure sine function of time. The generator does not produce a sinusoidal voltage because an engineer chose a sinusoidal waveform. It produces one because it is a rotating machine, and rotation is the physical origin of sinusoidal motion.

The instantaneous voltage at the terminals of a generator winding is:

$$
v(t) = V_{\text{peak}} \sin(\omega t + \phi)
$$

where:
- $V_{\text{peak}}$ = peak voltage [V]
- $\omega$ = angular frequency, $\omega = 2\pi f$ [rad/s]
- $f$ = frequency [Hz]
- $t$ = time [s]
- $\phi$ = initial phase angle [rad]

In Europe, the grid frequency is 50 Hz — the rotor completes fifty revolutions per second, the voltage completes fifty full cycles, and the instantaneous voltage at any point oscillates between $+V_{\text{peak}}$ and $-V_{\text{peak}}$ at that rate. The 50 Hz European standard was established largely through AEG's systems of the early 1890s, following the Lauffen–Frankfurt demonstration discussed later in this chapter. Westinghouse and Tesla in the United States preferred 60 Hz, which makes motors slightly more compact and gives smoother operation at low speeds. By the early twentieth century both continents had standardised separately, and the discrepancy was too deeply embedded in existing equipment to reconcile. The offshore wind farm in this book, connected to the Polish grid, operates at 50 Hz throughout. [2]

The nameplate on every transformer, cable, and generator in the offshore substation reads **220 kV** or **66 kV** — not 311 kV or 93 kV. But a peak voltage of 311 kV is the physical reality inside every conductor on the 220 kV system. To reconcile the nameplate with the physics, power engineers use a single standardised quantity: the root-mean-square voltage, or RMS.

The RMS voltage is defined as the square root of the time-averaged square of the instantaneous voltage:

$$
V_{\text{rms}} = \sqrt{\frac{1}{T} \int_0^T v(t)^2 \, dt} = \frac{V_{\text{peak}}}{\sqrt{2}}
$$

where:
- $V_{\text{rms}}$ = root-mean-square voltage [V]
- $T$ = period, $T = 1/f$ [s]
- $V_{\text{peak}}$ = peak voltage [V]

The factor $1/\sqrt{2} \approx 0.707$ connects every nameplate voltage to the physical peak. For a 220 kV system: $V_{\text{peak}} = 220 \times \sqrt{2} = 311.1$ kV. The gas-insulated switchgear in the substation is designed to withstand 311 kV continuously — plus a lightning impulse test voltage of 1,050 kV and a switching surge test voltage of 850 kV — while its nameplate reads 220 kV. [3]

The reason engineers use RMS rather than peak is power equivalence. A resistor $R$ connected to a DC supply of $V_{\text{dc}}$ dissipates average power $P = V_{\text{dc}}^2 / R$. The same resistor connected to an AC supply of $V_{\text{rms}}$ dissipates exactly the same time-averaged power: $P = V_{\text{rms}}^2 / R$. The RMS voltage is the DC-equivalent voltage for rating, heating, and power transfer. A transformer rated 220 kV, 500 MVA can carry 500 million volt-amperes of power — the same it would carry if the voltage were a steady 220 kV DC instead of a 50 Hz sinusoid peaking at 311 kV. [4]

In the control room of the offshore substation, every voltage reading on the mimic screens — 220.3 kV on the HV busbar, 66.1 kV on the LV busbar — is an RMS value. The measurement unit in the switchgear room samples the actual sinusoid thousands of times per second, squares the samples, averages them, and takes the square root. What the operator reads is the calm DC-equivalent number, which can be compared directly against the rated values on the equipment nameplates.

<!-- IMAGE: fig-16-01 -->
> **Figure 16.1** — Sinusoidal voltage waveform: peak, RMS, and period
> **Type:** line chart
> **Content:** A single cycle of v(t) = 311 sin(2π × 50 × t) plotted over 0–20 ms. Annotations: "Peak voltage: 311 kV" at the maximum; "RMS voltage: 220 kV" shown as a horizontal dashed line at 0.707 × 311 kV; "Period T = 20 ms (f = 50 Hz)" spanning the full cycle. A secondary shaded region shows v(t)² to illustrate the mean-of-squares concept. Axes: time in ms (x), voltage in kV (y).
> **Caption:** A 220 kV RMS sinusoid peaks at 311 kV. Insulation is sized for the peak; equipment nameplates and metering display the RMS.
> **Alt text:** Graph showing one sinusoidal voltage cycle, with a horizontal dashed line at the RMS value of 220 kV and the peak annotated at 311 kV.
> **Data source:** Author illustration.
> **Resolution:** 1200 × 600 px minimum
> **Color notes:** Waveform in dark blue; RMS dashed line in orange; annotations in black

> **Standard reference:** IEC 60038:2009, "IEC Standard Voltages" — Table 1, System III: the 220 kV and 66 kV levels used throughout this book correspond to IEC 60038 Series I standard voltages for HV AC transmission systems. [3]

---

## 16.2 Phasors — Steinmetz's Shorthand

In July 1893, a twenty-eight-year-old German émigré named Karl August Rudolf Steinmetz stood before the American Institute of Electrical Engineers and presented a paper that changed how every electrical engineer in the world would think about AC circuits. He had fled Breslau five years earlier, one step ahead of the police — he had edited a socialist newspaper and his name was on a list. He arrived in the United States with almost nothing, found work designing motors at a company that would soon be absorbed by General Electric, and spent the next five years solving a problem that had frustrated AC engineers for a decade. [5]

The problem was calculation. An AC circuit is described by differential equations: the voltage across an inductance is $v = L \, di/dt$; across a capacitance, $i = C \, dv/dt$. Computing the steady-state behaviour of any circuit with multiple reactive components — a transformer with leakage inductance, a cable with shunt capacitance, a generator feeding a motor — required solving systems of coupled differential equations. Every AC study was a multi-page exercise in calculus, and the systems being built in the 1890s were already too complex for this approach to scale.

Steinmetz's insight was that for steady-state sinusoidal circuits — where every voltage and current oscillates at the same frequency — you could represent each quantity as a point in the complex plane rather than a function of time. A voltage $v(t) = V_{\text{peak}} \sin(\omega t + \phi)$ could be written as a **phasor**: a complex number encoding the amplitude and phase angle, with the time dependence factored out. Multiplication by $j$ (the imaginary unit, representing a 90° phase shift) replaced differentiation. The differential equations became algebraic equations solvable with arithmetic.

"I have reduced this complicated problem," Steinmetz told the assembled engineers, "to a simple problem of algebra." [5] His book, *Theory and Calculation of Alternating Current Phenomena*, published four years later, taught a generation of American engineers the method. The notation — including the lower-case letter $j$ rather than $i$ (which electrical engineers reserve for instantaneous current) to denote the 90° rotation operator — became the global standard for power system analysis. [6]

In phasor notation, voltage and current at the same frequency are related by a complex impedance $\mathbf{Z} = R + jX$, where $R$ is resistance and $X$ is reactance (positive for inductive, negative for capacitive). The quantity that connects phasor voltages and currents to the physical flow of energy is **complex power**:

$$
\mathbf{S} = \mathbf{V} \cdot \mathbf{I}^* = P + jQ
$$

where:
- $\mathbf{S}$ = complex apparent power [VA]
- $\mathbf{V}$ = voltage phasor [V]
- $\mathbf{I}^*$ = complex conjugate of current phasor [A]
- $P$ = active power [W] — flows one-way from source to load, does work
- $Q$ = reactive power [VAR] — oscillates between source and electromagnetic fields without net power transfer
- $|\mathbf{S}|$ = apparent power magnitude [VA], equal to $\sqrt{P^2 + Q^2}$

The physical distinction between $P$ and $Q$ is not abstract. The turbine generators in this wind farm produce active power $P$, which flows to the grid as useful electrical energy — the megawatt-hours that appear on the electricity meter and generate revenue. Reactive power $Q$ does not do net work, but it cannot be ignored: it circulates in the conductors, consumes capacity in the cables and transformers, and must be balanced at every node in the network or voltages will collapse. A submarine cable is a distributed capacitor (as Chapter 14 established: 2.6 MVAR/km at 220 kV), producing reactive power whether or not any active power flows — which is why the offshore substation contains a shunt reactor and a STATCOM whose sole purpose is to absorb and supply $Q$ to keep the busbar voltage within 0.95–1.05 per-unit of its nominal value. The role of reactive power in offshore wind voltage management is the subject of Chapter 20. [7]

<!-- IMAGE: fig-16-02 -->
> **Figure 16.2** — Phasor diagram for a lagging power factor load
> **Type:** vector diagram
> **Content:** Two panels. Left: the complex plane (Re on x-axis, Im on y-axis) showing voltage phasor V along the positive real axis and current phasor I at angle φ below the real axis (lagging). Right: the power triangle — a right triangle with P on the horizontal axis (active power), Q pointing upward on the vertical axis (lagging = inductive = positive Q), |S| as the hypotenuse, and angle φ labelled between |S| and P. Arrow annotations show "lagging (inductive): Q > 0" and "leading (capacitive): Q < 0".
> **Caption:** For a lagging load, current lags voltage by angle φ. Complex power S = VI* has positive Q — reactive power consumed by the inductance. The cosine of φ is the power factor.
> **Alt text:** Two-panel diagram. Left panel: complex plane phasor diagram with voltage on the real axis and current lagging below it. Right panel: power triangle with active power P as base, reactive power Q as vertical leg, and apparent power S as hypotenuse.
> **Data source:** Author illustration.
> **Resolution:** 1200 × 700 px minimum
> **Color notes:** Voltage phasor in blue; current phasor in orange; power triangle in green

---

## 16.3 The Power Triangle

The relationship $\mathbf{S} = P + jQ$ has a geometric form that power engineers think in almost instinctively: the **power triangle**, a right triangle with $P$ as the base, $Q$ as the height, and $|\mathbf{S}|$ as the hypotenuse. The angle between $P$ and $|\mathbf{S}|$ is the power factor angle $\phi$:

$$
|\mathbf{S}| = \sqrt{P^2 + Q^2}, \qquad \cos \phi = \frac{P}{|\mathbf{S}|}
$$

where:
- $|\mathbf{S}|$ = apparent power [VA]
- $P$ = active power [W]
- $Q$ = reactive power [VAR]
- $\phi$ = power factor angle [rad]
- $\cos \phi$ = power factor [-]

The power factor is the fraction of apparent power that does useful work. A power factor of 1.00 means every ampere flowing through the cable is delivering active power. A power factor of 0.80 means 80 percent of the current is doing work; the remaining 20 percent — the reactive current — occupies cable capacity, heats the conductors slightly, and produces voltage drop along the line, all without contributing to the megawatt-hours on the electricity meter.

For a **lagging** power factor, current lags voltage as in an inductive load (a motor, a transformer under load), and $Q > 0$. For a **leading** power factor, current leads voltage as in a capacitive load (a long unloaded cable), and $Q < 0$. The convention that inductive reactive power is positive is established by IEC standard and is universal in power engineering practice. [8]

Transformers and cables are rated in **volt-amperes**, not watts. A 250 MVA transformer carries 250 million volt-amperes of current regardless of the power factor. At power factor 1.00, all 250 MVA is active power. At power factor 0.80, the transformer still carries 250 MVA of current, but only 200 MW of it is active — the remaining 150 MVAR of reactive current is using the transformer's thermal capacity without contributing to generation. Every offshore component — the 220 kV export cable, the main power transformers, the 66 kV array cables — operates under this constraint. Specifying equipment with too small an apparent power rating and too optimistic a power factor assumption is one of the most common causes of thermal overload in new offshore wind farm designs.

The Polish grid operator PSE requires, under the ENTSO-E Network Code on Requirements for Generators, that Type D generating units (≥75 MW connected at ≥110 kV) maintain reactive capability within ±0.225 per-unit of rated active power at the grid connection point — corresponding approximately to a power factor range of 0.90 to 0.975, lagging and leading. [9] At the farm's rated output of 500 MW, this means being capable of absorbing up to 123 MVAR from the grid and supplying up to 123 MVAR to the grid, simultaneously with full active power delivery, in any wind condition. Maintaining that capability across the full range of wind speeds — from 5 m/s partial output to 12.5 m/s rated — is the job of the Power Plant Controller, covered in Chapter 24.

Elif Şahin — the electrical engineer Kaan had met over coffee in the SOV common room during his first week — had a mug on her desk that read "I ♥ REACTIVE POWER." The joke is understood only by power engineers: reactive power is the half of the power triangle that does no visible work and causes endless problems when it is not properly managed. It is invisible to most people, not measurable by a household energy meter, and irrelevant to anyone who does not operate a high-voltage network. Understanding it — the power triangle, the apparent power rating, the lagging and leading distinction — is the minimum equipment for reading any single-line diagram in any substation.

<!-- IMAGE: fig-16-03 -->
> **Figure 16.3** — The power triangle and the cost of power factor
> **Type:** geometric diagram with annotation
> **Content:** A right triangle labelled as the power triangle. Horizontal base: "P [MW] — Active Power (does work)". Vertical leg: "Q [MVAR] — Reactive Power (stores energy in fields)". Hypotenuse: "|S| [MVA] — Apparent Power (equipment rating)". Angle φ labelled between |S| and P. Two example annotations: "pf = 0.95: |S| = 526 MVA for 500 MW" and "pf = 0.80: |S| = 625 MVA for 500 MW — 19% larger cable and transformer required." Secondary annotation: "lagging (inductive, Q > 0)" and "leading (capacitive, Q < 0)".
> **Caption:** The power triangle governs equipment sizing. At pf = 0.80, delivering 500 MW requires 625 MVA of apparent power — 19% more cable and transformer capacity than at pf = 0.95.
> **Alt text:** Right triangle diagram labelled as the power triangle, with horizontal base as active power P, vertical leg as reactive power Q, and hypotenuse as apparent power S, with example numbers for two different power factors.
> **Data source:** Author illustration.
> **Resolution:** 1200 × 700 px minimum
> **Color notes:** Triangle outline in dark blue; P base in green; Q leg in orange; S hypotenuse in blue

---

## 16.4 Three-Phase: Dolivo-Dobrovolsky's Proof

On the evening of 24 August 1891, a test committee gathered at the International Electrotechnical Exhibition in Frankfurt to measure the efficiency of an unusual experiment. A generator at a cement plant on the Neckar River — 175 kilometres to the south in the small town of Lauffen am Neckar — had been running since earlier that day, producing three-phase alternating current from a water turbine. The current had been stepped up by transformers to approximately 15,000 volts and transmitted north through an overhead line to Frankfurt, where it had been stepped down to drive a 100-horsepower motor and illuminate exhibition halls with incandescent lamps. The test committee's finding was unambiguous: 75 percent of the power generated in Lauffen had arrived in Frankfurt. [10]

The demonstration was designed by Mikhail Osipovich Dolivo-Dobrovolsky, a Russian-born engineer working for AEG (Allgemeine Elektricitäts-Gesellschaft) in Frankfurt, with the generating equipment built by the Swiss firm Maschinenfabrik Oerlikon under its technical director, Charles Eugene Lancelot Brown. Dolivo-Dobrovolsky had spent the preceding three years inventing the components that made the 175-kilometre transmission possible: a practical squirrel-cage induction motor (1889), a three-phase transformer, and the theoretical framework for balanced three-phase AC networks. [11] The Frankfurt exhibition was, for him, a public proof of concept at industrial scale.

The War of Currents that Elif had described over coffee had been settled for practical purposes by the Niagara Falls generating station in 1896. But the 1891 Frankfurt demonstration was the engineering turning point — the moment measured data proved that AC could carry industrial power over distances that made DC impractical. A Russian engineer at a German company, building on equipment made in Switzerland, did it. [12]

Why three phases, and not two or four?

A single-phase generator produces a voltage $v_1(t) = V_{\text{peak}} \sin(\omega t)$. The instantaneous power in a resistive load pulsates at twice the supply frequency: $p_1(t) = V_{\text{peak}}^2 \sin^2(\omega t) / R$ is zero twice per cycle and maximum twice per cycle. A single-phase motor driven by this supply produces torque that pulsates at 100 Hz — causing vibration and mechanical fatigue at industrial scales.

A balanced three-phase system produces three voltages, each 120° apart:

$$
v_a = V_p \sin(\omega t), \quad v_b = V_p \sin\!\left(\omega t - \tfrac{2\pi}{3}\right), \quad v_c = V_p \sin\!\left(\omega t - \tfrac{4\pi}{3}\right)
$$

The sum of the three instantaneous powers is constant in time — it does not pulsate. In a balanced three-phase system, the total active power is:

$$
P_{3\phi} = \sqrt{3} \cdot V_L \cdot I_L \cdot \cos \phi
$$

where:
- $P_{3\phi}$ = total three-phase active power [W]
- $V_L$ = line-to-line RMS voltage [V] — the voltage measured between any two of the three conductors
- $I_L$ = RMS line current [A]
- $\cos \phi$ = power factor [-]

The $\sqrt{3}$ factor comes from the geometry of the star (Y) connection: in a star system, the line-to-line voltage between two conductors is $\sqrt{3}$ times the phase voltage from conductor to neutral. The same formula holds for a delta (Δ) connection, where the relationship is between phase current and line current. In both cases, the total three-phase power is $\sqrt{3} V_L I_L \cos\phi$. [13]

The economic argument for three phases is equally compelling. Three separate single-phase circuits carrying the same total power would require six conductors. A balanced three-phase system needs only three: the return currents from the three phases sum to exactly zero at the neutral, so the neutral conductor can be eliminated entirely. Three conductors instead of six — a saving of 50 percent in copper, cable weight, and cable cost at the same transmitted power. This is why Dolivo-Dobrovolsky's system won, and why the 50 Hz three-phase standard he demonstrated in Frankfurt in 1891 is still the standard to which the turbines, cables, and transformers operating in the Baltic Sea are built in the twenty-first century.

Every component in the wind farm is a three-phase system: the generator terminals at 0.69 kV inside each turbine, the 66 kV array cables, the 220 kV export cable, and the 400 kV PSE transmission grid to which it all connects. The $\sqrt{3}$ factor appears at every step of the power calculation.

<!-- IMAGE: fig-16-04 -->
> **Figure 16.4** — Star (Y) and delta (Δ) three-phase connections
> **Type:** circuit diagram
> **Content:** Two diagrams side by side. Left: Star (Y) connection showing three voltage sources Va, Vb, Vc with their tails joined at neutral N. Line conductors emerge from the heads. Line-to-line voltage VL and phase voltage Vph = VL/√3 annotated. Right: Delta (Δ) connection showing three sources in a closed loop, line conductors emerging from the junctions. Phase current Iph and line current IL = √3 × Iph annotated. Below both: three sinusoidal waveforms 120° apart (phases A, B, C), with the annotation "sum at any instant = 0" demonstrating balanced operation.
> **Caption:** In a star connection, line voltage is √3 times phase voltage. In a delta connection, line current is √3 times phase current. Both obey P = √3 VL IL cos φ.
> **Alt text:** Two three-phase circuit diagrams showing star and delta connections with voltage and current annotations, and three 120°-offset sinusoidal waveforms below demonstrating balanced operation.
> **Data source:** Author illustration.
> **Resolution:** 1200 × 700 px minimum
> **Color notes:** Phase A in blue; phase B in orange; phase C in green; neutral in grey

> **Standard reference:** IEC 60038:2009, "IEC Standard Voltages" — the 220 kV and 66 kV nominal voltages are IEC 60038 Series I standard voltages. Transformer vector group notation (e.g., YNd11, Dyn11) follows IEC 60076-1:2011, "Power transformers — Part 1: General." [14]

---

## 16.5 The Per-Unit System

Trace the path of active power from a turbine generator to the PSE transmission grid. The V236 generator produces approximately 0.69 kV at its terminals. The turbine transformer steps this to 66 kV for the array cable. At the offshore substation, the main power transformer steps 66 kV to 220 kV for the export cable. At the onshore substation, a final transformer steps 220 kV to 400 kV for the PSE grid. Four voltage levels: 0.69, 66, 220, and 400 kV.

At each transformer, the current changes by the inverse of the turns ratio. A single 15 MW turbine at full power draws approximately 12,600 A at 0.69 kV. At 66 kV the same power flows at 131 A. At 220 kV, 39 A. At 400 kV, the full 500 MW farm output flows at about 722 A. Impedances scale by the square of the turns ratio: a cable with a resistance of 0.5 Ω represents completely different proportions of the circuit's power-carrying capacity at 66 kV versus 220 kV.

Computing fault currents, load flow, and protection settings for a system that spans four voltage levels — with impedances that transform by the square of the turns ratio at each transformer — is manageable but error-prone. A single misapplied turns ratio can corrupt an entire study. The **per-unit system** removes this problem by normalising all voltages, currents, powers, and impedances to a common dimensionless base. [15]

The procedure:

1. Choose a system-wide base apparent power $S_{\text{base}}$ — typically the rated capacity of the wind farm, or a round number close to it.
2. Choose a base voltage $V_{\text{base}}$ for each voltage zone — typically the nominal operating voltage of that zone.
3. **Derive** the base current and base impedance for each zone from $S_{\text{base}}$ and $V_{\text{base}}$:

$$
I_{\text{base}} = \frac{S_{\text{base}}}{\sqrt{3} \cdot V_{\text{base}}}, \qquad Z_{\text{base}} = \frac{V_{\text{base}}^2}{S_{\text{base}}}
$$

where:
- $S_{\text{base}}$ = chosen base apparent power [VA] — one value, same everywhere
- $V_{\text{base}}$ = chosen base voltage for this zone [V] — one value per zone
- $I_{\text{base}}$ = derived base current for this zone [A]
- $Z_{\text{base}}$ = derived base impedance for this zone [Ω]

4. Express every actual quantity as a fraction of its base:

$$
V_{\text{pu}} = \frac{V_{\text{actual}}}{V_{\text{base}}}, \quad I_{\text{pu}} = \frac{I_{\text{actual}}}{I_{\text{base}}}, \quad Z_{\text{pu}} = \frac{Z_{\text{actual}}}{Z_{\text{base}}}
$$

The central elegance of the method: a transformer with turns ratio 66/220 kV has a primary base voltage of 66 kV and a secondary base voltage of 220 kV. If the same $S_{\text{base}}$ is used on both sides, the transformer's leakage reactance — say, $j0.14$ pu on its own rating — appears as a single series element connecting the 66 kV pu bus to the 220 kV pu bus, with no turns ratio in the circuit. **The transformer disappears from the per-unit equivalent.** All four voltage levels of the wind farm collapse into a single normalised network. [16]

Component datasheets give per-unit impedances on the component's own rating. When the study uses a different $S_{\text{base}}$, the conversion is:

$$
Z_{\text{pu,new}} = Z_{\text{pu,old}} \times \frac{S_{\text{base,new}}}{S_{\text{base,old}}} \times \left(\frac{V_{\text{base,old}}}{V_{\text{base,new}}}\right)^2
$$

When the voltage bases match the nominal voltages (as they should), the voltage ratio is 1.00 and the formula simplifies to a scaling by the MVA ratio. A 250 MVA transformer with $X = 0.14$ pu on its own rating, expressed on a 500 MVA system base, has:

$$
X_{\text{pu, 500 MVA}} = 0.14 \times \frac{500}{250} = 0.28 \text{ pu}
$$

This transformer's 28% reactance on the system base dominates the circuit during fault conditions — which is precisely why it appears prominently in the short-circuit calculations of Chapter 19 and the protection coordination study of Chapter 26.

<!-- IMAGE: fig-16-05 -->
> **Figure 16.5** — Actual multi-voltage circuit vs per-unit equivalent
> **Type:** single-line circuit diagram (two-panel comparison)
> **Content:** Left panel (actual circuit): Generator at 0.69 kV → turbine transformer T1 (0.69/66 kV, turns ratio shown) → 66 kV bus → OSS transformer T2 (66/220 kV, turns ratio shown) → 220 kV export cable → onshore transformer T3 (220/400 kV) → PSE 400 kV grid. Current values annotated at each level: 12,600 A / 131 A / 39 A / 722 A for 500 MW. Right panel (per-unit circuit): same topology, but all transformers replaced by their pu leakage reactances jX_T1, jX_T2, jX_T3 in series. All currents in pu. PSE grid appears as infinite bus at 1.00 pu. No turns ratios anywhere.
> **Caption:** The per-unit system collapses four voltage levels into a single normalised circuit. Transformer turns ratios vanish; leakage reactances become simple series impedances.
> **Alt text:** Two electrical circuit diagrams side by side. Left diagram shows multi-voltage actual circuit with four different voltage levels and widely varying currents. Right diagram shows the per-unit equivalent with normalized values and transformer symbols replaced by reactance elements.
> **Data source:** Author illustration.
> **Resolution:** 1400 × 700 px minimum
> **Color notes:** Zones colour-coded — 0.69 kV yellow; 66 kV green; 220 kV blue; 400 kV red. Per-unit circuit in black.

---

## 16.6 Worked Example: AC Quantities for a 500 MW Wind Farm

A 500 MW offshore wind farm operates at full rated output. The grid code requires a power factor of at least 0.95 lagging at the high-voltage connection point.

**Step 1: Apparent power and reactive power**

$$
|\mathbf{S}| = \frac{P}{\cos\phi} = \frac{500}{0.95} = 526.3 \text{ MVA}
$$

$$
Q = |\mathbf{S}| \sin\phi = 526.3 \times \sin(\arccos 0.95) = 526.3 \times 0.3122 = 164.3 \text{ MVAR}
$$

The farm absorbs 164.3 MVAR from the grid (lagging: transformer and cable inductances consume reactive power). The STATCOM and shunt reactor must balance this within the grid code range.

**Step 2: Line current at 220 kV**

$$
I_L = \frac{|\mathbf{S}|}{\sqrt{3} \cdot V_L} = \frac{526.3 \times 10^6}{\sqrt{3} \times 220 \times 10^3} = \frac{526.3 \times 10^6}{381{,}051} = 1{,}381 \text{ A}
$$

The two export cables share this load: approximately 691 A each — consistent with the ampacity design from Chapter 14.

**Step 3: Per-unit base quantities on the 220 kV zone**

Choose $S_{\text{base}} = 500$ MVA, $V_{\text{base}} = 220$ kV:

$$
I_{\text{base}} = \frac{500 \times 10^6}{\sqrt{3} \times 220 \times 10^3} = 1{,}312 \text{ A}, \qquad Z_{\text{base}} = \frac{(220 \times 10^3)^2}{500 \times 10^6} = 96.8 \text{ Ω}
$$

**Step 4: Per-unit summary**

| Quantity | Actual | Per unit |
|---|---|---|
| Active power $P$ | 500 MW | 1.000 pu |
| Apparent power $\|S\|$ | 526.3 MVA | 1.053 pu |
| Reactive power $Q$ | 164.3 MVAR | 0.329 pu |
| Line current $I_L$ | 1,381 A | 1.053 pu |
| Base impedance $Z_{\text{base}}$ | — | 96.8 Ω |

The current is 1.053 pu — slightly above base current because the reactive component adds in quadrature to the active component. Equipment must be rated for this continuous overload.

**Step 5: Export cable impedance in per unit**

A 220 kV XLPE export cable has series impedance $r \approx 0.021$ Ω/km, $x \approx 0.095$ Ω/km. For the 45 km route:

$$
Z_{\text{cable}} = (0.021 + j\,0.095) \times 45 = 0.945 + j\,4.275 \text{ Ω}
$$

On the 500 MVA, 220 kV base ($Z_{\text{base}} = 96.8$ Ω):

$$
Z_{\text{cable,pu}} = \frac{0.945 + j\,4.275}{96.8} = 0.010 + j\,0.044 \text{ pu}
$$

The cable has 1.0% resistance and 4.4% reactance. Active power loss at full load:

$$
P_{\text{loss}} = 3 I_L^2 R = 3 \times 1{,}381^2 \times 0.945 \approx 5.4 \text{ MW} = 1.1\% \text{ of farm output}
$$

For comparison, the OSS main transformer (250 MVA rated, $X_T = 0.14$ pu on its own rating) has on the 500 MVA system base:

$$
X_{T,\text{pu}} = 0.14 \times \frac{500}{250} = 0.28 \text{ pu}
$$

The transformer's 28% reactance dwarfs the cable's 4.4%. In any fault or load flow study, the transformer impedance governs the voltage drop and fault current magnitude — a point that will dominate the short-circuit analysis in Chapter 19. The full network load flow, using all of these pu impedances from turbine terminals to the PSE grid, is the subject of Chapter 18.

---

## Key Takeaways

- **The 220 kV nameplate is an RMS value; the physical peak voltage is 311 kV.** Insulation is sized for the peak. The RMS voltage delivers the same average power to a resistive load as a DC supply of the same magnitude — which is why it is used for rating all electrical equipment.

- **Steinmetz's 1893 phasor method — complex power $\mathbf{S} = P + jQ$ — reduced AC circuit analysis from differential equations to algebra.** Active power $P$ does work; reactive power $Q$ oscillates in electromagnetic fields and must be balanced at every network node. Understanding the phasor and the power triangle is the minimum requirement for reading any substation single-line diagram.

- **Three-phase AC, demonstrated by Dolivo-Dobrovolsky over 175 km at 75% efficiency in August 1891, delivers constant non-pulsating power, uses 50% fewer conductors than the single-phase equivalent, and produces smooth torque in rotating machines.** These properties made it the universal standard for generation, transmission, and distribution.

- **Equipment is rated in MVA (apparent power), not MW.** A transformer delivering 500 MW at pf = 0.95 carries 526 MVA of current. At pf = 0.80, delivering the same 500 MW requires 625 MVA — 19% more cable and transformer capacity. Managing power factor determines the cost of the electrical infrastructure.

- **The per-unit system normalises all quantities to a common base, eliminating transformer turns ratios from circuit calculations.** Choosing $S_{\text{base}} = 500$ MVA and $V_{\text{base}}$ equal to the nominal voltage of each zone gives a single pu network spanning 0.69 kV to 400 kV — the language in which every power system study in this book is written.

## For Further Reading

- **Steinmetz, C.P. (1900).** *Theory and Calculation of Alternating Current Phenomena.* 3rd ed. New York: Electrical World and Engineer. Now freely available at archive.org. Reading even the first three chapters — on complex quantities, phasors, and power — gives a direct sense of the clarity Steinmetz brought to a field operating in mathematical confusion. The style is dated; the insight is not.

- **Glover, J.D., Sarma, M.S., and Overbye, T.J. (2017).** *Power Systems Analysis and Design.* 6th ed. Cengage Learning. Chapters 2 (power in AC circuits), 4 (transformers), and 5 (per-unit systems) cover the material of this chapter at undergraduate textbook depth, with complete worked examples and problem sets. The per-unit treatment — including base changes and the proof that transformer turns ratios cancel — is the most thorough in any introductory text. ISBN: 978-1-305-63213-4.

- **ENTSO-E (2016).** *Commission Regulation (EU) 2016/631 — Network Code on Requirements for Generators (NC RfG).* Official Journal of the European Union, L 112/1. Article 14 (synchronous power-generating modules) and Article 17 (Type D requirements) define the reactive power capability obligations — the engineering requirement that makes the power triangle an economic quantity, not just a mathematical one. Freely available at eur-lex.europa.eu.

---

*The control room of the offshore substation was smaller than Kaan had imagined — ten metres long and five wide, with a continuous bench of screens along one wall and a single operator console in the centre. The screens showed the current state of the 66 kV and 220 kV systems in mimic-diagram format: bus voltages, breaker positions, transformer load percentages, and the real-time active and reactive power at the 220 kV connection point. Every number was live, updating every few seconds as the wind shifted and the turbines responded.*

*"Two hundred and twenty point three kilovolts," Anders said, pointing to the HV busbar reading. "RMS. The measurement unit in the switchgear room is sampling the sinusoid tens of thousands of times per second. Squaring the samples, averaging, taking the root. That is what you are reading."*

*Kaan looked at the laminated A0 single-line diagram printed and mounted on the opposite wall — a schematic of the entire 66 kV and 220 kV system. Every circuit breaker was numbered. Every transformer had its rating and vector group labelled. Every cable run had its impedance annotated. He could not yet read it completely — he understood the phasors, the power triangle, the per-unit notation, but the individual components on the diagram, the specific symbols and switching sequences and protection zones, were still unfamiliar.*

*The substation was the heart of the electrical system — the point where the energy from thirty-four machines, spread across ten square kilometres of Baltic sea, was collected, transformed, and sent to shore. He had spent three months watching the physical structure being built: steel in the seabed, cable on the seafloor, turbines assembled blade by blade in a September window. Now the construction was finished. The abstract quantities — the sinusoidal voltages, the phasors, the reactive power he was only beginning to understand — would flow through the components shown on that diagram.*

*"The physical equipment tomorrow," Anders said, picking up his jacket. "Transformers, switchgear, protection relays. What those symbols on the wall actually look like and what they do." He paused at the door. "Today you learned the language. Tomorrow we start reading what it says."*

*Kaan turned back to the diagram for a moment before following him out. The 220 kV and 66 kV buses. The breaker numbers. The transformer impedances in per unit. The reactive power compensation symbols. He could not read all of it yet. But it was beginning to make sense.*

---

## Notes

[1] Faraday's law: $\mathcal{E} = -d\Phi_B/dt$. For a rectangular coil of $N$ turns, area $A$, rotating at angular velocity $\omega$ in uniform field $B$: $\Phi_B = NBA\cos(\omega t)$, giving $\mathcal{E} = NBA\omega\sin(\omega t)$. Cross-reference: Chapter 4, Note [2] of this volume. For the full derivation: Chapman, S.J. (2012). *Electric Machinery Fundamentals.* 5th ed. McGraw-Hill, Section 2.2.

[2] Frequency standardisation history: AEG's early three-phase systems (from the 1891 Lauffen–Frankfurt demonstration onward) operated near 50 Hz; the 50 Hz standard became the European norm. Westinghouse's US systems operated at 60 Hz. For historical context: Hughes, T.P. (1983). *Networks of Power: Electrification in Western Society, 1880–1930.* Baltimore: Johns Hopkins University Press, Chapter 4. Also: Jonnes, J. (2003). *Empires of Light.* Random House, Chapters 10–14.

[3] IEC 60038:2009. "IEC Standard Voltages." International Electrotechnical Commission, Geneva. Table 1 (Series I, systems above 35 kV). Lightning impulse withstand voltage (LIWV) for 220 kV: 1,050 kV; for 66 kV: 325 kV. Switching impulse withstand voltage for 220 kV: 850 kV. Test procedures: IEC 60060-1:2010, "High-voltage test techniques — Part 1: General definitions and test requirements."

[4] RMS and power equivalence: For $v(t) = V_p\sin(\omega t)$, time-averaged power in resistance $R$ is $\langle p \rangle = V_p^2/(2R) = V_\text{rms}^2/R$. This is the standard proof. Source: Hayt, W.H., Kemmerly, J.E., and Durbin, S.M. (2018). *Engineering Circuit Analysis.* 9th ed. McGraw-Hill, Chapter 10.

[5] Steinmetz, C.P. (1893). "Complex Quantities and Their Use in Electrical Engineering." *Proceedings of the International Electrical Congress,* Chicago, July 1893. American Institute of Electrical Engineers, 33–74. For biography: Kline, R. (1992). *Steinmetz: Engineer and Socialist.* Baltimore: Johns Hopkins University Press. Kline confirms Steinmetz fled Breslau (now Wrocław) in 1888 to avoid arrest, arrived in the US via Zurich and Le Havre, and was working at Eickemeyer and Osterheld when he presented the 1893 paper.

[6] Steinmetz, C.P. (1897). *Theory and Calculation of Alternating Current Phenomena.* New York: Electrical World and Engineer. (3rd ed. 1900.) The use of $j$ for the 90° rotation operator — as opposed to $i$, reserved for instantaneous current — is established in this text. Now available at archive.org. For the influence on the field: Slepian, J. (1936). "Charles Proteus Steinmetz." *Electrical Engineering,* 55(3), 229–232.

[7] Complex power and reactive power management: Bergen, A.R. and Vittal, V. (2000). *Power Systems Analysis.* 2nd ed. Prentice-Hall, Chapter 2. For reactive power in offshore wind: Muljadi, E. et al. (2012). "Reactive Power Performance of a Wind Power Plant." *2012 IEEE Power and Energy Society General Meeting.* DOI: 10.1109/PESGM.2012.6344618.

[8] IEC 60050-131:2002. "International Electrotechnical Vocabulary — Part 131: Circuit theory." Clause 131-11-26 defines reactive power. IEC 60375:2003, "Conventions concerning electric and magnetic circuits," establishes the sign convention (inductive reactive power positive, lagging).

[9] ENTSO-E (2016). Commission Regulation (EU) 2016/631 — NC RfG. Article 17(c): Type D modules must maintain reactive power capability of ±0.225 pu at rated active power at the connection point. Polish implementation: URE, Grid Code IRiESP version 2.3 (2024), Section 5.4. The ±0.225 pu requirement corresponds to a power factor range of approximately 0.976 lagging to 0.976 leading at rated power, expanding to approximately 0.90 at partial output as the reactive capability envelope applies as a fixed MVAR range.

[10] Lauffen–Frankfurt demonstration: distance 175 km; transmission voltage approximately 15 kV (raised to ~25 kV for further tests); efficiency 75% measured on 24 August 1891 at the International Electrotechnical Exhibition, Frankfurt. Primary source: Riedler, A. and Zetzsche, C. (1891). "Elektrische Kraftübertragung von Lauffen nach Frankfurt." *Zeitschrift des Vereines Deutscher Ingenieure,* 35, 821–831. IEEE Milestone acknowledgement: ETHW. "Long Distance Electric Power Transmission Using Three-Phase Alternating Current, 1891." ethw.org (accessed March 2026).

[11] Dolivo-Dobrovolsky, Mikhail Osipovich (1862–1919). Born Gatchina, Russia. Studied at the Technische Hochschule Darmstadt. Joined AEG, Frankfurt, 1887. Filed patents for the squirrel-cage induction motor (1889) and three-phase transformer (1890). Source: Wißner, G. (2011). *Mikhail von Dolivo-Dobrovolsky: Ein Pionier der Drehstromtechnik.* Darmstadt: TU Darmstadt. Also: Linda Hall Library, "Mikhail Dolivo-Dobrovolsky — Scientist of the Day," lindahall.org (accessed March 2026).

[12] Charles Eugene Lancelot Brown (1863–1924). Technical director of Maschinenfabrik Oerlikon (MFO), Zurich, at the time of the 1891 demonstration. Co-founded Brown Boveri & Cie (BBC, later part of ABB) in 1891, the same year as the Frankfurt exhibition. Source: Brown Boveri Review (1941). "Zum 50. Jubiläum der Drehstromübertragung Lauffen–Frankfurt." BBC Nachrichten.

[13] Three-phase power constant in time: the proof that $p_a(t) + p_b(t) + p_c(t) = \tfrac{3}{2}V_pI_p\cos\phi$ (constant) follows from the identity $\sin^2\theta + \sin^2(\theta - 2\pi/3) + \sin^2(\theta - 4\pi/3) = 3/2$. For the conductor saving argument: Stevenson, W.D. (1994). *Elements of Power System Analysis.* 4th ed. McGraw-Hill, Section 2.1.

[14] IEC 60076-1:2011. "Power transformers — Part 1: General." IEC, Geneva. Vector group notation (YNd11, Dyn11, etc.) is defined in Clause 3.4. Offshore wind transformer vector group is typically YNd11 (star earthed on HV, delta on LV) to block zero-sequence fault currents from the array network.

[15] Per-unit system: standardised in the power engineering literature from the 1920s. Current reference: Glover, J.D., Sarma, M.S., and Overbye, T.J. (2017). *Power Systems Analysis and Design.* 6th ed. Cengage, Chapter 5. DOI: not applicable (textbook). ENTSO-E system studies typically use $S_\text{base} = 100$ MVA; project-level studies for offshore wind use the farm's rated MVA as base.

[16] Base change formula derivation: from $Z_\text{base} = V_\text{base}^2/S_\text{base}$, it follows that $Z_\text{pu,new}/Z_\text{pu,old} = (Z_\text{base,old}/Z_\text{base,new}) = (S_\text{base,new}/S_\text{base,old})(V_\text{base,old}/V_\text{base,new})^2$. Source: Bergen, A.R. and Vittal, V. (2000). *Power Systems Analysis.* 2nd ed. Prentice-Hall, Chapter 3.

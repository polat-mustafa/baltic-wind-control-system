# Chapter 19: Short-Circuit Analysis — Preparing for the Worst

*Kaan found her in the relay testing room at the south end of the upper module, a space the size of a generous walk-in wardrobe, lined on three sides with grey relay cabinets. The door was open and the smell of warm electronics hung in the air — capacitors, cooling resistors, something faintly like ozone. Sigrid Lund sat on a high stool at the central workbench with a secondary injection test set plugged into the front of an overcurrent relay panel and a calibration notebook open beside her. She was running a timing test. A small digital stopwatch on the bench counted upward. She pressed a button; the relay tripped; she wrote down the result without looking up.*

*"Ninety-three milliseconds. Should be a hundred and twelve."*

*She adjusted a setting dial, reset the test set, ran the timing again. Ninety-seven milliseconds. She wrote it down.*

*"Sigrid Lund." She extended a hand without breaking stride. "Norwegian. Protection relay specialist. I've been here six weeks. You're the control engineer."*

*"Kaan. Yes."*

*"Anders says you've been learning load flow." She looked toward the far wall, in the direction of Stefan Bauer's GIS hall. "Load flow tells you where the power goes in normal operation. My work begins when it goes somewhere wrong."*

*She gestured toward the relay cabinet. "Do you know what happens on that 66 kV busbar if a three-phase fault occurs and this relay doesn't trip within two hundred milliseconds?"*

*Kaan considered it. "The fault current keeps flowing?"*

*"The arc keeps burning. The copper vaporises. The pressure wave can destroy a switchgear compartment. Arc energy scales with time — every additional hundred milliseconds beyond a well-timed clearing represents a disproportionate increase in damage. But the deeper problem is not the arc itself. The deeper problem is what happens to the rest of the network if the faulted bus stays connected." She set down her pen. "In 1965, a protective relay on a single 230 kilovolt transmission line out of Sir Adam Beck Generating Station No. 2 in Ontario tripped because its settings had not been updated as system loads grew since 1963. That single trip cascaded across the northeast United States and Canada within twelve minutes. Thirty million people lost power. The relay was not broken. It was not even wrong when it was installed. Nobody updated it as the network grew."*

*She paused.*

*"The relay in this cabinet I will recalibrate and document today. The settings will be recalculated if the network changes. That is how we prevent this building from becoming a cautionary tale." She gestured to the stool beside her. "Sit. I will show you the mathematics."*

---

## 19.1 The Equivalent Voltage Source: IEC 60909-0

A short circuit is an unintended conductive path between conductors at different potentials — or between a conductor and earth — whose impedance is low enough to allow very high current to flow. In a correctly designed power system, all current-carrying components are rated to withstand normal operating current with comfortable margin. During a fault, the current can be many times higher. The energy released in the fault arc is proportional to $I^2 \cdot R_{arc} \cdot t$ — the square of the fault current, multiplied by the arc resistance and the duration. Because fault current is squared, a fault at ten times normal releases a hundred times more energy per unit time than normal operation. Speed of detection and interruption is the engineer's most important protective tool.

The international standard for calculating fault currents in three-phase AC systems is **IEC 60909-0:2016**, second edition. [1] Its method is called the **equivalent voltage source method** — after the Thevenin theorem it applies: at any two terminals of a linear network, the behaviour can be represented by a single voltage source in series with a single equivalent impedance.

The approach replaces the entire network — every generator, every transformer, every cable — with a single voltage source placed directly at the fault location. That source voltage is not the prefault voltage at the bus; it is a standardised equivalent voltage chosen to produce conservative fault current estimates:

$$
c \cdot \frac{V_n}{\sqrt{3}}
$$

where:
- $c$ = voltage factor (dimensionless)
- $V_n$ = nominal line-to-line voltage at the fault location [kV]
- $V_n / \sqrt{3}$ = nominal phase-to-earth voltage [kV]

The **voltage factor** $c$ accounts for pre-fault over-voltage, motor action, and other effects that cause the actual fault current to exceed a naïve nominal-voltage calculation. IEC 60909-0:2016, Table 1 specifies $c_{max} = 1.10$ for all systems with $V_n > 35\,\text{kV}$ when calculating maximum fault current for equipment rating. For minimum fault current (protection sensitivity calculations), $c_{min} = 1.00$. [1]

The **Thevenin impedance** $Z_k$ at the fault location is the impedance seen by the fault looking back into the network, with all independent voltage sources replaced by their internal impedances. For a three-phase fault at any bus, $Z_k$ is assembled by adding in series every impedance between the infinite grid reference and the fault point:

$$
Z_k = \sum_i Z_i = Z_{grid} + Z_{T,1} + Z_{cable} + Z_{T,2} + \cdots
$$

where each $Z_i$ is the impedance of a network element referred to the fault voltage base [pu or Ω].

With $Z_k$ assembled, the **initial symmetrical short-circuit current** is:

$$
I''_k = \frac{c \cdot V_n}{\sqrt{3} \cdot |Z_k|}
$$

where:
- $I''_k$ = initial symmetrical short-circuit current, r.m.s. [kA]
- $c$ = voltage factor (1.10 for maximum fault) [dimensionless]
- $V_n$ = nominal voltage at fault location [kV]
- $|Z_k|$ = magnitude of the Thevenin impedance at the fault point [Ω or pu]

The double-prime notation ($''$) denotes the **initial value**, computed without allowing for current decay from rotating machine flux — the subtransient value applicable to the first few cycles after fault inception. This is the value used for equipment rating.

Two assumptions distinguish IEC 60909-0 from the load flow of Chapter 18. First, a **flat voltage profile**: all bus voltages are assumed to be $V_n$ before the fault, regardless of what the load flow solution shows. The 1.024 pu Ferranti rise at Bus 3 is discarded in favour of the nominal value. Second, **prefault currents are neglected**: no current is assumed to be flowing in any branch before the fault. These simplifications reduce the impedance network to a series of linear elements and make the problem tractable by spreadsheet — the most common calculation tool in practice.

The method is deliberately conservative. The calculated $I''_k$ is the maximum possible initial fault current for the given network configuration. The actual fault current at the instant of occurrence will always be less than or equal to the IEC 60909-0 result.

<!-- IMAGE: fig-19-01 -->
> **Figure 19.1** — Thevenin equivalent network for fault at the OSS 220 kV bus
> **Type:** schematic diagram (two panels)
> **Content:** Left panel: five-bus network from Fig. 18.1 with the fault location at Bus 3 (OSS 220 kV) marked with a red short-circuit symbol. Right panel: Thevenin reduction — single voltage source (c·V_n/√3 = 1.10 × 127 kV = 139.7 kV phase-to-earth) in series with Thevenin impedance Z_k labelled with component values: Z_grid = 0.010 + j0.099 pu; Z_T,onshore = 0.006 + j0.120 pu; Z_cable = 0.010 + j0.044 pu; total Z_k = 0.026 + j0.263 pu (|Z_k| = 0.264 pu). Fault current I"k shown flowing into the fault terminal. WTG aggregate shown as a separate controlled current source I_WTG ≤ 1.2·I_rated in parallel. Arrow indicates superposition of the two contributions.
> **Caption:** Reduction of the five-bus network to its Thevenin equivalent for a three-phase fault at the OSS 220 kV bus. The entire PSE grid, onshore transformer, and export cable collapse into a single source (c·V_n/√3 = 139.7 kV) in series with the series impedance chain. The WTG aggregate is modelled separately as a controlled current source bounded by converter rating — a fundamentally different representation from a synchronous generator.
> **Alt text:** Network diagram showing five-bus network on the left reduced to a Thevenin equivalent circuit on the right for short-circuit calculation.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Fault location in red; Thevenin source in blue; WTG controlled source in green.

---

## 19.2 Symmetrical and Asymmetrical Faults

The most studied fault type is the **three-phase bolted fault** (3Ph) — all three conductors shorted together at the same location through zero impedance. It produces the highest current magnitude of any fault type and is therefore the worst case for equipment rating. The formula in Section 19.1 applies directly, using only the positive-sequence Thevenin impedance.

But a fault applied at any point on the voltage wave introduces a **DC component** in the fault current. At the instant of fault inception, the total current (AC forced response plus DC natural response) must equal the pre-fault current, which is zero. If the fault occurs at the instant the voltage reaches its peak, the AC forced response already starts at $\sqrt{2} I''_k$ and the DC component is zero — the current begins symmetrically. If the fault occurs at the voltage zero crossing, the AC forced response starts at zero but the inductive network prevents an instantaneous current change: the DC component jumps to $\sqrt{2} I''_k$ to maintain zero total current, then decays exponentially with time constant $\tau = X / (\omega R)$.

The worst case — maximum asymmetry — is this zero-crossing inception. The **asymmetry factor** $\kappa$ captures the ratio of peak asymmetrical current to the symmetrical r.m.s. value as a function of the network X/R ratio at the fault point:

$$
\kappa = 1.02 + 0.98 \cdot e^{-3R/X}
$$

where:
- $\kappa$ = asymmetry factor (dimensionless, range 1.02 to 2.0)
- $R$ = resistance component of Thevenin impedance at fault point [pu or Ω]
- $X$ = reactance component of Thevenin impedance at fault point [pu or Ω]

For a purely inductive network ($X/R \to \infty$), $\kappa$ approaches 2.0 — the maximum theoretical value of $1 + e^0 \times 0.98 + 1.02 = 2.0$. For a purely resistive network ($X/R = 0$), $\kappa = 1.02$. Offshore substations with export cables and transformers typically give $X/R$ ratios of 8–15, producing $\kappa$ in the range 1.73–1.85.

The **peak short-circuit current** — the maximum instantaneous current, reached within the first half-cycle — is:

$$
\hat{i}_p = \kappa \cdot \sqrt{2} \cdot I''_k
$$

where:
- $\hat{i}_p$ = peak short-circuit current [kA]
- $\kappa$ = asymmetry factor (dimensionless)
- $\sqrt{2}$ = conversion from r.m.s. to peak for the AC component
- $I''_k$ = initial symmetrical short-circuit current (r.m.s.) [kA]

This peak current determines the **mechanical ratings** of busbars, cable terminations, and transformer windings. The electromagnetic force between two parallel conductors scales with the square of the instantaneous current. At $\hat{i}_p = 1.75 \times \sqrt{2} \times 5\,kA = 12.4\,kA$, the forces are over 1,000 times those at rated current. GIS compartments must withstand the associated internal pressure rise without deformation.

The mathematical framework for analysing **asymmetrical faults** (those involving fewer than three phases) was developed by Charles LeGeyt Fortescue at Westinghouse Electric. Fortescue was born in 1876 at York Factory, Manitoba, Canada — a Hudson's Bay Company trading post on Hudson Bay where his father served as chief factor. He studied at Queen's University in Kingston, Ontario, graduating in 1898, then joined Westinghouse in East Pittsburgh, Pennsylvania, where he remained for his entire career. [3]

On 28 June 1918, Fortescue presented a 48-page paper to the 34th Annual Convention of the AIEE in Atlantic City, New Jersey. The title was "Method of Symmetrical Co-Ordinates Applied to the Solution of Polyphase Networks." Its central claim was that any unbalanced three-phase system — voltages, currents, or impedances — can be decomposed into three sets of balanced phasors: a **positive-sequence** set (balanced, normal phase rotation), a **negative-sequence** set (balanced, reversed phase rotation), and a **zero-sequence** set (all three phasors identical and in phase). [3] At 48 pages it was among the longest papers ever presented to the AIEE. It was received politely and not immediately understood.

The practical consequence: each fault type maps to a specific connection of three independent sequence networks. For a **three-phase fault**, only the positive-sequence network is active. For the most common fault type — the **single-line-to-ground (SLG) fault**, responsible for approximately 80% of all power system faults — all three sequence networks connect in series. The initial symmetrical current in the faulted phase is:

$$
I''_{k,SLG} = \frac{\sqrt{3} \cdot c \cdot V_n}{\left| 2Z_1 + Z_0 \right|}
$$

where:
- $I''_{k,SLG}$ = initial symmetrical current for a single-line-to-ground fault [kA]
- $Z_1$ = positive-sequence Thevenin impedance at the fault point [pu]
- $Z_0$ = zero-sequence Thevenin impedance at the fault point [pu]
- (For passive networks containing only transformers and cables: $Z_2 = Z_1$)

Whether the SLG fault produces higher or lower current than the three-phase fault depends on $Z_0/Z_1$. When $Z_0 < Z_1$ — which occurs at solidly grounded transformer neutrals — the single-phase fault exceeds the three-phase fault. This is non-intuitive: a fault involving one phase can produce more current than a fault on all three. The transformer neutral grounding arrangement is therefore a protection design variable, not merely an earthing convenience. For offshore wind substations, where the 220 kV transformer neutrals are solidly earthed but the 66 kV side is impedance-earthed (to limit single-phase fault current in the array cables), the zero-sequence impedance seen from the 220 kV bus is relatively high, and the SLG fault current remains below the three-phase value.

<!-- IMAGE: fig-19-02 -->
> **Figure 19.2** — Sequence network connections for three-phase and single-line-to-ground faults
> **Type:** circuit diagram (two side-by-side panels)
> **Content:** Left panel (3Ph fault): positive-sequence network only — voltage source c·V_n/√3 at top; Z_1 in series below; fault terminals at bottom connected by short circuit. Label: I"k = c·V_n/(√3·Z_1). Right panel (SLG fault): three sequence networks stacked vertically and connected in series — positive-sequence (source + Z_1) on top; negative-sequence (Z_2 = Z_1, source absent) in middle; zero-sequence (Z_0, source absent) at bottom. Series current I₁ flows through all three; faulted phase current = 3I₁. Z_0 value labelled as larger than Z_1 for the case of high-impedance earthed 66 kV side (Z_0 ≈ 4Z_1), so I"k,SLG < I"k,3Ph. Caption note: if Z_0 < Z_1 (solidly grounded neutral), SLG > 3Ph.
> **Caption:** Sequence network connections for three-phase (left) and single-line-to-ground (right) faults, following Fortescue's method of symmetrical components. The three-phase fault activates only the positive-sequence network; the SLG fault requires all three sequences in series. Whether the SLG current exceeds the three-phase current depends on Z_0/Z_1 — a design choice made when selecting transformer neutral earthing.
> **Alt text:** Two circuit diagrams showing single-sequence network for three-phase fault and three-sequence series connection for single-line-to-ground fault.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Positive-sequence in blue; negative-sequence in orange; zero-sequence in grey.

Fortescue's method was not widely adopted until the 1930s, when textbooks by C.F. Wagner and R.D. Evans systematised the calculations for practising engineers. Today, every protection relay for three-phase systems performs symmetrical component decomposition within one cycle of fault inception. The 48 pages that Fortescue presented in Atlantic City are executed millions of times per second in power systems worldwide.

---

## 19.3 Wind Turbines During Faults: The Converter-Limited Source

IEC 60909-0 was developed for power systems dominated by synchronous generators — machines with rotating mass directly coupled to the grid. When terminal voltage collapses during a fault, a synchronous generator's magnetic flux cannot change instantaneously. A large initial fault current flows, limited only by the **subtransient reactance** $X''_d$ (typically 0.10–0.25 pu of rated). For a 500 MVA generator with $X''_d = 0.20$ pu, the initial fault current is five times rated. Large interconnected grids with dozens of generators can produce fault currents of 40–80 kA at major substation busbars.

The **Type 4 full-power converter** wind turbine — used in modern offshore machines including the Vestas V236-15.0 MW — behaves fundamentally differently. The generator (a permanent-magnet synchronous machine or wound-rotor synchronous machine) is decoupled from the grid by a back-to-back voltage-source converter (VSC). The grid-side converter actively regulates its output current within every PWM switching cycle (typically 2–4 kHz). It does not "see" the grid fault as a voltage collapse that drives natural current; it sees it as a change in commanded setpoint. [4]

When a fault collapses the terminal voltage, the grid-side converter does not produce a large initial surge. It operates in a current-limited mode bounded by the power electronics' rating. The maximum fault current contribution from a Type 4 WTG is:

$$
I_{WTG,fault} \leq I_{max} = 1.0\text{–}1.2 \cdot I_{rated}
$$

where:
- $I_{WTG,fault}$ = actual fault current contribution from the WTG aggregate [kA]
- $I_{max}$ = converter current limit (typically 1.0–1.2 pu, confirmed with manufacturer) [kA]
- $I_{rated}$ = rated current of the WTG aggregate at the connection voltage [kA]

Under PSE IRiESP and ENTSO-E NC RfG Type D, the converter must shift to **reactive current priority** during voltage dips: reactive current injection is maximised to support grid voltage, and active current is reduced proportionally. This means the fault current from the WTG side is a controlled, bounded value — quite unlike the 5–10× rated surge from an equivalent synchronous generator bank.

The engineering consequence is significant. For a 500 MW farm at 66 kV: $I_{rated,66} = 500\,\text{MW} / (\sqrt{3} \times 66\,\text{kV}) = 4.374\,\text{kA}$. Maximum WTG fault contribution: $1.2 \times 4.374 = 5.25\,\text{kA}$. Compare with what the same power from synchronous generators would produce: subtransient reactance of 0.20 pu would allow $1/0.20 = 5$ pu of rated current — approximately $5 \times 4.374 = 21.9\,\text{kA}$. The converter limits the WTG contribution to roughly one-quarter of what a conventional generator bank would produce at the same rating.

For offshore wind substations, this means the **grid connection dominates fault current**. A fault on the OSS 220 kV bus is fed primarily from the PSE 400 kV network through the onshore transformer and export cable. The WTG contribution, arriving through the OSS main transformer, is a supplement — significant at the 66 kV bus (where the WTGs connect directly), smaller at the 220 kV bus (where their current is attenuated by the transformer impedance).

The WTG fault current also behaves differently over time. A synchronous generator's fault current decays naturally from a high subtransient value toward a lower steady-state, following the decay of rotor flux. A Type 4 converter's fault current is constant at its controlled limit until either the fault clears or the converter trips on internal protection. This means protection relays designed for conventional generators — relying on the time-varying magnitude to infer fault type and distance — require adaptation for converter-dominated networks. This is an active area of protection engineering research and an implicit challenge to every relay setting in this building.

---

## 19.4 Equipment Rating Verification

Every piece of electrical equipment in the offshore substation carries a nameplate specifying its short-circuit ratings. These are not conservative guidelines; they are physical limits. Below these limits, equipment survives a fault; above them, it may fail catastrophically. The protection engineer verifies by calculation that the fault current at every location is less than the equipment rating at that location, with margin.

IEC 62271-100:2021, the standard for high-voltage AC circuit breakers, specifies three independent short-circuit ratings that must each be satisfied. [5]

**Rated short-time withstand current** ($I_{cw}$): the r.m.s. current the equipment can carry for a specified duration — typically 1 second or 3 seconds — without thermal damage. This is the heat-energy rating: the $I^2 t$ product that conductors, joints, and insulation can absorb before degradation. Exceeding $I_{cw}$ for the rated duration melts insulation, anneals copper, or deforms contact surfaces.

**Rated peak withstand current** ($\hat{i}_{pk}$): the maximum instantaneous current the equipment can withstand without mechanical damage. The electromagnetic force between two parallel conductors carrying current $i$ scales with $i^2$. At peak fault current — which may be $\kappa\sqrt{2}$ times the r.m.s. symmetrical value — the forces between busbar supports, cable cleats, and transformer winding turns can cause deformation or fracture if below the peak rating. By convention, $\hat{i}_{pk} = 2.5 \times I_{cw}$ for standard 50 Hz equipment, reflecting the maximum $\kappa\sqrt{2}$ for networks with $X/R \leq 50$.

**Rated short-circuit breaking current** ($I_{sc}$): the r.m.s. current the circuit breaker can interrupt while carrying the DC-offset asymmetric fault current at contact separation. Interrupting fault current is far more demanding than carrying it: the arc between separating contacts must be extinguished against the full system voltage within microseconds of a natural current zero crossing, and the asymmetric DC component delays those zero crossings. SF6 circuit breakers in GIS achieve interruption in 2–3 cycles (40–60 ms at 50 Hz) by cooling and elongating the arc through the pressurised gas flow Stefan Bauer described in Chapter 17.

Cables also carry a short-circuit current limit. During the brief fault duration before a breaker clears (typically 50–500 ms), the conductor temperature rises approximately adiabatically — too fast for heat to conduct through the insulation into surrounding soil or sea. The maximum fault current the cable can carry without exceeding the conductor's short-time temperature limit follows:

$$
I_{sc,cable} = \frac{k \cdot S}{\sqrt{t}}
$$

where:
- $I_{sc,cable}$ = cable short-circuit current rating [A]
- $k$ = thermal constant for the conductor and insulation type [A·s$^{1/2}$/mm²]; for XLPE copper conductors, $k \approx 143$
- $S$ = conductor cross-sectional area [mm²]
- $t$ = fault duration [s]

For a 630 mm² copper array cable with a 200 ms fault clearing time: $I_{sc} = 143 \times 630 / \sqrt{0.20} = 90,090 / 0.447 = 201\,\text{kA}$. The cable can carry 201 kA for 200 ms — far more than any credible fault current in a 66 kV offshore wind farm network. Array cables are dimensioned for normal operating current and $I^2 R$ losses; fault withstand is not the limiting constraint. Export cables at 220 kV have even larger conductors and commensurately higher ratings.

<!-- IMAGE: fig-19-03 -->
> **Figure 19.3** — Equipment short-circuit rating verification summary
> **Type:** horizontal bar chart with dual comparison
> **Content:** Three rows: (1) OSS 220 kV GIS switchgear, (2) OSS 66 kV GIS switchgear, (3) Export cable 220 kV 630 mm². For each row, two bars side by side: calculated peak fault current (from worked example: 11.70 kA at 220 kV, 31.55 kA at 66 kV, and cable rated short-circuit current 201 kA shown as context) versus equipment rated peak withstand current (100 kA for 220 kV GIS, 125 kA for 66 kV GIS, 201 kA for cable). Margin ratios annotated: 8.5× at 220 kV, 4.0× at 66 kV, >>1 for cable. Horizontal dashed red lines at rated values. Note: "All calculated values below equipment rating — ratings determined by network interconnection standard, not this farm alone."
> **Caption:** Equipment short-circuit rating verification for the 500 MW offshore substation. Calculated peak fault currents (orange) compared against equipment rated peak withstand currents (blue). The 66 kV bus has the tighter margin because WTGs contribute directly there; the 220 kV bus is dominated by the PSE grid contribution attenuated by the export cable impedance.
> **Alt text:** Horizontal bar chart comparing calculated fault currents with rated equipment withstand currents at three OSS locations, showing margin ratios.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Calculated values in orange; equipment ratings in blue; margin region hatched grey.

---

## 19.5 Protection Coordination — The First Principle

Equipment rating verification answers one question: does a specific component survive a fault? Protection coordination answers the complementary question: which breaker should open, and how quickly?

The guiding principle is **selectivity**. Only the minimum section of network necessary to isolate the fault should be de-energised. A fault on a 66 kV feeder string should trip the feeder string circuit breaker — not the 220 kV export connection, which would remove the entire farm from the grid. A fault on a single turbine's step-up transformer should trip that transformer's breaker, not the feeder collector. Selectivity is achieved by grading relay operating times: the relay closest to the fault operates first; upstream relays wait, ready to act only if the downstream relay fails.

The fundamental instrument is the **inverse definite minimum time (IDMT) overcurrent relay**. Its operating time decreases as fault current increases, following the characteristic:

$$
t_{op} = \frac{TMS \cdot k}{\left(I / I_{set}\right)^{\alpha} - 1}
$$

where:
- $t_{op}$ = relay operating time [s]
- $TMS$ = time multiplier setting (dimensionless relay dial)
- $I$ = fault current seen by the relay [A]
- $I_{set}$ = relay pickup current threshold [A]
- $k, \alpha$ = curve-shape constants; for IEC normal-inverse: $k = 0.14, \alpha = 0.02$; very inverse: $k = 13.5, \alpha = 1$; extremely inverse: $k = 80, \alpha = 2$

A higher fault current (nearer the fault) produces a shorter operating time. A lower fault current (farther from the fault, attenuated through more impedance) produces a longer time — allowing downstream relays, which see higher current, to act first. The time difference between adjacent relay levels is the **coordination interval**: typically 200–400 ms, sufficient for a breaker to open and reset before the upstream relay's timer expires.

This is not the full treatment — Chapter 26 examines protection coordination across every protection zone of the offshore substation, from the turbine converter to the PSE interconnection. What matters here is the philosophical consequence: every relay setting is a calculation, and every calculation has a date.

The Northeast Blackout of 1965 was precisely a failure of dated settings. The relay at Sir Adam Beck No. 2 was not miscalculated; its threshold was correct for the 1963 network. By November 1965, load growth meant the reactive power flow on the line reached the relay's threshold during normal, healthy operation. The relay tripped a healthy line. The other four 230 kV lines from that station picked up the load; each one then exceeded its own relay threshold; each one tripped in sequence. The cascade completed in twelve minutes. [6] If the setting had been updated annually as loads grew, it would not have tripped. The update would have taken an engineer perhaps two hours.

Sigrid's notebook — columns of time multiplier settings, pickup currents, and calculated operating times — was that update, performed before first energisation rather than after a cascade. Every number in it had a corresponding calculation. The calculation had her signature and a date.

---

## 19.X Worked Example: Three-Phase Fault at the OSS 220 kV Bus

**Network data — 500 MVA, 220 kV base (consistent with Chapter 18)**

$Z_{base,220} = 220^2 / 500 = 96.8\,\Omega$; $I_{base,220} = 500 / (\sqrt{3} \times 220) = 1.312\,\text{kA}$

**Step 1: Assemble the Thevenin impedance at the OSS 220 kV bus (Bus 3)**

The fault is fed from the PSE network side through Bus 1 → Bus 2 → Bus 3:

| Component | Basis | R [pu] | X [pu] |
|-----------|-------|--------|--------|
| PSE grid ($S_{cc} = 5{,}000\,\text{MVA}$, $X/R = 10$) | $Z_{grid} = S_{base}/S_{cc}$ | 0.0099 | 0.0990 |
| Onshore transformer ($500\,\text{MVA}$, $v_k = 12\%$, $X/R = 20$) | Referred to 220 kV base | 0.0060 | 0.1196 |
| Export cable (45 km, from Ch 18) | Per-unit, 500 MVA base | 0.0100 | 0.0440 |
| **Total $Z_k$** | **Series sum** | **0.0259** | **0.2626** |

$$
|Z_k| = \sqrt{0.0259^2 + 0.2626^2} = \sqrt{0.000671 + 0.068959} = 0.2639 \text{ pu}
$$

**Step 2: Initial symmetrical fault current from the PSE side**

$$
I''_{k,PSE} = \frac{c \cdot 1.0}{\sqrt{3} \cdot |Z_k|} = \frac{1.10}{1.732 \times 0.2639} = \frac{1.10}{0.4571} = 2.406 \text{ pu} = 2.406 \times 1.312 = 3.156\,\text{kA}
$$

(The per-unit calculation uses $c \cdot V_n/V_n$ — the nominal voltage cancels with the base voltage, leaving $c / (\sqrt{3} \cdot |Z_k|_{pu})$.)

**Step 3: WTG contribution at the 220 kV bus**

The WTG aggregate (500 MW at 66 kV) is converter-current-limited to $1.2 \times I_{rated,66}$:
$I_{rated,66} = 500 / (\sqrt{3} \times 66) = 4.374\,\text{kA}$; maximum WTG output: $1.2 \times 4.374 = 5.249\,\text{kA}$ at 66 kV.

Reflected through the OSS transformer turns ratio (66/220): $5.249 \times (66/220) = 1.575\,\text{kA}$ at 220 kV.

**Step 4: Total initial fault current**

By superposition (conservative algebraic addition per IEC 60909-0 for converter-based sources):

$$
I''_k = I''_{k,PSE} + I''_{k,WTG} = 3.156 + 1.575 = 4.731\,\text{kA at Bus 3 (220 kV)}
$$

**Step 5: Peak asymmetrical current**

$X/R = 0.2626 / 0.0259 = 10.14$

$$
\kappa = 1.02 + 0.98 \cdot e^{-3 \times 0.0259/0.2626} = 1.02 + 0.98 \cdot e^{-0.296} = 1.02 + 0.98 \times 0.744 = 1.749
$$

$$
\hat{i}_p = 1.749 \times \sqrt{2} \times 4.731 = 1.749 \times 1.414 \times 4.731 = 11.70\,\text{kA peak}
$$

**Step 6: Equipment check at the 220 kV bus**

| Rating parameter | GIS rated value | Calculated value | Margin |
|-----------------|----------------|-----------------|--------|
| Short-time withstand $I_{cw}$ (1 s) | 40 kA r.m.s. | 4.73 kA | 8.5× |
| Peak withstand $\hat{i}_{pk}$ | 100 kA peak | 11.70 kA | 8.5× |
| Breaking capacity $I_{sc}$ | 40 kA r.m.s. | 4.73 kA | 8.5× |

The 220 kV GIS has comfortable margins — all three calculated values are less than 25% of the equipment ratings. The margins are deliberately large: the GIS was selected from standard offshore substation designs rated for higher interconnection levels; this farm could be connected to a stronger grid without requiring switchgear replacement.

**Extension: fault at the 66 kV bus (Bus 4)**

The 66 kV bus has higher fault current because the WTG aggregate contributes there directly. $I_{base,66} = 500 / (\sqrt{3} \times 66) = 4.374\,\text{kA}$.

Add the OSS main transformer impedance ($Z_{T,OSS} = 0.0060 + j0.1196$ pu on 500 MVA base, referred to 66 kV):

$Z_{k,66} = Z_{k,220} + Z_{T,OSS} = (0.0259 + j0.2626) + (0.0060 + j0.1196) = 0.0319 + j0.3822$ pu; $|Z_{k,66}| = 0.3835$ pu.

$$
I''_{k,PSE \to 66kV} = \frac{1.10}{\sqrt{3} \times 0.3835} = \frac{1.10}{0.6641} = 1.657 \text{ pu} = 1.657 \times 4.374 = 7.244\,\text{kA}
$$

WTG contribution at 66 kV (direct, no transformer): $1.2 \times 4.374 = 5.249\,\text{kA}$

Total: $I''_{k,66} = 7.244 + 5.249 = 12.493\,\text{kA}$

Peak ($X/R = 0.3822/0.0319 = 11.98$; $\kappa = 1.02 + 0.98 \cdot e^{-3/11.98} = 1.785$):

$$
\hat{i}_{p,66} = 1.785 \times \sqrt{2} \times 12.493 = 31.55\,\text{kA peak}
$$

The 66 kV bus has 2.6 times the fault current of the 220 kV bus, and the WTG contribution is proportionally larger (42% vs 33%). Both remain well within the 66 kV GIS rating of 50 kA breaking / 125 kA peak — but the difference between the two buses illustrates a principle: the closer the fault is to the WTG aggregate, the more significant the converter contribution becomes.

<!-- IMAGE: fig-19-04 -->
> **Figure 19.4** — Fault current contribution breakdown at the 220 kV and 66 kV buses
> **Type:** stacked horizontal bar chart
> **Content:** Two stacked bars. Bar 1 (220 kV bus): PSE contribution 3.156 kA (blue segment), WTG contribution 1.575 kA (green segment); total 4.731 kA; WTG % label "33%". Bar 2 (66 kV bus): PSE contribution 7.244 kA (blue), WTG contribution 5.249 kA (green); total 12.493 kA; WTG % label "42%". Vertical dashed red lines at equipment breaking ratings (40 kA for 220 kV, 50 kA for 66 kV). Both totals far to the left of their rating lines. X-axis: fault current [kA], 0 to 55. Title: "Three-phase fault current contributions — 500 MW offshore substation".
> **Caption:** Fault current contributions from the PSE grid (blue) and WTG aggregate (green) at the 220 kV and 66 kV buses. The WTG contribution is larger at 66 kV (42% of total) than at 220 kV (33%) because the WTGs connect directly to the 66 kV bus without passing through the OSS transformer. Both totals are well below equipment ratings (dashed lines). The converter current limit keeps WTG contributions bounded and predictable — unlike a synchronous generator bank, which would contribute 5–10× rated current in the same scenario.
> **Alt text:** Stacked horizontal bar chart showing PSE and WTG fault current contributions at 220 kV and 66 kV buses against equipment rating reference lines.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** PSE contribution in blue; WTG contribution in green; equipment ratings as dashed red vertical lines.

---

## Key Takeaways

- **The IEC 60909-0:2016 equivalent voltage source method calculates maximum short-circuit current by replacing the network with a Thevenin equivalent at the fault point.** The voltage factor $c = 1.10$ conservatively accounts for pre-fault over-voltage and motor action. The result $I''_k = c \cdot V_n / (\sqrt{3} |Z_k|)$ is the initial symmetrical r.m.s. fault current used for switchgear rating. The flat-start assumption (all voltages at $V_n$, no prefault current) makes the calculation tractable and deliberately conservative.

- **The peak asymmetrical current $\hat{i}_p = \kappa\sqrt{2}I''_k$ can be nearly twice the symmetrical r.m.s. value for highly inductive networks.** The asymmetry factor $\kappa = 1.02 + 0.98 e^{-3R/X}$ reaches 1.75 for a typical offshore substation with $X/R \approx 10$. This peak value — not the r.m.s. — determines the mechanical rating of busbars, cable terminations, and GIS compartments. For the example farm, $\hat{i}_p = 11.7\,\text{kA}$ at 220 kV and 31.6 kA at 66 kV.

- **Type 4 full-power converter WTGs contribute bounded, controlled fault current of 1.0–1.2× rated, independent of fault severity.** This is fundamentally different from synchronous generators, which produce 5–10× rated in the first few cycles. For the 500 MW offshore farm, the PSE grid dominates fault current at the 220 kV bus; the WTG contribution grows to 42% at the 66 kV bus where the WTGs connect directly. The lower, predictable WTG contribution reduces total fault levels but requires protection relays calibrated for converter — not generator — behaviour.

- **Switchgear must satisfy three independent ratings: $I_{cw}$ (thermal withstand), $\hat{i}_{pk}$ (peak mechanical withstand), and $I_{sc}$ (breaking capacity).** Each rating captures a different failure mode: overheating, conductor deformation, and arc extinction respectively. All three must exceed calculated values with margin. For this farm, all three ratings at both 220 kV and 66 kV carry margins exceeding 4×, consistent with equipment selected from standard offshore substation ranges that accommodate future network upgrades.

- **Selectivity — tripping the minimum section necessary to isolate the fault — requires graded relay operating times that must be recalculated whenever the network changes.** The 1965 Northeast Blackout was caused by a relay setting that was correct when written and wrong when invoked, because the network had grown. Every relay setting has a date. That date determines its validity.

---

## For Further Reading

- **Anderson, P.M. (1995).** *Analysis of Faulted Power Systems.* IEEE Press, Wiley-Interscience, Piscataway, NJ. Originally published by Iowa State University Press (1973); the standard reference on fault analysis for three-phase AC systems. Chapter 3 develops symmetrical components from first principles with full derivations; Chapter 4 applies them to all fault types including simultaneous faults and open conductors. The per-unit notation and five-bus treatment are directly comparable to the approach in this chapter. ISBN: 978-0-7803-1145-9.

- **IEC 60909-0:2016.** *Short-circuit currents in three-phase AC systems — Part 0: Calculation of currents.* Second edition, January 2016. International Electrotechnical Commission, Geneva. The normative standard for IEC-compliant fault calculations. Annexes A–D cover special topics: networks fed by transformers at the boundary of the system (Annex A), method for asynchronous motors (Annex B), converter-interfaced generators (Annex C), and reactances of synchronous machines (Annex D). Available from the IEC Webstore (webstore.iec.ch).

- **Fortescue, C.L. (1918).** "Method of Symmetrical Co-Ordinates Applied to the Solution of Polyphase Networks." *AIEE Transactions*, Vol. 37, pp. 1027–1140. Presented at the 34th Annual Convention of the AIEE, Atlantic City, New Jersey, 28 June 1918. The foundational paper of symmetrical component analysis, available through IEEE Xplore (historical archive). For a modern centenary assessment: Yao, D. and Wang, F. (2019). "100 Years of Symmetrical Components." *Energies*, Vol. 12, No. 3, pp. 450–463. DOI: 10.3390/en12030450. For Fortescue's biography: Brittain, J.E. (2000). "Charles LeGeyt Fortescue and the method of symmetrical components." *IEEE Industry Applications Magazine*, Vol. 6, No. 3, pp. 7–9. DOI: 10.1109/2943.848916.

---

*Sigrid closed the relay calibration notebook and removed the test leads from the front panel. She looked at the overcurrent relay cabinet for a moment — the way a surgeon might look at a finished incision — and set the secondary injection test set to standby.*

*"One relay," Kaan said. "One hundred and twelve milliseconds."*

*"One hundred and twelve milliseconds to trip the 66 kV feeder circuit breaker. Then that feeder's fault current is zero. The busbar stays energised. The other five strings keep generating. The fault is isolated to one string of six turbines." She coiled the test lead around her hand. "Every relay in this building has a calculation behind it, a test like the one I ran today, and a commissioning record with my signature. None of that is interesting. It is necessary."*

*She paused.*

*"What is interesting is when it is wrong. And the interesting thing about when it is wrong is that it is never wrong in an obvious way. It is wrong because the setting was correct in 2023 and the network is different in 2026. It is wrong because somebody added a cable and forgot to rerun the short-circuit study. It is wrong because the WTG converter firmware was updated and the fault current limit changed by eight percent." She picked up her notebook. "Protection engineering is not a calculation you run once. It is a system you maintain."*

*Kaan wrote that down.*

*Anders appeared in the doorway. He had his jacket on and a coffee in his hand. He looked at the closed notebook, looked at Kaan.*

*"Good," he said. "He knows what we are protecting against. Come."*

*He gestured toward the corridor — toward the grey metal door with the observation window and the cooling fan. The door that had been locked for every day of Kaan's time on the platform.*

*STATCOM — HIGH VOLTAGE AREA — AUTHORISED PERSONNEL ONLY.*

*"You told me Chapter 20 first," Kaan said.*

*"You need to understand the Ferranti effect quantitatively before you open that door. Not the name Elif gave you in Chapter 4 — the mechanism. Why the voltage at Bus 3 is 1.024 pu when the physics of resistance and inductance should be pulling it down. And why it becomes worse the moment the wind drops and the cable is still energised but the turbines stop injecting current." He held the corridor door open. "Come. Chapter 20."*

*Behind him, through the observation window, the cooling fans of a hundred and eighty megavars of power electronics turned without interruption.*

---

## Notes

[1] IEC 60909-0:2016. *Short-circuit currents in three-phase AC systems — Part 0: Calculation of currents.* Second edition, January 2016. IEC, Geneva. The first edition was published in 2001. The second edition clarifies the treatment of converter-interfaced sources (Annex C), aligns with IEC 60909-1:2002 (factors for calculation) and IEC 60909-2:2008 (electrical equipment data), and updates voltage factor $c$ tables. Table 1 of the standard: $c_{max} = 1.10$ for nominal voltages $> 35\,\text{kV}$ (maximum fault current), $c_{min} = 1.00$ (minimum fault current, protection sensitivity). Available from IEC Webstore: webstore.iec.ch/en/publication/24100.

[2] DC offset at fault inception: the worst case (DC component equals $\sqrt{2}I''_k$) occurs when the fault is applied at the voltage zero crossing. The total current at $t = 0^+$ must equal zero (the inductance prevents instantaneous change), so the DC component jumps to $-\sqrt{2}I''_k$ to cancel the AC forced response. The DC component decays as $e^{-t/\tau}$ where $\tau = X/(\omega R) = X/(2\pi f R)$. For $X/R = 10$ at 50 Hz: $\tau = 10/(314) = 31.8\,\text{ms}$; the DC component falls to 1% after $5\tau \approx 159\,\text{ms}$ — well beyond the first breaker contact separation at 40–80 ms. Source: IEC 60909-0:2016, Clause 4.3.1; Kundur, P. (1994). *Power System Stability and Control.* McGraw-Hill, New York, Section 3.6.

[3] Fortescue, C.L. (1918). "Method of Symmetrical Co-Ordinates Applied to the Solution of Polyphase Networks." *AIEE Transactions*, Vol. 37, pp. 1027–1140. Presented at the 34th Annual Convention of the AIEE, Atlantic City, New Jersey, 28 June 1918. Biographical detail: Fortescue was born 7 January 1876 at York Factory, Manitoba, Canada (a Hudson's Bay Company trading post where his father, Robert Oliver Fortescue, served as chief factor). He graduated from Queen's University, Kingston, Ontario, in 1898, joined Westinghouse Electric, East Pittsburgh, Pennsylvania, and died 4 February 1936. Sources: Brittain, J.E. (2000). "Charles LeGeyt Fortescue and the method of symmetrical components." *IEEE Industry Applications Magazine*, Vol. 6, No. 3, pp. 7–9. DOI: 10.1109/2943.848916. Yao, D. and Wang, F. (2019). "100 Years of Symmetrical Components." *Energies*, Vol. 12, No. 3. DOI: 10.3390/en12030450.

[4] Type 4 converter fault current behaviour: the grid-side VSC current controller saturates at the converter's rated current limit (typically 1.0–1.2 pu) within 1–2 PWM cycles (~0.5 ms) of fault inception. There is no subtransient surge. For reactive current priority during LVRT: PSE IRiESP (2021 edition), Section 3.4.4 (Type D, reactive power injection during fault); ENTSO-E NC RfG EU Regulation 2016/631, Article 20 (fast fault current injection). The IEC standard for WTG electrical characteristics and fault behaviour is IEC 61400-21-1:2019, *Measurement and assessment of power quality characteristics of grid connected wind turbines*. For converter-based source modelling in protection studies: CIGRÉ Working Group B4.57 (2014). "Guide for the Development of Models for HVDC Converters in a HVDC Grid." CIGRÉ Technical Brochure 604. The same principles apply to AC-connected Type 4 WTGs.

[5] IEC 62271-100:2021. *High-voltage switchgear and controlgear — Part 100: Alternating-current circuit-breakers.* Third edition. IEC, Geneva. Rated short-circuit parameters are defined in Clause 4.101 (making current), 4.103 (short-time withstand current), and 4.104 (breaking current). Cable short-circuit ratings: IEC 60949:1988, "Calculation of thermally permissible short-circuit currents, taking into account non-adiabatic heating effects." The adiabatic heating formula $I_{sc} = k S / \sqrt{t}$ is also given in CENELEC EN 60364-5-54 (earthing and protective conductors), Annex A, with $k$ values for conductor and insulation combinations: copper/XLPE $k = 143$, copper/EPR $k = 143$, aluminium/XLPE $k = 94$.

[6] Northeast Blackout of 1965: the relay implicated was relay Q29BD on one of five 230 kV northbound transmission lines from Sir Adam Beck Hydroelectric Generating Station No. 2, Queenston, Ontario, operated by Ontario Hydro (now Ontario Power Generation). The relay had been reconfigured in 1963; its reactive power pickup threshold was not subsequently revised as system loads grew. At 17:16:11 EST on 9 November 1965, the line tripped; the subsequent cascade through New York, New England, and Ontario left approximately 30 million people without power for up to 13 hours. Post-event investigation: Federal Power Commission (1965). *Northeast Power Failure, November 9 and 10, 1965 — A Report to the President by the Federal Power Commission.* US Government Printing Office, Washington DC, 6 December 1965. For a technical analysis: Pourbeik, P., Kundur, P.S., and Taylor, C.W. (2006). "The anatomy of a power grid blackout." *IEEE Power and Energy Magazine*, Vol. 4, No. 5, pp. 22–29. DOI: 10.1109/MPAE.2006.1687814.

# Chapter 21: Harmonics, Flicker, and Power Quality

*The corridor between the STATCOM room and the OSS control room was twenty-three steps, which Kaan had learned to count because the lighting was uneven and the deck plates had a lip at the expansion joint that he had caught his toe on twice in the same week. He pulled the control room door open against its pneumatic resistance and felt the familiar breath of conditioned air — cooler and quieter than the rest of the building, the air that SCADA equipment seemed to demand as a condition of its cooperation.*

*The control room at 08:30 on a Tuesday was not busy. The day operator sat at the primary workstation, hands folded, watching a trend plot of Bus 3 voltage. A power quality analyser was mounted on a rack beside the bay panel, its screen showing a vertical bar graph of something Kaan could not yet read from the doorway. And a woman he had not met was seated at a secondary workstation with a tablet, a clipboard with a laminated sheet fixed to its back, and a power quality analyser report laid flat on the desk beside her.*

*"You are Anders's student," she said without looking up. Her English was Danish-inflected — precise vowels, the articles placed with deliberate care. "Johan sent me a message this morning. He said you now understand cable charging and STATCOM response time."*

*"I think so," Kaan said.*

*"Good." She finally looked at him. Late thirties, dark-framed glasses, the kind of steady attention that did not read as unfriendly but did read as evaluative. "My name is Ingrid Sørensen. I am the power quality specialist for the grid compliance package. I have been here three days and I will be here three more." She gestured at the rack. "Look at the screen."*

*Kaan looked. The bar graph showed a frequency spectrum: a tall bar at 50 Hz, then a series of smaller bars at regular intervals extending to the right — at 100 Hz, 150 Hz, 200 Hz, and so on, diminishing in height but distinctly present. Above each bar, a percentage value: 0.1%, 2.1%, 0.3%, 1.7%, 0.2%, 0.9%.*

*"Those are harmonic components of the voltage waveform at this bus," Ingrid said. "The tall bar at 50 Hz is the fundamental. The smaller bars are the harmonics. The second harmonic is 100 Hz. The fifth is 250 Hz. The seventh is 350 Hz. Each one is a perfect sinusoid oscillating at exactly that frequency — and when you add them all together, you get the waveform that is actually in the cable right now."*

*"From the STATCOM?" Kaan said.*

*"Some of it. The wind turbine converters more. The STATCOM's MMC topology suppresses most of its own harmonic output — that is what the many sub-modules are for. But every piece of power electronics in this building contributes a harmonic fingerprint. And some of those harmonics arrive at this bus magnified, because the cable and the transformers resonate at certain frequencies." She turned back to him. "That is what I am here to measure, to calculate, and to certify will not disturb the grid."*

*She picked up the clipboard. The laminated sheet on its back was a table of numbers in small print — columns of harmonic orders and percentages.*

*"This," she said, "is what the IEC says is acceptable at the grid connection point. My job is to prove we are below it."*

*She set the clipboard on the desk and sat back down.*

*"Sit. We begin with Fourier."*

---

## 21.1 Why Converters Generate Harmonics

In 1822, Joseph Fourier published *Théorie analytique de la chaleur* — the *Analytical Theory of Heat* — a work that had begun life fifteen years earlier as a memoir submitted to the Institut de France. The memoir, presented on 21 December 1807, introduced the claim that any periodic function, however irregular its shape, could be exactly represented as a sum of sine waves at integer multiples of a fundamental frequency. The French Academy's review committee included Joseph-Louis Lagrange, who had independently studied trigonometric series in the 1750s and raised objections about Fourier's treatment. Publication was blocked. The ideas circulated privately among mathematicians and eventually appeared, substantially expanded, in the 1822 book.[1]

Fourier was studying heat diffusion through a metal bar. He did not know that electrical engineers would one day use his theorem to describe the voltage waveform inside a submarine cable. But the mathematics is indifferent to its application. Any periodic waveform decomposes into a sum of sinusoids:

$$
v(t) = V_0 + \sum_{h=1}^{\infty} V_h \sqrt{2} \sin(h\omega t + \phi_h)
$$

where:
- $V_0$ = DC offset [V] — zero in a balanced AC power system
- $V_h$ = RMS amplitude of the h-th harmonic [V]
- $h$ = harmonic order (h = 1 is the fundamental at 50 Hz; h = 5 is the fifth harmonic at 250 Hz)
- $\omega = 2\pi f_1 = 314.16$ [rad/s]
- $\phi_h$ = phase angle of the h-th harmonic [rad]

The fundamental ($h = 1$) carries almost all the power. The harmonics ($h \geq 2$) are small in amplitude but not zero. For any real power system with switching converters, the $V_h$ terms for $h > 1$ are finite and measurable — they are not theoretical artefacts but physical voltages present at every bus, visible on Ingrid's analyser screen.

A wind turbine converter controls power flow by opening and closing transistors (IGBTs) at high frequency — typically 2 kHz. In each switching cycle, the transistors chop the DC link voltage into short pulses whose average value approximates a sinusoidal reference. This process — Pulse Width Modulation, or PWM — produces an output voltage that is the desired 50 Hz sinusoid plus a family of harmonics. For a carrier (switching) frequency $f_{sw}$ and fundamental frequency $f_1$, the carrier ratio is $N = f_{sw}/f_1 = 40$ (for 2 kHz at 50 Hz). The characteristic sidebands appear at:

$$
h = nN \pm k \quad \text{for integers } n = 1, 2, 3, \ldots \text{ and odd } k = 1, 3, 5, \ldots
$$

For $n = 1$: $h = 39$ and $h = 41$ — harmonics around 2 kHz. For $n = 2$: $h = 79$ and $h = 81$ — harmonics around 4 kHz. These high-order harmonics are attenuated naturally by the cable's capacitive impedance, which decreases with frequency.

More troublesome are the low-order harmonics — $h = 5, 7, 11, 13, 17, 19, \ldots$ — the characteristic harmonics of three-phase converter stages. In a balanced three-phase system, the triplen harmonics ($h = 3, 9, 15, \ldots$) cancel because the three phase-shifted fundamental components add to zero at triple frequency. This cancellation is a free filter — it requires no hardware, only the geometric symmetry of three-phase construction. What remains are the odd non-triplen orders, and these are present at every converter output whether the designer wishes it or not.

The Modular Multilevel Converter (MMC) topology used in the STATCOM and in advanced Type 4 wind turbines synthesises the AC waveform from many small voltage steps — 200 to 400 sub-modules per arm in a large STATCOM. Each step is smaller, the staircase is finer, and the harmonic distortion at the switching frequency is far lower than in a two-level VSC. The residual emission is concentrated at the odd non-triplen orders ($h = 5, 7, 11, 13, 17, 19$) at amplitudes that the converter's active harmonic control aims to reduce. What the control cannot eliminate, the compliance engineer must measure and certify.

<!-- IMAGE: fig-21-01 -->
> **Figure 21.1** — Harmonic voltage spectrum at the WTG converter output (Type 4, MMC)
> **Type:** vertical bar chart
> **Content:** X-axis: harmonic order h, 1 to 50. Y-axis: harmonic voltage magnitude as % of fundamental. Tall blue bar at h=1 (100%). Smaller bars: h=5 (2.1%), h=7 (1.7%), h=11 (0.9%), h=13 (0.6%), h=17 (0.4%), h=19 (0.3%). Near-zero bars at even orders and triplen orders (h=3, 9, 15). Dashed red line showing IEC 61000-3-6:2008 HV planning levels: 2% at h=5, 2% at h=7, 1.5% at h=11, 1.5% at h=13. Annotation: "triplen harmonics cancelled by 3-phase symmetry" pointing to blank bars at h=3, 9, 15.
> **Caption:** Characteristic harmonic voltage spectrum for a Type 4 full-power converter (MMC). Odd non-triplen harmonics dominate; triplen orders are suppressed by three-phase symmetry. At the WTG terminals, the 5th and 7th harmonics approach the IEC 61000-3-6:2008 HV planning levels; after aggregation and transformer attenuation to the 220 kV connection point, all values reduce significantly.
> **Alt text:** Bar chart of harmonic voltage spectrum with peaks at h=5, 7, 11, 13 and near-zero values at triplen and even orders.
> **Data source:** Author illustration
> **Resolution:** 1200 × 700 px minimum
> **Color notes:** Odd non-triplen harmonics in blue; all others in grey; IEC planning level in dashed red.

---

## 21.2 Total Harmonic Distortion and IEC Limits

The harmonic spectrum contains many individual components. Engineers need a single number to summarise the total distortion — a figure that can be written on a compliance certificate and compared against a limit. That number is the Total Harmonic Distortion:

$$
THD_V = \frac{\sqrt{\sum_{h=2}^{H} V_h^2}}{V_1} \times 100\%
$$

where:
- $V_h$ = RMS voltage of the h-th harmonic [V]
- $V_1$ = RMS voltage of the fundamental [V]
- $H$ = highest harmonic order included (typically 40 to 50)

For a perfectly sinusoidal voltage, $V_h = 0$ for all $h > 1$ and $THD_V = 0\%$. For a real WTG converter output at the turbine terminals (0.69 kV), $THD_V$ is typically 3–5%. At the 220 kV connection point — after transformer attenuation, 45 km of export cable, and mixing of 34 turbine outputs — it is typically well below 2%.

The IEC manages harmonic emission through a hierarchical framework built in IEC 61000-3-6:2008. The document establishes *planning levels* — the maximum harmonic voltage distortion permitted in a network — and *emission limits* — the portion attributable to a single generator. The philosophy is that the grid is a shared resource: each connected party has a right to inject harmonics proportional to its contracted connection size, subject to the aggregate remaining below the planning level.

> **Standard reference:** IEC 61000-3-6:2008, "Assessment of emission limits for the connection of distorting installations to MV, HV and EHV power systems," Table II (harmonic voltage planning levels at HV, 1–145 kV) and Section 6 (allocation methodology for individual customers). [2]

At HV (1–145 kV), the planning levels for individual harmonic voltages include 2.0% at $h = 5$, 2.0% at $h = 7$, 1.5% at $h = 11$, and 1.5% at $h = 13$. The total voltage distortion ($THD_V$) planning level at HV is 3.0%. These values are not arbitrary — they are set to protect sensitive industrial loads (variable-speed drives, medical equipment, precision instrumentation) from malfunction caused by voltage distortion, based on measured sensitivity data gathered through decades of industrial power quality surveys.

When multiple harmonic sources are present, their contributions aggregate statistically. The phase angles of harmonics from independent converters are not correlated — each WTG's converter runs its own control loop, at its own slightly different switching phase. The aggregate distortion grows approximately as the square root of the sum of squares:

$$
V_{h,\mathrm{farm}} \approx \sqrt{\sum_{i=1}^{N} V_{h,i}^2}
$$

For $N = 34$ identical turbines each emitting $V_{h,1}$: the farm contribution is $\sqrt{34} \approx 5.8$ times the individual — not 34 times. This square-root aggregation is both a physical truth (random phase diversity reduces coherent addition) and a design advantage: each turbine can emit more per-unit distortion than would be permitted if all 34 sources added in phase. Ingrid's compliance calculations depend on this — and on verifying, through measurement, that the turbines are not accidentally phase-locked to each other in their harmonic emission.

---

## 21.3 The Harmonic Impedance Scan

Individual harmonic emission levels at the turbine terminals tell only part of the story. Before a harmonic from the WTG terminals reaches the 220 kV connection point, it travels through the collection network: the 66 kV cables, the step-up transformers, the OSS busbars, the export cable. At each element, the impedance is frequency-dependent — and the network can either attenuate a harmonic or amplify it.

The impedance of a passive network element at harmonic order $h$ scales predictably. An inductor with fundamental-frequency reactance $X_L$ presents impedance $hX_L$ at the h-th harmonic. A capacitor with fundamental-frequency reactance $X_C$ presents $X_C/h$. Inductive impedances grow with frequency; capacitive impedances shrink. A transformer leakage reactance, small at 50 Hz, is thirteen times larger at the 13th harmonic.

A harmonic impedance scan plots the magnitude of the Thevenin impedance as seen from a network node — typically the offshore 66 kV bus — as a function of harmonic order:

$$
|Z(h)| = \left| \frac{\hat{V}_h}{\hat{I}_{h,\mathrm{injected}}} \right| \quad [\Omega]
$$

where $\hat{V}_h$ is the voltage at the node if a unit harmonic current $\hat{I}_{h,\mathrm{injected}}$ is injected. The scan answers: "if a source injects 1 A of harmonic current at order $h$, how large a voltage disturbance appears at this bus?" A high impedance at a particular harmonic order means that small harmonic currents produce large harmonic voltages — the network is sensitive at that frequency.

The scan is computed numerically using the network admittance matrix evaluated at $h \times f_1$ instead of $f_1$, sweeping from $h = 2$ to $h = 50$. Ingrid had run this scan during the morning using the network model she had built from the cable datasheets, transformer test certificates, and the grid operator's short-circuit data. The result showed a mostly smooth curve — declining gradually with harmonic order — with one sharp peak at a specific order.

"This peak," she said, pointing at the screen with a pencil, "is a resonance. The cable and the transformers are forming an LC circuit. At this one frequency, the impedance is very high. A harmonic current that would be harmless everywhere else in the spectrum becomes dangerous here." She set the pencil down. "That is the number I came here to find."

> **Standard reference:** IEC 61000-3-6:2008, Section 5.4 — harmonic impedance assessment and impedance scan methodology for the assessment of harmonic distortion propagation in HV and EHV networks. [2]

<!-- IMAGE: fig-21-02 -->
> **Figure 21.2** — Harmonic impedance scan at the offshore 66 kV bus
> **Type:** line chart
> **Content:** X-axis: harmonic order h, 2 to 50. Y-axis: Thevenin impedance magnitude |Z(h)| in ohms. Generally declining smooth curve from ~20 Ω at h=2 to ~5 Ω at h=50. Sharp resonance peak at h≈11 reaching approximately 75 Ω. Annotations: "parallel resonance: cable capacitance + transformer inductance" at the peak with arrow. Dashed horizontal line at the "base impedance" level (~14 Ω). Shaded yellow band around the resonant peak indicating the "high-sensitivity region" where compliance margin is tightest.
> **Caption:** Harmonic impedance scan at the offshore 66 kV bus, swept from h=2 to h=50. The parallel resonance near h=11 amplifies harmonic currents injected at that order by approximately 5× relative to the off-resonance baseline. The 11th harmonic (550 Hz) is a characteristic converter harmonic — its position near the resonance peak is the primary compliance challenge for this farm's collection network.
> **Alt text:** Line chart of harmonic impedance versus harmonic order showing a sharp peak near h=11 indicating parallel resonance.
> **Data source:** Author illustration
> **Resolution:** 1200 × 700 px minimum
> **Color notes:** Impedance curve in blue; resonance peak region in yellow shading; base impedance level in dashed grey.

---

## 21.4 Cable Resonance and the Amplification Problem

The parallel resonance near $h = 11$ has a direct physical explanation. The 66 kV collection cables — approximately 120 km of three-core XLPE at $C \approx 0.18\,\mu\text{F/km}$ — present a total shunt capacitance. The thirty-four WTG step-up transformers, wired in parallel at the 66 kV bus, present a combined leakage inductance. A capacitance in parallel with an inductance resonates. At resonance, the parallel impedance peaks — theoretically to infinity for a lossless circuit, in practice to a large but finite value limited by resistance.

The resonant harmonic order is the order at which the capacitive and inductive reactances are equal. In terms of the short-circuit apparent power $S_{sc}$ at the 66 kV bus and the total cable reactive generation $Q_c$ at the fundamental frequency, this simplifies to:

$$
h_r = \sqrt{\frac{S_{sc}}{Q_c}}
$$

where:
- $S_{sc}$ = short-circuit apparent power at the 66 kV bus [MVA]
- $Q_c$ = reactive power generated by the collection cables at 50 Hz [MVAR]
- $h_r$ = resonant harmonic order (dimensionless)

For the farm's 66 kV collection network: the total cable reactive generation at 66 kV is approximately $Q_c = 120\,\text{km} \times 0.18\,\mu\text{F/km} \times (66\,\text{kV})^2 \times 314.16 \approx 3.9\,\text{MVAR}$. The short-circuit power at the 66 kV bus, looking into the 34 turbine transformers and the OSS transformer connected to the grid, is approximately $S_{sc} \approx 510\,\text{MVA}$:

$$
h_r = \sqrt{\frac{510}{3.9}} \approx \sqrt{131} \approx 11.4
$$

The resonance falls near the 11th harmonic — at 550 Hz. This is precisely one of the characteristic harmonics generated by three-phase converter bridges, including the Type 4 WTG converters. A harmonic current that is 0.5% at the turbine terminals — well below any limit — passes through the cable network and encounters an impedance five times higher at $h = 11$ than at non-resonant orders. The resulting harmonic voltage is amplified fivefold. Sub-threshold emission becomes a potential compliance violation, not because the converter is misbehaving, but because the network has a resonance at that frequency.

The fun fact that engineers tend to share: the resonant order formula $h_r = \sqrt{S_{sc}/Q_c}$ is the same formula used to assess the risk of capacitor bank resonance in industrial plants — wind farm collection networks rediscover a problem that factory electrical engineers have dealt with since fixed-capacitor power factor correction was introduced in the 1960s. The geometry of the problem is the same; only the scale changes.

Mitigation options when the resonance falls at a characteristic harmonic order include passive filters (tuned LC circuits providing a low-impedance path at the problem frequency), converter control adjustments (shifting the switching frequency to move the characteristic harmonics away from the resonance), and — most commonly for modern Type 4 farms with MMC STATCOMs — demonstrating through detailed calculation that even with amplification, the distortion remains below the IEC planning levels. Ingrid's worked calculation would determine which of these applied to this farm.

---

## 21.5 Flicker: Pst, Plt, and EN 50160

Harmonics distort the *shape* of the voltage waveform. Flicker distorts its *magnitude* — a rapid fluctuation in the RMS voltage that occurs at frequencies the human visual system can perceive as varying light intensity. The phenomenon was named in the early twentieth century for exactly this reason: electric arc furnaces, which draw large and erratic currents that cause rapid voltage fluctuations, made the lights in nearby buildings visibly flicker. Workers in steel towns noticed. Utility engineers measured. A new discipline — power quality — was born from the complaint that a steel plant was ruining someone else's lightbulbs.[3]

The challenge with quantifying flicker is that it is fundamentally a perception phenomenon. A 1% voltage fluctuation at 8 Hz is far more disturbing to the eye than a 1% fluctuation at 0.1 Hz or at 30 Hz. The eye-brain system has a frequency-dependent sensitivity to brightness variation, peaking around 8–10 Hz. The IEC flickermeter standard — first developed by UIE in the 1970s, standardised as IEC 868 in 1986, and reissued as IEC 61000-4-15 in 1997 — models this sensitivity explicitly. The flickermeter is a virtual instrument: a software chain that processes a measured voltage signal through filters that model the lamp, the retina, and the brain's response to fluctuating brightness, accumulating the result into a statistical severity index.[3]

The output is two quantities. The short-term flicker severity $P_{st}$ is computed over a 10-minute measurement window. The long-term severity is:

$$
P_{lt} = \sqrt[3]{\frac{1}{N}\sum_{i=1}^{N} P_{st,i}^3}
$$

where:
- $P_{lt}$ = long-term flicker severity [dimensionless]
- $P_{st,i}$ = i-th short-term flicker value (10-minute period) [dimensionless]
- $N = 12$ = number of $P_{st}$ periods in a 2-hour $P_{lt}$ window

The cubic mean (rather than the arithmetic mean) weights severe flicker events more heavily — a single bad 10-minute period has more impact on $P_{lt}$ than twelve mediocre ones. This reflects the asymmetry in human tolerance: people find intermittent severe flicker far more objectionable than persistent mild flicker of the same average intensity.

> **Standard reference:** EN 50160:2010 + A1:2015, "Voltage characteristics of electricity supplied by public electricity networks," Section 5.8 (flicker at LV) and Section 6.6 (flicker at MV). Compatibility limits: $P_{st} \leq 1.0$ and $P_{lt} \leq 1.0$ at the 95th percentile of all measured weekly values. [4]

A $P_{st}$ or $P_{lt}$ value of 1.0 corresponds to the perceptibility threshold — the level at which 50% of observers describe the flicker as "just noticeable." Arc furnaces operating at full power typically produce $P_{st}$ values of 2 to 6 at the adjacent network bus. The steel town workers were not imagining things.

For modern offshore wind farms with Type 4 converters, flicker is a largely solved problem. The mechanical source of flicker in wind turbines — the tower shadow — occurs at the blade-passing frequency, three times the rotor speed (3P). For a V236-15.0 MW turbine at rated speed of 9 rpm, this is $3 \times 9/60 = 0.45$ Hz — well below the 8–10 Hz range of maximum visual sensitivity. More importantly, the Type 4 converter decouples mechanical and electrical variability: the DC link absorbs fluctuations in aerodynamic torque, and the grid-side inverter outputs a smooth sinusoidal current regardless of what the rotor blades are experiencing moment to moment.

For grid code compliance purposes, the farm-level $P_{st}$ contribution is estimated from a flicker coefficient $c(\psi_k, v_a)$ measured during the WTG type test, following IEC 61400-21-1:2021:

$$
P_{st,\mathrm{WF}} = \frac{c(\psi_k, v_a) \cdot S_{\mathrm{rated,WTG}}}{S_{sc}} \cdot \sqrt{N_{\mathrm{WTG}}}
$$

where:
- $c(\psi_k, v_a)$ = flicker coefficient from type test, function of network impedance angle $\psi_k$ and annual mean wind speed $v_a$ [dimensionless]
- $S_{\mathrm{rated,WTG}}$ = WTG rated apparent power [VA]
- $S_{sc}$ = short-circuit apparent power at the 220 kV connection point [VA]
- $N_{\mathrm{WTG}}$ = number of turbines

> **Standard reference:** IEC 61400-21-1:2021, "Wind energy generation systems — Part 21-1: Measurement and assessment of electrical characteristics — Wind turbines," Section 5.2 (flicker coefficient measurement) and Section 6.1 (flicker emission assessment for wind power plants). [5]

<!-- IMAGE: fig-21-03 -->
> **Figure 21.3** — Short-term flicker severity Pst: arc furnace vs. Type 1 vs. Type 4 wind turbine
> **Type:** grouped bar chart over a 24-hour period
> **Content:** Three horizontal bar groups across a 24-hour x-axis (144 ten-minute intervals): (1) Arc furnace (red): Pst values ranging 2.0–5.5, most bars above 1.0; (2) Type 1 directly-connected induction generator (orange): Pst values ranging 0.3–0.8; (3) Type 4 full-power converter WTG offshore (green): Pst values ranging 0.04–0.12. Dashed red horizontal line at Pst = 1.0 labelled "EN 50160:2010 limit." Arc furnace bars clearly dominating the chart; Type 4 bars barely visible against the y-axis.
> **Caption:** Short-term flicker severity Pst over 24 hours for three generator types. Electric arc furnaces routinely exceed the EN 50160:2010 limit (Pst ≤ 1.0). Directly-connected induction generators (Type 1 turbines) remain below the limit but can approach it under turbulent conditions. Type 4 full-power converter turbines in modern offshore wind farms generate flicker levels an order of magnitude below the limit — the consequence of DC-link decoupling between mechanical variability and electrical output.
> **Alt text:** Grouped bar chart showing Pst values for arc furnace (frequently above 1.0), Type 1 WTG (below 1.0), and Type 4 WTG (well below 1.0) over a 24-hour period.
> **Data source:** Author illustration; arc furnace range from IEC 61000-3-6:2008 Annex C; WTG ranges from IEC 61400-21-1:2021 measurement data.
> **Resolution:** 1200 × 700 px minimum
> **Color notes:** Arc furnace in red; Type 1 WTG in orange; Type 4 WTG in green; EN 50160 limit in dashed red.

---

## 21.6 Worked Example: Harmonic Compliance Assessment

**Reference case:** A generic 500 MW offshore wind farm — 33 × 15 MW Type 4 MMC turbines, 66 kV collection network with 140 km total XLPE cable ($C = 0.18\,\mu\text{F/km}$), OSS 220/66 kV transformer (rated 550 MVA, $X_{sc} = 14\%$), 45 km 220 kV export cable. Grid short-circuit power at the 220 kV connection point: $S_{sc,220} = 4{,}000$ MVA.

### Step 1: Resonance frequency

Collection cable reactive generation at 66 kV: $Q_c = (66\,\text{kV})^2 \times 314.16 \times 0.18 \times 10^{-6} \times 140 = 4.55\,\text{MVAR}$.

Aggregate short-circuit power at the 66 kV bus (from transformers + grid): approximately 500 MVA.

$$h_r = \sqrt{\frac{500}{4.55}} \approx \sqrt{110} \approx 10.5$$

The resonance falls between the 10th and 11th harmonic — closer to the 11th. The 11th harmonic current from the WTG converters will be amplified by the resonance.

### Step 2: Individual harmonic emission at 66 kV bus

From the WTG type test report (representative values referred to 66 kV after the WTG step-up transformer):

| Harmonic order $h$ | Voltage (% of $V_1$) | IEC 61000-3-6 HV planning level |
|---:|---:|---:|
| 5 | 2.1% | 2.0% |
| 7 | 1.7% | 2.0% |
| 11 | 0.9% | 1.5% |
| 13 | 0.6% | 1.5% |
| 17 | 0.4% | 1.0% |

### Step 3: Farm aggregation (square-root law)

Individual WTG harmonic current at 66 kV for $h = 5$: rated current of one 15 MVA WTG at 66 kV is $I_n = 15\,\text{MVA}/({\sqrt{3} \times 66\,\text{kV}}) = 131\,\text{A}$. The 5th harmonic current is $0.021 \times 131 = 2.75\,\text{A}$ per turbine.

Farm aggregate: $I_{5,\mathrm{farm}} = \sqrt{33} \times 2.75 = 15.8\,\text{A}$.

For each harmonic order, the voltage distortion at the 66 kV bus is $V_h = I_{h,\mathrm{farm}} \times |Z(h)|$. From the impedance scan: $|Z(5)| = 18\,\Omega$, $|Z(7)| = 14\,\Omega$, $|Z(11)| = 72\,\Omega$ (at resonance peak), $|Z(13)| = 11\,\Omega$, $|Z(17)| = 9\,\Omega$.

| $h$ | $I_{h,\mathrm{farm}}$ [A] | $|Z(h)|$ [$\Omega$] | $V_h$ [V] | $V_h/V_1$ [%] | IEC limit [%] |
|---:|---:|---:|---:|---:|---:|
| 5 | 15.8 | 18 | 284 | 0.75% | 2.0% |
| 7 | 11.0 | 14 | 154 | 0.40% | 2.0% |
| 11 | 5.17 | 72 | 372 | 0.98% | 1.5% |
| 13 | 3.45 | 11 | 38 | 0.10% | 1.5% |
| 17 | 2.30 | 9 | 21 | 0.05% | 1.0% |

Note the $h = 11$ row: a per-turbine emission of only 0.9% has produced a farm-level voltage distortion of 0.98% — because the impedance at the resonance is five times higher than at non-resonant orders. Without the resonance, the 11th harmonic voltage would be approximately $5.17 \times 14\,\Omega = 72\,\text{V} = 0.19\%$ — barely visible. The resonance has amplified a minor harmonic into the dominant compliance concern.

### Step 4: Total Harmonic Distortion

$$THD_V = \sqrt{0.75^2 + 0.40^2 + 0.98^2 + 0.10^2 + 0.05^2 + \ldots} \approx \sqrt{0.56 + 0.16 + 0.96 + 0.01 + 0.003} \approx \sqrt{1.70} \approx 1.30\%$$

IEC 61000-3-6:2008 HV planning level for $THD_V$: **3.0%**. **Result: PASS** — 1.70 percentage points of margin.

### Step 5: Flicker

From the WTG type test report: flicker coefficient $c(\psi_k = 70°, v_a = 8.5\,\text{m/s}) = 0.31$ (representative for a large offshore Type 4 turbine with MMC converter).

$$P_{st,\mathrm{WF}} = \frac{0.31 \times 15 \times 10^6}{4{,}000 \times 10^6} \times \sqrt{33} = \frac{4.65 \times 10^6}{4{,}000 \times 10^6} \times 5.74 = 0.00116 \times 5.74 = 0.0067$$

EN 50160:2010 limit: $P_{st} \leq 1.0$. **Result: PASS** — the farm contributes 0.7% of the allowable flicker. The arc furnace in the steel town 50 km away contributes more in one minute than this farm in a week.

### Summary

| Parameter | Calculated | Limit | Margin |
|-----------|-----------|-------|--------|
| $V_5$ at 66 kV | 0.75% | 2.0% | 1.25% |
| $V_7$ at 66 kV | 0.40% | 2.0% | 1.60% |
| $V_{11}$ at 66 kV (resonance) | 0.98% | 1.5% | 0.52% |
| $V_{13}$ at 66 kV | 0.10% | 1.5% | 1.40% |
| $THD_V$ at 66 kV | 1.30% | 3.0% | 1.70% |
| $P_{st,\mathrm{WF}}$ | 0.007 | 1.0 | 0.993 |

The 11th harmonic has the tightest margin — 35% of the planning level consumed — due to the resonance amplification. Ingrid would note this in her compliance report and flag it as a monitoring point: any future change in WTG converter software that altered the 11th harmonic emission profile would require a re-check of the 66 kV bus distortion.

<!-- IMAGE: fig-21-04 -->
> **Figure 21.4** — Harmonic compliance summary: calculated voltage distortion vs. IEC 61000-3-6:2008 planning levels
> **Type:** grouped horizontal bar chart
> **Content:** Six harmonic orders (h=5, 7, 11, 13, 17, THD total) on the y-axis. Two bars per order: calculated distortion (green) and IEC planning level (red). For h=11, the green bar extends to 0.98% while the red limit is at 1.5%, with annotation "resonance amplification: |Z(11)| = 5× |Z(5)|". The green bars are all clearly shorter than the red bars. A small gap indicator for h=11 shows 0.52% remaining margin. Background shading: green region (compliant) below the red bars.
> **Caption:** Harmonic voltage distortion at the offshore 66 kV bus versus IEC 61000-3-6:2008 HV planning levels for a 500 MW reference farm. The 11th harmonic has the narrowest compliance margin (0.98% calculated vs. 1.5% limit) due to the cable-transformer parallel resonance near h = 10.5. All parameters pass, confirming grid code compliance at the 66 kV connection point.
> **Alt text:** Horizontal grouped bar chart showing calculated harmonic voltage distortion and IEC planning limits for harmonic orders 5 through 17 and THD, with h=11 showing the narrowest margin.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Calculated values in green; IEC planning levels in red; compliance margin region shaded light green.

---

## Key Takeaways

- **Every power converter is a harmonic source.** PWM switching generates voltage harmonics at integer multiples of the fundamental frequency. In a three-phase system, the triplen harmonics (h = 3, 9, 15...) cancel by symmetry. The dominant components are the odd non-triplen orders (h = 5, 7, 11, 13...). MMC converters reduce but do not eliminate these — the Fourier decomposition of any switched waveform always contains them.

- **Cable-transformer resonance is the primary harmonic compliance challenge for offshore wind farms.** Long XLPE cables are capacitors; transformer leakage reactances are inductors; together they form an LC circuit with a resonant harmonic order $h_r = \sqrt{S_{sc}/Q_c}$. For typical 66 kV collection networks with 100–150 km of cable, this resonance falls between $h = 9$ and $h = 13$ — exactly where converter characteristic harmonics exist. An individual turbine's harmonic emission can be amplified fourfold at the resonance, turning a sub-threshold source into a compliance risk at the 66 kV bus.

- **Harmonic compliance is assessed at the connection point, not at the turbine terminals.** IEC 61000-3-6:2008 sets planning levels that the aggregate distortion at the grid boundary must not exceed. Farm-level aggregation uses the square-root summation law — 34 turbines at 2.1% each contribute $\sqrt{34} \times 2.1\% \approx 12\%$ at the WTG level, which, after transformer attenuation and mixing, arrives at the connection point as a much smaller number.

- **Flicker from Type 4 offshore wind farms is negligible.** The DC link decouples mechanical variability from electrical output — the 3P tower shadow that was a real problem for 1990s directly-connected induction generators does not reach the grid through a modern power converter. For a 500 MW farm on a 4,000 MVA grid, the calculated $P_{st}$ is approximately 0.007 — about 0.7% of the EN 50160:2010 limit. Power quality compliance for this farm lives entirely in the harmonic domain, not the flicker domain.

- **"Clean" power is a contractual boundary, not a physics absolute.** The grid does not demand zero harmonics or zero flicker — such a thing does not exist. It demands that distortion at the metering point remain below agreed planning levels, determined by the sensitivity of other users sharing the network. The IEC framework translates the physics of harmonic distortion and the neuroscience of flicker perception into a set of numbers that can be written into a grid connection agreement. Every calculation in this chapter is ultimately answering one question: at the boundary, does this farm's output meet the contract?

---

## For Further Reading

- **Arrillaga, J. and Watson, N.R. (2003).** *Power System Harmonics.* 2nd edition. John Wiley & Sons, Chichester. ISBN 0-470-85129-5. The standard engineering reference for harmonic analysis. Chapter 4 derives the harmonic impedance from network theory; Chapter 8 covers the resonance amplification problem and the IEC assessment framework; Chapter 12 addresses offshore wind farm harmonic assessment with North Sea case studies. The derivation of the parallel resonance condition in terms of short-circuit strength and cable charging (Section 8.3) is the clearest available treatment for engineers applying the $h_r = \sqrt{S_{sc}/Q_c}$ formula to real farms.

- **IEC 61400-21-1:2021.** *Wind energy generation systems — Part 21-1: Measurement and assessment of electrical characteristics — Wind turbines.* International Electrotechnical Commission, Geneva. The current standard for wind turbine power quality type testing and grid compliance assessment. Annex A gives measured flicker coefficients for representative turbine classes across a range of network impedance angles and mean wind speeds. Section 6 provides the aggregation methodology for computing farm-level harmonic emission and flicker from individual turbine type test data. Every grid code compliance report for a modern offshore wind farm cites either this standard or its predecessor, IEC 61400-21:2008.

- **Baggini, A. (ed.) (2008).** *Handbook of Power Quality.* John Wiley & Sons, Chichester. ISBN 978-0-470-06561-7. A comprehensive reference covering all power quality phenomena. Chapter 7 covers harmonic sources, propagation, and mitigation; Chapter 4 covers flicker measurement and the IEC flickermeter model; Chapter 3 explains the EN 50160 framework and its relationship to IEC 61000-3-6. For engineers without a power quality background, Part I (Chapters 1–6) is the fastest path to fluency in the measurement standards and compliance methodology before applying them to a wind farm grid connection study.

---

*The worked example took forty minutes. Ingrid ran the 11th harmonic calculation twice, wrote the second calculation on a separate sheet, verified that both reached 0.98%, and circled the number in red pen.*

*"Tight," she said.*

*"Is it acceptable?" Kaan asked.*

*"Today, yes. The calculation shows compliance." She set the pen down. "But I will note it as a monitoring point. If Vestas releases a converter software update that changes the harmonic emission profile at the 11th order, the operator needs to rerun this check. The resonance does not move — cable length and transformer impedance do not change. The emission amplitude can change. So we track it."*

*She began to gather her papers into a precise stack, corners aligned. Her relationship to information was the same as her relationship to paperwork: organised, complete, nothing left in an ambiguous state.*

*"The grid does not care what happens inside this building," she said. "It cares what arrives at the metering point. My job ends at the connection point. Everything behind that point is yours."*

*Kaan thought about that. He had spent the last six weeks learning the internal logic of the farm: the physics of wind, the mathematics of wakes, the forces on foundations, the heat inside a cable, the reactive surge of a STATCOM settling in eighteen milliseconds. All of it invisible. All of it managed inside a fence that ended, on paper, at a metering point in a grid connection agreement.*

*"What happens after the metering point?" he asked. "I mean — when the grid operator calls and says the frequency is dropping and they need more active power in ten seconds: who wrote the rule that says the farm must respond?"*

*Ingrid snapped the latches on her analyser case.*

*"Anders can answer that one," she said. "That is not power quality — that is the grid code. That is the contract between this farm and the transmission system operator. The contract that says what this farm must deliver, how fast, and under what conditions." She picked up the case. "Chapter 22 is his."*

*Kaan looked out through the control room window at the grey water. Thirty-four turbines rotating, each one generating a voltage waveform that was almost but not quite sinusoidal, each one contributing a small harmonic fingerprint to a shared grid that served millions of people who would never think about any of this. The power they received was clean enough. Not perfect. Clean enough, by agreement.*

*That, he thought, was perhaps how most things worked.*

---

## Notes

[1] Fourier and Fourier series: The 1807 memoir — "Sur la propagation de la chaleur dans les corps solides" — was presented to the Institut de France on 21 December 1807. Lagrange's objection, raised during the Academy's review, concerned Fourier's treatment of the convergence of trigonometric series for discontinuous functions — a concern that was not fully resolved mathematically until Dirichlet's 1829 proof. The ideas circulated in manuscript form and were finally published in expanded form as: Fourier, J.-B.J. (1822). *Théorie analytique de la chaleur.* Firmin Didot Père et Fils, Paris. English translation: Freeman, A. (trans.) (1878). *The Analytical Theory of Heat.* Cambridge University Press; reprinted Dover Publications (2003), ISBN 0-486-49531-0. The history of Lagrange's opposition is documented in: Grattan-Guinness, I. and Ravetz, J.R. (1972). *Joseph Fourier, 1768–1830: A Survey of His Life and Work.* MIT Press, Cambridge, MA. Also: Darboux, G. (1877). "Éloge historique de Joseph Fourier." *Mémoires de l'Académie des Sciences*, Vol. 20, pp. lxxxij–cxxxij.

[2] IEC 61000-3-6:2008. *Electromagnetic compatibility (EMC) — Part 3-6: Limits — Assessment of emission limits for the connection of distorting installations to MV, HV and EHV power systems.* Technical Report, 2nd edition, February 2008. International Electrotechnical Commission, Geneva. Note: This document is a Technical Report rather than a normative Standard. Its planning levels and allocation methodology are referenced in national grid codes including the Polish PSE *Instrukcja Ruchu i Eksploatacji Sieci Przesyłowej* (IRiESP), which may adapt the planning levels to the specific characteristics of the Polish transmission network. Planning levels in Table II apply at HV (1–145 kV); Table III at EHV (>145 kV, including the 220 kV and 400 kV levels of the PSE system).

[3] Flickermeter standard history: The UIE/IEC flickermeter was developed by Union Internationale d'Électricité working groups from the 1970s onward to standardise measurement of the eye-brain response to voltage fluctuations. First standardised as: IEC 868:1986, "Flickermeter — Functional and design specifications." Withdrawn and reissued as: IEC 61000-4-15:1997; current edition: IEC 61000-4-15:2010, "Electromagnetic compatibility (EMC) — Part 4-15: Testing and measurement techniques — Flickermeter — Functional and design specifications," 2nd edition, IEC, Geneva. Historical overview of the standard's development: Nau, J.-Y. et al. (1989). "The UIE/IEC flickermeter." *Measurement* (Elsevier), Vol. 7, No. 4, pp. 171–178. DOI: 10.1016/0263-2241(89)90024-4. The connection between arc furnaces, light flicker, and the development of power quality standards as a discipline: Arrillaga, J., Watson, N.R. and Chen, S. (2000). *Power System Quality Assessment.* John Wiley & Sons, Chichester, Chapter 1.

[4] EN 50160:2010 + A1:2015 + A2:2019 + A3:2019. "Voltage characteristics of electricity supplied by public electricity networks." CENELEC, Brussels. Flicker limits: $P_{st} \leq 1.0$ and $P_{lt} \leq 1.0$ at the 95th percentile of all measured values over any one-week period. The standard applies to the supply voltage at the customer's metering point; for an offshore wind farm, the equivalent specification appears in the grid connection agreement referencing EN 50160 at the Point of Common Coupling (PCC). Note: EN 50160 is a compatibility standard (describing the characteristic of the supply voltage in normal operating conditions) rather than an emission standard (placing limits on individual customer contributions). The emission allocation methodology for wind farms is governed by IEC 61000-3-7:2008 and IEC 61400-21-1:2021.

[5] IEC 61400-21-1:2021. "Wind energy generation systems — Part 21-1: Measurement and assessment of electrical characteristics — Wind turbines." IEC, Geneva. Supersedes IEC 61400-21:2008. The flicker coefficient $c(\psi_k, v_a)$ is determined by power quality type testing at the WTG level following the measurement protocol in Section 5 of this standard. Values for 10–15 MW class Type 4 turbines in the range $c = 0.2–0.5$ for network impedance angles of 50–85° at mean wind speeds of 7–10 m/s are consistent with published measurements from North Sea offshore farms. The $\sqrt{N}$ aggregation factor reflects the statistical independence of tower shadow events across turbines experiencing different instantaneous wind speeds.

[6] Harmonic aggregation law: The square-root summation exponent used in IEC 61000-3-6:2008 for aggregating harmonic emissions from multiple uncorrelated sources is justified by the statistical independence of converter switching phases. For large numbers of identical sources with uniformly distributed random phase angles, the aggregate harmonic voltage follows a Rayleigh distribution and the expected value of the aggregate magnitude scales as $\sqrt{N}$ times the individual magnitude. Derivation and experimental validation for offshore wind collector networks: Masetti, C. and Napolitano, F. (2008). "Definition of emission levels for the connection of large offshore wind farms to HV power systems." *Proceedings of CIGRÉ Session*, Paper C4-116, Paris, August 2008. The exponent varies from α = 1.4 (for low-order harmonics where partial phase correlation is expected) to α = 2 (for high-order harmonics where sources are essentially random) as specified in IEC 61000-3-6:2008 Annex B.

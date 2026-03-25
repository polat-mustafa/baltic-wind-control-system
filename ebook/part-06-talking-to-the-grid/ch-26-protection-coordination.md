# Chapter 26: Protection Coordination: Relay Grading and Selectivity

*The relay testing room was lit when Kaan arrived at seven in the morning, which meant Sigrid had been there since before he had.*

*He had slept four hours in the SOV, his mind still running the frequency trace from the night before: 49.68, nadir, recovery, 49.99. The event was closed. Piotr Zawadzki had said so, calmly, in complete sentences. He pushed open the relay room door with the particular alertness of someone who knows coffee is not yet working.*

*Sigrid Lund was at the workbench, not with her test set this time but with her calibration notebook open and her laptop showing a frequency trace that Kaan recognised immediately. It was the OSS measurement from last night — the same curve he had watched, annotated now in her handwriting with timestamps and protective relay output flags.*

*"Good morning," she said, without looking up. "You watched the whole event?"*

*"From the beginning. Anders kept me there."*

*"Good." She closed the calibration notebook. "Then you already know what I am going to say first."*

*She turned the laptop around. Below the frequency trace was a second trace: the output of one relay in particular, a device labelled OSS-RFP-01 on the protection single line diagram pinned to the wall behind her. The trace showed a single variable, the relay's measured rate of change of frequency, plotted in green. For the entire duration of the PSE event — Łagisza B at 22:14 through frequency recovery at 22:31 — the green line had not once crossed the horizontal threshold marked in red at 2.0 Hz per second. Its maximum value, at the deepest point of the frequency nadir, had been 0.019 Hz per second.*

*"The relay was watching," Sigrid said. "It saw everything. It decided not to act." She paused. "That was the correct decision. But correct decisions from protection relays are not accidents. They are the result of a grading calculation done months before the event, on a workbench, at two in the afternoon, when nobody's frequency was falling."*

*She set her coffee down and picked up a marker. On the whiteboard behind her, next to a circuit diagram that had been there since Ch 19, she drew a new diagram — a horizontal line representing the network, with five points marked on it.*

*"Today I am going to show you how we make sure the correct relay trips — and only the correct relay — every time. Then I am going to show you what happens when that calculation is wrong."*

*She wrote two words on the whiteboard in block capitals: SOUTH AUSTRALIA.*

*"September 28, 2016," she said. "The wind farms tripped correctly. That was the problem."*

---

## 26.1 The Four Pillars of Protection Philosophy

Protection engineering rests on four requirements that stand in partial tension with each other, which is precisely what makes the discipline difficult.

**Selectivity** — sometimes called discriminativity — is the requirement that only the protection device closest to the fault should operate. The relay protecting the cable between turbines 3 and 4 should trip its associated circuit breaker; the relay protecting the entire array feeder should not, unless the first device fails. Selectivity is the foundation of all grading calculations.

**Reliability** encompasses two things that engineers sometimes conflate: *dependability*, the assurance that protection will operate when it must, and *security*, the assurance that it will not operate when it should not. A relay that trips for every fault is perfectly dependable but may be catastrophically insecure. A relay that never operates spuriously is perfectly secure but useless if it also fails to clear genuine faults. The tension between dependability and security is the central design trade-off in every protection setting exercise.

**Sensitivity** is the requirement that protection detect the minimum expected fault current, including faults with high arc resistance or faults near the pickup threshold. In a radial 66 kV network fed from a single offshore substation, a fault at the far end of a long array cable may see a significantly reduced fault current due to the cable's series impedance. A relay set to a pickup current that misses this minimum case is insensitive — and insensitivity in protection engineering has the same consequence as dependability failure.

**Speed** is the requirement to clear faults fast enough to prevent equipment damage and inhibit cascade. The energy deposited in an arc is proportional to I²t. For a 12,700 A fault at 66 kV, each additional 100 ms of fault duration represents roughly 9 kJ of additional arc energy — enough, in a confined cable trench, to propagate the fault from one circuit to an adjacent one. Speed and selectivity are in fundamental tension: the most selective scheme is a time-graded scheme with deliberately introduced delays, and those delays are paid for in arc energy and equipment stress.

The protection engineer's craft is finding the combination of relay type, pickup setting, time characteristic, and communication scheme that satisfies all four requirements simultaneously — or, more commonly, determining where the trade-offs must be accepted and documenting why.

---

## 26.2 A Map of the Farm's Protection Zones

A 500 MW offshore wind farm does not have a single protection system. It has six overlapping zones, each the responsibility of a different relay or group of relays, each with its own operating time window.

**Zone 1 — Within the turbine:** The WTG controller and its embedded protection monitor the generator, converter, transformer, and low-voltage switchgear at 0.69 kV. Overcurrent, earth fault, differential, and thermal protection are all integrated within the turbine controller by the manufacturer. Operating times are typically 20–80 ms. Zone 1 protection is not designed or commissioned by the grid connection team; it is an inherited part of the turbine supply.

**Zone 2 — 66 kV array cables:** Each array feeder (connecting five to six turbines to the offshore substation 66 kV busbar) is protected by overcurrent relays at the feeder incomer in the OSS, backed up by time-graded overcurrent relays at individual turbine 66 kV switchgear positions. Operating times range from 300 ms (outermost relay, nearest the turbine) to 900 ms (OSS incomer backup). A cable differential relay (87L) using the fibre optic core embedded in the cable provides instantaneous primary protection.

**Zone 3 — 66 kV OSS busbar:** A busbar differential relay (87B) monitors all current inflows and outflows on the 66 kV busbar. Any discrepancy — a current that flows in but does not flow out, indicating a busbar fault — triggers instantaneous operation in approximately 20–30 ms. The 66 kV busbar is the electrical heart of the offshore substation; a busbar fault that is not cleared in under 30 ms will damage all equipment connected to it.

**Zone 4 — OSS power transformers:** Two transformer differential relays (87T), one per transformer, compare current on the 66 kV primary winding with current on the 220 kV secondary winding, normalised for the turns ratio and vector group. Faults inside the transformer — turn-to-turn, winding-to-core, bushing — produce a differential current that trips both primary and secondary circuit breakers within 30–80 ms. A Buchholz relay (gas-actuated, inside the transformer tank) provides additional non-electrical protection for incipient internal faults, connecting to the protection scheme through an alarm-only path for gas accumulation and a trip path for sudden gas surge.

**Zone 5 — 220 kV export cable, 45 km to shore:** A pilot differential relay (87L) uses the fibre optic pair in the cable to compare currents at the offshore substation and the onshore termination point. Any in-zone fault trips both ends of the cable simultaneously, within 40–60 ms. A distance relay (21) at the offshore end provides backup protection for scenarios where the pilot communications path is lost.

**Zone 6 — Onshore GIS and 400 kV connection:** Conventional distance protection (21) and backup overcurrent (51) at the onshore substation protect the interface with the transmission network. Protection settings in this zone are specified by the TSO (PSE in this case) and must be coordinated with the zones described above.

<!-- IMAGE: fig-26-01 -->
> **[Figure 26.1]** — Protection Zone Map: 500 MW Offshore Wind Farm
> **Type:** Schematic diagram
> **Content:** Single-line diagram from WTG low-voltage terminals through 66 kV array and OSS to 220 kV export cable and onshore connection. Each zone (1-6) shaded in a distinct colour with associated relay designations (87T, 87B, 87L, 21, 51/IDMT) and approximate operating times annotated.
> **Caption:** Six overlapping protection zones for a 500 MW offshore wind farm. Each zone is the responsibility of a specific relay type with defined operating time windows. Where zones overlap, the inner zone's relay operates first; the outer zone provides backup.
> **Alt text:** Single-line diagram showing six protection zones from turbine terminals to onshore grid connection, with relay symbols and operating times annotated at each zone boundary.
> **Data source:** Author illustration, based on IEC 61850-7-4 protection functions and IEC 60255-151.
> **Resolution:** 1800 × 900 px minimum
> **Color notes:** Zone 1 light blue, Zone 2 green, Zone 3 orange, Zone 4 red, Zone 5 purple, Zone 6 grey.

---

## 26.3 IDMT Overcurrent Relays — The Workhorse of the Array

The inverse definite minimum time (IDMT) overcurrent relay is the oldest relay principle still in widespread use, and for good reason. Its operating characteristic is a curve, not a fixed time threshold, and the shape of that curve corresponds to a physical truth about radial power systems.

The physical truth is this: in a radial network, the closer a fault is to the source, the higher the fault current. A three-phase fault at the 66 kV busbar of the offshore substation produces perhaps 12,700 A. The same fault type at the far end of a 10 km array cable — through the cable's series impedance — might produce only 4,000 A. The IDMT relay exploits this relationship: it trips quickly for high currents (nearby faults) and slowly for low currents (distant faults). The time delay is inherent in the physics, not imposed arbitrarily.

The operating time is given by the IEC 60255-151 formula:

$$
t = \text{TMS} \times \frac{K}{\left(\dfrac{I}{I_s}\right)^\alpha - 1}
$$

where:
- $t$ = relay operating time [s]
- $\text{TMS}$ = time multiplier setting [dimensionless] — scales the entire curve up or down
- $I$ = measured fault current [A]
- $I_s$ = relay pickup (start) current setting [A]
- $K$, $\alpha$ = curve coefficients, defined by IEC 60255-151 for each characteristic type

The three standard characteristics and their coefficients are:

| Characteristic | K | α | Physical description |
|---|---|---|---|
| Standard Inverse (SI) | 0.14 | 0.02 | Mild inverse — similar operating times across a wide current range |
| Very Inverse (VI) | 13.5 | 1.0 | Strongly inverse — large reduction in operating time as current increases |
| Extremely Inverse (EI) | 80.0 | 2.0 | Steep inverse — used where high inrush discrimination is needed |

For array cable protection, Standard Inverse is typically used. At a fault current eight times the pickup (I/Is = 8, a typical maximum value for a remote array fault), Standard Inverse gives approximately one-quarter of the time that an inverse definite time relay would give at pickup — fast enough for coordination while still providing adequate grading margin at lower fault currents.

The pickup current $I_s$ is set to detect the minimum expected fault current while remaining above the maximum load current. A typical setting is 1.2 × I_rated, with a minimum pickup of 1.1 × I_rated to ensure the relay does not operate during sustained overloads within the cable's thermal capacity.

<!-- IMAGE: fig-26-02 -->
> **[Figure 26.2]** — IDMT Relay Characteristic Curves: Standard Inverse, Very Inverse, Extremely Inverse
> **Type:** Log-log chart
> **Content:** Three curves on log-log axes (x: I/Is from 1.5 to 20; y: operating time in seconds from 0.1 to 100) for Standard Inverse, Very Inverse, and Extremely Inverse, all at TMS = 1.0. Horizontal minimum time dashed line at 0.05 s. Annotations showing operating time at I/Is = 4, 8, and 16 for each curve.
> **Caption:** IDMT relay characteristic curves per IEC 60255-151 at TMS = 1.0. The Extremely Inverse curve is most sensitive to changes in fault current magnitude, making it useful for discriminating between close-in and remote faults in networks with large variation in fault current with distance.
> **Alt text:** Log-log chart showing three IDMT relay curves — Standard Inverse, Very Inverse, and Extremely Inverse — with operating time in seconds on the y-axis and fault current multiple I/Is on the x-axis.
> **Data source:** IEC 60255-151:2023, Table 1.
> **Resolution:** 1200 × 900 px
> **Color notes:** Standard Inverse blue, Very Inverse orange, Extremely Inverse red.

---

## 26.4 Grading and the Coordination Time Interval

The IDMT characteristic solves half the problem. The other half is ensuring that when a fault occurs on any section of the array cable, the nearest upstream relay trips before the next relay in the chain — and that the margin between them is wide enough to account for real-world timing uncertainties.

This margin is the coordination time interval (CTI), and it is the parameter that determines the architecture of the entire time-graded scheme. It is not a single setting but the sum of four uncertainty components:

$$
\text{CTI} \geq \Delta t_{cb} + \Delta t_{os} + \Delta t_{err} + \Delta t_{margin}
$$

where:
- $\Delta t_{cb}$ = circuit breaker interrupting time [s] — typically 0.06 s for a modern vacuum circuit breaker (3 cycles at 50 Hz)
- $\Delta t_{os}$ = relay overshoot time [s] — the time a current relay continues to integrate after the current drops to zero, due to the disc or electronic equivalent continuing to rotate. Typically 0.05 s for modern digital relays, up to 0.10 s for electromechanical.
- $\Delta t_{err}$ = relay timing tolerance [s] — IEC 60255-151 allows ±5% timing error at any point on the characteristic; at a 600 ms operating time, this is ±30 ms = 0.03 s per relay, or 0.06 s for two relays in series.
- $\Delta t_{margin}$ = safety margin [s] — accounts for systematic errors, CT saturation effects, and unforeseen conditions. Typically 0.10 s.

For this installation: CTI = 0.06 + 0.05 + 0.06 + 0.10 = **0.27 s**, rounded to **0.30 s** for conservatism.

The practical consequence of this number is that every relay in the chain must operate at least 0.30 seconds after the relay it is backing up, for any fault current that both relays could see. This means the TMS of each successive relay (moving from the load end toward the source) must be set higher, giving the inner relay a deliberately longer operating time.

The grading runs from the outermost relay (nearest the turbine, at the farthest point from the source) back toward the source. The outermost relay gets the lowest TMS — the fastest operating time — because it is backing up nothing except the turbine's own internal protection. Every successive relay gets a TMS that places its operating time at least CTI seconds above the previous one, at the maximum fault current that both relays could see simultaneously.

This is the key insight: grading is performed at the maximum current, because that is where the curves are closest together. At lower currents, the curves diverge and the grading margin widens automatically due to the inverse characteristic. Engineers who grade at minimum fault current often discover that at maximum current the curves overlap — which means the backup trips before (or simultaneously with) the primary, destroying selectivity.

---

## 26.5 Differential Protection — The Surgeon's Instrument

IDMT overcurrent grading provides selectivity through time. Differential protection provides selectivity through physics: a differential relay operates only when current flows into its protected zone and does not flow out — a condition that is definitionally a fault inside the zone and cannot be reproduced by any external through-fault, regardless of magnitude.

The operating principle is Kirchhoff's current law applied as a protection criterion. For a healthy transformer or cable, all current that flows in at one terminal flows out at the other. Sum the currents at all terminals (accounting for turns ratio and vector group), and the result should be zero. A fault inside the zone creates a path for current to leave the zone without passing through a metered terminal — the sum is no longer zero, and the relay operates.

The differential relay's characteristic is expressed as an operating condition rather than a time formula:

$$
I_{op} \geq k_r \cdot I_{bias} + I_{op,\min}
$$

where:
- $I_{op}$ = differential (operating) current $= |{\mathbf{I}_1 + \mathbf{I}_2}|$ [pu of relay rated current]
- $k_r$ = bias slope (restraint factor) [dimensionless] — typically 0.20 to 0.40
- $I_{bias}$ = restraint (bias) current $= (|\mathbf{I}_1| + |\mathbf{I}_2|) / 2$ [pu of relay rated current]
- $I_{op,\min}$ = minimum operating current (relay sensitivity threshold) — typically 0.10 to 0.20 pu

The bias term $k_r \cdot I_{bias}$ serves a critical function. During a through-fault (a fault outside the protected zone but passing through it), both terminal currents are large but their sum is nominally zero. In practice, CT saturation during high through-fault current causes the CT secondary currents to be slightly different from their true ratio — a small false differential signal appears. Without the bias term, the relay might trip for this false signal. The bias term raises the operating threshold in proportion to the through-fault current, ensuring that the relay remains restrained even when CT saturation produces a spurious differential current up to $k_r$ times the through-current.

For the offshore substation's 66/220 kV power transformers, the transformer differential relay (87T) must also account for the transformer's vector group. A Dyn11 transformer (delta primary, star secondary, 30° phase shift) produces a natural 30° phase difference between primary and secondary current phasors. Uncorrected, this appears as a large differential current in every phase. The relay corrects for this mathematically, applying a phase rotation to the secondary phasor set before computing $I_{op}$.

The 66 kV array cable differential relay (87L) compares current at the offshore substation end of the cable with current at the far end, measured by a CT at the last turbine in the string and transmitted via the fibre optic pair embedded in the cable jacket. A fault anywhere on the cable — including a fault in the sea, invisible to any non-pilot protection — produces a discrepancy between the two ends that the relay detects within one to two power frequency cycles: 20–40 ms.

For the 220 kV export cable, the 87L pilot protection uses the same principle across 45 km of submarine cable. Measured data from the onshore end arrives at the offshore relay with a communications latency of roughly 0.15–0.2 ms (signal velocity through fibre: approximately 200,000 km/s). This propagation delay is negligible relative to the protection operating time and is compensated automatically in modern protection IEDs using time-stamped sample synchronisation.

---

## 26.6 Distance Protection and the Export Cable Challenge

Where pilot communications are unavailable or where backup protection is required without communications dependence, distance protection (ANSI relay function 21) provides selectivity by measuring the impedance from the relay to the fault.

The relay continuously computes the apparent impedance of the connected network:

$$
\mathbf{Z}_{apparent} = \frac{\mathbf{V}_{relay}}{\mathbf{I}_{relay}}
$$

Under normal load conditions, this apparent impedance is large — the load impedance seen by the relay. When a fault occurs on the cable, the relay's voltage collapses toward zero while the current remains high. The apparent impedance falls sharply. The relay compares this impedance to pre-defined zones:

$$
Z_{1} = 0.80 \times Z_{cable,total}, \qquad Z_{2} = 1.20 \times Z_{cable,total}
$$

where $Z_{cable,total}$ is the total positive-sequence impedance of the export cable (both resistive and reactive components, in ohms at the relay's voltage base).

Zone 1 reaches 80% of the cable: faults within the first 80% of its length produce an apparent impedance below $Z_1$ and are tripped instantaneously (within one to two cycles). The 20% underreach is deliberate — it prevents the Zone 1 relay from operating for faults just beyond the remote terminal, where voltage and current measurement errors could produce an apparent impedance that momentarily falls within Zone 1.

Zone 2 reaches 120% of the cable: faults in the last 20% of the cable (beyond Zone 1's reach) are cleared by Zone 2 with a deliberate time delay — typically 0.3 to 0.5 s — to allow the remote-end relay to operate first. With communications (a permissive over-reach transfer trip, or POTT scheme), Zone 2 can be made instantaneous: the remote relay accelerates the local relay's Zone 2 when it detects a fault in its forward direction.

The cable poses a complication that overhead-line distance relays do not face: shunt capacitive charging current. Every 66 kV and 220 kV cable generates reactive current proportional to its voltage, capacitance, and length:

$$
\mathbf{I}_{c} = V_{phase} \cdot j\omega C \cdot L
$$

where:
- $V_{phase}$ = phase-to-ground voltage [V]
- $\omega = 2\pi \times 50$ [rad/s]
- $C$ = cable capacitance per unit length [F/m]
- $L$ = cable length [m]

The relay's measured current includes not only the load and fault current but also this charging current. Because $\mathbf{I}_c$ is 90° ahead of the voltage in phase, the computed apparent impedance rotates toward a more capacitive (lower) value than the true fault impedance. For the 45 km export cable with a capacitance of approximately 0.20 μF/km and operating at 220 kV line voltage, the charging current reaches:

$$
I_c = \frac{220{,}000}{\sqrt{3}} \cdot 2\pi \times 50 \cdot 0.20 \times 10^{-6} \cdot 45{,}000 \approx 359 \text{ A per phase}
$$

This 359 A of reactive current — present at all times, independent of load — is seen by the distance relay as a source of measurement error. Under full load (510 MW / (√3 × 220 kV) ≈ 1,340 A), the charging current represents about 27% of the relay's measured current. Modern cable protection relays include charging current compensation algorithms and quadrilateral (rather than mho circular) tripping characteristics, which allow the operating boundary to be defined independently in the resistive and reactive impedance directions. This flexibility is essential for cable distance protection to remain selective across the full range of loading and fault resistance conditions.

<!-- IMAGE: fig-26-03 -->
> **[Figure 26.3]** — Distance Relay Zone Definitions and Apparent Impedance Trajectories
> **Type:** R-X impedance plane diagram
> **Content:** Complex impedance plane (R on x-axis, X on y-axis). Cable impedance vector shown as a straight line from origin at cable angle (~60–70°). Zone 1 reach at 80% of cable length, Zone 2 reach at 120%. Load impedance region shown in upper right. Fault trajectory from load impedance to fault point shown with arrows for a fault at 50%, 80%, and 95% of cable length. Charging current distortion illustrated as a rotated apparent impedance vector.
> **Caption:** Zone 1 and Zone 2 distance relay reach on the R-X impedance plane for a 45 km 220 kV export cable. Faults within Zone 1 (80% reach) are cleared instantaneously; faults between 80% and 120% are cleared by Zone 2 with a communications-assisted trip or a time delay.
> **Alt text:** R-X impedance plane showing Zone 1 and Zone 2 tripping boundaries for a 45 km 220 kV submarine cable, with load impedance region and fault trajectory arrows.
> **Data source:** Author illustration, based on IEC 60255-128 and IEC 60909-0 parameters.
> **Resolution:** 1200 × 1200 px (square aspect ratio)
> **Color notes:** Zone 1 green, Zone 2 amber, load region grey hatching, cable impedance vector blue.

---

## 26.7 The Relay That Watched Last Night

Sigrid had waited until this point in the morning before returning to the South Australia diagram on the whiteboard.

At 15:50 on 28 September 2016, a severe storm over South Australia destroyed 23 transmission pylons. The resulting faults on the 275 kV network produced six voltage dips across the South Australian grid within 120 seconds — not one after the other in a neat sequence, but in a chaotic cascade driven by faults on the Brinkworth-Templers line and then the Davenport-Belalie and Davenport-Mount Lock lines. Each voltage dip was individually survivable by the wind turbines. That is, each turbine had adequate low-voltage ride-through (LVRT) capability — the ability to remain connected during a brief voltage depression and recover. This had been verified, tested, and certified.

What had not been verified — because nobody at the Australian Energy Market Operator had been told it existed — was a second protection feature embedded in the firmware of turbines from two manufacturers: a cumulative ride-through counter. The logic was simple:

$$
\begin{cases}
\text{Ride through} & \text{if } n_{FRT}(\Delta t) \leq n_{max} \\
\text{Disconnect} & \text{if } n_{FRT}(\Delta t) > n_{max}
\end{cases}
$$

where $n_{FRT}(\Delta t)$ was the number of low-voltage events recorded within a rolling time window $\Delta t$ and $n_{max}$ was a manufacturer-configured threshold. For some turbine models at the affected farms, $n_{max}$ was set to 6 events in 120 seconds. Others were set to 5. At least one group was set to 2.

The sixth voltage dip, at approximately 16:16, triggered the threshold. Nine wind farms — 456 MW — disconnected within seven seconds. The remaining conventional generation could not compensate for the loss. South Australia experienced a complete system blackout. 850,000 customers lost power.

The AEMO investigation, published in March 2017, found not that the turbines had malfunctioned, but that their protection settings had never been disclosed to, or modelled by, the grid operator. The cumulative counter was individually rational — it prevented turbines from suffering repeated mechanical stress from sequential LVRT events — but it had been set, installed, and operated without grid operator knowledge. Each turbine's settings were technically correct in isolation. The consequence of applying them simultaneously, in a stressed network, was a total blackout.

"That is what happens," Sigrid said, "when protection settings are designed at the device level without coordination at the system level. Each manufacturer made a defensible engineering decision. The aggregate of those decisions was a state-wide power failure."

She set the marker down. "Our RoCoF relay set to 2.0 Hz per second is not arbitrary. It is coordinated with the PSE requirement, which is coordinated with the NC RfG Article 14 mandatory withstand level for Type D generation, which is coordinated with the maximum rate of change of frequency that the CE synchronous area can produce from a credible single contingency event." She pointed at the frequency trace from the previous night, the green line that had peaked at 0.019 Hz/s and never approached 2.0. "Last night, the relay watched the event with a margin of 99 percent. That margin exists by design. It was calculated, not assumed."

$$
\left|\frac{df}{dt}\right| > \text{RoCoF}_{trip} = 2.0 \text{ Hz/s} \quad \Rightarrow \quad \text{relay trips}
$$

where $\text{RoCoF}_{trip}$ is the coordinated threshold from PSE Grid Connection Agreement clause 5.4.3, derived from NC RfG Article 14 and verified against the worst-case CE contingency event characterised in ENTSO-E's frequency stability evaluation criteria.

The measured RoCoF during the Łagisza B event: $|\mathrm{d}f/\mathrm{d}t|_{max} = 0.019$ Hz/s. The relay's operating margin: $2.0 / 0.019 = 105$. The relay did not trip because the grid event — large as it was in human terms — was well within the designed operating envelope of the continental synchronous area.

> **Standard reference:** IEC 60255-181:2019, "Measuring relays and protection equipment — Part 181: Functional requirements for frequency protection" — Clause 7.3 (rate-of-change-of-frequency protection functional requirements) and Table 2 (accuracy requirements for df/dt measurement at different frequency deviation levels). The IEC 60255-181 requirements apply to the OSS-RFP-01 relay's RoCoF measurement accuracy at all operating points from 47.5 Hz to 52.5 Hz.

---

## 26.8 Current Transformers — The Interface Between Primary and Secondary

Every relay discussed in this chapter measures something it cannot directly sense: the primary circuit current in a conductor carrying tens of thousands of amperes at 66 or 220 kV. What the relay actually measures is the secondary output of a current transformer (CT), which scales the primary current by a fixed turns ratio and presents it at a safe secondary level — typically 1 A or 5 A rated.

The CT introduces measurement uncertainty that directly limits protection performance. The key parameter is the accuracy limit factor (ALF), specified by IEC 61869-2:

$$
K_{ALF} = \frac{I_{c,ALF}}{I_n}
$$

where:
- $K_{ALF}$ = accuracy limit factor [dimensionless] — the multiple of rated current at which the CT's composite error does not exceed 5%
- $I_{c,ALF}$ = accuracy limit current [A]
- $I_n$ = CT rated primary current [A]

A CT specified as 600/5 A Class 5P20 has a rated primary current of 600 A and an accuracy limit factor of 20 — meaning the CT maintains its composite error below 5% for primary currents up to 20 × 600 = 12,000 A. Above this threshold, the CT saturates: the iron core reaches its magnetic flux limit, the secondary output no longer faithfully reproduces the primary current, and the protection relay sees a distorted signal.

CT saturation during through-faults is the primary motivation for the bias slope in differential protection (Section 26.5) and for the timing uncertainty term $\Delta t_{err}$ in the CTI calculation (Section 26.4). A CT that saturates during a 12,700 A through-fault produces a false differential current that could trip the 87T relay without a transformer fault; the bias slope prevents this. A CT that saturates at the maximum fault current also produces a delayed secondary signal, extending the relay's apparent operating time — the $\Delta t_{err}$ term accounts for this possibility.

For the array cable CTs, the ALF specification must be checked against the maximum expected fault current at the relay's location. An array incomer CT rated 800/5 A Class 5P20 will maintain accuracy to 16,000 A — comfortably above the 12,700 A maximum fault current at the 66 kV busbar. A CT at a turbine position, where the fault current may be only 4,000–6,000 A, can use a lower ALF, reducing the CT's physical size and cost.

<!-- IMAGE: fig-26-04 -->
> **[Figure 26.4]** — CT Excitation Curve and Saturation Region
> **Type:** Semi-log chart
> **Content:** CT secondary excitation voltage (y-axis, linear, 0-800 V) vs. excitation current (x-axis, logarithmic, 1 mA to 10 A). Curve shows linear region at low excitation, knee point, and saturation region. Accuracy limit current $I_{c,ALF}$ marked with vertical dashed line. Secondary burden operating point marked. Region of >5% composite error shaded in red to the right of the ALF marking.
> **Caption:** CT excitation curve showing the knee point and saturation region. The accuracy limit factor specifies the maximum multiple of rated primary current at which composite error remains below 5%. Above this point, CT saturation can distort relay measurements and invalidate time-grading calculations.
> **Alt text:** Semi-log chart of CT excitation voltage versus excitation current, with knee point and accuracy limit current marked. Saturation region where composite error exceeds 5% is shaded.
> **Data source:** IEC 61869-2:2012, Annex 2A.
> **Resolution:** 1200 × 900 px
> **Color notes:** Linear region blue, saturation region red shading, knee point marker orange.

---

## 26.9 Worked Example: Grading a 66 kV Array Feeder

**Setup:** A 66 kV array feeder connects four 15 MW turbines in series to the offshore substation 66 kV busbar. Total feeder capacity: 60 MW. Three overcurrent relays are in series: R1 at the last turbine position (Turbine 4), R2 at the feeder midpoint (Turbine 2), and R3 at the OSS feeder incomer.

**Network data (from Chapter 18 load flow and Chapter 19 fault analysis):**
- Normal load current at 66 kV, full output: $I_{rated} = 60{,}000 / (\sqrt{3} \times 66 \times 0.95) = 553$ A
- Maximum fault current at OSS 66 kV busbar: 12,700 A (three-phase, from Chapter 19)
- Estimated fault current at feeder midpoint (2 km array cable, 0.12 Ω/km positive-sequence impedance): approximately 8,200 A
- Estimated fault current at Turbine 4 position (4 km total cable): approximately 5,100 A

**CT and relay specifications:**
- R1 and R2: 600/5 A Class 5P20; relay pickup $I_s$ = 660 A (1.2 × rated, rounded); Standard Inverse (SI) characteristic
- R3: 800/5 A Class 5P20; relay pickup $I_s$ = 880 A (note: higher to account for full feeder load, preserving sensitivity margin); Standard Inverse

**Step 1 — Grade R1 (outermost, fastest):**

At fault current 5,100 A:
$$\frac{I}{I_s} = \frac{5{,}100}{660} = 7.73$$

Using the Standard Inverse formula with TMS = 0.10 (minimum practical setting):
$$t_{R1} = 0.10 \times \frac{0.14}{7.73^{0.02} - 1} = 0.10 \times \frac{0.14}{0.04544} = 0.308 \text{ s}$$

**Step 2 — Grade R2 (requires CTI = 0.30 s above R1 at the same fault current):**

$$t_{R2} = t_{R1} + \text{CTI} = 0.308 + 0.30 = 0.608 \text{ s}$$

Solving for TMS at the same I/Is = 7.73:
$$\text{TMS}_{R2} = \frac{0.608 \times 0.04544}{0.14} = 0.197 \to \text{set } \textbf{0.20}$$

**Step 3 — Grade R3 (requires CTI above R2):**

At fault current 5,100 A, R3 sees the same primary current but through an 800/5 CT: $I/I_s = 5{,}100 / 880 = 5.80$.

$$5.80^{0.02} - 1 = e^{0.02 \ln 5.80} - 1 = e^{0.03473} - 1 = 0.03535$$

$$t_{R2} \text{ at } I/I_s = 5.80: \quad 0.20 \times \frac{0.14}{0.03535} = 0.793 \text{ s}$$

$$t_{R3} = 0.793 + 0.30 = 1.093 \text{ s}$$

$$\text{TMS}_{R3} = \frac{1.093 \times 0.03535}{0.14} = 0.276 \to \text{set } \textbf{0.28}$$

**Step 4 — Verify R3 at maximum fault current (12,700 A):**

$$\frac{I}{I_s} = \frac{12{,}700}{880} = 14.43$$

$$14.43^{0.02} - 1 = e^{0.02 \times \ln 14.43} - 1 = e^{0.05338} - 1 = 0.0548$$

$$t_{R3} = 0.28 \times \frac{0.14}{0.0548} = 0.715 \text{ s}$$

**Step 5 — Comparison with primary protection:**

The 66 kV cable differential relay (87L) clears the same in-zone fault in 25–40 ms — 18 times faster than R3's overcurrent backup at maximum fault current. The overcurrent scheme exists to provide backup if the 87L pilot communications path fails, or if a fault occurs in the switchgear bay (between CT and circuit breaker) where the 87L is not the primary protection.

**Grading summary:**

| Relay | Location | I_s [A] | TMS | t at 5,100 A fault [s] | t at 12,700 A fault [s] |
|---|---|---|---|---|---|
| R1 | Turbine 4 (feeder end) | 660 | 0.10 | 0.308 | 0.097 |
| R2 | Turbine 2 (midpoint) | 660 | 0.20 | 0.608 | 0.194 |
| R3 | OSS incomer | 880 | 0.28 | 1.093 | 0.715 |
| 87L | Cable differential | — | — | 0.025–0.040 | 0.025–0.040 |

The grading is correct: at every fault location, R1 operates before R2, R2 operates before R3, and the CTI margin of 0.30 s is maintained between adjacent relays at the critical coordination current of 5,100 A. At the higher fault current of 12,700 A, the inverse characteristic causes all three relays to operate faster — but R1 remains fastest, and the ordering is preserved.

The complete economic consequence of this scheme: a cable fault that the 87L clears in 35 ms costs roughly 3 kJ of arc energy per phase. If the 87L fails and R1 operates instead (308 ms), the arc energy rises to 26 kJ per phase — still tolerable. If R1 also fails and R3 provides backup (715 ms), the arc energy reaches 61 kJ per phase — within the cable's fault withstand capability for a properly selected cable but approaching the threshold for adjacent cable damage. The grading calculation directly determines how much of the cable infrastructure is at risk in a worst-case protection failure scenario.

---

## Key Takeaways

- **Selectivity is achieved through time, position, or physics.** Time-graded IDMT overcurrent relays achieve selectivity through deliberately introduced delays — the nearest relay trips first because its time multiplier is lowest. Differential relays achieve selectivity through physics — they respond only to currents that violate KCL at their zone boundary, making them inherently immune to through-faults.

- **The coordination time interval (CTI) defines the architecture of the graded scheme.** Every relay, circuit breaker, and CT specification downstream of the CTI calculation must be consistent with it. A breaker that clears in 80 ms instead of 60 ms silently invalidates a CTI calculation that assumed 60 ms — and the violation may not manifest until a fault occurs in conditions that have never been tested.

- **Grading must be verified at maximum fault current.** The inverse time characteristic causes relay curves to converge at high fault currents. A grading calculation performed only at minimum fault current may show adequate margins that disappear entirely when a close-in bolted fault drives the current to its maximum value.

- **Protection settings that are not disclosed to the grid operator are a systemic risk, not an individual device risk.** The South Australia 2016 blackout was not caused by a relay malfunction. It was caused by settings that were individually defensible, collectively undisclosed, and impossible to coordinate because their existence was unknown. All protection settings for grid-connected plant must be approved by the TSO before commissioning.

- **The margin between measured RoCoF and the relay threshold is an engineered quantity, not an observed one.** Last night's 105× margin — 0.019 Hz/s measured against a 2.0 Hz/s threshold — was designed into the relay setting through coordination with the NC RfG Article 14 withstand requirement, the PSE grid connection agreement, and the CE synchronous area's maximum credible contingency. The margin was not lucky. It was calculated.

---

## For Further Reading

1. Warrington, A. R. van C. (1968). *Protective Relays: Their Theory and Practice*, Volume 1. Chapman & Hall, London. ISBN 978-0412093807.[^1]

2. AEMO (2017). *Black System South Australia 28 September 2016: Final Report*. Australian Energy Market Operator, Melbourne, March 2017. Available at aemo.com.au.[^2]

3. IEEE Power System Relaying and Control Committee (2008). *IEEE Guide for Protective Relay Applications to Transmission Lines*, IEEE Std C37.113-2015. IEEE, New York. DOI: 10.1109/IEEESTD.2015.7404435.[^3]

---

*Sigrid closed the calibration notebook and set it on the shelf beside the secondary injection test set. The relay room had been quiet all morning — the kind of quiet that exists in rooms where the equipment being commissioned operates at 220,000 volts and the engineering culture does not permit hurrying.*

*"The grading calculation," she said, "takes an afternoon. The documentation takes another afternoon. The review — someone checking the calculation who did not make it — takes a third afternoon. Then it goes to PSE for approval. They sometimes have questions. You answer the questions, update the documentation, and then it goes back." She picked up her coffee. "All of that work exists so that if a thermal plant in eastern Poland trips at 22:14 on a Tuesday night, your protection system can watch the event, decide correctly that it is not required to act, and report the RoCoF peak in the morning log as 0.019 Hz per second."*

*Kaan looked at the relay cabinet on the wall. Behind that steel door was a device that had been watching last night, measuring frequency at 50 times per second, comparing its measurements against a threshold set on a workbench months ago by the person standing beside him. The threshold had been correct. The relay had decided correctly. That was the entire point.*

*"There is one more problem," Sigrid said. She picked up the marker again and wrote on the whiteboard beneath the South Australia diagram. The word she wrote was not a protection designation or a relay function code. It was a frequency: not the grid frequency, but a much lower one. "Twelve hertz," she said. "Sometimes seven. Sometimes as low as four." She drew a small sinusoidal wave beneath it.*

*"It is not a fault. There is no overcurrent. There is no voltage collapse. But if you leave it unchecked, it will trip your protection, damage your cables, and eventually take the farm offline — and your overcurrent relays and your differential protection and your distance relays will watch it happen and decide, correctly, that it is not their problem." She capped the marker. "That is tomorrow. But first, go sleep."*

*She was already writing in her calibration notebook when the relay room door closed.*

---

## Notes

[^1]: Warrington, A. R. van C. (1968). *Protective Relays: Their Theory and Practice*, Volume 1. Chapman & Hall, London. ISBN 978-0412093807. Despite its age, Warrington's two-volume treatment of relay principles remains unsurpassed for depth of explanation and physical insight. Volume 1 covers overcurrent and impedance protection (Chapters 3-6) with rigorous derivations of IDMT curve characteristics and graphical grading methods that remain directly applicable to modern numerical relays. Chapter 5's treatment of the coordination time interval — including the original breakdown of breaker clearing time, relay overshoot, timing tolerances, and safety margin — is the direct ancestor of the CTI formula presented in section 26.4 of this chapter. Engineers who implement protection coordination using modern software tools without understanding the underlying physics will find that Warrington cures that deficiency efficiently and permanently.

[^2]: AEMO (2017). *Black System South Australia 28 September 2016: Final Report*. Australian Energy Market Operator, Melbourne, March 2017. Available at: [aemo.com.au/energy-systems/electricity/national-electricity-market-nem/market-notices-and-events/power-system-incident-reports/2017/integrated-final-report-sa-black-system-28-september-2016]. The definitive technical investigation of the event described in section 26.7. Sections 6 and 7 contain the protection system analysis, including the wind turbine manufacturer protection settings (Table 7-3), the timeline of wind farm disconnections (Figure 6-4), and the AEMO's determination that cumulative ride-through counter settings were neither disclosed nor modelled in pre-connection assessments. Appendix C provides the corrective action directions that followed, which form the basis for the updated Australian LVRT and protection setting disclosure requirements implemented after 2017. Engineers designing wind farm protection settings for any jurisdiction will find this report a comprehensive practical guide to what can go wrong when protection coordination is treated as a device-level rather than system-level discipline.

[^3]: IEEE Power System Relaying and Control Committee (2015). *IEEE Guide for Protective Relay Applications to Transmission Lines*, IEEE Std C37.113-2015. IEEE, New York. DOI: 10.1109/IEEESTD.2015.7404435. This guide covers distance, overcurrent, and pilot protection applications for transmission-class lines and cables, including specific guidance on cable distance protection (Section 7) that addresses the capacitive charging current compensation problem described in section 26.6. Section 7.3.2 treats the apparent impedance measurement error due to shunt capacitance and the recommended methods for quadrilateral characteristic setting. Section 9 covers coordination of line protection with generator protection — directly relevant to the coordination between the OSS protection zones described in this chapter and the Type 4 converter protection discussed in Chapter 19. Annex A provides worked examples for both overhead line and cable applications. The guide is written for practising engineers rather than academics and assumes working familiarity with relay IED parameterisation and CT burden calculations.

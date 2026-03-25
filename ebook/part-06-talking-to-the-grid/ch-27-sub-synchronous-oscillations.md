# Chapter 27: Sub-Synchronous Oscillations and Converter Stability

*The relay room door was still closed when Kaan passed it in the corridor. Through the narrow wire-glass window he could see Sigrid's whiteboard — the South Australia diagram, the grading table, and the number she had written last: 12 Hz, with a small sinusoidal wave beneath it.*

*He had slept six hours in the SOV and felt, if not recovered, at least functional. The frequency trace from two nights ago had finally left his sleep. The week had the particular texture of a week in which too much had happened — thermal trips, relay calibration, fault current calculations — and some of it had only arrived as understanding during the unconscious hours. He pressed his access card to the control room reader.*

*The first thing he registered was a man he had not seen before, sitting at the secondary workstation with a MacBook Pro that was clearly old and clearly important: its lid was covered in stickers from what looked like three continents' worth of power systems conferences, and its screen was running a frequency spectrum, not a SCADA display. The spectrum showed a clean comb of harmonics at 150, 250, 350 Hz — and, well below the grid frequency line, a single bar at 12.3 Hz.*

*The man looked up. He had the patient, slightly unfocused expression of someone who had been reading impedance data since before breakfast.*

*"Lars Mikkelsen," he said. "DNV stability group, Høvik. You must be the control engineer." He nodded at his screen. "You are just in time. The farm has been telling us something interesting for the last forty minutes."*

*Anders was at the main workstation. He turned briefly. "The second transformer went offline for scheduled inspection at 06:00. The single-transformer configuration reduces the parallel grid connection impedance by half." He paused. "That is where the problem is."*

*Kaan looked at the spectrum bar at 12.3 Hz. It was not large — the scale showed it as perhaps 0.4% of the fundamental. But it was there, where nothing should be, at a frequency that was not a harmonic and not a sideband. It was a frequency the grid had not put there. The converters had.*

---

## 27.1 Cable LC Resonance

Every submarine cable is a capacitor, distributed along its length. Every transformer is an inductor. Together, they form an LC circuit — and every LC circuit has a natural frequency at which it rings.

The parallel resonant frequency of a cable connected to a network inductance is:

$$
f_r = \frac{1}{2\pi\sqrt{LC}}
$$

where:
- $L$ = total series inductance of the connected network [H] — transformer leakage, grid inductance, cable series inductance
- $C$ = total shunt capacitance of the cable [F] — from cable geometry, dielectric permittivity, and length
- $f_r$ = the frequency at which the parallel impedance is maximised [Hz]

At the resonant frequency, a small harmonic current from the converters encounters the highest possible network impedance. A 1% harmonic current injection that would produce 0.1% voltage distortion at 250 Hz may produce 2–5% distortion at $f_r$ if that resonance falls within the harmonic injection spectrum.

For the 66 kV array in a 500 MW offshore wind farm, the cable capacitance is substantial. A 10 km array feeder at 0.22 µF/km carries 2.2 µF of shunt capacitance. The combined inductance of the array cable, the offshore substation transformer, and the grid-side source impedance determines where $f_r$ falls. Depending on the specific network configuration, resonances can appear anywhere from 100 Hz to 800 Hz — well into the harmonic range, and potentially in the range where the power converters' own switching sidebands (discussed in Chapter 21) can excite them.

But a second class of resonance — the one that Sigrid had written on the whiteboard — does not arise from LC physics alone. It arises from the interaction between the network and the converter's control software.

Lars turned the MacBook toward Kaan. The spectrum at 12.3 Hz occupied a frequency range that no passive LC resonance in the 66 kV network could produce. Passive LC resonances for this cable configuration started at roughly 300 Hz. The 12.3 Hz oscillation was something else: it was a mode created jointly by the cable network and the converter control loop operating on each other.

"Twelve hertz is below the grid frequency," Lars said. "It is sub-synchronous. Which means it is not a harmonic. It is not a switching artefact. It is the farm disagreeing with the grid about what the voltage should be doing — and neither side is wrong. The physics of both is correct. Together, they are unstable."

<!-- IMAGE: fig-27-01 -->
> **[Figure 27.1]** — Frequency Spectrum of OSS 66 kV Busbar Voltage, Normal vs. Single-Transformer Configuration
> **Type:** Bar chart with line overlay
> **Content:** Two frequency spectra (x-axis: 0–500 Hz; y-axis: voltage distortion % of fundamental) shown as overlaid bars. Normal configuration (blue): clean spectrum with harmonics at 150, 250, 350 Hz below 0.5%, no sub-synchronous content. Single-transformer configuration (red): same harmonic structure, plus a visible bar at 12.3 Hz labelled "PLL interaction mode, 0.4%". Vertical dashed line at 50 Hz labelled "grid frequency". Region below 50 Hz shaded grey labelled "sub-synchronous range".
> **Caption:** 66 kV busbar voltage spectrum in normal twin-transformer configuration (blue) versus single-transformer configuration (red). The 12.3 Hz sub-synchronous mode appears only when the grid connection impedance doubles, reducing the short-circuit ratio below the PLL stability boundary.
> **Alt text:** Frequency spectrum chart comparing voltage distortion in normal and reduced-impedance grid configurations. A 12.3 Hz oscillation appears in the reduced-impedance case at the sub-synchronous frequency labelled as a PLL interaction mode.
> **Data source:** Author illustration, based on SCADA power quality logger output format.
> **Resolution:** 1400 × 700 px
> **Color notes:** Normal configuration blue, single-transformer configuration red, sub-synchronous region light grey background.

---

## 27.2 Converter PLL Interaction

A grid-following converter — the standard control architecture for every Type 4 wind turbine in the farm — does not generate its own voltage. It outputs a controlled current. To do this correctly, it must know the precise angle and frequency of the grid voltage at its terminals. It measures this using a phase-locked loop: a software algorithm that continuously compares the converter's internal phase reference to the measured grid voltage and adjusts until they match.

The PLL is not instantaneous. It has a bandwidth — a speed at which it can track changes in grid voltage angle. A typical offshore wind turbine PLL is tuned to a bandwidth of 8–15 Hz: fast enough to track slow frequency deviations and voltage angle swings, but not so fast that measurement noise drives the output into oscillation.

The problem arises when the grid itself is weak.

Grid strength at any point in the network is quantified by the short-circuit ratio:

$$
\text{SCR} = \frac{S_{sc,PCC}}{P_{WF,rated}}
$$

where:
- $S_{sc,PCC}$ = three-phase short-circuit apparent power at the point of common coupling [MVA]
- $P_{WF,rated}$ = rated active power of the wind farm [MW]
- $\text{SCR}$ = dimensionless grid strength index

A high SCR (greater than 3.0) means the grid's fault level is large compared to the farm's power output: injecting or absorbing power moves the voltage angle only slightly. A low SCR (below 3.0, and critically below 2.0) means the grid is relatively weak at that point: the same power injection significantly rotates the local voltage phasor.

The PLL watches voltage angle. In a weak grid, the voltage angle changes substantially when the converter injects power — and the converter injects power based on the PLL's output, which depends on the voltage angle it just measured. The loop is circular, and under the wrong conditions, it becomes a positive feedback loop:

*The grid voltage angle shifts → the PLL responds by changing the current command → the new current changes the grid voltage angle further → the PLL responds again.*

The frequency at which this interaction grows is determined by the PLL bandwidth and the grid impedance. For the farm's 8–12 Hz PLL bandwidth, operating through a grid connection whose effective SCR has halved, the unstable mode falls precisely in the sub-synchronous range. It was at 12.3 Hz.

> **Standard reference:** ENTSO-E Technical Group on Grid Forming Capabilities (2024). *First Interim Report: Technical Requirements for Grid-Forming Converters*. ENTSO-E, Brussels, November 2024 — Section 3.2 (grid-following instability in low-SCR grids) and Section 4.1 (PLL bandwidth and stability margins). This report provides the technical foundation for emerging European grid code requirements on GFM converter capability, including the stability criteria discussed in Section 27.3.

---

## 27.3 The Impedance Criterion

The interaction between a converter and the grid it is connected to can be analysed with mathematical tools originally developed for DC power supply design in the 1970s — and this origin story tells you something useful about the nature of the problem.

In 1976, R. D. Middlebrook at Caltech published a stability criterion for DC-DC converters cascaded with other converters or filters. He showed that if you modelled each element as having an output impedance $Z_s$ (source) and an input impedance $Z_l$ (load), the stability of the cascaded system depended on the ratio of these impedances. If the source impedance was small compared to the load impedance at all frequencies, the system was stable. If the source impedance was large — particularly if its real part was negative — the system could oscillate.

The same mathematics applies to AC power systems when the "source" is a converter and the "load" is the AC network.

A grid-following converter, viewed from its AC terminals, presents an output impedance $Z_{out,conv}(j\omega)$ that depends on the control parameters. At most frequencies, this impedance has a positive real part — the converter absorbs energy from oscillations and damps them. But in the sub-synchronous frequency range, near the PLL bandwidth, the converter's output impedance can acquire a negative real part:

$$
\text{Re}\left[Z_{out,conv}(j\omega_{SSO})\right] < 0
$$

A negative real part in the output impedance means the converter is not damping oscillations at that frequency — it is amplifying them. Every volt of oscillation at 12.3 Hz drives the converter to inject a current that makes the oscillation larger.

The Middlebrook stability criterion states that the system is stable if and only if:

$$
\left|\frac{Z_s(j\omega)}{Z_l(j\omega)}\right| < 1 \quad \text{for all } \omega
$$

where $Z_s$ is the converter's source (output) impedance and $Z_l$ is the network's (load) impedance. Equivalently, in Nyquist terms: the ratio $Z_s/Z_l$ must not encircle the $-1$ point in the complex plane.

When the second transformer went offline at 06:00, the network impedance at the PCC halved — meaning $Z_l$ halved. The ratio $Z_s/Z_l$ approximately doubled. The system crossed from stable to marginally unstable at the PLL interaction frequency, and the 12.3 Hz oscillation began to grow.

"It is not dramatic," Lars said. "Not yet. At 0.4 percent, it is below any compliance limit. But the growth rate is positive — the oscillation is getting larger, not decaying. If we do nothing, it will reach the protection relay thresholds within three to four hours."

He pulled up a second window on the MacBook: the same spectrum bar, but timestamped at 06:15, 06:30, 06:45, and 07:00. The 12.3 Hz bar grew by approximately 0.08% per fifteen minutes. It was not dramatic. It was precise.

<!-- IMAGE: fig-27-02 -->
> **[Figure 27.2]** — Middlebrook Impedance Ratio: Normal vs. Single-Transformer Configuration
> **Type:** Bode magnitude plot with two curves
> **Content:** Frequency (x-axis, 1–100 Hz, logarithmic) vs. impedance ratio |Z_s/Z_l| (y-axis, 0.1–10, logarithmic). Horizontal dashed line at 1.0 labelled "stability boundary". Blue curve (normal configuration): peaks at ~0.65 at 12 Hz, remains below 1.0 across all frequencies. Red curve (single-transformer): peaks at ~1.3 at 12.3 Hz, crosses the stability boundary. Crossover point annotated "SSO frequency, 12.3 Hz". Annotations showing how doubling Z_s/Z_l corresponds to halving the network fault level.
> **Caption:** Middlebrook impedance ratio |Z_s/Z_l| for the 500 MW offshore wind farm in normal (two-transformer) and contingency (single-transformer) configurations. The instability criterion |Z_s/Z_l| > 1 is violated at 12.3 Hz in the contingency case, producing the growing sub-synchronous oscillation observed on the SCADA system.
> **Alt text:** Bode plot showing impedance ratio versus frequency for two grid configurations. The single-transformer configuration crosses the stability boundary at 12.3 Hz, confirming the observed oscillation.
> **Data source:** Author illustration, based on converter impedance modelling methodology per ENTSO-E Grid Forming Technical Report (2024).
> **Resolution:** 1400 × 800 px
> **Color notes:** Normal configuration blue, single-transformer configuration red, stability boundary dashed black.

---

## 27.4 The Zorillo Gulf Incident — SSCI Before Anyone Had a Name for It

The sub-synchronous control interaction that Lars described at the workstation was not, in 2026, a hypothetical concern. It had already destroyed equipment.

On 22 October 2009, a sub-synchronous oscillation appeared on the ERCOT transmission network in west Texas. The oscillation grew rapidly. Within seconds, it had driven the protection systems of several wind turbines into activation — not because the protection had malfunctioned, but because the current and voltage distortions were large enough to reach relay thresholds. The oscillation frequency was approximately 20–22 Hz: sub-synchronous on a 60 Hz grid.

The wind farm involved was Zorillo Gulf, operating a fleet of Type 3 DFIG turbines. The transmission line that connected it to the ERCOT network included a series capacitor — a device installed to reduce the effective series reactance of the line and improve power transfer capability. The interaction was between the DFIG's rotor-side converter control and the series capacitor's impedance.

The physics of DFIG sub-synchronous control interaction differs from the PLL-driven mode affecting the offshore farm. In DFIG turbines, the rotor-side converter sees a rotor slip frequency that shifts with the mechanical speed; a series capacitor in the transmission line creates a resonant LC circuit whose natural frequency can interact directly with the rotor circuit currents. The oscillation frequency is set by the LC network, not the control loop bandwidth.

But the underlying principle is the same: a converter control system and a passive network element created a joint mode. Neither the converter, operating correctly by itself, nor the series capacitor, operating correctly by itself, was the cause. The cause was the interaction between the two. The AEMO investigation team studying the 2016 South Australia event had made the same observation about a different technology and a different mechanism. Sigrid had written it on the whiteboard in different words: protection settings that are correct in isolation can be catastrophic in combination.

The Adams et al. paper documenting the ERCOT experience, published in 2012, was one of the first systematic treatments of SSCI as a design problem rather than an operational surprise. It showed that the interaction could be predicted by impedance analysis — exactly the Middlebrook framework — and prevented by ensuring adequate impedance margins at all operating conditions.

"The Zorillo Gulf incident changed how the industry assessed new grid connections," Lars said. "Before that, nobody was computing converter output impedance as part of the grid connection application. After that, every serious TSO required it." He closed the Adams reference on his laptop. "The ERCOT case was DFIG and series compensation. What we have here is Type 4 and a single-transformer contingency. Same family of problem. Different branch."

> **Standard reference:** IEC TS 61400-21-4:2024, "Wind energy generation systems — Part 21-4: Measurement and assessment of electrical characteristics — Technical specification for converter stability analysis" — Clause 5 (impedance measurement methodology for Type 3 and Type 4 turbines) and Clause 7 (stability criterion and minimum impedance margins for grid connection assessment). This technical specification formalises the impedance-based approach to SSCI assessment that emerged from the Zorillo Gulf incident and subsequent industry experience.

---

## 27.5 Grid-Following Versus Grid-Forming

The PLL problem has a different solution at its root, not just a patch applied to its symptoms.

A grid-following (GFL) converter is designed around the assumption that the grid voltage is always present, always strong, and always provides the phase angle reference the converter needs to synchronise. In most situations — strong grids, normal fault levels, multiple transformers connected — this assumption holds. The PLL is fast enough to track the grid angle, the control loops are well-tuned, and the converter outputs power as commanded.

In weak grids, the assumption breaks down. The grid voltage angle is no longer a stable external reference: it moves in response to the converter's own power injection. The PLL, chasing a moving target it is partly causing to move, can generate the oscillations described in the previous section.

A grid-forming (GFM) converter inverts this architecture. It does not synchronise to an external voltage reference. It generates its own internal voltage angle and imposes that angle on the network, behaving as a voltage source behind an impedance — exactly as a synchronous generator behaves. Because it does not depend on the grid voltage angle for its reference, it cannot be destabilised by the circular PLL feedback loop. It is, in the strict dynamical sense, an unconditionally stable voltage source: it maintains its output regardless of how weak the grid is, and recovers gracefully from the loss of a parallel transformer.

The relevant measure of GFM stability margin is not the SCR but the short-circuit impedance ratio:

$$
\frac{Z_{GFM}(j\omega)}{Z_{grid}(j\omega)} = \frac{j\omega L_{virt} + R_{virt}}{Z_{sc,PCC}/\text{SCR}}
$$

where $L_{virt}$ and $R_{virt}$ are the virtual inductance and damping resistance of the GFM control law. For any positive $R_{virt}$, the GFM converter presents positive real impedance at all frequencies — damping every oscillatory mode it encounters rather than amplifying it.

The trade-off is not free. A GFM converter requires more sophisticated control software. It must handle the full voltage regulation burden during grid disturbances, which requires a robust DC link energy source to supply the current surge. And it must respond to faults without losing its internal angle reference — a requirement that was straightforward for synchronous generators (whose rotor angle is physically anchored to a rotating mass) but must be engineered explicitly into converter control.

As of the mid-2020s, GFM requirements were beginning to appear in grid codes: the UK's GC0137 (published 2023) and the Australian AEMO core requirements framework (2024) included GFM specifications for new grid-connected plant above certain rating thresholds. ENTSO-E's interim technical report, published in late 2024, outlined the parameters and stability criteria that future European requirements would adopt. The offshore wind industry was moving from a question of whether GFM was necessary to a question of when it would become mandatory.

<!-- IMAGE: fig-27-03 -->
> **[Figure 27.3]** — Grid-Following vs. Grid-Forming Converter Architecture
> **Type:** Two side-by-side block diagrams
> **Content:** Left diagram (GFL): AC network → PLL → angle θ → current controller → PWM → converter output. PLL loop shown with feedback arrow from AC voltage measurement to phase angle estimator. Right diagram (GFM): Internal voltage generator (V∠θ_internal) → virtual impedance (L_virt, R_virt) → converter output → AC network. No PLL feedback path. Both diagrams annotated with typical control bandwidths (GFL PLL: 8-12 Hz; GFM droop response: 0-∞ Hz stable). Red annotation on GFL: "SCR dependency — weak grid instability". Green annotation on GFM: "Voltage source — no SCR dependency".
> **Caption:** Control architecture comparison between grid-following (GFL) and grid-forming (GFM) converters. The GFL converter relies on the PLL to synchronise to the grid, creating a feedback loop that can destabilise in weak grids. The GFM converter generates its own voltage reference, eliminating the SCR dependency and providing inherent stability across all grid conditions.
> **Alt text:** Two block diagrams showing GFL converter with PLL feedback loop on the left, and GFM converter with internal voltage generation and no external PLL on the right.
> **Data source:** Author illustration, based on ENTSO-E Grid Forming Technical Report (2024) and IEC TS 61400-21-4:2024.
> **Resolution:** 1600 × 700 px
> **Color notes:** GFL diagram orange to indicate SCR dependency, GFM diagram green to indicate inherent stability.

---

## 27.6 Virtual Inertia and the GFM Future

Chapter 25 had described the synthetic inertia burst that the farm had provided during the PSE Łagisza B event — 12 MW released in the first 500 milliseconds from the kinetic energy of 34 slowly decelerating rotors. It had been framed as a feature of the turbine's mechanical physics: stored kinetic energy, discharged through deliberate blade pitch adjustment.

A grid-forming converter provides a different kind of inertia response — one that does not come from rotating mass but from the converter's control law.

The virtual synchronous machine (VSM) control architecture implements the swing equation in software. When the grid frequency deviates from nominal, the VSM's internal model responds exactly as a synchronous generator's rotor would — not because there is a rotor, but because the control algorithm produces the same power response:

$$
\Delta P_{virt} = -\frac{2 H_{virt} S_n}{\omega_n} \cdot \frac{d\omega}{dt}
$$

where:
- $H_{virt}$ = virtual inertia constant [s] — a design parameter chosen by the engineer, not fixed by physics
- $S_n$ = converter rated apparent power [VA]
- $\omega_n$ = nominal angular frequency [rad/s]
- $\Delta P_{virt}$ = instantaneous active power increment from the virtual inertia response [W]
- $d\omega/dt$ = measured rate of change of frequency [rad/s²]

The energy source for this response is the DC link capacitor. A typical 15 MW Type 4 converter has a DC link capacitor of approximately 30 mF at 1,150 V, storing $E = \frac{1}{2} \times 30 \times 10^{-3} \times 1150^2 \approx 19.8$ kJ. For 34 turbines, the total DC link energy is approximately 673 kJ — roughly 1.3 seconds of full-power operation. This is vastly less than the rotor kinetic energy described in Chapter 25 (503 MJ), but it is instantly available and precisely controlled.

The engineering implication is that GFM converters provide two benefits simultaneously: sub-synchronous stability (because their impedance is positive at all frequencies) and virtual inertia (because the VSM control law provides an instantaneous power response to frequency deviation). Both properties emerge from the same control architecture. The farm that is stable in a weak grid is also the farm that supports frequency in the moments after a large contingency.

This connection — stability and inertia as two faces of the same control philosophy — was the argument that the industry's most forward-looking engineers were making to regulators in 2024 and 2025. It was the reason that GFM requirements appeared first in markets that had both weak interconnection and high renewable penetration: Britain, Australia, isolated islands. The continental European grid, with its enormous synchronous area, remained stable with GFL converters at current penetration levels. But the trajectory was clear.

"The requirement in the connection agreement," Lars said, pointing at a clause on his laptop, "says GFL is acceptable for this project. But the connection agreement was written in 2023. The next tender cycle, for the project that will be operational in 2029, will require GFM-capable converters. Vestas has already demonstrated it on the V236 platform." He closed the impedance analysis window. "Tonight's event is not a failure. It is a preview."

---

## 27.7 Worked Example: Stability Assessment Under Grid Contingency

**Setup:** A 500 MW offshore wind farm connects to the onshore transmission network via a 220 kV export cable. The grid connection agreement specifies that the farm operates two parallel OSS transformers (each 250 MVA, 12% leakage reactance) in normal operation. During a planned outage of one transformer, the farm must remain grid-connected.

**Grid data:**
- Grid short-circuit level at the 220 kV onshore connection point: 3,200 MVA
- Export cable series impedance (45 km): $Z_{cable} = 0.065 + j0.127 \; \Omega/\text{km} \times 45 \; \text{km} = 2.925 + j5.715 \; \Omega$
- Transformer leakage reactance (each, at 220 kV base): $X_T = 0.12 \times \frac{220^2}{250} = 23.2 \; \Omega$

**Step 1 — Compute SCR in normal operation (two transformers in parallel):**

Parallel transformer impedance: $Z_{T,parallel} = Z_T / 2 = j11.6 \; \Omega$

Source impedance at the 220 kV PCC: $Z_{source} = \frac{220^2}{3200} = 15.1 \; \Omega$ (resistive and reactive components from grid)

Total impedance seen from farm in normal operation:
$$Z_{total,normal} = Z_{cable} + Z_{T,parallel} + Z_{source,approx} \approx j11.6 + j5.715 + j15.1 = j32.4 \; \Omega$$

Short-circuit MVA at OSS 66 kV busbar (referred to 220 kV, then to effective PCC):
For SCR calculation, use the fault level contribution at PCC:
$$S_{sc,PCC} \approx \frac{220^2}{|Z_{total,normal}|} = \frac{48{,}400}{32.4} = 1{,}494 \; \text{MVA}$$

$$\text{SCR}_{normal} = \frac{1{,}494}{510} = 2.93$$

This is in the weak-grid range (SCR < 3.0), but acceptable for tuned GFL converters.

**Step 2 — Compute SCR with one transformer offline:**

Single transformer impedance: $Z_{T,single} = j23.2 \; \Omega$

$$Z_{total,contingency} = j23.2 + j5.715 + j15.1 = j44.0 \; \Omega$$

$$S_{sc,PCC,contingency} = \frac{48{,}400}{44.0} = 1{,}100 \; \text{MVA}$$

$$\text{SCR}_{contingency} = \frac{1{,}100}{510} = 2.16$$

**Step 3 — Check against GFL stability boundary:**

Industry guidelines (CIGRE, IEC TS 61400-21-4, ENTSO-E 2024) establish that well-tuned GFL converters with PLL bandwidth of 8–12 Hz are stable for SCR > 1.5–2.0, depending on PLL parameters. The contingency SCR of 2.16 is at the margin. Given the farm's PLL bandwidth of 10 Hz, the stability boundary is approximately SCR = 2.0 for this converter design.

The 12.3 Hz oscillation observed corresponds to the predicted PLL interaction frequency for SCR = 2.16 and a 10 Hz PLL bandwidth:

$$f_{SSO} \approx f_{PLL} \cdot \sqrt{\frac{\text{SCR}_{nominal}}{\text{SCR}_{contingency}}} \approx 10 \times \sqrt{\frac{2.93}{2.16}} \approx 10 \times 1.16 \approx 11.6 \; \text{Hz}$$

Close agreement with the observed 12.3 Hz confirms the PLL interaction diagnosis.

**Step 4 — Immediate mitigation: PLL bandwidth reduction**

Reducing the PLL bandwidth from 10 Hz to 4 Hz moves the interaction frequency below 5 Hz where the network impedance provides stronger natural damping. This is implemented as a firmware parameter change pushed to all 34 turbine controllers simultaneously.

Impact on FRT compliance: the PLL bandwidth reduction increases the reactive current response time from 5 ms to approximately 12 ms. This remains well within the NC RfG 5-second requirement. No compliance impact.

**Step 5 — Summary**

| Condition | SCR | PLL bandwidth | SSO frequency | Stability |
|-----------|-----|--------------|--------------|-----------|
| Normal operation | 2.93 | 10 Hz | No mode | Stable |
| Single transformer | 2.16 | 10 Hz | 12.3 Hz | Marginally unstable |
| Single transformer | 2.16 | 4 Hz | < 5 Hz (damped) | Stable |
| GFM architecture | Any SCR | N/A (no PLL) | N/A | Unconditionally stable |

The firmware update to 4 Hz PLL bandwidth eliminates the 12.3 Hz mode for this contingency. The long-term recommendation: the farm's next major software cycle should include GFM-capable firmware, which eliminates the SCR dependency entirely and removes all SSCI risk across all credible contingency scenarios.

---

## Key Takeaways

- **Sub-synchronous oscillations below 50 Hz can arise from converter control interaction, not just passive LC resonance.** When a grid-following converter's PLL bandwidth is close to the frequency at which the combined converter-network system has near-zero damping, small perturbations grow into measurable oscillations. The trigger is often a reduction in grid short-circuit ratio — a contingency, not a fault.

- **The short-circuit ratio (SCR) quantifies grid strength.** SCR = S_sc / P_rated. Values below 3.0 are weak; below 2.0, GFL converters with standard PLL bandwidths are at risk of sub-synchronous instability. Every planned grid contingency — a transformer outage, a cable test, a planned disconnect — must be checked against the stability boundary.

- **The Middlebrook impedance criterion provides the mathematical test.** If the ratio |Z_converter / Z_network| exceeds 1.0 at any frequency, the system is potentially unstable at that frequency. This criterion requires computing the converter's output impedance — a function of PLL bandwidth, current controller gains, and outer loop parameters — not just the passive network impedance.

- **Grid-following converters are tunable but conditionally stable; grid-forming converters are unconditionally stable.** GFL stability depends on maintaining adequate SCR. GFM converters generate their own voltage reference internally, present positive real impedance at all frequencies, and remain stable regardless of how weak the grid connection becomes. GFM architecture eliminates the SSCI risk class entirely.

- **Grid-forming converters provide virtual inertia as a byproduct of their control philosophy.** The same VSM control law that makes a GFM converter stable also makes it respond to frequency deviations with an instantaneous power injection — the formula is the same as synthetic inertia, but the energy source is the DC link capacitor rather than the rotor. GFM converters address the sub-synchronous stability problem and the inertia problem from the same architectural choice.

---

## For Further Reading

1. Adams, J., Carter, C., & Huang, S.-H. (2012). "ERCOT experience with sub-synchronous control interaction and proposed remediation." *IEEE PES Transmission and Distribution Conference and Exposition*, Orlando, FL. IEEE, New York. This paper is the foundational industry reference for SSCI as a design discipline, documenting the Zorillo Gulf incident, the post-event impedance analysis that explained it, and the operational and protection changes ERCOT implemented. Engineers assessing new wind farm grid connections in systems with series compensation will find the impedance measurement methodology directly applicable.[^1]

2. ENTSO-E Technical Group on Grid Forming Capabilities (2024). *First Interim Report: Technical Requirements for Grid-Forming Converters*. ENTSO-E, Brussels. Available at entsoe.eu. This report defines the stability criteria, impedance specifications, and performance requirements that will underpin future European GFM grid code obligations. Section 4 covers the transition from GFL to GFM architectures; Section 6 covers virtual inertia and synthetic inertia provision from GFM converters. Read alongside IEC TS 61400-21-4:2024 for the wind turbine-specific measurement methodology.[^2]

3. Harnefors, L., Bongiorno, M., & Lundberg, S. (2007). "Input-admittance calculation and shaping for controlled voltage-source converters." *IEEE Transactions on Industrial Electronics*, 54(6), 3323–3334. DOI: 10.1109/TIE.2007.904022. The theoretical foundation for converter output impedance analysis applied to power systems. Harnefors et al. derive the closed-form input admittance for a VSC with inner current control and phase-locked loop, showing explicitly the frequency region where the real part of the admittance becomes negative. This paper is the bridge between the Middlebrook stability criterion and practical converter control parameter selection.[^3]

---

*Lars pushed the firmware update through the OSS control system at 08:47 — a parameter file, forty-three kilobytes, containing revised PLL bandwidth coefficients for all thirty-four turbine controllers. By 09:03, the 12.3 Hz bar on the spectrum analyser had dropped below the measurement noise floor. The farm had been told something, in a language it understood, and it had changed its behaviour.*

*Kaan watched the spectrum decay. Not the mathematics of it — he understood that well enough now — but the mechanical fact of it. Forty-three kilobytes had travelled from Lars's laptop through the OSS switch, down the fibre in the array cables, into thirty-four individual turbine cabinets distributed across twelve square kilometres of open water, and each of those turbines had read the message and adjusted its control law within the same second. There had been no vessels dispatched, no technicians climbing towers, no panel doors opened. Just light, in glass, carrying instructions.*

*"That update," Kaan said, "how did it get to all thirty-four turbines at once?"*

*Lars looked at him briefly. "Ask Anders. That is not my speciality."*

*Anders had heard the question from the main workstation. He had the half-smile he wore when a question arrived from exactly the direction he had been expecting it. "IEC 61850," he said. "A data model that every device in this building understands — and every device in every turbine tower. When you want to know how the farm watches itself and speaks to itself, that is where you start." He picked up his coffee. "Tomorrow."*

*Kaan looked at the spectrum display one more time. The sub-synchronous bar was gone. The farm had been quiet for six weeks — collecting wind, running load flows, surviving faults, dispatching reactive power, watching its protection margins, counting its frequencies. He had understood it, piece by piece, through the eyes of people who had spent careers learning its language.*

*He did not yet understand how all those pieces spoke to each other in real time — how an alarm in a turbine tower became an entry in a control room log, how a protection trip became a SCADA event, how a firmware update became a parameter in thirty-four simultaneous processes. The individual languages he could now read. The grammar that connected them was the subject that began tomorrow.*

---

## Notes

[^1]: Adams, J., Carter, C., & Huang, S.-H. (2012). "ERCOT experience with sub-synchronous control interaction and proposed remediation." *IEEE PES Transmission and Distribution Conference and Exposition, T&D 2012*, Orlando, FL, 7-10 May 2012. IEEE, New York. DOI: 10.1109/TDC.2012.6281678. The paper describes the October 2009 SSCI event at the Zorillo Gulf wind farm in ERCOT, involving GE 1.5 MW Type 3 DFIG turbines and a series-capacitor-compensated 345 kV transmission line. Oscillations were observed in the 20–22 Hz range on the 60 Hz ERCOT grid. The post-event impedance analysis confirmed that the rotor-side converter control presented negative resistance at the series compensation resonant frequency, meeting the Middlebrook instability criterion. ERCOT's remedial actions — dynamic relay settings, operational constraints on series compensation during wind farm operation, and revised interconnection study requirements including converter impedance measurement — are described in detail. This paper effectively created SSCI as a recognised interconnection assessment discipline within the North American wind industry; the subsequent IEC TS 61400-21-4 measurement methodology is its international descendant.

[^2]: ENTSO-E Technical Group on Grid Forming Capabilities (2024). *First Interim Report in Technical Requirements for Grid-Forming Converters — Grid Forming Capability of Power Park Modules*. ENTSO-E, Brussels, November 2024. Available at: eepublicdownloads.entsoe.eu. The ENTSO-E interim report responds to the increasing penetration of converter-interfaced resources and the declining synchronous inertia in the European synchronous areas. Sections 3 and 4 define the GFL stability boundaries (SCR thresholds, PLL bandwidth constraints) and the transition conditions under which GFM architectures become necessary. Section 6 addresses virtual inertia provision from GFM converters, including the energy source limitations (DC link capacitor versus supplemental storage) and the minimum inertia constant values achievable from different converter designs. Annex A provides a comparison of national grid code requirements for GFM capability as of mid-2024, including the UK GC0137, the Australian AEMO Core Requirements Framework, and proposed ENTSO-E minimum specifications. This document is the foundational reference for understanding where European grid code obligations on converter stability are heading and why the engineering requirements described in this chapter will become contractually mandatory for offshore wind farms commissioned after 2027–2028.

[^3]: Harnefors, L., Bongiorno, M., & Lundberg, S. (2007). "Input-admittance calculation and shaping for controlled voltage-source converters." *IEEE Transactions on Industrial Electronics*, 54(6), 3323–3334. DOI: 10.1109/TIE.2007.904022. This paper derives the closed-form analytical expression for the input admittance (the inverse of output impedance) of a voltage-source converter with standard inner current control and a phase-locked loop, as a function of frequency and controller parameters. The critical result — that the real part of the admittance becomes negative in a frequency band centred approximately at the PLL bandwidth, with the width and depth of the negative region dependent on the short-circuit ratio — is the mathematical foundation for the PLL interaction analysis in Section 27.2. The derivation requires familiarity with complex transfer functions and frequency-domain analysis but is fully self-contained within the paper. Engineers implementing converter impedance models for grid connection studies will find this paper, together with the companion work by Wen et al. (IEEE Transactions on Power Delivery, 2016, DOI: 10.1109/TPWRD.2015.2472172), provides the complete theoretical basis for the Middlebrook impedance approach applied to wind turbines.

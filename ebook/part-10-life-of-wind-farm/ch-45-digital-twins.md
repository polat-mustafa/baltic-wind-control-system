# Chapter 45: Digital Twins and Condition Monitoring

*The screen showed thirty-four turbines arranged in a grid, but not the SCADA grid Kaan had been watching for eighteen months. This was different.*

*Each turbine was a small three-dimensional model: a tower, a nacelle, three blades, colour-coded by health. Thirty-one were solid green. Two were yellow. T17 was amber.*

*Kaan had been looking at the amber icon for four minutes. He knew what it meant in operational terms — Erik had flagged it in January, and Helena had asked for the payback calculation in April. What he did not yet understand was how the system knew. The SCADA historian had been showing T17's power output as normal for months. The turbine had generated 15.2 MW in last Tuesday's storm. Its availability was 99.4 percent. From every operational angle, T17 looked like the healthiest turbine on the farm.*

*The amber icon said otherwise.*

*"You're reading the SCADA data," said Katrine Holm, without turning from her own screen.*

*She had arrived from Copenhagen on the first CTV that morning — a compact figure in a navy fleece, laptop bag over one shoulder, a portable vibration analyser in a yellow Pelican case over the other. She had not properly introduced herself at the access ladder. She had said "You're the control engineer," glanced at the Pelican case as though confirming its contents, and walked toward the control room. Kaan had followed.*

*Now she pulled a chair next to his and opened a second window. It showed a vibration spectrum: frequency on the x-axis, amplitude on the y-axis. The display was for T17's main shaft bearing, sampled at 25,600 Hz over a five-minute window that morning.*

*At 3.56 Hz, a small peak was visible. Next to it, at 7.12 Hz, a smaller one. At 10.68 Hz, smaller still.*

*"Those," said Katrine, pointing with one finger, "were not there at Month 12."*

*Kaan looked at them. The peaks were narrow, precise. On either side of the 3.56 Hz bar, a pair of sidebands separated by exactly the shaft rotation frequency. The pattern was almost decorative in its regularity.*

*"That's the defect frequency?"*

*"That is the defect frequency. The bearing is telling you it has a mark on the outer race. It has been telling you since Month 14." She brought up the historical spectrum — a colour map of frequency versus time, eighteen months of data compressed into a single image. At Month 14, a faint line appeared at 3.56 Hz. At Month 16 it deepened. At Month 18 it was unmistakable.*

*"Erik's algorithm caught it at Month 15," Kaan said.*

*"Erik's threshold caught it at Month 15. The signal was there four weeks earlier." She closed the spectrum view. "That is the difference between a threshold alarm and a digital twin. The twin was watching the bearing change. Erik's system waited until the change was large enough to cross a fixed line."*

*She looked at the amber icon on the health dashboard. T17, Main Bearing, Health Index 51/100.*

*"Helena asked for a payback calculation," Kaan said.*

*"Then let me show you where the number comes from."*

---

## 45.1 What a Digital Twin Is — and What It Is Not

The phrase "digital twin" is now applied to everything from a product catalogue rendering to a continental power system model running on a supercomputer cluster. The breadth of usage has diluted the concept close to meaninglessness. A useful starting definition is the one that emerged from the two people most responsible for the term.

In October 2002, Dr Michael Grieves of the University of Michigan presented a concept he called the "Conceptual Ideal for PLM" at an organizing meeting for the Product Lifecycle Management Consortium at the Lurie Engineering Center, Ann Arbor. The slide showed three elements: a physical product, a virtual product, and a two-way link connecting them — data flowing from physical to virtual, information flowing from virtual back to physical. The virtual product was not a drawing or a specification or a CAD file. It was a dynamic computational representation, updated continuously from measurements of the physical object, capable of predicting how the physical object would behave under conditions not yet experienced.

Grieves taught the concept in PLM courses at Michigan for the following years without attaching a name to it. The term "digital twin" was coined by John Vickers of NASA in a 2010 Technology Roadmap for advanced materials and manufacturing. The roadmap described the concept of a "virtual digital fleet leader" — a computational representation of an ageing spacecraft structure, continuously updated from sensor data, used to predict structural health and guide maintenance decisions. Grieves and Vickers subsequently collaborated to formalise the definition and present it to the broader engineering community.[^1]

The essential elements have not changed since 2002:

1. A **physical entity** — a real object with measurable behaviour.
2. A **virtual entity** — a computational model that represents the physical entity.
3. A **live connection** — a data link that continuously updates the virtual entity from measurements of the physical entity.

What the definition excludes is as important as what it includes. A digital twin is not a simulation run once at the design stage. It is not a three-dimensional CAD model, however detailed. It is not a fixed finite-element model used to calculate design loads at the engineering phase. These are all inputs to a digital twin, but without the live data connection they are static descriptions of how the object was designed — not dynamic representations of what the object is now.

For offshore wind turbines, the practical consequence of this distinction is significant. A turbine's design documentation describes a statistically representative machine built to a specification with nominal tolerances. The machine that came off the production line and was installed on a specific monopile in a specific location has experienced eighteen months of specific wind loads, temperature cycles, pitch events, and grid disturbances. The design documentation cannot tell you what is happening inside T17's main shaft bearing on a Tuesday morning in Month 18. A digital twin fed with T17's own sensor history can.

Three capability levels are distinguished in practice:

**Descriptive:** What happened? The twin reconstructs the component's state history from recorded measurements. Useful for post-event analysis and warranty claims.

**Diagnostic:** Why did it happen? The twin combines sensor data with physics models to identify the failure mechanism — bearing outer-race defect, partial discharge, blade trailing-edge crack. Useful for root cause analysis.

**Predictive:** What will happen? The twin extrapolates current degradation trends to estimate when a failure threshold will be reached, with quantified uncertainty. Useful for maintenance scheduling.

The Apollo 13 mission in April 1970 is frequently cited as the first practical digital twin. When the oxygen tank in the Service Module exploded approximately fifty-six hours after launch, the NASA mission controllers in Houston began feeding real-time telemetry from the crippled spacecraft into their ground-based simulators, running candidate procedures against a virtual mirror of the vehicle until they found the protocol that would bring the crew home safely. The physical spacecraft and the computational mirror were updated together, each informing the other. The data link was one-directional, the "model" was human cognition running across purpose-built hardware simulators, and the computational tools were by modern standards trivially simple — but the structure was identical to what Grieves would formalise thirty-two years later.[^2]

The wind turbine digital twin is the Apollo 13 approach applied to a rotating machine running continuously for thirty years, updated from over a thousand sensor channels at sample rates that would have consumed more storage capacity in 1970 than existed on the entire planet.

<!-- IMAGE: fig-45-01 -->
> **Figure 45.1** — Digital Twin Architecture for an Offshore Wind Turbine
> **Type:** Layered block diagram
> **Content:** Three vertical layers from bottom to top. Bottom layer (navy): Physical asset — turbine cross-section with sensor symbols at bearing housings, gearbox casing, generator, tower base. Annotated with "SCADA: 80 channels, 10-min avg" and "CMS: 12 accelerometers, 25,600 Hz". Middle layer (teal): Virtual entity — three sub-blocks: Physics model (structural FE, drivetrain kinematics), Data model (NBM, defect frequency library), Prognostics model (Weibull RUL, uncertainty bands). Two-way arrows between bottom and middle layers labelled "Sensor data stream (live)" and "Maintenance recommendations". Top layer (green): Decision outputs — Health Index dashboard, RUL with P10/P90, Maintenance scheduling recommendation, Financial case generator.
> **Caption:** Three-layer digital twin architecture for an offshore wind turbine. The live sensor connection between the physical machine and the virtual entity is what distinguishes a digital twin from a simulation. Removing the data link collapses the middle layer to a static design model.
> **Alt text:** Block diagram showing three layers: physical turbine with sensors at bottom, virtual models in the middle, and decision outputs at the top, connected by bidirectional data flows.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Physical layer in navy, virtual entity in teal, decision outputs in green; data link arrows in amber

---

## 45.2 The Sensor Foundation: SCADA versus CMS

A digital twin is only as good as its data connection to the physical world. For a wind turbine, that connection runs through two measurement systems with fundamentally different characteristics.

The SCADA system — whose information model was introduced in Chapter 28 — collects ten-minute statistical averages of approximately eighty operational parameters: active and reactive power output, wind speed from the nacelle anemometer, rotor speed, pitch angle, generator temperatures, gearbox oil temperature, ambient temperature, and transformer temperatures. The ten-minute averaging window is a legacy of the statistical conventions in IEC 61400-12-1 for power performance assessment. At a ten-minute sample rate, the SCADA historian accumulates roughly fifty thousand data points per turbine per year. It is a rich picture of what the turbine is producing — its output, its efficiency, its gross operational health.

What it cannot see is equally important. Rotating machinery faults manifest as periodic mechanical impulses at specific frequencies determined by the geometry of the failing component. A bearing outer-race defect produces an impulse every time a rolling element passes over the defect — at a frequency in the range of 2 to 30 Hz for main shaft and gearbox bearings, depending on shaft speed and geometry. These impulses last milliseconds. In a ten-minute average, they are completely invisible: the statistical window suppresses the time-varying signal that carries all the fault information.

The Condition Monitoring System (CMS) exists to capture what SCADA cannot. It comprises piezoelectric accelerometers mounted directly on the bearing housings, gearbox casing, and generator frame, recording vibration at sample rates typically between 12,800 and 51,200 Hz. An oil particle counter in the gearbox sump counts metallic debris particles by size class — ISO 4406 cleanliness codes — providing a direct measure of mechanical wear accumulation. Some systems include acoustic emission sensors at frequencies above 100 kHz for detecting the ultrasonic signals produced by propagating surface cracks long before they become visible as vibration.

The data volume from a CMS is substantially larger than from SCADA. A single accelerometer at 25,600 Hz generates approximately 80 gigabytes of raw data per year at 32-bit resolution. A turbine with twelve accelerometers produces nearly one terabyte of vibration data per year. Fleet-level storage and processing of this data — thirty-four turbines producing 34 terabytes per year — is a significant data engineering problem in its own right, one that edge-computing nodes performing on-turbine feature extraction (computing spectral features locally before transmitting compressed results) have made practically tractable.

The fundamental distinction between the two data streams is worth stating precisely: SCADA knows what the turbine is making; CMS knows what the turbine is doing internally. A turbine can produce 15.2 MW — a healthy SCADA output — while simultaneously generating a bearing defect frequency at 3.56 Hz that has been growing for four months. The SCADA system sees the 15.2 MW. The digital twin sees both.

> **Standard reference:** IEC 61400-25-2:2015, "Wind energy generation systems — Part 25-2: Communications for monitoring and control of wind power plants — Information models," Section 6.6 (Condition monitoring logical node classes). The IEC 61400-25-2 standard defines the MSTA, WTUR, and WCNV logical node classes for operational SCADA data, as introduced in Chapter 28. The companion IEC 61400-25-6 extends these with condition monitoring logical nodes covering vibration signatures, bearing temperature data classes, and oil particle count attributes. Together the two parts provide the unified information model that integrates SCADA and CMS data streams into a single IEC 61850 compatible data architecture.

---

## 45.3 Bearing Defect Frequencies: Physics Written in the Spectrum

The diagnostic power of vibration analysis rests on a straightforward physical fact: the geometry of a rolling element bearing completely determines the frequency at which a developing defect will produce mechanical impulses. No empirical calibration is required. The defect speaks at a calculable frequency, in a language that has been understood since the 1940s.

A rolling element bearing consists of an inner race (rotating with the shaft), an outer race (stationary in the housing), a cage (holding the rolling elements at equal angular spacing), and the rolling elements themselves — balls, cylindrical rollers, or spherical rollers depending on the load case. When a surface defect develops on any of these four components, each pass of a rolling element over the defect produces a brief mechanical impulse. The rate of these impulses depends on the shaft rotation speed and the bearing's geometric parameters.

Two of the four standard defect frequencies are most relevant for early-stage detection:

**Ball Pass Frequency, Outer Race (BPFO):** The rate at which rolling elements contact a fixed defect on the stationary outer race.

$$
f_{\text{BPFO}} = \frac{N_b}{2} \cdot f_s \cdot \left(1 - \frac{B_d}{P_d}\,\cos\alpha\right)
$$

where:
- $N_b$ = number of rolling elements [dimensionless]
- $f_s$ = shaft rotation frequency [Hz]
- $B_d$ = rolling element diameter [m]
- $P_d$ = pitch circle diameter — centre-to-centre diameter across the bearing [m]
- $\alpha$ = contact angle — angle between the contact plane and a plane perpendicular to the shaft axis [degrees]

**Ball Pass Frequency, Inner Race (BPFI):** The rate at which a defect on the rotating inner race contacts rolling elements.

$$
f_{\text{BPFI}} = \frac{N_b}{2} \cdot f_s \cdot \left(1 + \frac{B_d}{P_d}\,\cos\alpha\right)
$$

The plus sign arises because the inner race rotates with the shaft, increasing the relative contact frequency above the outer-race value. For typical bearing geometries, BPFI is 10 to 30 percent higher than BPFO at the same shaft speed.

The outer-race defect frequency is typically the first to be detected in a developing fault, for a reason that is physically transparent once understood. The outer race is stationary. A defect on the outer race sits permanently in the load zone — the region of highest contact stress where the rotor's weight and dynamic loads are transmitted through the rolling elements to the housing. Every rolling element passes directly over the defect on every revolution, at the same contact stress, producing uniform impulses. The resulting spectral peak is narrow and clean, easy to detect above the broadband background. It appears at exactly $f_{\text{BPFO}}$ and at harmonics $2f_{\text{BPFO}}, 3f_{\text{BPFO}}, \ldots$

An inner-race defect, by contrast, rotates with the shaft. For approximately half of each revolution the defect is in the load zone; for the other half it is on the lightly loaded unloaded side where contact stress is much lower. The impulse amplitude is modulated at the shaft rotation frequency, producing sidebands at $f_{\text{BPFI}} \pm f_s$ in the spectrum. This modulation pattern is detectable but requires higher spectral resolution to distinguish from broadband noise. Outer-race defects are therefore caught at an earlier stage of development than inner-race defects.[^3]

The Hertz contact stress at the rolling-element-to-race contact in a large wind turbine main shaft bearing can exceed 1.5 GPa under full load — roughly a hundred times the pressure at the bottom of the Mariana Trench. A surface defect introduces a localised stress concentration that amplifies this already extreme contact pressure, initiating a fatigue crack that propagates at a rate set by the material, the load magnitude, and the temperature. The bearing does not fail suddenly. It announces itself, in a language of periodic impulses at a frequency that the geometry dictates.

<!-- IMAGE: fig-45-02 -->
> **Figure 45.2** — Vibration Spectrum Comparison: Healthy Bearing (Month 12) vs Degraded Bearing (Month 18)
> **Type:** Dual-panel frequency spectrum plot
> **Content:** Top panel (Month 12, healthy): x-axis 0–15 Hz, y-axis amplitude mm/s², 0 to 3.0. Clean broadband noise floor below 0.4 mm/s². No distinct peaks. Vertical dashed line at 3.55 Hz labelled "Predicted BPFO". Top panel header: "Month 12 — HI 91 (Green)". Bottom panel (Month 18, degraded): Same axes. Distinct peaks at 3.56 Hz (BPFO, amplitude 2.26 mm/s²), 7.12 Hz (2×BPFO, 0.94 mm/s²), 10.68 Hz (3×BPFO, 0.41 mm/s²). Sidebands at 3.56 ± 0.137 Hz visible as small flanking bars. Same vertical dashed line at 3.55 Hz. Bottom panel header: "Month 18 — HI 51 (Amber)". Annotation on bottom panel at BPFO peak: "6.8 dB growth since Month 14".
> **Caption:** CMS accelerometer spectra from T17's main shaft bearing at Month 12 (healthy, Health Index 91) and Month 18 (degraded, Health Index 51). The predicted BPFO at 3.55 Hz matches the measured peak to within 0.01 Hz. The harmonic series and shaft-frequency sidebands (±0.137 Hz) confirm an outer-race defect in the progressive wear-out regime. Total spectral growth since Month 14: 6.8 dB at the fundamental frequency.
> **Alt text:** Two vibration frequency spectra: the Month 12 spectrum shows a clean noise floor with no distinct peaks; the Month 18 spectrum shows clear peaks at 3.56 Hz and harmonics confirming a developing bearing defect.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Healthy spectrum panel in green header, degraded spectrum panel in amber; BPFO prediction line in navy dashed; sideband markers in grey

---

## 45.4 Normal Behaviour Models: The Baseline That Did Not Exist Before

A vibration spectrum at a single point in time is difficult to interpret in isolation. Knowing that the BPFO peak amplitude is 2.26 mm/s² tells you almost nothing about the bearing's condition unless you know what the amplitude was when the bearing was new — and what it would be under the same operating conditions if the bearing were healthy today.

Every turbine has a slightly different background vibration signature: different foundation stiffness, different manufacturing tolerances in the drivetrain, different pre-loads introduced during installation. Fleet-average thresholds set conservatively to avoid false positives on noisy machines will miss faults on quieter ones; set aggressively to catch early faults, they will generate constant false alarms on machines that are simply noisier than average. The fault detection problem is not "is the amplitude above a threshold?" but "is the amplitude different from what this specific machine would show if it were healthy right now?"

This is the role of the Normal Behaviour Model. The NBM learns — from historical data recorded while the machine was confirmed healthy — the expected relationship between the operating point and each measured parameter. The operating point for a main shaft bearing is characterised by shaft rotation speed, bearing oil temperature, and ambient temperature. For a given operating point, the NBM predicts: "at 8.2 RPM, 43°C oil temperature, and 9°C ambient, this specific turbine's BPFO amplitude would be 0.80 mm/s², with a standard deviation of 0.12 mm/s², if the bearing were healthy." When a new measurement arrives under the same conditions and the amplitude is 2.26 mm/s², the deviation is twelve standard deviations above the predicted value. Something has changed.

The residual — the difference between the measured value and the NBM prediction — is the fundamental diagnostic signal:

$$
\varepsilon(t) = y(t) - \hat{y}_{\text{NBM}}(t)
$$

where:
- $\varepsilon(t)$ = residual at time $t$ [same physical units as $y$]
- $y(t)$ = measured value at time $t$ (e.g., BPFO amplitude [mm/s²])
- $\hat{y}_{\text{NBM}}(t)$ = NBM prediction for the operating conditions at time $t$ [mm/s²]

A residual near zero means the machine is behaving as it did when it was healthy, at this operating point. A residual that begins to trend away from zero — slowly, consistently, over weeks or months — means something is changing.

The NBM approach transforms fault detection from an absolute threshold comparison into a relative anomaly detection. A turbine running at 6 RPM in light wind produces a smaller BPFO amplitude than the same turbine running at 10 RPM in storm conditions — the amplitude is physically larger at higher contact force. A threshold-alarm system must be set conservatively high to avoid false positives at high load, which means it will miss early faults at low load. The NBM residual removes the operating-point dependence from the signal. What remains is the pure anomaly: the change relative to the machine's own healthy baseline, regardless of the current operating conditions. Faults are detected earlier. False alarms are fewer.

The NBM can be implemented as a linear regression model (appropriate for slowly varying, well-characterised operating regimes), a Gaussian process regression (useful when the relationship between operating point and measured parameter is nonlinear and uncertain), or — increasingly — as a neural network trained on the turbine's own twelve-to-eighteen month healthy data period. In all cases, the principle is the same: learn the healthy machine, then listen for deviations from health.

---

## 45.5 Health Scoring and Remaining Useful Life

A residual signal by itself requires expert interpretation. A site technician standing at the operations console does not need to read a vibration spectrum or interpret a residual trend in units of mm/s². They need a number. The health index translates the statistical behaviour of residuals and fault frequency amplitudes into a single 0-to-100 score for each major component.

$$
\text{HI}(t) = 100 \cdot \exp\!\left(-\lambda \cdot \frac{\operatorname{Var}[\,\varepsilon(t)\,]}{\operatorname{Var}_0}\right)
$$

where:
- $\text{HI}(t)$ = health index at time $t$ [dimensionless, range 0–100]
- $\lambda$ = sensitivity calibration constant, set during baseline commissioning [dimensionless, typically 3–8]
- $\operatorname{Var}[\varepsilon(t)]$ = variance of the residual over a rolling window of recent measurements
- $\operatorname{Var}_0$ = residual variance during the confirmed healthy baseline period

The exponential form gives a health index that declines slowly from 100 as early anomalies appear, then falls more steeply as the fault develops. This matches empirical observation: early bearing degradation produces small increases in residual variance — detectable but not alarming — while late-stage degradation, when the defect surface has grown, produces rapidly increasing variance. At $\operatorname{Var}[\varepsilon] = \operatorname{Var}_0$, the HI is $100 \cdot e^{-\lambda}$; for $\lambda = 5$, this is $\approx 0.7$ — a modest fall from 100, appropriate for a machine showing early anomaly at the level of its healthy baseline variance. At ten times the baseline variance, HI drops to approximately 5.

Four alarm zones are standard practice:

| HI range | Zone | Action |
|----------|------|--------|
| 80 – 100 | Green | Normal operation |
| 60 – 80 | Yellow | Monitor closely; plan inspection |
| 40 – 60 | Amber | Plan replacement within the next maintenance window |
| 0 – 40 | Red | Urgent — replacement before the next planned window |

The health index is the output of what ISO 13374 calls the condition assessment block — the fourth of six processing levels in the standard's framework. The six levels run from data acquisition (raw sensor signals), through data conditioning (filtering, calibration), feature extraction (spectral peaks, statistical moments), condition assessment (HI), fault diagnosis (which component, which mechanism), to prognosis: estimating how much longer the component will function before reaching a failure threshold.[^4]

Remaining useful life estimation draws on statistical lifetime models. The Weibull distribution is the standard tool for failure time analysis of rotating machinery components, because its shape parameter $\beta$ captures the three physically distinct failure regimes in a component's service life:

$$
h(t) = \frac{\beta}{\eta} \cdot \left(\frac{t}{\eta}\right)^{\beta-1}
$$

where:
- $h(t)$ = hazard rate — the instantaneous probability of failure per unit time, given that the component has survived to time $t$ [h$^{-1}$]
- $\beta$ = Weibull shape parameter [dimensionless]
- $\eta$ = scale parameter — the characteristic life at which 63.2% of a population would have failed [h]

When $\beta < 1$, the hazard rate decreases with time: this is the infant mortality regime, where components that survive early life are progressively less likely to fail — the left side of the bathtub curve introduced in Chapter 43. When $\beta = 1$, the hazard rate is constant: purely random failures independent of age. When $\beta > 1$, the hazard rate increases with time: the wear-out regime. Rolling element bearings operating under sustained cyclic load have shape parameters in the range $\beta = 1.5$ to $\beta = 3.5$ depending on loading and lubrication conditions; a value of $\beta = 2.5$ is commonly used for large offshore wind main shaft bearings operating under design loads.[^5]

The remaining useful life point estimate — the expected additional operating time before the health index is projected to reach the critical threshold HI = 20 — is obtained by fitting the Weibull parameters to the observed health index trend and solving for the projected crossing time:

$$
t_{\text{RUL}} = t_{\text{HI}=20}^{\text{P50}} - t_{\text{now}}
$$

where $t_{\text{HI}=20}^{\text{P50}}$ is the median (P50) projected time at which the health index crosses the critical threshold, extrapolated along the current degradation trajectory. The P10 and P90 bounds on the RUL estimate — analogous to the P10/P90 annual energy production uncertainty introduced by Helena in Chapter 12 — quantify the prognostic uncertainty and determine how much margin remains between today and the critical threshold.

<!-- IMAGE: fig-45-03 -->
> **Figure 45.3** — T17 Health Index Trend, Alarm Zones, and RUL Projection
> **Type:** Line chart with shaded alarm zones and confidence interval
> **Content:** x-axis: months (10 to 26). y-axis: Health Index 0–100. Four horizontal shaded bands: red (0–40), amber (40–60), yellow (60–80), green (80–100). Solid line (measured): HI at Month 12 (91), 13 (88), 14 (82), 15 (74), 16 (62), 17 (57), 18 (51). Filled circles at each measured point. Dashed line from Month 18: median projected trajectory reaching HI = 20 at Month 21.4. Light blue shaded band around dashed line: P10 projection reaching HI = 20 at Month 20.1, P90 reaching HI = 20 at Month 23.3. Vertical dashed line at Month 20 labelled "Planned maintenance window (June)". Small grey downward arrow at Month 14 labelled "First yellow alarm (basic threshold: Month 15)".
> **Caption:** T17 main bearing health index from Month 12 to Month 18 (measured), with P50 RUL projection and P10/P90 confidence bounds. The digital twin detected entry into the yellow zone at Month 14; the basic threshold alarm triggered at Month 15. The planned June maintenance window (Month 20) falls within the P10/P50 confidence band — inside the safe operating envelope for a planned intervention.
> **Alt text:** Line chart showing T17 health index declining from 91 at Month 12 to 51 at Month 18, with projected continuation reaching critical threshold at approximately Month 21 and a maintenance window marker at Month 20.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Alarm zones in green/yellow/amber/red; measured data line in solid navy; RUL projection in dashed navy; P10/P90 band in light blue; maintenance window line in dark green

---

## 45.6 Worked Example — T17 Main Bearing: From Spectrum to Decision

**Operating conditions at diagnostic session:** Turbine T17, shaft speed 8.2 RPM, gearbox oil temperature 43°C, ambient temperature 9°C.

**Bearing geometry (illustrative parameters for a large spherical roller bearing of the type used in a 15 MW class turbine main shaft):**

| Parameter | Symbol | Value |
|-----------|--------|-------|
| Number of rolling elements | $N_b$ | 56 |
| Rolling element diameter | $B_d$ | 60 mm |
| Pitch circle diameter | $P_d$ | 820 mm |
| Contact angle | $\alpha$ | 10° |

---

**Step 1: Predicted BPFO**

Shaft frequency: $f_s = 8.2 / 60 = 0.1367\ \text{Hz}$

$$
f_{\text{BPFO}} = \frac{56}{2} \cdot 0.1367 \cdot \left(1 - \frac{60}{820}\cdot\cos 10°\right)
= 28 \cdot 0.1367 \cdot \left(1 - 0.0732 \cdot 0.9848\right)
= 28 \cdot 0.1367 \cdot 0.9279
= \mathbf{3.55}\ \text{Hz}
$$

The CMS spectrum shows a peak at **3.56 Hz** — within 0.01 Hz of the kinematic prediction. The match is not a coincidence. It confirms that the spectral feature is not measurement noise or an electromagnetic artefact: it is a bearing outer-race defect, producing impulses at the exact frequency that the geometry requires.

---

**Step 2: Residual trend and health index history**

The NBM baseline was established from Months 1–10, when the bearing was confirmed healthy by oil particle count (< 5 particles/mL in the 15–25 µm size range, ISO 4406 Class 16/14/11). During the baseline period, the BPFO amplitude residual had mean $\mu_0 = 0$ and standard deviation $\sigma_0 = 0.12\ \text{mm/s}^2$.

| Month | Measured $y$ (mm/s²) | NBM $\hat{y}$ (mm/s²) | Residual $\varepsilon$ (mm/s²) | HI |
|-------|---------------------|-----------------------|--------------------------------|----|
| 12 | 0.92 | 0.80 | +0.12 | 91 |
| 13 | 0.95 | 0.80 | +0.15 | 88 |
| 14 | 1.11 | 0.80 | +0.31 | **82 — Yellow zone** |
| 15 | 1.34 | 0.80 | +0.54 | 74 |
| 16 | 1.69 | 0.80 | +0.89 | **62 — Amber zone** |
| 17 | 1.97 | 0.80 | +1.17 | 57 |
| 18 | 2.26 | 0.80 | +1.46 | **51 — Amber** |

The NBM prediction remains approximately constant because operating conditions are similar across these months; the measured amplitude increase is therefore entirely carried in the residual. The health index fell from 91 to 51 over six months — a mean rate of approximately −6.7 points per month, with acceleration apparent in months 16–18 as the defect surface area grows.

Erik's basic threshold alarm triggered when the BPFO amplitude crossed 1.20 mm/s² at Month 15 — four weeks after the digital twin first flagged yellow. The four-week advantage is not the primary benefit of the digital twin system. The primary benefit is the RUL projection with confidence bounds, which determines when to act.

---

**Step 3: RUL projection and maintenance decision**

Fitting a Weibull degradation model to the health index series, with shape parameter $\beta = 2.5$ (characteristic of wear-out failure for offshore main shaft bearings):

| Projection | Time to HI = 20 (critical threshold) | Months from now |
|-----------|--------------------------------------|-----------------|
| P10 (conservative) | Month 20.1 | 2.1 months |
| P50 (median) | Month 21.4 | 3.4 months |
| P90 (optimistic) | Month 23.3 | 5.3 months |

The planned summer maintenance window is Month 20 — the June weather window Erik identified in January. It falls within the P10–P50 range: there is a 10-to-50 percent probability, based on the degradation model, that the bearing would reach the critical threshold before June if left unaddressed.

This probability range makes the maintenance decision straightforward. The June window costs EUR 15,210. A bearing failure that forces an emergency replacement in January weather costs EUR 210,600. The probability-weighted expected cost of waiting:

$$0.10 \times 210{,}600 + 0.90 \times 15{,}210 = \text{EUR}\ 34{,}749$$

The probability-weighted expected cost of acting in June:

$$1.0 \times 15{,}210 = \text{EUR}\ 15{,}210$$

Act in June.

---

**Step 4: Financial case for the digital twin system**

The case Helena requested: does the fleet-level digital twin investment pay back?

The financial argument rests on the cost ratio between planned and emergency interventions. For the T17 bearing, the ratio is 13.8:1. Across a fleet of 34 turbines, the digital twin is expected to enable condition-based maintenance planning that avoids approximately 2.0 emergency interventions per year — a conservative estimate based on the drivetrain failure rate data reported in publicly available O&M studies for comparable offshore wind portfolios.

$$
V_{\text{annual}} = N_{\text{avoided}} \cdot \left(C_{\text{emergency}} - C_{\text{planned}}\right) - C_{\text{DT,annual}}
$$

where:
- $N_{\text{avoided}}$ = number of avoided emergency drivetrain interventions per year [yr$^{-1}$]
- $C_{\text{emergency}}$ = cost of unplanned emergency replacement [EUR]
- $C_{\text{planned}}$ = cost of planned summer replacement [EUR]
- $C_{\text{DT,annual}}$ = annual digital twin platform, analytics, and support cost [EUR/yr]

$$
V_{\text{annual}} = 2.0 \times (210{,}600 - 15{,}210) - 85{,}000
= 2.0 \times 195{,}390 - 85{,}000
= \text{EUR}\ 305{,}780\ \text{per year}
$$

| Parameter | Value |
|-----------|-------|
| Fleet implementation cost (EUR 15,000 × 34 turbines) | EUR 510,000 |
| Annual platform and analytics cost | EUR 85,000 |
| Annual value captured (2 avoided emergencies) | EUR 390,780 |
| Annual net value | EUR 305,780 |
| Simple payback period | **1.3 years** |
| 25-year NPV at WACC 5.73% (declining annuity, final-year maintenance costs) | **EUR 4.2 M** |

The 8:1 return on the implementation investment over the asset life is a conservative case. It does not credit the indirect benefit of earlier RUL confidence — the ability to order a long-lead-time bearing six months before the maintenance window rather than at emergency-premium cost with two weeks' notice. It does not credit reduced turbine stress from component degradation that was arrested before it propagated to adjacent components. And it credits only 2.0 avoided emergencies per year against an expected fleet drivetrain failure rate that, in some offshore portfolios, runs higher.

<!-- IMAGE: fig-45-04 -->
> **Figure 45.4** — Digital Twin Financial Case: Planned vs Emergency Intervention Cost Comparison
> **Type:** Grouped bar chart with cost breakdown
> **Content:** Three bar groups on x-axis: "Planned (June)" (EUR 15,210, green solid), "Emergency (January)" (EUR 210,600, red with three sub-segments: direct labour/parts EUR 141,200 dark red, emergency logistics premium EUR 47,400 medium red, lost revenue 96 hours × EUR 15 MW × EUR 45/MWh = EUR 64,800 light red). Wait — let me recalculate: 96 hours downtime × 15 MW average × EUR 45/MWh = 64,800 EUR lost revenue. Direct + premium + lost revenue should sum to EUR 210,600. Let me adjust: EUR 141,200 + EUR 4,600 premium + EUR 64,800 = 210,600. Hmm, that doesn't quite work with EUR 47,400 premium. Let me use: direct replacement EUR 113,000 (dark red), emergency premium EUR 32,800 (medium red), lost revenue EUR 64,800 (light red) = EUR 210,600. Third bar: "Annual DT cost" (EUR 85,000, navy). Horizontal annotation line between Planned and Emergency bars labelled "13.8× ratio". Below chart: "Simple payback: 1.3 years at 2 avoided emergencies/year".
> **Caption:** Cost comparison between planned condition-based maintenance (EUR 15,210) and unplanned emergency replacement in winter conditions (EUR 210,600), showing sub-component breakdown of the emergency cost. The 13.8× ratio is the financial foundation for the digital twin investment case; at two avoided emergencies per year, the EUR 510,000 fleet implementation cost is recovered in 1.3 years.
> **Alt text:** Grouped bar chart with three bars: planned replacement cost EUR 15,210 in green, emergency replacement cost EUR 210,600 in red with cost breakdown sub-segments, and annual digital twin cost EUR 85,000 in navy.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Planned bar solid green; emergency bar in three red shades (dark direct cost, medium premium, light revenue loss); DT annual cost in navy; "13.8×" annotation in bold black

---

## Key Takeaways

- **A digital twin is not a model you run once — it is a model that runs continuously, updated from live sensor data.** The essential elements are the physical entity, the virtual entity, and a live data connection between them. Michael Grieves formalised this distinction at the University of Michigan in 2002; John Vickers of NASA coined the term in a 2010 Technology Roadmap. Without the live connection, a digital twin is a simulation: a description of how the asset was designed, not a representation of what the asset is now.

- **Bearing defect frequencies are determined entirely by geometry and shaft speed — no empirical calibration required.** The BPFO and BPFI formulas contain no fitted parameters: they are purely kinematic. A measured spectral peak matching the predicted BPFO within measurement resolution is not a coincidence; it is a bearing outer-race defect declaring itself at the frequency that physics requires. The diagnostic specificity of frequency analysis is what makes CMS a fault identification tool, not merely a fault detection tool.

- **Normal behaviour models remove operating-point dependence from the measured signal, leaving only the anomaly.** A fixed threshold alarm must be set conservatively to survive varying operating conditions, which both delays detection and generates false positives. The NBM residual is the deviation from the machine's own healthy baseline at the current operating point — catching faults earlier, with fewer false alarms, on every turbine regardless of its individual signature.

- **The health index and Weibull RUL projection convert statistical residuals into a maintenance decision with explicit uncertainty.** The P10/P90 confidence interval on the remaining useful life is as operationally important as the point estimate. It is what allows a maintenance manager to book crews and order bearings six months before the window, rather than waiting until the alarm is unambiguous and the procurement lead time creates the emergency that the monitoring system existed to prevent.

- **The financial case for condition-based maintenance is driven by the intervention cost ratio, not by the cost of the digital twin.** At a 13.8:1 ratio between emergency and planned replacement costs, avoiding two unplanned interventions per year pays back a EUR 510,000 fleet implementation in 1.3 years. The digital twin is not a cost centre; it is the early-warning infrastructure that converts expensive reactive maintenance into inexpensive planned maintenance.

---

## For Further Reading

- **Grieves, M., & Vickers, J. (2017).** "Digital Twin: Mitigating Unpredictable, Undesirable Emergent Behavior in Complex Systems." In *Transdisciplinary Perspectives on Complex Systems: New Findings and Approaches*, pp. 85–113. Springer, Cham. DOI: 10.1007/978-3-319-38756-7_4. The definitive reference for the digital twin concept's intellectual history, written jointly by the two people responsible for its formalisation. Grieves provides the PLM origin from the 2002 University of Michigan PLM Consortium meeting; Vickers provides the NASA Technology Roadmap context from 2010. The chapter distinguishes clearly between simulation (static, run at design time) and the digital twin (dynamic, continuously updated from operational data). The formal definition — physical entity, virtual entity, and live bidirectional connection — is stated here with full historical attribution. Essential reading for anyone who needs to explain why a digital twin is categorically different from a simulation.

- **Randall, R. B. (2021).** *Vibration-Based Condition Monitoring: Industrial, Aerospace and Automotive Applications, 2nd Edition.* Wiley, Chichester. ISBN 978-1-119-47476-5. The graduate-level reference for machinery vibration diagnostics. Chapter 6 covers rolling element bearing analysis — defect frequency derivation from first kinematic principles, envelope analysis, and the physical distinction between outer-race and inner-race fault signatures. Chapter 9 covers gearbox diagnostics. Section 6.2 provides the BPFO and BPFI derivations in the form used in this chapter, with worked numerical examples for industrial bearings. The second edition adds coverage of machine learning approaches to bearing fault classification — random forests, one-class SVM, and neural networks applied to spectral features. Randall also covers the historical development of bearing diagnostics, from early time-domain threshold alarms in the 1970s through modern envelope-based methods, a trajectory that mirrors the evolution from SCADA alarms to digital twin described in this chapter.

- **Carroll, J., McDonald, A., & McMillan, D. (2016).** "Failure rate, repair time and unscheduled O&M cost analysis of offshore wind turbines." *Wind Energy*, 19(6), pp. 1107–1119. DOI: 10.1002/we.1887. A systematic analysis of failure rates and repair costs for offshore wind turbine components, drawing on operational data from a 350 MW European offshore portfolio. The paper reports failure rates by component category and distinguishes between minor repairs, major repairs, and major replacements. Drivetrain components (gearbox, main shaft bearings, generator) account for a disproportionate share of total downtime and cost despite relatively low failure rates — the consequence of long access wait times and high component costs in offshore conditions. The cost ratios reported for planned versus emergency interventions (ranging from 5:1 to 20:1 depending on component and season) are the empirical foundation for the financial case presented in Section 45.6.

---

*Katrine sent the payback calculation to Helena at 16:47 on a Thursday afternoon in June.*

*It was two pages: the T17 worked example and the fleet-level NPV table. At the bottom of the second page was a single number in bold type: EUR 4.2 million net present value over the asset's remaining life, discounted at WACC. Below it, Katrine had written three sentences: "All assumptions are conservative. The model does not credit earlier parts procurement or reduced secondary damage from arrested degradation. Those benefits would increase the NPV by an estimated 30 to 40 percent."*

*Kaan read it once after she left, standing at the control room window with his coffee.*

*T17 was generating 13.9 MW at 9.4 RPM in a steady northwest wind. Amber icon, HI 51. Somewhere inside the nacelle, 150 metres above the water, the main shaft bearing was rotating at 0.157 Hz and producing a mechanical impulse every 0.28 seconds at 3.56 Hz — at exactly the frequency that the geometry required, exactly as it had been since Month 14. The signal had been propagating up through the bearing housing, into the accelerometer casing, down the tower, through the array cable, into the OSS data concentrator, and into the historian that Katrine had been reading that morning. For four months before the threshold alarm triggered, the bearing had been announcing itself. Now, finally, someone had been listening in the right language.*

*His phone showed a message from Helena: "Payback looks solid. Proceed with procurement."*

*The bearing replacement was scheduled for the first June weather window. The part was on order. The crew was booked.*

*He looked at T09. The health dashboard showed HI 77, yellow zone — a gearbox intermediate shaft bearing, different BPFO, different timeline. Erik already had it on the planning schedule.*

*Two turbines talking. One message, from each, in the language of frequency spectra.*

*Outside the window, the turbines turned in the afternoon light. Erik had mentioned at lunch that an environmental survey vessel was arriving the following week — a team from the university in Gdańsk, here to assess eighteen months of biological change on the monopile foundations. Something about mussels colonising the J-tube protection brackets, and cod congregating in the scour protection rock.*

*The farm had been changing the sea since the day the first pile was driven. The question was how much, and whether that was a problem or — as Erik had put it with characteristic understatement — something else.*

*That was the next chapter.*

---

## Notes

[^1]: Grieves, M. W. (2014). *Origins of the Digital Twin Concept.* White paper, Florida Institute of Technology. DOI: 10.13140/RG.2.2.26367.61609. Available via ResearchGate. The white paper documents that the first public presentation of the digital twin concept occurred in October 2002 at a PLM Consortium organizing meeting at the University of Michigan Lurie Engineering Center, where Grieves presented a slide entitled "Conceptual Ideal for PLM" showing three elements: real space, virtual space, and a bidirectional link. The term "digital twin" was attached retroactively to this concept when it appeared as "digital twin" in Grieves's 2011 white paper "Digital Twin: Manufacturing Excellence through Virtual Factory Replication" (Grieves LLC, Cocoa Beach, FL) — the name having been coined by NASA's John Vickers in the 2010 NASA Technology Roadmap for Advanced Manufacturing (NP-2010-06-334-HQ). For Vickers's own account of the coinage and subsequent development, see: Vickers, J. (2024). *Digital Twins in a Nutshell.* Presentation at the DOE–NSF Digital Twin Workshop, 1 November 2024. NASA Technical Reports Server, document NTRS-2024-0013986.

[^2]: Renschler, C., & Vickers, J. (2021). *Digital Twins and Living Models at NASA.* ASME Digital Twin Summit Keynote. NASA Technical Reports Server, citation 20210023699. Available at ntrs.nasa.gov. This presentation documents NASA's evolving use of "living models" for spacecraft systems — computational representations updated from in-flight sensor data — from the Apollo programme through the Space Shuttle to modern International Space Station health monitoring. The authors explicitly link the Apollo 13 ground simulation to the modern digital twin concept, while noting that the Apollo 13 simulators were hardware platforms updated by human judgment rather than automated data pipelines. The presentation traces the technical evolution that made the modern sense of "digital twin" (automated live sensor feed to a computational model) practical: the miniaturisation of sensor hardware, the emergence of real-time communication protocols, and the computational capacity to process high-volume sensor streams continuously.

[^3]: Harris, T. A., & Kotzalas, M. N. (2007). *Rolling Bearing Analysis, 5th Edition. Volume 2: Advanced Concepts of Bearing Technology.* CRC Press, Boca Raton. ISBN 978-0-8493-7183-7. Chapter 13 covers vibration signature analysis for rolling element bearings, including the kinematic derivation of BPFO, BPFI, BSF (Ball Spin Frequency), and FTF (Fundamental Train Frequency) from first principles. Section 13.4 explains the physical mechanism by which outer-race defects produce non-modulated spectral peaks (stationary race, defect permanently in the load zone) and inner-race defects produce amplitude-modulated signatures (rotating race, defect cycling in and out of the load zone at the shaft frequency). The text notes that outer-race defects are typically detectable at an earlier stage of development — smaller defect dimensions — than inner-race defects for this reason.

[^4]: ISO 13374-1:2003, "Condition monitoring and diagnostics of machines — Data processing, communication and presentation — Part 1: General guidelines." International Organization for Standardization, Geneva. Section 4 defines the six functional processing blocks: (1) data acquisition, (2) data manipulation (conditioning), (3) state detection (feature extraction), (4) health assessment (condition assessment), (5) prognostics (remaining useful life estimation), (6) advisory generation (maintenance recommendation). The standard is technology-neutral: it applies to vibration-based condition monitoring, oil analysis, acoustic emission, and thermography. For wind turbine-specific data classes, see IEC 61400-25-6 (condition monitoring logical node classes for wind energy generation systems).

[^5]: Kotzalas, M. N., & Doll, G. L. (2010). "Tribological advancements for reliable wind turbine performance." *Philosophical Transactions of the Royal Society A*, 368(1929), pp. 4829–4850. DOI: 10.1098/rsta.2010.0194. The paper reviews failure mechanisms in wind turbine rolling element bearings — particularly the role of lubricant film thickness, contamination particle ingress, and dynamic overloading from turbulent wind events in determining bearing fatigue life. The Weibull shape parameter $\beta$ for offshore wind main shaft bearings is reported in the range 1.1 to 3.0 depending on load profile and installation quality. The paper notes that field bearing lifetimes frequently diverge from ISO 281 design life predictions (which use a fixed load spectrum), primarily because the actual turbulent wind load spectrum differs from the design spectrum and because rotor overloads during grid fault events introduce high-cycle fatigue cycles not captured in the design basis. Condition monitoring is recommended as the primary tool for managing the gap between design life and field reality.

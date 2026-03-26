# Chapter 41: LOTO, Emergency Response, and the Dark Scenarios

*The Feeder 5 programme was on the drill table, which was what Brigid was calling the cable reel she had positioned outside the cable basement entrance with three laminated scenario cards on it. The scenario cards were yellow. They were not the kind of cards anyone wanted to read at 08:00 on a Tuesday, which was, Kaan suspected, exactly the point.*

*"You're not signing it yet," Brigid said. She had her orange hi-vis and her clipboard and the red marking pen between two fingers. A yellow SCBA unit sat on the cable reel beside the three cards, its face mask pointing up. "Not until you can tell me what you do when each of these goes wrong."*

*He looked at the three cards. The first said: ARC FLASH. The second said: SF6 ALARM. The third said: MAN OVERBOARD.*

*"These are not edge cases," Brigid said. "Every one of them has happened on a platform inside three hundred kilometres of where we are standing. The arc flash happened at a cable termination head on a Norwegian farm, six years ago. The SF6 alarm happened at a GIS installation in the southern North Sea. The man overboard — that one was on an SOV off Bornholm. October. Water eight degrees Celsius."*

*She did not say what had happened to the people involved. She didn't need to.*

*"Anders asked you yesterday," she continued, "what happens when the relay operating time is on the wrong side of the physics. I know he did because he told me he was going to. So the first drill has his answer in it." She picked up the ARC FLASH card and set it at the front. "We start here."*

*Anders arrived at 08:09. He had a coffee. He stood against the wall. He was not going to take notes.*

---

## 41.1 Lockout/Tagout — Six Steps, Five Energy Types

The Lockout/Tagout procedure codified by OSHA regulation 29 CFR 1910.147, promulgated 1 September 1989 and effective 2 January 1990, was developed in direct response to a documented pattern: across the 1970s and 1980s, American manufacturing workers were being killed and injured at a consistent rate by equipment that released stored energy during maintenance. The machines were de-energised. The switches were open. The workers believed the equipment was safe. It was not, because the switches had addressed only the electrical energy input. The stored mechanical energy — the compressed spring, the raised load, the pressurised accumulator — was still present.

OSHA estimated the standard would prevent approximately 120 deaths and 50,000 injuries per year in the United States alone. The same estimation framework is embedded in EN/IEC 50110-1 and the offshore equivalents — the UK Offshore Electricity and Noise Regulations 1997, the Polish maritime law provisions governing fixed offshore installations in the exclusive economic zone. The number of energy types that must be addressed before maintenance access is granted is not limited to electricity.

The six steps of an effective LOTO procedure are:

**Step 1: Prepare.** Identify every energy source that could harm the work team if released during the maintenance activity. For an offshore substation, this includes: electrical energy at every voltage level present in or connected to the equipment; mechanical energy stored in operating mechanism springs; thermal energy in hot transformer oil, energised heating elements, and charged batteries; pressure energy in SF6 gas compartments, hydraulic actuators, and compressed air systems; gravitational potential energy in raised equipment suspended on maintenance hooks or tap-changer diverter switches.

**Step 2: Notify.** Communicate the isolation scope to every person who will be working in or passing through the affected area. In a multi-team commissioning environment, notification extends beyond the immediate work team to include any contractor who might enter the cable basement during the isolation window.

**Step 3: Isolate.** Operate every isolating device in the required sequence. For the Feeder 5 cable termination inspection: open the 66 kV feeder circuit breaker, open the 66 kV bus disconnector, close the busbar-side earth switch, close the cable-side earth switch at each of the five WTG switchboards, and confirm all five WTG disconnectors open. The sequence established in Chapter 39 is operative.

**Step 4: Apply lockout devices.** Physical padlocks — unique key — on each isolating device operated in Step 3. No two padlocks on the same lock hasp share a key. If three people are working in the cable basement, three separate padlocks are on the main earth switch hasp, one per person.

**Step 5: Release and restrain stored energy.** This step is the one most commonly abbreviated in practice and most frequently implicated in serious incidents. For the Feeder 5 cable termination inspection, it includes four distinct categories:

*Electrical stored energy:* The 12 km 66 kV Feeder 5 cable stores reactive energy at rated voltage. The closed earth switches discharge this energy; the dead test in Step 6 confirms it has been discharged. No additional action required if earth switches are confirmed closed.

*Spring mechanism stored energy:* The GIS 66 kV disconnector operating mechanism adjacent to the Feeder 5 spout is spring-operated — an internal spring stores energy after each operation to power the next high-speed open or close. Before any maintenance personnel open the operating mechanism access cover, the mechanism must be discharged by driving it to its fully open or closed position. A discharged spring mechanism is confirmed by the absence of the SPRING CHARGED indicator on the mechanism door.

*SF6 pressure energy:* The GIS compartment containing the Feeder 5 spout is filled with SF6 at approximately 4.5 bar gauge. Before any work involves opening an access panel that penetrates the SF6 pressure boundary, the compartment must be vented to a certified SF6 recovery vessel, reducing compartment pressure to atmospheric. Confirmed by the compartment pressure gauge reading zero bar gauge.

*Thermal energy:* For work involving access to oil-filled components adjacent to the work zone — transformer bushings, cable termination oil-filled chambers — confirm that the oil temperature is below 40°C before opening any oil-filled access covers. The stored thermal energy in a large power transformer oil fill is substantial:

$$Q_{\text{oil}} = m_{\text{oil}} \cdot c_p \cdot (T_{\text{oil}} - T_{\text{ref}})$$

where:
- $m_{\text{oil}}$ = transformer oil mass [kg]
- $c_p$ = specific heat of mineral insulating oil ≈ 1,700 J/(kg·K)
- $T_{\text{oil}}$ = oil temperature at time of access [°C]
- $T_{\text{ref}}$ = ambient temperature [°C]

For the 225 MVA main power transformer with $m_{\text{oil}} = 58{,}000$ kg and an oil temperature of 72°C after eight hours at full load:

$$Q_{\text{oil}} = 58{,}000 \times 1{,}700 \times (72 - 15) = 5.61 \times 10^9 \text{ J} = 5{,}610 \text{ MJ}$$

A drain valve opened on hot pressurised oil will produce a jet of mineral oil at 72°C at line pressure. The 40°C threshold is not conservative caution — it is the threshold below which skin contact with a transient splash causes a first-degree but not a second-degree burn. Above 40°C, flash contact produces immediate tissue damage. The Step 5 requirement is a thermodynamic boundary condition.

**Step 6: Verify.** Dead test on every conductor and connection point to be touched. Measure; do not assume. Chapter 40, Section 40.3. This step does not change.

<!-- IMAGE: fig-41-1 -->
> **Figure 41.1** — LOTO Six Steps with Energy Types for Offshore Substation
> **Type:** Structured flow diagram
> **Content:** Six steps in vertical sequence. Each step has an icon and a brief description. Step 5 is expanded into four sub-bullets: spring mechanism (mechanical), SF6 pressure (pneumatic), transformer oil (thermal), cable charge (electrical). Step 5 box highlighted in amber. Step 6 in green with dead-test instrument icon.
> **Caption:** The six-step LOTO procedure and the energy types present in a 66/220 kV offshore substation. Step 5 (stored energy release) is the step most commonly abbreviated and most frequently implicated in serious incidents.
> **Alt text:** Flow diagram of LOTO steps with energy type annotations at Step 5.
> **Data source:** OSHA 29 CFR 1910.147, EN ISO 14118:2018, EN 50110-1:2013.
> **Resolution:** 1000 × 1400 px minimum
> **Color notes:** Step 5 amber, Step 6 green, remaining steps neutral grey. Sub-bullets in Step 5 each colour-coded by energy type.

---

## 41.2 Arc Flash Hazard Analysis — The Wrong Clearing Time

"The relay operating time," Anders said, when Brigid handed him the ARC FLASH card. He looked at it and then at Kaan. "From yesterday. What is on the wrong side?"

The answer required a calculation.

Arc flash is the uncontrolled electrical discharge through an ionised plasma channel in air. The thermal energy released — as radiated heat, pressure wave, and molten metal vapour — is determined by two quantities: the available fault current, which sets the power of the arc, and the duration of the arc, which sets the energy. Both quantities are determined by the protection system's response.

The incident energy $E_i$ — the radiated heat energy per unit area reaching a worker's body at distance $D$ from the arc source — is the quantity that determines PPE requirements. IEEE 1584:2018, the standard that defines the incident energy analysis method for most industrial installations, was validated for system voltages up to 15 kV. For a 66 kV cable termination, it is extrapolated beyond its validated range; the reference values used here are derived from the IEC 62271-200:2021 arc energy test data established in Chapter 40 ($E_{\text{arc,ref}} = 400$ kJ/phase at $t_{\text{ref}} = 200$ ms). Project-specific arc flash analysis at 66 kV requires finite element modelling using the circuit geometry; the formula below establishes the scaling principle.

For a cable basement installation where the geometry partially confines the arc radiation:

$$E_i = \frac{k_c \cdot E_{\text{arc,ref}} \cdot (t_{\text{clear}}/t_{\text{ref}})}{2\pi D^2 \cdot c_{\text{th}}}$$

where:
- $E_i$ = incident energy [cal/cm²]
- $k_c$ = cavity amplification factor [−] (1.0 for open field; 1.8 for enclosed cable basement with reflective surfaces — accounts for reflected radiation from walls and ceiling)
- $E_{\text{arc,ref}}$ = arc energy per phase at reference clearing time [J]
- $t_{\text{clear}}$ = relay clearing time [s]
- $t_{\text{ref}}$ = reference clearing time [s]
- $D$ = working distance from arc source [cm]
- $c_{\text{th}}$ = 4.184 J/cal

The NFPA 70E:2024 PPE categories — the industry-standard classification of required protective equipment based on minimum arc rating:

| PPE Category | Min. arc rating [cal/cm²] | Typical ensemble |
|-------------|--------------------------|-----------------|
| 1 | 4 | Single-layer FR coverall, safety glasses, leather gloves |
| 2 | 8 | Two-layer FR coverall, arc-rated face shield, leather gloves |
| 3 | 25 | Arc flash suit jacket + trousers, arc-rated hood, insulating gloves |
| 4 | 40 | Heavy arc flash suit, full head/neck coverage, Class 00 insulating gloves |
| > 40 | — | No PPE will protect — do not perform this work while energised |

The Feeder 5 cable termination inspection places the work team at $D = 450$ mm from the cable head — a typical working distance for a standing inspection. The 87L differential relay is the primary protection, with $t_{\text{clear,87L}} = 35$ ms (Chapter 26).

At primary relay clearing time:

$$E_{i,\text{primary}} = \frac{1.8 \times 400{,}000 \times (0.035/0.200)}{2\pi \times 45^2 \times 4.184} = \frac{126{,}000}{53{,}232} = 2.4 \text{ cal/cm}^2 \quad \rightarrow \textbf{Category 1}$$

The programme as written specifies Category 1 minimum. This is correct — under one assumption.

"Under this assumption," Anders said. "What is the assumption?"

That the 87L relay operates.

The 87L differential relay requires a healthy CT circuit on each phase. The CT secondary terminal blocks are mounted on the GIS frame at approximately 1.2 m height in the cable basement — the same space the inspection team will be working in, at the same time. A tool dropped near a CT secondary terminal, or vibration from torque-wrenching the cable head bolts, or contact with a cable tray edge, can short-circuit or open-circuit the CT secondary wiring. An open-circuited CT secondary disables the differential protection for that phase. Protection falls back to the R1 IDMT overcurrent relay. Clearing time from Chapter 26: $t_{\text{clear,R1}} = 308$ ms.

At R1 backup relay clearing time:

$$E_{i,\text{backup}} = \frac{1.8 \times 400{,}000 \times (0.308/0.200)}{2\pi \times 45^2 \times 4.184} = \frac{1{,}108{,}800}{53{,}232} = 20.8 \text{ cal/cm}^2 \quad \rightarrow \textbf{Category 3}$$

The work team is wearing Category 1 PPE rated at 4 cal/cm². The incident energy under backup clearing is 20.8 cal/cm² — 5.2 times the PPE's protection capacity. Category 1 PPE in a 20.8 cal/cm² exposure does not provide partial protection. It provides 4 cal/cm² of protection. The remaining 16.8 cal/cm² reaches the body.

This is what is on the wrong side of the physics. Not a fault in the protection design. Not an unlikely scenario. A consequence of the work itself creating the mechanism that removes the primary protection.

The Flash Protection Boundary — the distance at which incident energy drops to 1.2 cal/cm², the threshold for second-degree burn onset — at R1 backup clearing:

$$D_{\text{FPB}} = D_{\text{work}} \times \sqrt{\frac{E_{i,\text{backup}}}{1.2}} = 45 \times \sqrt{\frac{20.8}{1.2}} = 45 \times 4.16 = 187 \text{ cm} \approx 1.9 \text{ m}$$

The cable basement is approximately 3 m wide. The Flash Protection Boundary at backup relay clearing time encompasses the full width of the basement. There is nowhere in the basement that is outside it.

Two engineering responses exist. First: add a pre-access verification step confirming CT secondary circuit integrity — measure the secondary loop resistance on all three phases, compare to the commissioning baseline, hold if delta exceeds 5 Ω. This confirms the 87L relay is healthy before the work team enters. Second: specify Category 3 PPE for all cable basement work during 66 kV cable operations, regardless of CT circuit status. Category 3 at 25 cal/cm² minimum arc rating protects against the R1 backup scenario (20.8 cal/cm²) with a 4.2 cal/cm² margin. The conservative specification does not require the engineer to verify CT circuit health before granting access, because it is correct whether or not the 87L relay is healthy.

The correct answer is both, in sequence.

<!-- IMAGE: fig-41-2 -->
> **Figure 41.2** — Arc Flash Incident Energy Scaling with Relay Clearing Time
> **Type:** Annotated bar chart
> **Content:** Three vertical bars. X-axis labels: "87L Primary (35 ms)", "R1 IDMT Backup (308 ms)", "R3 Second Backup (715 ms)". Y-axis: Incident energy [cal/cm²], range 0–55. Bar heights: 2.4, 20.8, 48.3. Horizontal dashed lines at 4 (Cat 1), 8 (Cat 2), 25 (Cat 3), 40 (Cat 4). 87L bar is green. R1 bar is amber. R3 bar is red (above Cat 4 line). Annotation on Cat 4 line: "No PPE will protect — do not work energised."
> **Caption:** Incident energy at 450 mm working distance scales linearly with relay clearing time. Primary 87L protection keeps the work zone in Category 1. Backup relay activation pushes it to Category 3. R3 second backup clears at 715 ms — beyond Category 4.
> **Alt text:** Bar chart showing incident energy at three clearing times relative to NFPA 70E PPE category thresholds.
> **Data source:** Author calculation, IEC 62271-200:2021 arc energy reference data, NFPA 70E:2024 Table 130.7(C)(15)(c).
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Green/amber/red bars. PPE threshold lines dashed, labelled on right axis.

> **Standard reference:** IEC 62271-200:2021, "AC metal-enclosed switchgear and controlgear for rated voltages above 1 kV and up to and including 52 kV," Section 6.106 — Internal arc classification (IAC) testing. IEEE 1584:2018, "IEEE Guide for Performing Arc-Flash Hazard Calculations" — validated for ≤15 kV; extrapolation to 66 kV requires project-specific modelling. NFPA 70E:2024, "Standard for Electrical Safety in the Workplace," Table 130.7(C)(15)(c).

---

## 41.3 SF6 Leak Response — What You Cannot Smell

"The second scenario," Brigid said, handing him the SF6 ALARM card, "happens quietly."

Sulphur hexafluoride has no odour. It has no colour. In its pure form, at concentrations below a few percent by volume, it causes no physiological symptoms whatever. A GIS compartment that has been leaking SF6 for twelve hours looks, smells, and feels exactly like a GIS compartment that has not. The only reliable detection is instrumental.

The OSS GIS hall is equipped with fixed infrared SF6 gas detectors at floor level, spaced at 4 m intervals. SF6 is 5.0 times denser than air — it sinks. A leak from a GIS flange fitting at 3 m height will drift down and pool at floor level. The floor-level placement of detectors is not incidental.

The two-stage alarm system:
- Stage 1 (1,000 ppm): caution alert. Identify the leak location from the detector map. Increase ventilation. Do not enter the source bay without a personal SF6 monitor.
- Stage 2 (3,000 ppm): immediate evacuation of the affected zone. No investigation. No retrieval of equipment. Proceed directly to the designated muster point.

The quantity of SF6 available from a single GIS compartment determines the maximum possible concentration in the affected room. At gauge pressure $P_g$, the released volume at atmospheric pressure is:

$$V_{\text{gas}} = \left(\frac{P_g}{P_a} + 1\right) \cdot V_c$$

where:
- $V_{\text{gas}}$ = volume of SF6 at standard atmospheric conditions [m³]
- $P_g$ = GIS compartment gauge pressure [bar]
- $P_a$ = atmospheric pressure = 1.013 bar
- $V_c$ = compartment internal volume [m³]

The equilibrium concentration in a room of volume $V_r$ after full compartment release:

$$C_{\text{SF}_6} = \frac{V_{\text{gas}}}{V_r + V_{\text{gas}}}$$

For a GIS bus section compartment with $V_c = 0.5$ m³ at $P_g = 4.5$ bar, releasing into the cable basement ($V_r = 80$ m³):

$$V_{\text{gas}} = (4.5/1.013 + 1) \times 0.5 = 5.44 \times 0.5 = 2.72 \text{ m}^3$$

$$C_{\text{SF}_6} = \frac{2.72}{80 + 2.72} = 0.033 = 3.3\% = 33{,}000 \text{ ppm}$$

The Stage 2 evacuation threshold is 3,000 ppm. A single compartment rupture produces an equilibrium concentration eleven times the evacuation threshold. By the time the floor-level sensor registers Stage 2, the local concentration near the leak source is substantially higher. Stage 2 is not an investigation prompt. It is an exit instruction.

In pure form, SF6 is physiologically inert. The hazard emerges when SF6 is exposed to an electrical arc in the presence of moisture: the arc decomposes SF6 into sulphuryl fluoride (SO₂F₂), thionyl fluoride (SOF₂), sulphur dioxide (SO₂), and hydrogen fluoride (HF). HF has a ceiling TLV of 0.5 ppm from the American Conference of Governmental Industrial Hygienists. At 0.5 ppm, it causes immediate irritation of the eyes and respiratory tract. At concentrations above 5 ppm, it produces pulmonary oedema. These concentrations occur in the immediate vicinity of an arc-faulted GIS compartment. Activated carbon filter masks do not adequately remove HF at low ppm levels. Only SCBA — a self-contained breathing apparatus with positive pressure — provides reliable protection for entry into a post-arc compartment environment.

The rule for arc-faulted GIS: do not open it. Any entry to an arc-faulted GIS compartment requires SCBA, full-body chemical protective clothing, and written approval from the plant HSE authority, the equipment manufacturer, and the site's environmental officer. The decomposition products deposited on internal surfaces are classified as hazardous waste under EU Directive 2008/98/EC. The SF6 gas itself must be recovered to a certified containment vessel before any maintenance; the European F-Gas Regulation 2024/573 prohibits intentional atmospheric release and requires annual leak testing for GIS installations above specified gas thresholds.

A reliable piece of industrial knowledge about SF6 that is unrelated to its suppression properties: if you inhale a small quantity of pure SF6, your voice becomes extremely deep — the opposite of the helium effect. Sound travels at 138 m/s in SF6 compared to 343 m/s in air, so the resonant modes of the vocal tract shift dramatically downward. The effect has been demonstrated in chemistry lectures and, memorably, at engineering conferences where the demonstrator had ready access to a GIS bay and insufficient appreciation of the gas's density. At room temperature and pressure, SF6 sinks and does not disperse through normal respiratory effort. The demonstrators who required brief medical attention via this route are not uniformly tragic figures, but they are instructive ones.

<!-- IMAGE: fig-41-3 -->
> **Figure 41.3** — SF6 Concentration Profile After Single Compartment Release into Cable Basement
> **Type:** Cross-sectional diagram
> **Content:** Side view of cable basement (3 m height × 8 m length). Colour gradient (blue near zero, red maximum) showing SF6 pooling at floor level. GIS compartment on left wall at 2 m height, arrow showing release direction downward. Floor-level detectors (small squares, 0.1 m height) annotated. Stage 2 contour at approximately 0.6 m height labelled "3,000 ppm — evacuate." Stage 1 contour at 1.2 m height labelled "1,000 ppm — caution."
> **Caption:** SF6 (5× denser than air) released at GIS height pools at floor level. Floor-level detectors provide earliest warning. A single 0.5 m³ compartment at 4.5 bar produces ~33,000 ppm equilibrium concentration in an 80 m³ cable basement — eleven times the Stage 2 evacuation threshold.
> **Alt text:** Cross-section of cable basement showing SF6 concentration gradient sinking to floor, with alarm thresholds annotated at height.
> **Data source:** Ideal gas calculation from compartment volume and pressure; SF6 density 6.14 kg/m³ (5.0× air).
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Blue-to-red gradient. Alarm contours as dashed white lines with labels.

---

## 41.4 Fire Suppression — The Thirty-Second Rule

"There are three things that burn in this building," Brigid said, walking through the GIS hall toward the transformer bay. "The transformer oil, the low-voltage switchroom, and the battery room. For each one, the suppression system is different. For all of them, the rule is the same: thirty seconds."

The transformer bay uses high-pressure water mist suppression. Water mist produces droplets below 200 microns in diameter; these evaporate rapidly in contact with hot oil surfaces, absorbing heat and reducing the temperature below the oil flash point (approximately 145°C for standard mineral insulating oil) while forming a steam blanket that suppresses oxygen access to the flame. The system activates on a 2-of-2 voting logic — ionisation smoke detector and heat detector — to prevent spurious discharge from steam or condensation.

The LV switchroom and battery room use total-flooding clean agent suppression. Two agents are in common use:

*FM-200 (HFC-227ea):* design concentration 7.0% by volume for transformer oil fires, global warming potential 3,600 (IPCC AR6, 2021). Extinguishes by interrupting the chemical chain reaction of combustion; safe for occupied spaces up to the NOAEL concentration of 9% v/v.

*Novec 1230 (FK-5-1-12):* design concentration 4.0–5.5% by volume, GWP less than 1.0. Increasingly specified for new offshore installations as F-Gas Regulation requirements tighten. Thermally stable, same mechanism of action as FM-200, fully halogen-free.

The agent volume required to achieve design concentration:

$$V_{\text{agent}} = \frac{C_d \cdot V_r}{1 - C_d}$$

where:
- $V_{\text{agent}}$ = agent volume at standard conditions [m³]
- $C_d$ = design concentration [fraction by volume]
- $V_r$ = protected room volume [m³]

For a 150 m³ LV switchroom with FM-200 at $C_d = 7.0\%$:

$$V_{\text{agent}} = \frac{0.070 \times 150}{1 - 0.070} = \frac{10.5}{0.930} = 11.3 \text{ m}^3 \equiv 80.8 \text{ kg of FM-200 agent}$$

Per NFPA 2001:2022, the pre-discharge alarm — a continuous horn and strobe — must sound for a minimum of 30 seconds before agent release. This is not a courtesy pause. At FM-200 design concentration (7.0%), the room atmosphere reduces oxygen partial pressure from 20.9% to 19.4% — below the 19.5% alarm threshold of personal oxygen monitors. Thirty seconds is the designed evacuation time. Anyone still in the room when the discharge completes is in an oxygen-deficient atmosphere.

The GIS hall has no fixed suppression system. The SF6 inside the GIS enclosures is itself arc-suppressive; the primary hazard in the GIS hall is not fire from the buses, but fire from the GIS control cubicles or cable trays. Detection only — addressable smoke detectors, heat sensors — with portable extinguisher access. Any fire in the GIS hall that threatens the bus structure requires evacuation and external fire service response, not suppression by the work team.

---

## 41.5 Man Overboard — The Ten-Minute Window

The OSS external deck on the weather side faced north-northeast across 80 kilometres of open water. At 09:45 on an October morning, the sea temperature was 8.2°C. Kaan had seen this number on the SCADA main screen every day for three weeks without thinking of it as anything except a turbine cooling circuit input.

Brigid was holding a heaving line and a horseshoe buoy. She handed both to him.

"Throw it at the orange buoy," she said, pointing to a buoy in the water 15 metres off the deck. "You want the line to reach it."

He threw. He missed by four metres.

"Throw upwind," she said. "The buoy drifts toward the person. You are not trying to hit them."

He threw again. The line fell across the orange flag.

She was not visibly impressed. It was a calm day.

---

The physics of cold water survival is captured in the 1-10-1 rule, codified by the United States Coast Guard Marine Safety Center and supported by decades of military and civilian immersion research from Dr. Martin Tipton (University of Portsmouth) and Dr. Frank Golden (Royal Naval Institute of Naval Medicine):

**1 minute:** Cold shock. Sudden immersion below 15°C triggers an involuntary gasp reflex and hyperventilation, lasting approximately one minute. During this phase, the risk of inhaling water is high and breathing control is severely impaired.

**10 minutes:** Swimming failure. Progressive muscle cooling causes loss of fine and gross motor control. At 10°C, meaningful arm and leg movement begins to fail at approximately 10 minutes. At 5°C, failure is faster. A person who cannot swim and is not face-up in waves will inhale water.

**1 hour:** Hypothermia. Core body temperature drops below 35°C. Loss of consciousness occurs between 30 and 90 minutes depending on body composition and water temperature. Below 30°C, ventricular fibrillation risk is substantial.

At Baltic Sea temperatures in October (8–10°C), the transition from cold shock to swimming failure occurs within approximately 10 minutes without an immersion suit. A rough empirical guide from USCG data:

$$T_{\text{swim}} \approx 0.56 \cdot T_w + 3.9 \text{ min} \quad (5 \leq T_w \leq 20°\text{C})$$

where $T_w$ is water temperature in °C. At $T_w = 8.2°C$: $T_{\text{swim}} \approx 0.56 \times 8.2 + 3.9 = 8.5$ minutes. The rescue must achieve physical contact within approximately 8–9 minutes for a person in work clothing without an immersion suit. An immersion suit suppresses cold shock, delays swimming failure beyond one hour, and extends the hypothermia onset to 4–6 hours depending on sea state. The immersion suit cabinet by the external door contains one suit for every authorised person on the OSS plus two spares. It is not optional during any deck operation.

The MOB response sequence, per SOLAS Chapter V:

1. **Alarm:** MOB button on bridge (or radio "MAYDAY MAYDAY MAYDAY, Man Overboard"). AIS receiver logs the GPS position automatically.
2. **Throw:** Heave the MOB buoy (self-illuminating light, loud whistle) and heaving line upwind. The buoy drifts toward the person; throwing directly in a sea state is unreliable.
3. **Watch:** Designate a lookout who does not take eyes off the person in the water and does not perform any other task. Point continuously.
4. **Communicate:** Radio MAYDAY on VHF Channel 16 with vessel name, position, description, and time. Contact MRCC Gdynia for Polish Baltic waters.
5. **Manoeuvre:** CTV or small SOV: direct return on reciprocal course. Large SOV: Williamson Turn.

The Williamson Turn was developed by John Williamson of the United States Naval Reserve in 1943 for MOB recovery in vessels too large to turn immediately. The procedure: turn 60° to the same side as the MOB event, then apply hard opposite rudder, steer to 20° past the vessel's original reciprocal heading, and proceed at slow speed. This returns the vessel to the victim's original position on a reciprocal course, accounting for vessel drift, and allows a controlled slow approach from upwind. For a 6,000-tonne SOV at 12 knots, the Williamson Turn requires 3–4 minutes and returns the vessel to within 50 metres of the MOB position.

<!-- IMAGE: fig-41-4 -->
> **Figure 41.4** — Williamson Turn for Large Offshore Vessel MOB Recovery
> **Type:** Overhead navigation diagram
> **Content:** Vessel original course shown as dashed arrow heading north. MOB event marked as red star. Williamson Turn path: 60° starboard, hard port, steer 20° past reciprocal. Return course shown converging on MOB position from upwind. Time stamps: +0 min (MOB event), +1 min (60° starboard turn), +3 min (hard port turn), +4 min (reciprocal course), +6 min (approach). Vessel icon at each waypoint.
> **Caption:** The Williamson Turn returns a large vessel to its MOB position in approximately 4–6 minutes, accounting for drift, on a reciprocal course that allows a controlled upwind approach. For small CTV/OSS vessels, direct return is faster and preferred.
> **Alt text:** Overhead diagram of Williamson Turn manoeuvre with time annotations.
> **Data source:** SOLAS Chapter V Reg. 33, Williamson (1950), US Naval Institute Proceedings.
> **Resolution:** 1200 × 1000 px minimum
> **Color notes:** Original course grey dashed, turn path blue, return course green, MOB red star.

---

## 41.X Worked Example: Arc Flash PPE Category Verification for Feeder 5 Inspection

**Context:** Feeder 5 cable termination splice inspection. One month post-commissioning. Proposed programme specifies Category 1 PPE (minimum 4 cal/cm²) based on 87L differential relay as primary protection.

**Task:** Verify whether the PPE specification remains valid across all foreseeable protection scenarios.

**System parameters (from Chapters 26 and 40):**
- Bus voltage: 66 kV (V_LL)
- Maximum fault current: 12,700 A
- Arc energy reference: $E_{\text{arc,ref}}$ = 400 kJ/phase at $t_{\text{ref}}$ = 200 ms
- Working distance: $D$ = 450 mm = 45 cm
- Cavity amplification factor: $k_c$ = 1.8 (cable basement, partial enclosure)

**Protection clearing times (from Chapter 26):**
- 87L differential (primary): $t_1$ = 35 ms
- R1 IDMT overcurrent (backup): $t_2$ = 308 ms
- R3 second backup: $t_3$ = 715 ms

**Step 1: Incident energy at each clearing time**

$$E_i = \frac{k_c \cdot E_{\text{arc,ref}} \cdot (t/t_{\text{ref}})}{2\pi D^2 \cdot c_{\text{th}}}$$

Primary (87L, 35 ms):
$$E_{i,1} = \frac{1.8 \times 400{,}000 \times (0.035/0.200)}{2\pi \times 45^2 \times 4.184} = \frac{126{,}000}{53{,}232} = 2.4 \text{ cal/cm}^2 \rightarrow \textbf{Category 1}$$

R1 backup (308 ms):
$$E_{i,2} = \frac{1.8 \times 400{,}000 \times (0.308/0.200)}{2\pi \times 45^2 \times 4.184} = \frac{1{,}108{,}800}{53{,}232} = 20.8 \text{ cal/cm}^2 \rightarrow \textbf{Category 3}$$

R3 second backup (715 ms):
$$E_{i,3} = \frac{1.8 \times 400{,}000 \times (0.715/0.200)}{53{,}232} = \frac{2{,}574{,}000}{53{,}232} = 48.4 \text{ cal/cm}^2 \rightarrow \textbf{Above Category 4}$$

**Step 2: Flash Protection Boundary at R1 backup scenario**

$$D_{\text{FPB}} = D_{\text{work}} \times \sqrt{\frac{E_{i,2}}{1.2}} = 45 \times \sqrt{\frac{20.8}{1.2}} = 45 \times 4.16 = 187 \text{ cm} \approx 1.9 \text{ m}$$

The cable basement is 3 m wide. At R1 backup clearing time, the Flash Protection Boundary encompasses the full width of the basement.

**Step 3: Assessment of 87L reliability during cable termination work**

The CT secondary terminal blocks are located in the cable basement adjacent to the cable termination head. Physical access to the cable head creates a foreseeable mechanism for CT secondary circuit disturbance — tool contact, vibration from torque wrenching, dropped hardware. If 87L is disabled by CT disruption → R1 activates → 308 ms → 20.8 cal/cm².

**Protection deficit:** Category 1 PPE rated at 4 cal/cm². Backup relay incident energy: 20.8 cal/cm². Ratio: **5.2×**.

**Step 4: Engineering revisions to programme**

| Item | Original programme | Revised programme |
|------|-------------------|-------------------|
| PPE specification | Category 1 minimum (4 cal/cm²) | Category 3 minimum (25 cal/cm²) |
| CT circuit check | Not included | Step 4A: measure CT secondary loop resistance, compare to baseline; delta > 5 Ω = hold |
| Justification recorded | No | Yes — two sentences in programme header |

**Summary of incident energy by protection scenario:**

| Protection state | Clearing time | $E_i$ at 450 mm | Required PPE | Revised spec | Adequate? |
|-----------------|--------------|----------------|-------------|-------------|-----------|
| 87L primary | 35 ms | 2.4 cal/cm² | Category 1 | Category 3 | ✓ (margin: 22.6) |
| R1 IDMT backup | 308 ms | 20.8 cal/cm² | Category 3 | Category 3 | ✓ (margin: 4.2) |
| R3 second backup | 715 ms | 48.4 cal/cm² | Evacuate | N/A | — |

Category 3 PPE (25 cal/cm² minimum arc rating) protects against the R1 backup scenario with a 4.2 cal/cm² margin. It does not protect against R3 second backup clearing (48.4 cal/cm²) — if protection degrades to that level, the cable basement must be evacuated before the arc can be cleared. This boundary is not a design failure; it is the limit of what PPE can achieve at 66 kV and 12,700 A. The answer to R3 exposure is not better PPE. It is not being in the room.

---

## Key Takeaways

- **LOTO Step 5 — stored energy release — is the step most commonly abbreviated and most frequently implicated in serious incidents.** In an offshore substation, stored energy includes electrical charge (cable capacitance), spring-loaded switchgear mechanisms, SF6 under gauge pressure, hot transformer oil, and charged batteries. Opening the main electrical supply addresses only one of these.

- **Arc flash PPE category is determined by the relay that actually clears the fault, not the relay that was designed to clear it.** If the work itself can defeat the primary protection, PPE must be sized for the backup relay clearing time. For cable basement work at 450 mm working distance, primary relay clearing (35 ms) requires Category 1; backup relay clearing (308 ms) requires Category 3. Category 1 PPE in a Category 3 exposure does not provide partial protection — it provides 4 cal/cm² of protection against 20.8 cal/cm² of incident energy.

- **SF6 has no odour.** Detection is exclusively by instrument. A Stage 2 alarm (3,000 ppm) means immediate evacuation — not investigation. A single 0.5 m³ GIS compartment at 4.5 bar can produce 33,000 ppm equilibrium concentration in an 80 m³ cable basement — eleven times the evacuation threshold. After any arc event in a GIS compartment, decomposition products HF and SOF₂ are present; no re-entry without SCBA.

- **At Baltic Sea temperatures in October (8–10°C), effective swimming ability is limited to approximately 8–10 minutes without an immersion suit (1-10-1 rule).** The MOB rescue window is roughly coterminous with the CTV response time. The immersion suit cabinet by the external door is not optional during deck operations — it is the difference between an 8-minute rescue window and a 4-hour one.

- **An engineer who modifies the programme before signing it is more valuable than one who executes it as written.** The programme is drafted before the work begins, by someone who may not have known the protection relay configuration, the cable basement geometry, or the arc flash calculation. The engineer at the point of signing does know these things. The programme is the starting point for engineering judgement, not the conclusion of it.

---

## For Further Reading

- **NFPA 70E:2024.** *Standard for Electrical Safety in the Workplace.* National Fire Protection Association, Quincy, MA. Article 130 covers the incident energy analysis method and PPE category approach. Table 130.7(C)(15)(c) provides PPE category arc ratings. Annex D gives a worked example using IEEE 1584:2018 parameters for systems up to 15 kV; for systems above 15 kV, Annex D directs the engineer to IEC 62271-200 arc test data or project-specific FEM modelling. The 2024 edition added clarifications to the arc flash boundary calculation and updated PPE category descriptions to align with IEC 61482-2:2018.

- **Golden, F.StC. and Tipton, M.J. (2002).** *Essentials of Sea Survival.* Human Kinetics, Champaign, IL. ISBN 0-7360-3765-8. The definitive synthesis of cold water immersion physiology from four decades of UK Royal Navy and civilian research. Chapter 4 covers the four phases of cold water immersion (cold shock, swimming failure, hypothermia, post-rescue collapse) with empirical data from controlled immersion experiments at temperatures from 5°C to 25°C. The 1-10-1 rule is a practical summary derived from this data. The USCG codification is in: *A Guide to Cold Water Survival*, MSC.1/Circ.1185a (2013), available at dco.uscg.mil.

- **IEC 62271-200:2021.** *AC metal-enclosed switchgear and controlgear for rated voltages above 1 kV and up to and including 52 kV.* International Electrotechnical Commission. Section 6.106 covers internal arc classification (IAC) testing: the test conditions (current, duration, accessible face classification A/B/F) and the criteria for personnel protection at the specified test distances. The IAC marking on the GIS nameplate (e.g., IAC AFLR 25 kA 1 s) states the arc current and duration for which the enclosure has been tested to retain structural integrity and protect personnel at the accessible face distances defined in Table 7. Understanding the IAC marking allows the arc flash analyst to determine whether the GIS enclosure provides additional shielding in the cable basement zone.

---

*Kaan looked at the Feeder 5 programme for two minutes. Then he picked up a pen — a real pen, not a pencil — and made three marks.*

*He wrote "4A" in the margin between Steps 4 and 5. Next to it, in small neat letters: "CT secondary circuit continuity verification — measure secondary loop resistance, all three phases, compare to commissioning baseline. Delta > 5 Ω: hold. Notify protection engineer before proceeding."*

*He crossed out the PPE specification.*

*He wrote: "Category 3 minimum (25 cal/cm²) for all personnel in cable basement, Steps 4A through 11."*

*Above Step 4A, he wrote two sentences. He did not abbreviate them or put them in note form. He wrote them as a complete engineering statement: the calculation, the 5.2 factor, the CT secondary exposure, the reason that Category 1 was inadequate for the backup relay scenario.*

*He signed it.*

*Brigid read it over his shoulder. She did not say anything about the added step. She initialled the revision log at the bottom — B. O'Neill, HSE, date — without pausing.*

*"That's the right programme," she said.*

*Anders, from the back of the room, did not say anything for a moment. Then: "Why Category 3?"*

*He already knew. He was asking Kaan to say it out loud.*

*Kaan told him. The backup relay. The 308 milliseconds. The 20.8 cal/cm². The 5.2 factor. The CT terminal blocks adjacent to the cable head, at 1.2 m height, accessible to any tool that slipped from a work tray.*

*Anders was quiet. Then: "Write that in the programme. Not in your notebook. In the programme. The person reading this in twelve years does not have your notebook. They have this."*

*Kaan added the paragraph above Step 4A. Four sentences. It was now part of the permanent work record for Feeder 5, attached to the commissioning file, indexed under Feeder 5 Cable Splice Inspection, Month 10.*

*He looked out through the control room window toward the north-northeast. Thirty-four rotors in 11.8 m/s wind. In the water below the deck, 8.2°C. He thought, briefly, about the immersion suit cabinet and the count he had done in his head. One for every person, plus two spare.*

*Ten days. The PSE grid compliance audit. Piotr Zawadzki — the voice on the radio from Chapters 25 and 39 — would be in this room, in person, with his own calculations, and the full weight of the Polish transmission system operator's contractual authority to certify or not certify.*

*"Anders," he said. "Who comes from PSE for the compliance audit?"*

*"Zawadzki."*

*Kaan nodded.*

*"He will bring calculations," Anders said. "You should bring yours."*

---

## Notes

[^1]: OSHA 29 CFR 1910.147: *The Control of Hazardous Energy (Lockout/Tagout)*. Promulgated 1 September 1989; effective 2 January 1990. 54 Fed. Reg. 36644. US Occupational Safety and Health Administration. Available at osha.gov. The Standard's preamble estimates compliance would prevent approximately 120 fatalities and 29,000 lost-workday injuries per year in US manufacturing and service industries. EN ISO 14118:2018 (*Safety of machinery — Prevention of unexpected start-up*, CENELEC) is the European equivalent for machinery LOTO. For electrical systems specifically: EN 50110-1:2013 Section 6.6 covers verification of isolation and discharge of stored energy. The offshore installation application in the UK is governed by the Electricity at Work Regulations 1989 (reviewed in Chapter 40) and the Offshore Electricity and Noise Regulations 1997 (SI 1997/1993), which extends EAWR to offshore installations. NFPA 2001:2022 is referenced in footnote [^5] below for the clean agent suppression system design values.

[^2]: IEEE Std 1584-2018. *IEEE Guide for Performing Arc-Flash Hazard Calculations.* IEEE Power and Energy Society, New York. DOI: 10.1109/IEEESTD.2018.8563139. The 2018 revision extended the validated test database from 290 to over 2,000 test cases. Validated range: 0.208 kV to 15 kV, 700 A to 106 kA, 19–254 mm conductor gap. For 66 kV systems, the Guide explicitly recommends IEC 62271-200 IAC test data or finite element method thermal modelling. NFPA 70E:2024 Article 130 references IEEE 1584 as the calculation method for medium-voltage systems and provides the PPE category arc ratings in Table 130.7(C)(15)(c): Category 1 (4 cal/cm²), Category 2 (8 cal/cm²), Category 3 (25 cal/cm²), Category 4 (40 cal/cm²). IEC 61482-1-1:2019 provides an alternative arc flash test methodology based on directed arc (box test), used primarily in European contexts; the arc ratings (ATPV and Ebt) are directly comparable to NFPA 70E categories.

[^3]: SF6 decomposition product toxicology: Radley, I. and Rose, N. (2003). "The production of sulphur fluoride gases during arcing of sulphur hexafluoride gas." *IEE Proceedings: Generation, Transmission and Distribution*, 150(2), pp. 164–170. DOI: 10.1049/ip-gtd:20030069. Primary decomposition products of SF6 under arc conditions in the presence of moisture: SOF₂ (thionyl fluoride), SO₂F₂ (sulphuryl fluoride), SO₂, and HF (hydrogen fluoride). HF ceiling TLV (C = 0.5 ppm) from: ACGIH (2024), *TLVs and BEIs: Threshold Limit Values for Chemical Substances and Physical Agents and Biological Exposure Indices*. American Conference of Governmental Industrial Hygienists, Cincinnati, OH. The European F-Gas Regulation 2024/573 (replacing 517/2014) entered into force 11 March 2024; relevant provisions for HV switchgear include leak detection obligations (Article 5), containment requirements (Article 4), and prohibitions on intentional atmospheric release (Article 11). SF6 GWP 24,300 (AR6 100-year value) is from: IPCC (2021), *Climate Change 2021: The Physical Science Basis*, Table AII.1.2, Cambridge University Press. DOI: 10.1017/9781009157896.

[^4]: Golden, F.StC. and Tipton, M.J. (2002). *Essentials of Sea Survival.* Human Kinetics, Champaign, IL. ISBN 0-7360-3765-8. Chapter 4 covers the four physiological phases of cold water immersion with empirical data at 5–25°C. The 1-10-1 rule summary is derived from this data and codified in: US Coast Guard Marine Safety Center (2013). *A Guide to Cold Water Survival.* MSC.1/Circ.1185a. Available at: dco.uscg.mil/Portals/9/CG-5R/nsarc. The USCG formula for usable swimming time at temperature $T_w$ is an approximation from the empirical data in Chapter 4 of Golden & Tipton; the linear regression $T_{\text{swim}} \approx 0.56 T_w + 3.9$ minutes is consistent with the published survival curves for uninsulated subjects in still water. The Williamson Turn is documented in: Williamson, J.A. (1950). "The Williamson Turn," *United States Naval Institute Proceedings*, Vol. 76, No. 4, pp. 445–446. The turn was developed by Williamson (USNR) in 1943 during wartime convoy escort operations. SOLAS consolidated text (2020 edition) Chapter V Regulation 33 covers MOB obligations for ships. Offshore installations in Poland's EEZ follow comparable requirements under the Polish Maritime Safety Act and applicable IMO instruments.

[^5]: NFPA 2001:2022. *Standard on Clean Agent Fire Extinguishing Systems.* National Fire Protection Association, Quincy, MA. Section 4.3 (minimum design concentrations): FM-200/HFC-227ea: 6.25% for Class A surface fires, 7.0% for transformer oil (Class B) fires. NOAEL (no observable adverse effect level) for HFC-227ea: 9% v/v; LOAEL: 10.5% v/v. Section 7.5: pre-discharge alarm minimum 30 seconds before agent release. FM-200 GWP 3,350 (AR5) / 3,600 (AR6): IPCC (2021) as cited in footnote [^3]. Novec 1230 (FK-5-1-12) GWP < 1.0: 3M/Chemours technical data sheet. High-pressure water mist for offshore transformer fire suppression: NFPA 750:2023 (*Standard on Water Mist Fire Protection Systems*), Section 4.5 (transformer and oil-filled equipment applications). IEC 61892-3:2023 (*Mobile and fixed offshore units — Electrical installations — Part 3: Equipment*), Section 11 covers fire protection systems in offshore electrical installations, including transformer bays and clean agent suppression rooms, with reference to SOLAS Chapter II-2 principles where applicable to fixed offshore platforms.

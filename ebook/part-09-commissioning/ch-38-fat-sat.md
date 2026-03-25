# Chapter 38: Before the Power Flows: FAT and SAT

*The binder was on the desk when Kaan arrived. He had put it there himself, precisely, at 07:58 on a Monday morning that felt different from any previous Monday morning in the OSS. Not because anything had changed physically — the transformer oil smell was the same, the fluorescent corridor the same cool grey — but because the binder itself had changed. When Anders had handed it to him four months ago, it had been a document. Now, after a weekend of reading and a pencil and three Post-it notes, it was a map.*

*He had marked three places.*

*First Post-it: page 47, the main transformer short-circuit impedance test result. The measured value was 13.2%. The nameplate said 12.5%. The test report said PASS, in bold, and a third-party witness had countersigned. Kaan knew it was within the IEC tolerance. He had looked this up on Saturday. But he wanted someone to explain the consequence.*

*Second Post-it: page 113, the GIS contact resistance measurements. Bay 3 busbar contact had measured 18.2 µΩ. The acceptance criterion was ≤ 20 µΩ. Passed — but the same bus in Bay 1 had measured 9.8 µΩ. Bay 3 was nearly twice the resistance of Bay 1. Kaan wanted to know if that was manufacturing variation or a signal of something more serious.*

*Third Post-it: page 178, the relay timing tests. All twelve relays had passed the IEC 60255 timing accuracy requirement. But Relay R3 — the 66 kV export backup relay — had been tested only at 2× and 5× setting current. Kaan had expected tests at 10× and 20× settings, for the high-current coordination range that Sigrid had worked through in Chapter 26.*

*He was still looking at the binder when someone entered the room.*

*She was in her late forties, slightly built, with short practical hair and the kind of bearing that comes from twenty years of being the person who signs off before power flows. She was carrying a red marking pen between two fingers, and her clipboard already had pages folded back. She looked at the binder, then at Kaan, then at the three Post-it notes.*

*"You've actually read it," she said, in Swedish-accented English. Not quite surprise. Something closer to satisfaction.*

*"Three questions," Kaan said.*

*Åsa Lindqvist set her clipboard on the table, uncapped her pen, and sat down. "Good," she said. "That is the right number. Any fewer, you haven't read it. Any more, you've confused yourself."*

---

## 38.1 What a Factory Test Is — and Is Not

A Factory Acceptance Test is a contractual document before it is a technical one.

The generator, transformer, GIS, protection relays, and subsea cable that make up an offshore substation each cost millions of euros. They are manufactured in countries hundreds or thousands of kilometres from where they will be installed. They will be commissioned in a marine environment where repair access is expensive, weather-dependent, and slow. When one of them fails, the consequences are not minor inconveniences — they are production losses measured in hundreds of thousands of euros per day, plus the cost of moving a specialist vessel to the site.

The FAT exists, above all, to shift the cost of a defect from the offshore site to the factory floor. A defect found at the factory costs a few days of production delay and a repair bill. The same defect found offshore, after installation, costs a vessel charter, an outage, a repair in conditions no factory engineer would design for, and — if the defect propagates to a failure — potentially the replacement of the component entirely.

This is why the FAT report that Kaan had read contained not just test results but signatures: the commissioning engineer for the project, a third-party inspector (Lloyd's Register, Bureau Veritas, or DNV GL, depending on the component), and in several cases a representative from the client. The third-party witness signature is the contractual anchor. It converts the test record from a manufacturer's internal document into a verifiable claim about a specific machine.

What the FAT cannot test is everything that happens after the component leaves the factory floor.

In 2004, two years after the Horns Rev 1 offshore wind farm in Denmark came online, Vattenfall began to experience unexpected failures in the wind turbines' nacelle-mounted transformers and electrical assemblies. The failures were consistent: corrosion of insulation combined with vibration-induced mechanical fatigue, in an environment of continuous salt-laden humidity that the nacelle had not been designed to exclude for the duration expected. Over the following several years, nacelles were towed to shore for refurbishment — a logistics programme that required jack-up vessels, harbour facilities, and costs that dwarfed the original electrical specification.[^1]

The turbines had passed their factory acceptance tests. The tests had verified electrical performance, insulation quality, mechanical function. They had not replicated the offshore environment over the timescale that mattered — because Horns Rev 1 was among the first offshore wind farms to operate at scale, and no one had yet established precisely what that environment would do over years of continuous operation.

"The test tells you it worked on the day, in the conditions the manufacturer controlled," Åsa said. She was not reading from notes. She had clearly said this before, to many people. "It does not tell you it will work on the day you need it, in the conditions nature supplies. The gap between those two statements is what the rest of commissioning is about."

The standards that govern factory testing have evolved substantially since Horns Rev 1. IEC 60076 (power transformers), IEC 62271-203 (gas-insulated switchgear), IEC 60840 (high-voltage cables), and IEC 60255 (protection relays) each specify mandatory routine tests — performed on every manufactured unit — and optional type tests, performed once per design to qualify the design rather than every individual unit. The commissioning engineer's first task is to verify that the specific tests recorded in the FAT report match the mandatory tests required by the applicable standard for that component's voltage class, power rating, and application.

Page 47 of Kaan's binder contained the mandatory routine tests for the 220/66 kV, 170 MVA main transformer. He had counted seven test categories. Åsa counted them the same way.

---

## 38.2 The Transformer Under Test

The main transformer is the most expensive single component in an offshore substation. A 170 MVA, 220/66 kV, ONAN/ONAF-cooled unit of the type used here costs approximately €3–4 million at the factory gate. The temperature rise test alone — which operates the transformer at rated load until thermal equilibrium and then measures the hot-spot temperature by resistance measurement and fibre-optic sensor — takes 24 to 48 hours of continuous operation and occupies a high-power test bay for that entire period.

IEC 60076-1:2011 divides transformer tests into three categories. Routine tests are mandatory for every transformer: ratio measurement, impedance and load losses, no-load losses and current, dielectric routine tests, and on-load tap changer testing. Type tests are performed once per design: temperature rise, short-circuit withstand, lightning impulse withstand. Special tests are performed only when contractually specified: noise measurement, harmonic analysis, seismic qualification, and the partial discharge measurement that had become standard practice for offshore applications after Horns Rev 1.

The short-circuit impedance — the number on page 47 of Kaan's binder — is measured by applying reduced voltage to the high-voltage winding with the low-voltage winding short-circuited, and increasing the applied voltage until rated current flows in the HV winding. The applied voltage at that point, expressed as a fraction of rated voltage, is the short-circuit impedance:

$$
z_k = \frac{U_k}{U_n} \times 100\%
$$

where:
- $z_k$ = short-circuit impedance [%]
- $U_k$ = voltage applied to HV winding to circulate rated current with LV winding short-circuited [V]
- $U_n$ = rated voltage of the HV winding [V]

For the main transformer, the nameplate declared $z_k = 12.5\%$. The measured value was 13.2%. The IEC 60076-1 tolerance band for a transformer above 2,500 kVA with a declared impedance above 10% is ±10% of the declared value. Ten percent of 12.5% is 1.25 percentage points. The maximum acceptable measured impedance is therefore 12.5% + 1.25% = 13.75%. The measured value of 13.2% is within tolerance by 0.55 percentage points.[^2]

"It passes," Åsa said. "But you were right to mark it, because passing the FAT tolerance and being irrelevant to the rest of the project are two different things. The protection coordination study was calculated using 12.5%. Not 13.2%."

That was exactly the question Kaan had wanted to ask.

The dielectric testing that followed the impedance measurement occupied pages 48 through 61 of the FAT report. Power-frequency withstand at 460 kVrms applied to the 220 kV winding for 60 seconds — no flashover, no partial discharge above 300 pC. Lightning impulse at 1,050 kV peak, five positive and five negative impulses — no failure, no oscillatory waveshape changes that would indicate partial discharge within the winding.

The partial discharge measurement, recorded at 1.5× rated voltage on both windings simultaneously, found a maximum apparent charge of 87 pC against a limit of 300 pC. That result was clean. A partial discharge is the visible sign of a void or contaminant within the insulation — a location where the electric field is concentrated enough to ionise the gas in the void rather than stress the insulation bulk. Left uncorrected, a partial discharge becomes a tracking tree: a dendritic channel of carbonised insulation that propagates toward the opposite conductor until the insulation fails. The 87 pC result was not merely within specification. It was well within it.

<!-- IMAGE: fig-38-1 -->
> **Figure 38.1** — Transformer Short-Circuit Impedance: Measurement Setup and IEC Tolerance Zone
> **Type:** Two-panel schematic + horizontal bar chart
> **Content:** Left: simplified test circuit diagram showing HV winding energised by variable voltage source, LV winding short-circuited, ammeter in HV circuit, voltmeter measuring applied voltage. Right: horizontal bar chart showing IEC 60076-1 tolerance band (11.25%–13.75%), nameplate value (12.5%), measured value (13.2%), and the 0.55% remaining margin to the upper limit.
> **Caption:** The measured short-circuit impedance (13.2%) exceeds the nameplate value (12.5%) by 5.6% — within the IEC 60076-1 ±10% tolerance band. The 0.55 percentage-point margin to the acceptance boundary is sufficient to pass, but the protection coordination study must be updated to use the measured value.
> **Alt text:** Bar chart showing measured vs. nameplate transformer impedance within the IEC 60076-1 tolerance zone, with margin to acceptance boundary annotated.
> **Data source:** Author illustration based on IEC 60076-1:2011
> **Resolution:** 1100 × 600 px minimum
> **Color notes:** Tolerance zone in light green, measured value bar in amber, nameplate in deep blue, margin annotation in red

> **Standard reference:** IEC 60076-1:2011, "Power transformers — Part 1: General," Clause A.3 (Short-circuit impedance tolerances: ±10% of declared value for transformers above 2,500 kVA with declared impedance above 10%). IEC 60076-3:2013, "Power transformers — Part 3: Insulation levels, dielectric tests and external clearances in air," Clause 12 (Partial discharge measurement during induced voltage test).

---

## 38.3 GIS and Protection Relays: Factory Precision, Site Reality

The GIS cells that Stefan had shown Kaan in Chapter 17 — grey steel cylinders, chest height, SF6 at 0.6 MPa — had been factory-tested to IEC 62271-203 before delivery. The standard for AC gas-insulated metal-enclosed switchgear above 52 kV mandates two routine test categories that matter most for offshore substations.

The first is partial discharge testing: with the GIS cell energised at 1.1 times the maximum system voltage (1.1 × 245 kV = 269.5 kV phase-to-phase for the 220 kV system), the apparent charge must remain below 5 pC. Five picocoulombs — a measure so small that the instrumentation required to detect it reliably was not widely available until the 1980s, when GIS technology was already two decades old. Achieving this requires absolute cleanliness of the SF6 gas, absolute smoothness of the metallic contact surfaces, and the absence of any metallic particle — a filing from manufacturing, a thread of swarf from drilling — that might accelerate under the electric field and initiate a discharge. The factory test establishes the baseline; regular on-site dissolved gas analysis tracks whether the baseline holds over the service life.

The second is contact resistance measurement. Page 113 of Kaan's binder showed the measurements he had already noticed.

$$
R_{\text{contact}} = \frac{U_{mV}}{I_{\text{inject}}}
$$

where:
- $R_{\text{contact}}$ = resistance of a busbar joint or circuit breaker main contact [µΩ]
- $U_{mV}$ = voltage drop measured across the contact at known injection current [µV]
- $I_{\text{inject}}$ = DC injection current [A] — typically 100 A for GIS busbar joints

The four-wire (Kelvin) method is essential: the voltage measurement circuit is separate from the current injection circuit, so the resistance of the test leads themselves does not appear in the result. At 100 A injection, a 9.8 µΩ contact in Bay 1 develops a voltage drop of 0.98 millivolts — less than one millivolt across a busbar joint that is carrying, at rated current, thousands of amperes of AC.

"The variation between Bay 1 and Bay 3 is normal," Åsa said. "Two assemblers, two shifts, slightly different torque applied to the bolted joint. What matters is that both are below 20 µΩ. If Bay 3 were at 19.9 µΩ and Bay 1 at 9.8 µΩ, I would ask the manufacturer to re-torque Bay 3 before shipping — not because it is out of tolerance, but because the variation is a signal. At 18.2 µΩ, the signal is weak." She wrote "Monitor at first SAT insulation resistance check" on her clipboard in red pen.

The protection relays had their own factory test programme under IEC 60255-1. For each relay, the manufacturer applied calibrated current and voltage signals via a test injection set — equivalent to Sigrid's Omicron CMC equipment from Chapter 26 — and verified operating time accuracy. The requirement: the actual operating time must be within ±5% (or ±25 ms, whichever is greater) of the calculated time for all current settings from 1.05× up to 20× the relay pick-up current.

Kaan's third Post-it — the backup relay tested only to 5× setting — had a straightforward resolution. "The manufacturer tested to 5× for the standard FAT programme," Åsa said. "The commissioning team tests to 20× during the SAT. The factory verifies the relay mechanism. The site verifies the coordination. They are different questions."

> **Standard reference:** IEC 62271-203:2022, "AC gas-insulated metal-enclosed switchgear for rated voltages above 52 kV," Clause 6.3 (Factory routine tests) and Table 2 (Partial discharge test limit: 5 pC at 1.1 U_m; contact resistance ≤ 20 µΩ for busbar joints). IEC 60255-1:2022, "Measuring relays and protection equipment — General requirements," Clause 7.4 (Timing accuracy requirement: ±5% of calculated operating time or ±25 ms, whichever is greater, for all current settings from 1.05× to 20× setting current).

---

## 38.4 Testing the 45 km Cable: Factory and Field

The 220 kV export cable — 45 kilometres of XLPE-insulated, lead-sheathed, double-armoured submarine cable — had been manufactured and drum-tested at the cable factory before loading onto the cable-lay vessel. The factory test programme, specified in IEC 62067 for AC cables rated above 150 kV, tested the cable's fundamental electrical properties before it left the controlled environment of the factory floor.

The routine factory test at IEC 62067 Clause 11 includes partial discharge measurement at 1.5 times the rated voltage-to-ground ($U_0$ = 127 kVrms for a 220 kV system): at 190.5 kVrms, the apparent charge must remain below a level specified by the standard and the manufacturer's quality plan — for modern XLPE cable at this voltage class, typically 1 pC. The test current at factory level is dominated by the cable's capacitive charging current, which for a 45 km, 220 kV cable can reach hundreds of amperes at 50 Hz. To keep this current manageable, the manufacturer tests individual drum lengths of 1,000–3,000 m rather than the full assembled length.

But once the cable has been installed — laid on the seabed, pulled through the J-tube, terminated in both the OSS and the onshore substation — it cannot be returned to the factory. The terminations, which are fabricated on site by specialist cable jointers, cannot be factory-tested at all. The field test must be performed in place, in the marine environment, with the cable fully assembled and both ends accessible.

The standard field test for offshore high-voltage cables is Very Low Frequency (VLF) testing at 0.1 Hz, using a high-voltage sinusoidal waveform at one five-hundredth of power frequency. The rationale is practical arithmetic:

$$
I_c = V_0 \cdot \omega \cdot C \cdot L
$$

where:
- $I_c$ = capacitive charging current [A]
- $V_0$ = applied peak voltage [V]
- $\omega = 2\pi f$ = angular frequency [rad/s]
- $C$ = cable capacitance per unit length [F/m] — approximately $0.20\,\mu\text{F/km}$ for this cable
- $L$ = cable length [m]

For the 45 km export cable at 220 kV:
- At 50 Hz: $I_c = 127{,}000 \times 2\pi \times 50 \times 0.20 \times 10^{-6} \times 45{,}000 \approx 3{,}590\,\text{A}$ — impractical without a dedicated 50 Hz supply of hundreds of MVA
- At 0.1 Hz: $I_c = 127{,}000 \times 2\pi \times 0.1 \times 0.20 \times 10^{-6} \times 45{,}000 \approx 7.2\,\text{A}$ — achievable with a resonant VLF generator in a shipping container

The 500:1 reduction in charging current at VLF makes it possible to test the full installed cable and its terminations from a generator that a service vessel can carry. The VLF withstand test voltage is typically 1.7 × $U_0$ for 60 minutes — below the factory test level, but sufficient to detect gross dielectric weaknesses introduced during installation, particularly at the terminations where the cable insulation screen is cut back, the cable geometry changes, and mechanical stresses during the J-tube pull may have caused micro-damage.

The TDR — time-domain reflectometer — provides a complementary check: not of insulation quality but of physical continuity and cable length. A calibrated pulse is injected at one end of the cable and the reflected pulse from the far termination is measured. The propagation velocity in XLPE cable is approximately 60% of the speed of light in vacuum:

$$
L = \frac{v_p \cdot t_{\text{echo}}}{2}
$$

where:
- $L$ = cable length [m]
- $v_p \approx 1.80 \times 10^8$ m/s = propagation velocity in XLPE (approximately 0.60 × $c$) [m/s]
- $t_{\text{echo}}$ = round-trip echo time from injected pulse to returned reflection [s]

For the 45 km export cable, the expected round-trip echo time is:
$$
t_{\text{echo}} = \frac{2 \times 45{,}000}{1.80 \times 10^8} = 500\,\mu\text{s}
$$

A returned pulse at 500 µs confirms physical continuity and cable length. A second, earlier reflection indicates a discontinuity — a termination defect, a joint anomaly, or a mechanical crimp — with a spatial resolution of approximately 5 metres for the test equipment used. The TDR is the cable's X-ray: it cannot see inside the insulation, but it can locate reflective physical discontinuities with precision.

<!-- IMAGE: fig-38-2 -->
> **Figure 38.2** — VLF Field Test Setup for 45 km Submarine Cable: Charging Current Comparison
> **Type:** Two-panel schematic
> **Content:** Left panel: standard 50 Hz test concept showing an impossibly large generator (3,590 A label, struck through as "not practical") connected to 45 km cable. Right panel: VLF test setup with compact resonant generator (7.2 A label, "containerised"), LC resonant inductor, and the full 45 km cable under test. Both panels show the test voltage (1.7 U₀) and the cable length. The formula I_c = V₀ωCL displayed between panels with the two numerical results highlighted.
> **Caption:** At 50 Hz, the capacitive charging current of the 45 km, 220 kV export cable is 3,590 A — impractical for field testing. At 0.1 Hz, the same cable draws only 7.2 A — achievable from a generator that fits in a shipping container. VLF testing makes full-length dielectric field testing of submarine cables feasible.
> **Alt text:** Comparative schematic of 50 Hz and VLF field test configurations for 45 km submarine cable, with charging current calculations annotated on each.
> **Data source:** Author illustration
> **Resolution:** 1200 × 600 px minimum
> **Color notes:** 50 Hz configuration in red/struck-through; VLF configuration in green; cable drawn as horizontal line in deep navy

> **Standard reference:** IEC 62067:2011, "Power cables with extruded insulation and their accessories for rated voltages above 150 kV (U_m = 170 kV) up to 500 kV (U_m = 550 kV) — Test methods and requirements," Clause 11 (Routine tests) and Clause 12 (After-laying tests and field test recommendations for installed cables). IEC 60885-3:2015, "Electrical test methods for electric cables — Part 3: Test methods for partial discharge measurements on lengths of extruded power cables," Clause 4 (Measurement during VLF AC voltage application). DNV-RP-0419 (2016), "Acceptance Criteria for VLF Testing of HV Underground and Submarine Cables," Section 5 (500:1 current ratio at 0.1 Hz vs. 50 Hz for long cables).

---

## 38.5 Site Acceptance Testing: The First Time the System Speaks

The Factory Acceptance Test proves that every component worked when individually tested by the people who built it, in controlled conditions, before it faced sea transport, crane lifts, J-tube pulls, termination heat-shrink operations, and months of salt-laden air.

The Site Acceptance Test is something different. It is the first time the assembled system — transformers, GIS, cables, protection relays, SCADA, GOOSE network, PPC — is tested as a single integrated entity, in the actual environment where it will operate, by the people responsible for making it work.

Three things the FAT could not test are verified for the first time during SAT.

**Cable terminations.** All cable terminations are fabricated on site by specialist cable jointers. The quality of a termination depends on the individual jointer's technique, the cleanliness of the working environment, and whether the cable insulation was damaged during transport or installation. SAT partial discharge measurement on each termination — using the VLF generator after the full cable system is assembled — is the only way to verify that the jointing was correct.

**IEC 61850 GOOSE end-to-end latency.** The GOOSE network described by Hanna in Chapter 29 was factory-tested on individual IEDs in the manufacturer's laboratory. At the site, 49 IEDs communicate through two managed Ethernet switches across a PRP dual-redundant network. The actual latency — measured from the moment a protective relay issues a trip command to the moment the circuit breaker receives the trip signal — must be verified against the Performance Class P3 requirement of IEC 61850-10 in the installed network topology:

$$
T_{\text{GOOSE}} = T_{\text{IED,tx}} + T_{\text{switch}} + T_{\text{IED,rx}} + T_{\text{hardware}}
$$

where:
- $T_{\text{IED,tx}}$ = IED internal processing time from trip trigger to GOOSE frame transmission [ms]
- $T_{\text{switch}}$ = managed switch store-and-forward forwarding delay [ms]
- $T_{\text{IED,rx}}$ = receiving IED processing time from frame arrival to contact output [ms]
- $T_{\text{hardware}}$ = output relay mechanical delay (protection relay trip coil) [ms]

> **Standard reference:** IEC 61850-10:2012, "Communication networks and systems for power utility automation — Part 10: Conformance testing," Clause 5.4 (GOOSE performance class requirements). Class P3: total GOOSE delivery time ≤ 3 ms, measured from GOOSE publisher trigger event to subscriber binary output change. Test method: GPS-synchronised Ethernet analyser at both ends of the communication path, providing µs-precision timestamps at the Ethernet frame level.

The measured GOOSE latency results for the four protection bays in the OSS, taken with a GPS-synchronised packet analyser during the first week of SAT, were:

| Bay | Primary Relay | GOOSE Tx→Rx | HW Output | Total | Class P3 ≤3 ms |
|-----|--------------|-------------|-----------|-------|----------------|
| Bay 1 (T1 66 kV incomer) | SEL-351S | 1.8 ms | 0.3 ms | 2.1 ms | **PASS** |
| Bay 2 (T2 66 kV incomer) | SEL-351S | 2.2 ms | 0.3 ms | 2.5 ms | **PASS** |
| Bay 3 (220 kV export) | GE D60 | 2.7 ms | 0.3 ms | 3.0 ms | **PASS** |
| Bay 4 (busbar coupler) | SEL-421 | 1.6 ms | 0.3 ms | 1.9 ms | **PASS** |

Bay 3 was exactly on the limit. "Zero margin is still a pass," Åsa said. "But Bay 3 traverses the second switch in the communication path because the GE D60 relay sits on the opposite side of the station bus from the busbar coupler. The latency was always going to be the highest. It is documented. If the system is ever extended — more IEDs added to the process bus — Bay 3 is the first place to check."

**Protection coordination end-to-end.** The most demanding SAT verification is the end-to-end protection sequence test: inject a fault current into Relay R1 at a specific multiple of its setting, verify that R1 trips within the correct time window and ahead of R2; inject the same fault with R1 blocked, verify that R2 operates within the correct backup time. This is the test that verifies Sigrid's coordination study from Chapter 26, in the actual installed system, against the actual relay settings, using the actual transformer impedance — 13.2%, not the 12.5% that the study assumed.

The SAT protection programme was a 47-page document. It had been drafted by Sigrid and was now in Åsa's custody.

---

## 38.6 Worked Example: Does 13.2% Matter?

Page 47 of the FAT binder. Kaan had been right to mark it.

The protection coordination study from Chapter 26 had calculated relay settings using the nameplate short-circuit impedance of $z_k = 12.5\%$ for the 170 MVA, 220/66 kV main transformer. With the measured value of 13.2%, the actual transformer impedance is 5.6% higher than assumed. What does this change for the protection coordination?

**Step 1: Tolerance verification.**

$$
\Delta z_k = \frac{z_{k,\text{meas}} - z_{k,\text{name}}}{z_{k,\text{name}}} \times 100\% = \frac{13.2 - 12.5}{12.5} \times 100\% = 5.6\%
$$

IEC 60076-1 tolerance is ±10% of the declared value. Measured deviation is 5.6% — within tolerance. Maximum permitted: 13.75%. **Tolerance check: PASS.**

**Step 2: Maximum fault current at the 66 kV busbar (transformer contribution).**

The transformer leakage impedance referred to the 66 kV side:

$$
Z_T = \frac{z_k}{100} \cdot \frac{U_{n,LV}^2}{S_n}
$$

where:
- $z_k$ = short-circuit impedance [%]
- $U_{n,LV} = 66{,}000$ V = LV rated voltage [V]
- $S_n = 170 \times 10^6$ VA = transformer rated power [VA]

- Nominal (12.5%): $Z_T^{\text{nom}} = 0.125 \times \frac{66{,}000^2}{170 \times 10^6} = 0.125 \times 25.62 = 3.20\,\Omega$
- Measured (13.2%): $Z_T^{\text{meas}} = 0.132 \times 25.62 = 3.38\,\Omega$

The maximum three-phase fault current at the 66 kV busbar (IEC 60909, voltage factor c = 1.10, source impedance $Z_{source} = 1.85\,\Omega$ referred to 66 kV from the load flow of Chapter 18):

- Nominal: $I''_{k,\text{max}} = \frac{1.10 \times 66{,}000}{\sqrt{3} \times (1.85 + 3.20)} = \frac{72{,}600}{8.75} = 8{,}297\,\text{A}$
- Measured: $I''_{k,\text{max}} = \frac{72{,}600}{\sqrt{3} \times (1.85 + 3.38)} = \frac{72{,}600}{9.06} = 8{,}014\,\text{A}$

**The maximum fault current is 3.4% lower than calculated.** This makes protection grading margins slightly more conservative in the correct direction — the relay trips slower relative to fault onset for a given fault current, which increases the time-overcurrent coordination interval.

**Step 3: Minimum fault current — the critical check.**

The binding constraint is the minimum fault: a single-line-to-ground fault at the far end of the longest 66 kV array feeder (approximately 8 km), where the fault current is limited by the total series impedance. The relay setting for R1 (66 kV incomer) was $I_s = 1{,}930\,\text{A}$ (from Chapter 26: 1.3 × rated load current).

With the measured transformer impedance added to the feeder impedance, the minimum SLG fault current decreases from the design calculation's 3,420 A to approximately 3,284 A — a 4.0% reduction.

Checking the IEC relay selectivity criterion: the minimum fault current must exceed the relay pick-up setting by at least 25%:

$$
I_{\text{fault,min}} \geq 1.25 \times I_s
$$

$$
3{,}284\,\text{A} \geq 1.25 \times 1{,}930\,\text{A} = 2{,}413\,\text{A} \quad \checkmark \quad (\text{margin: }36\%)
$$

The criterion is satisfied with a 36% margin. The fault detection capability is unaffected.

**Step 4: Action.**

The transformer short-circuit impedance of 13.2% is within IEC 60076-1 tolerance. The 3–4% reduction in fault currents leaves all protection coordination margins positive and compliant. The FAT result is accepted.

However, the protection settings file — Sigrid's 47-page SAT programme — must be updated to replace the 12.5% nameplate assumption with the 13.2% measured value. The reason is not the commissioning test: it is the next commissioning test in twenty years. If a relay is replaced in year 12 of the farm's operating life, the settings engineer will use the documented protection study. If that study says 12.5% but the transformer is 13.2%, the engineer will calculate the wrong fault currents and may set the relay incorrectly.

"This is what the FAT binder is for," Åsa said. She had been following Kaan's calculation over his shoulder, not because she had not done it herself already, but because she wanted to see whether he would arrive at the correct conclusion through the correct reasoning. "The test result is a measurement. A measurement is data. Data feeds the design. If the data changes, the design must acknowledge it. Even when the change is small."

She wrote "Confirm Sigrid's study updated to Z_k = 13.2% measured" on her clipboard in red ink.

<!-- IMAGE: fig-38-3 -->
> **Figure 38.3** — Fault Current Comparison: Nominal vs. Measured Transformer Impedance at 66 kV Busbar
> **Type:** Side-by-side bar chart with protection margin annotations
> **Content:** Two grouped bar chart columns: nominal Z_k = 12.5% (deep blue) and measured Z_k = 13.2% (amber). Left group: maximum three-phase fault current (8,297 A nominal vs. 8,014 A measured). Right group: minimum SLG fault current at remote feeder end (3,420 A nominal vs. 3,284 A measured). Relay setting I_s = 1,930 A shown as horizontal dashed line. Minimum criterion (1.25 × I_s = 2,413 A) shown as horizontal orange dashed line. 36% margin annotated on the measured minimum fault bar.
> **Caption:** A 5.6% increase in measured vs. nameplate transformer impedance reduces the maximum and minimum fault currents by 3–4%. All protection margins remain positive. The settings file must be updated to the measured value for long-term configuration accuracy.
> **Alt text:** Grouped bar chart comparing fault currents at nominal and measured transformer impedance values, with relay setting and minimum detection criteria lines annotated.
> **Data source:** Author calculation per IEC 60909-0:2016
> **Resolution:** 1100 × 700 px minimum
> **Color notes:** Nominal bars in deep blue, measured bars in amber, relay setting line in red dashed, minimum criterion in orange dashed, margin annotation in green

---

## Key Takeaways

- **FAT proves the component; SAT proves the system:** factory tests verify individual components in controlled conditions before shipment. Site tests verify integrated performance in the offshore environment — including cable terminations, GOOSE communication, and protection coordination — that the factory could not test by definition.
- **IEC tolerance ≠ design tolerance:** a transformer passing the IEC 60076-1 short-circuit impedance tolerance (±10%) may still carry an impedance that deviates from the protection coordination study's assumption. FAT measurements are data inputs to the commissioning design, not merely acceptance certificates to be filed.
- **VLF testing makes long-cable field testing feasible:** at 0.1 Hz, the capacitive charging current of a 45 km, 220 kV cable is 500× lower than at 50 Hz — reducing a 3,590 A problem to a 7.2 A one. The factory routine test verifies drum lengths; the VLF site test verifies the complete installed system including all field-made terminations.
- **GOOSE end-to-end latency must be measured in the installed network:** individual IED conformance to IEC 61850-10 does not capture the combined latency of two IED processing stages, switch forwarding delay, and hardware output time in the actual network topology. Class P3 (≤ 3 ms) must be verified per protection bay in the commissioned system.
- **The as-commissioned document must reflect measured data, not nameplate data:** every FAT measurement that differs from the design assumption — even when within tolerance — must be propagated through the protection study, relay settings file, and any document a future commissioning engineer would use. The binder is not a filing exercise. It is the technical memory of the machine.

## For Further Reading

- **Heathcote, M. J. (2007).** *J & P Transformer Book*, 13th ed. Newnes/Elsevier. ISBN: 978-0-7506-8164-3. The definitive single-volume engineering reference for power transformer theory, testing, and service. Chapters 8–9 cover the full IEC 60076 test suite in engineering detail, including the physical significance of short-circuit impedance deviation and its propagation into protection and load flow calculations. Chapter 15 covers commissioning and in-service testing procedures, including partial discharge measurement and dissolved gas analysis interpretation.

- **Cigré Working Group B3.36 (2014).** "Offshore Substations for Wind Power Plants." *Technical Brochure 595*, CIGRÉ. Available at e-cigre.org. The primary industry reference for offshore substation design, specification, and commissioning. Chapter 8 (Commissioning) provides structured guidance on FAT/SAT scope for each major equipment category — transformers, GIS, cables, protection relays, SCADA — including the rationale for environmental qualification tests specific to the offshore context. Appendix C contains a model FAT/SAT witness schedule used by several European TSOs.

- **DNV GL (2016).** *Recommended Practice DNV-RP-0419: Acceptance Criteria for VLF Testing of HV Underground and Submarine Cables*. DNV GL, Høvik. This recommended practice defines VLF test voltage levels, frequency, test duration, and partial discharge acceptance criteria for field testing of installed HV cables after construction. Section 5 provides the derivation of the 500:1 current ratio at 0.1 Hz versus 50 Hz for long cables, and Section 7 provides acceptance criteria for partial discharge measurements during VLF withstand — distinguishing between background noise, discharges from cable bulk, and discharges from terminations. Adopted by the majority of European offshore wind project owners as the basis for post-installation cable acceptance.

---

*At 16:30, the afternoon session ended. Åsa closed her clipboard. The red pen went back behind her ear. Around the table, the commissioning team — twelve engineers from six organisations, representing the transformer manufacturer, the GIS supplier, the cable contractor, the relay manufacturer, the SCADA integrator, and the project owner — gathered their binders and laptops.*

*Kaan's three Post-it notes had been resolved. The transformer impedance: within tolerance, protection study to be updated. The contact resistance variation: documented and monitored. The relay test range: SAT scope, not FAT scope — two different documents, two different purposes.*

*But the SAT programme document that Åsa had placed on the table during the afternoon was not a binder. It was a loose stack of A4 sheets, each page marked DRAFT in red across the top corner. Forty-seven test procedures, seventeen hold points, six independent inspection witness points. The first procedure was dated for Week 32 of the project — four weeks from now.*

*Anders came in at 16:40, before the engineers had fully dispersed.*

*He was carrying a single sheet of paper. Not a binder, not a document set. One page, printed on both sides, folded in thirds the way a letter is folded for an envelope.*

*He unfolded it and placed it on the table in the space that had just been cleared.*

*Kaan looked. Forty-two numbered lines. Each line was a switching step: equipment identifier, action, expected response, hold point for verification. The first line read: "1. Verify all 34 WTG circuit breakers OPEN — position confirmed by local indication and SCADA." The last line read: "42. Close 220 kV export cable circuit breaker to PSE metering point — monitor active power, voltage, frequency at POC; confirm synchronisation complete."*

*"When you can explain to me," Anders said, looking at Kaan, "why the order of those forty-two steps cannot be changed — not the reasons from a checklist, but the physical reasons, from the physics — then you are ready for the energisation sequence."*

*He left the sheet on the table and walked out.*

*Kaan sat for a moment after the room had emptied. He looked at the forty-two lines. He had spent three days understanding AC fundamentals, a week on load flow and fault analysis, an evening watching the STATCOM respond to the Ferranti effect, a morning in the relay room with Sigrid's calibration notebook, a week on grid codes and protection coordination. And now, somewhere in those forty-two steps, all of it converged into a sequence that had to be exactly right, in an order that had a physical reason.*

*He folded the sheet the way Anders had folded it. He put it in his jacket pocket.*

*Tomorrow, he would begin to understand why.*

---

## Notes

[^1]: Vattenfall (2009). *Horns Rev 1 Offshore Wind Farm: Operational Experience and Turbine Refurbishment.* Vattenfall Vindkraft A/S internal technical report, excerpted in publicly available conference proceedings. The Horns Rev 1 refurbishment programme (approximately 2004–2009) addressed corrosion and electrical failures in nacelle-mounted electrical assemblies on the Bonus/Siemens 2 MW turbines. Root cause analysis identified that the nacelle's internal environment — humidity, temperature cycling, salt ingress through gaskets and cable entries — was more aggressive than the factory acceptance test conditions had replicated. The programme required multiple jack-up vessel deployments to the site. The experience is widely cited in the offshore wind literature as the primary motivation for IEC 61400-24:2010's specific environmental qualification requirements for offshore wind turbine electrical assemblies, including salt-fog, damp-heat, and vibration test combinations that were not part of the original equipment specifications. See also: Barthelmie, R. J., & Jensen, L. E. (2010). "Evaluation of wind farm efficiency and wind turbine wakes at the Nysted offshore wind farm." *Wind Energy*, 13(6), 573–586. DOI: 10.1002/we.408.

[^2]: IEC 60076-1:2011. *Power Transformers — Part 1: General*. Geneva: International Electrotechnical Commission. Clause A.3 (Tolerances on short-circuit impedance): for three-phase transformers above 2,500 kVA with a declared short-circuit impedance above 10%, the tolerance is ±10% of the declared value, subject to the condition that the measured no-load plus load losses at the principal tapping do not exceed the declared losses by more than 10%. The ±10% tolerance was introduced in the 2000 edition of IEC 60076-1 following joint IEC/CIGRÉ working group consultations between transformer manufacturers and utility purchasers; the previous ±7.5% tolerance (IEC 60076:1976 and 1993 editions) is retained for transformers rated below 35 kV. The broader tolerance reflects the practical manufacturing difficulty of achieving tight impedance control in large transformers, where the winding geometry is constrained by thermal and mechanical design requirements.

[^3]: Cigré Working Group B3.36 (2014). "Offshore Substations for Wind Power Plants." *Technical Brochure 595*. CIGRÉ. ISBN: 978-2-85873-279-3. Available at e-cigre.org. This brochure provides the most comprehensive publicly available guidance on offshore substation FAT/SAT scope and commissioning methodology. Section 8.2 defines the three-phase SAT programme structure: (1) pre-energisation tests (insulation resistance, continuity, earth resistance, control circuit function, protection relay secondary injection); (2) first energisation sequence (step-by-step, each step with a hold point and sign-off); (3) post-energisation tests (protection end-to-end, SCADA point-to-point, harmonic measurement, load flow verification). The recommended GOOSE performance class for protection applications — Class P3 ≤ 3 ms — is consistent with IEC 61850-10:2012 Clause 5.4.

[^4]: IEC 60909-0:2016. *Short-circuit currents in three-phase AC systems — Part 0: Calculation of currents*. Geneva: International Electrotechnical Commission. Clause 4.1 (Application of the method): the standard uses a voltage factor c (1.10 for maximum fault current calculation, 0.95 for minimum) applied to the network nominal voltage at the fault location, in place of the actual pre-fault voltage. This simplification avoids the need for a full load flow as input to the short-circuit calculation — and, as demonstrated in the worked example, produces conservative results (slightly overestimates maximum fault current) that are appropriate for equipment rating rather than for relay setting. Relay setting calculations that must determine minimum fault current should use c = 0.95 and the worst-case system configuration (maximum source impedance, minimum generation, maximum load), as specified in Clause 4.3.

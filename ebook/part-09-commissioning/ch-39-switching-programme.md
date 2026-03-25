# Chapter 39: The Switching Programme: 42 Steps to First Power

*He had not slept much.*

*Not from anxiety — though there was some of that, quiet and persistent, in the way of something that matters. He had not slept because at 04:30 he had woken with a thought about Step 17 — the step that closed the 220 kV transformer circuit breaker with the 66 kV side still open — and had not been able to convince himself the thought was wrong. By 05:15 he was at his desk in the accommodation module, the 42-step programme flat under the fluorescent light, Åsa's spare red pen making small annotations in the margin.*

*By 07:00 he had written three rules at the top of the page.*

*Rule 1: Earth confirmed before HV present.*
*Rule 2: HV enters from the grid end, not the farm end.*
*Rule 3: Load connects one step at a time, not all at once.*

*He looked at the forty-two steps against his three rules. Each step resolved to one of them. Except three steps, which resolved to something he had not quite found the words for — something about the consequences of getting the sequence wrong that went beyond blown fuses and tripped relays.*

*Anders found him in the corridor at 07:30, en route to the control room, carrying two coffees.*

*He handed one to Kaan without asking. He read the three rules at the top of the programme sheet.*

*"Good," he said. "Thirty-nine of the forty-two steps follow one of those three rules. The other three — " he pointed to the steps Kaan had marked with question marks " — follow a fourth rule you haven't written yet."*

*"What's the fourth rule?"*

*"Fault-clear before you energise." Anders drank from his coffee. "If there is already an insulation defect on the circuit you are about to energise — a void in the cable insulation, a contaminated busbar surface, a loose terminal that has allowed moisture ingress — and you close that breaker, the first thing the voltage does is find it. The result is an arc. The arc is anywhere between a small spark that trips a breaker and a high-energy failure that requires a vessel charter and a replacement component. You cannot know which until after. The morning's insulation resistance measurements are the one check between you and that event."*

*"Step 4," Kaan said. "I thought that was just a routine check."*

*"They are all routine checks," Anders said. "Until one of them fails."*

*He walked into the control room. Kaan followed, Rule 4 written in the margin before the door closed.*

---

## 39.1 Four Physical Rules: The Architecture of the Sequence

When the first high-voltage substations grew large enough that a single operator could no longer oversee the entire installation from one position, verbal switching instructions became unreliable. A misheard step, a forgotten confirmation, a step executed out of order by an operator on the far side of a switchyard — each of these had the same physical consequence: the wrong equipment in the wrong state at the wrong moment. The written switching programme is the direct response. It converts the switching sequence from a chain of spoken words into a signed document: each step with an action, an expected response, a hold point, and a space for a signature that is the operator's personal attestation that the expected response was actually observed, before the sequence continued.

IEC 61936-1:2021, the international standard for power installations exceeding 1 kV AC, requires in Clause 6.2 that switching operations on high-voltage equipment be carried out in accordance with written instructions prepared in advance, that each operation be confirmed before the next is initiated, and that the sequence not be altered without written authorisation from the responsible engineer. The language is procedural, as it must be. The physics behind it is not.

Of the 42 numbered steps in the OSS programme, 30 involved a physical switching action — closing or opening a circuit breaker, disconnector, or earth switch. The remaining 12 were verification, hold point, and PSE authorisation steps. All 42 mapped to one of four physical rules.

**Rule 1: Earth confirmed before high voltage enters.**

A conductor can be in one of two states: dead and earthed, or energised. The space between those two states — a conductor partially isolated, an earth switch in an ambiguous position, a circuit breaker whose auxiliary contacts have failed to follow the main contacts — is where people die and equipment is destroyed. Before voltage is applied to any part of the network, every earth switch connected to that part must be confirmed OPEN by at least two independent methods: local mechanical indication AND SCADA digital input. Before any work team accesses any part of the network, every source of voltage must be confirmed isolated, and every earth switch protecting the access zone must be confirmed CLOSED and padlocked.

The failure mode Rule 1 prevents is the simultaneous presence of earth and voltage on the same conductor. The energy available in a 220 kV bolted earth fault is measured in tens of megajoules. Arc temperatures reach 20,000 K. No protection relay acts fast enough to prevent catastrophic damage to equipment and lethal risk to anyone within several metres of the event. Rule 1 is not a precaution. It is the boundary condition that makes the rest of the sequence possible.

**Rule 2: High voltage enters from the grid end, not the farm end.**

A cable is a capacitor. When energised with one end open, the voltage at the open end rises above the voltage at the source end — the Ferranti effect, first described in Chapter 20 in the context of the STATCOM's reactive absorption duty. The magnitude of the rise depends on the cable's capacitance, its series inductance, and the source impedance at the energised end. A weak source — a small generator, an island inverter — cannot hold the source voltage steady against the cable's reactive generation; the voltage rises until protection trips or equipment fails.

The PSE grid, connected at the onshore end of the 45 km export cable, has a short-circuit level of approximately 4,500 MVA at the connection point — an impedance so low that the cable's 116 MVAR of charging reactive generation causes less than 0.7% voltage rise at the onshore busbar. Rule 2 states: the export cable is always energised from the onshore (PSE) end first. The OSS 220 kV circuit breaker is the last breaker closed in the export circuit, not the first.

**Rule 3: Load connects one step at a time.**

The overcurrent protection on the 66 kV array system is designed for selectivity: the feeder relay trips before the busbar relay trips before the transformer relay. This selectivity works correctly only when a fault on one feeder produces a current seen by that feeder's relay and not, in a meaningful sense, by the others. If all 34 turbine circuit breakers were closed simultaneously, the first half-cycle of energisation would present the busbar protection with the combined magnetising inrush of 34 turbine step-up transformers — a current waveform indistinguishable from a busbar fault under certain protection settings. The relay might trip the entire busbar, disconnecting all 34 turbines from the 66 kV network.

Rule 3 states: each feeder circuit breaker is closed in sequence, and each turbine circuit breaker within that feeder is closed in sequence. The 90 minutes between Step 21 and Step 38 were, paradoxically, the quietest part of the commissioning day. Thirty-four turbines connected one at a time, each confirmed by the synchrocheck relay before the power converter was loaded.

**Rule 4: Fault-clear before you energise.**

An insulation defect — a void in the XLPE, a contaminated porcelain surface, a moisture-infiltrated cable termination — is invisible to normal inspection and silent until a voltage appears across it. The insulation resistance test, performed with a DC test voltage significantly above the rated AC level, creates an electric field that finds the defect before the operational voltage does. A defect that fails the IR test is found in a controlled condition, with a repair team available. A defect that is found by the operational voltage is found as an arc.

For a 220 kV XLPE submarine cable immediately before first energisation, the minimum acceptable insulation resistance is calculated from the cable's rated voltage and the accepted industry index for new XLPE:

$$
R_{IR,min} = \frac{\rho_{spec}}{L}
$$

where:
- $R_{IR,min}$ = minimum insulation resistance for the complete cable assembly [$\Omega$]
- $\rho_{spec}$ = specified insulation resistance index (10,000 MΩ·km for new 220 kV XLPE) [MΩ·km]
- $L$ = cable length [km]

For the 45 km export cable: $R_{IR,min} = 10{,}000 / 45 = 222\ \text{M}\Omega$. This seems low — but it is the minimum for the parallel resistance of 45 km of continuous insulation. The measured value was 8,700 MΩ, nearly 40 times the minimum. The insulation was intact.

<!-- IMAGE: fig-39-1 -->
> **Figure 39.1** — The Four Physical Rules: Mapping the 42-Step Switching Programme
> **Type:** Two-panel diagram
> **Content:** Left panel: four-colour coded rule blocks (Rule 1 red, Rule 2 blue, Rule 3 green, Rule 4 orange). Right panel: simplified 42-step list with each step colour-coded to the rule that governs it. The 30 physical switching actions are shown in solid colour; the 12 hold/verification/authorisation steps are shown in grey.
> **Caption:** Each of the 42 switching steps is governed by one of four physical rules. The sequence cannot be reordered because the rules, not the programme, determine the safe sequence.
> **Alt text:** Colour-coded diagram showing the four physical switching rules and their mapping to each of the 42 programme steps.
> **Data source:** Author illustration from IEC 61936-1:2021 principles.
> **Resolution:** 1400 × 900 px minimum
> **Color notes:** Rule 1 red, Rule 2 blue, Rule 3 green, Rule 4 orange; hold points grey.

---

## 39.2 The Pre-Energisation Walk — Steps 1 Through 8

Åsa Lindqvist arrived in the GIS hall at 07:45 with her clipboard and her red pen. Six commissioning engineers followed her: the transformer manufacturer's representative, the GIS supplier's site commissioning engineer, the cable contractor, the protection relay manufacturer's commissioning team leader, the SCADA integrator, and the project owner's commissioning manager. Each of them had a copy of the 42-step programme. Each had signed the pre-authorisation form the previous afternoon, confirming that the equipment in their scope was ready for energisation.

The pre-energisation walk is not an inspection. It is a physical verification of facts that will be signed into the commissioning record and remain there for the 30-year life of the installation — and possibly longer, if the substation is life-extended. Every signature on the programme sheet represents an engineer's attestation of what they personally observed, not what the previous shift's report said or what the SCADA screen showed from across the control room.

**Step 1:** Main 220 kV earth switch ES-01 — position confirmed OPEN. Local mechanical indicator: OPEN (green flag visible through inspection window of GIS bay). SCADA: XCBR1.Pos.stVal = 0 (open) on the instrument panel's IEC 61850 status display. Åsa initialled. The transformer manufacturer's representative, as independent witness, initialled. Time: 07:53.

**Step 2:** All GIS bays, earth switch positions confirmed OPEN — the same dual confirmation (local and SCADA) for the eight earth switches in the 220 kV section that could, if mistakenly left CLOSED, create a direct fault on an energised conductor. This step required 11 minutes to complete physically, walking bay to bay. Each confirmation was initialled.

**Step 3:** Insulation resistance test on the 220 kV export cable. The test set — a 5 kVDC instrument, compact and yellow, connected to the 220 kV core at the OSS cable sealing end — measured the total parallel insulation resistance from one end to the other. The far end was confirmed isolated and earthed at the onshore substation by PSE Warsaw via the IEC 60870-5-104 telecontrol link. Measurement: 8,700 MΩ. Acceptance criterion: 222 MΩ. Margin: 39×. The cable's 45 km of continuous XLPE insulation was intact from end to end.

**Step 4:** Insulation resistance on the six 66 kV array feeder cables (66 kV XLPE, 10–15 km each, with WTG terminations at each turbine base). Minimum acceptance criterion: 10,000 MΩ·km / 12 km = 833 MΩ for a representative 12 km feeder. All six feeders measured between 6,200 MΩ and 14,800 MΩ. All passed.

**Step 5:** SF6 gas density on all GIS bays. Each density monitor — a combined pressure/temperature gauge that corrects for temperature and reads in gas density directly, so a cold morning does not appear as low pressure — showed green. All bays confirmed ≥ 95% of nominal gas density. The threshold below which the GIS cannot safely operate is approximately 80%; these bays were well above it.

**Step 6:** Transformer oil level and Buchholz relay. The oil level sight glass showed the N-mark (normal at 22°C oil temperature, within 3 mm of the reference level). The Buchholz relay's test cock confirmed closed. The dissolved gas analysis sample from the previous afternoon showed no hydrocarbons or acetylene above the factory baseline — the transformer insulation was not decomposing under any incipient stress.

**Step 7:** Protection relay confirmation. Åsa moved to the relay panel and verified, on the transformer differential relay's configuration screen, that the second harmonic inrush restraint function was enabled at a 15% threshold — the setting that would prevent the relay from tripping during transformer magnetising inrush while still detecting genuine fault current. She verified the busbar protection (differential, Class P1) was armed. She verified that the updated settings file — the one Sigrid had revised after the transformer's measured $z_k = 13.2\%$ changed the maximum fault current calculation — was loaded and active.

**Step 8:** SCADA communications verification. The control room screen showed 49 IED icons: all green. The IEC 60870-5-104 telecontrol link to PSE Warsaw showed "Connected — Established."

Åsa picked up the commissioning radio.

"PSE Control, this is OSS Commissioning, reference C-2024-017-POL. Pre-energisation checks Steps 1 through 7 complete. All results within acceptance criteria. Requesting authorisation to proceed with Steps 9 through 14, export cable and 220 kV bus energisation."

Piotr Zawadzki's voice — calm, clipped, exactly as it had sounded during the frequency event months earlier. "OSS Commissioning, PSE Control. Authorised. Onshore substation confirmed ready. You may proceed with Steps 9 through 14. Call before Step 15. Confirm."

"Confirmed. Proceeding with Step 9 at 09:17. OSS Commissioning out."

---

## 39.3 The 220 kV Circuit — Energisation from the Grid End (Steps 9–14)

The export cable was, at this moment, an uncharged capacitor: 0.17 µF/km, 45 km, three conductors. When voltage was applied from the PSE onshore end, a capacitive charging current would flow into it, generating reactive power proportional to the square of the voltage and the cable length:

$$
Q_c = V_{LL}^2 \cdot \omega \cdot C_0 \cdot L
$$

where:
- $Q_c$ = reactive power generated by the cable [var]
- $V_{LL}$ = line-to-line voltage [V]
- $\omega$ = angular frequency [rad/s]
- $C_0$ = cable capacitance per unit length [F/km]
- $L$ = cable length [km]

$$
Q_c = (220{,}000)^2 \times 314.16 \times 0.17 \times 10^{-6} \times 45 = 116 \text{ MVAR}
$$

One hundred and sixteen megavars of reactive generation, absorbed by the PSE grid at the onshore end, producing a small Ferranti rise at the OSS open end. With the PSE grid's 4,500 MVA short-circuit capacity absorbing the reactive surplus, the Ferranti rise was less than 1%. If the same cable had been energised from a 510 MW wind farm operating in island mode, with no external stiff voltage reference, the voltage at the onshore end would have risen until overvoltage protection tripped the island or the cable insulation was stressed beyond its rated level.

This is why Rule 2 exists. Not as a procedure. As a consequence of physics.

**Step 9:** OSS 220 kV earth switch ES-01 confirmed OPEN — the same confirmation performed in Step 1, repeated now because Step 9 marks the moment when the verification becomes load-bearing. A SCADA screenshot was captured, timestamped, and saved to the commissioning record. Time: 09:18.

**Step 10:** PSE Warsaw confirmed via IEC 60870-5-104 that the onshore 220 kV circuit breaker had closed. The 220 kV voltage transformer secondary at the OSS cable sealing end showed a voltage, immediately: 221.3 kV line-to-line on all three phases. The cable was energised from the PSE side. The Ferranti rise, measured: 0.6%. The OSS 220 kV metering point — the instrument transformer whose secondary circuits fed the protection relays and SCADA — was live. Kaan watched the voltage figure appear on the SCADA mimic: a number that had been zero for every one of the eight months since the substation had been installed.

**Step 11:** OSS 220 kV earth switch ES-01 confirmed OPEN a second time, now with the cable energised. This is the confirmation that distinguishes a correctly sequenced energisation from a catastrophic error: the earth switch position must be verified immediately before the disconnector is closed, because closing an earth switch on an energised conductor creates a bolted fault. The confirmation is performed in the same 90 seconds that separate Step 11 from Step 12.

**Step 12:** OSS 220 kV disconnector DS-01 CLOSE. Disconnectors are designed to make and break only on de-energised circuits — or to close onto an already-live circuit when the system is at equal voltage on both sides. At this moment, the cable side of DS-01 was live at 221.3 kV; the CB-01 side was dead. Closing DS-01 did not connect two live circuits; it simply extended the live circuit one step toward the circuit breaker. This is safe because CB-01 is still OPEN and can interrupt any resulting arc if something unexpected happens at DS-01's contacts during the make.

**Step 13:** OSS 220 kV main circuit breaker CB-01 CLOSE. A command from the SCADA operator's desk. A confirmation signal from the GIS bay's auxiliary contacts, arriving at the protection relay panel in under 20 milliseconds. The circuit breaker's SF6 interrupter closed. The 220 kV busbar was live. Every instrument transformer secondary circuit in the OSS 220 kV section came to life. The SCADA active power meter showed 0 MW — no generation yet — but the voltage bar on every 220 kV VT channel was full.

**Step 14:** Verify 220 kV bus voltage. SCADA: 221.3 kV on all three phases, balanced within 0.1%. Hold point. Åsa signed: "220 kV bus energised at 09:31. Voltage: 221.3 kV LL. Earth switches confirmed OPEN."

The first two rows of the programme sheet were done.

<!-- IMAGE: fig-39-2 -->
> **Figure 39.2** — 220 kV Export Cable Energisation: Direction, Ferranti Rise, and Step Sequence
> **Type:** System single-line diagram with annotated time sequence
> **Content:** Left: onshore PSE substation with 220 kV CB and cable feeder. Centre: 45 km XLPE submarine cable with distributed capacitance symbols and Ferranti voltage profile (rising from onshore 220 kV to OSS 221.3 kV at open end). Right: OSS GIS bay with DS-01, ES-01, CB-01 in sequence, annotated with step numbers (9→10→11→12→13). Ferranti rise of +0.6% shown as voltage profile curve.
> **Caption:** The 220 kV cable is energised from the onshore (PSE) end first (Step 10), producing a controlled 0.6% Ferranti rise at the OSS open end. Steps 11–13 extend the energised circuit progressively toward the transformer, verifying earth switch position at each stage.
> **Alt text:** Single-line diagram showing the sequence of step 10 through step 13 in the 220 kV export circuit energisation, with Ferranti voltage profile and earth switch positions.
> **Data source:** Author illustration; cable parameters from IEC 60287-1-1:2023.
> **Resolution:** 1400 × 700 px minimum
> **Color notes:** Energised circuit in red; unenergised circuit in grey; step labels in black.

---

## 39.4 Transformer Energisation and Magnetising Inrush (Steps 15–20)

"PSE Control, OSS Commissioning. 220 kV bus energised, voltage confirmed 221.3 kV, all measurements within acceptance. Requesting authorisation for Steps 15 through 20, transformer energisation."

"Authorised. Call before Step 21."

The 170 MVA, 220/66 kV main transformer was about to be energised at site for the first time. The factory acceptance test had confirmed it was electrically correct. Site energisation would confirm it was correct in its actual installation — with its actual cable connections, its actual earthing arrangement, and its actual protection relay settings, including Sigrid's updated $z_k = 13.2\%$ fault current calculation.

What would happen in the milliseconds after Step 17 — the moment CB-HV-TR connected the live 220 kV bus to the transformer's high-voltage winding — was not precisely predictable, but its general character was understood from transformer physics. An iron core retains a residual magnetic flux when de-energised — typically between 20% and 80% of its rated peak flux, depending on the exact moment the circuit was opened. When voltage is next applied, the core must transition from this residual state to the steady-state sinusoidal flux. If the applied voltage reinforces the residual flux rather than opposing it, the resulting total flux can temporarily exceed the rated peak. The core saturates. In saturation, the incremental magnetising inductance drops to a small fraction of its unsaturated value, and the current drawn to maintain the flux — the magnetising inrush — becomes large.

For a large power transformer, the first-cycle peak inrush is commonly expressed as a multiple of rated current:

$$
\hat{I}_{inrush} = k_{inrush} \cdot I_n
$$

where:
- $\hat{I}_{inrush}$ = predicted first-cycle inrush peak [A]
- $k_{inrush}$ = inrush multiple (typically 6–12 for large power transformers) [–]
- $I_n$ = rated HV current [A]

The rated HV current: $I_n = S_n / (\sqrt{3} \cdot V_{HV}) = 170 \times 10^6 / (\sqrt{3} \times 220 \times 10^3) = 446$ A.

With $k_{inrush} = 8$ (from the factory magnetising test data): $\hat{I}_{inrush} = 8 \times 446 = 3{,}568$ A. In a circuit breaker rated for 631 A. The inrush would appear, to an overcurrent relay without inrush restraint, as a fault current eight times above the full-load threshold.

The inrush signature is distinguished from a genuine fault by its harmonic content. A fault current is predominantly sinusoidal at 50 Hz, with a decaying DC offset in the first few cycles. An inrush current is asymmetric — it flows strongly in one polarity during the half-cycle when the core is saturated, and weakly in the other half-cycle when the core is unsaturated. This asymmetry produces a current waveform rich in even harmonics, particularly the second harmonic (100 Hz). The ratio of second harmonic amplitude to fundamental amplitude is characteristically high during inrush:

$$
\frac{I_2}{I_1} \geq k_{2H} = 15\% \quad \Rightarrow \quad \text{inrush restraint active — differential trip blocked}
$$

where:
- $I_2$ = second harmonic current magnitude at 100 Hz [A]
- $I_1$ = fundamental current magnitude at 50 Hz [A]
- $k_{2H}$ = second harmonic restraint threshold [–]

During a genuine internal fault, $I_2/I_1 < 5\%$. The relay acts on the difference. It cannot be fooled by the inrush because the physics of core saturation produces a harmonic signature that a genuine fault, generated by an arc between conductors, cannot replicate.

**Step 15:** 66 kV transformer LV circuit breaker CB-66-TR confirmed OPEN.
**Step 16:** 66 kV earth switch on transformer LV terminal confirmed OPEN.

**Step 17:** Close 220 kV transformer HV circuit breaker CB-HV-TR.

The command signal travelled from the SCADA to the GIS relay driver in 8 milliseconds. The SF6 interrupter closed in 52 milliseconds. On the protection relay's oscillographic capture — displayed on the relay interface laptop that Kaan was watching — the current trace on the 220 kV transformer feeder jumped from zero to a sharp asymmetric spike: the first half-cycle of inrush. The relay's FFT algorithm, running in real time, computed the harmonic content: $I_2/I_1 = 67\%$ — more than four times the restraint threshold. The differential relay restrained. No trip.

The second half-cycle of inrush was smaller: the core, having been driven well into saturation in one polarity, was now returning through unsaturation in the other direction. The ratio fell: 67%, 41%, 22%, 16%, 12%. After 0.42 seconds — just over 21 cycles — the ratio fell below 15%, and the restraint function disengaged. The inrush had decayed. The relay was now fully armed and monitoring for genuine differential current.

From the transformer bay, through the GIS hall door, a sound was audible: a brief low-frequency rumble as the core magnetised to its steady-state operating flux, followed by the 50 Hz hum of a loaded magnetic circuit. The transformer was running correctly.

The transformer's inrush had been brief, powerful, and entirely harmless. As it should be.

**Step 18:** Five-minute hold. Monitor transformer: oil temperature stable (16°C, no rise detectable in 5 minutes), Buchholz relay clear, no protection events. The minimum 5-minute hold point exists not because 5 minutes is the time for inrush to decay — the inrush was gone in under 1 second — but because it is the minimum time for an experienced commissioning engineer to walk the transformer bay, look at the oil level, listen for unusual sound, and check the protection relay event log for any disturbance that the oscillographic capture might have missed.

**Step 19:** Close 66 kV transformer LV circuit breaker CB-66-TR. The 66 kV busbar energised. A second, smaller inrush — from the LV winding's magnetising branch, now connected for the first time — appeared in the relay record, decayed in three cycles.

**Step 20:** The STATCOM — set to automatic reactive absorption mode — registered the 66 kV bus voltage (65.8 kV, as expected for a lightly loaded transformer) and began absorbing reactive power. Within 2 seconds, the STATCOM was at 45 MVAR absorption. The 66 kV busbar voltage rose from 65.8 kV to 66.1 kV as the reactive balance was re-established — the STATCOM absorbing the cable's capacitive generation, the transformer maintaining voltage at its rated ratio.

Åsa: "Step 20 complete. 66 kV bus energised. STATCOM at 45 MVAR absorption. Voltage 66.1 kV. Hold point signed at 10:14."

<!-- IMAGE: fig-39-3 -->
> **Figure 39.3** — Transformer Magnetising Inrush: Current Waveform and Second Harmonic Ratio
> **Type:** Dual time-series chart (stacked)
> **Content:** Top chart: three-phase transformer HV current waveform from relay oscillographic capture, showing asymmetric inrush spike (first cycle ~3,500 A peak) decaying to near-zero over 21 cycles (0.42 s). Bottom chart: computed I₂/I₁ ratio time series, starting at 67%, falling through the 15% restraint threshold (shown as dashed red line) after 0.42 s. Time axis common to both charts.
> **Caption:** The 170 MVA transformer's magnetising inrush peaks at approximately 3,568 A (8× rated) in the first half-cycle. The second harmonic ratio, calculated in real time by the differential relay, remains above the 15% restraint threshold for 0.42 seconds — preventing a false trip while the inrush decays.
> **Alt text:** Two time-series charts showing transformer inrush current waveform and the corresponding second harmonic to fundamental ratio with restraint threshold line.
> **Data source:** Author illustration; inrush parameters from factory magnetising test data.
> **Resolution:** 1400 × 700 px minimum
> **Color notes:** Phase A red, Phase B blue, Phase C green; restraint threshold dashed red; I₂/I₁ trace orange.

---

## 39.5 Feeder Energisation and WTG Connection (Steps 21–38)

The six 66 kV array feeders — each serving five or six wind turbine generators through submarine XLPE cables — connected the busbar to the turbines. Energising each feeder produced a capacitive charging current step at the 66 kV busbar, as the feeder cable's distributed capacitance charged to the busbar voltage.

For a representative feeder of 12 km length:

$$
I_{c,feeder} = \frac{V_{LL} \cdot \omega \cdot C_0 \cdot L}{\sqrt{3}}
$$

where:
- $I_{c,feeder}$ = capacitive charging current per phase [A]
- $V_{LL}$ = line-to-line voltage [V] = 66,000 V
- $\omega$ = 314.16 rad/s
- $C_0$ = feeder cable capacitance per unit length [F/km] = 0.17 µF/km
- $L$ = feeder length [km] = 12 km

$$
I_{c,feeder} = \frac{66{,}000 \times 314.16 \times 0.17 \times 10^{-6} \times 12}{\sqrt{3}} = \frac{42.3}{1.732} = 24.4 \text{ A}
$$

Twenty-four amps, on a feeder protected by a relay set to trip at 250 A overload and 2,000 A fault. The charging step was not a protection event. But it was a physical fact: closing six feeder circuit breakers simultaneously would have produced six simultaneous 24 A steps, a combined 146 A charging current spike on the 66 kV busbar, and — more importantly — six simultaneous inrush events from six sets of turbine step-up transformers, whose combined first-cycle current could look, to the busbar protection, like a busbar fault.

Rule 3. One feeder at a time.

Åsa ran Steps 21 through 38 in groups of three — three steps per feeder. Step one of each group: close the feeder circuit breaker, verify cable voltage present at each WTG connection point (confirmed from the WTG's local IED over IEC 61850 MMS). Step two: signal the WTGs on that feeder to "ready to connect" state. Step three: PPC executes WTG connections one turbine at a time.

Before each WTG circuit breaker closed, a synchrocheck relay verified the voltage state on both sides of the breaker — the energised 66 kV feeder on one side, the wind turbine's power converter output on the other — and confirmed that the difference in magnitude, frequency, and phase angle was within safe limits for a make-on-live connection:

$$
\Delta V < 5\%, \quad \Delta f < 0.1 \text{ Hz}, \quad \Delta\theta < 10°
$$

where:
- $\Delta V$ = voltage magnitude difference across the circuit breaker [% of nominal]
- $\Delta f$ = frequency difference across the circuit breaker [Hz]
- $\Delta\theta$ = phase angle difference across the circuit breaker [°]

Each of the 34 wind turbines had its converter operating in idle mode: synchronised to the 66 kV busbar, rotating at rated speed, producing no active power. The converter held $\Delta V < 1\%$, $\Delta f < 0.02$ Hz, and $\Delta\theta < 3°$ for every connection — comfortably within the synchrocheck window. The relays authorised each closure in under 100 milliseconds.

The 90 minutes from Step 21 to Step 38 were quiet in a way that the previous four hours had not been. No significant currents, no inrush above 25 A, no protection events. Thirty-four turbines connected one at a time, each showing a green icon on the SCADA mimic as its circuit breaker confirmed closed. By 11:47, all 34 icons were green. No active power was flowing — the PPC held all turbines at zero output, as instructed. The entire 510 MW of installed capacity was connected, synchronised to the 66 kV busbar, and waiting.

The wind at hub height was 9.1 m/s. Region 2. The turbines were ready.

"Thirty-eight steps done," Åsa said. "Four remaining."

She picked up the radio.

"PSE Control, OSS Commissioning. All 34 WTGs connected and synchronised, 66 kV bus stable at 66.2 kV, no protection events. Requesting authorisation for Steps 39 through 42, active power ramp and first power delivery."

"OSS Commissioning, PSE Control. Authorised. Grid frequency 50.01 Hz. Eastern zone standing by. First commissioning power delivery window opens now. You may proceed. Confirm."

"Confirmed. Proceeding with Step 39 at 11:51. OSS Commissioning out."

---

## 39.6 Grid Synchronisation and First Power (Steps 39–42)

**Step 39:** The Power Plant Controller received the dispatch instruction from the project control room: ramp to 5% of nameplate over 10 minutes. The PSE IRiESP ramp-up limit — established in Chapter 24 — was 10% of rated power per minute:

$$
\left|\frac{\Delta P}{\Delta t}\right| \leq r_{ramp} \cdot P_n = 10\%/\text{min} \times 510 \text{ MW} = 51 \text{ MW/min}
$$

At 25.5 MW over 10 minutes, the actual ramp rate was 2.55 MW/min — one-twentieth of the limit. The PPC distributed the setpoint pro-rata across 34 turbines: each turbine received 0.75 MW, 5% of its 15 MW individual rated power. The pitch controllers began moving blades into the aerodynamic position. The power curve began to take shape.

**Step 40:** The first non-zero reading appeared on the SCADA active power meter at the 220 kV point of common coupling at 12:01:47. Not a round number. The meter showed 0.4 MW, then 1.2 MW, then 4.3 MW as the turbines' pitch controllers transitioned from idle to generating mode and the generators loaded. The reading was live data — not a test signal, not a simulation. The wind was pushing the blades; the blades were turning the generators; the generators were producing voltage; the voltage was driving current through 45 kilometres of submarine cable and into the PSE grid.

The number climbed: 9.1 MW, 14.8 MW, 18.4 MW. The turbines were not yet at their setpoint — pitch control takes time to settle. But they were generating.

**Step 41:** Åsa verified the power quality at the POC: power factor 0.987 lagging, reactive power balance within ±3 MVAR of neutral, THD voltage 0.9%, flicker Pst 0.004, frequency at the 220 kV metering point 50.01 Hz. All values within the grid connection agreement tolerances confirmed in the compliance matrix from Chapter 22. The STATCOM was still absorbing 42 MVAR — the cable's capacitive generation minus the small inductive reactive consumption of the lightly loaded turbines.

Hold point. Åsa signed.

**Step 42:** Final hold point. Four signatures required.

Åsa signed first — clear, unhurried, red pen. The project owner's commissioning manager signed second. The facsimile from PSE Warsaw arrived in the control room printer at 12:18 — Piotr Zawadzki's countersignature, confirming that the POC metering had registered generation and that the commissioning reference C-2024-017-POL Step 42 was complete on the TSO record.

The witness line was blank.

Anders, who had been standing at the back of the control room since Step 20, walked forward. He picked up the red pen from the table where Åsa had left it. He signed as witness. He handed the pen to Kaan.

"You don't sign this one," he said. "You watch this one."

He paused.

"Next time, you sign."

The SCADA meter showed 24.8 MW. The wind was 9.1 m/s. Thirty-four turbines, each producing 0.73 MW, each connected to the same 66 kV busbar that had been dead metal five hours earlier.

Kaan put the pen down and looked at the number on the screen. The number that everything in the book — the blades, the transformer, the cable, the protection study, the STATCOM sizing, the load flow, the grid code compliance matrix — had been pointing toward.

---

## 39.X Worked Example: Hold Point Analysis

**Transformer inrush peak and decay time:**

Rated HV current: $I_n = 170 \times 10^6 / (\sqrt{3} \times 220 \times 10^3) = 446$ A

Predicted first-cycle peak (from factory magnetising data, $k_{inrush} = 8$): $\hat{I}_{inrush} = 8 \times 446 = 3{,}568$ A

Inrush decay time constant — from leakage inductance and winding resistance. With $z_k = 13.2\%$ and $X/R = 44$ (from factory short-circuit loss data):

$$
L_k = \frac{z_k \cdot V_n^2}{\omega \cdot S_n} = \frac{0.132 \times (220{,}000)^2}{314.16 \times 170 \times 10^6} = 0.120 \text{ H}
$$

$$
R_k = \frac{X_k}{(X/R)} = \frac{0.132 \times (220{,}000)^2 / (170 \times 10^6)}{44} = \frac{37.58}{44} = 0.854 \text{ }\Omega
$$

$$
\tau_{inrush} = \frac{L_k}{R_k} = \frac{0.120}{0.854} = 0.140 \text{ s} = 140 \text{ ms}
$$

Time for inrush to decay to 5% of peak: $t = \tau \ln(20) = 0.140 \times 3.00 = 0.42$ s = 21 cycles

The differential relay's 5-minute hold point (Step 18) provided a margin of 700:1 over the inrush decay time. The hold point exists for the engineer's walk-down, not for the inrush.

**Feeder cable charging current step (worst case: Feeder 5, 14 km):**

$$
I_{c} = \frac{V_{LL} \cdot \omega \cdot C_0 \cdot L}{\sqrt{3}} = \frac{66{,}000 \times 314.16 \times 0.17 \times 10^{-6} \times 14}{\sqrt{3}} = \frac{49.4}{1.732} = 28.5 \text{ A}
$$

Compared to Stage 1 overcurrent relay setting of 250 A: margin = (250 − 29) / 250 = 88.6%. The feeder energisation step produced no protection event on any of the six feeders.

**Synchrocheck margins (worst observed case: WTG 12, Feeder 2 far end):**

| Parameter | Measured | Limit | Margin |
|-----------|----------|-------|--------|
| $\Delta V$ | 0.8% | 5.0% | 4.2 pp |
| $\Delta f$ | 0.02 Hz | 0.10 Hz | 0.08 Hz |
| $\Delta\theta$ | 3.2° | 10.0° | 6.8° |

All margins adequate. WTG 12 circuit breaker closure authorised. No manual override required on any of the 34 connections.

**Active power at Step 40 + 10 minutes:**

SCADA POC meter at 12:12: 25.1 MW (98.4% of 25.5 MW target). Wind stabilised at 9.3 m/s during the ramp, slightly above the value at ramp start. By 12:18 (Step 42 signature time), the meter showed 25.6 MW — 100.4% of target, within the PPC's ±5% dispatch tolerance from Chapter 24.

Total commissioning duration from Step 1 to Step 42 complete: 4 hours 25 minutes.

<!-- IMAGE: fig-39-4 -->
> **Figure 39.4** — First Power: SCADA POC Active Power Ramp, Steps 39–42
> **Type:** Time-series line chart with annotated events
> **Content:** Single trace showing POC active power (MW) from 11:51 (Step 39, ramp command) through 12:18 (Step 42, signed). Y-axis 0–35 MW. Vertical dashed lines mark Step 40 (first non-zero reading, 12:01:47), Step 41 (PQ verification, 12:14), and Step 42 (signature, 12:18). Horizontal dashed line at 25.5 MW (target). Trace shows smooth ramp with minor wind variability.
> **Caption:** The POC active power ramp from Step 39 (dispatch command) to Step 42 (commissioning complete): 4.3 MW at 12:01:47, rising to 25.1 MW by 12:12 and 25.6 MW by 12:18. The target of 25.5 MW (5% of 510 MW nameplate) was met within the PPC's ±5% dispatch tolerance.
> **Alt text:** Time-series chart showing POC active power rising from zero at 11:51 to 25.6 MW at 12:18, with annotated events at key steps.
> **Data source:** Author illustration.
> **Resolution:** 1400 × 700 px minimum
> **Color notes:** Active power trace navy blue; target line dashed grey; event markers black vertical dashed.

---

## Key Takeaways

- **The switching sequence is determined by physics, not procedure.** Four physical rules — earth confirmation, directional energisation, sequential load connection, and fault-clear before energise — govern the entire 42-step programme. Any sequence that satisfies those four rules is physically safe; the specific sequence in the programme is one implementation of those constraints.

- **The export cable must be energised from the grid end.** The PSE grid's 4,500 MVA short-circuit capacity absorbs the cable's 116 MVAR of capacitive generation with less than 0.7% Ferranti rise. Energising from the offshore end — against a 510 MW wind farm — would produce an uncontrolled voltage rise at the onshore end.

- **Transformer magnetising inrush is 8× rated current, not a fault.** The 3,568 A first-cycle peak is distinguished from genuine fault current by its second harmonic content ($I_2/I_1 = 67\%$ at peak inrush, decaying to below 15% within 21 cycles). The differential relay's inrush restraint prevents a false trip; the restraint disengages within 0.42 seconds. The 5-minute hold point is for the commissioning walk-down, not for the inrush.

- **Synchrocheck margins at WTG connection are not tight.** With a power converter maintaining $\Delta V < 1\%$, $\Delta f < 0.02$ Hz, and $\Delta\theta < 3°$, the synchrocheck relay (limit: 5%, 0.1 Hz, 10°) never approached its threshold on any of the 34 connections. The converter's ability to match the bus voltage is several times more precise than the relay requires.

- **The commissioning programme is a document, not a checklist.** Each hold point signature is a legal attestation that the expected response was observed before the sequence continued. The programme remains in the technical record for the life of the installation — a future commissioning engineer de-energising and re-energising the system after a major repair will read these signatures as evidence of what the original state of the equipment was on the day it first worked.

---

## For Further Reading

- **IEC 61936-1:2021.** *Power installations exceeding 1 kV AC and 1.5 kV DC — Part 1: Common rules.* International Electrotechnical Commission. Clause 6.2 specifies the requirements for written switching programmes, including the dual-confirmation requirement for earth switch positions (Clause 6.2.4), the prohibition on verbal-only switching instructions for circuits above 1 kV (Clause 6.2.2), and the hold-point and signature requirements for commissioning sequences (Clause 6.2.6). Clause 8 covers testing and commissioning requirements for substation components, including the insulation resistance acceptance criteria for cable systems at different voltage classes.

- **Heathcote, M. J. (2007).** *J & P Transformer Book*, 13th ed. Newnes/Elsevier. ISBN: 978-0-7506-8164-3. Chapter 8 covers transformer commissioning in detail, including the physics of magnetising inrush, the second harmonic content of inrush versus fault current, and the design of inrush restraint functions in transformer differential protection. Section 8.4 derives the inrush peak current formula from first principles and provides empirical k_inrush values for a range of transformer sizes and core designs. Chapter 15 covers transformer test procedures including the IR measurement, Buchholz relay testing, and DGA sampling protocols used in the pre-energisation checks.

- **Cigré Working Group B3.36 (2014).** "Offshore Substations for Wind Power Plants." *Technical Brochure 595.* CIGRÉ. ISBN: 978-2-85873-279-3. Section 8 (Commissioning) provides the most complete publicly available guidance on offshore substation SAT structure and sequence, including the standard hold-point format, the three-phase programme structure (pre-energisation → first energisation → post-energisation load tests), and the rationale for energising export cables from the onshore end. Appendix D contains a model commissioning programme for a 220/66 kV offshore substation, with 38 steps, that served as a reference for the programme structure described in this chapter.

---

*The signed programme sheet was in the commissioning record binder — the binder that was now slightly heavier than the 214-page FAT binder that had started the week. Anders's witness signature was the last entry.*

*Kaan stood at the SCADA screen for a few minutes after the room had partially emptied. The active power meter was reading 25.6 MW. The reactive meter was reading −42.1 MVAR — the STATCOM absorbing the cable. The frequency at the metering point was 50.01 Hz.*

*He thought about the 42 steps. And about the 10 months of chapters that had preceded them.*

*The Ferranti effect — Johan's real-time demonstration in the STATCOM room — was Rule 2. The second harmonic restraint — Sigrid's protection relay calibration notebook — was the reason Step 17 hadn't tripped the 170 MVA transformer on its first energisation. The synchrocheck relay — mentioned in Chapter 19 and used 34 times today — had confirmed each turbine connection in under 100 milliseconds.*

*The 42-step programme was not a document separate from what he had learned. It was a compression of everything he had learned into a sequence that a site engineer could execute safely, in the right order, with signatures and hold points and an authority in Warsaw approving each phase on a radio channel that used the same IEC 104 protocol Katrijn had explained in the network room.*

*He thought about Anders's fourth rule. Fault-clear before you energise. The insulation resistance measurement on the 220 kV cable — 8,700 MΩ, 39 times the minimum, measured at 08:12 on a Tuesday morning — had been the last check between the cable and a high-energy arc at the OSS cable termination. A routine check, until one of them fails.*

*The wind was still 9.1 m/s at hub height. The turbines were holding their setpoint. The metre of wire in the 220 kV POC metering current transformer — a component costing roughly three hundred euros in a cable worth 145 million — was measuring 65.3 A of primary current and reporting it to PSE Warsaw in real time.*

*Piotr Zawadzki had a number on his screen in Warsaw that had not been there yesterday.*

*Kaan looked at the same number from a different side of the same cable.*

*Tomorrow: the person in control.*

---

## Notes

[^1]: IEC 61936-1:2021. *Power installations exceeding 1 kV AC and 1.5 kV DC — Part 1: Common rules.* Geneva: International Electrotechnical Commission. Clause 6.2 (Switching operations) establishes the mandatory requirements for written switching programmes in HV installations. The requirement for dual-confirmation of earth switch positions (by at least two independent methods) is specified in Clause 6.2.4. The standard originated as a consolidation of IEC 61936-1:2002 and its amendments, drawing on national standards including the German DIN VDE 0101, the British BS 7354 (Code of Practice for design of high-voltage open-terminal stations), and the French NF EN 61936 series. The 2021 edition extended coverage to DC installations and added specific guidance for offshore installations, including requirements for documentation of switching sequences in marine environments where normal HSE inspection access may be weather-dependent.

[^2]: The second harmonic inrush restraint criterion — the principle that a second harmonic content of ≥15% of fundamental indicates magnetising inrush rather than fault current — is specified in modern transformer differential protection standards. The physical basis for the criterion (core saturation produces asymmetric flux, which generates even harmonics, particularly at 100 Hz in a 50 Hz system) was identified in technical literature from the 1940s onward. For a complete treatment of the derivation and the choice of the 15% threshold, see: Heathcote, M. J. (2007). *J & P Transformer Book*, 13th ed. Newnes/Elsevier. Section 8.4. The threshold of 15% was established as a result of field experience with transformer differential protection — set low enough to restrain during all credible inrush events (including cases of low residual flux and low system impedance that produce low-amplitude inrush), and high enough to ensure reliable tripping on internal faults where the second harmonic content is typically below 5%.

[^3]: The synchrocheck relay function — verification of voltage magnitude, frequency, and phase angle difference across a circuit breaker before permitting closure onto a live system — is a standard protection function implemented by all major relay manufacturers. The IEC 60255-187 series specifies functional requirements for differential protection (IEC 60255-187-1:2021 covers transformer, motor and generator differential protection, including second harmonic inrush restraint); synchrocheck functional requirements for interconnection applications are commonly addressed through project-specific grid connection agreements and manufacturer relay datasheets rather than a single dedicated IEC standard. IEEE C37.132 provides a reference framework for synchrocheck relay testing. The setting values cited (ΔV < 5%, Δf < 0.1 Hz, Δθ < 10°) are representative of commissioning specifications for wind turbine converter connections at distribution and sub-transmission voltages (33–66 kV), consistent with published practice in DNV and CIGRÉ commissioning documentation and with manufacturer factory settings for Type 4 converter interconnection. Tighter settings — ΔV < 2%, Δf < 0.05 Hz — may be specified where the commissioning programme requires demonstration of close synchronisation before operational hand-over, as is common in TSO witness test specifications. See: IEC 61936-1:2021, Clause 9.6 (synchronisation checking for generator connections); CIGRÉ TB 595:2014, Section 8.3 (offshore substation commissioning programme requirements).

[^4]: Cigré Working Group B3.36 (2014). "Offshore Substations for Wind Power Plants." *Technical Brochure 595.* CIGRÉ. Available at e-cigre.org. Section 8.2 (Commissioning programme structure) defines the three-phase SAT structure — pre-energisation tests, first energisation sequence, post-energisation load and protection tests — and recommends that the export cable be energised from the onshore substation (grid connection point) in all cases where the onshore grid has higher short-circuit capacity than any generation source available at the offshore substation. The recommendation is physically motivated: the grid-end energisation ensures the Ferranti voltage rise is absorbed by the short-circuit capacity of the transmission network rather than by the wind farm's reactive compensation equipment, which at the time of first energisation has not been independently commissioned. Section 8.3 provides hold-point format guidance and recommended minimum hold durations for transformer energisation (5 minutes for visual inspection), cable charging (3 minutes), and WTG first connection (10 minutes per feeder group).

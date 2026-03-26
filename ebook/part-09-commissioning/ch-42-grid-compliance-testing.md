# Chapter 42: Grid Code Compliance Testing: EON, ION, FON

*The helicopter came in from the north at 07:58, right on schedule. Kaan had been in the control room since 06:30, reading through his calculations for the third time — not because he expected to find errors, but because he wanted them to feel like his own answers rather than numbers copied from Sigrid's settings files or Rafael's simulation logs.*

*He watched the helicopter land on the helipad from the control room window. Three people descended the steps: Anders, who had gone to meet the PSE team at the terminal onshore, and two men he did not recognise. The third person — slightly shorter than both of them, grey overcoat, rolling laptop bag — had to be Piotr Zawadzki.*

*The voice Kaan had heard at 22:17 on the night of the Łagisza B trip, calm and unexcited, delivering "approximately eleven hundred megawatts" as if it were a weather observation. The same voice that had called back at 10:47 on the day of the frontal passage ramp, confirming reserve pre-positioning in twenty-two words. The voice on the radio authorising each of the three phases of the switching programme — Steps 9-14, Steps 15-20, Steps 39-42 — with the same measured precision.*

*He was shorter than the voice suggested. He wore reading glasses on a cord around his neck and did not take them off when he entered the building. His two colleagues carried a combined eight file folders; Zawadzki carried one and a tablet.*

*Anders made the introduction in the corridor outside the conference room. "Mr. Kowalczyk, this is our control engineer—"*

*"Kaan," Zawadzki said, and extended his hand. "I have read your protection coordination study and the PPC simulation log." He said it without qualification or compliment. It was a statement of fact: he had read these things, and so they shared some common ground.*

*They set up in the conference room. Zawadzki opened his tablet and turned it toward the table. The compliance matrix covered most of the screen: three colour-coded tabs at the top, rows for each NC RfG Article 41 requirement, columns for test status, measured value, required value, and margin.*

*The first tab — EON — was entirely green.*

*The second tab — ION — had seven green rows and one amber.*

*The third tab — FON — had one green row, one amber row, and one row Kaan had not expected: labelled SYNTHETIC INERTIA DECLARATION, status white, not yet submitted.*

*"One result needs a conversation," Zawadzki said. "The rest is documentation." He turned to the first tab. "Shall we start at the beginning?"*

---

## 42.1 The Compliance Framework

The legal basis for the meeting in the OSS conference room was Commission Regulation (EU) 2016/631 of 14 April 2016, published in the Official Journal of the European Union on 17 May 2016 and entering into force on the same date. The regulation is known as the Network Code on Requirements for Grid Connection of Power Generating Facilities — NC RfG — and Article 41 is its enforcement mechanism.

Before NC RfG, grid connection requirements across Europe were set by individual transmission system operators in their national grid codes, and a power-generating facility's compliance with those requirements was typically demonstrated by declaration rather than measurement. The developer submitted documentation; the TSO reviewed it; the facility connected. If the facility did not perform as declared, the TSO had limited recourse under the connection agreement and no European framework for systematic verification.

The 2006 European blackout — 4 November 2006, the cascade that began with a planned busbar switching operation on the Ems powerline in northwest Germany and within seventeen seconds separated the European grid into three islands, leaving fifteen million customers without power — generated, among other responses, a comprehensive investigation by the Union for the Coordination of Transmission of Electricity (UCTE). The Investigation Committee's final report, published in January 2007, made a recommendation that would take nine years to become regulation: that the connection requirements of power-generating facilities should be verified through systematic testing, not assumed on the basis of manufacturer declarations or design calculations. The UCTE report observed that during the cascade, the real behaviour of generation facilities diverged from what their connection documentation said they would do. The cascading separations exploited that gap.

NC RfG Article 41 is that recommendation, encoded in law. It requires each relevant system operator to define compliance monitoring procedures for power-generating facilities on its system. For Type D facilities — those with a rated capacity at or above 75 MW, or connected at a voltage at or above 110 kV — the requirements include dynamic capability testing: measurements of the facility's actual performance in response to controlled test inputs, rather than certification of its design parameters alone.

The European implementation timeline was not uniform. NC RfG entered into force on 17 May 2016 and required application from 27 April 2019 for new facilities. In Poland, delays in establishing accredited certification bodies under the national implementation framework pushed effective application to 1 May 2022 — three years later than the European deadline. PSE Operator S.A., operating under the IRiESP (Instrukcja Ruchu i Eksploatacji Sieci Przesyłowej), incorporated the NC RfG Article 41 requirements into its compliance monitoring framework in Section 7.3, applicable to all new Type D facilities connected on or after 1 May 2022.

The compliance process unfolds in three named stages:

**Energisation Operational Notification (EON)** is issued by the TSO to confirm that the facility is safely connected, that its basic protection and communication infrastructure is operational, and that the Article 41 test programme may begin. The EON does not certify capability — it certifies readiness to be tested. It does not permit commercial power exchange. It is the starting gun, not the finish line.

**Interim Operational Notification (ION)** is issued after the facility has demonstrated its core dynamic capabilities — active and reactive power range, ramp rate compliance, fault ride-through, and primary frequency response — and the TSO is satisfied that interim commercial operation can proceed safely. The ION permits the facility to begin power exchange under commercial contracts, subject to any specific operational restrictions noted in the notification. In the UK National Grid Grid Code (STCP19-3, Issue 006, published 25 June 2018), the ION has a maximum duration of 24 months; any tests not completed within that window require special dispensation. The PSE IRiESP sets the equivalent window at 18 months for Type D facilities connected to the 220 kV or 400 kV transmission system.

**Final Operational Notification (FON)** is issued when all outstanding tests in the ION compliance schedule have been completed and verified. The FON confirms unconditional compliance with the grid code requirements applicable to the facility. For the project under assessment, the Polish OZE support contract — the fixed-price auction contract awarded under the Ustawa z dnia 20 lutego 2015 r. o odnawialnych źródłach energii (Renewable Energy Act) — commences full price guarantee payments on the date of FON. The difference between ION payment rates and FON rates is not large per MWh, but it is material per calendar day. At 510 MW, operating at a 52% capacity factor against an auction clearing price, the daily difference between ION and FON commercial treatment was approximately EUR 18,000. Eighteen thousand euros per day is not the reason for urgency — safety and compliance are the reason — but it is a useful number for calculating the financial value of competent commissioning.

> **Standard reference:** Commission Regulation (EU) 2016/631 of 14 April 2016, establishing a network code on requirements for grid connection of power generating facilities — OJ L 112, 27.4.2016. Article 41: Compliance monitoring. [^1]

---

## 42.2 EON — The Five Basics

The EON had been issued eleven days ago, at 19:23 on the evening of the energisation, nine hours and twenty-two minutes after first power at 12:01:47.

"Nine hours," Zawadzki said, looking at the EON tab with its five green rows. "We have received EON applications that took three weeks to process because the telecontrol documentation was incomplete. Yours arrived with the test results attached."

The five tests for EON were not capability demonstrations. They were existence proofs: evidence that the basic connection infrastructure was operational and that the safety-critical systems were in the state that the documentation claimed.

**Test 1: Telecontrol connectivity.** The IEC 60870-5-104 link to PSE's dispatch centre in Warsaw — the same link that had delivered the Łagisza B event notification and the ramp alert confirmation — was verified end-to-end. Protocol: Application Service Data Unit (ASDU) sequence numbers continuous; General Interrogation (GI) cycle completed in 14.2 seconds (PSE limit: 30 seconds); spontaneous transmission confirmed for 847 change-of-state objects. One-way propagation delay: 23 ms. No missing objects.

**Test 2: Revenue metering.** The two revenue metering systems — active energy (IEC 62053-22 class 0.2S) and reactive energy (class 0.5S) — had been calibrated by an accredited Polish laboratory forty-one days before energisation. The metering accuracy requirement:

$$\varepsilon = \frac{|M_{\text{measured}} - M_{\text{reference}}|}{M_{\text{reference}}} \times 100\% \leq 0.2\%$$

where:
- $M_{\text{measured}}$ = meter registration under calibration [MWh or MVARh]
- $M_{\text{reference}}$ = calibration laboratory reference standard [MWh or MVARh]
- $\varepsilon$ = relative error [%]

Class 0.2S meters are accurate to ±0.2% of reading across the load range from 5% to 120% of rated current. The laboratory results: 0.12% at 100% load, 0.18% at 20% load. Both within the class limit.

**Test 3: Protection settings documentation.** Sigrid Lund's six-zone relay settings files — the documentation that had emerged from the coordination study in Chapter 26, been updated with the measured transformer impedance in Chapter 38, and been signed as part of the commissioning completion certificate — were submitted to PSE forty-five days before energisation. PSE had reviewed and returned them thirty-one days later with one annotation: the Bay 3 GOOSE trip signal latency (3.0 ms, at the NC RfG 3 ms limit) was noted for monitoring in the first post-commissioning inspection. The annotation had been acknowledged and logged. No outstanding objections.

**Test 4: Communication security.** IEC 62351-5 authentication was active on the IEC 60870-5-104 link, providing message authentication and sequence integrity. The one-time handshake key exchange had been logged at 18:41 on the energisation date. The cybersecurity assessment — five protection zones, IEC 62443 Security Level 2, HMAC-SHA256 on the telecontrol link — was included in the EON package.

**Test 5: Basic PPC function.** The power plant controller executed a fifteen-minute power reference setpoint test: initial setpoint 300 MW, step to 495 MW, step back to 300 MW. Farm response: 495 MW delivered from 300 MW within 4 minutes 47 seconds (ramp rate: 40.5 MW/min, within the 51 MW/min PSE limit). Deviation from setpoint at steady state: ±3.1 MW (±0.6% of 495 MW), within the ±2% tolerance.

The EON was issued eleven days before this meeting. The tests it confirmed were not the hard ones. They were necessary — a facility that could not operate its telecontrol, calibrate its meters, document its protection settings, or follow a power setpoint would have had no business requesting commercial operation. The hard tests came next.

---

## 42.3 ION — Dynamic Capability

The ION compliance test programme had eight tests. Seven were complete. One — the LFSM-U dedicated trigger test — had not yet been performed as a scheduled test. It was the amber cell in the ION tab.

Zawadzki opened the single file folder he had carried from the helicopter. Inside were twelve printed pages. He placed the folder on the table.

"Before we discuss the amber," he said, "let me confirm the seven greens."

**Test 1: Active power output range.** Maximum measured output at the point of connection: 510.4 MW, achieved at 13:22 on day 14 of operation during a 13.1 m/s mean wind speed period. Rated output 510.0 MW. Margin: 0.08%. Pass.

**Test 2: Reactive power capability — PQ diagram.** The full PQ diagram test was conducted at five active power setpoints. NC RfG Article 16 defines the mandatory reactive power range for Type D facilities connected to the transmission system: the facility must be capable of providing reactive power between:

$$Q_{\text{req}}(P) = \pm P \cdot \tan\!\left(\arccos\!\left(pf_{\min}\right)\right)$$

where:
- $P$ = active power output [MW]
- $pf_{\min}$ = minimum power factor = 0.95 (as specified in the PSE grid connection agreement)
- $Q_{\text{req}}$ = required reactive power range boundary [MVAR]

At $P = 510$ MW: $Q_{\text{req,max}} = 510 \times \tan(\arccos(0.95)) = 510 \times 0.3287 = 167.6$ MVAR. Measured: +172.0 MVAR. Margin: 4.4 MVAR.

The converter reactive capability of each 15 MW Type 4 turbine:

$$Q_{\text{WTG}}(P) = \pm\sqrt{S_{\text{WTG}}^2 - P_i^2}$$

where $S_{\text{WTG}} = 16.5$ MVA (rated apparent power, providing headroom for reactive support at full active output) and $P_i$ is the active output per turbine [MW]. At $P_i = 15$ MW: $Q_{\text{WTG}} = \pm\sqrt{16.5^2 - 15.0^2} = \pm 6.87$ MVAR per turbine. Across 34 turbines: ±233.6 MVAR combined, plus the STATCOM's ±120 MVAR — more than twice the required envelope at rated output. The measurements confirmed the design.

*Test results at five operating points (inductive quadrant only):*

| P setpoint | Q required (+) [MVAR] | Q measured (+) [MVAR] | Margin |
|-----------|---------------------|---------------------|--------|
| 510 MW (Pn) | 167.6 | 172.0 | 4.4 |
| 382 MW (0.75Pn) | 125.7 | 129.1 | 3.4 |
| 255 MW (0.50Pn) | 83.8 | 86.8 | 3.0 |
| 128 MW (0.25Pn) | 42.1 | 46.3 | 4.2 |
| 51 MW (0.10Pn) | 51.5 (flat min.) | 52.7 | 1.2 |

Pass. The 51 MW row would become relevant under the FON discussion. Zawadzki did not comment on it here.

**Tests 3 and 4: Ramp rate up and down.** NC RfG Article 15 and the PSE IRiESP require:

$$\left|\frac{\Delta P}{\Delta t}\right| \leq r_{\text{ramp}} \cdot P_n$$

where $r_{\text{ramp,up}} = 10\%\ P_n/\text{min} = 51.0$ MW/min and $r_{\text{ramp,down}} = 20\%\ P_n/\text{min} = 102.0$ MW/min. Measured: 50.7 MW/min up, 101.3 MW/min down. Both within the ±5% measurement tolerance. Pass.

**Test 5: LFSM-O.** Frequency rise to 50.22 Hz (2 mHz above the 50.20 Hz LFSM-O threshold): the PPC reduced farm output from 488 MW to 482.0 MW within 2.1 seconds. NC RfG requirement: response must begin within 30 seconds. The measured droop: 5.1% against the 5.0% command. Pass.

**Test 6: FRT compliance.** Type 4 converter type approval certificates (per IEC 61400-21-1:2019) were submitted. The ANDES simulation — voltage to 0.05 pu for 140 ms, reactive current injection 1.0 pu in 5 ms, active power recovery to 89.8% at t+1.0 s — was reviewed against the type test data. Zawadzki looked at Anders. "Your ANDES model was calibrated to within 3.1% of the type test voltage recovery curve. That is within the 5% calibration tolerance. Acceptable."

**Test 7: Voltage regulation.** The Q(V) PI controller was tested at ±5% voltage excursion at the 220 kV bus. Response time to 90% of commanded reactive output: 3.1 seconds. NC RfG Article 22 requirement: within 5 seconds. Pass.

---

Zawadzki placed the printed pages from his folder in front of him. He aligned them on the table.

"Test 8," he said. "LFSM-U."

He turned the top sheet toward the table.

It showed two traces, aligned on a common time axis. One was the PSE Warsaw dispatch centre frequency measurement from the evening of 22 October — the night of the Łagisza B event. The other was the IEC 60870-5-104 event log from the OSS, recording the farm's active power output across the same period. The two traces were synchronised to within 200 milliseconds. Someone at PSE had retrieved the dispatch centre record and matched it against the 104 log that Kaan had watched unfold in real time, seated at the same SCADA workstation ten weeks earlier.

"Łagisza B tripped at 22:14:07," Zawadzki said. "Frequency fell below the LFSM-U activation threshold of 49.80 Hz at 22:14:31. Your farm's active power began increasing at 22:14:39. Eight seconds after threshold crossing. NC RfG requires response to begin within thirty seconds."

He continued: "At the frequency nadir — 49.67 Hz, reached at 22:14:52 — your farm was providing an additional 10.2 MW above the pre-event baseline. The measured LFSM-U droop characteristic, derived from these two traces, is 5.0% within the measurement uncertainty of ±0.3%."

The LFSM-U response is characterised by:

$$\Delta P_{\text{LFSM-U}} = P_{\text{avail}} \cdot \frac{f_{\text{threshold}} - f_{\text{actual}}}{\sigma \cdot f_n}$$

where:
- $P_{\text{avail}}$ = available active power at event onset = 392 MW [MW]
- $f_{\text{threshold}}$ = LFSM-U activation frequency = 49.80 Hz [Hz]
- $f_{\text{actual}}$ = measured frequency at nadir = 49.67 Hz [Hz]
- $\sigma$ = droop setting = 5% = 0.05 [dimensionless]
- $f_n$ = nominal frequency = 50 Hz [Hz]

$$\Delta P_{\text{LFSM-U,commanded}} = 392 \cdot \frac{49.80 - 49.67}{0.05 \times 50} = 392 \times \frac{0.13}{2.5} = 20.4 \text{ MW}$$

The measured delivery was 10.2 MW — approximately half the commanded value. "The discrepancy," Zawadzki said, without being asked, "is explained by the wind resource at the event time. The farm's actual available power was 392 MW against a nominal 510 MW — turbines at partial load in 8.6 m/s wind. LFSM-U cannot deliver power the wind is not providing. The partial delivery is consistent with the available resource." He paused. "NC RfG Article 15, paragraph 2: LFSM-U response is a best-effort obligation above the available active power. It is not a guaranteed delivery independent of wind. Your droop characteristic is correct. The resource was limited."

He looked at Kaan directly for the first time since the meeting started. "You watched this event happen."

It was not a question.

"Yes," Kaan said.

"NC RfG Article 41, paragraph 4: TSO-observed operational events may be accepted as evidence for compliance tests in lieu of a dedicated trigger test, where the observed event parameters meet the test specification criteria." He uncapped a pen and marked the LFSM-U row. "This event satisfies the LFSM-U test requirement. ION test programme: complete."

The ION was issued at 11:14 that morning.

<!-- IMAGE: fig-42-1 -->
> **Figure 42.1** — ION Compliance Test Summary: LFSM-U Evidence from Live Event
> **Type:** Dual-trace time series chart
> **Content:** Horizontal axis: time [minutes], 10-minute window centred on 22:14. Vertical axis left: system frequency [Hz], 49.60–50.00 Hz. Vertical axis right: farm active power [MW], 380–420 MW. Blue trace: PSE dispatch frequency measurement. Orange trace: farm active power (IEC 60870-5-104 event log). Vertical dashed lines: Łagisza B trip (22:14:07), LFSM-U threshold crossing (22:14:31), farm response start (22:14:39), nadir (22:14:52). Annotation: "Δt = 8 s (≤ 30 s limit)"; "ΔP = 10.2 MW measured"; "droop = 5.0% ± 0.3%".
> **Caption:** The Łagisza B frequency event (22 October) provided compliance evidence for the LFSM-U test in lieu of a scheduled trigger test. The two independently logged traces — PSE dispatch centre frequency and farm active power from the IEC 60870-5-104 link — agree within 200 ms and confirm the 5.0% droop characteristic and sub-30-second response onset.
> **Alt text:** Dual-trace time series showing system frequency falling and farm active power rising in response, with event timeline annotations and LFSM-U compliance metrics.
> **Data source:** PSE Warsaw dispatch centre frequency log; OSS IEC 60870-5-104 event archive. Author illustration.
> **Resolution:** 1400 × 700 px minimum
> **Color notes:** PSE frequency trace blue, farm power orange; threshold and nadir markers dashed grey; compliance annotations in black.

---

## 42.4 FON — The Three Remaining Tests

Three rows remained in the FON tab. Zawadzki turned to them in order.

**FON Test 1: Power quality at the point of connection.** Ingrid Sørensen's harmonic assessment — THD 1.30%, Pst 0.007, 11th harmonic at 0.98% with 0.52% margin — had been submitted as the design-stage assessment. PSE required a measurement at the actual point of connection, taken during commercial operation. The measurement had been taken during the second week: THD 1.26%, Pst 0.006. The 11th harmonic measured 0.94% — slightly below the design assessment value, confirming that the cable-transformer resonance modelling had been conservative.

Zawadzki reviewed the report. "The 11th harmonic: 0.94%, limit 1.5%. Margin: 0.56 percentage points. You have annotated this as a monitoring point." He read the annotation: *Re-measure at 6 months, 12 months, and after any firmware update to the WTG inverter control.* "We agree with this approach. The condition will be carried into the FON." He marked the row: PASS, with monitoring condition.

**FON Test 2: Synthetic inertia declaration.** NC RfG Article 45 — synchronous inertia equivalent contribution from non-synchronous generation — is a voluntary requirement in Poland until the grid code revision scheduled for 2027. PSE's Article 41 compliance framework requests a baseline declaration from all Type D non-synchronous facilities, as system inertia inventory data for network planning purposes.

Anders submitted a one-page declaration: the farm's virtual inertia constant H_SI = 1.5 s per WTG, from the PLL emulation algorithm installed by the stability consultant in Chapter 27, active across 34 WTGs of 15 MW each. Total virtual inertia contribution at rated output: H_farm = 1.5 × (34 × 15) / 510 = 1.5 s. A declared capability, not a binding obligation.

Zawadzki accepted the declaration without comment and marked the row green. Declarations are straightforward. The third row was the one that had been amber since the first draft of the compliance schedule.

**FON Test 3: Reactive capability at P = 0.10·Pn.** Kaan looked at the PQ table from the ION section again. At 51 MW active power output, the measured reactive capability showed +52.7 MVAR. But the required value in that row was not ±16.8 MVAR — the value given by the pf = 0.95 envelope at 51 MW.

"The required value in that row," Zawadzki said, "is not derived from the power factor requirement. PSE IRiESP Section 7.3, paragraph 4: at active power outputs below 20% of rated, Type D facilities connected to the 220 kV system shall maintain reactive capability of not less than ten percent of rated apparent power." Ten percent of 567 MVA was 56.7 MVAR. The IRiESP set the minimum at 51.5 MVAR for this connection point. "This requirement exists to maintain voltage stability margin at the substation busbar when the farm is operating at minimum load in high-reactive-demand conditions. It does not follow the power factor curve. It is a flat minimum."

"The first measurement," Zawadzki continued, "showed +42.2 MVAR."

He looked at Rafael Díaz, who was sitting on the far side of the table with his tablet open.

"The first measurement," Rafael said, "was taken at 17:30 on a Wednesday evening, with 21 of 34 turbines in minimum speed mode at 0.5 MW each, and 13 turbines shut down for scheduled maintenance. The STATCOM was providing +40.0 MVAR. The WTG contribution was +2.2 MVAR. Total: +42.2 MVAR. Deficit against the 51.5 MVAR requirement: 9.3 MVAR."

He did not pause before continuing. "I identified the problem when I reviewed the preliminary test log on Friday. At P below 15% rated, the STATCOM Q priority ceiling in the PPC was set to +40.0 MVAR. This was the correct setting for normal load-following operation — it prevented STATCOM overload during reactive-power oscillations at partial turbine count. But at minimum active load, the WTG Q contribution falls to near zero because the converters are at minimum excitation. The STATCOM ceiling needed to increase."

"The firmware update to the STATCOM Q priority profile was developed Friday afternoon, reviewed Saturday, deployed Sunday at 07:42. The test was repeated at 08:15." He slid his tablet across the table. The screen showed the updated test record: P = 51.4 MW, Q_measured = +52.7 MVAR, Q_required ≥ 51.5 MVAR, margin = +1.2 MVAR. Pass.

Zawadzki looked at the tablet. He looked at the timestamp: 08:15, today. He looked at Rafael. "You corrected this before arriving at the meeting."

"Yes."

"And you brought the updated result."

"Yes."

Zawadzki removed his reading glasses. He wrote PASS in the FON column of the reactive capability row, with the date and time from the test record. He replaced his glasses. "FON test programme: complete."

<!-- IMAGE: fig-42-2 -->
> **Figure 42.2** — PQ Capability Diagram: NC RfG Envelope vs Measured Farm Capability
> **Type:** P-Q diagram with envelopes
> **Content:** Horizontal axis: Active power P [MW], 0 to 530. Vertical axis: Reactive power Q [MVAR], −200 to +200. Two diagonal solid lines: the NC RfG pf = 0.95 envelope (upper-right and lower-right). Horizontal dashed orange lines at ±51.5 MVAR: the PSE flat minimum below 20% Pn. Vertical dashed grey line at 102 MW (20% Pn): flat minimum boundary. Five measured points (red dots) at each test operating point, plotted in the inductive quadrant. Dashed blue envelope: farm capability curve (maximum achievable Q at each P). Shaded green region: margin between measured points and required envelope. The 51 MW measured point circled in orange.
> **Caption:** The farm's measured PQ capability at five operating points against the NC RfG Article 16 minimum envelope and the PSE flat minimum for low active power operation. The tightest margin (1.2 MVAR at P = 51 MW) resulted from a STATCOM Q ceiling setting corrected before the FON compliance meeting.
> **Alt text:** P-Q diagram showing measured reactive capability at five operating points, all above the required NC RfG compliance envelope, with the PSE flat minimum annotated at low active power.
> **Data source:** Author illustration based on NC RfG 2016/631/EU Article 16 and PSE IRiESP Section 7.3.4.
> **Resolution:** 1200 × 900 px minimum
> **Color notes:** NC RfG envelope dark blue solid, PSE flat minimum orange dashed, measured points red, capability envelope dashed blue, margin shading light green.

---

## 42.5 Gate Logic to Commercial Operation

The FON was necessary. It was not sufficient.

Commercial operation — the legal status under which the farm could begin receiving its OZE auction contract payments, sell electricity through the PSE balancing market, and operate without the interim constraints attached to the ION — required the simultaneous clearing of three independent gates. Engineering teams rarely control all three.

**Gate 1: Technical.** The FON, now issued. Date: today.

**Gate 2: Contractual.** The OZE support contract, won in the Polish auction and signed with the URE (Urząd Regulacji Energetyki — the Office of Energy Regulation), specified that price support payments began on the date of the Final Operational Notification. The contract had been held in escrow pending the FON. At 14:00, the URE contract administrator would receive notification of the FON date, triggering the price support period. The contract trigger did not require a separate application. It required only the date. The date was today.

**Gate 3: Financial.** Revenue metering acceptance by an accredited verification body under the Polish transmission tariff rules required calibration certificates filed not fewer than 30 days before metering commencement. The certificates had been filed 41 days ago. Accepted.

"All three gates clear at 00:00:01 tomorrow morning," Anders said. "Commercial operation begins at midnight."

He looked at Åsa Lindqvist, who had been sitting in the corner of the conference room throughout the morning's proceedings — not as a participant in the compliance testing conversation, but as the commissioning lead who had signed every test document since Chapter 38. She had her clipboard open. She closed it.

"That is the last signature," she said.

She uncapped her red pen, initialled the commissioning completion certificate — the final act in the sequence she had opened three months ago with the remark that the document said it passed and the instrument decided — and handed it to Anders.

Anders signed as commissioning representative. He passed it to Kaan.

Kaan signed as project control engineer. The space for his signature had been there since the document was printed.

Åsa took it back, checked both signatures, folded the red pen cap over the pen barrel, and put both in her jacket pocket. She picked up her clipboard.

"I'm done here," she said.

She stood. She shook Zawadzki's hand, then Anders's, then Kaan's. She did not say anything further. The door to the conference room closed behind her.

Zawadzki packed his file folder into his laptop bag with the same methodical precision with which he had unpacked it. His two colleagues from the Network Compliance Division followed suit.

"Your documentation," he said, pulling the bag strap over his shoulder, "was among the better packages we have received this year. I say this as an observation, not a compliment. The better packages are the ones that allow us to do our work efficiently. Yours allowed us to do exactly that." He moved toward the door. He paused. "The 11th harmonic. Re-measure at six months."

"Noted," Kaan said.

Zawadzki left.

<!-- IMAGE: fig-42-3 -->
> **Figure 42.3** — Three-Gate Logic for Commercial Operation
> **Type:** Flow diagram
> **Content:** Three vertical gate icons aligned horizontally (Gate 1: Technical — FON issued; Gate 2: Contractual — URE OZE trigger; Gate 3: Financial — metering certificate pre-filed). Each gate has a green check mark and an annotation note. Below: AND logic gate symbol merging all three into a single output labelled "Commercial Operation — 00:00:01." Timeline annotation across the top: EON (Day 0) → ION (Day 11) → FON (Day 21) → CO (Day 22 00:00:01). Gate 3 annotated: "pre-filed 41 days prior — not on critical path."
> **Caption:** Commercial operation requires the simultaneous clearing of three independent gates: technical certification (FON), contractual activation (URE OZE contract trigger), and financial acceptance (metering calibration). For this project, the financial gate had the earliest resolution — metering certificates were filed 41 days before energisation.
> **Alt text:** Flow diagram showing three parallel gate conditions converging via AND logic into commercial operation start.
> **Data source:** Author illustration.
> **Resolution:** 1200 × 700 px minimum
> **Color notes:** Gate icons green. AND logic symbol standard IEC. Timeline arrow horizontal, left to right.

---

## 42.X Worked Example: Complete NC RfG Type D Compliance Matrix

**Context:** Final Operational Notification compliance verification for a 510 MW offshore wind power generating module (34 × 15 MW Type 4 WTG + ±120 MVAR STATCOM + 50 MVAR shunt reactor), connected to the 220 kV transmission system.

**Step 1: PQ diagram — NC RfG required envelope.**

At each active power setpoint $P$, the required reactive power range boundary is:

$$Q_{\text{req}}(P) = \pm P \cdot \tan\!\left(\arccos\!\left(0.95\right)\right) = \pm 0.3287\,P \text{ [MVAR]}$$

For $P \leq 102$ MW (below 20% of $P_n = 510$ MW), the PSE flat minimum applies:

$$Q_{\text{flat}} = 51.5 \text{ MVAR (binding floor when } Q_{\text{req}}(P) < Q_{\text{flat}}\text{)}$$

**Step 2: Measured capability and compliance verification.**

| P [MW] | P/Pn | Q_req (+) [MVAR] | Q_flat [MVAR] | Governing req. | Q_measured (+) | Margin | Status |
|--------|------|----------------|------------|----------------|----------------|--------|--------|
| 510 | 1.00 | 167.6 | — | 167.6 | 172.0 | +4.4 | ✓ |
| 382 | 0.75 | 125.7 | — | 125.7 | 129.1 | +3.4 | ✓ |
| 255 | 0.50 | 83.8 | — | 83.8 | 86.8 | +3.0 | ✓ |
| 128 | 0.25 | 42.1 | — | 42.1 | 46.3 | +4.2 | ✓ |
| 51 | 0.10 | 16.8 | **51.5** | **51.5** | 52.7 | +1.2 | ✓ |

The full-load margin of 4.4 MVAR confirms the STATCOM sizing from Chapter 20. The tightest margin is at 51 MW (1.2 MVAR above the flat minimum), following the STATCOM ceiling update. The negative-Q (capacitive) results, not shown above, were symmetric within 0.8 MVAR in all cases.

**Step 3: Financial consequence of the corrected setting.**

The difference between the preliminary failed result at 51 MW (+42.2 MVAR, deficit 9.3 MVAR) and the corrected result (+52.7 MVAR, pass) represented the difference between a conditional ION and a full FON. If the correction had required a 30-day engineering study and additional type testing, the delay to FON would have cost approximately EUR 540,000 in deferred OZE price support payments (EUR 18,000/day × 30 days). The firmware update took 18 hours from identification to deployment. The test took 45 minutes. The margin between a minor fix and a major delay was the decision to review the preliminary test data before the meeting, not during it.

**Summary: Complete NC RfG Article 41 Type D compliance matrix**

| Stage | Test | Required | Measured | Status |
|-------|------|----------|----------|--------|
| EON | Telecontrol (IEC 60870-5-104) | GI < 30 s | 14.2 s | ✓ |
| EON | Revenue metering (class 0.2S) | ε ≤ 0.2% | 0.18% | ✓ |
| EON | Protection settings | Submitted + approved | Approved (1 monitored annotation) | ✓ |
| EON | Communication security | IEC 62351-5 active | Active | ✓ |
| EON | Basic PPC setpoint | ±2% steady state | ±0.6% | ✓ |
| ION | P_max | ≥ 510 MW | 510.4 MW | ✓ |
| ION | PQ diagram (5 points) | pf ≥ 0.95 / flat min. | All pass | ✓ |
| ION | Ramp up | ≤ 51 MW/min | 50.7 MW/min | ✓ |
| ION | Ramp down | ≤ 102 MW/min | 101.3 MW/min | ✓ |
| ION | LFSM-O | Response < 30 s | 2.1 s | ✓ |
| ION | FRT (type approval + sim) | IEC 61400-21-1 | Calibrated < 3.1% | ✓ |
| ION | Voltage regulation Q(V) | < 5 s | 3.1 s | ✓ |
| ION | LFSM-U | Droop 5% ± 0.3% | 5.0% (event evidence) | ✓ |
| FON | Power quality at POC | THD < 3.0%, Pst < 1.0 | 1.26%, 0.006 | ✓ (monitor h11) |
| FON | Synthetic inertia decl. | Declaration (voluntary) | H = 1.5 s declared | ✓ |
| FON | Q at P = 0.10Pn | ≥ 51.5 MVAR | 52.7 MVAR | ✓ |

---

## Key Takeaways

- **NC RfG Article 41 replaced self-declaration with demonstrated performance as the European standard for power-generating facility compliance.** Before 2016, capabilities were declared. After 2016, they are measured. The 2006 European blackout exposed the gap between what facilities declared they could do and what they did when the grid needed them. NC RfG Article 41 closed that gap with legally binding measurement requirements.

- **The three-stage EON → ION → FON sequence allows commercial operation to begin before all dynamic tests are complete, but defers full price support until the facility has demonstrated the complete capability set.** In Poland, the OZE support contract triggers on FON, not ION — creating a financial incentive to complete the test programme rapidly without compromising test quality. The daily financial cost of delay is calculable; for a 510 MW project at a 52% capacity factor, it was EUR 18,000 per day.

- **A real grid event can substitute for a dedicated compliance test when the event parameters satisfy the test specification and the TSO has independent confirmation.** The Łagisza B frequency event provided LFSM-U compliance evidence that a scheduled trigger test would have replicated under controlled conditions. NC RfG Article 41 explicitly provides for this substitution — it is not a workaround, but an acknowledgment that power systems provide test conditions the commissioning schedule cannot always anticipate.

- **Reactive capability at low active power is governed by a flat minimum, not the power factor envelope.** Below 20% of rated capacity, the PSE requirement for reactive support is a fixed floor that does not scale with active power. The pf = 0.95 compliance line falls to 16.8 MVAR at 10% load; the PSE flat minimum requires 51.5 MVAR. An engineer who designs only for the power factor envelope will under-specify the STATCOM authority at minimum active power.

- **Compliance testing is engineering work, not administrative work.** The reactive capability deficit at 51 MW was identified from preliminary test data, diagnosed to a specific STATCOM setting, corrected by a firmware update, and re-tested — all before the compliance meeting. The auditor reviewed a corrected result, not an open problem. Professional commissioning engineering means the auditor receives the answer, not the question.

---

## For Further Reading

- **Commission Regulation (EU) 2016/631 of 14 April 2016.** *Establishing a network code on requirements for grid connection of power generating facilities.* Official Journal of the European Union L 112, 27.4.2016. Full text at EUR-Lex. Article 41 (Compliance monitoring) and Article 16 (Reactive power capability for Type D) are the primary references for this chapter. The ENTSO-E Implementation Guidance Document for compliance verification (September 2017) provides non-binding guidance on how TSOs and generator owners should implement Article 41 testing in practice, including the conditions under which operational event data may be accepted in lieu of a scheduled trigger test.

- **National Grid Electricity System Operator (2018).** *STCP19-3: Operational Notification and Compliance Testing.* Issue 006, 25 June 2018. Available at nationalgrideso.com. The UK Grid Code document that established the ION/FON framework in its current form. Section 3 defines the Interim Operational Notification, permitting commercial electricity trade while outstanding tests are resolved, with a 24-month maximum duration. Section 4 defines the Final Operational Notification as confirming full compliance. Appendix A (ION Schedule) lists the specific tests required for different generating unit types, including Type 4 converter-based generation. The UK framework preceded NC RfG by several years and served as a reference for several European TSOs during the development of the ENTSO-E compliance monitoring guidance.

- **IEC 62053-22:2020.** *Electricity metering equipment — Particular requirements — Part 22: Static meters for AC active energy (classes 0.1S, 0.2S and 0.5S).* International Electrotechnical Commission, Geneva. Defines the Class 0.2S accuracy requirements for revenue-grade electricity meters at grid connection points. Table 1 specifies the maximum permissible error of ±0.2% of reading across 5–120% of rated current. IEC 62053-23:2020 covers Class 0.5S reactive energy meters. The companion standards IEC 61869-2 and IEC 61869-3 set the accuracy requirements for the instrument transformers that feed the metering system; revenue metering accuracy is only achievable if both the transformers and the meters meet the required accuracy class.

---

*Kaan was alone in the control room at 23:47.*

*The day operator had handed over to the night operator at 22:00, and the night operator — a methodical Polish engineer named Marek, who preferred quiet nights — had checked the SCADA trends, confirmed all 34 turbines at normal operating temperature, and settled into his chair with a thermos of his own.*

*In thirteen minutes, the revenue metering system would begin recording the first commercial megawatt-hours of the farm's life. The turbines would not know. Nothing would change on the SCADA screens. The blades were already turning; the megawatts were already flowing; the IEC 60870-5-104 link to Warsaw was already transmitting. What would change at midnight was a number in an accounting system in Warsaw, and a date in a contract register at the URE offices in central Warsaw, and a new entry in the PSE operational database: this facility, these megawatts, now commercial.*

*He looked at the compliance matrix printout on the desk beside him. Three tabs, all green. He had printed it himself after Zawadzki left, not because he needed to, but because he wanted to see it on paper.*

*Nine months. Thirty-four rotors. Forty-five kilometres of export cable. A switching programme that had taken most of a night to execute. A frequency event that turned out to be a compliance test that nobody had scheduled. A STATCOM firmware update that Rafael had deployed on a Sunday morning because a number in a preliminary test log was 9.3 MVAR below a number in a PSE specification, and that gap mattered.*

*He thought about every person who had taught him something in this building. Stefan on the GIS hall. Johan in the STATCOM room. Sigrid in the relay room, twice. Lars and his spectrum analyser at 12.3 Hz. Hanna and her four laminated A3 sheets. Brigid and her padlocks. Jonasz and the GIGO card. Anders, always, from the first night on the CTV in the 3.8-metre sea.*

*The compliance certificate proved what the machine could do. The operations log would prove whether it continued to do it.*

*He looked at the clock: 23:59:31.*

*At 00:00:01, the meter registered its first MWh.*

*Nothing changed. Everything had already happened.*

*He looked at the desk calendar propped beside the SCADA workstation. Monday's entry: Erik Svensson, O&M Manager — arrival 09:00. The man who would show him what it meant to run the machine that had just received its certificate. The farm was not done. It had only just begun its life.*

---

## Notes

[^1]: Commission Regulation (EU) 2016/631 of 14 April 2016 establishing a network code on requirements for grid connection of power generating facilities. *Official Journal of the European Union* L 112, 27.4.2016, pp. 1–68. Available at EUR-Lex (eur-lex.europa.eu). The regulation entered into force on 17 May 2016 and required application from 27 April 2019 for new power-generating facilities. Article 41 (Compliance monitoring) requires relevant system operators to define compliance monitoring procedures; Article 16 (Reactive power capability) defines the mandatory P-Q capability envelope for Type C and D facilities. The ENTSO-E Implementation Guidance Document for compliance verification: *IGD — Compliance Verification and Monitoring after Operational Notification*, ENTSO-E, September 2017. Available at eepublicdownloads.entsoe.eu. Section 4.3 of the IGD addresses the conditions under which TSO-observed operational events may be accepted as evidence in lieu of dedicated trigger tests under Article 41, paragraph 4.

[^2]: UCTE Investigation Committee. (2007). *Final Report — System Disturbance on 4 November 2006*. Union for the Coordination of Transmission of Electricity, Brussels, January 2007. Full report available at entsoe.eu/fileadmin/user_upload/_library/publications/ce/otherreports/Final-Report-20070130.pdf. The report documents the 4 November 2006 cascade: planned Ems powerline switching at 22:10:15 CET, synchronous area separation in three islands at 22:10:38 CET (23 seconds), affecting approximately 15 million customers across ten countries. The Investigation Committee's Recommendation 14 (pp. 69–70) calls for systematic verification of power-generating facility capabilities as a condition of grid connection, replacing design-parameter declarations — the direct legislative precursor to NC RfG Article 41. Previously cited in Chapter 22.

[^3]: National Grid Electricity System Operator. (2018). *STCP19-3: Operational Notification and Compliance Testing*, Issue 006, 25 June 2018. Available at nationalgrideso.com. The document defines the full ION/FON framework: Section 3 (ION — first export, maximum 24-month duration, schedule of outstanding tests); Section 4 (FON — all tests complete, full compliance confirmed); Appendix A (ION schedule by unit type, including Type 4 converter-based generation). The UK framework predated NC RfG by several years; the ION/FON terminology and staged commercial operation structure were adopted or referenced in the compliance frameworks of several European TSOs during the NC RfG national implementation process.

[^4]: PSE Operator S.A. *Instrukcja Ruchu i Eksploatacji Sieci Przesyłowej (IRiESP)* (Instructions for Transmission System Operation and Maintenance). Current version available at pse.pl/publikacje/instrukcja-ruchu-i-eksploatacji-sieci-przesylowej. Section 7.3 (Compliance monitoring for power-generating facilities): incorporates NC RfG Article 41 requirements for the Polish 220 kV and 400 kV transmission system. Section 7.3.4 specifies the flat minimum reactive capability of ≥10% of rated apparent power for Type D non-synchronous facilities at active power outputs below 20% of rated. Poland's delayed NC RfG implementation (full application from 1 May 2022, versus the EU application date of 27 April 2019) is described in the PSE IRiESP revision history notes for the 2022 edition update.

[^5]: Ustawa z dnia 20 lutego 2015 r. o odnawialnych źródłach energii (Act of 20 February 2015 on Renewable Energy Sources). Dz.U. 2015 poz. 478, as amended through 2024. Available at isap.sejm.gov.pl. Chapter 4 (Auction system for renewable energy): Article 83 defines the support period as 15 years from the date of first sale of electricity under the auction contract, which corresponds to the FON date for new grid-connected facilities. The contract price is the clearing price from the relevant auction round. Contract administration by URE (Urząd Regulacji Energetyki, ure.gov.pl). Auction clearing prices for offshore wind in Poland: first offshore auction held in 2023 under the amended IRiESP framework for facilities in the Baltic EEZ.

[^6]: IEC 62053-22:2020. *Electricity metering equipment — Particular requirements — Part 22: Static meters for AC active energy (classes 0.1S, 0.2S and 0.5S).* International Electrotechnical Commission, Geneva. Table 1: maximum permissible errors for Class 0.2S, ±0.2% at cos φ = 1 from 5% to 120% of basic current. IEC 62053-23:2020 covers Class 0.5S reactive energy meters (±0.5% at PF = 1, ±1.0% at PF = 0.5 L). Companion standards: IEC 61869-2:2012 (current transformer accuracy classes for metering — Class 0.2S CTs required to support Class 0.2S meter accuracy) and IEC 61869-3:2011 (voltage transformers for metering — Class 0.2 VTs). The full metering system accuracy, including instrument transformer contribution, is determined by the RSS combination of CT, VT, and meter errors; a Class 0.2 VT (±0.2%) combined with a Class 0.2S CT (±0.2%) and Class 0.2S meter (±0.2%) yields a combined system error budget of approximately ±0.35% RSS — acceptable for TSO settlement metering at Type D connection points.

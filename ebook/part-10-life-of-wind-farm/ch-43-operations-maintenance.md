# Chapter 43: The Rhythm of the Sea — Operations, Weather Windows, and the Discipline of Access

*The calendar on the control room wall said March. Outside, the Baltic was grey-green and restless, four-foot swells rolling in from the northwest under a sky that had not been fully light since October.*

*Kaan had been the resident control engineer for six months now. He knew the daily shape of the SCADA screen the way you know the face of someone you see every morning: the slow rise of power output as the wind strengthened before noon, the brief dip when the export transformer temperature climbed above setpoint and the cooling fans cycled, the particular scatter pattern of alarm colours on a Monday when the night shift had let minor alerts accumulate. He had stopped noticing any of it consciously. It had become the farm's resting heartbeat.*

*The CTV was in the harbour.*

*He had been watching the vessel report for forty minutes. The crew of six had arrived at the operations base at 06:15 as scheduled. The load-out was done: replacement pitch controller cards for T03, hydraulic seals for T11, a toolkit for the quarterly bolt torque checks on strings 2 and 3. The CTV was ready. The sea was not. The nearest wave buoy was reading 1.7 metres significant wave height. The catamaran's operational limit was 1.5 metres.*

*The operations manager arrived at 07:30. His name was Erik Svensson, and he had been running offshore O&M operations since 2008 — Horns Rev II first, then a string of UK Round 2 projects, then this assignment in the Baltic. He was compact and precise, the kind of man who could be described as unhurried only if you understood that unhurried, in his vocabulary, did not mean slow. It meant that every action was the right one and the right one had been decided before the decision was needed.*

*He looked at the vessel report. He looked at the wave forecast. He looked at the planned maintenance schedule, which was printed on a laminated sheet and already annotated in blue ballpoint.*

*"Eleven," he said.*

*"Eleven o'clock," Kaan confirmed. "The forecast model has the swell easing to 1.4 by eleven and staying below 1.5 through to about fifteen hundred."*

*"Four-hour window." Erik wrote the number on the laminate. "That's enough for T03 if the crew is efficient. T11 gets rescheduled." He capped the pen and handed the revised sheet to Kaan. "This is what we do. The sea gives you windows. You decide what to put in them."*

*Kaan had heard him say that before. He was beginning to understand it was not a philosophy. It was a description of the job.*

---

## 43.1 The Access Problem

There is a sentence that every offshore operations manager knows and every engineer from an onshore background has to learn: *you cannot drive to a turbine.*

On land, a wind technician with a fault code and a van can be at the base of the tower within the hour. The job either takes two hours or it takes a day; either way, the technician can return home for dinner. On an offshore farm fifteen to twenty kilometres from the nearest harbour, the same technician needs a vessel, a sea state within the vessel's operational limits, a weather forecast that will hold through the duration of the job, a plan for what happens if the forecast is wrong, and a place to sleep if it is. The marginal cost of access is not the cost of one van trip — it is the cost of one day of vessel operation, one day of crew time, one day of logistics coordination, and a probability multiplied by a revenue figure. That probability — the chance that the sea will allow the vessel to reach the turbine and allow the crew to board it — is the governing constraint of everything in offshore operations.

The first offshore wind farm, Vindeby, was commissioned in 1991 eleven kilometres south of the island of Lolland in Danish waters. Its eleven Bonus 450-kW turbines stood in four to five metres of water. The maintenance strategy for Vindeby was, in retrospect, improvised: engineers used flat-bottomed barges and a small crane barge for access and equipment handling. It worked, after a fashion, because the turbines were small, the water was shallow, and the wind resource in the Vindeby site was relatively mild. But the barges were susceptible to wave motion, and in any sea state above about one metre the access route was effectively closed. Maintenance was deferred when the sea was unfriendly, and a turbine that could not be reached could not be fixed.

Horns Rev I, commissioned in 2002 as the first large commercial offshore wind project — eighty Vestas V80 2-MW turbines, fifty to eighty kilometres from shore in water depths of six to fourteen metres — confronted the access problem at a different scale. The solution adopted at Horns Rev I was helicopters. Personnel were hoisted directly into the nacelle access hatch. It was safe and weather-independent at lower sea states, but it was expensive, limited to two technicians per lift, and practically impossible for heavy component exchanges. Boat transfers were used in parallel for lower-wave-height periods, typically with rigid inflatable boats or small utility vessels.

What the offshore wind industry needed was a purpose-built vessel designed specifically for the access problem. The crew transfer vessel — the CTV — emerged from the early 2000s as the workhorse of offshore maintenance access. A CTV is typically a twin-hull catamaran, twenty-four to thirty metres long, capable of carrying twelve to twenty-four technicians at speeds of twenty-five to thirty knots, designed with a specially reinforced aluminium bow that contacts the turbine foundation ladder access platform at an angle and holds position using engine thrust. Technicians step from the bow onto the ladder. The key operational parameter is the significant wave height limit: for standard CTV catamarans operating in the North Sea and Baltic, the limit is 1.5 metres Hs. Specialist vessels with larger dimensions and enhanced hull forms extend this to 2.0 metres; surface effect ships achieve 2.5 metres, but at significantly higher operational cost.

For farms at greater distances from shore or in habitually rougher waters, the service operations vessel — the SOV — addresses the access problem differently. Rather than commuting from the mainland, an SOV accommodates its technicians onboard for rotation periods of typically four weeks on, four weeks off. Modern SOVs carry sixty to one hundred and twenty personnel, are equipped with motion-compensated walk-to-work gangways, carry a daughter craft for inner-array access, and can operate in significant wave heights up to 2.5 to 3.0 metres. The walk-to-work gangway extends hydraulically from the vessel's side to the turbine access platform, compensating for vessel motion and wave action to provide a stable, safe transfer path — a fundamentally different engineering approach to the CTV's bump-and-board method.

The first purpose-built SOV dedicated to offshore wind was the *Esvagt Froude*, christened in June 2015 at EnBW's Baltic 2 wind farm in the German Baltic — forty-three kilometres from the Baltic Sea coast of Mecklenburg-Vorpommern. The vessel, built at Havyard Ship Technology's yard in Norway on a Havyard 832 design, operated on a rotational crew basis from day one. That the first dedicated SOV appeared in the same Baltic Sea where the first offshore wind farm had been built twenty-four years earlier — and that in those twenty-four years the access technology had progressed from improvised barges to a purpose-designed fifty-metre vessel with a motion-compensated gangway — is an accurate summary of how rapidly offshore O&M matured once the industry grew large enough to support purpose-built infrastructure.[^1]

The access rate — the fraction of working days on which vessel access is practically achievable — is a foundational parameter for any offshore O&M budget. It is defined by the local wave climate, the seasonal distribution of wave heights, and the operational limit of the access vessel:

$$
A_{\text{access}} = P(H_s \leq H_{\text{lim}}) = 1 - \exp\!\left(-\left(\frac{H_{\text{lim}}}{\lambda}\right)^k\right)
$$

where:
- $H_{\text{lim}}$ = vessel access wave height limit [m]
- $\lambda$ = Weibull scale parameter of the local $H_s$ distribution [m]
- $k$ = Weibull shape parameter of the local $H_s$ distribution [dimensionless]

For a southern Baltic site with $\lambda = 1.05$ m and $k = 1.45$ (characteristically gentler than the northern North Sea), a CTV with $H_{\text{lim}} = 1.5$ m achieves an annual access rate of approximately 73%. Seasonally, this breaks into roughly 85% accessibility from May through August and 58% from November through February. The asymmetry — the months with the highest wind energy production have the lowest access rate — is the central challenge of offshore O&M scheduling, and it shapes every decision Erik Svensson makes on a laminated sheet with a blue ballpoint pen.

> **Standard reference:** DNV-RP-0573:2021, "Subsea cables and pipelines — Access and maintenance in the offshore environment" — Chapter 4 (vessel access operability and sea state criteria). [^2]

<!-- IMAGE: fig-43-1 -->
> **Figure 43.1** — CTV Access Operability vs Significant Wave Height
> **Type:** Line chart with seasonal breakdown
> **Content:** Three curves: annual average, summer (May–Aug), winter (Nov–Feb). X-axis Hs 0–3.0 m; Y-axis cumulative access probability 0–100%. Vertical dashed lines at 1.5 m (CTV limit) and 2.5 m (SOV limit). Baltic Sea site parameters.
> **Caption:** For a southern Baltic site, a standard CTV (1.5 m Hs limit) achieves 73% annual access; an SOV (2.5 m limit) achieves 92%. The seasonal gap — summer exceeds winter access rate by 27 percentage points — drives the PM scheduling logic.
> **Alt text:** Cumulative wave height probability curves for annual, summer, and winter conditions at a Baltic offshore wind site, with CTV and SOV operational limits marked.
> **Data source:** Weibull distribution fit to ERA5 Baltic Sea wave height data
> **Resolution:** 1200 × 700 px
> **Color notes:** Annual average: dark blue; summer: amber; winter: steel grey. Limit lines: dashed red.

---

## 43.2 The Maintenance Hierarchy

Offshore wind maintenance is classified into three categories, each with different drivers, different resource requirements, and different relationships with weather:

**Preventive Maintenance** (PM) is time-based and planned: at a fixed interval — typically annually for offshore turbines, with minor six-monthly visits for some components — every turbine receives a scheduled inspection and service visit. The scope of the annual PM visit for a modern 12–15 MW offshore turbine includes visual inspection of all drive train components, blade inspection (leading edge, trailing edge, lightning receptor bonding), lubrication of main bearing, gearbox oil sampling and analysis, hydraulic system pressure check, torque verification on structural bolts, software updates, and functional testing of safety systems. The labour requirement is approximately sixty to eighty person-hours per turbine for a full annual visit, plus travel and waiting time. For a thirty-four turbine farm, that is between 2,040 and 2,720 person-hours of planned maintenance per year — the equivalent of one to two full-time technicians working every day of the year for that single purpose alone.

**Corrective Maintenance** (CM) is response-based: a component has failed, performance has degraded beyond threshold, or an alarm has been generated. Corrective maintenance ranges from a ten-minute remote reset of a soft-faulted converter to a four-week crane vessel campaign for a main bearing replacement. The mean time to repair depends on what has failed and, crucially, on weather. A pitch motor replacement in a nadir summer window might take six hours. The same job in the middle of winter, with a five-day series of restricted-access days, might take three weeks.

**Condition-Based Maintenance** (CBM) is the third category and the most recent in offshore wind practice. Rather than waiting for a scheduled visit (PM) or a failure (CM), CBM uses continuous monitoring — vibration signatures from accelerometers on bearings and the gearbox, temperature trends from oil and winding sensors, SCADA torque and rpm data, periodic oil sample analysis — to identify degradation before it becomes failure. The benefit of CBM is not just that it prevents failures; it is that it converts what would have been unplanned corrective maintenance into planned preventive maintenance. A bearing that the SCADA trending identifies as running two degrees above baseline temperature four months before it fails can have its replacement scheduled for the next summer window, at a time of low wind and high access probability, with a replacement part already procured and waiting. The same bearing, failing unexpectedly in January during a twelve-metre-per-second wind week, requires emergency access, emergency parts procurement, and replacement during a weather window that may not appear for two weeks.

The reliability profile of an offshore wind turbine over its design life follows a pattern well known to reliability engineers: the bathtub curve. The early operating period — roughly the first twelve to twenty-four months — sees elevated failure rates as manufacturing defects manifest under operational load, software configurations are tuned to site conditions, and installation imperfections become apparent. This infant failure period was particularly pronounced in the first generation of offshore turbines; with improved manufacturing quality and pre-commissioning testing (the FAT and SAT process described in Chapter 38), early failure rates have declined substantially for modern platforms. The useful life period — the long central section of the bathtub — is characterised by roughly constant, low failure rates: stochastic failures caused by operational stress, environmental exposure, and the accumulated effect of cyclic loading. For modern offshore turbines, this period averages approximately 1.5 unplanned failure incidents per turbine per year for the full system, though this figure varies significantly by drivetrain type, maintenance strategy, and site conditions. The wear-out period begins, for current offshore platforms, after approximately twenty years as fatigue-life margins close and component degradation accelerates.

IEC 61400-26-1:2019 defines the official taxonomy of turbine operating states for the purpose of availability reporting. The standard, which replaced three separate technical specifications (IEC TS 61400-26-1:2011, IEC TS 61400-26-2:2014, and IEC TS 61400-26-3:2016) with a unified information model, classifies any turbine at any instant into one of eight primary states: Available (producing, standby, or start-up), External Conditions (curtailed or stopped due to weather, grid, or operator instruction), Scheduled Maintenance, Unscheduled Maintenance, Forced Outage (technical failure, component unavailable), Technical Standby, Information Unavailable, and Out of Scope. The precision of this taxonomy matters because how time is classified determines what availability figures mean, and availability figures determine whether an O&M contract is performing as agreed.[^3]

---

## 43.3 Availability: What the Numbers Mean

Availability is the most-quoted performance metric in offshore O&M. It is also the most frequently misunderstood, because there are at least two distinct things "availability" can mean, they differ materially in value, and contract documents are sometimes ambiguous about which one is being measured.

**Time-Based Availability** (TBA) measures the fraction of calendar time in which the turbine is in a state where it is able to produce electricity — excluding time lost to forced outages (technical failures), but typically including or excluding scheduled maintenance depending on the contract. Its formula is:

$$
\text{TBA} = \frac{T_{\text{cal}} - T_{\text{FO}}}{T_{\text{cal}}} \times 100\%
$$

where:
- $T_{\text{cal}}$ = calendar time in the measurement period [h]
- $T_{\text{FO}}$ = time in forced outage (unplanned technical unavailability) [h]

TBA measures engineering performance: the fraction of time the mechanical and electrical systems were functional. It says nothing about how much energy was lost or how much revenue was affected. A turbine that spends twelve hours in forced outage during a period of calm weather, when it would have produced only fifteen percent of rated power, costs the project almost nothing. A turbine that spends the same twelve hours in forced outage during a rated-wind gale costs twelve hours at full rated output.

**Production-Based Availability** (PBA), also called energy-based availability, corrects for this by weighting the unavailability by the energy that would have been produced:

$$
\text{PBA} = \frac{E_{\text{actual}} + E_{\text{sched}}}{E_{\text{actual}} + E_{\text{sched}} + E_{\text{forced}}} \times 100\%
$$

where:
- $E_{\text{actual}}$ = energy actually produced in the period [MWh]
- $E_{\text{sched}}$ = energy lost to scheduled (planned) maintenance [MWh]
- $E_{\text{forced}}$ = energy lost to forced outages (unplanned failures) [MWh]

The denominator is the energy the farm would have produced at 100% technical availability, given the actual wind conditions of the period. PBA tells you the financial story: what fraction of achievable energy did the farm actually deliver?

TBA and PBA diverge when failures correlate with high-wind conditions — which they do. Gearboxes fail under high torque; main bearings fail under high load; pitch systems fault in high-turbulence conditions. The same mechanical systems that see the most stress in high wind are the systems whose failure costs the most energy per outage-hour. In practice, an offshore farm with TBA = 97.5% might have PBA = 96.8%, because the failures that consumed the missing 2.5% of time were disproportionately concentrated in high-production periods.

The economic consequence of this gap is not abstract. For a 510 MW farm at a 52% capacity factor and an electricity price of EUR 45 per MWh, one percentage point of annual PBA is worth approximately EUR 1.04 million per year. The gap between what TBA suggests you are losing and what PBA confirms you are actually losing is the financial argument for CBM: if you can schedule major maintenance actions during low-wind summer windows rather than responding to failures during high-wind winter peaks, you narrow the TBA-PBA gap and recover that revenue.

<!-- IMAGE: fig-43-2 -->
> **Figure 43.2** — TBA vs PBA Divergence: Monthly Wind Speed and Failure Timing
> **Type:** Dual-axis bar and scatter chart
> **Content:** Left axis (bars): average monthly wind speed, m/s. Right axis (scatter): energy cost per forced outage event, EUR × 1,000. Shows high-energy-cost failures clustering in winter months (Dec–Feb) and low-cost events spread more uniformly. TBA and PBA values for each month annotated.
> **Caption:** Failures that occur in high-wind months cost four to six times more energy per outage-hour than failures in calm summer months. A farm with 97.9% TBA may have only 96.7% PBA if its major failures correlate with peak production periods.
> **Alt text:** Monthly chart showing wind speed bars and energy cost of forced outages as scatter points, demonstrating winter clustering of high-cost failure events.
> **Data source:** Author illustration based on European offshore wind IEC 61400-26 reporting data
> **Resolution:** 1400 × 700 px
> **Color notes:** Wind speed bars: pale blue. High-cost failures: red circles. Low-cost failures: grey circles.

---

## 43.4 The Spare Parts Problem

There are components in an offshore wind turbine that, if they fail, will keep the turbine stopped for longer than any consideration of maintenance strategy can prevent. The governing constraint is not access. It is lead time.

A main bearing for a 15 MW offshore turbine — a precision-machined spherical roller bearing roughly the diameter of a dining table, weighing several tonnes — has a typical delivery lead time from the manufacturer of twelve to eighteen months after a confirmed order. A full gearbox replacement, including the crane vessel campaign to swap it, runs eighteen to twenty-four months from failure diagnosis to turbine back in service. A converter module for a Type 4 full-power converter is faster, at six to eight weeks for most platforms, but still requires pre-procurement to avoid extending a forced outage through a supply chain delay.

The spare parts strategy for an offshore project is, therefore, a problem in inventory optimisation under uncertainty. The categories are:

**Consumable spares** (filters, seals, greases, minor electrical components): low unit cost, fast delivery, kept in moderate quantities at the O&M base or on the SOV. Procurement is routine and demand is predictable from PM frequency.

**Routine capital spares** (pitch motors, yaw motors, converter power modules, transformer tap changers): moderate cost, three to twelve week delivery, stocked individually or in small quantities at the O&M base. The stocking level is set by the expected annual failure rate multiplied by the average time-to-availability penalty if the part is not on hand.

**Critical capital spares** (main bearing, main shaft, gearbox for geared platforms): high cost, twelve to twenty-four month delivery, typically shared across a portfolio of projects under an insurance spare arrangement. A developer operating three or four projects will maintain one or two main bearings at a central European warehouse, available to any project in the portfolio on a priority-access basis. The carrying cost of a single spare main bearing — the purchase price plus storage, insurance, and the opportunity cost of the capital — is weighed against the expected cost of a one-year turbine outage at full revenue loss.

The rule of thumb that experienced O&M managers use, without exception, is: *order the critical spare before you need it.* A CBM alert showing bearing degradation is not a crisis. It is an eighteen-month window. A bearing that fails without a replacement on order converts that window into a crane vessel campaign that finishes sixteen months after the failure and costs, for a 510 MW project, approximately EUR 5 to 8 million per affected turbine in lost production alone.

---

## 43.5 Weather Windows and the Economics of Access

The most expensive hours in offshore O&M are not the hours during which a turbine is broken. They are the hours during which a turbine is broken and the sea will not allow anyone to fix it.

This distinction has a name: the waiting-on-weather (WOW) component of corrective maintenance logistic time. WOW is not a fixed overhead; it is a function of the season, the vessel type, and the duration of access required. In the North Sea and Baltic, the average WOW component for corrective maintenance involving CTV access is estimated at thirty to forty percent of total logistics time in winter months and twelve to eighteen percent in summer months. For jobs requiring SOV or crane vessel access, WOW at a 2.5 m Hs limit is considerably lower, but the day-rate cost of the vessel is considerably higher.

The operational consequence of this structure is the scheduling logic that underlies Erik Svensson's laminated weekly schedule:

*Plan preventive maintenance in summer.* The access probability for a standard CTV is approximately 85% from May through August in the southern Baltic. Wind speeds are lower. Lost production per PM-visit hour is minimised. The technician who spends six hours on T19's annual inspection in July costs approximately EUR 1,800 in lost production (at 6.2 m/s average wind, approximately 5 MW turbine output, six hours). The same PM visit forced into January — either because the July window was missed or because the work could not be completed in summer — costs EUR 8,100 (at 10.8 m/s average wind, approximately 13.5 MW output, six hours). The economic differential is 4.5 to 1 in favour of summer scheduling, before any WOW penalty is applied.

*Use ensemble forecast data to select the optimal 72-hour window.* The probability that a three-day access window — three consecutive days with Hs below 1.5 metres — will occur in any given summer week in the southern Baltic is approximately 58%. In any given winter week, it is 23%. The ensemble wind and wave forecast from the farm's operational forecasting system (described in Chapter 37) provides a P10/P90 wave height envelope at 72-hour resolution. A job requiring two days of CTV access can be scheduled when the P10 of the daily Hs forecast falls below the vessel limit — a more conservative criterion than using the P50 alone, chosen to reduce the probability that the crew arrives on site and cannot board.

*Separate work scope by vessel type.* CTV-accessible work (anything that can be done by technicians boarding from a catamaran in under 1.5 metres) and SOV-accessible work (larger component work, extended crane campaigns) are planned separately. Mixing them forces a single weather criterion on work with different access requirements, either over-constraining the CTV work or under-constraining the SOV campaign.

The probability that a sustained access window of $n$ consecutive days will occur within a scheduling horizon of $T$ days, given a daily access probability $p$, follows a geometric distribution argument:

$$
P(\text{window}_n \text{ occurs within } T \text{ days}) = 1 - \left(1 - p^n\right)^{\lfloor T/n \rfloor}
$$

where:
- $p$ = daily access probability = $P(H_s \leq H_{\text{lim}})$ [dimensionless]
- $n$ = minimum window duration required [days]
- $T$ = scheduling horizon [days]

For $p = 0.58$ in summer (CTV, Hs ≤ 1.5 m), $n = 2$ days, and $T = 14$ days, the probability of finding a suitable two-day window within a two-week planning horizon is approximately 0.89 — good enough to support firm crew mobilisation. For the same conditions in winter ($p = 0.38$), the probability falls to 0.64 — acceptable for planning but requiring a contingency option.

<!-- IMAGE: fig-43-3 -->
> **Figure 43.3** — Seasonal Access Calendar: CTV and SOV Access Days Per Month
> **Type:** Stacked horizontal bar chart by month
> **Content:** Twelve months, two bars each (CTV access days in blue, SOV access days extending in green). X-axis: days per month (0–31). Winter months visibly shorter CTV bar, summer months longer. O&M cost overlay (secondary axis) showing optimal PM window in June–August.
> **Caption:** The southern Baltic CTV access calendar for a representative year. Summer months average 22–24 accessible days; winter months average 16–18. The optimal annual PM window — lowest wind resource, highest access probability — runs from June through August.
> **Alt text:** Monthly horizontal bar chart showing CTV and SOV accessible days per month, with summer months clearly showing higher access rates than winter months.
> **Data source:** ERA5 Baltic wave climate data; CTV limit 1.5 m Hs; SOV limit 2.5 m Hs
> **Resolution:** 1200 × 700 px
> **Color notes:** CTV bars: steel blue; SOV extension: teal green; shaded optimal PM window: light amber.

---

## 43.6 Worked Example: Year 1 Availability Analysis

At the end of the first full operating year, the operations team extracted the IEC 61400-26-1 event log from the SCADA historian for all 34 turbines. The calendar period covered was 8,760 hours (one full year). The analysis presented here uses a simplified two-metric approach — TBA (forced outage only) and PBA (energy-weighted) — to illustrate the divergence between time-based and production-based performance.

**Input data from the SCADA event log:**

| Incident | Duration [h] | Avg wind speed [m/s] | Avg turbine power [MW] | Energy lost [MWh] |
|----------|-------------|---------------------|----------------------|-------------------|
| T17 main bearing temperature — forced outage, winter week 21 | 312 | 11.8 | 15.0 (rated) | 4,680 |
| T09 pitch controller fault — forced outage, spring week 14 | 186 | 7.1 | 5.6 | 1,042 |
| T22 converter module replacement — summer week 31 | 144 | 6.8 | 4.9 | 706 |
| Minor events (34 turbines, various seasons) | 3,372 | 8.2 | 7.4 | 24,953 |
| **Total forced outage** | **4,014** | — | — | **31,381** |
| Scheduled maintenance (PMs, weather delays) | 2,040 | 6.4 | 4.3 | 8,772 |

**Calendar hours available:**

$$
T_{\text{cal}} = 34 \times 8{,}760 = 297{,}840 \text{ turbine-hours}
$$

**Time-Based Availability (forced outage only):**

$$
\text{TBA} = \frac{297{,}840 - 4{,}014}{297{,}840} \times 100\% = 98.65\%
$$

**Time-Based Availability (including scheduled maintenance):**

$$
\text{TBA}_{\text{total}} = \frac{297{,}840 - 4{,}014 - 2{,}040}{297{,}840} \times 100\% = 97.97\%
$$

**Production-Based Availability:**

The total theoretical AEP at 100% availability, given the actual wind conditions measured in Year 1, was 2,346 GWh (a modestly above-P50 wind year). Actual production was:

$$
E_{\text{actual}} = 2{,}346{,}000 - 31{,}381 - 8{,}772 = 2{,}305{,}847 \text{ MWh} \approx 2{,}306 \text{ GWh}
$$

$$
\text{PBA} = \frac{2{,}306 + 8.77}{2{,}306 + 8.77 + 31.38} \times 100\% = \frac{2{,}314.8}{2{,}346.2} \times 100\% = 98.66\%
$$

The TBA forced-only and PBA are, in this first year, almost identical at 98.65% and 98.66% respectively. The gap is negligible — meaning that the Year 1 forced outage events were distributed across wind conditions in roughly the same proportion as the overall wind distribution. This is an unusually clean result.

**What is not clean is the per-event cost.**

T17's 312-hour forced outage in winter week 21 cost 4,680 MWh — EUR 210,600 at EUR 45/MWh. T09's 186-hour forced outage in spring week 14 cost 1,042 MWh — EUR 46,890. T17 was down for only 68% more hours than T09, but it cost 4.5 times more energy and revenue. The reason: T17 failed at rated wind conditions; T09 failed at below-rated conditions.

Now consider the CBM counterfactual. T17's main bearing had been showing a slow temperature rise for eleven weeks before the forced outage (identified in Chapter 45). If the bearing had been replaced during a planned summer window — sixty to seventy-two hours of turbine downtime, at the June average wind speed of 6.1 m/s and a turbine output of approximately 4.7 MW:

$$
E_{\text{planned replacement}} = 72 \text{ h} \times 4.7 \text{ MW} = 338 \text{ MWh} = \text{EUR } 15{,}210
$$

The forced replacement in winter cost EUR 210,600. The planned replacement in summer would have cost EUR 15,210. The bearing itself, procured on a 14-week lead time following the CBM alert, costs approximately EUR 185,000 installed. The total planned maintenance scenario: EUR 200,210. The total forced maintenance scenario: EUR 210,600 plus emergency procurement premium plus crane vessel campaign costs if accessible in winter — potentially EUR 350,000 to EUR 500,000 for a full emergency bearing replacement.

The financial argument for CBM is: EUR 210,600 forced cost in winter versus EUR 15,210 planned cost in summer — a EUR 195,390 saving per major bearing event, before emergency premium costs are considered. For a thirty-four turbine farm with an expected bearing replacement rate of perhaps one per three years, this is a EUR 65,000 per year expected annual savings from CBM scheduling alone, before any reduction in emergency crane vessel costs is applied.

The Year 1 O&M cost for the project was EUR 12.3 million: EUR 8.4 million in scheduled maintenance (vessel contracts, labour, spare parts, logistics) and EUR 3.9 million in corrective maintenance. Cost per MWh produced: EUR 12.3M / 2,306 GWh = EUR 5.33 per MWh. This compares to a benchmark range of EUR 4.50 to EUR 7.00 per MWh for mature offshore projects with well-managed O&M programmes.

---

## Key Takeaways

- **Offshore O&M is governed by the access problem, not the maintenance problem.** Every maintenance action must fit within a weather window that the sea grants on its own schedule. The O&M manager's primary skill is not technical diagnosis — it is the optimisation of a limited resource (accessible vessel time) against a competing set of demands (preventive and corrective maintenance).

- **Time-based availability and production-based availability tell different stories.** TBA measures uptime hours; PBA measures uptime weighted by the energy that would have been produced. Because failures correlate with high-load (high-wind) conditions, PBA is typically lower than TBA. The financial performance of an O&M programme should be evaluated against PBA, not TBA.

- **CBM converts unplanned corrective maintenance into planned preventive maintenance, and planned events in summer are four to five times cheaper per lost-production-hour than emergency events in winter.** The economic case for continuous monitoring is not about preventing failures — it is about controlling when they are addressed and at what wind speed the turbine is stopped to address them.

- **Critical spare lead times can exceed turbine warranties.** A main bearing or gearbox replacement ordered after failure adds twelve to twenty-four months to the forced outage duration. The decision to carry a critical spare is made during project development, not during the forced outage — at which point it is already too late. Spare parts strategy is a risk management decision, priced against the expected cost of extended downtime.

- **The first purpose-built Service Operations Vessel appeared twenty-four years after the first offshore wind farm.** The technology evolution from improvised barges (Vindeby, 1991) to helicopter access (Horns Rev I, 2002) to purpose-built CTVs (from 2003) to DP2 SOVs with motion-compensated gangways (from 2015) illustrates both how rapidly the offshore wind industry matured and how consequential the access problem was to every stage of that maturation.

---

## For Further Reading

- **Carroll, J., McDonald, A., & McMillan, D. (2016).** "Failure rate, repair time and unscheduled O&M cost analysis of offshore wind turbines." *Wind Energy*, 19(6), pp. 1107–1119. DOI: 10.1002/we.1887. The study of 350 onshore and offshore turbines from 2006 to 2010, analysing 1,712 failures and producing the most-cited offshore wind failure rate database in the open literature. Key findings: offshore turbines show higher failure rates than onshore equivalents (primarily due to access and marine environment effects), but repair times are longer for offshore events even when access is available. Generator, power converter, and rotor (blades and pitch system) are the top three subsystems by failure-related downtime. The paper's distinction between failure rate (frequency of faults per turbine per year) and repair time (hours per fault) explains why the same failure rate can produce different availability outcomes depending on access conditions.

- **IEC 61400-26-1:2019.** *Wind energy generation systems — Part 26-1: Information model for availability for wind energy generation systems.* International Electrotechnical Commission, Geneva. The consolidated availability standard that unified three earlier technical specifications (IEC TS 61400-26-1:2011, IEC TS 61400-26-2:2014, and IEC TS 61400-26-3:2016) into a single information model. Defines eight primary operating states, the derivation of time-based availability, and the derivation of production-based availability from the unified state model. Annex A provides normative guidance on state assignment for ambiguous situations (grid curtailment, communication outage, combined weather and fault conditions). Essential reading for any O&M engineer responsible for availability reporting under a commercial O&M contract.

- **Dinwoodie, I., Endrerud, O.-E., Hofmann, M., Martin, R., & Sperstad, I. B. (2015).** "Reference cases for verification of operation and maintenance simulation models for offshore wind farms." *Wind Engineering*, 39(1), pp. 1–14. DOI: 10.1260/0309-524X.39.1.1. The first published reference data set specifically designed to allow O&M simulation models to be compared against known input conditions and outputs. Describes the three reference cases (shallow near-shore, moderate-depth mid-distance, and deep far-shore) used for benchmarking in the IEA Wind Task 26 O&M modelling community. Tables of failure rates, repair times, vessel day-rates, and weather climate parameters are provided for all three reference cases, making this the de facto baseline for O&M model validation studies.

---

*The week ended on a Friday at 16:00 with the CTV back in the harbour, all port-side pitch controller replacements done, and the revised maintenance schedule for the following week already annotated on the laminate.*

*Erik set it down on the desk and turned to the performance report — a single A4 sheet that Kaan had printed from the historian: thirty-four turbines, fifty-two weeks, availability and production numbers aggregated and broken down by turbine and by month.*

*Year 1. TBA: 97.97%. PBA: 98.66%. Total production: 2,306 GWh. O&M cost: EUR 12.3 million. Cost per MWh: EUR 5.33.*

*"Within budget," Erik said. He ran a finger down the monthly production column. He stopped at December, where the winter wind had driven a strong above-P50 result. He stopped at January, where T17's bearing had cost three hundred hours and EUR 210,600. "Within budget," he said again, in a different tone — the tone of a man who knows what 'within budget' is hiding.*

*He handed the sheet to Kaan. "This tells you what the machine produced. What it doesn't tell you is whether what it produced was worth what it cost, or whether what it cost was the right amount to spend, or whether the numbers in this report are good enough to justify the EUR 1.5 billion that went into the ground and the water and the cables and the buildings." He picked up the report, folded it once, and handed it back. "Helena Voss is coming next week. She'll tell you that part."*

*Kaan folded the sheet and put it in his jacket pocket. He had last seen Helena Voss's face on a video screen in the SOV conference room, twenty months earlier, making the P90 sound like a physical law. He had understood it mathematically then. He was beginning to understand it operationally now — as the gap between what 97.97% meant in hours and what it meant in euros.*

*Outside the OSS control room window, turbine number T17 was turning. Its bearing temperature had been nominal for eleven weeks — since the emergency replacement in January, the oil analysis came back clean. It was producing at rated power, 15.0 MW, in a fresh northeast wind.*

*Kaan watched it for a moment. Then he looked back at the desk, and at the next week's laminated schedule, and at the wave forecast already loading on his second monitor.*

*Six months had taught him what the rhythm was. The next twelve would teach him what it cost.*

---

## Notes

[^1]: Esvagt A/S and Siemens Wind Power. (2015). "Siemens and Esvagt christen wind industry's first offshore Service Operation Vessels." Press release, 23 June 2015. The *Esvagt Froude* was the lead vessel of a pair (sister vessel: *Esvagt Dana*), both built at Havyard Ship Technology's yard in Leirvik, Norway on a Havyard 832 WP design. The christening took place at the Baltic 2 offshore wind farm site, 45 km from the coast of Mecklenburg-Vorpommern, Germany. Baltic 2 is a 288 MW project (80 × Siemens SWT-3.6-120 turbines), commissioned 2014–2015. The deployment of a purpose-built live-aboard SOV to a Baltic Sea project — the same sea basin as the first offshore wind farm (Vindeby, 1991) — connects the full twenty-four-year arc of offshore access technology development. Vindeby is documented in: Sørensen, H. C., Larsen, J. H. M., Olsen, F., Svenson, J., & Hansen, S. R. (2002). "Middelgrunden 40 MW offshore wind farm Denmark — Lessons learned." *EWEA Conference Proceedings*, Paris. The Horns Rev I helicopter access method is documented in: Vattenfall A/S. (2003). "Horns Rev Offshore Wind Farm: Operating Experience." Technical report to DONG Energy, Copenhagen. Helicopter access was the operational standard from commissioning in 2002 until dedicated CTVs became available for the site in the 2004–2005 period.

[^2]: DNV-RP-0573:2021. *Personnel Transfer at Sea.* DNV, Oslo. Provides recommended practice for risk assessment, weather criteria, and vessel selection for personnel transfer operations in offshore environments. Chapter 4 covers operability criteria for different vessel and transfer types, including the significant wave height limits for CTV catamaran, motion-compensated gangway, and helicopter operations. The CTV limit of 1.5 m Hs applies to standard catamaran configurations with a bow-bumping personnel transfer method. The 2.0 m limit for specialist vessels with enhanced hull forms is noted in Chapter 4.3. Companion document: DNV-ST-0083:2020, *Transport and Installation of Wind Turbines.*

[^3]: IEC 61400-26-1:2019. *Wind energy generation systems — Part 26-1: Information model for availability for wind energy generation systems.* International Electrotechnical Commission, Geneva. Edition 1.0, May 2019. This edition replaced three predecessor technical specifications: IEC TS 61400-26-1:2011 (time-based availability for wind turbines), IEC TS 61400-26-2:2014 (production-based availability for wind turbines), and IEC TS 61400-26-3:2016 (availability for wind power plants). The eight primary operating states are defined in Clause 5.3.2, Table 2. The derivation of TBA and PBA from the unified information model is in Clause 7.2 (time-based indicators) and Clause 7.3 (production-based indicators). Annex A (normative) provides state assignment guidance for ambiguous operational situations including partial curtailment, communication loss, and combined weather-fault conditions. The standard is referenced in IEC TS 61400-26-4:2024 (portfolio-level availability reporting), which extends the information model to wind power plant fleet management.

[^4]: Carroll, J., McDonald, A., & McMillan, D. (2016). "Failure rate, repair time and unscheduled O&M cost analysis of offshore wind turbines." *Wind Energy*, 19(6), pp. 1107–1119. DOI: 10.1002/we.1887. The study covered 350 turbines (onshore and offshore) from 2006 to 2010, recording 1,712 failure events across eleven subsystems. Key results: offshore turbine failure rate approximately 7.1 failures per turbine per year (versus 6.3 for comparable onshore turbines), with the offshore increment attributable primarily to generator and power converter events. Repair time per failure: offshore average 76 hours versus onshore average 51 hours, reflecting access and logistics delays. The paper introduced the three-parameter Weibull–Weibull mixture model for failure-time distribution fitting that has since become standard in O&M simulation research. Note on data vintage: the 2006–2010 dataset reflects first- and second-generation offshore turbine platforms (primarily 2–3.6 MW range); modern 12–15 MW platforms have substantially different drivetrain architectures, different gearbox designs, and direct-drive options that alter the failure mode distribution. Failure rates for modern platforms are proprietary and not in open literature as of 2025.

[^5]: Dinwoodie, I., Endrerud, O.-E., Hofmann, M., Martin, R., & Sperstad, I. B. (2015). "Reference cases for verification of operation and maintenance simulation models for offshore wind farms." *Wind Engineering*, 39(1), pp. 1–14. DOI: 10.1260/0309-524X.39.1.1. IEA Wind Task 26 reference dataset for O&M model benchmarking. Three reference cases defined: Case A (near-shore, 15 km, 7 m depth, 10 turbines × 2 MW), Case B (moderate, 30 km, 20 m depth, 20 turbines × 5 MW), Case C (far-shore, 100 km, 40 m depth, 80 turbines × 5 MW). Vessel types, day-rates, and access criteria for each case provided in Tables 2–4. Weather climate parameterisation (Weibull Hs distributions) for three representative European sites provided in Table 5. The reference dataset enabled the first systematic cross-comparison of the OMCE-HAMMER, ECUME, OffshoreWind LCOE, and ECN O&M Tool models, establishing the benchmarking methodology used in subsequent IEA Wind Task 26 and Task 45 studies.

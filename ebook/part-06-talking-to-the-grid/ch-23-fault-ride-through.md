# Chapter 23: Fault Ride-Through: Staying Connected When Everything Goes Wrong

*Kaan arrived at the control room at 07:30 to find Anders already there, a half-empty coffee mug beside the keyboard and the ANDES simulation loaded on both monitors. The left screen showed three time-domain traces: voltage in blue, reactive current in green, active power in red. All three were flat. The right screen showed a single-line diagram of the network — the 220 kV export bus, the 45-kilometre cable, the 66 kV collector ring, and the thirty-four turbine icons arranged in their staggered rows. A small red diamond sat on the 220 kV bus.*

*"We apply the fault there," Anders said without looking up. "A bolted three-phase-to-earth fault at the 220 kV connection point. The voltage drops to zero. For 140 milliseconds."*

*He paused. He had a habit of pausing before numbers, the way some people did before punch lines.*

*"Everything downstream — the converters, the STATCOM, the protection relays — has 140 milliseconds to decide what to do. The protection relay at the PSE substation has to detect, measure, compute, and trip the breaker. The STATCOM current controller has to determine that the voltage reference has gone away and switch to fault mode. The WTG converters — all thirty-four of them, simultaneously — have to recognise that injecting active power into an absent voltage is not possible, and redirect their current toward reactive support." He looked at the clock on the simulation toolbar. The timestamp read 0.000 seconds. "The breaker clears the fault. By 0.140 seconds, the voltage starts to recover. At 1.500 seconds, the farm must be producing power again."*

*Kaan opened his notebook. He had read NC RfG Articles 20 and 21 the previous evening. He had found them clear on requirements and silent on physics. "What happens to the turbines during those 140 milliseconds?" he said. "The blades don't stop."*

*"No," Anders said. "The blades don't stop. The generators don't stop. The rotors have the kinetic energy of ten freight trains each. The machine-side converters are still absorbing that mechanical power from the generators and pushing it into the DC bus — but the grid-side converters can't put it into a grid that isn't there." He clicked a button. The voltage trace on the left monitor dropped vertically to zero, remained there for exactly 140 milliseconds, then began to climb. "Watch the DC link."*

*A fourth trace appeared on the screen. Yellow. Rising.*

---

## 23.1 Why Staying Connected Changed Everything

For the first two decades of commercial wind power, the standard approach to grid faults was simple: disconnect. When the voltage at a wind turbine's terminals fell below a threshold — typically 0.85 pu or 0.80 pu, depending on the manufacturer — the turbine tripped its main breaker and coasted to a stop. The logic was defensive: a low-voltage condition might indicate an internal fault, feeding the fault with current would stress components, and the wind would return after the fault cleared. The turbines would ride out the event and reconnect when the coast was clear.

This approach made sense for a single 500 kW turbine on a rural distribution feeder in the 1990s. By the time Germany had installed more than 10,000 MW of wind across its northern states, it was a systemic liability.

The problem arrived in a report. In 2003, E.ON Netz — the high-voltage transmission subsidiary responsible for the German network where most of that wind was connected — completed a stability study with an uncomfortable conclusion: a single transmission fault, of the kind that occurred dozens of times per year in any large network, could trigger a simultaneous disconnection of several thousand megawatts of wind generation. The turbines were programmed to disconnect at undervoltage. A fault at a single node caused voltage depression across hundreds of kilometres of network. Every turbine in the region, following its individual protection logic, would disconnect. The net effect was a cascade: a 400 MW fault became a 4,000 MW fault in seconds.[1]

The September 23, 2003 blackout in southern Sweden and eastern Denmark made the risk scenario concrete. The immediate cause was the loss of the Oskarshamn Nuclear Power Plant Unit 3 — 1,175 MW dropped instantly — followed within minutes by a fault at the Ringhals substation that tripped two additional nuclear units. The system lost approximately 6,350 MW in under ten minutes and split into two asynchronous islands. Over four million people lost power for up to three hours.[2]

Wind turbines did not cause that blackout. The 2003 event was a nuclear and conventional failure. But the post-event analysis by Nordic TSOs, Svenska Kraftnät, and researchers at Chalmers University of Technology in Gothenburg asked a pointed question: what would happen when wind penetration in the Nordic system reached 10%, 20%, 30%? If the same sequence of faults occurred with 15,000 MW of wind in the network — all programmed to disconnect on undervoltage — the answer was unambiguous. The secondary generation deficit from simultaneous wind tripping would far exceed the primary fault, and the cascade would be larger and harder to arrest.[3]

E.ON Netz responded without waiting for a European consensus. In 2003, they published the *Ergänzungsregeln* — Supplementary Rules — to the existing German high-voltage grid code. For the first time anywhere in the world, a grid code required that wind turbines remain connected to the grid during a low-voltage event:

- Wind turbines must stay connected if voltage at the point of common coupling remains above a defined envelope
- Disconnection is forbidden if voltage stays above 15% of nominal
- Reactive current injection is required proportional to the voltage dip: 2% of rated current for each 1% of voltage deviation, up to 100% of rated current at the limit

The final item was the decisive innovation. E.ON Netz was not merely asking turbines to stay connected passively. They were requiring turbines to actively support the network voltage during the fault — injecting reactive current as if they were a synchronous generator's excitation system responding to a terminal voltage drop. Turbines were being asked to behave like grid assets, not grid passengers.[1]

By 2016, when Commission Regulation (EU) 2016/631 made fault ride-through mandatory for all Type D generators across the EU, Germany had been operating with FRT requirements for thirteen years and had accumulated two complete generations of FRT-capable wind turbine technology. The physics had not changed. Only the regulatory territory had caught up.

<!-- IMAGE: fig-23-01 -->
> **Figure 23.1** — The case for FRT: simultaneous tripping cascade versus FRT-enabled response
> **Type:** two-panel time series chart
> **Content:** Left panel: "Pre-FRT scenario." Time axis 0–5 s. Upper trace: 220 kV bus voltage — falls to 0 at t=0, recovers to 1.0 pu at t=0.5 s. Lower trace: farm active power output — drops from 500 MW to 0 MW at t=0.14 s (turbines trip at fault clearance) and remains at zero. Right panel: "FRT scenario." Same voltage trace. Lower trace: farm active power — falls to 0 MW during fault (0–0.14 s), recovers to 450 MW by t=1.14 s, returns to 500 MW by t=3 s. Reactive power injected during 0–1.5 s shown as separate green trace (positive, reactive injection). Both panels annotated with "fault applied," "fault cleared," "voltage recovery."
> **Caption:** Comparison of wind farm active power response during a 220 kV three-phase fault: pre-FRT scenario (turbines trip at fault clearance, permanent loss of 500 MW) versus FRT-capable scenario (turbines ride through, active power recovers within 1.5 s). The FRT requirement transforms a 500 MW secondary deficit into a manageable transient.
> **Alt text:** Two-panel chart showing wind farm active power dropping to zero and remaining there in the pre-FRT scenario, versus recovering to full output within 1.5 seconds in the FRT-capable scenario.
> **Data source:** Author illustration; NC RfG Article 20; E.ON Netz Ergänzungsregeln (2003)
> **Resolution:** 1600 × 800 px minimum
> **Color notes:** Voltage in blue; active power in red; reactive power in green; fault period shaded light red.

---

## 23.2 The LVRT Envelope

The Low Voltage Ride-Through envelope is a contract written in coordinates. It defines the minimum voltage-versus-time boundary below which a generator may disconnect; above that boundary, it must stay connected and perform. The shape of the envelope — which engineers call the "bathtub curve" — communicates the TSO's model of what a realistic fault looks like and how fast the network can recover it.

NC RfG Article 20 establishes the framework: each TSO publishes its own LVRT profile for each connection voltage level. The TSO's profile is national prerogative — the regulation mandates that a profile must exist and must be complied with, but the exact coordinates are not harmonised at EU level.[4] The ENTSO-E reference profile — used as the basis for most European grid codes — takes the following form:

$$V_{LVRT}(t) = \begin{cases} V_{min} & 0 \leq t \leq t_{clear} \\[4pt] V_{min} + \dfrac{V_{rec1} - V_{min}}{t_{rec1} - t_{clear}} \cdot (t - t_{clear}) & t_{clear} < t \leq t_{rec1} \\[4pt] V_{rec1} + \dfrac{V_{rec2} - V_{rec1}}{t_{rec2} - t_{rec1}} \cdot (t - t_{rec1}) & t_{rec1} < t \leq t_{rec2} \end{cases}$$

where:
- $V_{LVRT}(t)$ = minimum permissible voltage at the connection point [pu] — the farm must stay connected if actual voltage stays above this boundary
- $V_{min}$ = minimum voltage depth during the fault [pu] — for the PSE 220 kV profile, $V_{min} \approx 0.05$ pu (near-bolted fault condition)
- $t_{clear}$ = fault clearance time [s] — for PSE 220 kV, $t_{clear} = 0.140$ s (140 ms)
- $V_{rec1}$ = first recovery voltage target [pu] — for PSE 220 kV, $V_{rec1} = 0.85$ pu
- $t_{rec1}$ = time to reach first recovery target [s] — for PSE, $t_{rec1} = 1.500$ s (1,500 ms after fault inception)
- $V_{rec2}$ = second recovery voltage target [pu] — for PSE, $V_{rec2} = 0.90$ pu
- $t_{rec2}$ = time to reach full recovery [s] — for PSE, $t_{rec2} = 3.000$ s

Reading this profile in plain language: if a three-phase fault occurs at 220 kV, the voltage may fall to near-zero for up to 140 ms while the protection relay and circuit breaker clear the fault. After clearance, the voltage must recover above 0.85 pu within 1,500 ms of fault inception. The wind farm must remain connected and inject reactive current throughout this period.

The 140 ms clearance time for the 220 kV bus is a direct consequence of the protection grading discussed in Chapter 19. Busbar differential protection at PSE's onshore substation operates in approximately 20–30 ms. The 220 kV circuit breaker opens in 50–80 ms (two to three cycles of 50 Hz). Main protection clearance from fault inception: 70–110 ms. The 140 ms envelope adds margin for main protection failure — it assumes that the worst-case realistic clearance time at 220 kV, including a single failure of the primary protection system and backup relay operation, is 140 ms.[5] Above that time, the fault should never exist; below that time, the farm must ride through it.

> **Standard reference:** Commission Regulation (EU) 2016/631, Article 20 (fault ride-through capability for Type D power-generating modules). PSE IRiESP Section 7.4 contains the Polish LVRT profile for 220 kV wind farm connections. IEC 61400-21-1:2019 (*Wind energy generation systems — Part 21-1: Measurement and assessment of electrical characteristics — Wind turbines*, Edition 1.0, published May 2019) defines the standardised test procedure — rectangular voltage dips at defined depths and durations — used for type-testing FRT compliance.

<!-- IMAGE: fig-23-02 -->
> **Figure 23.2** — PSE LVRT envelope for 220 kV wind farm connections
> **Type:** voltage versus time chart (bathtub shape)
> **Content:** Horizontal axis: time t [s], −0.2 to 3.5 s. Vertical axis: voltage V [pu], 0 to 1.2. The LVRT boundary is a piecewise linear curve: V = 1.0 at t < 0 (pre-fault); drops vertically to V = 0.05 at t = 0 (fault applied); holds at V = 0.05 from t = 0 to t = 0.14 s (fault clearance period); rises linearly from V = 0.05 at t = 0.14 s to V = 0.85 at t = 1.5 s (first recovery segment); rises gently from V = 0.85 at t = 1.5 s to V = 0.90 at t = 3.0 s. Area below the LVRT boundary shaded red ("generator may disconnect"). Area above the boundary shaded green ("generator must remain connected"). Key coordinate points annotated: (0, 0.05), (0.14, 0.05), (1.5, 0.85), (3.0, 0.90). Dashed line at V = 0.90 labelled "continuous operating range." Horizontal label under red fault-period region: "140 ms — protection clearance window."
> **Caption:** PSE LVRT envelope for Type D wind farm connections at 220 kV (consistent with the ENTSO-E reference profile). The farm must remain connected and inject reactive current while voltage exceeds the boundary (green region). During the fault period (0 to 0.14 s), voltage may fall to 0.05 pu. Voltage must recover above 0.85 pu within 1.5 s of fault inception.
> **Alt text:** Bathtub-shaped voltage-time chart showing the minimum voltage boundary; above the boundary the farm must remain connected, below it may disconnect.
> **Data source:** PSE IRiESP Section 7.4; NC RfG Article 20
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Below-boundary region in light red; above-boundary region in light green; LVRT boundary line in black (bold); 140 ms clearance period labelled.

---

## 23.3 HVRT: The Other Direction

Low voltage gets most of the attention. High voltage is equally real.

When a nearby circuit is switched off — a feeder disconnects, or a line trip removes a parallel path — the voltage at adjacent busbars can spike upward. The reactive power that was flowing through the tripped circuit has nowhere to go; it piles into the remaining network and raises voltage. If the farm is generating near rated power, the voltage spike can reach 1.20–1.25 pu within a cycle of the switching event.

NC RfG Article 14 requires that Type D generators remain connected under High Voltage Ride-Through (HVRT) conditions: continuous operation up to 1.05 pu; short-duration operation up to 1.10 pu for a period specified by the TSO; and withstand up to 1.25 pu for at least 100 ms.[4] The 1.25 pu / 100 ms requirement is not a test of insulation endurance — the GIS, rated 245 kV and designed for 1,050 kV impulse withstand, handles 1.25 × 220 × √2 = 389 kV peak without difficulty. The challenge is the converter.

When the 220 kV bus rises to 1.25 pu, the grid-side converter attempts to absorb excess reactive energy from the elevated grid through its output inductors. The DC link voltage rises — not from generator power as during low-voltage, but from grid-side reverse current. The DC chopper fires. The mechanism is the same as for LVRT; the energy source is different. This is one reason the DC chopper is designed and tested for both directions of DC link overvoltage: a single protective device handles both the low-voltage fault (generator overfeeds DC link) and the high-voltage transient (grid feeds back into DC link through the GSC).

The HVRT test during commissioning is brief — a 100 ms overvoltage event applied at the point of common coupling via the PSE-approved test procedure. The farm must show that all thirty-four turbines and the STATCOM remain connected and resume normal operation when voltage returns to the continuous operating range.

---

## 23.4 Reactive Current Injection: The Grid's First Need

When a fault collapses the voltage at a bus, what the network needs is not active power — it needs reactive current. Active power requires a voltage reference to transfer energy; in a near-zero voltage condition, active power injection would produce only resistive losses. Reactive current, however, does not require active energy transfer. A converter can inject purely reactive current while its DC link voltage remains unchanged, acting as a controllable current source that stiffens the local network.

The physics is the same operating principle as the STATCOM from Chapter 20. A converter connected to a network through a small series inductance, operating at a slightly different internal AC voltage angle than the network, pushes reactive current into the system. During a fault, thirty-four turbines operating simultaneously in this mode have a measurable effect on the voltage at the 66 kV collector bus, even when the 220 kV bus is at near-zero volts.

NC RfG Article 21(3)(b) specifies the minimum reactive current injection requirement for Type D generators during a fault:

$$\Delta I_q = k \cdot \Delta V \cdot I_n$$

where:
- $\Delta I_q$ = increase in reactive current above the pre-fault value [A] — positive means inductive injection into the network, supporting voltage
- $k$ = reactive current injection gain [pu/pu] — NC RfG requires $k \geq 2$; PSE IRiESP specifies $k = 2$ for 220 kV connections
- $\Delta V = V_{pre} - V_{meas}$ = voltage deviation below the pre-fault value [pu] — positive when voltage has dropped
- $I_n$ = rated current of the generator at the connection point [A]

A deadband applies: for $\Delta V < 0.10$–$0.15$ pu, no additional reactive injection is required and the normal Q(V) droop mode continues. Above the deadband, the reactive injection ramps linearly at twice the voltage deviation rate.

For a 500 MW reference farm at 220 kV, rated current is $I_n = 500 \times 10^6 / (\sqrt{3} \times 220 \times 10^3) = 1{,}312$ A. If voltage drops from 1.00 pu to 0.05 pu during the fault, $\Delta V = 0.95$ pu, and the required reactive current injection is:

$$\Delta I_q = 2 \times 0.95 \times 1{,}312 = 2{,}493 \text{ A} = 1.90 \cdot I_n$$

This exceeds the converter's thermal current limit. NC RfG Article 21(4) specifies that when the required reactive injection would exceed the maximum current capability, the converter shall prioritise reactive current, reducing active current first. The total current constraint is:

$$I_{total} = \sqrt{I_d^2 + I_q^2} \leq I_{max}$$

where $I_d$ is the active (d-axis) current, $I_q$ is the reactive (q-axis) current, and $I_{max} = 1.0 \cdot I_n$ for the converter's continuous thermal limit (some manufacturers certify 1.05–1.10 pu for the fault transient). When the required $\Delta I_q$ drives $I_{total}$ above $I_{max}$, active current is reduced to zero and the converter's full capacity goes to reactive support:

$$I_q = I_{max} = 1{,}312 \text{ A} \quad , \quad I_d = 0 \text{ A}$$

This is the mechanism behind the active power dip during an FRT event. The converter does not lose active power because the voltage fell — it gives up active power voluntarily because its full current capacity is needed for reactive support. When voltage recovers above 0.85 pu and the required reactive injection drops below $I_{max}$, the headroom becomes available and active power recovery begins immediately.

The inner current control loop of the converter responds to the voltage dip within one or two sampling periods — at a 250-microsecond sample period, that is 500 microseconds from fault inception to full reactive injection. NC RfG Article 21 requires reactive response "within 5 seconds." The converter completes it in half a millisecond. The 5-second requirement was written for synchronous generators. For converter-interfaced machines, it is not a constraint but a comfortable margin of five orders of magnitude.

<!-- IMAGE: fig-23-03 -->
> **Figure 23.3** — Reactive current injection characteristic during fault (k = 2)
> **Type:** line chart with two vertical axes
> **Content:** Horizontal axis: voltage deviation ΔV [pu], 0 to 1.0 (left = small dip, right = deep fault). Left vertical axis: reactive current injection ΔIq [pu of In], 0 to 2.0. Right vertical axis: active current headroom Id [pu of In], 0 to 1.0 (inversely related). Main traces: ΔIq = 2·ΔV (blue solid line, rising from (0.15, 0) — deadband edge — to (0.50, 1.0), then capped at Imax = 1.0 pu for ΔV > 0.50). Id trace (red dashed): starts at 1.0 pu for ΔV < 0.15 (deadband, normal operation), then falls as √(Imax² − ΔIq²) for 0.15 < ΔV < 0.50, reaches 0 at ΔV = 0.50 and remains at 0 for ΔV > 0.50. Vertical dashed line at ΔV = 0.15 labelled "deadband threshold." Vertical dashed line at ΔV = 0.50 labelled "reactive current fully loads converter." Key annotations: "active current forced to zero for deep faults (ΔV > 0.5 pu)"; "all current to reactive support."
> **Caption:** Reactive current injection characteristic for a Type D wind turbine converter (k = 2, Imax = 1.0 pu of rated). Above the deadband (0.15 pu), reactive current increases linearly at twice the voltage deviation rate. For deviations above 0.5 pu — including all deep faults — the converter's full current capacity is consumed by reactive injection and active current falls to zero.
> **Alt text:** Line chart showing reactive current rising linearly with voltage deviation and active current decreasing to zero, with the converter fully loaded by reactive injection for voltage deviations above 0.5 pu.
> **Data source:** Commission Regulation (EU) 2016/631, Article 21; Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Reactive current in blue; active current in red dashed; deadband region shaded grey.

---

## 23.5 Inside the DC Link: Energy, Choppers, and Recovery

The Type 4 wind turbine topology — a permanent magnet synchronous generator (PMSG) connected to the grid through a full back-to-back power converter — was described in Chapter 6. During normal operation, the machine-side converter (MSC) absorbs mechanical power from the PMSG at whatever generator speed maximises energy extraction, producing a DC output at approximately 1,100 V. The grid-side converter (GSC) inverts that DC to 690 V AC, which the step-up transformer raises to the collector network voltage.

During a fault, this elegant separation becomes an energy problem.

The MSC continues to receive mechanical power from the generator. The rotor is spinning — a full Vestas V236 rotor at rated speed carries enormous kinetic energy, and aerodynamic deceleration requires the blade pitch system to respond over several seconds, not milliseconds. The MSC continues pushing current into the DC link capacitor bank at close to the rated power rate. The DC link voltage begins to rise.

The GSC, meanwhile, is trying to inject current into a nearly-zero-voltage AC system. During a 140 ms fault at 0.05 pu terminal voltage, the active power it can inject is negligible. The entire MSC output accumulates in the DC link. If left uncontrolled:

$$V_{DC,new} = \sqrt{V_{DC,nom}^2 + \frac{2 \cdot P_{MSC} \cdot t_{fault}}{C_{DC}}}$$

where:
- $V_{DC,nom}$ = nominal DC link voltage [V] — approximately 1,100 V for a 15 MW converter
- $P_{MSC}$ = machine-side converter power input during fault [W] — approximately 15 × 10⁶ W at fault onset, before pitch response
- $t_{fault}$ = fault duration [s] — 0.140 s
- $C_{DC}$ = DC link capacitance [F] — approximately 20–40 mF for a 15 MW converter

For $C_{DC} = 30$ mF and $P_{MSC} = 15$ MW over 140 ms, the DC link energy accumulation is $\Delta E = 15 \times 10^6 \times 0.140 = 2.1$ MJ, and $V_{DC,new} = \sqrt{1{,}100^2 + 2 \times 2.1 \times 10^6 / 0.030} \approx 11{,}883$ V. The capacitor would need to reach nearly 12,000 V to absorb 2.1 MJ — destroying the converter insulation in milliseconds.

The DC chopper prevents this. A braking resistor is connected across the DC bus through a high-speed IGBT switch. When the DC link voltage rises above a threshold — typically 1.05–1.10 pu of nominal, approximately 1,150–1,200 V — the chopper IGBT fires, routing excess current through the resistor and converting it to heat. The IGBT switches at approximately 2–4 kHz, with a PWM duty cycle modulated to hold the DC link at its target voltage throughout the fault.

The energy dissipated in the chopper resistors per turbine over the 140 ms fault is approximately:

$$E_{chopper} \approx P_{MSC,avg} \cdot t_{fault}$$

where $P_{MSC,avg}$ is the average machine-side power during the fault. As the blade pitch system begins responding at approximately 50 ms after fault onset, mechanical power starts falling; the average over 140 ms is approximately 12–14 MW. For 13.5 MW average:

$$E_{chopper} \approx 13.5 \times 10^6 \times 0.140 = 1.89 \text{ MJ per turbine}$$

For the 34-turbine farm: $34 \times 1.89 = 64$ MJ — roughly the kinetic energy of a fully loaded double-decker bus at 100 km/h — converted to heat in turbine nacelles in 140 milliseconds. The resistors are sized and thermally rated for this event; they cool over the following fifteen minutes by natural convection inside the nacelle. Each turbine's FRT type certificate includes a thermal analysis of the chopper assembly demonstrating adequate margin for repeated fault events.

Unlike Type 3 (DFIG) turbines, which use a rotor crowbar — a bypass resistor connected directly to the rotor windings to limit fault current — Type 4 converters have no direct electrical path from the grid to the generator rotor. The crowbar concept does not apply. The entire FRT problem resolves to DC link voltage management, and the DC chopper solves it.

**Active Power Recovery**

After fault clearance, voltage begins to recover. As it rises above the LVRT boundary, the required reactive injection decreases and active current headroom opens up. The PPC — Power Plant Controller — re-enables active power production as the DC link settles and the terminal voltage recovers. NC RfG Article 21(3)(c) requires that active power return to at least 90% of the pre-fault level within one second of voltage recovery above the LVRT boundary.[4] PSE IRiESP specifies the same one-second target.

The normal ramp-rate limiter (10% $P_n$/min upward under IRiESP) is suspended during post-fault recovery to allow the faster aerodynamically-constrained recovery rate:

$$P(t) = P_{pre} \cdot \min\!\left(1,\; \frac{t - t_{clear}}{t_{rec}}\right) \quad \text{for } t > t_{clear}, \; P(t) \geq 0.90 \cdot P_{pre} \text{ at } t = t_{clear} + 1.0 \text{ s}$$

where $P_{pre}$ is the pre-fault active power, $t_{clear}$ is the fault clearance time, and $t_{rec}$ is the recovery time constant that must satisfy the 90% target. The aerodynamic constraint — blade pitch moving back toward the power-optimal angle — is the dominant limit; it typically constrains recovery to approximately 80–100 MW/s at farm level, meeting the 90% target at or near the one-second boundary.

<!-- IMAGE: fig-23-04 -->
> **Figure 23.4** — Type 4 converter FRT architecture: the DC chopper
> **Type:** schematic circuit diagram
> **Content:** Simplified back-to-back converter diagram. Left side: PMSG symbol → three-phase AC (690 V) → MSC (three-phase IGBT bridge, labelled "Machine-Side Converter"). Centre: DC link (two horizontal bars) with capacitor CDC and DC bus voltage VDC labelled. DC chopper shown as IGBT switch + braking resistor R_chop connected across DC bus as a shunt branch, with PWM signal from DC link voltage controller. DC link voltage controller block shown with VDC input and IGBT gate signal output. Right side: GSC (three-phase IGBT bridge, labelled "Grid-Side Converter") → three-phase AC output (690 V) → step-up transformer symbol. During fault event: thick red arrow from MSC labelled "P_MSC (continues, ~15 MW)"; thick arrow at GSC labelled "P_GSC ≈ 0 (cannot inject into faulted grid)"; thick orange arrow through R_chop labelled "P_chop ≈ P_MSC (heat dissipation)." Text annotation: "VDC held at 1.05–1.10 pu by chopper PWM; prevents IGBT overvoltage damage."
> **Caption:** DC link energy management in a Type 4 (full-power converter) wind turbine during an LVRT event. The MSC continues absorbing generator mechanical power during the fault while the GSC cannot export it to the faulted grid. The DC chopper dissipates the excess energy as heat, holding DC link voltage within safe limits throughout the fault. Approximately 1.7–2.1 MJ per turbine (64–71 MJ for 34 turbines) is dissipated over the 140 ms fault duration.
> **Alt text:** Circuit diagram showing back-to-back converter with DC chopper braking resistor connected across the DC bus; arrows indicate power flow during fault with chopper absorbing the excess.
> **Data source:** Author illustration; US Patent US20130334818A1
> **Resolution:** 1400 × 800 px minimum
> **Color notes:** Normal operation power paths in blue; fault-period generator input in red; chopper heat dissipation path in orange.

---

## 23.6 Dynamic Simulation: What 200 Data Points Show

"Watch the current first," Anders said. "The voltage trace will do what you expect. The current trace will surprise you."

The ANDES simulation had a 1 ms time step and was logging fourteen electrical quantities at each step: bus voltages at all twelve network nodes, active and reactive power injections at each converter group, DC link voltages at three representative turbine models, and the STATCOM reactive current. For a 150 ms fault simulation window, that was 150 data points per quantity — slightly more than 2,000 total. Anders had been rounding earlier.

The voltage trace did exactly what Kaan expected. It dropped to zero at t = 0.000 s, held there for 140 ms, then climbed from 0.05 pu to 0.85 pu over the next 1,360 ms. The bathtub shape from Figure 23.2, precisely reproduced on screen.

The current trace did not behave as expected.

At t = 0.000 s — the instant the fault was applied — the reactive current trace leapt upward. Not gradually. Vertically. From 0.3 pu (the pre-fault reactive absorption set by the Q(V) droop controller) to 1.0 pu in under 5 ms. The active current trace went the other way: from 0.85 pu (near-rated active power) to nearly zero in the same 5 ms. The total current stayed at approximately 1.0 pu throughout — the converter was fully loaded, but all of it was reactive.

"The inner current control loop," Anders said. "It is running at a 250-microsecond sample period. It sees the voltage deviation, computes the required reactive current using the k-factor equation, and adjusts the d-q current references. In 5 milliseconds, it has converged to the new operating point. The grid code says 'reactive response within 5 seconds.' The converter does it in 5 milliseconds."

The DC link voltage trace — the yellow line — rose from 1,100 V to approximately 1,180 V in the first 15 ms, then held steady for the remainder of the fault. The DC chopper had activated. Beneath the voltage trace, a fifth channel showed the chopper duty cycle: a pulse-width modulated signal at approximately 3 kHz, modulating between 40% and 60% as the DC link voltage oscillated slightly around its 1,175 V target.

"The chopper is dissipating approximately 12 megawatts per turbine," Anders said. "For 140 milliseconds. Then it stops. The energy — about 1.7 megajoules per turbine, 58 megajoules for the farm — goes into the braking resistors as heat. Natural convection in the nacelle takes care of the cooling over the next fifteen minutes." He looked at the chopper duty-cycle trace. "The resistors have been doing this for twenty years in Danish and German turbines. The thermal design is well understood."

At t = 0.140 s, the fault cleared. The voltage began to recover. On screen, Kaan watched the reactive current begin to fall — smoothly, proportionally, tracking the k-factor equation in reverse as voltage rose above the LVRT boundary. The active current trace began to climb as headroom opened.

"There," Anders said. "Watch the active power."

At t = 0.300 s, the active power trace began to rise. Not at the 10% Pn/min ramp rate — that constraint was suspended for post-fault recovery. The PPC had issued a recovery-mode command to all thirty-four turbines simultaneously. By t = 1.140 s — exactly 1.0 second after fault clearance — the active power trace read 449 MW.

"89.8% of pre-fault," Kaan said.

"Yes. The blade pitch response lag. The pitch controller sensed the reduced load during the fault and began feathering. When the PPC commanded recovery, the blades had to pitch back — each blade takes 3–5 seconds to sweep its full range. The aerodynamics cost us those 0.2 percentage points." He tapped the screen. "The commissioning test accepts 90% ± 1 percentage point, which covers us. But the simulation puts us right at the boundary. I want to see whether a slightly earlier reactive-to-active handover — a few milliseconds — buys margin."

At t = 3.000 s, the simulation completed. Active power: 499.7 MW. Voltage at 220 kV bus: 1.003 pu. The STATCOM had returned to Q(V) droop mode. Thirty-four converters were producing full power as if nothing had happened.

---

## 23.7 Worked Example: FRT Compliance Verification — 500 MW Reference Farm

**Given parameters:**
- Farm rated power: $P_n = 500$ MW at $V_n = 220$ kV; 34 × 15 MW Type 4 turbines
- Pre-fault operating point: $P_0 = 500$ MW, $Q_0 = 0$ MVAR (unity power factor)
- Fault: three-phase bolted fault at 220 kV bus; PSE profile: 0.05 pu for 140 ms, recovery to 0.85 pu at 1,500 ms

**Step 1: Rated current at 220 kV**

$$I_n = \frac{P_n}{\sqrt{3} \cdot V_n} = \frac{500 \times 10^6}{\sqrt{3} \times 220 \times 10^3} = 1{,}312 \text{ A}$$

**Step 2: Required reactive current injection during fault**

$\Delta V = 1.00 - 0.05 = 0.95$ pu. With $k = 2$:

$$\Delta I_q = 2 \times 0.95 \times 1{,}312 = 2{,}493 \text{ A} = 1.90 \cdot I_n$$

Required reactive current exceeds $I_{max} = 1{,}312$ A. Active current is forced to zero; reactive current is capped at $I_{max}$:

$$I_q = 1{,}312 \text{ A} \quad , \quad I_d = 0$$

**Step 3: Active power during fault**

$$P_{fault} = \sqrt{3} \cdot V_{fault} \cdot I_d \cdot \cos\phi = \sqrt{3} \times (0.05 \times 220 \text{ kV}) \times 0 = 0 \text{ MW}$$

**Step 4: DC chopper energy per turbine**

Average MSC power during the 140 ms fault (accounting for pitch response beginning at ~50 ms): $P_{MSC,avg} \approx 13.5$ MW.

$$E_{chopper} = P_{MSC,avg} \cdot t_{fault} = 13.5 \times 10^6 \times 0.140 = 1.89 \text{ MJ per turbine}$$

Farm total: $34 \times 1.89 = 64.3$ MJ. Equivalent to the kinetic energy of approximately 50 tonnes at 51 m/s — dissipated as heat across thirty-four nacelles in 140 milliseconds.

**Step 5: Active power recovery verification**

Recovery begins at $t_{clear} = 0.140$ s. NC RfG requires $P(t_{clear} + 1.0) \geq 0.90 \times 500 = 450$ MW. Converter recovery rate in post-fault mode: approximately 90 MW/s at farm level (aerodynamically constrained by blade pitch rate). At $t = 1.140$ s:

$$P(1.140) = 90 \; \frac{\text{MW}}{\text{s}} \times 1.0 \; \text{s} = 90 \text{ MW} \times (t - t_{clear}) \approx 450 \text{ MW}$$

This meets the 90% requirement (450 MW / 500 MW = 90.0%). **Boundary condition met.**

**Step 6: Compliance summary**

| FRT Parameter | PSE Requirement | Calculated / Simulated | Status |
|---|---|---|---|
| LVRT minimum voltage | 0.05 pu for 140 ms | Fault at 0.05 pu, clearance at 140 ms | **PASS** |
| Stay connected during fault | Yes, above LVRT boundary | Converters remain connected, no trip | **PASS** |
| Reactive current injection | $k \geq 2$, max reactive priority | $\Delta I_q = I_n = 1{,}312$ A at $\Delta V = 0.95$ pu | **PASS** |
| Active current during deep fault | Reduce to zero if needed | $I_d = 0$ A (all current to reactive) | **PASS** |
| Active power recovery at $t_{clear} + 1.0$ s | $\geq 90\%$ of pre-fault | 450 MW = 90% (boundary) | **PASS** |
| HVRT withstand | 1.25 pu for 100 ms | GIS rated 245 kV; DC chopper active | **PASS** |

---

## Key Takeaways

- **FRT requirements were invented in Germany in 2003, thirteen years before European law mandated them.** E.ON Netz's *Ergänzungsregeln* required reactive current injection and undervoltage ride-through because thousands of megawatts of wind, all programmed to disconnect on undervoltage, would amplify any fault into a cascade. NC RfG Article 20 codified this insight into EU law in 2016.

- **The LVRT envelope is a contract in coordinates.** The piecewise voltage-time profile — 0.05 pu for 140 ms, recovering to 0.85 pu at 1,500 ms — encodes the worst-case realistic fault clearance time at 220 kV and the expected network recovery characteristic. Above the boundary, the farm must stay connected. Below it, disconnection is permitted.

- **Reactive current takes priority over active power during a deep fault.** When the voltage dip exceeds 0.5 pu, the converter's full current capacity is consumed by reactive injection ($\Delta I_q = k \cdot \Delta V \cdot I_n$ exceeds $I_{max}$) and active power falls to zero. This is the correct response: the grid needs reactive current to recover voltage first. Active power recovery follows within one second.

- **The DC chopper is the key FRT technology for Type 4 converters.** Unlike Type 3 (DFIG) turbines, which crowbar the rotor circuit, Type 4 converters manage DC link overvoltage through a braking resistor switched at 2–4 kHz. Approximately 1.7–2.1 MJ per turbine — 64–71 MJ for a 34-turbine farm — is dissipated as heat in 140 ms. The resistor sizing and thermal certification are part of the turbine's FRT type test.

- **The converter responds in milliseconds; the grid code allows seconds.** The inner current control loop reacts to the voltage dip within 1–5 ms. NC RfG's "5-second reactive response" requirement reflects the timescale of synchronous generators. In a modern offshore wind farm, the reactive current injection is complete before the protection relay at the TSO substation has finished its measurement window.

---

## For Further Reading

- **Hansen, A.D. et al. (2007).** *Mapping of Grid Faults and Grid Codes.* Risø National Laboratory for Sustainable Energy, Technical Report Risø-R-1617(EN), Technical University of Denmark. Available: https://www.osti.gov/etdeweb/servlets/purl/20913171. The most accessible English-language summary of the E.ON Netz 2003 *Ergänzungsregeln* and the propagation of FRT requirements through European national grid codes from 2003 to 2006. Chapter 3 covers German requirements; Chapter 4 covers Denmark, Spain, and the United Kingdom in the same period. Engineers working on multi-country FRT compliance documentation will find the side-by-side comparison of national profiles in Appendix A particularly useful.

- **IEC 61400-21-1:2019.** *Wind energy generation systems — Part 21-1: Measurement and assessment of electrical characteristics — Wind turbines.* International Electrotechnical Commission, Geneva. Edition 1.0, published May 2019. Cancels and replaces IEC 61400-21 Second Edition (2008). This standard defines all standardised test procedures for wind turbine electrical characteristics, including the rectangular voltage-dip test used for FRT type certification. Section 7 specifies the test equipment requirements; Section 8 covers voltage dip testing at defined depths and durations. Engineers verifying FRT compliance of a WTG model against a grid code requirement should confirm that the type test report references IEC 61400-21-1:2019 (not the 2008 edition), as measurement procedures were significantly revised. The companion standard IEC 61400-21-2:2019 covers wind power plant (farm-level) electrical characteristics.

- **Liserre, M., Cardenas, R., Molinas, M. & Rodriguez, J. (2011).** "Overview of Multi-MW Wind Turbines and Wind Parks." *IEEE Transactions on Industrial Electronics*, Vol. 58, No. 4, pp. 1081–1095. DOI: 10.1109/TIE.2010.2103910. A comprehensive survey of power converter topologies for large wind turbines, with sections on FRT mechanisms for Type 3 (DFIG crowbar) and Type 4 (DC chopper) architectures. Section IV covers the DC link energy balance during a voltage dip — the physics behind the chopper energy calculation in section 23.5 — with per-unit derivations applicable to any converter rating. The paper predates some of the grid code developments covered in this chapter but remains the standard reference for understanding why different turbine topologies require different FRT hardware.

---

*The simulation screen showed 499.7 MW. The voltage trace was flat at 1.003 pu. The yellow DC link trace was back at 1,100 V, as if the previous three seconds had not happened.*

*Kaan had filled four pages. Most of the questions he had written down had been answered by the time the simulation reached its conclusion — the screen was faster than his pen, which was not something he had expected to say about a piece of software. One question remained underlined at the bottom of the fourth page.*

*"Who coordinates all of this?" he said. "During the fault, each converter followed the k-factor equation independently. When recovery began, they all ramped at the same rate. Somebody decided when to switch from reactive-priority mode back to active power mode. Somebody decided that 89.8% recovery was acceptable and told the pitch controller to stop feathering."*

*"Yes," Anders said.*

*"Who?"*

*Anders closed the simulation window. On the second monitor, a block diagram was already open — boxes inside boxes, arrows in both directions. He enlarged the central block.*

*PPC — POWER PLANT CONTROLLER*
*STATE: RUNNING*
*ACTIVE MODE: POWER_REFERENCE*
*REACTIVE MODE: Q_V_DROOP*

*"The Power Plant Controller," Anders said. "It coordinates the thirty-four turbines, the STATCOM, and the ramp limiter. It receives the PSE setpoint — how much power to produce, what power factor to hold — and distributes that instruction across the farm. During the fault, it stepped back and let the individual converters handle reactive injection. When voltage recovered, it stepped back in and issued the recovery command." He pushed back his chair. "Chapter 24 is how it works. Today I want to look at whether we can gain those 0.2 percentage points."*

*He pulled the simulation log open and scrolled to the 1.140-second mark. Kaan looked at the 449 MW figure — 1 MW short of the requirement — and felt, for reasons he could not immediately articulate, that the 1 MW mattered more than the 449.*

---

## Notes

[1] E.ON Netz FRT requirements — origin and content: E.ON Netz GmbH (2003). *Ergänzungsregeln für Windenergieanlagen: Anforderungen an Windenergieanlagen* (Supplementary Rules for Wind Turbines: Requirements for Wind Turbines). E.ON Netz GmbH, Bayreuth, Germany, 2003. The specific requirements cited — disconnection forbidden above 15% nominal voltage; reactive current injection with gain k ≥ 2 (2% of rated current per 1% of voltage deviation); reactive current injection up to 100% of rated current — are summarised and contextualised in Hansen, A.D. et al. (2007). *Mapping of Grid Faults and Grid Codes.* Risø National Laboratory Technical Report Risø-R-1617(EN), pp. 35–42. Available: https://www.osti.gov/etdeweb/servlets/purl/20913171. The E.ON Netz 2003 rules were the first mandated FRT requirements for wind turbines in any national grid code. They predated IEC 61400-21-1 by sixteen years and were written before standardised FRT test procedures existed. The requirements were later incorporated into the German VDE-AR-N 4120 (Technical requirements for the connection and operation of customer installations to the high-voltage network, 2018 edition) and superseded at European level by NC RfG Article 20 (2016).

[2] September 23, 2003 blackout in southern Sweden and eastern Denmark: Elkraft System & Svenska Kraftnät (2003). *Power Failure in Eastern Denmark and Southern Sweden on 23 September 2003 — Final Report.* Elkraft System and Svenska Kraftnät, December 2003. Available from Energinet.dk (https://en.energinet.dk). The proximate cause was the loss of Oskarshamn Nuclear Power Plant Unit 3 (1,175 MW) followed by a fault at the Ringhals station that tripped two further nuclear units. Total generation loss: approximately 6,350 MW. Over 4 million customers in southern Sweden and eastern Denmark lost power for up to three hours. Documented also in Ekström, A. & Söder, L. (2004). "The black-out in southern Sweden and eastern Denmark, September 23, 2003." *IEEE Power Engineering Society General Meeting*, Vol. 2, pp. 1296–1299. DOI: 10.1109/PES.2004.1373073. Note: a second major European blackout occurred on September 28, 2003 — five days later, in Italy, with an independent cause (a 380 kV line flash-over near Lucino cascading through Switzerland). Both events are cited in the academic literature that motivated FRT requirements, but the September 23 event is more directly relevant to wind integration risk analysis.

[3] Nordic TSO wind penetration risk analysis: Eriksson, R. et al. (2006). "Simulation of the impact of wind power on the transient fault behavior of the Nordic power system." *Electric Power Systems Research*, Vol. 77, No. 2, pp. 135–144. DOI: 10.1016/j.epsr.2006.02.020. This paper explicitly models the risk scenario described in section 23.1: how increasing wind penetration in the Nordic network — with turbines programmed to disconnect on undervoltage — would amplify a generation loss event of the September 23, 2003 type. Calculations show that 10% wind penetration with pre-FRT protection logic would have added approximately 1,000–2,500 MW of secondary generation loss to the 2003 event. The paper directly motivated Energinet.dk and Svenska Kraftnät to mandate FRT in their national grid codes. Earlier modelling: Akhmatov, V. et al. (2003). "Modelling and transient stability of large wind farms." *International Journal of Electrical Power & Energy Systems*, Vol. 25, No. 2, pp. 123–144. DOI: 10.1016/S0142-0615(02)00018-0.

[4] NC RfG FRT requirements: Commission Regulation (EU) 2016/631, Article 14 (HVRT — continuous operation voltage range), Article 20 (LVRT capability for Type C and D generators), and Article 21 (reactive power during fault, including the k-factor requirement and active power recovery). The ENTSO-E reference LVRT profile — 0.05 pu minimum voltage, 140 ms fault clearance, 0.85 pu recovery within 1,500 ms of fault inception, 0.90 pu within 3,000 ms — is used as the default in NC RfG implementation guidance and is replicated in most national grid codes either directly or with minor adjustments. PSE IRiESP Section 7.4 specifies the Polish profile for 220 kV connections; specific coordinates should be verified against the current IRiESP edition available at pse.pl. The active power recovery requirement — ≥ 90% of pre-fault power within one second of voltage recovery above the LVRT boundary — is in Article 21(3)(c). HVRT requirements (continuous above 1.05 pu, specified duration above 1.10 pu, 100 ms above 1.25 pu) are in Article 14(2)(d), with national TSOs specifying the exact 1.10 pu duration.

[5] 140 ms fault clearance time and protection grading: The PSE 140 ms clearance time for 220 kV faults reflects the protection design philosophy described in Chapter 19. Primary busbar differential protection (IEC 60255-187-3, PDIF function): 20–30 ms operate time. 220 kV circuit breaker opening time: 50–80 ms (two to three 50 Hz cycles). Main protection total clearance: 70–110 ms. The 140 ms envelope covers backup protection operation in the event of main protection failure — consistent with the ENTSO-E reference profile design basis. The 140 ms is an obligation on the TSO (PSE guarantees this clearance time through protection coordination requirements in IRiESP Chapter 9), not a requirement on the generator; the generator must withstand however long the fault lasts up to 140 ms without disconnecting.

[6] DC chopper mechanism in Type 4 converters: The braking resistor and DC chopper IGBT architecture for FRT in full-power-converter wind turbines is described in US Patent US20130334818A1, "Dynamic Braking on a Wind Turbine During a Fault" (Vestas Wind Systems A/S, published 2013). The physics of DC link energy accumulation during a grid fault — MSC continues delivering power while GSC cannot transfer it — is described in Liserre, M. et al. (2011). "Overview of Multi-MW Wind Turbines and Wind Parks." *IEEE Transactions on Industrial Electronics*, Vol. 58, No. 4, pp. 1081–1095. DOI: 10.1109/TIE.2010.2103910. Control sampling periods (inner current loop: 125–500 µs at 2–8 kHz switching frequency) are consistent with: OPAL-RT (2016). *Field Validated Generic EMT-Type Model of a Full Converter Wind Turbine.* Technical Report L00161, pp. 4–7. Available: https://blob.opal-rt.com/medias/L00161_0889.pdf. The distinction between Type 4 DC chopper and Type 3 rotor crowbar is clearly explained in: Mohseni, M. & Islam, S.M. (2012). "Review and assessment of fault ride-through capability standards for wind turbines." *Renewable and Sustainable Energy Reviews*, Vol. 16, No. 7, pp. 4787–4807. DOI: 10.1016/j.rser.2012.04.008.

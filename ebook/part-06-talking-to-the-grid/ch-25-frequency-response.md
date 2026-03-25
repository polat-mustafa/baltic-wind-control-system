# Chapter 25: Frequency Response and Synthetic Inertia

---

*The number on the frequency display was 49.76 Hz and it was still falling.*

*Kaan had watched frequencies drift before — small oscillations around 50.00, the quiet breathing of a 300-gigawatt grid — but this was different. This was a sustained decline, deliberate as a barometer falling before a storm. The SCADA screen showed the PSE-wide average frequency plotted against time, a curve bending downward with the unhurried certainty of a stone dropped over the edge of a sea wall.*

*Anders was already on the coordination channel. His voice was flat, unhurried.*

*"PSE Warsaw, Baltic Wind offshore, frequency monitoring. We are observing 49.76 and declining. Can you confirm the event?"*

*A pause. The crackle of a long-distance radio path crossing a flat Baltic night.*

*"Baltic Wind, PSE duty operator, Zawadzki. Confirmed. Łagisza B tripped at 22:14. Approximately eleven hundred megawatts, thermal, eastern Poland. Reserves being activated from Bełchatów and Kozienice. Contingency reserve fully online in approximately seventy seconds. Continue monitoring."*

*"Understood. Baltic Wind out."*

*Anders replaced the handset and turned back to the screens without comment. The voice on the other end — Piotr Zawadzki, duty system operator in Warsaw — had spoken the way engineers speak when a large and unwelcome thing has happened and the procedure is clear: calmly, in complete sentences, with numbers.*

*Kaan watched the individual turbine traces. Thirty-four lines, each representing a V236 rotor somewhere in the dark sea three kilometres north of where he was standing. They had already moved. He had been watching when it happened — a collective flinch upward, all thirty-four lines ticking up by a small fraction of a megawatt, before any new setpoint had arrived from the Power Plant Controller. Before the LFSM-U response had cleared five megawatts. Before anything had been commanded.*

*The turbines had felt the grid change and responded without being asked.*

*49.71 Hz.*

*49.68 Hz.*

*The curve flattened. Not recovering — not yet — but no longer accelerating downward. A nadir forming, visible in real time, the frequency event reaching its worst point and pausing there, the way a pendulum pauses at the apex of its swing before the stored energy begins to pull it back.*

*49.67 Hz. Flat. Then, almost imperceptibly, rising.*

*"There," Anders said. He pointed at the aggregate power trace, where the PPC's setpoint command had now become visible — a stepped increase, the LFSM-U ramp beginning its work, adding generation in the measured way the grid code required. "The PPC caught up. As promised."*

*He reached across and pulled up a second trace — the synthetic inertia contribution, logged separately in the SCADA historian. A sharp spike in the first second, narrow as a spike of light, then tapering as the rotor recovered and the droop controller took over.*

*"We contributed about twelve megawatts of synthetic inertia in the first second," he said. "Trivial, in a three-hundred-gigawatt grid. But in a different grid — a smaller one, a less interconnected one — that same event looks very different." He paused, watching the frequency trace climb slowly back toward 49.80. "That is what this chapter is about."*

---

## 25.1 The Inertia Constant H

Before the first wind turbine was ever connected to a grid, power systems engineers had a century of experience with one defining property of large synchronous generators: they were heavy, they were spinning, and that combination meant they resisted change.

A synchronous generator — a steam turbine, a gas turbine, a hydro unit — is physically coupled to the grid through the magnetic field of the alternator. If the grid frequency changes, the rotor feels it. If the rotor accelerates or decelerates, the grid sees it. The coupling is direct, electromagnetic, and instantaneous. This physical coupling meant that every megawatt of generating capacity installed anywhere in the Continental European synchronous area was also a megawatt of spinning mass contributing its rotational energy to the shared frequency of 50 Hz.

That spinning mass is a mechanical battery. The kinetic energy stored in a rotating object is:

$$W_k = \frac{1}{2} J \omega^2$$

where J is the moment of inertia of the rotor in kg·m² and ω is the angular velocity in rad/s. For a large steam turbine-generator, this is an enormous quantity — we are talking about tens of tonnes of steel rotating at 3,000 rpm. The energy stored is real, physical, and immediately available to resist any change in rotational speed.

The practical problem for power systems engineers was that comparing kinetic energy across machines of wildly different sizes — a 2 MW gas turbine versus a 1,200 MW steam unit — required normalisation. The quantity that provides this normalisation is the inertia constant H:

$$H = \frac{W_k}{S_n}$$

where: H = inertia constant [s], W_k = kinetic energy stored at rated speed [MJ], S_n = rated apparent power [MVA].

H has units of seconds. The physical interpretation is elegant: H tells you how long the machine could supply its rated power output from its stored kinetic energy alone, before the rotor came to a complete stop. A machine with H = 6 seconds could, in a hypothetical universe where all mechanical input suddenly ceased and load remained constant, sustain its rated output for six seconds before the rotor stalled.

In practice, this number is never tested that severely. But it tells you something important about the machine's contribution to frequency stability in the crucial first few seconds after a disturbance.

Typical values cluster by technology. Steam turbines, with their long shafts, multiple turbine stages, and heavy alternator rotors, achieve H = 3–9 s. Gas turbines, more compact, run H = 2–4 s. Hydro units, with their large-diameter runners but slower rotational speeds, tend toward H = 2–4 s as well. Synchronous condensers — synchronous machines operated with no mechanical load, purely for reactive power support — typically contribute H = 1–2 s and are increasingly deployed specifically to provide inertia rather than energy.

For perspective: the CE synchronous area at typical 2020s operating conditions has a combined committed synchronous generation capacity of roughly 350,000 MVA with an average H around 5–6 seconds. In the purely hypothetical scenario where all prime movers simultaneously stopped delivering power, the stored kinetic energy in that spinning mass would sustain 50 Hz for approximately six seconds. Six seconds is long enough for every governor on every responsive generator in Europe to begin opening its admission valves, for every primary reserve to start flowing. That is not an accident. The physics of synchronous machines built frequency stability into the system as a free by-product of the technology.

Type 4 wind turbines — the full-power converter machines that have become the dominant technology for offshore wind since around 2010 — do not do this.

A V236-15.0 MW wind turbine has a rotor assembly with a moment of inertia that, if you calculate it from the blade masses and rotor radius, corresponds to a physical H_rotor of roughly 4–6 seconds. The kinetic energy is there. The spinning mass exists. But the power electronics between the rotor and the grid are a firewall.

In a Type 4 turbine, the rotor drives a generator at variable speed, completely decoupled from the 50 Hz grid. The generator output is rectified to DC in the nacelle. The DC power travels down to the base, where an inverter reconstructs a 50 Hz AC waveform and injects it into the collection system. The rotor spins at whatever speed gives the best power coefficient for the current wind speed — often 8–10 rpm for a machine this size — and the inverter synthesises whatever waveform the grid expects.

The consequence is that changes in grid frequency do not reach the rotor, and changes in rotor speed do not reach the grid. Without explicit control logic, a Type 4 WTG presents zero inertia to the power system. The rotor's kinetic energy sits locked behind the converter, usable only if someone designs control code to release it.

For the first three decades of modern wind energy, this was not a critical problem. Wind penetration was low, thermal and hydro generation dominated, and the aggregate system inertia remained high. The problem emerged only as the thermal fleet began to retire.

> **[Figure 25.1]** — Inertia Constant H by Generation Technology
> **Type:** Horizontal bar chart
> **Content:** Five technology categories on vertical axis: Steam turbine (3–9 s range shown as bar with mean), Gas turbine (2–4 s), Hydro (2–4 s), Synchronous condenser (1–2 s), Type 4 WTG without synthetic inertia control (H_effective ≈ 0 s), Type 4 WTG with synthetic inertia enabled (H_SI = 4.0 s shown as reference line). Values plotted as ranges. Colour coding: thermal in warm grey, renewable in blue-green, synthetic inertia reference in amber dashed line. Annotation: "CE synchronous area average ≈ 5–6 s (2020s conditions)" as reference line.
> **Caption:** Inertia constants for major generation technologies at rated output. Type 4 full-power converter WTGs contribute zero effective inertia without synthetic inertia control, regardless of rotor size. With synthetic inertia enabled, an offshore wind farm can approach the inertia contribution of a modern gas turbine unit.
> **Alt text:** Horizontal bar chart showing inertia constant H in seconds for five generation types, ranging from steam turbine at 3–9 seconds down to Type 4 WTG without synthetic inertia at approximately zero.
> **Data source:** Kundur (1994) typical values; ENTSO-E (2022) frequency stability criteria; manufacturer rotor data for V236 estimate.
> **Resolution:** 1200 × 800 px minimum

---

## 25.2 The Swing Equation and Frequency Dynamics

Every mechanical system that rotates obeys Newton's second law. For a rotating body, Newton's second law becomes: net torque equals moment of inertia multiplied by angular acceleration. For a synchronous generator connected to the grid, this means the rotor accelerates or decelerates in response to the difference between mechanical torque from the prime mover and electrical torque demanded by the load.

This relationship, cast into per-unit form normalised to the machine's own MVA base, is called the swing equation. It is one of the foundational equations of power systems engineering, appearing in every textbook on the subject since Concordia's work in the 1940s:

$$\frac{2H}{f_n} \cdot \frac{df}{dt} = \frac{P_m - P_e}{S_n}$$

where: H = machine inertia constant [s], f_n = nominal frequency [Hz], df/dt = rate of change of frequency [Hz/s], P_m = mechanical power input [MW], P_e = electrical power output [MW], S_n = rated MVA [MVA].

The physical meaning of this equation is direct. If a generator is running steadily at 50 Hz, P_m equals P_e and df/dt is zero — the frequency is constant. If a large load suddenly connects or a generator suddenly trips, the balance between mechanical input and electrical output is broken. The numerator becomes non-zero, the frequency begins to change, and the rate at which it changes is inversely proportional to H. Halving H doubles the rate of frequency change for the same power imbalance. Doubling H halves it.

The swing equation applies to a single machine. Extending it to the whole grid requires summing across all committed synchronous generators — each contributing its own H·S_n product to the aggregate — to get a system-level equivalent. The result is an equation for the initial rate of change of frequency across the entire synchronous area immediately following a generation loss:

$$\text{RoCoF}_0 = -\frac{f_n \cdot \Delta P_L}{2 \cdot H_\text{sys} \cdot S_\text{sys}}$$

where: RoCoF_0 = initial rate of change of frequency [Hz/s], f_n = nominal frequency = 50 Hz, ΔP_L = lost generation [MW], H_sys = equivalent system inertia constant [s], S_sys = total committed generation [MVA].

Notice that H_sys appears in the denominator. Halving system inertia doubles the RoCoF for any given generation loss. Quartering it quadruples the RoCoF. The formula is not subtle about what happens as thermal plants retire and are replaced by converter-connected renewables that contribute zero inertia.

With the formula in hand, a frequency event can be decomposed into three phases, each with its own physics and timescale.

The first phase is the inertial response, occupying roughly the first zero to two seconds after the disturbance. In this phase, no control system has had time to respond. The frequency trajectory is determined entirely by the swing equation — by the stored kinetic energy in all spinning masses connected to the grid. No governor has opened, no setpoint has changed, no AGC command has been dispatched. This is pure physics. The RoCoF in this phase is what the formula above describes. Engineers cannot change it by adjusting settings or dispatching faster reserves. The only way to change the RoCoF in this phase is to change H_sys — and H_sys is determined by which generators are connected and running when the event occurs.

The second phase is primary reserve response, running from roughly two seconds to thirty seconds. Governors and frequency-droop controllers detect the frequency deviation and increase power output. The frequency reaches its lowest point — the nadir — somewhere in this window, when the rate of generation recovery equals the rate of load growth. Then frequency begins to climb back. Primary reserve does not restore frequency to exactly 50.00 Hz; it merely arrests the decline and begins recovery to a new steady-state value slightly below nominal.

The third phase is secondary reserve, from thirty seconds to fifteen minutes or more. Automatic Generation Control (AGC) systems detect the persistent under-frequency, dispatch additional generation, and restore frequency to exactly 50.00 Hz. This is the slow, coordinated layer that the market and dispatch systems support.

The key parameter linking all three phases is the RoCoF. A high RoCoF in the first two seconds means the frequency is already deep into its decline before primary reserve has time to respond. The lower the nadir, the closer the grid approaches the thresholds that trigger automatic load shedding — deliberately cutting power to customers to stop the frequency collapse. A low RoCoF gives primary reserve time to catch the frequency before it falls that far.

> **[Figure 25.2]** — Frequency Event Phases: Inertial Response, Primary Reserve, Secondary Restoration
> **Type:** Line chart (frequency vs time), annotated
> **Content:** Single frequency trace from 50.00 Hz at t=0, declining through three labelled phases. Phase 1 (0–2 s): steep linear decline, slope labelled "RoCoF_0 determined by H_sys". Phase 2 (2–30 s): decelerating decline reaching nadir, labelled "nadir — primary reserve active", then recovery to "steady-state under-frequency" ~49.9 Hz. Phase 3 (30 s – 10 min): slow recovery back to 50.00 Hz, labelled "AGC — secondary restoration". Horizontal reference lines at 49.8 Hz (LFSM-U activation), 49.0 Hz (LFDD threshold for some systems), 48.8 Hz (GB 2019 nadir). Vertical dotted lines demarcating phases. RoCoF annotation as slope angle on phase 1.
> **Caption:** Three-phase decomposition of a frequency event following a generation loss. The inertial phase (0–2 s) is governed entirely by stored kinetic energy in synchronous machines — no control intervention is possible in this window. The subsequent phases can be shaped by governor response, droop control, and AGC.
> **Alt text:** Frequency versus time graph showing frequency declining steeply in the first two seconds, reaching a nadir around 49.67 Hz near thirty seconds, then recovering gradually to 50 Hz over several minutes, with the three response phases annotated.
> **Data source:** Schematic based on Kundur (1994) Chapter 11; event shapes consistent with ENTSO-E (2022) criteria.
> **Resolution:** 1200 × 800 px minimum

> **Standard reference:** ENTSO-E Network Code on Requirements for Generators (NC RfG), Commission Regulation (EU) 2016/631, Articles 13–15 and 20–21. Establishes frequency response capability requirements for power-generating modules, including LFSM-U (Article 13) and the three-phase timescale framework for frequency containment, restoration, and replacement reserves.

---

## 25.3 The Day the Grid Forgot About Inertia: Great Britain, 9 August 2019

At 16:52 BST on 9 August 2019, a lightning strike on a 400 kV transmission line in Lincolnshire caused a brief voltage dip across a section of the GB transmission network. What followed was, by any engineering measure, a textbook demonstration of low-inertia grid vulnerability — and the most significant power system event in Great Britain since 2003.

The GB power system that afternoon was operating in conditions that had become increasingly common through the 2010s: high solar PV output, moderate wind, and a large fraction of the traditional thermal fleet offline because midday summer demand did not require it. Effective system inertia, calculated across all committed synchronous machines, was at historically low levels.

When the voltage dip hit, Hornsea One — a large offshore wind farm in the North Sea that had commenced commercial operation in 2019 — responded in a way that nobody had designed to be catastrophic: its protection systems, responding to the transient voltage disturbance, caused the farm to lose approximately 737 MW of output rapidly. This was not a failure. The protection systems did exactly what they were specified to do when they detected abnormal conditions.

Eight seconds later, a separate fault at Little Barford, a gas-fired power station in Bedfordshire, tripped approximately 244 MW. The fault at Little Barford was caused by vibration protection responding to mechanical conditions that had developed independently of the Hornsea One event. The two events were not causally connected. They were coincidental — the kind of coincidence that low-probability risk assessments sometimes fail to account for with adequate conservatism.

The combined loss reached approximately 981 MW within ten seconds. Under normal operating conditions with the thermal fleet fully committed, this would have been a manageable contingency — large but within the reference incident parameters of the GB grid code. Under the actual operating conditions that afternoon, with system inertia historically low, the formula tells the story:

RoCoF = 50 × 981 / (2 × 2.0 × 30,000) = 0.41 Hz/s

For comparison, the same 981 MW loss on the CE synchronous area under typical conditions would produce RoCoF around 0.007 Hz/s — roughly sixty times slower. The difference is not the lost generation; it is the denominator.

At 0.41 Hz/s, the frequency fell from 50.00 Hz to the LFSM-U activation threshold of 49.8 Hz in approximately 0.49 seconds. Primary reserve governors, which need several seconds to open valves, warm up fuel delivery, and ramp mechanical output, had not had time to provide meaningful response before the frequency was already 200 mHz below nominal.

The nadir reached 48.88 Hz within 140 seconds of the initial disturbance. At that depth, automatic low-frequency demand disconnection relays activated — a last-resort protection designed to stop frequency collapse by deliberately cutting loads. Approximately five percent of GB demand was shed. Around one million customers, concentrated in London and the South East, lost power. Some remained without power for up to forty-five minutes.

The subsequent investigation by National Grid ESO and Ofgem, published in December 2019, reached a conclusion that was both technically precise and somewhat uncomfortable. No individual system operator, generator owner, or protection engineer had made an error. Every system had operated within its specified parameters. The protection systems protecting Hornsea One had worked correctly. The vibration protection at Little Barford had worked correctly. The LFDD relays had worked correctly.

The problem was that the system had been designed to operate safely above a certain level of inertia, and on 9 August 2019, effective inertia had dipped below that level during high-renewable, low-thermal conditions. The design did not account for the emergent behaviour of a grid composition that had not existed when the protection settings were last reviewed.

There was a secondary consequence that illustrates why this chapter's section on protection relays matters. Some distributed generators — units connected to the distribution network rather than the transmission backbone — had rate-of-change-of-frequency protection set at 0.5 Hz/s, a threshold historically considered conservatively high. This protection had been installed originally to detect islanding: if a section of distribution network became electrically isolated from the rest of the grid, RoCoF within that island would rise rapidly, and tripping generators within it was a safety measure.

At 0.41 Hz/s, the LFDD events and secondary losses briefly pushed the measured RoCoF past 0.5 Hz/s in some locations. The df/dt protection that had been designed to catch islanding triggered on a normal grid event, tripping additional generators and compounding the disturbance.

The response was significant. National Grid ESO subsequently contracted for new "Enhanced Frequency Response" and "Dynamic Containment" services, requiring mandatory sub-second frequency response from batteries, demand-side resources, and wind farms. These services now provide an inertia-like capability from converter-connected assets that the old system design had implicitly assumed would come from synchronous generation for free. The annual cost of procuring these services runs to approximately £200 million per year — the price of not having priced inertia into the market when the thermal fleet was still providing it without charge.

The August 2019 event was not the first low-inertia incident in a major grid, and it will not be the last. But it was the event that moved synthetic inertia from a research topic to a mandatory grid service in the country where offshore wind had developed furthest.

> **[Figure 25.3]** — GB Frequency Trace, 9 August 2019
> **Type:** Annotated line chart
> **Content:** Frequency vs time from 16:51 to 17:00 BST. Trace shows 50.00 Hz baseline, sharp decline beginning at 16:52, nadir at 48.88 Hz annotated with vertical dashed line, LFDD activation threshold at 49.0 Hz shown as horizontal dashed reference line, recovery curve from nadir back toward 49.5–50.0 Hz. Key event annotations: "Hornsea One loss ~737 MW", "Little Barford loss ~244 MW", "LFDD activation — ~1M customers disconnected", "df/dt protection trips in distribution network". Inset box: "RoCoF ≈ 0.41 Hz/s — 60× faster than equivalent CE event".
> **Caption:** Measured frequency trace during the 9 August 2019 GB power system disturbance, showing the 48.88 Hz nadir and LFDD activation. The event demonstrated that protection settings calibrated for high-inertia operation become inadequate when system composition shifts toward converter-connected generation.
> **Alt text:** Frequency versus time line chart showing the GB system frequency declining from 50 Hz to a nadir of 48.88 Hz following the Hornsea One and Little Barford losses on 9 August 2019, with LFDD activation marked.
> **Data source:** National Grid ESO and Ofgem (2019) investigation report; Ofgem published data.
> **Resolution:** 1200 × 800 px minimum

---

## 25.4 Synthetic Inertia from Type-4 WTGs

Understanding why Type 4 turbines present zero effective inertia to the grid without special control requires holding two facts simultaneously. First: the physical rotor in a large offshore wind turbine carries enormous kinetic energy. A V236-15.0 MW machine has a rotor of 118 metres in radius, blades with combined mass around 90 tonnes, a hub and drivetrain adding further rotational mass. The physical inertia constant H_rotor for the complete rotating assembly is approximately 4–6 seconds — comparable to a gas turbine, and it is always charged when the wind is blowing.

Second: the full-power converter between that rotor and the grid is deliberately designed to prevent the rotor's frequency from coupling to the grid's frequency. This decoupling is the feature, not the bug. It is what allows a Type 4 turbine to capture power efficiently across a wide wind speed range, operating the rotor at optimal rotational speed for each wind condition rather than locking it to the 50 Hz synchronous frequency. The consequence is that without additional control logic, the grid never sees the rotor decelerate during a frequency event, and the rotor never feels the grid's frequency drop. They are in the same building but speaking different languages.

Synthetic inertia control bridges this gap. The approach is conceptually straightforward, though the implementation requires care. The inverter on the grid side continuously measures the grid frequency. When it detects a rate of change — a df/dt that exceeds a defined threshold — it computes an additional power command proportional to that derivative and immediately adds it to the current injection. The power comes from the rotor's kinetic energy: the turbine briefly extracts energy from the rotor at a higher rate than the wind is currently supplying, decelerating the rotor slightly in exchange for delivering a burst of power to the grid. The grid sees this burst exactly as it would see any other sudden increase in power output from any other generator. The mechanism is electronic but the physics of the energy delivery is real.

The synthetic inertia power injection is described by:

$$\Delta P_\text{SI} = \frac{2 H_\text{SI} \cdot S_n}{f_n} \cdot \left|\frac{df}{dt}\right|$$

where: Delta P_SI = synthetic inertia power injection [MW], H_SI = virtual inertia constant [s] (PSE minimum requirement = 4.0 s for offshore Type D), S_n = turbine rated apparent power [MVA], f_n = nominal frequency = 50 [Hz], df/dt = measured rate of change of frequency [Hz/s].

The physical meaning is that the turbine behaves, from the grid's perspective, as if it were a synchronous machine with an inertia constant H_SI. The grid does not know the power is coming from a decelerating rotor rather than a decelerating alternator. The effect on frequency dynamics is identical.

The amount of energy available for this response is finite, and it is determined by how much the rotor can safely decelerate:

$$\Delta E_\text{rotor} = H_\text{rotor} \cdot S_n \cdot \left[1 - \left(\frac{\omega_\text{min}}{\omega_0}\right)^2\right]$$

where: Delta E_rotor = kinetic energy available for extraction [MJ], H_rotor = physical rotor inertia constant [s], S_n = rated apparent power [MVA], omega_min = minimum rotor speed [rad/s] (typically 10% below rated), omega_0 = rated rotor speed [rad/s].

The minimum rotor speed constraint matters. Below roughly 90% of optimal rotational speed, the turbine's power coefficient Cp begins to fall substantially. Decelerating the rotor below this threshold to extract energy would cost more efficiency than the inertia response is worth — and in extreme cases could push the turbine toward stall conditions. So the available energy for synthetic inertia is the kinetic energy difference between full speed and 90% speed, not the full kinetic energy.

The recovery phase following a synthetic inertia burst is the aspect that separates a well-engineered implementation from a naive one. After the burst, the rotor has been slowed slightly. It must now re-accelerate to optimal speed — but re-acceleration requires mechanical energy from the wind, which means the turbine briefly produces less electrical power than the wind would normally allow. If the Power Plant Controller does not account for this recovery dip, it can create a second disturbance: the frequency has recovered from the initial event, and then a few seconds later, the wind farm's output drops as all thirty-four rotors simultaneously try to spin back up.

The PPC manages this by spreading the rotor recovery across time, staggering the recovery of individual turbines and scheduling the recovery to avoid coinciding with any phase where grid frequency is still sensitive. The coordination between the turbine-level synthetic inertia controller and the farm-level PPC is one of the more subtle aspects of modern wind farm control, and it is why both are necessary: the turbine controller sees the df/dt first and responds immediately; the PPC coordinates the aftermath.

ENTSO-E's Network Code on Requirements for Generators classifies synthetic inertia as a capability requirement for Type D generators (above 75 MW in most member states) but leaves mandatory implementation to national TSO parameterisation. In most CE countries, synthetic inertia remains an optional enhanced service. PSE's national parameters, updated following the broader European response to the 2019 GB event and to anticipated changes in the Polish generation mix as coal plants retire through the 2030s, have moved to require synthetic inertia from offshore wind farms above 75 MW connecting at 110 kV and above.

> **[Figure 25.4]** — Synthetic Inertia Response Curve
> **Type:** Multi-trace time-domain chart
> **Content:** Four traces on shared time axis (0–60 seconds). Trace 1 (black): grid frequency, declining from 50.00 Hz, nadir ~49.7 Hz at ~15 s, recovery. Trace 2 (blue): df/dt, sharp negative spike at t=0 triggering response, returning toward zero as frequency stabilises. Trace 3 (amber): power output relative to pre-event level — ΔP_SI burst (0–2 s, ~12 MW above setpoint), transition to LFSM-U droop response (2–30 s), rotor recovery dip (20–45 s, slight below-setpoint period), restoration to normal. Trace 4 (green): rotor speed, held constant 0–1 s, then small decline (1–8 s, kinetic energy extraction), recovery back to optimal by ~40 s. Phase labels: "SI burst", "LFSM-U primary", "rotor recovery".
> **Caption:** Synthetic inertia response from a Type 4 WTG wind farm, showing the four-phase sequence: df/dt-triggered power burst, transition to sustained primary droop, rotor deceleration and recovery. The PPC coordinates rotor recovery to prevent a secondary disturbance during the frequency recovery period.
> **Alt text:** Four-trace chart showing grid frequency, rate of change of frequency, turbine power output relative to setpoint, and rotor speed during a frequency event, with the synthetic inertia burst, LFSM-U droop, and rotor recovery phases labelled.
> **Data source:** Schematic based on ENTSO-E (2022) criteria and Kundur (1994) analysis; representative values for 15 MW Type 4 WTG.
> **Resolution:** 1200 × 800 px minimum

> **Standard reference:** PSE IRiESP (2024), Section 3.4, Paragraph 3.4.7: "Wytwórca morskiej farmy wiatrowej o mocy powyżej 75 MW przyłączonej do sieci 110 kV i powyżej zobowiązany jest do wyposażenia instalacji w funkcję syntetycznej inercji, z wirtualną stałą bezwładności H_SI nie mniejszą niż 4,0 s." [The operator of an offshore wind farm above 75 MW connected at 110 kV and above is obligated to equip the installation with a synthetic inertia function, with a virtual inertia constant H_SI not less than 4.0 s.]

---

## 25.5 Primary Frequency Response: Droop and the Steady State

Synthetic inertia handles the first one to two seconds of a frequency event. After that, the turbines' brief kinetic energy burst has been delivered, and the grid needs sustained power — not a spike but a maintained increase in output that persists until AGC can act. This is the domain of primary frequency response, governed by the droop characteristic introduced in Chapter 22 and deployed through LFSM-U.

The timescale here is qualitatively different. Synthetic inertia responds in under a second because it involves only an electronic command to the converter. Primary response via LFSM-U involves ramping actual power output — changing blade pitch, operating at above-optimal tip-speed ratio, calling on the PPC's dispatch logic to redistribute setpoints across all available turbines. The ramp takes five to thirty seconds, depending on how far the frequency has fallen and how much headroom exists in the current operating point.

The steady-state frequency that the grid settles at after all primary reserve has responded — but before AGC has acted — depends on the aggregate droop characteristic of every responder in the synchronous area. The farm's contribution through droop control begins to become significant when frequency falls below the dead band. For this project's grid code requirements, the dead band is ±100 mHz — tighter than the NC RfG default of ±200 mHz — meaning primary response activates at 49.9 Hz rather than 49.8 Hz.

What matters from the farm's perspective is the maximum generation loss the system can withstand while keeping RoCoF below the protection relay withstand threshold:

$$\Delta P_{L,\max} = \frac{2 \cdot H_\text{sys} \cdot S_\text{sys} \cdot \text{RoCoF}_\max}{f_n}$$

where: Delta P_L,max = maximum generation loss the system can withstand without exceeding RoCoF_max [MW], H_sys = equivalent system inertia constant [s], S_sys = total committed synchronous generation [MVA], RoCoF_max = protection relay withstand threshold [Hz/s] (PSE: 2.0 Hz/s), f_n = 50 Hz.

The physical meaning is a budget calculation. Given a fixed RoCoF threshold that protection relays must not exceed, the maximum permissible single-event generation loss scales linearly with both H_sys and S_sys. As H_sys declines and S_sys shrinks (thermal plants decommissioning reduces both quantities simultaneously), the maximum permissible contingency shrinks. A grid that could safely absorb a 3,000 MW loss under high-inertia conditions might only safely absorb 1,500 MW under low-inertia conditions — not because the physics changed, but because the inertia stock changed.

The three timescales — synthetic inertia (milliseconds to two seconds), LFSM-U primary response (two to thirty seconds), secondary AGC (minutes) — are not redundant. Each fills a gap that the others cannot cover. Synthetic inertia without primary response means the initial RoCoF is arrested but frequency continues to decline slowly because no sustained power injection follows. Primary response without synthetic inertia means primary reserve has to catch up with a faster initial frequency decline, requiring either faster governor response or accepting a lower nadir. Secondary reserve without primary means the frequency oscillates down and up in large swings before AGC can act. The grid code requires all three because removing any one creates a window where frequency cannot be controlled.

---

## 25.6 RoCoF Withstand: Protection Relays in a Low-Inertia World

Legacy power system protection was designed in an era when system inertia was high and certain things could be assumed. One assumption was that rate-of-change-of-frequency exceeding 0.5 Hz/s in a local measurement was a reliable indicator of islanding — the condition where a section of network had become electrically separated from the main grid. Within an island, with generation and load suddenly unbalanced, RoCoF rises rapidly. Setting df/dt protection to trip generators at 0.5 Hz/s made sense: no normal grid event was expected to push system RoCoF that high, so any measured exceedance must be a local islanding condition requiring immediate disconnection for safety reasons.

This logic was sound for the grid composition it was designed for.

As system inertia declined through the 2010s, the assumption began to fail. Large generation contingencies — events within the normal operating envelope of the grid — started producing measured RoCoF approaching or exceeding 0.5 Hz/s at some measurement locations. Protection systems that had been correctly calibrated for high-inertia conditions became incorrectly calibrated for low-inertia conditions. The relays were behaving exactly as designed; the design had become inappropriate.

The 9 August 2019 GB event made the consequences visible at scale. When the combined Hornsea One and Little Barford loss drove RoCoF past 0.5 Hz/s at several measurement points, df/dt protection on distributed generators and some embedded generation tripped additional units. Each additional trip reduced system inertia and committed generation further, which increased RoCoF, which triggered more trips. The positive feedback was bounded — the system did not collapse entirely — but it contributed materially to the depth of the frequency excursion and the volume of load shedding required.

The modern response is captured in NC RfG and the national parameters that implement it. Generators are now required to withstand RoCoF up to 2.0 Hz/s without disconnecting or reducing output. The protection relay must not trip on RoCoF alone. It remains in service, monitoring, but the trip threshold for disconnection requires sustained frequency deviation outside the extreme thresholds: below 47.5 Hz or above 51.5 Hz. A brief RoCoF excursion during a grid event — even a severe one — should not disconnect generation; it should be ridden through.

For the thirty-four turbines and the STATCOM in this project, this means the RoCoF withstand parameter is set to 2.0 Hz/s in every converter control system. The digital phase-locked loop in each converter measures frequency at a 10 ms update interval. The df/dt signal used for both synthetic inertia and protection logic is filtered with a 500 ms sliding window. This filter is essential: instantaneous frequency measurement in a real grid includes measurement noise, voltage distortions, and transients that could produce spurious df/dt spikes on a 10 ms basis. The 500 ms window removes noise while remaining fast enough to detect genuine frequency events in time to be useful for synthetic inertia control.

The interplay between synthetic inertia control (which wants a fast, sensitive df/dt measurement to respond early) and protection relay stability (which wants a slow, filtered df/dt measurement to avoid false trips) is one of the engineering tensions in this domain. The 500 ms window represents a calibrated compromise: fast enough to provide useful synthetic inertia contribution, slow enough to avoid nuisance trips on measurement artefacts.

This is the relay — and the setting — that Sigrid Lund would want to discuss.

---

## 25.X Worked Example: CE Event versus GB August 2019 Conditions

The two events in this chapter — the PSE contingency observed from the OSS control room, and the GB event of 9 August 2019 — involved similar lost generation volumes but produced dramatically different outcomes. Working through the numbers makes clear why.

**Scenario setup**

Two systems, one contingency each:

- CE/PSE system: H_sys = 6.0 s, S_sys = 350,000 MVA, ΔP_L = 1,100 MW (loss of a large thermal unit, eastern Poland)
- GB system (August 2019 conditions): H_sys = 2.0 s, S_sys = 30,000 MVA, ΔP_L = 981 MW (combined Hornsea One + Little Barford loss)
- Wind farm: H_SI = 4.0 s (virtual inertia constant, PSE specification), S_n = 510 MVA (34 turbines × 15 MW)
- Per turbine: H_rotor = 5.2 s (physical rotor), ω_min = 0.90 × ω_0, S_n per turbine = 15 MVA

**Step 1: Initial RoCoF**

For CE:

RoCoF_CE = 50 × 1,100 / (2 × 6.0 × 350,000) = 55,000 / 4,200,000 = **0.013 Hz/s**

For GB:

RoCoF_GB = 50 × 981 / (2 × 2.0 × 30,000) = 49,050 / 120,000 = **0.41 Hz/s**

The GB RoCoF is approximately thirty-two times larger than the CE RoCoF, despite the lost generation being slightly smaller. The difference is entirely in the denominator — H_sys × S_sys.

**Step 2: Time to reach the LFSM-U activation threshold (49.8 Hz from 50.0 Hz)**

This is the time primary reserve has to begin responding before it is needed — a crude but useful measure of urgency.

For CE: t = 0.20 / 0.013 = **15.4 seconds**

For GB: t = 0.20 / 0.41 = **0.49 seconds**

On the CE grid, primary reserve governors have fifteen seconds before frequency has fallen to the LFSM-U threshold. Steam turbine governors can open admission valves, gas turbines can accelerate, hydro units can increase gate opening. On the GB grid under August 2019 conditions, frequency reaches the LFSM-U threshold in under half a second. No mechanical governor responds in half a second.

**Step 3: Synthetic inertia power injection at initial RoCoF**

The constant k_H simplifies the calculation:

k_H = 2 × H_SI × S_n / f_n = 2 × 4.0 × 510 / 50 = **81.6 MW·s/Hz**

For CE: ΔP_SI = 81.6 × 0.013 = **1.1 MW**

For GB equivalent: ΔP_SI = 81.6 × 0.41 = **33.5 MW**

The farm provides 1.1 MW of synthetic inertia injection into a 350,000 MVA grid during the PSE event — small but technically non-zero, and on a trajectory toward greater value as Polish system inertia declines with coal phase-out. Against a GB August 2019 equivalent, the same farm would contribute 33.5 MW of immediate synthetic power — enough to make a measurable difference to the nadir, comparable to a fast-response open-cycle gas turbine fully loaded.

**Step 4: Available kinetic energy from rotor deceleration**

For a single turbine:

ΔE_per_turbine = H_rotor × S_n × [1 − (ω_min/ω_0)²] = 5.2 × 15 × [1 − 0.9²] = 78 × 0.19 = **14.8 MJ**

For thirty-four turbines:

ΔE_farm = 34 × 14.8 = **503 MJ**

Five hundred and three megajoules is a quantity worth visualising. It is approximately equivalent to the kinetic energy of a fully loaded Shinkansen N700 series bullet train — 715 tonnes at operational speed — accelerated from rest to 250 km/h. That energy is stored in the spinning mass of thirty-four rotors, charged by the wind, available for controlled electrical release over roughly sixty seconds if the farm is operating in rated conditions and all rotors are at full speed. The energy does not expire between events; it is recharged by the next gust.

**Step 5: Maximum tolerable generation loss for a given RoCoF threshold**

With RoCoF_max = 2.0 Hz/s (NC RfG and PSE mandatory threshold for protection relay withstand):

For CE: ΔP_max = 2 × 6.0 × 350,000 × 2.0 / 50 = **168,000 MW**

No realistic generation contingency in the CE synchronous area approaches 168,000 MW. The RoCoF withstand threshold is never going to be challenged by a grid event in CE at current inertia levels. The threshold is set for resilience against future inertia decline.

For GB (August 2019 conditions): ΔP_max = 2 × 2.0 × 30,000 × 2.0 / 50 = **4,800 MW**

The GB budget is sixty times smaller. A coordinated event — three large generation units tripping simultaneously — could exceed 4,800 MW. Even without coordination, operating near the margin means normal contingency events push RoCoF toward the protection relay threshold. And as the GB event showed, when df/dt protection begins tripping generators, ΔP_L grows and H_sys simultaneously shrinks.

**Comparison table**

| Parameter | CE / PSE Event | GB / Aug 2019 Equivalent |
|---|---|---|
| ΔP_L | 1,100 MW | 981 MW |
| H_sys | 6.0 s | 2.0 s |
| S_sys | 350,000 MVA | 30,000 MVA |
| Initial RoCoF | 0.013 Hz/s | 0.41 Hz/s |
| Time to 49.8 Hz | 15.4 s | 0.49 s |
| ΔP_SI from farm | 1.1 MW | 33.5 MW |
| ΔP_max (RoCoF = 2.0 Hz/s) | 168,000 MW | 4,800 MW |
| Outcome | Controlled, nadir 49.67 Hz | LFDD, approximately 1M customers affected |

**Financial dimension**

The £200 million per year that National Grid ESO now spends on Enhanced Frequency Response and Dynamic Containment services is the market's belated recognition of something that had been provided for free for a century. When thermal plant with high H sat at the bottom of the dispatch stack, always committed, it provided inertia as a free by-product of being connected and spinning. When that plant retires and is replaced by solar PV, batteries, and converter-connected wind, the inertia does not retire gradually — it disappears precisely when the plant goes offline. The £200M figure is, in a narrow engineering sense, the cost of purchasing synthetically what had previously been an incidental property of the fuel combustion business.

---

## Key Takeaways

- The inertia constant H quantifies stored kinetic energy per rated MVA. For a hundred years it was a free by-product of synchronous generation; with full-power converters, it must be deliberately engineered into the control system because the converter isolates rotor dynamics from grid dynamics by design.

- Initial RoCoF after a generation loss is determined entirely by system inertia and committed generation in the moments before the event — not by protection settings, not by operator action, not by grid code. Lower H_sys means faster frequency collapse for any given contingency. The swing equation is not negotiable.

- Type 4 WTGs can provide synthetic inertia proportional to the measured df/dt within milliseconds — faster than any mechanical governor — but only if the control logic has been explicitly designed, parameterised, and tested. The physical rotor energy is always present; the converter determines whether the grid ever sees it.

- The 9 August 2019 GB event demonstrated that low-inertia grid operation is not a future risk scenario. A system where RoCoF reaches 0.41 Hz/s during a normal contingency event is a system where protection settings calibrated for high-inertia conditions become actively harmful, triggering additional disconnections that compound the original disturbance.

- Synthetic inertia, primary droop response through LFSM-U, and secondary AGC restoration operate at three distinct timescales — milliseconds to seconds, seconds to thirty seconds, and minutes — and each fills a gap the others cannot reach. Removing any one creates a window where frequency cannot be controlled.

---

## For Further Reading

1. Kundur, P. (1994). *Power System Stability and Control*. McGraw-Hill, New York. ISBN 978-0070359581.[^1]

2. National Grid ESO and Ofgem (2019). *Investigation into the events of 9 August 2019: Interim Report*. National Grid ESO, Warwick, December 2019. Available at nationalgrideso.com.[^2]

3. ENTSO-E (2022). *Frequency Stability Evaluation Criteria for the Synchronous Zone of Continental Europe — Requirements and Methods*. ENTSO-E, Brussels, May 2022. Available at entso-e.eu.[^3]

---

*The frequency readout reached 49.85 Hz at 22:31. Seventeen minutes after Piotr Zawadzki's initial confirmation call, the display showed a trace that had flattened, then tilted upward with the slow certainty of a tide turning.*

*The radio crackled.*

*"Baltic Wind, PSE Warsaw, Zawadzki. Event closed. All reserve obligations fulfilled. Bełchatów and Kozienice contingency reserve fully deployed. No load shedding in PSE control area. Frequency stable at 49.92 and recovering. Thank you for monitoring."*

*"PSE Warsaw, Baltic Wind. Understood. No anomalies at offshore substation. Baltic Wind out."*

*Anders replaced the handset and poured himself a coffee from the control room thermos. He poured one for Kaan without asking.*

*"Twelve megawatts into three hundred gigawatts," Kaan said. He was looking at the historian trace, the synthetic inertia spike that had appeared and disappeared in the first second. A needle of amber on the screen. "It looks almost decorative from here."*

*"It is decorative," Anders said. "Tonight, for this event, in this grid. The mathematics are straightforward." He turned the coffee cup in his hands. "But the regulatory obligation is not written for tonight. It is written for 2032, when three of the large coal units in Pątnów and Turów are offline, when the aggregate inertia constant for the Polish system is two-point-something instead of six, and when the same generation trip you just watched creates a RoCoF of not zero-point-013 but zero-point-four. The requirement exists now so that the capability exists then. Grid codes are always written for the grid that is coming, not the grid that is here."*

*Kaan looked at the frequency trace, now flat at 49.96 and climbing in fractional steps back toward 50.00. He thought about the swing equation. Somewhere in eastern Poland, the governor on a steam turbine at Kozienice was sitting at a slightly more open position than it had been twenty minutes ago, holding a small additional load. In Germany, in France, in Spain, in every country connected to the CE synchronous area, the same physics was operating: every spinning rotor, without instruction, without communication, without anyone asking, pulling against the shared frequency like a mechanical consensus. Individual machines, unknown to each other, synchronised by the laws that governed rotating mass.*

*The aggregate of it was 50.00 Hz, and it was being rebuilt one watt at a time across a continent.*

*Anders finished his coffee. "Tomorrow, Sigrid wants to walk you through the protection relay that governs that two-point-zero threshold. The relay that was watching tonight." He paused. "The one we just tested — without testing it."*

*He looked at the frequency display, now reading 49.99.*

*"You want to understand what it took to make sure it did not trip."*

---

[^1]: Kundur, P. (1994). *Power System Stability and Control*. McGraw-Hill, New York. ISBN 978-0070359581. Chapter 15 provides the foundational treatment of the swing equation, inertia constant, and frequency dynamics underlying every formula in this chapter. Kundur's analysis of the relationship between RoCoF, system inertia, and primary reserve timescales remains the authoritative reference for control engineers approaching frequency stability from a mathematical background. Chapter 12 (small-signal stability and eigenvalue analysis) provides the theoretical grounding for understanding why the three-phase decomposition of frequency events is not merely descriptive but reflects distinct eigenvalue modes of the system.

[^2]: National Grid ESO and Ofgem (2019). *Investigation into the events of 9 August 2019: Interim Report*. National Grid ESO, Warwick, December 2019. Available at: [nationalgrideso.com/document/152701/download]. The investigation documents the event timeline, measured frequency data at multiple measurement points, protection relay activation sequence, generation loss sequence, and remedial actions mandated in response. Appendix A contains the measured frequency trace and measured RoCoF values used in this chapter's analysis. Engineers designing synthetic inertia and RoCoF withstand parameters for any European grid connection should read this document alongside their TSO's current parameterisation of NC RfG Article 13 — the gap between what August 2019 demonstrated and what legacy protection settings assumed is precisely the gap that modern requirements are designed to close.

[^3]: ENTSO-E (2022). *Frequency Stability Evaluation Criteria for the Synchronous Zone of Continental Europe — Requirements and Methods*. ENTSO-E, Brussels, May 2022. Available at: [entso-e.eu/publications]. This document establishes the analytical basis for frequency stability limits in the CE synchronous area, including: the maximum instantaneous power imbalance (reference incident, currently 3,000 MW for CE), minimum equivalent inertia thresholds for secure operation, and RoCoF withstand obligations for connected generation. Section 4 describes the methodology by which national TSOs — including PSE — derive their own parameters within the ENTSO-E framework, which explains why the CE area's 0.013 Hz/s RoCoF for a 1,100 MW contingency is consistent with grid code compliance while the GB system's 0.41 Hz/s for a comparable event was not. Essential context for anyone seeking to understand why CE and GB grid codes arrived at different mandatory synthetic inertia requirements from the same ENTSO-E framework.
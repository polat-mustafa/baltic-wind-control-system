# Chapter 14: Submarine Cables — 45 Kilometres Under the Sea

*The cable was heavier than he expected.*

*Nora Henriksen had handed Kaan a thirty-centimetre slice of decommissioned submarine cable — a cross-section cut cleanly through all its layers, polished smooth on both faces — and it weighed as much as a bag of cement. He held it in both hands, turning it under the deck lights of the cable lay vessel, studying the concentric rings: a core of stranded copper the colour of a new penny, surrounded by a band of translucent plastic, then a thin grey sleeve of lead, then a cage of helically wound steel wires, and finally an outer wrapping of coarse black yarn. It looked like the trunk of a mechanical tree, each ring a growth layer recording a different engineering problem that someone had solved.*

*"Each layer exists because the last one was not enough," Nora said. She was the project's cable engineer — Norwegian, mid-thirties, with the unhurried precision of someone who had spent a decade planning, manufacturing, and installing submarine cables. She had begun her career at a cable factory in Halden, Norway — a town that had been producing submarine cables since the 1970s, when the first Skagerrak interconnectors linked Norway and Denmark beneath the sea. She wore a hard hat and steel-toed boots like everyone else on the vessel, but she also carried a transparent ruler marked in millimetres, which she now pressed against the cable cross-section to measure the insulation thickness. "Twenty-four millimetres of cross-linked polyethylene," she said. "That is what stands between two hundred and twenty thousand volts and the sea."*

*They stood on the aft deck of the cable lay vessel, beside the carousel — a steel turntable twenty-two metres in diameter, sunk into the deck like a sunken amphitheatre, holding seven thousand tonnes of cable wound in concentric rings. This was the cable that Pieter had pointed to the day before from the jack-up vessel: eighty-five kilometres of it, enough for two runs to shore, each forty-five kilometres long. The carousel rotated slowly as the vessel moved along the planned route, feeding cable over the stern through a set of tensioners and down to the seabed thirty metres below.*

*"People think the turbines are the wind farm," Nora said, taking the cable cross-section back from Kaan and running her finger along the copper core. "The turbines generate the power. But this — " she tapped the polished face — "this is how the power reaches the people who need it. One hundred and fifty kilometres of cable, buried in the seabed, connecting thirty-four turbines to an offshore substation and the substation to shore. If any section fails, the power does not flow. And repairing a cable on the seabed takes two months, not two days." She set the cross-section on a cable drum and looked at him. "So. Let me show you what is inside this thing, and why every layer matters."*

---

## 14.1 The Anatomy of a Submarine Cable

The submarine power cable is among the oldest forms of engineered electrical infrastructure, and its fundamental challenge has not changed since the first attempt: how to transmit electrical energy through a medium — seawater — that is both corrosive and conductive.

On 28 August 1850, John Watkins Brett's English Channel Submarine Telegraph Company laid the first undersea cable to link two countries, running a single copper conductor insulated with gutta-percha (the latex of the Palaquium tree) from Dover to Cap Gris-Nez across the English Channel. The cable had no armouring. A French fisherman snagged it with his trawl within hours, hauled up a section, and — finding the strange substance wrapped around a copper wire — reportedly concluded that he had discovered a new species of gold-bearing seaweed. The cable was destroyed. [1]

The lesson was immediate: insulation alone is not enough. A year later, in September 1851, a second cable — this one wrapped in iron wire armour — was laid successfully. It operated for years. The principle established in 1851 remains the design philosophy of every submarine cable built since: **the conductor carries the current; the insulation contains the voltage; and the armour protects both from the mechanical violence of the sea.**

A modern submarine power cable, whether rated at 66 kV for an array connection or 220 kV for an export link to shore, is constructed in concentric layers from the inside out:

| Layer | Material | Function |
|---|---|---|
| 1. Conductor | Stranded copper (Milliken segmental for ≥800 mm²) | Carries the current |
| 2. Conductor screen | Extruded semi-conducting compound | Smooths the electric field at the conductor surface |
| 3. Insulation | XLPE (cross-linked polyethylene) | Withstands the operating voltage |
| 4. Insulation screen | Extruded semi-conducting compound | Smooths the electric field at the insulation surface |
| 5. Metallic sheath | Lead alloy, ~2.5–3.0 mm thick | Water barrier (impervious to moisture) |
| 6. Filler / bedding | Polypropylene rope, optical fibres | Fills interstices, houses DTS fibres |
| 7. Inner sheath | Polyethylene jacket | Corrosion protection for armour |
| 8. Armour | Galvanised steel wires, ~5–6 mm diameter | Mechanical protection during laying and service |
| 9. Outer serving | Polypropylene yarn | Corrosion protection for armour |

The insulation is the most critical layer. Early submarine cables used oil-impregnated paper wrapped around the conductor — a technology borrowed from telegraph cables and refined over a century. In 1963, General Electric patented cross-linked polyethylene (XLPE), a thermoplastic whose molecular chains are chemically bonded into a three-dimensional network by heating with peroxide. XLPE permits a continuous conductor temperature of 90 °C (compared to 70 °C for PVC and 85 °C for oil-impregnated paper), has excellent dielectric strength, and does not leak oil when cut — a significant advantage for submarine repair operations. By the 1990s, XLPE had displaced paper insulation for most submarine AC cables up to 220 kV. [2]

The lead sheath deserves particular attention. Lead is heavy, expensive, and environmentally problematic — yet it remains the standard water barrier for submarine cables because no alternative matches its combination of impermeability, flexibility, and resistance to the alkaline conditions inside a cable. A submarine cable spends its entire life submerged in seawater at pressures of 2 to 4 bar (at 20 to 40 metres depth). Any breach of the water barrier allows moisture to penetrate the insulation, creating microscopic channels called "water trees" that grow under electrical stress until the insulation fails — a process that can take months or years but is irreversible once started. The 2.5-millimetre lead sheath is the cable's immune system: remove it, and the cable's life is measured in years, not decades. [3]

Woven into the filler between the three cores is a bundle of optical fibres thinner than a human hair. These are not for communication — they are a **distributed temperature sensing** (DTS) system. A laser pulse injected at one end of the fibre produces scattered light whose wavelength shifts with temperature (Raman backscatter). By analysing the return signal, operators can measure the temperature at every point along the cable's route with a spatial resolution of approximately one metre. If any section begins to overheat — due to reduced burial depth, a thermal bottleneck at a crossing, or unexpected soil drying — the DTS provides a warning hours or days before the insulation reaches its 90 °C limit. [4]

<!-- IMAGE: fig-14-01 -->
> **Figure 14.1** — Cross-section of a 220 kV three-core submarine XLPE cable
> **Type:** annotated photograph / technical illustration
> **Content:** A polished cable cross-section approximately 280 mm in diameter, with each concentric layer labelled: (1) copper Milliken conductor, (2) semi-conducting conductor screen, (3) XLPE insulation (24 mm), (4) semi-conducting insulation screen, (5) lead alloy sheath, (6) polypropylene filler with optical fibre bundle visible, (7) PE inner sheath, (8) galvanised steel wire armour, (9) polypropylene outer serving. Scale bar in millimetres. Inset: comparison with a human hand for size reference.
> **Caption:** A submarine power cable is not a wire — it is a seven-layer containment system engineered to carry 220,000 volts through 45 kilometres of seawater for 30 years without maintenance.
> **Alt text:** Annotated cross-section of a three-core 220 kV submarine power cable showing nine concentric layers from copper conductor to outer polypropylene serving, approximately 280 mm in overall diameter.
> **Data source:** Author illustration based on Nexans, Prysmian, and NKT product documentation.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Copper core in natural copper colour, XLPE insulation in translucent amber, lead sheath in grey, steel armour in metallic silver, outer serving in black

---

## 14.2 Two Voltages, Two Missions

A 500 MW offshore wind farm requires two entirely different cable systems, each operating at a different voltage and serving a different purpose.

**Array cables** operate at 66 kV and connect the turbines to the offshore substation (OSS). They are three-core cables — all three phases bundled inside a single armoured cylinder — with conductor cross-sections that vary along each string to match the cumulative current flow. The turbine at the end of a string produces 15 MW at 66 kV, which corresponds to a current of 131 A per phase. The next turbine adds another 131 A, and so on, until the cable nearest the OSS carries the current of five or six turbines — 655 to 786 A. This is why array cables use **tapered cross-sections**: 185 mm² at the string end (rated 375 A), 500 mm² in the middle (rated 615 A), and 800 mm² near the OSS (rated 750 A). [5]

The industry's shift from 33 kV to 66 kV array cables, which began around 2015, doubled the power capacity per cable for a modest increase in cost. At 66 kV, a single 800 mm² cable can carry approximately 86 MVA — enough for five 15 MW turbines. At 33 kV, the same cable could carry only 43 MVA, requiring twice as many strings and twice as many cable pull-ins. The move to 66 kV roughly halved the total length of array cable needed for a given farm layout. [6]

**Export cables** operate at 220 kV and carry the farm's entire output from the OSS to the onshore grid connection point. The rated current for a 510 MW farm at 220 kV is:

$$
I_{\text{rated}} = \frac{P}{\sqrt{3} \times V} = \frac{510{,}000}{\sqrt{3} \times 220} = 1{,}338 \text{ A}
$$

No single three-core cable at 220 kV can carry 1,338 A continuously — the thermal limit of a 1,000 mm² conductor is approximately 800 A when buried in typical seabed soil. The solution is **two parallel export cables**, each carrying half the farm's output (~670 A). This also provides N-1 redundancy: if one cable fails, the other can carry reduced power to shore while repairs are arranged. [7]

The difference between the two cable types is visible in their physical dimensions:

| Parameter | 66 kV Array (800 mm²) | 220 kV Export (1,000 mm²) |
|---|---|---|
| Insulation thickness | 8 mm | 24 mm |
| Overall diameter | ~225 mm | ~280 mm |
| Weight in air | ~85 kg/m | ~125 kg/m |
| Weight in water | ~50 kg/m | ~75 kg/m |
| Ampacity (buried) | ~750 A | ~800 A |
| Power rating (3-phase) | ~86 MVA | ~305 MVA |

The insulation thickness is the dominant difference: 24 mm of XLPE for 220 kV versus 8 mm for 66 kV. The insulation must withstand not only the continuous operating voltage but also transient overvoltages — lightning impulses, switching surges, and fault-induced spikes. The basic impulse level (BIL) for a 220 kV cable is 1,050 kV; for 66 kV, it is 325 kV. [8]

The current flowing through the conductor generates heat (I²R losses), and the cable's current-carrying capacity — its **ampacity** — is determined not by the conductor's ability to carry current but by the insulation's ability to survive the resulting temperature. This is the heat problem.

<!-- IMAGE: fig-14-02 -->
> **Figure 14.2** — Array cable topology for a 34-turbine offshore wind farm
> **Type:** plan-view schematic / map
> **Content:** Bird's-eye view of 34 turbine positions arranged in a staggered grid, connected to a central OSS by 7 radial strings (6 strings of 5 turbines, 1 string of 4 turbines). Cable cross-sections are colour-coded: green for 185 mm² (end of string, 1 turbine), amber for 500 mm² (mid-string, 2–3 turbines), red for 800 mm² (near OSS, 4–5 turbines). Two 220 kV export cables shown running from OSS toward shore (southwest). OSS symbol at centre. Compass rose indicating predominant wind direction (WSW).
> **Caption:** Array cables connect turbines in radial strings with tapered cross-sections — thicker near the substation where cumulative current is highest. Two parallel 220 kV export cables carry the farm's output to shore.
> **Alt text:** Plan view of a 34-turbine offshore wind farm showing seven radial array cable strings connecting to a central offshore substation, with two export cables running to shore. Cable thickness increases toward the substation.
> **Data source:** Author illustration based on generic 500 MW farm layout.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Turbines as blue circles, OSS as orange square, cable colours graded from green (thin) to red (thick), sea in light blue, export cables in purple

> **Standard reference:** IEC 63026:2023, "Submarine power cables with extruded insulation and their accessories for rated voltages from 6 kV (Um = 7.2 kV) up to 60 kV (Um = 72.5 kV)." Defines design, testing, and type approval requirements for submarine array cables, including bending tests, water penetration tests, and installation load tests specific to offshore wind applications. [9]

---

## 14.3 The Heat Problem

A buried submarine cable is a heat source trapped inside a thermal blanket. The conductor generates heat through resistive losses; that heat must flow outward through the insulation, lead sheath, armour, and surrounding soil to the ambient seawater. If the heat cannot escape fast enough, the conductor temperature rises until the XLPE insulation degrades — and 90 °C is the absolute limit.

The international standard for calculating cable ampacity is **IEC 60287**, which models the cable as a thermal circuit analogous to an electrical circuit: heat flow (in watts per metre) replaces current, temperature difference replaces voltage, and thermal resistance (in K·m/W) replaces electrical resistance. The cable's concentric layers become a series of thermal resistors:

| Thermal Resistance | Description | Typical Value |
|---|---|---|
| $T_1$ | Insulation (conductor to sheath) | 0.4–0.8 K·m/W |
| $T_2$ | Bedding (sheath to armour) | 0.1–0.3 K·m/W |
| $T_3$ | Outer serving (armour to surface) | 0.05–0.15 K·m/W |
| $T_4$ | Surrounding medium (cable surface to ambient) | 0.5–3.0 K·m/W |

The external thermal resistance $T_4$ dominates. For a cable buried at depth $L$ below the seabed surface with external diameter $D_e$, it is calculated as:

$$
T_4 = \frac{\rho_{\text{soil}}}{2\pi} \ln\!\left(\frac{2L}{D_e} + \sqrt{\left(\frac{2L}{D_e}\right)^2 - 1}\right)
$$

where:
- $T_4$ = external thermal resistance [K·m/W]
- $\rho_{\text{soil}}$ = thermal resistivity of the seabed soil [K·m/W]
- $L$ = burial depth to cable centre [m]
- $D_e$ = cable external diameter [m]

The thermal resistivity of the soil is the single most important parameter in the entire calculation. It varies by an order of magnitude depending on the soil type:

| Seabed Material | $\rho_{\text{soil}}$ [K·m/W] |
|---|---|
| Saturated sand | 0.7–1.0 |
| Saturated clay / silt | 1.0–1.5 |
| Mixed glacial till (Baltic) | 0.8–1.3 |
| Dried-out sand | 2.5–4.0 |
| Dried-out clay | 2.0–3.5 |

The difference between saturated and dried-out soil reveals a dangerous positive feedback loop. Water is an excellent thermal conductor ($\rho \approx 0.6$ K·m/W); air is a terrible one ($\rho \approx 40$ K·m/W). When a buried cable heats the surrounding soil above a critical temperature — typically 40 to 60 °C — moisture migrates away from the cable, creating a dried-out annulus. The dried zone has two to four times higher thermal resistivity, which further increases the conductor temperature, which drives more moisture away. Left unchecked, this thermal runaway can push the conductor past 90 °C and destroy the insulation. IEC 60287 accounts for this by requiring the designer to assume a dried-out zone within a critical isotherm radius and to use the higher thermal resistivity for that zone. [10]

The steady-state ampacity — the maximum continuous current the cable can carry — is given by the IEC 60287 master equation:

$$
I = \sqrt{\frac{\Delta\theta - W_d \left[0.5\,T_1 + n\,(T_2 + T_3 + T_4)\right]}{R_{\text{ac}}\left[T_1 + n\,(1 + \lambda_1)\,T_2 + n\,(1 + \lambda_1 + \lambda_2)\,(T_3 + T_4)\right]}}
$$

where:
- $I$ = continuous current rating (ampacity) [A]
- $\Delta\theta$ = permissible temperature rise = $\theta_{\max} - \theta_{\text{ambient}}$ [K]
- $W_d$ = dielectric losses per phase [W/m]
- $R_{\text{ac}}$ = AC resistance of conductor at $\theta_{\max}$ [Ω/m]
- $\lambda_1$ = ratio of sheath losses to conductor losses [dimensionless]
- $\lambda_2$ = ratio of armour losses to conductor losses [dimensionless]
- $T_1, T_2, T_3, T_4$ = thermal resistances [K·m/W]
- $n$ = number of load-carrying conductors in the cable

The equation is an energy balance: the numerator represents the available temperature budget after subtracting losses that do not depend on current (dielectric losses in the insulation); the denominator represents the thermal path that current-dependent losses (I²R heating in conductor, sheath, and armour) must traverse to reach the ambient. The designer's goal is to maximise $I$ — and the only variables under engineering control are the conductor size (which sets $R_{\text{ac}}$), the burial depth (which affects $T_4$), and the soil conditions (which set $\rho_{\text{soil}}$).

> **Standard reference:** IEC 60287-1-1:2023, "Electric cables — Calculation of the current rating — Part 1-1: Current rating equations (100% load factor) and calculation of losses — General." The foundational standard for cable thermal rating, used worldwide for both land and submarine cables. Part 2-1 covers thermal resistance calculations; Part 3-1 specifies reference operating conditions. [11]

<!-- IMAGE: fig-14-03 -->
> **Figure 14.3** — IEC 60287 thermal circuit model for a three-core submarine cable
> **Type:** circuit diagram / schematic
> **Content:** Thermal equivalent circuit showing: conductor as a heat source (I²R_ac), dielectric loss source (W_d) at the insulation midpoint, four thermal resistances (T1 through T4) in series from conductor to ambient seabed temperature θ_amb. Sheath losses (λ₁·I²R) and armour losses (λ₂·I²R) shown as additional heat sources between T2/T3. Temperature labels at each node: θ_conductor (max 90°C), θ_sheath, θ_armour, θ_surface, θ_ambient (~10–15°C for Baltic). Arrow showing heat flow direction (outward).
> **Caption:** The IEC 60287 thermal circuit treats a submarine cable as a series of heat sources and thermal resistances. The cable's current rating is limited by the temperature at which the innermost node — the conductor — reaches 90 °C.
> **Alt text:** Thermal equivalent circuit diagram of a three-core submarine cable showing conductor losses, dielectric losses, sheath losses, and armour losses as heat sources, connected through four thermal resistances T1 through T4 to the ambient seabed temperature.
> **Data source:** Author illustration based on IEC 60287-1-1:2023.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Heat sources in red, thermal resistances in blue, temperature nodes in black, ambient in green

---

## 14.4 The Capacitor You Did Not Order

There is a second problem with submarine cables that has nothing to do with heat and everything to do with geometry.

A submarine cable is a cylindrical capacitor. The copper conductor at high voltage is separated from the grounded lead sheath by a layer of XLPE insulation — a dielectric. This capacitance draws a leading (capacitive) current even when no turbine is generating a single watt of power. The moment the cable is energised, reactive current begins to flow.

The charging current per phase per kilometre is:

$$
I_c = U_0 \cdot \omega \cdot C
$$

where:
- $I_c$ = charging current [A/km per phase]
- $U_0$ = phase-to-earth voltage = $V / \sqrt{3}$ [V]
- $\omega$ = angular frequency = $2\pi f$ [rad/s]
- $C$ = capacitance per phase per kilometre [F/km]

And the total three-phase reactive power generated by a cable of length $L$ is:

$$
Q_c = \omega \cdot C \cdot V^2 \cdot L
$$

where:
- $Q_c$ = reactive power generated [VAr]
- $V$ = line-to-line voltage [V]
- $C$ = capacitance per phase [F/km]
- $L$ = cable length [km]

For a 220 kV export cable with a typical capacitance of 0.17 μF/km, the numbers are startling. The charging current is 6.8 A per phase per kilometre. Over forty-five kilometres, that accumulates to 306 A per phase — **thirty-eight percent of the cable's 800 A thermal rating** — consumed by reactive current before a single watt of real power has been transmitted. The total reactive power generated by one cable is approximately 116 MVAR; two parallel export cables generate 232 MVAR. This is reactive power that must be absorbed somewhere, or the voltage at the cable's open end will rise above statutory limits — the Ferranti effect that Elif had described over coffee in the SOV common room, weeks earlier. [12]

The charging current and the load current are ninety degrees out of phase, so they add in quadrature rather than arithmetically:

$$
I_{\text{total}} = \sqrt{I_{\text{load}}^2 + I_c^2}
$$

For a cable carrying 670 A of load current and 306 A of charging current: $I_{\text{total}} = \sqrt{670^2 + 306^2} = 737$ A, which is within the 800 A rating. But without reactive compensation, the charging current would consume cable capacity that could otherwise carry real power to shore.

This is why the project's single-line diagram includes a **50 MVAR shunt reactor** at the offshore substation. The reactor is a large iron-cored inductor, permanently connected to the cable, that absorbs a fixed quantity of reactive power and reduces the charging current flowing through the cable. The **±120 MVAR STATCOM** provides dynamic compensation — absorbing or generating reactive power as the farm's output varies from zero to rated. The detailed design of the reactive compensation system belongs to Chapter 20; the point here is that the cable itself creates the need. Every kilometre of 220 kV submarine cable acts as a 2.6 MVAR capacitor that nobody ordered but everybody must pay for.

This capacitive generation also imposes a **maximum practical length for AC submarine cables**. As voltage and length increase, the charging current eventually consumes the cable's entire ampacity, leaving nothing for real power. At 220 kV, the economic limit is approximately 80 to 100 kilometres (with reactive compensation); at 400 kV, it shrinks to 25 to 40 kilometres. Beyond these distances, HVDC transmission — which generates no reactive current because DC has no frequency — becomes the only viable option. The world's first HVDC submarine power cable, the Gotland link built by ASEA in 1954, transmitted 20 MW at 100 kV DC over 98 kilometres from the Swedish mainland to the island of Gotland. It used mercury arc valves for AC-DC conversion. Seventy years later, the principle remains the same: when AC cables become impractical, DC takes over. The Viking Link between the United Kingdom and Denmark, commissioned in December 2023, stretches 765 kilometres — the longest land-and-subsea interconnector in the world — and operates at ±525 kV DC. [13]

---

## 14.5 From Carousel to Seabed

The cable lay vessel on which Kaan stood was one of perhaps a dozen purpose-built ships in the world capable of installing high-voltage submarine cables for offshore wind farms. These vessels are among the most specialised — and most expensive — assets in the offshore construction fleet. A single CLV charter costs EUR 150,000 to 250,000 per day, and a cable installation campaign for a large wind farm takes three to six months. [14]

The vessel's defining feature is the **carousel** — a below-deck turntable, typically 20 to 28 metres in diameter, that holds 5,000 to 10,000 tonnes of cable wound in concentric rings. The cable is loaded onto the carousel at the factory quayside, where it is manufactured in a continuous process and spooled directly from the production line. A single carousel load may contain 40 to 50 kilometres of export cable or 80 to 100 kilometres of array cable (which is lighter per metre). The loading process takes several days and is itself a critical operation — any kink, twist, or over-bend during loading can damage the cable before it ever reaches the seabed. [15]

The lay procedure follows a sequence that has been refined over decades of practice:

1. **First-end pull-in.** The cable end is transferred from the CLV to the foundation (monopile or OSS) using a messenger wire pre-installed through a J-tube — a steel tube welded to the outside of the transition piece, curving from a bell-mouth opening above the seabed through a 90-degree bend up to platform level. A winch at the top pulls the cable through the tube at 5 to 15 tonnes of tension. At the top, the cable is secured with a **hang-off clamp** that grips the armour wires and transfers the cable's self-weight to the foundation structure.

2. **Lay-away.** The vessel moves along the pre-surveyed route at 200 to 500 metres per hour, paying out cable over the stern through a set of tensioners that control the catenary — the curve the cable makes between the vessel and the seabed. Too little tension and the cable forms loops on the seabed; too much and it is pulled taut against the vessel's roller, risking damage to the outer serving.

3. **Simultaneous burial.** A jetting sled or plough, towed behind the vessel or mounted on a remotely operated vehicle (ROV), buries the cable as it is laid. **Jet trenching** — the most common method in sandy and soft clay seabeds — uses high-pressure water jets to fluidise the sediment; the cable sinks under its own weight into the liquefied soil, which then reconsolidates around it. Target burial depth is typically 1.0 to 1.5 metres below the natural seabed, increasing to 2.0 metres in shipping lanes where anchor strikes are a risk. In harder soils — stiff clay, glacial till, soft rock — **mechanical trenchers** with chain-cutters or disc-cutters are used instead. [16]

4. **Second-end pull-in.** The cable is pulled into the J-tube at the destination foundation, completing the circuit.

5. **Post-lay survey.** An ROV surveys the entire route, measuring the **depth of lowering** (the distance from the original seabed surface to the top of the cable) using a cable tracker — a sensor that detects the cable's electromagnetic field through the sediment.

Where burial is not achievable — at crossings of existing pipelines or telecom cables, on rocky seabed, or at locations where the soil is too hard for trenching — the cable is protected by **rock placement** (graded stone dumped from a fall-pipe vessel in a controlled berm), **concrete mattresses** (pre-fabricated slabs, 6 m × 3 m, weighing 3 to 5 tonnes each), or **cast-iron half-shells** bolted around the cable. Crossing agreements with the owners of existing seabed infrastructure — pipelines, telecom cables, other power cables — are negotiated during the consenting phase and specify the crossing angle (minimum 30°, preferably 90°), vertical separation (minimum 0.3 m), and protection method. [17]

The landfall — where the cable transitions from the seabed to the onshore cable route — is typically achieved by **horizontal directional drilling** (HDD). A drill rig onshore bores a curved tunnel 10 to 30 metres below the seabed, emerging at a pre-excavated pit on the beach or in shallow water. The cable is pulled through the bore and jointed to the onshore cable. The HDD section is often the thermal bottleneck of the entire cable route, because the disturbed soil has a higher thermal resistivity (1.5 to 3.0 K·m/W) than the undisturbed seabed. [18]

<!-- IMAGE: fig-14-04 -->
> **Figure 14.4** — Cable lay vessel installing a submarine cable with simultaneous jet burial
> **Type:** side-view technical illustration
> **Content:** Cross-section view of a CLV showing: (1) the below-deck carousel with cable wound in concentric rings, (2) the cable paying out over the stern through a tensioner, (3) the cable catenary descending to the seabed, (4) a jetting ROV at the seabed burying the cable in a fluidised trench. The seabed layers (sand, clay) are visible in cross-section. The cable's burial depth (1.5 m) is annotated. The vessel's DP2 thrusters are visible below the waterline. Water depth labelled as 30 m.
> **Caption:** A cable lay vessel pays out cable from a below-deck carousel while a jetting ROV simultaneously buries it 1.5 metres below the seabed. The operation proceeds at 200 to 500 metres per hour, governed by weather and soil conditions.
> **Alt text:** Side-view illustration of a cable lay vessel showing a carousel below deck, cable feeding over the stern, descending through the water column, and being buried in the seabed by a remotely operated jetting vehicle.
> **Data source:** Author illustration based on industry documentation from Nexans, Prysmian, and Jan De Nul.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Blue for water, brown/tan for seabed, vessel in grey/white, cable in black, jetting ROV in yellow

---

## 14.6 When the Highway Breaks

Submarine cables account for approximately 10 percent of an offshore wind farm's capital expenditure. They account for approximately **80 percent of its insurance claims**. [19]

This statistic, widely cited across the offshore wind industry, reflects a simple reality: cables are long, they are buried in an environment that cannot be inspected without mobilising a vessel, and they are vulnerable to damage at every stage of their life — during manufacturing, during installation, and during decades of service on the seabed. The average failure rate for offshore wind submarine cables in European waters is approximately 0.003 failures per kilometre per year. For a farm with 150 kilometres of cable, this translates to a 36 percent probability of at least one cable failure in any given year. [20]

The root causes of cable failures, drawn from industry databases, reveal that most damage occurs before the cable ever enters service:

| Root Cause | Share of Failures |
|---|---|
| Installation damage (over-bending, excessive tension, anchor/equipment impact) | ~46% |
| Manufacturing defects (insulation voids, sheath pinholes, joint assembly errors) | ~31% |
| Design issues (under-rated thermal capacity, inadequate protection) | ~15% |
| External damage in service (anchors, fishing gear, dredging) | ~8% |

Repairing a submarine cable is not a matter of splicing two wires. It is a major marine operation that requires a cable repair vessel, an ROV, a weather window, and a team of specialist jointers — and it takes weeks to months.

The standard repair procedure produces a characteristic shape on the seabed called an **omega loop** (named for its resemblance to the Greek letter Ω):

1. **Fault location.** Time-domain reflectometry (TDR) from shore pinpoints the fault location to within a few metres by measuring the reflection of a voltage pulse from the point of damage.

2. **Cable recovery.** The repair vessel positions over the fault. An ROV de-buries the cable on both sides of the damage and cuts it. A grapnel or ROV lifts each cable end to the vessel deck.

3. **Testing.** Each cable end is tested for moisture ingress and insulation integrity using VLF (very low frequency) withstand tests.

4. **Omega formation.** A repair length of new cable (typically 200 to 500 metres) is jointed to the first cable end on the vessel deck. The joint alone takes a team of four specialist jointers approximately 18 hours to complete in a controlled-atmosphere enclosure. The first cable end with its repair length is then laid back to the seabed in a loop.

5. **Second joint.** The second cable end is recovered, jointed to the other end of the repair length, and overboarded.

6. **Re-burial and protection.** The omega loop — now containing two factory joints and extra cable length — is re-buried or protected with rock placement.

Average repair time for an array cable is approximately **40 days**; for an export cable, approximately **60 days**. Costs range from EUR 2 to 12 million for an array cable repair and EUR 10 to 30 million for an export cable repair. If the failure occurs in winter, when weather windows for vessel operations are scarce, the repair may be delayed until the following spring — meaning months of lost generation. [21]

This vulnerability raises the question of redundancy. Most offshore wind farms use **radial (string) topology** for their array cables — turbines connected in series, with a single cable path back to the OSS. A cable fault anywhere in the string disconnects all downstream turbines. The alternative is a **ring topology**, where the last turbine in each string is connected back to the OSS or to an adjacent string, forming a loop. If any single cable fails, power flows around the ring in the opposite direction. But ring designs require all cables in the loop to be rated for the full string current (no tapering), increasing cable cost by 20 to 40 percent. For most projects, the cost of the extra cable exceeds the expected value of the energy recovered during the repair period, and the radial topology prevails. As farms grow larger and repair vessel availability tightens, however, the economics of redundancy are shifting. [22]

<!-- IMAGE: fig-14-05 -->
> **Figure 14.5** — Omega loop cable repair procedure
> **Type:** four-panel sequence diagram
> **Content:** Panel 1: Fault location shown on seabed with TDR pulse reflecting from damage point. Panel 2: Cable cut and both ends recovered to vessel deck, with ROV visible. Panel 3: Repair length jointed to first end, laid in omega loop on seabed, second end recovered. Panel 4: Completed repair showing omega loop with two joints, re-buried or rock-protected. Scale annotations showing repair length (~300 m) and loop width.
> **Caption:** Submarine cable repair requires cutting the damaged section, jointing a repair length on the vessel deck, and laying the repaired cable in an omega loop on the seabed. The entire operation takes 40 to 60 days and costs EUR 2 to 30 million.
> **Alt text:** Four-panel diagram showing the submarine cable repair sequence: fault location via TDR, cable recovery and cutting, omega loop formation with repair length and two joints, and re-burial of the completed repair.
> **Data source:** Author illustration based on CIGRE TB 773 and industry repair documentation.
> **Resolution:** 1200 x 1000 px minimum
> **Color notes:** Original cable in black, repair length in red, joints highlighted in yellow, seabed in brown, vessel in grey

---

## 14.7 Worked Example: Sizing the Invisible Highway

Consider a generic 500 MW offshore wind farm with 34 turbines rated at 15 MW each, an offshore substation, and a 45-kilometre export route to the onshore grid connection. The following calculations size the cable system and quantify its electrical characteristics.

### Step 1: Export cable specification

The total rated current at 220 kV:

$$
I_{\text{rated}} = \frac{510{,}000 \text{ kW}}{\sqrt{3} \times 220 \text{ kV}} = 1{,}338 \text{ A}
$$

A single 220 kV, 1,000 mm² copper XLPE cable has an ampacity of approximately 800 A when buried 1.5 m in seabed soil with $\rho_{\text{soil}} = 1.0$ K·m/W and an ambient temperature of 15 °C. Since 1,338 A exceeds this rating, **two parallel export cables** are required, each carrying approximately 670 A at rated output — an 800 A rating provides a 19% thermal margin.

### Step 2: Reactive power generation

Each export cable generates reactive power due to its distributed capacitance ($C = 0.17$ μF/km per phase):

$$
Q_c = \omega \cdot C \cdot V^2 \cdot L = 314.16 \times 0.17 \times 10^{-6} \times (220{,}000)^2 \times 45 \approx 116 \text{ MVAR per cable}
$$

Two cables: **232 MVAR total**. This reactive power must be absorbed by shunt reactors (fixed compensation) and the STATCOM (dynamic compensation) to prevent voltage rise at the cable's open end. The charging current per phase per cable is approximately 6.8 A/km × 45 km = 306 A — thirty-eight percent of the cable's thermal capacity consumed by reactive current alone.

### Step 3: Combined current check

At rated load, the total current per phase in each cable combines load and charging components in quadrature:

$$
I_{\text{total}} = \sqrt{I_{\text{load}}^2 + I_c^2} = \sqrt{670^2 + 306^2} = \sqrt{542{,}456} = 737 \text{ A}
$$

This is within the 800 A ampacity. With a 50 MVAR shunt reactor at the OSS, the reactor absorbs approximately 131 A per phase of charging current, reducing the net charging current to ~175 A and the combined current to ~692 A — a comfortable 13.5% margin below the thermal limit.

### Step 4: Export cable losses

The AC resistance of the 1,000 mm² copper conductor at 90 °C, including skin and proximity effects, is approximately $R_{\text{ac}} = 0.024$ Ω/km. The resistive losses in each export cable at rated load:

$$
P_{\text{loss}} = 3 \times I_{\text{load}}^2 \times R_{\text{ac}} \times L = 3 \times 670^2 \times 0.024 \times 45 = 1{,}454 \text{ kW} \approx 1.5 \text{ MW per cable}
$$

Two cables at rated: **2.9 MW** (0.57% of 510 MW). Over a year at an average capacity factor of 44%, the losses scale with the square of the loading — average cable losses are approximately $(0.44)^2 \times 2.9 = 0.56$ MW, or **4,900 MWh per year**. At EUR 100/MWh, this is EUR 490,000 per year — EUR 14.7 million over the farm's 30-year life.

### Step 5: Array cable design

The 34 turbines are arranged in 7 strings (6 strings of 5 turbines + 1 string of 4 turbines). Each 15 MW turbine at 66 kV draws 131 A per phase. The array cables use tapered cross-sections:

| String Position | Cumulative Power | Cumulative Current | Cable Cross-Section | Cable Rating |
|---|---|---|---|---|
| End of string (1 WTG) | 15 MW | 131 A | 185 mm² | 375 A |
| Mid-string (3 WTG) | 45 MW | 393 A | 500 mm² | 615 A |
| Near OSS (5 WTG) | 75 MW | 655 A | 800 mm² | 750 A |

Average inter-turbine cable length: 1.8 km. Average cable-to-OSS length: 3 km. Total array cable: approximately **60 km**.

### Step 6: Total cable cost

| Component | Length | Unit Cost | Total |
|---|---|---|---|
| Array cable (66 kV, mixed cross-sections) | 60 km | ~EUR 250/m avg | EUR 15M |
| Export cable (220 kV, 1,000 mm²) | 90 km (2 × 45) | ~EUR 700/m | EUR 63M |
| Cable installation (CLV, burial, protection) | — | — | EUR 55M |
| Crossings, rock placement, HDD landfall | — | — | EUR 12M |
| **Total cable system** | **150 km** | — | **EUR 145M** |

As a percentage of total CAPEX (EUR 1,500M for a 500 MW farm): approximately **9.7%** — consistent with the industry benchmark of cables representing roughly 10% of project cost, yet responsible for 80% of insurance claims by value.

---

## Key Takeaways

- **A submarine cable is not a wire — it is a seven-layer containment system** designed to carry hundreds of thousands of volts through seawater for thirty years. The lead sheath is the critical water barrier; a breach allows moisture to grow "water trees" in the XLPE insulation, leading to irreversible failure.

- **The cable's current-carrying capacity (ampacity) is limited by heat, not by the conductor.** IEC 60287 models the cable as a thermal circuit: the conductor generates heat (I²R), and the surrounding soil must dissipate it before the insulation exceeds 90 °C. The thermal resistivity of the seabed soil — which can vary by a factor of four between saturated sand and dried-out clay — is the dominant parameter.

- **Every kilometre of 220 kV submarine cable acts as a 2.6 MVAR capacitor,** generating reactive current that consumes cable ampacity and causes voltage rise at the open end (the Ferranti effect). For a 500 MW farm with two 45-kilometre export cables, the total reactive power generation exceeds 230 MVAR — requiring shunt reactors and a STATCOM to maintain voltage within limits.

- **Cable failures are the dominant insurance risk in offshore wind,** accounting for approximately 80% of claims by value despite representing only 10% of capital cost. Nearly half of all failures originate during installation. Repair requires a specialised vessel, takes 40 to 60 days, and costs EUR 2 to 30 million — with winter failures potentially waiting months for a weather window.

- **The cable system for a 500 MW farm comprises approximately 150 kilometres of submarine cable** (60 km of 66 kV array cable in tapered strings + 90 km of 220 kV export cable in two parallel circuits), costing approximately EUR 145 million and losing roughly EUR 15 million in resistive heat over the farm's 30-year life.

## For Further Reading

- **Worzyk, Thomas (2009).** *Submarine Power Cables: Design, Installation, Repair, Environmental Aspects.* Springer. ISBN 978-3-642-01269-3. The definitive monograph on submarine power cable engineering, covering materials science, thermal design, manufacturing, installation vessels and methods, fault location, and repair procedures. Includes case studies from major HVDC and HVAC projects worldwide. Essential reference for anyone working with submarine cables.

- **CIGRE Technical Brochure 815 (2020).** "Update of Service Experience of HV Underground and Submarine Cable Systems." CIGRE Working Group B1.57. Compiles failure statistics, root cause analyses, and reliability data from over 62,000 km of HV cable systems worldwide, including offshore wind array and export cables. The primary source for cable failure rates and repair time benchmarks.

- **Høyer-Hansen, M., Nouri, B., et al. (2021).** "Challenges and Recent Developments in Submarine Cable Technology for Offshore Wind." *CIGRE Session 2020/2021*, Paper B1-308. Reviews the transition from 33 kV to 66 kV array cables, the development of 275 kV and 400 kV XLPE submarine cables, and the engineering challenges of cables for floating wind platforms (dynamic cables subject to fatigue from platform motion).

---

*The last array cable was pulled into the OSS J-tube at half past four in the afternoon, and Nora pronounced the string complete. Seven strings, thirty-four turbines, sixty kilometres of 66 kV cable buried in the seabed — each string a copper highway running from the outermost turbine back to the offshore substation, where the power would be stepped up to 220 kV and sent ashore through the two export cables that had been laid the previous month.*

*Kaan stood at the CLV's stern railing as the vessel's DP system held position against a freshening westerly wind. The forecast on the bridge showed a low-pressure system moving in from the North Sea — significant wave height was expected to exceed two metres by the following morning, and the vessel master had already announced that cable operations would be suspended for at least three days. Three days of a vessel costing a quarter of a million euros per day, sitting idle because the sea would not cooperate.*

*He looked out across the construction site. The jack-up vessel Brave Tern stood on its legs two kilometres to the north, its crane swinging a transition piece onto the latest monopile. The SOV was anchored to the east, running technician transfers to the turbines whose foundations had already been installed. A rock placement vessel was dumping graded stone onto a pipeline crossing south of the OSS. Four vessels, four different operations, all governed by the same weather window — and all of them would stop when the wave height rose above their operational limits.*

*"This is the part they do not teach you in university," Nora said, joining him at the railing. She had changed out of her hard hat and was holding a mug of coffee in both hands against the wind. "You can design the perfect cable, manufacture it to the millimetre, and plan every metre of the route. But at the end, you are standing on a ship, watching the weather forecast, and hoping the sea gives you enough calm days to finish." She took a sip. "The cable does not care about the weather. The ship does."*

*Kaan thought about the monopiles that Pieter had driven into the glacial clay, and the cables that Nora had buried in the sand, and the substation that sat on its own jacket foundation in thirty metres of water. Each was a feat of engineering. But getting them all to the right place, at the right time, in the right weather — that was a different kind of problem entirely. Not a problem of physics or materials or standards, but of logistics, vessels, and the relentless arithmetic of weather windows.*

*He looked at the wave forecast on his tablet. Three days of waiting. Then, if the models were right, a five-day window to complete the remaining cable work before the next system arrived. He was beginning to understand that building a wind farm in the sea was not just about engineering the components — it was about engineering the construction itself.*

---

## Notes

[1] Brett's Channel cable: The English Channel Submarine Telegraph Company laid the first undersea cable between Dover and Cap Gris-Nez on 28 August 1850 using the converted tugboat *Goliath*. The cable was a single copper conductor insulated with gutta-percha and had no armouring. It failed within hours when a French fisherman's trawl snagged and severed it. A second, armoured cable was successfully laid in September 1851 by the vessel *Blazer*. Source: Bright, C. (1898). *Submarine Telegraphs: Their History, Construction, and Working*. Crosby Lockwood and Son, London. Also: Headrick, D.R. (1991). *The Invisible Weapon: Telecommunications and International Politics, 1851–1945*. Oxford University Press. Chapter 1 provides a detailed account of the early Channel cables.

[2] XLPE insulation development: Cross-linked polyethylene was developed for cable insulation in the early 1960s using peroxide cross-linking. The material allows a continuous conductor temperature of 90 °C and a short-circuit temperature of 250 °C (for 1 second), compared to 70 °C continuous for PVC. Source: Hampton, R.N. (2008). "Some of the Considerations for Materials Operating under High-Voltage, Direct-Current Stresses." *IEEE Electrical Insulation Magazine*, 24(1), 5–13. DOI: 10.1109/MEI.2008.4455499. Also: Orton, H. (2013). "Power Cable Technology Review." *High Voltage Engineering*, 39(7), 1556–1563.

[3] Lead sheath and water treeing: Steennis, E.F. and Kreuger, F.H. (1990). "Water Treeing in Polyethylene Cables." *IEEE Transactions on Electrical Insulation*, 25(5), 989–1028. DOI: 10.1109/14.59869. Comprehensive review of water tree growth mechanisms in XLPE and PE cable insulation under AC electrical stress in the presence of moisture. Also: Worzyk, T. (2009). *Submarine Power Cables*. Springer. Chapter 3: "Cable Design." Discusses the role of the metallic sheath as an absolute moisture barrier and the consequences of sheath damage.

[4] Distributed temperature sensing (DTS): Hartog, A.H. (2017). *An Introduction to Distributed Optical Fibre Sensors*. CRC Press. Chapter 7: "Raman-Based Temperature Sensors." Explains the physics of Raman backscatter DTS with spatial resolutions of ~1 m over cable lengths up to 30–50 km. Also: Lyall, I. et al. (2019). "Use of DTS for Cable Rating in Offshore Wind Farms." *CIGRE Session 2019*, Paper B1-102. Reports on the use of DTS to validate IEC 60287 thermal models for offshore wind submarine cables.

[5] Array cable string design and tapered cross-sections: BVG Associates (2019). "Guide to an Offshore Wind Farm." Published for The Crown Estate and the Offshore Renewable Energy Catapult. Chapter B.1.2: "Array Cable." Describes the tapering of cable cross-sections along strings to match cumulative current flow, with typical cross-sections from 185 mm² to 1,000 mm² at 66 kV.

[6] Transition from 33 kV to 66 kV array cables: Lakshmanan, P. et al. (2017). "Economic Assessment of 66 kV Wind Farm Collection Networks." *IET Renewable Power Generation*, 11(7), 874–882. DOI: 10.1049/iet-rpg.2016.0612. Reports that 66 kV array cables reduce total collection cable length by approximately 40% and cable losses by approximately 50% compared to 33 kV designs for a given farm size. Also: Carbon Trust/ORE Catapult (2015). "66 kV Systems for Offshore Wind." Report documenting the industry roadmap for the 33-to-66 kV transition.

[7] Export cable redundancy: Baring-Gould, I. et al. (2018). "Offshore Wind Plant Electrical Systems." *NREL Technical Report*, NREL/TP-5000-67191. Section 4.3 discusses export cable redundancy options, noting that most projects above 300 MW install two parallel export cables for reliability and maintenance flexibility. Also: DNV-ST-0359:2021, Section 4: "Cable system design."

[8] Basic impulse level (BIL): IEC 60071-1:2019, "Insulation co-ordination — Part 1: Definitions, principles and rules." Specifies standard insulation levels for equipment at various rated voltages. For Um = 72.5 kV (66 kV systems): BIL = 325 kV. For Um = 245 kV (220 kV systems): BIL = 1,050 kV. Also: IEC 62067:2022, "Power cables with extruded insulation and their accessories for rated voltages above 150 kV (Um = 170 kV) up to 500 kV (Um = 550 kV)."

[9] IEC 63026:2023, "Submarine power cables with extruded insulation and their accessories for rated voltages from 6 kV (Um = 7.2 kV) up to 60 kV (Um = 72.5 kV)." International Electrotechnical Commission. The first IEC standard specifically developed for submarine power cables at medium voltage, addressing the unique mechanical, thermal, and environmental requirements of offshore wind array cables.

[10] Soil drying and thermal runaway: IEC 60287-3-1:2017, "Electric cables — Calculation of the current rating — Part 3-1: Operating conditions — Site conditions and selection of cable type." Section 4.2 specifies the treatment of partially dried soil using a two-zone model with critical isotherm temperature. Also: CIGRE TB 880 (2022). "Submarine Cable Rating." Provides updated methods for thermal rating of submarine cables, including the effects of soil drying, mutual heating, and time-varying load profiles. Also: Brakelmann, H. and Anders, G.J. (2018). "Current Rating of Submarine Cables." *IEEE Transactions on Power Delivery*, 33(4), 1630–1637. DOI: 10.1109/TPWRD.2017.2761756.

[11] IEC 60287-1-1:2023, "Electric cables — Calculation of the current rating — Part 1-1: Current rating equations (100% load factor) and calculation of losses — General." International Electrotechnical Commission. The foundational standard for cable thermal rating worldwide. Defines the thermal equivalent circuit, loss calculations (conductor, dielectric, sheath, armour), and the iterative solution procedure for continuous current rating.

[12] Charging current and Ferranti effect: Worzyk, T. (2009). *Submarine Power Cables*. Springer. Chapter 2.5: "Capacitance and Charging Current." Explains the capacitive reactive power generation of submarine cables and its effect on voltage regulation. The Ferranti effect — voltage rise at the open end of a cable due to capacitive charging — was first observed by Sebastian Ziani de Ferranti at the Deptford Power Station in 1890 (see Chapter 4 of this book). Also: CIGRE TB 610 (2015). "Offshore Generation Cable Connections." Section 3.4: "Reactive Power Compensation."

[13] HVDC Gotland and Viking Link: The HVDC Gotland link (1954) was built by ASEA (now ABB) for the Swedish state utility Vattenfall: 20 MW at 100 kV DC, 98 km of mass-impregnated cable, mercury arc valves. IEEE Milestone in Electrical Engineering. Source: Arrillaga, J. (1998). *High Voltage Direct Current Transmission*. IET Power and Energy Series, 2nd edition. Chapter 1. Viking Link: National Grid and Energinet (2023). "Viking Link — First Power." Press release, 28 December 2023. 1,400 MW capacity, ±525 kV, 765 km total length (650 km submarine), Prysmian cable supply, Bicker Fen (UK) to Revsing (Denmark).

[14] Cable lay vessel costs: BVG Associates (2019), ibid. Chapter I.5: "Offshore Cable Installation." Reports CLV day rates of EUR 150,000–250,000 depending on vessel capability and market conditions. Also: 4C Offshore (2024). "Cable Lay Vessel Market Report." Reports a fleet of approximately 15 vessels capable of high-voltage submarine cable installation for offshore wind, with several new-builds on order.

[15] Carousel specifications: Prysmian Group (2021). "Cable Laying Vessel Leonardo da Vinci — Technical Specifications." Reports two carousels (10,000 t and 7,000 t capacity), 170 m LOA, DP2. Also: Nexans (2021). "Nexans Aurora — Cable Laying Vessel." Reports 10,000 t split turntable, 149.9 m LOA, DP3. NKT (2017). "NKT Victoria." Reports 4,500 t below-deck + 7,000 t deck carousel, 140 m LOA, DP3.

[16] Cable burial methods: DNV-RP-J301:2014, "Subsea power cables in shallow water renewable energy applications." Section 6: "Cable protection." Defines burial depth requirements and burial tool selection criteria based on soil type. Also: Carbon Trust (2015). "Cable Burial Risk Assessment (CBRA) Guidance." The industry-standard methodology for assessing burial depth requirements based on hazard analysis (anchor strike, dredging, fishing gear).

[17] Crossing agreements and protection: ICPC Recommendation No. 3 (2019). "Criteria to be Applied to Proposed Crossings of Submarine Cables and/or Pipelines." International Cable Protection Committee. Specifies minimum crossing angles (30° minimum, 90° preferred), vertical separation (0.3 m minimum), and protection methods (concrete mattresses, rock berms). Also: DNV-RP-F107:2019, "Risk assessment of pipeline protection." Covers the design of crossing structures for subsea cable-pipeline crossings.

[18] Horizontal directional drilling (HDD): Moles, P.J. and Grisolia, A. (2019). "Cable Landfalls for Offshore Wind Farms." *Proceedings of the International Conference on Offshore Mechanics and Arctic Engineering* (OMAE 2019). Reports typical HDD bore lengths of 500–2,000 m, bore diameters of 400–600 mm, and drill rates of 30–50 m/day in mixed soils. Thermal resistivity of HDD backfill material (typically bentonite-cement grout) ranges from 0.8 to 1.2 K·m/W; disturbed soil around the bore can reach 2.0–3.0 K·m/W, making the HDD section a thermal bottleneck.

[19] Cable failure insurance statistics: DNV (2022). "80 Percent of Insurance Claims in Offshore Wind are Related to Subsea Cable Failures — How Can the Industry Manage These Risks?" DNV Energy Systems white paper. Reports that subsea cables represent the single largest source of financial loss in offshore wind insurance, despite representing only approximately 10% of CAPEX.

[20] Cable failure rates: Carroll, J., McDonald, A., and McMillan, D. (2016). "Failure Rate, Repair Time and Unscheduled O&M Cost Analysis of Offshore Wind Turbines." *Wind Energy*, 19(6), 1107–1119. DOI: 10.1002/we.1887. Also: Dinmohammadi, F. et al. (2019). "Predicting the Failure Frequency of Subsea Cables for Offshore Renewable Energy Applications." *University of Strathclyde / ORE Catapult.* Reports cable failure rates of 0.002–0.004 failures per km per year based on European operational data.

[21] Cable repair procedures and costs: Power Cable Systems (2021). "Offshore Wind Subsea Cable Repair Joints." Technical documentation. Reports repair joint duration of approximately 18 hours for a team of 4 jointers. Also: Acteon Group (2023). "Maximising Power Cable Reliability for Offshore Wind." Reports average array cable repair downtime of ~40 days, export cable ~60 days, and repair costs of EUR 2–12M (array) and EUR 10–30M (export). Also: CIGRE TB 773 (2019). "Fault Location on Land and Submarine Links." Covers TDR fault location methods for submarine power cables.

[22] Array cable topology: Lumbreras, S. and Ramos, A. (2013). "Optimal Design of the Electrical Layout of an Offshore Wind Farm Applying Decomposition Strategies." *Renewable Energy*, 50, 1001–1010. DOI: 10.1016/j.renene.2012.08.068. Compares radial, ring, and star topologies for offshore wind collection systems, reporting that radial designs are cost-optimal when failure rates and repair times are moderate. Also: Pérez-Rúa, J.A. et al. (2019). "Electrical Cable Optimisation in Offshore Wind Farms — A Review." *IEEE Access*, 7, 85796–85811. DOI: 10.1109/ACCESS.2019.2925873.

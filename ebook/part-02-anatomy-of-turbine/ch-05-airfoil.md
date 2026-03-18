# Chapter 5: How an Airfoil Makes a Turbine Spin

*The CTV crossed the last hundred metres of grey water and bumped against the boat landing at the base of turbine WTG-17. Kaan grabbed the handrail as the vessel rose on a swell, and the technician on the platform above — a wiry Dane named Morten, mid-forties, with a salt-faded Vestas cap and the kind of unhurried confidence that comes from a decade of climbing towers — reached down and offered a hand.*

*"First time on a turbine?" Morten asked, pulling Kaan onto the platform with practiced ease.*

*"First time," Kaan confirmed. He steadied himself and looked up.*

*He had seen the turbines from the SOV for two days. From a distance, they had looked elegant, even graceful — white columns rising from the sea, blades sweeping in slow arcs against the sky. Up close, the scale was something else entirely. The tower was a steel cylinder perhaps seven metres in diameter at the base, tapering as it rose. He could not see the top. The blades — three of them, each longer than a football pitch — were turning slowly overhead, their tips cutting through the low cloud layer and reappearing on the other side. The sound was not what he had expected: not a whoosh but a deep, rhythmic pulse, more felt than heard, like standing near a very large, very slow heartbeat.*

*Anders was already on the platform, checking his harness. He nodded at Kaan. "Before we go up," he said, "Morten has something to show you."*

*Morten had laid a section of blade — a two-metre cross-cut from a decommissioned rotor — across two trestles near the base of the tower. It was painted white on the outside, bare composite on the cut face. Kaan could see the internal structure: spar caps of carbon fibre, shear webs, infused glass-fibre skins, a hollow interior. But it was the shape that caught his attention. In cross-section, the blade was not a flat plate. It was not even symmetrical. It was a teardrop — thick and rounded at one end, tapering to a sharp trailing edge at the other.*

*"That shape," Morten said, tapping the rounded leading edge with his knuckle, "is the reason these machines work. Not the generator, not the gearbox, not the control system. This. The airfoil."*

---

## 5.1 Lift Versus Drag: Two Ways to Catch the Wind

There are exactly two aerodynamic forces that the wind can exert on any object in its path: **drag**, which pushes the object in the direction the wind is blowing, and **lift**, which pushes the object perpendicular to the wind direction. Every wind energy device in history has relied on one of these forces, or some combination of both. The distinction matters enormously, because the physics sets a hard ceiling on how much energy each approach can extract.

**Drag-based devices** are the older and more intuitive concept. A flat plate held perpendicular to the wind experiences a force pushing it downwind. If that plate is mounted on a rotating arm — like the cups on a weather station anemometer, or the scoops of a Savonius rotor — the arm spins. The device can never move faster than the wind, because drag only works when there is a velocity difference between the air and the surface. As the surface accelerates toward the wind speed, the relative velocity drops, drag drops, and the device reaches a limit. The theoretical maximum power coefficient for a pure drag device is:

$$
C_{p,\text{drag,max}} = \frac{4}{27} \approx 0.148
$$

This means a perfect drag-based turbine can capture at most 14.8% of the wind's kinetic energy. [1]

**Lift-based devices** work differently. An airfoil — a carefully shaped cross-section — generates a force perpendicular to the incoming airflow. Because the blade tip can move much faster than the wind (tip speed ratios of 7 to 9 are common), the effective velocity seen by each blade section is large, and the lift force is correspondingly large. A lift-based rotor is not limited by the wind speed in the same way a drag device is. The theoretical maximum for a lift-based turbine is the Betz limit:

$$
C_{p,\text{Betz}} = \frac{16}{27} \approx 0.593
$$

The ratio is decisive: $16/27$ versus $4/27$ — lift-based turbines can theoretically extract four times more energy than drag-based turbines of the same swept area. This is why every utility-scale wind turbine on earth — every machine that feeds power into a grid — uses lift, not drag. The ancient Persian windmills at Nashtifan (Chapter 1) were drag devices. The machine turning overhead was a lift device. The difference between them is not just engineering refinement. It is a different branch of physics.

The understanding of lift did not arrive overnight. It required two centuries of investigation, beginning with a Yorkshire baronet who engraved the forces of flight on a silver disc.

<!-- IMAGE: fig-05-01 -->
> **Figure 5.1** — Drag versus lift: two mechanisms of wind energy extraction
> **Type:** side-by-side schematic
> **Content:** Left panel: a Savonius rotor (two half-cylinders) with drag force arrows showing wind pushing the concave face. The rotor cannot spin faster than the wind. Right panel: a modern HAWT blade cross-section (airfoil) with lift and drag vectors resolved. The blade moves perpendicular to the wind at several times wind speed. Include velocity triangles showing relative wind direction.
> **Caption:** Drag-based rotors (left) are limited to Cp = 4/27 because they cannot exceed wind speed. Lift-based rotors (right) generate forces perpendicular to the airflow, allowing blade tips to move far faster than the wind and achieving Cp values up to 16/27.
> **Alt text:** Side-by-side comparison of a Savonius drag rotor and a horizontal-axis lift-based airfoil, with force vectors and velocity triangles annotated.
> **Data source:** Author illustration based on Burton et al. (2011), *Wind Energy Handbook*, Ch. 3.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Drag vectors in red, lift vectors in blue, velocity triangles in grey.

---

## 5.2 The Anatomy of an Airfoil

Sir George Cayley, a self-taught engineer from Scarborough, was the first person to separate the four forces acting on a body in flight — lift, weight, thrust, and drag — and to recognise that a curved surface generates more lift than a flat plate. In 1799, he inscribed these principles on a small silver disc, now in the Science Museum in London: on one side, the force diagram; on the other, a sketch of a fixed-wing aircraft with a cruciform tail. It was 104 years before the Wright brothers flew. [2]

The science of shaped surfaces advanced through Otto Lilienthal, the German engineer whose 1889 book *Der Vogelflug als Grundlage der Fliegekunst* ("Bird Flight as the Basis of Aviation") presented the first systematic measurements of lift and drag on curved plates, derived from twenty-three years of experiments with his brother Gustav. Lilienthal built and flew eighteen glider designs between 1891 and 1896, proving that a cambered surface — one curved more on top than on the bottom — could sustain a human in flight. The Wright brothers studied his data tables for years. [3]

The mathematical foundation came from two men working independently. In 1902, the German mathematician Martin Wilhelm Kutta published a paper on the circulation of airflow around a body, establishing what became the Kutta condition: the requirement that airflow leaves the trailing edge of an airfoil smoothly. In 1906, the Russian physicist Nikolai Zhukovsky (Joukowski) derived the relationship between circulation and lift that bears both their names — the Kutta-Joukowski theorem:

$$
L' = \rho \cdot V_\infty \cdot \Gamma
$$

where:
- $L'$ = lift force per unit span [N/m]
- $\rho$ = air density [kg/m³]
- $V_\infty$ = freestream velocity [m/s]
- $\Gamma$ = circulation around the airfoil [m²/s]

This elegant result says that lift is proportional to the strength of the circulatory flow pattern around the airfoil. No circulation, no lift. The airfoil's shape — its camber and angle of attack — determines how much circulation develops. [4] [5]

An airfoil is defined by several geometric parameters:

- **Chord line** — the straight line from the leading edge (the rounded front) to the trailing edge (the sharp back). The chord length $c$ is this distance.
- **Camber line** — the curve midway between the upper and lower surfaces. If the camber line is above the chord line, the airfoil generates lift even at zero angle of attack.
- **Thickness** — the maximum distance between upper and lower surfaces, expressed as a percentage of the chord (e.g., "18% thick").
- **Angle of attack** ($\alpha$) — the angle between the chord line and the direction of the incoming airflow.

The aerodynamic forces on any airfoil section are characterised by two dimensionless coefficients:

$$
L = \frac{1}{2} \rho V^2 c \cdot C_l
$$

$$
D = \frac{1}{2} \rho V^2 c \cdot C_d
$$

where:
- $L$ = lift force per unit span [N/m]
- $D$ = drag force per unit span [N/m]
- $\rho$ = air density [kg/m³]
- $V$ = airflow velocity [m/s]
- $c$ = chord length [m]
- $C_l$ = lift coefficient [dimensionless]
- $C_d$ = drag coefficient [dimensionless]

The lift coefficient $C_l$ increases approximately linearly with angle of attack up to a critical angle — typically 12° to 16° for wind turbine airfoils — beyond which the airflow separates from the upper surface and the blade **stalls**. At stall, lift drops abruptly and drag increases. The ratio $C_l / C_d$, called the **lift-to-drag ratio** or **glide ratio**, is the primary measure of airfoil efficiency. For wind turbine airfoils, $C_l / C_d$ values of 100 to 150 are typical at design conditions. [6]

### Wind Turbine Airfoil Families

Early wind turbines borrowed airfoil profiles from aviation — the NACA (National Advisory Committee for Aeronautics) four-digit and six-digit series developed in the 1930s and 1940s. The NACA 63-4xx and 64-6xx families, originally designed for low-drag aircraft wings, were widely used on wind turbine blades through the 1990s, with thicknesses ranging from 15% at the tip to 30% or more at the root. But aviation airfoils were optimised for clean, smooth surfaces at high altitude. Wind turbine blades operate in rain, salt spray, insect impacts, and ice — conditions that roughen the leading edge and degrade performance. [7]

Beginning in the 1990s, research institutions developed airfoil families specifically for wind turbines, designed to maintain performance even with contaminated leading edges:

- **DU airfoils** (Delft University of Technology, Netherlands) — developed by W.A. Timmer and R.P.J.O.M. van Rooij from 1995 onwards, with thicknesses from 15% to 40% chord. Designed using the RFOIL code, a modified version of XFOIL that accounts for rotational effects on boundary layers. Used on turbines from 29 m to over 100 m rotor diameter. [8]
- **FFA-W airfoils** (Swedish Defence Research Agency / KTH) — a family of thick airfoils optimised for the inboard sections of large rotors, where structural requirements demand 30%+ thickness.
- **NREL S-series** (National Renewable Energy Laboratory, USA) — designed by Dan Somers from 1984 onwards, specifically to tolerate leading-edge roughness while maintaining high lift-to-drag ratios. [9]
- **Risø-A and Risø-B** (Technical University of Denmark) — thick airfoils for the root and mid-span of MW-scale blades.

Modern large turbines like the V236-15.0 MW use proprietary airfoil blends: thick structural profiles (30-40% chord) at the root for strength, transitioning to thinner, high-performance profiles (18-21% chord) at the tip for aerodynamic efficiency.

<!-- IMAGE: fig-05-02 -->
> **Figure 5.2** — Airfoil geometry and aerodynamic coefficients
> **Type:** annotated schematic + graph
> **Content:** Top panel: cross-section of a wind turbine airfoil (e.g., DU 96-W-180) with chord line, camber line, thickness, leading edge, trailing edge, and angle of attack α labeled. Lift (L) and drag (D) vectors shown relative to the incoming airflow. Bottom panel: Cl versus α curve showing the linear region, maximum Cl, stall angle, and post-stall drop. Annotate the design operating point (α ≈ 6°-8°).
> **Caption:** The lift coefficient increases linearly with angle of attack until stall, where flow separation causes an abrupt loss of lift. Wind turbine blades operate in the linear region, typically at α = 6°-8°.
> **Alt text:** Airfoil cross-section with labeled geometry and force vectors, paired with a graph of lift coefficient versus angle of attack showing the linear region and stall point.
> **Data source:** Author illustration based on Timmer & van Rooij (2003), *Journal of Solar Energy Engineering*, 125(4).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Lift vector in blue, drag vector in red, stall region shaded amber.

---

## 5.3 The Betz Limit: The Law No Turbine Can Break

In 1738, Daniel Bernoulli published *Hydrodynamica*, establishing the relationship between pressure and velocity in a moving fluid. [10] Nearly two centuries later, three scientists — working independently, in three countries, within five years of each other — applied that principle to answer a deceptively simple question: *How much energy can you actually extract from the wind?*

The first was Frederick W. Lanchester, the British engineer better known for his contributions to automobile engineering and military operations research. In 1915, analysing the momentum change in airflow passing through an "actuator disc" (an idealised rotor that uniformly slows the wind), Lanchester showed that maximum power extraction occurs when the wind speed downstream of the rotor is one-third of the upstream speed. He derived a maximum efficiency of 16/27 — and then, apparently not fully trusting his own result, relegated it to an appendix. [11]

In 1920, the German physicist Albert Betz, working at the University of Göttingen under Ludwig Prandtl, published "Das Maximum der theoretisch möglichen Ausnutzung des Windes durch Windmotoren" ("The Maximum of the Theoretically Possible Exploitation of Wind by Means of Wind Motors") in the *Zeitschrift für das gesamte Turbinenwesen*. Betz derived the same result independently and presented it as a central theorem. [12] That same year, the Russian aerodynamicist Nikolai Zhukovsky arrived at the identical limit through his own analysis. [13]

The result — now known as the Betz limit, or more properly the Lanchester-Betz-Joukowski limit — is one of the most important equations in wind energy engineering.

### The Derivation

Consider a stream tube of air approaching a rotor disc. Far upstream, the wind has velocity $V_1$ and the stream tube has cross-sectional area $A_1$. At the rotor disc, the velocity is $V_d$ and the area is $A_d$ (the swept area of the rotor). Far downstream, the velocity has slowed to $V_2$ and the area has expanded to $A_2$.

By conservation of mass (continuity), the mass flow rate is constant:

$$
\dot{m} = \rho A_1 V_1 = \rho A_d V_d = \rho A_2 V_2
$$

The power extracted by the rotor equals the rate of kinetic energy loss of the air:

$$
P = \frac{1}{2} \dot{m} (V_1^2 - V_2^2)
$$

By momentum theory, the velocity at the disc is the average of the upstream and downstream velocities: $V_d = (V_1 + V_2)/2$. Defining the **axial induction factor** $a$ as the fractional decrease in wind speed at the disc:

$$
a = \frac{V_1 - V_d}{V_1} = 1 - \frac{V_d}{V_1}
$$

so $V_d = V_1(1-a)$ and $V_2 = V_1(1-2a)$. Substituting into the power equation:

$$
P = \frac{1}{2} \rho A_d V_1^3 \cdot 4a(1-a)^2
$$

The **power coefficient** $C_p$ is the ratio of extracted power to the total kinetic energy flux through the swept area:

$$
C_p = \frac{P}{\frac{1}{2} \rho A V_1^3} = 4a(1-a)^2
$$

where:
- $C_p$ = power coefficient [dimensionless]
- $a$ = axial induction factor [dimensionless]
- $\rho$ = air density [kg/m³]
- $A$ = rotor swept area [m²]
- $V_1$ = upstream (freestream) wind speed [m/s]

To find the maximum, take $dC_p/da = 0$:

$$
\frac{dC_p}{da} = 4(1-a)(1-3a) = 0
$$

This gives $a = 1/3$ (the solution $a = 1$ is physically meaningless — it would mean stopping all the air). At $a = 1/3$:

$$
C_{p,\text{max}} = 4 \times \frac{1}{3} \times \left(\frac{2}{3}\right)^2 = \frac{16}{27} \approx 0.593
$$

No wind turbine — regardless of design, materials, or technology — can extract more than 59.3% of the kinetic energy in the wind passing through its swept area. The physical reason is intuitive: if you extracted *all* the energy, the downstream air velocity would be zero. The air would pile up behind the rotor and no new air could flow through. The optimum is a compromise — slow the wind enough to extract energy, but not so much that you choke the flow.

Modern utility-scale turbines achieve peak power coefficients of $C_p \approx 0.45$ to $0.50$, which is 76% to 84% of the Betz limit. The gap is due to aerodynamic losses (tip vortices, profile drag, wake rotation), mechanical losses (gearbox friction, bearing losses), and electrical losses (generator, converter). Reaching even 80% of a theoretical maximum is a remarkable engineering achievement. [14]

<!-- IMAGE: fig-05-03 -->
> **Figure 5.3** — The Betz limit: actuator disc model and Cp versus induction factor
> **Type:** dual panel diagram
> **Content:** Left panel: stream tube diagram showing airflow approaching a rotor disc, expanding downstream. Label V1 (upstream), Vd (at disc), V2 (downstream), A1, Ad, A2. Show velocity decreasing and stream tube expanding. Right panel: plot of Cp = 4a(1-a)² versus a, from a=0 to a=0.5. Mark the peak at a=1/3, Cp=16/27=0.593. Shade the region of typical modern turbine operation (Cp=0.45-0.50). Include a horizontal dashed line at Cp=4/27 for drag-based devices.
> **Caption:** The Betz limit (16/27 ≈ 0.593) represents the theoretical maximum energy extraction from an ideal actuator disc. Modern turbines operate at Cp = 0.45-0.50, while drag-based devices are limited to 4/27 ≈ 0.148.
> **Alt text:** Stream tube diagram of actuator disc model alongside a graph of power coefficient versus axial induction factor, with the Betz limit peak marked at a = 1/3.
> **Data source:** Author illustration based on Betz (1920) and Burton et al. (2011).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Stream tube in light blue, rotor disc in dark grey, Cp curve in blue with Betz peak marked in red.

---

## 5.4 Blade Element Momentum Theory

The Betz limit tells you *how much* energy a perfect rotor can extract. It tells you nothing about what shape the blades should be, how fast they should turn, or why they are twisted from root to tip. For that, you need a theory that connects the overall momentum balance to the forces on individual blade sections. That theory — **blade element momentum** (BEM) — was formulated by Hermann Glauert in his 1935 chapter "Airplane Propellers," published in W.F. Durand's *Aerodynamic Theory*, Vol. IV. [15] It remains the standard design tool for wind turbine blades ninety years later.

### The Idea

BEM divides the blade into a series of independent radial elements, each at a distance $r$ from the hub. Each element has its own chord length $c(r)$, twist angle $\theta(r)$, and airfoil profile. The theory makes two independent calculations for each element and then iterates until they agree:

1. **Momentum theory** — treats the rotor as an annular ring of swept area and calculates the forces needed to produce the observed change in air velocity (both axial and tangential). This gives the forces in terms of the induction factors $a$ (axial) and $a'$ (tangential, or rotational).

2. **Blade element theory** — calculates the lift and drag forces on the blade section based on the local airfoil properties ($C_l$, $C_d$), the local chord, and the local flow angle. The local flow angle depends on the wind speed, the blade's rotational speed, and the induction factors.

### The Velocity Triangle

At any radial position $r$ along the blade, the air approaching the blade section has two velocity components:

- **Axial:** $V_1(1-a)$ — the wind speed reduced by the axial induction factor
- **Tangential:** $\Omega r (1+a')$ — the rotational speed of the blade plus the swirl imparted to the wake

where $\Omega$ is the rotor angular velocity [rad/s] and $a'$ is the tangential induction factor.

The **relative wind velocity** $W$ and **flow angle** $\phi$ seen by the blade element are:

$$
W = \sqrt{[V_1(1-a)]^2 + [\Omega r(1+a')]^2}
$$

$$
\phi = \arctan\left(\frac{V_1(1-a)}{\Omega r(1+a')}\right)
$$

where:
- $W$ = relative wind speed at the blade element [m/s]
- $\phi$ = flow angle (angle between relative wind and rotor plane) [°]
- $V_1$ = freestream wind speed [m/s]
- $\Omega$ = rotor angular velocity [rad/s]
- $r$ = radial position along blade [m]
- $a$ = axial induction factor [dimensionless]
- $a'$ = tangential induction factor [dimensionless]

The **angle of attack** is then $\alpha = \phi - \theta$, where $\theta$ is the local pitch-plus-twist angle of the blade section. The lift and drag forces per unit span are computed from $C_l(\alpha)$ and $C_d(\alpha)$, projected into the axial and tangential directions, and equated to the momentum theory predictions. The induction factors are updated and the process repeats until convergence.

### Why Blades Are Twisted and Tapered

The velocity triangle reveals the fundamental reason for blade twist. Near the root, $r$ is small, so $\Omega r$ is small relative to $V_1(1-a)$. The flow angle $\phi$ is large — the wind arrives at a steep angle. Near the tip, $r$ is large, $\Omega r$ dominates, and $\phi$ is small — the wind arrives nearly in the plane of rotation. If the blade had no twist, the angle of attack would vary enormously from root to tip: far too high at the root (causing stall) and far too low at the tip (producing almost no lift).

Twist solves this. The blade is rotated at the root by 15° to 25° relative to the tip, so that every section along the span encounters approximately the same angle of attack — typically 6° to 8°, well within the linear lift region. The total twist from root to tip on a modern large turbine is typically 10° to 20°. [16]

Taper serves a related purpose. The chord is widest near the root (4 to 5 metres on a 115-metre blade) and narrows toward the tip (1 to 1.5 metres). This distributes the aerodynamic loading more evenly along the span and reduces the bending moment at the root. The ideal taper for maximum aerodynamic efficiency follows a $1/r$ relationship, though structural and manufacturing constraints produce a modified distribution in practice.

<!-- IMAGE: fig-05-04 -->
> **Figure 5.4** — Velocity triangle and blade twist along a wind turbine blade
> **Type:** dual panel illustration
> **Content:** Left panel: velocity triangle at a blade element showing axial component V1(1-a), tangential component Ωr(1+a'), resultant relative wind W, flow angle φ, blade pitch/twist angle θ, and angle of attack α = φ - θ. Right panel: side view of a full blade from root to tip, showing the twist: blade sections at root (large θ, wide chord), mid-span (medium θ, medium chord), and tip (small θ, narrow chord). Annotate typical angles: root ~20°, mid ~10°, tip ~2°.
> **Caption:** The velocity triangle (left) determines the angle of attack at each blade section. Because the tangential velocity Ωr increases from root to tip, the blade must be twisted (right) so that each section operates near its optimal angle of attack.
> **Alt text:** Velocity triangle diagram showing axial and tangential wind components at a blade element, alongside a side view of a twisted and tapered wind turbine blade with angles annotated at root, mid-span, and tip.
> **Data source:** Author illustration based on Glauert (1935) and Hansen (2015), *Aerodynamics of Wind Turbines*, 3rd ed.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Velocity vectors in blue (axial) and green (tangential), resultant in black, angles labeled in red.

---

## 5.5 The Cp-Lambda-Beta Surface: The Turbine's Operating Map

Two parameters control the aerodynamic performance of a wind turbine rotor at any given instant: the **tip speed ratio** and the **blade pitch angle**.

The **tip speed ratio** $\lambda$ is the ratio of the blade tip speed to the wind speed:

$$
\lambda = \frac{\Omega R}{V}
$$

where:
- $\lambda$ = tip speed ratio [dimensionless]
- $\Omega$ = rotor angular velocity [rad/s]
- $R$ = rotor radius [m]
- $V$ = freestream wind speed [m/s]

For a modern three-bladed horizontal-axis turbine, the optimal tip speed ratio — the value that maximises $C_p$ — is typically in the range $\lambda_{\text{opt}} \approx 7$ to $9$. The reason is tied to wake interference between successive blade passes. As a blade sweeps through the rotor disc, it leaves a region of disturbed, turbulent air behind it. If the next blade arrives before that air has recovered, it encounters turbulent inflow and extracts less energy. If the rotor turns too slowly, large sections of undisturbed air pass through between blades, wasting potential energy. The optimum balances these effects: fast enough to intercept most of the wind, slow enough to avoid excessive wake interference. For a three-bladed rotor, this balance occurs at $\lambda \approx 7$–$9$; for two blades, around $\lambda \approx 10$–$12$. [17]

The **blade pitch angle** $\beta$ is the angle of the entire blade (measured at some reference section, typically 70% or 75% span) relative to the rotor plane. Increasing $\beta$ (pitching "to feather") reduces the angle of attack and thus the aerodynamic forces. Decreasing $\beta$ (pitching "toward stall") increases the angle of attack.

The power coefficient $C_p$ is a function of both $\lambda$ and $\beta$:

$$
C_p = f(\lambda, \beta)
$$

When plotted as a three-dimensional surface — or, more commonly, as a contour map — this function is the turbine's **operating map**. It has a single peak at $(\lambda_{\text{opt}}, \beta_{\text{opt}})$ where $C_p$ reaches its maximum (typically 0.45 to 0.50 for a well-designed rotor). The surface falls off steeply if $\lambda$ is too low (the rotor is turning too slowly) or too high (excessive tip losses), and falls off with increasing $\beta$ as the blades are pitched away from optimal.

### Variable-Speed Operation: Two Regimes

Modern large turbines are **variable-speed, variable-pitch** machines. Their control strategy has two distinct operating regimes, separated by the rated wind speed:

**Below rated wind speed** (Region 2): The turbine adjusts its rotor speed to maintain $\lambda = \lambda_{\text{opt}}$, keeping $C_p$ at its maximum. As the wind speed increases, the rotor speeds up proportionally. The pitch angle is held constant at $\beta_{\text{opt}}$ (typically 0° to 2°). The power output follows the cubic relationship with wind speed:

$$
P = C_{p,\text{max}} \cdot \frac{1}{2} \rho A V^3
$$

This strategy is called **maximum power point tracking** (MPPT). The generator torque is controlled so that the rotor operates at the peak of the $C_p$-$\lambda$ curve at every wind speed. It is the wind turbine equivalent of the MPPT algorithms used in solar photovoltaics — except that here, the "tracking" is mechanical (rotor speed) rather than electrical (voltage).

**Above rated wind speed** (Region 3): The wind contains more power than the generator can handle. The rotor speed is held constant at its maximum value, and the blades are progressively pitched toward feather (increasing $\beta$) to deliberately reduce $C_p$. Power is held constant at the rated value — 15 MW for the V236. The pitch system is the valve that prevents the machine from exceeding its structural and electrical limits.

Between these two regimes is a narrow transition zone (Region 2.5) where the turbine transitions from speed control to pitch control.

The tip speed at rated conditions reveals the mechanical reality of these numbers. The V236-15.0 MW has a rotor radius of 118 metres and a maximum tip speed of 104 m/s. At rated conditions, the blade tips are moving at 374 km/h — faster than a Formula 1 car at full throttle, and only 80 km/h slower than the speed of sound at sea level. This is the reason modern blades are made from carbon-fibre-reinforced composites: no other material offers the combination of stiffness, strength, and lightness needed for a 115.5-metre structure spinning at those speeds. [18]

<!-- IMAGE: fig-05-05 -->
> **Figure 5.5** — The Cp-lambda-beta surface and two-regime control strategy
> **Type:** dual panel: contour plot + power curve
> **Content:** Left panel: contour plot of Cp as a function of λ (x-axis, range 2-15) and β (y-axis, range 0°-25°). Show the peak at approximately λ=8, β=0°, with Cp=0.48. Contour lines at 0.1 intervals. Mark the operating trajectory: a vertical line at β≈0° from λ=5 to λ=9 (Region 2, variable speed), then a horizontal line at λ≈8 sweeping to β=25° (Region 3, pitch control). Right panel: power curve showing power (MW) versus wind speed (m/s). Mark cut-in (3 m/s), rated (12-13 m/s), and cut-out (31 m/s). Region 2 follows the cubic curve; Region 3 is flat at rated power.
> **Caption:** The Cp-λ-β surface (left) defines the turbine's aerodynamic operating map. Below rated wind speed, the turbine tracks the optimal tip speed ratio. Above rated, blade pitch reduces Cp to hold constant power output (right).
> **Alt text:** Contour plot of power coefficient as a function of tip speed ratio and pitch angle, with operating trajectory marked, alongside a typical wind turbine power curve showing cubic growth below rated and constant power above rated.
> **Data source:** Author illustration based on generic 15 MW turbine parameters; power curve shape consistent with Vestas V236-15.0 MW published characteristics.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Cp contours in blue-to-red gradient (low to high), operating trajectory in white dashed line, power curve in dark blue.

---

## 5.6 Worked Example: How Much Power Does One Rotor Extract?

Consider a single turbine in a 500 MW offshore wind farm. The rotor has a diameter of 236 m, giving a swept area of $A = \pi \times 118^2 = 43{,}742$ m². The air density at sea level is $\rho = 1.225$ kg/m³. The peak power coefficient is $C_{p,\text{max}} = 0.48$, and the optimal tip speed ratio is $\lambda_{\text{opt}} = 8.0$. Rated power is 15 MW.

**Step 1: Available wind power at $V = 10$ m/s.**

$$
P_{\text{wind}} = \frac{1}{2} \rho A V^3 = \frac{1}{2} \times 1.225 \times 43{,}742 \times 10^3 = 26{,}792 \text{ kW} = 26.79 \text{ MW}
$$

**Step 2: Betz limit at $V = 10$ m/s.**

$$
P_{\text{Betz}} = \frac{16}{27} \times 26.79 = 15.88 \text{ MW}
$$

**Step 3: Actual extracted power (at peak Cp).**

$$
P_{\text{actual}} = C_{p,\text{max}} \times P_{\text{wind}} = 0.48 \times 26.79 = 12.86 \text{ MW}
$$

This is 81% of the Betz limit — a realistic value for a modern rotor. The turbine is below its 15 MW rated power, so Region 2 control applies: the rotor speed adjusts to maintain $\lambda_{\text{opt}} = 8.0$.

**Step 4: Rotor speed at $V = 10$ m/s.**

$$
\Omega = \frac{\lambda_{\text{opt}} \times V}{R} = \frac{8.0 \times 10}{118} = 0.678 \text{ rad/s} = 6.47 \text{ rpm}
$$

$$
V_{\text{tip}} = \Omega \times R = 0.678 \times 118 = 80.0 \text{ m/s} = 288 \text{ km/h}
$$

**Step 5: At rated wind speed ($V \approx 12.5$ m/s).**

$$
P_{\text{wind}} = \frac{1}{2} \times 1.225 \times 43{,}742 \times 12.5^3 = 52{,}329 \text{ kW} = 52.33 \text{ MW}
$$

$$
P_{\text{Betz}} = \frac{16}{27} \times 52.33 = 31.01 \text{ MW}
$$

But rated power is 15 MW — so the turbine must pitch its blades to deliberately reduce $C_p$:

$$
C_{p,\text{rated}} = \frac{15{,}000}{52{,}329} = 0.287
$$

At rated wind speed, the turbine extracts only 29% of the available wind energy — barely half of what the Betz limit allows. This is not a failure of engineering. It is deliberate. The pitch system is protecting the generator, the gearbox, and the grid connection from overload. Every kilowatt above 15 MW would be wasted heat in the generator windings.

**Step 6: Farm-level perspective.**

At 10 m/s (ignoring wake losses), 34 turbines produce:

$$
P_{\text{farm}} = 34 \times 12.86 = 437 \text{ MW} \quad (85\% \text{ of 510 MW rated})
$$

At rated wind speed, all 34 turbines produce their full 15 MW:

$$
P_{\text{farm}} = 34 \times 15 = 510 \text{ MW} \quad (100\% \text{ of rated})
$$

The cubic relationship between wind speed and power means that a small change in wind speed has an enormous effect on output. From 10 m/s to 12.5 m/s — a 25% increase in wind speed — the available power nearly doubles (from 26.8 MW to 52.3 MW). This cubic sensitivity is why wind resource assessment (Part III) matters so much to the economics of a wind farm.

---

## Key Takeaways

- **Lift, not drag, is the operating principle of every modern wind turbine.** Lift-based rotors can theoretically extract four times more energy than drag-based devices ($C_p = 16/27$ versus $4/27$). The airfoil shape — developed through two centuries of research from Cayley to Delft University — is the foundation of turbine performance.

- **The Betz limit (16/27 ≈ 59.3%) is an absolute ceiling on wind energy extraction.** Derived independently by Lanchester (1915), Betz (1920), and Joukowski (1920), it follows from conservation of mass and momentum. Modern turbines reach 76-84% of this limit — a remarkable achievement.

- **Blade element momentum theory connects the global energy balance to local blade design.** By dividing the blade into elements and matching momentum theory with aerodynamic force calculations, BEM determines the optimal twist, taper, and airfoil distribution from root to tip. Blades are twisted 10°-20° so every section operates near its optimal angle of attack.

- **The Cp-lambda-beta surface is the turbine's operating map.** Below rated wind speed, the control system tracks the optimal tip speed ratio to maximise energy capture. Above rated wind speed, blade pitch deliberately reduces Cp to hold power constant at the rated value.

- **The cubic relationship between wind speed and power dominates everything.** A 25% increase in wind speed nearly doubles the available power. This sensitivity is why site selection, hub height, and accurate wind measurement matter more to a wind farm's economics than any other single factor.

## For Further Reading

- **Burton, T., Jenkins, N., Sharpe, D., and Bossanyi, E. (2021).** *Wind Energy Handbook*, 3rd edition. Wiley. The standard reference for wind turbine aerodynamics, covering momentum theory, BEM, tip corrections, dynamic stall, and aeroelastic coupling. Chapters 3 and 4 provide the most thorough treatment of the material in this chapter, with full derivations and extensive worked examples.

- **Hansen, M.O.L. (2015).** *Aerodynamics of Wind Turbines*, 3rd edition. Routledge. A concise, mathematically rigorous treatment of BEM theory and its extensions, including the Glauert correction, Prandtl tip loss factor, and yaw modelling. More compact than Burton et al. and ideal for readers who want the equations without the broader context.

- **Manwell, J.F., McGowan, J.G., and Rogers, A.L. (2009).** *Wind Energy Explained: Theory, Design and Application*, 2nd edition. Wiley. An excellent introduction that balances theory with practical application, covering aerodynamics, structural loads, and control systems. Chapter 3 provides a clear, step-by-step development of BEM theory accessible to readers encountering it for the first time.

---

*Kaan ran his hand along the cut section of blade on the trestle. The carbon-fibre spar cap was cool and smooth under his fingers. He could feel the precision of the shape — the way the leading edge curved just so, the gradual thinning toward the trailing edge. An hour ago, it had been a white surface turning in the sky. Now it was a piece of applied mathematics: Bernoulli's pressure equation made solid in composite, Glauert's momentum balance frozen into twist and taper.*

*"Every metre of that blade," Morten said, nodding at the rotor above them, "has a different angle, a different chord width, a different airfoil profile. Root to tip — it's like a wing that redesigns itself every few metres. The guys who designed it probably ran ten thousand BEM iterations before they signed off."*

*Kaan looked up at the tower. The door at the base was open — a steel frame leading to a ladder and, beyond that, a service elevator that ran the full height. A hundred and fifty metres to the nacelle. The gearbox, the generator, the pitch system, the yaw drive — everything that converted the slow rotation of three blades into fifteen megawatts of electricity was up there.*

*"Ready to go up?" Anders asked.*

*Kaan zipped his harness, clipped his lanyard, and stepped through the door.*

---

## Notes

[1] The theoretical maximum Cp for an ideal drag-based wind device is 4/27, derived from the condition that the device cannot move faster than the wind. See: Burton, T., Jenkins, N., Sharpe, D., and Bossanyi, E. (2021). *Wind Energy Handbook*, 3rd ed. Wiley. Ch. 3.

[2] Cayley, G. (1809–1810). "On Aerial Navigation." *Nicholson's Journal of Natural Philosophy, Chemistry, and the Arts*, Parts I–III. Cayley's silver disc (1799), now in the Science Museum, London, contains the earliest known depiction of the four forces of flight as separate components. See also: Gibbs-Smith, C.H. (1962). *Sir George Cayley's Aeronautics 1796–1855*. HMSO, London.

[3] Lilienthal, O. (1889). *Der Vogelflug als Grundlage der Fliegekunst: Ein Beitrag zur Systematik der Flugtechnik*. R. Gaertners Verlagsbuchhandlung, Berlin. Published October 1889, 1,000 copies, with 80 woodcuts and 8 lithographed plates. English translation: *Birdflight as the Basis of Aviation* (1911). Lilienthal conducted over 2,000 glider flights between 1891 and 1896 before dying in a crash on August 10, 1896, at Rhinow, Germany.

[4] Kutta, M.W. (1902). "Auftriebskräfte in strömenden Flüssigkeiten" ("Lift Forces in Flowing Fluids"). *Illustrierte Aeronautische Mitteilungen*, 6, 133–135. Kutta established the trailing-edge condition that determines the unique circulation around an airfoil.

[5] Zhukovsky (Joukowski), N.E. (1906). "De la chute dans l'air de corps légers de forme allongée, animés d'un mouvement rotatoire." *Bulletin de l'Institut Aérodynamique de Koutchino*, 1, 51–65. Joukowski's derivation of lift from circulation, combined with Kutta's trailing-edge condition, forms the Kutta-Joukowski theorem.

[6] Abbott, I.H., and Von Doenhoff, A.E. (1959). *Theory of Wing Sections*. Dover Publications. The standard reference for NACA airfoil data, including lift and drag coefficient curves for the entire NACA four-digit and six-digit series. Lift-to-drag ratios of 100–150 are typical for modern wind turbine airfoils at design Reynolds numbers (Re = 3–9 × 10⁶).

[7] Timmer, W.A. (2009). "An Overview of NACA 6-Digit Airfoil Series Characteristics with Reference to Airfoils for Large Wind Turbine Blades." Presented at the 47th AIAA Aerospace Sciences Meeting, Orlando, FL. AIAA Paper 2009-268. Documents the performance degradation of NACA 63- and 64-series airfoils under leading-edge contamination conditions typical of wind turbine operation.

[8] Timmer, W.A., and van Rooij, R.P.J.O.M. (2003). "Summary of the Delft University Wind Turbine Dedicated Airfoils." *Journal of Solar Energy Engineering*, 125(4), 488–496. Also presented at the 41st AIAA Aerospace Sciences Meeting, Reno, NV. AIAA Paper 2003-352. Comprehensive overview of DU airfoils from 15% to 40% thickness, including the effect of Gurney flaps, vortex generators, and trip wires.

[9] Somers, D.M. (2005). "The S830, S831, and S832 Airfoils." NREL/SR-500-36339. National Renewable Energy Laboratory, Golden, CO. The NREL S-series airfoils were designed specifically for wind turbine applications, with emphasis on insensitivity to leading-edge roughness — a critical requirement for blades exposed to rain, insects, salt spray, and ice.

[10] Bernoulli, D. (1738). *Hydrodynamica, sive de Viribus et Motibus Fluidorum Commentarii*. Strasbourg: Johann Reinhold Dulsecker. Established the inverse relationship between fluid velocity and pressure that underlies all aerodynamic analysis.

[11] Lanchester, F.W. (1915). "A Contribution to the Theory of Propulsion and the Screw Propeller." *Transactions of the Institution of Naval Architects*, 57, 98–116. Lanchester derived the 16/27 maximum efficiency for an ideal actuator disc but relegated the wind energy application to an appendix. See: Bergey, K.H. (1979). "The Lanchester-Betz Limit." *Journal of Energy*, 3(6), 382–384.

[12] Betz, A. (1920). "Das Maximum der theoretisch möglichen Ausnutzung des Windes durch Windmotoren." *Zeitschrift für das gesamte Turbinenwesen*, 26, 307–309. Published September 20, 1920. Betz's PhD (1919, University of Göttingen) was on ship propellers with minimum energy loss; his wind energy work followed immediately.

[13] Joukowski, N.E. (1920). "Windmill of the NEJ Type." *Transactions of the Central Institute for Aero-Hydrodynamics of Moscow*. Joukowski derived the maximum rotor efficiency independently of Betz, in the same year. See: Okulov, V.L., and van Kuik, G.A.M. (2012). "The Betz-Joukowsky Limit: On the Contribution to Rotor Aerodynamics by the British, German and Russian Scientific Schools." *Wind Energy*, 15(2), 335–344. DOI: 10.1002/we.464.

[14] Modern utility-scale turbines achieve peak Cp values of 0.45–0.50, representing 76–84% of the Betz limit. See: Burton et al. (2021), *Wind Energy Handbook*, 3rd ed., Ch. 3. The remaining losses include tip vortices (~5%), profile drag (~5%), wake rotation (~2%), and mechanical/electrical conversion (~5%).

[15] Glauert, H. (1935). "Airplane Propellers." In: Durand, W.F. (Ed.), *Aerodynamic Theory*, Vol. IV, Division L. Springer, New York, pp. 169–360. Glauert (1892–1934) combined momentum theory with blade element theory to create the BEM method, which remains the foundation of wind turbine aerodynamic design. The chapter was published posthumously; Glauert died in 1934 from burns sustained in an accident at his home.

[16] Hansen, M.O.L. (2015). *Aerodynamics of Wind Turbines*, 3rd ed. Routledge, Ch. 6. Typical blade twist is 10°–20° from root to tip, with chord lengths tapering from 4–5 m at the root to 1–1.5 m at the tip for rotors in the 230+ m diameter class.

[17] Wilson, R.E., and Lissaman, P.B.S. (1974). "Applied Aerodynamics of Wind Power Machines." Oregon State University, Report NSF/RA/N-74-113. The relationship between optimal tip speed ratio and blade count arises from wake recovery time: fewer blades require higher λ to intercept the maximum fraction of undisturbed airflow.

[18] Vestas Wind Systems A/S. "V236-15.0 MW Offshore Wind Turbine." Product specifications: rotor diameter 236 m, blade length 115.5 m, swept area 43,742 m², rated tip speed 104 m/s (374 km/h). The 16% tip speed increase over previous designs is enabled by an erosion-resistant leading-edge shell integrated into the blade laminate.

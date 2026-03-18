# Chapter 8: The Atmosphere Is an Engine

*Kaan met Maja Kowalska on the SOV's aft deck at seven-thirty, wearing his harness and hardhat and carrying nothing else. She was already there — compact, unhurried, hair pulled back in a tight braid that the wind could not touch — adjusting a handheld instrument clipped to her jacket pocket. A Kestrel weather meter, he would later learn. She checked it the way other people checked their phones.*

*"You are the new control engineer," she said, not quite a question. She had a slight Polish accent and the air of someone who had been measuring things long before anyone asked her to. "Anders tells me you want to understand the wind."*

*"I want to understand where it comes from," Kaan said. "Why it blows. Why it is stronger at the top of the turbine than at the bottom."*

*Maja glanced at her Kestrel. "Eight point two metres per second, deck level. By the time that same air reaches hub height" — she pointed upward, toward the nacelles turning slowly against the grey Baltic sky — "it will be closer to eleven. Same air, same moment, different speed. That is the first thing I need you to understand."*

*They boarded the CTV for the short transfer to the meteorological mast — a lattice tower standing a kilometre east of the nearest turbine, bristling with cup anemometers, ultrasonic sensors, and wind vanes at five heights: 10, 40, 80, 120, and 150 metres. The mast had been there for three years, installed during the resource assessment campaign before a single foundation was driven. Its data — ten-minute averages, six per hour, 52,560 records per year per sensor — had determined whether this patch of Baltic Sea was worth half a billion euros.*

*On the mast platform at forty metres, the wind was different. Not just stronger — sharper. It pressed against Kaan's chest with a steady, insistent force that felt nothing like the gusts on the SOV deck. The sea below was a grey sheet scored with whitecaps. The turbines stood in their rows, their blades sweeping through air that Kaan was beginning to realise was not uniform, not simple, and not at all the same from one height to the next.*

*"Anders told you the atmosphere is an engine," Maja said, checking a sensor junction box with a practised eye. "He was not being poetic. He was being literal. The atmosphere is a heat engine. The sun provides the fuel. The Earth's surface is the hot reservoir. Space is the cold reservoir. And the wind — all of it, every breeze and every storm — is the mechanical output."*

*She turned to face him. "Today I will show you how the engine works."*

---

## 8.1 Earth's Heat Engine

The sun illuminates Earth with a power flux called the **total solar irradiance** (TSI), measured at approximately 1,361 W/m² at the top of the atmosphere — a value known historically as the **solar constant**, though it varies slightly with the eleven-year solar cycle. [1] But the Earth is a sphere, and the sun is effectively infinitely far away, so the solar flux that strikes each square metre of surface depends on the angle of incidence. At the equator, where the sun passes nearly overhead at noon, a square metre of surface receives close to the full 1,361 W/m². At 55° North — the latitude of the Polish Baltic — the same square metre receives approximately $1{,}361 \times \cos(55°) \approx 781$ W/m² at the top of the atmosphere, before any atmospheric absorption. At the poles, the flux approaches zero during winter.

The result is a permanent energy imbalance: the tropics absorb more solar energy than they emit as infrared radiation, while the polar regions emit more than they absorb. The Earth's climate system — atmosphere and ocean together — exists to correct this imbalance by transporting heat poleward. The atmosphere carries roughly 60% of this poleward heat transport; the ocean carries the rest. [2]

George Hadley, an English lawyer and amateur meteorologist, was the first to propose a coherent mechanism. In a paper read to the Royal Society in 1735 — "Concerning the Cause of the General Trade-Winds" — Hadley argued that warm air rises near the equator, flows poleward at altitude, cools, descends, and returns to the equator at the surface. The descending air creates the subtropical high-pressure belts near 30° latitude; the returning surface flow creates the persistent easterly trade winds that sailors had relied upon for centuries. Hadley's paper was so far ahead of the available observations that it was largely forgotten for more than a century, its authorship occasionally confused with his older brother John Hadley (the instrument-maker) or with Edmond Halley (the comet astronomer). [3]

Hadley's model was remarkably close to the truth for the tropical circulation, but it predicted a single hemisphere-spanning cell from equator to pole — and that prediction fails for the mid-latitudes. In 1856, the American meteorologist William Ferrel showed that the Earth's rotation prevents a single cell from reaching the poles. Instead, the atmosphere organises itself into three circulation cells per hemisphere: [4]

- **The Hadley cell** (0–30° latitude): warm air rises near the equator, flows poleward aloft, descends near 30°. Surface winds blow toward the equator, deflected westward by the Earth's rotation to form the northeast trades (Northern Hemisphere) and southeast trades (Southern Hemisphere).

- **The Ferrel cell** (30–60° latitude): a thermally indirect cell driven by the Hadley and polar cells. Surface winds blow poleward and are deflected eastward, forming the **prevailing westerlies** — the winds that dominate northern Europe and the Baltic Sea.

- **The polar cell** (60–90° latitude): cold air descends at the pole, flows equatorward at the surface, and is deflected westward to form the polar easterlies.

<!-- IMAGE: fig-08-01 -->
> **Figure 8.1** — Global atmospheric circulation: the three-cell model
> **Type:** schematic cross-section diagram
> **Content:** Cross-section of one hemisphere from equator to pole, showing three meridional cells: Hadley cell (0–30°), Ferrel cell (30–60°), Polar cell (60–90°). Mark the surface wind directions in each cell (northeast trades, southwest westerlies, polar easterlies for NH). Show rising air at equator (ITCZ), descending air at ~30° (subtropical highs), rising at ~60° (polar front), descending at poles. Include altitude markers (tropopause at ~16 km in tropics, ~8 km at poles). Mark the latitude of the Baltic wind farm (~55° N) with a vertical dashed line in the Ferrel cell. Show jet streams at cell boundaries (~10 km altitude).
> **Caption:** The atmosphere's three-cell circulation drives the surface wind patterns that determine wind energy resources globally. The Baltic wind farm at 55° N sits in the Ferrel cell, within the belt of prevailing westerlies that provide the dominant wind resource.
> **Alt text:** Schematic cross-section of atmospheric circulation from equator to pole showing Hadley, Ferrel, and Polar cells with surface wind directions and the Baltic farm location at 55° N marked.
> **Data source:** Author illustration adapted from Peixoto and Oort (1992) and Lorenz (1967).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Hadley cell in warm red/orange, Ferrel cell in blue, Polar cell in white/grey. Rising air in red arrows, descending in blue arrows. Wind farm location in green dashed line.

The Baltic wind farm sits at approximately 55° North — squarely within the Ferrel cell, in the belt of prevailing westerlies. The dominant wind direction is from the southwest to west, driven by the same planetary-scale heat engine that Hadley described nearly three centuries ago. Roughly 1 to 2% of the solar energy absorbed by the Earth is converted into kinetic energy of atmospheric motion — a tiny fraction, but one that amounts to approximately 2 × 10¹⁵ watts, more than a hundred times the world's total electricity consumption. The wind turbines in the Baltic capture a vanishingly small fraction of this planetary output. But they can only do so because the atmosphere's engine runs continuously, fuelled by a star 150 million kilometres away. [5]

---

## 8.2 The Coriolis Force and the Geostrophic Wind

The deflection of the trade winds — westward in one direction, eastward in the other — arises from a consequence of living on a rotating planet. The mathematics was first laid out by a French engineer who was not thinking about weather at all.

Gaspard-Gustave de Coriolis published his foundational paper in 1835: *Sur les équations du mouvement relatif des systèmes de corps* ("On the Equations of Relative Motion of Systems of Bodies"). His concern was practical — he was analysing the forces acting on components of waterwheels and other rotating machinery. But the mathematics was general: any object moving in a rotating reference frame experiences a deflecting force perpendicular to its velocity, proportional to the product of the object's speed and the rotation rate. Coriolis called it the "compound centrifugal force." It was not until the early twentieth century that meteorologists adopted the term **Coriolis force** for the atmospheric deflection it produces. The force is named after a man who studied waterwheels, not weather. [6]

The Coriolis force is not a real force in the Newtonian sense — it does no work, adds no energy, and does not exist in a non-rotating reference frame. But from the perspective of an observer standing on the Earth's surface, it is as real as gravity: it deflects every moving air parcel to the right in the Northern Hemisphere and to the left in the Southern Hemisphere.

The magnitude of the deflection depends on latitude. At the poles, where the surface is perpendicular to the rotation axis, the effect is strongest. At the equator, where the surface is parallel to the axis, it vanishes. This latitude dependence is captured by the **Coriolis parameter**:

$$
f = 2\Omega \sin(\varphi)
$$

where:
- $f$ = Coriolis parameter [rad/s]
- $\Omega$ = Earth's angular velocity = 7.292 × 10⁻⁵ rad/s
- $\varphi$ = latitude [°]

At the latitude of the Baltic wind farm (55° N):

$$
f = 2 \times 7.292 \times 10^{-5} \times \sin(55°) = 1.195 \times 10^{-4} \text{ rad/s}
$$

This number appears small, but it governs the large-scale wind patterns that determine the energy resource of every wind farm on Earth.

### The Geostrophic Balance

Above the atmospheric boundary layer — in the **free atmosphere**, typically above 500 to 1,000 metres — the wind flows nearly parallel to the isobars (lines of constant pressure) rather than from high pressure toward low pressure. This counterintuitive behaviour arises from the balance between two forces: the **pressure gradient force**, which pushes air from high to low pressure, and the **Coriolis force**, which deflects the moving air to the right (in the Northern Hemisphere) until it flows along the isobars rather than across them.

The resulting wind is called the **geostrophic wind**. It blows parallel to the isobars with low pressure to the left (in the Northern Hemisphere) — a rule known as **Buys Ballot's law**, after the Dutch meteorologist Christoph Buys Ballot, who published it in 1857. The geostrophic wind speed is inversely proportional to the spacing of the isobars: closely spaced isobars mean a strong pressure gradient and fast winds; widely spaced isobars mean gentle gradients and light winds. [7]

Below the free atmosphere, friction with the Earth's surface slows the wind, which weakens the Coriolis deflection, which allows the pressure gradient force to push the air slightly across the isobars toward low pressure. The result is that surface wind is both slower and rotated 10 to 40 degrees toward low pressure compared with the geostrophic wind aloft. The transition from friction-dominated surface flow to nearly frictionless geostrophic flow above is the central problem of boundary layer meteorology — and it has everything to do with how much wind energy reaches a turbine's rotor.

---

## 8.3 The Atmospheric Boundary Layer

The concept of a **boundary layer** — a thin region near a solid surface where friction dominates the flow — was introduced on the morning of 12 August 1904, when a twenty-nine-year-old professor named Ludwig Prandtl gave a ten-minute talk at the Third International Congress of Mathematicians in Heidelberg. The talk, titled *Über Flüssigkeitsbewegung bei sehr kleiner Reibung* ("On Fluid Motion with Very Small Friction"), proposed that the effects of viscosity in a fluid flow are confined to a thin layer adjacent to the surface, while the flow outside this layer behaves as if friction does not exist. The idea unified two previously irreconcilable branches of fluid mechanics — inviscid theory, which gave elegant solutions that did not match reality, and viscous theory, which gave correct physics but intractable equations. Ten minutes that arguably changed engineering forever. [8]

Prandtl's insight applies to every scale of fluid flow, from aircraft wings to ocean currents to the atmosphere. The **atmospheric boundary layer** (ABL) — also called the planetary boundary layer — is the lowest portion of the atmosphere, directly influenced by the Earth's surface and responding to surface friction, heating, and moisture on timescales of an hour or less. Above the ABL lies the **free atmosphere**, where the wind is governed by pressure gradients and the Coriolis force, largely unaffected by the surface. [9]

### Structure of the ABL

The ABL has three distinct sublayers:

**The surface layer** occupies the lowest 10% of the ABL — typically the bottom 50 to 200 metres. In this layer, the wind speed increases rapidly with height, the wind direction is approximately constant, and turbulent fluxes of momentum, heat, and moisture are nearly constant with height. It is the layer that contains most of a wind turbine's rotor, and it is where the logarithmic wind profile (Section 8.4) applies with greatest accuracy.

**The Ekman layer** (or **mixed layer**) extends from the top of the surface layer to the top of the ABL. Here, the wind speed continues to increase and the wind direction rotates clockwise (in the Northern Hemisphere) from the surface wind toward the geostrophic wind direction — a phenomenon called **wind veer**. For a large offshore turbine, the lower blade tip may sit within the surface layer while the upper tip reaches into the Ekman layer, experiencing both a different wind speed and a different wind direction during each rotation.

**The free atmosphere** begins at the ABL top. Above this height, the wind is approximately geostrophic, turbulence is minimal, and the surface has negligible influence.

### ABL Height

The height of the ABL varies dramatically:

- **Over land (daytime):** Solar heating warms the surface, creating unstable conditions and vigorous convective mixing. The ABL can grow to 1,500 to 2,500 metres by mid-afternoon.
- **Over land (nighttime):** Radiative cooling stabilises the surface layer, suppressing vertical mixing. The ABL collapses to 100 to 300 metres, often forming a temperature inversion and a **low-level jet** — a wind speed maximum at 100 to 300 metres that can significantly affect turbine loading and fatigue.
- **Over the sea:** The water surface temperature changes very slowly compared with land, so the diurnal cycle is strongly damped. The marine ABL is typically 300 to 800 metres deep, relatively steady, and often slightly stable in spring and summer when the sea surface is cooler than the air above. [10]

This stability of the marine boundary layer is one reason offshore wind resources are more predictable than onshore ones. The wind over the Baltic on a Tuesday at three in the afternoon is not dramatically different from the wind at three in the morning — a consistency that land-based sites cannot match.

### The Ekman Spiral

The rotation of wind direction with height across the ABL was first explained — not by a meteorologist, but by an oceanographer working on a problem posed by a polar explorer.

In 1893, the Norwegian explorer Fridtjof Nansen observed during the *Fram* expedition that Arctic icebergs drifted not downwind but systematically 20 to 40 degrees to the right of the surface wind direction. The observation puzzled him. Back in Stockholm, the Swedish physicist Vilhelm Bjerknes asked one of his students to investigate the problem mathematically. That student was Vagn Walfrid Ekman, and his solution — presented in his 1902 doctoral thesis and published in expanded form in 1905 — showed that the balance between friction and the Coriolis force in a rotating fluid produces a spiralling velocity profile: each successive layer of fluid moves at a slight angle to the layer below, with the direction rotating clockwise (in the Northern Hemisphere) with increasing height. The result is the **Ekman spiral**. [11]

<!-- IMAGE: fig-08-02 -->
> **Figure 8.2** — Structure of the atmospheric boundary layer
> **Type:** annotated vertical profile diagram with three panels
> **Content:** Three vertical cross-sections side by side. Left panel: daytime over land — convective mixed layer up to 1,500–2,500 m, vigorous thermals, uniform wind speed in mixed layer. Middle panel: nighttime over land — shallow stable boundary layer (100–300 m), residual layer above, low-level jet at ~200 m marked with wind speed maximum. Right panel: marine boundary layer — moderately stable, 300–800 m depth, gradual wind speed increase. For each panel, show a schematic wind speed profile. Mark the surface layer (~10% of ABL height), the Ekman layer, and the free atmosphere. On the marine panel, mark the V236 rotor sweep zone (32–268 m) spanning from the surface layer into the Ekman layer.
> **Caption:** The atmospheric boundary layer varies dramatically between land and sea, and between day and night. Over land, convective mixing creates deep daytime boundary layers that collapse at night, often forming low-level jets. Over the sea, the ABL is shallower and more temporally stable, with the V236's rotor sweep extending from the surface layer well into the Ekman layer.
> **Alt text:** Three-panel diagram showing atmospheric boundary layer structure over land during day, over land at night, and over the sea, with height annotations, wind speed profiles, and the V236 rotor zone marked on the marine panel.
> **Data source:** Author illustration based on Stull (1988) and Garratt (1992).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Daytime convective layer in warm orange/yellow, nocturnal stable layer in dark blue, marine boundary layer in teal. V236 rotor zone in light green shading. Low-level jet peak marked in red.

Ekman's original analysis applied to ocean currents, but Åkerblom demonstrated in 1908 that the same physics governs the atmospheric boundary layer. In the atmosphere, surface friction slows the wind near the ground and rotates it toward low pressure; with increasing height, friction weakens, the Coriolis force strengthens relative to friction, and the wind rotates toward the geostrophic direction. Across the full depth of the ABL, the wind direction may rotate by 20 to 40 degrees — precisely the same range Nansen observed for icebergs on the Arctic Ocean.

For a wind turbine with a 236-metre rotor, the wind direction difference between the lower blade tip (32 metres above sea level) and the upper blade tip (268 metres) can be 5 to 15 degrees under typical offshore conditions. This **wind veer** causes each blade to encounter a slightly different angle of attack at different points in its rotation — a periodic loading variation that contributes to fatigue and must be accounted for in the turbine's structural design.

---

## 8.4 Wind Shear: The Log Law and the Power Law

The increase of wind speed with height — **wind shear** — is the single most consequential atmospheric property for wind energy. It determines how much energy is available at hub height based on measurements made near the surface. Getting the wind shear model wrong by even a small amount can mean an error of tens of millions of euros in projected annual revenue.

### The Logarithmic Profile

The most physically grounded description of the wind profile in the surface layer is the **logarithmic wind profile**, derived from the assumption that turbulent shear stress near the surface is constant with height and that the size of turbulent eddies scales with distance from the surface:

$$
u(z) = \frac{u_*}{\kappa} \ln\left(\frac{z}{z_0}\right)
$$

where:
- $u(z)$ = mean wind speed at height $z$ [m/s]
- $u_*$ = friction velocity [m/s]
- $\kappa$ = von Kármán constant ≈ 0.40 [dimensionless]
- $z$ = height above ground or sea surface [m]
- $z_0$ = aerodynamic roughness length [m]

The **friction velocity** $u_*$ is not a physical wind speed but a scaling parameter defined as $u_* = \sqrt{\tau_0 / \rho}$, where $\tau_0$ is the surface shear stress and $\rho$ is air density. It represents the intensity of turbulent momentum transfer between the surface and the atmosphere.

The **roughness length** $z_0$ characterises how aerodynamically rough the surface is. It is not the physical height of surface obstacles but rather the height at which the logarithmic profile extrapolates to zero wind speed. Typical values span four orders of magnitude: [12]

| Surface type | Roughness length $z_0$ [m] |
|---|---|
| Open sea (calm to moderate) | 0.0001–0.0005 |
| Sand, snow on flat ground | 0.001 |
| Short grass (mowed lawn) | 0.01 |
| Agricultural land (crops) | 0.05–0.10 |
| Suburbs, scattered trees | 0.5 |
| City centre, dense buildings | 1.0–2.0 |

The offshore roughness length of approximately 0.0002 m is 500 to 10,000 times smaller than typical onshore values. This is the fundamental reason offshore wind speeds are higher at any given height: the sea offers almost no friction, so the wind retains far more of its geostrophic speed as it approaches the surface. Over the sea, the roughness length is not fixed — it depends on the wave state. Charnock (1955) showed that $z_0$ increases with wind speed as waves grow, following the relationship $z_0 = \alpha_c u_*^2 / g$, where $\alpha_c \approx 0.011$ is the Charnock parameter and $g$ is gravitational acceleration. But even in high winds, the offshore $z_0$ rarely exceeds 0.005 m — still orders of magnitude smoother than land. [13]

### The Power Law

For practical wind engineering — particularly when extrapolating from one measurement height to another without measuring friction velocity directly — the **power law** provides a simpler alternative:

$$
u(z) = u(z_{\text{ref}}) \left(\frac{z}{z_{\text{ref}}}\right)^{\alpha}
$$

where:
- $u(z)$ = wind speed at height $z$ [m/s]
- $u(z_{\text{ref}})$ = measured wind speed at reference height $z_{\text{ref}}$ [m/s]
- $z$ = target height [m]
- $z_{\text{ref}}$ = reference (measurement) height [m]
- $\alpha$ = wind shear exponent [dimensionless]

The power law has no rigorous physical derivation — it is an empirical fit — but its simplicity makes it the default model in many design standards and wind resource assessments. The shear exponent $\alpha$ depends on surface roughness, atmospheric stability, and height:

- **IEC 61400-3-1:2019** specifies $\alpha = 0.14$ for the Normal Wind Profile (NWP) model for fixed offshore wind turbines — the standard condition used for fatigue and load calculations under normal operating conditions.
- **IEC 61400-3-1:2019** specifies $\alpha = 0.11$ for the Extreme Wind Speed (EWS) model — representing the more neutral atmospheric conditions during severe storms.
- **Onshore sites** typically use $\alpha = 0.14$ to $0.25$, depending on terrain roughness and stability. [14]

The difference between $\alpha = 0.11$ and $\alpha = 0.14$ may seem trivial. It is not. For a turbine with a hub height of 150 metres and a measurement height of 10 metres, the predicted hub-height wind speed differs by about 8% — and since power scales with the cube of wind speed, the predicted power density differs by over 25%. Over the lifetime of a 500 MW wind farm, this translates to hundreds of millions of euros in projected revenue. The choice of shear exponent is, in financial terms, one of the most consequential modelling decisions in the entire project.

> **Standard reference:** IEC 61400-3-1:2019, "Wind energy generation systems — Part 3-1: Design requirements for fixed offshore wind turbines" — Clause 6.3 defines the Normal Wind Profile (NWP) model with $\alpha = 0.14$ and the Extreme Wind Speed (EWS) model with $\alpha = 0.11$ for offshore conditions. [14]

<!-- IMAGE: fig-08-03 -->
> **Figure 8.3** — Wind speed profiles for offshore and onshore sites
> **Type:** multi-line chart with height on vertical axis
> **Content:** Plot height (y-axis, 0 to 300 m) versus wind speed (x-axis, 5 to 15 m/s). Show four profiles, all anchored at 9.0 m/s at 10 m height: (1) logarithmic profile with z₀ = 0.0002 m (offshore, neutral stability — solid blue), (2) power law with α = 0.14 (offshore, IEC NWP — dashed blue), (3) power law with α = 0.11 (offshore, IEC EWS — solid green), (4) power law with α = 0.20 (onshore, rough terrain — solid orange). Mark the V236 hub height (150 m) with a horizontal dashed line and the rotor sweep zone (32–268 m) with a light grey shaded band. Annotate the wind speed value at 150 m for each profile: 11.3, 13.1, 12.1, and 14.4 m/s respectively.
> **Caption:** Wind speed increases with height according to surface roughness and atmospheric stability. The offshore neutral log law and IEC power law profiles diverge above 100 m, illustrating the sensitivity of hub-height wind speed estimates to the chosen shear model. The grey band shows the V236's rotor sweep zone (32–268 m).
> **Alt text:** Chart showing four wind speed profiles from 0 to 300 metres height, with offshore profiles rising more gradually than the onshore profile, and hub-height wind speed values annotated for each curve.
> **Data source:** Author calculations using the logarithmic profile (z₀ = 0.0002 m) and power law (α = 0.11, 0.14, 0.20). IEC 61400-3-1:2019 for offshore shear exponents.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Log law (offshore, neutral) in solid blue, IEC NWP (α = 0.14) in dashed blue, IEC EWS (α = 0.11) in solid green, onshore (α = 0.20) in solid orange. Rotor zone in light grey shading.

---

## 8.5 Turbulence Intensity

No wind is truly steady. Even on a calm, clear day, the wind speed measured by a fast-response anemometer fluctuates rapidly — gusting above and dipping below the ten-minute mean in an irregular, chaotic pattern. These fluctuations are **turbulence**, and they matter enormously for wind turbine design because they create fluctuating loads on the blades, tower, and drivetrain that accumulate over millions of cycles into fatigue damage.

The standard measure of turbulence in wind energy is the **turbulence intensity** (TI):

$$
\text{TI} = \frac{\sigma_u}{\bar{u}}
$$

where:
- TI = turbulence intensity [dimensionless, often expressed as %]
- $\sigma_u$ = standard deviation of the wind speed over a 10-minute period [m/s]
- $\bar{u}$ = mean wind speed over the same 10-minute period [m/s]

A turbulence intensity of 10% at a mean wind speed of 12 m/s means the standard deviation of the fluctuations is 1.2 m/s — so roughly two-thirds of the instantaneous readings fall between 10.8 and 13.2 m/s (assuming a Gaussian distribution of fluctuations), with occasional gusts reaching further.

IEC 61400-1:2019 defines three turbulence categories for wind turbine design, based on the **representative ambient turbulence intensity at 15 m/s**: [15]

| Turbulence category | Reference TI at 15 m/s ($I_{\text{ref}}$) |
|---|---|
| A (high) | 0.16 |
| B (medium) | 0.14 |
| C (low) | 0.12 |

Offshore sites typically fall in category B or C, with ambient turbulence intensities of 5 to 8% at hub height — significantly lower than onshore sites, where terrain roughness and surface obstacles generate turbulence intensities of 10 to 20%. The difference is physical: over open water, the only source of surface-generated turbulence is friction between wind and waves. Over land, buildings, trees, hills, and varying terrain create larger and more energetic eddies.

Lower turbulence offshore is a double advantage. First, it reduces the fatigue loads on the turbine structure, potentially extending component life or allowing lighter structural design. Second, it reduces the uncertainty in wind speed measurements, making resource assessment more reliable and investors more confident in energy production estimates.

However, within an operating wind farm, turbulence intensity rises dramatically behind each turbine due to **wake effects** — the turbulent, reduced-velocity flow downstream of a rotor. Wake-added turbulence can increase the effective TI from 6% (ambient) to 12 to 18% for downwind turbines, depending on spacing and wind direction. This wake-added turbulence, not the ambient turbulence, often drives the fatigue design of turbines in the interior rows of the farm — a topic that Chapter 10 will examine in detail. [16]

> **Standard reference:** IEC 61400-1:2019, "Wind energy generation systems — Part 1: Design requirements" — Clause 6.3 defines the Normal Turbulence Model (NTM) with turbulence categories A, B, and C, specifying reference turbulence intensity values at a reference wind speed of 15 m/s. [15]

<!-- IMAGE: fig-08-04 -->
> **Figure 8.4** — Turbulence intensity versus wind speed for IEC turbulence categories
> **Type:** line chart with data overlay
> **Content:** Plot turbulence intensity (y-axis, 0% to 25%) versus mean hub-height wind speed (x-axis, 4 to 25 m/s). Show three curves for IEC turbulence categories A ($I_{\text{ref}}$ = 0.16), B (0.14), and C (0.12) using the IEC Normal Turbulence Model. Overlay scattered data points from a representative offshore met mast dataset (TI typically 5–8% at moderate wind speeds, decreasing toward 4–5% at 15+ m/s) to show that real offshore data falls well below even category C at most wind speeds. Annotate: "Offshore ambient TI: typically 5–8% at hub height" and "Wake-added TI can reach 12–18%."
> **Caption:** Turbulence intensity decreases with increasing wind speed because the mean wind grows faster than turbulent fluctuations. Offshore sites typically fall below IEC category C, reflecting the aerodynamically smooth sea surface. Wake-added turbulence (not shown on this chart) can significantly raise effective TI for downwind turbines.
> **Alt text:** Line chart showing three IEC turbulence intensity curves (categories A, B, C) decreasing with wind speed, overlaid with scattered offshore data points mostly below category C.
> **Data source:** IEC 61400-1:2019 Normal Turbulence Model; representative offshore ambient data based on Peña et al. (2016) and Türk and Emeis (2010).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Category A in red, B in amber, C in green. Offshore data points in blue circles.

---

## 8.6 Atmospheric Stability and the Monin-Obukhov Framework

The logarithmic wind profile derived in Section 8.4 assumes **neutral stability** — a condition where the vertical temperature gradient follows the **dry adiabatic lapse rate** (approximately –9.8 °C per 1,000 metres) and buoyancy forces neither enhance nor suppress turbulent mixing. Neutral conditions occur when strong winds generate enough mechanical turbulence to overwhelm any buoyancy effects — typically during storms or very windy periods. [17]

In reality, the atmosphere is rarely neutral. Over the sea, stability depends on the temperature difference between the water surface and the air above:

**Unstable conditions** occur when the sea surface is warmer than the air — common in autumn and early winter in the Baltic, when the sea retains summer heat while cold continental air masses arrive from the east. Warm surface air rises, creating buoyant convective eddies that enhance vertical mixing. The wind profile becomes more uniform with height: the wind speed at hub height is lower than the neutral log law predicts, because turbulent mixing has brought faster air downward and pushed slower air upward.

**Stable conditions** occur when the sea surface is cooler than the air — typical in spring and summer, when the Baltic surface is still cold but warm air arrives from the south. Cool surface air resists rising, suppressing vertical mixing. The wind profile becomes steeper: wind speed at hub height is higher than the neutral prediction, because the lack of mixing allows the upper flow to decouple from surface friction. Stable conditions can also produce **low-level jets** — thin layers of supergeostrophic wind speed at 100 to 300 metres that can increase both energy production and turbine loading.

**Neutral conditions** are the transition — when buoyancy effects are negligible compared with mechanical turbulence. This typically occurs at high wind speeds (above 12 to 15 m/s), where shear-driven mixing dominates regardless of the temperature gradient.

### The Obukhov Length

The physicist Alexander Obukhov, together with the applied mathematician Andrei Monin, formalised the relationship between stability and wind profiles in a landmark 1954 paper: "Basic Laws of Turbulent Mixing in the Surface Layer of the Atmosphere." Their theory — **Monin-Obukhov similarity theory** (MOST) — introduces a single scaling length that characterises the stability of the surface layer: [18]

$$
L = -\frac{u_*^3 \, \bar{\theta}_v}{\kappa \, g \, \overline{w'\theta_v'}}
$$

where:
- $L$ = Obukhov length [m]
- $u_*$ = friction velocity [m/s]
- $\bar{\theta}_v$ = mean virtual potential temperature [K]
- $\kappa$ = von Kármán constant ≈ 0.40 [dimensionless]
- $g$ = gravitational acceleration ≈ 9.81 m/s²
- $\overline{w'\theta_v'}$ = surface kinematic heat flux [K·m/s]

The physical meaning of $L$ is elegant: it is the height at which buoyancy-produced turbulence equals mechanically produced turbulence. The sign of $L$ reveals the stability regime:

- $L > 0$ (positive): **stable** — surface heat flux is downward (cool surface, warm air), suppressing turbulence
- $L < 0$ (negative): **unstable** — surface heat flux is upward (warm surface, cool air), enhancing turbulence
- $|L| \to \infty$: **neutral** — heat flux approaches zero, buoyancy effects vanish

Typical magnitudes range from $|L| \approx 10$ to $50$ m in strongly stable or unstable conditions (buoyancy dominates even near the surface) to over 1,000 m in near-neutral conditions (mechanical turbulence overwhelms buoyancy). For wind energy, the dimensionless ratio $z/L$ — where $z$ is the measurement or hub height — determines how strongly stability modifies the neutral log law. [19]

### The Stability-Corrected Log Law

Monin-Obukhov similarity theory modifies the neutral logarithmic profile by adding a **stability correction function** $\psi_m$:

$$
u(z) = \frac{u_*}{\kappa} \left[ \ln\left(\frac{z}{z_0}\right) - \psi_m\left(\frac{z}{L}\right) \right]
$$

where:
- $\psi_m(z/L)$ = integrated stability correction function for momentum [dimensionless]
- All other variables as defined previously

The function $\psi_m$ was determined empirically by Businger, Wyngaard, Izumi, and Bradley in 1971 from the landmark Kansas experiment — a field campaign in the wheat fields of central Kansas that measured turbulent fluxes and mean profiles under a wide range of stability conditions: [20]

- **Unstable** ($z/L < 0$): $\psi_m > 0$, which reduces the effective wind speed gradient — the profile is more uniform than the neutral case, reflecting enhanced mixing by buoyant eddies.
- **Stable** ($z/L > 0$): $\psi_m < 0$, which increases the effective wind speed gradient — the profile is steeper than the neutral case, reflecting the suppression of vertical mixing.
- **Neutral** ($z/L = 0$): $\psi_m = 0$, and the formula reduces to the standard logarithmic profile.

For offshore wind farm design, the practical consequence is significant. At a site where the annual average stability is slightly stable ($z/L \approx +0.05$, typical of the Baltic in spring and summer), the hub-height wind speed may be 5 to 10% higher than the neutral log law predicts — and the available power density 15 to 33% higher, due to the cubic relationship. This is partly why the IEC power law exponent ($\alpha = 0.14$) is larger than the neutral log law equivalent ($\alpha \approx 0.08$ for $z_0 = 0.0002$ m): the standard implicitly accounts for the typically non-neutral offshore atmosphere. Ignoring stability in the resource assessment can lead to systematic errors of hundreds of gigawatt-hours in projected annual energy production.

<!-- IMAGE: fig-08-05 -->
> **Figure 8.5** — Effect of atmospheric stability on the wind speed profile
> **Type:** multi-line chart with secondary panel
> **Content:** Main panel: plot height (y-axis, 0 to 300 m) versus wind speed (x-axis, 6 to 16 m/s), showing three wind speed profiles all computed with $u_* = 0.35$ m/s and $z_0 = 0.0002$ m: (1) neutral ($\psi_m = 0$, solid black), (2) unstable ($z/L = -0.1$, profile more uniform — dashed blue), (3) stable ($z/L = +0.1$, profile steeper — dashed red). Mark the V236 hub height (150 m) and annotate the hub-height wind speed for each stability regime. Secondary panel (right): schematic temperature profiles for each case — neutral (follows adiabatic lapse rate), unstable (warmer near surface, superadiabatic decrease), stable (temperature inversion near surface).
> **Caption:** Atmospheric stability fundamentally alters the wind speed profile. Under stable conditions, wind speeds at hub height (150 m) are significantly higher than the neutral prediction, while unstable conditions reduce hub-height wind speed by enhancing vertical mixing. The temperature profiles (right) illustrate the underlying physical mechanism.
> **Alt text:** Three wind speed profiles (stable, neutral, unstable) plotted against height from 0 to 300 m, showing stable conditions producing the highest hub-height wind speed and unstable conditions the lowest, with accompanying temperature profile diagrams.
> **Data source:** Author calculations using the Monin-Obukhov stability-corrected log law with Businger-Dyer (1971) empirical functions. Parameters: $z_0 = 0.0002$ m, $u_* = 0.35$ m/s.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Neutral profile in solid black, unstable in dashed blue, stable in dashed red. Temperature panel uses the same colour scheme.

---

## 8.7 Worked Example: From Measurement Mast to Hub Height

A meteorological mast at an offshore site measures an annual mean wind speed of 9.0 m/s at 10 metres above mean sea level. The aerodynamic roughness length for the site is $z_0 = 0.0002$ m. The turbines will have a hub height of 150 m. Air density is $\rho = 1.225$ kg/m³. What is the expected wind speed and power density at hub height?

**Step 1: Logarithmic profile (neutral stability).**

Calculate the friction velocity from the measurement:

$$
u_* = \frac{\kappa \, u(10)}{\ln(z / z_0)} = \frac{0.40 \times 9.0}{\ln(10 / 0.0002)} = \frac{3.60}{10.82} = 0.333 \text{ m/s}
$$

Extrapolate to hub height:

$$
u(150) = \frac{u_*}{\kappa} \ln\left(\frac{150}{z_0}\right) = \frac{0.333}{0.40} \times \ln(750{,}000) = 0.832 \times 13.53 = 11.3 \text{ m/s}
$$

The neutral log law predicts a 25% increase in wind speed from 10 m to 150 m.

**Step 2: Power law (IEC 61400-3-1 Normal Wind Profile, $\alpha = 0.14$).**

$$
u(150) = 9.0 \times \left(\frac{150}{10}\right)^{0.14} = 9.0 \times 15^{0.14} = 9.0 \times 1.461 = 13.1 \text{ m/s}
$$

The IEC power law predicts a 46% increase — nearly twice the shear predicted by the neutral log law.

**Step 3: Why do the methods disagree?**

The neutral log law with $z_0 = 0.0002$ m yields an effective shear exponent of $\alpha \approx 0.08$ between 10 m and 150 m — the profile one would observe if the atmosphere were perfectly neutral at all times. The IEC value of $\alpha = 0.14$ represents typical offshore conditions, which include the average effect of atmospheric stability (predominantly slightly stable over the sea). The difference between the two is the stability effect, and it is worth 1.8 m/s at hub height.

**Step 4: Power density comparison.**

| Height | Wind speed (log law) | Wind speed (IEC NWP) | Power density (log law) | Power density (IEC NWP) |
|---|---|---|---|---|
| 10 m | 9.0 m/s | 9.0 m/s | 447 W/m² | 447 W/m² |
| 150 m | 11.3 m/s | 13.1 m/s | 884 W/m² | 1,377 W/m² |
| **Ratio (150 m / 10 m)** | **1.25×** | **1.46×** | **1.98×** | **3.08×** |

The power density at hub height is two to three times the power density at the measurement height — depending entirely on which shear model is correct for the site. Notice the cubic amplification: a 25% wind speed increase translates to a 98% increase in power density; a 46% wind speed increase translates to a 208% increase. The cubic law magnifies every modelling uncertainty relentlessly.

**Step 5: Revenue impact.**

The IEC power law predicts 56% more power density at hub height than the neutral log law. If this translates to even a 10% difference in projected annual energy production for a 500 MW farm producing roughly 2,200 GWh per year, the revenue difference is 220 GWh × 60 EUR/MWh = 13.2 million EUR per year — or nearly 400 million EUR over the farm's 30-year design life. This is why resource assessment engineers insist on multi-year measurement campaigns, site-specific stability analysis, and rigorous validation of their shear models against measured data at hub height. The mast that Kaan climbed this morning exists to keep that uncertainty as small as possible.

---

## Key Takeaways

- **Wind is the mechanical output of a planetary heat engine.** Differential solar heating between the equator and the poles drives the three-cell atmospheric circulation (Hadley, Ferrel, Polar). The Baltic wind farm sits in the Ferrel cell's belt of prevailing westerlies, tapping roughly 1–2% of the solar energy that the atmosphere converts into kinetic motion.

- **Wind speed increases with height because surface friction slows the air near the ground.** The logarithmic wind profile describes this increase using two parameters: friction velocity and roughness length. Offshore roughness ($z_0 \approx 0.0002$ m) is 500 to 10,000 times smaller than onshore values, which is why offshore winds are stronger and more uniform.

- **The choice of shear model directly determines projected revenue.** The neutral log law and the IEC power law ($\alpha = 0.14$) can disagree by nearly 2 m/s at 150 m hub height — a difference worth hundreds of millions of euros over a project lifetime, amplified by the cubic relationship between wind speed and power density.

- **Atmospheric stability modifies everything.** Stable conditions (cool sea, warm air) steepen the wind profile and increase hub-height wind speeds; unstable conditions flatten it. The Monin-Obukhov framework, built on a single scaling length $L$, provides the theoretical foundation for correcting the neutral log law.

- **Turbulence intensity is lower offshore — but wake effects multiply it.** Ambient offshore TI of 5–8% compares favourably with 10–20% onshore, reducing fatigue loads and measurement uncertainty. However, wake-added turbulence within the farm can double the effective TI for interior turbines.

## For Further Reading

- **Stull, R.B. (1988).** *An Introduction to Boundary Layer Meteorology*. Kluwer Academic Publishers, Dordrecht. Chapters 1–6 and 9. The definitive graduate-level textbook on the atmospheric boundary layer — thorough treatment of turbulence, stability, surface layer similarity, and the Ekman layer, with worked examples and derivations throughout.

- **Emeis, S. (2018).** *Wind Energy Meteorology: Atmospheric Physics for Wind Power Generation*. 2nd edition. Springer. Covers the specific meteorological topics relevant to wind energy — wind profiles, stability, turbulence, wakes, and mesoscale effects — with direct applications to site assessment and turbine design.

- **Burton, T., Jenkins, N., Sharpe, D., and Bossanyi, E. (2021).** *Wind Energy Handbook*. 3rd edition. Wiley. Chapter 2 ("The Wind Resource"). An accessible yet rigorous treatment of wind shear, turbulence, and the atmospheric boundary layer from the wind engineer's perspective, with direct connections to IEC design standards and energy yield estimation.

---

*The wind had not changed by the time they returned to the SOV — or rather, Kaan could not have said whether it had changed, because he had spent the morning learning that the wind he felt on the aft deck was only a fraction of the story. The same air, the same molecules, moved faster a hundred metres above his head and in a slightly different direction, shaped by forces he could now name: friction, stability, the rotation of the planet itself.*

*At the mess table, Maja spread a printout — a twelve-month wind rose from the met mast, the compass divided into 36 sectors, each bar coloured by wind speed bin. The dominant sector was southwest, as expected for the prevailing westerlies. But the detail mattered: the distribution was not symmetric, the nighttime data differed from daytime (though less so than an onshore site would show), and the strongest winds came from slightly different directions than the most frequent ones.*

*"You now understand why the wind blows and why it is stronger at hub height than at the surface," Maja said. "But understanding the physics is not the same as knowing the wind at a specific site. The Coriolis force does not tell you whether the mean speed at 150 metres is 11.3 or 13.1 m/s — only measurements can do that. And the measurements themselves are imperfect. They come from instruments with calibration drift, from models that assimilate satellite data, from reanalysis grids that average over 30 kilometres."*

*She tapped the wind rose. "Tomorrow I will show you where the data comes from. The measurement campaigns. The reanalysis archives. The Weibull distribution. The difference between data and knowledge." She paused. "That is where the money is made — or lost."*

*Kaan looked at the wind rose — a diagram of invisible forces drawn from three years of ten-minute averages — and thought about the mast standing alone a kilometre from the nearest turbine. A lattice of steel and sensors, measuring something you cannot see, to justify half a billion euros. It seemed fragile. It seemed essential.*

---

## Notes

[1] Solar constant and total solar irradiance: Kopp, G. and Lean, J.L. (2011). "A New, Lower Value of Total Solar Irradiance: Evidence and Climate Significance." *Geophysical Research Letters*, 38, L01706. DOI: 10.1029/2010GL045777. The updated TSI value of 1360.8 ± 0.5 W/m² replaced the previously accepted value of ~1366 W/m². The "solar constant" varies by approximately 0.1% over the 11-year solar cycle.

[2] Meridional heat transport: Trenberth, K.E. and Caron, J.M. (2001). "Estimates of Meridional Atmosphere and Ocean Heat Transports." *Journal of Climate*, 14, 3433–3443. DOI: 10.1175/1520-0442(2001)014<3433:EOMAAO>2.0.CO;2. The atmosphere carries approximately 60% of total poleward heat transport in the mid-latitudes; the ocean carries the remainder, primarily through the thermohaline circulation and wind-driven surface currents.

[3] Hadley, G. (1735). "Concerning the Cause of the General Trade-Winds." *Philosophical Transactions of the Royal Society*, 39, 58–62. Hadley's single-cell model correctly explained the trade winds but failed for mid-latitude westerlies. His contribution was largely unrecognised for over a century; see: Lorenz, E.N. (1983). "A History of Prevailing Ideas about the General Circulation of the Atmosphere." *Bulletin of the American Meteorological Society*, 64(7), 730–734.

[4] Ferrel, W. (1856). "An Essay on the Winds and the Currents of the Ocean." *Nashville Journal of Medicine and Surgery*, 11, 287–301. Ferrel demonstrated that the Earth's rotation prevents a single Hadley cell from extending pole-to-pole, proposing instead the mid-latitude indirect cell now bearing his name. For a comprehensive treatment of the three-cell model: Lorenz, E.N. (1967). *The Nature and Theory of the General Circulation of the Atmosphere*. World Meteorological Organisation, Geneva.

[5] Total kinetic energy generation rate in the atmosphere: Peixoto, J.P. and Oort, A.H. (1992). *Physics of Climate*. American Institute of Physics, New York. Estimated at approximately 2 to 3.6 × 10¹⁵ watts (~1–2% of absorbed solar radiation). Global electricity consumption in 2023 was approximately 29,000 TWh/yr ≈ 3.3 TW average power. Also: Lorenz, E.N. (1955). "Available Potential Energy and the Maintenance of the General Circulation." *Tellus*, 7(2), 157–167.

[6] Coriolis, G.G. de (1835). "Sur les équations du mouvement relatif des systèmes de corps." *Journal de l'École Royale Polytechnique*, 15, 142–154. Coriolis referred to the deflecting force as the "compound centrifugal force" (*force centrifuge composée*). The term "Coriolis force" was adopted by meteorologists in the early twentieth century. For a historical survey: Persson, A.O. (1998). "How Do We Understand the Coriolis Force?" *Bulletin of the American Meteorological Society*, 79(7), 1373–1385.

[7] Buys Ballot, C.H.D. (1857). "Note sur le rapport de l'intensité et de la direction du vent avec les écarts simultanés du baromètre." *Comptes Rendus de l'Académie des Sciences*, 45, 765–768. Buys Ballot's law states that in the Northern Hemisphere, if you stand with your back to the wind, low pressure is to your left. The geostrophic wind speed is inversely proportional to the spacing of isobars and directly proportional to the pressure gradient and inversely proportional to the Coriolis parameter.

[8] Prandtl, L. (1904). "Über Flüssigkeitsbewegung bei sehr kleiner Reibung." *Verhandlungen des III. Internationalen Mathematiker-Kongresses*, Heidelberg, 484–491. Prandtl was twenty-nine, a professor at the Technical University of Hanover, and his talk lasted ten minutes. For historical context: Anderson, J.D. (2005). "Ludwig Prandtl's Boundary Layer." *Physics Today*, 58(12), 42–48. DOI: 10.1063/1.2169443.

[9] Atmospheric boundary layer structure: Stull, R.B. (1988). *An Introduction to Boundary Layer Meteorology*. Kluwer Academic Publishers, Dordrecht. Chapter 1 provides the three-layer structure (surface layer, Ekman layer, free atmosphere) and discusses the scaling arguments for surface layer depth (~10% of ABL height).

[10] Marine atmospheric boundary layer: Garratt, J.R. (1992). *The Atmospheric Boundary Layer*. Cambridge University Press. Chapter 7. The marine ABL is typically 300–800 m deep with strongly damped diurnal variation. Also: Peña, A., Gryning, S.E., and Hasager, C.B. (2008). "Measurements and Modelling of the Wind Speed Profile in the Marine Atmospheric Boundary Layer." *Boundary-Layer Meteorology*, 129, 479–495. DOI: 10.1007/s10546-008-9323-9.

[11] Ekman, V.W. (1905). "On the Influence of the Earth's Rotation on Ocean-Currents." *Arkiv för Matematik, Astronomi och Fysik*, 2(11), 1–52. Doctoral thesis presented 1902. Nansen's observation of iceberg drift at 20–40° to the right of the wind direction during the *Fram* expedition (1893–1896) was the stimulus for Ekman's analysis. Bjerknes posed the problem to Ekman while both were at the University of Stockholm. Åkerblom (1908) extended the Ekman spiral to the atmospheric boundary layer.

[12] Surface roughness classification: Wieringa, J. (1992). "Updating the Davenport Roughness Classification." *Journal of Wind Engineering and Industrial Aerodynamics*, 41–44, 357–368. The roughness length $z_0$ ranges over four orders of magnitude from open sea (~0.0002 m) to dense urban centres (~2 m). Values depend on fetch, land use, and season.

[13] Charnock, H. (1955). "Wind Stress on a Water Surface." *Quarterly Journal of the Royal Meteorological Society*, 81(350), 639–640. The Charnock relation $z_0 = \alpha_c u_*^2/g$ accounts for the dependence of sea surface roughness on wave state. The Charnock parameter $\alpha_c$ varies from ~0.011 (open ocean) to ~0.018 (fetch-limited coastal waters).

[14] International Electrotechnical Commission. IEC 61400-3-1:2019, "Wind energy generation systems — Part 3-1: Design requirements for fixed offshore wind turbines." Clause 6.3 defines the Normal Wind Profile (NWP) model with shear exponent $\alpha = 0.14$ for normal offshore conditions and $\alpha = 0.11$ for the Extreme Wind Speed (EWS) model. These values implicitly incorporate the average stability conditions observed at typical offshore sites.

[15] International Electrotechnical Commission. IEC 61400-1:2019, "Wind energy generation systems — Part 1: Design requirements." Edition 4.0. Clause 6.3 defines the Normal Turbulence Model (NTM) with reference turbulence intensities: Category A ($I_{\text{ref}} = 0.16$), B (0.14), C (0.12), measured at 15 m/s reference wind speed. The model specifies $\sigma_1 = I_{\text{ref}}(0.75 V_{\text{hub}} + b)$, where $b = 5.6$ m/s.

[16] Wake-added turbulence: Frandsen, S.T. (2007). "Turbulence and Turbulence-Generated Structural Loading in Wind Turbine Clusters." Risø National Laboratory, Risø-R-1188(EN). The Frandsen wake turbulence model is the basis for the effective turbulence calculation in IEC 61400-1:2019, Annex D. Wake-added TI depends on spacing, ambient TI, and thrust coefficient. Also: Barthelmie, R.J., et al. (2009). "Quantifying the Impact of Wind Turbine Wakes on Power Output at Offshore Wind Farms." *Journal of Atmospheric and Oceanic Technology*, 26(6), 1181–1190.

[17] Atmospheric stability and the neutral assumption: Arya, S.P. (2001). *Introduction to Micrometeorology*. 2nd edition. Academic Press. Chapter 11. Neutral conditions occur when the wind-generated mechanical turbulence overwhelms any buoyancy-driven convection, typically at wind speeds above 12–15 m/s. At lower speeds, stability effects can significantly alter the wind profile.

[18] Monin, A.S. and Obukhov, A.M. (1954). "Osnovnye zakonomernosti turbulentnogo peremeshivaniya v prizemnom sloe atmosfery" (Basic Laws of Turbulent Mixing in the Surface Layer of the Atmosphere). *Trudy Geofizicheskogo Instituta Akademii Nauk SSSR*, No. 24(151), 163–187. The Obukhov length was first introduced by Obukhov in 1946; the full similarity framework was developed jointly with Monin in 1954. MOST remains the foundation of surface layer meteorology and is valid in the surface layer (~lowest 10% of ABL) under stationary, horizontally homogeneous conditions.

[19] Obukhov length interpretation and typical values: Garratt, J.R. (1992). *The Atmospheric Boundary Layer*. Cambridge University Press. Chapter 3. The Obukhov length $L$ ranges from ~10 m (strongly convective) through ~50 m (moderate instability) to $|L| > 1{,}000$ m (near-neutral). For offshore wind energy applications, Peña et al. (2008) report typical Baltic Sea values ranging from $L \approx +100$ to $+500$ m during spring/summer (slightly stable) and $L \approx -200$ to $-1{,}000$ m during autumn/winter (slightly unstable).

[20] Businger, J.A., Wyngaard, J.C., Izumi, Y., and Bradley, E.F. (1971). "Flux-Profile Relationships in the Atmospheric Surface Layer." *Journal of the Atmospheric Sciences*, 28, 181–189. DOI: 10.1175/1520-0469(1971)028<0181:FPRITA>2.0.CO;2. The Kansas experiment (summer 1968) provided the empirical functions $\phi_m(z/L)$ and $\phi_h(z/L)$ that are integrated to produce the stability correction functions $\psi_m$ and $\psi_h$ used in the Monin-Obukhov framework. For stable conditions, the linear form $\psi_m = -5z/L$ is widely used; for unstable conditions, the Businger-Dyer formulation involves the fourth root of $(1 - 16z/L)$.

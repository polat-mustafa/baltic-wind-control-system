# Chapter 10: Wake Effects: Why Turbines Steal Each Other's Wind

*Anders was waiting on the SOV's observation deck when Kaan arrived at seven o'clock on Day 5, two mugs of coffee already on the railing. The sea was flat — a rare Baltic morning when the water looked like brushed aluminium and the horizon dissolved into a pale grey haze. All thirty-four turbines were turning, their blades catching the low sun and throwing long shadows across the water.*

*"Look at the front row," Anders said, handing Kaan a mug without ceremony. He pointed southwest, where the first line of turbines faced the prevailing wind. "Now look at the back row."*

*Kaan looked. The front-row blades were spinning at a steady, purposeful cadence. The back-row blades — the ones furthest from the incoming wind — were turning visibly slower. He had noticed this on Day 2 during the nacelle visit with Morten, but had assumed it was a trick of perspective. Now, with all thirty-four turbines visible across six kilometres of open water, the difference was unmistakable.*

*Anders opened his tablet and turned the screen toward Kaan. It showed a scatter plot: turbine position on the horizontal axis, normalised power output on the vertical. The front-row turbines clustered near 1.0 — producing close to their expected output. The second row dropped to 0.92. The third to 0.87. The last row, eight rotor diameters behind the first, sat at 0.82.*

*"Eighteen percent," Kaan said.*

*"Eighteen percent of a fifteen-megawatt turbine," Anders corrected. "Times the number of turbines in the back rows, times thirty years." He took a sip of coffee. "That is the number that keeps layout engineers awake at night."*

*He swiped to a new screen — a satellite photograph of the Horns Rev wind farm in the Danish North Sea, taken on a February morning in 2008. The image was famous in wind energy: eighty turbines arranged in a regular grid, each one trailing a white plume of condensation that made the wake visible to the naked eye. The plumes stretched downwind for kilometres, each one narrower at the rotor and widening as it travelled, each one marking the region where the upstream turbine had extracted momentum from the air.*

*"Every turbine casts a shadow," Anders said. "Not a shadow of light — a shadow of wind. The air behind the rotor is slower, more turbulent, and less energetic. If you put another turbine in that shadow, it produces less power and its blades experience higher fatigue loads." He tapped the Horns Rev photograph. "This image is the reason we have an entire discipline called wake modelling. The physics is straightforward. The consequences are worth hundreds of millions of euros."*

---

## 10.1 The Physics of a Wake

A wind turbine extracts kinetic energy from the moving air by decelerating it. The rotor acts as a semi-permeable disc: the air that passes through it surrenders a fraction of its momentum, and the downstream flow is slower than the upstream flow. This velocity deficit is the defining feature of a wake.

The physics follows directly from the actuator disc theory introduced in Chapter 5. A turbine operating with an axial induction factor $a$ reduces the wind speed at the rotor plane from the free-stream velocity $U_\infty$ to $U_\infty(1 - a)$, and the velocity far downstream — in the fully developed wake — drops to $U_\infty(1 - 2a)$. At the Betz-optimal induction of $a = 1/3$, the far-wake velocity is only one-third of the free-stream velocity. In practice, modern turbines operate at $a \approx 0.25$ to 0.33 in the below-rated regime (Region 2), giving a far-wake velocity of 33 to 50% below the free-stream wind speed immediately behind the rotor. [1]

But the wake does not remain at its initial deficit forever. The slow-moving air in the wake is surrounded by faster free-stream air, and turbulent mixing at the boundary gradually entrains high-momentum air from outside the wake into the deficit region. This process — called **wake recovery** — causes the wake to expand in diameter while the velocity deficit decreases with downstream distance. Close to the rotor (within 2 to 3 rotor diameters), the wake is dominated by the near-wake region: a complex zone of tip vortices, root vortices, and the nacelle's recirculation bubble. Beyond approximately 3 to 5 rotor diameters, the tip vortices break down, the velocity profile becomes self-similar, and the wake enters the far-wake region where analytical models can describe it with reasonable accuracy. [2]

Two quantities define the severity of a wake at any downstream distance $x$: the **velocity deficit** $\Delta U(x)$ and the **added turbulence intensity** $\Delta I(x)$. The velocity deficit determines how much less power a downstream turbine can extract — and because power scales with the cube of wind speed, even a modest 10% deficit in velocity translates to a 27% deficit in available power. The added turbulence determines how much additional fatigue loading the downstream turbine's blades, tower, and drivetrain must endure over the project lifetime.

<!-- IMAGE: fig-10-01 -->
> **Figure 10.1** — Anatomy of a wind turbine wake
> **Type:** annotated schematic diagram
> **Content:** Side-view schematic of a wind turbine wake showing the free-stream velocity $U_\infty$ approaching from the left, the rotor disc, and the wake expanding downstream. Label the near-wake region (0–3D, with tip vortex spirals and nacelle recirculation), the transition zone (3–5D), and the far-wake region (>5D, with a smooth Gaussian-like velocity deficit profile). Show the wake diameter expanding linearly with distance. Overlay a velocity deficit profile at three cross-sections (2D, 5D, 10D) showing the evolution from a top-hat shape to a Gaussian bell curve. Mark the wake centreline velocity $U_w(x)$ and the free-stream velocity $U_\infty$ outside the wake.
> **Caption:** The anatomy of a wind turbine wake. In the near-wake region (0–3D), coherent tip vortices and the nacelle's recirculation zone create a complex, non-axisymmetric flow. Beyond 3–5D, turbulent mixing breaks down the vortex structure and the deficit profile becomes approximately Gaussian. The wake expands and recovers as ambient turbulence entrains high-momentum air from outside the wake boundary.
> **Alt text:** Side-view diagram of a wind turbine wake showing near-wake vortices, wake expansion, and velocity deficit profiles evolving from top-hat to Gaussian shape at increasing downstream distances.
> **Data source:** Author illustration based on Vermeer, Sørensen, and Crespo (2003) and Bastankhah and Porté-Agel (2014).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Free-stream flow in blue, wake deficit region in red-orange gradient (darker = larger deficit), vortex spirals in dark blue, velocity profiles in black line plots.

---

## 10.2 The Jensen Model: A Top-Hat That Changed an Industry

The first engineering wake model that was simple enough to run on the computers of the early 1980s — and accurate enough to be useful — was published in 1983 by Niels Otto Jensen of Risø National Laboratory in Denmark. His technical note, "A note on wind generator interaction," is eleven pages long, contains one core equation, and has been cited more than 1,400 times. It remains the foundation of the WAsP and Park family of wake models used by the wind industry for four decades. [3]

Jensen's insight was to assume that the wake expands linearly with downstream distance, like a cone, and that the velocity inside the wake is uniform across the cross-section at any given distance — a **top-hat** profile. The wake radius at a downstream distance $x$ from the rotor is:

$$
r_w(x) = r_0 + k_w x
$$

where:
- $r_w(x)$ = wake radius at distance $x$ [m]
- $r_0$ = initial wake radius, equal to the rotor radius $D/2$ [m]
- $k_w$ = wake decay constant (also called wake expansion coefficient) [dimensionless]
- $x$ = downstream distance from the rotor [m]

The wake decay constant $k_w$ is the single empirical parameter that controls how fast the wake recovers. For onshore sites with moderate turbulence, $k_w \approx 0.075$ is the classical value recommended in the WAsP model. For offshore sites, where the ambient turbulence intensity is lower and the wake recovers more slowly, typical values are $k_w \approx 0.04$ to 0.05. The lower offshore value means that wakes persist longer over the sea — a fact that makes wake losses more severe for offshore wind farms than for their onshore counterparts. [4]

Applying conservation of momentum to the expanding wake gives the velocity inside the wake at distance $x$:

$$
U_w(x) = U_\infty \left[ 1 - \frac{1 - \sqrt{1 - C_T}}{\left(1 + \frac{k_w x}{r_0}\right)^2} \right]
$$

where:
- $U_w(x)$ = wake velocity at downstream distance $x$ [m/s]
- $U_\infty$ = free-stream (undisturbed) wind speed [m/s]
- $C_T$ = thrust coefficient of the upstream turbine [dimensionless]
- $k_w$ = wake decay constant [dimensionless]
- $r_0$ = rotor radius $D/2$ [m]

The thrust coefficient $C_T$ encodes how aggressively the turbine is extracting momentum. At below-rated wind speeds (Region 2), a modern 15 MW turbine operates at $C_T \approx 0.8$; above rated (Region 3), the blades pitch to shed load and $C_T$ drops to 0.1–0.2. The Jensen model captures a crucial operational truth: wakes are deepest at moderate wind speeds (8–12 m/s), precisely the range where the turbine is working hardest to capture energy. At high wind speeds, the wake is shallow because the turbine is deliberately limiting its extraction.

Jensen's model has known limitations. The top-hat velocity profile overpredicts the deficit at the wake centreline and underpredicts it at the edges, because real wakes have a smooth, bell-shaped profile — not a sharp boundary. For a single turbine in isolation, this matters little when integrated over the swept area of a downstream rotor. But for deep arrays where wakes overlap and interact, the shape of the deficit profile becomes significant. [5]

> **Standard reference:** IEC 61400-1:2019, "Wind energy generation systems — Part 1: Design requirements" — Annex E recommends the use of engineering wake models for turbine siting and provides guidance on wake-induced turbulence calculations. The Jensen/Park model and its extensions are explicitly referenced as accepted approaches for design-basis wake analysis. [6]

---

## 10.3 The Gaussian Wake: A Better Shape

In 2014, Majid Bastankhah and Fernando Porté-Agel of the École Polytechnique Fédérale de Lausanne published a wake model that addressed Jensen's most significant shortcoming: the unrealistic top-hat velocity profile. Their model, derived from conservation of mass and momentum with the assumption that the velocity deficit in the far wake follows a **self-similar Gaussian distribution**, has become the most widely used analytical wake model in modern wind farm design tools. [7]

The physical basis is straightforward. Wind tunnel experiments and large-eddy simulations consistently show that beyond 4 to 5 rotor diameters downstream, the radial profile of the velocity deficit collapses to a Gaussian bell curve when normalised by the local wake width. This self-similarity is a hallmark of turbulent free shear flows — jets, wakes, and mixing layers all exhibit it, as Ludwig Prandtl and his students observed a century ago. Bastankhah and Porté-Agel exploited this universality to write the velocity at any point $(x, r)$ downstream of the rotor:

$$
\frac{\Delta U(x,r)}{U_\infty} = C(x) \exp\left(-\frac{r^2}{2\sigma^2(x)}\right)
$$

where:
- $\Delta U(x,r) = U_\infty - U(x,r)$ = velocity deficit at downstream distance $x$ and radial distance $r$ [m/s]
- $C(x)$ = centreline maximum deficit at distance $x$ [dimensionless]
- $\sigma(x)$ = standard deviation of the Gaussian profile (wake width parameter) [m]
- $r$ = radial distance from the wake centreline [m]

The wake width $\sigma(x)$ grows linearly with downstream distance in the far wake, parameterised by a single growth rate $k^*$:

$$
\frac{\sigma(x)}{D} = k^* \frac{x}{D} + \epsilon
$$

where $\epsilon = 0.2\sqrt{\beta}$ is the initial wake width (with $\beta = \frac{1}{2}\frac{1 + \sqrt{1-C_T}}{\sqrt{1-C_T}}$), and $k^*$ is the wake growth rate, which depends on the ambient turbulence intensity. For offshore conditions with 6% ambient turbulence, $k^* \approx 0.03$; for onshore conditions with 10–12% turbulence, $k^* \approx 0.04$ to 0.05. [8]

The centreline deficit follows from mass and momentum conservation:

$$
C(x) = 1 - \sqrt{1 - \frac{C_T}{8(\sigma(x)/D)^2}}
$$

The Gaussian model offers three advantages over the Jensen model. First, it predicts the correct shape of the velocity deficit — a smooth bell curve rather than a uniform disc — which matters when calculating the spatially averaged wind speed across a downstream rotor. Second, the single parameter $k^*$ has a clear physical connection to the ambient turbulence intensity, whereas Jensen's $k_w$ is more of a tuning knob. Third, the Gaussian profile naturally handles partial wake overlap: when a downstream turbine is not centred in the wake, the model correctly predicts a non-uniform velocity distribution across the rotor face, which affects both power output and asymmetric loading. [7]

<!-- IMAGE: fig-10-02 -->
> **Figure 10.2** — Jensen top-hat vs. Bastankhah–Porté-Agel Gaussian wake profiles
> **Type:** comparative line chart with two panels
> **Content:** Left panel: cross-sectional velocity deficit profiles at 5D downstream for the Jensen (step function) and Gaussian (bell curve) models, overlaid with wind-tunnel measurement data points (scatter). Right panel: centreline velocity recovery with downstream distance (x/D from 2 to 20) for both models, compared to LES data. Both panels use the same turbine parameters ($C_T = 0.8$, $D = 236$ m). The Gaussian model fits the experimental data more closely in both panels.
> **Caption:** The Jensen model (dashed) assumes a uniform velocity deficit across the wake, while the Gaussian model (solid) predicts a bell-shaped profile that matches wind tunnel and LES data more closely. At 5D downstream, the Jensen model overpredicts the centreline deficit by approximately 15% and underpredicts the deficit at the wake edges.
> **Alt text:** Two-panel chart comparing Jensen top-hat and Gaussian wake velocity deficit profiles at 5D downstream and centreline recovery curves from 2D to 20D, with measurement data points for validation.
> **Data source:** Author illustration based on Bastankhah and Porté-Agel (2014), Fig. 5 and Fig. 8.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Jensen model in blue dashed, Gaussian model in red solid, measurement data as black circles, LES data as grey squares.

---

## 10.4 Wake Superposition: When Wakes Meet Wakes

A single wake behind a single turbine is a solvable problem. A wind farm is not a single wake — it is dozens of wakes overlapping, merging, and interacting across kilometres of sea. The downstream turbines in a large array operate not in one wake but in the superposition of multiple wakes from several upstream turbines, each at a different distance, a different angle, and a different state of recovery. Predicting the combined velocity deficit at any point in the farm requires a **wake superposition method** — a rule for combining individual wake deficits into a total deficit.

The most influential superposition method was proposed in 1986 by Ivo Katić, Jens Højstrup, and Niels Otto Jensen — the same Jensen who had published the single-wake model three years earlier. Their paper, "A Simple Model for Cluster Efficiency," was presented at the European Wind Energy Association conference in Rome on 7–9 October 1986, and it introduced the principle that would become the default in virtually every commercial wind farm design tool. [9]

Katić, Højstrup, and Jensen argued that wake deficits should be superimposed as a **sum of squared velocity deficits** — not as a linear sum of velocity deficits. The physical reasoning is that kinetic energy (which scales as velocity squared) is the conserved quantity in the momentum balance. If turbine $j$ experiences wakes from $N$ upstream turbines, the combined velocity deficit is:

$$
\frac{\Delta U_j}{U_\infty} = \sqrt{\sum_{i=1}^{N} \left(\frac{\Delta U_{ij}}{U_\infty}\right)^2}
$$

where:
- $\Delta U_j$ = total velocity deficit at turbine $j$ [m/s]
- $\Delta U_{ij}$ = individual velocity deficit at turbine $j$ due to the wake of upstream turbine $i$ [m/s]
- $N$ = number of upstream turbines whose wakes overlap at the position of turbine $j$

The sum-of-squares method (often called the **RSS method**, for root sum of squares) is less conservative than a linear sum, which simply adds the deficits and tends to overpredict losses in deep arrays. A linear sum of two 10% deficits gives 20%; the RSS gives $\sqrt{0.10^2 + 0.10^2} = 14.1\%$. For a turbine in the eighth row of a large farm, where five or six upstream wakes may overlap, the difference between linear and RSS superposition can be 5 to 10 percentage points in predicted power — a discrepancy worth tens of millions of euros over the project lifetime. [10]

Neither method is perfectly physical. The RSS method conserves kinetic energy but not momentum; the linear method conserves neither. More recent approaches — including momentum-conserving methods by Zong and Porté-Agel (2020) and Bastankhah and colleagues — attempt to resolve this by solving the integral momentum equation directly. But for engineering design, the Katić RSS method remains the industry workhorse, embedded in WAsP, WindPRO, OpenWind, and NREL's FLORIS. [11]

### The Deep Array Effect

In large offshore wind farms — 80 turbines at Horns Rev, 111 at the London Array, 174 at the Borssele cluster — the cumulative effect of multiple overlapping wakes creates what researchers call the **deep array effect**. Turbines in the interior of the farm experience not just the wake of their nearest upstream neighbour but the accumulated deficit from an entire column of turbines stretching upwind. The velocity deficit does not grow indefinitely — it reaches an equilibrium where the rate of wake recovery from turbulent entrainment balances the rate of momentum extraction by successive rotors — but this equilibrium velocity can be 15 to 25% below the free-stream wind speed.

The deep array effect is why overall farm wake losses for large offshore arrays are typically 10 to 15%, even with spacing of 7 to 10 rotor diameters. For comparison, small onshore farms with 10 to 20 turbines might lose only 3 to 5%. The economic stakes scale accordingly: a 500 MW offshore farm producing 2,000 GWh per year at 60 EUR/MWh loses 12 to 18 million EUR per year to wakes — 360 to 540 million EUR over a 30-year lifetime. [12]

<!-- IMAGE: fig-10-03 -->
> **Figure 10.3** — Wake superposition in a regular turbine array
> **Type:** plan-view colour map
> **Content:** Top-down view of a 5 × 5 turbine array with 7D spacing, wind from the left. Show a colour map of normalised wind speed ($U/U_\infty$) across the array, with dark blue/purple in the deep-wake regions behind the last row and light blue/green in the free-stream regions. Overlay the individual wake expansion cones (dashed lines) from each turbine. Label the velocity at three positions: free-stream (1.0), behind row 1 (0.90), behind row 3 (0.83), and behind row 5 (0.78). Include a colour bar.
> **Caption:** Wake superposition in a 5 × 5 turbine array with 7D spacing. Individual wakes (dashed cones) overlap progressively, creating a deep array effect where interior turbines operate at 78–83% of the free-stream velocity. The cumulative deficit reaches equilibrium around row 4–5, beyond which additional rows experience similar conditions.
> **Alt text:** Top-down colour map of wind speed across a 5-by-5 turbine array showing progressive velocity deficit from front row to back row, with individual wake cones overlaid.
> **Data source:** Author illustration using Jensen wake model with $k_w = 0.04$ and $C_T = 0.8$.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Velocity colour bar from 0.6 (dark purple) to 1.0 (light green/yellow). Turbine icons as black dots. Wake cone boundaries as white dashed lines.

---

## 10.5 Turbulence in Wakes

A wake is not merely slower wind — it is also rougher wind. The shear layer at the boundary of the wake, where fast ambient air meets slow wake air, generates turbulent eddies that increase the turbulence intensity experienced by downstream turbines. This **wake-added turbulence** is, in some respects, more consequential than the velocity deficit itself. A velocity deficit reduces energy production; added turbulence reduces the structural lifetime of the turbine.

The standard model for wake-added turbulence in wind farm design was developed by Sten Frandsen of Risø National Laboratory, published as a Risø report in 2007 and subsequently adopted into IEC 61400-1 Edition 3 as the basis for calculating **effective turbulence intensity** at each turbine position. [13]

Frandsen's approach combines the ambient turbulence $I_0$ and the wake-added turbulence $I_+$ using a root-sum-of-squares rule, weighted by a material fatigue exponent $m$ (typically $m = 10$ for the Wöhler S-N curve of fiberglass composite):

$$
I_{\text{eff}} = \left[\frac{1}{N_s} \sum_{n=1}^{N_s} \left(I_0^m + I_{+,n}^m\right)\right]^{1/m}
$$

where:
- $I_{\text{eff}}$ = effective turbulence intensity at the turbine position [dimensionless]
- $I_0$ = ambient turbulence intensity [dimensionless]
- $I_{+,n}$ = wake-added turbulence from the $n$-th sector [dimensionless]
- $N_s$ = number of wind direction sectors (typically 12)
- $m$ = Wöhler exponent for the material (typically 10 for GRP blades)

The wake-added turbulence for a turbine located a distance $s$ (in rotor diameters) behind an upstream turbine with thrust coefficient $C_T$ is approximately:

$$
I_+ \approx \frac{1}{1.5 + 0.8 \, s / \sqrt{C_T}}
$$

At 7D spacing with $C_T = 0.8$, this gives $I_+ \approx 0.08$ (8%), which adds to the ambient offshore turbulence of 5–6% to produce an effective turbulence of 10–12% at the downstream position. At 5D spacing — the minimum permitted under most design guidelines — $I_+$ rises to approximately 12%, and the effective turbulence exceeds 14%. [14]

The consequences are structural. IEC 61400-1 defines three turbulence classes — A (high, $I_{\text{ref}} = 0.16$), B (medium, $I_{\text{ref}} = 0.14$), and C (low, $I_{\text{ref}} = 0.12$). A turbine certified for Class C may be unsuitable for an interior position in a large offshore farm where the effective turbulence exceeds the Class C design envelope. Wind farm developers must check that the effective turbulence at every turbine position falls within the selected turbine's design class — a calculation that directly constrains the minimum spacing and the array layout. A turbine that is structurally adequate in the front row may not be adequate in the fifth row, even though the same wind approaches from the same direction.

> **Standard reference:** IEC 61400-1:2019, "Wind energy generation systems — Part 1: Design requirements" — Clause 6.5.1.1 and Annex E define the Frandsen effective turbulence model and its application to turbine siting within wind farms. The standard requires that the effective turbulence intensity at each turbine position be calculated sector-by-sector and compared against the turbine's design class to verify structural adequacy over the design lifetime. [6]

---

## 10.6 Validation: Horns Rev and Lillgrund

Wake models are only as trustworthy as the data against which they have been validated. Two offshore wind farms have provided more wake data to the research community than any others: Horns Rev I in the Danish North Sea and Lillgrund in the Øresund strait between Sweden and Denmark. Between them, they bracket the range of spacing that the industry uses — and they reveal both the power and the limitations of engineering wake models.

### Horns Rev I

Horns Rev I was commissioned on 11 December 2002: eighty Vestas V80 turbines, each rated at 2 MW, arranged in a regular 8 × 10 grid with 7D spacing in both the along-wind and cross-wind directions. At 160 MW, it was four times larger than the previous record holder — the 40 MW Middelgrunden farm near Copenhagen — and it was the first large-scale offshore wind farm in the world. Its location, 14 kilometres off the west coast of Jutland, exposed it to the full force of the North Sea, and its regular grid layout made it an ideal laboratory for wake research. [15]

The landmark measurements came from Barthelmie, Frandsen, and colleagues in a series of papers published between 2006 and 2010. When the wind blew directly along a row of turbines (within ±5° of the row axis), the power output of successive downstream turbines dropped sharply: the second turbine produced 80–85% of the front turbine's power, the fourth produced 70–75%, and the eighth — after passing through seven wakes — produced only 60–65%. The total farm-level wake loss, averaged over all wind directions and speeds, was approximately 10–12%. [16]

The row-aligned case at Horns Rev became a benchmark that every wake model must reproduce. The Jensen model, with $k_w = 0.04$, captures the general trend of decreasing power with row depth but tends to overpredict the recovery in the middle rows. The Gaussian model, tuned with $k^* = 0.03$, reproduces the measured deficit profile more accurately, particularly the slow recovery between rows 3 and 6 where the deep array effect dominates. Neither model fully captures the slight recovery observed at rows 7 and 8 in some datasets, which is attributed to increased turbulent mixing from the accumulated wake turbulence — the wake, paradoxically, generates the turbulence that helps it recover. [17]

One image from Horns Rev has become the most reproduced photograph in wind energy. On 12 February 2008, Christian Steiness of the Danish energy company Vattenfall photographed the farm from a helicopter during conditions of high humidity and light wind. The cold air flowing over the warmer sea produced a thin fog layer at hub height, and as the air decelerated in each turbine's wake, the slight pressure drop caused water vapour to condense — making every wake visible as a white plume stretching downwind for several rotor diameters. The photograph shows eighty wakes in parallel, fanning out across the North Sea, each one a visible reminder that a wind turbine does not simply harvest the wind — it changes the wind for every turbine behind it. [18]

### Lillgrund

If Horns Rev represents the industry standard, Lillgrund represents the cautionary extreme. The Lillgrund wind farm was built in 2007 in the Øresund strait, approximately 10 kilometres south of the Øresund Bridge connecting Malmö and Copenhagen. It comprises 48 Siemens SWT-2.3-93 turbines, each rated at 2.3 MW, for a total capacity of 110 MW. The distinguishing feature is the spacing: 3.3 rotor diameters in the dominant wind direction and 4.3D across — roughly half the industry-standard 7D. The tight layout was driven by seabed constraints (a gap in the middle of the farm avoids a shallow reef) and by the economics of the time. [19]

The consequences were exactly what wake theory predicts. Comprehensive analyses by Dahlberg and others showed that Lillgrund's farm-level wake losses were approximately 23–28%, compared to 10–12% at Horns Rev. The back-row turbines produced barely 70% of the front-row turbines' output. The tight spacing meant that wakes had not recovered before reaching the next downstream rotor, and the superposition of multiple immature wakes created a deep velocity deficit across the entire interior of the farm. [20]

Lillgrund became the definitive argument for adequate spacing. The capital cost saved by closer spacing (shorter inter-array cables, smaller seabed lease area) was overwhelmed by the energy lost to wakes over the project lifetime. The lesson was quantitative: halving the spacing from 7D to 3.3D roughly doubled the wake losses, from ~11% to ~25%. Or, expressed as the cubic amplification that Chapter 8 introduced: a 25% velocity deficit translates to a $1 - (0.75)^3 = 58\%$ deficit in available power density. The front-row turbines at Lillgrund produced at capacity factors comparable to Horns Rev; the interior turbines operated in wind that had lost more than half its energy content.

<!-- IMAGE: fig-10-04 -->
> **Figure 10.4** — Row-by-row normalised power at Horns Rev I and Lillgrund
> **Type:** comparative bar chart
> **Content:** Bar chart with row number (1 through 8) on the horizontal axis and normalised power output (fraction of front-row power) on the vertical axis. Two series: Horns Rev I (7D spacing, blue bars) and Lillgrund (3.3D spacing, red bars). Front-row normalised to 1.0. Horns Rev drops from 1.0 to ~0.65 at row 8. Lillgrund drops from 1.0 to ~0.58 at row 5 (fewer rows due to layout). Include a dashed horizontal line at 0.80 labelled "typical design assumption." Error bars showing ±1 standard deviation from the measurement datasets.
> **Caption:** Normalised power output by row depth for aligned wind directions at Horns Rev I (7D spacing) and Lillgrund (3.3D spacing). The tighter spacing at Lillgrund produces steeper power decay: the fifth-row turbine at Lillgrund produces less than the eighth-row turbine at Horns Rev. Error bars reflect variability across wind speed bins and yaw conditions.
> **Alt text:** Bar chart comparing row-by-row normalised power output at Horns Rev (7D spacing) and Lillgrund (3.3D spacing), showing steeper power loss at Lillgrund due to tighter turbine spacing.
> **Data source:** Author illustration based on Barthelmie et al. (2010) for Horns Rev and Dahlberg (2009) for Lillgrund.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Horns Rev bars in blue, Lillgrund bars in red/orange, design assumption line in dark grey dashed.

### Wake Steering: Turning Wakes into a Design Variable

The traditional approach to wake management is passive: space the turbines far enough apart and accept the residual losses. But beginning in the 2010s, researchers at NREL and elsewhere began to explore an active approach called **wake steering**. The concept is counterintuitive: deliberately yaw an upstream turbine away from the wind — accepting a small power loss at that turbine — so that its wake is deflected away from the downstream turbine, which then operates in cleaner air and produces more power. If the downstream gain exceeds the upstream loss, the farm as a whole benefits.

The physics of wake deflection follows from the aerodynamics of a yawed rotor. When a turbine operates with a yaw misalignment angle $\gamma$, the thrust vector tilts away from the wind direction, and the wake is deflected laterally by an amount that increases with downstream distance. The resulting wake path curves away from the centreline, exposing the downstream rotor to higher wind speeds.

In 2019, Paul Fleming and colleagues at NREL published the first results from a field campaign of wake steering at a commercial wind farm. For a closely spaced pair of turbines, they measured a 14% increase in power at the downstream turbine when the upstream turbine was yawed by 20–25°. The combined power of the pair increased by approximately 4% — the upstream turbine lost power from the misalignment, but the downstream turbine gained more than what was lost. In stable atmospheric conditions, where wakes are more coherent and deflect more predictably, the gains were even higher. [21]

Scaled to an entire farm, the gains are more modest — typically 1 to 3% of annual energy production — but for a 500 MW offshore farm, even 1% represents 20 GWh per year, or roughly 1.2 million EUR in additional revenue annually. NREL's open-source FLORIS model (FLOw Redirection and Induction in Steady State) has become the standard tool for optimising wake steering strategies, combining the Gaussian wake model with yaw-dependent deflection to predict the optimal yaw angles for every wind direction and speed. [22]

<!-- IMAGE: fig-10-05 -->
> **Figure 10.5** — Wake steering: yawed turbine deflects wake away from downstream rotor
> **Type:** plan-view schematic, two panels
> **Content:** Left panel: conventional operation — upstream turbine aligned with wind, wake (shown as Gaussian ellipse) directly impinging on downstream turbine. Right panel: wake steering — upstream turbine yawed by angle $\gamma$, wake deflected laterally, partially or fully clearing the downstream rotor. Label the yaw angle $\gamma$, the wake deflection distance $\delta_y(x)$, the upstream turbine's reduced power ($P_1 \cos^{p}\gamma$), and the downstream turbine's increased power. Show net gain annotation.
> **Caption:** Wake steering deflects the upstream turbine's wake away from the downstream rotor by introducing an intentional yaw misalignment $\gamma$. The upstream turbine produces less power (proportional to $\cos^p \gamma$ where $p \approx 1.5$–2), but the downstream turbine gains more than the upstream loss, yielding a net increase in combined power output.
> **Alt text:** Two-panel plan-view diagram comparing conventional turbine alignment (wake hits downstream turbine) with wake steering (yawed upstream turbine deflects wake to the side).
> **Data source:** Author illustration based on Fleming et al. (2019) and NREL FLORIS documentation.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Wake regions in semi-transparent orange, turbines as black icons, yaw angle arc in green, deflection arrow in blue.

---

## 10.7 Worked Example: Wake Losses in a 500 MW Offshore Farm

Consider a row of five 15 MW turbines spaced 7D apart, with the wind aligned along the row. The rotor diameter is $D = 236$ m, the free-stream wind speed is $U_\infty = 10$ m/s, and the thrust coefficient is $C_T = 0.82$. We use the Jensen model with $k_w = 0.04$ (offshore).

**Step 1: Wake velocity behind each turbine.**

The Jensen model gives the wake velocity at distance $x = 7D = 1{,}652$ m behind a single turbine:

$$
U_w = 10 \times \left[1 - \frac{1 - \sqrt{1 - 0.82}}{(1 + 0.04 \times 7 \times 2)^2}\right]
$$

Computing the terms:
- $\sqrt{1 - C_T} = \sqrt{0.18} = 0.424$
- $1 - 0.424 = 0.576$
- $(1 + 0.04 \times 14)^2 = (1.56)^2 = 2.434$
- Deficit: $0.576 / 2.434 = 0.237$
- $U_w = 10 \times (1 - 0.237) = 7.63$ m/s

The single-wake deficit at 7D is 23.7%.

**Step 2: Power at each turbine position.**

Using $P \propto U^3$ normalised to the front turbine, and applying Katić RSS superposition for multiple wakes:

| Row | Effective $U$ [m/s] | $U/U_\infty$ | Normalised power $(U/U_\infty)^3$ |
|-----|---------------------|---------------|----------------------------------|
| 1 | 10.00 | 1.000 | 1.000 |
| 2 | 7.63 | 0.763 | 0.445 |
| 3 | 6.79 | 0.679 | 0.313 |
| 4 | 6.37 | 0.637 | 0.258 |
| 5 | 6.13 | 0.613 | 0.230 |

Wait — these numbers look severe, and they are. The Jensen model with $k_w = 0.04$ is conservative for a perfectly aligned row. In practice, wind direction variability (the wind is rarely aligned within ±2° for long periods) and the lateral Gaussian spreading of real wakes mean that the actual row-averaged power is higher than this worst-case. Barthelmie et al. measured rows at Horns Rev producing 60–65% at position 8, not the 23% the single-direction Jensen model predicts at position 5. The model gives the instantaneous aligned case; reality is an average over fluctuating directions.

**Step 3: A more realistic farm-level estimate.**

For engineering purposes, the farm-level wake loss is typically expressed as a percentage of gross AEP:

$$
\eta_{\text{wake}} = 1 - \frac{\text{Net AEP}}{\text{Gross AEP}}
$$

From Chapter 9, the gross AEP for 34 turbines at this site is 2,499 GWh/yr. Industry experience and validated wake models for a farm with 7D spacing, 34 turbines in an irregular grid (not a regular row), and realistic wind direction distributions give wake losses of **8–12%**, depending on the dominant wind direction sector and the specific layout.

Taking a central estimate of 10%:

| Quantity | Value |
|----------|-------|
| Gross AEP (34 turbines) | 2,499 GWh/yr |
| Wake loss fraction | 10% |
| Wake loss energy | 250 GWh/yr |
| Net AEP | 2,249 GWh/yr |
| Revenue loss at 60 EUR/MWh | 15.0 million EUR/yr |
| 30-year revenue loss | 450 million EUR |
| Per-turbine net AEP | 66.1 GWh/yr (CF = 50.3%) |

The capacity factor drops from 55.9% (gross, from Chapter 9) to 50.3% (net of wakes) — still an excellent number for offshore wind, but the 5.6 percentage point difference represents half a billion euros over the project lifetime.

**Step 4: What if we could reduce wake losses by 2 percentage points through layout optimisation?**

Moving from 10% to 8% wake loss:
- Recovered energy: 50 GWh/yr
- Recovered revenue: 3.0 million EUR/yr
- 30-year value: 90 million EUR

This 90 million EUR is why layout engineers — the subject of Chapter 11 — are among the most valuable specialists in the industry.

---

## Key Takeaways

- **A wind turbine wake is a region of reduced velocity and increased turbulence downstream of the rotor.** The velocity deficit depends on the thrust coefficient and recovers with distance as ambient turbulence entrains fast air into the wake. At typical offshore spacing (7D), a single wake produces a 15–25% velocity deficit; the cubic power law amplifies this to a 40–60% power deficit in the worst case.

- **The Jensen (1983) and Gaussian (Bastankhah & Porté-Agel, 2014) models are the two foundational analytical wake models.** Jensen assumes a top-hat profile and linear expansion — fast to compute, widely used, but inaccurate at wake edges. The Gaussian model uses a self-similar bell-curve profile that matches measurements and LES data more closely, with the wake growth rate tied to ambient turbulence.

- **Wake superposition in large arrays creates the deep array effect.** The Katić (1986) root-sum-of-squares method combines individual wakes by summing squared deficits. Interior turbines in large farms experience cumulative losses of 15–25% in velocity, and overall farm wake losses are typically 10–15% of gross AEP for offshore installations.

- **Wake-added turbulence increases fatigue loads on downstream turbines.** The Frandsen model, adopted in IEC 61400-1, calculates effective turbulence that must remain within the turbine's design class. This structural constraint — not just energy loss — is what sets the minimum allowable spacing in a wind farm.

- **Wake steering is an active control strategy that deflects wakes by intentionally yawing upstream turbines.** Field tests have demonstrated 1–3% AEP gains at the farm level. For a 500 MW farm, even 1% represents over 1 million EUR per year in additional revenue.

## For Further Reading

- **Stevens, R.J.A.M. and Meneveau, C. (2017).** "Flow Structure and Turbulence in Wind Farms." *Annual Review of Fluid Mechanics*, 49, 311–339. DOI: 10.1146/annurev-fluid-010816-060206. A comprehensive review of wind farm fluid mechanics from the single-wake scale to the atmospheric boundary layer interaction, covering analytical models, LES, and field data. The best single reference for understanding the physics behind engineering wake models.

- **Porté-Agel, F., Bastankhah, M., and Shamsoddin, S. (2020).** "Wind-Turbine and Wind-Farm Flows: A Review." *Boundary-Layer Meteorology*, 174, 1–59. DOI: 10.1007/s10546-019-00473-0. A detailed review by the developers of the Gaussian wake model, covering single-wake physics, superposition methods, atmospheric stability effects, and validation against wind-tunnel and field data.

- **Barthelmie, R.J., Hansen, K.S., Frandsen, S.T., et al. (2009).** "Modelling and Measuring Flow and Wind Turbine Wakes in Large Wind Farms Offshore." *Wind Energy*, 12(5), 431–444. DOI: 10.1002/we.348. The definitive Horns Rev measurement paper — row-by-row power data, model comparisons, and the first quantification of the deep array effect that validated (and exposed the limits of) the Jensen model at industrial scale.

---

*Anders closed his tablet and leaned on the railing. The morning sun had climbed higher, burning off the haze, and the turbines now stood in sharp relief against a blue sky — their wakes invisible again, the stolen momentum hidden in the physics of moving air.*

*"So the spacing between turbines is not just a construction convenience," Kaan said. "It is a financial decision."*

*"It is a compromise," Anders said. "Wide spacing means less wake loss but longer cables, a larger seabed lease, and more installation time. Tight spacing means shorter cables but more wakes, higher turbulence, and heavier fatigue loading on every downstream machine." He paused. "Somewhere in between is an optimum. Finding it is what the layout engineer does."*

*"And the layout is fixed for thirty years," Kaan said.*

*"Thirty years," Anders confirmed. "You pour a monopile foundation into the seabed, and that turbine stays where you put it for three decades. You cannot move it if the wind rose changes, or if the wake model turns out to be wrong, or if a new turbine technology makes a different spacing optimal. The layout is a bet — the most expensive bet in the entire project — and you get one chance to make it."*

*He picked up his empty coffee mug and turned toward the door. "Tomorrow I will show you how that bet is placed. There is a woman in the engineering office — a layout optimiser. She will tell you that finding the best positions for thirty-four turbines on a patch of Baltic seabed is like solving a chess problem where the pieces interact through physics, the board has exclusion zones, and every move costs or earns millions of euros." He glanced back. "She is not exaggerating."*

*Kaan stayed on the observation deck for another few minutes, watching the turbines. He now saw what he had not seen on Day 1: the invisible cones of slower air stretching behind each rotor, the overlapping zones where the second row and third row turbines fought for momentum that the front row had already taken. The thirty-four turbines were not independent machines — they were a coupled system, each one's performance shaped by the decisions made about every other one's position. The layout was not geometry. The layout was physics.*

---

## Notes

[1] Actuator disc theory and wake velocity: Burton, T., Jenkins, N., Sharpe, D., and Bossanyi, E. (2021). *Wind Energy Handbook*. 3rd edition. Wiley. Chapter 3, "Aerodynamics of Horizontal Axis Wind Turbines." The far-wake velocity $U_\infty(1-2a)$ follows directly from the one-dimensional momentum theory of Rankine (1865) and Froude (1889), applied to wind turbines by Betz (1920).

[2] Near-wake and far-wake structure: Vermeer, L.J., Sørensen, J.N., and Crespo, A. (2003). "Wind Turbine Wake Aerodynamics." *Progress in Aerospace Sciences*, 39(6-7), 467–510. DOI: 10.1016/S0376-0421(03)00078-2. Comprehensive review distinguishing the near-wake region (tip vortices, root vortices, nacelle recirculation) from the far-wake region (self-similar velocity profiles, linear expansion).

[3] Jensen, N.O. (1983). "A Note on Wind Generator Interaction." Risø-M-2411. Risø National Laboratory, Roskilde, Denmark. 11 pages. The founding document of engineering wake modelling. Jensen's linear-expansion top-hat model was incorporated into the WAsP and Park software developed at Risø and has been the default engineering wake model for four decades.

[4] Wake decay constant values: Peña, A., Réthoré, P.-E., and van der Laan, M.P. (2016). "On the Application of the Jensen Wake Model Using a Turbulence-Dependent Wake Decay Coefficient: The Sexbierum Case." *Wind Energy*, 19(5), 763–776. DOI: 10.1002/we.1863. Demonstrates that the wake decay constant should be related to the ambient turbulence intensity rather than treated as a fixed value. Offshore values of $k_w = 0.04$–0.05 correspond to ambient TI of 5–8%.

[5] Jensen model limitations for deep arrays: Gaumond, M., Réthoré, P.-E., Ott, S., Peña, A., Bechmann, A., and Hansen, K.S. (2014). "Evaluation of the Wind Direction Uncertainty and Its Impact on Wake Modeling at the Horns Rev Offshore Wind Farm." *Wind Energy*, 17(8), 1169–1178. DOI: 10.1002/we.1625. Demonstrates that wind direction uncertainty of ±3–5° significantly affects the comparison between model predictions and measurements, particularly for the Jensen model's sharp-edged top-hat profile.

[6] International Electrotechnical Commission. IEC 61400-1:2019, "Wind energy generation systems — Part 1: Design requirements." Edition 4.0. Annex E provides guidance on wake-induced turbulence and turbine siting within wind farms, including the Frandsen effective turbulence model and references to the Jensen/Park model family. Clause 6.5.1.1 defines the turbulence class requirements.

[7] Bastankhah, M. and Porté-Agel, F. (2014). "A New Analytical Model for Wind-Turbine Wakes." *Renewable Energy*, 70, 116–123. DOI: 10.1016/j.renene.2014.01.002. Derives the Gaussian wake model from conservation of mass and momentum assuming self-similar Gaussian velocity deficit profiles. Validated against wind-tunnel measurements and LES data.

[8] Niayifar, A. and Porté-Agel, F. (2016). "Analytical Modeling of Wind Farms: A New Approach for Power Prediction." *Energies*, 9(9), 741. DOI: 10.3390/en9090741. Extends the Bastankhah–Porté-Agel model by relating the wake growth rate $k^*$ directly to the local turbulence intensity, enabling wake-to-wake interaction where the added turbulence from one wake accelerates the recovery of the next.

[9] Katić, I., Højstrup, J., and Jensen, N.O. (1986). "A Simple Model for Cluster Efficiency." *Proceedings of the European Wind Energy Association Conference and Exhibition (EWEC '86)*, 7–9 October 1986, Rome, Italy, pp. 407–410. Introduces the sum-of-squared-deficits superposition principle that became the standard method in WAsP and virtually all commercial wind farm design tools.

[10] Wake superposition comparison: Machefaux, E., Larsen, G.C., Koblitz, T., Troldborg, N., Kelly, M.C., Chougule, A., Hansen, K.S., and Rodrigo, J.S. (2016). "An Experimental and Numerical Study of the Atmospheric Stability Impact on Wind Turbine Wakes." *Wind Energy*, 19(10), 1785–1805. DOI: 10.1002/we.1950. Compares linear sum, RSS, and other superposition methods against LES and field data under different stability conditions.

[11] Zong, H. and Porté-Agel, F. (2020). "A Momentum-Conserving Wake Superposition Method for Wind-Farm Power Prediction." *Journal of Fluid Mechanics*, 889, A8. DOI: 10.1017/jfm.2020.77. Derives a superposition method that conserves momentum rather than kinetic energy, addressing a theoretical limitation of the Katić RSS method.

[12] Deep array wake losses: Nygaard, N.G. (2014). "Wakes in Very Large Wind Farms and the Effect of Neighbouring Wind Farms." *Journal of Physics: Conference Series*, 524, 012162. DOI: 10.1088/1742-6596/524/1/012162. Documents the deep array effect and inter-farm wake effects for the Horns Rev cluster, showing that wakes from one farm can measurably reduce the output of a neighbouring farm located 20 km away.

[13] Frandsen, S.T. (2007). "Turbulence and Turbulence-Generated Structural Loading in Wind Turbine Clusters." Risø-R-1188(EN). Risø National Laboratory, Roskilde, Denmark. The foundational reference for wake-added turbulence modelling, providing the effective turbulence calculation that was adopted into IEC 61400-1 Edition 3 and retained in Edition 4 (2019).

[14] Frandsen, S.T. and Thøgersen, M.L. (1999). "Integrated Fatigue Loading for Wind Turbines in Wind Farms by Combining Ambient Turbulence and Wakes." *Wind Engineering*, 23(6), 327–339. Develops the sector-averaged effective turbulence methodology and the S-N curve weighting with Wöhler exponent $m$, showing that the fatigue-weighted effective turbulence is dominated by the sectors with the highest combined ambient and wake turbulence.

[15] Horns Rev I: The wind farm was developed by Elsam (later DONG Energy, now Ørsted) and commissioned in December 2002. Eighty Vestas V80-2.0 MW turbines on monopile foundations at water depths of 6–14 m, hub height 70 m, 7D spacing (560 m). Vattenfall acquired 60% ownership in 2005 and now operates the farm jointly with Ørsted (40%). See: Sørensen, P., Hansen, A.D., Janosi, L., Bech, J., and Bak-Jensen, B. (2001). "Simulation of Interaction between Wind Farm and Power System." *Risø-R-1281(EN)*, Risø National Laboratory.

[16] Barthelmie, R.J., Hansen, K.S., Frandsen, S.T., Rathmann, O., Schepers, J.G., Schlez, W., Phillips, J., Rados, K., Zervos, A., Politis, E.S., and Chaviaropoulos, P.K. (2009). "Modelling and Measuring Flow and Wind Turbine Wakes in Large Wind Farms Offshore." *Wind Energy*, 12(5), 431–444. DOI: 10.1002/we.348. Documents row-by-row power deficits at Horns Rev, showing power losses of 30–40% at row 8 in aligned conditions and ~10–12% farm-averaged losses over all directions.

[17] Barthelmie, R.J., Pryor, S.C., Frandsen, S.T., Hansen, K.S., Schepers, J.G., Rados, K., Schlez, W., Neubert, A., Jensen, L.E., and Neckelmann, S. (2010). "Quantifying the Impact of Wind Turbine Wakes on Power Output at Offshore Wind Farms." *Journal of Atmospheric and Oceanic Technology*, 27(8), 1302–1317. DOI: 10.1175/2010JTECHA1398.1. The definitive quantification of wake losses at Horns Rev and Nysted, comparing multiple wake models against SCADA data.

[18] The Horns Rev wake photograph: Hasager, C.B., Rasmussen, L., Peña, A., Jensen, L.E., and Réthoré, P.-E. (2013). "Wind Farm Wake: The Horns Rev Photo Case." *Energies*, 6(2), 696–716. DOI: 10.3390/en6020696. Analyses the meteorological conditions (sea surface temperature warmer than air temperature, high relative humidity, wind speed ~8 m/s from the west) that produced the visible condensation plumes in the widely reproduced photograph by Christian Steiness of Vattenfall, taken on 12 February 2008.

[19] Lillgrund: The wind farm was developed by Vattenfall and commissioned in 2007 in the Øresund strait, approximately 10 km south of the Øresund Bridge. 48 × Siemens SWT-2.3-93 turbines on gravity-based foundations at 4–8 m water depth. The irregular layout with a gap in the centre avoids a shallow reef (Lillgrund shoal). Spacing of 3.3D (308 m) in the dominant wind direction and 4.3D (400 m) across. Total capacity 110 MW. See: Nilsson, K. and Ivanell, S. (2010). "Lillgrund — an Offshore Wind Farm." *Proceedings of the UpWind Workshop*, Risø DTU.

[20] Dahlberg, J.-Å. (2009). "Assessment of the Lillgrund Wind Farm: Power Performance." Vattenfall Vindkraft AB report. Documents the 23–28% farm-level wake losses at Lillgrund due to the tight 3.3D spacing. Also: Nilsson, K., Ivanell, S., Hansen, K.S., Mikkelsen, R., Sørensen, J.N., Breton, S.-P., and Henningson, D. (2015). "Large-Eddy Simulations of the Lillgrund Wind Farm." *Wind Energy*, 18(3), 449–467. DOI: 10.1002/we.1707. LES validation showing that wake models systematically underpredict losses at Lillgrund's tight spacing.

[21] Fleming, P., King, J., Dykes, K., Simley, E., Roadman, J., Scholbrock, A., Murphy, P., Lundquist, J.K., Moriarty, P., Fleming, K., van Dam, J., Bay, C., Mudafort, R., Lopez, H., Skopek, J., Scott, M., Ryan, B., Guber, C., and Lanber, D. (2019). "Initial Results from a Field Campaign of Wake Steering Applied at a Commercial Wind Farm — Part 1." *Wind Energy Science*, 4(2), 273–285. DOI: 10.5194/wes-4-273-2019. First published field results from wake steering at a commercial wind plant, showing 14% power increase at the downstream turbine and 4% combined increase for the turbine pair.

[22] NREL FLORIS: National Renewable Energy Laboratory. "FLORIS: FLOw Redirection and Induction in Steady State." Open-source software available at github.com/NREL/floris. Combines Gaussian wake models with yaw-dependent wake deflection for wind farm control optimisation. Also: Fleming, P., Annoni, J., Shah, J.J., Wang, L., Anber, S., Whitfield, R., Scholbrock, A., Moriarty, P., Jimenez, A., and Medina, O. (2017). "Field Test of Wake Steering at an Offshore Wind Farm." *Wind Energy Science*, 2(1), 229–239. DOI: 10.5194/wes-2-229-2017. Reports 29% downstream power gain in a 2-turbine offshore test.

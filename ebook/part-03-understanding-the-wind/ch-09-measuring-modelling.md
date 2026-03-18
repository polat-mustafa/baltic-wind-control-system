# Chapter 9: Measuring and Modelling the Wind

*The SOV's analysis room was a windowless compartment on the main deck — two monitors, a laptop dock, a whiteboard covered in equations that someone had written in blue marker and no one had erased. Maja was already seated when Kaan arrived at eight o'clock on Day 4, her laptop open to a screen filled with jagged time series: wind speed traces from the met mast, three years of data compressed into a single scrolling display.*

*"Yesterday I showed you where the wind comes from," she said, without looking up. "Today I will show you what we do with it."*

*She gestured at the chair beside her. On the right monitor, a spreadsheet displayed 157,680 rows — the entire measurement record from the met mast, ten-minute averages, six per hour, twenty-four hours a day, for three years. On the left monitor, a histogram had taken shape: wind speed on the horizontal axis, frequency on the vertical, a smooth curve overlaid on the bars like a bell pushed sideways.*

*"This curve," Maja said, tapping the screen, "is the Weibull distribution. It tells you not just the average wind speed but how the wind speed is distributed across every hour of the year. Without it, you cannot compute how much energy the turbines will produce. Without the energy estimate, the project does not get financed. Without the financing, those turbines" — she pointed toward the wall, as if they were visible through the steel — "do not exist."*

*Kaan studied the histogram. The bars were not symmetric. The peak was to the left of centre, somewhere around 8 or 9 metres per second, with a long tail stretching to the right toward 25 m/s and beyond. The smooth Weibull curve traced the shape almost exactly, capturing both the peak and the tail with only two parameters.*

*"Two numbers describe the entire wind climate of a site?" he asked.*

*Maja allowed herself a small smile — the first Kaan had seen from her. "Two numbers, a compass, and a very expensive measurement campaign. That is the beginning." She pulled up a wind rose on the second monitor — the compass divided into twelve sectors, each with a coloured bar extending outward from the centre. The dominant bar pointed to the southwest. "But the beginning is the part that determines everything else."*

*She opened a new tab — a satellite map of Europe overlaid with a coloured grid, each cell shaded by wind speed. "Now let me show you where the data comes from — and why I do not trust any single source."*

---

## 9.1 The Cup Anemometer and the Art of Measuring Wind

The instrument that has measured more wind than any other in history was invented by an astronomer who was not thinking about wind energy at all. In 1846, John Thomas Romney Robinson — physicist, clergyman, and long-serving director of the Armagh Astronomical Observatory in Northern Ireland — presented his four-cup anemometer to the Royal Irish Academy. The design was elegant: four hemispherical cups mounted on horizontal arms at right angles, attached to a vertical shaft. Wind from any horizontal direction pushes harder on the concave face of each cup than on the convex face, creating a net torque that spins the assembly at a rate proportional to the wind speed. Count the rotations over a known time interval, and you have the mean wind speed. [1]

Robinson made one confident assertion about his invention: the cups rotated at exactly one-third of the wind speed, regardless of cup size or arm length. This claim was apparently confirmed by several early experiments and was widely believed for decades. It was wrong. The ratio of cup speed to wind speed — the **anemometer factor** — depends on the dimensions of the cups and arms, and can range from about 2 to slightly above 3. Robinson's error was not corrected until later in the nineteenth century, a cautionary reminder that a plausible physical argument is not a substitute for careful calibration. [2]

The modern cup anemometer owes its form to a Canadian meteorologist. In 1926, John Patterson of the Meteorological Service of Canada demonstrated that a three-cup design responds faster and more linearly than Robinson's four-cup original, because three cups present a more symmetrical drag profile to the wind. In 1935, Brevoort and Joiner of the United States further refined the cup shape, achieving a nearly linear response with errors below 3% up to 97 km/h. The three-cup configuration has been the standard ever since. [3]

Cup anemometers have one fundamental flaw: **overspeeding**. The aerodynamic drag on a hemispherical cup is higher when the concave face catches the wind (a gust) than when the convex face opposes it (a lull). As a result, a cup anemometer accelerates faster in a gust than it decelerates when the gust passes. Over thousands of ten-minute averages, this asymmetry produces a systematic positive bias in the measured mean wind speed — typically 0.1 to 0.5 m/s at turbulence intensities of 5 to 15%. For a wind farm producing 2,200 GWh per year, a persistent 0.3 m/s overestimate at hub height would inflate the projected annual energy production by roughly 4 to 6%, an error worth tens of millions of euros over the project lifetime. [4]

To control such errors, the International Electrotechnical Commission specifies rigorous calibration requirements. IEC 61400-12-1 requires that cup anemometers used for power performance testing be classified to a performance class of 1.7A or better, calibrated before and after the measurement campaign in a certified wind tunnel, with the difference between calibration and recalibration falling within ±0.1 m/s in the range 6 to 12 m/s. The calibration accounts for the specific cup geometry, bearing friction, and signal processing of each individual instrument — not just the instrument model. [5]

For research-grade measurements, **ultrasonic anemometers** (also called sonic anemometers) eliminate the mechanical limitations entirely. A three-axis sonic anemometer measures the transit time of ultrasonic pulses between pairs of transducers. A pulse travelling downwind arrives faster than one travelling upwind; the difference in transit times yields the wind speed component along each axis. With three orthogonal transducer pairs, the instrument resolves the full three-dimensional wind vector — including the vertical component that cup anemometers cannot measure — at sampling rates of 20 to 50 Hz. The price is typically three to five times that of a high-quality cup anemometer, but the result is turbulence data (including Reynolds stresses and heat fluxes) that a rotating cup cannot provide. [6]

<!-- IMAGE: fig-09-01 -->
> **Figure 9.1** — Meteorological mast instrumentation at multiple heights
> **Type:** annotated photograph or technical diagram
> **Content:** Schematic of a 150 m offshore met mast showing instrument locations at five heights (10, 40, 80, 120, and 150 m). At each height, label the instruments: paired cup anemometers (one on a boom, one on the mast for redundancy), wind vane, temperature sensor, and pressure sensor (at selected heights). At the top, show a 3D sonic anemometer. At the base, show the data logger enclosure and power supply (solar panel + battery). Include typical boom length (4–6 m from mast centreline) and note the purpose of paired sensors at each height: redundancy and correction for mast shadow effects.
> **Caption:** A typical offshore meteorological mast carries paired cup anemometers and wind vanes at five heights spanning the full rotor sweep zone. Redundant instruments at each level detect mast shadow effects and provide backup data when individual sensors fail. Three years of ten-minute averaged data from such a mast determined whether this patch of Baltic Sea was worth half a billion euros.
> **Alt text:** Diagram of a 150-metre offshore meteorological mast with cup anemometers, wind vanes, temperature sensors, and a sonic anemometer labelled at five measurement heights.
> **Data source:** Author illustration based on IEC 61400-12-1:2017 measurement guidance and typical offshore mast designs.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Mast structure in grey steel, instruments in blue, boom arms in dark grey, sensor labels in black with leader lines.

> **Standard reference:** IEC 61400-12-1:2017, "Wind energy generation systems — Part 12-1: Power performance measurements of electricity producing wind turbines" — Clause 7 specifies measurement equipment requirements, including anemometer classification to Class 1.7A or better, calibration procedures (Annex F), and mounting configurations to minimise flow distortion. [5]

---

## 9.2 Remote Sensing and the Global Weather Archive

A 150-metre met mast planted in the seabed costs two to five million euros to install and maintain offshore, requires a vessel campaign and regulatory permits, and measures the wind at a single point in space. In the last two decades, two technologies have fundamentally changed how the industry gathers wind data: ground-based LiDAR and global atmospheric reanalysis.

### LiDAR: Light Detection and Ranging

A wind LiDAR operates on the Doppler principle. A laser beam is emitted into the atmosphere. When the beam encounters aerosol particles — dust, pollen, salt crystals, water droplets — a tiny fraction of the light is backscattered toward the instrument. If the particles are moving with the wind, the backscattered light is shifted in frequency by an amount proportional to the velocity component along the beam direction:

$$
v_r = \frac{\Delta f \cdot \lambda}{2}
$$

where:
- $v_r$ = radial wind velocity (component along beam direction) [m/s]
- $\Delta f$ = Doppler frequency shift [Hz]
- $\lambda$ = laser wavelength [m]

The factor of 2 arises because the light travels to the particle and back — a round trip. For a typical wind LiDAR operating at a wavelength of 1.55 μm (near-infrared, eye-safe), a wind speed of 10 m/s produces a frequency shift of approximately 12.9 MHz — a small but precisely measurable shift against the carrier frequency of $1.9 \times 10^{14}$ Hz. [7]

Two competing architectures emerged in the early 2000s. The **continuous-wave (CW) LiDAR**, pioneered by QinetiQ and the Technical University of Denmark (DTU), focuses the laser beam at a specific range and measures the Doppler shift of backscattered light from the focal volume. By adjusting the focus, the instrument scans through different heights sequentially. QinetiQ's ZephIR system became the first commercial wind LiDAR in 2003, initially developed for defence applications and adapted for wind energy. The current product, ZephIR 300, measures from 10 to 200 metres. [8]

The **pulsed LiDAR**, commercialised by the French company Leosphere (now part of Vaisala) as the Windcube series, emits short laser pulses and measures the return signal at different time delays — each delay corresponding to a different range. Pulsed systems can measure at multiple heights simultaneously, from 40 to 300 metres or beyond, without mechanically adjusting focus. The Windcube V2 and its successors have become widely deployed in both onshore and offshore campaigns. [9]

For offshore applications, where installing a fixed met mast may be prohibitively expensive or premature, **floating LiDAR** systems mount a pulsed LiDAR unit on a moored buoy. The buoy's motion compensation algorithms correct for pitch, roll, and heave to recover accurate wind profiles from a moving platform. The Carbon Trust's Offshore Wind Accelerator programme drove the commercial acceptance of floating LiDAR through a structured validation roadmap, comparing buoy-mounted LiDAR measurements against fixed met mast data until the technology achieved "pre-commercial" and eventually "commercial" acceptance ratings. [10]

The IEC 61400-12-1:2017 second edition formally recognised remote sensing devices as acceptable measurement instruments for power performance testing — a milestone that validated LiDAR as more than a screening tool. Subsequent standards — IEC 61400-50-2 (ground-based wind LiDAR), IEC 61400-50-3 (nacelle-mounted LiDAR), and IEC 61400-50-4 (floating LiDAR) — provide detailed requirements for calibration, classification, and uncertainty quantification. [11]

### ERA5: The Global Weather Archive

No measurement campaign, however well instrumented, can be longer than the time since the instruments were installed. Yet financial models for offshore wind projects require estimates of the long-term wind climate spanning 20 to 30 years — far longer than any practical measurement campaign. The bridge between short-term measurements and long-term climate is provided by **atmospheric reanalysis**.

A reanalysis runs a modern numerical weather prediction model retrospectively through history, assimilating all available observations — satellite imagery, radiosonde profiles, surface weather stations, aircraft measurements, ocean buoys, and ship reports — into a physically consistent, gridded atmospheric state. The result is a complete four-dimensional picture of the atmosphere at regular intervals, reaching back decades before the measurement campaign began.

The most widely used reanalysis in wind energy is **ERA5**, the fifth generation atmospheric reanalysis produced by the European Centre for Medium-Range Weather Forecasts (ECMWF), based in Reading, England, as part of the Copernicus Climate Change Service. ERA5 provides global, hourly estimates of atmospheric variables on a horizontal grid of approximately 31 km (0.25° × 0.25°), with 137 vertical levels from the surface to 80 km altitude, covering the period from 1940 to the present. It assimilates approximately 24 million observations per day through four-dimensional variational data assimilation (4D-Var), producing both analysis fields and ten-member ensemble spreads that quantify uncertainty. [12]

ERA5 is the product of a multi-decade evolution. ECMWF's first reanalysis, ERA-15, produced in the mid-1990s, covered only 1979 to 1993 at relatively coarse resolution. ERA-40, completed in 2003, extended the record back to 1957 — the International Geophysical Year — at a horizontal resolution of approximately 125 km. ERA-Interim, operational from 2006 to 2019, improved to 79 km resolution and corrected known problems in ERA-40's hydrological cycle and stratospheric circulation. ERA5 represents another leap: finer resolution, more vertical levels, a longer record, and uncertainty estimates from the ensemble. [13]

For wind energy, ERA5 provides 10 m and 100 m wind speed and direction as standard output variables. These can be used directly for preliminary resource screening or — more importantly — as the long-term reference dataset for the Measure-Correlate-Predict methodology described in Section 9.5. The critical limitation is resolution: a 31 km grid cell cannot resolve coastal effects, local terrain features, or the wind speed gradient around individual islands. ERA5 tends to underestimate extreme wind speeds and to smooth spatial variability. It is not a replacement for on-site measurements — but it is an indispensable complement, providing the temporal depth that no measurement campaign can match. [14]

<!-- IMAGE: fig-09-02 -->
> **Figure 9.2** — ERA5 reanalysis grid over the Baltic Sea with met mast location
> **Type:** map with grid overlay
> **Content:** Map of the southern Baltic Sea (Poland, Sweden, Denmark, Germany coastlines visible) with the ERA5 0.25° × 0.25° grid overlaid as thin grey lines, showing grid cells of approximately 31 km × 31 km. Highlight a single grid cell containing the approximate offshore wind farm location (~55° N, ~16° E). Mark the met mast location as a red dot within that cell. Include a scale bar showing 31 km. In an inset or annotation, show the comparison: one grid cell (31 km) versus one met mast (single point) versus one LiDAR measurement cone. Label nearby cities (Gdańsk, Koszalin, Malmö) for geographic reference.
> **Caption:** ERA5 reanalysis provides hourly wind data on a 31 km grid from 1940 to the present — an 80-year archive that no measurement campaign can replicate. But each grid cell averages over nearly 1,000 km², smoothing local effects that a met mast or LiDAR captures in detail. The combination of long-term reanalysis and short-term on-site measurements is the foundation of modern wind resource assessment.
> **Alt text:** Map of the southern Baltic Sea showing the ERA5 reanalysis grid (31 km cells) with the wind farm location and met mast position marked, illustrating the scale difference between grid-cell resolution and point measurements.
> **Data source:** ERA5 grid geometry from ECMWF (Hersbach et al., 2020). Coastlines from Natural Earth. Wind farm location approximate.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Grid cells in light grey with highlighted cell in blue shading. Met mast in red. Coastlines in dark grey. Ocean in light blue. Land in tan.

---

## 9.3 The Weibull Distribution

The smooth curve that Maja overlaid on the wind speed histogram has a name that sounds nothing like wind. It is named after a Swedish engineer who was thinking about ball bearings.

Ernst Hjalmar Waloddi Weibull was born on 18 June 1887 in Scania, the southernmost province of Sweden. He studied mechanical engineering and spent his career investigating the strength and fatigue of materials — steel, ceramics, bearings, anything that could break under stress. In 1939, he published a paper proposing a new statistical distribution function, arguing that it could describe the probability of failure for a remarkably wide range of materials and conditions. The paper appeared in a Swedish engineering journal and attracted limited attention. [15]

In 1951, Weibull presented his case to a broader audience. His paper "A Statistical Distribution Function of Wide Applicability," published in the *Journal of Applied Mechanics* (ASME), demonstrated the distribution's versatility through seven examples drawn from entirely different domains: the yield strength of Bofors steel, the fibre strength of Indian cotton, the fatigue life of an ST-37 steel, the stature of adult males born in the British Isles, the breadth of beans of *Phaseolus vulgaris*, the discharge of the Kalix River, and the fibre strength of Ponderosa pine. A single two-parameter distribution described them all. The American Society of Mechanical Engineers awarded Weibull its Gold Medal in 1972. He died in Annecy, France, in 1979. [16]

Wind was not among Weibull's seven examples. The connection between the Weibull distribution and wind speed was established by C.G. Justus, W.R. Hargraves, and A. Mikhail in 1978, who demonstrated that the two-parameter Weibull provides an excellent fit to measured wind speed frequency distributions across a wide variety of sites and climates. Since then, the Weibull distribution has become the standard statistical model for wind speed in every major design code and resource assessment tool. [17]

### The Probability Density Function

The Weibull probability density function describes the probability of observing a wind speed in the infinitesimal interval $[v, v + dv]$:

$$
f(v) = \frac{k}{A} \left(\frac{v}{A}\right)^{k-1} \exp\left[-\left(\frac{v}{A}\right)^k\right], \quad v \geq 0
$$

where:
- $f(v)$ = probability density [s/m]
- $v$ = wind speed [m/s]
- $k$ = shape parameter [dimensionless]
- $A$ = scale parameter [m/s]

Two parameters control the entire distribution. The **shape parameter** $k$ determines the spread and skewness of the distribution:

- $k = 1$: the exponential distribution — highly variable, very gusty winds, with the most probable speed near zero
- $k = 2$: the **Rayleigh distribution** — a common first approximation when only the mean wind speed is known
- $k \approx 3.6$: approximately Gaussian — very narrow, unusually steady winds

Onshore sites typically have $k \approx 1.5$ to $2.0$, reflecting the higher turbulence and variability caused by terrain roughness. Offshore sites, with their smooth surface and damped diurnal cycle, typically show $k \approx 2.0$ to $2.5$ — the wind blows more steadily over the sea. A higher shape parameter means a narrower distribution, a more predictable wind resource, and — all else being equal — more energy. [18]

The **scale parameter** $A$ stretches the distribution along the wind speed axis. It is closely related to the mean wind speed but is not equal to it (except in the Rayleigh case, where $\bar{v} = A \sqrt{\pi}/2 \approx 0.886 A$). A site with a higher scale parameter has a distribution shifted toward higher wind speeds.

The cumulative distribution function — the probability that the wind speed does not exceed a given value — follows directly:

$$
F(v) = 1 - \exp\left[-\left(\frac{v}{A}\right)^k\right]
$$

Its complement, the **exceedance probability** $P(V > v) = \exp[-(v/A)^k]$, answers questions that matter to engineers: what fraction of the year does the wind exceed cut-in speed? What fraction exceeds rated speed? What fraction exceeds the design extreme? These probabilities feed directly into energy yield estimates, structural loading calculations, and financial risk models.

### Mean Wind Speed and Power Density

The mean wind speed can be computed from the Weibull parameters without returning to the raw data:

$$
\bar{v} = A \, \Gamma\!\left(1 + \frac{1}{k}\right)
$$

where:
- $\bar{v}$ = mean wind speed [m/s]
- $\Gamma$ = Euler gamma function [dimensionless]

For $k = 2.1$: $\Gamma(1 + 1/2.1) = \Gamma(1.476) \approx 0.886$, so $\bar{v} \approx 0.886 A$. For the Rayleigh case ($k = 2.0$): $\Gamma(1.5) = \sqrt{\pi}/2 \approx 0.886$ — essentially the same value, which is why rough estimates often assume the Rayleigh distribution when only the mean is known.

The mean **power density** — the energy flux available per unit area of the rotor disc — depends not on the cube of the mean wind speed but on the mean of the cube:

$$
\frac{E}{A_{\text{rotor}}} = \frac{1}{2} \rho \, A^3 \, \Gamma\!\left(1 + \frac{3}{k}\right)
$$

where:
- $E / A_{\text{rotor}}$ = mean power density [W/m²]
- $\rho$ = air density [kg/m³]
- $A$ = Weibull scale parameter [m/s]

This formula reveals a subtle but critical point. If you compute the power density from the mean wind speed alone — $\frac{1}{2} \rho \bar{v}^3$ — you will systematically underestimate the actual power available in the wind. The ratio of the true power density to the "cube of the mean" estimate is called the **energy pattern factor**, and it is always greater than 1.0 for any distribution with non-zero variance. For $k = 2.1$, the energy pattern factor is approximately 1.82 — the true power density is 82% higher than a naive estimate from the mean wind speed alone. This is why the distribution matters: the mean wind speed is not enough. The high-speed tail of the Weibull distribution, where power is proportional to $v^3$, contributes far more energy than its frequency alone would suggest.

<!-- IMAGE: fig-09-03 -->
> **Figure 9.3** — Weibull probability density functions for different shape parameters
> **Type:** multi-line chart
> **Content:** Plot wind speed (x-axis, 0 to 25 m/s) versus probability density (y-axis, 0 to 0.12 s/m). Show three Weibull PDFs, all with the same mean wind speed of 10 m/s: (1) k = 1.5, A = 11.0 m/s (broad, peaked near 6 m/s, long tail — typical of gusty onshore site), (2) k = 2.0, A = 11.3 m/s (Rayleigh — moderate spread), (3) k = 2.5, A = 11.2 m/s (narrow, peaked near 9 m/s — typical of steady offshore site). Annotate the mean (10 m/s) with a vertical dashed line. For each curve, annotate the peak (mode) wind speed. Shade the area under the k = 2.5 curve above 12.5 m/s (rated speed) and label it "hours at rated power."
> **Caption:** The Weibull shape parameter $k$ controls the spread of the wind speed distribution. Offshore sites (higher $k$, narrower distribution) have less variability, which concentrates more hours near the peak of the distribution and improves the predictability of energy production. All three curves share the same mean wind speed of 10 m/s, but their energy content differs significantly due to the cubic relationship between wind speed and power.
> **Alt text:** Three Weibull probability density curves with the same mean wind speed of 10 m/s but different shape parameters (k = 1.5, 2.0, 2.5), showing progressively narrower distributions as k increases.
> **Data source:** Author calculations. Parameters chosen to produce equal mean wind speeds for visual comparison.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** k = 1.5 in orange (onshore), k = 2.0 in green (Rayleigh), k = 2.5 in blue (offshore). Mean wind speed line in dashed black. Shaded region above rated speed in light blue.

---

## 9.4 The Wind Rose and the Energy Rose

The Weibull distribution describes how fast the wind blows. It says nothing about where the wind comes from. For that, the industry uses the **wind rose** — one of the oldest data visualisation tools in meteorology, adapted for the specific needs of wind energy.

A wind rose divides the compass into sectors — 12 sectors of 30° each for a standard wind rose, or 36 sectors of 10° for high-resolution analysis. For each sector, a bar extends outward from the centre, its length proportional to the fraction of time that the wind arrives from that direction. Colour segments within each bar often show the speed distribution within the sector (for example, the fraction of time at 0–5, 5–10, 10–15, 15–20, and above 20 m/s). The result is a polar diagram that reveals, at a glance, the dominant wind directions and their speed characteristics.

For the Baltic site, the wind rose shows what the three-cell atmospheric circulation predicts: the dominant direction is southwest to west, consistent with the prevailing westerlies of the Ferrel cell at 55° North. A secondary peak from the east reflects continental air masses arriving from Poland and Russia, typically in winter. The asymmetry is important: the southwest sector may account for 20 to 25% of the total hours, while some sectors contribute less than 3%.

The wind rose, however, is an incomplete guide to where the energy comes from. Wind energy is proportional to the cube of the wind speed, so a sector with moderate frequency but high mean speed can contribute far more energy than a frequent but slow sector. The **energy rose** corrects for this by weighting each sector's contribution by the cube of its mean speed:

$$
E(\theta) \propto f(\theta) \times \bar{v}(\theta)^3
$$

where:
- $E(\theta)$ = energy contribution from direction $\theta$ [proportional]
- $f(\theta)$ = frequency of wind from direction $\theta$ [dimensionless]
- $\bar{v}(\theta)$ = mean wind speed from direction $\theta$ [m/s]

The contrast between the wind rose and the energy rose can be dramatic. Consider two sectors at the Baltic site: the southwest sector has 18% frequency and a mean speed of 11.5 m/s, while the northeast sector has 12% frequency and a mean speed of 7.0 m/s. Their energy contributions are proportional to:

- Southwest: $0.18 \times 11.5^3 = 0.18 \times 1{,}521 = 274$
- Northeast: $0.12 \times 7.0^3 = 0.12 \times 343 = 41$

The southwest sector contributes 6.7 times more energy than the northeast despite being only 1.5 times more frequent. The cubic amplification, once again, transforms a moderate difference in wind speed into a dominant difference in energy. The energy rose is the map that matters for layout optimisation: turbine rows should be oriented perpendicular to the dominant energy direction, not just the most frequent wind direction. This distinction — which sector contributes the most hours versus which sector contributes the most megawatt-hours — will become critical in Chapter 11.

<!-- IMAGE: fig-09-04 -->
> **Figure 9.4** — Wind rose and energy rose for a Baltic offshore site
> **Type:** paired polar diagrams, side by side
> **Content:** Left panel: standard wind rose with 12 sectors, bars extending outward proportional to frequency (maximum ~22% for SW sector), coloured by speed bin (0–5 blue, 5–10 green, 10–15 yellow, 15–20 orange, >20 red). Right panel: energy rose for the same data, bars proportional to energy contribution per sector. The SW sector should dominate more strongly in the energy rose than in the wind rose. Annotate both panels with N/S/E/W labels. Below each panel, note: "Wind rose: hours per sector" and "Energy rose: energy per sector (∝ v³)." Add an arrow between the panels indicating "cubic amplification."
> **Caption:** The wind rose (left) shows that 18% of the time the wind comes from the southwest. The energy rose (right) shows that the southwest contributes over 30% of the total energy — because the cubic relationship amplifies the effect of that sector's higher mean wind speed. Layout optimisation and wake analysis must use the energy rose, not the wind rose, to identify the directions that matter most for annual energy production.
> **Alt text:** Side-by-side polar diagrams showing a wind rose (frequency by direction) and an energy rose (energy by direction) for an offshore Baltic site, with the southwest sector dominating more strongly in the energy rose.
> **Data source:** Author illustration based on representative Baltic offshore site data (Peña et al., 2008; Danish Meteorological Institute long-term records).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Speed bins: 0–5 m/s blue, 5–10 green, 10–15 yellow, 15–20 orange, >20 red. Background white. Compass lines in light grey.

---

## 9.5 Measure-Correlate-Predict

A met mast measures the wind at one location for one to three years. A wind farm must produce energy for twenty-five to thirty years. The gap between these timescales is the central challenge of wind resource assessment — and it is bridged by a methodology with a pragmatic name: **Measure-Correlate-Predict** (MCP).

### Why Short Campaigns Are Not Enough

Wind energy varies from year to year. The large-scale atmospheric patterns that drive the prevailing westerlies — particularly the North Atlantic Oscillation (NAO) and the Arctic Oscillation — shift the storm tracks northward or southward across Europe on timescales of years to decades. A measurement campaign that captures an unusually windy two-year period will overestimate the long-term resource. A campaign during a calm period will underestimate it. For offshore European sites, inter-annual variability in annual mean wind speed is typically ±5 to 8%, which the cubic relationship amplifies to ±15 to 25% variability in energy production. A two-year campaign could easily coincide with a 5% positive anomaly — an overestimate that, over 30 years, might translate to a cumulative revenue shortfall of several hundred million euros. [19]

### The Method

MCP resolves this by correlating short-term site measurements with a long-term reference dataset. The procedure has five steps:

**Step 1.** Identify a **long-term reference** — a nearby weather station with 20 or more years of wind data, or (increasingly) the ERA5 reanalysis dataset, which now extends back more than 80 years.

**Step 2.** Extract the **concurrent period** — the months or years during which both the site met mast and the long-term reference were recording simultaneously. A minimum of 12 months (a full seasonal cycle) is required; 24 months is preferred.

**Step 3.** During the concurrent period, establish a statistical relationship between the site and reference wind speeds. The simplest approach is linear regression:

$$
\hat{v}_{\text{site}} = a \times v_{\text{ref}} + b
$$

where:
- $\hat{v}_{\text{site}}$ = predicted site wind speed [m/s]
- $v_{\text{ref}}$ = reference wind speed [m/s]
- $a$, $b$ = regression coefficients [dimensionless, m/s]

The slope $a$ captures the ratio of site to reference wind speeds; the intercept $b$ accounts for any offset.

**Step 4.** Apply the regression to the **full long-term reference record** — the 20 to 80+ years of reference data. The result is a predicted long-term time series of wind speed at the site, as if the met mast had been recording for the entire reference period.

**Step 5.** Compute the **long-term corrected Weibull parameters** and mean wind speed from the predicted time series. These climate-adjusted values replace the short-term measured values in the energy yield calculation.

A refinement addresses a limitation of simple linear regression: regression toward the mean. Because linear regression predicts the conditional mean of the site wind speed for each reference value, it systematically narrows the predicted distribution — underestimating both the calm periods and the windy extremes. The **variance ratio method** corrects this by scaling the predictions to preserve the ratio of standard deviations between site and reference observed during the concurrent period. More sophisticated approaches — Weibull scaling, matrix methods, and machine learning — offer further improvements, but the linear regression and variance ratio methods remain the workhorses of commercial practice. [20]

The quality of an MCP correction depends critically on the correlation between site and reference during the concurrent period. A correlation coefficient below 0.80 suggests that the reference station is too far away, in a different climate regime, or obstructed by terrain that the site does not share. ERA5 has become the dominant reference dataset for offshore MCP because it provides consistent, hourly data at every grid point globally, with no gaps, no instrument failures, and no station relocations — limitations that plague long records from physical weather stations.

MCP does not eliminate uncertainty — it quantifies and reduces it. A typical MCP analysis reduces the uncertainty in the long-term mean wind speed from ±5 to 8% (short-term measurement alone) to ±2 to 4% (MCP-corrected). That residual uncertainty, propagated through the cubic relationship, translates to ±6 to 12% uncertainty in energy yield — numbers that flow directly into the financial model's P50, P75, and P90 estimates. The distinction between P50 (median estimate — 50% chance of exceedance) and P90 (conservative — 90% chance of exceedance) is the difference between what the developer hopes for and what the bank will lend against. That distinction begins here, in the correlation between a three-year met mast record and an eighty-year reanalysis archive.

<!-- IMAGE: fig-09-05 -->
> **Figure 9.5** — Measure-Correlate-Predict: scatter plot and time series
> **Type:** two-panel figure (scatter plot + time series)
> **Content:** Top panel: scatter plot of concurrent-period data — site wind speed (y-axis, 0–20 m/s) versus ERA5 reference wind speed (x-axis, 0–20 m/s), monthly means, 24 points. Overlay the linear regression line (solid red) with equation and R² value (~0.92). Label: "Concurrent period: 2 years." Bottom panel: time series showing ERA5 monthly mean wind speed (blue line, full 20-year record) and the MCP-predicted site wind speed (red line, derived from regression). Shade the concurrent period in light green. Mark the short-term site mean and the long-term corrected site mean with horizontal dashed lines, annotating the difference (~0.3 m/s correction in this example). Label: "Long-term reference: 20 years."
> **Caption:** Measure-Correlate-Predict uses the statistical relationship between site and reference during the concurrent measurement period (top, green shading) to reconstruct the site's long-term wind climate from the full reference record (bottom). In this example, the two-year measurement campaign coincided with an above-average wind period; the MCP correction reduces the estimated long-term mean by 0.3 m/s — a small adjustment that changes projected revenue by millions of euros.
> **Alt text:** Two panels: a scatter plot of site versus reference monthly wind speeds with regression line (top), and a 20-year time series showing ERA5 reference, MCP-predicted site speed, and the concurrent measurement period highlighted in green (bottom).
> **Data source:** Author illustration based on representative MCP methodology (Rogers et al., 2005; ERA5 reference).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** ERA5 reference in blue, site measurements/predictions in red, concurrent period shading in light green, regression line in red.

---

## 9.6 Worked Example: From Wind Data to Annual Energy Production

An offshore met mast has recorded three years of data at a Baltic Sea site. After quality control, MCP correction against the ERA5 reference, and vertical extrapolation to hub height (150 m), the long-term corrected Weibull parameters are:

- Shape parameter: $k = 2.1$
- Mean wind speed at hub height: $\bar{v} = 10.2$ m/s
- Air density: $\rho = 1.225$ kg/m³

**Step 1: Compute the Weibull scale parameter.**

$$
A = \frac{\bar{v}}{\Gamma(1 + 1/k)} = \frac{10.2}{\Gamma(1.476)} = \frac{10.2}{0.886} = 11.5 \text{ m/s}
$$

**Step 2: Compute the mean power density.**

$$
\frac{E}{A_{\text{rotor}}} = \frac{1}{2} \times 1.225 \times 11.5^3 \times \Gamma\!\left(1 + \frac{3}{2.1}\right) = 0.6125 \times 1{,}521 \times 1.267 = 1{,}180 \text{ W/m}^2
$$

For comparison, the naive estimate from the cube of the mean wind speed: $\frac{1}{2} \times 1.225 \times 10.2^3 = 650$ W/m². The true power density is 82% higher — this is the energy pattern factor at work.

**Step 3: Compute annual energy production for a single turbine.**

Using a simplified power curve for a 15 MW turbine (cut-in 3 m/s, rated 12.5 m/s, cut-out 31 m/s), with the approximation $P(v) = 15 \times (v/12.5)^3$ MW for $3 \leq v \leq 12.5$ and $P(v) = 15$ MW for $12.5 < v \leq 31$:

$$
\text{AEP} = 8{,}760 \sum_{i=1}^{N} P(v_i) \, p_i
$$

where $p_i = \exp[-(v_{i-0.5}/A)^k] - \exp[-(v_{i+0.5}/A)^k]$ is the Weibull probability for the 1 m/s bin centred on $v_i$.

| Bin [m/s] | Weibull prob. $p_i$ | Power $P(v_i)$ [MW] | Energy $P \times p$ [MW] |
|---|---|---|---|
| 3 | 0.020 | 0.2 | 0.004 |
| 5 | 0.049 | 1.0 | 0.049 |
| 7 | 0.077 | 2.6 | 0.200 |
| 9 | 0.094 | 5.6 | 0.527 |
| 10 | 0.097 | 7.7 | 0.747 |
| 11 | 0.097 | 10.2 | 0.989 |
| 12 | 0.090 | 13.3 | 1.197 |
| 13 | 0.079 | 15.0 | 1.185 |
| 15 | 0.049 | 15.0 | 0.735 |
| 18 | 0.014 | 15.0 | 0.210 |
| 20 | 0.004 | 15.0 | 0.060 |

Summing all bins from 3 to 31 m/s (only selected bins shown above):

$$
\sum P(v_i) \, p_i = 8.39 \text{ MW (mean power output)}
$$

$$
\text{AEP}_{\text{single}} = 8{,}760 \times 8.39 = 73{,}500 \text{ MWh} = 73.5 \text{ GWh/yr}
$$

**Step 4: Capacity factor.**

$$
\text{CF} = \frac{8.39}{15.0} = 0.559 = 55.9\%
$$

A capacity factor of 56% is realistic for a modern 15 MW turbine with low specific power (343 W/m²) at a site with a mean hub-height wind speed of 10.2 m/s. The low specific power — a large rotor relative to the generator rating — means the turbine reaches rated power at a moderate wind speed and spends more hours at full output.

**Step 5: Scale to the full wind farm.**

Gross AEP (assuming each turbine sees undisturbed flow):

$$
\text{AEP}_{\text{gross}} = 34 \times 73.5 = 2{,}499 \text{ GWh/yr}
$$

This is the theoretical maximum — the energy the farm would produce if no turbine stood in another turbine's shadow. In reality, the downstream turbines operate in the wake of the upstream turbines, receiving slower and more turbulent wind. Wake losses typically reduce the net AEP by 8 to 12% for an offshore farm with industry-standard spacing.

**Step 6: Revenue context.**

At an electricity price of 60 EUR/MWh:

- Gross revenue: $2{,}499 \times 60 = 150$ million EUR/yr
- If wake losses are 10%: lost production = 250 GWh/yr → lost revenue = 15 million EUR/yr
- Over 30 years: wake losses cost approximately 450 million EUR

Those 450 million euros — energy that the wind carried but the turbines could not capture because they stood in each other's way — are the subject of Chapter 10.

---

## Key Takeaways

- **Wind measurement uses three complementary data sources.** Cup anemometers and sonic sensors provide accurate point measurements at specific heights; LiDAR systems profile the full rotor sweep zone without a 150-metre mast; and ERA5 reanalysis provides 80+ years of gridded data at 31 km resolution. No single source is sufficient — the combination of short-term precision and long-term depth is what makes a bankable resource assessment.

- **The Weibull distribution describes the full wind speed distribution with two parameters.** The shape parameter $k$ controls the spread (onshore ~1.5–2.0, offshore ~2.0–2.5) and the scale parameter $A$ controls the magnitude. The mean wind speed alone underestimates the available energy by up to 80% because the cubic relationship amplifies the contribution of the high-speed tail.

- **The energy rose, not the wind rose, reveals which directions matter most.** The cubic weighting transforms a moderate difference in wind speed between sectors into a dominant difference in energy contribution. Layout optimisation and wake analysis must use the energy rose to identify critical directions.

- **Measure-Correlate-Predict corrects short-term data to long-term climate norms.** A 1-to-3-year measurement campaign may coincide with an anomalous period. MCP correlates site data with a long-term reference (typically ERA5) to produce climate-adjusted Weibull parameters, reducing uncertainty from ±5–8% to ±2–4% in mean wind speed.

- **AEP is computed by integrating the turbine power curve against the Weibull distribution.** For a 15 MW turbine at 10.2 m/s mean hub-height wind speed ($k = 2.1$), the result is approximately 73.5 GWh/yr — a capacity factor of 56%. Scaling to 34 turbines gives 2,499 GWh/yr gross, before the wake losses that Chapter 10 will quantify.

## For Further Reading

- **Burton, T., Jenkins, N., Sharpe, D., and Bossanyi, E. (2021).** *Wind Energy Handbook*. 3rd edition. Wiley. Chapter 2, "The Wind Resource." Comprehensive treatment of the Weibull distribution, wind roses, measurement campaigns, MCP methodology, and annual energy production calculations, with worked examples and direct connections to IEC standards.

- **Brower, M.C. (2012).** *Wind Resource Assessment: A Practical Guide to Developing a Wind Project*. Wiley. The practitioner's reference for every step from site screening through met mast installation, data validation, LiDAR deployment, MCP correction, and energy yield estimation — written by one of the founders of AWS Truepower.

- **Hersbach, H., Bell, B., Berrisford, P., et al. (2020).** "The ERA5 Global Reanalysis." *Quarterly Journal of the Royal Meteorological Society*, 146(730), 1999–2049. DOI: 10.1002/qj.3803. The definitive reference for ERA5 — describing the data assimilation system, resolution, observation inputs, validation against independent data, and known limitations. Essential reading for anyone using ERA5 as a long-term reference.

---

*Maja closed her laptop at half past four. They had been in the analysis room for eight hours, with breaks only for coffee and a canteen lunch during which Maja had continued to talk about data quality — the difference between a 99.2% recovery rate and a 97.8% recovery rate, and how two missing weeks in February could bias an entire annual mean.*

*"One more thing," she said. She reopened the laptop and pulled up a bar chart — monthly energy production by turbine position. The front row turbines, facing the southwest, produced close to what the Weibull integration predicted. But the second row produced 5 to 8% less. The third row less still. The turbines at the back of the array — the ones furthest downwind in the dominant southwest direction — produced nearly 12% less than the front row.*

*"Where does the missing energy go?" Kaan asked.*

*"It does not go anywhere," Maja said. "It was never there. The front-row turbines extract momentum from the wind. The air behind them is slower. Less energy per cubic metre. The downstream turbines are operating in the shadow of the upstream ones." She tapped the bar chart. "These are called wake effects. The wind that reaches the back row is not the wind you measured on the mast."*

*She turned to face him. "The gross AEP we computed today — 2,499 gigawatt-hours — assumes every turbine sees the free-stream wind. None of them do, except the first row in the dominant direction. Tomorrow, Anders will show you why, and how much it costs."*

*Kaan looked at the bar chart and thought about the 450 million euros the worked example had computed — energy the wind carried but the turbines could not capture because they stood in each other's way. He thought about the layout he had seen on the navigation display: 34 turbines in neat rows, their spacing measured in rotor diameters. Someone had chosen that spacing. Someone had decided how much wake loss was acceptable. That decision, he was beginning to understand, was worth more than most people's careers.*

---

## Notes

[1] Robinson, J.T.R. (1850). "On a New Anemometer." *Proceedings of the Royal Irish Academy*, 4, 566–572. Robinson's original four-cup anemometer was presented to the Royal Irish Academy in 1846. Robinson served as director of the Armagh Astronomical Observatory in Northern Ireland from 1823 to 1882. The instrument was designed to measure wind speed for astronomical seeing assessments.

[2] Robinson's anemometer factor error: Robinson asserted that the cup speed equalled one-third of the wind speed. This was widely accepted but eventually shown to be incorrect — the anemometer factor depends on cup and arm geometry and ranges from approximately 2 to just above 3. See: Middleton, W.E.K. (1969). *Invention of the Meteorological Instruments*. Johns Hopkins University Press, Baltimore. Chapter 7.

[3] Patterson, J. (1926). "The Cup Anemometer." *Transactions of the Royal Society of Canada*, Series III, 20, 1–54. Patterson demonstrated the superiority of the three-cup design over Robinson's four-cup original. Brevoort, M.J. and Joiner, U.T. (1935). "Experimental Investigation of the Robinson-Type Cup Anemometer." NACA Technical Report No. 513. The Brevoort-Joiner improvements achieved <3% error to 60 mph.

[4] Cup anemometer overspeeding: Kristensen, L. (1998). "Cup Anemometer Behavior in Turbulent Environments." *Journal of Atmospheric and Oceanic Technology*, 15(1), 5–17. DOI: 10.1175/1520-0426(1998)015<0005:CABITE>2.0.CO;2. The systematic overspeeding bias arises from the non-linear relationship between drag force and wind speed on hemispherical cups.

[5] International Electrotechnical Commission. IEC 61400-12-1:2017, "Wind energy generation systems — Part 12-1: Power performance measurements of electricity producing wind turbines." Edition 2.0. Clause 7 specifies measurement equipment requirements, including anemometer classification. Annex F defines calibration procedures. The classification system (Class 1.7A or better) quantifies the measurement uncertainty associated with a specific anemometer in defined operational conditions.

[6] Kaimal, J.C. and Finnigan, J.J. (1994). *Atmospheric Boundary Layer Flows: Their Structure and Measurement*. Oxford University Press. Chapter 6, "Sonic Anemometer-Thermometers." Sonic anemometers measure wind components by detecting the transit time difference of ultrasonic pulses between transducer pairs, providing 3D wind vectors at 20–50 Hz without mechanical inertia.

[7] Doppler wind LiDAR principle: Banakh, V.A. and Smalikho, I.N. (2013). *Coherent Doppler Wind Lidars in a Turbulent Atmosphere*. Artech House. The Doppler frequency shift is proportional to the radial velocity component along the beam and inversely proportional to the laser wavelength. At 1.55 μm, 10 m/s radial velocity produces a shift of ~12.9 MHz.

[8] ZephIR development: Slinger, C. and Harris, M. (2012). "Introduction to Continuous-Wave Doppler Lidar." QinetiQ/Natural Power technical report. The first commercial CW wind LiDAR was developed by QinetiQ and DTU in 2003, adapted from defence applications. Commercial launch under the ZephIR brand by Natural Power in 2005. Now marketed by ZX Lidars.

[9] Windcube development: Cariou, J.P. and Boquet, M. (2010). "Leosphere Pulsed Lidar Principles." Leosphere technical documentation. The Windcube series uses a pulsed Doppler architecture that measures at multiple heights simultaneously. Leosphere was acquired by Vaisala in 2018.

[10] Floating LiDAR commercial acceptance: Carbon Trust (2018). "Roadmap for the Commercial Acceptance of Floating Lidar Technology." Offshore Wind Accelerator (OWA) programme. The roadmap defined three stages — pre-commercial, commercial, and fully accepted — based on validation against fixed reference masts.

[11] IEC 61400-12-1:2017, Edition 2.0, formally includes remote sensing devices (RSDs) as acceptable measurement instruments, with calibration and classification requirements defined in IEC 61400-50-2:2022 (ground-based wind LiDAR), IEC 61400-50-3:2022 (nacelle-mounted LiDAR), and IEC 61400-50-4 (floating LiDAR).

[12] Hersbach, H., Bell, B., Berrisford, P., et al. (2020). "The ERA5 Global Reanalysis." *Quarterly Journal of the Royal Meteorological Society*, 146(730), 1999–2049. DOI: 10.1002/qj.3803. ERA5 provides hourly data on a 31 km grid with 137 vertical levels, assimilating ~24 million observations per day through 4D-Var assimilation. Produced by ECMWF under the Copernicus Climate Change Service.

[13] ECMWF reanalysis evolution: ERA-15 (mid-1990s, 1979–1993); ERA-40 (completed 2003, 1957–2002, ~125 km); ERA-Interim (2006–2019, 1979–2019, ~79 km); ERA5 (2020–present, 1940–present, ~31 km). See: Uppala, S.M., et al. (2005). "The ERA-40 Re-analysis." *Quarterly Journal of the Royal Meteorological Society*, 131(612), 2961–3012; Dee, D.P., et al. (2011). "The ERA-Interim Reanalysis." *Quarterly Journal of the Royal Meteorological Society*, 137(656), 553–597.

[14] ERA5 limitations for wind energy: Ramon, J., Lledó, L., Torralba, V., Soret, A., and Doblas-Reyes, F.J. (2019). "What Global Reanalysis Best Represents Near-Surface Winds?" *Quarterly Journal of the Royal Meteorological Society*, 145(724), 3236–3251. DOI: 10.1002/qj.3616. ERA5 tends to underestimate wind speed at coastal and complex-terrain sites due to the 31 km resolution smoothing local topographic and coastal effects.

[15] Weibull, W. (1939). "A Statistical Theory of the Strength of Materials." *Ingeniörsvetenskapsakademiens Handlingar*, No. 151, 1–45. Royal Swedish Institute for Engineering Research, Stockholm. The original presentation of the Weibull distribution, motivated by the statistical analysis of material strength and fatigue.

[16] Weibull, W. (1951). "A Statistical Distribution Function of Wide Applicability." *Journal of Applied Mechanics* (ASME), 18(3), 293–297. The paper that made the Weibull distribution famous, demonstrating its applicability across seven domains from steel fatigue to river discharge. Weibull (born 18 June 1887, died 12 October 1979 in Annecy, France) received the ASME Gold Medal in 1972.

[17] Justus, C.G., Hargraves, W.R., and Mikhail, A. (1978). "Methods for Estimating Wind Speed Frequency Distributions." *Journal of Applied Meteorology*, 17(3), 350–353. DOI: 10.1175/1520-0450(1978)017<0350:MFEWSF>2.0.CO;2. Demonstrated that the two-parameter Weibull distribution provides an excellent fit to wind speed data across diverse sites, establishing it as the standard model for wind energy applications.

[18] Weibull shape parameters by terrain: Troen, I. and Petersen, E.L. (1989). *European Wind Atlas*. Risø National Laboratory, Roskilde, Denmark. The European Wind Atlas project mapped Weibull parameters across Europe, finding $k \approx 1.5$–2.0 for complex onshore terrain and $k \approx 2.0$–2.5 for flat terrain and offshore sites. The atlas remains a foundational reference for European wind resource characterisation.

[19] Inter-annual wind variability: Früh, W.G. (2013). "Long-Term Wind Resource and Uncertainty Estimation Using Wind Records from Scotland as Example." *Renewable Energy*, 50, 1014–1026. DOI: 10.1016/j.renene.2012.08.047. Inter-annual variability in mean wind speed is typically ±5–8% for offshore European sites, amplified to ±15–25% in energy yield by the cubic relationship. The North Atlantic Oscillation index explains a significant fraction of this variability.

[20] MCP methodology review: Carta, J.A., Velázquez, S., and Cabrera, P. (2013). "A Review of Measure-Correlate-Predict (MCP) Methods Used to Estimate Long-Term Wind Characteristics at a Target Site." *Renewable and Sustainable Energy Reviews*, 27, 362–400. DOI: 10.1016/j.rser.2013.07.004. Comprehensive review of MCP methods from the earliest linear regression approaches (1940s) through variance ratio, Weibull scaling, matrix, and neural network methods. Also: Rogers, A.L., Rogers, J.W., and Manwell, J.F. (2005). "Comparison of the Performance of Four Measure-Correlate-Predict Algorithms." *Journal of Wind Engineering and Industrial Aerodynamics*, 93(3), 243–264.

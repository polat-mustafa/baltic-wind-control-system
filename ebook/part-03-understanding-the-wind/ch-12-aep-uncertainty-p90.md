# Chapter 12: How Much Energy? AEP, Uncertainty, and the P90 That Banks Demand

*The video call connected at nine o'clock on a Monday morning in Kaan's second week on the SOV. The screen divided into six tiles — four from an office in London, one from Copenhagen, and Kaan's own feed from the SOV's small conference room, where the porthole behind him framed a grey Baltic horizon and, just barely visible, the tops of three turbine towers. The woman in the largest London tile was Helena Voss, the project's finance lead, and she wasted no time.*

*"Good morning, everyone. We have four months until financial close, and the lender's engineer has flagged the uncertainty budget." She had the kind of London-accented precision that made every number she spoke sound like a verdict. Early fifties, silver-streaked dark hair pulled back, reading glasses she never removed. Behind her, a second monitor displayed a spreadsheet so dense with numbers that it resembled a wall of text from across the room. "Signe's optimised layout is final. Maja's resource assessment is complete. What we do not yet have is a bankable energy yield — and without that, no bank writes a cheque."*

*Kaan had heard the word "bankable" three times in the past week, always spoken by people who did not build turbines. He was beginning to understand that the wind farm existed in two parallel realities: the physical one, where blades turned and cables carried current, and the financial one, where every megawatt-hour had to survive a gauntlet of uncertainty before it could be counted as revenue.*

*"The P50 looks strong," said a voice from Copenhagen — Anders, dialling in from the developer's technical office. "Two thousand five hundred gigawatt-hours per year, gross. Signe's layout brings the net above twenty-three hundred."*

*"P50 is the developer's number," Helena replied. "The bank does not lend on P50. The bank lends on P90. And the distance between those two numbers is what we need to close today." She looked directly into her camera. "So let us walk through the cascade — from gross energy to the number that actually gets written into the loan agreement."*

---

## 12.1 The Gross-to-Net Energy Cascade

The distance between the energy a wind farm could theoretically produce and the energy it actually delivers to the grid is measured in a series of losses, each with its own physics, its own uncertainty, and its own line in the project's financial model. The industry calls this the **gross-to-net energy cascade**, and its standardised framework is defined in IEC 61400-15, published in its first edition in March 2025 after more than a decade of development. [1]

The cascade begins with the **gross AEP** — the energy that would be produced if every turbine operated at its warranted power curve, experienced no wakes, suffered no downtime, and lost no energy in cables or transformers. This is the number that falls out of the wind resource assessment (Chapters 8 and 9) when applied to a single isolated turbine multiplied by the number of turbines. It is a theoretical ceiling, and no real wind farm has ever reached it.

From the gross AEP, each loss category removes a fraction of energy:

$$
\text{AEP}_{\text{net}} = \text{AEP}_{\text{gross}} \times \prod_{i=1}^{n} (1 - L_i)
$$

where:
- $\text{AEP}_{\text{net}}$ = net annual energy production delivered to the grid [MWh/yr]
- $\text{AEP}_{\text{gross}}$ = gross annual energy production (no losses) [MWh/yr]
- $L_i$ = fractional loss for category $i$ [dimensionless]
- $n$ = number of loss categories

The standard loss categories, with typical ranges for a modern offshore wind farm, are:

| Loss Category | Typical Range | Primary Driver |
|---|---|---|
| Wake losses (intra-farm) | 6–15% | Turbine spacing, layout, wind rose |
| Blockage effect | 2–3% | Induction zone upstream of the farm |
| Electrical losses | 2–4% | Array cable, export cable, transformer |
| Availability losses | 3–8% | Turbine failures, BoP downtime, access |
| Turbine performance | 1–5% | Power curve degradation, sub-optimal control |
| Environmental losses | 0.5–3% | Blade icing, soiling, leading-edge erosion |
| Curtailment | 0.5–5% | Grid curtailment, noise, environmental |

The total loss from gross to net is typically **15 to 25 percent** for offshore wind. A comprehensive review by Clifton and others at NREL found that preconstruction loss predictions across eight studies ranged from 9.5 to 22.5 percent, with wake losses and availability consistently the two largest contributors. [2]

Two loss categories deserve particular attention because they are the most uncertain and the most consequential.

**Wake losses** are the largest single deduction for most offshore farms. In Chapter 10, we saw that Horns Rev I experienced 10 to 12 percent farm-level wake losses, while the closely spaced Lillgrund farm suffered 23 to 28 percent. For our reference 500 MW farm with a well-optimised layout (Chapter 11), a wake loss of 7 to 8 percent is a reasonable central estimate — but the uncertainty around that estimate is plus or minus 2 to 3 percentage points, which translates directly to tens of millions of euros over the project lifetime.

**Blockage** is a more recently recognised phenomenon. The wind farm itself, as a collective obstacle, decelerates the incoming flow before it reaches the first row of turbines. This "farm-scale blockage" was first quantified by Bleeg and others in 2018, who measured a 1.9 to 3.4 percent reduction in wind speed at the leading edge of large offshore farms compared to free-stream conditions. The effect is not captured by standard wake models, which assume undisturbed inflow at the first row. DNV's recommended blockage deduction for large offshore farms is 2 to 3 percent of gross AEP — a loss category that barely existed in energy yield assessments before 2018. [3]

<!-- IMAGE: fig-12-01 -->
> **Figure 12.1** — The gross-to-net energy cascade
> **Type:** waterfall chart (horizontal bars)
> **Content:** A waterfall chart showing the energy cascade from Gross AEP (~2,500 GWh/yr) to Net AEP (~2,050 GWh/yr). Starting bar at 2,500; successive negative bars for wake losses (–200), blockage (–62), electrical losses (–67), availability (–100), turbine performance (–50), environmental (–25), curtailment (–25). Final bar at ~2,050 shows Net AEP. Each bar labelled with the loss percentage and absolute GWh. Use red for losses, green for the Gross and Net bars.
> **Caption:** The gross-to-net energy cascade for a reference 500 MW offshore wind farm. Total losses reduce the theoretical gross production by approximately 18 percent. Wake losses and availability are the two largest individual contributors. The blockage effect, recognised since 2018, adds 2–3 percent that early energy assessments did not account for.
> **Alt text:** Waterfall chart showing progressive energy losses from 2,500 GWh/yr gross to approximately 2,050 GWh/yr net, with wake losses being the largest deduction.
> **Data source:** Author illustration based on typical offshore loss factors (Clifton et al. 2021; DNV guidelines).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Gross and Net bars in green, all loss bars in graduated red-orange.

> **Standard reference:** IEC 61400-15-1:2025, "Wind energy generation systems — Part 15-1: Assessment of wind resource, energy yield and site suitability — Energy yield methodology." This standard defines the loss categories, uncertainty framework, and reporting requirements for preconstruction energy yield assessments.

---

## 12.2 Availability: The Art of Keeping Turbines Running

Of all the loss categories in the cascade, availability is the one that most directly reflects the quality of engineering, logistics, and maintenance planning. A turbine that is not spinning when the wind is blowing is a turbine that is losing money — and offshore, the obstacles to keeping turbines spinning are formidable.

The wind industry defines two kinds of availability, standardised in IEC 61400-26. **Time-based availability** is the fraction of time a turbine is technically available to generate power, regardless of whether the wind is blowing:

$$
A_{\text{time}} = 1 - \frac{T_{\text{down}}}{T_{\text{total}}}
$$

where:
- $A_{\text{time}}$ = time-based availability [dimensionless]
- $T_{\text{down}}$ = total hours of downtime (planned + unplanned) [h]
- $T_{\text{total}}$ = total hours in the period (8,760 for one year) [h]

**Energy-based availability**, defined in IEC 61400-26-2, is more meaningful for financial modelling because it accounts for when the downtime occurs:

$$
A_{\text{energy}} = 1 - \frac{E_{\text{lost}}}{E_{\text{potential}}}
$$

where:
- $A_{\text{energy}}$ = energy-based availability [dimensionless]
- $E_{\text{lost}}$ = energy that would have been produced during downtime periods [MWh]
- $E_{\text{potential}}$ = energy that would have been produced if available for the entire period [MWh]

The distinction matters because downtime is not random with respect to wind speed. If a turbine fails during a winter storm — precisely when it would be producing the most power — the energy loss is far greater than if it fails during a calm summer afternoon. For offshore turbines, energy-based availability is typically 1 to 3 percentage points higher than time-based availability, because many failures occur during high-wind conditions that also make repair access difficult, but the longest calm periods (when the turbine would produce little anyway) often coincide with good weather windows for maintenance. [4]

> **Standard reference:** IEC 61400-26-1:2019, "Wind energy generation systems — Part 26-1: Availability for wind energy generation systems." Defines the information model and state diagram for deriving time-based availability indicators. IEC 61400-26-2:2014, Part 26-2, extends the framework to production-based (energy-based) availability.

Modern offshore wind farms achieve time-based availability of 93 to 97 percent, with the best projects exceeding 97 percent. This represents a hard-won improvement. The first generation of offshore farms told a different story: Scroby Sands, a 60 MW farm off the Norfolk coast commissioned in 2004, recorded availability as low as 84 percent in its early years. Kentish Flats, commissioned the following year, saw figures as low as 73.5 percent. The causes were mundane but expensive — gearbox failures, transformer faults, and, above all, the difficulty of reaching turbines in the North Sea. [5]

The logistics of offshore access are governed by significant wave height ($H_s$), the single most important parameter for maintenance planning. A standard crew transfer vessel (CTV) — the rigid-hulled boats that ferry technicians from port — can safely transfer personnel up to $H_s$ = 1.5 metres. A motion-compensated gangway system, such as those developed by Ampelmann, extends the limit to 2.0 metres. Service operation vessels (SOVs), the floating hotels where Kaan is currently living, allow walk-to-work access in seas up to 2.5 to 3.0 metres $H_s$. In the southern North Sea, the proportion of time when $H_s$ is below 1.5 metres — the CTV threshold — is approximately 71 percent along the Danish coast, but drops to below 50 percent in the central North Sea and below 20 percent on the exposed Atlantic coasts of Scotland and Ireland. [6]

The seminal study of offshore turbine failure rates was published by Carroll and others in 2016, based on operational data from approximately 350 offshore turbines across European wind farms. They found an overall failure rate of roughly 8 to 10 events per turbine per year — a number that sounds alarming until you understand that the vast majority are minor faults (sensor errors, pitch system resets) that are cleared remotely or during routine maintenance visits. The critical insight was that major failures — those requiring heavy-lift vessels, such as gearbox or generator replacements — represented only 25 percent of all failures but were responsible for 95 percent of total downtime. A single gearbox replacement on an offshore turbine requires mobilising a jack-up vessel at a charter rate of several hundred thousand euros per day, waiting for a suitable weather window, and executing a crane lift 150 metres above the sea. The repair itself may take 24 hours. The weather window may take weeks. [7]

This asymmetry — many small faults, a few catastrophic ones — is why availability modelling for offshore wind has moved far beyond simple percentage assumptions. Modern energy yield assessments use Monte Carlo simulations that sample failure rates from empirical distributions, model weather-dependent access using hindcast wave data, and simulate vessel logistics including fleet size, mobilisation time, and port distance. The result is not a single availability number but a distribution, with its own mean and variance that feeds into the overall uncertainty budget.

<!-- IMAGE: fig-12-02 -->
> **Figure 12.2** — Offshore wind farm availability versus significant wave height threshold
> **Type:** line chart with shaded access windows
> **Content:** X-axis: Significant wave height Hs threshold (0.5 to 4.0 m). Y-axis: Percentage of year accessible (0–100%). Three curves: CTV access (steep drop above 1.5 m), walk-to-work/gangway (steep drop above 2.5 m), and jack-up vessel (threshold at ~1.5 m but with mobilisation delay). Shaded bands show typical Hs distributions for three locations: Southern North Sea (mostly <2 m), Central North Sea (wider spread), and Baltic Sea (intermediate). Mark the 1.5 m CTV threshold and the 2.5 m SOV threshold with vertical dashed lines.
> **Caption:** Accessibility for maintenance operations depends on significant wave height and vessel type. The CTV threshold of 1.5 m Hs provides 60–80 percent accessibility in the southern North Sea but drops sharply at more exposed sites. Service operation vessels, with walk-to-work access up to 2.5 m Hs, extend the maintenance window significantly and are standard for far-offshore projects.
> **Alt text:** Line chart showing decreasing accessibility percentage as wave height threshold decreases, with curves for different vessel types and shaded bands for different sea areas.
> **Data source:** Author illustration based on Fraunhofer IEE wave climate data and vessel access limits from DNV-ST-0437.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** CTV curve in blue, SOV in green, jack-up in orange. Sea area bands in pale blue, grey, and tan.

---

## 12.3 The Uncertainty Budget

Every number in the gross-to-net cascade carries uncertainty. The wind speed at hub height is uncertain because it was measured for two years, not thirty, and extrapolated from 10 metres to 150 metres using a model. The wake loss is uncertain because the Jensen and Gaussian models are approximations of turbulent fluid dynamics. The power curve is uncertain because the IEC 61400-12-1 test procedure has a measurement uncertainty of 2 to 3 percent even under controlled conditions. The availability is uncertain because no one knows exactly when the next gearbox will fail.

The discipline of quantifying these uncertainties — assigning a probability distribution to each loss category and combining them into a total AEP uncertainty — is what the industry calls the **uncertainty budget**. It is the single most consequential document in the project's financial model, because it determines the gap between the P50 and the P90.

Each uncertainty source contributes to the total standard deviation of the AEP estimate. If the uncertainty sources are independent — an assumption that is approximately but not perfectly true — the total uncertainty combines in quadrature:

$$
\sigma_{\text{total}} = \sqrt{\sum_{i=1}^{m} \sigma_i^2}
$$

where:
- $\sigma_{\text{total}}$ = total standard deviation of net AEP [MWh/yr or % of P50]
- $\sigma_i$ = standard deviation contribution from uncertainty source $i$ [same units]
- $m$ = number of independent uncertainty categories

The major uncertainty categories and their typical contributions, based on the framework established by Clifton and others and now standardised in IEC 61400-15, are:

| Uncertainty Category | Typical σ (% of AEP) | Nature |
|---|---|---|
| Wind speed measurement | 1.0–2.0% | Anemometer calibration, mounting effects |
| Horizontal extrapolation | 1.5–3.0% | Spatial variation across the farm area |
| Vertical extrapolation (shear) | 1.0–2.5% | Log law vs power law model choice |
| Long-term correlation | 2.0–3.0% | MCP regression, reference data quality |
| Future inter-annual variability | 3.5–6.0% | Weather year-to-year variation |
| Wake model | 1.0–2.0% | Jensen vs Gaussian, blockage |
| Power curve | 0.5–1.5% | Measurement uncertainty, warranty margin |
| Availability and losses | 0.5–1.5% | Failure rates, access, curtailment |

The single largest contributor is almost always **future inter-annual variability** — the simple fact that some years are windier than others, and no model can predict which years those will be. For a typical North Sea site, the inter-annual coefficient of variation (standard deviation divided by mean) of annual mean wind speed is 4 to 6 percent. Because power scales with the cube of wind speed, a 5 percent variation in wind speed translates to approximately 15 percent variation in energy production. Even with the cubic amplification tempered by the capacity factor ceiling (the turbine cannot produce more than rated power), the resulting AEP variability is typically 6 to 10 percent — and this is a **fundamental** uncertainty that cannot be reduced by better measurements or better models. The weather will do what the weather does. [8]

The total AEP uncertainty (one standard deviation) for a well-characterised offshore site with a two-year measurement campaign and modern modelling tools is typically **6 to 10 percent** of the P50 estimate. For complex or data-poor sites — or for novel technologies where the power curve has not been validated — the total can exceed 15 percent.

A critical subtlety is that some uncertainty sources are correlated. Wind speed measurement error and power curve uncertainty are not fully independent, because both depend on the anemometry campaign. Long-term correlation uncertainty and inter-annual variability share a common dependence on the quality of the reference dataset. Treating all sources as independent (as the quadrature formula assumes) slightly underestimates the total uncertainty. An NREL study in 2019 found that ignoring correlations underestimated total uncertainty by an average of 0.1 percent and as much as 0.5 percent at individual sites — a small but non-negligible error when the total uncertainty itself is only 8 to 10 percent. The solution is Monte Carlo simulation, which can sample correlated variables jointly using correlation matrices or copulas. [9]

<!-- IMAGE: fig-12-03 -->
> **Figure 12.3** — Uncertainty budget breakdown for a typical offshore wind farm
> **Type:** stacked horizontal bar chart
> **Content:** A single horizontal bar representing total σ = 8.5% of AEP, divided into coloured segments for each uncertainty category: inter-annual variability (largest, ~4.5%), long-term correlation (~2.5%), horizontal extrapolation (~2.0%), vertical extrapolation (~1.5%), wind measurement (~1.5%), wake model (~1.5%), power curve (~1.0%), availability/losses (~1.0%). Note that these are root-sum-of-squares contributions, so they add in quadrature, not linearly. A second bar below shows the same categories combined in quadrature, with a callout showing the total σ_total = 8.5%.
> **Caption:** Typical uncertainty budget for an offshore wind energy yield assessment. Inter-annual variability dominates because it is an irreducible property of the climate. Measurement and modelling uncertainties can be reduced with longer campaigns, better instruments, and validated models, but the weather itself cannot be made more predictable. Values represent one standard deviation (σ) contributions, combined in quadrature.
> **Alt text:** Stacked bar chart showing uncertainty contributions to total AEP standard deviation, with inter-annual variability as the largest segment.
> **Data source:** Author illustration based on Clifton et al. (2021) and IEC 61400-15 framework.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Each category in a distinct colour; inter-annual variability in deep blue to emphasise its dominance.

---

## 12.4 P50, P75, P90: The Statistics That Finance Demands

Andrew Garrad founded his consultancy in Bristol in 1984 with a mathematical mission: to predict, with quantifiable confidence, how much energy a wind farm would produce. The company — Garrad Hassan, later absorbed into DNV — became the industry's most trusted independent engineer, and its methodology shaped the financial language of wind energy. When banks in the early 1990s began financing wind farms through non-recourse project finance — lending against the project's cash flows rather than the developer's balance sheet — they needed a number that answered a specific question: *what is the minimum production we can reasonably count on?* [10]

The answer was the **P90** — the annual energy production that will be exceeded in 90 percent of years. It is not the expected production (that is the P50, the median) but the conservative floor that allows a lender to size a loan with confidence that the project will generate enough revenue to service its debt even in a poor wind year.

The P-values are defined as **exceedance probabilities**. Assuming the annual net AEP follows a normal distribution with mean $\mu$ (the P50) and standard deviation $\sigma$ (from the uncertainty budget):

$$
P_{x} = \mu - z_x \cdot \sigma
$$

where:
- $P_{x}$ = production level exceeded with probability $x/100$ [MWh/yr]
- $\mu$ = P50 (mean) net AEP [MWh/yr]
- $\sigma$ = total standard deviation of net AEP [MWh/yr]
- $z_x$ = standard normal quantile for exceedance probability $x$

The key quantiles are:

| Exceedance level | $z_x$ | Meaning |
|---|---|---|
| P50 | 0 | Exceeded 50% of years (the mean estimate) |
| P75 | 0.674 | Exceeded 75% of years |
| P90 | 1.282 | Exceeded 90% of years |
| P99 | 2.326 | Exceeded 99% of years |

For a project with a P50 of 2,300 GWh/yr and a total uncertainty of 8.5 percent (σ = 195.5 GWh/yr), the P90 is:

$$
P_{90} = 2{,}300 - 1.282 \times 195.5 = 2{,}049 \text{ GWh/yr}
$$

That is 89.1 percent of the P50 — a gap of 251 GWh/yr, or roughly 25 million euros per year at a power price of 100 EUR/MWh. Over a 30-year project life, the difference between P50 and P90 is approximately **750 million euros** in revenue. This is the gap that Helena was talking about: the distance between what the developer hopes for and what the bank will lend against.

A crucial distinction exists between the **1-year P90** and the **long-term (e.g., 10-year or lifetime) P90**. The uncertainty budget contains two fundamentally different types of uncertainty:

1. **Systematic (epistemic) uncertainty** — errors in the wind resource model, power curve, or loss assumptions that bias the P50 estimate itself. These uncertainties persist every year: if the model overestimates wind speed by 3 percent, it overestimates it every year.

2. **Random (aleatory) uncertainty** — inter-annual weather variability. This uncertainty averages out over time: a sequence of ten years will have some windy years and some calm years, and the ten-year average will be closer to the true mean than any individual year.

For a multi-year period of $n$ years, the random component reduces by $\sqrt{n}$, while the systematic component does not:

$$
\sigma_{\text{n-year}} = \sqrt{\sigma_{\text{sys}}^2 + \frac{\sigma_{\text{random}}^2}{n}}
$$

This means the 10-year P90 is closer to the P50 than the 1-year P90 — typically 92 to 95 percent of P50 versus 85 to 90 percent. Banks typically use the 1-year P90 for sizing annual debt service and the 10-year P90 for evaluating the debt service coverage ratio (DSCR) over the loan tenor. A typical DSCR requirement is 1.30 to 1.40 — meaning that even in a P90 year, revenue must exceed debt payments by 30 to 40 percent. [11]

> **Standard reference:** IEC 61400-15-1:2025, "Wind energy generation systems — Part 15-1: Assessment of wind resource, energy yield and site suitability — Energy yield methodology." Sections 9 and 10 define the framework for quantifying uncertainty categories, combining them into a total uncertainty estimate, and deriving exceedance probabilities (P50, P75, P90, P99) for reporting to project stakeholders.

The P90 convention was not invented by wind engineers. It was imported from oil-and-gas project finance, where proven reserves (the "P90" or "1P" estimate) had long been the basis for lending. Garrad Hassan adapted the concept for wind energy in the late 1980s and early 1990s, when UK electricity market deregulation (1990) and the Non-Fossil Fuel Obligation created the first generation of privately financed wind farms. By the time the US Production Tax Credit was enacted in 1992, the P90 was already becoming standard practice for independent energy yield assessments. Today, no utility-scale wind farm anywhere in the world reaches financial close without an independent P90 assessment — typically prepared by DNV, K2 Management, UL Solutions, or another accredited consultant. The P90 is not a regulation. It is a market standard, enforced not by law but by the lending committees of banks that have learned, through decades of project finance, that the P50 alone is not enough to protect their capital. [12]

<!-- IMAGE: fig-12-04 -->
> **Figure 12.4** — P50 and P90 on the AEP probability distribution
> **Type:** probability distribution curve with shaded areas
> **Content:** A normal distribution curve of annual net AEP, centered on P50 (~2,300 GWh/yr). The x-axis is AEP (GWh/yr), y-axis is probability density. Mark P50 at the center with a vertical line. Mark P90 at 2,049 GWh/yr with a vertical line. Shade the area to the right of P90 in blue (90% probability). Mark P75 and P99 with lighter vertical lines. Label the gap between P50 and P90 as "The bank's risk buffer" with a double-headed arrow. Show σ = 195.5 GWh/yr.
> **Caption:** The P50 and P90 on a normal distribution of annual net AEP. The P90 is the production level that will be exceeded in 90 percent of years — the shaded area represents the 90 percent confidence region. The gap between P50 and P90 represents the uncertainty that project finance must price in. For this example (σ = 8.5% of P50), the P90 is 89 percent of the P50.
> **Alt text:** Normal distribution curve of annual energy production showing P50 at center, P90 to the left, and 90% of the distribution shaded to the right of P90.
> **Data source:** Author illustration.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Distribution curve in dark blue, P90 shaded area in light blue, P50 line in green, P90 line in red, gap annotation in orange.

---

## 12.5 LCOE: What a Megawatt-Hour Really Costs

The P90 tells the bank how much energy the farm will produce in a bad year. The LCOE — the **levelised cost of energy** — tells everyone what that energy costs to generate. It is the single metric that allows comparison between offshore wind, onshore wind, solar, nuclear, gas, and every other generation technology, and it is the number that has driven the transformation of offshore wind from an expensive experiment to a competitive energy source.

The LCOE expresses the all-in cost of generating one megawatt-hour of electricity, including capital cost, operating cost, and the time value of money:

$$
\text{LCOE} = \frac{\text{CAPEX} \times \text{FCR} + \text{OPEX}_{\text{annual}}}{\text{AEP}_{\text{net}}}
$$

where:
- $\text{LCOE}$ = levelised cost of energy [EUR/MWh]
- $\text{CAPEX}$ = total capital expenditure [EUR]
- $\text{FCR}$ = fixed charge rate, which annualises the capital cost at a given discount rate over the project lifetime [1/yr]
- $\text{OPEX}_{\text{annual}}$ = annual operating expenditure [EUR/yr]
- $\text{AEP}_{\text{net}}$ = net annual energy production [MWh/yr]

The fixed charge rate is itself a function of the weighted average cost of capital (WACC) and the project design life:

$$
\text{FCR} = \frac{r(1+r)^n}{(1+r)^n - 1}
$$

where:
- $r$ = nominal WACC [dimensionless]
- $n$ = project design life [years]

For a WACC of 7 percent and a design life of 30 years, the FCR is 0.0806 — meaning that approximately 8.1 percent of the total CAPEX must be recovered each year to satisfy both debt and equity investors over the project lifetime.

The CAPEX of an offshore wind farm is typically decomposed as:

| Component | Share of CAPEX | Typical cost |
|---|---|---|
| Wind turbines (nacelle, rotor, tower) | 40–44% | EUR 1,200–1,400/kW |
| Balance of plant (foundations, array cables, export cable, OSS) | 24–28% | EUR 700–850/kW |
| Installation and commissioning | 20–27% | EUR 550–800/kW |
| Development and project management | 4–6% | EUR 120–180/kW |
| **Total** | **100%** | **EUR 2,600–3,200/kW** |

The global weighted-average total installed cost for offshore wind in 2024 was USD 2,852 per kilowatt (approximately EUR 2,600/kW), according to IRENA — a 48 percent reduction since 2010. Operating expenditure for European offshore wind is typically EUR 80,000 to 100,000 per megawatt per year, with the expectation that improved reliability and logistics will reduce this to approximately EUR 55,000/MW/yr by 2030. [13]

The result is an LCOE that has fallen dramatically. IRENA's 2024 data shows a global weighted average of USD 0.079/kWh (approximately EUR 72/MWh) for newly commissioned offshore projects — a 62 percent decline from 2010 levels. The lowest LCOEs in Europe are found in Denmark (EUR 48/MWh) and the Netherlands, where shallow water, established supply chains, and favourable wind resources combine to drive costs below onshore wind in some cases. [14]

But the LCOE is a levelised average — it says nothing about the year-to-year variability of revenue, the timing of cash flows, or the risk that wholesale electricity prices may be lower than the LCOE when the wind is blowing. This is where the revenue guarantee becomes essential.

---

## 12.6 Contracts for Difference: The Revenue Guarantee

A wind farm produces electricity when the wind blows, not when the market wants it. On a windy winter night, when demand is low and every offshore farm in the North Sea is running at full power, the wholesale price may fall to zero or even go negative. On a calm summer afternoon, when the grid is strained and prices spike, the turbines sit idle. This mismatch between production and price is the **merchant risk**, and for the first three decades of offshore wind development, eliminating it was the single most important financial innovation.

The mechanism that most European countries adopted is the **Contract for Difference (CfD)** — a two-sided agreement between the generator and a government-backed counterparty. The CfD guarantees a fixed "strike price" for every megawatt-hour produced over a contract period (typically 15 to 25 years). When the wholesale electricity price is below the strike price, the counterparty pays the generator the difference. When the wholesale price is above the strike price, the generator pays the counterparty. The result is a revenue stream that is almost entirely insulated from wholesale price volatility — exactly the predictability that lenders require.

The United Kingdom pioneered the CfD for offshore wind, and its allocation rounds (ARs) have become the most visible chronicle of offshore wind's cost decline:

| Round | Year | Strike price (2012 GBP/MWh) | Key projects |
|---|---|---|---|
| AR1 | 2015 | 119–140 | Hornsea 1 (1.2 GW), East Anglia 1 |
| AR2 | 2017 | 57.50–74.75 | Hornsea 2, Moray East |
| AR3 | 2019 | 39.65–41.61 | Dogger Bank A/B/C, Sofia |
| AR4 | 2022 | 37.35 | Inch Cape, Norfolk Boreas |
| AR5 | 2023 | — | Zero offshore wind awarded |
| AR6 | 2024 | 58.87 | 4.9 GW across 9 projects |

The trajectory from AR1 to AR3 was spectacular: a more than 70 percent reduction in strike price in just four years, driven by larger turbines, lower WACC, and fierce competition among developers. AR4 in 2022 continued the downward trend. Then AR5, in September 2023, awarded zero offshore wind capacity — the price cap set by the government (44 GBP/MWh in 2012 prices) was below the cost that developers could accept in a world of rising interest rates, supply chain inflation, and commodity price increases. The lesson was immediate and expensive: set the cap too low, and you get nothing. AR6 in 2024 raised the ceiling and awarded 4.9 GW, but at a strike price 58 percent higher than AR4. The cost of offshore wind, it turned out, could go up as well as down. [15]

The Netherlands took a different path. In 2018, Vattenfall won the Hollandse Kust Zuid tender — 1.5 GW, 139 turbines — with a **zero-subsidy bid**. It was the world's first offshore wind farm built without any guaranteed price support. The revenue model relied instead on corporate power purchase agreements (PPAs) with industrial offtakers. The project was made possible by an exceptional combination: shallow water (18 to 35 km offshore), a mature supply chain, and the world's most competitive offshore wind WACC at the time. Hollandse Kust Zuid began producing power in 2022. It remains an outlier — few sites in the world can match those conditions. [16]

Poland, where our reference farm sits in the Baltic Sea, held its first offshore wind CfD auction in December 2025. Three projects totalling 3.4 GW were awarded strike prices of 476 to 492 PLN/MWh (approximately EUR 113 to 117/MWh) under 25-year contracts — reflecting the higher costs of a nascent supply chain and the engineering challenges of the Baltic's sea ice and shallow bathymetry. [17]

The CfD transforms the revenue line in the financial model from a volatile unknown into a near-constant. And that constancy, combined with the P90 energy yield, is what allows a bank to write the loan that builds the wind farm. Without a CfD (or an equivalent price guarantee), the P90 alone is not enough — the bank must also model electricity price risk, and that additional uncertainty can increase the required DSCR, raise the cost of debt, or kill the project entirely.

<!-- IMAGE: fig-12-05 -->
> **Figure 12.5** — UK offshore wind CfD strike prices, AR1 to AR6
> **Type:** bar chart with trend line
> **Content:** X-axis: Allocation rounds AR1 through AR6 (years 2015–2024). Y-axis: Strike price in 2012 GBP/MWh. Bars for each round showing the minimum awarded strike price: AR1 ~120, AR2 ~57.50, AR3 ~39.65, AR4 ~37.35, AR5 marked as "No award" (zero bar with an X), AR6 ~58.87. Include a dotted trend line showing the U-shaped trajectory. Add annotation for AR5: "Price cap below market — zero MW awarded."
> **Caption:** UK offshore wind CfD strike prices from Allocation Round 1 (2015) to AR6 (2024), in 2012 prices. The 70 percent decline from AR1 to AR3 was one of the fastest cost reductions in energy history. AR5's failure to award any offshore capacity demonstrated that price caps below market reality yield zero results. AR6 restored procurement but at a 58 percent premium over AR4.
> **Alt text:** Bar chart showing UK offshore wind strike prices declining steeply from AR1 to AR4, then AR5 with zero awards, and AR6 rebounding upward.
> **Data source:** UK DESNZ CfD allocation round results; Energy Voice AR timeline analysis.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Bars in graduated blue (darker for higher prices), AR5 bar in red/grey with X overlay.

---

## 12.7 Worked Example: From Gross AEP to a Bankable Number

Let us follow the full cascade for our reference 500 MW offshore wind farm: 34 turbines, each rated at 15 MW with a 236-metre rotor, operating in a Baltic Sea wind resource with a Weibull shape parameter $k = 2.1$ and scale parameter $A = 11.5$ m/s (from Chapter 9's analysis).

**Step 1: Gross AEP.**

From the Chapter 9 worked example, the single-turbine gross AEP (no wake losses, no other losses) is 73.5 GWh/yr, giving a farm gross AEP of:

$$
\text{AEP}_{\text{gross}} = 34 \times 73.5 = 2{,}499 \text{ GWh/yr}
$$

**Step 2: Loss cascade.**

| Loss category | Central estimate | Energy lost [GWh/yr] |
|---|---|---|
| Wake losses (optimised layout, Ch 11) | 7.8% | 195 |
| Blockage effect | 2.5% | 58 |
| Electrical losses (array + export) | 3.0% | 65 |
| Availability (energy-based) | 5.0% | 103 |
| Turbine performance | 2.0% | 39 |
| Environmental (blade degradation) | 1.0% | 18 |
| Curtailment (grid + environmental) | 1.5% | 27 |
| **Total loss** | **~21.0%** | |

Applying the losses multiplicatively:

$$
\text{AEP}_{\text{net}} = 2{,}499 \times (1-0.078)(1-0.025)(1-0.03)(1-0.05)(1-0.02)(1-0.01)(1-0.015)
$$

$$
\text{AEP}_{\text{net}} = 2{,}499 \times 0.922 \times 0.975 \times 0.970 \times 0.950 \times 0.980 \times 0.990 \times 0.985
$$

$$
\text{AEP}_{\text{net}} = 2{,}499 \times 0.790 = 1{,}974 \text{ GWh/yr}
$$

This is the **P50 net AEP**: the central estimate of the energy delivered to the grid connection point. The capacity factor at P50 is:

$$
\text{CF} = \frac{1{,}974{,}000}{510 \times 8{,}760} = 0.442 = 44.2\%
$$

**Step 3: Uncertainty budget.**

| Uncertainty category | σ (% of P50 AEP) |
|---|---|
| Wind speed measurement | 1.5% |
| Horizontal extrapolation | 2.0% |
| Vertical extrapolation | 1.5% |
| Long-term correlation | 2.5% |
| Inter-annual variability | 5.0% |
| Wake model | 1.5% |
| Power curve | 1.0% |
| Availability and losses | 1.0% |

Combining in quadrature:

$$
\sigma_{\text{total}} = \sqrt{1.5^2 + 2.0^2 + 1.5^2 + 2.5^2 + 5.0^2 + 1.5^2 + 1.0^2 + 1.0^2}
$$

$$
\sigma_{\text{total}} = \sqrt{2.25 + 4.0 + 2.25 + 6.25 + 25.0 + 2.25 + 1.0 + 1.0} = \sqrt{44.0} = 6.6\%
$$

In energy terms: $\sigma = 0.066 \times 1{,}974 = 130.3$ GWh/yr.

**Step 4: P-values.**

| Exceedance level | Calculation | AEP [GWh/yr] | % of P50 |
|---|---|---|---|
| P50 | $1{,}974$ | 1,974 | 100.0% |
| P75 | $1{,}974 - 0.674 \times 130.3$ | 1,886 | 95.5% |
| P90 (1-year) | $1{,}974 - 1.282 \times 130.3$ | 1,807 | 91.6% |
| P99 (1-year) | $1{,}974 - 2.326 \times 130.3$ | 1,671 | 84.6% |

The **1-year P90 is 1,807 GWh/yr** — 167 GWh/yr less than the P50. At a CfD strike price of EUR 100/MWh, that gap represents **16.7 million EUR per year**, or **500 million EUR over the 30-year project life**. This is the cost of uncertainty.

For the 10-year P90, we separate systematic and random uncertainty. Approximately 60 percent of the total variance comes from systematic sources (measurement, extrapolation, wake model, power curve) and 40 percent from random inter-annual variability:

$$
\sigma_{\text{sys}} = 0.066 \times \sqrt{0.60} \times 1{,}974 = 100.9 \text{ GWh/yr}
$$

$$
\sigma_{\text{random}} = 0.066 \times \sqrt{0.40} \times 1{,}974 = 82.4 \text{ GWh/yr}
$$

$$
\sigma_{\text{10yr}} = \sqrt{100.9^2 + \frac{82.4^2}{10}} = \sqrt{10{,}181 + 679} = \sqrt{10{,}860} = 104.2 \text{ GWh/yr}
$$

$$
P_{90,\text{10yr}} = 1{,}974 - 1.282 \times 104.2 = 1{,}841 \text{ GWh/yr} \quad (93.3\% \text{ of P50})
$$

The 10-year P90 is 34 GWh/yr higher than the 1-year P90, because the random component has ten years to average out. This distinction matters for debt sizing: the bank uses the 1-year P90 for annual debt service and the multi-year P90 for the overall loan structure.

**Step 5: LCOE.**

| Parameter | Value |
|---|---|
| Total CAPEX | EUR 2,900/kW × 510 MW = EUR 1,479 M |
| WACC (nominal) | 7.0% |
| Project life | 30 years |
| FCR | 0.0806 |
| Annual OPEX | EUR 90,000/MW/yr × 510 MW = EUR 45.9 M/yr |

$$
\text{LCOE} = \frac{1{,}479 \times 0.0806 + 45.9}{1{,}974} = \frac{119.2 + 45.9}{1{,}974} = \frac{165.1}{1{,}974} = 83.6 \text{ EUR/MWh}
$$

At P90 production:

$$
\text{LCOE}_{P90} = \frac{165.1}{1{,}807} = 91.4 \text{ EUR/MWh}
$$

The LCOE at P90 is 9.3 percent higher than at P50 — a direct measure of how much uncertainty costs per megawatt-hour.

**Step 6: Revenue under CfD.**

With a Polish CfD strike price of EUR 115/MWh (based on the 2025 auction result) and a 25-year contract:

| Metric | P50 | P90 (1-year) |
|---|---|---|
| Annual production [GWh/yr] | 1,974 | 1,807 |
| Annual CfD revenue [M EUR/yr] | 227.0 | 207.8 |
| 25-year CfD revenue [M EUR] | 5,676 | 5,195 |
| Annual debt service coverage (at 119.2 M EUR debt) | 1.91 | 1.74 |

The DSCR at P90 is 1.74 — well above the typical lender requirement of 1.30 to 1.40. This project is financeable. The P90 cushion gives the bank confidence that even in a poor wind year, revenue will exceed debt payments by 74 percent.

**Step 7: Summary.**

| Metric | Value |
|---|---|
| Gross AEP | 2,499 GWh/yr |
| Total losses | ~21% |
| P50 Net AEP | 1,974 GWh/yr |
| Total uncertainty (σ) | 6.6% |
| P90 Net AEP (1-year) | 1,807 GWh/yr (91.6% of P50) |
| LCOE at P50 | 83.6 EUR/MWh |
| LCOE at P90 | 91.4 EUR/MWh |
| 25-year CfD revenue (P50) | 5,676 M EUR |
| DSCR at P90 | 1.74 |

---

## Key Takeaways

- **The gross-to-net energy cascade typically reduces offshore wind production by 15 to 25 percent,** with wake losses and availability as the two largest contributors. The blockage effect, quantified since 2018, adds 2 to 3 percent that earlier assessments missed.

- **The P90 is the energy production exceeded in 90 percent of years, and it is the basis for project finance lending.** For a well-characterised offshore site, the 1-year P90 is typically 85 to 92 percent of the P50, depending on total uncertainty. The gap between P50 and P90 can represent hundreds of millions of euros over the project lifetime.

- **Inter-annual wind variability is the single largest uncertainty source and cannot be reduced by better measurement or modelling.** It is a fundamental property of the climate. All other uncertainty categories can be reduced with longer campaigns, better instruments, and validated models.

- **Contracts for Difference transform volatile wholesale revenue into a predictable cash flow,** enabling the low WACC and high leverage that make offshore wind financially viable. The UK's CfD allocation rounds chronicle a 70 percent cost decline from 2015 to 2019 — and the consequences when price caps are set too low (AR5, 2023).

- **LCOE at P90 is 7 to 10 percent higher than at P50,** providing a direct measure of the financial cost of uncertainty. Reducing uncertainty — through better measurements, longer campaigns, and validated models — directly lowers the P90 LCOE and improves project bankability.

## For Further Reading

- **Clifton, A., Smith, A., and Fields, M.J. (2016).** "Wind Plant Preconstruction Energy Estimates: Current Practice and Opportunities." NREL/TP-5000-64735. National Renewable Energy Laboratory. The most comprehensive public review of preconstruction energy yield assessment practices, loss factors, and uncertainty methods across the US wind industry, with data from eight independent studies covering 1.1 GW of projects.

- **IRENA (2025).** "Renewable Power Generation Costs in 2024." International Renewable Energy Agency, Abu Dhabi. Annual report tracking LCOE, CAPEX, and capacity factors for all renewable technologies globally. Contains the most authoritative public dataset on offshore wind costs across regions.

- **Garrad, A. (2024).** "The Queen Elizabeth Prize Lecture: Wind Energy and the Art of Engineering." Royal Academy of Engineering. Andrew Garrad's retrospective on four decades of wind energy development, including the origin of probabilistic energy yield assessment and the P90 convention. A rare primary-source account from the engineer who shaped the industry's financial methodology.

---

*Helena closed her spreadsheet and removed her reading glasses for the first time in the meeting. The London office was quiet behind her. Anders's Copenhagen tile showed him leaning back in his chair, coffee in hand, apparently satisfied.*

*"So the P90 net is just over eighteen hundred gigawatt-hours," she said. "The DSCR clears the bank's threshold with room to spare. The CfD locks in the revenue for twenty-five years. The lender's engineer will have questions about the blockage model and the availability assumptions — they always do — but the fundamental case is bankable."*

*Kaan had spent two weeks learning about wind — how it formed, how it was measured, how it turned rotors, how wakes stole energy, and how layouts were optimised to recover it. He understood, now, that every one of those chapters had been building toward this moment: a single number on a spreadsheet that a banker in London would use to decide whether a billion and a half euros of steel, copper, and concrete would be placed in the Baltic Sea.*

*"The P90 is not a prediction," Helena added, as though reading his thoughts. "It is a promise. A promise that even in a bad year — one year in ten — the wind farm will produce enough to pay its debts. Everything we have discussed today exists to support that promise."*

*She closed her laptop. "Next time I see you, Kaan, we will be talking about the things that hold these turbines up." She paused. "The foundations. The cables. The physical infrastructure that turns a spreadsheet into a power station. Because right now, everything we have discussed lives in a model. What happens next is engineering in the sea."*

*Kaan looked through the porthole behind him. The three turbine towers were still there, solid against the grey sky, their blades turning in the same unhurried rhythm as when he had first seen them from the CTV two weeks ago. But they were no longer mysterious machines standing in water. They were financial instruments that happened to be made of steel — each one a node in a network of physics, probability, and capital that stretched from the Baltic seabed to a bank vault in London. He understood, for the first time, that building a wind farm was not an engineering project that required financing. It was a financial project that required engineering.*

*Part III was complete. The wind had been understood — from the atmosphere's heat engine to the last decimal of the P90. What remained was to build the physical world that the models described: foundations driven into the seabed, cables buried beneath it, and a substation standing alone in the sea. That story would begin at dawn, three days later, when Kaan watched a hydraulic hammer drive the first monopile into the clay.*

---

## Notes

[1] IEC 61400-15-1:2025, "Wind energy generation systems — Part 15-1: Assessment of wind resource, energy yield and site suitability — Energy yield methodology." International Electrotechnical Commission. Published 14 March 2025. This standard, over a decade in development, provides the first international consensus framework for categorising energy-production losses and uncertainties in preconstruction energy yield assessments.

[2] Clifton, A., Smith, A., and Fields, M.J. (2016). "Wind Plant Preconstruction Energy Estimates: Current Practice and Opportunities." NREL/TP-5000-64735. National Renewable Energy Laboratory. DOI: 10.2172/1248798. Reviews preconstruction energy yield practices across the US wind industry, documenting loss predictions ranging from 9.5% to 22.5% across eight independent studies. Also: Clifton, A., Daniels, M.H., and Roadman, J. (2021). "An overview of wind-energy-production prediction bias, losses, and uncertainties." *Wind Energy Science*, 6, 311–365. DOI: 10.5194/wes-6-311-2021.

[3] Bleeg, J., Purcell, M., Ruber, R., Traiger, E., and Tanner, M. (2018). "Wind Farm Blockage and the Consequences of Neglecting Its Impact on Energy Production." *Energies*, 11(6), 1609. DOI: 10.3390/en11061609. First systematic quantification of farm-scale blockage, measuring 1.9–3.4% wind speed reduction upstream of large offshore farms. This finding led DNV to recommend a 2–3% blockage deduction in energy yield assessments.

[4] IEC 61400-26-1:2019, "Wind energy generation systems — Part 26-1: Availability for wind energy generation systems." Defines time-based availability indicators. IEC 61400-26-2:2014, Part 26-2, extends the framework to production-based (energy-based) availability. Also: DNV GL (2017). "Definitions of Availability Terms for the Wind Industry." White paper. Discusses the relationship between time-based and energy-based availability and recommends energy-based metrics for financial modelling.

[5] Scroby Sands and Kentish Flats availability data: BERR/DECC (2008). "UK Offshore Wind: Moving Forward." Department for Business, Enterprise and Regulatory Reform. Reports early UK offshore wind availability figures of 73.5–90.4% during the first years of operation, driven by gearbox failures, transformer faults, and weather-limited access.

[6] Significant wave height and offshore access: Fraunhofer IEE. "Wind Monitor — Wave Heights and Accessibility." Accessed 2025. Reports accessibility statistics for different Hs thresholds across European sea areas. Also: DNV-ST-0437:2016, "Loads and site conditions for wind turbines." Standard for site conditions including wave climate characterisation.

[7] Carroll, J., McDonald, A., and McMillan, D. (2016). "Failure rate, repair time and unscheduled O&M cost analysis of offshore wind turbines." *Wind Energy*, 19(6), 1107–1119. DOI: 10.1002/we.1887. Based on approximately 350 offshore turbines, reports overall failure rates of 8–10 per turbine per year, with major failures (25% of events) responsible for 95% of downtime. Gearbox and generator replacements require jack-up vessels at charter rates exceeding EUR 200,000/day.

[8] Inter-annual wind variability and cubic amplification: Pryor, S.C. and Barthelmie, R.J. (2010). "Climate Change Impacts on Wind Energy: A Review." *Renewable and Sustainable Energy Reviews*, 14(1), 430–437. DOI: 10.1016/j.rser.2009.07.028. Reports inter-annual coefficients of variation of 4–6% for annual mean wind speed at North Sea sites. Also: Brower, M.C. (2012). *Wind Resource Assessment: A Practical Guide to Developing a Wind Project.* John Wiley & Sons. Chapter 11: "Uncertainty Analysis."

[9] Monte Carlo methods for correlated AEP uncertainty: Drunsic, M. and Johnson, G. (2019). "A Monte Carlo-based Approach for Assessing the Annual Energy Production of Wind Power Plants." NREL/CP-5000-72233. National Renewable Energy Laboratory. Demonstrates that ignoring correlations between uncertainty sources underestimates total uncertainty by an average of 0.1% and up to 0.5% at individual sites. Recommends 10,000+ Monte Carlo iterations for convergence.

[10] Garrad Hassan founding and methodology: Garrad, A. (2012). "The Lessons Learned from the Development of the Wind Energy Industry That Might Be Applied to Marine Energy." *Philosophical Transactions of the Royal Society A*, 370(1959), 451–471. DOI: 10.1098/rsta.2011.0166. Also: Queen Elizabeth Prize for Engineering (2025). "Andrew Garrad CBE FREng." Citation: for pioneering the mathematical modelling and probabilistic assessment that enabled the commercialisation of wind energy.

[11] P90 and DSCR in project finance: Bodmer, E. (2023). "Wind P99, P90, P50 and Debt Sizing for 1-Year and 10-Year Periods." Edward Bodmer Financial Modelling. Also: WFO Global (2024). "Financing Offshore Wind — Part 9: Risk Assessment and P90." World Forum Offshore Wind. Reports typical DSCR requirements of 1.30–1.40 at P90 revenue for offshore wind project finance.

[12] Evolution of P90 as market standard: The P90 convention was adapted from oil-and-gas reserve classification (Society of Petroleum Engineers proved reserves = P90) for wind energy in the late 1980s–early 1990s. UK Non-Fossil Fuel Obligation (1990–1998) and US Production Tax Credit (Energy Policy Act of 1992) created the first significant markets for privately financed wind farms requiring independent energy yield assessments. Also: Garrad, A. (2013). "Garrad Hassan: 29 Years of Wind." Presentation at EWEA Conference, Vienna.

[13] Offshore wind CAPEX and OPEX: IRENA (2025). "Renewable Power Generation Costs in 2024." International Renewable Energy Agency, Abu Dhabi. Reports global weighted-average total installed cost of USD 2,852/kW, a 48% reduction from 2010. OPEX: BVG Associates (2019). "Guide to an Offshore Wind Farm." Updated for The Crown Estate and ORE Catapult. Chapter 9: "Operations and maintenance." Reports EUR 80,000–100,000/MW/yr for current European offshore projects.

[14] LCOE trends: IRENA (2025), ibid. Reports global weighted-average offshore LCOE of USD 0.079/kWh (EUR ~72/MWh) for 2024 commissioning, with Denmark at USD 0.053/kWh (EUR ~48/MWh) and Germany at USD 0.069/kWh (EUR ~63/MWh). Also: Lazard (2025). "Lazard's Levelised Cost of Energy Analysis — Version 18.0." June 2025. Reports unsubsidised offshore wind LCOE of USD 72–140/MWh.

[15] UK CfD allocation rounds: UK Department for Energy Security and Net Zero. CfD Allocation Round results, AR1 (2015) through AR6 (2024). AR3 (2019) achieved GBP 39.65/MWh (2012 prices), a >70% reduction from AR1. AR5 (2023) awarded zero offshore wind at a cap of GBP 44/MWh. AR6 (2024) awarded 4.9 GW at GBP 58.87/MWh. Also: Energy Voice (2025). "From AR1 to AR7: The UK Offshore Wind CfD Timeline."

[16] Hollandse Kust Zuid: Vattenfall (2022). "Hollandse Kust Zuid — First Power." Project documentation. 1.5 GW, 139 × SG 11.0-200 DD, 18–35 km offshore. Won with zero-subsidy bid in 2018 — the world's first subsidy-free offshore wind tender. Revenue secured through corporate PPAs.

[17] Polish offshore wind CfD: Republic of Poland, Energy Regulatory Office (2025). First offshore wind CfD auction, 17 December 2025. 3.4 GW awarded across three projects at strike prices of 476–492 PLN/MWh (~EUR 113–117/MWh) for 25-year contract terms. Also: Offshore Wind Biz (2025). "Poland Holds First Offshore Wind CfD Auction."

# Chapter 44: The Year One Report — LCOE, CfD, and the Cost of Making Electricity

*The CTV brought Helena Voss to the OSS on a Tuesday afternoon in early April.*

*Sixteen months after commercial operation, on a flat Baltic Sea under a pale spring sky, she was the last person from the project's founding team who had not yet stood on what they had built.*

*Kaan had been watching the vessel tracker since noon. The CTV left the harbour at 14:00 with six passengers: Helena, two insurance surveyors, a structural inspector, and two analysts whose names he did not recognise from the manifest. He met them at the access ladder. Helena was last off the bow platform. She put her laptop bag over one shoulder, gripped the handrail, and stepped from the vessel to the foundation access platform with the careful deliberateness of someone who was prepared to do this but not used to it.*

*On the way up the exterior staircase she did not speak. She was looking at the turbine array. Kaan had stopped noticing the view at around month two. He tried to see it through her eyes now: thirty-four machines turning slowly against a horizon of low cloud, their wakes just visible where the morning haze was still light, spaced far enough apart that the geometry of the array was only apparent from elevation. This was the three-hundredth time he had seen it. For her, the first.*

*She stopped at the upper deck rail for about twenty seconds.*

*"Right," she said. "Conference room."*

*The phrase was as close to wonder as Helena Voss's professional vocabulary permitted.*

*The conference room was smaller than she had apparently been imagining, from the brief pause before she sat down. She set her laptop bag on the table, connected to the display on the far wall, and spent a moment looking at the SCADA overview: thirty-four green turbine icons, the real-time power output climbing through 280 MW as the afternoon sea breeze strengthened.*

*Then she opened her laptop.*

*"I've had the operational report since Thursday," she said. "Good numbers. Let me tell you what they mean financially."*

*She pulled up the first tab on her spreadsheet. At the centre of the screen was a single number in a large font: EUR 89.50.*

*"The contract is in force," she said. "The question now is whether we are earning it."*

---

## 44.1 What It Costs to Make a Megawatt-Hour

Every power plant, from a nineteenth-century steam engine to a modern offshore wind farm, has the same fundamental economic structure: you spend money building it, you spend money running it, and then you divide what came out in kilowatt-hours into the total. The result is the levelised cost of energy — LCOE — the minimum long-run price at which electricity must be sold to cover all costs, including a required return on the capital invested.

The formula is deceptively simple. The difficulty is in the denominator.

$$
\text{LCOE} = \frac{I_0 + \displaystyle\sum_{t=1}^{T} \frac{M_t}{(1+r)^t}}{\displaystyle\sum_{t=1}^{T} \frac{E_t}{(1+r)^t}}
$$

where:
- $I_0$ = capital expenditure at time zero [EUR]
- $M_t$ = operating and maintenance cost in year $t$ [EUR/year]
- $E_t$ = electrical energy generated in year $t$ [MWh/year]
- $r$ = weighted average cost of capital (WACC) [fraction, per year]
- $T$ = project design life [years]

The reason the energy in the denominator must be discounted — treated the same way as costs in the numerator — is that a megawatt-hour produced in year 25 is worth less than a megawatt-hour produced this year, for the same reason that EUR 1,000 in your pocket today is worth more than EUR 1,000 promised twenty-five years from now. The discount rate captures both the time preference of money and the investor's required return given the project's risk. Failing to discount the denominator would produce an LCOE that becomes artificially low for long-lived assets simply because they run a long time — which would make a nuclear plant look cheaper than it is, and a gas turbine look more expensive than it is, whenever the comparison ignored timing.

The concept of levelising costs over a project's lifetime predates electricity entirely. Victorian-era railway engineers used the same logic to compare competing routes: a line through flat terrain required lower capital investment but higher maintenance per kilometre; a direct mountain route required tunnels and bridges but ran faster and earned more traffic. The question was always the same — what does one unit of service actually cost, properly accounting for everything, discounted to the present? The unit changed from passenger-kilometre to megawatt-hour. The mathematics did not.

What changed for offshore wind specifically was the trajectory of the answer. In 2010, the first credible LCOE estimates for large European offshore wind projects came in at EUR 130 to EUR 200 per megawatt-hour. The technology was new, the supply chain was thin, the installation costs were not yet understood at scale, and the turbines were small by the standards that would follow. The estimates looked daunting against average European wholesale electricity prices of EUR 40 to EUR 55 per megawatt-hour. Offshore wind was commercially viable only with substantial long-term price support.

By 2023, the same calculation for a well-located European offshore project produced an LCOE of EUR 55 to EUR 75 per megawatt-hour — a fifty to sixty-five percent reduction in thirteen years. For comparison, the Ford Model T fell in price by about seventy percent over twenty years of production; commercial air travel costs fell by roughly seventy-five percent over thirty years. Offshore wind LCOE fell by a similar magnitude in thirteen years, and the reduction did not stop at 2023. It is one of the fastest sustained cost reductions in the history of manufactured energy.

<!-- IMAGE: fig-44-01 -->
> **Figure 44.1** — Offshore Wind LCOE Trajectory, Europe, 2010–2024
> **Type:** Line chart
> **Content:** LCOE in EUR/MWh (y-axis, 0–200 range) vs year (x-axis, 2010–2024). Shaded range showing min–max estimates from IRENA, BloombergNEF, and NREL annual cost reports. Annotated project milestones: Horns Rev II (2009, EUR 140/MWh), London Array (2013, EUR 130/MWh), Borssele (2017, EUR 72/MWh), Hornsea 2 (2022, EUR 63/MWh). Declining trend line. Horizontal dashed lines for retail electricity price (EUR 120/MWh) and historical wholesale average (EUR 50/MWh). Grid parity crossing approximately 2022.
> **Caption:** European offshore wind LCOE fell from approximately EUR 150–200/MWh in 2010 to approximately EUR 55–80/MWh by 2024, driven by turbine scaling, supply chain maturation, and installation learning-curve effects. The crossing of the wholesale electricity reference price around 2022 marked the transition from a technology requiring long-term price support to one competitive on its own economics.
> **Alt text:** Line chart showing the declining trajectory of European offshore wind LCOE from approximately EUR 165/MWh in 2010 to approximately EUR 65/MWh in 2024, with annotated key project milestones and horizontal reference lines.
> **Data source:** IRENA Renewable Power Generation Costs 2023; BloombergNEF New Energy Outlook 2024
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Main trend line in navy; historic range in pale blue shading; milestone points in orange; reference price lines in dashed grey

The denominator — lifetime energy production — explains why wind speed matters so profoundly to project economics, and why the Weibull analysis from Chapter 9 and the wake loss calculations from Chapter 10 flow directly into every financial model. A ten percent improvement in wind speed produces, through the cubic relationship established in Chapter 5, approximately thirty percent more energy density — and therefore thirty percent more entries in the LCOE denominator. The revenue effect of that thirty percent arrives whether or not the developer planned for it. The capital cost in the numerator was already paid.

This asymmetry is the foundational structure of offshore wind project economics: costs are predominantly fixed and frontloaded; revenue is variable and spread over thirty years. The LCOE formula is the essential tool for comparing projects with different capital intensities and different wind resources on a common basis — and for asking the question that Helena Voss asks every project, every year: is the machine earning back what it cost?

---

## 44.2 The Contract for Difference

For a project with LCOE of EUR 64/MWh and a wholesale electricity market averaging EUR 50/MWh, the economics do not work in isolation. The project recovers its costs only if it can sell electricity at a price above the market average — reliably, for long enough to repay the debt and satisfy the equity investors. A project that sells purely into the spot market faces thirty years of price risk, which makes long-term bank debt nearly impossible to arrange: lenders cannot model the project's revenue with sufficient confidence to issue a creditworthy covenant package.

The Contract for Difference solves this problem by converting spot price risk into basis risk. Under a CfD, the project developer receives a guaranteed strike price for each megawatt-hour generated. If the market reference price in a given settlement period falls below the strike, the CfD counterparty — typically a government-designated low-carbon contracts body or the transmission system operator — pays the difference. If the market reference price rises above the strike, the project operator pays back the excess to the contract body. Either way, the project receives the strike price for its output.

$$
\text{Total revenue}_t = P_{\text{strike}} \cdot E_t
$$

$$
\text{CfD top-up}_t = \max\!\bigl(0,\; (P_{\text{strike}} - P_{\text{ref},t}) \cdot E_t\bigr)
$$

$$
\text{CfD clawback}_t = \max\!\bigl(0,\; (P_{\text{ref},t} - P_{\text{strike}}) \cdot E_t\bigr)
$$

where:
- $P_{\text{strike}}$ = CfD strike price [EUR/MWh]
- $P_{\text{ref},t}$ = market reference price in period $t$ [EUR/MWh]
- $E_t$ = energy generated in period $t$ [MWh]

The CfD is bilateral — not a subsidy in the sense of a one-way transfer from government to industry, but a price-fixing contract that flows in either direction depending on market conditions. This distinction matters more than it might seem. When European wholesale electricity prices spiked during the 2021–2022 energy crisis, reaching EUR 200 to EUR 400 per megawatt-hour in some settlement periods, projects operating under CfDs with strike prices below those elevated market reference prices were required to pay back the difference. Large European renewable generators — Ørsted, Vattenfall, RWE, and others — returned hundreds of millions of euros to their respective CfD contract bodies during 2022. The instrument worked exactly as designed: in both directions.

The first competitive tender for offshore wind in Europe that operated on CfD-equivalent principles was the 2000 Danish tender for Horns Rev I — 160 MW in water depths of six to fourteen metres off the west coast of Jutland. The winning consortium of Elsam and DONG Energy was awarded a guaranteed total price of approximately DKK 0.45 per kilowatt-hour for the first 42,000 full-load hours — equivalent to approximately EUR 60 per megawatt-hour at 2000 exchange rates — combining an electricity market price with a renewable certificate premium under the Danish Energy Agreement. At the time, most analysts expected offshore wind to cost EUR 70 to EUR 90 per megawatt-hour in operation; the Elsam-DONG tender was regarded as aggressively competitive. The competitive tender model it demonstrated — government-set price support, developer-bid quantity — has since become the standard procurement mechanism for offshore wind across Europe.[^1]

The UK formalised the CfD mechanism in the Energy Act 2013, replacing the Renewables Obligation certificate system with a direct contract framework administered by the Low Carbon Contracts Company. The first CfD allocation round in 2014–2015 awarded offshore wind contracts at strike prices of approximately £114 to £120 per megawatt-hour — a price that reflected the technology's cost basis at the time and was widely described as high for a long-term government commitment. By the second allocation round in 2017, Ørsted's Hornsea Project Two — 2.4 GW, the largest offshore wind project then awarded — was contracted at £57.50 per megawatt-hour, already a dramatic reduction from AR1. The third allocation round in 2019 pushed prices further still: Ørsted's Hornsea Project Three and Triton Knoll were awarded at £41.61 per megawatt-hour; SSE's Sofia at £39.65 per megawatt-hour — a more than sixty-five percent reduction from AR1 in four years. In the fifth allocation round in 2023, the administrative strike price cap had not been updated to reflect post-2021 supply chain inflation, and no offshore wind projects submitted bids. The government revised the reference prices upward for Allocation Round 6 in 2024, and offshore wind returned to the auction — still at prices below the AR1 clearing level in nominal terms, despite inflation, supply chain disruption, and twelve years of capital cost growth in between.[^2]

<!-- IMAGE: fig-44-02 -->
> **Figure 44.2** — CfD Mechanism: Two Market Scenarios
> **Type:** Side-by-side bar chart pair
> **Content:** Left scenario (low market): strike price EUR 89.50/MWh, market reference EUR 68.80/MWh — bars showing market revenue (EUR 68.80/MWh portion, blue), CfD top-up (EUR 20.70/MWh, green), total = EUR 89.50/MWh. Right scenario (high market): strike price EUR 89.50/MWh, market reference EUR 130/MWh — bars showing market revenue (EUR 89.50/MWh effective, capped at strike), CfD clawback (EUR 40.50/MWh returned, red). Both scenarios show effective project revenue of EUR 89.50/MWh.
> **Caption:** Under a Contract for Difference, the project receives the strike price regardless of wholesale market conditions. In low-price periods (left), the CfD body pays the top-up. In high-price periods (right), the project returns the excess. The instrument eliminates wholesale price risk over the CfD term but does not eliminate the market after the CfD expires.
> **Alt text:** Side-by-side bar chart illustrating the Contract for Difference payment mechanism under below-strike and above-strike market price conditions, showing that effective project revenue equals EUR 89.50/MWh in both cases.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Market revenue in blue; CfD top-up in green; CfD clawback in red; strike price line as horizontal dashed orange

Poland's equivalent of the CfD operates under the Act on Renewable Energy Sources, administered through energy auctions run by the President of the Energy Regulatory Office (URE). Under the Polish OZE system, renewable generators bid in competitive auctions for fifteen-year support contracts; the winning price becomes the reference price against which market settlements are calculated. The first dedicated offshore wind auction under the Polish post-2021 framework was held in 2023, with support prices for Baltic Sea projects in the range of PLN 280 to PLN 330 per megawatt-hour — approximately EUR 63 to EUR 75 per megawatt-hour at prevailing exchange rates. For projects of this farm's scale and investment vintage, the negotiated bilateral contract — a contract for difference against the Polish Day-Ahead Market reference price — reflected a slightly higher strike price than the 2023 competitive clearing prices, consistent with the cost basis at the time of financial close in 2022.

The strike price at the centre of this farm's CfD was EUR 89.50 per megawatt-hour. Fixed at contract signature in 2022, it would remain fixed in nominal terms for fifteen years from commercial operation.

---

## 44.3 Year One: Revenue and the First Test of the Numbers

Year One production: 2,306 GWh.

The P50 projection from the resource assessment of Chapter 9 — the central estimate around which the project had been designed and financed — was 2,200 GWh. The Year One result was 4.8 percent above P50, placing it comfortably in the upper half of the probability distribution, well clear of the P75 threshold used in the stress-tested financial model, and not far below the P25 level.

Two things drove the outperformance. The first was the wind resource: the North Atlantic Oscillation index for the measurement year was positive, bringing stronger-than-average westerly flow across the Baltic and pushing measured hub-height wind speeds approximately three percent above the long-term mean. Through the cubic power relationship from Chapter 5, three percent more wind produces roughly nine percent more power density — moderated in practice because the turbines operated at rated power for much of the additional wind energy, limiting the P-curve response above 12.5 m/s. The second was availability: 97.97 percent TBA and 98.66 percent PBA, both above the 97.0 percent TBA assumed in the base-case model. The T17 January bearing event, which cost the farm 0.09 percentage points of TBA and EUR 210,600, was visible in the January bar of the monthly production profile — but the farm's reserve management and the fair-weather recovery in February had contained the impact within normal variation.

Year One revenue:

$$
R_{\text{Y1}} = P_{\text{strike}} \cdot E_{\text{Y1}} = \text{EUR}\;89.50/\text{MWh} \times 2{,}306{,}000\;\text{MWh} = \text{EUR}\;206.4\;\text{M}
$$

The average Polish Day-Ahead Market reference price over the twelve-month settlement period was EUR 68.80 per megawatt-hour, which is below the EUR 89.50 strike. The farm received:

- Market revenue at reference price: EUR 68.80 × 2,306,000 MWh = EUR 158.7 M
- CfD top-up payment: (EUR 89.50 − EUR 68.80) × 2,306,000 = EUR 47.7 M
- **Total Year One revenue: EUR 206.4 M** ✓

Had the market reference price exceeded EUR 89.50 per megawatt-hour — as it did across much of Europe in 2022 — the project would have returned the excess to the Polish OZE contract body. The EUR 89.50 strike price locked the revenue regardless. For the lenders who had financed EUR 1,110 M of the project's EUR 1,479 M capital cost, this revenue structure — predictable, CfD-secured — was precisely the architecture they had required before committing long-term debt.

<!-- IMAGE: fig-44-03 -->
> **Figure 44.3** — Year One Monthly Production vs P50 and P90 Projections
> **Type:** Bar chart with overlay line
> **Content:** Monthly AEP bars (actual, Jan–Dec) in blue. P50 monthly average as horizontal dashed orange line segment per month. P90 monthly lower envelope as dashed grey. Bar heights show actual above P50 in 8 of 12 months; winter months (Dec–Feb) show strongest performance; summer (Jul–Aug) slightly below P50. January bar noticeably reduced (T17 forced outage, annotated). Annual total on right axis.
> **Caption:** Year One monthly production against P50 and P90 projections. The farm exceeded P50 in eight of twelve months, driven by above-average winter westerlies and high availability. The January dip reflects the T17 bearing forced outage documented in Chapter 43.
> **Alt text:** Bar chart of Year One monthly actual production versus P50 and P90 projections, showing consistent above-P50 performance with a visible reduction in January from the T17 forced outage.
> **Data source:** Author illustration based on IEC 61400-26 availability methodology
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Actual bars in medium blue; P50 line in orange; P90 boundary in dashed grey; T17 outage annotated in red

---

## 44.4 LCOE — The Single Number

The LCOE calculation for this project requires three inputs, each with a different update cadence: the capital expenditure (fixed at close of project financing in 2022), the operating costs (updated from Year One actual experience), and the lifetime energy production estimate (revised from Year One performance and the updated long-term wind resource model).

**Capital expenditure:** EUR 1,479 M, comprising the component cost totals established across Chapters 13 to 15 and the OSS infrastructure from Part V: foundations EUR 316 M (21.4%); array and export cables EUR 145 M (9.8%); installation campaigns EUR 237 M (16.0%); turbine supply EUR 612 M (41.4%); offshore substation EUR 85 M (5.7%); balance of plant, development costs, and contingency EUR 84 M (5.7%).

**Weighted average cost of capital:** 7.2 percent post-tax nominal, comprising seventy-five percent senior debt at 4.5 percent and twenty-five percent equity at a 12.0 percent target return. The after-tax cost of debt incorporates the corporate interest tax shield at the Polish corporation tax rate of 19 percent:

$$
\text{WACC} = w_d \cdot k_d \cdot (1 - T_c) + w_e \cdot k_e = 0.75 \times 4.5\% \times (1-0.19) + 0.25 \times 12.0\% = 2.73\% + 3.00\% = 5.73\%
$$

where:
- $w_d, w_e$ = debt and equity weights [fraction]
- $k_d, k_e$ = pre-tax cost of debt and cost of equity [fraction]
- $T_c$ = corporate income tax rate [fraction]

The 5.73 percent post-tax WACC is the rate at which future cash flows are discounted in the LCOE denominator. When LCOE is computed on a nominal (money-of-the-day) basis — which is the IRENA convention and the convention used here — the discount rate is the nominal WACC, and both costs and energy must be expressed in nominal terms. Costs escalate at approximately 2.0 percent per year with general inflation; production-based energy declines at approximately 0.3 percent per year from component ageing.

**NPV of 30-year operating costs** (EUR 15.0 M/year base, escalating at 2.0 percent per year, discounted at WACC):

The present value of a growing annuity at base payment $M_1$, growth rate $g$, and discount rate $r$ over $T$ periods is:

$$
\text{NPV}(M) = M_1 \cdot \frac{1 - \left(\frac{1+g}{1+r}\right)^T}{r - g} = 15.0 \times \frac{1 - \left(\frac{1.020}{1.0573}\right)^{30}}{0.0573 - 0.020} = 15.0 \times 14.93 = \text{EUR}\;223.9\;\text{M}
$$

**NPV of 30-year P50 energy production** (2,200 GWh/year base, declining at 0.3 percent per year):

$$
\text{NPV}(E) = 2{,}200 \times \frac{1 - \left(\frac{0.997}{1.0573}\right)^{30}}{0.0573 + 0.003} = 2{,}200 \times 11.98 = 26{,}361\;\text{GWh-equivalent}
$$

**Total NPV of costs:**

$$
\text{NPV}(\text{costs}) = I_0 + \text{NPV}(M) = 1{,}479 + 223.9 = \text{EUR}\;1{,}702.9\;\text{M}
$$

**LCOE:**

$$
\text{LCOE} = \frac{\text{EUR}\;1{,}702.9\;\text{M}}{26{,}361\;\text{GWh-eq}} = \text{EUR}\;64.6\;/\text{MWh}
$$

The CfD strike price of EUR 89.50/MWh exceeds this LCOE by EUR 24.90 per megawatt-hour — the project's gross margin per unit of output before financing costs and tax, which must also be covered by the same spread. The LCOE of EUR 64.6/MWh is below the current market reference price of EUR 68.80/MWh, which means the farm is commercially viable at current market prices even without the CfD. This is the structural transition in offshore wind economics that occurred between approximately 2020 and 2024: when LCOE fell below the wholesale price, the CfD evolved from an instrument of viability into an instrument of revenue stability and financing assurance.

> **Standard reference:** IRENA (2023). *Renewable Power Generation Costs in 2023*. International Renewable Energy Agency, Abu Dhabi. Chapter 2 provides the offshore wind LCOE methodology including WACC parameterisation by market type, degradation rates, and O&M cost escalation assumptions used in international comparisons. The 2023 global weighted-average offshore wind LCOE is reported at USD 84/MWh (≈ EUR 77/MWh); European projects achieved EUR 60–75/MWh. The IRENA methodology uses nominal WACC, escalating costs, and declining production — consistent with this chapter's treatment.

---

## 44.5 DSCR and Equity Return — What the Lenders and Investors Saw

The senior lenders who provided EUR 1,110 M of project financing required a minimum annual debt service coverage ratio (DSCR) of 1.20x throughout the seventeen-year debt term. The base-case P50 model projected 1.74x; the conservative P90 case projected 1.44x. Both were above the covenant floor.

The DSCR measures the project's ability to service its debt from operating cash flow:

$$
\text{DSCR}_t = \frac{\text{CFADS}_t}{\text{DS}_t}
$$

where:
- $\text{CFADS}_t$ = cash flow available for debt service in year $t$: operating revenue minus operating costs, before principal and interest payments [EUR]
- $\text{DS}_t$ = annual debt service in year $t$: scheduled principal repayment plus interest payment [EUR]

The debt was structured as EUR 1,110 M at 4.5 percent per annum, amortising over seventeen years from commercial operation on an annuity basis. Annual debt service:

$$
\text{DS} = \frac{k_d \cdot D}{1 - (1 + k_d)^{-n}} = \frac{0.045 \times 1{,}110}{1 - (1.045)^{-17}} = \frac{49.95}{0.513} = \text{EUR}\;97.4\;\text{M per year}
$$

where:
- $k_d$ = annual interest rate [fraction]
- $D$ = original principal [EUR]
- $n$ = amortisation term [years]

**Year One DSCR calculation:**

| Item | EUR M |
|------|-------|
| Year One revenue | 206.4 |
| O&M cost (from Ch 43) | −12.3 |
| Insurance and lease | −4.8 |
| Management fees and overhead | −1.2 |
| **CFADS** | **188.1** |
| Annual debt service | −97.4 |
| **Post-DS cash flow** | **90.7** |

$$
\text{DSCR}_{\text{Y1}} = \frac{188.1}{97.4} = 1.93
$$

The Year One DSCR of 1.93 was above the base-case projection of 1.74, above the P90 covenant test of 1.44, and sixty percent above the minimum covenant of 1.20. Three factors drove the positive variance: above-P50 wind (the largest contribution), below-budget operating costs (EUR 18.3 M actual versus EUR 20.0 M budget), and favourable exchange rates on non-euro cost elements.

The lenders' institutional response to a DSCR of 1.93 is no response at all. "They only speak to us when the number is wrong," Helena told Kaan. The covenant machinery operates entirely through breach, not through compliance. A DSCR above 1.20 produces nothing visible. That silence is itself the signal.

For the equity investors, the relevant metric is not the DSCR but the equity internal rate of return — the discount rate at which the net present value of all equity cash flows equals zero:

$$
\sum_{t=0}^{T} \frac{\text{FCF}_{\text{equity},t}}{(1 + \text{IRR}_e)^t} = 0
$$

where:
- $\text{FCF}_{\text{equity},t}$ = free cash flow to equity: CFADS minus debt service, minus tax payments [EUR]
- $\text{IRR}_e$ = equity internal rate of return [fraction]

At financial close, the base-case equity IRR was modelled at 11.5 percent on the EUR 369 M equity contribution. Year One outperformance, extrapolated over the remaining project life using the revised resource model, shifted the equity IRR projection upward to 12.3 percent — a 0.8 percentage-point improvement representing approximately EUR 38 M of additional present-value equity return.[^3]

<!-- IMAGE: fig-44-04 -->
> **Figure 44.4** — Financial Metrics: Base Case, P90, and Year One Actual
> **Type:** Multi-panel comparison chart (3 panels)
> **Content:** Panel 1 (capital structure): stacked bar showing equity EUR 369M (25%, teal) and senior debt EUR 1,110M (75%, navy). Panel 2 (DSCR): grouped bars for minimum covenant (1.20, red line), P90 case (1.44), base-case P50 (1.74), Year One actual (1.93). Panel 3 (equity IRR): grouped bars for cost of equity hurdle (10%, red line), base-case IRR (11.5%), Year One updated projection (12.3%).
> **Caption:** Year One financial metrics against base-case projections, P90 covenant test, and performance thresholds. The DSCR of 1.93 represents 60% headroom above the minimum covenant; the equity IRR update to 12.3% represents 80 basis points above the base-case model.
> **Alt text:** Three-panel chart comparing project capital structure, DSCR variants, and equity IRR variants, showing Year One actual performance above all base-case projections.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Debt in navy, equity in teal; DSCR bars in graduating blue; Year One bars with hatching; minimum/hurdle lines in red

---

## 44.6 Worked Example — The Year One Financial Pipeline

**Starting data:** Year One operational results (from Chapter 43)

| Input | Value |
|-------|-------|
| Actual AEP | 2,306 GWh |
| TBA | 97.97% |
| PBA | 98.66% |
| Total operating costs | EUR 18.3 M |

---

**Step 1: Revenue**

Market reference price (Year One average): EUR 68.80/MWh

Since EUR 68.80 < strike price EUR 89.50, the CfD pays the difference:

$$
R_{\text{Y1}} = P_{\text{strike}} \times E_{\text{Y1}} = 89.50 \times 2{,}306{,}000 = \text{EUR}\;206.4\;\text{M}
$$

Market revenue: EUR 68.80 × 2,306,000 = EUR 158.7 M
CfD top-up: EUR 20.70 × 2,306,000 = EUR 47.7 M
Total: EUR 206.4 M ✓

---

**Step 2: Cash Flow Available for Debt Service**

$$
\text{CFADS} = R - \text{OPEX} = 206.4 - 18.3 = \text{EUR}\;188.1\;\text{M}
$$

---

**Step 3: DSCR**

$$
\text{DSCR}_{\text{Y1}} = \frac{188.1}{97.4} = 1.93 \quad \text{(covenant: 1.20, base case: 1.74)}
$$

---

**Step 4: Tax**

| Item | EUR M |
|------|-------|
| CFADS | 188.1 |
| Less: interest on debt (EUR 1,110 M × 4.5%) | −50.0 |
| EBIT | 138.1 |
| Less: tax depreciation (EUR 1,479 M ÷ 25 yrs) | −59.2 |
| Taxable income | 78.9 |
| Tax at 19% CIT | 15.0 |
| **Net income after tax** | **63.9** |

---

**Step 5: Free Cash Flow to Equity**

$$
\text{FCF}_{\text{equity}} = \text{CFADS} - \text{DS} - \text{Tax} = 188.1 - 97.4 - 15.0 = \text{EUR}\;75.7\;\text{M}
$$

Simple Year One return on equity: EUR 75.7 M / EUR 369 M = **20.5%** (single-year cash yield, not IRR)

The 20.5% single-year yield is not the equity IRR. It reflects one above-P50 year on an investment whose full return is determined by thirty years of cash flows. The long-run equity IRR of 12.3% distributes the EUR 369 M investment across all future cash flows — including years of average wind, OPEX escalation, and the uncertain post-CfD merchant tail.

---

**Step 6: LCOE vs Revenue Summary**

| Metric | Value |
|--------|-------|
| CAPEX | EUR 1,479 M |
| NPV of 30-year OPEX (WACC 5.73%) | EUR 224 M |
| Total NPV of costs | EUR 1,703 M |
| NPV of 30-year P50 AEP (WACC 5.73%, −0.3%/yr degradation) | 26,361 GWh-eq |
| **LCOE** | **EUR 64.6/MWh** |
| CfD strike price | EUR 89.50/MWh |
| Year One market reference price | EUR 68.80/MWh |
| LCOE margin vs CfD | EUR 24.9/MWh |
| LCOE margin vs market | EUR 4.2/MWh |

The EUR 4.2/MWh margin against the current market reference price is thin. It illustrates why the post-CfD merchant period — years 16 to 30, when the EUR 89.50 strike price expires and the project earns whatever the market pays — carries residual price risk that no contract can eliminate for the asset's full life. The base-case financial model assumed EUR 75/MWh for the post-CfD period. If the market clears lower, equity absorbs the shortfall. If it clears higher — and the energy transition's effect on long-run power prices is genuinely uncertain — equity captures the upside. The lenders bear none of this risk; their debt matures at year seventeen, well within the CfD term.

---

**Step 7: 30-Year Revenue Projection**

| Period | AEP (P50 basis) | Effective Price | Nominal Revenue |
|--------|----------------|-----------------|-----------------|
| CfD: Years 1–15 | 2,200 GWh/yr | EUR 89.50/MWh (fixed) | EUR 2,953 M |
| Post-CfD: Years 16–30 | ~2,134 GWh/yr (−0.3%/yr) | EUR 75.00/MWh (assumed) | EUR 2,401 M |
| **30-year total** | | | **EUR 5,354 M** |

EUR 5,354 M lifetime revenue against EUR 1,703 M NPV of total costs (at WACC) implies a net present value of approximately EUR 900 M — the economic surplus generated above and beyond the required return on all capital.

---

## Key Takeaways

- **LCOE is the minimum long-run price at which electricity must be sold to cover all costs, including return on invested capital, properly discounted over the project life.** For this farm, LCOE = EUR 64.6/MWh — below both the CfD strike price (EUR 89.50/MWh) and the current market reference price (EUR 68.80/MWh). The project is financially viable under the CfD and marginally commercially viable without it at current wholesale prices.

- **The Contract for Difference is bilateral — it fixes price in both directions.** The top-up flows from government to project when market prices are below strike; the clawback flows from project to government when market prices are above strike. Projects operating under CfDs during the 2021–2022 European energy price crisis paid back substantial sums to their contract counterparties. The CfD provides revenue stability and enables project finance; it does not provide a guaranteed profit.

- **The DSCR is the lender's primary annual health indicator, and lenders communicate only through breach.** Year One DSCR of 1.93 was 60% above the 1.20 minimum covenant and above the base-case projection of 1.74. Below 1.20, covenants trigger, conversations happen, and remedies are imposed. Above 1.20, the financial structure runs silently.

- **Equity IRR and project LCOE answer different questions.** LCOE answers whether the project's output covers its full costs — it is a per-unit cost metric independent of capital structure. Equity IRR answers whether the equity tranche, leveraged by senior debt, earns above its cost of capital. A project can have a low LCOE (efficient cost of production) and a high equity IRR (because cheap debt amplifies equity returns) simultaneously. The distinction matters for evaluating whether to invest versus whether to build.

- **Year One data updates the model but does not prove it.** One year above P50 is encouraging evidence that the resource assessment was sound, but it is a single point on a thirty-year probability distribution. The P50/P90 framework from Chapter 12 governs lifetime outcomes, not individual years. The financial model must be re-run against actuals annually for the project's full operating life.

---

## For Further Reading

- **IRENA (2023).** *Renewable Power Generation Costs in 2023.* International Renewable Energy Agency, Abu Dhabi. ISBN 978-92-9260-559-0. Available at www.irena.org/publications. The most comprehensive annual benchmark for LCOE across all renewable technologies. Chapter 2 covers offshore wind methodology (WACC assumptions, degradation rates, O&M escalation), regional data, and the global weighted-average LCOE trajectory. Table 2.4 provides per-country breakdowns for European offshore wind. The IRENA datasets are downloadable and widely used as the reference baseline in academic and policy analysis.

- **Stehly, T., & Beiter, P. (2020).** *2019 Cost of Wind Energy Review.* NREL Technical Report TP-5000-78471. National Renewable Energy Laboratory, Golden, CO. DOI: 10.2172/1756710. A full decomposition of offshore wind LCOE into component contributions (turbine supply, foundations, installation, electrical infrastructure, operations) with sensitivity analysis showing which drivers account for the largest LCOE uncertainty. Appendix B provides a tornado chart identifying wind speed and net capacity factor as the dominant LCOE drivers, followed by CAPEX and WACC. The 2019 data predates the post-2021 supply chain disruption but the decomposition methodology is authoritative and transferable.

- **Green, R., & Vasilakos, N. (2010).** "Market behaviour with large amounts of intermittent generation." *Energy Policy*, 38(7), pp. 3211–3220. DOI: 10.1016/j.enpol.2009.07.038. The foundational paper on the merit-order effect: as zero-marginal-cost renewable generation enters the market, it suppresses wholesale prices for all generators. For CfD-contracted projects, this matters in the opposite direction from what intuition suggests: lower market reference prices increase the CfD top-up payment from the contract body, not the project's revenue. For post-CfD merchant revenues, however, high renewable penetration poses a structural long-run price risk. The 2010 analysis modelled twenty percent renewable penetration; modern systems operating at forty to sixty percent face the same mechanism at a scale not yet empirically validated.

---

*Helena closed the Year One summary tab. She did not close the spreadsheet.*

*"Good Year One," she said. Coming from Helena Voss, those three words were the full sentence. The financial equivalent of a period.*

*She scrolled to the next tab — Year Two sensitivity — and walked through three scenarios in twenty minutes: base case (P50 wind, EUR 20 M OPEX), downside (P90 wind, EUR 22 M OPEX), and stress test (P90 wind, EUR 26 M OPEX, market reference EUR 40/MWh, extended T-transformer outage for six months). Even the stress test cleared a DSCR of 1.26.*

*"The project is robust," she said. Not as a compliment. As a mathematical description.*

*The meeting broke for coffee at seventeen hundred. Kaan stood at the conference room window with his mug and looked at the SCADA overview: thirty-four green icons, 341 MW, northwest wind at 9.8 metres per second. He had watched this screen for sixteen months. He knew what each number meant in engineering terms — the rotating mass behind it, the converter topology, the control loop holding it steady.*

*He was beginning to understand what it meant in financial terms as well. EUR 341,000 per hour. EUR 89.50 for every megawatt-hour that crossed the metering point and entered the Polish grid.*

*Erik Svensson came in with a print-out. "T17 bearing signature is shifting," he said. "Vibration frequency distribution. Early. Four months before it becomes unambiguous. Plenty of time for a summer window."*

*"Replacement cost, planned?" Helena said from behind her laptop, without looking up.*

*"EUR 15,200. June window, normal sea state, scheduled crew."*

*Helena typed something. "And emergency, winter?"*

*"EUR 210,600. Our data. January."*

*She looked at the number on her screen. "Fourteen-to-one return on the monitoring investment. What's generating the early warning?"*

*Erik looked at Kaan. "SCADA historian and a basic vibration algorithm. We need better resolution to distinguish a real fault precursor from calibration drift. Better sensors, higher sample rate, a model that learns the machine's individual signature."*

*Kaan had been waiting for someone to say that sentence in Helena's presence since January. "There's a digital twin specification," he said. "I can have an outline by Thursday."*

*Helena nodded once. "Show me the payback calculation when it's ready."*

*She closed her laptop — not the spreadsheet, just the lid — and looked out at the turbine array for the first time since they had entered the conference room. The afternoon light was going, and the machines were tall dark forms against a pale sky, turning slowly.*

*The Year One report told what the machines had produced. It did not tell what was happening inside them — the slow accumulation of fatigue, the frequency patterns in bearing vibration that preceded failure by four months, the invisible degradation that would convert today's 98.66 percent availability into tomorrow's forced outage if no one was watching carefully enough.*

*The financial model was a projection built on physics. The digital twin would be physics under continuous observation.*

*Kaan opened a new notebook page. At the top he wrote: "What does the turbine know about itself that the SCADA system doesn't know yet?"*

*He did not yet know the answer. But he knew the question was worth the next chapter.*

---

## Notes

[^1]: Danish Energy Agency (2000). *Havvindmølleparken Horns Rev: Tender for Establishment and Operation.* Danish Energy Agency, Copenhagen. The guaranteed price structure for Horns Rev I under the Danish Electricity Reform Agreement of 1999 combined an electricity market price with a renewable electricity premium certificate (VE-bevis) for the first 42,000 full-load operating hours, yielding an effective all-in guaranteed price of approximately DKK 0.45/kWh (≈ EUR 60/MWh at 2000 DKK/EUR rates). The competitive tender was won by the Elsam–DONG Energy consortium; commercial operation commenced in December 2002. The project comprised 80 × Vestas V80-2MW turbines at a site 14 to 20 km west of Blåvandshuk, Jutland, in water depths of 6 to 14 metres, with a total construction cost of approximately DKK 2.1 billion. Vattenfall acquired operational ownership from DONG Energy in 2013. The Horns Rev I procurement model — competitive tender for a government-administered price guarantee, with a private developer taking wind resource and operational risk — became the template for subsequent European offshore wind procurement frameworks including the UK CfD allocation rounds, German offshore wind tenders, and the Polish OZE offshore auction system.

[^2]: UK Department for Energy Security and Net Zero (2024). *CfD Allocation Round 6 Results.* DESNZ, London. The AR1 (2014–2015) offshore wind clearing prices ranged from approximately £114 to £120/MWh. AR2 (2017): Ørsted's Hornsea Project Two, 2.4 GW, was awarded at £57.50/MWh — at the time the largest single offshore wind CfD award by capacity. AR3 (2019): Ørsted's Hornsea Project Three and Triton Knoll at £41.61/MWh; SSE's Sofia Offshore Wind Farm at £39.65/MWh. Allocation Round 5 (2023) set the offshore wind administrative strike price cap at £44/MWh, which was below the cost recovery threshold for projects facing post-2021 supply chain inflation; no offshore wind projects submitted bids. The UK Government revised the AR6 offshore wind maximum strike price substantially upward for the 2024 round. The reduction from approximately £117/MWh (AR1) to £39.65/MWh (AR3) — sixty-six percent in four years — is the most-cited illustration of offshore wind cost reduction at scale. The AR5 failure and AR6 correction illustrate the sensitivity of CfD clearing to administrative price-cap calibration.

[^3]: The equity IRR calculation uses the discounted cash flow model described in IFC (2015), *A Guide to the Project Finance of Renewable Energy*, International Finance Corporation, Washington DC. The base-case equity IRR of 11.5% was the project's internal target at financial close; the 12.3% projection update is derived from rerunning the equity cash flow model using Year One actual revenue, Year One actual OPEX, and the revised long-term resource estimate incorporating the Year One above-P50 measurement. The 12.3% figure represents a scenario estimate; actual equity IRR will not be determined until project end at year 30. The cost-of-equity hurdle rate of 10% reflects the specific risk premium over the risk-free rate applicable to a contracted offshore wind project with CfD revenue and investment-grade lenders.

[^4]: IRENA (2023). *Renewable Power Generation Costs in 2023.* International Renewable Energy Agency, Abu Dhabi. ISBN 978-92-9260-559-0. Table 2.4 reports European offshore wind LCOE range for projects commissioning in 2022–2023: EUR 60–80/MWh for fixed-bottom projects in established markets (UK, Denmark, Netherlands, Germany, Belgium), with Baltic Sea projects at the lower end due to consistently strong winds and shallow-to-moderate water depths. The global weighted-average offshore wind LCOE declined from USD 275/MWh in 2010 to USD 84/MWh in 2023, a seventy percent reduction. The period 2020–2023 showed a temporary increase (approximately fifteen percent above the 2020 value) driven by supply chain inflation before resuming decline in 2023–2024 as supply chains normalised and turbine scales continued to increase.

[^5]: Green, R., & Vasilakos, N. (2010). "Market behaviour with large amounts of intermittent generation." *Energy Policy*, 38(7), pp. 3211–3220. DOI: 10.1016/j.enpol.2009.07.038. The merit-order effect predicted in this paper has been empirically confirmed in multiple European electricity markets: in Germany (Würzburg/Cludius study, 2014), Denmark (Ravn et al., 2015), and Spain (Gelabert et al., 2011). The effect size at fifty percent or higher renewable penetration is an active area of research; market design responses including energy storage, demand flexibility, and interconnector capacity affect the magnitude and distribution of the price suppression effect in ways not fully captured by the original model.

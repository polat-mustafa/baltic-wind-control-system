# Chapter 11: Layout Optimization: Placing Thirty-Four Turbines on a Patch of Sea

*The engineering office on the SOV's upper deck was smaller than Kaan had expected — two desks, four monitors, a whiteboard covered in marker scrawls that nobody had wiped, and a window that looked out over the port side where three turbines stood in a line, their blades turning in easy synchrony. Anders had told him to be here at eight o'clock on Day 6. When Kaan arrived, the woman at the larger desk was already deep in a screen full of coloured dots and contour lines.*

*"Signe, this is Kaan," Anders said from the doorway. "He has spent the last five days learning why those turbines produce less power than they should. Now he wants to know how you decided where to put them."*

*Signe Vestergaard turned her chair and regarded Kaan with the appraising look of someone who had been interrupted mid-thought. She was in her early forties, sharp-featured, with reading glasses pushed up into short blonde hair and a mug of black coffee that had clearly been refilled more than once. Her desk held two monitors: the left one showed a map of the wind farm's lease area with thirty-four turbine positions marked as circles, each one surrounded by a pale blue halo that Kaan assumed represented a wake zone. The right monitor displayed a graph — hundreds of dots climbing unevenly toward an asymptote, like a stock price that could not quite reach a ceiling.*

*"You are the one Anders has been educating on the observation deck," she said. It was not a question. Her English was precise, with the flat vowels of a Dane who had spent years in international project rooms. "Did he tell you the chess analogy?"*

*"He said it was like a chess problem where the pieces interact through physics."*

*Signe smiled faintly. "That is close enough. Except in chess, there are sixty-four squares and well-defined rules. In layout optimisation, the board is a polygon with exclusion zones, the pieces generate wake fields that change with wind speed and direction, every cable you draw between them costs money, and the game lasts thirty years." She tapped the left monitor. "This is what I do. I find the positions for these thirty-four turbines that make the most energy for the least cost, while respecting every constraint that nature, regulation, and engineering impose on the design." She tapped the right monitor. "And this is how I know when I have found a good answer — though never the best one. The best one does not exist. There is only better."*

*Kaan pulled up a chair.*

---

## 11.1 The Layout Problem: What Are We Optimizing?

The wind farm layout optimization problem — abbreviated WFLOP in the academic literature — is deceptively simple to state: given a defined area, a set of turbines, and a model of the wind resource, find the turbine positions that optimize an objective function subject to a set of constraints. The difficulty lies in every word of that sentence.

The most common objective function is to maximise the net annual energy production (AEP) of the wind farm. Using the wake models from Chapter 10 and the wind resource characterisation from Chapters 8 and 9, the net AEP for a farm of $N$ turbines is:

$$
\text{AEP} = 8{,}760 \sum_{j=1}^{N_\theta} \sum_{k=1}^{N_v} f_{jk} \sum_{i=1}^{N} P_i(v_k, \theta_j, \mathbf{x})
$$

where:
- $\text{AEP}$ = annual energy production [MWh/yr]
- $8{,}760$ = hours per year [h]
- $f_{jk}$ = joint probability of wind speed bin $v_k$ and direction sector $\theta_j$ [dimensionless]
- $P_i$ = power output of turbine $i$, which depends on the wind speed, direction, and the positions $\mathbf{x}$ of all turbines (through wake interactions) [MW]
- $N$ = number of turbines
- $N_\theta$ = number of wind direction sectors (typically 36 at 10° intervals, or 72 at 5°)
- $N_v$ = number of wind speed bins (typically 1 m/s bins from cut-in to cut-out)

Notice that $P_i$ depends on $\mathbf{x}$ — the position vector of every turbine in the farm. Moving turbine 7 changes the wake field experienced by turbines 8 through 34. This coupling is what makes the problem hard: the turbines are not independent, and the objective function is the sum of $N$ terms that each depend on the positions of all other turbines. [1]

But maximising AEP is not the same as maximising profit. A layout that squeezes turbines into the upwind edge of the lease area may produce more energy, but the cable runs to the offshore substation will be longer, the foundations may sit in deeper water, and the turbines will experience higher wake-induced fatigue loading that shortens component lifetimes. A more sophisticated objective function minimises the levelised cost of energy:

$$
\text{LCOE} = \frac{\text{CAPEX} \times \text{FCR} + \text{OPEX}_{\text{annual}}}{\text{AEP}}
$$

where:
- $\text{LCOE}$ = levelised cost of energy [EUR/MWh]
- $\text{CAPEX}$ = total capital expenditure, including turbines, foundations, cables, and installation [EUR]
- $\text{FCR}$ = fixed charge rate, which annualises the capital cost over the project lifetime at a given discount rate [1/yr]
- $\text{OPEX}_{\text{annual}}$ = annual operating expenditure [EUR/yr]
- $\text{AEP}$ = net annual energy production [MWh/yr]

The LCOE formulation captures the fundamental trade-off: wider spacing reduces wake losses (increasing the numerator's denominator — AEP) but increases cable length, seabed lease area, and installation vessel transit times (increasing the numerator's numerator — cost). For a fixed number of turbines, the LCOE-optimal layout and the AEP-optimal layout often coincide. But when the number of turbines is itself a design variable — when the question is not "where do I put 34 turbines?" but "how many turbines should I build, and where?" — the two objectives can diverge significantly. [2]

In practice, the industry uses a hierarchy of objective functions depending on the project stage. In early feasibility studies, AEP maximisation with a fixed turbine count is standard — it is fast and easy to understand. In detailed design, LCOE or net present value (NPV) becomes the target, incorporating cable routing costs, foundation cost models, and sometimes even the cost of wake-induced fatigue loading on specific components. The most advanced optimisations consider multi-objective trade-offs, producing a Pareto front of layouts where no single design dominates all others. [3]

<!-- IMAGE: fig-11-01 -->
> **Figure 11.1** — The layout optimization trade-off space
> **Type:** conceptual diagram with two axes
> **Content:** A schematic showing the trade-off between AEP and cost. The horizontal axis is "Mean turbine spacing [rotor diameters]" ranging from 4D to 12D. Two curves are plotted: one for "Net AEP" (rising steeply from 4D to 7D, then flattening) and one for "Total cost" (rising linearly with spacing due to cable length, lease area). A third curve shows "LCOE" (a U-shape, with the minimum around 7–8D). Mark the LCOE-optimal point and the AEP-optimal point (further apart). Include a shaded region labelled "Typical offshore spacing" between 6D and 10D.
> **Caption:** The fundamental trade-off in layout optimisation. Increasing turbine spacing reduces wake losses and increases AEP, but also increases cable cost, lease area, and installation time. The LCOE-optimal spacing balances these competing effects. For fixed turbine count, the AEP-optimal and LCOE-optimal layouts are similar; when turbine count varies, they can diverge.
> **Alt text:** Graph showing net AEP rising and flattening with increased spacing, total cost rising linearly, and LCOE forming a U-shape with minimum around 7-8 rotor diameters.
> **Data source:** Author illustration based on Meyers and Meneveau (2012) and Perez-Moreno et al. (2018).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** AEP curve in green, cost curve in red, LCOE curve in dark blue, optimal point marked with a gold star.

---

## 11.2 The Grid Legacy and the Spacing Question

The earliest offshore wind farms used regular grid layouts — rows and columns of turbines at fixed spacing. Horns Rev I (2002) placed eighty Vestas V80 turbines in an 8-by-10 parallelogram at 7D spacing (560 m) in both the row and column directions. Nysted (2003) used a similar approach: seventy-two Bonus 2.3 MW turbines in eight rows of nine, with 10.5D spacing along the prevailing wind direction and 5.8D across it. The reasons were pragmatic: regular grids simplified cable routing, foundation installation logistics, and turbine identification. In an era when wake models were crude and computing power was limited, the regularity itself was considered a virtue. [4]

But regular grids have a critical flaw that the Horns Rev SCADA data exposed within months of commissioning: when the wind aligns with a row, every turbine downstream sits squarely in the wake of the turbine in front of it. The result is the cascading power deficit that Kaan and Anders observed in Chapter 10 — losses of 30 to 40 percent at the eighth row. A staggered layout, where alternate rows are offset by half the column spacing, reduces this alignment penalty significantly: the downstream turbine now sits between two upstream wakes rather than directly behind one. Modern farms almost universally use staggered or irregular layouts. [5]

The question of how far apart to place turbines has no single answer, because it depends on the wind resource, the turbine model, the wake model, and the cost structure. But the industry has converged on a set of conventions that serve as starting points for optimisation:

| Spacing direction | Typical range | Rationale |
|-------------------|---------------|-----------|
| Downwind (along prevailing direction) | 7D – 10D | Allow sufficient wake recovery for energy yield |
| Crosswind (perpendicular to prevailing) | 4D – 6D | Wake deflection is lateral; cross-wind deficits are smaller |
| Minimum absolute distance | 3D – 5D | IEC 61400-1 turbulence class and structural loading limits |

The minimum spacing is not a convention — it is a structural constraint. As Chapter 10 explained, a downstream turbine in a wake experiences increased turbulence intensity, and the Frandsen effective turbulence model determines whether that turbine remains within its IEC design class. If the effective turbulence exceeds the turbine's rated turbulence intensity (e.g., Class A at $I_{\text{ref}} = 0.16$), the turbine's design lifetime is compromised. The minimum allowable spacing is therefore set by the intersection of the wake turbulence model and the turbine's structural design envelope — a physics constraint, not a rule of thumb. [6]

> **Standard reference:** IEC 61400-1:2019, "Wind energy generation systems — Part 1: Design requirements." Edition 4.0. Section 6.5.1.1 and Annex D define the site-specific turbulence requirements. The effective turbulence model in Annex E.1 establishes the framework for assessing wake-induced loads that determines minimum turbine spacing.

For the V236-15.0 MW turbine with its 236-metre rotor diameter, the typical offshore spacing conventions translate to absolute distances of 1,652 to 2,360 metres downwind and 944 to 1,416 metres crosswind — enormous areas of seabed for a 34-turbine farm. The lease area must accommodate not only the turbines themselves but also buffer zones, shipping lanes, and cable corridors. This is why layout optimisation is not an academic exercise: it is the difference between a project that fits within its lease boundary and one that does not.

<!-- IMAGE: fig-11-02 -->
> **Figure 11.2** — Regular grid versus staggered layout wake exposure
> **Type:** plan-view comparison diagram (two panels)
> **Content:** Left panel: A 5×7 regular grid layout with prevailing wind from the left. Wind-aligned rows show overlapping wake cones (shaded red/orange) where downstream turbines sit entirely within upstream wakes. Right panel: The same 35 turbines in a staggered layout, with alternate rows offset by half the column spacing. Wake cones still exist but downstream turbines now sit between wakes rather than within them. Show wake recovery contours at 80%, 90%, and 95% of free-stream velocity. Label the spacing in both directions in rotor diameters.
> **Caption:** Regular grid versus staggered layout for 35 turbines with prevailing wind from the west. In the regular grid (left), wind-aligned rows create cascading wake deficits. In the staggered layout (right), the half-column offset shifts downstream turbines into the gaps between upstream wakes, reducing the time-averaged wake exposure. Most modern offshore wind farms use staggered or irregular layouts.
> **Alt text:** Plan view comparing a regular grid wind farm layout with cascading wake cones versus a staggered layout where turbines sit between wake cones.
> **Data source:** Author illustration.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Turbines as black dots, wake cones in semi-transparent red-orange, free-stream flow in light blue arrows, spacing labels in grey.

---

## 11.3 The Constraint Landscape

If the layout problem were unconstrained — if the optimiser could place turbines anywhere on an infinite flat seabed — the solution would be trivial: space them so far apart that wakes never overlap, and arrange them perpendicular to the prevailing wind. But real projects face a web of constraints that shrink the feasible region to a fraction of the apparent lease area.

**Lease boundary.** The project's exclusive development rights cover a defined polygon on the seabed, negotiated with the national maritime authority and typically fixed years before the turbine model is selected. The lease boundary is the hard outer wall of the optimisation problem. In the Polish Baltic, the offshore wind concession areas were defined by the Ministry of Infrastructure under the Act on the Promotion of Electricity Generation in Offshore Wind Farms (2021), with specific coordinates for each development zone. [7]

**Exclusion zones.** Within the lease boundary, certain areas are excluded from turbine placement:

- **Environmental exclusion zones** protect habitats identified in environmental impact assessments (EIAs) — reef structures, spawning grounds, bird migration corridors, and marine mammal haul-out sites. The EU Habitats Directive (92/43/EEC) and the Birds Directive (2009/147/EC) require these assessments for all offshore developments.
- **Navigational exclusion zones** maintain safe distances from shipping lanes, marked channels, and anchorage areas. The International Maritime Organisation (IMO) and national maritime administrations (in Poland, the Maritime Office in Gdynia and Słupsk) define minimum setback distances, typically 500 metres to 2 nautical miles from the nearest turbine to the nearest shipping lane edge.
- **Archaeological exclusion zones** protect identified shipwrecks and cultural heritage sites. The Baltic Sea holds an estimated 100,000 shipwrecks, and geophysical surveys during site investigation regularly identify magnetic anomalies that must be assessed before construction. [8]
- **Geotechnical exclusion zones** arise from seabed conditions: areas of exposed bedrock, boulder fields, unexploded ordnance (UXO) from World War II, buried pipelines, or submarine cables. The southern Baltic's seabed is a patchwork of glacial till, sand, and clay, and not every location can support a monopile foundation.

**Cable routing constraints.** Every turbine must be connected to the offshore substation by an array cable, and the cables must follow routes that avoid crossing each other, respect minimum bend radii, and maintain burial depth in the seabed. The cable routing problem is coupled to the layout problem: moving a turbine changes the cable lengths, and the total cable cost is a significant fraction of the project CAPEX — typically 5 to 10 percent for array cables alone. [9]

**Turbulence constraints.** As discussed in Section 11.2, the IEC 61400-1 effective turbulence limits set a minimum spacing that depends on the ambient turbulence, the wake decay characteristics, and the turbine's structural design class. This constraint is not a fixed distance but a function of the farm layout, because wake-added turbulence from multiple upstream turbines combines through the Frandsen model.

**Flicker and noise constraints.** For onshore wind farms, shadow flicker (caused by rotating blades interrupting sunlight) and noise propagation (modelled using ISO 9613-2) impose setback distances from residential receptors. For offshore farms, these constraints are rarely binding, but visual impact from shore may influence turbine height and lighting requirements.

The constraint landscape transforms the layout problem from a smooth optimisation over a convex domain into a highly constrained, non-convex problem with irregular feasible regions. Signe's characterisation — "a chess problem where the board has exclusion zones" — is accurate. The optimiser must not only find turbine positions that maximise energy production but must also ensure that every position lies within the feasible region and that every pair of turbines respects the minimum spacing constraint:

$$
d_{ij} = \sqrt{(x_i - x_j)^2 + (y_i - y_j)^2} \geq d_{\min} \quad \forall \; i \neq j
$$

where:
- $d_{ij}$ = Euclidean distance between turbines $i$ and $j$ [m]
- $(x_i, y_i)$ = coordinates of turbine $i$ [m]
- $d_{\min}$ = minimum allowable spacing, typically 3D to 5D [m]

For the V236-15.0 MW with $D = 236$ m, a minimum spacing of 4D means $d_{\min} = 944$ m. For $N = 34$ turbines, there are $\binom{34}{2} = 561$ pairwise distance constraints — every one of which must be satisfied simultaneously.

<!-- IMAGE: fig-11-03 -->
> **Figure 11.3** — Constraint landscape for an offshore wind farm lease area
> **Type:** annotated plan-view map
> **Content:** A polygon representing a typical offshore wind farm lease area (approximately 60 km²). Within the polygon, show several constraint layers: an environmental exclusion zone (hatched green, protecting a reef), a navigational exclusion zone (hatched red, maintaining setback from a shipping lane along one edge), an archaeological exclusion zone (small hatched orange circles around shipwreck locations), a geotechnical exclusion zone (hatched brown, where a boulder field was identified). The remaining feasible area — where turbines can actually be placed — is shown in clear white, visibly smaller than the total lease area. Include a scale bar and north arrow. Label each constraint type.
> **Caption:** The constraint landscape of a typical offshore wind farm lease area. Environmental, navigational, archaeological, and geotechnical exclusion zones reduce the feasible turbine placement area to approximately 60–80% of the total lease polygon. The layout optimiser must find positions for all turbines within the remaining feasible region while respecting minimum spacing constraints.
> **Alt text:** Plan view of an offshore wind farm lease area showing multiple exclusion zones that reduce the feasible area for turbine placement to roughly two-thirds of the total area.
> **Data source:** Author illustration based on generic Baltic Sea offshore wind development constraints.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Lease boundary in dark blue, environmental exclusions in green hatching, navigational exclusions in red hatching, archaeological sites in orange circles, geotechnical exclusions in brown hatching, feasible area in white.

---

## 11.4 Optimization Algorithms: From Genetic to Gradient

The wind farm layout optimization problem entered the academic literature in 1994, when Mosetti, Poloni, and Diviacco published what is now regarded as the founding paper of computational WFLOP. They discretised a 2 km × 2 km wind farm into a 10 × 10 grid of 100 potential positions and used a genetic algorithm (GA) to select which cells should contain turbines. The wake model was Jensen's (Chapter 10). The objective function was the ratio of total power to total cost. The approach was crude by modern standards — only 100 possible positions, a single wind speed, and a wake model that treats the deficit as a top hat — but it demonstrated, for the first time, that evolutionary computation could find non-obvious layouts that outperformed regular grids. The paper has been cited more than 1,400 times. [10]

### The Genetic Algorithm Approach

The genetic algorithm works by analogy with biological evolution. Each candidate layout is encoded as a chromosome — in Mosetti's formulation, a binary string of 100 bits, where a 1 means "place a turbine in this cell" and a 0 means "leave it empty." A population of candidate layouts is initialised randomly, and then iteratively improved through three operators:

1. **Selection:** Layouts with higher fitness (more energy per unit cost) are more likely to be chosen as parents.
2. **Crossover:** Two parent chromosomes exchange segments of their binary strings to produce offspring with traits from both parents.
3. **Mutation:** Random bits are flipped with a small probability, introducing exploration into new regions of the design space.

After many generations (typically hundreds to thousands), the population converges toward a set of high-performing layouts. The GA's strength is that it searches broadly across the design space without requiring gradient information — it can navigate the multi-modal landscape where many local optima exist. Its weakness is that it requires thousands of objective function evaluations, each of which involves running a wake model for the full farm across all wind speed and direction bins.

In 2005, Grady, Hussaini, and Abdullah extended Mosetti's approach with a larger population (600 individuals) evolved over 3,000 generations, testing three wind direction scenarios and confirming that the GA consistently found irregular layouts that outperformed regular grids by 1 to 5 percent in energy production. Their work established the 10 × 10 Mosetti grid as a benchmark problem that subsequent algorithms would be tested against for the next two decades. [11]

### Beyond the Genetic Algorithm

The success of GAs inspired a proliferation of metaheuristic algorithms applied to WFLOP:

- **Particle swarm optimisation (PSO)** models each candidate layout as a particle moving through the design space, attracted toward its own best-known position and the swarm's best-known position. PSO has shown competitive performance with GAs but typically requires careful tuning of inertia and acceleration parameters. [12]
- **Simulated annealing (SA)** mimics the physical process of cooling a metal: the algorithm accepts worse solutions with a probability that decreases as the "temperature" drops, allowing it to escape local optima early in the search and refine the solution later. Bilbao and Alba (2009) applied SA to WFLOP and found it competitive with GAs for small to medium farms.
- **Ant colony optimisation** and **differential evolution** have also been applied, each with particular strengths in specific problem formulations.

A comprehensive comparison by Samorani (2013) and later by Mosetti's 12-algorithm benchmark study (Kumar et al., 2024) confirmed that no single metaheuristic consistently dominates — the best algorithm depends on the problem size, the constraint structure, and the fidelity of the wake model. [13]

### The Gradient Revolution

All metaheuristic algorithms share a fundamental scaling problem: they are gradient-free, meaning they treat the objective function as a black box and require many evaluations to converge. For a farm of $N$ turbines, the design space has $2N$ continuous variables (x and y coordinates for each turbine). A 34-turbine farm has 68 design variables; a 100-turbine farm has 200. The number of objective function evaluations required by gradient-free methods scales poorly with dimensionality — a GA that works well for 10 turbines may need millions of evaluations for 100.

Gradient-based optimisation offers a fundamentally different approach. If the wake model is differentiable — if the derivative of the AEP with respect to each turbine's position can be computed — then the optimiser can follow the gradient uphill, reaching a local optimum in far fewer evaluations. The challenge is that analytical wake models are not always smooth: the Jensen top-hat model has discontinuities at the wake boundary, and even the Gaussian model can produce non-smooth gradients when wakes overlap.

Two developments made gradient-based WFLOP practical:

1. **Smooth wake models.** Thomas and Ning at Brigham Young University modified the FLORIS Gaussian wake model to ensure continuous gradients everywhere, enabling efficient computation of $\partial \text{AEP} / \partial x_i$ for every turbine simultaneously. Their 2017 paper showed that gradient-based optimisation of a 100-turbine farm converged in minutes rather than the hours required by a GA. [14]

2. **Algorithmic differentiation (AD).** The TOPFARM framework developed at DTU Wind Energy uses automatic differentiation through the OpenMDAO optimisation platform to compute exact gradients of the AEP with respect to all design variables in a single backward pass. For a farm with $N$ turbines, AD computes the full gradient vector (all $2N$ partial derivatives) at a cost of roughly 2 to 4 times a single objective function evaluation — regardless of $N$. This means that a 500-turbine farm requires no more gradient computation time per iteration than a 10-turbine farm. [15]

The catch is multi-modality. The WFLOP landscape is littered with local optima — small perturbations from a locally optimal layout decrease the AEP, even though a very different layout might produce more energy. Gradient-based methods find *a* local optimum quickly, but not necessarily the global optimum. The practical solution is a hybrid approach: use a metaheuristic (GA or random restarts) to explore the design space broadly, then refine each candidate layout with gradient-based optimisation. This two-stage strategy combines the exploration strength of metaheuristics with the exploitation efficiency of gradients.

$$
\mathbf{x}^{(t+1)} = \mathbf{x}^{(t)} + \alpha \nabla_{\mathbf{x}} \text{AEP}(\mathbf{x}^{(t)})
$$

where:
- $\mathbf{x}^{(t)}$ = vector of all turbine positions at iteration $t$ [m]
- $\alpha$ = step size (determined by line search or trust-region method) [m²·yr/MWh]
- $\nabla_{\mathbf{x}} \text{AEP}$ = gradient of AEP with respect to all turbine positions [MWh/(yr·m)]

The gradient tells the optimiser, for each turbine, which direction to move it and by how much, to increase the farm's total energy production. A turbine deep in the wake of its upstream neighbour will have a large gradient pointing laterally — "move me sideways, out of this wake." A turbine on the upwind edge with no wake exposure will have a near-zero gradient — "I am already well placed."

<!-- IMAGE: fig-11-04 -->
> **Figure 11.4** — Gradient vectors on a wind farm layout
> **Type:** plan-view diagram with arrows
> **Content:** A plan view of approximately 20 turbines in an irregular layout with the prevailing wind from the left. Each turbine is marked with a dot and an arrow representing the AEP gradient vector — the direction and magnitude of the position change that would most increase the farm AEP. Upwind turbines (front row) have small or zero arrows. Downstream turbines in wake zones have large arrows pointing laterally (perpendicular to the wind direction), indicating the optimiser wants to move them out of the wake. A few turbines near the lease boundary have arrows constrained by the boundary. Show the wake contours as faint background shading.
> **Caption:** Gradient vectors superimposed on a wind farm layout. Each arrow shows the direction and magnitude of the AEP gradient with respect to that turbine's position — the direction in which moving the turbine would most increase the farm's total annual energy production. Turbines in deep wake zones have large lateral gradients; front-row turbines have near-zero gradients. Gradient-based optimisation follows these arrows iteratively until convergence.
> **Alt text:** Plan view of a wind farm with arrows on each turbine showing the direction that would increase farm energy production, with larger arrows on turbines in wake zones.
> **Data source:** Author illustration based on Thomas and Ning (2017).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Turbines as black dots, gradient arrows in dark blue (length proportional to magnitude), wake contours in faint red-orange, lease boundary in dashed grey.

---

## 11.5 The Tools of the Trade

Layout optimisation is not performed on a blank spreadsheet. The wind industry has developed a generation of commercial and open-source software tools that integrate wind resource data, wake models, constraint maps, cable routing, and optimisation algorithms into unified design environments.

**WindPRO** (EMD International, Denmark, first released 1996) is one of the most widely used commercial tools for onshore and offshore wind farm design. Its OPTIMIZE module uses a combination of greedy placement and genetic algorithm refinement, with wake modelling through the Park (Jensen) and N.O. Jensen/Risø family of models. WindPRO's strength is its integration with noise modelling (ISO 9613-2), shadow flicker calculation, and regulatory compliance checking — making it particularly strong for onshore projects where noise and visual impact constraints dominate the layout. [16]

**openWind** (UL Solutions, formerly AWS Truepower) is the other major commercial platform, used by approximately 70 percent of the world's top wind developers. openWind's layout optimisation combines a genetic algorithm with wake models from the Eddy Viscosity family and supports LCOE-based objective functions that include foundation cost models, cable routing costs, and accessibility metrics. Its terrain-following wake models and seamless integration with UL's energy assessment services have made it the industry standard for bankable yield estimates. [17]

**TOPFARM** (DTU Wind Energy, open-source, Python) represents the academic frontier. Built on the OpenMDAO framework, TOPFARM wraps the PyWake wake model library (which includes Jensen, Bastankhah-Porté-Agel, and several others) with gradient-based and gradient-free optimisation capabilities. Because PyWake provides analytical gradients through algorithmic differentiation, TOPFARM can optimise layouts with hundreds of turbines using sequential quadratic programming (SQP) or interior-point methods in minutes rather than hours. TOPFARM also supports multi-objective optimisation and constraint handling through penalty functions or direct constraint enforcement. [18]

**FLORIS** (NREL, open-source, Python) was developed primarily for wake steering research (Chapter 10) but includes layout optimisation capabilities through its integration with the SciPy optimisation library. FLORIS uses the Gaussian wake model with yaw-dependent wake deflection, making it uniquely suited for co-optimising layout and active wake control strategies. [19]

The choice of tool depends on the project stage and the question being asked. In early development, WindPRO or openWind with a fast wake model and GA-based optimisation is standard — the goal is to converge quickly on a feasible layout that can support financial modelling. In detailed design, higher-fidelity wake models (sometimes calibrated against SCADA data from neighbouring farms) and gradient-based refinement are used to squeeze the last 1 to 2 percent of AEP from the layout. For research and regulatory analysis, TOPFARM and FLORIS provide the transparency and customisability that commercial tools do not.

---

## 11.6 From Theory to Seabed: How a Real Layout Emerges

Signe's job did not begin with an optimisation algorithm. It began with a map.

The first step in any real layout design is to assemble the constraint map — the spatial representation of every boundary and exclusion zone described in Section 11.3. For the 500 MW reference farm, the process looked like this:

1. **Lease boundary polygon** from the maritime concession (fixed, non-negotiable).
2. **Bathymetry survey** to identify water depth contours and exclude areas too deep for monopiles (typically >40 m for current technology) or too shallow for vessel access.
3. **Geotechnical survey** to identify boulder fields, clay pockets, and UXO locations. Each UXO location generates a 500-metre exclusion circle until cleared.
4. **Environmental impact assessment** to identify sensitive habitats — in the Polish Baltic, this typically includes Natura 2000 sites, harbour porpoise migration corridors, and bird migration funnels, particularly for long-tailed ducks and common scoters.
5. **Navigational risk assessment** to establish setback distances from shipping lanes and anchorage areas.
6. **Cable corridor reservation** for the export cable route from the offshore substation to the onshore grid connection point.

The result of this process is a feasible placement polygon — the area where turbines may actually be placed — which is invariably smaller and more irregular than the original lease boundary. For a typical Baltic Sea project, the feasible area is 60 to 80 percent of the lease area.

The second step is to generate an initial layout. Most practitioners start with a regular or semi-regular grid aligned with the prevailing wind direction, spaced at approximately 7D downwind and 5D crosswind. This "seed layout" gives the optimiser a starting point that already satisfies the minimum spacing constraint and roughly distributes the turbines across the feasible area. Starting from a random layout is possible but wasteful — the optimiser spends many iterations just untangling constraint violations rather than improving energy production.

The third step is optimisation itself — running the chosen algorithm (GA, gradient-based, or hybrid) with the wake model, wind resource data, and constraint set. A typical optimisation run for a 34-turbine farm takes:

| Method | Evaluations | Time (single core) | Typical AEP improvement over regular grid |
|--------|------------|--------------------|-----------------------------------------|
| Genetic algorithm (500 generations) | 50,000–100,000 | 2–8 hours | 1–3% |
| Gradient-based (TOPFARM/SQP) | 200–500 | 5–15 minutes | 1–3% |
| Hybrid (GA seed → gradient refinement) | 10,000 + 200 | 1–2 hours | 2–4% |

The improvement percentages seem small — 2 to 4 percent — but they are applied to an enormous base. For a 500 MW farm producing 2,500 GWh per year, a 3 percent improvement is 75 GWh per year, worth 4.5 million EUR per year at 60 EUR/MWh, or 135 million EUR over a 30-year lifetime. This is why layout optimisation is one of the highest-value engineering activities in a wind farm's development. [20]

The fourth step is engineering review. The optimised layout is checked by hand against constraints that the algorithm may not have captured: cable crossing avoidance, vessel manoeuvrability during installation, helicopter access to individual turbines for maintenance, and regulatory setback distances that may have changed since the constraint map was assembled. Signe's experience — twenty years of layouts across Danish, German, and now Polish waters — is what catches the problems that algorithms miss.

---

## 11.7 Worked Example: Optimising a 34-Turbine Layout

**Problem:** A 500 MW offshore wind farm uses 34 × V236-15.0 MW turbines in a rectangular lease area of approximately 6 km × 10 km in the Polish Baltic Sea. The prevailing wind direction is from the southwest (240°) with a mean wind speed of 10.2 m/s at 150 m hub height (Weibull $k = 2.1$, $A = 11.5$ m/s — from Chapter 9). Compare the gross and net AEP of three layout options.

**Step 1: Define the three layouts.**

| Layout | Description | Mean downwind spacing | Mean crosswind spacing |
|--------|-------------|----------------------|----------------------|
| A: Regular grid | 5 rows × 7 columns (with one gap), aligned SW-NE | 7D = 1,652 m | 5D = 1,180 m |
| B: Staggered grid | Same row structure, alternate rows offset by 2.5D | 7D = 1,652 m | 5D = 1,180 m |
| C: Optimised irregular | GA + gradient refinement, LCOE objective | Variable (6.5D–9.5D) | Variable (4.5D–7D) |

**Step 2: Compute gross AEP (no wakes).**

From Chapter 9, the single-turbine gross AEP is 73.5 GWh/yr. For 34 turbines:

$$
\text{AEP}_{\text{gross}} = 34 \times 73.5 = 2{,}499 \text{ GWh/yr}
$$

**Step 3: Compute wake losses for each layout using the Jensen model.**

Using the Jensen model with $k_w = 0.04$ and 36 direction sectors at 10° intervals, weighted by the directional wind resource:

| Layout | Wake loss fraction | Net AEP [GWh/yr] | Capacity factor (net) |
|--------|-------------------|-------------------|----------------------|
| A: Regular grid | 11.2% | 2,219 | 49.7% |
| B: Staggered grid | 9.1% | 2,272 | 50.9% |
| C: Optimised irregular | 7.8% | 2,304 | 51.6% |

**Step 4: Compute the cable cost for each layout.**

Array cable cost depends on total cable length. Assume 66 kV XLPE submarine cable at approximately 400 EUR/m (including installation):

| Layout | Total array cable length [km] | Cable cost [M EUR] |
|--------|------------------------------|-------------------|
| A: Regular grid | 38.5 | 15.4 |
| B: Staggered grid | 40.2 | 16.1 |
| C: Optimised irregular | 43.8 | 17.5 |

The optimised layout uses 14% more cable than the regular grid — the price of wider, irregular spacing.

**Step 5: Compute the net financial benefit.**

The revenue difference between layouts (at 60 EUR/MWh) over 30 years:

$$
\Delta \text{Revenue}_{C \text{ vs } A} = (2{,}304 - 2{,}219) \times 60 \times 30 = 153 \text{ M EUR}
$$

The additional cable cost:

$$
\Delta \text{Cable}_{C \text{ vs } A} = 17.5 - 15.4 = 2.1 \text{ M EUR}
$$

The net benefit of the optimised layout over the regular grid:

$$
\text{Net benefit} = 153 - 2.1 = 150.9 \text{ M EUR}
$$

The optimised layout costs 2.1 million EUR more in cables but recovers 153 million EUR in energy revenue over 30 years — a return of 73:1 on the additional cable investment. This is why every major offshore wind developer employs layout optimisation specialists, and why Signe's job exists.

**Step 6: Summary.**

| Metric | Regular grid (A) | Staggered (B) | Optimised (C) |
|--------|-----------------|----------------|---------------|
| Wake loss | 11.2% | 9.1% | 7.8% |
| Net AEP [GWh/yr] | 2,219 | 2,272 | 2,304 |
| Cable cost [M EUR] | 15.4 | 16.1 | 17.5 |
| 30-year revenue [M EUR] | 3,994 | 4,090 | 4,147 |
| Net benefit vs grid A [M EUR] | — | +93.8 | +150.9 |
| LCOE impact | Baseline | −1.4% | −2.3% |

The progression from regular grid to staggered grid recovers 94 million EUR; the further step from staggered to fully optimised recovers an additional 57 million EUR. The staggered grid captures most of the benefit at near-zero additional complexity, which explains why it became the default industry practice. The remaining improvement from full optimisation requires sophisticated algorithms, detailed constraint handling, and experienced engineers — but 57 million EUR over a project lifetime more than justifies the effort.

---

## Key Takeaways

- **The wind farm layout optimisation problem (WFLOP) is to find turbine positions that maximise energy production (or minimise LCOE) subject to spacing, boundary, environmental, and structural constraints.** The objective function couples all turbines through wake interactions, making the problem non-separable and multi-modal.

- **Regular grid layouts suffer from wind-aligned wake cascades.** Staggering alternate rows by half the column spacing reduces wake losses by 2 to 3 percentage points for negligible additional cost — the single most cost-effective layout change for any wind farm.

- **The constraint landscape includes lease boundaries, environmental exclusion zones, navigational setbacks, geotechnical limitations, and IEC turbulence class requirements.** The feasible area for turbine placement is typically 60 to 80 percent of the lease polygon.

- **Optimisation algorithms evolved from Mosetti's 1994 genetic algorithm to modern gradient-based methods that use algorithmic differentiation.** Hybrid approaches (metaheuristic exploration + gradient refinement) combine the breadth of evolutionary search with the efficiency of gradient descent.

- **For a 500 MW offshore farm, optimised layout design recovers 150 million EUR in energy revenue over the project lifetime compared to a regular grid — at a cost of 2 million EUR in additional cables.** Layout optimisation is one of the highest-return engineering activities in wind farm development.

## For Further Reading

- **Samorani, M. (2013).** "The Wind Farm Layout Optimization Problem." In *Handbook of Wind Power Systems*, pp. 21–38. Springer. A concise and accessible introduction to the WFLOP, covering problem formulation, constraint handling, and the major algorithm families (GA, PSO, SA) with worked examples and pseudocode.

- **Stanley, A.P.J. and Ning, A. (2019).** "Massive Simplification of the Wind Farm Layout Optimization Problem." *Wind Energy Science*, 4(4), 663–676. DOI: 10.5194/wes-4-663-2019. Demonstrates that a boundary-grid parameterisation with only 5 design variables produces layouts that perform as well as full coordinate optimisation with 200 variables, enabling efficient gradient-based optimisation of farms with hundreds of turbines.

- **Pérez-Moreno, S.S., Dykes, K., Merz, K.O., and Zaaijer, M.B. (2018).** "Multidisciplinary Design Analysis and Optimisation of a Reference Offshore Wind Plant." *Journal of Physics: Conference Series*, 1037, 042004. DOI: 10.1088/1742-6596/1037/4/042004. Demonstrates LCOE-based multidisciplinary optimisation that co-designs layout, turbine selection, support structures, and electrical infrastructure — the direction the field is moving.

---

*Signe leaned back in her chair and crossed her arms. The right monitor now showed three layouts superimposed: the regular grid in grey, the staggered grid in blue, and her optimised result in green. The green dots had migrated outward from the centre and shifted laterally away from the prevailing wind axis, opening channels for wake recovery between the rows. Some turbines had barely moved from the staggered grid positions. Others had shifted by hundreds of metres.*

*"The algorithm wants to spread them apart along the wind direction," Kaan observed. "And move the interior turbines sideways."*

*"Exactly," Signe said. "The gradient pushes downstream turbines laterally — out of the wake shadow — and increases the downwind spacing wherever the lease boundary allows it. The crosswind spacing actually tightens in some places, because the wake deficit perpendicular to the wind is small." She pointed to a cluster of three turbines on the northeastern edge that had moved closer together than the original grid. "These three are almost never in each other's wakes. The dominant wind comes from the southwest, so they are side by side from the wind's perspective. The algorithm recognised that and used the space for something more valuable — wider downwind corridors for the interior rows."*

*"How do you know the algorithm found the best layout?"*

*Signe smiled — the question she had clearly been waiting for. "I do not. I know it found a good layout — better than the grid, better than the staggered grid, better than the fifty other candidates the genetic algorithm explored. But the design space for thirty-four turbines in two dimensions has sixty-eight continuous variables and five hundred and sixty-one pairwise constraints. The number of local optima is enormous. Every time I run the optimiser with different random seeds, I get a slightly different result." She gestured at the convergence plot on the right monitor. "The lines all end up within half a percent of each other, which tells me I am close to a global optimum. But I cannot prove it. Nobody can."*

*Kaan thought about that. A hundred and fifty million euros in value, and the difference between the best layout and a good layout might be unmeasurable. The engineering was not about finding perfection — it was about finding something demonstrably better than the obvious choice and then having the discipline to stop searching.*

*"What happens next?" he asked.*

*"Next," Signe said, closing the optimiser window and opening a spreadsheet dense with numbers, "we find out what all of this is worth. AEP is physics. Revenue is finance. And the distance between the two is uncertainty." She glanced at him. "Have you heard of the P90?"*

*Kaan shook his head.*

*"You will," she said. "That is the number the bank cares about."*

---

## Notes

[1] Wind farm layout optimisation problem formulation: Herbert-Acero, J.F., Probst, O., Réthoré, P.-E., Larsen, G.C., and Castillo-Villar, K.K. (2014). "A Review of Methodological Approaches for the Design and Optimization of Wind Farms." *Energies*, 7(11), 6930–7016. DOI: 10.3390/en7116930. Comprehensive review of WFLOP formulations, objective functions, constraints, and solution methods, covering publications from 1994 to 2013.

[2] LCOE versus AEP optimisation: Perez-Moreno, S.S., Dykes, K., Merz, K.O., and Zaaijer, M.B. (2018). "Multidisciplinary Design Analysis and Optimisation of a Reference Offshore Wind Plant." *Journal of Physics: Conference Series*, 1037, 042004. DOI: 10.1088/1742-6596/1037/4/042004. Demonstrates that LCOE-optimal layouts differ from AEP-optimal layouts when turbine count, foundation type, and cable routing are co-optimised.

[3] Multi-objective wind farm layout optimisation: Feng, J. and Shen, W.Z. (2015). "Solving the Wind Farm Layout Optimization Problem Using Random Search Algorithm." *Renewable Energy*, 78, 182–192. DOI: 10.1016/j.renene.2015.01.005. Also: Parada, L., Herrera, C., Flores, P., and Parada, V. (2017). "Wind Farm Layout Optimization Using a Gaussian-Based Wake Model." *Renewable Energy*, 107, 531–541. DOI: 10.1016/j.renene.2017.02.017. Pareto-front approaches that trade off AEP, cable cost, and turbulence loading.

[4] Horns Rev I layout: Barthelmie, R.J., Hansen, K.S., Frandsen, S.T., Rathmann, O., Schepers, J.G., Schlez, W., Phillips, J., Rados, K., Zervos, A., Politis, E.S., and Chaviaropoulos, P.K. (2009). "Modelling and Measuring Flow and Wind Turbine Wakes in Large Wind Farms Offshore." *Wind Energy*, 12(5), 431–444. DOI: 10.1002/we.348. Documents the 8×10 regular grid at 7D spacing and the resulting row-by-row power deficits. Nysted layout: Barthelmie, R.J., Pryor, S.C., et al. (2010). "Quantifying the Impact of Wind Turbine Wakes on Power Output at Offshore Wind Farms." *Journal of Atmospheric and Oceanic Technology*, 27(8), 1302–1317. DOI: 10.1175/2010JTECHA1398.1.

[5] Staggered versus regular grid performance: González, J.S., Rodriguez, A.G.G., Mora, J.C., Santos, J.R., and Payan, M.B. (2010). "Optimization of Wind Farm Turbines Layout Using an Evolutive Algorithm." *Renewable Energy*, 35(8), 1671–1681. DOI: 10.1016/j.renene.2010.01.010. Demonstrates 2–4% AEP improvement from staggered layouts compared to regular grids for equivalent turbine count and lease area.

[6] IEC turbulence constraints on spacing: International Electrotechnical Commission. IEC 61400-1:2019, "Wind energy generation systems — Part 1: Design requirements." Edition 4.0. Annex E.1, "Effective turbulence." The Frandsen model for wake-added turbulence determines the minimum allowable spacing based on the turbine's design turbulence class and the site-specific ambient turbulence. Also: Frandsen, S.T. (2007). "Turbulence and Turbulence-Generated Structural Loading in Wind Turbine Clusters." Risø-R-1188(EN). Risø National Laboratory.

[7] Polish offshore wind concession areas: Republic of Poland. "Ustawa o promowaniu wytwarzania energii elektrycznej w morskich farmach wiatrowych" (Act on the Promotion of Electricity Generation in Offshore Wind Farms), 17 December 2020 (Journal of Laws 2021, item 234). Defines the legal framework for offshore wind development in Polish maritime areas, including the concession process and development zone designations in the Baltic Sea.

[8] Baltic Sea shipwrecks and archaeological constraints: Beltrame, C. and Gaddi, D. (2005). "The Rigging and the Hydraulic System of the Roman Wreck at Grado, Italy." *International Journal of Nautical Archaeology*, 34(1), 142–152. For the Baltic specifically: Eriksson, N. and Rönnby, J. (2017). "The Ghost Ship: An Intact Fluyt from c. 1650 in the Middle of the Baltic Sea." *International Journal of Nautical Archaeology*, 46(2), 253–264. DOI: 10.1111/1095-9270.12242. The estimate of ~100,000 shipwrecks in the Baltic comes from UNESCO's cultural heritage database and Nordic maritime archaeology surveys.

[9] Cable cost as fraction of offshore wind CAPEX: BVG Associates (2019). "Guide to an Offshore Wind Farm." Updated for The Crown Estate and the Offshore Renewable Energy Catapult. Chapter 7, "Array cables." Reports array cable costs at 5–10% of total CAPEX for typical offshore wind projects, depending on farm size and inter-turbine spacing. Also: Lumbreras, S. and Ramos, A. (2013). "Optimal Design of the Electrical Layout of an Offshore Wind Farm Applying Decomposition Strategies." *Renewable Energy*, 50, 604–613. DOI: 10.1016/j.renene.2012.07.024.

[10] Mosetti, G., Poloni, C., and Diviacco, B. (1994). "Optimization of Wind Turbine Positioning in Large Wind Farms by Means of a Genetic Algorithm." *Journal of Wind Engineering and Industrial Aerodynamics*, 51(1), 105–116. DOI: 10.1016/0167-6105(94)90080-9. The founding paper of computational wind farm layout optimisation. Discretised a 2 km × 2 km farm into a 10 × 10 grid and used a GA with Jensen wake model to select turbine positions. Tested three wind scenarios (single direction, uniform rose, non-uniform rose).

[11] Grady, S.A., Hussaini, M.Y., and Abdullah, M.M. (2005). "Placement of Wind Turbines Using Genetic Algorithms." *Renewable Energy*, 30(2), 259–270. DOI: 10.1016/j.renene.2004.05.007. Extended Mosetti's approach with larger populations (600 individuals, 3,000 generations) and confirmed that GAs consistently outperform regular grids by 1–5% in energy production. Established the 10 × 10 benchmark that subsequent algorithms are tested against.

[12] Particle swarm optimisation for WFLOP: Wan, C., Wang, J., Yang, G., Li, X., and Zhang, X. (2012). "Optimal Micro-Siting of Wind Turbines by Genetic Algorithms Based on Improved Wind and Turbine Models." *Proceedings of the IEEE Conference on Decision and Control*, pp. 5092–5096. Also: Eroğlu, Y. and Seçkiner, S.U. (2012). "Design of Wind Farm Layout Using Ant Colony Algorithm." *Renewable Energy*, 44, 53–62. DOI: 10.1016/j.renene.2012.01.064.

[13] Comparative performance of metaheuristics: Samorani, M. (2013). "The Wind Farm Layout Optimization Problem." In Pardolos, P.M., Rebennack, S., Pereira, M.V.F., and Iliadis, N.A. (eds.), *Handbook of Wind Power Systems*, pp. 21–38. Springer. DOI: 10.1007/978-3-642-41080-2_2. Also: Kumar, R., Devi, S., Nigam, B., and Malik, V. (2024). "Wind Farm Layout Optimization Problem Using Nature-Inspired Algorithms." *Journal of Electrical and Computer Engineering*, 2024, 9406519. DOI: 10.1155/2024/9406519. Compares 12 metaheuristics on the Mosetti benchmark.

[14] Gradient-based layout optimisation with smooth wake models: Thomas, J.J., Gebraad, P.M.O., and Ning, A. (2017). "Improving the FLORIS Wind Plant Model for Compatibility with Gradient-Based Optimization." *Wind Engineering*, 41(5), 313–329. DOI: 10.1177/0309524X17722000. Modified the Gaussian wake model to ensure continuous, differentiable gradients, enabling gradient-based optimisation of 100+ turbine farms in minutes.

[15] TOPFARM and algorithmic differentiation: Pedersen, M.M., van der Laan, P., Friis-Møller, M., Rinker, J., and Réthoré, P.-E. (2019). "DTUWindEnergy/TopFarm2: TOPFARM2." DTU Wind Energy. Available at: topfarm.pages.windenergy.dtu.dk. Also: Stanley, A.P.J., Thomas, J., Ning, A., Annoni, J., Dykes, K., and Fleming, P. (2022). "Gradient-Based Wind Farm Layout Optimization Results Compared with Large-Eddy Simulations." *Wind Energy Science*, 7(6), 2085–2098. DOI: 10.5194/wes-7-2085-2022. Demonstrates that gradient-based layouts validated against LES produce genuinely higher AEP than GA-only results.

[16] WindPRO: EMD International A/S. "WindPRO." Version 4.0. Aalborg, Denmark. Commercial software for wind energy project design, including modules for wind resource assessment (ATLAS), energy calculation (PARK), noise propagation (DECIBEL), shadow flicker (SHADOW), and layout optimisation (OPTIMIZE). First released 1996; used in over 100 countries.

[17] openWind: UL Solutions (formerly AWS Truepower / UL Renewables). "openWind Enterprise." Commercial software for wind farm design, energy assessment, and layout optimisation. Uses genetic algorithms with Eddy Viscosity and other wake models. Reported to be used by approximately 70% of the top global wind developers. Includes LCOE-based optimisation with foundation and cable cost models.

[18] TOPFARM: DTU Wind Energy. "TOPFARM2 — Multi-fidelity Wind Farm Optimisation." Open-source Python package. Documentation: topfarm.pages.windenergy.dtu.dk/TopFarm2/. Wraps PyWake for AEP calculation and OpenMDAO for gradient-based optimisation. Supports turbine position, type, and hub height optimisation with boundary and spacing constraints.

[19] NREL FLORIS: National Renewable Energy Laboratory. "FLORIS: FLOw Redirection and Induction in Steady State." Open-source Python package. Documentation: github.com/NREL/floris. Combines Gaussian wake models with yaw-dependent deflection for layout and wake steering co-optimisation.

[20] Value of layout optimisation: Meyers, J. and Meneveau, C. (2012). "Optimal Turbine Spacing in Fully Developed Wind Farm Boundary Layers." *Wind Energy*, 15(2), 305–317. DOI: 10.1002/we.469. Demonstrates that optimal turbine spacing for large arrays is 15D when considering atmospheric boundary layer effects — far wider than industry practice — suggesting that current layouts are constrained by lease area rather than aerodynamic optimality. The gap between aerodynamically optimal and practically constrained layouts represents the value of advanced optimisation within the available space.

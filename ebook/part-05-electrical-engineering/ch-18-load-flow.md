# Chapter 18: Load Flow — Where Does the Power Go?

*Kaan arrived at the OSS control room at ten minutes past eight with a pencil in his breast pocket and a still-warm coffee from the galley. He had taken Anders's instruction literally.*

*The control room occupied the east face of the upper module — a room about the size of a university seminar space, banks of operator workstations arranged in a horseshoe facing a wall of mounted displays. The central screen showed a one-line diagram of the complete electrical network: the wind turbine symbols in seven strings at the bottom left, collector cables running up to the offshore substation 66 kV bus, step-up transformers, the OSS 220 kV bus, then two horizontal lines running right across the screen toward a blue box labelled PSE 400 kV. Every bus had a column of four numbers beside it — voltage magnitude, voltage angle, active power injection, reactive power injection — coloured green for within normal range, amber for marginal, red for alarm. All green this morning.*

*Anders was already at the far workstation, a coffee at his elbow. He had the same diagram open in more detail: per-unit values, impedance labels on every branch, arrow annotations showing the direction of power flow.*

*"You brought a pencil."*

*"You told me to."*

*"Good. Sit down."*

*Kaan sat. Anders pointed at the left side of the diagram, where the WTG symbols were clustered.*

*"Five hundred megawatts leaves those rotors at six hundred and ninety volts, three-phase. It enters a step-up transformer, becomes sixty-six kilovolts. Travels along the array cables to this substation, goes through the main transformer to two hundred and twenty kilovolts, and then travels forty-five kilometres along the export cable to the onshore substation, through another transformer, and into the PSE 400 kV system." He traced the path with his finger without touching the screen. "Between those two points — blade tip to PSE bus — power is consumed by resistances, stored and returned by reactances, and transformed four times. At the end, the grid receives something less than five hundred megawatts. The question is: how much less? And where did the rest go? And what voltage is actually present at each node in between?"*

*Kaan looked at the number beside the OSS 220 kV bus. Voltage magnitude: 1.024 pu. He had assumed voltage would sit near 1.0 pu everywhere in a healthy, loaded system.*

*"The OSS voltage is above one."*

*"Yes." Anders let Kaan sit with that for a moment.*

*"Ferranti. The export cable capacitance raises the voltage at the offshore end."*

*"Correct. Even at full active load, the cable generates more reactive power than the leakage reactances and transformer magnetising branches consume. The voltage rises at the offshore end." Anders closed the one-line diagram and opened a blank workbook. "That number — 1.024 — is not a guess. It is the solution to a system of nonlinear equations that represents every branch, every transformer, every shunt capacitance in the network. The method that produces it is called load flow analysis. It is the foundation of everything else in power systems engineering."*

*He wrote four words on the whiteboard.*

*LOAD FLOW. WHERE DOES IT GO?*

*"Let us find out."*

---

## 18.1 From Scale Models to Equations: Bus Types and the Load Flow Problem

Power systems engineers have asked the same fundamental question since the first alternating-current networks were built in the 1890s: if I know what every generator is producing and what every load is consuming, what voltage will appear at every bus in the network, and how much power will flow through every branch? The question matters because voltage must stay within tight limits for equipment to function correctly — IEC 60038 specifies ±10% of nominal for high-voltage systems — and because cables, transformers, and switchgear must be rated for the currents that will actually flow, not rough estimates.

In the early decades of AC power engineering, the question was answered with analogue computers. From the late 1920s onward, utilities and manufacturers built **AC network analysers** — physical scale models of power systems constructed from miniature transformers, resistors, and capacitors. The machines at MIT, General Electric in Schenectady, and Westinghouse in East Pittsburgh could reproduce the steady-state behaviour of a network at reduced scale: engineers adjusted load or generation dials and read voltages and currents from attached instruments. [1] Some of these machines filled entire rooms and could model networks of a hundred buses or more. They were impressive, slow to reconfigure, and fundamentally limited: studying a new topology required rewiring the physical model, which could take days.

The digital computer changed this. In 1956, J.B. Ward and H.W. Hale at General Electric published the first practical paper on solving load flow problems using a digital computer. [2] They represented the power network as a set of algebraic equations and solved them iteratively on an early electronic computer — a process that took minutes rather than days of physical model construction. The formulation they introduced remains the basis of every commercial load flow program in use today.

To pose the problem mathematically, the network is treated as a set of **buses** (nodes) connected by **branches** (cables, overhead lines, and transformers). At each bus, the engineer specifies two known quantities and the load flow solves for two unknowns. There are three bus types.

**Slack bus** (reference bus, swing bus). The slack bus has a fixed voltage magnitude and fixed angle — typically $|V| = 1.000$ pu and $\theta = 0°$. All other voltage angles in the network are measured relative to this reference. Physically, the slack bus represents a grid connection so large that it can supply or absorb any amount of active and reactive power without changing its own voltage — the transmission system operator's network, in effect. In offshore wind networks, the PSE 400 kV interconnection bus is the slack.

**PV bus** (generator bus). A PV bus has specified active power injection $P_{sch}$ and specified voltage magnitude $|V_{sch}|$. The generator's turbine control maintains active output; its excitation or converter control maintains terminal voltage. In offshore wind, the aggregated WTG collector bus is modelled as a PV bus: the power plant controller holds active output at the dispatch setpoint, and the WTG converters regulate voltage.

**PQ bus** (load bus, passive node). A PQ bus has both $P_{sch}$ and $Q_{sch}$ specified. Intermediate buses with no local generation or load — the OSS 66 kV bus, the OSS 220 kV bus, the onshore 220 kV bus — carry $P_{sch} = Q_{sch} = 0$. Their voltage magnitude and angle are unknown and must be computed.

The unknowns across the network are: one voltage angle $\theta_i$ per non-slack bus, and one voltage magnitude $|V_i|$ per PQ bus (PV magnitudes are specified; the slack has both fixed). The load flow solution determines all unknowns simultaneously by satisfying the power balance at every bus.

<!-- IMAGE: fig-18-01 -->
> **Figure 18.1** — One-line diagram of the five-bus offshore wind farm network
> **Type:** schematic diagram
> **Content:** Five buses connected in a chain from left (Bus 5, WTG aggregate, 66 kV, labelled PV) to right (Bus 1, PSE Grid 400 kV, labelled SLACK). Intermediate buses: Bus 4 (OSS 66 kV, PQ), Bus 3 (OSS 220 kV, PQ), Bus 2 (Onshore 220 kV, PQ). Array cable branch (Bus 5→4): pi-model with small shunt capacitors. OSS transformer (Bus 4→3): ideal transformer symbol plus series reactance. Export cable (Bus 3→2): pi-model with large shunt capacitors labelled B/2 = 0.144 pu. Onshore transformer (Bus 2→1): series reactance. Each bus annotated with type label. Branch impedance values shown: export cable R = 0.010, X = 0.044, B/2 = 0.144 pu.
> **Caption:** Five-bus representation of the offshore wind farm electrical network. Bus 1 (PSE Grid) is the slack reference; Bus 5 (WTG aggregate) is a PV bus with fixed active output and voltage; the three intermediate OSS and onshore buses are PQ nodes. The large shunt capacitors on the export cable pi-model are the source of the reactive surplus the load flow must quantify.
> **Alt text:** Five-bus chain network from WTG aggregate at left to PSE grid at right, with bus type labels and branch impedance values.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Slack bus outlined in blue; PV bus in green; PQ buses in grey. Export cable shunt capacitors visually larger than array cable shunts.

---

## 18.2 The Admittance Matrix and the Power Balance Equations

The **Y-bus admittance matrix** encodes the complete electrical connectivity of the network in a single matrix. Element $Y_{ij}$ relates the current injected at bus $i$ to the voltage at bus $j$ when all other bus voltages are zero. The construction rules are:

$$
Y_{ii} = \sum_{j \neq i} y_{ij} + y_{sh,i}, \qquad Y_{ij} = -y_{ij} \quad (i \neq j)
$$

where:
- $Y_{ii}$ = diagonal admittance at bus $i$ [pu siemens]
- $Y_{ij}$ = off-diagonal admittance for branch $i$–$j$ [pu siemens]
- $y_{ij} = 1/(R_{ij} + jX_{ij})$ = series branch admittance [pu siemens]
- $y_{sh,i}$ = total shunt admittance at bus $i$ from pi-model half-shunts $= j\sum_k B_k/2$ [pu siemens]

The diagonal element is the sum of all admittances connected to a bus, including the shunt capacitances from the pi-model branches incident to it. The off-diagonal element is the negative of the branch admittance. For a chain network like the offshore wind farm, nearly every off-diagonal entry is zero — only adjacent buses are directly connected — producing a sparse, banded matrix that is fast to invert.

For the export cable branch (Bus 3 to Bus 2), the series admittance is:

$$
y_{32} = \frac{1}{R_{32} + jX_{32}} = \frac{1}{0.010 + j0.044} = \frac{0.010 - j0.044}{0.010^2 + 0.044^2} = 4.91 - j21.61 \text{ pu}
$$

The diagonal element at Bus 3 — which connects to Bus 2 (export cable), Bus 4 (OSS transformer), and receives one cable half-shunt — is:

$$
Y_{33} = y_{32} + y_{34} + j\tfrac{B_{32}}{2} = (4.91 - j21.61) + (0 - j7.14) + j0.144 = 4.91 - j28.61 \text{ pu}
$$

The large negative imaginary part (−j28.61) reflects the dominant inductive susceptance of the transformer and cable series branches. The shunt susceptance +j0.144 from the cable half-shunt is much smaller but physically important: it injects reactive current into Bus 3 regardless of load, lifting the bus voltage above 1.0 pu at all times.

From the Y-bus, the power injected at each bus is given by the **AC power flow equations**:

$$
P_i = |V_i| \sum_{j=1}^{n} |V_j| \bigl( G_{ij} \cos\theta_{ij} + B_{ij} \sin\theta_{ij} \bigr)
$$

$$
Q_i = |V_i| \sum_{j=1}^{n} |V_j| \bigl( G_{ij} \sin\theta_{ij} - B_{ij} \cos\theta_{ij} \bigr)
$$

where:
- $P_i, Q_i$ = net active and reactive power injected at bus $i$ [pu]
- $|V_i|, |V_j|$ = voltage magnitudes at buses $i$ and $j$ [pu]
- $\theta_{ij} = \theta_i - \theta_j$ = voltage angle difference between buses $i$ and $j$ [rad]
- $G_{ij} = \text{Re}(Y_{ij})$, $B_{ij} = \text{Im}(Y_{ij})$ = conductance and susceptance elements [pu]
- $n$ = total number of buses

These equations are transcendental: they contain products of unknowns ($|V_i| \cdot |V_j|$) and trigonometric functions of unknowns ($\cos\theta_{ij}$, $\sin\theta_{ij}$). There is no closed-form solution for a network of more than two buses. The equations must be solved iteratively: compute the mismatch between scheduled and calculated injections, adjust the voltage state, and repeat until the mismatch is negligible.

The load flow mismatch at each iteration $k$ is:

$$
\Delta P_i^{(k)} = P_{sch,i} - P_i^{calc,\,(k)}, \qquad \Delta Q_i^{(k)} = Q_{sch,i} - Q_i^{calc,\,(k)}
$$

Iteration stops when $\max_i|\Delta P_i|$ and $\max_i|\Delta Q_i|$ both fall below a convergence tolerance — typically $10^{-4}$ to $10^{-6}$ pu, corresponding to roughly 50–500 W of unbalanced power at the 500 MVA base.

<!-- IMAGE: fig-18-02 -->
> **Figure 18.2** — Y-bus admittance matrix structure for the five-bus network
> **Type:** matrix diagram with network reference
> **Content:** Left panel: 5×5 matrix. Diagonal elements Y_11 through Y_55 shaded blue; non-zero off-diagonal elements Y_12, Y_21, Y_23, Y_32, Y_34, Y_43, Y_45, Y_54 shaded grey; all other elements white (zero). Representative values annotated: Y_33 = 4.91 − j28.61 pu (Bus 3 diagonal); Y_32 = −4.91 + j21.61 pu (export cable off-diagonal). Right panel: the five-bus chain network with branch labels matching the matrix entries, showing which physical connection corresponds to each non-zero Y-bus element.
> **Caption:** Y-bus admittance matrix for the five-bus offshore wind farm network. The chain topology produces a sparse banded structure — only four off-diagonal pairs are non-zero. In a real 200-bus collector network, fewer than 3% of entries would be non-zero, enabling highly efficient sparse factorisation in commercial load flow solvers.
> **Alt text:** Five-by-five admittance matrix with diagonal and four off-diagonal pairs highlighted, corresponding to a five-bus chain network.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Diagonal in blue; non-zero off-diagonal in light grey; zero entries white.

---

## 18.3 Newton-Raphson and the Jacobian Matrix

The most widely used method for solving the load flow equations is Newton-Raphson iteration. Its application to power systems was developed by William F. Tinney and Charles E. Hart at the Bonneville Power Administration in Portland, Oregon, and published in 1967. [3] Before their paper, the standard method was Gauss-Seidel iteration, which updates bus voltages one at a time in sequence and converges slowly — typically requiring 50 to 100 iterations for large networks. Tinney and Hart demonstrated that Newton-Raphson converges in three to five iterations for the same networks, regardless of size. In an era when computer time was billed by the minute, this was not a marginal improvement but a change in kind.

The reason for the difference is the character of convergence. Gauss-Seidel converges linearly: the error reduces by a roughly constant factor each iteration. Newton-Raphson converges quadratically: the number of correct significant digits approximately doubles each iteration. A problem that takes 100 Gauss-Seidel iterations to reach a tolerance of $10^{-6}$ pu may require only five Newton-Raphson iterations. Tinney also developed sparse matrix ordering techniques — Tinney-Walker optimal elimination ordering — that made the linear solve at each Newton-Raphson step practical for large networks with thousands of buses. [3] These two contributions, taken together, made real-time power system computation feasible.

The Newton-Raphson method linearises the nonlinear mismatch equations around the current estimate and solves the linearised system. At iteration $k$, the update step is:

$$
\mathbf{J}^{(k)} \cdot \begin{bmatrix} \Delta\boldsymbol{\theta}^{(k)} \\[4pt] \Delta|\mathbf{V}|^{(k)} \,/\, |\mathbf{V}|^{(k)} \end{bmatrix} = \begin{bmatrix} \Delta\mathbf{P}^{(k)} \\[4pt] \Delta\mathbf{Q}^{(k)} \end{bmatrix}
$$

where:
- $\mathbf{J}^{(k)}$ = Jacobian matrix evaluated at the current state, dimension $(2n-2) \times (2n-2)$ for an $n$-bus network with one slack bus [pu/rad for upper blocks, dimensionless for lower]
- $\Delta\boldsymbol{\theta}^{(k)}$ = vector of voltage angle corrections [rad]
- $\Delta|\mathbf{V}|^{(k)}/|\mathbf{V}|^{(k)}$ = vector of normalised voltage magnitude corrections [pu]
- $\Delta\mathbf{P}^{(k)}, \Delta\mathbf{Q}^{(k)}$ = active and reactive mismatch vectors [pu]

The Jacobian matrix $\mathbf{J}$ has four sub-blocks, each a matrix of partial derivatives:

$$
\mathbf{J} = \begin{bmatrix} \dfrac{\partial \mathbf{P}}{\partial \boldsymbol{\theta}} & \dfrac{\partial \mathbf{P}}{\partial |\mathbf{V}|} \\[12pt] \dfrac{\partial \mathbf{Q}}{\partial \boldsymbol{\theta}} & \dfrac{\partial \mathbf{Q}}{\partial |\mathbf{V}|} \end{bmatrix}
$$

where:
- $\partial\mathbf{P}/\partial\boldsymbol{\theta}$ = how active power injections change with voltage angles [pu/rad]
- $\partial\mathbf{P}/\partial|\mathbf{V}|$ = how active power injections change with voltage magnitudes [pu/pu]
- $\partial\mathbf{Q}/\partial\boldsymbol{\theta}$ = how reactive power injections change with voltage angles [pu/rad]
- $\partial\mathbf{Q}/\partial|\mathbf{V}|$ = how reactive power injections change with voltage magnitudes [pu/pu]

Each element is computed analytically from the power flow equations using the current voltage state. The Jacobian changes at every iteration — this is what makes Newton's method nonlinear — and must be reformed and refactored at each step. For a well-conditioned offshore wind farm network, the Jacobian remains well-posed throughout the iteration, and convergence from a flat start ($|V_i| = 1.0$ pu, $\theta_i = 0°$ for all buses) is reliable.

<!-- IMAGE: fig-18-03 -->
> **Figure 18.3** — Newton-Raphson convergence versus Gauss-Seidel for the five-bus load flow
> **Type:** line chart, logarithmic y-axis
> **Content:** X-axis: iteration number 0–20. Y-axis: maximum power mismatch max(|ΔP|, |ΔQ|) in pu, logarithmic scale from 10⁰ to 10⁻⁸. Two curves: Newton-Raphson (solid blue) — drops from 1.0 at iteration 0 to below 10⁻⁶ by iteration 4, showing the characteristic quadratic-convergence steep drop; Gauss-Seidel (dashed orange) — decreases approximately linearly on the log scale, reaching 10⁻⁶ only after approximately 19–22 iterations. Horizontal dashed red line at 10⁻⁶ labelled "Convergence tolerance." NR data points labelled: Iter 0 (flat start, max mismatch ≈ 1.0 pu), Iter 1 (≈ 0.08), Iter 2 (≈ 5×10⁻⁴), Iter 3 (≈ 2×10⁻⁷), Iter 4 (< 10⁻⁶, converged).
> **Caption:** Convergence comparison for the five-bus offshore wind farm load flow. Newton-Raphson (blue) reaches the 10⁻⁶ pu tolerance in four iterations via quadratic convergence — the error squares each step. Gauss-Seidel (orange) requires approximately five times as many iterations. For a 1,000-bus transmission network, the advantage is proportionally larger.
> **Alt text:** Log-scale convergence chart showing Newton-Raphson reaching tolerance in four iterations and Gauss-Seidel requiring approximately twenty.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Newton-Raphson in blue; Gauss-Seidel in orange; tolerance line in red.

---

## 18.4 The DC Approximation: Speed at the Cost of Reactive Power

For applications that require many thousands of load flow calculations quickly — power market clearing, contingency ranking, long-term planning studies — the full AC Newton-Raphson solution is more detailed than necessary. The **DC power flow approximation** reduces the load flow to a linear system that is solved in a single matrix operation, with no iteration.

The DC approximation rests on three simplifying assumptions: all voltage magnitudes equal 1.0 pu; angle differences $\theta_{ij}$ are small enough that $\sin\theta_{ij} \approx \theta_{ij}$ and $\cos\theta_{ij} \approx 1$; and branch resistance is negligible compared to reactance, so conductance $G_{ij} \approx 0$. Under these assumptions the active power injection equation collapses to:

$$
P_i \approx \sum_{j \neq i} \frac{\theta_i - \theta_j}{X_{ij}} = \sum_{j \neq i} B_{ij}' \,(\theta_i - \theta_j)
$$

where:
- $P_i$ = active power injection at bus $i$ [pu]
- $\theta_i, \theta_j$ = voltage angles at buses $i$ and $j$ [rad]
- $X_{ij}$ = branch reactance [pu]
- $B_{ij}' = 1/X_{ij}$ = branch susceptance in the lossless approximation [pu]

In matrix form: $\mathbf{P} = \mathbf{B}' \boldsymbol{\theta}$, where $\mathbf{B}'$ is the reduced susceptance matrix, computed from branch reactances only. Solving for angles requires a single matrix factorisation: $\boldsymbol{\theta} = (\mathbf{B}')^{-1} \mathbf{P}$. Branch power flows then follow immediately: $P_{ij} = (\theta_i - \theta_j)/X_{ij}$. No iteration; no Jacobian; no convergence concern.

The DC approximation is the basis of every power market clearing algorithm in the European Union. ENTSO-E's flow-based market coupling, which clears the day-ahead energy market across the CWE, SWE, and CORE price zones, uses a linearised network model in which each transmission corridor is represented by a transfer sensitivity factor derived from the DC approximation. [4] The calculation runs for thousands of market scenarios per day; the per-cent-level inaccuracy of the approximation is acceptable in exchange for computational speed.

The DC approximation is fundamentally wrong for offshore wind farm network analysis. It ignores reactive power entirely: the cable shunt capacitances that inject 150 MVAR into the OSS bus, the STATCOM that absorbs them, the Ferranti voltage rise that determines equipment ratings — none of these appear in the DC solution. Using the DC approximation to design an offshore substation would produce correct active power flows and incorrect ratings for every piece of reactive compensation equipment in the building. It is the right tool for half the problems in power systems and the wrong tool for the other half, and knowing which is which is what distinguishes an engineer from a software user.

---

## 18.5 What Load Flow Reveals: Voltage, Losses, and Reactive Power

The converged AC load flow solution provides three categories of engineering information that are not available from any simpler calculation.

**Voltage profile.** The voltage magnitude at every bus determines whether equipment operates within rated limits. For the offshore wind farm network, the Ferranti effect produces a voltage profile that varies with generation output: at rated load, the inductive voltage drop across the export cable partially cancels the capacitive rise, and the OSS 220 kV bus sits near 1.02 pu. At half load, the capacitive effect dominates, and the voltage rises toward 1.04 pu. At zero load — wind calm, no active generation — the cable capacitance drives the OSS voltage toward 1.05 pu and beyond, exceeding the IEC 60038 nominal range. [5] The load flow calculates this voltage profile for every operating point, determining the compensation required at each condition. The no-load case sizes the minimum reactive absorption requirement; the rated-load case verifies that active compensation (STATCOM) is not driving the voltage below 0.95 pu.

**Active power losses.** Branch losses are computed from the converged solution using:

$$
P_{loss,ij} = G_{ij} \bigl( |V_i|^2 + |V_j|^2 - 2|V_i||V_j|\cos\theta_{ij} \bigr)
$$

where:
- $P_{loss,ij}$ = active power loss in branch $i$–$j$ [pu]
- $G_{ij}$ = branch conductance, $= R_{ij}/(R_{ij}^2 + X_{ij}^2)$ [pu]
- $|V_i|, |V_j|$ = bus voltage magnitudes [pu]
- $\theta_{ij} = \theta_i - \theta_j$ = voltage angle difference [rad]

This is the $I^2R$ loss formula expressed in bus quantities. In a typical 500 MW offshore wind farm, total transmission losses run 1.5–3.0% of gross generation: export cable I²R losses dominate (0.8–1.2%), followed by transformer iron and copper losses (0.5–0.8% combined), with array cable losses smaller (0.3–0.5%). [6]

**Reactive power balance.** The reactive power injection at each bus — positive from cable capacitances, negative from transformer leakage reactances and inductive loads — reveals what compensation is necessary and where. In the load flow solution, the PSE slack bus absorbs all uncompensated reactive surplus: if the slack absorbs 124 MVAR in the base case, that is precisely how much local compensation the STATCOM must provide to prevent the PSE connection point from operating outside the grid code's reactive power band. The load flow turns a physical phenomenon (cable charging) into a number that can be evaluated against a contractual requirement (PSE IRiESP power factor band) and sized into hardware (STATCOM MVA rating). [5]

<!-- IMAGE: fig-18-04 -->
> **Figure 18.4** — Voltage profile from WTG aggregate (Bus 5) to PSE grid (Bus 1) at three generation levels
> **Type:** line chart
> **Content:** X-axis: bus position from Bus 5 (left) to Bus 1 (right), labelled by name (WTG Aggregate / OSS 66 kV / OSS 220 kV / Onshore 220 kV / PSE Grid). Y-axis: voltage magnitude in pu, range 0.95–1.065. Three curves: Full load 500 MW (blue solid) — profile approximately flat, OSS 220 kV at 1.024 pu; Half load 250 MW (orange dashed) — OSS 220 kV at 1.038 pu; No load 0 MW (red dotted) — OSS 220 kV reaches 1.052 pu, above the 1.05 limit. Bus 1 pinned at 1.000 pu for all curves (slack). Red dotted curve annotated "STATCOM + shunt reactor required." Horizontal dashed grey line at 1.050 pu labelled "Typical grid code upper limit."
> **Caption:** Voltage magnitude along the network at three generation levels. At full load the inductive voltage drop roughly cancels the Ferranti rise; at no load the cable capacitance drives the OSS voltage above 1.05 pu. The no-load curve determines the minimum reactive absorption required from the STATCOM and shunt reactor (Chapter 20).
> **Alt text:** Line chart showing voltage rising at the OSS bus as generation decreases, with no-load voltage exceeding the grid code upper limit.
> **Data source:** Author illustration
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Full load in blue; half load in orange; no load in red. Grid code limit at 1.050 pu as dashed grey horizontal line.

A subtle point the load flow makes visible: reactive power flows in directions that the active power arrows on a one-line diagram do not indicate. Active power always flows from generator to grid — Bus 5 to Bus 1 in every operating condition. Reactive power flows simultaneously in all directions: the cable shunt capacitances inject Q toward both ends of the cable; transformer leakage reactances consume Q; the WTG converters absorb or generate Q depending on their control mode; the STATCOM injects or absorbs Q at the OSS bus. A load flow that tracks only active power — including every DC approximation — is blind to the dominant engineering challenge in the offshore substation. Reactive power is not an afterthought. It is the reason the substation is the size it is.

---

## 18.6 Worked Example: Tracing 500 MW from Blade to Grid

The following calculation traces the complete electrical path through the five-bus offshore wind farm network, from the WTG aggregate collector bus to the PSE grid connection, using Newton-Raphson load flow.

**System parameters (Sbase = 500 MVA)**

Voltage bases: Bus 1 = 400 kV, Buses 2–3 = 220 kV, Buses 4–5 = 66 kV.

| Branch | From–To | R (pu) | X (pu) | B/2 (pu) |
|--------|---------|--------|--------|---------|
| Array cables (aggregate) | 5–4 | 0.003 | 0.008 | 0.010 |
| OSS main transformer (66/220 kV) | 4–3 | 0 | 0.140 | 0 |
| Export cable (220 kV, 45 km) | 3–2 | 0.010 | 0.044 | 0.144 |
| Onshore transformer (220/400 kV) | 2–1 | 0 | 0.140 | 0 |

*Array cable aggregate parameters are derived from seven 66 kV strings, each approximately 5 km, 500 mm² conductor, modelled as a radial feeder with uniformly distributed generation (effective resistance ≈ R_string/3, per string). All values on 500 MVA base.*

**Bus scheduled data:**

| Bus | Name | Type | P_sch (pu) | Q_sch (pu) | \|V\|_sch (pu) |
|-----|------|------|-----------|-----------|--------------|
| 1 | PSE Grid | Slack | — | — | 1.000∠0° |
| 2 | Onshore 220 kV | PQ | 0 | 0 | solve |
| 3 | OSS 220 kV | PQ | 0 | 0 | solve |
| 4 | OSS 66 kV | PQ | 0 | 0 | solve |
| 5 | WTG Aggregate | PV | +1.000 | — | 1.020 |

**Step 1: Y-bus diagonal element, Bus 3 (illustrative)**

Bus 3 connects to Bus 2 via the export cable (series admittance $y_{32} = 4.91 − j21.61$ pu, shunt $+j0.144$ pu) and to Bus 4 via the OSS transformer ($y_{34} = 0 − j7.14$ pu):

$$
Y_{33} = y_{32} + y_{34} + j\tfrac{B_{32}}{2} = (4.91 - j21.61) + (-j7.14) + j0.144 = 4.91 - j28.61 \text{ pu}
$$

The large negative imaginary diagonal element (−j28.61) is dominated by the transformer and cable series reactances. The small positive shunt susceptance (+j0.144) injects capacitive reactive current at Bus 3 regardless of load.

**Step 2: Newton-Raphson solution**

Starting from a flat start ($|V_i| = 1.0$ pu, $\theta_i = 0°$ for all buses), Newton-Raphson converges in four iterations to a tolerance of $10^{-6}$ pu. The converged bus voltages are:

| Bus | Name | \|V\| (pu) | θ (°) | P_inj (MW) | Q_inj (MVAR) |
|-----|------|----------|-------|-----------|------------|
| 1 | PSE Grid (slack) | 1.000 | 0.00 | −490.2 | +124.3 |
| 2 | Onshore 220 kV | 1.018 | −1.74 | 0 | 0 |
| 3 | OSS 220 kV | 1.024 | −2.68 | 0 | 0 |
| 4 | OSS 66 kV | 1.019 | −3.15 | 0 | 0 |
| 5 | WTG Aggregate | 1.020 | −3.77 | +500.0 | −11.2 |

*Sign convention: positive injection = power entering the bus from generation; negative injection = power leaving the bus to the grid.*

**Step 3: Voltage profile interpretation**

The voltage angle at Bus 5 is −3.77° and at Bus 1 is 0°. This 3.77° angle difference drives 500 MW of active power from Bus 5 toward Bus 1 — power flows in the direction of decreasing angle, as it must for a lossless network (and approximately so for a low-resistance one). The OSS 220 kV bus (Bus 3) operates at 1.024 pu — higher than the WTG voltage of 1.020 pu. This is the Ferranti effect: the export cable capacitance lifts the OSS busbar voltage above the WTG terminal voltage even at full rated load. At zero load, the absence of inductive voltage drop would push Bus 3 to approximately 1.052 pu.

**Step 4: Active power losses**

$$
P_{gen} - P_{delivered} = 500.0 - 490.2 = 9.8 \text{ MW} \quad (1.96\% \text{ of gross generation})
$$

| Loss component | Approximate calculation | Value |
|----------------|------------------------|-------|
| Array cables ($I^2 R$) | $(1.00)^2 \times 0.003 \times 500$ | 1.5 MW |
| OSS main transformer | 0.3% of 500 MVA rated | 1.5 MW |
| Export cable ($I^2 R$) | $(0.985)^2 \times 0.010 \times 500$ | 4.8 MW |
| Onshore transformer | 0.3% of 500 MVA rated | 1.5 MW |
| Rounding | — | 0.5 MW |
| **Total** | | **9.8 MW** |

The export cable dominates: 4.8 MW, or 49% of total losses, from 45 km of copper at 0.010 pu resistance. Those 4.8 MW, valued at EUR 100/MWh over 4,500 full-load hours per year, cost EUR 2.16 million per year — EUR 64.8 million over a 30-year project life. Every additional 1 mm² of copper cross-section has a calculable payback period.

**Step 5: Reactive power balance**

| Source or sink | Value (MVAR) |
|----------------|-------------|
| Export cable, Bus 3 half-shunt: $|V_3|^2 \times 0.144 \times 500$ | +75.8 |
| Export cable, Bus 2 half-shunt: $|V_2|^2 \times 0.144 \times 500$ | +74.7 |
| Array cable shunts (both half-shunts) | +10.0 |
| Export cable inductance: $I^2 X$, consumed | −22.0 |
| OSS transformer leakage: consumed | −17.2 |
| Onshore transformer leakage: consumed | −16.8 |
| WTG converter absorption | −11.2 |
| **Net absorbed by PSE slack bus** | **−123.3** |
| **Total** | **0** |

The cable charging (160.5 MVAR gross, 150.5 MVAR from the export cable alone) is the dominant term. After the transformer reactances and WTG converters absorb their share, 123.3 MVAR flows to the PSE slack bus. In this pre-commissioning load flow, the slack bus absorbs that reactive power by definition — it is mathematically required. In physical operation, PSE's grid code charges a financial penalty for reactive exports at the connection point and requires the wind farm to operate within a power factor band of 0.95 leading to 0.95 lagging. The 123.3 MVAR surplus must be absorbed locally — at the OSS 220 kV bus — before it reaches the export cable. That is the STATCOM's job. Chapter 20 will size it exactly.

---

## Key Takeaways

- **Load flow solves for voltage magnitude and angle at every bus simultaneously**, given the scheduled active and reactive power at each bus. The slack bus (PSE grid connection) provides the voltage reference and absorbs all active and reactive mismatches by definition — including transmission losses and capacitive reactive surplus. The load flow's output is the complete electrical state of the network.

- **The Y-bus admittance matrix encodes network topology in a single sparse matrix.** Diagonal elements equal the sum of all admittances at a bus (including cable shunt capacitances); off-diagonal elements equal the negative of each branch admittance. For offshore wind farm chain topologies, the Y-bus is nearly diagonal — fewer than 10% of entries are non-zero — enabling fast factorisation.

- **Newton-Raphson converges quadratically: three to five iterations from a flat start, regardless of network size.** Tinney and Hart (1967) demonstrated this advantage over the then-standard Gauss-Seidel method, which required 50–100 iterations for large networks. Every commercial load flow solver — PSS/E, PowerWorld, pandapower — uses Newton-Raphson or a derivative. Sparse matrix techniques (Tinney-Walker ordering) make the Jacobian solve efficient for networks with thousands of buses.

- **The DC approximation linearises load flow by assuming flat voltage profile and lossless network ($P = B'\theta$), enabling single-solve speed.** It is accurate for active power flows in well-regulated transmission networks and forms the basis of European power market clearing. It is entirely blind to reactive power, cable charging, voltage rise, and STATCOM sizing — making it inappropriate for offshore substation design.

- **A 500 MW offshore wind farm loses approximately 2% of gross generation in transmission.** Export cable I²R losses dominate (approximately 5 MW). The reactive surplus from cable capacitance (approximately 130 MVAR total, 75 MVAR at the OSS bus) is a larger engineering challenge than the active losses: it determines the STATCOM rating, sizes the shunt reactor, and must be managed to within the TSO's reactive power band at the grid connection point.

---

## For Further Reading

- **Tinney, W.F. and Hart, C.E. (1967).** "Power Flow Solution by Newton's Method." *IEEE Transactions on Power Apparatus and Systems*, Vol. PAS-86, No. 11, pp. 1449–1460, November 1967. The paper that established Newton-Raphson as the industry-standard load flow algorithm. Compact (twelve pages), readable with undergraduate linear algebra. Tinney's companion 1967 paper on optimal ordering ("Optimal Orderings of Network Matrix Factorizations," *IEEE Trans. PAS*, Vol. PAS-86, pp. 2042–2048) provides the sparse matrix techniques that make Newton-Raphson practical at scale. Both available through IEEE Xplore.

- **Glover, J.D., Sarma, M.S., and Overbye, T.J. (2017).** *Power Systems Analysis and Design.* 6th ed. Cengage Learning. Chapter 6 covers bus types, Y-bus construction, Gauss-Seidel, Newton-Raphson, and the fast-decoupled load flow with worked examples. The accompanying PowerWorld Simulator software allows interactive load flow analysis of the five-bus network used in this chapter. ISBN: 978-1-305-63213-4.

- **Thurner, L., Scheidler, A., Schäfer, F., et al. (2018).** "pandapower — An Open-Source Python Tool for Convenient Modeling, Analysis, and Optimization of Electric Power Systems." *IEEE Transactions on Power Systems*, Vol. 33, No. 6, pp. 6510–6521. DOI: 10.1109/TPWRS.2018.2829021. The five-bus system in this chapter can be built and solved in approximately twenty lines of pandapower Python code. The library's `runpp()` function uses Newton-Raphson by default and reports bus voltages, branch flows, and loss breakdowns in a format directly comparable to this worked example.

---

*Anders printed the load flow result on a single sheet of paper — five rows, ten columns — and handed it to Kaan.*

*"This is your map," he said. "Every number is a voltage, an angle, a power. The active power column shows where the watts go — five hundred million watts in, four hundred and ninety million out, and the nine million between them are converted to heat in the resistance of copper wire and the magnetising current of silicon steel." He pointed to the rightmost column. "Now look at the reactive power column."*

*Kaan looked. Bus 1: plus 124.3 MVAR. Bus 5: minus 11.2 MVAR. Buses 2, 3, 4: zero by construction — they were passive nodes with no local generation or load.*

*"The PSE grid is absorbing a hundred and twenty-four megavars from us."*

*"Yes."*

*"Is that a problem?"*

*"It will become one." Anders picked up the sheet and folded it once. "PSE is tolerating it today because we are in pre-commissioning and the reactive power requirement does not yet apply. Once we achieve grid code compliance, we must operate within a power factor band at the connection point. We cannot export a hundred and twenty-four megavars to the national grid and expect no consequences." He set the folded sheet on the workstation. "Which is why that room exists."*

*He gestured across the corridor. A grey metal door with a small observation window. A cooling fan visible through the glass. A label: STATCOM — HIGH VOLTAGE AREA — AUTHORISED PERSONNEL ONLY.*

*"What is in there?"*

*"A hundred and eighty megavars of power electronics whose only purpose is to manage the number you just asked about." Anders retrieved his jacket from the back of the chair. "But before we open that door, you need to understand why the voltage at Bus 3 is 1.024 pu when the cable has resistance and inductance working against it. You need to understand the Ferranti effect quantitatively — not the name Elif gave you in Chapter 4, but the exact mechanism, and why it becomes worse the moment the wind stops." He held the door open. "That is Chapter 20. But first, Chapter 19: what happens when the fault current exceeds every rating we computed this morning."*

*Kaan tucked the printed load flow result into his notebook between the blank pages he had intended to fill with the pencil. He had not written a single number by hand. He had not needed to. The computer had solved four iterations of a nonlinear system and handed him the complete electrical state of a 500 MW power plant on a single sheet of paper. The pencil had been wrong equipment.*

*But looking at those numbers — the 1.024 at Bus 3, the 124 MVAR being quietly absorbed by a grid connection sixty kilometres away, the 9.8 MW dissolving into heat in cables he could not see — he understood why Anders had told him to bring one. Not to write the answer. To understand what the answer meant.*

---

## Notes

[1] AC network analysers at MIT, GE, and Westinghouse: the MIT network analyser laboratory, described by Gordon S. Brown and Campbell in the 1930s publications, was capable of modelling networks of up to approximately 200 buses. The GE network analyser in Schenectady and the Westinghouse analyser in East Pittsburgh were used for utility planning studies through the early 1950s. Source: Cohn, N. (1971). *Control of Generation and Power Flow on Interconnected Systems.* Wiley, New York, Chapter 1. For institutional history: IEEE History Center, Rutgers University, Piscataway, NJ — records of analogue network analyser installations. For a contemporary account: Harder, E.L. and Cheek, R.C. (1950). "Regulation of Recovering Power Systems." *AIEE Transactions*, Vol. 69.

[2] Ward, J.B. and Hale, H.W. (1956). "Digital Computer Solution of Power Flow Problems." *AIEE Transactions, Part III — Power Apparatus and Systems*, Vol. 75, No. 3, pp. 398–404. Presented at the AIEE Winter General Meeting, New York, January–February 1956. Ward was at the General Electric Company, Schenectady, NY. The paper used the Gauss-Seidel method with nodal admittance matrix representation — the formulation that remains standard today, even though Newton-Raphson replaced the solution method. Available through IEEE Xplore (historical archive, pre-1963 AIEE Transactions).

[3] Tinney, W.F. and Hart, C.E. (1967). "Power Flow Solution by Newton's Method." *IEEE Transactions on Power Apparatus and Systems*, Vol. PAS-86, No. 11, pp. 1449–1460, November 1967. Tinney worked at Bonneville Power Administration (BPA), Portland, Oregon. The quadratic convergence demonstration and comparison with Gauss-Seidel form the core of the paper. For sparse matrix ordering: Tinney, W.F. and Walker, J.W. (1967). "Direct Solutions of Sparse Network Equations by Optimally Ordered Triangular Factorization." *Proceedings of the IEEE*, Vol. 55, No. 11, pp. 1801–1809, November 1967. DOI: 10.1109/PROC.1967.6011. These two 1967 papers together enabled large-scale digital power system computation. Both available through IEEE Xplore.

[4] DC power flow in European market clearing: ENTSO-E (2021). "Explanatory Note on the Flow-Based Market Coupling Algorithm." ENTSO-E, Brussels. The flow-based methodology uses power transfer distribution factors (PTDFs) derived from the DC load flow approximation; each is a linearised sensitivity of branch flow to bus injection. For a rigorous analysis of DC approximation accuracy: Stott, B., Jardim, J., and Alsac, O. (2009). "DC Power Flow Revisited." *IEEE Transactions on Power Systems*, Vol. 24, No. 3, pp. 1290–1300. DOI: 10.1109/TPWRS.2009.2021235. Stott was also the author of the fast decoupled load flow (1974), the second most important load flow algorithm after Newton-Raphson.

[5] IEC 60038:2009. "IEC Standard Voltages." Table 3: for 220 kV nominal systems, the highest voltage for equipment is 245 kV, and the operational range is ±10% of nominal (198–242 kV). PSE IRiESP (Instrukcja Ruchu i Eksploatacji Sieci Przesyłowej, 2021 edition): voltage at the point of connection must remain within 0.90–1.10 pu during normal operation; reactive power band 0.95 leading to 0.95 lagging at rated active output. Source: PSE S.A. (2021), pse.pl. ENTSO-E Network Code on Requirements for Generators (NC RfG), EU Regulation 2016/631, Article 14 (Type D, reactive power capability at connection point).

[6] Active power loss benchmarks for offshore wind farms: typical aggregate transmission losses for a 500 MW farm with 220 kV export cable: 1.5–2.5% of gross AEP. Component breakdown: array cables 0.3–0.5%, OSS main transformers 0.3–0.5%, export cables 0.8–1.2%, onshore transformers 0.2–0.3%. Source: CIGRÉ Working Group B3.36 (2015). "Offshore Substations for Wind Farms." CIGRÉ Technical Brochure 636, Paris. For export cable loss optimisation: Lundberg, S. (2003). "Performance Comparison of Wind Park Configurations." Chalmers University of Technology, Technical Report, Göteborg. For transformer loss standards: IEC 60076-7:2018, "Power transformers — Part 7: Loading guide for mineral-oil-immersed power transformers."

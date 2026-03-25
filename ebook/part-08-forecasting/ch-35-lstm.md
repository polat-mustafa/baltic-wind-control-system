# Chapter 35: LSTM — When the Network Remembers

*Kaan arrived Wednesday at 07:40 to find the data lab lights already on and Jonasz standing at the whiteboard with a dry-erase marker in his hand and no coffee in sight — which, Kaan had learned in three days, was unusual. Jonasz operated from a steel thermos that appeared at 06:30 and departed empty by 10:00. The absence of the thermos meant he had been here long enough to finish it.*

*The whiteboard had a new diagram. A horizontal chain of boxes labeled h₀, h₁, h₂, and continuing with dots to h₁₄₄. Below each box, a vertical arrow pointed upward from below, labeled x_t. Above each box, a vertical arrow pointed upward into the air, labeled ŷ_t or nothing, depending on whether a prediction was produced at that step. Between each adjacent pair of boxes, a rightward horizontal arrow. The structure was clean, almost elegant. It looked, Kaan thought, like the kind of diagram that appears in a textbook after a concept has been made to seem much simpler than it actually is.*

*"What is the problem with this picture?" Jonasz asked. He did not say good morning.*

*Kaan studied the diagram. He counted the horizontal arrows. There were 143 of them, each connecting one box to the next in the chain. He thought about backpropagation — the algorithm that computed how much to adjust each weight by tracing the loss gradient backward through the network from the prediction at the end to the inputs at the beginning. In a chain this long, the gradient would pass through 143 nonlinear functions on its way back. Each passage would multiply the signal by a derivative value. The derivative of a tanh activation is bounded between zero and one.*

*"If the derivative at each step is less than one," Kaan said slowly, "and you multiply it 143 times, the gradient gets very small."*

*"Very small," Jonasz confirmed. He uncapped a red marker. "Or?"*

*Kaan thought for a moment. "Or if the weights are large enough, the derivative product grows. Very large."*

*"Very large. Both are problems." Jonasz circled the chain of horizontal arrows in red. "In 1991, a twenty-two-year-old diploma student at TU Munich identified this as the fundamental obstacle to making recurrent networks useful for long sequences. He wrote it up in his thesis — in German — and spent the next six years figuring out what to do about it. We will get to his solution in forty minutes. First I want to make sure you understand what the problem actually is."*

*He capped the red marker and picked up a blue one. Below the original chain diagram, he drew a second version: the same boxes, the same input arrows, the same output arrows. But now, through the centre of each box, a straight horizontal line passed without bending. And hanging off that line — four small rectangles, each labeled with a single Greek letter or symbol.*

*"This is the fix," Jonasz said. He drew a thermos-shaped outline in the corner of the board and wrote: EMPTY. "There is more coffee in the machine on level two. I do not recommend it. But if you bring two cups, I will tell you what that horizontal line is for."*

*Kaan had already turned toward the door.*

---

## 35.1 The Sequence Prediction Problem

Wind power forecasting is, at its core, a sequence prediction problem. Not in the trivial sense that wind speed measurements happen to arrive in chronological order, but in the deeper sense that the atmospheric state at any moment is causally linked to the states that preceded it. A low-pressure front moving across the Baltic does not arrive instantaneously: it travels at roughly 40–60 km/h across the surface, preceded by a backing wind shift, accompanied by a pressure gradient that the farm's meteorological tower registers as a slow, progressive change over hours. The marine atmospheric boundary layer — the thin region of turbulent air, typically 200–600 metres deep, within which offshore turbines operate — responds to pressure gradient changes over timescales of one to six hours. A wind speed observation at 08:00 is not an independent draw from some distribution; it is a consequence of what happened at 06:00, 04:00, and 02:00.

This is why the Chapter 34 XGBoost model used lag features: 6-step (1-hour) and 12-step (2-hour) lagged wind speed values, included as additional columns in the feature matrix, gave the model access to recent history. The approach is pragmatic and it works well at short horizons. But it rests on an approximation that becomes increasingly costly as the forecast horizon extends: it treats each ten-minute record as an independent observation, and represents "memory" by manually encoding a fixed number of past values as static columns. The model itself has no architecture for processing a sequence; it applies the same learned function to each row regardless of what came before.

The specific failure mode reveals the approximation's limits. In the Chapter 34 results, the XGBoost MAPE error curve at the one-hour horizon was 4.1%, respectable and well within the range that most commercial forecasting systems achieve with similar feature engineering. At six hours it was 5.7%. At twelve hours it was 7.1%. At twenty-four hours it was 7.4%. The degradation is smooth but structural: lag features that describe the state two hours ago carry increasingly little predictive information about the state twelve or twenty-four hours from now. Beyond roughly a twelve-hour horizon, the atmospheric system that produced the current observations may have been replaced by a different system entirely. The lag feature vector is pointing at the past of one regime and trying to predict the future of another.

What would it mean for a model to have genuine memory, rather than a bag of lagged features? It would mean representing the trajectory of atmospheric states over the entire lookback window — not their snapshot values at a small number of fixed lags, but the shape, direction, and rate of change of the sequence — and updating that representation at each new observation. A low-pressure system arriving from the southwest would leave a signature in the trajectory: wind backing from south to southwest to west, pressure falling, temperature dropping, turbulence intensity rising. A model that had learned to recognise this signature — embedded in the sequence itself rather than in any individual snapshot — could extrapolate the trajectory forward with information unavailable to a model that considers each row independently.

That is what a recurrent neural network promises to provide. Whether it can deliver on that promise across a 24-hour, 144-timestep sequence depends on a problem that took six years to solve.

---

## 35.2 Recurrent Networks and the Vanishing Gradient

The idea of feeding a network's own output back as input is older than deep learning. In 1986, Michael Jordan at the University of California San Diego described a recurrent architecture in which the output from the previous timestep was concatenated with the current input and fed into a standard feedforward network.[^1] The Jordan network was conceived for sequence generation tasks — producing outputs in the correct order given a serial structure — and demonstrated that recirculating information from previous predictions could improve performance on tasks with temporal dependencies.

Four years later, Jeffrey Elman at UCSD refined this into an architecture that would become the canonical simple RNN. In a 1990 paper titled "Finding Structure in Time," published in *Cognitive Science*, Elman introduced the context layer: instead of recirculating the output, the network recirculated the previous hidden state — an internal representation that the network had learned, rather than the raw output it had produced.[^2] This was a meaningful distinction. The hidden state encodes whatever features the network has found useful; the output is merely a projection from that space. Elman demonstrated that his network could learn grammatical structure in sequence data, identifying dependencies between elements separated by several timesteps.

The simple RNN hidden state update takes the following form. At each timestep t, the new hidden state is computed from the previous hidden state and the current input:

$$h_t = \tanh\!\left(W_h\, h_{t-1} + W_x\, x_t + b\right)$$

where:
- $h_t \in \mathbb{R}^d$ = hidden state vector at timestep $t$
- $h_{t-1} \in \mathbb{R}^d$ = hidden state from the previous timestep
- $x_t \in \mathbb{R}^p$ = input feature vector at timestep $t$ ($p = 18$ features in the wind application)
- $W_h \in \mathbb{R}^{d \times d}$ = recurrent weight matrix, learned during training
- $W_x \in \mathbb{R}^{d \times p}$ = input weight matrix, learned during training
- $b \in \mathbb{R}^d$ = bias vector
- $\tanh(\cdot)$ = hyperbolic tangent activation, squashing the linear combination to the interval $(-1, +1)$

This looks straightforward, and for sequences of five or ten timesteps it works reasonably well. For sequences of 144 timesteps — 24 hours of ten-minute observations — it does not, and the reason is precise.

Training a neural network requires computing the gradient of the loss with respect to every parameter. For parameters in the recurrent weight matrix $W_h$, this means computing how much the loss at the final timestep is affected by the hidden state at each earlier timestep. Backpropagation through time (BPTT) traces this gradient backward through the entire unrolled chain. The gradient of the loss $\mathcal{L}$ with respect to the hidden state $k$ steps before the final timestep involves a product of $k$ Jacobian matrices:

$$\frac{\partial \mathcal{L}}{\partial h_{t-k}} = \left(\prod_{i=t-k+1}^{t} \frac{\partial h_i}{\partial h_{i-1}}\right) \frac{\partial \mathcal{L}}{\partial h_t}$$

where each factor $\partial h_i / \partial h_{i-1} = W_h^\top \cdot \operatorname{diag}[\tanh'(h_i)]$ is a matrix product involving $W_h^\top$ and the diagonal matrix of tanh derivatives. The tanh derivative $\tanh'(z) = 1 - \tanh^2(z)$ is bounded in $(0, 1]$, equalling 1 only at $z = 0$ and decaying toward 0 as $|z|$ grows. For a 24-hour sequence, this product has 143 factors.

The outcome depends on the spectral norm of $W_h$ — roughly speaking, its largest singular value. If the spectral norm is less than 1, the gradient product shrinks exponentially with $k$: at $k = 143$ with spectral norm 0.95, the gradient magnitude is approximately $0.95^{143} \approx 5 \times 10^{-7}$, effectively zero. The optimiser cannot use it to update parameters that influence early-sequence hidden states. If the spectral norm is greater than 1, the product grows exponentially: gradient explosion, requiring clipping or careful initialisation to avoid numerical divergence. The stable region — where the spectral norm stays exactly 1 across all updates — is a narrow manifold that becomes harder to maintain as the sequence grows longer.

In 1994, Yoshua Bengio, Patrice Simard, and Paolo Frasconi at the Université de Montréal published a formal analysis of this situation in *IEEE Transactions on Neural Networks*.[^3] Their result was not a practical observation about training difficulty; it was a mathematical proof. They showed that simple recurrent networks face a fundamental dilemma: long-term dependencies require the recurrent weight matrix to maintain gradient signal across many timesteps, but this requires the spectral norm to stay near 1, and a spectral norm near 1 makes it difficult for the network to learn the very short-term dependencies that constitute most of the training signal. The network tends toward one failure mode or the other depending on initialisation. Their conclusion was explicit: simple recurrent architectures cannot reliably learn dependencies longer than roughly five to ten timesteps. For a 144-timestep wind forecasting sequence, this means the first twelve to eighteen hours of the lookback window contribute almost nothing to training.

Bengio received the Turing Award in 2018, shared with Geoffrey Hinton and Yann LeCun, partly for this body of foundational work on deep learning and neural network training. The problem he proved essentially unsolvable in 1994 had, by extraordinary coincidence, already been solved — though not yet published — by a twenty-two-year-old student in Munich three years earlier.

<!-- IMAGE: fig-35-1 -->
> **Figure 35.1** — Vanishing Gradient in a Standard RNN Over 144 Timesteps
> **Type:** Line chart / semi-logarithmic plot
> **Content:** Two y-axes on a semi-log scale. Left panel: gradient magnitude ‖∂L/∂h_{t-k}‖ vs. k (steps back), showing exponential decay from 1.0 at k=0 to ~10⁻⁷ at k=144, for spectral norm = 0.95 (solid line) and spectral norm = 1.05 (dashed, showing explosion). Right panel: same calculation for LSTM, showing gradient magnitude remaining near 1.0 across all k values due to the cell state pathway. X-axis: timesteps back from 0 to 144 (24 hours). Annotation at k=144: "XGBoost lag coverage ends here."
> **Caption:** The vanishing gradient in a simple RNN (left) compared to the LSTM (right) across a 144-timestep, 24-hour sequence. At k=144 steps back, the RNN gradient has been multiplied by a value less than 1 exactly 143 times; at spectral norm 0.95, the gradient magnitude is approximately 5×10⁻⁷ — too small for the optimiser to update early-sequence parameters.
> **Alt text:** Semi-logarithmic plot showing exponential gradient decay in standard RNN versus near-constant gradient magnitude in LSTM across 144 timesteps.
> **Data source:** Author illustration — analytical gradient norms from equations in Section 35.2
> **Resolution:** 1400 × 700 px minimum
> **Color notes:** RNN vanishing: orange (#FF7043); RNN exploding: red dashed (#F44336); LSTM stable: blue (#1565C0)

---

## 35.3 The LSTM Solution: Gates and Cell State

Sepp Hochreiter was twenty-two years old and a diploma student at the Technische Universität München when, in 1991, he submitted his thesis: *Untersuchungen zu dynamischen neuronalen Netzen* — Investigations into Dynamic Neural Networks.[^4] Working under the supervision of Jürgen Schmidhuber, then at TU Munich and later director of the Swiss AI Lab IDSIA in Lugano, Hochreiter had independently identified the vanishing gradient problem and characterised it mathematically — three years before Bengio's published proof. His thesis, written in German and circulated as an internal document, showed analytically why backpropagation through time fails for long sequences, and proposed the conceptual shape of a solution: an architecture that allows gradient signals to flow backward without passing repeatedly through a saturating nonlinearity.

It took six years to develop that concept into a working algorithm. The LSTM paper — Long Short-Term Memory — was published in *Neural Computation* in 1997, co-authored by Hochreiter and Schmidhuber.[^5] It described a complete recurrent architecture with four interacting components per cell: three gating mechanisms and a cell state that carries information forward through the sequence. The paper has been cited over 100,000 times, making it one of the most cited papers in computer science history. Hochreiter later moved to Johannes Kepler University Linz, where he leads the Institute for Machine Learning.

Before reading the equations, it helps to understand what problem the architecture is designed to solve and why the solution has the shape it does. The vanishing gradient arises because gradient signals must pass through 143 applications of the recurrent weight matrix and 143 applications of a saturating activation function. The LSTM's solution is surgical: introduce a pathway through which the gradient can travel backward without passing through either of those things. This pathway is the cell state.

The cell state $c_t \in \mathbb{R}^d$ is a vector that flows from left to right through the unrolled sequence. It is updated not through matrix multiplication followed by tanh, but through two simpler operations: elementwise multiplication (to selectively forget) and elementwise addition (to selectively write new information). The gradient of the cell state at time $t$ with respect to the cell state at time $t-1$ is simply $\operatorname{diag}(f_t)$ — a diagonal matrix of forget gate values, each in $(0, 1)$. No weight matrix multiplication. No tanh saturation. The gradient flows backward through this path with attenuation controlled entirely by how open the forget gate is, not by the geometry of the weight matrices.

Three gates mediate what is written to, retained in, and read from the cell state. Each gate is a vector of values in $(0, 1)$, computed by a sigmoid function applied to the current input and previous hidden state. A gate value near 0 blocks information; a gate value near 1 passes it.

The forget gate, input gate, candidate cell value, and cell state update are computed together. The forget gate decides what fraction of the previous cell state to retain. The input gate controls the magnitude of the update. The candidate cell value proposes new information to be written:

$$f_t = \sigma\!\left(W_f\, [h_{t-1},\, x_t] + b_f\right)$$

$$i_t = \sigma\!\left(W_i\, [h_{t-1},\, x_t] + b_i\right), \qquad \tilde{c}_t = \tanh\!\left(W_c\, [h_{t-1},\, x_t] + b_c\right)$$

$$c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t$$

where:
- $f_t \in (0,1)^d$ = forget gate vector; value near 0 discards the corresponding cell state dimension, value near 1 retains it
- $\sigma(\cdot)$ = sigmoid activation, $\sigma(z) = 1/(1 + e^{-z})$, mapping any real value to $(0, 1)$
- $[h_{t-1},\, x_t]$ = concatenation of the previous hidden state and current input into a single vector
- $i_t \in (0,1)^d$ = input gate vector, controlling the write magnitude for each cell state dimension
- $\tilde{c}_t \in (-1,+1)^d$ = candidate cell state, representing new information proposed for storage
- $\odot$ = elementwise (Hadamard) product
- The critical property: the gradient $\partial c_t / \partial c_{t-1} = \operatorname{diag}(f_t)$ — a diagonal scaling, not a full matrix-tanh product — which allows gradient signals to travel backward through arbitrarily long sequences without vanishing

The output gate then controls how much of the current cell state is exposed as the hidden state output at this timestep:

$$o_t = \sigma\!\left(W_o\, [h_{t-1},\, x_t] + b_o\right), \qquad h_t = o_t \odot \tanh(c_t)$$

where:
- $o_t \in (0,1)^d$ = output gate vector, controlling what fraction of the stored cell state is passed to the output
- $h_t \in (-1,+1)^d$ = hidden state output, passed both to the prediction layer and to the next timestep as $h_{t-1}$

The functional role of each gate is worth stating plainly, because the abstractions map naturally onto the wind forecasting application. The forget gate decides when a previous wind regime is no longer relevant: a diurnal sea-breeze pattern that dominated the previous eighteen hours will be progressively written toward zero when a synoptic-scale front arrives and the atmospheric dynamics change. The input gate and candidate together control what new information is written: when the pressure gradient steepens and the wind direction backs, the model writes a representation of this new state into the appropriate cell state dimensions with magnitude proportional to how much the input gate is open. The output gate determines what portion of the accumulated representation is exposed at each timestep: a weather system approaching the farm that will affect production in twelve hours might already be encoded in the cell state while the output gate holds most of it back, producing a prediction that does not yet reflect the impending change — until the front is close enough that the model has learned to open the output gate.

A brief note on the name, because it is frequently misunderstood. Long Short-Term Memory does not describe a network with both long memory and short memory, operating simultaneously. It describes a network that solves the problem of short-term memory — the standard RNN forgets after a few steps because the gradient vanishes and the weights cannot hold information across long intervals. The "long" modifies the failure mode being fixed: long-lasting short-term memory, as opposed to the very brief short-term memory of an ordinary RNN. The name is not a description of what the architecture does. It is the name of the problem it was built to solve.

<!-- IMAGE: fig-35-2 -->
> **Figure 35.2** — LSTM Cell Architecture: Gates, Cell State, and Hidden State
> **Type:** Schematic / annotated flow diagram
> **Content:** Single LSTM cell unrolled over three timesteps (t-1, t, t+1). For the central cell at time t: horizontal cell state line c_t runs straight through the cell with ⊕ (additive update) and ⊙ (forget gate multiplication) operations. Input enters from bottom left (x_t concatenated with h_{t-1}). Three gate branches: left (forget gate f_t, sigmoid block), centre (input gate i_t + candidate c̃_t, sigmoid + tanh blocks), right (output gate o_t, sigmoid block). Hidden state h_t exits upward and rightward to the next cell. The cell state line is drawn in blue running horizontally; the hidden state loop in orange. Gate computation blocks are labelled with their activation functions.
> **Caption:** The LSTM cell at timestep t. The horizontal cell-state line (blue) carries information forward through only elementwise multiplication and addition — no full matrix multiplication through a saturating activation — which allows gradient signals to travel backward through arbitrarily long sequences without vanishing.
> **Alt text:** Diagram of LSTM cell showing three gates controlling information flow into and out of a horizontal cell state line, with hidden state output.
> **Data source:** Author illustration based on Hochreiter & Schmidhuber (1997)
> **Resolution:** 1400 × 900 px minimum
> **Color notes:** Cell state line in blue (#2196F3); hidden state in orange (#FF9800); sigmoid gates in green (#4CAF50); tanh in red (#F44336)

---

## 35.4 Architecture for Wind Power Forecasting

Three architectural decisions determine most of the LSTM's performance on a 24-hour wind power forecasting task. Each has a physical justification, not merely an empirical one.

**Lookback window: 144 timesteps (24 hours).** The choice of 24 hours corresponds to one full diurnal cycle — the period over which the sea-surface temperature gradient, the Coriolis effect, and the solar heating of the coastal land mass produce a repeating pattern in the marine atmospheric boundary layer. An LSTM trained with a 24-hour lookback window has access to the full previous cycle: it can recognise that the wind increased during the morning transition, held steady through the afternoon, and is now beginning the evening slowdown typical of stable stratification after sunset. Cross-validation over lookback windows of 72, 144, and 288 timesteps (12, 24, and 48 hours) shows diminishing improvement beyond 144: the 288-timestep model achieves MAPE improvements of less than 0.2 percentage points over the 144-timestep model at a training cost roughly 40% higher.

**Stacked layers: two LSTM layers, hidden dimension d = 128.** A single LSTM layer learns to represent temporal structure in the raw 18-feature input: pressure gradients, wind speed ramps, turbulence evolution. A second layer, taking the output sequence of the first as its input, learns higher-order patterns in those representations — sequences of patterns, rather than sequences of raw features. Empirically, stacking two layers reduces 24-hour MAPE by approximately 0.4 percentage points relative to a single layer with the same total parameter count. Beyond two layers, improvement is negligible for this application. A three-layer LSTM trains more slowly, is more prone to overfitting on the available dataset, and provides no measurable accuracy benefit at any forecast horizon tested.

**Monte Carlo Dropout for uncertainty quantification.** Jonasz had flagged this during the previous session's discussion of XGBoost confidence intervals, where the model produced only point estimates. A LSTM model with a single inference pass produces a single number — no indication of confidence. For grid operations, this is insufficient. A 200 MW prediction with no error bound is less useful than a 200 MW prediction with a stated 90% interval of ±30 MW under stable conditions or ±100 MW during a frontal passage.

The Monte Carlo Dropout approach was formalised by Yarin Gal and Zoubin Ghahramani at the University of Cambridge in a 2016 paper at the International Conference on Machine Learning.[^6] The key insight is that a neural network with dropout — randomly zeroing a fraction of layer outputs during training — is mathematically equivalent, under certain conditions, to a specific type of Bayesian approximation over neural network weights. The practical implication is that if you keep dropout active during inference (not just training) and run the same input through the network multiple times with different random dropout masks, the resulting distribution of predictions approximates the model's posterior uncertainty over the output.

The prediction mean and variance across $N_{\text{MC}} = 100$ Monte Carlo forward passes are:

$$\hat{y} = \frac{1}{N_{\text{MC}}} \sum_{n=1}^{N_{\text{MC}}} \hat{y}_n, \qquad \sigma_{\text{MC}}^2 = \frac{1}{N_{\text{MC}}-1} \sum_{n=1}^{N_{\text{MC}}} (\hat{y}_n - \hat{y})^2$$

where:
- $\hat{y}$ = mean prediction across all MC dropout samples [MW]
- $\sigma_{\text{MC}}^2$ = MC dropout sample variance, approximating epistemic uncertainty [MW²]
- $N_{\text{MC}} = 100$ forward passes, sufficient for stable interval estimates (additional passes beyond 100 change the variance estimate by less than 1% on this dataset)
- The 90% prediction interval is $[\hat{y} - 1.645\,\sigma_{\text{MC}},\;\hat{y} + 1.645\,\sigma_{\text{MC}}]$, using the standard normal quantile for a two-tailed 90% interval

The connection to Helena Voss's P90 analysis from Chapter 12 is not accidental. When Helena showed the bank's financing committee a P90 annual energy production number — the value such that there is only a 10% probability the actual yield falls below it — she was providing a 90th-percentile lower bound on a one-year energy integral. The MC dropout prediction interval provides a 90th-percentile bound on a one-hour power output, using the same probabilistic logic at a different timescale. The bank wanted a 90th-percentile annual energy guarantee; the grid operator wants a 90th-percentile hourly power bound. The same framework — quantifying uncertainty through repeated sampling from a distribution — serves both needs.

By 2019, commercial deployments of deep learning forecasting systems were reporting 10–20% improvements in forecast value for large wind portfolios relative to statistical baselines, driven primarily by better uncertainty quantification enabling tighter reserve scheduling. The MC dropout approach offers a practical route to calibrated uncertainty without the computational cost of full Bayesian neural network inference.

> **Standard reference:** IEC 61400-15-2:2023, "Wind Energy Generation Systems — Part 15-2: Assessment of Site-Specific Wind Conditions — Application of Wind Power Plants." IEC, Geneva. Section 8.3 covers uncertainty propagation in energy yield assessments and provides context for the P-value confidence intervals that MC dropout uncertainty estimates map to at the forecast horizon.

---

## 35.5 Physical Constraint Enforcement

A neural network with a linear output layer produces any real number. It can predict −42 MW or 950 MW for a 510 MW farm. Neither is physically possible: the minimum output of a connected, operational wind farm is 0 MW, and the maximum is the rated capacity. The mean squared error loss function is indifferent to this: it penalises a prediction of −20 MW and a prediction of +20 MW equally, even though one is impossible and one is not. If even a small fraction of the training examples involve wind speeds near cut-in or cut-out — where the power curve transitions sharply — the network may learn to minimise MSE by drifting slightly below zero or slightly above rated, incurring small training penalties while producing physically meaningless outputs.

Two complementary approaches enforce the physical bounds.

Hard clipping is applied as a post-processing step at inference time. The raw network output is passed through a clip function before being reported:

$$\hat{P} = \operatorname{clip}\!\left(\hat{y},\; 0,\; P_{\text{rated}}\right) = \max\!\left(0,\; \min\!\left(\hat{y},\; P_{\text{rated}}\right)\right)$$

where:
- $\hat{P}$ = physically-constrained prediction [MW], the value reported to the grid operator or energy trading desk
- $P_{\text{rated}} = 510$ MW for the 500 MW reference farm (rated capacity = sum of individual turbine ratings)

Hard clipping guarantees that no prediction violates the physical bounds. It is simple to implement and adds no computational cost. Its limitation is that it does not inform the model during training: the network never learns that predictions below zero or above rated are inadmissible, because the loss function it minimises does not encode this information.

The soft penalty approach adds explicit constraint violation terms directly to the training loss:

$$\mathcal{L}_{\text{total}} = \mathcal{L}_{\text{MSE}} + \lambda \left[\sum_{i} \max(0,\; -\hat{y}_i)^2 + \sum_{i} \max(0,\; \hat{y}_i - P_{\text{rated}})^2\right]$$

where:
- $\lambda = 0.10$ = penalty weight, balancing the MSE accuracy objective against the constraint violation penalty (tuned by validation)
- $\max(0,\; -\hat{y}_i)^2$ = squared below-zero violation for sample $i$; equals zero if $\hat{y}_i \geq 0$, grows quadratically for negative predictions
- $\max(0,\; \hat{y}_i - P_{\text{rated}})^2$ = squared above-rated violation for sample $i$; equals zero if $\hat{y}_i \leq P_{\text{rated}}$, grows quadratically above rated
- The quadratic form means that large violations are penalised disproportionately more than small ones, encouraging the model to stay well clear of the boundaries rather than just touching them

The recommended practice is to use both approaches together. The soft penalty during training teaches the model that predictions outside the physical envelope carry an additional cost beyond MSE error; the model learns to avoid them as part of the optimisation process. Hard clipping at inference time then guarantees that any residual violations in the MC dropout ensemble — including those that might arise from unusual combinations of dropout masks producing tail predictions — are eliminated before the output is reported. The two mechanisms are not redundant. They operate at different stages of the pipeline and handle different sources of potential violation.

In the Monte Carlo ensemble, it is possible that individual samples $\hat{y}_n$ from the 100 forward passes differ in whether they violate the boundaries; hard clipping each sample before computing the ensemble mean and variance ensures that the reported interval is also physically bounded at both endpoints.

<!-- IMAGE: fig-35-3 -->
> **Figure 35.3** — MC Dropout Prediction Intervals for a 72-Hour Period Including a Frontal Passage
> **Type:** Time series / area chart
> **Content:** 72-hour time series (x-axis: hours 0–72, 10-minute resolution). Y-axis: power output 0–510 MW. Three overlaid elements: (1) measured output — solid black line; (2) LSTM point prediction — solid blue line; (3) 90% MC dropout prediction interval — light blue shaded band. Two annotated periods: "Stable: ±18 MW band" (hours 5–20, wind steady around 300 MW, narrow band) and "Frontal passage: ±95 MW band" (hours 38–50, wind ramping from 80 to 360 MW, wide band). Dashed red horizontal line at 510 MW (P_rated, hard clipping boundary). Band never extends below 0 MW. Legend at top right.
> **Caption:** LSTM 90% MC dropout prediction interval for a 72-hour period. The uncertainty band widens automatically during the frontal passage ramp event at hour 42 — reflecting reduced model confidence during a regime change the model has seen less frequently in training — and narrows once the new wind regime stabilises.
> **Alt text:** Time series of wind farm power output with LSTM forecast and shaded 90% uncertainty interval showing band widening during a ramp event at hour 42.
> **Data source:** Author illustration — representative results from the 500 MW reference case
> **Resolution:** 1400 × 600 px minimum
> **Color notes:** Measured: black; LSTM forecast: #1565C0; 90% band: #BBDEFB (light blue); P_rated: #F44336 dashed

---

## 35.X Worked Example: LSTM Wind Power Forecast for a 500 MW Farm

The same cleaned dataset constructed in Chapter 33 serves as the training corpus: 50,399 ten-minute records, 18 input features, target variable $P_t$ in MW. The walk-forward validation split follows the Chapter 34 convention: 80% for training (approximately 40,319 records, covering the earlier years of the dataset), 20% for testing (10,080 records, covering the most recent period). No shuffling: the temporal order is preserved throughout. Shuffling would contaminate the test set with information from the future and produce optimistic error estimates.

**Architecture and hyperparameters:**

| Component | Specification |
|-----------|---------------|
| Input shape | $(144,\; 18)$ — 24 h × 18 features per sample |
| LSTM Layer 1 | Hidden dimension $d = 128$, dropout $p = 0.20$ |
| LSTM Layer 2 | Hidden dimension $d = 128$, dropout $p = 0.20$ |
| Output layer | Linear, 1 unit: $\hat{P}_{t+144}$ [MW] |
| Optimiser | Adam, $\eta = 1 \times 10^{-3}$, $\beta_1 = 0.9$, $\beta_2 = 0.999$ |
| Epochs | 50 with early stopping (patience = 7, monitored on validation MAE) |
| Batch size | 512 |
| Loss | $\mathcal{L}_{\text{MSE}} + 0.10 \cdot \mathcal{L}_{\text{penalty}}$ |
| Total parameters | 460,929 |

The parameter count breaks down as follows. Each LSTM layer with input dimension $p$ and hidden dimension $d$ contains $4(pd + d^2 + d)$ parameters: four gate operations, each requiring a $[p+d] \times d$ weight matrix and a $d$-dimensional bias. Layer 1 with $p = 18$, $d = 128$: $4(18 \times 128 + 128^2 + 128) = 4(2304 + 16384 + 128) = 4 \times 18816 = 75264$ parameters. Layer 2 with $p = 128$ (input from Layer 1), $d = 128$: $4(128 \times 128 + 128^2 + 128) = 4 \times 32896 = 131584$ parameters. Two identical Layer 2 stacks for forward and recurrent weights: $2 \times 131584 = 263168$. Output linear layer: $128 + 1 = 129$ parameters. Total: approximately 460,929.

Training completed in 4 minutes 12 seconds on a CPU server with no GPU acceleration. The Adam optimiser converges quickly on this dataset because the 18 input features have been normalised to zero mean and unit variance (Chapter 33 preprocessing), preventing large-magnitude gradient components from dominating the early updates.

**Results by forecast horizon:**

| Horizon | LSTM MAPE | XGBoost MAPE (Ch 34) | Persistence MAPE |
|---------|-----------|----------------------|-----------------|
| 1 hour (6 steps) | 3.2% | 4.1% | 4.8% |
| 6 hours (36 steps) | 4.8% | 5.7% | 7.9% |
| 12 hours (72 steps) | 5.4% | 7.1% | 10.3% |
| 24 hours (144 steps) | **6.1%** | **7.4%** | 11.3% |

The pattern in the table is precisely what the architecture predicts. At the one-hour horizon, XGBoost's lag features carry substantial predictive information — the wind speed six timesteps ago is still highly correlated with the wind speed now — and LSTM's advantage is modest (0.9 pp). At twelve hours, the lag features have largely decayed into noise, and the LSTM's sequence memory contributes 1.7 pp of improvement. At twenty-four hours, the improvement is 1.3 pp. The crossover is not coincidental: it occurs at roughly the timescale where lag feature autocorrelation falls below 0.3, which is the threshold below which the XGBoost model is effectively predicting from climatological distributions rather than dynamic sequence information.

**MC Dropout uncertainty calibration** ($N_{\text{MC}} = 100$, dropout $p = 0.20$ kept active at inference):

$$\sigma_{\text{MC}} = \sqrt{\frac{1}{N_{\text{MC}}-1} \sum_{n=1}^{N_{\text{MC}}} (\hat{y}_n - \hat{y})^2}$$

| Condition | Mean $\sigma_{\text{MC}}$ [MW] | 90% PI Coverage | Mean PI Width |
|-----------|-------------------------------|-----------------|---------------|
| Stable high-wind | 18 | 91.2% | ±30 MW |
| Stable low-wind | 12 | 89.4% | ±20 MW |
| Frontal passage (ramp) | 63 | 88.7% | ±104 MW |
| All conditions | 31 | 90.3% | ±51 MW |

The overall empirical 90% coverage of 90.3% is within 0.3 percentage points of the nominal target of 90.0%. This means the uncertainty is calibrated: the model is not reporting artificially narrow intervals that cover less than they claim, nor artificially wide intervals that cover more than they claim. The frontal passage result is particularly notable: the mean uncertainty $\sigma_{\text{MC}} = 63$ MW during ramp events is 3.5 times the stable high-wind figure of 18 MW, reflecting the model's reduced confidence during atmospheric regime transitions that appear less frequently in the training data. The coverage during frontal passages (88.7%) is slightly below nominal — marginally undercovering the most challenging events — a known property of MC Dropout that more sophisticated Bayesian methods reduce further.

The Monte Carlo inference step runs in 33 seconds: 100 forward passes through a 460,929-parameter network on the 10,080-record test set, each pass independently sampling dropout masks. The additional cost over a single-pass point estimate is negligible relative to the operational value of the resulting uncertainty bounds.

**Financial value of LSTM over XGBoost at the 24-hour horizon:**

Improving MAPE from 7.4% (XGBoost) to 6.1% (LSTM) at 24 hours represents a 1.3 percentage point reduction in forecast error. At a 500 MW farm operating in a balancing energy market where forecast error translates to imbalance costs — typically assessed at EUR 5–8 million per percentage point of MAPE per year for a farm this size, depending on market conditions and imbalance price volatility — the improvement yields:

$$\Delta \text{Revenue} = (7.4\% - 6.1\%) \times \text{EUR}\ 5\text{–}8\text{M/pp} = \text{EUR}\ 6.5\text{–}10.4\text{M/year}$$

Discounted over 30 years at a 5% cost of capital, the net present value of this improvement is approximately EUR 100–160 million.

Added to the Chapter 33 data quality improvement (EUR 120–200M NPV) and the Chapter 34 XGBoost-over-persistence improvement (EUR 175–275M NPV), the three-chapter pipeline — clean data, gradient boosting, sequence memory — delivers a combined NPV of approximately EUR 395–635 million relative to an uncleaned persistence baseline. Each layer of engineering contributes independently, and each layer's contribution is measurable.

---

## Key Takeaways

- XGBoost treats time as a feature by including lag columns; LSTM represents the sequence itself as a structured input, allowing it to exploit dependencies that lag features cannot encode beyond the short-autocorrelation horizon.
- The vanishing gradient is a proved mathematical obstruction (Bengio, Simard & Frasconi, 1994), not a practical limitation or a matter of optimiser tuning — LSTM's cell state resolves it by replacing the multiplicative tanh-through-weight-matrix path with an additive, gated update.
- The cell state is an information highway; the forget gate clears stale regimes, the input gate writes new atmospheric signals, and the output gate controls what the hidden state exposes to the prediction layer at each step.
- MC Dropout provides calibrated uncertainty at minimal inference cost — 100 forward passes in approximately 33 seconds — and produces prediction intervals that widen correctly during frontal passage ramp events, giving grid operators operationally actionable confidence bounds.
- Physical constraint enforcement requires both training-time soft penalty (to teach the model the bounds) and inference-time hard clipping (to guarantee no violations survive into the MC dropout ensemble output).

---

## For Further Reading

1. **Hochreiter, S. & Schmidhuber, J. (1997).** "Long Short-Term Memory." *Neural Computation*, 9(8), 1735–1780. DOI: 10.1162/neco.1997.9.8.1735. The original LSTM paper — dense but complete. Read the gradient flow analysis in Section 4 before anything else. Over 100,000 citations; one of the most-cited papers in computer science.

2. **Gal, Y. & Ghahramani, Z. (2016).** "Dropout as a Bayesian Approximation: Representing Model Uncertainty in Deep Learning." *Proceedings of the 33rd International Conference on Machine Learning (ICML)*, PMLR 48, 1050–1059. arXiv: 1506.02142. Theorem 1 establishes the equivalence between a neural network with dropout and a deep Gaussian process; Section 4 describes the practical MC Dropout inference procedure. The implementation requires a single boolean flag change from standard inference.

3. **Bengio, Y., Simard, P., & Frasconi, P. (1994).** "Learning Long-Term Dependencies with Gradient Descent is Difficult." *IEEE Transactions on Neural Networks*, 5(2), 157–166. DOI: 10.1109/72.279181. Read Section 2 for the formal analysis; Section 4 for the experimental evidence showing the effective memory horizon of a standard RNN under different initialisation conditions. Establishes the theoretical foundation that LSTM was designed to overcome.

---

*Jonasz ran the training loop twice. The first pass took four minutes and twelve seconds, the training loss curve flattening at epoch 34 before early stopping halted at epoch 41. The MAPE at the 24-hour horizon was 6.1%. Kaan studied the horizon breakdown table for a long time.*

*"At one hour," he said, "XGBoost and LSTM are nearly the same. And then it widens."*

*"Because at one hour," Jonasz said, "the wind speed from ten minutes ago still tells you almost everything you need to know. The lag feature is sufficient. At twelve hours, the lag feature is noise. The LSTM is using something else."*

*"It found the memory," Kaan said.*

*Jonasz looked at him with the patient expression of a man correcting an approximation rather than an error. "It learned to use the memory it was given the architecture to maintain. The memory was always available — the sequence was always there in the input. What Hochreiter gave it was a path through which that information could reach the optimiser."*

*The MC dropout evaluation ran for 33 seconds: 100 forward passes, independent dropout masks, 90.3% empirical coverage. Kaan read the calibration table twice. 90.3% coverage against a 90% nominal target: the model was neither overconfident nor conservative. It knew, within measurable limits, how much it did not know.*

*Jonasz pulled up the test window for the frontal passage — three hours in early November, wind ramping from 88 to 347 MW in 180 minutes. The shaded uncertainty band in the plot had widened to ±104 MW at the peak of the ramp, then narrowed again as the new wind regime stabilised. The point prediction had tracked the ramp with a lag of roughly 40 minutes, missing the steepest portion. But the band had widened before the prediction moved, catching the event inside its envelope.*

*"The model didn't predict the ramp," Kaan said.*

*"No," Jonasz agreed. "But it said it didn't know. Which is the next best thing. The XGBoost model during the same event gave a confident wrong answer. This gave an uncertain correct answer — that is, it said: something is going to happen, I cannot tell you what, here is the width of my ignorance. That is useful. A grid operator can schedule reserve against an interval. They cannot schedule reserve against a point estimate they have been given no reason to distrust."*

*Jonasz closed the visualisation and opened a third browser tab. The URL resolved to `06_tft_v01.ipynb`. He did not say anything for a moment.*

*"Tomorrow," he said finally, "we give it the ability to say not only that it is uncertain, but which features it is uncertain about, and why. The Temporal Fusion Transformer. It will show you where it is looking."*

*Kaan saved the calibration table to his notebook folder and wrote the session date at the top of a fresh page. Outside the windowless data lab — somewhere a hundred and fifty metres overhead, on the OSS observation deck, in the salt air above the Baltic — the wind had shifted three degrees north since morning. The SCADA system had recorded it at 14:10, logged it, and passed it downstream. Somewhere in the LSTM's cell state, a representation of that shift was already propagating forward: written through the input gate, carried along the cell state line, held behind the output gate, waiting to reach the prediction at hour 24.*

---

## Notes

[^1]: Jordan, M. I. (1986). *Serial Order: A Parallel Distributed Processing Approach*. ICS Technical Report 8604. Institute for Cognitive Science, University of California San Diego. Jordan's report introduced the concept of recirculating the previous output as an additional input to a standard feedforward network. It was widely circulated as a technical report before formal journal publication and became the first widely-known recurrent architecture. Jordan later moved to UC Berkeley, where he became one of the most influential figures in machine learning and probabilistic graphical models.

[^2]: Elman, J. L. (1990). "Finding Structure in Time." *Cognitive Science*, 14(2), 179–211. DOI: 10.1207/s15516709cog1402_1. Elman's key architectural contribution was replacing the recirculated output with the recirculated hidden state, giving the network access to its own internal representation of the previous timestep rather than merely its prediction. The paper demonstrated learning of grammatical dependencies — subject-verb agreement across intervening clauses — which required the network to maintain a representation of the sentence subject across several intervening words.

[^3]: Bengio, Y., Simard, P., & Frasconi, P. (1994). "Learning Long-Term Dependencies with Gradient Descent is Difficult." *IEEE Transactions on Neural Networks*, 5(2), 157–166. DOI: 10.1109/72.279181. Theorem 1 of this paper establishes a formal trade-off: if the recurrent weight matrix has spectral radius less than 1, long-term components of the gradient vanish; if it has spectral radius greater than 1, long-term components explode. The narrow manifold where neither occurs shrinks with increasing sequence length. The paper's conclusion — that gradient descent cannot reliably learn long-term dependencies in standard RNNs — provided the theoretical underpinning for all subsequent gated architectures.

[^4]: Hochreiter, S. (1991). *Untersuchungen zu dynamischen neuronalen Netzen* [Investigations into Dynamic Neural Networks]. Diploma thesis, Institut für Informatik, Technische Universität München. Supervisor: J. Schmidhuber. Written in German; an English translation of the core technical sections has been circulated informally. The thesis independently derived the vanishing gradient problem using a local error flow analysis and showed mathematically that information decay is exponential with sequence length in standard recurrent networks. Hochreiter identified the problem at age 22, three years before Bengio's published proof. The thesis was not widely read outside TU Munich during the 1990s; its significance became fully recognised only after the 1997 LSTM paper it had motivated.

[^5]: Hochreiter, S. & Schmidhuber, J. (1997). "Long Short-Term Memory." *Neural Computation*, 9(8), 1735–1780. DOI: 10.1162/neco.1997.9.8.1735. As of 2025, this paper has exceeded 100,000 citations in Google Scholar — one of the most cited papers in the history of computer science — despite being published in a journal (Neural Computation) rather than a conference proceeding, the more typical venue for machine learning work of this period. The paper introduced the original two-gate LSTM (forget gate and input gate); the three-gate version used in modern implementations adds an output gate introduced by Gers, Schmidhuber & Cummins (2000). Hochreiter held a professorship at Johannes Kepler University Linz (JKU) from 2006, where he founded and led the Institute for Machine Learning. His students and collaborators produced multiple landmark contributions in deep learning, including work on batch normalisation and network architecture search.

[^6]: Gal, Y. & Ghahramani, Z. (2016). "Dropout as a Bayesian Approximation: Representing Model Uncertainty in Deep Learning." *Proceedings of the 33rd International Conference on Machine Learning (ICML)*, PMLR 48, 1050–1059. arXiv: 1506.02142. Theorem 1 of the paper proves that a neural network with arbitrary depth, non-linearities, and dropout applied before every weight layer is equivalent in distribution to a deep Gaussian process with a specific kernel. The practical consequence is that running $N_{\text{MC}}$ forward passes with dropout active at inference approximates sampling from the model's posterior predictive distribution — without any modification to the trained network, any additional training procedure, or any change to the loss function. The only requirement is that dropout probability $p > 0$ and is kept active (not switched off) at inference time. Calibration quality depends on the choice of $p$ and $N_{\text{MC}}$; values of $p = 0.1$–$0.2$ and $N_{\text{MC}} = 50$–$100$ are typical in operational wind forecasting applications.

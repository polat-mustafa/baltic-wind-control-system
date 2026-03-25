# Chapter 34: XGBoost — Decision Trees That Learn from Mistakes

*Kaan had read about decision trees until the corridor lights outside the data lab cycled through their night-time dimming sequence twice, which he took to mean it was somewhere past midnight. He had started with a tutorial that used coloured boxes and arrows. He had ended with the 1984 textbook — `CART_1984_Breiman.pdf`, no explanation beyond the filename — that Jonasz had left in the shared folder the previous evening like a challenge. The book was dense and careful and assumed the reader was comfortable with recursive partitioning and impurity measures, which Kaan mostly was not, but by 01:30 he had filled three notebook pages with annotated trees and a running argument with himself about why the relay analogy Jonasz had offered was simultaneously illuminating and wrong in a way he could not yet identify.*

*When he arrived Tuesday at 07:45, Jonasz had already replaced yesterday's terminal session with a new notebook. The browser tab read `04_xgboost_v01.ipynb`. On the whiteboard, beside the half-erased data pipeline diagram, was a fresh column header: LEARN. Below it, nothing yet.*

*"Explain to me what you read," Jonasz said, before Kaan had hung his jacket.*

*This was, he had come to understand, Jonasz's primary teaching method. Not lecturing. Not demonstration. Listening to Kaan's explanation with patient attention, then identifying with clinical precision the exact point at which the understanding stopped being correct.*

*Kaan explained what he had read: a binary tree with decision nodes, each asking one question about the input features — wind speed above or below a threshold, turbulence intensity high or low — branching left or right depending on the answer, until reaching a leaf that contained a prediction. Like Jonasz had said himself the evening before: the same logic as a relay protection engineer, choosing a path and committing to it.*

*"Good," Jonasz said. "Now explain to me why a single tree is useless."*

*Kaan paused. He had read as far as the construction of the tree. He had not read far enough to understand why you would immediately replace it.*

*"By the end of today," Jonasz said, setting a mug of coffee in front of Kaan without being asked, "you will be able to tell me yourself. We start with one tree. We watch it fail in two different ways. Then we fix it — once badly, once well. The badly-fixed version is a Random Forest. The well-fixed version is the beginning of XGBoost." He opened the notebook and typed the first cell. "The difference between a decision tree and XGBoost is the difference between one relay and a full protection scheme. One relay can trip correctly most of the time. The scheme coordinates. It is selective. It learns what the system requires of it." He pressed Shift-Enter and the cell executed. "Let us begin with the one relay."*

---

## 34.1 The Decision Tree: One Question at a Time

The decision tree was formalised in 1984 by four statisticians — Leo Breiman of the University of California Berkeley, Jerome Friedman of Stanford, Richard Olshen of the University of California San Diego, and Charles Stone of Berkeley — in a textbook called *Classification and Regression Trees*.[^1] The textbook's acronym, CART, has since attached itself to the algorithm it describes, and most software implementations trace their lineage to this work. The four authors were all statisticians, not computer scientists, and the book reflects that heritage: it is rigorous, proof-heavy, and occasionally indifferent to the impatience of practitioners. What it established was a unified framework for a question that had been approached piecemeal for decades: how do you use data to construct a function that maps inputs to outputs through a sequence of binary decisions?

For regression — predicting a continuous value, such as wind farm power output — the CART algorithm proceeds as follows. Start with all training observations at the root. At each node, search exhaustively over every possible feature and every possible threshold value for that feature, and choose the split that produces the greatest reduction in prediction error at the two resulting child nodes. The prediction error used is the mean squared error of the node's observations around their mean:

$$
\mathcal{L}_{\text{split}} = \sum_{i \in R_L} (y_i - \bar{y}_L)^2 + \sum_{i \in R_R} (y_i - \bar{y}_R)^2
$$

where:
- $y_i$ = observed power output of sample $i$ [MW]
- $\bar{y}_L$ = mean power output of all samples routed to the left child node [MW]
- $\bar{y}_R$ = mean power output of all samples routed to the right child node [MW]
- $R_L$, $R_R$ = the sets of samples assigned to left and right child nodes respectively

The algorithm searches for the feature and threshold pair that minimises this quantity, makes the split, and recurses on each child. At a leaf node — when stopping criteria are met, such as minimum samples per node or maximum tree depth — the prediction is simply $\bar{y}_{leaf}$, the mean of all training samples that reach it.

Consider the 50,399-record feature matrix from Chapter 33: 18 columns including hub-height wind speed, wind direction components, turbulence intensity, lag features, and temperature. A shallow three-level tree might first split on wind speed at roughly 7.2 m/s (the knee of the power curve, where output transitions from Region 2 to Region 3), then split each branch on turbulence intensity, then split again on the one-hour lagged wind speed. At a depth of three, this produces eight leaf nodes, each of which predicts the mean power output of the training samples it captured. The tree is interpretable: you can trace any prediction back to three binary decisions.

<!-- IMAGE: fig-34-1 -->
> **Figure 34.1** — Decision Tree Structure for Wind Power Regression (Depth 3)
> **Type:** Schematic / flow diagram
> **Content:** A three-level binary decision tree. Root node: "v_hub > 7.2 m/s?" splitting into two branches. Left branch (below threshold): split on "TI > 0.14?", producing two leaves (low-wind / low-TI, low-wind / high-TI). Right branch (above threshold): split on "v_hub,lag1 > 10.5 m/s?", producing two leaves (high-wind ramping, high-wind stable). Each leaf shows: predicted power, sample count, and mean absolute error. Node boxes coloured by depth (white root, light grey level 1, dark grey level 2, hatched leaves).
> **Caption:** A three-level CART regression tree trained on 80% of the cleaned 50,399-record dataset. Each split was chosen by exhaustive search over all 18 features and all threshold values; root node wind speed 7.2 m/s corresponds to the Region 2/3 transition knee in the IEC 61400-12-1 power curve.
> **Alt text:** Binary decision tree with three levels of splits, showing wind speed, turbulence intensity, and lagged wind speed as the selected splitting features, with eight leaf nodes showing predicted power output values.
> **Data source:** Author illustration — representative tree structure from XGBoost depth-3 equivalent
> **Resolution:** 1200 × 900 px minimum
> **Color notes:** Leaves coloured on a blue-to-red scale proportional to predicted power output

> **Standard reference:** IEC 61400-12-1:2017, "Wind Energy Generation Systems — Part 12-1: Power Performance Measurements of Electricity Producing Wind Turbines." IEC, Geneva. Section 7.1 defines the ten-minute averaging period and measurement uncertainty categories used for SCADA data referenced throughout this chapter.

The appeal of the decision tree is its transparency. Every prediction is the result of a traceable sequence of yes/no questions, and every question refers to a measurable physical quantity. An engineer looking at the tree can understand it, argue with it, and identify which splits seem physically plausible and which do not. This is not a small advantage in engineering applications.

The problem — which Jonasz intended Kaan to discover rather than be told — is what happens when you deepen the tree.

---

## 34.2 The Overfitting Problem and the Bias-Variance Tradeoff

A decision tree with unlimited depth will, eventually, separate every training sample into its own leaf. At that extreme, the tree's training error is zero: every prediction is exact, because every leaf contains exactly one observation and predicts that observation's value perfectly. But this is not a model. It is a look-up table. When presented with a test observation that was not in the training set, the tree will route it to whatever leaf the training points drew it toward, and the prediction will be the mean of the neighbouring training points rather than the correct value for the new observation.

This phenomenon — learning the training data so completely that the model loses its ability to generalise — is called overfitting, and it is one of the oldest and most persistent problems in statistical learning. It arises from a fundamental tension in the design of any predictive model, known as the bias-variance tradeoff:

$$
\mathbb{E}\left[(y - \hat{f}(x))^2\right] = \underbrace{\left(\mathbb{E}[\hat{f}(x)] - f(x)\right)^2}_{\text{Bias}^2} + \underbrace{\mathbb{E}\left[(\hat{f}(x) - \mathbb{E}[\hat{f}(x)])^2\right]}_{\text{Variance}} + \underbrace{\sigma_\varepsilon^2}_{\text{Irreducible noise}}
$$

where:
- $y$ = true power output [MW]
- $\hat{f}(x)$ = model prediction for feature vector $x$ [MW]
- $f(x)$ = true underlying function mapping features to power [MW]
- $\sigma_\varepsilon^2$ = irreducible noise variance (measurement error, physical turbulence) [MW²]

Bias measures how systematically wrong the model is on average — a very shallow tree predicts every observation as approximately its region's mean, which is systematically wrong everywhere. Variance measures how sensitive the model is to which particular training set it happened to see — a very deep tree learns the noise in its specific training data so precisely that different training datasets produce completely different trees for the same underlying wind farm. The irreducible noise $\sigma_\varepsilon^2$ cannot be eliminated by any model: it is the randomness inherent in the system.

A shallow tree has high bias (too simple) and low variance (stable, but wrong). A deep tree has low bias (flexible enough to fit the true function) and high variance (so sensitive to training data that it overfits). No single tree can achieve both low bias and low variance simultaneously. This is the fundamental limitation that ensemble methods exist to address.

<!-- IMAGE: fig-34-2 -->
> **Figure 34.2** — Bias-Variance Tradeoff for Decision Tree Depth
> **Type:** Dual-axis line chart
> **Content:** X-axis: maximum tree depth (1–20). Left Y-axis: bias² and variance (as fraction of total error). Right Y-axis: total test MAPE (%). Three curves: bias² (decreasing monotonically), variance (increasing after depth ~6), total error (U-shaped, minimum near depth 6–8). Vertical dashed line at optimal depth. Two shaded regions: "underfitting" (left, high bias) and "overfitting" (right, high variance).
> **Caption:** Bias-variance decomposition for a CART regression tree trained on the wind power dataset. Total test error is minimised near depth 6–8; shallower trees underfit the power curve's nonlinearity; deeper trees memorise wind-speed fluctuations specific to the training period.
> **Alt text:** Line chart showing bias squared decreasing and variance increasing with tree depth, with total test error forming a U-shape and minimum near depth 7.
> **Data source:** Author illustration — representative decomposition; exact values vary with dataset split
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** Bias² in blue, variance in orange, total error in dark red, irreducible noise as horizontal dashed grey line

The practical implication for wind power forecasting: a single tree optimised by cross-validation will achieve roughly MAPE 9–10% on this dataset — better than the cleaned-but-unmodelled baseline (12.1%), but still well above what the operational grid requires. The model is simply not expressive enough, and making it more expressive immediately makes it unstable. A different approach is needed.

---

## 34.3 From Averaging to Accumulating: Bagging, Random Forests, and Gradient Boosting

The first successful ensemble method — combining multiple models whose individual predictions are aggregated — was proposed by Leo Breiman in 1996 under the name *bagging*, a contraction of bootstrap aggregating.[^2] The idea is simple: draw $B$ bootstrap samples from the training data (each sample of the same size as the training set, drawn with replacement), train a full decision tree on each, and average the predictions. Because each tree sees a slightly different dataset, the trees disagree with each other in their finer details. When you average their predictions, the systematic errors (bias) remain and the random disagreements (variance) cancel. The mathematics is straightforward: if the individual trees have variance $\sigma^2$ and correlation $\rho$ between them, the ensemble of $B$ trees has variance $\rho\sigma^2 + (1-\rho)\sigma^2/B$. As $B \rightarrow \infty$, the second term vanishes and you are left with $\rho\sigma^2$ — the irreducible component due to the trees' shared correlation with the training data. To reduce variance further, you need trees that are less correlated with each other.

Random Forests, introduced by Breiman in 2001, achieve this by adding a second source of randomisation: at each node, rather than searching over all features for the best split, the algorithm considers only a random subset of $\lfloor\sqrt{p}\rfloor$ of the $p$ available features.[^3] This decorrelates the trees — they no longer all select the same dominant feature (wind speed) at the root, so their errors are less correlated, and averaging produces a larger variance reduction. Random Forests are robust, fast to parallelise, and often achieve competitive performance with modest tuning. They also provide a natural measure of feature importance: a feature's importance is the total reduction in node impurity (averaged over all trees) attributable to splits on that feature.

But averaging has a fundamental limitation: it does not make individual trees better. It only reduces their collective variance. Each tree in the ensemble is trying to predict $y$ directly, and the ensemble stops improving once the trees have been sufficiently decorrelated. Gradient boosting, proposed by Jerome Friedman in 2001, takes a completely different approach.[^4] Rather than building trees in parallel and averaging, gradient boosting builds them in *sequence*, with each tree trained not on $y$ but on the *residuals* of the previous ensemble's predictions:

$$
F_m(x) = F_{m-1}(x) + \eta \cdot h_m(x)
$$

where:
- $F_m(x)$ = ensemble prediction after $m$ trees [MW]
- $F_{m-1}(x)$ = ensemble prediction before the $m$-th tree [MW]
- $h_m(x)$ = prediction of the $m$-th tree, trained on the negative gradient of the loss function evaluated at $F_{m-1}$ [MW]
- $\eta$ = learning rate (shrinkage factor, typically 0.01–0.10) [dimensionless]

The genius of Friedman's formulation is that the negative gradient of the loss function, evaluated at the current ensemble prediction, is simply the *residuals* — the differences $y_i - F_{m-1}(x_i)$ — when the loss function is squared error. Each new tree learns to correct what the previous ensemble got wrong. The ensemble does not average independent predictions: it *accumulates* corrections, each step improving on the last. The learning rate $\eta$ controls how aggressively each tree is trusted; small values are more conservative but typically achieve better generalisation because the model can afford to add more trees without overfitting.

Friedman published this work in the *Annals of Statistics*, a pure mathematics journal, in 2001. The fact that a technique now running on millions of production machine learning systems appeared first in a theoretical statistics journal reflects how completely the fields of statistics and computer science were still operating in parallel communities at the turn of the millennium. Friedman himself is the "F" in the CART textbook's authorship (Breiman-Friedman-Olshen-Stone), making him the rare figure who contributed foundational work to both the individual tree and the ensemble that eventually replaced it.

<!-- IMAGE: fig-34-3 -->
> **Figure 34.3** — Gradient Boosting: Sequential Residual Fitting
> **Type:** Three-panel schematic
> **Content:** Panel 1 (left): Training data scatter (wind speed vs residual power after mean subtraction). A single tree prediction is shown as a step function — it captures the major trend but leaves large residuals. Panel 2 (centre): The residuals from Panel 1, with the second tree's fit shown — smaller corrections to the remaining errors. Panel 3 (right): The ensemble prediction after 100 trees — a smooth, accurate curve through the data, with the summed residuals near zero. Arrows between panels show the "these residuals become the next training target" relationship.
> **Caption:** Three stages of gradient boosting on wind power data. Each panel shows the quantity the next tree is trained on: the original targets (Panel 1), then successive layers of residuals (Panels 2–3). The ensemble converges to an accurate prediction by learning from its own mistakes rather than from the original targets.
> **Alt text:** Three scatter plots showing the progressive improvement of gradient boosting: first tree captures the trend, second tree fits the residuals, and the 100-tree ensemble produces a smooth accurate curve.
> **Data source:** Author illustration — schematic representation; exact curve shape varies with dataset
> **Resolution:** 1800 × 600 px minimum
> **Color notes:** Training data in grey, tree predictions in blue, residuals highlighted in orange

---

## 34.4 XGBoost: The Engineering of a Learning Algorithm

Gradient boosting as Friedman described it works. XGBoost, developed by Tianqi Chen as a PhD student at the University of Washington and published with his advisor Carlos Guestrin at KDD 2016, is gradient boosting engineered for production.[^5]

The engineering improvements that XGBoost introduced over plain gradient boosting address five distinct problems, each of which makes the difference between a research implementation and a system robust enough to deploy:

**Regularisation.** Plain gradient boosting has no intrinsic control over leaf weight magnitudes — individual leaves can become very large if they happen to fit a cluster of noisy training points. XGBoost adds explicit L1 and L2 regularisation to the objective function:

$$
\mathcal{L}^{(m)} = \sum_{i=1}^{N} l\!\left(y_i,\, F_{m-1}(x_i) + h_m(x_i)\right) + \Omega(h_m), \qquad \Omega(h) = \gamma T + \frac{1}{2}\lambda \sum_{j=1}^{T} w_j^2
$$

where:
- $l(\cdot)$ = per-sample loss function (mean squared error for regression) [MW²]
- $h_m(x_i)$ = prediction of the $m$-th tree for sample $i$ [MW]
- $\Omega(h_m)$ = regularisation penalty on tree $h_m$
- $T$ = number of leaves in the tree [dimensionless]
- $w_j$ = weight (predicted value) at leaf $j$ [MW]
- $\gamma$ = minimum loss reduction required to make a split (L1-type, penalises leaf count) [MW²]
- $\lambda$ = L2 regularisation coefficient on leaf weights [dimensionless]

The term $\gamma T$ penalises trees with many leaves; the term $\frac{1}{2}\lambda\sum w_j^2$ penalises large leaf weights. Together they smooth the ensemble's predictions and substantially reduce overfitting, especially with noisy training data of the kind that emerges from real SCADA systems.

**Shrinkage.** The learning rate $\eta$ in equation (34.3) is standard gradient boosting. XGBoost applies it consistently and provides column subsampling (sampling a random fraction of features at each tree, like Random Forests) in addition to row subsampling (sampling a random fraction of training records at each tree). The combination of $\eta$, row subsampling, and column subsampling provides three independent regularisation mechanisms that can be tuned separately.

**Approximate split finding.** Plain gradient boosting searches all possible split points exactly. For continuous features (wind speed, temperature), this means sorting all training samples and evaluating every distinct value as a threshold — an operation that scales as $O(N \cdot p \cdot D)$ for $N$ samples, $p$ features, and tree depth $D$. XGBoost's weighted quantile sketch compresses the candidate split points to a histogram of approximately 256 bins per feature, reducing the search cost by a factor of $N/256$ with negligible accuracy loss. For 50,399 samples, this is a roughly 200-fold speed improvement per tree per feature.

**Native missing value handling.** Rather than requiring imputation of missing values before training, XGBoost routes samples with missing feature values to either the left or right child at each split, learning the optimal default direction from the training data. For a wind farm SCADA dataset where maintenance periods, icing events, and communication outages leave legitimate gaps even after the cleaning pipeline, this is a direct engineering advantage.

**GPU acceleration.** The histogram-based split finding algorithm maps naturally to GPU parallelism. XGBoost's GPU implementation achieves near-linear speedup across the number of GPU cores for the split-finding phase, reducing training time for large datasets from hours to minutes.

The practical consequence of these five improvements: by 2016, XGBoost was used in 17 of the 29 challenge-winning solutions on the Kaggle machine learning competition platform.[^5] The statistic is both a measure of the algorithm's practical effectiveness and a reminder that winning Kaggle competitions — which use fixed, clean, tabular datasets with well-defined targets — is not the same as building production forecasting systems. Wind power forecasting adds temporal dependencies, physical constraints, concept drift, and extreme event handling that no Kaggle benchmark captures. What XGBoost provides is an excellent and well-understood baseline: fast, regularised, and interpretable via feature importance and SHAP values.

---

## 34.5 TimeSeriesSplit: The Trap You Cannot See

Standard machine learning cross-validation — shuffling the dataset into $K$ random folds, holding out each fold in turn, and averaging the resulting performance metrics — produces wildly optimistic performance estimates for time-series forecasting. The reason is data leakage: when the training set for a fold contains observations from the future relative to the validation set, the model can learn patterns that include information it could not have possessed at prediction time.

For wind power forecasting, the leakage is particularly severe because of the lag features in the feature matrix. If the training set includes the observation at $t = 14{:}00$ (which includes the observed power at $t = 13{:}50$, $t = 13{:}40$, and so on), and the validation set contains the observation at $t = 12{:}00$, then the training set contains future information about the validation sample's near-term future. A model trained on such data learns to exploit these future peeks and appears more accurate than it truly is.

The correct approach for time series is the **walk-forward validation** scheme, implemented in scikit-learn as `TimeSeriesSplit`:

$$
\text{TrainFold}_k = \left[0,\; k \cdot \left\lfloor N / K \right\rfloor\right), \qquad \text{ValFold}_k = \left[k \cdot \left\lfloor N / K \right\rfloor,\; (k+1) \cdot \left\lfloor N / K \right\rfloor \right)
$$

where:
- $N$ = total number of training samples [dimensionless]
- $K$ = number of cross-validation folds [dimensionless]
- $k = 1, 2, \ldots, K$ = fold index [dimensionless]

The training set for fold $k$ is always strictly earlier in time than the validation set for fold $k$. There is no leakage. The training set grows with each fold (an expanding window), which reflects the operational reality that more historical data is available as the farm ages. A rolling window variant (training set of fixed size, window sliding forward) can also be used when concept drift is expected to make older data less informative — but for the first year of operation, the expanding window is appropriate.

<!-- IMAGE: fig-34-4 -->
> **Figure 34.4** — Walk-Forward TimeSeriesSplit Validation (5 Folds)
> **Type:** Horizontal bar chart (Gantt-style)
> **Content:** X-axis: time (14 months, from Month 1 to Month 14+). Y-axis: fold number (1–5). For each fold: training period shown in blue (expanding each fold), validation period shown in orange (each one month, always following training). Gap between training and validation set equal to the forecast horizon (24 hours) to avoid leakage through lag features. One fold marked with red dashed border labelled "selected model fold" (fold 4). Below the chart: comparison table of MAPE per fold showing increasing difficulty in later months due to seasonal wind pattern shift.
> **Caption:** Walk-forward TimeSeriesSplit cross-validation for the 50,399-record wind power dataset. Training sets expand chronologically; validation sets are always strictly in the future relative to their corresponding training set. Fold 5 (January–February, highest average wind speed and turbulence) shows 0.9% MAPE degradation relative to Fold 2 (July–August), reflecting seasonal distribution shift.
> **Alt text:** Horizontal timeline chart showing five cross-validation folds, each with a growing training period in blue and a fixed-length validation period in orange, always in chronological order.
> **Data source:** Author illustration
> **Resolution:** 1400 × 600 px minimum
> **Color notes:** Training in solid blue, validation in solid orange, gap between them in grey hatching

A subtle additional concern for lag-feature models: the validation fold must be separated from the training fold by at least the maximum lag horizon. If the feature matrix includes power output at $t-1$, $t-2$, and $t-3$ (three ten-minute lags), and the validation period begins at sample $N_\text{train}$, then sample $N_\text{train}$ has a lag-1 feature derived from sample $N_\text{train}-1$, which is the last training sample. This is legitimate — the model would have this information in production. But sample $N_\text{train}+1$ would have a lag-1 feature from $N_\text{train}$, which is the first validation sample — information the model genuinely will not have at inference time. For 24-hour-ahead forecasting with twelve 2-hour lag features, the validation set must begin at least twenty-four hours after the training set ends. The scikit-learn implementation includes a `gap` parameter specifically for this purpose.

---

## 34.6 SHAP Values: When the Model Explains Itself

A trained XGBoost model is a function that maps 18-dimensional feature vectors to power output predictions. It is not a black box in the sense that the structure — the ensemble of trees — is fully inspectable, but it is not easily interpretable in the sense that no engineer can read 500 trees with 6 levels each and extract a physical intuition. Feature importance, as reported by XGBoost, tells you which features were used for splits most often or produced the largest total reduction in training loss. This is useful but limited: it tells you which features the model considered important but not *how* each feature influences each individual prediction.

Shapley values provide a rigorous solution to this problem. They were introduced in 1953 by Lloyd Shapley, then a 23-year-old PhD student at Princeton under Albert Tucker, in a paper titled "A Value for n-Person Games."[^6] Shapley's problem was in cooperative game theory, not machine learning: given a coalition of players who collectively produce a value, how do you fairly attribute that value to individual players? His answer — now called the Shapley value — is the average marginal contribution of each player across all possible orderings of the coalition:

$$
\phi_j(f, x) = \sum_{S \subseteq \mathcal{F} \setminus \{j\}} \frac{|S|!\left(|\mathcal{F}| - |S| - 1\right)!}{|\mathcal{F}|!} \left[f_S(x_{S \cup \{j\}}) - f_S(x_S)\right]
$$

where:
- $\phi_j$ = Shapley value of feature $j$ for prediction on input $x$ [MW]
- $\mathcal{F}$ = the full set of features (here: all 18 columns) [dimensionless]
- $S$ = a subset of features excluding feature $j$
- $f_S(x)$ = model prediction using only the features in $S$, with other features marginalised
- The prefactor $\frac{|S|!(|\mathcal{F}|-|S|-1)!}{|\mathcal{F}|!}$ = the fraction of orderings in which $j$ joins coalition $S$ first

The intuition: the Shapley value of wind speed lag-1 is the average amount by which knowing the wind speed one time step ago changes the model's prediction, averaged over all possible subsets of other features that might already be known. It is the feature's fair share of the prediction, in the same sense that a coalition member's fair wage is the marginal value they add regardless of which other members they find already at work.

Computing exact Shapley values for a model with 18 features requires evaluating $2^{18} = 262,144$ marginalised model predictions for every sample — computationally prohibitive. Scott Lundberg and Su-In Lee showed in 2017 that for any model expressible as a linear sum of individual feature contributions (a class that includes linear models, trees, and neural networks under specific architectures), exact Shapley values can be computed in linear time.[^7] For tree-based models specifically, the TreeSHAP algorithm, published in 2020 in *Nature Machine Intelligence*, achieves this in $O(TLD^2)$ time — polynomial in the number of trees $T$, leaves $L$, and tree depth $D$, rather than exponential in the number of features.[^8] For a 500-tree XGBoost model on 50,399 samples, this reduces the computation from hours to seconds.

Shapley became the subject of an unexpected coda to his career. In 2012, at age 89, he shared the Nobel Prize in Economic Sciences with Alvin Roth. The prize citation was for "the theory of stable allocations and the practice of market design." Shapley himself observed, with characteristic modesty, that he had done the work as a mathematician and had not intended it as economics. The cooperative game theory he developed in the 1950s, including the value that bears his name, had by 2012 found applications in power system cost allocation, political science, search ranking, and machine learning interpretability — none of which he had anticipated.

<!-- IMAGE: fig-34-5 -->
> **Figure 34.5** — SHAP Beeswarm Plot: Wind Power XGBoost Model (50,399 samples)
> **Type:** SHAP beeswarm plot
> **Content:** Y-axis: feature names, ranked by mean absolute SHAP value (top to bottom: wind_speed_lag1, wind_dir_sin, wind_speed_lag2, TI, temp_lag1, wind_dir_cos, wind_speed_lag3, h_sin, power_lag1, …). X-axis: SHAP value (MW), range −80 to +120 MW. Each point is one sample, coloured on a blue-to-red scale by feature value (blue = low, red = high). For wind_speed_lag1: strong positive correlation (high wind speed → high positive SHAP), wide spread. For TI: moderate negative values at high TI (above-average turbulence reduces predicted output, consistent with the IEC 61400-12-1 power curve scatter). For temp_lag1: weak positive correlation (cold air → higher air density → higher power, consistent with Chapter 8 air density correction).
> **Caption:** SHAP beeswarm plot for the 500-tree XGBoost wind power forecast model. Each point represents one sample; position on the x-axis shows that sample's SHAP value for the given feature (contribution to the deviation from mean prediction). The model's three dominant drivers — lagged wind speed, wind direction, and turbulence intensity — correspond precisely to the physical drivers identified in Chapters 5, 8, and 9.
> **Alt text:** Beeswarm plot with eighteen rows, one per feature, showing SHAP values distributed around zero. Wind speed lag-1 shows the widest spread and strongest feature values; turbulence intensity shows negative SHAP values at high TI.
> **Data source:** Author illustration — representative SHAP distribution from wind power XGBoost model; specific values will vary with training data
> **Resolution:** 1400 × 1000 px minimum
> **Color notes:** Feature value colour scale from navy (low) through white (median) to crimson (high)

---

## 34.7 Worked Example: Training the XGBoost Baseline

The 50,399-record feature matrix from Chapter 33 is split into training and test sets using a single temporal cut at the 80th percentile by time — approximately month 11 of 14. The training set (40,319 records, months 1–11) is used for hyperparameter tuning via five-fold TimeSeriesSplit cross-validation; the test set (10,080 records, months 12–14) is held out until the final evaluation.

**Hyperparameters selected by cross-validation:**

| Parameter | Symbol | Selected Value | Effect |
|-----------|--------|----------------|--------|
| Number of estimators | $n_{\text{est}}$ | 500 | More trees, better accuracy, slower training |
| Maximum tree depth | $D_{\max}$ | 6 | Balances expressiveness and overfitting |
| Learning rate | $\eta$ | 0.05 | Conservative; requires more trees |
| Row subsampling | $r_{\text{row}}$ | 0.80 | 80% of training records per tree |
| Column subsampling | $r_{\text{col}}$ | 0.80 | 80% of features per tree |
| L1 leaf regularisation | $\gamma$ | 0.10 MW² | Discourages excessive splits |
| L2 leaf weight reg. | $\lambda$ | 1.0 | Moderate leaf weight damping |

**Cross-validation performance (5-fold TimeSeriesSplit):**

The mean absolute percentage error (MAPE) across the five folds ranges from 6.8% (summer, stable winds) to 8.1% (winter, storm periods). The cross-validation estimate is MAPE = 7.3% ± 0.6%.

**Test set performance:**

Training on all 40,319 records and evaluating on the held-out 10,080 produces:

$$
\text{MAPE} = \frac{1}{N} \sum_{i=1}^{N} \left| \frac{y_i - \hat{y}_i}{y_i} \right| \times 100\%
$$

where:
- $y_i$ = measured farm power output, sample $i$ [MW]
- $\hat{y}_i$ = XGBoost prediction, sample $i$ [MW]
- $N$ = number of test samples = 10,080 [dimensionless]

Result: **MAPE = 7.4%**

**Comparison to baselines:**

| Model | MAPE | Notes |
|-------|------|-------|
| Raw SCADA (unfiltered) + persistence | 14.6% | Dirty data, no model — worst case |
| Cleaned data (Ch 33) + persistence | 11.3% | Data quality gain only |
| Cleaned data + XGBoost | **7.4%** | Data quality + model |
| Theoretical lower bound (NWP skill limit) | ~5.0–5.5% | Irreducible NWP forecast error |

The improvement from Chapter 33's cleaning pipeline to the XGBoost model is 3.9 percentage points — roughly equal to the improvement from raw persistence to cleaned persistence (3.3 points). The model and the data quality pipeline contribute approximately equally to total performance.

**SHAP feature importance (mean absolute SHAP value):**

| Rank | Feature | Mean |ΦSHAP| [MW] | Fraction of total |
|------|---------|------|---------|
| 1 | Wind speed lag-1 ($v_{-1}$) | 43.1 | 38% |
| 2 | Wind direction sine ($\sin\theta$) | 15.8 | 14% |
| 3 | Wind speed lag-2 ($v_{-2}$) | 13.5 | 12% |
| 4 | Turbulence intensity (TI) | 9.3 | 8% |
| 5 | Temperature lag-1 ($T_{-1}$) | 6.8 | 6% |
| 6–18 | Remaining features | 25.0 | 22% |
| | **Total** | **113.5** | **100%** |

The model recovered, through gradient boosting on 50,399 wind power records, the same physical hierarchy that Maja had explained from a met mast platform in Chapter 8: wind speed is the primary driver of power (cubic relationship, so lag-1 wind speed captures most of the current-state information), wind direction determines which turbines wake-shade which others (Chapter 10), turbulence intensity degrades power curve performance (Chapter 5), and temperature affects air density (Chapter 8). The algorithm did not know these physical relationships. It learned them from the data.

**Financial value of the MAPE improvement:**

Replacing the persistence baseline (MAPE 11.3%) with the XGBoost model (MAPE 7.4%) represents a 3.9 percentage point improvement. Using the PSE balancing market cost estimate from Chapter 33 of EUR 5–8M per percentage point per year for a 510 MW farm at 0.45 capacity factor:

$$
\Delta \text{Revenue} = 3.9 \times \text{EUR}\ 5{-}8\text{M} = \text{EUR}\ 19.5{-}31.2\text{M/year}
$$

Over the 30-year design life, at a 5% discount rate, this corresponds to a net present value of approximately **EUR 300–480 million** — from a model that trains in less than three minutes on a standard CPU server.

---

## Key Takeaways

- **One tree cannot be both accurate and stable.** The bias-variance tradeoff means a shallow tree underfits and a deep tree overfits; no single depth achieves both. Ensemble methods exist precisely because this is a mathematical rather than a practical limitation.
- **Gradient boosting accumulates corrections.** Unlike bagging, which averages independent trees, gradient boosting trains each tree to reduce the errors of the previous ensemble. Every tree is a correction to its predecessors, and the ensemble error decreases monotonically with the number of trees (with regularisation).
- **XGBoost's engineering advantages are specific.** Regularisation ($\gamma$, $\lambda$), native missing-value handling, and histogram-based split finding are not minor improvements over plain gradient boosting: they are what makes the algorithm deployable on real, imperfect industrial datasets. The Kaggle-win statistic is evidence of production robustness, not academic novelty.
- **TimeSeriesSplit is mandatory for time-series data.** Shuffled cross-validation produces optimistic MAPE estimates because it allows models to learn from their own future. Walk-forward validation with a temporal gap equal to the forecast horizon is the only correct procedure for wind power forecasting applications.
- **SHAP values make the model accountable.** The XGBoost model rediscovered the physical hierarchy of wind power drivers (wind speed → direction → turbulence → density) that physical theory predicts. This is not coincidence: it is evidence that the cleaned data and the feature engineering in Chapter 33 correctly represented the underlying physics. When a model's SHAP values contradict physical expectations, it is usually the data pipeline, not the model, that needs investigation.

---

## For Further Reading

- **Chen, T., & Guestrin, C. (2016). "XGBoost: A Scalable Tree Boosting System."** *Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining*, pp. 785–794. The original XGBoost paper. Section 3 derives the regularised objective and the weighted quantile sketch in full mathematical detail. Sections 5–6 present the system-level engineering (cache-aware computation, out-of-core learning) that underlies the algorithm's scalability. Freely available on arXiv (1603.02754).

- **Friedman, J.H. (2001). "Greedy Function Approximation: A Gradient Boosting Machine."** *Annals of Statistics*, 29(5), 1189–1232. DOI: 10.1214/aos/1013203451. The foundational paper for gradient boosting. Sections 4–5 introduce the stochastic gradient boosting variant (row subsampling) that XGBoost inherits. The paper is notable for deriving the gradient boosting framework for arbitrary differentiable loss functions, making it applicable to regression, classification, and survival analysis with the same underlying algorithm.

- **Lundberg, S.M., & Lee, S.-I. (2017). "A Unified Approach to Interpreting Model Predictions."** *Advances in Neural Information Processing Systems*, 30 (NIPS 2017), pp. 4765–4774. The original SHAP paper. Theorem 1 proves uniqueness of the SHAP attribution among all additive feature attribution methods satisfying local accuracy, missingness, and consistency. The proof connects the machine learning attribution problem directly to Shapley's 1953 cooperative game theory result, showing that SHAP is not an approximation to Shapley values — it is the exact Shapley value of a specific cooperative game defined by the model's prediction function.

---

*When Jonasz printed the SHAP beeswarm plot, he did not pin it to the whiteboard immediately. He held it at arm's length for a long moment, studying the spread of points.*

*Kaan looked at the output. The top feature — wind speed at t−1, accounting for 38% of the model's total explanatory power — was not surprising. But the fourth row caught him: turbulence intensity, with a cluster of negative SHAP values at the high-TI end of the feature scale. High turbulence, predicting lower-than-expected output. Morten had explained this from a cross-section of a decommissioned blade on trestles in Chapter 5, months and a different universe ago: turbulent inflow degrades the lift distribution across the blade, reduces the effective Cp, pulls the operating point below the ideal power curve. The XGBoost model had learned the same thing from 50,399 ten-minute records without being told any of it.*

*"The model found the physics," Kaan said.*

*"The model found a pattern that correlates with physics," Jonasz said, which was not a correction but a precision. He pinned the plot to the whiteboard, below the LEARN header. "If the physics changed — if a bearing failure began adding vibration, or a pitch controller drifted by two degrees — the pattern would change first and the SHAP values would shift. The model does not know why. But it knows the pattern well enough that you can use the deviation to ask why." He turned back to the notebook. "That is the difference between a forecasting model and a monitoring tool. The same algorithm. Different questions."*

*"And for 24-hour ahead?" Kaan asked.*

*"Seven point four percent," Jonasz said. "Better than persistence. Better than what most farms achieved five years ago." He pulled up the error breakdown by forecast horizon — one step, two, six, twelve, twenty-four hours ahead. The curve rose steadily from left to right: 4.1% at one hour, 7.4% at twenty-four. "The problem begins here." He tapped the x-axis at the 12-hour mark, where the slope steepened. "After twelve hours, the lag features carry very little information about what the wind is actually doing. The model knows what the wind was doing this morning. It does not know what the weather system will do by evening. For that, you need memory." He opened a new browser tab. The filename was `05_lstm_v01.ipynb`. "XGBoost treats every ten-minute record as an independent feature vector. It has no concept of a sequence. That is tomorrow's problem."*

*Outside the windowless data lab, the Baltic wind was already building the training data for the next twelve months.*

---

## Notes

[^1]: Breiman, L., Friedman, J., Olshen, R., & Stone, C. (1984). *Classification and Regression Trees*. Wadsworth & Brooks, Monterey, CA. The CART text unified classification and regression tree methods into a single framework and introduced the recursive binary splitting algorithm described in Section 34.1. Chapter 8 covers regression trees specifically; Chapter 3 covers the impurity measures used for split selection, including the residual sum of squares criterion used here. The book remains in print (CRC Press) and is the standard reference for the CART algorithm. Breiman was 57 at publication; Friedman had previously collaborated with him on projection pursuit (1981), and the two would later independently develop ensemble methods — Breiman through bagging and Random Forests, Friedman through gradient boosting.

[^2]: Breiman, L. (1996). "Bagging Predictors." *Machine Learning*, 24(2), 123–140. DOI: 10.1007/BF00058655. The paper that introduced bootstrap aggregating. Section 2 presents the bias-variance analysis of bagging; Section 4 applies it to regression trees, demonstrating 20–30% MAPE reduction on reference datasets. Breiman was 60 when this paper appeared; his 2001 *Statistical Science* essay "Statistical Modeling: The Two Cultures" (20(3), 199–231) provides the intellectual context for his shift from classical statistical modelling to algorithmic learning methods, a transition that produced both bagging and Random Forests.

[^3]: Breiman, L. (2001). "Random Forests." *Machine Learning*, 45(1), 5–32. DOI: 10.1023/A:1010933404324. Section 2 proves the error bound for Random Forests in terms of the strength of individual trees and the correlation between them; Section 4 introduces the random feature subsampling that decorrelates the trees. The feature subsampling fraction of $\lfloor\sqrt{p}\rfloor$ for classification and $\lfloor p/3 \rfloor$ for regression is empirically motivated in Section 4.1. Random Forests remain competitive with XGBoost on many structured datasets and are frequently preferred when training speed and hyperparameter robustness outweigh marginal MAPE improvement.

[^4]: Friedman, J.H. (2001). "Greedy Function Approximation: A Gradient Boosting Machine." *Annals of Statistics*, 29(5), 1189–1232. DOI: 10.1214/aos/1013203451. The paper that introduced gradient boosting for general differentiable loss functions. Section 4.1 introduces the stochastic gradient boosting variant (subsampling of training records), which Friedman noted improved both accuracy and computation time, and which XGBoost later generalised to include column (feature) subsampling. The publication venue — the *Annals of Statistics*, a theoretical mathematics journal — reflects the era's disciplinary boundaries; the algorithmic contributions would later be classified as machine learning. Friedman's companion paper "Stochastic Gradient Boosting" (Computational Statistics & Data Analysis, 38(4), 367–378, 2002, DOI: 10.1016/S0167-9473(01)00065-2) formalises the subsampling analysis.

[^5]: Chen, T., & Guestrin, C. (2016). "XGBoost: A Scalable Tree Boosting System." *Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining*, pp. 785–794. DOI: 10.1145/2939672.2939785. Also available as arXiv preprint 1603.02754. The Kaggle competition statistic (17 of 29 winning solutions, 2015 challenge outcomes) is reported in Section 1.1 of the paper. Section 3 derives the regularised objective and the weighted quantile sketch for approximate split finding. Tianqi Chen was a PhD student at the Paul G. Allen School of Computer Science and Engineering, University of Washington, when the first public XGBoost release appeared in 2014. He received the 2022 ACM SIGKDD Test of Time Award for this paper at the 10-year retrospective. Carlos Guestrin was his PhD advisor; Guestrin subsequently moved to Apple and later founded Turi (acquired by Apple in 2016).

[^6]: Shapley, L.S. (1953). "A Value for n-Person Games." In Kuhn, H.W., & Tucker, A.W. (Eds.), *Contributions to the Theory of Games*, Vol. 2, pp. 307–317. Princeton University Press, Princeton, NJ. This is the paper in which the Shapley value is defined and its uniqueness proved from four axioms (efficiency, symmetry, dummy, and additivity). Shapley was 23 at publication; his doctoral thesis at Princeton (1953, advisor: Albert Tucker) introduced both the Shapley value and the Shapley-Shubik power index. He joined the UCLA Department of Economics in 1981, where he remained for the rest of his career. The 2012 Nobel Prize in Economic Sciences, shared with Alvin Roth, was awarded "for the theory of stable allocations and the practice of market design." Shapley's stable matching theorem (with David Gale, 1962) was cited alongside the value in the Nobel announcement; Shapley himself noted that he considered his contributions to be mathematics rather than economics.

[^7]: Lundberg, S.M., & Lee, S.-I. (2017). "A Unified Approach to Interpreting Model Predictions." *Advances in Neural Information Processing Systems* (NIPS 2017), 30, pp. 4765–4774. The paper that introduced SHapley Additive exPlanations (SHAP). Theorem 1 proves that among all additive feature attribution methods satisfying local accuracy, missingness, and consistency, the unique solution is the Shapley value of a specific cooperative game. Lundberg was a PhD student at the University of Washington (advisor: Su-In Lee, Paul G. Allen School) — the same department that produced XGBoost. The connection is not coincidence: the SHAP framework was developed specifically to explain tree-based models, including XGBoost. The open-source `shap` Python package (available at github.com/shap/shap) implements all algorithms described in this chapter and is the standard tool for SHAP computation in production ML systems.

[^8]: Lundberg, S.M., Erion, G., Chen, H., DeGrave, A., Prutkin, J.M., Nair, B., Katz, R., Himmelfarb, J., Bansal, N., & Lee, S.-I. (2020). "From Local Explanations to Global Understanding with Explainable AI for Trees." *Nature Machine Intelligence*, 2(1), 56–67. DOI: 10.1038/s42256-019-0138-9. The TreeSHAP paper. Algorithm 1 presents the polynomial-time exact Shapley value computation for tree ensembles, achieving $O(TLD^2)$ complexity versus the exponential cost of exact marginalisation. The paper demonstrates SHAP applied to clinical sepsis prediction, showing how SHAP dependency plots can reveal feature interactions invisible to traditional importance measures. The same methodology applies directly to wind power forecasting: the SHAP interaction between wind speed and turbulence intensity (high TI reduces the Shapley value of wind speed) corresponds to the physical interaction between wind speed and power curve Cp degradation described in IEC 61400-12-1.

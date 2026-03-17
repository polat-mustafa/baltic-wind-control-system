# Lesson 016 - Ensemble Forecasting, Ramp Detection and Model Evaluation

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 015 - TFT Multi-Horizon Forecasting](lesson-015.md) | **Next:** [Lesson 017 - Commissioning Workflow and LOTO](lesson-017.md) :material-arrow-right:

    **Phase:** P4 | **Language:** English | **Progress:** 17 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-27
> **Phase:** P4 (AI Forecasting)
> **Roadmap sections:** [Phase 4 - Evaluation Metrics, Ensemble Methods and Ramp Detection]
> **Language:** English
> **Previous lesson:** Lesson 015

---

## What You Will Learn

- Why no single forecasting model dominates every horizon
- How horizon-dependent ensemble weighting improves operational usefulness
- Why ramp detection matters to the grid beyond ordinary forecast accuracy
- How to evaluate models with metrics that reflect both error and skill

## Section 1: Horizon-Dependent Ensembles

Different models excel at different forecast horizons. Short-horizon behaviour may favour XGBoost, medium-range dependence may favour LSTM, and longer interpretable horizons may favour TFT. The ensemble therefore changes weights by forecast band instead of pretending one model is universally best.

## Section 2: Ramp Detection

Grid operators care not only about average forecast error but also about sudden large changes in output. Ramp detection converts the forecast from a passive estimate into an early-warning tool for balancing, reserve activation, and voltage-control readiness.

## Section 3: Bridging Forecasts to Grid Stability

The lesson explicitly links P4 to P2 and P3. Severe ramp-down events can trigger network-management attention, compensation adjustments, and SCADA alerts. Forecasting therefore becomes part of system operations, not just analytics.

## Section 4: Evaluation Metrics

RMSE alone is not enough. Proper evaluation also considers horizon dependence, quantile behaviour, baseline comparison, and skill score. A model is useful only when it outperforms meaningful reference behaviour.

## Key Takeaways

- Ensemble design should reflect horizon-specific strengths.
- Ramp events are operationally critical even when average metrics look good.
- Forecasting outputs can feed grid and SCADA workflows directly.
- Evaluation must go beyond a single error number.

## Interview Corner

### Explain Simply

We combined several forecast models and added a way to warn the grid when wind power is likely to change very fast.

### Explain Technically

The lesson builds a horizon-aware ensemble, adds ramp-event classification, and evaluates probabilistic forecast performance with richer metrics that connect forecasting quality to operational usefulness.


# Lesson 013 - XGBoost Quantile Forecasting: NWP Pipeline, Probabilistic Power Forecasting and SHAP Explainability

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 012 - SCADA Data Pipeline](lesson-012.md) | **Next:** [Lesson 014 - LSTM Forecasting with MC Dropout](lesson-014.md) :material-arrow-right:

    **Phase:** P4 | **Language:** English | **Progress:** 14 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-26
> **Phase:** P4 (AI Forecasting)
> **Roadmap sections:** [Phase 4 - Quantile Forecasting, NWP Features and Explainability]
> **Language:** English
> **Previous lesson:** Lesson 012

---

## What You Will Learn

- Why XGBoost is a strong baseline for short-horizon wind-power forecasting
- How NWP features complement SCADA lag features in a production forecasting pipeline
- Why quantile regression is better aligned with operational risk than point forecasting alone
- How SHAP explains which features drive the forecast

## Section 1: Why XGBoost First

Tree-based models are fast, robust, and effective for structured feature sets. In forecasting practice they often provide an excellent baseline, especially at short horizons where lagged SCADA signals remain highly informative.

## Section 2: NWP and Feature Engineering

Forecast quality improves when local SCADA history is combined with weather-model information. The lesson therefore treats feature engineering as a fusion problem between plant measurements and atmospheric predictors.

## Section 3: Quantile Forecasting

Operational planning benefits from uncertainty bands. Quantile forecasting produces P10, P50, and P90 directly, allowing dispatch and risk decisions to reflect asymmetry and forecast spread.

## Section 4: SHAP Explainability

High-performing forecasts still need interpretation. SHAP provides a principled way to decompose individual predictions into feature contributions, which makes the model more transparent to engineers and interviewers.

## Key Takeaways

- XGBoost is an effective benchmark for short-horizon forecasting.
- SCADA and NWP features should be fused, not treated as competing sources.
- Quantile outputs are operationally more useful than point estimates alone.
- Explainability strengthens engineering trust in the model.

## Interview Corner

### Explain Simply

We built a forecast model that not only predicts future power, but also shows a likely range and explains which inputs mattered most.

### Explain Technically

The lesson establishes an XGBoost-based probabilistic forecasting stack that combines SCADA and NWP features, optimises quantile objectives, and interprets predictions through SHAP attribution.

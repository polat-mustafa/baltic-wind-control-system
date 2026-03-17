# Lesson 012 - SCADA Data Pipeline: Power Curves, Synthetic Production, Quality Filters and Physical Constraints

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 011 - RBAC and Permit-to-Work](lesson-011.md) | **Next:** [Lesson 013 - XGBoost Quantile Forecasting](lesson-013.md) :material-arrow-right:

    **Phase:** P3/P4 | **Language:** English | **Progress:** 13 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-26
> **Phase:** P3 to P4 transition
> **Roadmap sections:** [Phase 3 - Data Quality, Phase 4 - Forecasting Inputs]
> **Language:** English
> **Previous lesson:** Lesson 011

---

## What You Will Learn

- Why forecasting quality depends first on SCADA data quality
- How synthetic production data can be generated while preserving basic physics
- Why quality filtering must remove impossible values before model training begins
- How physical constraints serve as a model-agnostic safety layer

## Section 1: Data Quality Before Model Complexity

A sophisticated model trained on bad data will produce sophisticated errors. The project therefore treats filtering, validation, and plausibility checks as the first stage of forecasting engineering.

## Section 2: Synthetic Production and Power Curves

When real historical data are limited, synthetic generation can support development and testing. However, it must still honour turbine operating regions, rated power, and zero-production conditions below cut-in and above cut-out.

## Section 3: Quality Filters and Physical Constraints

Negative power, impossible temperatures, discontinuous timestamps, or inconsistent wind-power pairs should be corrected or rejected before they reach the training set. These filters are a bridge between domain knowledge and machine learning practice.

## Key Takeaways

- Good forecasting starts with trustworthy SCADA inputs.
- Synthetic data are useful only when they respect physical limits.
- Quality filters are part of engineering modelling, not only preprocessing.
- Physical constraints can be reused across multiple forecasting models.

## Interview Corner

### Explain Simply

We cleaned and structured the SCADA data so later forecasting models do not learn impossible turbine behaviour.

### Explain Technically

The lesson formalises a physics-aware SCADA preprocessing chain: synthetic production generation, power-curve consistency checks, quality filtering, and reusable physical constraints for downstream ML models.

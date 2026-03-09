# Lesson 014 - LSTM Time-Series Forecasting: Uncertainty Estimation with MC Dropout

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 013 - XGBoost Quantile Forecasting](lesson-013.md) | **Next:** [Lesson 015 - TFT Multi-Horizon Forecasting](lesson-015.md) :material-arrow-right:

    **Phase:** P4 | **Language:** English | **Progress:** 15 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-26
> **Phase:** P4 (AI Forecasting)
> **Roadmap sections:** [Phase 4 - LSTM and Wind Power Forecasting]
> **Language:** English
> **Previous lesson:** Lesson 013

---

## What You Will Learn

- Why sequential models become useful when temporal order matters strongly
- How LSTM gates manage memory and information flow over time
- Why MC Dropout can be used as an approximate Bayesian uncertainty method
- How the project combines sequence generation, validation, and physical post-processing

## Section 1: Why Sequence Models Matter

XGBoost sees each row as a feature vector, but a wind-power time series also contains ordering, persistence, and temporal regime information. LSTM is introduced to model that sequence dependence more explicitly.

## Section 2: LSTM Cell Mechanics

The LSTM cell uses gating logic to decide what to keep, what to forget, and what to expose at the output. This makes it more stable than a simple recurrent network when learning medium-range temporal structure.

## Section 3: MC Dropout for Uncertainty

Running dropout-enabled inference multiple times gives an approximate distribution of predictions rather than a single deterministic output. In this project, that distribution is transformed into P10, P50, and P90 style forecast bands.

## Section 4: Training and Validation Pipeline

Sequence creation, normalization, TimeSeriesSplit validation, and early stopping are part of one coherent pipeline. The lesson emphasises that validation must respect temporal order to avoid leakage.

## Section 5: Physical Safety Layer

Even a neural forecast must obey turbine physics. Final outputs are clipped and reordered if necessary so that quantiles remain monotonic and power stays within feasible limits.

## Key Takeaways

- LSTM is useful when temporal ordering carries predictive value.
- MC Dropout gives a practical uncertainty estimate without building a full Bayesian network.
- Validation design matters as much as network architecture.
- Physics constraints remain mandatory after ML inference.

## Interview Corner

### Explain Simply

We taught the model to read a sequence of past turbine behaviour and to express how uncertain it is about the future.

### Explain Technically

The lesson introduces an LSTM forecasting pipeline with sliding-window sequences, temporally correct cross-validation, MC Dropout uncertainty estimation, and model-agnostic physical post-processing.

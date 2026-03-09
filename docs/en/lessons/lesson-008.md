# Lesson 008 - Dynamic Grid Compliance: ANDES, Fault Ride Through, Frequency Response and SSO

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 007 - HV Grid Integration](lesson-007.md) | **Next:** [Lesson 009 - IEC 61850 Data Model and SCL](lesson-009.md) :material-arrow-right:

    **Phase:** P2 | **Language:** English | **Progress:** 9 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-25
> **Phase:** P2 (HV Grid Integration)
> **Roadmap sections:** [Phase 2 - Dynamic Studies, Fault Ride Through, Frequency Support]
> **Language:** English
> **Previous lesson:** Lesson 007

---

## What You Will Learn

- Why steady-state compliance is not enough for offshore wind integration
- How ANDES is used to study fault ride through, frequency response, and converter behaviour
- Why sub-synchronous oscillation and converter-control interactions must be considered early
- How grid-code obligations translate into dynamic simulation requirements

## Section 1: Why Dynamic Compliance Matters

A wind farm that looks acceptable in load flow may still disconnect during a voltage dip or behave poorly during a system disturbance. Dynamic studies answer the question that steady-state tools cannot: what happens in time when the grid is stressed?

## Section 2: Fault Ride Through

Fault ride through is one of the core Type D generator obligations. The plant must remain connected through specified voltage depressions and support recovery instead of tripping immediately. This requirement drives both converter control assumptions and test scenarios.

## Section 3: Frequency Response and Grid Support

Modern offshore wind plants are expected to contribute to frequency stability through functions such as LFSM-O, LFSM-U, and frequency-sensitive response. Dynamic simulation is therefore not a luxury feature but part of grid-code compliance engineering.

## Section 4: Converter Interactions and SSO

Large converter-dominated systems can interact with network impedance in unstable ways. Sub-synchronous oscillation is especially important when weak-grid effects, long cables, and power-electronic controls coexist. The lesson frames this as a system-stability risk, not as a niche academic topic.

## Key Takeaways

- Dynamic compliance extends beyond normal load-flow acceptability.
- FRT and frequency support must be checked against time-domain behaviour.
- Converter-rich networks can create oscillatory risks that steady-state models hide.
- ANDES becomes the dynamic counterpart to the earlier Pandapower model.

## Interview Corner

### Explain Simply

We checked whether the wind farm can stay connected and behave correctly when the grid suffers a disturbance.

### Explain Technically

This lesson introduces ANDES-based time-domain studies for FRT, frequency-response modes, and converter-interaction risks such as SSO, translating NC RfG-style obligations into dynamic simulation workflows.

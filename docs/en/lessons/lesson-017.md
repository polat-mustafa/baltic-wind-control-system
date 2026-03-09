# Lesson 017 - P5 Commissioning: Switching Programme, Equipment State Machine and LOTO Isolation Management

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 016 - Ensemble Forecasting](lesson-016.md) | **Next:** [Lesson 018 - FAT/SAT and Protection Coordination](lesson-018.md) :material-arrow-right:

    **Phase:** P5 | **Language:** English | **Progress:** 18 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-27
> **Phase:** P5 (Commissioning)
> **Roadmap sections:** [Phase 5 - HV Switching and Safety, Testing and Commissioning]
> **Language:** English
> **Previous lesson:** Lesson 016

---

## What You Will Learn

- Why commissioning logic must be represented as explicit state transitions
- How a switching programme enforces sequence, preconditions, and verification steps
- Why LOTO isolation management belongs inside the operational workflow model
- How commissioning APIs expose execution safely

## Section 1: Equipment State Machines

Switchgear does not move arbitrarily between states. Open, closed, earthed, isolated, and intermediate states all carry physical meaning. Explicit transition maps prevent software from allowing impossible or unsafe actions.

## Section 2: LOTO Isolation Management

Lockout-tagout is not paperwork; it is an energy-isolation control. Treating isolation points as structured workflow objects ensures that the platform can track what is locked, by whom, and for which programme.

## Section 3: Switching Programme Execution

A professional switching programme is sequential by design. Preconditions, action, verification, and sign-off must all be satisfied before the next step can begin. This is the operational core of the commissioning simulation.

## Section 4: API and Workflow Discipline

The REST API does not replace HV authority. It exposes programme state, execution requests, PiC decisions, and emergency-stop capabilities in a controlled form suitable for simulation and training.

## Key Takeaways

- Commissioning logic should be modelled, not improvised.
- State machines make unsafe transitions explicit and preventable.
- LOTO tracking is part of digital safety management.
- APIs must reflect operational authority boundaries.

## Interview Corner

### Explain Simply

We turned high-voltage switching and isolation into a step-by-step digital workflow so the system can only move through safe states.

### Explain Technically

The lesson establishes a state-machine-driven commissioning model with programme sequencing, LOTO object management, PiC-governed execution, and API-level control surfaces for P5 simulation.


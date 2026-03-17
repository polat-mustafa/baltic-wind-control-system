# Lesson 018 - FAT/SAT Acceptance Testing, Protection Relay Coordination and the SAT Gate

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 017 - Commissioning Workflow and LOTO](lesson-017.md) | **Next:** None :material-arrow-right:

    **Phase:** P5 | **Language:** English | **Progress:** 19 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-27
> **Phase:** P5 (Commissioning)
> **Roadmap sections:** [Phase 5 - Testing and Commissioning, Protection Coordination]
> **Language:** English
> **Previous lesson:** Lesson 017

---

## What You Will Learn

- Why acceptance testing must be split between factory and site campaigns
- How tolerance bands and test criteria can be represented as data structures
- Why protection coordination is central to selective fault clearance
- How the SAT gate prevents energisation before test readiness is proven

## Section 1: Factory Acceptance Testing

FAT verifies that critical equipment meets specification before shipment. In offshore projects this is especially important because correcting a defect after offshore installation is dramatically more expensive than finding it in the factory.

## Section 2: Site Acceptance Testing

SAT validates what happened after transport, installation, wiring, and integration. A unit that passed FAT may still fail on site because of handling, assembly, or communication issues.

## Section 3: Protection Coordination

Protection systems must trip the right device at the right time. Coordination therefore combines settings, grading margins, and selectivity verification. This logic directly affects both safety and availability.

## Section 4: The SAT Gate

The SAT gate acts as a final energisation lock. If required tests are incomplete or outside tolerance, the programme should not proceed. Embedding this rule into workflow logic reduces the chance of unsafe energisation.

## Key Takeaways

- FAT and SAT answer different engineering questions.
- Structured test limits improve reproducibility and traceability.
- Protection coordination is a selective-clearing problem, not just a settings list.
- The SAT gate is a digital safety barrier before energisation.

## Interview Corner

### Explain Simply

We built the acceptance-test and protection checks that must pass before the wind farm can be energised safely.

### Explain Technically

The lesson links factory and site acceptance campaigns, tolerance-driven test recording, protection selectivity verification, and SAT-gate enforcement into the final safety and readiness layer of P5.


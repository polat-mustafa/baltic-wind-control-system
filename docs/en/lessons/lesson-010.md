# Lesson 010 - GOOSE Fault Simulation, Protection Timeline and SCADA API Endpoints

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 009 - IEC 61850 Data Model](lesson-009.md) | **Next:** [Lesson 011 - IEC 62443 RBAC and Permit-to-Work](lesson-011.md) :material-arrow-right:

    **Phase:** P3 | **Language:** English | **Progress:** 11 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-25
> **Phase:** P3 (SCADA and Automation)
> **Roadmap sections:** [Phase 3 - GOOSE Behaviour, Protection and API Design]
> **Language:** English
> **Previous lesson:** Lesson 009

---

## What You Will Learn

- Why protection events must be described on a millisecond timeline rather than as generic alarms
- How GOOSE messaging differs from ordinary SCADA polling
- Why a simplified educational simulation still needs correct architectural boundaries
- How API endpoints expose the simulated protection workflow safely

## Section 1: GOOSE and the Protection Time Scale

GOOSE exists for fast peer-to-peer messaging. It belongs to the protection and automation layer, not to ordinary slow supervisory polling. A realistic lesson therefore focuses on sequence and latency, even when the implementation is simplified for teaching purposes.

## Section 2: Fault Simulation and Event Ordering

Protection correctness depends on the order of events: fault detection, message publication, breaker opening, and state confirmation. A timeline model makes those dependencies explicit and exposes where selectivity or delay problems would appear.

## Section 3: SCADA API Integration

The repository still needs application endpoints for educational control and observability. The key design rule is to keep the APIs clearly labelled as supervisory interfaces rather than pretending that HTTP itself is the real protection transport.

## Key Takeaways

- Protection logic lives on a faster time scale than conventional SCADA interaction.
- Event ordering is as important as event existence.
- Educational abstractions are acceptable only when they stay honest about what is simplified.
- API design must respect the boundary between simulation and real substation communications.

## Interview Corner

### Explain Simply

We modelled how a fault travels through the digital protection chain and how the software reports that sequence.

### Explain Technically

This lesson connects GOOSE-style event sequencing, protection timeline modelling, and supervisory API exposure while preserving the distinction between Layer 2 protection communication and higher-level software interfaces.

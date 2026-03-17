# Lesson 009 - IEC 61850 Data Model, SCL Builder and SCADA Asset Registry

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 008 - Dynamic Grid Compliance](lesson-008.md) | **Next:** [Lesson 010 - GOOSE Simulation and Protection Timeline](lesson-010.md) :material-arrow-right:

    **Phase:** P3 | **Language:** English | **Progress:** 10 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-25
> **Phase:** P3 (SCADA and Automation)
> **Roadmap sections:** [Phase 3 - IEC 61850 Modelling, SCL and Device Registry]
> **Language:** English
> **Previous lesson:** Lesson 008

---

## What You Will Learn

- Why IEC 61850 is a data model before it is a communication implementation
- How logical nodes, data objects, and naming discipline support interoperable substation engineering
- Why SCL generation matters for digital substation traceability
- How the SCADA asset registry becomes the operational backbone of the automation layer

## Section 1: IEC 61850 as Information Architecture

IEC 61850 standardises how substation functions are described, named, and related. This matters because protection, control, and SCADA systems must agree on the meaning of each signal before they can exchange it reliably.

## Section 2: SCL as the Engineering Source File

Substation Configuration Language is the structured description of devices, logical nodes, communication links, and datasets. Treating SCL as a first-class engineering artefact improves consistency between configuration, simulation, and documentation.

## Section 3: SCADA Asset Registry

A registry of devices, equipment identifiers, and communication roles gives the software platform an operational source of truth. It connects abstract IEC 61850 models to concrete plant assets that later appear in alarms, APIs, and commissioning steps.

## Key Takeaways

- IEC 61850 begins with modelling discipline, not transport protocols.
- SCL is critical for reproducible substation engineering.
- The asset registry links engineering models to operational software objects.
- P3 depends on strong naming and traceability, not only on screens and dashboards.

## Interview Corner

### Explain Simply

We created the structured language the digital substation uses to describe equipment and signals consistently.

### Explain Technically

The lesson establishes IEC 61850 logical modelling, SCL-oriented configuration generation, and asset-registry traceability as the core information architecture for P3.

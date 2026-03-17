# Lesson 011 - IEC 62443 RBAC and the Permit-to-Work Lifecycle

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 010 - GOOSE Simulation and Protection Timeline](lesson-010.md) | **Next:** [Lesson 012 - SCADA Data Pipeline](lesson-012.md) :material-arrow-right:

    **Phase:** P3 | **Language:** English | **Progress:** 12 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-25
> **Phase:** P3 (SCADA and Automation)
> **Roadmap sections:** [Phase 3 - OT Security, RBAC and Permit-to-Work]
> **Language:** English
> **Previous lesson:** Lesson 010

---

## What You Will Learn

- Why OT cybersecurity and operational safety workflows must be designed together
- How role-based access control maps onto IEC 62443-style zone and authority thinking
- Why Permit-to-Work is best treated as a strict state machine
- How auditability protects both safety and compliance

## Section 1: RBAC as an Operational Safety Control

In a high-voltage environment, access is not only an IT concern. The wrong user performing the wrong action at the wrong time can create a safety incident. RBAC therefore acts as both a cybersecurity control and an operational discipline mechanism.

## Section 2: Permit-to-Work as a State Machine

A Permit-to-Work should not move freely between arbitrary statuses. It must follow a defined progression: request, assessment, approval, isolation, lockout, execution, restoration, and closure. Modelling this explicitly prevents unsafe shortcuts.

## Section 3: Why Audit Logs Matter

Every change of state should be attributable to a person, a time, and a reason. In engineering terms, this supports incident review, procedural compliance, and trust in the digital workflow.

## Key Takeaways

- OT access control is part of plant safety.
- Permit-to-Work workflows need strict transition rules.
- Audit logging is a core design feature, not optional telemetry.
- P3 combines cybersecurity, operations, and traceability in one service layer.

## Interview Corner

### Explain Simply

We made sure only the right people can perform the right operational actions and that every safety workflow step is recorded.

### Explain Technically

The lesson integrates IEC 62443-inspired RBAC with a state-machine representation of the Permit-to-Work lifecycle, reinforced by explicit audit-trail design for OT accountability.

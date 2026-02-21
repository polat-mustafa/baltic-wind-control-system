# Offshore Wind HV Control Simulation Platform

[![CI](https://github.com/polat-mustafa/baltic-wind-control-system/actions/workflows/ci.yml/badge.svg)](https://github.com/polat-mustafa/baltic-wind-control-system/actions/workflows/ci.yml)
[![Docs](https://github.com/polat-mustafa/baltic-wind-control-system/actions/workflows/docs.yml/badge.svg)](https://polat-mustafa.github.io/baltic-wind-control-system/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.13](https://img.shields.io/badge/Python-3.13-3776AB.svg)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](https://www.typescriptlang.org/)

A production-grade educational simulation of a **510 MW Baltic Sea offshore wind farm** — from wind resource assessment through HV commissioning. Built to teach both **energy engineering** and **full-stack software engineering** simultaneously.

**34 × Vestas V236-15.0 MW** | 66 kV array cables | 220 kV export (45 km) | 400 kV PSE grid connection

---

## Why This Project Exists

This platform is a **flight simulator for offshore wind HV control engineers**. Just as pilots train on simulators before entering a cockpit, this project lets you practice every aspect of wind farm engineering — resource assessment, grid integration, SCADA automation, AI forecasting, and commissioning — in a safe, instrumented environment where mistakes are learning opportunities.

**Dual learning value:**
- **Energy engineering** — wind physics, IEC standards, power system analysis, protection coordination, SCADA protocols, commissioning procedures
- **Software engineering** — full-stack development, CI/CD, Docker, async APIs, time-series databases, ML pipelines, infrastructure-as-code

**Industry timing matters.** Poland's Baltic Sea is entering a construction boom: Baltic Power (1.2 GW), Baltyk 2 & 3 (1.4 GW), and more projects in the pipeline. These projects need HV control engineers who understand both the electrical systems and the software that operates them. This platform builds exactly that skillset.

**Quality bar:** Every line of code is written to be explainable to a junior engineer while maintaining production-grade standards. No hand-waving. No magic numbers. Every calculation grounded in physics and traceable to an IEC/IEEE/ENTSO-E standard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    510 MW Baltic Wind Farm                          │
│                                                                     │
│  P1: Wind Resource    P2: Grid Integration    P3: SCADA & IEC 61850│
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │ PyWake       │───▶│ Pandapower       │───▶│ IEC 61850 Data   │  │
│  │ ERA5 weather │    │ ANDES dynamics   │    │ Models + GOOSE   │  │
│  │ Weibull, AEP │    │ IEC 60909, FRT   │    │ Permit-to-Work   │  │
│  └──────┬───────┘    └────────┬─────────┘    └────────┬─────────┘  │
│         │                     │                        │            │
│         ▼                     ▼                        ▼            │
│  P4: AI Forecasting          P5: Commissioning Simulation          │
│  ┌──────────────────┐        ┌──────────────────────────┐          │
│  │ XGBoost + LSTM   │        │ 30-step switching prog.  │          │
│  │ TFT + SHAP       │◀───────│ LOTO + SAT procedures    │          │
│  └──────────────────┘        └──────────────────────────┘          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  React 19 + TS ──▶ FastAPI + Python 3.13 ──▶ PostgreSQL 16 │   │
│  │  Tailwind v4        Pydantic v2               + TimescaleDB │   │
│  │  Plotly.js          SQLAlchemy async           + Redis 7    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

Each project feeds data downstream: P1's AEP calculations determine P2's power flow scenarios, P2's grid topology defines P3's SCADA data model, P3's telemetry feeds P4's forecasting models, and P2's protection settings appear in P5's switching programmes. This mirrors how real wind farms operate as interconnected systems.

---

## Five Interconnected Projects

| # | Project | Domain | Core Technology | Key Standards |
|---|---------|--------|-----------------|---------------|
| **P1** | Wind Resource & AEP | Wake modeling, energy yield | PyWake, ERA5, Weibull | IEC 61400-12 |
| **P2** | HV Grid Integration | Power flow, short-circuit, FRT | Pandapower, ANDES | IEC 60909, ENTSO-E NC RfG |
| **P3** | SCADA & Automation | Substation automation | IEC 61850 data models | IEC 61850, IEC 62443 |
| **P4** | AI Forecasting | Wind power prediction | XGBoost, LSTM, TFT | IEA Wind Task 36 |
| **P5** | Commissioning | Switching & SAT | Switching programmes | IEC 62271, LOTO |

---

## Learning Resources

### AI-Powered Lesson Generation

This project includes a **teach-me** Claude Code skill that transforms git history into comprehensive teaching lessons. Each lesson follows a 4-layer structure (physics → standard → mathematics → code), uses 10 learning science techniques, and is validated against 12 quality rules.

```bash
# Generate a lesson in English (default)
# Type "teach me" in Claude Code

# Generate in another language
# Type "teach me turkish" or "teach me polish"
```

The skill automatically detects new commits since the last lesson, analyzes every diff, groups changes into logical sections, and generates a lesson with analogies, code walkthroughs, key concepts, quizzes, and interview preparation — minimum 1,500 words per lesson.

### Teaching Lessons

| Lesson | Topic | Focus |
|--------|-------|-------|
| [Lesson 000](docs/lessons/lesson-000.md) | Project Planning & Technology Decisions | The **why** — engineering philosophy, technology justification, teaching methodology |
| [Lesson 001](docs/lessons/lesson-001.md) | Phase 0 Infrastructure | The **what** — Docker, CI/CD, pre-commit, Dependabot, security skills |
| [Lesson 002](docs/lessons/lesson-002.md) | Skill Architecture & Multi-Language | The **how** — extending automated systems, translation boundaries, quality rules |

### Documentation Ecosystem

| Resource | Description |
|----------|-------------|
| [Project Roadmap](docs/Project_Roadmap.md) | 1,646-line consolidated technical specification — the design basis |
| [Learning Roadmap](docs/Learning_Roadmap.md) | 32-week self-study curriculum with trusted academic sources (DTU, MIT OCW, IEEE) |
| [Engineering Standards](docs/SKILL.md) | Coding conventions, 10 non-negotiable domain rules, API patterns |
| [MkDocs Site](https://polat-mustafa.github.io/baltic-wind-control-system/) | Auto-deployed documentation site |

---

## Tech Stack

```
Frontend:   React 19 + TypeScript (strict) + Tailwind CSS v4 + Plotly.js + Zustand
Backend:    FastAPI + Python 3.13 + Pydantic v2 + SQLAlchemy async
Database:   PostgreSQL 16 + TimescaleDB
Cache:      Redis 7
Compute:    PyWake, Pandapower, ANDES, XGBoost, LSTM, TFT
Container:  Docker Compose
CI/CD:      GitHub Actions + MkDocs (GitHub Pages) + Dependabot
Linting:    ruff (lint + format) + mypy + ESLint + pre-commit
Testing:    pytest + Vitest + Playwright
```

---

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js 22+
- Docker & Docker Compose

### Quick Start

```bash
# Clone the repository
git clone https://github.com/polat-mustafa/baltic-wind-control-system.git
cd baltic-wind-control-system

# Install all dependencies (backend + frontend)
make install

# Install pre-commit hooks
make install-hooks

# Start infrastructure (PostgreSQL, Redis, Backend, Frontend)
make docker-up

# Verify everything is running
make lint
make test

# Serve documentation locally
make docs-serve
```

---

## Standards & Compliance

This platform is designed against real offshore wind standards:

| Standard | Domain | Application in Project |
|----------|--------|----------------------|
| IEC 61850 | Substation automation | P3: GOOSE messaging, SCL data models |
| IEC 60909 | Short-circuit calculation | P2: Fault current analysis, protection coordination |
| IEC 62443 | Industrial cybersecurity | P3: SCADA network segmentation, access control |
| IEC 62271 | HV switchgear | P5: Switching programme procedures |
| ENTSO-E NC RfG | Grid connection (Type D) | P2: FRT profiles, reactive power capability |
| PSE IRiESP | Polish transmission rules | P2: Grid code compliance for 400 kV connection |
| IEC 61400 | Wind energy systems | P1: Power performance, wake modeling |
| IEA Wind Task 36 | Wind power forecasting | P4: Forecast evaluation metrics |

---

## Industry Context

This platform models a wind farm based on real Polish Baltic Sea projects:

- **Baltic Power** (1.2 GW) — PGE Baltica / Ørsted, under construction
- **Baltyk 2 & 3** (1.4 GW) — Equinor / Polenergia, in development
- **Educational scaling** — our 510 MW (34 × 15 MW) sits at realistic project scale

The parameters are real: 66 kV XLPE array cables, 220 kV HVAC export (45 km subsea), ±120 MVAR STATCOM with 50 MVAR shunt reactor, PSE grid connection at 400 kV. Every number is traceable to published project data or IEC standards.

---

## Status

> **Phase 0 complete** — Project foundation (CI/CD, Docker, linting, documentation, security scanning, automated lessons) is in place.
>
> **Next:** P1 — Wind Resource & AEP Assessment (PyWake, ERA5, Weibull distributions, P50/P75/P90 confidence levels, LCOE calculation).

---

## Contributing

Contributions follow the project's engineering standards:

- **Coding conventions** — see [SKILL.md](docs/SKILL.md) for Python/TypeScript rules, API patterns, and the 10 non-negotiable domain rules
- **Commit format** — scoped, imperative: `[SCOPE] Short description` (e.g., `[P1] Add wake model endpoint`)
- **Project order** — P1 → P2 → P3 → P4 → P5 (physics before code, always)
- **Testing** — all domain code requires unit tests with physics-based assertions (e.g., power output within [0, P_rated])
- **Security** — the github-push skill scans every commit for secrets before push; never bypass it

---

## License

[MIT](LICENSE) — Built as an educational platform to demonstrate the full scope of competence expected from HV Control Engineers in the offshore wind industry.

<div align="center">

```
        ╱│╲           ╱│╲           ╱│╲
       ╱ │ ╲         ╱ │ ╲         ╱ │ ╲
      ╱  │  ╲       ╱  │  ╲       ╱  │  ╲
     ╱   │   ╲     ╱   │   ╲     ╱   │   ╲
         │             │             │
         │             │             │
    ─────┴─────   ─────┴─────   ─────┴─────
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ≈ ≈ ≈    B A L T I C    S E A    ≈ ≈ ≈
```

# Baltic Wind HV Control Platform

**510 MW offshore wind farm simulation — from wake physics to grid commissioning**

[![CI](https://github.com/polat-mustafa/baltic-wind-control-system/actions/workflows/ci.yml/badge.svg)](https://github.com/polat-mustafa/baltic-wind-control-system/actions/workflows/ci.yml)
[![Docs](https://github.com/polat-mustafa/baltic-wind-control-system/actions/workflows/docs.yml/badge.svg)](https://polat-mustafa.github.io/baltic-wind-control-system/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Endpoints](https://img.shields.io/badge/API_Endpoints-200+-orange?style=flat-square)]()
[![Tests](https://img.shields.io/badge/Tests-132_files-brightgreen?style=flat-square)]()

![Python](https://img.shields.io/badge/Python-3.13+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

</div>

---

A production-grade educational simulation of a **510 MW Baltic Sea offshore wind farm** — 34 Vestas V236-15.0 MW turbines connected through 66 kV array cables, a 220 kV export system (45 km subsea), and a 400 kV connection to the Polish PSE transmission grid. Five interconnected projects cover the full lifecycle from wind resource assessment to HV commissioning, plus 15 improvement modules adding BESS, cybersecurity, market integration, and more.

Every calculation is grounded in physics and traceable to IEC, IEEE, or ENTSO-E standards. Built to teach both energy engineering and full-stack software engineering simultaneously.

---

## Table of Contents

- [Why This Project Exists](#why-this-project-exists)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [API Overview](#api-overview)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Standards & Compliance](#standards--compliance)
- [Industry Context](#industry-context)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Why This Project Exists

This platform is a **flight simulator for offshore wind HV control engineers**. Just as pilots train on simulators before entering a cockpit, this project lets you practice every aspect of wind farm engineering — resource assessment, grid integration, SCADA automation, AI forecasting, and commissioning — in a safe, instrumented environment where mistakes are learning opportunities.

**Dual learning value:**
- **Energy engineering** — wind physics, IEC standards, power system analysis, protection coordination, SCADA protocols, battery storage, market economics, commissioning procedures
- **Software engineering** — full-stack development, CI/CD, Docker, async APIs, time-series databases, ML pipelines, real-time visualization

**Industry timing matters.** Poland's Baltic Sea is entering a construction boom: Baltic Power (1.2 GW), Baltyk 2 & 3 (1.4 GW), and more projects in the pipeline. These projects need HV control engineers who understand both the electrical systems and the software that operates them. This platform builds exactly that skillset.

**Quality bar:** Every line of code is written to be explainable to a junior engineer while maintaining production-grade standards. No hand-waving. No magic numbers. Every calculation grounded in physics and traceable to an IEC/IEEE/ENTSO-E standard.

---

## Key Features

### P1 — Wind Resource & AEP Assessment
- Wake modeling with PyWake (Jensen, Bastankhah-Gu, TurbOPark)
- ERA5 reanalysis data integration and Weibull distribution fitting
- Farm layout comparison and optimization algorithms
- P50/P75/P90 confidence levels with Monte Carlo uncertainty
- AEP cascade: gross energy → net energy yield → LCOE
- IEC 61400-26 availability tracking (TBA, EBA, PBA)
- Weather window modeling for O&M vessel access (CTV, SOV, jack-up)

### P2 — HV Grid Integration & Power Analysis
- Full AC power flow with Pandapower (66 kV / 220 kV / 400 kV)
- Short-circuit analysis per IEC 60909
- Fault Ride-Through simulation per ENTSO-E NC RfG Type D
- Power Plant Controller with active/reactive power dispatch
- STATCOM (±120 MVAR) + 50 MVAR shunt reactor coordination
- 50 MW / 200 MWh BESS with FCR, FFR, and ramp smoothing
- Cable DTS thermal monitoring with IEC 60287 dynamic rating
- Protection relay coordination with time-current curves
- Power quality analysis: harmonics (IEC 61000), flicker, resonance
- Energy market simulation: TGE day-ahead bidding, imbalance settlement, CfD

### P3 — SCADA & Substation Automation
- IEC 61850 data modeling with GOOSE messaging simulation
- Bay controller with 7-rule interlock engine
- Sequence of Events recorder (1 ms resolution, TimescaleDB)
- OPC-UA server simulation with 185-node namespace
- Condition monitoring (vibration, temperature, oil analysis)
- IEC 62443 cybersecurity zones, conduits, and attack simulation
- Alarm rationalization and management
- Permit-to-work state machine with RBAC (5 security levels)
- Communication network architecture (IEC 61850 performance classes)

### P4 — AI Power Forecasting
- XGBoost, LSTM, and Temporal Fusion Transformer models
- Ensemble methods with automated model comparison
- SHAP explainability for every prediction
- SCADA-to-forecast data pipeline
- Revenue impact analysis (EUR per 1% MAPE improvement)

### P5 — Commissioning Simulation
- 30-step switching programme execution with interlock validation
- Lock-Out / Tag-Out (LOTO) procedures
- Factory and Site Acceptance Testing (FAT/SAT) tracking
- Emergency response simulation with anomaly injection
- Equipment state machine management
- Grid code compliance verification

### Cross-Cutting
- **Digital Twin** dashboard with real-time turbine state visualization
- **Turbine Physics** explorer — Cp-TSR surfaces, pitch control, power curves
- **Interactive Landing Map** — Leaflet with wake cones, cable routes, and drill-down navigation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       510 MW Baltic Wind Farm                          │
│                                                                        │
│  P1: Wind Resource    P2: Grid Integration     P3: SCADA & IEC 61850  │
│  ┌──────────────┐    ┌───────────────────┐    ┌───────────────────┐   │
│  │ PyWake       │───▶│ Pandapower        │───▶│ IEC 61850 Models  │   │
│  │ ERA5 weather │    │ ANDES dynamics    │    │ GOOSE + OPC-UA    │   │
│  │ Weibull, AEP │    │ IEC 60909, FRT   │    │ Bay Controller    │   │
│  │ Availability │    │ PPC + BESS + DTS  │    │ Cybersecurity     │   │
│  └──────┬───────┘    └────────┬──────────┘    └────────┬──────────┘   │
│         │                     │                         │              │
│         ▼                     ▼                         ▼              │
│  P4: AI Forecasting           P5: Commissioning Simulation            │
│  ┌──────────────────┐         ┌──────────────────────────┐            │
│  │ XGBoost + LSTM   │         │ 30-step switching prog.  │            │
│  │ TFT + SHAP       │◀────── │ LOTO + FAT/SAT           │            │
│  │ Ensemble + MAPE  │         │ Emergency response       │            │
│  └──────────────────┘         └──────────────────────────┘            │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                        Infrastructure                            │ │
│  │  React 19 + TS ──▶ FastAPI + Python 3.13 ──▶ PostgreSQL 16     │ │
│  │  Tailwind v4        Pydantic v2               + TimescaleDB     │ │
│  │  Plotly + XYFlow    SQLAlchemy async           + Redis 7        │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

Each project feeds data downstream: P1's AEP calculations determine P2's power flow scenarios, P2's grid topology defines P3's SCADA data model, P3's telemetry feeds P4's forecasting models, and P2's protection settings appear in P5's switching programmes. This mirrors how real wind farms operate as interconnected systems.

---

## Tech Stack

### Backend

![Python](https://img.shields.io/badge/Python-3.13+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Pydantic](https://img.shields.io/badge/Pydantic-v2-E92063?style=for-the-badge&logo=pydantic&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0_async-D71F00?style=for-the-badge)

### Simulation & Machine Learning

![PyTorch](https://img.shields.io/badge/PyTorch-2.2-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![XGBoost](https://img.shields.io/badge/XGBoost-2.0-189FDD?style=for-the-badge)
![NumPy](https://img.shields.io/badge/NumPy-2.0+-013243?style=for-the-badge&logo=numpy&logoColor=white)
![SciPy](https://img.shields.io/badge/SciPy-1.14+-8CAAE6?style=for-the-badge&logo=scipy&logoColor=white)
![PyWake](https://img.shields.io/badge/PyWake-2.5-2E8B57?style=for-the-badge)
![Pandapower](https://img.shields.io/badge/Pandapower-2.14-1E90FF?style=for-the-badge)
![ANDES](https://img.shields.io/badge/ANDES-1.10-FF6347?style=for-the-badge)
![SHAP](https://img.shields.io/badge/SHAP-0.46-9B59B6?style=for-the-badge)

### Frontend

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Plotly](https://img.shields.io/badge/Plotly.js-3.4-3F4F75?style=for-the-badge&logo=plotly&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=for-the-badge&logo=leaflet&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-5.0-433E38?style=for-the-badge)
![XYFlow](https://img.shields.io/badge/XYFlow-12.10-FF0072?style=for-the-badge)

### Infrastructure

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![TimescaleDB](https://img.shields.io/badge/TimescaleDB-latest-FDB515?style=for-the-badge&logo=timescale&logoColor=black)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-CI/CD-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)

### Code Quality

![Ruff](https://img.shields.io/badge/Ruff-linter-D7FF64?style=for-the-badge&logo=ruff&logoColor=black)
![mypy](https://img.shields.io/badge/mypy-strict-2A6DB2?style=for-the-badge)
![ESLint](https://img.shields.io/badge/ESLint-10.1-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)
![pytest](https://img.shields.io/badge/pytest-8.3+-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-4.1-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)

---

## Quick Start

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- (Optional) Python 3.13+ and Node.js 22+ for local development

### One-Command Launch

```bash
git clone https://github.com/polat-mustafa/baltic-wind-control-system.git
cd baltic-wind-control-system
docker compose up -d --build
```

Once the containers are healthy, you'll have:

| Service | URL |
|---------|-----|
| Frontend | [http://localhost:3000](http://localhost:3000) |
| Backend API | [http://localhost:8000](http://localhost:8000) |
| Swagger Docs | [http://localhost:8000/docs](http://localhost:8000/docs) |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

---

## Development Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

### Useful Makefile Targets

```bash
make install          # Install all dependencies (backend + frontend)
make install-hooks    # Install pre-commit hooks (ruff, mypy, eslint)
make lint             # Run all linters (ruff + mypy + tsc + eslint)
make format           # Auto-format all code
make test             # Run all tests (pytest + vitest)
make docker-up        # Start full stack with Docker Compose
make docker-down      # Stop all services
make docs-serve       # Serve MkDocs locally at localhost:8080
```

---

## API Overview

**200+ endpoints** across 36 router modules, organized by project domain.

| Prefix | Project | What It Covers |
|--------|---------|----------------|
| `/api/v1/wind/*` | P1 — Wind Resource | Wake models, AEP, Weibull, layout optimization, availability, weather windows |
| `/api/v1/grid/*` | P2 — HV Grid | Power flow, short-circuit, FRT, PPC, BESS, cable DTS, protection, market |
| `/api/v1/scada/*` | P3 — SCADA | IEC 61850, GOOSE, bays, alarms, permits, SOE, OPC-UA, security, CMS |
| `/api/v1/forecast/*` | P4 — Forecasting | XGBoost, LSTM, TFT, ensemble, SHAP, SCADA pipeline |
| `/api/v1/commissioning/*` | P5 — Commissioning | Switching, LOTO, FAT/SAT, emergency response, grid code tests |
| `/api/v1/physics/*` | Cross-cutting | Turbine physics, digital twin |

```bash
# Example: Run a power flow analysis
curl http://localhost:8000/api/v1/grid/load-flow

# Example: Get wind farm AEP summary
curl http://localhost:8000/api/v1/wind/aep
```

Full interactive documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs) when the backend is running.

---

## Testing

**132 test files** — 60 backend (pytest) + 72 frontend (Vitest)

```bash
# Run everything
make test

# Backend only (with coverage report)
make test-backend

# Frontend only (with coverage report)
make test-frontend
```

Backend tests use **pytest** with physics-based assertions — power output clamped to `[0, P_rated]`, impedances checked against IEC reference values, interlock logic validated against real switchgear rules.

Frontend tests use **Vitest** + **Testing Library** for component rendering, Zustand store behavior, and API service mocking.

End-to-end tests use **Playwright** for full browser automation.

---

## Project Structure

```
baltic-wind-control-system/
├── backend/
│   ├── app/
│   │   ├── core/               # Middleware, caching, exceptions, RBAC
│   │   ├── models/             # SQLAlchemy ORM (12 domain models)
│   │   ├── routers/            # 36 router files, 200+ endpoints
│   │   │   ├── p1*.py          # Wind resource routes
│   │   │   ├── p2*.py          # Grid integration routes
│   │   │   ├── p3/             # SCADA routes (14 sub-modules)
│   │   │   ├── p4/             # Forecasting routes (6 sub-modules)
│   │   │   └── p5/             # Commissioning routes (5 sub-modules)
│   │   ├── schemas/            # Pydantic request/response models
│   │   └── services/           # Business logic (p1/ p2/ p3/ p4/ p5/)
│   ├── tests/                  # 60 pytest files
│   ├── alembic/                # Database migrations
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/         # React components by project
│   │   │   ├── landing/        # Interactive wind farm map
│   │   │   ├── p1/ – p5/      # Dashboard components per project
│   │   │   ├── digital-twin/
│   │   │   └── turbine-physics/
│   │   ├── pages/              # Route page components
│   │   ├── services/           # API client layer
│   │   ├── store/              # Zustand state management
│   │   └── types/              # TypeScript type definitions
│   ├── tests/                  # 72 Vitest files
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docs/                       # MkDocs source, lessons, roadmaps
├── docker-compose.yml          # Full stack: PG + Redis + API + UI
├── Makefile                    # Universal task runner
├── mkdocs.yml                  # Documentation site config
├── .github/workflows/          # CI (lint + test) + Docs (GitHub Pages)
└── .pre-commit-config.yaml     # Git hooks (ruff, mypy, eslint)
```

---

## Standards & Compliance

This platform is designed against real offshore wind standards — the same ones used on projects like Baltic Power and Baltyk 2 & 3:

| Standard | Domain | Application in Project |
|----------|--------|----------------------|
| **IEC 61850** | Substation automation | P3: GOOSE messaging, SCL data models, bay controllers |
| **IEC 60909** | Short-circuit calculation | P2: Fault current analysis, protection coordination |
| **IEC 62443** | Industrial cybersecurity | P3: Purdue Model zones, conduits, attack simulation |
| **IEC 62271** | HV switchgear | P5: Switching programme procedures, interlocks |
| **IEC 61000** | Power quality | P2: Harmonics, flicker, resonance analysis |
| **IEC 61400** | Wind energy systems | P1: Power performance, wake modeling, availability |
| **ENTSO-E NC RfG** | Grid connection (Type D) | P2: FRT profiles, reactive power, frequency response |
| **PSE IRiESP** | Polish transmission rules | P2: Grid code compliance, ramp rate limits |
| **IEA Wind Task 36** | Forecasting best practice | P4: Forecast evaluation metrics |

---

## Industry Context

This platform models a wind farm based on real Polish Baltic Sea projects:

- **Baltic Power** (1.2 GW) — PGE Baltica / Orsted, under construction
- **Baltyk 2 & 3** (1.4 GW) — Equinor / Polenergia, in development
- **Educational scaling** — our 510 MW (34 x 15 MW) sits at a realistic project scale

The parameters are real: 66 kV XLPE array cables, 220 kV HVAC export (45 km subsea + 5 km onshore), ±120 MVAR STATCOM with 50 MVAR shunt reactor, 50 MW/200 MWh BESS, PSE grid connection at 400 kV. Every number is traceable to published project data or IEC standards.

---

## Documentation

| Resource | Description |
|----------|-------------|
| [Project Roadmap](docs/Project_Roadmap.md) | 1,646-line consolidated technical specification — the design basis |
| [Learning Roadmap](docs/Learning_Roadmap.md) | 32-week self-study curriculum with academic sources (DTU, MIT OCW, IEEE) |
| [Engineering Standards](docs/SKILL.md) | Coding conventions, 10 non-negotiable domain rules, API patterns |
| [MkDocs Site](https://polat-mustafa.github.io/baltic-wind-control-system/) | Auto-deployed documentation site (GitHub Pages) |

---

## Contributing

Contributions follow the project's engineering standards:

- **Coding conventions** — see [SKILL.md](docs/SKILL.md) for Python/TypeScript rules, API patterns, and the 10 non-negotiable domain rules
- **Commit format** — scoped, imperative: `[SCOPE] Short description` (e.g., `[P2] Add BESS frequency response endpoint`)
- **Testing** — all domain code requires unit tests with physics-based assertions (e.g., power output within `[0, P_rated]`)
- **Type safety** — strict mypy for Python, strict TypeScript with no `any` types
- **Pre-commit hooks** — ruff + mypy + eslint run automatically on every commit

---

## License

[MIT](LICENSE) — Built as an educational platform to demonstrate the full scope of competence expected from HV Control Engineers in the offshore wind industry.

<div align="center">

---

**34 turbines. 510 MW. One platform to learn it all.**

*Made with wind, code, and a lot of IEC standards.*

</div>

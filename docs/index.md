# Baltic Wind HV Control Platform

A production-grade educational simulation platform for a **510 MW Baltic Sea offshore wind farm** — covering the complete engineering lifecycle from wind resource assessment through HV commissioning.

**34 x Vestas V236-15.0 MW** | 66 kV array | 220 kV export (45 km) | 400 kV PSE grid connection

## Five Interconnected Projects

| # | Project | Key Technologies |
|---|---------|-----------------|
| **P1** | Wind Resource & AEP Assessment | PyWake, ERA5, Weibull, P50/P75/P90, LCOE |
| **P2** | HV Grid Integration & Power System Analysis | Pandapower, ANDES, IEC 60909, FRT, STATCOM |
| **P3** | SCADA & IEC 61850 Substation Automation | IEC 61850, GOOSE, Permit-to-Work, IEC 62443 |
| **P4** | AI-Powered Wind Power Forecasting | XGBoost, LSTM, Temporal Fusion Transformer, SHAP |
| **P5** | HV Commissioning & Switching Programme | 30-step switching programme, LOTO, SAT |

## Tech Stack

```
Frontend:   React 19 + TypeScript (strict) + Tailwind CSS + Plotly.js
Backend:    FastAPI + Python 3.13 + Pydantic v2 + SQLAlchemy async
Database:   PostgreSQL 16 + TimescaleDB
Cache:      Redis 7
Compute:    PyWake, Pandapower, ANDES, XGBoost, LSTM, TFT
Container:  Docker Compose
Testing:    pytest + Vitest + Playwright
CI/CD:      GitHub Actions + MkDocs + Dependabot
```

## Quick Start

```bash
# Install all dependencies
make install

# Start infrastructure (PostgreSQL + Redis + Backend + Frontend)
make docker-up

# Run linters
make lint

# Run tests
make test

# Serve docs locally
make docs-serve
```

## Reference Case

Based on real Polish Baltic Sea offshore wind projects (Baltic Power 1.2 GW, Baltyk 2&3 1.4 GW) with parameters scaled to educational scope (510 MW). Compliant with PSE IRiESP and ENTSO-E NC RfG Type D requirements.

## Purpose

This platform is an **educational tool** designed to demonstrate the full scope of competence expected from HV Control Engineers in the offshore wind industry. Every line of code is written to be explainable to a junior engineer while maintaining production-grade quality.

## Lessons

Step-by-step learning log documenting every engineering decision — from project planning through DevOps foundation to internationalization.

[Browse all lessons →](lessons/index.md)

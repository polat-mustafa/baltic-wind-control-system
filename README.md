# Offshore Wind HV Control Simulation Platform

A production-grade educational simulation platform for a **510 MW Baltic Sea offshore wind farm** — covering the complete engineering lifecycle from wind resource assessment through HV commissioning.

**34 × Vestas V236-15.0 MW** | 66 kV array | 220 kV export (45 km) | 400 kV PSE grid connection

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
Frontend:   React 19 + TypeScript (strict) + Tailwind CSS v4 + Plotly.js
Backend:    FastAPI + Python 3.13 + Pydantic v2 + SQLAlchemy async
Database:   PostgreSQL 16 + TimescaleDB
Cache:      Redis 7
Compute:    PyWake, Pandapower, ANDES, XGBoost, LSTM, TFT
Container:  Docker Compose
CI/CD:      GitHub Actions + MkDocs + Dependabot
Linting:    ruff + mypy + ESLint + pre-commit
Testing:    pytest + Vitest + Playwright
```

## Getting Started

```bash
# Prerequisites: Python 3.13+, Node 22+, Docker

# Install all dependencies
make install

# Install pre-commit hooks
make install-hooks

# Start infrastructure (PostgreSQL, Redis, Backend, Frontend)
make docker-up

# Run all linters
make lint

# Run all tests
make test

# Serve documentation locally
make docs-serve
```

## Status

> **Phase 0 complete** — Project foundation (CI, Docker, linting, docs) is in place. Application code development follows the project sequence P1 → P2 → P3 → P4 → P5.

## Reference Case

Based on real Polish Baltic Sea offshore wind projects (Baltic Power 1.2 GW, Baltyk 2&3 1.4 GW) with parameters scaled to educational scope (510 MW). Compliant with PSE IRiESP and ENTSO-E NC RfG Type D requirements.

## Purpose

This platform is an **educational tool** designed to demonstrate the full scope of competence expected from HV Control Engineers in the offshore wind industry. Every line of code is written to be explainable to a junior engineer while maintaining production-grade quality.

## License

[MIT](LICENSE)

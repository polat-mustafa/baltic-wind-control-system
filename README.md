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
Frontend:   React 18 + TypeScript (strict) + Tailwind CSS + Plotly.js
Backend:    FastAPI + Python 3.11 + Pydantic v2 + SQLAlchemy async
Database:   PostgreSQL 16 + TimescaleDB
Cache:      Redis 7
Compute:    PyWake, Pandapower, ANDES, XGBoost, LSTM, TFT
Container:  Docker Compose
Testing:    pytest + Vitest + Playwright
```

## Status

> **Work in Progress** — Currently in documentation and planning phase. Application code development follows the project sequence P1 → P2 → P3 → P4 → P5.

## Reference Case

Based on real Polish Baltic Sea offshore wind projects (Baltic Power 1.2 GW, Baltyk 2&3 1.4 GW) with parameters scaled to educational scope (510 MW). Compliant with PSE IRiESP and ENTSO-E NC RfG Type D requirements.

## Purpose

This platform is an **educational tool** designed to demonstrate the full scope of competence expected from HV Control Engineers in the offshore wind industry. Every line of code is written to be explainable to a junior engineer while maintaining production-grade quality.

## License

[MIT](LICENSE)

# User Guide

**OffshoreForge**: a simulation of a 510 MW Baltic Sea offshore wind farm
(34 × Vestas V236-15.0 MW, 66 kV array, 108 km 220 kV export cable, PSE 400 kV grid).

## 1. Requirements

| Method | Tools |
|---|---|
| Docker (recommended) | Git, Docker Desktop (Compose v2) |
| Manual development | Git, Python 3.13, Node.js 22, Docker (only for PostgreSQL + Redis) |

## 2. Run with Docker

```bash
git clone https://github.com/polat-mustafa/baltic-wind-control-system.git
cd baltic-wind-control-system
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up -d --build
```

The first build can take 5–15 minutes. Stop with `docker compose down`
(adding `-v` also deletes the database).

| Address | Content |
|---|---|
| http://localhost:3000 | Web interface |
| http://localhost:8000/docs | API documentation (Swagger) |
| http://localhost:8000/health | Service status |

## 3. Manual development

```bash
docker compose up -d postgres redis                       # database + cache
cd backend && pip install -e ".[dev]" && alembic upgrade head
uvicorn app.main:app --reload --port 8000                 # API → :8000
cd ../frontend && npm ci && npm run dev                   # UI → :5173
```

## 4. Interface

| Page | What it shows |
|---|---|
| Overview | Farm map, live KPIs, turbine detail and 3D view |
| P1 · Wind Resource | Weibull, wind rose, wake losses, AEP (P50/P90), LCOE |
| P2 · HV Grid | Load flow, short circuit (IEC 60909), FRT, reactive power / STATCOM |
| P3 · SCADA | Single-line diagram, IEC 61850 / GOOSE simulation, alarms, permits to work |
| P4 · Forecasting | XGBoost / LSTM / TFT power forecasts with uncertainty bands |
| P5 · Commissioning | Switching programme, LOTO, SAT tests |
| Digital Twin | Condition monitoring, fault diagnosis and remaining-life estimate |

The info button next to a chart explains the method and the relevant standard.

## 5. Common commands

| Command | Purpose |
|---|---|
| `make test` | Backend + frontend tests |
| `make lint` | Lint and type checks |
| `make format` | Format the code |
| `make docker-logs` | Follow service logs |

## 6. Troubleshooting

- **Port in use:** close whatever is using port 3000, 8000, 5432 or 6379.
- **Backend does not start:** check `docker compose logs backend`; usually the database is not ready yet, so retry after a few seconds.
- **UI shows no data:** check that the API answers at `http://localhost:8000/health`.

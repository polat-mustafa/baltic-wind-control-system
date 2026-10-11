# OffshoreForge

**Learn offshore wind engineering by running a wind farm — from wind resource to grid connection, SCADA and condition monitoring.**

[![CI](https://github.com/polat-mustafa/offshoreforge/actions/workflows/ci.yml/badge.svg)](https://github.com/polat-mustafa/offshoreforge/actions/workflows/ci.yml)
[![Docs](https://github.com/polat-mustafa/offshoreforge/actions/workflows/docs.yml/badge.svg)](https://polat-mustafa.github.io/offshoreforge/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

OffshoreForge is an open training platform for offshore wind engineers. Every screen is a working
engineering model, not a mock-up: wake losses come from PyWake, short-circuit currents from
pandapower (IEC 60909), and the digital twin detects and diagnoses faults injected with known ground truth.
Each method is traced to its standard or primary source in [docs/references.md](docs/references.md),
and the in-app **Evidence** page lists what each model is validated against (measured wakes,
hand calculations, a real farm's metered output over 28 months, real forecasts, the IEA 15 MW
reference tables), generated from the tests themselves.

## Case study: Southern Baltic (SB-510)

The platform ships with one reference project, modelled on the current Polish Baltic build-out.

| | |
|---|---|
| Site | Polish EEZ, MSP energy basin PZP_44 (≈ 55.06° N, 16.54° E; real site 44.E.1, permit PGE / Baltica 9 — used fictionally), 37–51 m, jackets |
| Turbines | 34 × 15 MW "V236 class" = **510 MW**, modelled with the open IEA 15 MW reference turbine (IEA-15-240-RWT, direct drive, ROSCO controller) because Vestas publishes no V236 model data |
| Array | 66 kV XLPE, 6 strings (6-6-6-6-5-5) |
| Export | 2 × 220 kV HVAC, 108 km (79.3 subsea round Ławica Słupska, clear of the military area + 28.7 onshore) to PSE Krzemienica |
| Reactive power | ±120 Mvar STATCOM, 4 × 180 Mvar shunt reactors (one per export circuit at each end), 2 Mvar harmonic filter (h 10.34) |
| Storage | 50 MW / 200 MWh BESS |
| Grid | PSE 400 kV, ENTSO-E NC RfG Type D |

The physics and the engineering are real; the farm itself is fictional.

## The lifecycle

The modules follow a wind farm through its life.

| Stage | Module | What you work with |
|---|---|---|
| **Develop** | Site & Permits | Open marine data (EMODnet, EEA Natura 2000, Marine Regions), official Polish location permits (SIPAM), the Polish transmission grid (KSE), ship traffic density, two wind atlases (NEWA, Global Wind Atlas v4), suitability screening, candidate-site report, survey and EIA stages, generic EU permit procedure |
| | Layout | Drag-and-drop turbines in the site, live wake loss, Esau–Williams array cables, PyWake AEP for the exact positions, CAPEX and LCOE |
| | Wind Resource | Weibull fits, wake models (PyWake) validated against measured Horns Rev 1 and Lillgrund rows, the AEP chain checked against Rødsand II's metered output (28 months), wake steering, derating and PCE/Sobol uncertainty studies, AEP and loss chain for SB-510 or your own layout and site wind, availability (IEC 61400-26), Copernicus Marine metocean and weather windows |
| | Project Report · My Projects | Printable report (PDF, JSON, windIO); open, compare and export your own projects |
| **Design** | Grid Integration | Load flow, IEC 60909 short circuit, fault ride-through, STATCOM sizing, power quality, cable thermal rating (IEC 60287), power plant controller, BESS, PSE live system data and a real market day — sized for SB-510 or your own farm |
| | Turbine Physics | Cp(λ, β) surface, ROSCO pitch and torque control, yaw, overspeed trip |
| **Build** | Construction | Installation campaign in Baltic weather windows (DNV-ST-N001 α factor): vessels, P10/P50/P90 timeline, waiting on weather, vessel cost |
| | Commissioning | Circuit 1 energisation (63 steps, topology interlocks, load-flow-verified readings, animated replay), isolation locks, FAT/SAT, EON → ION → FON |
| | Hand-over | Hand-over package checklist, punch-list grades, as-built register of your farm, energisation order per feeder bay, your layout on the control-room map |
| **Operate** | Control Room | Farm map, live KPIs, measured coastal wind (IMGW), turbine faults at published offshore failure rates, curtailment on the live PSE price, 7-day CTV/SOV access forecast, 3D turbine with drawing sheets |
| | SCADA | IEC 61850 data model and GOOSE, bay control, alarms, permit-to-work, instrument register, OPC UA, IEC 62443 zones |
| | Forecasting | Real data only (ENTSO-E / Energinet DK2): XGBoost, LSTM and TFT against the TSO's own forecast, CRPS and reliability, ensembles, SHAP, with an interactive ML academy |
| | Digital Twin | Physics-based condition monitoring (ISO 13374) on real CARE turbine data: detection, model-based diagnosis, RUL prognosis |
| **End of life** | Decommissioning | Removal options, removal campaign, material and recycling, end-of-life cost, seabed restoration (UNCLOS Art. 60, IMO A.672(16)) |
| **Learn** | Academy · Evidence | Courses along the lifecycle and scored missions (site, layout, energisation, FRT, twin diagnosis, control-room drills); the validation record of every model |

New here? On first launch the app offers a **guided tour**: spotlights and arrows walk you through
the control room, some steps ask you to try things yourself, and every module has its own short
tour in the header's **Tour** menu.

- **English / Turkish:** the header button switches the whole interface in place, without losing
  inputs or results.
- **AI tutor:** a panel on every page answers questions with the page as context and calls the
  platform's own calculators (plant facts, turbine operating point, export cable, IEC 60909).
  Bring your own key (OpenAI-compatible providers, or sign in with OpenRouter); the key stays in
  server memory and is never returned to the browser.

## Quick start

You need Docker with Compose. For development without Docker: Python 3.13 with
[uv](https://docs.astral.sh/uv/), and Node.js 22.

```bash
git clone https://github.com/polat-mustafa/offshoreforge.git
cd offshoreforge
docker compose up -d --build
```

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| API | http://localhost:8000 (Swagger at `/docs`, ReDoc at `/redoc`) |

Run without Docker:

```bash
# Backend
cd backend
uv sync --extra dev
uv run uvicorn app.main:app --reload

# Frontend (second terminal)
cd frontend
npm ci
npm run dev
```

## Architecture

```mermaid
graph LR
    UI["Frontend<br/>React 19 · TypeScript · Tailwind v4<br/>Zustand · Plotly · MapLibre · deck.gl · three.js"]
    API["Backend<br/>FastAPI · Python 3.13 · Pydantic v2<br/>~180 REST operations"]
    ENG["Engines<br/>PyWake · pandapower · ANDES<br/>scikit-learn · XGBoost · PyTorch"]
    DB[("PostgreSQL 16<br/>+ TimescaleDB")]
    RD[("Redis 7")]
    UI <--> API
    API --> ENG
    API --> DB
    API --> RD
```

| Path | Contents |
|---|---|
| `backend/app/routers/` | REST endpoints, one module per area |
| `backend/app/services/` | Computation engines and business logic |
| `backend/app/{models,schemas,core}/` | ORM models, Pydantic schemas, middleware, cache, RBAC |
| `frontend/src/pages/` | One page per module |
| `frontend/src/{components,store,services}/` | UI, Zustand stores, typed API clients |
| `docs/` | MkDocs site, user guides, methods and references |

API prefixes: `/api/v1/site`, `/wind`, `/grid`, `/scada`, `/forecast`, `/commissioning`,
`/lifecycle`, `/digital-twin`, `/turbine-physics`, `/turbine-sim`, `/projects`, `/tutor`, `/info`.

## Data

Bundled or fetched from open sources: ERA5, NEWA and Global Wind Atlas v4 (wind),
Copernicus Marine Baltic reanalyses (waves, seabed temperature, ice, currents), NOAA OISST,
EMODnet and SIPAM (sea use and permits), PyPSA-Eur / OpenStreetMap (grid), PSE open API and
IMGW (live system and coastal stations), ENTSO-E / Energinet (forecasting), CARE (condition
monitoring), Horns Rev 1 and Lillgrund (wake validation, via PyWake). Live sources need no key.

## Testing

```bash
make test        # backend (pytest) + frontend (Vitest)
make lint        # ruff + mypy + tsc + eslint
```

Backend tests assert physics rather than snapshots, for example:
- power stays in [0, P_rated] and is zero outside cut-in and cut-out;
- fault currents follow IEC 60909 with c_max = 1.10;
- interlocks obey switchgear rules;
- recorded validation values (Evidence page) and every SB-510 number quoted in the UI stay
  equal to what the engines compute.

Frontend end-to-end checks use Playwright (`cd frontend && npm run e2e`).

## Standards

| Standard | Used for |
|---|---|
| IEC 61400-1, -12-1, -25, -26 | Turbine design classes, power curves, monitoring data model, availability |
| IEC 60909 · IEC 60287 · IEC 61000 | Short circuit, cable rating, power quality |
| IEC 61850 · IEC 60870-5-104 · IEC 62443 | Substation automation, telecontrol, OT security |
| IEC 62271 | HV switchgear switching and interlocks |
| ENTSO-E NC RfG · PSE IRiESP | Grid connection requirements |
| ISO 13374 · ISO 13379-1 · ISO 13381-1 | Condition monitoring, diagnostics, prognostics |
| IEA Wind Task 36 | Forecast evaluation |

The full method-to-source map is in [docs/references.md](docs/references.md).

## Documentation

- [Documentation site](https://polat-mustafa.github.io/offshoreforge/)
- User guide: [EN](docs/en/user-guide.md) · [TR](docs/KULLANICI_KILAVUZU.md) · [PL](docs/pl/przewodnik-uzytkownika.md)
- [Engineering rules and code style](docs/SKILL.md)
- [Technical design basis](docs/Project_Roadmap.md)

## Contributing

- Follow the domain rules and code style in [docs/SKILL.md](docs/SKILL.md).
- New behaviour needs tests, with physics assertions where relevant.
- Run `make lint` and `make test` before opening a pull request.
- Commit messages use conventional-commit style, e.g. `feat(grid): add BESS frequency response`.

## License

[MIT](LICENSE). OffshoreForge is an educational project. It is not certified engineering
software and must not be used for real design or operational decisions.

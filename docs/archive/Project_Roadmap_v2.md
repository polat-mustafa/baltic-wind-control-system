# Offshore Wind HV Control Engineer — Enhanced Project Roadmap v2.0

## Gap Analysis & Professional Enhancement Document

**Author:** Engineering Review — February 2026
**Purpose:** Critical gap analysis of v1.0 and production-grade enhancement roadmap
**Status:** Review-ready for implementation via Claude Code

---

## PART I: CRITICAL GAP ANALYSIS OF v1.0

### Executive Summary of Findings

After comprehensive review against current industry practices (February 2026), real-world Baltic Sea project data (Baltic Power 1.2 GW, Bałtyk 2&3 1.4 GW), and professional engineering standards, the following critical gaps were identified across 8 categories. Each gap is rated by **Impact** (how much it affects project credibility) and **Effort** (implementation complexity).

---

### GAP 1: Turbine Specification Mismatch with Real Baltic Projects

| Aspect | v1.0 | Real-World (Feb 2026) | Impact |
|--------|------|----------------------|--------|
| Turbine model | Generic "14 MW class" | Vestas V236-15.0 MW (Baltic Power), SG 14-236 DD (Bałtyk 2&3) | HIGH |
| Rotor diameter | 222 m | 236 m (both real projects) | HIGH |
| Number of turbines | 36 × 14 MW = 504 MW | 76 × 15 MW = 1,140 MW (Baltic Power), 100 × 14 MW = 1,440 MW (Bałtyk 2&3) | MEDIUM |
| Hub height | 140 m | ~150 m for V236-15.0 class | MEDIUM |
| Cut-in/rated/cut-out | 3/12/30 m/s | 3/12.5/34 m/s (V236 spec) | LOW |

**Recommendation:** Update to 15 MW class turbines (V236-15.0 reference spec) with 236 m rotor. This aligns directly with both real Polish Baltic projects and demonstrates current market awareness. Optionally add a scalability analysis showing the system at both 500 MW (educational scale) and 1.2 GW (Baltic Power scale).

---

### GAP 2: Missing EMT/Dynamic Simulation Layer

**Critical gap.** The v1.0 uses only Pandapower for steady-state power system analysis. Professional offshore wind grid integration requires:

| Analysis Type | v1.0 Coverage | Industry Requirement | Gap Severity |
|--------------|--------------|---------------------|-------------|
| Load flow (steady-state) | ✅ Pandapower | Required | — |
| Short-circuit (IEC 60909) | ✅ Pandapower | Required | — |
| FRT dynamic simulation | ❌ Missing | **Critical** — requires EMT simulation | **CRITICAL** |
| Sub-synchronous oscillation (SSO) | ❌ Missing | Increasingly required by TSOs | HIGH |
| Grid-forming vs grid-following | ❌ Missing | Emerging industry requirement | HIGH |
| Harmonic impedance scan | ❌ Missing (only static THD check) | Required for cable resonance | HIGH |
| Transient overvoltage (TOV) | ❌ Missing | Required for insulation coordination | MEDIUM |

**Recommendation:** Add a dynamic simulation module using one or more of:

1. **Primary option (free, Python-native):** `ANDES` — open-source power system dynamics simulator (Python). Can model Type-4 WTG with converter control, STATCOM, and FRT response. Suitable for educational purposes.
2. **Secondary option (professional reference):** Document PSCAD/EMTDC or DIgSILENT PowerFactory workflows as "industry practice" sections, even if not directly executable in the open-source project. Show the model setup, expected inputs/outputs, and validation approach.
3. **Tertiary option:** `PyPSA` (Python for Power System Analysis) — supports dynamic time-series simulation with converter models.

**New sub-project: P2B — Dynamic Grid Compliance Simulation**

```
Scope:
- FRT simulation with voltage dip profile (PSE LVRT/HVRT curves)
- Active and reactive current injection during fault (ΔIq ≥ 2% × ΔV)
- Post-fault active power recovery (≥90% within 1 second)
- STATCOM dynamic response (<5 ms step change)
- Frequency response: synthetic inertia + FFR from WTG
- SSO screening via impedance-based stability analysis
```

---

### GAP 3: Incomplete Grid Code Implementation

**v1.0 references PSE IRiESP but does not implement the full NC RfG (EU Network Code for Requirements for Generators) compliance chain.** Since Poland adopted NC RfG (Commission Regulation 2016/631), offshore wind farms must comply with both PSE national requirements AND EU-harmonized requirements.

| Requirement | NC RfG Category | v1.0 Status | Gap |
|------------|----------------|-------------|-----|
| LFSM-O (over-frequency) | Type D | ❌ Missing | Must reduce power above 50.2 Hz |
| LFSM-U (under-frequency) | Type D | ❌ Missing | Must increase power below 49.8 Hz |
| FSM (frequency sensitive mode) | Type D | ❌ Missing | Droop-based frequency response |
| Active power controllability | Type D | ❌ Missing | TSO power setpoint following |
| Reactive power capability (P-Q diagram) | Type D | ❌ Missing | Full P-Q envelope required |
| FRT (LVRT + HVRT) | Type D | ⚠️ Partial (LVRT only) | HVRT profile missing |
| Power quality (harmonics, flicker) | Type D | ⚠️ Partial (harmonics only) | Flicker (Pst, Plt) missing |
| Robustness (rate of change of frequency) | Type D | ❌ Missing | RoCoF withstand capability |
| Protection & fault detection | Type D | ⚠️ Partial | Islanding detection missing |

**Recommendation:** Create a dedicated **Grid Code Compliance Matrix** as a checkable document within P2. Each NC RfG Type D requirement gets:
- Requirement description
- Compliance method (simulation/calculation/design choice)
- Evidence file (simulation output, calculation sheet)
- Pass/Fail status with quantitative result

This is exactly what real grid connection applications require. PSE uses a formal compliance verification process (EON → ION → FON stages) before granting operational notification.

---

### GAP 4: SCADA Architecture Missing Key Industrial Components

| Component | v1.0 Status | Industry Practice | Priority |
|-----------|-------------|------------------|----------|
| IEC 61850 SCL file (SCD/ICD/SSD) | ❌ Not created | **Core deliverable** — XML config files | CRITICAL |
| Sampled Values (SV/SMV, IEC 61850-9-2) | ❌ Missing | Process bus digitization of CT/VT | HIGH |
| PRP/HSR redundancy protocols | ❌ Missing | Zero-failover network redundancy | HIGH |
| IEC 61850 Ed. 2.1 enhancements | ❌ Missing | Enhanced GOOSE supervision, cybersecurity | HIGH |
| Time synchronization (IEEE 1588 PTP) | ❌ Missing | Critical for SV and event sequencing | HIGH |
| OPC-UA for vertical integration | ❌ Missing | Layer 3→4 data exchange standard | MEDIUM |
| Non-conventional instrument transformers (NCIT) | ❌ Missing | IEC 61869-9 digital output sensors | MEDIUM |
| Historian architecture (time-series DB) | ⚠️ Mentioned but not designed | InfluxDB/TimescaleDB for SCADA data | MEDIUM |

**Recommendation:** The SCADA project (P3) should produce actual SCL files:
1. **SSD (System Specification Description):** Define the substation single-line in XML
2. **ICD (IED Capability Description):** Per-IED logical node configuration
3. **SCD (Substation Configuration Description):** Complete system configuration

These are real engineering deliverables. Use the `libiec61850` open-source library (C) or `python-iec61850` for parsing/generation. Even creating simplified SCL files demonstrates deep understanding of the standard.

---

### GAP 5: AI/ML Forecasting Model Gaps

| Aspect | v1.0 | State-of-the-Art (2025) | Gap |
|--------|------|------------------------|-----|
| NWP integration | ❌ Missing | ECMWF HRES/ENS, GFS ensemble | HIGH — NWP is primary input for >6h forecasts |
| Transformer models (attention) | ❌ Missing | Temporal Fusion Transformer (TFT), PatchTST | HIGH — outperform LSTM on longer horizons |
| Probabilistic forecasting | ⚠️ MC Dropout only | Quantile regression, conformal prediction, normalizing flows | MEDIUM |
| Ramp detection | ⚠️ Basic threshold only | Wavelet-based ramp detection, regime-switching models | MEDIUM |
| Wake-aware forecasting | ❌ Missing | Per-turbine forecast considering wake propagation | MEDIUM |
| Online learning / model drift | ❌ Missing | Concept drift detection, periodic retraining pipeline | MEDIUM |
| MLOps pipeline | ❌ Missing | MLflow/DVC for experiment tracking, model versioning | LOW |

**Recommendation:** 
1. Add NWP data pipeline (ECMWF Open Data or GFS via AWS) as additional features
2. Implement Temporal Fusion Transformer alongside XGBoost/LSTM for comparison
3. Add quantile regression for native probabilistic forecasting (no MC Dropout hack needed)
4. Implement proper MLOps with experiment tracking

---

### GAP 6: Commissioning Simulation Missing Electrical Testing

| Test | v1.0 Status | Real Commissioning Practice | Priority |
|------|-------------|---------------------------|----------|
| HV withstand test (power frequency) | ❌ Missing | IEC 60060-1, applied voltage test | HIGH |
| Partial discharge (PD) measurement | ❌ Missing | Critical for GIS and cable systems | HIGH |
| Transformer ratio/polarity test | ❌ Missing | Standard factory + site test | HIGH |
| DGA baseline | ⚠️ Mentioned only | Full baseline oil analysis pre-energisation | MEDIUM |
| Frequency response analysis (FRA) | ❌ Missing | Transformer winding displacement test | MEDIUM |
| Cable impedance test | ❌ Missing | Verifies cable parameters match design | MEDIUM |
| Protection relay coordination check | ⚠️ Mentioned | Time-current curve overlay verification | MEDIUM |
| Dynamic transfer trip test | ❌ Missing | End-to-end communication-assisted tripping | MEDIUM |
| Black start test (if applicable) | ❌ Missing | Energisation from dead system | LOW |

**Recommendation:** Create a comprehensive SAT (Site Acceptance Test) and FAT (Factory Acceptance Test) specification document as part of P5. Include:
- Test procedure description
- Equipment required
- Pass/fail criteria with IEC standard reference
- Expected results (with tolerances)
- Sample test report format

---

### GAP 7: Missing Environmental & Regulatory Layer

| Topic | v1.0 Status | Professional Requirement | Priority |
|-------|-------------|------------------------|----------|
| Environmental Impact Assessment (EIA) | ❌ Missing | Legal requirement for all OWF | HIGH |
| Marine spatial planning | ❌ Missing | Site selection constraints | MEDIUM |
| Noise assessment (underwater) | ❌ Missing | Piling noise impact on marine life | MEDIUM |
| Aviation/radar impact | ❌ Missing | Turbine interference with radar systems | LOW |
| Decommissioning plan | ❌ Missing | Required as part of consent | LOW |
| Marine traffic risk assessment | ❌ Missing | Navigational safety | LOW |

**Recommendation:** Add a lightweight environmental module to P1. Not a full EIA (that would be a separate project), but document the key constraints and how they influence turbine layout:
- Exclusion zones (shipping lanes, military, pipelines)
- Bathymetry constraints (water depth limits for monopile foundations)
- Natura 2000 / bird migration corridors
- Noise mitigation measures (bubble curtains — as used at Baltic Power)

---

### GAP 8: Web Application Architecture Gaps

| Aspect | v1.0 | Professional Web App | Priority |
|--------|------|---------------------|----------|
| Unified web platform | ❌ Mixed (Streamlit + Dash + React) | Single cohesive platform | HIGH |
| Authentication/authorization | ❌ Missing | JWT/OAuth2 for RBAC | HIGH |
| API design | ❌ Missing | RESTful API with OpenAPI spec | HIGH |
| Real-time data streaming | ⚠️ WebSocket mentioned | WebSocket + Server-Sent Events architecture | MEDIUM |
| Database design | ⚠️ SQLite mentioned | PostgreSQL + TimescaleDB for time-series | MEDIUM |
| Containerization | ❌ Missing | Docker + Docker Compose | MEDIUM |
| Testing strategy | ⚠️ pytest mentioned | Unit + Integration + E2E testing | MEDIUM |
| CI/CD pipeline | ⚠️ GitHub Actions mentioned | Full pipeline with staging/production | LOW |

**Recommendation:** Unify the entire platform under a single technology stack:

```
RECOMMENDED UNIFIED ARCHITECTURE:

Frontend:  React 18 + TypeScript + Tailwind CSS + Plotly.js/D3.js
Backend:   FastAPI (Python) + SQLAlchemy + Alembic (migrations)
Database:  PostgreSQL + TimescaleDB extension (time-series)
Cache:     Redis (for real-time SCADA simulation state)
Realtime:  WebSocket (FastAPI native) + Server-Sent Events
Auth:      FastAPI Security + JWT tokens + RBAC middleware
Container: Docker + Docker Compose (dev) + docker-compose.prod.yml
CI/CD:     GitHub Actions → lint → test → build → deploy
Docs:      Swagger/OpenAPI auto-generated from FastAPI
```

This replaces the scattered Streamlit/Dash/React approach with a single professional stack. Streamlit is fine for rapid prototyping but not for a production educational platform.

---

## PART II: ENHANCED PROJECT ARCHITECTURE

### 2.1 Updated System Architecture

```
╔══════════════════════════════════════════════════════════════════════════╗
║          OFFSHORE WIND HV CONTROL SIMULATION PLATFORM v2.0              ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ┌─────────────────────────────────────────────────────────────────┐     ║
║  │                    REACT FRONTEND (TypeScript)                   │     ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ │     ║
║  │  │ P1: Wind  │ │P2: Grid  │ │P3: SCADA │ │P4: AI  │ │P5: Comm│ │     ║
║  │  │ Resource  │ │Integration│ │Automation│ │Forecast│ │issioning│ │     ║
║  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘ │     ║
║  └───────┼────────────┼────────────┼────────────┼──────────┼──────┘     ║
║          │            │            │            │          │             ║
║  ┌───────┴────────────┴────────────┴────────────┴──────────┴──────┐     ║
║  │              FASTAPI BACKEND + WEBSOCKET SERVER                 │     ║
║  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐   │     ║
║  │  │ REST API     │ │ WS Handlers  │ │ Background Workers   │   │     ║
║  │  │ (OpenAPI)    │ │ (Real-time)  │ │ (Celery/asyncio)     │   │     ║
║  │  └──────┬───────┘ └──────┬───────┘ └──────────┬───────────┘   │     ║
║  └─────────┼────────────────┼────────────────────┼───────────────┘     ║
║            │                │                    │                      ║
║  ┌─────────┴────────────────┴────────────────────┴───────────────┐     ║
║  │                    COMPUTATION ENGINES                          │     ║
║  │  ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────────┐ │     ║
║  │  │ PyWake  │ │Pandapower │ │ ANDES    │ │TensorFlow/XGBoost│ │     ║
║  │  │ (DTU)   │ │(Fraunhofer)│ │(Dynamic) │ │  (Forecasting)   │ │     ║
║  │  └─────────┘ └───────────┘ └──────────┘ └──────────────────┘ │     ║
║  └───────────────────────────────────────────────────────────────┘     ║
║            │                │                    │                      ║
║  ┌─────────┴────────────────┴────────────────────┴───────────────┐     ║
║  │                    DATA LAYER                                   │     ║
║  │  ┌──────────────┐ ┌───────────────┐ ┌───────────────────────┐ │     ║
║  │  │ PostgreSQL   │ │ TimescaleDB   │ │ Redis                 │ │     ║
║  │  │ (Config,PtW) │ │ (Time-series) │ │ (Cache, RT state)     │ │     ║
║  │  └──────────────┘ └───────────────┘ └───────────────────────┘ │     ║
║  └───────────────────────────────────────────────────────────────┘     ║
║                                                                          ║
║  ┌───────────────────────────────────────────────────────────────┐     ║
║  │  INFRASTRUCTURE: Docker Compose │ GitHub Actions CI/CD         │     ║
║  └───────────────────────────────────────────────────────────────┘     ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### 2.2 Updated Reference Wind Farm Specification

| Parameter | v1.0 | v2.0 (Updated) | Source |
|-----------|------|----------------|--------|
| Turbines | 36 × 14 MW | **34 × 15 MW = 510 MW** | Aligned with Vestas V236-15.0 (Baltic Power turbine class) |
| Rotor diameter | 222 m | **236 m** | V236-15.0 specification |
| Hub height | 140 m | **150 m** | Updated for 236 m rotor class |
| Cut-in / Rated / Cut-out | 3 / 12 / 30 m/s | **3 / 12.5 / 34 m/s** | V236-15.0 public specifications |
| Ct at rated | 0.30 | **0.28** | Updated for 15 MW class |
| Spacing crosswind | 5D (1,110 m) | **5D (1,180 m)** | Updated for 236 m rotor |
| Spacing downwind | 8D (1,776 m) | **8D (1,888 m)** | Updated for 236 m rotor |
| Array voltage | 66 kV | 66 kV | No change |
| Export voltage | 220 kV HVAC | 220 kV HVAC | No change (appropriate for ~45 km) |
| STATCOM | ±100 MVAR | **±120 MVAR + 50 MVAR shunt reactor** | Updated for N-1 redundancy |
| Grid code | PSE IRiESP | **PSE IRiESP + NC RfG Type D** | Full EU compliance |

### 2.3 New Project Structure (Monorepo)

```
offshore-wind-hv-platform/
├── README.md                          # Platform overview with system architecture
├── LICENSE                            # MIT / Apache 2.0
├── docker-compose.yml                 # Development environment
├── docker-compose.prod.yml            # Production environment
├── .github/
│   └── workflows/
│       ├── ci.yml                     # Lint + test on push
│       ├── cd.yml                     # Build + deploy on merge to main
│       └── security.yml               # Dependency vulnerability scanning
│
├── docs/
│   ├── system_architecture.md         # This document
│   ├── grid_code_compliance.md        # NC RfG + PSE IRiESP compliance matrix
│   ├── standards_reference.md         # Complete IEC standards map
│   ├── learning_roadmap.md            # Learning path with academic sources
│   ├── api_reference.md               # Auto-generated from OpenAPI
│   └── deployment_guide.md            # Docker deployment instructions
│
├── backend/                           # FastAPI Python backend
│   ├── pyproject.toml                 # Python project config (uv/poetry)
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py                    # FastAPI application entry
│   │   ├── config.py                  # Pydantic settings
│   │   ├── database.py                # SQLAlchemy + TimescaleDB
│   │   ├── auth/                      # JWT + RBAC
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── wind_resource.py   # P1 endpoints
│   │   │   │   ├── grid_integration.py # P2 endpoints
│   │   │   │   ├── scada.py           # P3 endpoints
│   │   │   │   ├── forecasting.py     # P4 endpoints
│   │   │   │   └── commissioning.py   # P5 endpoints
│   │   │   └── websocket.py           # Real-time SCADA simulation
│   │   ├── models/                    # SQLAlchemy ORM models
│   │   ├── schemas/                   # Pydantic request/response schemas
│   │   └── services/                  # Business logic
│   │       ├── wind/                  # PyWake integration
│   │       ├── grid/                  # Pandapower + ANDES integration
│   │       ├── scada/                 # IEC 61850 simulation
│   │       ├── forecast/              # ML model inference
│   │       └── commissioning/         # Switching programme logic
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── conftest.py
│   └── alembic/                       # Database migrations
│
├── frontend/                          # React TypeScript frontend
│   ├── package.json
│   ├── Dockerfile
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── common/                # Shared UI components
│   │   │   ├── p1-wind/               # Wind resource dashboards
│   │   │   ├── p2-grid/               # Power system dashboards
│   │   │   ├── p3-scada/              # SCADA mimic diagrams
│   │   │   ├── p4-forecast/           # Forecasting dashboards
│   │   │   └── p5-commissioning/      # Switching programme UI
│   │   ├── hooks/                     # Custom React hooks
│   │   ├── services/                  # API client (axios/fetch)
│   │   ├── store/                     # State management (Zustand)
│   │   └── types/                     # TypeScript interfaces
│   └── tests/
│
├── notebooks/                         # Jupyter notebooks for exploration
│   ├── 01_wind_data_eda.ipynb
│   ├── 02_wake_model_validation.ipynb
│   ├── 03_grid_load_flow.ipynb
│   ├── 04_dynamic_simulation.ipynb
│   ├── 05_ml_model_development.ipynb
│   └── 06_grid_code_compliance.ipynb
│
├── data/
│   ├── raw/                           # ERA5 NetCDF files (.gitignore)
│   ├── processed/                     # Weibull parameters, cleaned data
│   ├── turbine_specs/                 # Power/Ct curves
│   ├── scl_files/                     # IEC 61850 SCL configuration files
│   └── grid_code/                     # PSE IRiESP extracts, NC RfG requirements
│
├── ml_models/                         # Trained model artifacts (.gitignore)
│   ├── xgboost/
│   ├── lstm/
│   └── tft/
│
└── scripts/
    ├── download_era5.py               # CDS API data download
    ├── generate_synthetic_scada.py    # SCADA data generator
    ├── generate_scl.py                # IEC 61850 SCL file generator
    └── seed_database.py               # Initial database population
```

---

## PART III: PROJECT-BY-PROJECT ENHANCEMENT SPECIFICATIONS

### 3.1 Project 1 Enhancements — Wind Resource & Layout

**New additions:**
1. **Constraint mapping layer:** Add bathymetry, exclusion zones, existing infrastructure (pipelines, cables) as layout constraints. Use `geopandas` + `shapely` for spatial analysis.
2. **Blockage effect:** Add wind farm blockage model (Nygaard et al., 2020). Large arrays experience 1-3% power reduction from upstream flow deceleration. This is missing from v1.0 and represents a significant AEP overestimation risk.
3. **Climate change adjustment:** Add long-term wind speed trend analysis. ERA5 data shows some Baltic regions experiencing -0.5% to +1% wind speed trends per decade. Financial models must account for this.
4. **Foundation type selection module:** Add decision logic for monopile vs jacket vs gravity-based foundations depending on water depth and soil conditions.
5. **Cable route optimization:** Add inter-array cable routing optimization (minimum spanning tree or Steiner tree algorithm) with crossing constraints.

### 3.2 Project 2 Enhancements — HV Grid Integration

**New additions:**
1. **Full NC RfG Type D compliance matrix** (as described in Gap 3)
2. **Dynamic simulation module** using ANDES or PyPSA
3. **Frequency response simulation:** LFSM-O, LFSM-U, FSM modes
4. **P-Q capability diagram:** Full reactive power envelope at PCC
5. **Harmonic impedance scan:** Frequency-dependent impedance to identify cable resonance risks
6. **Insulation coordination study:** BIL/SIL levels for all HV equipment
7. **HVDC comparison module:** Side-by-side HVAC vs HVDC break-even analysis (distance, capacity)
8. **Earthing/grounding study:** System earthing philosophy (solidly grounded, resistance grounded, etc.)

### 3.3 Project 3 Enhancements — SCADA & Automation

**New additions:**
1. **SCL file generation:** Produce actual SSD/ICD/SCD files
2. **Sampled Values (IEC 61850-9-2):** Process bus simulation with digital CT/VT
3. **PRP/HSR redundancy:** Network architecture with zero-failover
4. **IEEE 1588 PTP time synchronization:** Architecture and accuracy requirements
5. **OPC-UA integration layer:** For Layer 3→4 data exchange
6. **IEC 62351 security:** Cybersecurity specifically for IEC 61850 communications
7. **Historian architecture:** TimescaleDB with data retention policies and compression
8. **SCADA HMI design standards:** Align with ISA-101 (HMI design guidelines) and ASM Consortium standards

### 3.4 Project 4 Enhancements — AI Forecasting

**New additions:**
1. **NWP data pipeline:** ECMWF open data + feature extraction
2. **Temporal Fusion Transformer:** State-of-the-art multi-horizon forecasting
3. **Quantile regression forests:** Native probabilistic output without MC Dropout
4. **Ramp event detection:** Wavelet decomposition + threshold-based alerting
5. **Model explainability report:** SHAP + attention weight visualization
6. **Concept drift detection:** Statistical tests for distribution shift
7. **Synthetic SCADA data generator:** Generate realistic turbine SCADA data for training when real data is unavailable (essential for open-source educational projects)

### 3.5 Project 5 Enhancements — Commissioning

**New additions:**
1. **Full SAT/FAT specification document** with all electrical tests
2. **Protection relay setting calculation module:** Time-current curves with selectivity verification
3. **Emergency response procedures:** Detailed emergency scenarios (fire, SF6 leak, medical emergency, man overboard)
4. **Offshore logistics planning:** CTV/SOV vessel scheduling, weather windows, crew change
5. **Punch list management:** Systematic tracking of open items from commissioning
6. **Grid code compliance testing:** EON/ION/FON stage verification per NC RfG

---

## PART IV: UPDATED INDUSTRY CONTEXT (February 2026)

### Poland's Offshore Wind — Current Status (As of 19 February 2026)

| Project | Capacity | Status | Turbines | Developer |
|---------|----------|--------|----------|-----------|
| **Baltic Power** | 1.2 GW | All 78 foundations installed, 30/76 turbines installed, OSS complete | Vestas V236-15.0 MW (76 units) | ORLEN + Northland Power |
| **Bałtyk 2** | ~720 MW | Offshore construction started Jan 2026 (rock installation) | SG 14-236 DD | Equinor + Polenergia |
| **Bałtyk 3** | ~720 MW | Offshore construction started Jan 2026 | SG 14-236 DD | Equinor + Polenergia |
| **Baltica 2** | ~1.5 GW | Pre-construction, FID expected 2026 | TBD | PGE + Ørsted |
| **Baltica 3** | ~1.0 GW | Pre-construction | TBD | PGE + Ørsted |

**Key facts for project context:**
- Baltic Power is scheduled to be operational by late 2026
- Bałtyk 2&3 construction campaign 2026 will install 100 monopiles, TPs, substations, and cables
- Poland's first wave: ~3.5 GW by 2028
- PSE is developing internal HVDC line (north-south Poland) to accommodate offshore wind
- Over 20 vessels simultaneously working on Baltic Power installation

### EU Offshore Wind Market Update

- EU target: 60 GW by 2030 (currently ~35 GW installed as of end 2025)
- Global offshore wind capacity expected to exceed 500 GW by 2040
- 15 MW turbines now standard for new projects (V236-15.0, SG 14-236)
- 20+ MW turbines in development (CSSC H260-18MW, Mingyang MySE 18.X-20MW)
- Grid-forming inverter requirements emerging in UK, Germany, and Ireland grid codes

---

## PART V: UPDATED STANDARDS REFERENCE MATRIX

### New Standards to Include (v2.0 Additions)

| Standard | Topic | Why Added |
|----------|-------|-----------|
| **NC RfG (EU 2016/631)** | EU Requirements for Generators | Full compliance chain for Type D |
| **NC ER (EU 2017/2196)** | Emergency & Restoration | Black start, defense plans |
| **IEC 61850 Ed. 2.1** | GOOSE supervision, cybersecurity | Latest standard update (2024) |
| **IEC 62351** | Power system cybersecurity | Security for IEC 61850/60870 |
| **IEC 61869-9** | NCIT digital output | Process bus instrument transformers |
| **IEEE 1588** | Precision Time Protocol | Time synchronization for SV |
| **ISA-101** | HMI design guidelines | SCADA dashboard design standard |
| **IEC 60060-1** | HV test techniques | Commissioning withstand tests |
| **IEC 61000-4-7** | Harmonic measurement | Harmonic analyzer requirements |
| **IEC 60076-7** | Loading guide for oil transformers | Transformer thermal model |
| **DNV-ST-0145** | Offshore substations | Structural/electrical design standard |
| **CIGRE TB 496** | Recommendations for testing DC cables | HVDC extension module |

---

*This document identifies 8 critical gap categories with 40+ specific improvements. Implementation priority: Gaps 1-3 (Critical), Gaps 4-6 (High), Gaps 7-8 (Medium). Total estimated implementation effort: 12-16 weeks for a dedicated developer.*

*Version 2.0 — February 2026*

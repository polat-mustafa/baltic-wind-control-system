# User Guide - Baltic Wind HV Control Platform

> **510 MW Baltic Sea offshore wind farm simulation platform**
> 34 x Vestas V236-15.0 MW | 66 kV array system | 220 kV export cable (45 km) | 400 kV PSE grid connection

This guide explains how to install, run, maintain, and troubleshoot the project with a level of detail suitable for self-study, onboarding, and GitHub Pages publication. It is written for users who may be new to the stack but still need technically accurate instructions.

---

## Contents

1. [What This Project Is](#1-what-this-project-is)
2. [Tooling and Why It Exists](#2-tooling-and-why-it-exists)
3. [Recommended Setup with Docker](#3-recommended-setup-with-docker)
4. [Manual Infrastructure Setup](#4-manual-infrastructure-setup)
5. [Manual Backend Setup](#5-manual-backend-setup)
6. [Manual Frontend Setup](#6-manual-frontend-setup)
7. [Database Management](#7-database-management)
8. [Daily Development Workflow](#8-daily-development-workflow)
9. [Makefile Reference](#9-makefile-reference)
10. [Linting and Pre-commit](#10-linting-and-pre-commit)
11. [Testing](#11-testing)
12. [CI/CD and GitHub Actions](#12-cicd-and-github-actions)
13. [MkDocs and GitHub Pages](#13-mkdocs-and-github-pages)
14. [Troubleshooting](#14-troubleshooting)
15. [Architecture Overview](#15-architecture-overview)
16. [Ports and Services](#16-ports-and-services)
17. [Quick Reference](#17-quick-reference)

---

## 1. What This Project Is

### 1.1 Purpose

The platform is an educational but engineering-grade simulation environment for a **510 MW offshore wind farm** in the Polish Baltic Sea. It combines wind-resource analysis, HV grid studies, substation automation concepts, forecasting workflows, and commissioning logic in one repository.

### 1.2 Project Streams

| Stream | Focus | Typical Outputs |
| --- | --- | --- |
| **P1** | Wind resource and AEP | Wake losses, layout studies, uncertainty, yield metrics |
| **P2** | HV system analysis | Load flow, short-circuit, FRT, reactive power studies |
| **P3** | SCADA and OT workflows | IEC 61850 models, alarm behaviour, Permit-to-Work lifecycle |
| **P4** | Forecasting and analytics | ML models, probabilistic forecasts, explainability outputs |
| **P5** | Commissioning logic | Switching programmes, FAT/SAT workflows, protection checks |

### 1.3 Who This Guide Is For

This guide is intended for:

- engineers learning the stack from scratch,
- contributors setting up a local development environment,
- reviewers checking how the project is structured for GitHub Pages and CI,
- students using the repository as a professional study portfolio.

---

## 2. Tooling and Why It Exists

### 2.1 Core Tools

| Tool | Why It Is Used |
| --- | --- |
| **Git** | Version control, branch workflow, traceable engineering history |
| **Docker Desktop** | Fast, reproducible multi-service setup with minimal local friction |
| **Python 3.13** | Backend services and engineering computation stack |
| **Node.js 22** | Frontend toolchain, build, lint, and test environment |
| **PostgreSQL 16 + TimescaleDB** | Relational plus time-series storage for engineering data |
| **Redis 7** | Cache and real-time support layer |
| **VS Code** | Recommended editor for Python, TypeScript, Docker, and docs work |

### 2.2 Recommended Installation Paths

- **Docker-first users**: install Git and Docker Desktop.
- **Full local development users**: install Git, Docker Desktop, Python 3.13, and Node.js 22.
- **Database-only local users**: PostgreSQL and Redis can also be run outside Docker, but that path requires more manual configuration.

---

## 3. Recommended Setup with Docker

### 3.1 Clone the Repository

```bash
git clone https://github.com/polat-mustafa/baltic-wind-control-system.git
cd baltic-wind-control-system
```

### 3.2 Prepare Environment Files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

If you are on Windows PowerShell, use:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

### 3.3 Start the Full Stack

```bash
docker compose up -d --build
```

### 3.4 Verify the Services

```bash
docker compose ps
curl http://localhost:8000/health
```

Expected checks:

- `postgres` is healthy,
- `redis` is healthy,
- `backend` responds on `/health`,
- `frontend` is accessible on `http://localhost:3000`.

### 3.5 When to Prefer Docker

Use Docker when you want:

- reproducible onboarding,
- zero manual PostgreSQL and Redis installation,
- environment parity with CI,
- a simple GitHub Pages / docs contributor workflow.

---

## 4. Manual Infrastructure Setup

### 4.1 PostgreSQL and TimescaleDB

If you are not using Docker, install PostgreSQL 16 and ensure the TimescaleDB extension is available.

Typical local database target:

```text
postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind
```

After creating the database, enable TimescaleDB if your local installation supports it:

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### 4.2 Redis

Run Redis locally on the default port:

```text
redis://localhost:6379/0
```

---

## 5. Manual Backend Setup

### 5.1 Install Dependencies

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
```

### 5.2 Apply Migrations

```bash
alembic upgrade head
```

### 5.3 Start the API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5.4 Backend Verification

Check:

- `http://localhost:8000/health`
- `http://localhost:8000/docs`
- `http://localhost:8000/redoc`

---

## 6. Manual Frontend Setup

### 6.1 Install Dependencies

```bash
cd frontend
npm ci
```

### 6.2 Start the Development Server

```bash
npm run dev
```

The default Vite development URL is usually `http://localhost:5173`.

### 6.3 Production Build Check

```bash
npm run build
npm run preview
```

---

## 7. Database Management

### 7.1 Common Commands

```bash
docker compose exec postgres psql -U postgres -d balticwind
```

```bash
alembic current
alembic history
```

### 7.2 When to Reset Local Data

A local reset is reasonable when:

- migrations changed substantially,
- seed data or test fixtures are corrupted,
- you explicitly want a clean environment.

Docker reset:

```bash
docker compose down -v
docker compose up -d --build
```

---

## 8. Daily Development Workflow

A good default workflow is:

1. pull the latest changes,
2. start infrastructure,
3. run the backend or frontend in development mode,
4. make changes,
5. run lint and tests locally,
6. update docs if behaviour changed,
7. commit with a scoped message.

Example:

```bash
git pull
make docker-up
make lint
make test
```

---

## 9. Makefile Reference

| Command | Purpose |
| --- | --- |
| `make install` | Install backend and frontend dependencies |
| `make docker-up` | Start the Docker stack |
| `make docker-down` | Stop the Docker stack |
| `make docker-logs` | Follow container logs |
| `make lint` | Run repository lint targets |
| `make format` | Apply formatting tools |
| `make test` | Run tests |
| `make clean` | Remove common caches and build artefacts |
| `make docs-serve` | Serve MkDocs locally |

---

## 10. Linting and Pre-commit

The repository uses pre-commit as the first quality gate. It helps catch issues before they reach CI.

Typical checks include:

- Python formatting and linting,
- Python typing,
- TypeScript and frontend linting,
- whitespace and file hygiene rules.

Install hooks once:

```bash
pre-commit install
```

Run them manually if needed:

```bash
pre-commit run --all-files
```

---

## 11. Testing

### 11.1 Backend

```bash
cd backend
pytest
```

### 11.2 Frontend

```bash
cd frontend
npm run test -- --run
```

### 11.3 What to Test Before Committing

At minimum, verify:

- the affected application starts,
- lint passes,
- the directly impacted tests pass,
- docs are updated when user-facing behaviour changes.

---

## 12. CI/CD and GitHub Actions

GitHub Actions is used for:

- linting,
- test execution,
- documentation build and Pages deployment,
- dependency update verification.

The documentation workflow publishes the MkDocs site to GitHub Pages whenever documentation files or MkDocs configuration change on `main`.

---

## 13. MkDocs and GitHub Pages

### 13.1 Local Preview

```bash
mkdocs serve
```

or

```bash
make docs-serve
```

### 13.2 Build Check

```bash
mkdocs build
```

### 13.3 Publishing Notes

For GitHub Pages, keep the docs structure explicit and stable:

- use committed markdown files,
- keep navigation deterministic in `mkdocs.yml`,
- avoid runtime translation plugins when static language sections are sufficient,
- verify links before merging.

---

## 14. Troubleshooting

### 14.1 Docker Does Not Start

Check:

- Docker Desktop is running,
- virtualization is enabled,
- WSL2 is healthy on Windows.

### 14.2 Backend Keeps Restarting

Inspect logs:

```bash
docker compose logs backend
```

Typical causes:

- missing environment variables,
- database not ready,
- migration failure,
- import or dependency error.

### 14.3 Frontend Opens but Is Blank

Check:

- browser console errors,
- backend health endpoint,
- `VITE_` environment values,
- whether the frontend was rebuilt after config changes.

### 14.4 Migration Errors

Useful commands:

```bash
alembic current
alembic upgrade head
```

### 14.5 CORS Issues

Verify the backend CORS configuration includes your active frontend origin, especially `http://localhost:3000` and `http://localhost:5173`.

---

## 15. Architecture Overview

### 15.1 High-Level Topology

```text
Browser -> Frontend -> Backend API -> PostgreSQL / TimescaleDB
                             -> Redis
                             -> Engineering services (P1-P5)
```

### 15.2 Repository Layout

```text
backend/     FastAPI application, services, schemas, tests, Alembic
frontend/    React application, UI components, stores, tests
docs/        MkDocs content, roadmaps, lessons, user documentation
.github/     CI/CD and documentation workflows
```

### 15.3 Engineering Principle

The project is structured to keep physics, standards, calculations, and code traceable. Documentation is therefore part of the system architecture, not an optional accessory.

---

## 16. Ports and Services

| Port | Service | Notes |
| --- | --- | --- |
| `3000` | Frontend (Docker / production-style serving) | Main browser entry for the containerised stack |
| `5173` | Frontend dev server | Default Vite development port |
| `8000` | Backend API | FastAPI application |
| `5432` | PostgreSQL / TimescaleDB | Main database |
| `6379` | Redis | Cache and messaging layer |
| `8080` | MkDocs local preview | Typical docs preview target |

---

## 17. Quick Reference

```bash
# Start full stack
docker compose up -d --build

# Stop full stack
docker compose down

# Tail logs
docker compose logs -f

# Backend tests
cd backend && pytest

# Frontend tests
cd frontend && npm run test -- --run

# Docs preview
mkdocs serve

# Docs build
mkdocs build
```

---

## Notes for Contributors

This English guide is the first direct-authored translation batch. The structure matches the original Turkish documentation while tightening wording for international academic and engineering readers. The lesson-by-lesson translations are being added in the same layout so that GitHub Pages navigation remains stable.

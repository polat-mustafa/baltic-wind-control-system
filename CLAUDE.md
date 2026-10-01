# Baltic Wind HV Control Platform

510 MW Baltic Sea offshore wind farm simulation: 34 × V236-15.0 MW, 66 kV array, 220 kV export (45 km), PSE grid.
Monorepo: FastAPI (Python 3.13, SQLAlchemy, Pydantic v2) backend + React 19 / TypeScript / Tailwind v4 / Vite frontend.

## Working style

- Physics first, code second: sanity-check results against the domain rules below and state units.
- Keep replies short — no session opener, no interview questions / "explain simply" sections.

## Commands (run from repo root unless noted)

| Task | Command |
|---|---|
| Backend lint | `cd backend && python -m ruff check app/ tests/ && python -m ruff format --check app/ tests/` |
| Backend types | `cd backend && python -m mypy app/` |
| Backend tests (targeted) | `cd backend && python -m pytest tests/test_<module>.py -q` |
| Backend tests (full, ~1750) | `cd backend && python -m pytest -n auto -q` (parallel, pytest-xdist) |
| Frontend typecheck | `cd frontend && npm run typecheck` |
| Frontend lint | `cd frontend && npm run lint` |
| Frontend tests | `cd frontend && npm test` |
| Frontend e2e (local, system Chrome) | `cd frontend && npm run e2e` (runtime errors + visual baselines; `npm run e2e:update` to accept a new look) |
| Format all | `make format` |
| Dev stack | `docker compose up` (or `cd frontend && npm run dev`) |

## Definition of done (verify before saying "done")

1. Targeted tests for the touched module pass (add/extend tests for new behaviour).
2. Backend change → ruff check + ruff format --check clean; frontend change → typecheck + lint clean.
3. Physics results sanity-checked against the domain rules below; state units.
Never claim success without having run the relevant command and seen it pass.

## Architecture map

- `backend/app/routers/` — REST endpoints per project (`p1*.py` … `p5/`, `digital_twin.py`, `turbine_*.py`)
- `backend/app/services/<p0..p5, digital_twin, turbine_physics>/` — business logic and computation engines
- `backend/app/models/` ORM · `schemas/` Pydantic · `core/` exceptions, middleware, cache, RBAC
- `frontend/src/pages/` — one page per module (WindResource, HVGrid, SCADA, Forecast, Commissioning, DigitalTwin, TurbinePhysics…)
- `frontend/src/{components,hooks,services,store,types}` — UI, hooks, API client, Zustand, TS types

## Navigating code — use CodeGraph first

This repo is indexed (`.codegraph/`, auto-syncs). For "where is / what calls / how does X work" use the
`codegraph_explore` MCP tool (or `codegraph explore "<symbol or question>"`) BEFORE grep or reading whole files.

## Non-negotiable domain rules (summary — full text: `docs/SKILL.md` § Critical Domain Rules)

1. 0 ≤ P ≤ Prated; zero output below cut-in 3 m/s and above cut-out 31 m/s; ML never overrides physics (`enforce_physical_constraints()`).
2. Per-unit consistent: Sbase 100 MVA, Vbase = bus nominal (66/220/400 kV); never mix pu and absolute.
3. Short-circuit per IEC 60909 via `pandapower.shortcircuit.calc_sc()` (HV/MV: cmax 1.10, cmin 1.00; 0.95 is LV-only) — do not re-implement.
4. Reactive power: generating Q positive (`reactive_power_mvar`).
5. GOOSE is L2 Ethernet (<4 ms); HTTP/WS simulations must carry `# EDUCATIONAL SIMULATION — GOOSE is L2 Ethernet in real systems`.
6. Time series: `TimeSeriesSplit`, never shuffle.
7. Cable Q is capacitive: `Q = ωCV²L` (positive).
For rules 8–10 and details, read that section of `docs/SKILL.md`.

## Reference docs — read ON DEMAND, only the relevant section

These are large (SKILL.md ≈ 28 KB, Project_Roadmap.md ≈ 93 KB). Do NOT read them whole; grep the heading and read that section.
- `docs/SKILL.md` — sections: Critical Domain Rules, Code Style, Database Schema, API Design Patterns,
  Computation Engine Integration, Testing Strategy, Error Handling, Git Workflow, Security Checklist (IEC 62443)
- `docs/Project_Roadmap.md` — §2 P1 Layout & Yield · §3 P2 HV Grid · §4 P3 SCADA/IEC 61850 · §5 P4 Forecasting & FRT ·
  §6 P5 Commissioning · §7 Integration Map · §8 Tech Stack/UI · §9 Standards Matrix
- `docs/Learning_Roadmap.md` — 32-week curriculum (map the session's module to it)
- `docs/archive/` — historical v1/v2 roadmaps

## Memory files (Claude Code project memory directory)

`engineering_rules.md` · `architecture.md` · `project_overview.md` · `teaching_methodology.md` · `frontend.md`

## Gotchas

- Windows dev machine: prefer `python -m <tool>` over bare `ruff`/`pytest`. Smart App Control blocks exe/DLLs in a fresh `uv sync` venv, so locally use the existing Python env; CI uses `uv sync --locked`.
- Dependencies are pinned in `backend/uv.lock`. After editing `pyproject.toml` dependencies run `cd backend && uv lock` and commit the lockfile (CI uses `--locked` and fails otherwise).
- `.planning/` holds old planning notes (legacy GSD) — not a source of truth.
- Never commit `.env*` files; secrets stay out of the repo.
- Commit messages, PR titles and PR bodies are always in **English** (conventional-commit style), even when chatting in Turkish.
- Backend CI runs in 3 pytest-split shards balanced by `backend/.test_durations`; refresh it after adding many/slow tests (command in `.github/workflows/ci.yml`).
- Dependabot minor/patch PRs auto-merge once the required `CI OK` check passes; majors need manual review.

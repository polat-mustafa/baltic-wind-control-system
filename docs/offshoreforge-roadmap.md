# OffshoreForge roadmap and hand-off

Working notes for continuing the OffshoreForge transformation in a new Claude Code session.
Read this first, then the CLAUDE.md rules. Six phases in total; phases 1–3 are merged, phases 4 and 5 are in review.

| Phase | Scope | Status |
|---|---|---|
| 1 | Rename to OffshoreForge, lifecycle sidebar, new README | Merged (PR #217) |
| 2 | Guided tour engine and per-page tours | Merged (PR #218) |
| 3a/3b | Open marine data package + site-assessment backend | Merged (PR #219) |
| 3c | `/develop` "build a farm from scratch" journey | Merged (PR #220) |
| 4 | Layout canvas: turbines, wake, AEP, array cables, cost | Done on `claude/busy-planck-8vitbx` (PR open) |
| 5 | Academy: courses and scored missions | Done on `claude/phase5-academy` (stacked on phase 4, own PR) |
| 6 | Lifecycle: construction, operation hand-over, decommissioning | **Next** |

## Resume here

1. `git fetch origin && git checkout claude/busy-planck-8vitbx && git pull`
   (if PR #221 is already merged: `git checkout -B claude/busy-planck-8vitbx origin/main`).
2. PR #221 (Phase 4) — check CI; merge only when the owner says so.
3. Phase 5 (Academy) is on `claude/phase5-academy`, a PR stacked on PR #221; after #221 is merged, merge
   `main` into it so the diff shows only phase 5.
4. Next: **Phase 6 — Lifecycle** (spec below).
5. Owner to-dos: `cd frontend && npm run e2e:update` (new `layout`, `site-permits` and `academy` baselines),
   rename the GitHub repo to `offshoreforge`, trademark check.

## Working conventions

- One PR per phase. Commits, PR titles/bodies, code, UI text and docs are in **English**.
- Every number in the UI is either sourced (`docs/references.md`, model cards) or labelled
  *illustrative*. Legal statements are checked against the primary text (EUR-Lex) before writing.
- Training documents carry the "TRAINING SPECIMEN" watermark and fictional issuers only.
- Existing modules (P1–P5, Digital Twin, Turbine Physics) are kept and linked into the lifecycle;
  route paths never change.
- Definition of done: see CLAUDE.md (ruff + mypy + targeted pytest; typecheck + lint + vitest;
  browser check in both themes and at 390 px width).

## What exists now (entry points)

### Tour engine — `frontend/src/tour/`
- `types.ts` `TourStep { id, route?, target?: string | string[], title, body, points?, task?, caution?, arrow? }`.
  `target` is a `data-tour` attribute value; an array gives fallbacks (first visible wins).
- `task.watch()` returns a predicate polled by the overlay; a step auto-advances only when the
  user did the task (`byUser`), never when it was already satisfied on entry, never on the last step.
- `tours.ts` holds 9 tours (one per page + `site-permits`). New pages need `data-tour` attributes
  and a tour entry. Storage keys: `of.tour.v1` (localStorage), `of.tour.later` (sessionStorage).
- Use `readStored` / `writeStored` in `frontend/src/lib/storage.ts` for every new key (`of.` prefix;
  legacy `bw.` keys are migrated).

### Site assessment — backend `backend/app/services/site_assessment/`
- `layers.py` loads `data/southern_baltic.json` (EMODnet / Marine Regions, CC BY 4.0, see
  `data/SOURCES.md`); roles: sea, shore, territorial, eez, cable, owf, grid, protected, shipping,
  restricted, bathymetry.
- `suitability.py` `screen()` — WLC multi-criteria grid with hard exclusions.
- `assess.py` `assess_site(polygon)` → checks, area, capacity, depth, distances, grid node.
- Router `backend/app/routers/site_assessment.py`: `GET /api/v1/site/regions|layers`,
  `POST /api/v1/site/suitability|assess`. Tests: `backend/tests/test_site_assessment.py`.
- Refresh data: `backend/scripts/fetch_marine_layers.py` (needs the EMODnet / VLIZ hosts allowed).

### Site journey — frontend
- Page `frontend/src/pages/SitePermitsPage.tsx` (route `/develop`), components in
  `frontend/src/components/site/` (`ScreeningMap`, `SiteReport`, `Stages`, `Documents`, `Actors`,
  `journey.ts` with `decide(report)`).
- Store `frontend/src/store/siteStore.ts` (persisted as `of.site.v1`): `site` (GeoJSON polygon),
  `report`, `stage`, `done[]`. Phase 4 starts from `site` + `report` of this store.

## Phase 4 — Layout canvas (implemented)

Delivered (route `/develop/layout`, page `frontend/src/pages/LayoutPage.tsx`):
- `frontend/src/lib/layout/` — `geometry.ts` (projection, point-in-polygon, grid fill), `cables.ts`
  (Esau–Williams, 66 kV sections 500/630/800 mm² from the P2 ratings, ≤ 6 × 15 MW per string),
  `energy.ts` (screening yield with the V236 Ct curve; k* = 0.05 matches PyWake within 0.5 pp),
  `cost.ts` (CAPEX lines, CRF, LCOE; illustrative editable inputs).
- `frontend/src/store/projectStore.ts` (`of.project.v1`, `.offshoreforge.json` export/import, schema 1).
- `frontend/src/components/layout-canvas/` — Leaflet map with draggable turbines and OSS, constraint
  layers, cables coloured by section, optional wake cones.
- Backend `POST /api/v1/wind/wake-analysis-custom` (note: the P1 router prefix is `/api/v1/wind`),
  tests `backend/tests/test_wake_custom.py`. Frontend tests `tests/lib/layout.test.ts`,
  `tests/store/projectStore.test.ts`. Tour `layout`.

Still open from the original Phase 4 spec (good follow-ups):
- IEA-15-240-RWT as a second turbine model (curves from the official IEA Wind Task 37 repo; backend
  `run_wake_analysis` already takes a `turbine` argument).
- Hand the project to P1/P2 pages (they still use the fixed SB-510 constants).

Original spec, kept for reference:

Goal: inside the site approved in `/develop`, the learner places turbines, sees wake losses live,
gets AEP, an offshore substation (OSS), array cable routing and a cost estimate, and saves a project
file that other modules can read.

### 4.1 Project store
- New `frontend/src/store/projectStore.ts` (persist key `of.project.v1`):
  `{ site: GeoJSON polygon, turbineModel: "V236-15.0" | "IEA-15-240-RWT", turbines: {id, lon, lat}[],
  oss: {lon, lat} | null, cables: {from, to, section}[], results }`.
- Seed from `useSiteStore.getState().site`; "Load SB-510" uses `frontend/src/constants/windFarmLayout.ts`.
- JSON export / import (`.offshoreforge.json`, include a `schema_version`). Unit tests in
  `frontend/tests/store/projectStore.test.ts`.

### 4.2 Turbine models — `frontend/src/constants/turbineModels.ts` (+ backend twin)
- V236-15.0: reuse the existing constants (D = 236 m; see `frontend/src/utils/wakeModel.ts` and the
  P1 services).
- IEA-15-240-RWT: D = 240 m, hub 150 m, 15 MW, cut-in 3, rated 10.59, cut-out 25 m/s
  (Gaertner et al. 2020, NREL/TP-5000-75698). Take the power and Ct curves from the official
  IEA Wind Task 37 repository (`IEAWindTask37/IEA-15-240-RWT`, Documentation) — do not invent them;
  add the source to `docs/references.md`.
- Domain rule 1: 0 ≤ P ≤ P_rated, zero below cut-in and above cut-out for every model.

### 4.3 Canvas UI — `frontend/src/pages/LayoutPage.tsx` (route e.g. `/develop/layout`)
- Reuse the Leaflet setup from `components/site/ScreeningMap.tsx` (canvas renderer, layer panel,
  bottom-right zoom). Draw the site polygon, exclusions from `/api/v1/site/layers`.
- Tools: grid fill (rows/columns spacing in D, orientation angle), staggered fill, single add,
  drag, delete, snap to grid. Turbines outside the polygon or in an excluded area → red marker
  with reason (point-in-polygon on the client; reuse the backend `geo.py` logic as a TS port).
- Minimum spacing warning in rotor diameters (teaching defaults: warn < 4 D cross-wind,
  < 6 D down-wind — mark *illustrative*, cite DNV / literature if a primary source is found).
- Live wake: `frontend/src/utils/wakeModel.ts` (Bastankhah Gaussian, `computeWakeLosses`,
  `wakeConePoly`). It assumes D = 236 m and a fixed latitude constant — generalise to take
  `D`, `Ct(U)` and the site latitude as parameters; keep existing callers working.
- Panel: capacity (MW), installed density (MW/km²), live wake loss (%), indicative AEP.
- Add `data-tour` attributes and a `layout` tour (drag a turbine; watch-out: spacing vs wake).

### 4.4 Backend AEP for arbitrary positions
- `POST /api/v1/wind/wake-analysis-custom` in `backend/app/routers/p1.py`.
  Request: positions (lon/lat or local x/y in m), turbine model, Weibull A/k (or the site wind
  rose), turbulence intensity. Convert lon/lat to local metres (equirectangular around the
  centroid, same as `services/site_assessment/geo.py`).
- Call the existing `run_wake_analysis(x_positions_m, y_positions_m, site, turbine)` in
  `backend/app/services/p1/wake_model.py` (PyWake). Response = `WakeAnalysisResponse`
  (gross/net AEP GWh, wake loss %, capacity factor, per-turbine values).
- Limits: ≤ 150 turbines, request validation with Pydantic `Field` bounds; add tests in
  `backend/tests/` (sanity: one turbine → 0 % wake loss; 7 D grid loss lower than 4 D grid;
  CF within 0–1). Acceptance: client wake loss within ~2 percentage points of PyWake.

### 4.5 Electrical infrastructure
- OSS: draggable; default at the turbine centroid moved towards the grid node from the site report.
- Array cables: capacity-constrained tree (Esau–Williams heuristic; plain MST as a comparison
  baseline). Constraint: turbines per string = floor(cable ampacity × √3 × 66 kV × pf / P_turbine).
  Cable sections (e.g. 66 kV XLPE 240 / 630 / 800 mm²) — reuse ratings already in the P2 services
  (`backend/app/services/p2/`) instead of new numbers.
- Output: total cable length per section (km), number of strings, a check that no two cables cross.
- Export cable length ≈ OSS → shore landing (site report `grid_km` is straight-line; show
  "route longer" as in the documents).

### 4.6 Cost / LCOE
- `LCOE = (CAPEX × CRF + OPEX) / AEP_net`, `CRF = r(1+r)^n / ((1+r)^n − 1)`.
- CAPEX lines: turbines (per MW), foundations (by depth band from the site report), array cable
  (per km per section), OSS, export cable (per km), installation. All inputs editable, each
  labelled with source or *illustrative*; units €/MW, €/km, €/MWh.
- Show the trade-off the Academy will score later: tighter spacing → more MW and less cable,
  but more wake loss.

### 4.7 Wiring and tests
- Sidebar: add "Layout" under Develop (`Sidebar.tsx` `NAV_GROUPS`), `ROUTE_LABELS` in
  `AppShell.tsx`, e2e `ROUTES` in `frontend/e2e`.
- From `/develop` stage 5 (documents) add a "Continue to layout" button.
- Tests: wake-model generalisation (vitest), cable heuristic (vitest: capacity respected, tree
  connects all turbines, MST ≤ Esau–Williams length), projectStore, backend endpoint.

## Phase 5 — Academy (implemented)

Delivered (route `/academy`, page `frontend/src/pages/AcademyPage.tsx`, sidebar group "Learn"):
- `frontend/src/academy/` — `courses.ts` (4 tracks, lessons = EducationContent primers or module links,
  9 missions), `scoring.ts` (site, layout, diagnosis), `frt.ts` (PSE profile + seeded dips), `sequence.ts`
  (energisation order from the P5 programme), `random.ts` (seeded RNG).
- Missions: site selection and layout challenge grade the learner's own `siteStore` / `projectStore`
  (layout always with `DEFAULT_COSTS`); energisation sequence, FRT compliance and Digital Twin diagnosis
  (backend run, graded against `validation.rows`) are challenges; the four control-room drills open via
  `/?drill=<scenario>` (ScenarioCenter) and `trainingStore` records their score.
- `frontend/src/lib/layout/evaluate.ts` — one-shot layout evaluation shared with the layout canvas.
- `store/academyStore.ts` (`of.academy.v1`): learner, lessons opened, attempts; JSON export.
  Printable training record (`components/academy/TrainingRecord.tsx`, `.print-doc[data-printing]`).
- Tour `academy`; tests `tests/academy/`, `tests/store/academyStore.test.ts`, `tests/components/academy/`.
- Not done (optional in the spec): instructor mission assignment, glossary tooltips.
- Note: `utils/gridEvents.ts` `PSE_LVRT` (control-room voltage-dip drill) differs from the PSE profile in
  `services/p2/frt_simulation.py` (0 pu to 0.15 s, line to 0.85 pu at 2.5 s), which the Academy uses.

Original spec, kept for reference:

- Route `/academy`: course map Develop → Design → Build → Operate, built on the existing
  `EducationContent` schema (`frontend/src/types/education.ts`, `components/ui/EducationPanel.tsx`).
- Scored missions by generalising `frontend/src/training/scenarios.ts` and `store/trainingStore.ts`:
  site selection, layout challenge (AEP vs wake vs cable cost), FRT compliance (P4),
  Digital Twin diagnosis scored against the injected ground truth.
- Local progress (`of.academy.v1`) and a printable "training record" (same print CSS as
  `Documents.tsx`, `.print-doc[data-printing]`).
- Optional: instructor mode extends `store/instructorStore.ts` (assign missions, JSON report);
  glossary tooltips (Cp, EIA, FRT…).

## Phase 6 — Lifecycle

- Construction: installation vessels and weather windows (`backend/app/services/p1/weather_window.py`),
  foundation → turbine installation sequence, timeline.
- Hand-over: the user's project (projectStore) feeds Commissioning (P5), Control Room, SCADA and
  Digital Twin instead of the fixed SB-510 constants where practical.
- Decommissioning section (removal options, seabed restoration, cost), sourced.

## Lessons learned / gotchas

- Root `.gitignore` used to ignore every `site/` directory; it is now `/site/` (mkdocs output only).
- `uv lock` cannot reach the torch index in some sandboxes; if needed edit `uv.lock` by hand only
  for pure renames/reorders and say so in the PR.
- Tailwind v4 scans sources but respects `.gitignore` — untracked-but-ignored files lose classes.
- 3D viewer: the HDR environment map is optional (`SceneErrorBoundary optional`); a CDN failure must
  never crash the app.
- Leaflet controls on phones: keep panels collapsed by default and give overlays
  `pointer-events-none` with interactive children `pointer-events-auto`.
- e2e visual baselines were recorded on Windows: run `npm run e2e:update` locally after UI changes.
- SB-510 deliberately conflicts with the open data (27 of 34 turbines in Polish MSP basin PZP_15,
  Ławica Słupska Natura 2000 ≈ 3.2 km away); it is kept as a teaching example.

## Owner actions (outside the code)

- Rename the GitHub repository to `offshoreforge`; check the name for trademark conflicts.
- Run `npm run e2e:update` locally to accept the new visual baselines.
- Decide whether SB-510 should be relocated out of PZP_15 (currently kept as a teaching case).

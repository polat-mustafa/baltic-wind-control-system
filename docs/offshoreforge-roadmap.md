# OffshoreForge roadmap and hand-off

Working notes for continuing the OffshoreForge transformation in a new Claude Code session.
Read this first, then the CLAUDE.md rules. Six phases in total, all merged (phase 6: PR #223).

| Phase | Scope | Status |
|---|---|---|
| 1 | Rename to OffshoreForge, lifecycle sidebar, new README | Merged (PR #217) |
| 2 | Guided tour engine and per-page tours | Merged (PR #218) |
| 3a/3b | Open marine data package + site-assessment backend | Merged (PR #219) |
| 3c | `/develop` "build a farm from scratch" journey | Merged (PR #220) |
| 4 | Layout canvas: turbines, wake, AEP, array cables, cost | Merged (PR #221) |
| 5 | Academy: courses and scored missions | Merged (PR #222) |
| 6 | Lifecycle: construction, operation hand-over, decommissioning | Merged (PR #223) |

### Own-project programme (approved 2026-10-06, 13 phases, one PR each)

Full plan: `~/.claude/plans/max-effortta-plani-dusun-velvety-dawn.md` (owner's machine).

| Phase | Scope | Status |
|---|---|---|
| 1 | Screening follows Polish MSP law: wind only in energy ('E') basins, real projects = warn, whole-EEZ data pack | In review (`feat/site-msp-energy-basins`) |
| 2 | Site & Permits UX: legend, permit outlook banner, role avatars, data & sources panel, report states (stale / failed / retry) | In review (`feat/site-permits-ux`, stacked on phase 1) |
| 3 | IEA-15-240-RWT / IEA-22-280-RWT from the official IEA Wind Task 37 tables; P1 wake/AEP, layout canvas and frontend curves on the model registry; CF bug fixed | In review (`feat/turbine-iea-models`, stacked on phase 2) |
| 4 | Site wind climate from real data: NEWA mean + k at 150 m, ERA5 rose; assessment returns it, layout and PyWake use it | In review (`feat/site-wind-climate`, stacked on phase 3) |
| 5 | Project persistence: `wind_farm` = project table (JSONB document, revision lock, 12-month idle purge, read-only SB-510 row), `/api/v1/projects` + stored PyWake AEP history, anonymous link, auto-save with conflict / offline handling, export/import schema 2 | In review (`feat/project-persistence`, stacked on phase 4) |
| 6–13 | Post-tour choice + locks · FarmSpec/P2 · P5/P3/DT generalised · SB-510 → PZP_44 · Layout UX · report + windIO · provenance · pro items | Open |

Phase 1 note: `test_sb510_case_study` expects `msp_energy == "fail"` until phase 9 moves SB-510 into PZP_44.
Phase 2 note: the permit outlook says a refused site "could not go on to layout" but Layout is not locked yet — the hard lock comes with phase 6.
Phase 3 notes:
- Official tables (tags IEA-15 v1.1.18, IEA-22 v1.1.0) give D 241.35 m and rated 10.66 m/s for the IEA 15 MW — not the 240 m / 10.59 m/s of the 2020 report text; curve and parameters are taken from the same table. Regenerate with `cd backend && python scripts/fetch_turbine_curves.py`.
- P4, the digital twin (`digital_twin/legacy_v236_table.py`), turbine physics (`state_machine` cut-out comes from the caller's spec) and P3 historian keep the legacy V236 curve (3 / 11.1 / 31 m/s) until phase 12.
- Educational texts that quote the Vestas V236 catalogue (part cards, library `turbineSelection`, P4 academy) are left for phase 12 (provenance pass).
- SB-510 with the IEA 15 MW: gross 2534 GWh/yr, wake 7.0 %, net P50 2126 GWh/yr, CF 0.476 (A 10.5 m/s, k 2.2).
Phase 4 notes:
- `scripts/fetch_wind_climate.py` (rate-limited services: sequential NEWA calls, Open-Meteo 429 back-off, on-disk cache in the temp dir). NEWA is **CC BY-NC 4.0**: fine for this free, non-commercial project; a commercial fork must replace `wind_climate`. NEWA `wind_speed_std` is a long-term statistic (moment fit gives k ≈ 4.5), so k comes from the microscale atlas.
- SB-510: mean 9.38 m/s, A 10.58 m/s, k 2.04 at 150 m; rose peaks at 270° (18.7 %) and 240° (14.1 %). Regular 34-turbine grid: gross 2506 GWh/yr (−1.1 % vs the old synthetic climate), wake 7.0 %.
- `/layers` does not send the wind/bathymetry rasters to the browser yet (planned with phase 10's per-turbine depth); the P1 page still runs on its synthetic climate (phase 7 FarmSpec).

Phase 5 notes:
- The project document (`frontend/src/lib/project/document.ts` ↔ `backend/app/schemas/project.py`) is built from the three existing stores (site, layout, lifecycle) instead of merging them into one store; their localStorage keys stay, so no migration is needed. Keep the two schemas in step.
- The project id (uuid4) is the only key: no listing endpoint, no account. Retention purge runs at startup and on every create. Limits: 512 KB body, ≤150 turbines, per-IP counters in the router (single uvicorn worker) + nginx `limit_req` on `/api/v1/projects`.
- `POST /projects/{id}/aep` runs PyWake on the saved layout; without wind inputs it uses the region-pack climate at the turbines. P-values = P1 loss cascade (blockage 0, not modelled there). The last 20 runs are kept; per-turbine rows survive moves (positions upserted by turbine id).
- Deferred: `wind_resource` (hourly ERA5 per project) has no consumer yet — fill it when P4 / the report needs it. `mode: reference | own` and the project menu come with phase 6; the "Save online" control sits in the Layout header until then. The document always carries the default turbine model (no model picker yet).
- SB-510 layout, site climate, server run: gross 2507 GWh/yr, wake 5.7 %, net 2364 GWh/yr, P50 2179 / P90 1986 GWh/yr.

## Resume here

1. `git fetch origin && git checkout main && git pull`; all six phases are merged (last: PR #223).
2. Next: the **own-project programme** above, phase by phase.
3. Owner to-dos: `cd frontend && npm run e2e:update` (new `layout`, `site-permits`, `academy`, `construction`,
   `handover` and `decommissioning` baselines), rename the GitHub repo to `offshoreforge`, trademark check.

## Open optional items (parked by the owner, do not start without asking)

- Phase 5: instructor mode — extend `store/instructorStore.ts` to assign Academy missions and export a
  JSON class report.
- Phase 5: glossary tooltips (Cp, EIA, FRT, …) on the Academy and module pages.
- Phase 4: IEA-15-240-RWT as a second turbine model, curves from the official IEA Wind Task 37 repository
  (`IEAWindTask37/IEA-15-240-RWT`), source in `docs/references.md`.
- Phase 4: hand the layout project to the P1 / P2 pages (they still use the fixed SB-510 constants).

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
- Not done (optional in the spec, parked — see "Open optional items"): instructor mission assignment, glossary tooltips.
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

## Phase 6 — Lifecycle (implemented)

Delivered (sidebar: "Construction" and "Hand-over" under Build & Commission, new group "Decommission"):
- Backend `backend/app/services/lifecycle/` — `weather.py` (6-hourly synthetic sea states: Rayleigh Hs and
  Weibull k = 2 wind around the monthly means of `services/p1/weather_window.py`, AR(1) persistence,
  wind–wave correlation; hub-height wind with the IEC 61400-3-1 power law) and `campaign.py`
  (weather-restricted operations after DNV-ST-N001 with OP_WF = α · OP_LIM, vessel scheduling with unit
  gates, just-in-time array cable vessel, charter and mobilisations; install and remove plans).
  `POST /api/v1/lifecycle/campaign` (router `routers/lifecycle.py`) → P10/P50/P90 milestones, median-run
  timeline, WoW, monthly window probabilities, vessel cost. Tests `backend/tests/test_lifecycle.py`.
- `/build` — Construction page: farm source, start date / α / runs / vessel limits, timeline, milestones,
  weather-window heat map, vessel table.
- `/build/handover` — Hand-over: as-built register (printable TRAINING SPECIMEN, CSV / JSON), energisation
  order per OSS feeder bay, what each operation module takes over. `lib/lifecycle/farm.ts` turns the layout
  project (or SB-510, keeping its own string numbers) into the register and the campaign request.
  Practical feeds: Control Room map layer "My Project (hand-over)" (`components/landing/MyProjectLayer.tsx`,
  `layerStore.myProject`); notes on Commissioning and Digital Twin. The live simulators (Control Room
  physics, SCADA IEC 61850 model, Digital Twin reference model) stay calibrated on SB-510 — the page says so.
- `/decommission` — removal options (cut / full foundations, cables and scour rock left or recovered),
  removal campaign, material inventory and end-of-life cost (`lib/lifecycle/decommissioning.ts`, masses and
  unit costs *illustrative*), legal frame checked against the primary texts (UNCLOS Art. 60(3), IMO
  A.672(16) §3.1–3.2, 3.6), seabed restoration steps, sources.
- Store `store/lifecycleStore.ts` (`of.lifecycle.v1`, inputs only). Tours `construction`, `handover`,
  `decommissioning` (tour stage "Decommission"); Academy lessons in the Build and Operate tracks.
  Frontend tests `tests/lib/lifecycle.test.ts`, `tests/store/lifecycleStore.test.ts`,
  `tests/components/lifecycle/` (fixtures from the real API in `tests/fixtures/campaign-*.json`).

Original spec, kept for reference:

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

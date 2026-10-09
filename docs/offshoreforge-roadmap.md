# OffshoreForge roadmap and hand-off

Working notes for continuing the OffshoreForge transformation in a new Claude Code session.
Read this first, then the CLAUDE.md rules. The first six phases are merged (phase 6: PR #223); the own-project
programme below is a stack of PRs, one per phase.

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
| 6 | Post-tour choice (SB-510 reference / own project), stage locks in the sidebar + one AppShell guard with "See it in SB-510", header project menu (name, online copy, new, open by link, import / export), lifecycle milestones | In review (`feat/project-mode-locks`, stacked on phase 5) |
| 7 | `FarmSpec` + `design()` (golden: SB-510 back exactly), P2 load flow / SC / STATCOM / N-1 / FRT / GFL-GFM / PPC / power quality / planning / ANDES on the farm spec, `X-Farm` header from the own layout, design-freeze gate before Construction | In review (`feat/farm-spec-p2`, stacked on phase 6) |
| 8a | P5 on the farm spec: circuit-1 switchgear, isolation locks, 60-step switching programme, load-flow checks, FAT/SAT limits; programme keeps its farm (`farm_spec` column) | In review (`feat/farm-spec-p5`, stacked on phase 7) |
| 8b | P3 SCADA + Digital Twin on the farm spec: bay controllers per string, historian, CMS, IEC 61850 / SCL, OPC UA tree, OT network, security zones; twin on the farm's turbines and site wind | In review (`feat/farm-spec-p3`, stacked on 8a) |
| 8c | Live control room on the own farm: one live fleet for the map, 3D, mimic, single-line diagram, bay controllers, alarms, drills and plant physics; live load flow with reactor switching | In review (`feat/farm-spec-control-room`, stacked on 8b) |
| 9 | SB-510 moves into MSP energy basin PZP_44 (site 44.E.1): new layout, OSS, LIDAR, boundary, marks, 76.5 km export round Ławica Słupska, P2 redesigned by `design()` (3 × 170 MVAr), reactor switching in every operating-point study, "From SB-510" project start | In review (`feat/sb510-pzp44`, stacked on 8c) |
| 10 | Layout UX: turbine glyphs by status (+ outside the energy basins), IDs from zoom 12, OSS platform icon, on-map legend; turbine card (net AEP, wake loss, free/waked wind, 2 nearest, depth → foundation, warnings) live while dragging; live checklist; move suggestions checked by PyWake (`/wind/wake-moves`); per-turbine depth (`/site/raster`); info buttons | In review (PR #237, `feat/layout-ux`, stacked on 9) |
| 11 | Project report `/report` (site checks + sources, permit outlook, SVG mini map, energy: screening + PyWake, per-turbine table, AEP history; PyWake-checked moves; electrical design + full-load load flow; cost / LCOE; construction P50 / P90; data sources + "re-verify" note), print → PDF, JSON download; `GET /projects/{id}/windio.yaml` (windIO 2.x) + `.offshoreforge.json` sidecar | In review (PR #238, `feat/project-report`, stacked on 10) |
| 12 | Provenance: `SourceBadge` (official / measured / literature / approximation / illustrative); Layout cost inputs, P1 loss cascade and report carry their source; cost defaults from NREL Cost of Wind Energy Review 2024 + ORBIT cable library (2023 USD → €), export priced per circuit; 66 kV cable capacitance from the ABB/NKT datasheet; datasheet cable ratings (current-based grading, 4 × 120 MVAr reactors at both export cable ends); every module on the IEA 15 MW (owner-approved): P4, Digital Twin, turbine physics (ROSCO controller), P3 historian/OPC UA/CMS, nacelle subsystems and the 3D model as a low-speed direct drive | In review (PR #239, `feat/provenance`, stacked on 11) |
| 13 | Pro items: region from the backend's pack, seabed substrate (EMODnet Geology) in screening / layout / cost, offshore wind ports with sea-route distances (construction trips, O&M CTV transit), choosable PSE grid node, export route check (drawn or automatic, length = export), cluster wakes from neighbouring farms (TurbOPark), sourced AEP uncertainty components and P50 / P75 / P90 | In review (PR #240, `feat/pro-items`, stacked on 12) |

Phase 1 note: `test_sb510_case_study` expected `msp_energy == "fail"` until phase 9 moved SB-510 into PZP_44; it now passes every blocker (owf = warn: allocated, natura2000 = warn: 2 km).
Phase 2 note: the permit outlook says a refused site "could not go on to layout"; since phase 6 Layout stays locked for such a site in an own project.
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

Phase 6 notes:
- `store/modeStore.ts` (`of.mode.v1`: `reference | own | null`). `ProjectChooser` opens when no mode is set and neither the welcome nor a tour is showing; opening a saved project (link or ID) switches to `own`. e2e writes `reference`.
- `lib/project/progress.ts`: `locks(input)` is the pure rule chain (each module also needs the one before it); `useLocks()` feeds the sidebar (lock icon, "(locked)" label, tooltip) and the AppShell guard (`LockedPage` instead of the route, "See it in SB-510" = reference mode). No locks in reference mode or while a tour runs, so tours keep working. Always open: Control Room, Site & Permits, Turbine Physics, Academy. In own mode AppShell loads the constraint layers and the site assessment the rules need.
- Rules: Wind Resource ← site; Layout ← permit stage done and outcome ≠ refused; Grid ← ≥ 1 turbine, OSS, no turbine outside the site / in a constraint area / < 4 D (`layoutProblems()` in `lib/layout/evaluate.ts`, shared with `evaluateLayout`); Construction ← Grid; Commissioning / Hand-over / operation + decommissioning ← lifecycle milestones `build` / `commissioning` / `handover` (`lifecycleStore.done`, in the project document's opaque `lifecycle` object, so no backend change). `StageDone` marks them: construction needs a fresh campaign for the own layout, commissioning a switching programme with status completed, hand-over an own layout.
- Deferred: the design-freeze gate before Construction (full-load load flow 0.95–1.05 pu, ≤ 100 % loading) needs P2 on the project — phase 7. "Copy SB-510 into my project" waits for phase 9: today the SB-510 site fails `msp_energy`, so a copy would stop at a refused permit. Reference mode does not swap the Site / Layout stores to SB-510 (they keep the learner's sketch; Layout has "Load SB-510 layout").
- The Layout header lost Save online / Export / Import — they live in the header project menu now.

Phase 7 notes:
- `services/p2/network_model.py`: `FarmSpec` (strings, export length + circuits, transformer units, STATCOM, reactors) and `design()`; the SB-510 constants stay as the defaults and `SB510` is built from them. Rules (module docstring): circuits ⌈P / P_circuit(L)⌉ with the charging current shared by both ends; transformer units ≤ 90 % at P_max, 50 MVA steps; STATCOM 120 MVAR per 510 MW but ≥ 1.15·Q/(2n+1); reactors N+1, unit ⌈(Q − S/1.15)/n⌉₁₀. `statcom_sizing.check_reactors()` then raises the unit in 10 MVAR steps until the reactor-N-1 load flow keeps the STATCOM off its limit (needed for short single-circuit exports: dQ/dV, not the Q balance, sets the duty). > 4 circuits → 422 "needs HVDC".
- Golden test `tests/test_farm_spec.py`: `design(SB-510 @ 45 km) == SB510` (2 circuits, 2 × 300 MVA, 3 × 80 MVAR, ±120 MVAR). Physics checked: 540 MW / 75 km → 2 circuits, Q 433 MVAR, 3 × 170 MVAR, full load 0.976–0.989 p.u., 96 %; 1080 MW / 45 km → 4 circuits, 2 × 600 MVA (IEC 60909: 38.5 kA at 66 kV exceeds the switchgear — a real finding, shown on the page); 120 MW / 73 km → STATCOM bound ±90 MVAR, 2 × 140 MVAR, 0.995–1.007 p.u.
- `routers/farm_spec.py`: `X-Farm` header (URL-encoded JSON: name, strings, mean array section km, export km; ≤ 6 turbines per string, ≤ 150) → `design()` + `check_reactors()`; no header = SB-510. Nothing is stored, so browser-only projects work. Chosen over the plan's `X-Project-Id` for that reason.
- Frontend: `lib/project/farmHeader.ts` adds the header to every `/api/v1/grid` request in own mode (`apiClient.setRequestHeaders`); `gridStore` keys results to the farm (`farmFor`) and offers `useNetwork()`; P2 panels (SLD, loading, voltage, STATCOM, converter, harmonics, N-1, planning, P2X, ANDES, PPC) read it. Protection, BESS, Cable DTS (burial zones follow SB-510's real route) and Market stay SB-510 and the page says so; live load flow (Control Room) stays SB-510.
- Design freeze: milestone `design` (lifecycleStore) marked on the HV Grid page once the full-load load flow of the own farm is within 0.95–1.05 p.u. and every branch ≤ 100 %; it opens Construction (`lib/project/progress.ts`).
- Changed test: `test_statcom.py::test_reactor_n1_detects_insecure_design` monkeypatched a module constant; it now passes a 2-reactor `FarmSpec`. All other existing P2 tests pass unchanged.

Phase 8a notes:
- `services/p5/equipment_state.py`: `equipment(spec)` builds the circuit-1 registry — strings of section A (1…⌈n/2⌉) with WTG groups, section B strings earthed, IDs `CB-STR-nn`; no reactor bay when the design has no reactors. Every interlock function takes `spec` (default SB-510, so the SB-510 registry, the 60 steps and all existing P5 tests are unchanged).
- `energisation.network_snapshot(state, spec)`: cable length, transformer / reactor / STATCOM ratings and strings from the spec. Two physics additions found by running every Phase 7 farm through the programme: (1) a long cable lifts the onshore busbar (75 km open-ended: 230 Mvar, 1.054 p.u.), so the onshore OLTC is pre-set (`onshore_tap`, first tap that keeps the busbar and cable end in 0.95–1.05 p.u.; SB-510: tap 0); (2) when no tap is enough (120 MW / 73 km on 2 × 100 MVA onshore transformers) reactor 1 is connected to the dead cable and energised with it (`reactor_energisation`, steps reordered). 3–4 circuit farms: section A exceeds one circuit, so the PPC limits circuit 1 to 90 % of its capability (`circuit1_limit_mw`; 1080 MW: 321 MW, cable 94 %).
- Transformer no-load losses now scale with the rating (`FarmSpec.oss_pfe_kw` / `onshore_pfe_kw`, SB-510 unchanged); before, a 100 MVA unit had the 300 MVA unit's 60 kW.
- `switching_programme`: `_defs(spec)`, `phases(spec)`, checks get the spec (STATCOM range, TX i0, rated text); the programme stores its `FarmSpec` (`switching_programme.farm_spec` JSONB, Alembic `d9e0f1a2b3c4`; NULL = SB-510). Create programme / FAT take the `X-Farm` header; later calls use the stored farm. FAT transformer limits follow the rating, SAT the cable length and strings.
- Frontend: `X-Farm` also goes to `/api/v1/commissioning`; `CircuitSLD` draws the programme's farm (wider for > 3 strings on section A); the new-programme text uses `useNetwork()`. `SB510_EXPORT_KM` / `SB510_DEPTH_M` moved from `lib/lifecycle/farm.ts` to `constants/windFarmLayout.ts` (the SB-510 data file phase 9 rewrites).
- Checked farms (whole programme to COMPLETED): SB-510, 540/75, 1080/45, 300/30, 120/73, 60/20, a no-reactor design. Not changed: protection relay settings (P2 Protection tab, SB-510), the Academy (its missions already use the own site/layout; the sequence drill teaches the SB-510 order).
- P5 had no API tests; `tests/test_farm_spec_p5.py` runs the router on in-memory SQLite (JSONB compiled as JSON).

Phase 8b notes:
- `bay_controller.bay_definitions(spec)`: feeder bays 01…n (one per string), incomer A n+1, coupler n+2, incomer B n+3 (SB-510: 07/08/09 unchanged). State is one switchboard per farm (`OrderedDict` LRU of 32, keyed by `FarmSpec`; `# ponytail:` note). All bay functions take `spec`.
- `X-Farm` now also goes to `/api/v1/scada` and `/api/v1/digital-twin` and may carry the site's hub-height Weibull (`wind_a`, `wind_k`, `routers.farm_spec.farm_wind`). Historian (capacity, cable charging ωCV²L of the design, reactors, STATCOM, string 1, export circuits), CMS (turbine count), IEC 61850 devices / SCL (bays, 220 kV export and reactor bays), OPC UA REST tree, OT network (first/central/last IED, fibre 5 µs/km × export km), security zone counts follow the farm. The asyncua server itself stays SB-510.
- Digital Twin: `run_digital_twin(..., n_turbines, weibull)`; scenarios are spread over a small farm (`plant_simulator.scenario_for`, 8 SB-510 fault turbines → distinct own turbines); the detector keeps its phase-one calibration on the SB-510 fleet (limits per wind bin, same turbine model). A lone turbine has no neighbour reference (anemometer channel not cross-checked).
- Not moved in 8b (done in 8c): the live control room.
- `useFarmPlan` now follows the mode (reference → SB-510), the same rule as the header; before, reference mode showed the own layout on the lifecycle pages.
- Known, pre-existing: Plotly `_plots` page error when switching SCADA tabs quickly (also on the code before this phase).

Phase 8c notes:
- `lib/fleet.ts` is the live plant: turbines (own: `WTG-01…` in register order, the backend's names), cable tree (`upstream`, `arraySegments` — radial strings or branched trees), strings, busbar sections (`section_a_strings`), OSS, grid node, site boundary and the backend's `NetworkSpec`. `hooks/useLiveFleet` (app shell) sets it: SB-510, or the own project once `/grid/network-spec` answered (until then, or on an HVDC-length refusal, the previous fleet stays). The landing, SCADA and live-grid stores reset when it changes.
- Fleet-driven: landing simulation and KPIs, map (turbines, cables, fibre, wakes, safety zones, crews, OSS, site boundary; own export drawn straight to the site report's grid node), 3D farm / cables / schematic, mimic (`mimicLayout(strings)`), SLD (`utils/scadaTopology`: n feeders, n export circuits, bays numbered like the backend), GOOSE scenario texts, permits list, instructor and drills (`injectRandomArrayFault` on any inner section; fault passage indicators on the path to the OSS, `litIds`), `landingPhysics.plantNet()` (charging, reactors, STATCOM, transformers, export length). `X-Farm` now also goes to `/scada/bays` and `/interlocks`.
- SB-510-only map features stay hidden for an own farm: surveyed export route, landfall, onshore yard / PSE line, LIDAR, navigation marks, O&M vessels, DTS. The "My Project" preview layer is gone (the fleet is the project).
- Backend: `POST /grid/live-load-flow` takes the farm (`wtg_p_mw` 1…150, length = turbines of the spec) and switches reactors like an operator (`_dispatch_with_reactor_switching`: out while the STATCOM injects > ½ rating and it helps; returns `reactors_in_service`). Before, all N+1 reactors stayed in and long single-circuit designs pinned the STATCOM at +rating (120 MW/73 km: +90/±90, V_OSS 0.98) — now −50…−38 MVAr, V_OSS 1.004–1.006. SB-510 unchanged (3/3 in, ≤ +56 MVAr). The browser estimate uses the same rule (threshold ½ rating; SB-510: 60 MVAr as before).

Phase 9 notes:
- Geometry (`constants/windFarmLayout.ts`, checked with the region pack): 34 turbines in N–S strings, 8D (1.93 km) apart along the 270° prevailing wind, 6D along a string, each string following the basin's slanted south edge; ≥ 0.57 km inside PZP_44, 37–51 m (jackets), Natura 2000 Ławica Słupska ≥ 2.5 km. Site = PZP_44 between 16.42 and 16.63 °E (112.9 km²; the basin's east tip by SwePol stays out). OSS at the south-west corner, LIDAR 3 km west. Export: OSS → round the west end of Ławica Słupska (≥ 1.2 km) → across PZP_15 at right angles → landfall Zaleskie → onshore SS: 63.3 + 13.4 km drawn, 76.5 km in the model. Bathymetry contours re-drawn from the pack's EMODnet grid.
- P2: `SB510 == design(STRING_LAYOUT, 76.5)` (golden test keeps the 45 km design too): 2 circuits, 2 × 300 / 2 × 300 MVA, ±120 MVAr, 3 × 170 MVAr, Q_cable 442 MVAr, Ferranti 2.1 %, uncompensated rise 15 %. All three reactors in would over-compensate, so `load_flow.dispatch_with_reactor_switching` (phase 8c, live map) now also runs in the Grid tab load flow and N-1: the spare is out, STATCOM −48 … +9 MVAr, export 87 % loaded at 510 MW, losses 8.6 MW. N-1 export trip: 162 % → runback to 321 MW. IEC 60909 at OSS 66 kV: 20.5 / 13.3 kA. Resonance moved from h17 to h19 (0.87 % = 80 % of the planning level). P5: onshore OLTC pre-set 3 steps. Cable DTS: HDD 62.7–63.5 km, 765 points.
- The landing estimate (`reactiveBalance`, POC Q = 0 by construction) keeps 3/3 reactors at no load (+68 MVAr) where pandapower holds the OSS voltage with 2/3 (−48 MVAr, +72 MVAr to PSE); the STATCOM panel therefore shows the load flow's reactors, STATCOM and POC Q when it answers.
- `docs`, README, CLAUDE.md, education texts and SOURCES.md follow; a vitest guard keeps "45 km / 260 MVA / 3 × 80" out of `src`.
- Pre-existing, not from this phase: `test_farm_spec_p3::test_bays_api_uses_the_header` needs the Postgres DB (SOE log) and xgboost DLLs are blocked by Windows Application Control on this machine.

Phase 10 notes:
- `lib/layout/energy.ts`: `prepareYield()` keeps the summed squared deficits per (sector, speed bin, turbine); `moveDelta()` swaps one turbine's contributions in O(N) per case (2.7 ms for SB-510 vs 25 ms full) — exact for the screening model (vitest compares with a full recompute). `layoutYield()` = `yieldOf(prepareYield())`, unchanged numbers.
- `lib/layout/evaluate.ts`: `layoutContext` + `statusAt` (one rule for the canvas, the card and the suggestions: outside > excluded > basin > close), `rasterSampler` (bilinear, same as the backend `Raster.sample`), `foundationFor`, `nearest`, `turbineStats`. Backend `GET /api/v1/site/raster?role=bathymetry&bbox=…` clips a raster (≤ 40 000 cells); `/layers` still sends no rasters.
- Drag: the marker publishes its position once per animation frame (`useDrag` in `layout-canvas/shared.ts`); only the card re-renders; the layout commits on drag end.
- `lib/layout/suggest.ts`: 10 most waked turbines × 8 directions × {½, 1, 2} D, allowed positions only (site, constraints, energy basin, ≥ 4 D, subsea-cable buffer from the criteria, own cables not crossing), score ΔLCOE with the turbine's own cable segments (strings unchanged — re-routing the whole Esau–Williams tree per candidate added heuristic jumps of up to −7 km for a 480 m move). Backend `POST /api/v1/wind/wake-moves` re-runs the top five with PyWake; the UI lists PyWake-confirmed moves first.
- Finding: on SB-510 PyWake finds at most +0.05 % per single move (1 D north; 28 of 133 tried moves gain). The screening model's along-wind gains (+0.13…+0.22 %) are not confirmed (PyWake −0.07 %): below its accuracy, and not from the superposition (linear sum gives the same sign) but from PyWake's turbulence-dependent recovery (STF2017) that a fixed k* cannot follow. Pure rows agree (3 turbines, 5 D: −0.83 vs −0.86 %). The panel says so when PyWake confirms none. Follow-up (phase 12/13): local-TI k* in the screening model.
- e2e: the Layout baselines change (legend, card, checklist, suggestions) — `npm run e2e:update` locally.

Phase 11 notes:
- `lib/project/report.ts`: `buildReport(input)` is pure and returns one plain object (units in the key names, `schema: offshoreforge-report/1`); the page renders it and "JSON" downloads it unchanged. `prepare()` (projection, site wind, screening yield, cable tree) is shared with `findMoves()`, which runs the Layout page's `suggestMoves` and the `/wind/wake-moves` PyWake check. Own mode reports the stores (site, layout, lifecycle); reference mode reports SB-510 (constants + its own `/site/assess` call) — the same rule as `useFarmPlan` / the `X-Farm` header, so grid and construction describe the same farm.
- The page is a white "paper" document in both themes (like the Site & Permits documents) and prints with the existing `.print-doc[data-printing]` rule; run buttons (PyWake, moves, load flow, campaign) are hidden in print. Wide tables scroll inside their box at 390 px.
- `services/p1/windio.py`: windIO 2.x `wind_energy_system` checked against the official schemas (IEAWindSystems/windIO `schemas/plant`): site boundary (or the layout's bounding box + 1 D), Weibull A / k per sector + sector probability + TI 0.06, layout with `turbine_identifiers`, turbine (power W, Ct, cut-in/rated/cut-out), OSS as `electrical_substations`, attributes (PyWake, Bastankhah2014 with k = 0.004 + 0.38·TI, STF2017, linear sum). Coordinates are metres about the turbine centroid, the same equirectangular projection as the canvas, with `crs` = the exact PROJ `eqc` string (R = 111 320 m·180/π). No YAML anchors, number lists inline. The reference row has no document → 422. The page downloads the YAML and the project document as `<name>.offshoreforge.json` (costs, permit stage, lifecycle: not windIO).
- `pyyaml` is now a direct dependency (it was transitive); `uv.lock` gets only the two pyyaml lines (a local `uv lock` re-wrote unrelated markers, so it was edited by hand and `uv lock --check` passes).
- SB-510 (reference, site climate A 10.8 m/s, k 2.04 at 150 m): screening net 2452 GWh/yr (wake 4.2 %), PyWake gross 2560 / net 2407 GWh/yr (wake 6.0 %, CF 0.539 wake only), 2214 GWh/yr after 8 % other losses; CAPEX 1633 M€ (3.20 M€/MW), LCOE 75 €/MWh (illustrative costs); full load 0.998–1.005 p.u., export 87 %, losses 8.63 MW, POC −14.7 MVAr; campaign P50 / P90 167 / 201 days. The Layout page's Esau–Williams routing gives SB-510 8 strings / 83.7 km where the electrical design uses 6-6-6-6-5-5 — the report labels both.
- e2e: new `report` route in `e2e/pages.spec.ts` → new baselines (`npm run e2e:update` locally).

Phase 12 notes:
- `components/ui/SourceBadge.tsx`: `Provenance {source, license?, retrieved?, quality, note?}`, `Sourced = Provenance & {value, unit}`; a native `<details>` (click / tap / keyboard, no hover) so it works at 390 px.
- Costs (`lib/layout/cost.ts` `COST_DEFAULTS` → `DEFAULT_COSTS`, `COST_LABELS`): NREL/PR-5000-91775 fixed-bottom reference (turbine 1 770, substructure + scour 789, OSS 243, installation + development + lease + soft costs 2 132 $/kW; OpEx 135 $/kW-yr; 25 yr) and ORBIT v1.3 cables (66 kV 630 mm² 650 000 $/km, 220 kV 1000 mm² 1 500 902 $/km per circuit, supply only), ÷ 1.0813 $/€ (ECB 2023). Jacket (+25 % over monopile) and WACC 6 % are labelled illustrative. The export line is now `km × circuits` with the backend `design()` rule (`exportCircuits`, SB-510 → 2); the key was renamed `exportCircuitMEURperKm` so old saved projects take the new default instead of a per-route value. The lease line is the U.S. auction price — a Polish project would replace it.
- SB-510 (reference, screening): CAPEX 2 680 M€ (5.26 M€/MW with jackets), LCOE 121 €/MWh (was 1 633 M€, 75 €/MWh with the illustrative set); NREL's own reference is 117 $/MWh ≈ 108 €/MWh at a 6.76 % real FCR vs our 7.82 % CRF. Academy `LCOE_RANGE` scaled by the same ratio to [132, 115] €/MWh so scores are unchanged. Farm Comparison defaults 5.0 M€/MW / 125 k€/MW·yr (`schemas/farm_config.py`, store, hints; base export 45 → 76.5 km, far-shore 80 → 110 km); the LCOE worked example now gives 121.8 €/MWh (IRR ≈ 0 % at 72 €/MWh).
- Losses (`aep_calculator.LOSS_SOURCES`, P1 `/aep-cascade` → `quality` + `source` per step, badges under the waterfall): values unchanged (electrical 2 %, availability 5 %, environmental 1 %), all "approximation"; Beiter et al. 2016 use 2 % for the environmental/other group. An overridden loss becomes "illustrative · Your input". Layout/report `OTHER_LOSSES` = the same three multiplied (7.83 % instead of a flat 8 %).
- Cables (`network_model.py` provenance note): R = IEC 60228 (official); C, X from ABB 2GM5007 rev 5 (NKT) Tables 45/49 — the 66 kV capacitances were 200 / 215 / 230 nF/km, the datasheet says 290 / 320 / 350 (test `test_cable_c_and_x_match_the_datasheet`).
- Cable ratings (commit 3721d14, owner asked for the real values): the datasheet IEC 60287 ratings 655 / 715 / 775 / 825 A (500 / 630 / 800 / 1000 mm², 66 kV) and 825 A (220 kV) replace the old +9–16 % values; IEC 60287-1-1 ac factor; grading by string current (`_get_cable_grade`, `string_current_ka`) — six 15 MW turbines need the 1000 mm² section at the OSS end. With 825 A per export circuit one reactor per circuit would load the cable to 100.3 %, so `design()` splits the compensation: 2n reactors, one per circuit at each cable end, u = ⌈(Q − S/1.15)/(2n − 1)⌉₁₀ → SB-510 4 × 120 MVAr (2 onshore, 2 at the OSS), STATCOM ≥ 1.15·Q/(4n − 1). Result: export loading 92 %, losses 8.38 MW, buses 0.990–1.007 p.u., N-1 runback 289 MW, IEC 60909 at the OSS 66 kV 20.4 / 13.2 kA, harmonic resonances 130 / 725 / 960 Hz (h19 above the planning level — a filter is a design follow-up). P5: onshore line reactor bay (`CB-SR-ON-01`), 63-step programme with the STATCOM switched in before the OSS reactor (a weak busbar gave 0.925 p.u. the other way round). Cable DTS recalibrated to 825 A at 20 °C seabed (alarm 80 °C).
- IEA 15 MW everywhere (owner-approved, direct drive chosen over a geared "V236-like" drivetrain because the reference turbine publishes it):
  - `p1/turbine_models.py`: the tabular operating points (pitch, rpm, Cp, thrust, torque), drivetrain/masses, `rosco()` = ROSCO Cp/Ct/Cq table (`RotorSurface`, bilinear, WISDEM line beyond λ 14.5) + DISCON controller + ElastoDyn drivetrain (`RotorControl`); `scripts/fetch_turbine_curves.py` writes `IEA-15-240-RWT_rosco.json`. `legacy_v236_table.py` deleted.
  - P4: power curve = the official table at v·(ρ/ρ₀)^⅓ (IEC 61400-12-1). Synthetic SCADA rebuilt: the old AR(1) filter on Weibull samples shrank the variance — now a Gaussian copula on the site Weibull (NEWA 10.80 / 2.04) with the ERA5 hourly persistence φ = 0.957 (lags 1–24 h → 0.9927 per 10 min), direction from the ERA5 rose, a persistent per-turbine offset and the 10-min sampling error (Λ₁ = 42 m, TI 0.06). On realistic data XGBoost lost to persistence (skill −1.9 / −0.14); it now learns the residual on persistence (`base_margin`), early-stops on the last 20 % of each fold and is scored against persistence on the same samples → skill +2.3 %.
  - Digital Twin: ROSCO surface with the minimum-pitch schedule, λ = 9, rated 7.518 rpm (95 m/s tip), generator 96.55 % × converter 99.18 %, k_aero 0.984 (closes the 1.6 % CCBlade vs WISDEM gap); max |ΔP| vs the official table 54 kW; gearbox → generator-loss fault (IEC 60034 / IEEE 43), stator-winding thermal model (10 K + 0.125 K/kW, τ 1.5 h, illustrative), thermal transients excluded for 2τ → false events 37 → 1.
  - Turbine physics: J = 3.543 × 10⁸ kg·m²; ROSCO generator-torque PI (TSR tracking, VS_KP/KI, rated torque 19.79 MN·m, 4.5 MN·m/s), gain-scheduled pitch PI (2 °/s, PS schedule), 2nd-order speed filter, setpoint smoother (checked against the ROSCO v2.10.1 Fortran), converter power cap for Rule 1; no artificial speed clamp; overspeed trip 9.07 rpm; yaw 0.5 °/s / 8°. Steady states land on the table (region 2 +1.7 % power from the CCBlade surface, rpm exact, pitch ±0.5°); IEC EOG at 12 m/s peaks 8.32 rpm. Simplifications (documented): perfect wind-speed estimate instead of ROSCO's EKF; beyond the 30° table edge a feathering blade only brakes; API dt ≤ 1 s (explicit Euler). The UI step default is 8 → 14 m/s in 30 s (peak 8.44 rpm) — the old 10 s ramp overshoots to 9.11 rpm, past the trip.
  - P3 / nacelle: historian and OPC UA on the official curve/rpm; CMS components MAIN_BEARING / REAR_BEARING / GENERATOR (f_e 12.6 Hz, 2·f_e, slot pass) / PITCH / YAW, oil analysis = pitch HPU ISO VG 46; MAD alarm `WTG.COOLANT_FLOW_LOW` replaces the gear-oil alarm (backend and HMI catalogue match); cooling = generator 540 kW + converter 124 kW, winding 92.6 °C at rated / 15 °C, alarm 130 / trip 155 °C (IEC 60085); HPU, UPS, cable-twist and coolant values stay labelled illustrative.
  - 3D + frontend: Blender model rev 5 (`MODEL_REV = 5`): overhang 11.35 m, 2.2 m hollow shaft on TDO + SRB bearings, 200-magnet outer rotor at r 5.08 m around the bearings, stator on the turret, turret flange 5 m upwind of the tower axis (report Table 5-3), shortened nacelle; drawn blades scaled ×1.023 to the 241.35 m rotor. Power chain, thermal model, sensors, health badges, power flow, schematic sheets M-01 / P-01, Cp–λ widget (official ROSCO table via `/cp-surface`), part education (gearbox and coupling removed, coolant skid added), annotations and labels follow.
- Site Weibull everywhere (commit 8dad61d): `wind_climate.SB510_WEIBULL_A/K/MEAN_MS` (10.80 m/s / 2.04 / 9.57 m/s, NEWA 150 m) are the default of every P1 router form, `farm_config` / `forecast` schemas, the P1 services and P2 planning; frontend `constants/sb510Wind.ts` (layout evaluator, Wind Resource and Farm Comparison stores, report fallback). `test_sb510_defaults_match_the_site_pack` keeps both equal to the pack. Worked examples recomputed: gross 2556.6 GWh/yr, wake 6.47 %, blockage 1.95 %, P50 2161 / P90 1970 GWh/yr (CF 48.4 %), LCOE 120.2 €/MWh.
- Harmonic filter: damped 2nd-order high-pass at OSS 66 kV (`FarmSpec.harmonic_filter_mvar/_tuned_order`, `power_quality.size_harmonic_filter`, called by `design()`): tune one order below the worst order, smallest size 2–10 Mvar with every order ≤ 50 % of the planning level at the POC / 220 / 66 kV for 0.5–2 × S_sc and no amplified resonance (> 3) on a characteristic order. SB-510: 5 Mvar at h18, q 1.5 (C 3.64 µF, L 8.59 mH, R 72.8 Ω); the 960 Hz peak moves to ≈ 645 Hz (×2.6), h19 108 % → 10 %, worst h13 50 %, THD at 66 kV 0.98 %. pandapower shunt `HF_OSS_66_5MVAR_h18` (q −5, load convention): STATCOM −2.8 → −7.8 MVAr at full load, buses 0.999–1.008 p.u.; the historian Q balance includes it.
- Still open / follow-ups: the drawn blade shape stays V236-like (only scaled).

Phase 13 notes (order 4 → 1 → 2 → 5 → 3 → 6 → 7, one commit each):
- 4 Region pack: already the whole Polish EEZ since phase 1 (every MSP energy basin 14 / 43–46 / 53 / 60). The
  frontend no longer names `southern-baltic`: without a region the backend default is used, the site store sends the
  region of the loaded layers. `/layers` is 523 KB raw / 129 KB gzip; nginx gzips JSON, so no GZip middleware.
- 1 Seabed: `seabed` class raster (EMODnet Geology 1:250 000, Folk 5; Polish part = PGI-NRI 1:200 000) on the
  bathymetry's 0.01° grid, one digit per cell (`rows`, decoded on load; nearest-node sampling). Check `seabed` warns on
  coarse / mixed (till, boulders) / rock with the piling and burial consequence (DNV-RP-C212, DNV-RP-0360) — an
  engineering finding, kept out of the permit conditions (`journey.ENGINEERING`). Foundation cost × mean class factor
  (sand 1.00 … rock 1.25, illustrative: no published premium found). SB-510: mixed 40 %, coarse 31 %, sand 29 % → warn,
  foundations × 1.06. `hooks/useSiteRasters` serves depth + seabed to Layout and Report.
- 2 Ports: `ports` layer (O&M Łeba / Ustka / Władysławowo, installation Świnoujście / Gdańsk T5 / Rønne; role and status
  from the operators' announcements, OSM location). `sea_routes.py`: 16-neighbour Dijkstra on the bathymetry sea cells,
  coastline cells blocked (Hel, Vistula Spit), ports snapped to the largest connected water body; cache keyed by the
  raster + coastline objects. SB-510: O&M Ustka 52.5 km, installation Rønne 116.7 km (constants
  `SB510_OM_PORT_KM` / `SB510_INSTALL_PORT_KM`, frontend twin `SB510_PORTS`, all pinned by tests). Campaign trips =
  units × ORBIT fastening time + 2 × distance / ORBIT speed (HLV 7, WTIV 10, CLV 11.5 km/h) instead of a fixed 48 h →
  SB-510 campaign P50 day 180 / P90 day 227 (was 167 / 201). O&M maintenance window: WOMBAT 07–19 working day minus the
  CTV transit at 37.04 km/h (SB-510 9.2 h of work); the P1 Availability & O&M tab calls it (follow-ups below).
- 5 Grid nodes: short names, `status` existing / commissioning (Choczewo) / planned (Krzemienica, Bałtyk 1) with PSE's
  investment pages as `basis`. Assessment ranks every node, takes `grid_node` (unknown → 422) and checks it (planned /
  commissioning warns; a grid matter, not a permit condition). Picker in the site report; the choice lives in the site
  store and the project document (`site.gridNode`) and goes into `X-Farm` → `FarmSpec.grid_node`. Per-node
  short-circuit power: see the follow-ups below.
- 3 Route check: `POST /site/route-check` (`route_check.py`): drawn route or automatic shortest sea path to the node;
  km subsea / land, landfall, Natura / military km, shipping-basin and cable crossings with angles (< 45° warns, ICPC
  Rec. 2; 45° is a teaching proxy for shipping lanes). SB-510's surveyed route = 76.5 km (63.4 + 13.1), PZP_15 at
  89°, no cable crossing; findings: 11.1 km of the coastal bird area (HDD), 1.5 km of Jezioro Wicko on land, and
  24.5 km through a military National Defence Area — re-drawn afterwards (follow-ups below). The checked
  length (`site.route`, `site.routeKm`) is the farm's export length in Layout cost, `X-Farm` and construction.
- 6 Cluster wakes: `POST /site/neighbours` (60 km, Platis et al. 2018) → virtual turbines of the site's model; outlines
  filled, point-only projects a square of P / median outline density (10.5 MW/km²), points inside outlines dropped,
  same-location points merged, projects holding the site's own area left out. `wake-analysis-custom` takes neighbour
  positions; external loss = TurbOPark (Nygaard et al. 2022) alone vs with neighbours on a 5° × 2 m/s grid,
  PropagateDownwind, at first rotor-centre averaging (−4.8 %, ≈ 20 s), now the full model (follow-ups below). The
  Gaussian model gives
  −0.96 % for the same farms. Layout button "Estimate external loss"; LCOE and the report's net energy include it.
- 7 Uncertainty: `uncertainty_components()` — NEWA spread 0.54 m/s × AEP sensitivity (computed, SB-510 0.98), ERA5
  IAV 4.20 % (`fetch_wind_climate.py --iav`, 1995–2024) / √30 and / √25, wake + blockage 25 % of the loss (Walker et
  al. 2016), turbine 4.0 % and non-wake 2.7 % (Lee & Fields 2021 Table B6 medians). SB-510 σ 7.7 %, P90 1 948 GWh/yr
  (was 6.89 % / 1 970). `POST /wind/uncertainty`; P1 shows the components, the report P50 / P75 / P90; the frontend
  twin `aepMath.UNCERTAINTY_SOURCES` is pinned by a backend test. `DEFAULT_UNCERTAINTY_SOURCES` stays for explicit
  overrides only.
- Data downloads (all in the scripts, retrieved 2026-10-08): EMODnet Geology WFS (needs `sortBy=objectid` for paging),
  Overpass (ports, grid), Open-Meteo ERA5 (IAV). Lee & Fields' Table B6 was read from the journal's XLSX.
- e2e: Site & Permits (route panel, grid picker), Layout (card seabed row, neighbour block), Report (seabed column,
  P-values) and Construction (ports) change their look → `npm run e2e:update` locally.

Phase 13 follow-ups (owner's decision 2026-10-08: re-route with real data, finish the open items), one commit each:
- SB-510 re-route: OSS → round the west end of Ławica Słupska (≥ 1.7 km) → PZP_15 / PZP_10 at 62–67° → between
  Darłowo's approach channel PZP_23 and the military National Defence Area (≥ 0.7 km from each) → landfall
  Darłówko-Wschodnie → 28.7 km on land north of Dolina Wieprzy i Studnicy (PLH220038) → PSE Krzemienica, the
  connection point PGE announced for Baltica 9+ (44.E.1; Słupsk-Wierzbięcino serves Bałtyk II/III). Route check:
  108.0 km (79.3 + 28.7), no military / munitions / cable, only PLB990002 (8.5 km at sea, HDD). The automatic route
  (`auto_route`) now closes military + munitions (1 km buffer), weights Natura × 10 and shipping × 3, lands outside
  harbour channels and checks the land leg. `design(STRING_LAYOUT, 108)`: Q_cable 624 Mvar, 4 × 180 Mvar reactors,
  ±120 Mvar, filter 2 Mvar h16 (array resonance 880 Hz, h17 74.5 % → 31.5 %; the 115 Hz cable–grid resonance stays
  ≤ 75 %). Load flow: export 99 % at 510 MW, losses 10.1 MW, buses 0.997–1.015 pu; N-1 export trip 174 % → runback
  to 279 MW; Ferranti 4.3 %, uncompensated rise 24.5 %; IEC 60909 OSS 66 kV 19.5 / 12.5 kA, OSS 220 kV 7.8 kA;
  terminal SCR 2.9 (very-weak scenario 0.75 GVA so GFL still has an operating point). P5: onshore OLTC pre-set 3
  steps; circuit-1 PPC limit from a load-flow capability (`circuit1_capability_mw`, 233 MW → 210 MW; the held tap
  sags the onshore busbar to 0.97 pu, the STATCOM sends ≈ 100 Mvar ashore — the analytic 273 MW is too high);
  energising from shore loads cable 1 to 101 % for the minutes until the OSS end is live. DTS: HDD 78.7–79.5 km,
  818 A at full load → J-tube ≈ 82 °C (alarm, below 90 °C), N-1 1 438 A → 37 min. The SB-510 site preselects
  Krzemienica (`CASE_STUDY_GRID_NODE`). Frontend `SB510_NETWORK` was still 3 × 170 / 442 → fixed; landing cable
  losses use the mean I² along the cable (Ic²/12).
- Per-node short-circuit power: PSE publishes none (not in PRSP 2025–2034 or elsewhere; only the 40 / 50 / 63 kA
  station standard), so it is a project input from the TSO's connection conditions: site report field next to the
  node → site store / project document `site.gridSscMva` → `X-Farm.grid_ssc_mva` → `FarmSpec.grid_ssc_mva`, 1 GVA …
  √3·400 kV·63 kA = 43 648 MVA; empty = illustrative 10 GVA, a new node clears it. All P2 studies default to the
  farm's value (load flow, IEC 60909, STATCOM / PSE Q range, N-1, FRT, ANDES, PPC, harmonics, GFM strong grid).
- O&M repair window: P1 Availability & O&M tab, `RepairWindowPanel` → `POST /wind/maintenance-scheduling` with the
  farm's O&M port distance (SB-510 Ustka 52.5 km: 9.2 h of CTV work per day).
- Full TurbOPark: PyWake's `Nygaard_2022` set-up incl. `GaussianOverlapAvgModel`; its table is read through
  h5netcdf's pure-Python `pyfive` backend (h5py's DLLs are blocked by Windows application control here and h5py is
  not a dependency); checked against the analytic disc average (Bessel I0). SB-510: −4.6 % (site climate), ≈ 55 s;
  cache key `wake-cluster-v2`. New deps: h5netcdf ≥ 1.8, pyfive ≥ 1.2.
- e2e: the landing map, Grid, Commissioning, Site & Permits, Wind Resource (O&M tab) change their look.

## Evidence programme (owner decisions 2026-10-10 — do not re-ask)

Review verdict 7/10: strong engineering and tooling, weak evidence. PR #264 (merged) fixed the blank
Print/PDF, the P4 IEC 61400-26-1 misattribution, the forecast-vs-yield P90 confusion, the skill-score split,
stale V236 / 76.5 km numbers in the education panels, and wrong or dead sources. Next, in this order:

- **B1 — measured wake validation (approved):** PyWake's measured Horns Rev 1 and Lillgrund data
  (DTU GitLab `TOPFARM/PyWake`, `py_wake/validation/data`, MIT) committed with its licence and attribution;
  our NOJ / BPA / TurbOPark set-ups scored against the measured row power ratios (RMSE per row and direction).
- **B2 — P2 analytic checks as tests:** ωCU²L charging, Ferranti 1/cos βl, LFSM-O hand formula vs ANDES,
  IEC TR 60909-4 example networks.
- **B3 — P4 real data only:** drop the synthetic SCADA forecast path; train and score on measured data
  (ENTSO-E File Library already in use, PR #262). Day-ahead metrics: CRPS, P10–P90 coverage,
  reliability diagram, skill vs 24 h persistence and climatology. Research result: the data is already
  here (`scripts/fetch_real_forecast_data.py`, `fetch_entsoe_units.py`, `services/p4/real_data.py`: Energinet
  DK2 + ENTSO-E Kriegers Flak / Rødsand with Open-Meteo Previous Runs `previous_day1` ECMWF/ICON, hourly
  2024-06 → 2026-10). Move XGB/LSTM/TFT/ensemble/SHAP onto it (NWP features, power lags ≥ 36 h only,
  TimeSeriesSplit with a 24–48 h gap), delete `scada_generator` and `_pipeline._build_*`. Add TSO benchmarks:
  Energinet `Forecasts_Hour` (DK2 offshore day-ahead) and Elia `ods031` (Belgian offshore, measured +
  day-ahead + confidence10/90). Never the Open-Meteo Historical Forecast API (near-analysis, leaks).
- **B4 — "Evidence" page** in the app generated from test results (what was validated, against what,
  metric, value, test file).
- **B5 — guards:** numbers quoted in education prose checked against the backend; weekly DOI / link check.
- **Still to audit line by line:** `turbinePartEducation.ts`, `tours.ts`, Academy courses.
- **AI tutor (after B):** OpenRouter-style OpenAI-compatible API with cheap models, the user brings their
  own key (kept server-side per session, never in localStorage); look into linking existing subscriptions.
  Context = current page + panel numbers; physics questions go to backend calculators as tools; browser
  Web Speech API for the microphone; an eval set before release.
- **Rejected for now:** learner paths, hosted demo, pilot study (old "Faz C").

## Resume here

1. The own-project programme is a PR stack, one branch per phase, each based on the one before it
   (phase 1 `feat/site-msp-energy-basins` → … → phase 10 `feat/layout-ux` #237 → phase 11
   `feat/project-report` #238 → phase 12 `feat/provenance` #239 → phase 13 `feat/pro-items`). The
   13-phase programme is complete; new work starts from the newest branch
   (`git fetch origin && git checkout feat/pro-items && git pull`) or from `main` once the stack is merged.
2. Next: nothing planned. Candidate follow-ups: neighbour layouts on the Layout map; SB-510's export at
   99 % suggests a study of a larger export conductor or mid-route compensation (no datasheet values for
   1200 / 1600 mm² in the model yet).
3. Known, not ours: 6 old mypy errors under `digital_twin`; the Docker backend image runs old code — check in
   the browser with a local `uvicorn app.main:app --port 8001` and a temporary Vite proxy target (revert it).
4. Owner to-dos: `cd frontend && npm run e2e:update` (new baselines incl. `layout`, `site-permits`, `academy`,
   `construction`, `handover`, `decommissioning`, `report`, and the phase 13 look changes; the owner's modified snapshot files in the working
   tree are not committed by Claude), merge the PR stack in order, rename the GitHub repo to `offshoreforge`,
   trademark check.

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
- SB-510 sits in MSP energy basin PZP_44 (phase 9; before that 27 of 34 turbines were in shipping
  basin PZP_15). The area is the real site 44.E.1 (permit PGE / Baltica 9), used fictionally.

## Owner actions (outside the code)

- Rename the GitHub repository to `offshoreforge`; check the name for trademark conflicts.
- Run `npm run e2e:update` locally to accept the new visual baselines.

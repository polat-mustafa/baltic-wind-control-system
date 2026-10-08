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
| 12 | Provenance: `SourceBadge` (official / measured / literature / approximation / illustrative); Layout cost inputs, P1 loss cascade and report carry their source; cost defaults from NREL Cost of Wind Energy Review 2024 + ORBIT cable library (2023 USD → €), export priced per circuit; 66 kV cable capacitance from the ABB/NKT datasheet. P4 / DT on IEA 15 MW still open (needs the owner's approval) | In review (PR #239, `feat/provenance`, stacked on 11) |
| 13 | Pro items | Open |

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
- Cables (`network_model.py` provenance note): R = IEC 60228 (official); C, X from ABB 2GM5007 rev 5 (NKT) Tables 45/49 — the 66 kV capacitances were 200 / 215 / 230 nF/km, the datasheet says 290 / 320 / 350, now used (test `test_cable_c_and_x_match_the_datasheet`). Effect on SB-510: array charging +8 MVAr, STATCOM over the scenarios −56 … +1 MVAr (was −48 … +9), losses 8.63 MW and 0.999–1.005 p.u. unchanged, resonance still h19. Ratings stay (labelled approximation): they are 9–16 % above the brochure's indicative IEC 60287 values (655 / 715 / 775 A; 825 A for 220 kV) — with 775 A the 800 mm² string would carry only 5 × 15 MW, so changing them redesigns SB-510's 6-turbine strings; left for an owner decision with a project-specific IEC 60287 rating.
- Not done in this phase: P4 / digital twin / turbine physics on the IEA 15 MW curve (owner approval first); the education texts that quote the Vestas V236 catalogue.

## Resume here

1. The own-project programme is a PR stack, one branch per phase, each based on the one before it
   (phase 1 `feat/site-msp-energy-basins` → … → phase 10 `feat/layout-ux` #237 → phase 11
   `feat/project-report` #238 → phase 12 `feat/provenance`). Start the next phase from the newest branch:
   `git fetch origin && git checkout feat/provenance && git pull`, then `git checkout -b <new branch>`
   and open the PR with that branch as base.
2. Next: the open part of phase 12 — moving P4 / Digital Twin / turbine physics to the IEA 15 MW curve and
   re-calibrating them — **needs the owner's approval first**; also decide on the array cable ratings (Phase 12
   notes). Then phase 13 (pro items, order 4 → 1 → 2 → 5 → 3 → 6 → 7). Full specs: the plan file named above,
   sections "Faz 12" / "Faz 13"; read the latest "Phase N notes" here before starting.
3. Known, not ours: 6 old mypy errors under `digital_twin`; the Docker backend image runs old code — check in
   the browser with a local `uvicorn app.main:app --port 8001` and a temporary Vite proxy target (revert it).
4. Owner to-dos: `cd frontend && npm run e2e:update` (new baselines incl. `layout`, `site-permits`, `academy`,
   `construction`, `handover`, `decommissioning`, `report`; the owner's modified snapshot files in the working
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

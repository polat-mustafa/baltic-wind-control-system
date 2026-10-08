# Site assessment layer packs — sources

Every layer in a pack carries `source`, `license` and `retrieved` fields;
this file summarises them. Polygons are clipped to the region (plus a
0.15° margin) and simplified (Ramer–Douglas–Peucker, ≈ 100 m); the
bathymetry is block-averaged. The geometry is for teaching and screening:
it is not a legal boundary and must not be used for navigation.

Regenerate every layer with (network access, a few minutes):

    cd backend && python scripts/fetch_marine_layers.py
    cd backend && python scripts/fetch_marine_layers.py --only wind     # wind farm layers only
    cd backend && python scripts/fetch_marine_layers.py --only seabed   # seabed substrate only

## southern_baltic.json — Southern Baltic, the whole Polish EEZ

Box 14.15–19.85 °E, 53.85–55.95 °N: the Polish EEZ (Marine Regions MRGID 5687)
and the coast from Świnoujście to the Vistula Spit. Retrieved 2026-10-06.

| Layer | Role | Source | Licence |
|---|---|---|---|
| `sea` | sea | Marine Regions `eez`, `eez_12nm` and `eez_internal_waters` of every State in the box (union = the sea) | CC BY 4.0 — Flanders Marine Institute (2026): MarineRegions.org |
| `eez` | eez | Marine Regions `eez` — Polish EEZ (MRGID 5687) | CC BY 4.0 — Flanders Marine Institute |
| `territorial` | territorial | Marine Regions `eez_12nm` — Polish 12 NM (MRGID 49028) | CC BY 4.0 — Flanders Marine Institute |
| `coastline` | shore | OpenStreetMap `natural=coastline` (Overpass), Świnoujście → Vistula Spit; Bornholm excluded so shore distance means the Polish coast | ODbL 1.0 © OpenStreetMap contributors |
| `cables` | cable | OpenStreetMap submarine power/telecom cables and pipelines (SwePol, NordBalt, Baltic Pipe, Nord Stream 1/2, C-Lion 1, Bornholm cables …) plus EMODnet Human Activities `pipelines` (Petrobaltic field lines) | ODbL 1.0; CC BY 4.0 (EMODnet) |
| `grid_nodes` | grid | OpenStreetMap PSE 400 kV substations near the coast: Słupsk-Wierzbięcino, Żarnowiec, Choczewo, Dunowo, Żydowo-Kierzkowo, Gdańsk I / Błonia / Przyjaźń, Pelplin; Krzemienica marked *planned* | ODbL 1.0 |
| `natura2000` | protected | EEA Natura 2000 (release 2023-12) via EMODnet Human Activities `natura2000areas`, marine and coastal sites | CC BY 4.0 (EMODnet) |
| `owf_outlines` | owf | OpenStreetMap offshore wind farm outlines (`power=plant` / `construction:power=plant`): Baltic Power, Bałtyk II, Baltica 2, Wikinger, Arkonabecken Südost | ODbL 1.0 |
| `owf_projects` | owf (points) | EMODnet Human Activities `windfarms`: locations, status and capacity of 34 projects (Baltic Power, Baltica 1–9, Bałtyk I–III, BC-Wind, Orlen Neptun, Bornholm …) | CC BY 4.0 (EMODnet) |
| `msp_energy` | msp_energy | Polish maritime spatial plan (Dz.U. 2021 poz. 935): basins whose priority use is renewable energy — PZP_14, 43, 44, 45, 46, 53, 60 — via EMODnet `mspzoningpoly` | CC BY 4.0 (EMODnet) |
| `shipping` | shipping | Maritime spatial plans (PL, DK): basins whose priority use is "maritime traffic flows", via EMODnet `mspzoningpoly` | CC BY 4.0 (EMODnet) |
| `restricted` | restricted | EMODnet `militaryareaspoly` and `munitionspoly` (HELCOM dumpsites) | CC BY 4.0 (EMODnet) |
| `bathymetry` | bathymetry | EMODnet Digital Bathymetry DTM 2024 (doi:10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1), mean of the 1/16′ cells in 0.01° blocks | EMODnet open data, with attribution; not for navigation |
| `wind_climate` | wind | Hub height 150 m, 0.05° grid: mean speed from the NEWA Mesoscale Atlas `wind_speed_mean` (WRF 3 km, 1989–2018, doi:10.11583/DTU.14414096.v1); Weibull k from the NEWA Microscale Atlas `weib_k_combined` at 100 and 200 m (0.5° sea points, ln z interpolation to 150 m); A = mean / Γ(1 + 1/k). Built by `scripts/fetch_wind_climate.py` | **CC BY-NC 4.0** (NEWA, DTU Wind Energy) — non-commercial; OffshoreForge is free and non-commercial, a commercial re-user must replace this layer |
| `wind_rose` | wind_rose | 12-sector direction frequency (wind FROM) of ERA5 hourly 100 m winds 2015–2024, 0.5° grid, via the Open-Meteo archive API | CC BY 4.0 (ERA5: Copernicus Climate Change Service; Open-Meteo) |
| `seabed` | seabed | EMODnet Geology seabed substrate 1:250 000 (`gtk:seabed_substrate_250k`), Folk 5 classes (mud to muddy sand, sand, coarse-grained, mixed, rock and boulders); Polish waters from PGI-NRI, *Geological Map of the Baltic Sea bottom 1:200 000* (Mojski ed., 1988–1995). Class at the centre of each 0.01° cell of the bathymetry grid, stored as one digit per cell | CC BY 4.0 — EMODnet Geology |

Licences were read from each dataset's ISO metadata record (EMODnet
GeoNetwork), the Marine Regions licence page and the OSM copyright page.
Marine Regions asks users to refer to marineregions.org for the current
boundaries rather than redistribute them: the pack holds only a clipped,
simplified excerpt for screening, and the script re-downloads it.

### The legal rules the screening applies

- **Territorial sea:** offshore wind farms are banned in Polish internal waters
  and the territorial sea — Act on the maritime areas of the Republic of Poland
  and maritime administration, consolidated text Dz.U. 2024 poz. 1125,
  Art. 23 ust. 1a.
- **Energy basins:** a wind farm needs a location permit (PSZW, Art. 23 ust. 1)
  for a defined sea area; competing applications are ranked first on consistency
  with the maritime spatial plan (Art. 27g ust. 1 pkt 1). The plan
  (Dz.U. 2021 poz. 935) gives offshore wind priority only in its energy
  basins, so the screening treats any area outside them as refused. This is a
  screening simplification: the plan text and the authority decide.
- **Allocation:** every energy basin already has a permit holder (e.g. PZP_44
  = site 44.E.1, permit issued on 9 August 2023 to Elektrownia Wiatrowa
  Baltica 9, PGE). A real project there would need the holder's area; the
  check reports it as a warning.

### Gaps (not in any open dataset we found)

- Outlines of most permitted projects (only five are mapped in OSM); the others
  are EMODnet points. The individual permit areas (e.g. 44.E.1 inside basin
  PZP_44) are not published as open GIS data.
- Seabed substrate is a 1:250 000 compilation of 1988–1995 mapping: it says what a
  site investigation will probably meet, not what a pile will meet. The foundation
  cost factors per class are teaching assumptions (no published premium found).

### What the data says about SB-510

The case-study farm is fictional. Since 2026-10 it uses energy basin PZP_44
between 16.42 and 16.63 °E (112.9 km², the west and middle of the basin, which
is the real site 44.E.1 — location permit 9 August 2023, Elektrownia Wiatrowa
Baltica 9 / PGE; SB-510 borrows the area for teaching):

- inside the energy basin, beyond 12 nm (≥ 49 km from shore), no shipping
  basin, military area or recorded munition dump in it; the SwePol HVDC cable
  is 4.6 km east of the boundary;
- 34–54 m of water over the boundary, 37–51 m at the 34 turbines → jackets;
- seabed (EMODnet Geology / PGI-NRI): mixed sediment 40 %, coarse-grained 31 %,
  sand 29 % of the site — glacial till and gravel of the Słupsk Bank area, so the
  screening warns about boulders and pile driving;
- already allocated (warning: Baltica 9, and the EMODnet points FEW Baltic II
  and Sharco Duo);
- the Natura 2000 site Ławica Słupska (PLC990001) is 2 km south: an
  appropriate-assessment screening question. The 220 kV export goes round its
  west end (≥ 1.2 km clear), crosses shipping basin PZP_15 at right angles and
  lands at Zaleskie: 63.5 km subsea + 13 km land = 76.5 km to PSE
  Słupsk-Wierzbięcino (2 circuits, 4 × 120 MVAR reactors at both cable ends, ±120 MVAR STATCOM).

Until 2026-10 SB-510 sat at 16.31–16.485 °E, 54.755–54.845 °N: outside every
energy basin and 60–80 % in shipping basin PZP_15 (27 of 34 turbines), so a
real project could not have been permitted there.

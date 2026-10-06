# Site assessment layer packs — sources

Every layer in a pack carries `source`, `license` and `retrieved` fields;
this file summarises them. Polygons are clipped to the region (plus a
0.15° margin) and simplified (Ramer–Douglas–Peucker, ≈ 100 m); the
bathymetry is block-averaged. The geometry is for teaching and screening:
it is not a legal boundary and must not be used for navigation.

Regenerate every layer with (network access, a few minutes):

    cd backend && python scripts/fetch_marine_layers.py
    cd backend && python scripts/fetch_marine_layers.py --only wind   # wind farm layers only

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
- Seabed substrate and ports are not in the pack yet.

### What the data says about SB-510 (current boundary)

The case-study farm is fictional. Its current boundary (16.31–16.485 °E,
54.755–54.845 °N):

- lies beyond 12 nm, inside the Polish EEZ, in 23–40 m of water;
- lies **outside every energy basin** and 60–80 % inside shipping basin
  PZP_15 (27 of the 34 turbines): a real project could not be permitted
  there;
- has the Natura 2000 site Ławica Słupska (PLC990001) ≈ 1 km from the
  boundary: an appropriate-assessment screening question.

SB-510 is being moved into energy basin PZP_44 (own-project programme,
phase 9); this section changes with it.

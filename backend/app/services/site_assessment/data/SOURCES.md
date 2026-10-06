# Site assessment layer packs — sources

Every layer in a pack carries `source`, `license` and `retrieved` fields;
this file summarises them. Polygons are clipped to the region (plus a
0.15° margin) and simplified (Ramer–Douglas–Peucker, ≈ 100 m); the
bathymetry is block-averaged. The geometry is for teaching and screening:
it is not a legal boundary and must not be used for navigation.

Regenerate the open-data layers with:

    cd backend && python scripts/fetch_marine_layers.py

## southern_baltic.json — Southern Baltic, Polish EEZ off Ustka (SB-510 case study)

| Layer | Role | Source | Licence | Retrieved |
|---|---|---|---|---|
| `sea` | sea | Derived from the coastline below, closed to the north | ODbL 1.0 | 2026-09-29 |
| `coastline` | shore | OpenStreetMap `natural=coastline` (Overpass), Rowy → Łeba, simplified ≈ 150 m | ODbL 1.0 © OpenStreetMap contributors | 2026-09-29 |
| `cables` | cable | OpenStreetMap ways 1025227913 + 251849081 (SwePol HVDC) | ODbL 1.0 © OpenStreetMap contributors | 2026-09-29 |
| `grid_nodes` | grid | OpenStreetMap: PSE 400 kV substation Słupsk-Wierzbięcino | ODbL 1.0 © OpenStreetMap contributors | 2026-09-29 |
| `natura2000` | protected | EEA Natura 2000 spatial data (release 2023-12) via EMODnet Human Activities `natura2000areas` | CC BY 4.0 (EMODnet; originator Cogea) | 2026-10-05 |
| `owf_areas` | owf | EMODnet Human Activities `windfarmspoly` (Polish MSP basins PZP_43–46) | CC BY 4.0 (EMODnet; originator CETMAR) | 2026-10-05 |
| `shipping` | shipping | Polish maritime spatial plan, Dz.U. 2021 poz. 935: basins whose priority use is "maritime traffic flows", via EMODnet Human Activities `mspzoningpoly` | CC BY 4.0 (EMODnet; originator CETMAR) | 2026-10-05 |
| `restricted` | restricted | EMODnet Human Activities `militaryareaspoly` and `munitionspoly` (HELCOM dumpsites) | CC BY 4.0 (EMODnet; originator CETMAR) | 2026-10-05 |
| `eez` | eez | Marine Regions, Maritime Boundaries `eez` — Polish EEZ (MRGID 5687) | CC BY — Flanders Marine Institute (2026): MarineRegions.org | 2026-10-05 |
| `territorial` | territorial | Marine Regions, Maritime Boundaries `eez_12nm` — Polish 12 NM (MRGID 49028) | CC BY — Flanders Marine Institute (2026): MarineRegions.org | 2026-10-05 |
| `bathymetry` | bathymetry | EMODnet Digital Bathymetry DTM 2024 (doi:10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1), mean of the 1/16′ cells in 0.01° blocks | EMODnet open data, with attribution; not for navigation | 2026-10-05 |

Licences were read from each dataset's ISO metadata record (EMODnet
GeoNetwork) and from the Marine Regions licence page on 2026-10-05.
Marine Regions asks users to refer to marineregions.org for the current
boundaries rather than redistribute them: the pack holds only a clipped,
simplified excerpt for screening, and the script re-downloads it.

### What the data says about SB-510

The case-study farm is fictional. Checked against these layers:

- it lies beyond 12 nm, inside the Polish EEZ, in 23–40 m of water, clear
  of other wind farm areas (nearest PZP_43, ≈ 9 km from the nearest turbine);
- the Natura 2000 site Ławica Słupska (PLC990001) is ≈ 3 km north of the
  nearest turbine (≈ 1 km from the site boundary): an appropriate-assessment
  screening question;
- 27 of the 34 turbines lie in basin PZP_15, whose priority use in the
  maritime spatial plan is shipping. A real project could not be permitted
  there; the case study keeps the layout as a teaching example.

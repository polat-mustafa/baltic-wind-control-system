# Third-party data, models and names

The [MIT licence](LICENSE) covers the OffshoreForge **source code** only. The datasets
bundled in this repository (and served by the public demo) keep their own licences, listed
below. If you re-use a dataset, follow its licence, not MIT. Per-layer details: each
`SOURCES.md` next to the data and the `source` / `license` fields inside the files.

## Case study, names and trademarks

- **SB-510 is fictional.** It borrows the area of the real site 44.E.1 in Polish
  maritime spatial-plan basin PZP_44 (location permit 9 August 2023, Elektrownia Wiatrowa
  Baltica 9 / PGE) and the PSE substation Krzemienica for teaching. Capacity, layout,
  electrical design, cable route and every SB-510 result are invented or computed here.
- OffshoreForge is **not affiliated with, endorsed by or sponsored by** Vestas, PGE,
  Ørsted, PSE, Orlen, Northland Power, Energinet, ENTSO-E or any other company or body
  named in it. Names and trademarks belong to their owners and are used only to describe
  real facts (who holds a permit, which turbine a real farm uses).
- "V236 class" describes the turbine size. It is modelled with the open IEA-15-240-RWT,
  not with Vestas data; the 3D model (`frontend/public/models/v236.glb`) is drawn by our own
  Blender script (`frontend/scripts/blender/build_v236.py`) from the IEA-15 report.
- Not certified engineering software; do not use it for real design or operational decisions.
  Map geometry is not a legal boundary and is not for navigation.

## Bundled data

| Data | Where | Source | Licence / terms |
|---|---|---|---|
| IEA 15 MW and 22 MW reference turbines, ROSCO controller tables | `backend/app/data/turbines/` | IEA Wind TCP Task 37 (NREL, DTU, UMaine); NREL ROSCO | Apache 2.0, `LICENSE-Apache-2.0.txt` in that folder |
| Site layers: sea, EEZ, 12 NM | `backend/app/services/site_assessment/data/southern_baltic.json` | Flanders Marine Institute, MarineRegions.org | CC BY 4.0 |
| Site layers: coastline, cables, grid nodes, ports, wind farm outlines | same | © OpenStreetMap contributors | **ODbL 1.0** (these layers stay ODbL) |
| Site layers: Natura 2000, wind farm points, MSP zoning, military, munitions, pipelines | same | EMODnet Human Activities (EEA, HELCOM, national MSPs) | CC BY 4.0 |
| Bathymetry | same | EMODnet Digital Bathymetry DTM 2024 | EMODnet open data, attribution; not for navigation |
| Seabed substrate | same | EMODnet Geology (PGI-NRI for Polish waters) | CC BY 4.0 |
| Wind climate (mean speed, Weibull k) | same | New European Wind Atlas (NEWA Consortium), DTU Wind Energy | CC BY 4.0 (DTU Data records doi:10.11583/DTU.14414096 and DTU.14672049) |
| Wind rose; ERA5 winds | same; `p1/validation_data/roedsand2/`; `lifecycle/data/` | ERA5 via Open-Meteo | Contains modified Copernicus Climate Change Service information; Open-Meteo CC BY 4.0 |
| Wave height Hs | `backend/app/services/lifecycle/data/` | Generated using E.U. Copernicus Marine Service Information; BALTICSEA_MULTIYEAR_WAV_003_015, doi:10.48670/moi-00014 | Copernicus Marine licence (free, credit line above) |
| Sea-ice days | same | NOAA OISST v2.1 | US public domain, credit NOAA |
| Polish grid ≥ 220 kV | `frontend/src/data/plGrid.json` | OpenStreetMap via PyPSA-Eur (Zenodo 10.5281/zenodo.18619025) | **ODbL 1.0** |
| Measured farm output (Rødsand 1/2, Kriegers Flak, Baltic Power …) | `backend/app/services/p4/data/entsoe_*`, `p5/data/` | ENTSO-E Transparency Platform, Actual Generation per Generation Unit (16.1.A) | Transparency Platform Terms of Use, source to be named. **Open point:** 16.1.A is not on ENTSO-E's list of data free for re-use (version of 28 Oct 2019), so republishing it needs the data owner's (the TSO's) consent |
| DK2 offshore production and TSO forecasts | `backend/app/services/p4/data/dk2_*` | Energinet Energi Data Service | CC BY 4.0 |
| NWP forecasts (ECMWF IFS, DWD ICON) | inside the P4 files | Open-Meteo Previous Runs API | CC BY 4.0 |
| CARE to Compare results (farms B, C) | `backend/app/services/digital_twin/data/care_farm_*.json` | Gück et al. 2024, Zenodo 10.5281/zenodo.14006163 | **CC BY-SA 4.0** (derived files stay CC BY-SA) |
| Horns Rev 1 / Lillgrund wake data | `backend/app/services/p1/validation_data/pywake/` | PyWake (DTU Wind Energy, TOPFARM) | MIT, `LICENSE` in that folder |
| Recorded API answers of the public demo | `frontend/demo-api/` | the backend above | as their sources; AIS vessel identities anonymised |

## Live services (fetched at run time, not bundled)

| Service | Terms |
|---|---|
| Base map: OpenFreeMap / OpenMapTiles, OpenStreetMap tiles (fallback) | © credits shown on every map; OSM tile usage policy |
| Open-Meteo forecast and archive APIs | CC BY 4.0; free API for non-commercial use |
| PSE reports API (`api.raporty.pse.pl`) | no published terms found (checked 2026-10-13); source named as "Raporty PSE"; data shown live, not bundled |
| aisstream.io live AIS (own API key) | no published terms of use (checked 2026-10-13); used as its documentation asks: one server-side connection, key kept on the server, positions held in memory only |
| Anthropic API (AI tutor, own key) | the key holder's Anthropic terms |

Licences were read from each provider's licence or metadata page when the data were fetched
(dates in `SOURCES.md` and in the files). This list is a good-faith summary, not legal advice.

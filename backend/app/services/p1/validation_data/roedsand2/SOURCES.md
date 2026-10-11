# Rødsand II validation inputs (evidence programme A1)

Written by `backend/scripts/fetch_validation_farms.py`; used by `app/services/p1/aep_validation.py`.

- `layout.csv` — the 90 Siemens SWT-2.3-93 turbines of Rødsand II (`generator:source=wind`
  nodes west of 11.64° E, every one tagged `model=SWT-2.3-93`), OpenStreetMap via the Overpass
  API, retrieved 2026-10-11. © OpenStreetMap contributors, licensed under the Open Database
  Licence 1.0 (https://opendatacommons.org/licenses/odbl/1-0/).
- `era5_2025.csv.gz` — ERA5 hourly 100 m wind speed [m/s] and direction [°] for 2025 at the
  farm centroid (Open-Meteo archive API, `models=era5`, nearest grid point 54.5° N 11.5° E),
  retrieved 2026-10-11. Contains modified Copernicus Climate Change Service information
  (Hersbach et al. 2020, DOI 10.1002/qj.3803); Open-Meteo data CC BY 4.0.

Measured output: ENTSO-E Transparency Platform 16.1.A "Actual Generation per Generation Unit",
Rødsand 2, bundled at `app/services/p4/data/entsoe_roedsand2.csv.gz` (see
`scripts/fetch_entsoe_units.py`). Turbine curves: PyWake `py_wake.validation.lillgrund.SWT2p3_93_65`
(MIT, see `../pywake/LICENSE`).

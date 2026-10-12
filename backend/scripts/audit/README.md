# Engineering audit scripts

Reproducible checks behind `docs/engineering-audit-2026-10.md`. Each script reads the app's
own functions and compares them with an independent reference; none changes app state.

| Script | Check | Reference |
|---|---|---|
| `a1_rosco_overspeed.py` | turbine speed regulation in steps, ramps, IEC EOG, turbulence | NREL compiled ROSCO 2.10.6, official IEA-15 DISCON.IN |
| `a2_turbopark_reference.py` | cluster-wake model | port of Ørsted's TurbOPark Matlab code |
| `a3_export_cable.py` | export loading at P_max, lumped-π vs distributed line | exact long-line equations, 54-section model |
| `a4_wtg_transformers.py` | effect of the missing WTG transformers; reactor choice vs cable current | app load flow with added units (generic parameters) |
| `a5_annual_electrical_loss.py` | annual electrical loss vs the fixed 2.0 % | app load flow × SB-510 output distribution |
| `a6_energisation_soak.py` | cable current in the 24 h soak; line-reactor compensation | app energisation snapshot |
| `a7_short_circuit_hand_calc.py` | IEC 60909 Ik″ max | hand calculation (IEC 60909-0) |
| `a8_scl_schema.py` | SSD / ICD / SCD validity | IEC 61850-6 SCL XSD (not committed, IEC copyright) |
| `c2_opendss_load_flow.py` | SB-510 load flow (72 buses, dispatched) | the same network solved in EPRI OpenDSS (`pip install opendssdirect.py`) |

Run from `backend/` with `PYTHONPATH=.`; extra packages: `pip install rosco==2.10.6 lxml h5py`.

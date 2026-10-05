# Site assessment layer packs — sources

Every layer in a pack carries `source`, `license` and `retrieved` fields;
this file summarises them. Geometry is simplified for teaching and is not a
legal boundary.

## southern_baltic.json — Southern Baltic, Polish EEZ off Ustka (SB-510 case study)

| Layer | Role | Source | Licence | Retrieved |
|---|---|---|---|---|
| `sea` | sea | Derived from the coastline below, closed to the north | ODbL 1.0 | 2026-09-29 |
| `coastline` | shore | OpenStreetMap `natural=coastline` (Overpass), Rowy → Łeba, simplified ≈ 150 m | ODbL 1.0 © OpenStreetMap contributors | 2026-09-29 |
| `cables` | cable | OpenStreetMap ways 1025227913 + 251849081 (SwePol HVDC) | ODbL 1.0 © OpenStreetMap contributors | 2026-09-29 |
| `owf_areas` | owf | Polish maritime spatial plan basins PZP_43–45 via EMODnet Human Activities `windfarmspoly`, simplified | EMODnet data policy — confirm at re-download | 2026-09-29 |
| `grid_nodes` | grid | OpenStreetMap: PSE 400 kV substation Słupsk-Wierzbięcino | ODbL 1.0 © OpenStreetMap contributors | 2026-09-29 |

The geometry is the same data the frontend map uses
(`frontend/src/constants/windFarmLayout.ts`), converted to GeoJSON order
(lon, lat).

### Not yet included (Phase 3a import)

Until these are imported the screening reports itself as incomplete and
the affected checks return "unknown":

| Layer | Planned source |
|---|---|
| Natura 2000 sites | EEA Natura 2000 spatial data |
| Shipping density / routes | EMODnet Human Activities, vessel density |
| Water depth | EMODnet Bathymetry DTM |
| EEZ and 12 nm territorial sea | Marine Regions (Flanders Marine Institute) |

Licences are checked again at download time and recorded per layer.

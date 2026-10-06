"""Download the official IEA Wind Task 37 reference turbine tables and package them.

    cd backend && python scripts/fetch_turbine_curves.py            # writes the files
    cd backend && python scripts/fetch_turbine_curves.py --dry-run  # prints a summary only

Sources (Apache-2.0, read from each repository's LICENSE; tags pinned so the
output is reproducible):

* IEA-15-240-RWT — github.com/IEAWindTask37/IEA-15-240-RWT, tag v1.1.18,
  Documentation/IEA-15-240-RWT_tabular.xlsx, sheet "Rotor Performance".
* IEA-22-280-RWT — github.com/IEAWindTask37/IEA-22-280-RWT, tag v1.1.0,
  Documentation/IEA-22-280-RWT_tabular.xlsx, sheet "Rotor Performance - WISDEM".

Both sheets are WISDEM steady-state results (idealised, power maximised per
wind speed). The rotor diameter, hub height and cut-in / rated / cut-out wind
speeds come from the "Overview" sheet of the same workbook, so curve and
parameters always match. Rated wind speed is the first table speed at which
power reaches the rating (the Overview value can differ by a few cm/s).

Writes, per turbine:
* app/data/turbines/<id>.csv   — ws_ms, power_kw, ct (table rows; power within
  1 kW of the rating is set to the rating — WISDEM solver tolerance, ±0.1 kW)
* app/data/turbines/turbines.json — parameters + provenance of every turbine
* ../frontend/src/constants/turbineModels.ts — the same data for the browser

openpyxl is needed to read the workbooks (script-only, not a runtime dependency).
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

BACKEND = Path(__file__).resolve().parents[1]
OUT_DIR = BACKEND / "app" / "data" / "turbines"
TS_OUT = BACKEND.parent / "frontend" / "src" / "constants" / "turbineModels.ts"

TURBINES: list[dict[str, Any]] = [
    {
        "id": "IEA-15-240-RWT",
        "name": "IEA 15 MW reference turbine",
        "repo": "IEAWindTask37/IEA-15-240-RWT",
        "tag": "v1.1.18",
        "path": "Documentation/IEA-15-240-RWT_tabular.xlsx",
        "sheet": "Rotor Performance",
        "reference": (
            "Gaertner, E. et al. (2020). Definition of the IEA 15-Megawatt Offshore Reference "
            "Wind Turbine. NREL/TP-5000-75698."
        ),
    },
    {
        "id": "IEA-22-280-RWT",
        "name": "IEA 22 MW reference turbine",
        "repo": "IEAWindTask37/IEA-22-280-RWT",
        "tag": "v1.1.0",
        "path": "Documentation/IEA-22-280-RWT_tabular.xlsx",
        "sheet": "Rotor Performance - WISDEM",
        "reference": (
            "Zahle, F. et al. (2024). Definition of the IEA Wind 22-Megawatt Offshore Reference "
            "Wind Turbine. DTU Wind Energy E-0243."
        ),
    },
]

OVERVIEW_KEYS = {
    "Power rating [MW]": "rated_mw",
    "Rotor diameter [m]": "rotor_diameter_m",
    "Hub height [m]": "hub_height_m",
    "Cut-in wind speed [m/s]": "cut_in_ms",
    "Cut-out wind speed [m/s]": "cut_out_ms",
}


def _download(repo: str, tag: str, path: str) -> bytes:
    url = f"https://raw.githubusercontent.com/{repo}/{tag}/{path}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        data: bytes = resp.read()
    return data


def _rows(workbook: Any, sheet: str) -> list[list[Any]]:
    return [[c for c in row] for row in workbook[sheet].iter_rows(values_only=True)]


def read_turbine(spec: dict[str, Any]) -> dict[str, Any]:
    try:
        import openpyxl
    except ImportError:
        sys.exit("openpyxl is required: pip install openpyxl (script-only dependency)")

    wb = openpyxl.load_workbook(
        io.BytesIO(_download(spec["repo"], spec["tag"], spec["path"])),
        read_only=True,
        data_only=True,
    )
    overview: dict[str, float] = {}
    for row in _rows(wb, "Overview"):
        if row and row[0] in OVERVIEW_KEYS and isinstance(row[1], int | float):
            overview[OVERVIEW_KEYS[row[0]]] = float(row[1])
    missing = set(OVERVIEW_KEYS.values()) - overview.keys()
    if missing:
        sys.exit(f"{spec['id']}: Overview sheet lacks {sorted(missing)}")

    perf = _rows(wb, spec["sheet"])
    header = [str(h) for h in perf[0]]
    i_ws = header.index("Wind [m/s]")
    i_p = header.index("Power [MW]")
    i_ct = header.index("Thrust Coefficient [-]")
    rated_kw = overview["rated_mw"] * 1e3
    table: list[tuple[float, float, float]] = []
    for row in perf[1:]:
        if not row or not isinstance(row[i_ws], int | float):
            continue  # blank line or the note under the table
        ws, p_kw, ct = float(row[i_ws]), float(row[i_p]) * 1e3, float(row[i_ct])
        if abs(p_kw - rated_kw) < 1.0:
            p_kw = rated_kw  # WISDEM solver tolerance (±0.1 kW) above rated
        table.append((round(ws, 4), round(min(max(p_kw, 0.0), rated_kw), 1), round(ct, 4)))
    if len(table) < 20:
        sys.exit(f"{spec['id']}: only {len(table)} performance rows found")
    rated_ws = next(ws for ws, p, _ in table if p >= rated_kw - 0.5)

    return {
        "id": spec["id"],
        "name": spec["name"],
        "rated_kw": rated_kw,
        "rotor_diameter_m": round(overview["rotor_diameter_m"], 2),
        "hub_height_m": overview["hub_height_m"],
        "cut_in_ms": overview["cut_in_ms"],
        "rated_ms": rated_ws,
        "cut_out_ms": overview["cut_out_ms"],
        "source": (
            f"github.com/{spec['repo']} @ {spec['tag']}, {spec['path']}, sheet '{spec['sheet']}'"
        ),
        "license": "Apache-2.0",
        "reference": spec["reference"],
        "retrieved": datetime.now(UTC).date().isoformat(),
        "table": table,
    }


def write_ts(turbines: list[dict[str, Any]]) -> str:
    lines = [
        "/**",
        " * Reference turbines for the layout canvas and every frontend energy estimate.",
        " *",
        " * GENERATED by backend/scripts/fetch_turbine_curves.py from the official IEA Wind",
        " * Task 37 tables (Apache-2.0) — do not edit by hand;",
        " * backend/tests/test_turbine_models.py checks it against backend/app/data/turbines/.",
        " * Power in kW, wind speed in m/s.",
        " */",
        "",
        "export interface TurbineModel {",
        "  id: string;",
        "  name: string;",
        "  ratedKw: number;",
        "  rotorDiameterM: number;",
        "  hubHeightM: number;",
        "  cutInMs: number;",
        "  ratedMs: number;",
        "  cutOutMs: number;",
        "  source: string;",
        "  license: string;",
        "  /** [wind speed m/s, power kW, thrust coefficient] rows, ascending wind speed. */",
        "  table: readonly (readonly [number, number, number])[];",
        "}",
        "",
        "export const TURBINE_MODELS: Record<string, TurbineModel> = {",
    ]
    for t in turbines:
        rows = ", ".join(f"[{ws}, {p}, {ct}]" for ws, p, ct in t["table"])
        lines += [
            f'  "{t["id"]}": {{',
            f'    id: "{t["id"]}",',
            f'    name: "{t["name"]}",',
            f"    ratedKw: {t['rated_kw']:g},",
            f"    rotorDiameterM: {t['rotor_diameter_m']},",
            f"    hubHeightM: {t['hub_height_m']:g},",
            f"    cutInMs: {t['cut_in_ms']:g},",
            f"    ratedMs: {t['rated_ms']},",
            f"    cutOutMs: {t['cut_out_ms']:g},",
            f'    source: "{t["source"]}",',
            f'    license: "{t["license"]}",',
            f"    table: [{rows}],",
            "  },",
        ]
    lines += [
        "};",
        "",
        '/** SB-510 is modelled with the IEA 15 MW turbine ("V236 class"). */',
        'export const DEFAULT_TURBINE_ID = "IEA-15-240-RWT";',
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    turbines = [read_turbine(spec) for spec in TURBINES]
    for t in turbines:
        print(
            f"{t['id']}: {len(t['table'])} rows, D {t['rotor_diameter_m']} m, hub "
            f"{t['hub_height_m']:g} m, {t['cut_in_ms']:g} / {t['rated_ms']} / "
            f"{t['cut_out_ms']:g} m/s, {t['rated_kw']:g} kW"
        )
    if args.dry_run:
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    meta = []
    for t in turbines:
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow(["ws_ms", "power_kw", "ct"])
        w.writerows(t["table"])
        (OUT_DIR / f"{t['id']}.csv").write_text(buf.getvalue(), encoding="utf-8")
        meta.append({k: v for k, v in t.items() if k != "table"})
    (OUT_DIR / "turbines.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    TS_OUT.write_text(write_ts(turbines), encoding="utf-8")
    print(f"wrote {OUT_DIR} and {TS_OUT}")


if __name__ == "__main__":
    main()

"""Download the official IEA Wind Task 37 reference turbine data and package them.

    cd backend && python scripts/fetch_turbine_curves.py            # writes the files
    cd backend && python scripts/fetch_turbine_curves.py --dry-run  # prints a summary only

Sources (Apache-2.0, read from each repository's LICENSE; tags pinned so the
output is reproducible):

* IEA-15-240-RWT — github.com/IEAWindTask37/IEA-15-240-RWT, tag v1.1.18:
  Documentation/IEA-15-240-RWT_tabular.xlsx (sheets "Overview", "Rotor Performance",
  "Nacelle Mass Properties"); OpenFAST/IEA-15-240-RWT/Cp_Ct_Cq.IEA15MW.txt (ROSCO
  rotor performance surfaces); OpenFAST/IEA-15-240-RWT-Monopile/…_DISCON.IN (ROSCO
  controller) and …_ElastoDyn.dat (drivetrain).
* IEA-22-280-RWT — github.com/IEAWindTask37/IEA-22-280-RWT, tag v1.1.0,
  Documentation/IEA-22-280-RWT_tabular.xlsx (sheets "Overview",
  "Rotor Performance - WISDEM", "Nacelle Mass Properties").
* IEA-15 values that only the definition report gives (generator Table 5-4, main
  shaft Table 5-2, yaw bearing §5.5, rigid-rotor inertia §5.7): Gaertner et al. 2020,
  NREL/TP-5000-75698 — typed in below (``IEA15_REPORT``) with their table numbers.

The performance sheets are WISDEM steady-state results (idealised, power maximised
per wind speed). Rotor diameter, hub height and cut-in / rated / cut-out wind speeds
come from the "Overview" sheet of the same workbook, so curve and parameters always
match. Rated wind speed is the first table speed at which power reaches the rating
(the Overview value can differ by a few cm/s).

Writes:
* app/data/turbines/<id>.csv — ws_ms, power_kw, ct, pitch_deg, rotor_rpm, cp, cp_aero,
  thrust_kn, torque_knm (table rows; power within 1 kW of the rating is set to the
  rating — WISDEM solver tolerance, ±0.1 kW)
* app/data/turbines/turbines.json — parameters, masses and provenance of every turbine
* app/data/turbines/IEA-15-240-RWT_rosco.json — Cp/Ct/Cq(λ, β) surfaces, ROSCO
  controller, ElastoDyn drivetrain, nacelle components and the report values
* ../frontend/src/constants/turbineModels.ts — the same data for the browser

openpyxl is needed to read the workbooks (script-only, not a runtime dependency).
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
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
        "rosco": {
            "performance": "OpenFAST/IEA-15-240-RWT/Cp_Ct_Cq.IEA15MW.txt",
            "discon": "OpenFAST/IEA-15-240-RWT-Monopile/IEA-15-240-RWT-Monopile_DISCON.IN",
            "elastodyn": "OpenFAST/IEA-15-240-RWT-Monopile/IEA-15-240-RWT-Monopile_ElastoDyn.dat",
        },
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
# Further Overview rows packaged as they are (key → JSON field)
OVERVIEW_EXTRA = {
    "Drive train": "drivetrain",
    "Hub diameter [m]": "hub_diameter_m",
    "Hub Overhang [m]": "hub_overhang_m",
    "Design tip speed ratio": "design_tsr",
    "Minimum rotor speed [rpm]": "min_rotor_rpm",
    "Maximum rotor speed [rpm]": "max_rotor_rpm",
    "Maximum tip speed [m/s]": "max_tip_speed_ms",
    "Shaft tilt angle [deg]": "shaft_tilt_deg",
    "Rotor cone angle [deg]": "cone_deg",
    "Tower top to hub flange height [m]": "tower_top_to_hub_flange_m",
    # labelled "[%]" in the workbook but given as a fraction (0.957)
    "Generator rated efficiency [%]": "generator_efficiency",
    "Tower base diameter [m]": "tower_base_diameter_m",
}
OVERVIEW_MASSES = {
    "Blade mass [t]": "blade",
    "Hub mass [t]": "hub",
    "Generator mass [t]": "generator",
    "Nacelle mass [t]": "nacelle",
    "RNA mass [t]": "rna",
    "Tower mass [t]": "tower",
    "Monopile mass [t]": "monopile",
}
PERFORMANCE_COLUMNS = {
    "Wind [m/s]": "ws",
    "Pitch [deg]": "pitch",
    "Power [MW]": "power",
    "Power Coefficient [-]": "cp",
    "Aero Power Coefficient [-]": "cp_aero",
    "Rotor Speed [rpm]": "rpm",
    "Thrust [MN]": "thrust",
    "Thrust Coefficient [-]": "ct",
    "Torque [MNm]": "torque",
}
CSV_HEADER = [
    "ws_ms",
    "power_kw",
    "ct",
    "pitch_deg",
    "rotor_rpm",
    "cp",
    "cp_aero",
    "thrust_kn",
    "torque_knm",
]

# Values only the IEA-15 definition report gives (NREL/TP-5000-75698).
IEA15_REPORT: dict[str, Any] = {
    "source": "Gaertner, E. et al. (2020), NREL/TP-5000-75698",
    "generator": {
        "table": "Table 5-4",
        "type": "permanent-magnet synchronous, radial flux, outer rotor",
        "rated_power_terminals_mw": 15.0,
        "rated_speed_rad_s": 0.792,
        "electrical_frequency_hz": 12.6,
        "rated_torque_mnm": 21.03,
        "air_gap_radius_m": 5.08,
        "core_length_m": 2.17,
        "air_gap_mm": 10.16,
        "poles": 200,
        "stator_slots": 240,
        "line_voltage_rms_v": 4770.34,
        "winding_current_rms_a": 1084.55,
        "stator_resistance_ohm": 0.16,
        "efficiency_full_load": 0.9655,
        "active_mass_t": 214.16,
        "magnet_mass_t": 24.20,
        "copper_mass_t": 9.01,
    },
    "main_shaft": {
        "table": "Table 5-2",
        "length_m": 2.2,
        "outer_radius_m": 3.0,
        "inner_radius_m": 2.8,
        "bearing_spacing_m": 1.2,
        "turret_outer_radius_m": 2.2,
        "turret_inner_radius_m": 2.0,
        "upwind_bearing": "tapered double outer ring (locating), 2,230 kg",
        "downwind_bearing": "spherical roller bearing (non-locating), 5,664 kg",
    },
    "yaw_bearing_diameter_m": 6.5,  # §5.5
    "rigid_rotor_inertia_kg_m2": 3.524605e8,  # §5.7, from the HAWC2 blade file
}


def _download(repo: str, tag: str, path: str) -> bytes:
    url = f"https://raw.githubusercontent.com/{repo}/{tag}/{path}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        data: bytes = resp.read()
    return data


def _rows(workbook: Any, sheet: str) -> list[list[Any]]:
    return [[c for c in row] for row in workbook[sheet].iter_rows(values_only=True)]


def _num(x: Any) -> bool:
    return isinstance(x, int | float)


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
    extra: dict[str, Any] = {}
    masses: dict[str, float] = {}
    for row in _rows(wb, "Overview"):
        if not row or row[0] is None:
            continue
        key, value = row[0], row[1]
        if key in OVERVIEW_KEYS and _num(value):
            overview[OVERVIEW_KEYS[key]] = float(value)
        elif key in OVERVIEW_EXTRA and value is not None:
            extra[OVERVIEW_EXTRA[key]] = round(float(value), 4) if _num(value) else str(value)
        elif key in OVERVIEW_MASSES and _num(value):
            masses[OVERVIEW_MASSES[key]] = round(float(value), 2)
    missing = set(OVERVIEW_KEYS.values()) - overview.keys()
    if missing:
        sys.exit(f"{spec['id']}: Overview sheet lacks {sorted(missing)}")

    perf = _rows(wb, spec["sheet"])
    header = [str(h) for h in perf[0]]
    col = {name: header.index(label) for label, name in PERFORMANCE_COLUMNS.items()}
    rated_kw = overview["rated_mw"] * 1e3
    table: list[tuple[float, ...]] = []
    for row in perf[1:]:
        if not row or not _num(row[col["ws"]]):
            continue  # blank line or the note under the table
        p_kw = float(row[col["power"]]) * 1e3
        if abs(p_kw - rated_kw) < 1.0:
            p_kw = rated_kw  # WISDEM solver tolerance (±0.1 kW) above rated
        table.append(
            (
                round(float(row[col["ws"]]), 4),
                round(min(max(p_kw, 0.0), rated_kw), 1),
                round(float(row[col["ct"]]), 4),
                round(max(float(row[col["pitch"]]), 0.0), 4),
                round(float(row[col["rpm"]]), 4),
                round(float(row[col["cp"]]), 5),
                round(float(row[col["cp_aero"]]), 5),
                round(float(row[col["thrust"]]) * 1e3, 1),
                round(float(row[col["torque"]]) * 1e3, 1),
            )
        )
    if len(table) < 20:
        sys.exit(f"{spec['id']}: only {len(table)} performance rows found")
    rated_ws = next(r[0] for r in table if r[1] >= rated_kw - 0.5)

    components: dict[str, float] = {}
    nacelle = _rows(wb, "Nacelle Mass Properties")
    for row in nacelle[1:]:
        if row and isinstance(row[0], str) and len(row) > 1 and _num(row[1]) and row[1] > 0:
            components[row[0]] = round(float(row[1]), 1)

    return {
        "id": spec["id"],
        "name": spec["name"],
        "rated_kw": rated_kw,
        "rotor_diameter_m": round(overview["rotor_diameter_m"], 2),
        "hub_height_m": overview["hub_height_m"],
        "cut_in_ms": overview["cut_in_ms"],
        "rated_ms": rated_ws,
        "cut_out_ms": overview["cut_out_ms"],
        **extra,
        "masses_t": masses,
        "nacelle_components_kg": components,
        "source": (
            f"github.com/{spec['repo']} @ {spec['tag']}, {spec['path']}, sheets 'Overview', "
            f"'{spec['sheet']}', 'Nacelle Mass Properties'"
        ),
        "license": "Apache-2.0",
        "reference": spec["reference"],
        "retrieved": datetime.now(UTC).date().isoformat(),
        "table": table,
    }


# ── ROSCO / OpenFAST text files (IEA-15) ──────────────────────────────────────


def _floats(line: str) -> list[float]:
    return [float(x) for x in re.findall(r"-?\d+(?:\.\d*)?(?:[eE][-+]?\d+)?", line)]


def parse_cp_ct_cq(text: str) -> dict[str, Any]:
    """ROSCO ``Cp_Ct_Cq.*.txt``: pitch vector, TSR vector, then three matrices."""
    lines = [ln.strip() for ln in text.splitlines()]

    def after(marker: str) -> int:
        return next(i for i, ln in enumerate(lines) if ln.startswith("#") and marker in ln)

    pitch = _floats(lines[after("Pitch angle vector") + 1])
    tsr = _floats(lines[after("TSR vector") + 1])

    def matrix(marker: str) -> list[list[float]]:
        rows: list[list[float]] = []
        for ln in lines[after(marker) + 1 :]:
            if ln.startswith("#"):
                break
            if ln:
                rows.append([round(v, 6) for v in _floats(ln)])
        if len(rows) != len(tsr) or any(len(r) != len(pitch) for r in rows):
            sys.exit(f"Cp_Ct_Cq: {marker} matrix is not {len(tsr)} × {len(pitch)}")
        return rows

    return {
        "pitch_deg": pitch,
        "tsr": tsr,
        "cp": matrix("Power coefficient"),
        "ct": matrix("Thrust coefficient"),
        "cq": matrix("Torque coefficient"),
    }


def parse_discon(text: str) -> dict[str, list[float]]:
    """``value(s) ! NAME - description`` lines of a ROSCO DISCON.IN."""
    out: dict[str, list[float]] = {}
    for ln in text.splitlines():
        if "!" not in ln:
            continue
        values, _, rest = ln.partition("!")
        name = rest.strip().split()[0] if rest.strip() else ""
        nums = _floats(values)
        if name and nums:
            out[name] = nums
    return out


def parse_elastodyn(text: str) -> dict[str, float]:
    """``value NAME - description`` lines of an OpenFAST ElastoDyn file."""
    out: dict[str, float] = {}
    for ln in text.splitlines():
        parts = ln.split()
        if len(parts) >= 2 and re.fullmatch(r"-?\d+(?:\.\d*)?(?:[eE][-+]?\d+)?", parts[0]):
            out[parts[1]] = float(parts[0])
    return out


def read_rosco(spec: dict[str, Any]) -> dict[str, Any]:
    files = spec["rosco"]
    perf = parse_cp_ct_cq(_download(spec["repo"], spec["tag"], files["performance"]).decode())
    d = parse_discon(_download(spec["repo"], spec["tag"], files["discon"]).decode())
    e = parse_elastodyn(_download(spec["repo"], spec["tag"], files["elastodyn"]).decode())

    def one(name: str) -> float:
        return d[name][0]

    base = f"github.com/{spec['repo']} @ {spec['tag']}"
    return {
        "id": spec["id"],
        "license": "Apache-2.0",
        "retrieved": datetime.now(UTC).date().isoformat(),
        "performance_surface": {"source": f"{base}, {files['performance']}", **perf},
        "controller": {
            "source": f"{base}, {files['discon']}",
            "rated_power_w": one("VS_RtPwr"),
            "rated_torque_nm": one("VS_RtTq"),
            "max_torque_nm": one("VS_MaxTq"),
            "max_torque_rate_nm_s": one("VS_MaxRat"),
            "rated_speed_rad_s": one("VS_RefSpd"),
            "pitch_ref_speed_rad_s": one("PC_RefSpd"),
            "min_speed_rad_s": one("VS_MinOMSpd"),
            "rgn2_k_nm_s2": one("VS_Rgn2K"),
            "vs_kp": one("VS_KP"),
            "vs_ki": one("VS_KI"),
            "generator_efficiency": one("VS_GenEff") / 100.0,
            "tsr_opt": one("VS_TSRopt"),
            "pitch_min_rad": one("PC_MinPit"),
            "pitch_max_rad": one("PC_MaxPit"),
            "pitch_max_rate_rad_s": one("PC_MaxRat"),
            "pitch_gain_schedule": {
                "pitch_rad": d["PC_GS_angles"],
                "kp_s": d["PC_GS_KP"],
                "ki": d["PC_GS_KI"],
            },
            "min_pitch_schedule": {"wind_ms": d["PS_WindSpeeds"], "pitch_rad": d["PS_BldPitchMin"]},
            "yaw_rate_rad_s": one("Y_Rate"),
            "yaw_error_threshold_deg": d["Y_ErrThresh"][-1],
            "overspeed_shutdown_rad_s": one("SD_MaxGenSpd"),
            "estimator_inertia_kg_m2": one("WE_Jtot"),
            "speed_filter_corner_rad_s": one("F_LPFCornerFreq"),
            "speed_filter_damping": one("F_LPFDamping"),
            "vs_ref_corner_rad_s": one("F_VSRefSpdCornerFreq"),
            "setpoint_smoother_corner_rad_s": one("F_SSCornerFreq"),
            "setpoint_smoother_vs_gain": one("SS_VSGain"),
            "setpoint_smoother_pc_gain": one("SS_PCGain"),
        },
        "drivetrain": {
            "source": f"{base}, {files['elastodyn']}",
            "gearbox_ratio": e["GBRatio"],
            "gearbox_efficiency": e["GBoxEff"] / 100.0,
            "generator_inertia_kg_m2": e["GenIner"],
            "hub_inertia_kg_m2": e["HubIner"],
            "hub_mass_kg": e["HubMass"],
            "shaft_stiffness_nm_rad": e["DTTorSpr"],
            "shaft_damping_nm_s_rad": e["DTTorDmp"],
        },
        "report": IEA15_REPORT,
    }


# ── Frontend constants ────────────────────────────────────────────────────────


def write_ts(turbines: list[dict[str, Any]]) -> str:
    lines = [
        "/**",
        " * Reference turbines for the layout canvas, the landing simulation and every frontend",
        " * energy estimate.",
        " *",
        " * GENERATED by backend/scripts/fetch_turbine_curves.py from the official IEA Wind",
        " * Task 37 tables (Apache-2.0) — do not edit by hand;",
        " * backend/tests/test_turbine_models.py checks it against backend/app/data/turbines/.",
        " * Power in kW, wind speed in m/s, rotor speed in rpm, pitch in degrees.",
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
        '  /** e.g. "Low speed, Direct drive" (workbook Overview). */',
        "  drivetrain: string;",
        "  minRotorRpm: number;",
        "  maxRotorRpm: number;",
        "  /** Electrical / aerodynamic power (workbook Overview, generator rated efficiency). */",
        "  generatorEfficiency: number;",
        "  source: string;",
        "  license: string;",
        "  /** [wind speed m/s, power kW, thrust coefficient] rows, ascending wind speed. */",
        "  table: readonly (readonly [number, number, number])[];",
        "  /** Same rows: [pitch deg, rotor rpm, aerodynamic Cp, thrust kN, rotor torque kNm]. */",
        "  operating: readonly (readonly [number, number, number, number, number])[];",
        "}",
        "",
        "export const TURBINE_MODELS: Record<string, TurbineModel> = {",
    ]
    for t in turbines:
        rows = ", ".join(f"[{r[0]}, {r[1]}, {r[2]}]" for r in t["table"])
        ops = ", ".join(f"[{r[3]}, {r[4]}, {r[6]}, {r[7]}, {r[8]}]" for r in t["table"])
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
            f'    drivetrain: "{t["drivetrain"]}",',
            f"    minRotorRpm: {t['min_rotor_rpm']:g},",
            f"    maxRotorRpm: {t['max_rotor_rpm']:g},",
            f"    generatorEfficiency: {t['generator_efficiency']:g},",
            f'    source: "{t["source"]}",',
            f'    license: "{t["license"]}",',
            f"    table: [{rows}],",
            f"    operating: [{ops}],",
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
    roscos = [read_rosco(spec) for spec in TURBINES if "rosco" in spec]
    for t in turbines:
        print(
            f"{t['id']}: {len(t['table'])} rows, D {t['rotor_diameter_m']} m, hub "
            f"{t['hub_height_m']:g} m, {t['cut_in_ms']:g} / {t['rated_ms']} / "
            f"{t['cut_out_ms']:g} m/s, {t['rated_kw']:g} kW, {t['drivetrain']}, "
            f"{t['min_rotor_rpm']:g}–{t['max_rotor_rpm']:g} rpm"
        )
    for r in roscos:
        s = r["performance_surface"]
        print(
            f"{r['id']} ROSCO: Cp {len(s['tsr'])} × {len(s['pitch_deg'])}, controller + drivetrain"
        )
    if args.dry_run:
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    meta = []
    for t in turbines:
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow(CSV_HEADER)
        w.writerows(t["table"])
        (OUT_DIR / f"{t['id']}.csv").write_text(buf.getvalue(), encoding="utf-8")
        meta.append({k: v for k, v in t.items() if k != "table"})
    (OUT_DIR / "turbines.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    for r in roscos:
        (OUT_DIR / f"{r['id']}_rosco.json").write_text(
            json.dumps(r, indent=1) + "\n", encoding="utf-8"
        )
    TS_OUT.write_text(write_ts(turbines), encoding="utf-8")
    print(f"wrote {OUT_DIR} and {TS_OUT}")


if __name__ == "__main__":
    main()

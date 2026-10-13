"""Write (or check) the SHA-256 manifest of every dataset bundled with the backend.

    cd backend && python scripts/data_manifest.py          # rewrite data_manifest.json
    cd backend && python scripts/data_manifest.py --check  # exit 1 if a file changed

Every result the platform reports rests on these files (hindcast, ENTSO-E series, turbine
tables, CARE SCADA extracts, ...). The manifest pins their exact bytes so a published
number can be traced to the data that produced it; tests/test_data_manifest.py fails when a
file changes without the manifest. ``provenance`` names the module whose docstring cites
the source and the script that fetched or built the file.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
MANIFEST = BACKEND / "data_manifest.json"
DATA_DIRS = ("app/data", "app/services")

# file name → (documented in, produced by)
PROVENANCE: dict[str, tuple[str, str]] = {
    "IEA-15-240-RWT.csv": ("app/services/p1/turbine_models.py", "scripts/fetch_turbine_curves.py"),
    "IEA-15-240-RWT_rosco.json": (
        "app/services/p1/turbine_models.py",
        "scripts/fetch_turbine_curves.py",
    ),
    "IEA-22-280-RWT.csv": ("app/services/p1/turbine_models.py", "scripts/fetch_turbine_curves.py"),
    "turbines.json": ("app/services/p1/turbine_models.py", "scripts/fetch_turbine_curves.py"),
    "care_farm_b.json": (
        "app/services/digital_twin/care_benchmark.py",
        "scripts/build_care_benchmark.py",
    ),
    "care_farm_c.json": (
        "app/services/digital_twin/care_benchmark.py",
        "scripts/build_care_benchmark.py",
    ),
    "sb510_ice.json": ("app/services/lifecycle/weather.py", "scripts/process_cmems.py"),
    "sb510_metocean_6h.csv.gz": ("app/services/lifecycle/weather.py", "scripts/process_cmems.py"),
    "cmems_metocean.json": ("app/services/p1/metocean.py", "scripts/process_cmems.py"),
    "dk2_deep_predictions.csv.gz": (
        "app/services/p4/real_data.py",
        "scripts/train_real_deep_models.py",
    ),
    "dk2_offshore_dayahead.csv.gz": (
        "app/services/p4/real_data.py",
        "scripts/fetch_real_forecast_data.py",
    ),
    "dk2_tso_dayahead.csv.gz": (
        "app/services/p4/real_data.py",
        "scripts/fetch_real_forecast_data.py",
    ),
    "entsoe_kriegers_flak.csv.gz": (
        "app/services/p1/aep_validation.py",
        "scripts/fetch_validation_farms.py",
    ),
    "entsoe_roedsand1.csv.gz": (
        "app/services/p1/aep_validation.py",
        "scripts/fetch_validation_farms.py",
    ),
    "entsoe_roedsand2.csv.gz": (
        "app/services/p1/aep_validation.py",
        "scripts/fetch_validation_farms.py",
    ),
    "entsoe_units.json": ("app/services/p4/real_data.py", "scripts/fetch_entsoe_units.py"),
    "baltic_power_energisation.json": (
        "app/routers/p5/real_data.py",
        "scripts/fetch_entsoe_units.py",
    ),
    "SOURCES.md": ("app/services/site_assessment/data/SOURCES.md", "(hand-written)"),
    "southern_baltic.json": (
        "app/services/site_assessment/data/SOURCES.md",
        "scripts/fetch_marine_layers.py, scripts/fetch_wind_climate.py",
    ),
}


# whole directories documented together (their SOURCES.md cites each file)
DIR_PROVENANCE: dict[str, tuple[str, str]] = {
    "app/services/p1/validation_data/pywake": (
        "app/services/p1/validation_data/pywake/SOURCES.md",
        "copied from PyWake v2.6.7 (MIT)",
    ),
    "app/services/p1/validation_data/roedsand2": (
        "app/services/p1/validation_data/roedsand2/SOURCES.md",
        "scripts/fetch_validation_farms.py",
    ),
}


def data_files() -> list[Path]:
    files = [
        p
        for d in DATA_DIRS
        for p in (BACKEND / d).rglob("*")
        if p.is_file()
        and {"data", "validation_data"} & set(p.relative_to(BACKEND).parts)
        and "__pycache__" not in p.parts
    ]
    # Sort by POSIX string: Windows Path ordering is case-insensitive, Linux's is not.
    return sorted(files, key=lambda p: p.relative_to(BACKEND).as_posix())


def _canonical_bytes(p: Path) -> bytes:
    """The bytes as git stores them: text files with LF line ends (a Windows checkout with
    core.autocrlf has CRLF), compressed files as they are."""
    raw = p.read_bytes()
    return raw if p.suffix == ".gz" else raw.replace(b"\r\n", b"\n")


def build() -> dict[str, object]:
    items = []
    for p in data_files():
        rel_dir = p.parent.relative_to(BACKEND).as_posix()
        documented, produced = DIR_PROVENANCE.get(rel_dir) or PROVENANCE.get(p.name, ("", ""))
        items.append(
            {
                "path": p.relative_to(BACKEND).as_posix(),
                "bytes": len(_canonical_bytes(p)),
                "sha256": hashlib.sha256(_canonical_bytes(p)).hexdigest(),
                "documented_in": documented,
                "produced_by": produced,
            }
        )
    return {"algorithm": "sha256", "files": items}


def main(argv: list[str]) -> int:
    manifest = build()
    if "--check" in argv:
        old = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
        if old != manifest:
            print("data_manifest.json is stale: python scripts/data_manifest.py")
            return 1
        return 0
    MANIFEST.write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    print(f"{len(manifest['files'])} files → {MANIFEST.name}")  # type: ignore[arg-type]
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

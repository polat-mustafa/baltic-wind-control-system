"""Polish transmission system (KSE) for the HV Grid page map.

    python scripts/fetch_pl_grid.py            → frontend/src/data/plGrid.json

Lines ≥ 220 kV with at least one end in Poland (so the interconnectors with DE, CZ,
SK, UA and LT come along) and the SwePol HVDC link, from the OpenStreetMap grid
prebuilt for PyPSA-Eur (Zenodo 10.5281/zenodo.18619025, ODbL); PSE substations
≥ 220 kV from OpenStreetMap (Overpass). Routes simplified to ~300 m.

Checked against ENTSO-E's "Interconnected network of Northern Europe 2024" map
(a print, no coordinates): the Polish stations it names are listed by --check PDF.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
from fetch_marine_layers import OSM_LICENCE, overpass, pypsa_grid, rdp, short_station_name

OUT = Path(__file__).resolve().parents[2] / "frontend/src/data/plGrid.json"
SIMPLIFY_DEG = 0.003  # ≈ 330 m north-south: a national map, not a route survey


def stations() -> list[dict[str, Any]]:
    """PSE substations ≥ 220 kV in Poland (existing and under construction)."""
    print("  OpenStreetMap: PSE substations ≥ 220 kV")
    elements = overpass(
        '[out:json][timeout:300];area["ISO3166-1"="PL"][admin_level=2]->.pl;('
        'nwr["power"="substation"]["voltage"~"(220000|400000|750000)"](area.pl);'
        'nwr["construction:power"="substation"]["voltage"~"(220000|400000)"](area.pl);'
        ");out tags center;"
    )
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for e in elements:
        t = e.get("tags", {})
        if "PSE" not in t.get("operator", "") and "Polskie Sieci" not in t.get("operator", ""):
            continue  # wind-farm, industrial and distribution stations
        kv = sorted(
            {int(v) // 1000 for v in t.get("voltage", "").split(";") if v.isdigit()}, reverse=True
        )
        name = short_station_name(t.get("name", ""), kv)
        c = e.get("center") or {"lat": e.get("lat"), "lon": e.get("lon")}
        if not name or name in seen or c.get("lat") is None:
            continue
        seen.add(name)
        building = "construction:power" in t or t.get("power") == "construction"
        out.append(
            {
                "name": name,
                "kv": kv,
                "c": [round(float(c["lon"]), 4), round(float(c["lat"]), 4)],
                **({"status": "under construction"} if building else {}),
            }
        )
    return sorted(out, key=lambda s: s["name"])


def lines() -> list[dict[str, Any]]:
    out = []
    for g in pypsa_grid():
        if "PL" not in g["countries"]:
            continue
        pts = rdp(np.asarray(g["pts"], dtype=float), SIMPLIFY_DEG)
        others = sorted({c for c in g["countries"] if c and c != "PL"})
        out.append(
            {
                "c": [[round(float(x), 3), round(float(y), 3)] for x, y in pts],
                "kv": int(g["kv"]),
                "kind": "DC" if g["kind"] == "HVDC link" else "AC",
                "circuits": g["circuits"],
                "km": round(g["length_km"], 1),
                **({"to": others[0]} if others else {}),
                **({"status": "under construction"} if g["under_construction"] else {}),
            }
        )
    return out


def check_pdf(pdf: Path, names: list[str]) -> dict[str, Any]:
    """Which OSM station names the ENTSO-E map print also names (text layer of the PDF)."""
    from pypdf import PdfReader

    text = " ".join(page.extract_text() or "" for page in PdfReader(pdf).pages)
    found = [n for n in names if re.sub(r"\s[\d/]+ kV$", "", n).split()[0] in text]
    print(f"  {len(found)} of {len(names)} PSE stations also on the ENTSO-E map")
    for n in names:
        if n not in found:
            print(f"    not on the map print: {n}")
    return {"map": pdf.stem, "named": len(found), "stations": len(names)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--check", type=Path, help="ENTSO-E grid map PDF to compare station names with"
    )
    args = parser.parse_args()
    data = {
        "title": "Polish transmission system (KSE) ≥ 220 kV",
        "source": "OpenStreetMap power lines prebuilt for PyPSA-Eur (Xiong et al. 2025, Zenodo "
        "10.5281/zenodo.18619025, 2026-02-12); PSE substations from OpenStreetMap (Overpass). "
        "Cross-checked with ENTSO-E, Interconnected network of Northern Europe 2024.",
        "license": OSM_LICENCE,
        "retrieved": datetime.now(UTC).date().isoformat(),
        "lines": lines(),
        "stations": stations(),
    }
    if args.check:
        data["entsoe_check"] = check_pdf(args.check, [s["name"] for s in data["stations"]])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    kv = {
        k: sum(1 for x in data["lines"] if x["kv"] == k)
        for k in sorted({x["kv"] for x in data["lines"]})
    }
    print(f"  {len(data['lines'])} lines {kv}, {len(data['stations'])} stations")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KiB)")


if __name__ == "__main__":
    main()

"""Validation report for a release: the Evidence rows, the model cards and the engineering
audit in one printable HTML file, and a PDF of it when a Chrome is found.

    cd backend && python scripts/validation_report.py [version] [out-dir]

The Evidence rows come from frontend/src/data/evidence.json (rebuilt by
scripts/build_evidence.py, checked by every test run). The release workflow
(.github/workflows/release-report.yml) attaches the PDF to each GitHub release.
"""

from __future__ import annotations

import datetime as dt
import html
import json
import shutil
import subprocess
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[2]
DOCS = ("docs/model-cards.md", "docs/engineering-audit-2026-10.md")
CHROMES = (
    "google-chrome",
    "chromium",
    "chromium-browser",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
)
CSS = """
body { font: 10.5pt/1.45 system-ui, sans-serif; margin: 18mm; color: #111; }
h1 { font-size: 20pt; } h2 { font-size: 14pt; margin-top: 1.6em; } h3 { font-size: 12pt; }
table { border-collapse: collapse; width: 100%; font-size: 8.5pt; margin: .6em 0; }
th, td { border: 1px solid #bbb; padding: 3px 5px; vertical-align: top; text-align: left; }
th { background: #eee; } code { font-size: 8.5pt; } .page { break-before: page; }
"""


def evidence_table() -> str:
    items = json.loads((ROOT / "frontend/src/data/evidence.json").read_text("utf-8"))["items"]
    rows = "".join(
        "<tr>"
        + "".join(
            f"<td>{html.escape(str(c))}</td>"
            for c in (
                e["area"],
                e["claim"],
                e["against"],
                e["metric"],
                f"{e['value']:g} {e.get('unit', '')}".strip(),
                e.get("limit", ""),
                e["kind"],
            )
        )
        + "</tr>"
        for e in items
    )
    head = "".join(
        f"<th>{h}</th>"
        for h in ("Area", "Claim", "Checked against", "Metric", "Value", "Limit", "Kind")
    )
    return (
        f"<h2>Evidence ({len(items)} checks)</h2><p>Every row is written by a test "
        "(<code>pytest -m validation</code>); a later run fails if the value drifts.</p>"
        f"<table><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>"
    )


def build(version: str, out: Path) -> Path:
    body = [
        f"<h1>OffshoreForge {html.escape(version)} — validation report</h1>",
        f"<p>Generated {dt.date.today().isoformat()} from the repository at this release.</p>",
        evidence_table(),
    ]
    for doc in DOCS:
        text = (ROOT / doc).read_text("utf-8")
        body.append(
            '<div class="page">' + markdown.markdown(text, extensions=["tables"]) + "</div>"
        )
    out.mkdir(parents=True, exist_ok=True)
    page = out / f"offshoreforge-{version}-validation-report.html"
    page.write_text(
        f"<!doctype html><meta charset='utf-8'><title>OffshoreForge {version} validation</title>"
        f"<style>{CSS}</style>{''.join(body)}",
        encoding="utf-8",
    )
    return page


def to_pdf(page: Path) -> Path | None:
    chrome = next((c for c in CHROMES if shutil.which(c) or Path(c).exists()), None)
    if chrome is None:
        return None
    pdf = page.with_suffix(".pdf")
    subprocess.run(
        [chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={pdf}", page.resolve().as_uri()],
        check=True,
        capture_output=True,
    )  # fmt: skip
    return pdf


if __name__ == "__main__":
    version = sys.argv[1] if len(sys.argv) > 1 else "dev"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "dist"
    page = build(version, out)
    pdf = to_pdf(page)
    print(pdf or page)

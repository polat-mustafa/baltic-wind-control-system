"""Check every DOI and web link cited in the docs and the frontend (evidence programme B5).

    cd backend && python scripts/check_links.py

DOIs are resolved through the doi.org handle API (200 = registered, 404 = no such DOI), so
publishers that block bots (403) do not hide or fake a dead citation. Plain links fail only
when they are really gone — 404 / 410 or a host name that no longer resolves; a host that is
down (refused, timeout) is reported but does not fail. Run weekly by .github/workflows/links.yml.
"""

from __future__ import annotations

import concurrent.futures as cf
import re
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = [ROOT / "docs", ROOT / "frontend" / "src"]
SUFFIXES = {".md", ".ts", ".tsx"}
URL = re.compile(r"https?://[^\s\"'`<>\]|,;]+")
DOI = re.compile(r"\b10\.\d{4,9}/[^\s\"'`<>)\],;]+")
SKIP = ("localhost", "127.0.0.1", "example.com", "${", "github.com/polat-mustafa")
DEAD = {404, 410}
HEADERS = {"User-Agent": "Mozilla/5.0 (OffshoreForge link check)"}


def _get(url: str) -> int | str:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as r:
            return int(r.status)
    except urllib.error.HTTPError as e:
        return e.code
    except urllib.error.URLError as e:
        return "DNS" if isinstance(e.reason, socket.gaierror) else f"down ({e.reason})"
    except Exception as e:  # TLS, timeout
        return f"down ({type(e).__name__})"


def check(kind: str, ref: str) -> tuple[str, str, int | str, bool]:
    if kind == "doi":
        status = _get(f"https://doi.org/api/handles/{ref}")
        return kind, ref, status, status == 200
    status = _get(ref)
    return kind, ref, status, status not in DEAD and status != "DNS"


def collect() -> dict[tuple[str, str], list[str]]:
    found: dict[tuple[str, str], list[str]] = {}
    for base in SOURCES:
        for f in base.rglob("*"):
            if f.suffix not in SUFFIXES or "node_modules" in f.parts:
                continue
            text = f.read_text(encoding="utf-8", errors="ignore")
            where = str(f.relative_to(ROOT)).replace("\\", "/")
            for u in URL.findall(text):
                u = u.rstrip(".")
                while u.endswith(")") and u.count(")") > u.count("("):  # "(see https://…)"
                    u = u[:-1]
                if any(s in u for s in SKIP):
                    continue
                key = ("doi", u.split("doi.org/", 1)[1]) if "doi.org/10." in u else ("url", u)
                found.setdefault(key, []).append(where)
            for d in DOI.findall(text):
                found.setdefault(("doi", d.rstrip(".")), []).append(where)
    return found


def main() -> int:
    found = collect()
    with cf.ThreadPoolExecutor(12) as ex:
        results = list(ex.map(lambda k: check(*k), found))
    bad = [r for r in results if not r[3]]
    down = [r for r in results if r[3] and str(r[2]).startswith("down")]
    for label, rows in (("DEAD", bad), ("DOWN", down)):
        for kind, ref, status, _ in sorted(rows, key=lambda r: r[1]):
            cited = ", ".join(sorted(set(found[(kind, ref)])))
            print(f"{label} {kind} {ref} ({status}) - cited in {cited}")
    print(f"{len(results)} links and DOIs checked: {len(bad)} dead, {len(down)} host down")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

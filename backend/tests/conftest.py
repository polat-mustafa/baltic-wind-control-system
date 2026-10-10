"""
Shared test fixtures.

``evidence`` — the validation tests record what they checked (claim, reference, metric,
value, limit) for the in-app Evidence page. ``scripts/build_evidence.py`` runs them with
``EVIDENCE_WRITE=1`` and writes ``frontend/src/data/evidence.json``; in every other run a
recorded value must match the committed one (2 % + 0.001), so the page cannot go stale.
"""

from __future__ import annotations

import json
import os
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

EVIDENCE_FILE = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "evidence.json"
_RECORDED: list[dict[str, Any]] = []


def _committed() -> dict[str, dict[str, Any]]:
    if not EVIDENCE_FILE.exists():
        return {}
    return {e["id"]: e for e in json.loads(EVIDENCE_FILE.read_text(encoding="utf-8"))["items"]}


@pytest.fixture
def evidence(request: pytest.FixtureRequest) -> Callable[..., None]:
    test_file = "backend/" + request.node.nodeid.split("::")[0].replace("\\", "/")

    def record(
        id: str,
        *,
        area: str,
        claim: str,
        against: str,
        metric: str,
        value: float,
        unit: str = "",
        limit: str = "",
    ) -> None:
        entry = {
            "id": id,
            "area": area,
            "claim": claim,
            "against": against,
            "metric": metric,
            "value": round(float(value), 4),
            "unit": unit,
            "limit": limit,
            "test": test_file,
        }
        if os.environ.get("EVIDENCE_WRITE"):
            _RECORDED.append(entry)
            return
        old = _committed().get(id)
        assert old is not None, f"evidence {id!r} missing: run scripts/build_evidence.py"
        assert abs(old["value"] - entry["value"]) <= 0.02 * abs(old["value"]) + 1e-3, (
            f"evidence {id!r} changed {old['value']} → {entry['value']}: "
            "run scripts/build_evidence.py and commit evidence.json"
        )

    return record


def pytest_sessionfinish(session: pytest.Session) -> None:
    if not (os.environ.get("EVIDENCE_WRITE") and _RECORDED):
        return
    items = _committed() | {e["id"]: e for e in _RECORDED}
    EVIDENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_FILE.write_text(
        json.dumps(
            {"items": sorted(items.values(), key=lambda e: (e["area"], e["id"]))},
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )

"""Score the AI tutor on scripts/tutor_eval.json with a real model (before a release).

    cd backend
    export TUTOR_PROVIDER=openrouter TUTOR_MODEL=<model id> TUTOR_API_KEY=<key>
    python scripts/tutor_eval.py

A case passes when the required tool was called, every expected number appears in the
answer (from the tool's own output, so the set never goes stale) and one of the required
words appears. Exits 1 below 80 %. The key is read from the environment and never printed.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import tutor

EVAL = Path(__file__).with_name("tutor_eval.json")
PASS_RATE = 0.8
NUMBER = re.compile(r"-?\d+(?:[.,]\d+)?")


def expected_values(case: dict[str, Any]) -> list[tuple[float, float, float]]:
    """(value, rel tol, abs tol) per expected number."""
    out = []
    for e in case.get("expect", []):
        v = (
            e["value"]
            if "value" in e
            else tutor.run_tool(e["tool"], json.dumps(e["args"]))[e["field"]]
        )
        out.append((float(v), float(e.get("rel", 0.02)), float(e.get("abs", 0.0))))
    return out


def found(answer: str, value: float, rel: float, abs_tol: float) -> bool:
    nums = [float(n.replace(",", ".")) for n in NUMBER.findall(answer.replace(" ", ""))]
    targets = (value, value / 1000, value * 1000)  # kW ↔ MW, kN ↔ MN
    return any(abs(n - t) <= max(rel * abs(t), abs_tol) for n in nums for t in targets)


def score(case: dict[str, Any], out: dict[str, Any]) -> list[str]:
    misses = []
    if case.get("tool") and case["tool"] not in {t["name"] for t in out["tools"]}:
        misses.append(f"tool {case['tool']} not called")
    for v, rel, abs_tol in expected_values(case):
        if not found(out["answer"], v, rel, abs_tol):
            misses.append(f"number {v:g} missing")
    words = case.get("contains_any")
    if words and not any(w.lower() in out["answer"].lower() for w in words):
        misses.append(f"none of {words}")
    return misses


def main() -> int:
    provider, key = os.environ.get("TUTOR_PROVIDER", "openrouter"), os.environ.get("TUTOR_API_KEY")
    if not key:
        print("Set TUTOR_API_KEY (and TUTOR_PROVIDER / TUTOR_MODEL).")
        return 2
    cases = json.loads(EVAL.read_text(encoding="utf-8"))["cases"]
    passed = 0
    for case in cases:
        _, s = tutor.new_session()
        tutor.connect(s, provider, key, os.environ.get("TUTOR_MODEL", ""))
        try:
            out = tutor.chat(s, [], case["question"], case["page"])
            misses = score(case, out)
        except tutor.TutorError as e:
            misses = [str(e)]
        passed += not misses
        print(f"{'PASS' if not misses else 'FAIL'} {case['id']:16} {'; '.join(misses)}")
    rate = passed / len(cases)
    print(f"{passed}/{len(cases)} passed ({rate:.0%}), model {s.model}")
    return 0 if rate >= PASS_RATE else 1


if __name__ == "__main__":
    sys.exit(main())

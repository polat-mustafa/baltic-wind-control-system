"""Rebuild the in-app Evidence page data from the validation tests.

    cd backend && python scripts/build_evidence.py

Runs the tests that record evidence (``evidence`` fixture, tests/conftest.py) with
EVIDENCE_WRITE=1, which writes frontend/src/data/evidence.json. Commit that file: every
later test run checks its recorded values against it.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
TESTS = ["tests/test_wake_validation.py", "tests/test_p2_analytic.py", "tests/test_p4_real_data.py"]


def main() -> int:
    env = {**os.environ, "EVIDENCE_WRITE": "1"}
    # one process (no xdist): the fixture collects in memory and writes at session end
    cmd = [sys.executable, "-m", "pytest", "-q", "-p", "no:xdist", "-p", "no:randomly", *TESTS]
    return subprocess.run(cmd, cwd=BACKEND, env=env, check=False).returncode


if __name__ == "__main__":
    sys.exit(main())

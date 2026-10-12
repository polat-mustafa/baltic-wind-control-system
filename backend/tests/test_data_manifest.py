"""Bundled datasets match their SHA-256 manifest (scripts/data_manifest.py)."""

import importlib.util
import json
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "data_manifest.py"


def _module():
    spec = importlib.util.spec_from_file_location("data_manifest", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_every_bundled_dataset_matches_the_manifest():
    mod = _module()
    committed = json.loads(mod.MANIFEST.read_text(encoding="utf-8"))
    assert committed == mod.build(), "dataset changed: python scripts/data_manifest.py"


def test_every_dataset_names_its_provenance():
    for f in _module().build()["files"]:
        assert f["documented_in"] and f["produced_by"], f["path"]

"""
The SCL files validate against the IEC 61850-6 SCL schema (engineering audit F7).

The schema is IEC's (copyright, not committed): the Ed. 2 2007B schema as OpenSCD embeds
it (packages/openscd/src/schemas.ts at a pinned commit), downloaded once per run. The test
skips without network access or without lxml (CI installs it: .github/workflows/ci.yml).
"""

from __future__ import annotations

import re
import urllib.request
from functools import cache

import pytest

from app.services.p2.network_model import design
from app.services.p3.iec61850_model import (
    build_oss_goose_control_block,
    build_oss_goose_trip_dataset,
    build_substation_configuration,
)
from app.services.p3.scl_generator import generate_icd, generate_scd, generate_ssd, scl_to_string

etree = pytest.importorskip("lxml.etree")

OPENSCD_COMMIT = "ce61ffe85d37f07db17062efc348028d4a24f3d8"
SCHEMAS_TS = (
    "https://raw.githubusercontent.com/openscd/open-scd/"
    f"{OPENSCD_COMMIT}/packages/openscd/src/schemas.ts"
)


@cache
def _schema():  # type: ignore[no-untyped-def]
    try:
        text = urllib.request.urlopen(SCHEMAS_TS, timeout=30).read().decode()
    except OSError as e:  # no network in this environment
        pytest.skip(f"SCL schema not reachable: {e}")
    xsd = re.search(r"'2007B': `(.*?)`", text, re.S)
    assert xsd, "2007B schema not found in schemas.ts"
    return etree.XMLSchema(etree.fromstring(xsd.group(1).strip().encode()))


def _assert_valid(root) -> None:  # type: ignore[no-untyped-def]
    schema = _schema()
    doc = etree.fromstring(scl_to_string(root).encode())
    assert schema.validate(doc), [e.message for e in schema.error_log][:5]


def test_ssd_is_schema_valid():
    _assert_valid(generate_ssd())


def test_icd_of_every_ied_type_is_schema_valid():
    devices = build_substation_configuration(34)
    prot = devices[0]
    _assert_valid(
        generate_icd(
            prot,
            [build_oss_goose_control_block(prot.name)],
            [build_oss_goose_trip_dataset(prot.name)],
        )
    )
    for kind in {d.equipment_type: d for d in devices}.values():
        _assert_valid(generate_icd(kind))


@pytest.mark.parametrize("strings", [(6, 6, 6, 6, 5, 5), (4, 4)])
def test_scd_is_schema_valid(strings):
    devices = build_substation_configuration(sum(strings))
    prot = devices[0].name
    root = generate_scd(
        "SB510_OSS",
        devices,
        goose_control_blocks={prot: [build_oss_goose_control_block(prot)]},
        datasets={prot: [build_oss_goose_trip_dataset(prot)]},
        spec=design(strings, 108.0),
    )
    _assert_valid(root)

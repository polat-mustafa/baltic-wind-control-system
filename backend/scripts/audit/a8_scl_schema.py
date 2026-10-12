"""Audit A8 — the app's SCL files (IEC 61850-6) against the official SCL XML schema.

The app checks SCL structure with its own rules (``scl_generator.validate_scl_structure``).
This validates the generated SSD, one ICD and the SCD against the IEC 61850-6 SCL XSD
(Ed. 2, 2007B; the IEC schema as embedded in OpenSCD, github.com/openscd/open-scd,
packages/openscd/src/schemas.ts). The XSD is IEC-copyrighted and is not committed: pass
its path (extract the '2007B' entry of schemas.ts to a file).

Run: cd backend && PYTHONPATH=. python scripts/audit/a8_scl_schema.py /path/to/SCL_2007B.xsd
"""

from __future__ import annotations

import sys
from collections import Counter

from lxml import etree


def main(xsd_path: str) -> None:
    from app.services.p3.iec61850_model import build_substation_configuration
    from app.services.p3.scl_generator import (
        generate_icd,
        generate_scd,
        generate_ssd,
        scl_to_string,
    )

    schema = etree.XMLSchema(etree.parse(xsd_path))
    devices = build_substation_configuration(34)
    files = {
        "SSD": generate_ssd("SB510_OSS"),
        f"ICD ({devices[0].name})": generate_icd(devices[0]),
        "SCD": generate_scd("SB510_OSS", devices),
    }
    for name, root in files.items():
        doc = etree.fromstring(scl_to_string(root).encode())
        ok = schema.validate(doc)
        errs = schema.error_log
        print(f"{name}: {'VALID' if ok else f'INVALID — {len(errs)} schema errors'}")
        if not ok:
            kinds = Counter(
                e.message.split(":")[0] if "Element" not in e.message else e.message[:110]
                for e in errs
            )
            for msg, n in kinds.most_common(6):
                print(f"   {n:5d} × {msg}")


if __name__ == "__main__":
    main(sys.argv[1])

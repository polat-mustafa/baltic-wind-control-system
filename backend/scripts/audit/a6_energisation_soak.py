# ruff: noqa: E501
"""Audit A6 — export cable 1 during the 24 h soak of the switching programme.

Step 2 of ``p5/switching_programme.py`` energises cable 1 from shore with its onshore line
reactor, OSS end open, and soaks it 24 h at U0. ``p5/energisation.py`` notes the shore-end
current is 101 % of rating "for the minutes until the OSS end is live". This script reads
the app's own snapshot of that state and the compensation degree that matters for the
zero-missing phenomenon on energisation (CIGRE TB 556: > 50 % shunt compensation on the
switched cable → DC offset, current zeros can be missed for many cycles).

Run: cd backend && PYTHONPATH=. python scripts/audit/a6_energisation_soak.py
"""

from __future__ import annotations

import logging
import warnings

warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)


def main() -> None:
    from app.services.p2.network_model import SB510, export_charging_mvar
    from app.services.p5.energisation import cable_energised_state, network_snapshot

    snap = network_snapshot(cable_energised_state())
    print("Cable 1 energised from shore, OSS end open (soak state, app snapshot):")
    print(
        f"  shore-end cable current {snap.cable_i_send_a:.0f} A → {snap.cable_loading_pct:.1f} % of 825 A"
    )
    print(
        f"  onshore line reactor {-snap.reactor_on_q_mvar:.0f} Mvar, onshore tap {snap.onshore_tap}"
    )
    for b in snap.buses:
        print(f"  {b.name:28s} {b.vm_pu:.4f} pu")
    q_c = export_charging_mvar(SB510.export_length_km)
    k = SB510.reactor_unit_mvar / q_c
    print(
        f"\nCompensation of the switched cable by its line reactor: {SB510.reactor_unit_mvar:.0f} / {q_c:.0f} Mvar = {k:.0%}"
    )
    print(
        "  > 50 % → zero-missing phenomenon possible on energisation (needs an EMT study / point-on-wave)"
    )


if __name__ == "__main__":
    main()

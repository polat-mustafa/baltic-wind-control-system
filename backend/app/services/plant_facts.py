"""The SB-510 numbers the platform quotes, taken from the models that use them.

One source for the education guard (``tests/test_plant_facts.py`` → frontend
``src/data/plantFacts.json``) and for the AI tutor's ``plant_facts`` tool.
"""

from __future__ import annotations

from app.services.p1.turbine_models import get_turbine
from app.services.p2.frt_simulation import DEAD_BAND_PU, K_FACTOR_RANGE, PSE_FRT_PROFILE
from app.services.p2.network_model import SB510
from app.services.p5.switching_programme import create_oss_energisation_programme


def plant_facts() -> dict[str, object]:
    t = get_turbine()
    return {
        "turbines": SB510.num_turbines,
        "turbine_mw": SB510.turbine_rated_mw,
        "capacity_mw": SB510.capacity_mw,
        "export_km": SB510.export_length_km,
        "reactors": SB510.num_reactors,
        "reactor_mvar": SB510.reactor_unit_mvar,
        "statcom_mvar": SB510.statcom_mvar,
        "cable_charging_mvar": round(SB510.cable_q_mvar),  # rule 7, ωCV²L, both circuits
        "rotor_diameter_m": t.rotor_diameter_m,
        "cut_in_ms": t.cut_in_ms,
        "rated_ms": t.rated_ms,
        "cut_out_ms": t.cut_out_ms,
        "min_rotor_rpm": t.min_rotor_rpm,
        "max_rotor_rpm": t.max_rotor_rpm,
        "pse_frt_profile": [list(p) for p in PSE_FRT_PROFILE],
        "frt_k_min": K_FACTOR_RANGE[0],
        "frt_dead_band_pu": DEAD_BAND_PU,
        "programme_steps": len(create_oss_energisation_programme("facts").steps),
    }

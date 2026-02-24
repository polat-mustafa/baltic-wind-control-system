"""
IEC 60909 short-circuit analysis for 510 MW offshore wind farm.

Calculates initial symmetrical short-circuit current (Ik''), peak current (ip),
and short-circuit power (Sk'') at every bus using Pandapower's built-in
IEC 60909 method (Engineering Rule 3: use Pandapower built-in, NOT custom).

Physics — IEC 60909 Short-Circuit Current
-------------------------------------------
The initial symmetrical short-circuit current at bus k is:

  Ik'' = c × V_n / (√3 × Z_k)

where:
  c   = voltage factor (1.1 for max, 0.95 for min per IEC 60909 Table 1)
  V_n = nominal voltage [V]
  Z_k = equivalent short-circuit impedance seen from bus k [Ω]

The peak current accounts for the DC component decay:
  ip = κ × √2 × Ik''

where κ depends on the R/X ratio at the fault location (κ ≈ 1.02–2.0).

The short-circuit power is:
  Sk'' = √3 × V_n × Ik''  [MVA]

Voltage Factor c (IEC 60909, Table 1)
--------------------------------------
| Voltage Level      | c_max | c_min |
|--------------------|-------|-------|
| LV (≤ 1 kV)       | 1.05  | 0.95  |
| MV (1–35 kV)      | 1.10  | 1.00  |
| HV (> 35 kV)      | 1.10  | 1.00  |

For our 66/220/400 kV network: c_max = 1.1, c_min = 1.0

Breaker Adequacy
-----------------
Circuit breakers must be rated for:
  - Breaking capacity ≥ Ik'' (symmetrical)
  - Making capacity ≥ ip (peak)
Typical ratings: 31.5 kA / 40 kA / 50 kA (IEC 62271-100)

References
----------
- IEC 60909-0: Short-circuit currents in three-phase a.c. systems
- IEC 62271-100: High-voltage switchgear — AC circuit-breakers
- Pandapower: pp.shortcircuit.calc_sc() — built-in IEC 60909
- Schlabbach, J.: Short-Circuit Currents (IET, 2005)

Constants (Baltic Wind Alpha)
-----------------------------
- Grid Ssc: 10,000 MVA at 400 kV
- 66 kV breaker rated: 25 kA
- 220 kV breaker rated: 40 kA
- 400 kV breaker rated: 50 kA
"""

import pandapower.shortcircuit as sc

from app.schemas.grid import ShortCircuitBusResult, ShortCircuitResponse
from app.services.p2.network_model import build_network

# Breaker rated breaking current per voltage level [kA]
BREAKER_RATINGS_KA: dict[float, float] = {
    400.0: 50.0,
    220.0: 40.0,
    66.0: 25.0,
}


def calc_short_circuit(
    case: str = "max",
    export_length_km: float = 45.0,
    grid_ssc_mva: float = 10_000.0,
) -> ShortCircuitResponse:
    """Run IEC 60909 short-circuit calculation for all buses.

    Uses Pandapower's built-in calc_sc() function (Rule 3).

    Parameters
    ----------
    case : str
        'max' (c=1.1) for breaker sizing or 'min' (c=1.0) for protection sensitivity.
    export_length_km : float
        Export cable length [km]. Default: 45.0.
    grid_ssc_mva : float
        Grid short-circuit power at PCC [MVA]. Default: 10,000.

    Returns
    -------
    ShortCircuitResponse
        Per-bus short-circuit results with breaker adequacy assessment.
    """
    if case not in ("max", "min"):
        msg = f"case must be 'max' or 'min', got '{case}'"
        raise ValueError(msg)

    # Build network at full generation (worst case for short-circuit)
    net = build_network(
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
        generation_fraction=1.0,
    )

    # IEC 60909 voltage factor
    c_factor = 1.1 if case == "max" else 1.0

    # Run Pandapower short-circuit calculation (Rule 3: use built-in)
    sc.calc_sc(
        net,
        fault="3ph",
        case=case,
        ip=True,
        ith=False,
        branch_results=False,
    )

    # Extract per-bus results
    bus_results = []
    max_ikss = 0.0
    max_ikss_bus = ""
    all_breakers_adequate = True

    for idx in range(len(net.bus)):
        bus_name = str(net.bus.at[idx, "name"])
        vn_kv = float(net.bus.at[idx, "vn_kv"])
        ikss_ka = float(net.res_bus_sc.at[idx, "ikss_ka"])
        ip_ka = float(net.res_bus_sc.at[idx, "ip_ka"])

        # Short-circuit power: Sk'' = √3 × Vn × Ik''
        skss_mw = 3**0.5 * vn_kv * ikss_ka  # [MVA]

        bus_results.append(
            ShortCircuitBusResult(
                bus_name=bus_name,
                vn_kv=vn_kv,
                ikss_ka=round(ikss_ka, 3),
                ip_ka=round(ip_ka, 3),
                skss_mw=round(skss_mw, 1),
            )
        )

        # Track maximum Ik''
        if ikss_ka > max_ikss:
            max_ikss = ikss_ka
            max_ikss_bus = bus_name

        # Check breaker adequacy
        breaker_rating = BREAKER_RATINGS_KA.get(vn_kv, 50.0)
        if ikss_ka > breaker_rating:
            all_breakers_adequate = False

    return ShortCircuitResponse(
        case=case,
        voltage_factor_c=c_factor,
        bus_results=bus_results,
        max_ikss_ka=round(max_ikss, 3),
        max_ikss_bus=max_ikss_bus,
        breaker_adequate=all_breakers_adequate,
    )

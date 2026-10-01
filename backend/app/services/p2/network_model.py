"""
Pandapower network model for 510 MW Baltic Sea offshore wind farm.

Builds the complete 66/220/400 kV electrical network as a Pandapower model:
34 WTGs connected via 66 kV array cables through an offshore substation (OSS),
two parallel 220 kV HVAC export cables (45 km subsea), and a 220/400 kV onshore transformer
connecting to the PSE 400 kV grid.

Physics — Cable Pi-Model
-------------------------
A submarine XLPE cable is modelled as a distributed-parameter transmission line,
approximated by the lumped pi-model. Each cable has:
  - R (resistance): Conductor losses, depends on cross-section area [Ω/km]
  - X (reactance): Inductive reactance from magnetic field [Ω/km]
  - C (capacitance): Dielectric capacitance of XLPE insulation [nF/km]

The capacitive charging current generates reactive power (Rule 7):
  Q_cable = ω × C × V² × L  [MVAR]

For one 220 kV, 45 km export cable: Q ≈ 2π×50 × 190e-9 × 220000² × 45 ≈ 130 MVAR
For the two parallel export cables: Q ≈ 260 MVAR

Why two export cables?
-----------------------
One 1000 mm² cable carries √3 × 220 kV × 0.95 kA ≈ 362 MVA — less than 510 MW.
With a single cable the full-load load flow showed ~140 % loading. Two cables
(≈ 75 % loaded at full output) also give N-1 export redundancy: losing one cable
curtails the farm to ~360 MVA instead of 0 MW.

Physics — Transformer Equivalent Circuit
-----------------------------------------
Transformers are modelled by short-circuit impedance (vk%) and copper losses (vkr%).
The magnetising branch (iron losses) is included as i0% and pfe_kw parameters.
Vector groups (Dyn11, YNyn0) determine zero-sequence behaviour for fault analysis.

Cable Data (IEC 60287 typical values for submarine XLPE)
---------------------------------------------------------
R20 = IEC 60228 DC resistance at 20 °C; R90 = AC resistance at 90 °C (see below).

Array 66 kV cables (3-core, Cu, round compacted conductor):
  - 500 mm²: R20 = 0.0366, R90 = 0.0493 Ω/km, X = 0.110 Ω/km, C = 200 nF/km, Imax ≈ 715 A
  - 630 mm²: R20 = 0.0283, R90 = 0.0395 Ω/km, X = 0.105 Ω/km, C = 215 nF/km, Imax ≈ 818 A
  - 800 mm²: R20 = 0.0221, R90 = 0.0325 Ω/km, X = 0.100 Ω/km, C = 230 nF/km, Imax ≈ 900 A

Export 220 kV cable (per circuit, 2 circuits in parallel, Cu Milliken conductor, 1000 mm²):
  - R20 = 0.0176, R90 = 0.0233 Ω/km, X = 0.116 Ω/km, C = 190 nF/km, Imax ≈ 950 A

Which resistance where?
------------------------
  R_AC,90 = R20 × (1 + α_Cu × (90 − 20)) × (1 + y_s + y_p)      IEC 60287-1-1 §2.1
  α_Cu = 0.00393 1/K; y_s / y_p = skin / proximity effect (``CableSpec.ac_factor``):
    round compacted (k_s = 1, k_p = 0.8), core spacing ≈ d_c + 33 mm:
      500 mm² 1.056 · 630 mm² 1.094 · 800 mm² 1.153
    Milliken 1000 mm² (k_s = 0.435, k_p = 0.37), d_c ≈ 38 mm, s ≈ 120 mm: 1.039
  - Load flow / OPF / SCOPF / STATCOM / dynamics: R_AC,90 — worst-case (maximum)
    losses at the conductor's rated temperature.
  - Short circuit (IEC 60909): R20. Ik''max needs the cold (lowest) resistance;
    for Ik''min pandapower heats R20 to ``endtemp_degree`` itself.

References
----------
- IEC 60287: Electric cables — calculation of current rating
- IEC 60909: Short-circuit currents in three-phase AC systems
- Pandapower documentation: bus, line, trafo, sgen, ext_grid elements
- PSE IRiESP: Polish transmission grid code
- ENTSO-E NC RfG: Network Code on Requirements for Generators

Constants (Baltic Wind Alpha)
-----------------------------
- 34 × V236-15.0 MW = 510 MW total
- 4 strings × 6 WTGs + 2 strings × 5 WTGs = 34 WTGs (same split as the landing map,
  the DB seed and the 6 string feeder bays in P3/P5)
- Array cable spacing: 1.5 km average
- Export cables: 2 × 45 km, 220 kV
- Shunt reactors: 3 × 80 MVAR at OSS 220 kV (N+1: one per export cable + one spare)
- Transformers: 2 × 300 MVA 66/220 kV (OSS, TX-OSS-01/02) + 2 × 300 MVA 220/400 kV
  (onshore). ~86 % loaded each at 510 MW; losing one keeps ~300 MW exporting
  instead of 0 MW for the 6-12 months an offshore transformer replacement takes
- Grid Ssc: 10,000 MVA at 400 kV PCC
- Base MVA: 100 (Rule 2)
"""

from dataclasses import dataclass

import numpy as np
import pandapower as pp

# ── Cable Parameters (IEC 60287) ─────────────────────────────────


@dataclass(frozen=True)
class CableSpec:
    """Cable electrical parameters per IEC 60287.

    Attributes
    ----------
    cross_section_mm2 : float
        Conductor cross-section area [mm²].
    r_ohm_per_km : float
        Conductor DC resistance at 20 °C [Ω/km] (IEC 60228 maximum for the Cu
        cross-section). Used for IEC 60909 short-circuit calculations.
    x_ohm_per_km : float
        Inductive reactance [Ω/km].
    c_nf_per_km : float
        Capacitance per phase [nF/km].
    max_i_ka : float
        Maximum continuous current rating [kA].
    ac_factor : float
        1 + y_s + y_p at 90 °C — skin and proximity effect (IEC 60287-1-1 §2.1.2–2.1.4).
    """

    cross_section_mm2: float
    r_ohm_per_km: float
    x_ohm_per_km: float
    c_nf_per_km: float
    max_i_ka: float
    ac_factor: float = 1.0

    @property
    def r_ac_ohm_per_km(self) -> float:
        """AC resistance at the 90 °C rated conductor temperature [Ω/km]."""
        temp_factor = 1.0 + ALPHA_CU_PER_K * (CONDUCTOR_OPERATING_TEMP_C - 20.0)
        return self.r_ohm_per_km * temp_factor * self.ac_factor


ALPHA_CU_PER_K = 0.00393  # Copper resistance temperature coefficient at 20 °C [1/K]
CONDUCTOR_OPERATING_TEMP_C = 90.0  # XLPE rated conductor temperature [°C]


# 66 kV array cables — graded by distance from OSS
ARRAY_CABLE_500 = CableSpec(500, 0.0366, 0.110, 200, 0.715, ac_factor=1.056)
ARRAY_CABLE_630 = CableSpec(630, 0.0283, 0.105, 215, 0.818, ac_factor=1.094)
ARRAY_CABLE_800 = CableSpec(800, 0.0221, 0.100, 230, 0.900, ac_factor=1.153)

# 220 kV export cable (per circuit)
EXPORT_CABLE_1000 = CableSpec(1000, 0.0176, 0.116, 190, 0.950, ac_factor=1.039)
NUM_EXPORT_CABLES = 2  # 1 × 362 MVA < 510 MW → two circuits in parallel


# ── Network Constants ─────────────────────────────────────────────

NUM_TURBINES = 34
TURBINE_RATED_MW = 15.0
TOTAL_CAPACITY_MW = NUM_TURBINES * TURBINE_RATED_MW  # 510 MW

# String layout: 4 strings × 6 WTGs + 2 strings × 5 WTGs (6 feeder bays at the OSS).
# 6 × 15 MW = 90 MW ≈ 790 A on the OSS-end cable → 800 mm² (900 A) is ~89 % loaded.
STRING_LAYOUT = [6, 6, 6, 6, 5, 5]
NUM_STRINGS = len(STRING_LAYOUT)
# OSS 66 kV switchboard: strings 1-3 on busbar section A (TX-OSS-01), 4-6 on
# section B (TX-OSS-02); bus coupler BAY-OSS-66-08 normally open. Each section
# (270 / 240 MW) stays inside one 300 MVA unit. Mirrors the frontend map.
STRING_BUSBAR_SECTION: dict[int, str] = {1: "A", 2: "A", 3: "A", 4: "B", 5: "B", 6: "B"}

# Cable lengths
ARRAY_CABLE_LENGTH_KM = 1.5  # average spacing between WTGs
EXPORT_CABLE_LENGTH_KM = 45.0

# Transformer parameters — per unit; 2 identical units in parallel at each substation
# (pandapower parallel=2: same impedance as one 600 MVA unit, but N-1 capable)
NUM_OSS_TRANSFORMERS = 2  # TX-OSS-01 / TX-OSS-02, one per 66 kV busbar section
TRAFO_66_220_MVA = 300.0  # OSS transformer rating per unit [MVA]
TRAFO_66_220_VK_PERCENT = 12.5  # Short-circuit voltage [%]
TRAFO_66_220_VKR_PERCENT = 0.25  # Resistive component [%]
TRAFO_66_220_PFE_KW = 60.0  # Iron losses per unit [kW]
TRAFO_66_220_I0_PERCENT = 0.05  # No-load current [%]

NUM_ONSHORE_TRANSFORMERS = 2
TRAFO_220_400_MVA = 300.0  # Onshore transformer rating per unit [MVA]
TRAFO_220_400_VK_PERCENT = 14.0
TRAFO_220_400_VKR_PERCENT = 0.20
TRAFO_220_400_PFE_KW = 50.0  # per unit [kW]
TRAFO_220_400_I0_PERCENT = 0.04

# Grid connection
GRID_SSC_MVA = 10_000.0  # Short-circuit power at PCC [MVA]
GRID_RX_RATIO = 0.1  # R/X ratio of grid impedance

# STATCOM and reactors
STATCOM_RATING_MVAR = 120.0  # ±120 MVAR
# N+1 reactors: with one out of service, (260 − 2 × 80) × 1.15 = 115 MVAR still fits
# the ±120 MVAR STATCOM. With only 2 × 80 an outage left 180 MVAR (> 120).
NUM_SHUNT_REACTORS = NUM_EXPORT_CABLES + 1  # one per export cable + one spare
SHUNT_REACTOR_UNIT_MVAR = 80.0  # absorption per reactor [MVAR]
SHUNT_REACTOR_MVAR = NUM_SHUNT_REACTORS * SHUNT_REACTOR_UNIT_MVAR  # 240 MVAR total


def _get_cable_grade(position_in_string: int, string_length: int) -> CableSpec:
    """Select cable cross-section based on position in feeder string.

    Cable grading: turbines far from OSS use smaller cables (less cumulative
    current), turbines near OSS use larger cables (more cumulative current).

    Parameters
    ----------
    position_in_string : int
        0-indexed position (0 = farthest from OSS, N-1 = nearest to OSS).
    string_length : int
        Total number of turbines in this string.

    Returns
    -------
    CableSpec
        Cable specification for this segment.
    """
    # Normalise position: 0.0 (far) to 1.0 (near OSS)
    normalised = position_in_string / max(string_length - 1, 1)

    if normalised < 0.4:
        return ARRAY_CABLE_500  # far from OSS — least current
    elif normalised < 0.7:
        return ARRAY_CABLE_630  # mid-string
    else:
        return ARRAY_CABLE_800  # near OSS — most cumulative current


def build_network(
    export_length_km: float = EXPORT_CABLE_LENGTH_KM,
    grid_ssc_mva: float = GRID_SSC_MVA,
    generation_fraction: float = 1.0,
    statcom_q_mvar: float = 0.0,
    enable_reactor: bool = True,
    r_at_operating_temp: bool = True,
) -> pp.pandapowerNet:
    """Build the complete 66/220/400 kV offshore wind farm network.

    Creates a Pandapower network with:
    - 38 buses: 1 PSE 400kV + 1 onshore 220kV + 1 OSS 220kV + 1 OSS 66kV + 34 WTGs
    - 35 line elements: 34 array (66 kV) + 1 export element with 2 parallel
      220 kV circuits (``parallel=2``), all pi-model
    - 2 transformer elements, each 2 × 300 MVA in parallel (``parallel=2``):
      66/220 kV Dyn11 (OSS) + 220/400 kV YNyn0 (onshore)
    - 34 static generators (WTGs) with P and Q
    - 1 STATCOM (sgen with Q control at OSS 220 kV)
    - 3 shunt reactors (3 × 80 MVAR at OSS 220 kV, N+1) if enabled
    - 1 external grid (slack bus) at 400 kV

    Parameters
    ----------
    export_length_km : float
        Export cable length [km]. Default: 45.0.
    grid_ssc_mva : float
        Grid short-circuit power at PCC [MVA]. Default: 10,000.
    generation_fraction : float
        Fraction of rated power (0.0–1.0). Default: 1.0 (full load).
    statcom_q_mvar : float
        STATCOM reactive power setpoint [MVAR]. Positive = generating (Rule 4).
    enable_reactor : bool
        If True, include the 3 × 80 MVAR shunt reactors at OSS 220 kV.
    r_at_operating_temp : bool
        True (default): cable R = AC resistance at 90 °C, for load flow and losses.
        False: R = DC resistance at 20 °C, as IEC 60909 short-circuit requires.

    Returns
    -------
    pp.pandapowerNet
        Pandapower network ready for load flow or short-circuit analysis.
    """
    net = pp.create_empty_network(name="Baltic Wind Alpha — 510 MW OWF")

    # ── Buses ─────────────────────────────────────────────────────
    bus_pse_400 = pp.create_bus(net, vn_kv=400.0, name="PSE_400kV")
    bus_onshore_220 = pp.create_bus(net, vn_kv=220.0, name="Onshore_220kV")
    bus_oss_220 = pp.create_bus(net, vn_kv=220.0, name="OSS_220kV")
    bus_oss_66 = pp.create_bus(net, vn_kv=66.0, name="OSS_66kV")

    # WTG buses — 34 turbines on 66 kV
    wtg_buses = []
    for i in range(NUM_TURBINES):
        bus_id = pp.create_bus(net, vn_kv=66.0, name=f"WTG_{i + 1:02d}")
        wtg_buses.append(bus_id)

    # ── External Grid (slack bus) ─────────────────────────────────
    # Model PSE grid as infinite bus with short-circuit capacity
    pp.create_ext_grid(
        net,
        bus=bus_pse_400,
        vm_pu=1.0,
        va_degree=0.0,
        name="PSE_Grid",
        s_sc_max_mva=grid_ssc_mva,
        s_sc_min_mva=grid_ssc_mva * 0.8,
        rx_max=GRID_RX_RATIO,
        rx_min=GRID_RX_RATIO,
    )

    # ── Transformers ──────────────────────────────────────────────
    # 220/400 kV onshore transformer (YNyn0)
    pp.create_transformer_from_parameters(
        net,
        hv_bus=bus_pse_400,
        lv_bus=bus_onshore_220,
        sn_mva=TRAFO_220_400_MVA,
        vn_hv_kv=400.0,
        vn_lv_kv=220.0,
        vk_percent=TRAFO_220_400_VK_PERCENT,
        vkr_percent=TRAFO_220_400_VKR_PERCENT,
        pfe_kw=TRAFO_220_400_PFE_KW,
        i0_percent=TRAFO_220_400_I0_PERCENT,
        vector_group="YNyn0",
        parallel=NUM_ONSHORE_TRANSFORMERS,
        name="Trafo_220_400kV",
    )

    # 66/220 kV OSS transformer (Dyn11)
    pp.create_transformer_from_parameters(
        net,
        hv_bus=bus_oss_220,
        lv_bus=bus_oss_66,
        sn_mva=TRAFO_66_220_MVA,
        vn_hv_kv=220.0,
        vn_lv_kv=66.0,
        vk_percent=TRAFO_66_220_VK_PERCENT,
        vkr_percent=TRAFO_66_220_VKR_PERCENT,
        pfe_kw=TRAFO_66_220_PFE_KW,
        i0_percent=TRAFO_66_220_I0_PERCENT,
        vector_group="Dyn11",
        parallel=NUM_OSS_TRANSFORMERS,
        name="Trafo_66_220kV",
    )

    # ── Export Cables (2 × 220 kV in parallel, pi-model) ─────────
    # One line element with parallel=2: pandapower divides R, X and multiplies
    # C by the circuit count; loading_percent is relative to both circuits.
    cable = EXPORT_CABLE_1000

    def r_ohm_per_km(spec: CableSpec) -> float:
        return spec.r_ac_ohm_per_km if r_at_operating_temp else spec.r_ohm_per_km

    pp.create_line_from_parameters(
        net,
        from_bus=bus_onshore_220,
        to_bus=bus_oss_220,
        length_km=export_length_km,
        r_ohm_per_km=r_ohm_per_km(cable),
        x_ohm_per_km=cable.x_ohm_per_km,
        c_nf_per_km=cable.c_nf_per_km,
        max_i_ka=cable.max_i_ka,
        endtemp_degree=80.0,  # XLPE max operating temperature for IEC 60909 min case
        parallel=NUM_EXPORT_CABLES,
        name="Export_220kV",
    )

    # ── Array Cables (66 kV, graded pi-model) ─────────────────────
    wtg_idx = 0
    for string_num, string_len in enumerate(STRING_LAYOUT):
        for pos in range(string_len):
            # Cable from previous element to this WTG
            from_bus = bus_oss_66 if pos == 0 else wtg_buses[wtg_idx - 1]
            to_bus = wtg_buses[wtg_idx]

            # Cable grading: position 0 = nearest OSS (largest cable)
            # Reverse position for grading: near OSS gets big cable
            grade_pos = string_len - 1 - pos
            cable_spec = _get_cable_grade(grade_pos, string_len)

            pp.create_line_from_parameters(
                net,
                from_bus=from_bus,
                to_bus=to_bus,
                length_km=ARRAY_CABLE_LENGTH_KM,
                r_ohm_per_km=r_ohm_per_km(cable_spec),
                x_ohm_per_km=cable_spec.x_ohm_per_km,
                c_nf_per_km=cable_spec.c_nf_per_km,
                max_i_ka=cable_spec.max_i_ka,
                endtemp_degree=80.0,  # XLPE max operating temp for IEC 60909
                name=f"Array_S{string_num + 1}_T{pos + 1}",
            )
            wtg_idx += 1

    # ── WTG Generators (static generators) ────────────────────────
    p_per_wtg = TURBINE_RATED_MW * generation_fraction
    # WTGs operate at unity power factor (Q = 0) by default
    for i, bus_id in enumerate(wtg_buses):
        pp.create_sgen(
            net,
            bus=bus_id,
            p_mw=p_per_wtg,
            q_mvar=0.0,
            sn_mva=TURBINE_RATED_MW,  # needed for IEC 60909 short-circuit
            k=1.0,  # ratio of Ik'' to In per IEC 60909 for inverter-based generators
            name=f"WTG_{i + 1:02d}",
        )

    # ── STATCOM at OSS 220 kV ─────────────────────────────────────
    # Rule 4: positive Q = generating (capacitive), negative Q = absorbing (inductive)
    pp.create_sgen(
        net,
        bus=bus_oss_220,
        p_mw=0.0,
        q_mvar=statcom_q_mvar,
        sn_mva=STATCOM_RATING_MVAR,  # needed for IEC 60909 short-circuit
        k=1.0,  # ratio of Ik'' to In for STATCOM (inverter-based)
        name="STATCOM",
    )

    # ── Shunt Reactors at OSS 220 kV ─────────────────────────────
    # Absorb cable capacitive Q — modelled as fixed shunts.
    # pandapower shunts use the LOAD convention: q_mvar > 0 = absorbing
    # (inductive). This is the opposite of Rule 4, which applies to our API
    # outputs and to sgens (STATCOM), not to pandapower shunt inputs.
    if enable_reactor:
        for n in range(NUM_SHUNT_REACTORS):
            pp.create_shunt(
                net,
                bus=bus_oss_220,
                q_mvar=SHUNT_REACTOR_UNIT_MVAR,  # positive = absorbing (load convention)
                p_mw=0.0,
                name=f"Reactor_{n + 1}_{SHUNT_REACTOR_UNIT_MVAR:.0f}MVAR",
            )

    return net


def get_bus_count(net: pp.pandapowerNet) -> int:
    """Return total number of buses in the network."""
    return len(net.bus)


def get_total_generation_mw(net: pp.pandapowerNet) -> float:
    """Return total active power from all static generators [MW]."""
    return float(net.sgen.p_mw.sum())


def get_cable_grades_summary(net: pp.pandapowerNet) -> dict[str, int]:
    """Return count of array cables by cross-section grade.

    Returns
    -------
    dict[str, int]
        Keys: '500mm2', '630mm2', '800mm2'. Values: cable count.
    """
    counts: dict[str, int] = {"500mm2": 0, "630mm2": 0, "800mm2": 0}
    for _, row in net.line.iterrows():
        name = str(row["name"])
        if not name.startswith("Array_"):
            continue
        # Identify the grade by its rating — R differs between 20 °C and 90 °C builds
        i_max = float(row["max_i_ka"])
        if np.isclose(i_max, ARRAY_CABLE_500.max_i_ka):
            counts["500mm2"] += 1
        elif np.isclose(i_max, ARRAY_CABLE_630.max_i_ka):
            counts["630mm2"] += 1
        elif np.isclose(i_max, ARRAY_CABLE_800.max_i_ka):
            counts["800mm2"] += 1
    return counts

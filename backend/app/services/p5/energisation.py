"""
Steady-state network snapshot of circuit 1 for any switching state.

Every switching step of the programme changes which zones are live
(``equipment_state.zone_status``). This module builds a pandapower model of the
live part only and solves the load flow, so each verification step checks
computed values instead of a fixed text.

What the numbers show
---------------------
- Cable energised open-ended from shore: the 76.5 km cable generates
  Q_c = ω·C·U²·l = 2π·50 · 190 nF/km · (220 kV)² · 76.5 km ≈ 221 Mvar, so the
  sending-end current is I_c = Q_c / (√3·U) ≈ 580 A with zero load, and the open
  end rises by the Ferranti factor 1/cos(βl) ≈ 1.021 (βl = ωl√(LC) ≈ 0.20 rad).
  The 221 Mvar flow into the onshore 220 kV busbar and raise its voltage by
  roughly Q_c / S_k there (S_k ≈ 3 GVA behind the two onshore transformers).
- Shunt reactor 1 (170 Mvar at 1 pu, Q ∝ U²) takes most of that back; the STATCOM
  then holds the OSS 220 kV busbar at 1.00 pu within ±120 Mvar.
- TX-OSS-01 on no load draws only its magnetising current (i0 = 0.05 % →
  ≈ 0.4 A at 220 kV).
- Released turbines are dispatched at rated output (15 MW, unity power factor):
  a design check of cable and transformer loading, not a wind forecast. When
  section A alone is more than one export circuit carries (farms with 3–4
  circuits), the PPC holds the output at 90 % of the circuit's capability
  (``circuit1_limit_mw``) until the other circuits are in service.

The numbers above are SB-510; ``network_snapshot(state, spec)`` builds the same
model for any ``FarmSpec`` (cable length, transformer and reactor sizes,
STATCOM, strings of section A).

Onshore OLTC pre-set: a longer cable lifts the onshore busbar further (75 km:
≈ 230 Mvar, +5 %), so before energising, the onshore transformers are tapped
down (``onshore_tap``: the first HV tap, 1.25 % per step, that keeps the busbar
and the open cable end within 0.95–1.05 pu). The tap is then held for the
whole programme; SB-510 (76.5 km) needs 3 steps. When no tap is enough (a long
cable on small onshore transformers), reactor 1 is connected to the dead cable
and energised with it (``reactor_energisation``).

Not modelled: switching transients and transformer inrush (they are not
steady-state quantities), WTG step-up transformers and auxiliary loads, OLTC
control during the programme (taps held at the pre-set). Data come from
``p2.network_model``.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from functools import lru_cache

import pandapower as pp

from app.services.p2.network_model import _OLTC as OLTC
from app.services.p2.network_model import (
    EXPORT_CABLE_1000,
    EXPORT_CABLE_LENGTH_KM,
    GRID_RX_RATIO,
    NUM_ONSHORE_TRANSFORMERS,
    OLTC_STEPS,
    SB510,
    TRAFO_66_220_I0_PERCENT,
    TRAFO_66_220_VK_PERCENT,
    TRAFO_66_220_VKR_PERCENT,
    TRAFO_220_400_I0_PERCENT,
    TRAFO_220_400_VK_PERCENT,
    TRAFO_220_400_VKR_PERCENT,
    FarmSpec,
    _get_cable_grade,
    export_circuit_capacity_mw,
)
from app.services.p5.equipment_state import (
    EquipmentState,
    ZoneStatus,
    build_initial_state,
    zone_status,
)

STATCOM_V_SET_PU = 1.00
FREQUENCY_HZ = 50.0
V_BAND_PU = (0.95, 1.05)  # project operating band for verification steps


@dataclass(frozen=True)
class BusReading:
    """Voltage of one live busbar or cable end."""

    name: str
    zone: str
    vn_kv: float
    vm_pu: float

    @property
    def kv(self) -> float:
        return self.vm_pu * self.vn_kv


@dataclass(frozen=True)
class NetworkSnapshot:
    """Load-flow result of the live part of circuit 1.

    Reactive powers follow the generator convention (Rule 4: generating > 0),
    so the reactor reads negative and the open cable makes ``poc_q_mvar`` > 0.
    """

    zones: dict[str, ZoneStatus]
    buses: tuple[BusReading, ...]
    poc_p_mw: float  # active power exported into PSE 400 kV
    poc_q_mvar: float  # reactive power delivered into PSE 400 kV
    generation_mw: float
    cable_i_send_a: float | None = None
    cable_i_recv_a: float | None = None
    cable_loading_pct: float | None = None
    reactor_q_mvar: float | None = None
    statcom_q_mvar: float | None = None
    tx1_i_hv_a: float | None = None
    tx1_loading_pct: float | None = None
    onshore_tap: int = 0

    def bus(self, zone: str) -> BusReading | None:
        return next((b for b in self.buses if b.zone == zone), None)


def cable_charging_mvar(u_kv: float = 220.0, length_km: float = EXPORT_CABLE_LENGTH_KM) -> float:
    """Q_c = ω·C·U²·l of one export cable [Mvar] (analytic cross-check)."""
    c = EXPORT_CABLE_1000.c_nf_per_km * 1e-9 * length_km
    return 2 * math.pi * FREQUENCY_HZ * c * (u_kv * 1e3) ** 2 / 1e6


def ferranti_ratio(length_km: float = EXPORT_CABLE_LENGTH_KM) -> float:
    """Open-end / sending-end voltage of the lossless cable, 1 / cos(βl)."""
    l_h = EXPORT_CABLE_1000.x_ohm_per_km / (2 * math.pi * FREQUENCY_HZ)
    c_f = EXPORT_CABLE_1000.c_nf_per_km * 1e-9
    beta = 2 * math.pi * FREQUENCY_HZ * math.sqrt(l_h * c_f)
    return 1.0 / math.cos(beta * length_km)


def section_a_mw(spec: FarmSpec = SB510) -> float:
    """Rated output of the strings on 66 kV section A [MW]."""
    return sum(spec.string_layout[: spec.section_a_strings]) * spec.turbine_rated_mw


def circuit1_limit_mw(spec: FarmSpec = SB510) -> float:
    """Output allowed with only circuit 1 in service [MW]: section A at rated, or 90 %
    of one export circuit's capability when section A is more (PPC limit)."""
    return min(section_a_mw(spec), 0.9 * export_circuit_capacity_mw(spec.export_length_km))


def network_snapshot(
    state: dict[str, EquipmentState], spec: FarmSpec = SB510, tap: int | None = None
) -> NetworkSnapshot:
    """Solve the load flow of everything that is live in ``state``; onshore OLTC at
    ``tap`` (default: the pre-set ``onshore_tap(spec)``)."""
    tap = onshore_tap(spec) if tap is None else tap
    zones = zone_status(state, spec)
    live = {z for z, s in zones.items() if s == ZoneStatus.LIVE}
    p_wtg = spec.turbine_rated_mw * circuit1_limit_mw(spec) / section_a_mw(spec)

    net = pp.create_empty_network(f_hz=FREQUENCY_HZ)
    b400 = pp.create_bus(net, 400.0, name="PSE 400 kV (POC)")
    b220 = pp.create_bus(net, 220.0, name="Onshore 220 kV")
    pp.create_ext_grid(net, b400, vm_pu=1.0, s_sc_max_mva=spec.grid_ssc_mva, rx_max=GRID_RX_RATIO)
    pp.create_transformer_from_parameters(
        net, b400, b220, sn_mva=spec.onshore_trafo_mva, vn_hv_kv=400.0, vn_lv_kv=220.0,
        vk_percent=TRAFO_220_400_VK_PERCENT, vkr_percent=TRAFO_220_400_VKR_PERCENT,
        pfe_kw=spec.onshore_pfe_kw, i0_percent=TRAFO_220_400_I0_PERCENT,
        parallel=NUM_ONSHORE_TRANSFORMERS, name="TX-ONS-01/02", **{**OLTC, "tap_pos": tap},
    )  # fmt: skip
    buses: list[tuple[int, str, str]] = [
        (b400, "PSE 400 kV (POC)", "PSE400"),
        (b220, "Onshore 220 kV", "ONS220"),
    ]

    cable_line = reactor = statcom = tx1 = None
    b_oss = b66 = None
    generation = 0.0
    if "CABLE1" in live:
        b_oss = pp.create_bus(net, 220.0, name="OSS 220 kV")
        cable = EXPORT_CABLE_1000
        cable_line = pp.create_line_from_parameters(
            net, b220, b_oss, length_km=spec.export_length_km,
            r_ohm_per_km=cable.r_ac_ohm_per_km, x_ohm_per_km=cable.x_ohm_per_km,
            c_nf_per_km=cable.c_nf_per_km, max_i_ka=cable.max_i_ka, name="Export cable 1",
        )  # fmt: skip
        on_bus = "OSS220" in live
        buses.append(
            (
                b_oss,
                "OSS 220 kV" if on_bus else "Cable 1, OSS end (open)",
                "OSS220" if on_bus else "CABLE1",
            )
        )
    if b_oss is not None and "SR1" in live:
        # pandapower shunt: load convention, q_mvar > 0 absorbs (at 1 pu)
        reactor = pp.create_shunt(net, b_oss, q_mvar=spec.reactor_unit_mvar, name="SR-1")
    if b_oss is not None and "STC" in live:
        statcom = pp.create_gen(
            net, b_oss, p_mw=0.0, vm_pu=STATCOM_V_SET_PU, min_q_mvar=-spec.statcom_mvar,
            max_q_mvar=spec.statcom_mvar, name="STATCOM",
        )  # fmt: skip
    if b_oss is not None and "TX1" in live:
        b66 = pp.create_bus(net, 66.0, name="66 kV section A")
        tx1 = pp.create_transformer_from_parameters(
            net, b_oss, b66, sn_mva=spec.oss_trafo_mva, vn_hv_kv=220.0, vn_lv_kv=66.0,
            vk_percent=TRAFO_66_220_VK_PERCENT, vkr_percent=TRAFO_66_220_VKR_PERCENT,
            pfe_kw=spec.oss_pfe_kw, i0_percent=TRAFO_66_220_I0_PERCENT, name="TX-OSS-01",
        )  # fmt: skip
        if "66A" in live:
            buses.append((b66, "66 kV section A", "66A"))
    if b66 is not None and "66A" in live:
        for n in range(1, spec.section_a_strings + 1):
            if f"STR{n}" not in live:
                continue
            released = state.get(f"WTG-GRP-{n:02d}") == EquipmentState.CLOSED
            prev, n_wtg = b66, spec.string_layout[n - 1]
            for pos in range(n_wtg):
                grade = _get_cable_grade(n_wtg - 1 - pos, n_wtg)  # biggest cable at the OSS
                wtg_bus = pp.create_bus(net, 66.0, name=f"String {n} WTG {pos + 1}")
                pp.create_line_from_parameters(
                    net, prev, wtg_bus, length_km=spec.array_cable_length_km,
                    r_ohm_per_km=grade.r_ac_ohm_per_km, x_ohm_per_km=grade.x_ohm_per_km,
                    c_nf_per_km=grade.c_nf_per_km, max_i_ka=grade.max_i_ka,
                )  # fmt: skip
                if released:
                    pp.create_sgen(net, wtg_bus, p_mw=p_wtg, q_mvar=0.0)
                    generation += p_wtg
                prev = wtg_bus
            buses.append((prev, f"String {n} far end", f"STR{n}"))

    pp.runpp(net, enforce_q_lims=True, numba=False)

    def opt(table: str, idx: int | None, col: str, scale: float = 1.0) -> float | None:
        return None if idx is None else float(net[table].at[idx, col]) * scale

    return NetworkSnapshot(
        zones=zones,
        buses=tuple(
            BusReading(name, zone, float(net.bus.at[b, "vn_kv"]), float(net.res_bus.at[b, "vm_pu"]))
            for b, name, zone in buses
        ),
        poc_p_mw=-float(net.res_ext_grid.at[0, "p_mw"]),
        poc_q_mvar=-float(net.res_ext_grid.at[0, "q_mvar"]),
        generation_mw=generation,
        cable_i_send_a=opt("res_line", cable_line, "i_from_ka", 1e3),
        cable_i_recv_a=opt("res_line", cable_line, "i_to_ka", 1e3),
        cable_loading_pct=opt("res_line", cable_line, "loading_percent"),
        reactor_q_mvar=opt("res_shunt", reactor, "q_mvar", -1.0),
        statcom_q_mvar=opt("res_gen", statcom, "q_mvar"),
        tx1_i_hv_a=opt("res_trafo", tx1, "i_hv_ka", 1e3),
        tx1_loading_pct=opt("res_trafo", tx1, "loading_percent"),
        onshore_tap=tap,
    )


def cable_energised_state(
    spec: FarmSpec = SB510, with_reactor: bool = False
) -> dict[str, EquipmentState]:
    """Export cable 1 energised from shore, open-ended or with reactor 1 (and the OSS
    busbar) connected at its far end; everything else as built."""
    state = build_initial_state(spec)
    opened = ["ES-ON-220-01", "ES-OSS-220-01"]
    closed = ["DS-ON-220-01", "CB-ON-220-01"]
    if with_reactor:
        opened += ["ES-OSS-220-BB", "ES-SR-01"]
        closed += ["DS-OSS-220-01", "CB-OSS-220-01", "CB-SR-01"]
    state.update(dict.fromkeys(opened, EquipmentState.OPEN))
    state.update(dict.fromkeys(closed, EquipmentState.CLOSED))
    return state


@lru_cache(maxsize=32)
def _energisation_plan(spec: FarmSpec) -> tuple[int, bool]:
    """(onshore tap, energise with reactor 1): the first tap at which the cable,
    open-ended, leaves the onshore busbar and the cable end inside the band; failing
    that, the same with reactor 1 connected (if the design has reactors). Taps are
    HV-side, + lowers the 220 kV side. Neither works → full range, open-ended (the
    verification step then fails: a finding)."""
    lo, hi = V_BAND_PU
    for with_reactor in (False, True)[: 1 + bool(spec.num_reactors)]:
        state = cable_energised_state(spec, with_reactor)
        for tap in range(OLTC_STEPS + 1):
            snap = network_snapshot(state, spec, tap)
            if all(lo <= b.vm_pu <= hi for b in snap.buses if b.zone != "PSE400"):
                return tap, with_reactor
    return OLTC_STEPS, False


def onshore_tap(spec: FarmSpec = SB510) -> int:
    """Onshore OLTC position held during the programme (0 = neutral)."""
    return _energisation_plan(spec)[0]


def reactor_energisation(spec: FarmSpec = SB510) -> bool:
    """True when cable 1 is energised together with reactor 1."""
    return _energisation_plan(spec)[1]

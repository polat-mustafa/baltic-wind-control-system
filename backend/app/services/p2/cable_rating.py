"""
Steady-state current rating of the export route per IEC 60287 (engineering audit B-2).

The P2 network rates the 220 kV export cable at the datasheet's 825 A everywhere — a value
for ONE condition (1.0 m burial, 20 °C seabed, 1.0 K·m/W). Real routes have sections with
worse cooling: the HDD landfall (10–15 m deep, in a duct), the J-tube on the OSS (in air in
a steel tube) and the land section (a different, single-core cable). The section with the
lowest rating sets what the circuit may carry. This module computes each with the IEC 60287
rating equation and the IEC 60287-2-1 thermal resistances.

Rating equation (IEC 60287-1-1 §1.4.1.1, n cores, 100 % load factor):

    I = √( (Δθ − W_d·[½T1 + n(T2 + T3 + T4)]) /
           (R·T1 + n·R(1 + λ1)·T2 + n·R(1 + λ1 + λ2)·(T3 + T4)) )

solved iteratively with R, R_s and λ1 at the conductor / sheath temperatures it gives
(as CIGRE TB 880 does). R includes skin and proximity effect (§2.1); λ1 the circulating
current loss of solidly bonded sheaths, λ1' = (R_s/R)/(1 + (R_s/X)²) (§2.3.1; separately
lead-sheathed "SL" cores of a three-core cable are treated like single cores in trefoil);
λ2 the steel-wire armour loss of a three-core cable (§2.4.2.3); W_d = ωCU0²·tan δ (§2.2).

Thermal resistances (IEC 60287-2-1): T1 layer by layer, ρ/(2π)·ln(1 + 2t/d) (§4.1.2.1);
T3 the outer covering (§4.1.4.1); T4 of a buried cable ρ/(2π)·ln(u + √(u² − 1)),
u = 2L/D_e (§4.2.3.1), with the other circuit's mutual heating (§4.2.3.2); a cable in a
duct T4 = T4′ (air gap, §4.2.7.1, U/(1 + 0.1(V + Yθm)D_e)) + T4″ (duct wall) + T4‴ (the
duct buried); trefoil touching single cores 1.5/π·ρ·(ln 2u − 0.630) (§4.2.4.3.2); a cable
in a steel J-tube as the cable in a metallic conduit (air gap) plus the tube in free air
(§4.2.1, h = Z/D^g + E, iterated on the surface temperature rise).

Verification: ``reference_case_tb880`` reproduces CIGRE TB 880 case 0-1 (132 kV single core
in trefoil, 820 A; the open re-implementation github.com/frdmendoza/cbl_CIGRE_TB880 gives
821.8 A) — tests/test_cable_rating.py.

The 220 kV three-core cable: its geometry is not public (the datasheet gives C, L and the
rating). Dimensions below are derived from the datasheet's own values — the insulation
thickness from C = ε/(18·ln(D_i/d_c)) and the core spacing from L — and typical layer
thicknesses (APPROXIMATION). The one parameter that geometry cannot fix, the filler/bedding
resistance T2, is solved so that the IEC equation returns the datasheet's 825 A at its
reference condition; every other section then follows from IEC 60287-2-1.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, replace
from functools import lru_cache

import numpy as np

F_HZ = 50.0
OMEGA = 2 * math.pi * F_HZ
THETA_MAX = 90.0  # XLPE continuous, IEC 62067

# Materials (IEC 60287-1-1 Table 1 resistivity at 20 °C [Ω·m], temperature coefficient)
CU = (1.7241e-8, 3.93e-3)
LEAD = (21.4e-8, 4.0e-3)
ALUMINIUM = (2.84e-8, 4.03e-3)
STEEL = (13.8e-8, 4.5e-3)
# Thermal resistivities [K·m/W] (IEC 60287-2-1 Table 1, CIGRE TB 640)
RHO_XLPE = 3.5
RHO_SEMICON = 2.5
RHO_PE = 3.5
RHO_PP_YARN = 6.0


@dataclass(frozen=True)
class CableDesign:
    """Geometry [mm] and materials of a cable; ``cores`` = 1 (single core) or 3."""

    name: str
    cores: int
    u0_kv: float
    r20_ohm_per_m: float  # conductor DC resistance at 20 °C (IEC 60228)
    d_conductor: float
    k_s: float
    k_p: float
    t_conductor_screen: float
    t_insulation: float
    t_insulation_screen: float
    sheath: tuple[float, float]  # (ρ20, α20)
    t_sheath: float
    t_core_jacket: float  # over each sheath (three-core: PE core jacket; single core: oversheath)
    t_armour_wire: float = 0.0  # three-core: steel wire diameter
    t_bedding: float = 0.0  # between laid-up cores and armour
    t_serving: float = 0.0  # outer serving over the armour
    rho_serving: float = RHO_PP_YARN
    epsilon: float = 2.5
    tan_delta: float = 0.001
    t2_k_m_w: float = 0.0  # filler/bedding resistance (three-core: calibrated)

    # derived diameters
    @property
    def d_insulation(self) -> float:
        return self.d_conductor + 2 * (self.t_conductor_screen + self.t_insulation)

    @property
    def d_sheath_mean(self) -> float:
        return self.d_insulation + 2 * self.t_insulation_screen + self.t_sheath

    @property
    def d_core(self) -> float:
        """Over the core jacket (= cable OD of a single core)."""
        return self.d_sheath_mean + self.t_sheath + 2 * self.t_core_jacket

    @property
    def d_armour_mean(self) -> float:
        return 2.155 * self.d_core + 2 * self.t_bedding + self.t_armour_wire

    @property
    def d_outer(self) -> float:
        if self.cores == 1:
            return self.d_core
        return self.d_armour_mean + self.t_armour_wire + 2 * self.t_serving

    def capacitance_f_per_m(self) -> float:
        """IEC 60287-1-1 §2.2: ε / (18·ln(D_i/d_c)) · 10⁻⁹ (d_c over the conductor screen)."""
        dc = self.d_conductor + 2 * self.t_conductor_screen
        return self.epsilon / (18 * math.log(self.d_insulation / dc)) * 1e-9

    def dielectric_loss_w_per_m(self) -> float:
        return OMEGA * self.capacitance_f_per_m() * (self.u0_kv * 1e3) ** 2 * self.tan_delta


@dataclass(frozen=True)
class Installation:
    """Where a section lies. ``kind``: buried | duct | trefoil | jtube."""

    kind: str
    depth_m: float = 1.0
    rho_soil: float = 1.0
    theta_ambient: float = 20.0
    other_circuit_m: float | None = None  # axis distance to the other circuit (mutual heating)
    duct_od_mm: float = 0.0
    duct_wall_mm: float = 0.0
    rho_duct: float = RHO_PE
    duct_fill: str = "air"  # air | water (bentonite / water-filled duct)
    tube_id_mm: float = 0.0  # J-tube
    solar_w_m2: float = 0.0  # J-tube in the sun (IEC 60287-2-1 §4.2.1.2: H = 1000 W/m²)
    solar_absorption: float = 0.6  # σ of the tube surface (painted / weathered steel)


@dataclass(frozen=True)
class RatingResult:
    current_a: float
    conductor_c: float
    sheath_c: float
    lambda1: float
    lambda2: float
    r_ac_ohm_per_m: float
    t1: float
    t2: float
    t3: float
    t4: float
    w_d: float


def _r_ac(c: CableDesign, theta: float, s_mm: float) -> float:
    """AC resistance with skin and proximity effect, IEC 60287-1-1 §2.1."""
    r_dc = c.r20_ohm_per_m * (1 + CU[1] * (theta - 20))

    def y(k: float) -> float:
        x4 = (8 * math.pi * F_HZ / r_dc * 1e-7 * k) ** 2
        return x4 / (192 + 0.8 * x4)

    ys, yp_ = y(c.k_s), y(c.k_p)
    ratio = c.d_conductor / s_mm
    yp = yp_ * ratio**2 * (0.312 * ratio**2 + 1.18 / (yp_ + 0.27))
    return r_dc * (1 + ys + yp)


def _t1(c: CableDesign) -> float:
    layers = (
        (RHO_SEMICON, c.t_conductor_screen, c.d_conductor),
        (RHO_XLPE, c.t_insulation, c.d_conductor + 2 * c.t_conductor_screen),
        (RHO_SEMICON, c.t_insulation_screen, c.d_insulation),
    )
    return sum(rho / (2 * math.pi) * math.log(1 + 2 * t / d) for rho, t, d in layers)


def _t3(c: CableDesign) -> float:
    if c.cores == 1:
        d_under = c.d_sheath_mean + c.t_sheath
        return RHO_PE / (2 * math.pi) * math.log(1 + 2 * c.t_core_jacket / d_under)
    d_under = c.d_armour_mean + c.t_armour_wire
    return c.rho_serving / (2 * math.pi) * math.log(1 + 2 * c.t_serving / d_under)


def _t4_buried(rho: float, depth_m: float, d_e_mm: float) -> float:
    u = 2 * depth_m * 1000 / d_e_mm
    return rho / (2 * math.pi) * math.log(u + math.sqrt(u * u - 1))


def _t4_mutual(inst: Installation) -> float:
    """Extra T4 from the other circuit (equal loss), IEC 60287-2-1 §4.2.3.2 image method."""
    if inst.other_circuit_m is None:
        return 0.0
    d = inst.other_circuit_m
    d_image = math.hypot(d, 2 * inst.depth_m)
    return inst.rho_soil / (2 * math.pi) * math.log(d_image / d)


def _t4_duct(c: CableDesign, inst: Installation, theta_m: float) -> float:
    """Cable in a buried duct, IEC 60287-2-1 §4.2.7: air (or water) gap, duct wall, soil."""
    d_e = c.d_outer
    # Table 4 constants: plastic duct in ground — air-filled (U 1.87, V 0.312, Y 0.0037);
    # water / bentonite-filled ducts conduct far better (U 0.1, V 0.03, Y 0.001)
    u, v, y = (1.87, 0.312, 0.0037) if inst.duct_fill == "air" else (0.1, 0.03, 0.001)
    t4_gap = u / (1 + 0.1 * (v + y * theta_m) * d_e)
    d_o = inst.duct_od_mm
    d_i = d_o - 2 * inst.duct_wall_mm
    t4_wall = inst.rho_duct / (2 * math.pi) * math.log(d_o / d_i)
    return t4_gap + t4_wall + _t4_buried(inst.rho_soil, inst.depth_m, d_o) + _t4_mutual(inst)


def _t4_jtube(
    c: CableDesign, inst: Installation, theta_m: float, w_total: float
) -> tuple[float, float, float]:
    """Cable in a steel J-tube: metallic-conduit air gap (Table 4: U 5.2, V 1.4, Y 0.011)
    plus the tube surface to free air (§4.2.1, single body: Z 0.21, E 3.94, g 0.60, with
    T = 1/(π·D·h·Δθs^¼) iterated on the surface rise Δθs that the cable's losses and the
    sun, σ·D·H, cause together); the steel wall itself is negligible.
    Returns (T4, the surface-to-air part, tube OD [m])."""
    d_e = c.d_outer
    t4_gap = 5.2 / (1 + 0.1 * (1.4 + 0.011 * theta_m) * d_e)
    de_m = (inst.tube_id_mm + 2 * 15.0) / 1000  # 15 mm steel wall
    h = 0.21 / de_m**0.60 + 3.94
    w_sun = inst.solar_absorption * de_m * inst.solar_w_m2
    dtheta = 10.0
    for _ in range(60):
        dtheta = max((w_total + w_sun) / (math.pi * de_m * h * dtheta**0.25), 1e-3)
    t_air = 1 / (math.pi * de_m * h * dtheta**0.25)
    return t4_gap + t_air, t_air, de_m


def rating(c: CableDesign, inst: Installation, theta_max: float = THETA_MAX) -> RatingResult:
    """Permissible current of one cable (per phase) in ``inst`` [A] (module docstring)."""
    n = c.cores
    w_d = c.dielectric_loss_w_per_m()
    t1 = _t1(c)
    t2 = c.t2_k_m_w
    t3 = _t3(c)
    s_mm = c.d_core  # cores touching (three-core laid up / trefoil touching)
    d_s = c.d_sheath_mean
    a_s = math.pi * d_s * c.t_sheath
    rs20 = c.sheath[0] / (a_s * 1e-6)
    x = 2 * OMEGA * 1e-7 * math.log(2 * s_mm / d_s)
    if n == 3:
        d_a = c.d_armour_mean
        wires = math.floor(math.pi * d_a / (c.t_armour_wire * 1.05))
        a_a = wires * math.pi / 4 * c.t_armour_wire**2
        ra20 = STEEL[0] / (a_a * 1e-6)
        c_axis = s_mm / math.sqrt(3)
    theta_c, theta_s = theta_max, theta_max - 10.0
    current = 0.0
    for _ in range(30):
        r = _r_ac(c, theta_c, s_mm)
        rs = rs20 * (1 + c.sheath[1] * (theta_s - 20))
        lam1 = 0.0 if inst.kind == "trefoil" else (rs / r) / (1 + (rs / x) ** 2)  # cross-bonded
        lam2 = 0.0
        if n == 3:
            theta_a_arm = theta_s - 5.0
            ra = ra20 * (1 + STEEL[1] * (theta_a_arm - 20))
            lam2 = (
                1.23 * (ra / r) * (2 * c_axis / d_a) ** 2
                / ((2.77 * ra * 1e6 / OMEGA) ** 2 + 1)
            )  # fmt: skip
        theta_m = (theta_s + inst.theta_ambient) / 2
        w_core = current**2 * r * (1 + lam1 + lam2) + w_d
        if inst.kind == "buried":
            t4 = _t4_buried(inst.rho_soil, inst.depth_m, c.d_outer) + _t4_mutual(inst)
        elif inst.kind == "trefoil":
            u = 2 * inst.depth_m * 1000 / c.d_outer
            t4 = 1.5 / math.pi * inst.rho_soil * (math.log(2 * u) - 0.630) + _t4_mutual(inst)
        elif inst.kind == "duct":
            t4 = _t4_duct(c, inst, theta_m)
        elif inst.kind == "jtube":
            t4, t_air, d_tube = _t4_jtube(c, inst, theta_m, n * w_core)
        else:
            raise ValueError(f"unknown installation kind {inst.kind!r}")
        dth = theta_max - inst.theta_ambient
        if inst.kind == "jtube":
            # the sun on the tube raises everything inside by σ·D·H·T_air (IEC 60287-1-1
            # §1.4.1.2, on the tube's diameter and its surface-to-air resistance)
            dth -= inst.solar_absorption * d_tube * inst.solar_w_m2 * t_air
        num = dth - w_d * (0.5 * t1 + n * (t2 + t3 + t4))
        den = r * t1 + n * r * (1 + lam1) * t2 + n * r * (1 + lam1 + lam2) * (t3 + t4)
        new = math.sqrt(max(num, 0.0) / den)
        w_c = r * new**2
        theta_j = inst.theta_ambient + n * (w_c * (1 + lam1 + lam2) + w_d) * t4
        theta_s_new = (
            theta_j + n * (w_c * (1 + lam1 + lam2) + w_d) * t3 + n * (w_c * (1 + lam1) + w_d) * t2
        )
        theta_c = theta_s_new + (w_c + w_d / 2) * t1
        if abs(new - current) < 1e-6 and abs(theta_s_new - theta_s) < 1e-6:
            current, theta_s = new, theta_s_new
            break
        current, theta_s = new, theta_s_new
    return RatingResult(current, theta_c, theta_s, lam1, lam2, r, t1, t2, t3, t4, w_d)


# ── Cables of the SB-510 export route ────────────────────────────

#: 220 kV three-core submarine cable, 1000 mm² Cu Milliken (network_model.EXPORT_CABLE_1000).
#: Insulation 22.0 mm from the datasheet C = 0.19 µF/km with ε 2.5; cores touching, core OD
#: ≈ 100 mm, which gives L ≈ 0.38 mH/km as the datasheet; lead sheath 3.0 mm, PE core jacket
#: 2.5 mm, steel wire armour 6 mm, PP yarn serving 4 mm (APPROXIMATION, typical builds).
EXPORT_3C_1000 = CableDesign(
    name="220 kV 3-core 1000 mm² Cu, Pb sheaths, SWA",
    cores=3,
    u0_kv=220.0 / math.sqrt(3),
    r20_ohm_per_m=0.0176e-3,
    d_conductor=37.9,
    k_s=0.435,
    k_p=0.37,
    t_conductor_screen=1.5,
    t_insulation=22.0,
    t_insulation_screen=1.2,
    sheath=LEAD,
    t_sheath=3.0,
    t_core_jacket=2.5,
    t_armour_wire=6.0,
    t_bedding=2.0,
    t_serving=4.0,
)
#: 220 kV single-core land cable, 1600 mm² Cu Milliken, Al sheath, trefoil, cross-bonded
#: (APPROXIMATION of a typical land cable for this duty; the subsea cable is not used on land).
LAND_1C_1600 = CableDesign(
    name="220 kV 1-core 1600 mm² Cu, Al sheath (land, trefoil, cross-bonded)",
    cores=1,
    u0_kv=220.0 / math.sqrt(3),
    r20_ohm_per_m=0.0113e-3,
    d_conductor=48.9,
    k_s=0.435,
    k_p=0.37,
    t_conductor_screen=1.5,
    t_insulation=22.0,
    t_insulation_screen=1.2,
    sheath=ALUMINIUM,
    t_sheath=1.5,
    t_core_jacket=5.0,
)

DATASHEET_RATING_A = 825.0
#: Thermal grout of the HDD ducts' surroundings (bentonite-cement), APPROXIMATION.
HDD_GROUT_RHO = 0.7
DATASHEET_CONDITION = Installation("buried", depth_m=1.0, rho_soil=1.0, theta_ambient=20.0)


@lru_cache(maxsize=4)
def calibrated_export_cable(rating_a: float = DATASHEET_RATING_A) -> CableDesign:
    """The three-core cable with T2 solved (bisection) so that the IEC 60287 rating at the
    datasheet's condition equals the datasheet's rating."""
    lo, hi = 0.0, 2.0
    for _ in range(60):
        mid = (lo + hi) / 2
        i = rating(replace(EXPORT_3C_1000, t2_k_m_w=mid), DATASHEET_CONDITION).current_a
        lo, hi = (mid, hi) if i > rating_a else (lo, mid)
    return replace(EXPORT_3C_1000, t2_k_m_w=(lo + hi) / 2)


def hdd_cable() -> CableDesign:
    """The landfall section's cable: the same three-core design with a 1600 mm² Cu
    conductor (transition joints at both ends of the HDD). With the 1000 mm² cable the
    12 m deep HDD rates only ≈ 670 A — below the 778 A it carries at 510 MW
    (``hdd_options``) — the usual landfall bottleneck."""
    return replace(
        calibrated_export_cable(),
        name="220 kV 3-core 1600 mm² Cu, Pb sheaths, SWA (HDD landfall)",
        r20_ohm_per_m=0.0113e-3,
        d_conductor=48.9,
    )


def _cable(kind: str) -> CableDesign:
    return {"subsea": calibrated_export_cable, "hdd": hdd_cable, "land": lambda: LAND_1C_1600}[
        kind
    ]()


_HDD = Installation(
    "duct",
    depth_m=12.0,
    rho_soil=HDD_GROUT_RHO,
    theta_ambient=12.0,
    duct_od_mm=355.0,
    duct_wall_mm=32.3,
    duct_fill="water",
)
#: SB-510 route sections (km from the OSS; ``cable_dts.ZONES``) and their installation.
#: APPROXIMATIONS: Baltic seabed sand 0.7 K·m/W at 15 °C; HDD 12 m deep in a water-filled
#: HDPE duct (OD 355 mm, SDR 11) in thermal grout (0.7 K·m/W) at 12 °C; J-tube ID 500 mm in
#: 25 °C air with full sun on it; land trefoil 1.3 m deep, 1.0 K·m/W, 20 °C, circuits 5 m
#: apart.
ROUTE: tuple[tuple[str, str, Installation], ...] = (
    (
        "OSS J-tube",
        "subsea",
        Installation("jtube", theta_ambient=25.0, tube_id_mm=500.0, solar_w_m2=1000.0),
    ),
    (
        "Subsea burial",
        "subsea",
        Installation("buried", depth_m=1.5, rho_soil=0.7, theta_ambient=15.0),
    ),
    ("HDD landfall", "hdd", _HDD),
    (
        "Land cable",
        "land",
        Installation("trefoil", depth_m=1.3, rho_soil=1.0, theta_ambient=20.0, other_circuit_m=5.0),
    ),
)


def hdd_options() -> list[dict[str, float | str]]:
    """The landfall design study: conductor and surroundings of the 12 m deep HDD."""
    small, big = calibrated_export_cable(), hdd_cable()
    natural = replace(_HDD, rho_soil=1.0)
    rows = (
        ("1000 mm², natural ground 1.0 K·m/W", small, natural),
        ("1000 mm², thermal grout 0.7 K·m/W", small, _HDD),
        ("1600 mm², natural ground 1.0 K·m/W", big, natural),
        ("1600 mm², thermal grout 0.7 K·m/W (SB-510 design)", big, _HDD),
    )
    return [
        {"option": label, "rating_a": round(rating(c, inst).current_a, 1)}
        for label, c, inst in rows
    ]


def route_ratings() -> list[dict[str, float | str]]:
    """IEC 60287 rating of every route section of one export circuit [A]."""
    out: list[dict[str, float | str]] = []
    for name, cable, inst in ROUTE:
        r = rating(_cable(cable), inst)
        out.append(
            {
                "section": name,
                "cable": _cable(cable).name,
                "installation": inst.kind,
                "ambient_c": inst.theta_ambient,
                "rating_a": round(r.current_a, 1),
                "t4_k_m_w": round(r.t4, 3),
                "lambda1": round(r.lambda1, 3),
                "lambda2": round(r.lambda2, 3),
            }
        )
    return out


# ── CIGRE TB 880 case 0-1 (verification) ─────────────────────────

#: 132 kV single core, 630 mm² Cu (IEC 60228: 28.3 µΩ/m), Al sheath 0.8 mm, oversheath
#: 3.5 mm, trefoil touching, 1 m, 20 °C, 1.0 K·m/W, solid bonding (TB 880 §4.2).
TB880_CASE01 = CableDesign(
    name="TB 880 case 0-1",
    cores=1,
    u0_kv=132.0 / math.sqrt(3),
    r20_ohm_per_m=28.3e-6,
    d_conductor=30.3,
    k_s=1.0,
    k_p=1.0,
    t_conductor_screen=1.5,
    t_insulation=15.5,
    t_insulation_screen=1.3,
    sheath=ALUMINIUM,
    t_sheath=0.8,
    t_core_jacket=3.5,
)


def reference_case_tb880() -> RatingResult:
    """TB 880 case 0-1: solidly bonded trefoil (λ1 from §2.3.1), T3 × 1.6 for the
    touching trefoil (IEC 60287-2-1 §4.2.4.3.2), T4 = 1.5/π·ρ·(ln 2u − 0.630)."""
    c = TB880_CASE01
    inst = Installation("trefoil_solid", depth_m=1.0, rho_soil=1.0, theta_ambient=20.0)
    return _rating_trefoil_solid(c, inst)


def _rating_trefoil_solid(c: CableDesign, inst: Installation) -> RatingResult:
    """Single cores in touching trefoil with solid bonding (TB 880 case 0-1 form)."""
    w_d = c.dielectric_loss_w_per_m()
    t1 = _t1(c)
    t3 = 1.6 * _t3(c)
    s_mm = c.d_core
    u = 2 * inst.depth_m * 1000 / c.d_outer
    t4 = 1.5 / math.pi * inst.rho_soil * (math.log(2 * u) - 0.630)
    d_s = c.d_sheath_mean
    rs20 = c.sheath[0] / (math.pi * d_s * c.t_sheath * 1e-6)
    x = 2 * OMEGA * 1e-7 * math.log(2 * s_mm / d_s)
    theta_c, theta_s, current = THETA_MAX, THETA_MAX - 10.0, 0.0
    for _ in range(30):
        r = _r_ac(c, theta_c, s_mm)
        rs = rs20 * (1 + c.sheath[1] * (theta_s - 20))
        lam1 = (rs / r) / (1 + (rs / x) ** 2)
        num = (THETA_MAX - inst.theta_ambient) - w_d * (0.5 * t1 + t3 + t4)
        current = math.sqrt(num / (r * t1 + r * (1 + lam1) * (t3 + t4)))
        w_c = r * current**2
        theta_j = inst.theta_ambient + (w_c * (1 + lam1) + w_d) * t4
        theta_s = theta_j + (w_c * (1 + lam1) + w_d) * t3
        theta_c = theta_s + (w_c + w_d / 2) * t1
    return RatingResult(current, theta_c, theta_s, lam1, 0.0, r, t1, 0.0, t3, t4, w_d)


# ── Load-profile check: the route through 30 years of real wind ──

#: External thermal time constants [h] per section (``cable_dts.ZONES``; assumptions there)
TAU_EXT_H = {"OSS J-tube": 20.0, "Subsea burial": 48.0, "HDD landfall": 150.0, "Land cable": 72.0}
WAKE_LOSS_FOR_PROFILE = 0.10  # farm output = free-stream curve × (1 − wake loss)


@lru_cache(maxsize=4)
def load_profile_check() -> list[dict[str, float | str]]:
    """Conductor temperature of every route section through SB-510's 30-year hindcast.

    A steady-state rating assumes the full current forever; a wind farm runs at full output
    only part of the time, and a deep HDD needs days to heat up. Each 6-hour step: farm output
    from the hindcast's 10 m wind (power-law shear to hub, reference power curve, uniform wake
    loss) → export current of the more loaded circuit end (P2 load flow,
    ``annual_losses.operating_curve``) → losses from the IEC 60287 model of the section; the
    surface-to-ambient rise follows them with the section's external time constant (first
    order, exact for a constant step), the rise inside the cable is quasi-steady (≈ 1 h).
    The section is fine if the conductor stays below 90 °C — the load-profile (cyclic)
    rating principle of IEC 60853, here with the real load sequence instead of a daily cycle.
    """
    from app.services.lifecycle import weather
    from app.services.p1.turbine_models import get_turbine
    from app.services.p2.annual_losses import operating_curve
    from app.services.p2.network_model import SB510

    fractions, _total, parts = operating_curve(SB510)
    _t, _hs, v10 = weather.hindcast()
    turbine = get_turbine(None)
    frac = turbine.power_curve_kw(weather.hub_wind(v10)) / turbine.rated_kw
    frac *= 1 - WAKE_LOSS_FOR_PROFILE
    current = np.interp(frac, fractions, parts["export_current_a"])
    dt_h = float(weather.STEP_HOURS)
    out: list[dict[str, float | str]] = []
    for name, cable, inst in ROUTE:
        c = _cable(cable)
        steady = rating(c, inst)
        n = c.cores
        decay = math.exp(-dt_h / TAU_EXT_H[name])
        solar = 0.0
        if inst.kind == "jtube":  # conservative: the tube in full sun all the time
            w_full = n * (steady.current_a**2 * steady.r_ac_ohm_per_m * 1.9 + steady.w_d)
            _t4, t_air, d_tube = _t4_jtube(c, inst, 60.0, w_full)
            solar = inst.solar_absorption * d_tube * inst.solar_w_m2 * t_air
        theta_e = 0.0  # rise of the cable surface over ambient
        theta_c = inst.theta_ambient
        peak, hours_over = -math.inf, 0.0
        for i in current:
            r = _r_ac(c, theta_c, c.d_core)
            w_c = r * i * i
            lam = 1 + steady.lambda1 + steady.lambda2
            w_tot = n * (w_c * lam + steady.w_d)
            theta_e = theta_e * decay + w_tot * steady.t4 * (1 - decay)
            internal = (
                (w_c + steady.w_d / 2) * steady.t1
                + n * (w_c * (1 + steady.lambda1) + steady.w_d) * steady.t2
                + n * (w_c * lam + steady.w_d) * steady.t3
            )
            theta_c = inst.theta_ambient + solar + theta_e + internal
            peak = max(peak, theta_c)
            hours_over += dt_h if theta_c > THETA_MAX else 0.0
        out.append(
            {
                "section": name,
                "steady_rating_a": round(steady.current_a, 1),
                "full_output_current_a": round(float(parts["export_current_a"][-1]), 1),
                "peak_conductor_c": round(float(peak), 1),
                "hours_above_90c": hours_over,
                "tau_ext_h": TAU_EXT_H[name],
            }
        )
    return out

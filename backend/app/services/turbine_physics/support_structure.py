"""
Support structure dynamics of the SB-510 turbine: tower + jacket natural frequencies
against the rotor's 1P / 3P bands (engineering audit B-6).

A fixed offshore turbine is designed "soft-stiff": the first bending frequency of the whole
structure must sit between the rotor's highest 1P and lowest 3P excitation, with a margin
(DNV-ST-0126 §4: typically ±10 %), or the rotor drives resonance and fatigue. For the
IEA 15 MW (5.0–7.56 rpm): 1P 0.083–0.126 Hz, 3P 0.250–0.378 Hz.

Model: a 3D Euler–Bernoulli frame finite-element model (12 DOF per element, consistent mass)
of
- the IEA-15-240-RWT tower: distributed mass and bending stiffness of the official
  ElastoDyn tower file (IEA-15-240-RWT-Monopile_ElastoDyn_tower.dat, v1.1, Apache-2.0),
  20 stations, mounted from the interface level to 144.386 m;
- the 3-legged jacket for 50 m water depth that DEME Group published for this turbine
  (github.com/mmrocze2/IEA-15-240-RWT, OpenFAST/IEA-15-240-RWT-Jacket SubDyn input):
  33 joints, 66 tubular members, 150 t at each of the three interface joints, a rigid
  transition piece tying joints 1–6 to the tower base at +30 m, legs clamped at the mudline
  except a 1 GN/m vertical soil spring;
- the rotor–nacelle assembly as a rigid body at the tower top: blades 3 × 68.5 t (the
  ElastoDyn blade file integrated), hub 69.4 t, nacelle 646.9 t, yaw bearing 28.3 t, with
  the official offsets (overhang 12.1 m upwind, shaft 4.35 m and nacelle CM 4.28 m above
  the tower top, nacelle CM 4.72 m upwind).

Verification: DEME report the global first natural frequency of this turbine–jacket model as
≈ 0.221 Hz from an OpenFAST free-decay test (``REFERENCE_JACKET_HZ``); tests/
test_support_structure.py compares. SB-510's sites are 37–51 m deep; the 50 m jacket is the
reference structure for the deepest positions (a shallower site gives a stiffer jacket).
The 50-year sea state (Hs50 from the 30-year hindcast, ``lifecycle.weather.extreme_hs``)
sets the wave-excitation band 1/Tp, which must lie well below f1.
Not modelled: hydrodynamic added mass of the members (≈ 1–2 % on frequency), pile–soil
flexibility beyond the vertical spring (as in the reference model), rotor aero-elasticity.
"""

from __future__ import annotations

import itertools
import math
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from scipy.linalg import eigh

from app.services.lifecycle.weather import extreme_hs

E_STEEL = 2.0e11
G_STEEL = 79.3e9
RHO_STEEL = 7850.0
RPM_MIN, RPM_MAX = 5.0, 7.56  # IEA 15 MW (ROSCO VS_MinOMSpd / PC_RefSpd)
SOFT_STIFF_MARGIN = 0.10  # DNV-ST-0126 frequency margin to 1P / 3P
REFERENCE_JACKET_HZ = 0.221  # DEME, OpenFAST free decay

# ── IEA-15-240-RWT tower (ElastoDyn: height fraction, kg/m, EI fore-aft N·m²) ──
TOWER_TOP_M = 144.386
TOWER_STATIONS: tuple[tuple[float, float, float], ...] = (
    (0.0, 10314.84, 3.065447e12),
    (0.1004745, 10314.84, 3.065447e12),
    (0.1004823, 9523.82, 2.832085e12),
    (0.2009491, 9453.08, 2.769450e12),
    (0.2009568, 8761.31, 2.568166e12),
    (0.3014236, 8333.52, 2.210056e12),
    (0.3014314, 7943.34, 2.107287e12),
    (0.4018982, 7428.46, 1.723500e12),
    (0.4019059, 7087.21, 1.644879e12),
    (0.5023727, 6538.10, 1.291405e12),
    (0.5023805, 6197.17, 1.224549e12),
    (0.6028473, 5616.52, 9.115850e11),
    (0.6028550, 5253.48, 8.530980e11),
    (0.7033218, 4910.28, 6.965893e11),
    (0.7033296, 4334.17, 6.154310e11),
    (0.8037964, 4232.82, 5.732590e11),
    (0.8038041, 3673.39, 4.979639e11),
    (0.9042709, 3577.28, 4.598938e11),
    (0.9042787, 4120.14, 5.291724e11),
    (1.0, 4074.84, 5.119079e11),
)

# ── Rotor–nacelle assembly (ElastoDyn) ──
BLADE_MASS_KG = 68_516.0
BLADE_INERTIA_APEX_KGM2 = 117.05e6  # one blade about the rotor apex
HUB_MASS_KG = 69_360.0
NACELLE_MASS_KG = 646_895.0
YAW_BEARING_MASS_KG = 28_280.0
OVERHANG_M = -12.098  # rotor apex, x downwind (negative = upwind)
TWR2SHFT_M = 4.349
NAC_CM = (-4.720, 4.275)  # (x downwind, z up) from the tower top

# ── DEME jacket for 50 m water depth (SubDyn joints [x, y, z] m) ──
JACKET_JOINTS: tuple[tuple[float, float, float], ...] = (
    (0.0, 10.0, 30.0), (8.66, -5.0, 30.0), (-8.66, -5.0, 30.0),
    (0.0, 8.66, 19.0), (7.5, -4.33, 19.0), (-7.5, -4.33, 19.0),
    (0.0, 10.623, 6.0), (9.2, -5.312, 6.0), (-9.2, -5.312, 6.0),
    (0.0, 12.888, -9.0), (11.162, -6.444, -9.0), (-11.162, -6.444, -9.0),
    (0.0, 15.455, -26.0), (13.385, -7.728, -26.0), (-13.385, -7.728, -26.0),
    (0.0, 18.475, -46.0), (16.0, -9.238, -46.0), (-16.0, -9.238, -46.0),
    (0.0, 18.475, -50.0), (16.0, -9.238, -50.0), (-16.0, -9.238, -50.0),
    (4.175, 2.41, 12.5), (0.0, -4.821, 12.5), (-4.175, 2.41, 12.5),
    (5.09, 2.939, -1.5), (0.0, -5.878, -1.5), (-5.09, 2.939, -1.5),
    (6.137, 3.543, -17.5), (0.0, -7.086, -17.5), (-6.137, 3.543, -17.5),
    (7.346, 4.241, -36.0), (0.0, -8.483, -36.0), (-7.346, 4.241, -36.0),
)  # fmt: skip
# property sets: (outer diameter, wall thickness) [m]
JACKET_PROPS: tuple[tuple[float, float], ...] = (
    (1.7, 0.080), (1.7, 0.080), (1.7, 0.080), (1.9, 0.090), (2.4, 0.090),
    (3.0, 0.100), (1.0, 0.020), (1.1, 0.020), (1.1, 0.020), (1.5, 0.040),
)  # fmt: skip
# members: (joint 1, joint 2, property set), 1-based as in SubDyn
_LEGS = [(j, j + 3, (j - 1) // 3 + 1) for j in range(1, 19)]
_X_BRACES = [
    (c, j, p)
    for c, js, p in (
        (22, (4, 5, 7, 8), 7), (23, (5, 6, 8, 9), 7), (24, (6, 4, 9, 7), 7),
        (25, (7, 8, 10, 11), 8), (26, (8, 9, 11, 12), 8), (27, (9, 7, 12, 10), 8),
        (28, (10, 11, 13, 14), 9), (29, (11, 12, 14, 15), 9), (30, (12, 10, 15, 13), 9),
        (31, (13, 14, 16, 17), 10), (32, (14, 15, 17, 18), 10), (33, (15, 13, 18, 16), 10),
    )
    for j in js
]  # fmt: skip
JACKET_MEMBERS: tuple[tuple[int, int, int], ...] = tuple(_LEGS + _X_BRACES)
TP_MASS_KG = 150_000.0  # at each of joints 1–3
TP_INERTIA = (1.25e6, 1.25e6, 2.5e6)
SOIL_KZZ = 1e9  # N/m at each leg foot
INTERFACE_Z = 30.0


def _tube(d: float, t: float) -> tuple[float, float]:
    """Area [m²] and second moment [m⁴] of a circular tube."""
    di = d - 2 * t
    return math.pi / 4 * (d * d - di * di), math.pi / 64 * (d**4 - di**4)


def _element(
    p1: np.ndarray, p2: np.ndarray, ea: float, ei: float, gj: float, m_len: float, j_mass: float
) -> tuple[np.ndarray, np.ndarray]:
    """Global 12×12 stiffness and consistent mass of a 3D Euler–Bernoulli beam."""
    d = p2 - p1
    length = float(np.linalg.norm(d))
    ex = d / length
    ref = np.array([0.0, 0.0, 1.0]) if abs(ex[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    ey = np.cross(ref, ex)
    ey /= np.linalg.norm(ey)
    ez = np.cross(ex, ey)
    lam = np.vstack([ex, ey, ez])
    t = np.zeros((12, 12))
    for b in range(4):
        t[3 * b : 3 * b + 3, 3 * b : 3 * b + 3] = lam
    k = np.zeros((12, 12))
    L = length  # noqa: N806
    k[0, 0] = k[6, 6] = ea / L
    k[0, 6] = k[6, 0] = -ea / L
    k[3, 3] = k[9, 9] = gj / L
    k[3, 9] = k[9, 3] = -gj / L
    for v, th, s in ((1, 5, 1.0), (2, 4, -1.0)):  # bending in local y (θz) and z (θy)
        idx = [v, th, v + 6, th + 6]
        kb = (
            ei
            / L**3
            * np.array(
                [
                    [12, 6 * L * s, -12, 6 * L * s],
                    [6 * L * s, 4 * L * L, -6 * L * s, 2 * L * L],
                    [-12, -6 * L * s, 12, -6 * L * s],
                    [6 * L * s, 2 * L * L, -6 * L * s, 4 * L * L],
                ]
            )
        )
        k[np.ix_(idx, idx)] += kb
    m = np.zeros((12, 12))
    mt = m_len * L
    m[np.ix_([0, 6], [0, 6])] += mt / 6 * np.array([[2, 1], [1, 2]])
    m[np.ix_([3, 9], [3, 9])] += j_mass * L / 6 * np.array([[2, 1], [1, 2]])
    for v, th, s in ((1, 5, 1.0), (2, 4, -1.0)):
        idx = [v, th, v + 6, th + 6]
        mb = (
            mt
            / 420
            * np.array(
                [
                    [156, 22 * L * s, 54, -13 * L * s],
                    [22 * L * s, 4 * L * L, 13 * L * s, -3 * L * L],
                    [54, 13 * L * s, 156, -22 * L * s],
                    [-13 * L * s, -3 * L * L, -22 * L * s, 4 * L * L],
                ]
            )
        )
        m[np.ix_(idx, idx)] += mb
    return t.T @ k @ t, t.T @ m @ t


def _rigid_mass(
    mass: float, offset: tuple[float, float, float], j: tuple[float, float, float]
) -> np.ndarray:
    """6×6 mass matrix at a node of a rigid body whose CM sits at ``offset``."""
    cx, cy, cz = offset
    s = np.array([[0, -cz, cy], [cz, 0, -cx], [-cy, cx, 0]])
    mm = np.zeros((6, 6))
    mm[:3, :3] = mass * np.eye(3)
    mm[:3, 3:] = -mass * s
    mm[3:, :3] = mass * s
    mm[3:, 3:] = np.diag(j) - mass * s @ s
    return mm


@dataclass(frozen=True)
class Modes:
    frequencies_hz: tuple[float, ...]
    first_bending_hz: float
    band_1p_hz: tuple[float, float]
    band_3p_hz: tuple[float, float]
    soft_stiff_ok: bool
    margin_to_1p: float  # f1 / 1P_max − 1
    margin_to_3p: float  # 1 − f1 / 3P_min
    wave_band_hz: tuple[float, float]  # 1/Tp range of the 50-year sea state
    hs50_m: float


def _rna_mass_matrix() -> np.ndarray:
    """Rigid RNA at the tower top: blades + hub at the rotor apex, nacelle, yaw bearing."""
    rotor = 3 * BLADE_MASS_KG + HUB_MASS_KG
    apex = (OVERHANG_M, 0.0, TWR2SHFT_M)
    # rotor inertia about a diameter through the apex: half the polar (blades) — about the
    # pitch (y) and yaw (z) axes
    j_rot = 1.5 * BLADE_INERTIA_APEX_KGM2
    m = _rigid_mass(rotor, apex, (3 * BLADE_INERTIA_APEX_KGM2, j_rot, j_rot))
    m += _rigid_mass(NACELLE_MASS_KG, (NAC_CM[0], 0.0, NAC_CM[1]), (0.0, 0.0, 0.0))
    m += _rigid_mass(YAW_BEARING_MASS_KG, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0))
    return m


@lru_cache(maxsize=4)
def jacket_modes(tower_elements_per_station: int = 2, n_modes: int = 6) -> Modes:
    """Natural frequencies of the IEA 15 MW on the 50 m jacket (module docstring)."""
    # nodes: jacket joints (0..32), tower nodes after them
    nodes = [np.array(j) for j in JACKET_JOINTS]
    elems: list[tuple[int, int, float, float, float, float, float]] = []
    for j1, j2, p in JACKET_MEMBERS:
        d, t = JACKET_PROPS[p - 1]
        a, i = _tube(d, t)
        elems.append(
            (
                j1 - 1,
                j2 - 1,
                E_STEEL * a,
                E_STEEL * i,
                G_STEEL * 2 * i,
                RHO_STEEL * a,
                RHO_STEEL * 2 * i,
            )
        )
    # tower from the interface to the top, stations subdivided
    h = TOWER_TOP_M - INTERFACE_Z
    base = len(nodes)
    nodes.append(np.array([0.0, 0.0, INTERFACE_Z]))
    prev = base
    for (f1, m1, ei1), (f2, m2, ei2) in itertools.pairwise(TOWER_STATIONS):
        if f2 - f1 < 1e-4:
            continue
        for s in range(tower_elements_per_station):
            a1 = f1 + (f2 - f1) * (s + 1) / tower_elements_per_station
            mid = (s + 0.5) / tower_elements_per_station
            m_len = m1 + (m2 - m1) * mid
            ei = ei1 + (ei2 - ei1) * mid
            nodes.append(np.array([0.0, 0.0, INTERFACE_Z + a1 * h]))
            cur = len(nodes) - 1
            # thin-wall tube: GJ ≈ 2·G/E·EI, EA from the steel area of the mass density
            elems.append(
                (
                    prev,
                    cur,
                    E_STEEL * m_len / RHO_STEEL,
                    ei,
                    2 * G_STEEL / E_STEEL * ei,
                    m_len,
                    m_len * 2 * ei / (E_STEEL * m_len / RHO_STEEL),
                )
            )
            prev = cur
    top = prev
    n_dof = 6 * len(nodes)
    k_g = np.zeros((n_dof, n_dof))
    m_g = np.zeros((n_dof, n_dof))
    for i1, i2, ea, ei, gj, ml, jm in elems:
        ke, me = _element(nodes[i1], nodes[i2], ea, ei, gj, ml, jm)
        dofs = list(range(6 * i1, 6 * i1 + 6)) + list(range(6 * i2, 6 * i2 + 6))
        k_g[np.ix_(dofs, dofs)] += ke
        m_g[np.ix_(dofs, dofs)] += me
    for j in range(3):  # transition piece masses at joints 1–3
        dof = list(range(6 * j, 6 * j + 6))
        m_g[np.ix_(dof, dof)] += np.diag([TP_MASS_KG] * 3 + list(TP_INERTIA))
    m_g[6 * top : 6 * top + 6, 6 * top : 6 * top + 6] += _rna_mass_matrix()
    for j in (18, 19, 20):  # leg feet: clamped except a vertical soil spring
        k_g[6 * j + 2, 6 * j + 2] += SOIL_KZZ

    # constraints: rigid TP — joints 1–6 slaved to the tower base node; feet fixed (not z)
    master = base
    t_map = np.eye(n_dof)
    slaves: list[int] = []
    for j in range(6):
        r = nodes[j] - nodes[master]
        rows = np.zeros((6, n_dof))
        rows[:, 6 * master : 6 * master + 6] = np.block(
            [[np.eye(3), -np.array([[0, -r[2], r[1]], [r[2], 0, -r[0]], [-r[1], r[0], 0]])],
             [np.zeros((3, 3)), np.eye(3)]]
        )  # fmt: skip
        t_map[6 * j : 6 * j + 6, :] = rows
        slaves.extend(range(6 * j, 6 * j + 6))
    fixed = [6 * j + d for j in (18, 19, 20) for d in (0, 1, 3, 4, 5)]
    keep = [d for d in range(n_dof) if d not in slaves and d not in fixed]
    t_red = t_map[:, keep]
    k_r = t_red.T @ k_g @ t_red
    m_r = t_red.T @ m_g @ t_red
    w2 = eigh(k_r, m_r, eigvals_only=True, subset_by_index=[0, n_modes - 1])
    freqs = tuple(float(math.sqrt(max(x, 0.0)) / (2 * math.pi)) for x in w2)
    f1 = freqs[0]
    p1 = (RPM_MIN / 60, RPM_MAX / 60)
    p3 = (3 * RPM_MIN / 60, 3 * RPM_MAX / 60)
    m1 = f1 / p1[1] - 1
    m3 = 1 - f1 / p3[0]
    sea = extreme_hs(50.0)
    return Modes(
        frequencies_hz=tuple(round(f, 4) for f in freqs),
        first_bending_hz=round(f1, 4),
        band_1p_hz=(round(p1[0], 4), round(p1[1], 4)),
        band_3p_hz=(round(p3[0], 4), round(p3[1], 4)),
        soft_stiff_ok=m1 >= SOFT_STIFF_MARGIN and m3 >= SOFT_STIFF_MARGIN,
        margin_to_1p=round(m1, 3),
        margin_to_3p=round(m3, 3),
        wave_band_hz=(round(1 / sea.tp_range_s[1], 4), round(1 / sea.tp_range_s[0], 4)),
        hs50_m=sea.hs_m,
    )

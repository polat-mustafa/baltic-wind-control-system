"""
Pandapower network model for 510 MW Baltic Sea offshore wind farm.

Builds the complete 66/220/400 kV electrical network as a Pandapower model:
34 WTGs connected via 66 kV array cables through an offshore substation (OSS),
two parallel 220 kV HVAC export cables (108 km: 79.3 subsea + 28.7 land), and a 220/400 kV
onshore transformer
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

For one 220 kV, 108 km export cable: Q ≈ 2π×50 × 190e-9 × 220000² × 108 ≈ 312 MVAR
For the two parallel export cables: Q ≈ 624 MVAR

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

Cable Data (sources and quality: provenance note at the cable constants below)
---------------------------------------------------------
R20 = IEC 60228 DC resistance at 20 °C; R90 = AC resistance at 90 °C (see below).

Array 66 kV cables (3-core, Cu, round compacted conductor), each segment the smallest
section that carries the turbines downstream at rated power (``_get_cable_grade``):
  - 500 mm²:  R20 = 0.0366, R90 = 0.0493 Ω/km, X = 0.107 Ω/km, C = 290 nF/km, Imax 655 A
  - 630 mm²:  R20 = 0.0283, R90 = 0.0395 Ω/km, X = 0.104 Ω/km, C = 320 nF/km, Imax 715 A
  - 800 mm²:  R20 = 0.0221, R90 = 0.0325 Ω/km, X = 0.101 Ω/km, C = 350 nF/km, Imax 775 A
  - 1000 mm²: R20 = 0.0176, R90 = 0.0277 Ω/km, X = 0.097 Ω/km, C = 380 nF/km, Imax 825 A

Export 220 kV cable (per circuit, 2 circuits in parallel, Cu Milliken conductor, 1000 mm²):
  - R20 = 0.0176, R90 = 0.0233 Ω/km, X = 0.119 Ω/km, C = 190 nF/km, Imax 825 A

Which resistance where?
------------------------
  R_AC,90 = R20 × (1 + α_Cu × (90 − 20)) × (1 + y_s + y_p)      IEC 60287-1-1 §2.1
  α_Cu = 0.00393 1/K; y_s / y_p = skin / proximity effect (``CableSpec.ac_factor``,
  ``iec60287_ac_factor``):
    round compacted (k_s = 1, k_p = 0.8), core spacing ≈ d_c + 33 mm:
      500 mm² 1.056 · 630 mm² 1.094 · 800 mm² 1.154 · 1000 mm² 1.236
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

Constants (SB-510)
-----------------------------
- 34 × 15 MW ("V236 class", IEA 15 MW reference) = 510 MW total
- 4 strings × 6 WTGs + 2 strings × 5 WTGs = 34 WTGs (same split as the landing map,
  the DB seed and the 6 string feeder bays in P3/P5)
- Array cable spacing: 1.5 km average
- Export cables: 2 × 108 km, 220 kV (site PZP_44 → round the west end of Ławica
  Słupska → across shipping basins PZP_15 / PZP_10 at 62–67° → the corridor between
  Darłowo's approach channel PZP_23 and the military National Defence Area off Ustka →
  landfall Darłówko-Wschodnie → 28.7 km on land, north of the Natura 2000 site Dolina
  Wieprzy i Studnicy (PLH220038) → PSE Krzemienica, the real connection point of site
  44.E.1 (Baltica 9+, PGE). Checked with the route check (2026-10-08); until then the
  route ran 76.5 km to Słupsk-Wierzbięcino through 24.5 km of the military area).
  ``design(STRING_LAYOUT, 108.0)`` reproduces every value below.
- Shunt reactors: 4 × 180 MVAR, one per export circuit at each cable end (2 at OSS 220 kV,
  2 at the onshore 220 kV busbar) — the charging current splits between both ends
- Transformers: 2 × 300 MVA 66/220 kV (OSS, TX-OSS-01/02) + 2 × 300 MVA 220/400 kV
  (onshore). ~86 % loaded each at 510 MW; losing one keeps ~300 MW exporting
  instead of 0 MW for the 6-12 months an offshore transformer replacement takes
- Grid Ssc: 10,000 MVA at 400 kV PCC
- Base MVA: 100 (Rule 2)

Other farms (FarmSpec, design)
------------------------------
The constants above are the SB-510 design and stay the defaults. ``FarmSpec``
describes any farm with the same topology (66 kV radial strings → OSS with two
66/220 kV units on busbar sections A/B → n × 220 kV export circuits → two
220/400 kV units → PSE). ``design()`` sizes it with rules that give the SB-510
numbers back (tests/test_farm_spec.py):

- export circuits: n = ⌈P / P_circuit(L)⌉ with P_circuit = √3·U·√(Imax² − (Ic/2)²),
  Ic = ωC·L·U/√3 (charging current shared by both cable ends, as in planning.py);
- OSS transformer unit = larger busbar section (strings 1…⌈n/2⌉ on A) / 0.9,
  onshore unit = P / 2 / 0.9, both rounded up to 50 MVA (≤ 90 % loading at P_max);
- STATCOM = ±120 MVAR per 510 MW, rounded up to 10 MVAR (scaled from the SB-510
  design; ``statcom_sizing.poc_q_capability`` checks the PSE Q range), but at
  least 1.15·Q_cable/(4n − 1) — see the reactors;
- shunt reactors, one per export circuit at each cable end (2n units: n at the OSS,
  n onshore), so each end absorbs about half of the cable's charging current — the
  assumption behind P_circuit above. With all reactors at the OSS the OSS end carries
  the whole charging current: on SB-510 that is 830 A on an 825 A cable at 510 MW.
  Unit u = ⌈(Q_cable − STATCOM/1.15) / (2n − 1)⌉₁₀, so that with one reactor out the
  STATCOM still covers the rest with its 15 % margin; with all 2n in they
  over-compensate by 2n·u − Q_cable, which the STATCOM covers if
  STATCOM ≥ 1.15·Q_cable/(4n − 1) — hence its lower bound. No reactors if the STATCOM
  alone covers Q_cable.
Branched array strings (the frontend's Esau–Williams trees) are modelled as
radial chains with the mean section length.
"""

import math
from dataclasses import dataclass, replace
from functools import lru_cache

import numpy as np
import pandapower as pp

from app.core.exceptions import DomainError

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


# Provenance (Phase 12; quality as in the frontend SourceBadge):
# - r_ohm_per_km: IEC 60228 class 2 Cu maximum DC resistance at 20 °C — official.
# - c_nf_per_km, x_ohm_per_km (= ωL), max_i_ka: ABB "XLPE Submarine Cable Systems",
#   2GM5007 rev 5 (ABB's cable business is now NKT) — literature:
#   66 kV three-core, Table 45: 500 / 630 / 800 / 1000 mm² → 0.29 / 0.32 / 0.35 / 0.38 µF/km,
#   0.34 / 0.33 / 0.32 / 0.31 mH/km; rating Table 33 (10–90 kV, Cu): 655 / 715 / 775 / 825 A.
#   220 kV three-core 1000 mm², Table 49: 0.19 µF/km, 0.38 mH/km; rating Table 34: 825 A.
#   Ratings are IEC 60287 values for one cable 1.0 m deep in a 20 °C seabed of 1.0 K·m/W
#   (the brochure calls them indicative); ORBIT v1.3 XLPE_630mm_66kV (775 A) and
#   XLPE_1000mm_220kV (825 A, 190 nF/km, 0.38 mH/km) agree on the 220 kV cable.
# - ac_factor = 1 + y_s + y_p at 90 °C, IEC 60287-1-1 §2.1 (``iec60287_ac_factor``):
#   66 kV round compacted Cu (k_s = 1, k_p = 0.8, core spacing d_c + 33 mm, d_c from
#   Table 45); 220 kV 1000 mm² Milliken (k_s = 0.435, k_p = 0.37, s ≈ 120 mm) — approximation
#   (the spacing is a geometric estimate; a Milliken 66 kV 1000 mm² would give 1.056).

# 66 kV array cables — the smallest section whose rating carries the turbines downstream
ARRAY_CABLE_500 = CableSpec(500, 0.0366, 0.1068, 290, 0.655, ac_factor=1.056)
ARRAY_CABLE_630 = CableSpec(630, 0.0283, 0.1037, 320, 0.715, ac_factor=1.094)
ARRAY_CABLE_800 = CableSpec(800, 0.0221, 0.1005, 350, 0.775, ac_factor=1.154)
ARRAY_CABLE_1000 = CableSpec(1000, 0.0176, 0.0974, 380, 0.825, ac_factor=1.236)
ARRAY_SECTIONS = (ARRAY_CABLE_500, ARRAY_CABLE_630, ARRAY_CABLE_800, ARRAY_CABLE_1000)
ARRAY_KV = 66.0

# 220 kV export cable (per circuit)
EXPORT_CABLE_1000 = CableSpec(1000, 0.0176, 0.1194, 190, 0.825, ac_factor=1.039)
NUM_EXPORT_CABLES = 2  # 1 × 314 MVA (√3·220 kV·825 A) < 510 MW → two circuits in parallel


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
EXPORT_CABLE_LENGTH_KM = 108.0

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

# On-load tap changers (both stages), HV side: ±10 steps × 1.25 % — typical, not a
# vendor value. tap_pos = 0 (neutral) everywhere unless a study moves it.
OLTC_STEPS = 10
OLTC_STEP_PERCENT = 1.25

# Grid connection
GRID_SSC_MVA = 10_000.0  # Short-circuit power at PCC [MVA] (illustrative default)
#: Upper bound of a project's grid short-circuit power: PSE's 400 kV switchgear is rated up to
#: 63 kA (the highest of its 40 / 50 / 63 kA standard ratings) → √3 · 400 kV · 63 kA.
GRID_SSC_MAX_MVA = round(math.sqrt(3) * 400.0 * 63.0)
#: SB-510's PSE connection point (region pack grid node, OSM / PSE).
SB510_GRID_NODE = "Krzemienica 400 kV"
GRID_RX_RATIO = 0.1  # R/X ratio of grid impedance

# STATCOM and reactors
STATCOM_RATING_MVAR = 120.0  # ±120 MVAR
# One reactor per export circuit at each cable end. One out of service:
# (624 − 3 × 180) × 1.15 = 97 MVAR fits the ±120 MVAR STATCOM; all four in
# over-compensate by 96 MVAR (× 1.15 = 110). At high load the operator switches one out
# (load_flow.dispatch_with_reactor_switching).
NUM_SHUNT_REACTORS = 2 * NUM_EXPORT_CABLES  # n at the OSS + n onshore
SHUNT_REACTOR_UNIT_MVAR = 180.0  # absorption per reactor [MVAR]
SHUNT_REACTOR_MVAR = NUM_SHUNT_REACTORS * SHUNT_REACTOR_UNIT_MVAR  # 720 MVAR total

# Harmonic filter at the OSS 66 kV busbar — damped 2nd-order high-pass (C in series with
# L ∥ R), sized by ``power_quality.size_harmonic_filter``: without it the array-cable
# capacitance and the OSS transformers resonate at 880 Hz (amplification 15.7) and h17
# reaches 74.5 % of the IEC TR 61000-3-6 planning level at 66 kV. 2 Mvar tuned to h16
# (C 1.46 µF, L 27.2 mH, R 205 Ω) damps the peak to 840 Hz, amplification 1.5, h17 31.5 %
# (power_quality module docstring).
HARMONIC_FILTER_MVAR = 2.0  # fundamental reactive output [Mvar], generating (Rule 4)
HARMONIC_FILTER_TUNED_ORDER = 16.0  # 800 Hz


# ── Farm specification (SB-510 or the learner's project) ─────────

TRAFO_MAX_LOADING = 0.9  # design loading of a transformer unit at P_max
STATCOM_MVAR_PER_MW = STATCOM_RATING_MVAR / TOTAL_CAPACITY_MW  # SB-510 ratio
STATCOM_MARGIN = 1.15  # temperature 10 % + ageing 5 % (statcom_sizing.size_statcom)
MAX_EXPORT_CIRCUITS = 4  # beyond this an HVAC export is not a sensible design
# Most turbines one string carries on the largest array cable (1000 mm², 825 A at 66 kV)
MAX_TURBINES_PER_STRING = math.floor(
    math.sqrt(3) * ARRAY_KV * ARRAY_SECTIONS[-1].max_i_ka / TURBINE_RATED_MW
)
EXPORT_KV = 220.0
OMEGA = 2.0 * math.pi * 50.0


def _round_up(x: float, step: float) -> float:
    return math.ceil(x / step - 1e-9) * step


@dataclass(frozen=True)
class FarmSpec:
    """Electrical design of a farm on the SB-510 topology (see module docstring)."""

    name: str
    string_layout: tuple[int, ...]
    export_length_km: float
    array_cable_length_km: float  # mean section length between turbines [km]
    num_export_cables: int
    oss_trafo_mva: float  # per unit, NUM_OSS_TRANSFORMERS units
    onshore_trafo_mva: float  # per unit, NUM_ONSHORE_TRANSFORMERS units
    statcom_mvar: float
    num_reactors: int
    reactor_unit_mvar: float
    turbine_rated_mw: float = TURBINE_RATED_MW
    grid_ssc_mva: float = GRID_SSC_MVA
    harmonic_filter_mvar: float = 0.0  # damped high-pass at OSS 66 kV, 50 Hz output [Mvar]
    harmonic_filter_tuned_order: float = 0.0
    grid_node: str = SB510_GRID_NODE  # PSE 400 kV connection point (site assessment)

    @property
    def num_turbines(self) -> int:
        return sum(self.string_layout)

    @property
    def capacity_mw(self) -> float:
        return self.num_turbines * self.turbine_rated_mw

    @property
    def reactor_mvar(self) -> float:
        return self.num_reactors * self.reactor_unit_mvar

    @property
    def reactors_per_end(self) -> int:
        """Reactors at each cable end (OSS and onshore), one per export circuit."""
        return self.num_reactors // 2

    @property
    def reactor_mvar_per_end(self) -> float:
        return self.reactors_per_end * self.reactor_unit_mvar

    @property
    def oss_pfe_kw(self) -> float:
        """No-load loss of one OSS transformer, scaled with its rating from SB-510 [kW]."""
        return TRAFO_66_220_PFE_KW * self.oss_trafo_mva / TRAFO_66_220_MVA

    @property
    def onshore_pfe_kw(self) -> float:
        """No-load loss of one onshore transformer, scaled with its rating [kW]."""
        return TRAFO_220_400_PFE_KW * self.onshore_trafo_mva / TRAFO_220_400_MVA

    @property
    def section_a_strings(self) -> int:
        """Strings 1 … n sit on 66 kV busbar section A (TX-OSS-01), the rest on B."""
        return math.ceil(len(self.string_layout) / 2)

    @property
    def cable_q_mvar(self) -> float:
        """Charging power of all export circuits at 220 kV, ωCV²L (Rule 7, positive)."""
        return export_charging_mvar(self.export_length_km) * self.num_export_cables


def export_charging_mvar(length_km: float) -> float:
    """Charging power of one 220 kV export circuit, ωCV²L [MVAR]."""
    c_f = EXPORT_CABLE_1000.c_nf_per_km * 1e-9
    return OMEGA * c_f * (EXPORT_KV * 1e3) ** 2 * length_km / 1e6


def export_circuit_capacity_mw(length_km: float) -> float:
    """Active power one export circuit carries at unity PF with its charging current
    compensated at both ends: √3·U·√(Imax² − (Ic/2)²) [MW] (as in planning.py)."""
    u = EXPORT_KV * 1e3
    ic = OMEGA * EXPORT_CABLE_1000.c_nf_per_km * 1e-9 * length_km * u / math.sqrt(3)
    i_max = EXPORT_CABLE_1000.max_i_ka * 1e3
    return math.sqrt(3) * u * math.sqrt(max(i_max**2 - (ic / 2) ** 2, 0.0)) / 1e6


@lru_cache(maxsize=64)
def design(
    string_layout: tuple[int, ...],
    export_length_km: float,
    array_cable_length_km: float = ARRAY_CABLE_LENGTH_KM,
    name: str = "Own project",
    grid_node: str = SB510_GRID_NODE,
    grid_ssc_mva: float = GRID_SSC_MVA,
) -> FarmSpec:
    """Size export, transformers, STATCOM and reactors of a farm (module docstring)."""
    if not string_layout or min(string_layout) < 1:
        raise DomainError(
            "A farm needs at least one string with at least one turbine.", status_code=422
        )
    capacity = sum(string_layout) * TURBINE_RATED_MW
    p_circuit = export_circuit_capacity_mw(export_length_km)
    if p_circuit <= 0 or capacity / p_circuit > MAX_EXPORT_CIRCUITS:
        raise DomainError(
            f"A 220 kV HVAC export of {export_length_km:.0f} km cannot carry {capacity:.0f} MW "
            f"on ≤ {MAX_EXPORT_CIRCUITS} circuits — this farm needs HVDC (see the planning study).",
            status_code=422,
        )
    n_export = max(1, math.ceil(capacity / p_circuit - 1e-9))
    n_a = math.ceil(len(string_layout) / 2)
    section = max(sum(string_layout[:n_a]), sum(string_layout[n_a:])) * TURBINE_RATED_MW
    q_cable = export_charging_mvar(export_length_km) * n_export
    statcom = _round_up(
        max(capacity * STATCOM_MVAR_PER_MW, STATCOM_MARGIN * q_cable / (4 * n_export - 1)), 10.0
    )
    unit = max(_round_up((q_cable - statcom / STATCOM_MARGIN) / (2 * n_export - 1), 10.0), 0.0)
    n_reactors = 2 * n_export if unit > 0 else 0
    # N-1 design case: one reactor out; all in: over-compensation. The STATCOM covers
    # either with its margin.
    left = abs(q_cable - unit * max(n_reactors - 1, 0))
    over = max(unit * n_reactors - q_cable, 0.0)
    statcom = max(statcom, _round_up(max(left, over) * STATCOM_MARGIN, 10.0))
    spec = FarmSpec(
        name=name,
        string_layout=tuple(string_layout),
        export_length_km=export_length_km,
        array_cable_length_km=array_cable_length_km,
        num_export_cables=n_export,
        oss_trafo_mva=_round_up(section / TRAFO_MAX_LOADING, 50.0),
        onshore_trafo_mva=_round_up(capacity / NUM_ONSHORE_TRANSFORMERS / TRAFO_MAX_LOADING, 50.0),
        statcom_mvar=statcom,
        num_reactors=n_reactors,
        reactor_unit_mvar=unit,
        grid_node=grid_node,
        grid_ssc_mva=grid_ssc_mva,
    )
    # Harmonic filter from the harmonic network of this design (power_quality imports
    # this module, hence the local import).
    from app.services.p2.power_quality import size_harmonic_filter

    q_filter, tuned = size_harmonic_filter(spec)
    return replace(spec, harmonic_filter_mvar=q_filter, harmonic_filter_tuned_order=tuned)


SB510 = FarmSpec(
    name="SB-510",
    string_layout=tuple(STRING_LAYOUT),
    export_length_km=EXPORT_CABLE_LENGTH_KM,
    array_cable_length_km=ARRAY_CABLE_LENGTH_KM,
    num_export_cables=NUM_EXPORT_CABLES,
    oss_trafo_mva=TRAFO_66_220_MVA,
    onshore_trafo_mva=TRAFO_220_400_MVA,
    statcom_mvar=STATCOM_RATING_MVAR,
    num_reactors=NUM_SHUNT_REACTORS,
    reactor_unit_mvar=SHUNT_REACTOR_UNIT_MVAR,
    harmonic_filter_mvar=HARMONIC_FILTER_MVAR,
    harmonic_filter_tuned_order=HARMONIC_FILTER_TUNED_ORDER,
)


_OLTC = {
    "tap_side": "hv",
    "tap_changer_type": "Ratio",  # pandapower 3: without it the tap has no effect
    "tap_neutral": 0,
    "tap_min": -OLTC_STEPS,
    "tap_max": OLTC_STEPS,
    "tap_step_percent": OLTC_STEP_PERCENT,
    "tap_pos": 0,
}


def iec60287_ac_factor(
    r20_ohm_per_km: float, d_c_mm: float, s_mm: float, k_s: float, k_p: float, f_hz: float = 50.0
) -> float:
    """1 + y_s + y_p at 90 °C for a three-core cable, IEC 60287-1-1 §2.1.2–2.1.4.

    x² = 8πf / R' · 10⁻⁷ · k, y = x⁴ / (192 + 0.8 x⁴) (x ≤ 2.8);
    y_p = F_p · (d_c/s)² · [0.312 (d_c/s)² + 1.18 / (F_p + 0.27)].
    """
    r_dc = r20_ohm_per_km * (1.0 + ALPHA_CU_PER_K * (CONDUCTOR_OPERATING_TEMP_C - 20.0)) / 1e3

    def f(k: float) -> float:
        x4 = (8.0 * math.pi * f_hz / r_dc * 1e-7 * k) ** 2
        return x4 / (192.0 + 0.8 * x4)

    q = d_c_mm / s_mm
    f_p = f(k_p)
    return 1.0 + f(k_s) + f_p * q * q * (0.312 * q * q + 1.18 / (f_p + 0.27))


def string_current_ka(turbines: int, turbine_mw: float = TURBINE_RATED_MW) -> float:
    """66 kV current [kA] of n turbines at rated power, unity power factor, 1.0 p.u."""
    return turbines * turbine_mw / (math.sqrt(3) * ARRAY_KV)


def _get_cable_grade(turbines_downstream: int, turbine_mw: float = TURBINE_RATED_MW) -> CableSpec:
    """Smallest 66 kV section whose rating carries ``turbines_downstream`` at rated power.

    SB-510 (15 MW): 1–4 turbines (≤ 525 A) → 500 mm², 5 (656 A) → 630 mm²,
    6 (787 A) → 1000 mm² (825 A, 95 %). 800 mm² (775 A) is too small for six.
    """
    i_ka = string_current_ka(turbines_downstream, turbine_mw)
    return next((c for c in ARRAY_SECTIONS if c.max_i_ka >= i_ka - 1e-9), ARRAY_SECTIONS[-1])


def build_network(
    export_length_km: float | None = None,
    grid_ssc_mva: float | None = None,
    generation_fraction: float = 1.0,
    statcom_q_mvar: float = 0.0,
    enable_reactor: bool = True,
    r_at_operating_temp: bool = True,
    spec: FarmSpec = SB510,
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
    - 4 shunt reactors (4 × 180 MVAR: 2 onshore 220 kV, 2 at OSS 220 kV) if enabled
    - 1 external grid (slack bus) at 400 kV

    Parameters
    ----------
    export_length_km : float | None
        Export cable length [km]; None = the spec's (SB-510: 108).
    grid_ssc_mva : float | None
        Grid short-circuit power at PCC [MVA]; None = the spec's (SB-510: 10,000).
    generation_fraction : float
        Fraction of rated power (0.0–1.0). Default: 1.0 (full load).
    statcom_q_mvar : float
        STATCOM reactive power setpoint [MVAR]. Positive = generating (Rule 4).
    enable_reactor : bool
        If True, include the shunt reactors (one per export circuit at each end).
    r_at_operating_temp : bool
        True (default): cable R = AC resistance at 90 °C, for load flow and losses.
        False: R = DC resistance at 20 °C, as IEC 60909 short-circuit requires.
    spec : FarmSpec
        Farm design (strings, export circuits, transformers, STATCOM, reactors).
        Default: SB-510; the counts in this docstring are SB-510's.

    Returns
    -------
    pp.pandapowerNet
        Pandapower network ready for load flow or short-circuit analysis.
    """
    if export_length_km is None:
        export_length_km = spec.export_length_km
    grid_ssc_mva = spec.grid_ssc_mva if grid_ssc_mva is None else grid_ssc_mva
    net = pp.create_empty_network(name=f"{spec.name} — {spec.capacity_mw:.0f} MW OWF")

    # ── Buses ─────────────────────────────────────────────────────
    bus_pse_400 = pp.create_bus(net, vn_kv=400.0, name="PSE_400kV")
    bus_onshore_220 = pp.create_bus(net, vn_kv=220.0, name="Onshore_220kV")
    bus_oss_220 = pp.create_bus(net, vn_kv=220.0, name="OSS_220kV")
    bus_oss_66 = pp.create_bus(net, vn_kv=66.0, name="OSS_66kV")

    # WTG buses — 34 turbines on 66 kV
    wtg_buses = []
    for i in range(spec.num_turbines):
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
        sn_mva=spec.onshore_trafo_mva,
        vn_hv_kv=400.0,
        vn_lv_kv=220.0,
        vk_percent=TRAFO_220_400_VK_PERCENT,
        vkr_percent=TRAFO_220_400_VKR_PERCENT,
        pfe_kw=spec.onshore_pfe_kw,
        i0_percent=TRAFO_220_400_I0_PERCENT,
        vector_group="YNyn0",
        parallel=NUM_ONSHORE_TRANSFORMERS,
        name="Trafo_220_400kV",
        **_OLTC,
    )

    # 66/220 kV OSS transformer (Dyn11)
    pp.create_transformer_from_parameters(
        net,
        hv_bus=bus_oss_220,
        lv_bus=bus_oss_66,
        sn_mva=spec.oss_trafo_mva,
        vn_hv_kv=220.0,
        vn_lv_kv=66.0,
        vk_percent=TRAFO_66_220_VK_PERCENT,
        vkr_percent=TRAFO_66_220_VKR_PERCENT,
        pfe_kw=spec.oss_pfe_kw,
        i0_percent=TRAFO_66_220_I0_PERCENT,
        vector_group="Dyn11",
        parallel=NUM_OSS_TRANSFORMERS,
        name="Trafo_66_220kV",
        **_OLTC,
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
        parallel=spec.num_export_cables,
        name="Export_220kV",
    )

    # ── Array Cables (66 kV, graded pi-model) ─────────────────────
    wtg_idx = 0
    for string_num, string_len in enumerate(spec.string_layout):
        for pos in range(string_len):
            # Cable from previous element to this WTG
            from_bus = bus_oss_66 if pos == 0 else wtg_buses[wtg_idx - 1]
            to_bus = wtg_buses[wtg_idx]

            # Segment pos carries the turbines from pos to the string end
            cable_spec = _get_cable_grade(string_len - pos, spec.turbine_rated_mw)

            pp.create_line_from_parameters(
                net,
                from_bus=from_bus,
                to_bus=to_bus,
                length_km=spec.array_cable_length_km,
                r_ohm_per_km=r_ohm_per_km(cable_spec),
                x_ohm_per_km=cable_spec.x_ohm_per_km,
                c_nf_per_km=cable_spec.c_nf_per_km,
                max_i_ka=cable_spec.max_i_ka,
                endtemp_degree=80.0,  # XLPE max operating temp for IEC 60909
                name=f"Array_S{string_num + 1}_T{pos + 1}",
            )
            wtg_idx += 1

    # ── WTG Generators (static generators) ────────────────────────
    p_per_wtg = spec.turbine_rated_mw * generation_fraction
    # WTGs operate at unity power factor (Q = 0) by default
    for i, bus_id in enumerate(wtg_buses):
        pp.create_sgen(
            net,
            bus=bus_id,
            p_mw=p_per_wtg,
            q_mvar=0.0,
            sn_mva=spec.turbine_rated_mw,  # needed for IEC 60909 short-circuit
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
        sn_mva=spec.statcom_mvar,  # needed for IEC 60909 short-circuit
        k=1.0,  # ratio of Ik'' to In for STATCOM (inverter-based)
        name="STATCOM",
    )

    # ── Shunt Reactors at both ends of the export ────────────────
    # Absorb cable capacitive Q — modelled as fixed shunts, one per circuit at each
    # end: Reactor_ONS_<c> at the onshore 220 kV busbar first, then Reactor_OSS_<c>.
    # pandapower shunts use the LOAD convention: q_mvar > 0 = absorbing
    # (inductive). This is the opposite of Rule 4, which applies to our API
    # outputs and to sgens (STATCOM), not to pandapower shunt inputs.
    if enable_reactor:
        for end, bus in (("ONS", bus_onshore_220), ("OSS", bus_oss_220)):
            for c in range(spec.reactors_per_end):
                pp.create_shunt(
                    net,
                    bus=bus,
                    q_mvar=spec.reactor_unit_mvar,  # positive = absorbing (load convention)
                    p_mw=0.0,
                    name=f"Reactor_{end}_{c + 1}_{spec.reactor_unit_mvar:.0f}MVAR",
                )

    # Harmonic filter at OSS 66 kV: capacitive at 50 Hz → negative q in the load
    # convention (it generates Q; losses in the damping resistor are < 1 kW, ignored).
    if spec.harmonic_filter_mvar > 0:
        pp.create_shunt(
            net,
            bus=bus_oss_66,
            q_mvar=-spec.harmonic_filter_mvar,
            p_mw=0.0,
            name=f"HF_OSS_66_{spec.harmonic_filter_mvar:.0f}MVAR_h{spec.harmonic_filter_tuned_order:.0f}",
        )

    return net


def series_impedances_pu(
    s_base_mva: float,
    grid_ssc_mva: float | None = None,
    export_length_km: float | None = None,
    spec: FarmSpec = SB510,
) -> dict[str, complex]:
    """Series impedances of the radial grid → OSS chain [p.u. on ``s_base_mva``].

    Same data as ``build_network`` (one source of truth), reduced to the four
    elements a fault or a converter "sees" between the PSE grid and the 66 kV
    busbar. Shunt elements (cable C, magnetising branch) are left out, as in
    IEC 60909 fault calculations. Key = element ending at that bus:

      grid     PSE Thevenin source → PSE_400kV   z = S_base/S_sc, R/X = GRID_RX_RATIO
      onshore  PSE_400kV → Onshore_220kV         2 × 300 MVA, vk 14 %
      export   Onshore_220kV → OSS_220kV         2 × 108 km, R at 90 °C
      oss      OSS_220kV → OSS_66kV              2 × 300 MVA, vk 12.5 %

    (SB-510 values; ``spec`` gives another farm's ratings and circuit count.)
    """
    if export_length_km is None:
        export_length_km = spec.export_length_km
    grid_ssc_mva = spec.grid_ssc_mva if grid_ssc_mva is None else grid_ssc_mva

    def trafo(vk: float, vkr: float, s_mva: float) -> complex:
        z = vk / 100.0 * s_base_mva / s_mva
        r = vkr / 100.0 * s_base_mva / s_mva
        return complex(r, (z * z - r * r) ** 0.5)

    z_grid = s_base_mva / grid_ssc_mva
    x_grid = z_grid / (1.0 + GRID_RX_RATIO**2) ** 0.5
    cable = EXPORT_CABLE_1000
    z_base_220 = 220.0**2 / s_base_mva
    return {
        "grid": complex(GRID_RX_RATIO * x_grid, x_grid),
        "onshore": trafo(
            TRAFO_220_400_VK_PERCENT,
            TRAFO_220_400_VKR_PERCENT,
            spec.onshore_trafo_mva * NUM_ONSHORE_TRANSFORMERS,
        ),
        "export": complex(cable.r_ac_ohm_per_km, cable.x_ohm_per_km)
        * export_length_km
        / spec.num_export_cables
        / z_base_220,
        "oss": trafo(
            TRAFO_66_220_VK_PERCENT,
            TRAFO_66_220_VKR_PERCENT,
            spec.oss_trafo_mva * NUM_OSS_TRANSFORMERS,
        ),
    }


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
        Keys: '500mm2', '630mm2', '800mm2', '1000mm2'. Values: cable count.
    """
    counts = {f"{c.cross_section_mm2:.0f}mm2": 0 for c in ARRAY_SECTIONS}
    for _, row in net.line.iterrows():
        if not str(row["name"]).startswith("Array_"):
            continue
        # Identify the grade by its capacitance — R differs between 20 °C and 90 °C builds
        c_nf = float(row["c_nf_per_km"])
        grade = next(c for c in ARRAY_SECTIONS if np.isclose(c_nf, c.c_nf_per_km))
        counts[f"{grade.cross_section_mm2:.0f}mm2"] += 1
    return counts

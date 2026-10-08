"""
Reference turbine models: power and thrust curves from the official IEA Wind
Task 37 tables.

The data live in ``app/data/turbines/`` (``turbines.json`` for the parameters,
masses and provenance, ``<id>.csv`` for the WISDEM steady-state operating table —
power, Ct, pitch, rotor speed, Cp, thrust, torque — and, for the IEA 15 MW,
``<id>_rosco.json`` with the Cp/Ct/Cq(λ, β) surfaces, the ROSCO controller and
the ElastoDyn drivetrain) and are written by ``scripts/fetch_turbine_curves.py``.
SB-510 is modelled with the IEA 15 MW turbine as a "V236-class" machine: Vestas
publishes no power, thrust or drivetrain data for the V236-15.0 MW. Both IEA
turbines are low-speed direct drives (no gearbox).

Physics
-------
- Power between table points is interpolated linearly; Rule 1 is enforced on
  every call: 0 ≤ P ≤ P_rated, P = 0 below cut-in and above cut-out.
- Ct is clipped to [0, 1] and is 0 outside the operating range (parked rotor).

References
----------
- Gaertner, E. et al. (2020). Definition of the IEA 15-Megawatt Offshore
  Reference Wind Turbine. NREL/TP-5000-75698.
- Zahle, F. et al. (2024). Definition of the IEA Wind 22-Megawatt Offshore
  Reference Wind Turbine. DTU Wind Report E-0243.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

from app.core.exceptions import ValidationError

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "turbines"

#: SB-510 reference model ("V236 class").
DEFAULT_TURBINE_ID = "IEA-15-240-RWT"


@dataclass(frozen=True)
class TurbineModel:
    """A wind turbine with its tabulated power and thrust curves.

    Units: wind speed m/s, power kW, lengths m.
    """

    id: str
    name: str
    rated_kw: float
    rotor_diameter_m: float
    hub_height_m: float
    cut_in_ms: float
    rated_ms: float
    cut_out_ms: float
    drivetrain: str
    min_rotor_rpm: float
    max_rotor_rpm: float
    generator_efficiency: float  # electrical / aerodynamic power (Cp / Cp_aero)
    masses_t: dict[str, float]
    nacelle_components_kg: dict[str, float]
    source: str
    license: str
    reference: str
    retrieved: str
    ws_ms: NDArray[np.float64]
    power_kw: NDArray[np.float64]
    ct: NDArray[np.float64]
    # WISDEM steady-state operating point at each table wind speed
    pitch_deg: NDArray[np.float64]
    rotor_rpm: NDArray[np.float64]
    cp: NDArray[np.float64]
    cp_aero: NDArray[np.float64]
    thrust_kn: NDArray[np.float64]
    torque_knm: NDArray[np.float64]

    @property
    def rotor_radius_m(self) -> float:
        return self.rotor_diameter_m / 2.0

    def operating_point(self, wind_speed_ms: float) -> dict[str, float]:
        """Steady-state rotor speed, pitch, Cp, thrust and torque at a wind speed (table
        interpolation, clamped to the table range)."""
        v = float(np.clip(wind_speed_ms, self.ws_ms[0], self.ws_ms[-1]))
        return {
            name: float(np.interp(v, self.ws_ms, arr))
            for name, arr in (
                ("rotor_rpm", self.rotor_rpm),
                ("pitch_deg", self.pitch_deg),
                ("cp", self.cp),
                ("cp_aero", self.cp_aero),
                ("thrust_kn", self.thrust_kn),
                ("torque_knm", self.torque_knm),
            )
        }

    @property
    def rated_mw(self) -> float:
        return self.rated_kw / 1e3

    def power_curve_kw(self, wind_speeds_ms: NDArray[np.floating] | float) -> NDArray[np.float64]:
        """Electrical power [kW] at the given hub-height wind speeds (Rule 1 enforced)."""
        v = np.asarray(wind_speeds_ms, dtype=np.float64)
        p = np.interp(v, self.ws_ms, self.power_kw)
        p = np.clip(p, 0.0, self.rated_kw)
        p = np.where((v < self.cut_in_ms) | (v > self.cut_out_ms), 0.0, p)
        return np.asarray(p, dtype=np.float64)

    def ct_curve(self, wind_speeds_ms: NDArray[np.floating] | float) -> NDArray[np.float64]:
        """Thrust coefficient [-] at the given wind speeds; 0 outside the operating range."""
        v = np.asarray(wind_speeds_ms, dtype=np.float64)
        c = np.clip(np.interp(v, self.ws_ms, self.ct), 0.0, 1.0)
        c = np.where((v < self.cut_in_ms) | (v > self.cut_out_ms), 0.0, c)
        return np.asarray(c, dtype=np.float64)

    def pywake(self) -> Any:
        """PyWake ``WindTurbine`` with this power / Ct table (power in W)."""
        from py_wake.wind_turbines import WindTurbine
        from py_wake.wind_turbines.power_ct_functions import PowerCtTabular

        return WindTurbine(
            name=self.id,
            diameter=self.rotor_diameter_m,
            hub_height=self.hub_height_m,
            powerCtFunction=PowerCtTabular(
                ws=self.ws_ms,
                power=self.power_kw * 1e3,
                power_unit="W",
                ct=self.ct,
            ),
        )


_COLUMNS = (
    "ws_ms",
    "power_kw",
    "ct",
    "pitch_deg",
    "rotor_rpm",
    "cp",
    "cp_aero",
    "thrust_kn",
    "torque_knm",
)


def _load(meta: dict[str, Any]) -> TurbineModel:
    with (DATA_DIR / f"{meta['id']}.csv").open(encoding="utf-8") as fh:
        rows = [tuple(float(r[c]) for c in _COLUMNS) for r in csv.DictReader(fh)]
    table = np.array(rows, dtype=np.float64)
    return TurbineModel(
        id=meta["id"],
        name=meta["name"],
        rated_kw=float(meta["rated_kw"]),
        rotor_diameter_m=float(meta["rotor_diameter_m"]),
        hub_height_m=float(meta["hub_height_m"]),
        cut_in_ms=float(meta["cut_in_ms"]),
        rated_ms=float(meta["rated_ms"]),
        cut_out_ms=float(meta["cut_out_ms"]),
        drivetrain=str(meta["drivetrain"]),
        min_rotor_rpm=float(meta["min_rotor_rpm"]),
        max_rotor_rpm=float(meta["max_rotor_rpm"]),
        generator_efficiency=float(meta["generator_efficiency"]),
        masses_t={k: float(v) for k, v in meta["masses_t"].items()},
        nacelle_components_kg={k: float(v) for k, v in meta["nacelle_components_kg"].items()},
        source=meta["source"],
        license=meta["license"],
        reference=meta["reference"],
        retrieved=meta["retrieved"],
        ws_ms=table[:, 0],
        power_kw=table[:, 1],
        ct=table[:, 2],
        pitch_deg=table[:, 3],
        rotor_rpm=table[:, 4],
        cp=table[:, 5],
        cp_aero=table[:, 6],
        thrust_kn=table[:, 7],
        torque_knm=table[:, 8],
    )


@cache
def turbine_models() -> dict[str, TurbineModel]:
    """Every packaged turbine model, keyed by id (loaded once)."""
    meta = json.loads((DATA_DIR / "turbines.json").read_text(encoding="utf-8"))
    return {m["id"]: _load(m) for m in meta}


def get_turbine(model_id: str | None = None) -> TurbineModel:
    """The turbine model with this id (default: SB-510's IEA 15 MW)."""
    models = turbine_models()
    key = model_id or DEFAULT_TURBINE_ID
    if key not in models:
        raise ValidationError(f"Unknown turbine model '{key}'. Available: {sorted(models)}")
    return models[key]


# ── ROSCO data (IEA 15 MW): rotor surfaces, controller, drivetrain ─────────────


@dataclass(frozen=True)
class RotorSurface:
    """Cp, Ct, Cq over tip-speed ratio λ (rows) and pitch β [deg] (columns).

    ROSCO table (CCBlade, steady, rigid rotor): λ 2 … 14.5, β −5 … 30°. Beyond
    λ = 14.5 — only reached below ≈ 4.4 m/s at the 5 rpm minimum rotor speed — the
    values follow the WISDEM steady-state operating line of the same turbine
    (``beyond_*``: λ, Cp_aero, Ct), where the controller holds the ROSCO
    minimum-pitch schedule.
    """

    tsr: NDArray[np.float64]
    pitch_deg: NDArray[np.float64]
    cp: NDArray[np.float64]
    ct: NDArray[np.float64]
    cq: NDArray[np.float64]
    beyond_tsr: NDArray[np.float64]
    beyond_cp: NDArray[np.float64]
    beyond_ct: NDArray[np.float64]
    source: str

    def _lookup(self, grid: NDArray[np.float64], tsr: float, pitch_deg: float) -> float:
        lam = float(np.clip(tsr, self.tsr[0], self.tsr[-1]))
        beta = float(np.clip(pitch_deg, self.pitch_deg[0], self.pitch_deg[-1]))
        i = int(np.clip(np.searchsorted(self.tsr, lam) - 1, 0, len(self.tsr) - 2))
        j = int(np.clip(np.searchsorted(self.pitch_deg, beta) - 1, 0, len(self.pitch_deg) - 2))
        u = (lam - self.tsr[i]) / (self.tsr[i + 1] - self.tsr[i])
        w = (beta - self.pitch_deg[j]) / (self.pitch_deg[j + 1] - self.pitch_deg[j])
        return float(
            (1 - u) * (1 - w) * grid[i, j]
            + u * (1 - w) * grid[i + 1, j]
            + (1 - u) * w * grid[i, j + 1]
            + u * w * grid[i + 1, j + 1]
        )

    def cp_array(
        self, tsr: NDArray[np.floating] | float, pitch_deg: NDArray[np.floating] | float
    ) -> NDArray[np.float64]:
        """Vectorised Cp(λ, β): same rule as ``coefficients`` (bilinear in the ROSCO
        table; beyond λ = 14.5 linear from the table edge along the WISDEM line)."""
        lam = np.asarray(tsr, dtype=np.float64)
        beta = np.broadcast_to(np.asarray(pitch_deg, dtype=np.float64), lam.shape)
        lc = np.clip(lam, self.tsr[0], self.tsr[-1])
        bc = np.clip(beta, self.pitch_deg[0], self.pitch_deg[-1])
        i = np.clip(np.searchsorted(self.tsr, lc) - 1, 0, len(self.tsr) - 2)
        j = np.clip(np.searchsorted(self.pitch_deg, bc) - 1, 0, len(self.pitch_deg) - 2)
        u = (lc - self.tsr[i]) / (self.tsr[i + 1] - self.tsr[i])
        w = (bc - self.pitch_deg[j]) / (self.pitch_deg[j + 1] - self.pitch_deg[j])
        g = self.cp
        cp = (
            (1 - u) * (1 - w) * g[i, j]
            + u * (1 - w) * g[i + 1, j]
            + (1 - u) * w * g[i, j + 1]
            + u * w * g[i + 1, j + 1]
        )
        # beyond the table, cp holds the edge value Cp(14.5, β)
        x0, x1 = float(self.tsr[-1]), float(self.beyond_tsr[0])
        first = cp + (lam - x0) / (x1 - x0) * (self.beyond_cp[0] - cp)
        line = np.interp(lam, self.beyond_tsr, self.beyond_cp)
        cp = np.where(lam <= x0, cp, np.where(lam < x1, first, line))
        return np.asarray(np.where(lam > 0.0, np.maximum(cp, 0.0), 0.0), dtype=np.float64)

    def coefficients(
        self, tsr: float, pitch_deg: float, *, clip_negative: bool = True
    ) -> tuple[float, float]:
        """(Cp, Ct) at λ, β — bilinear in the table, the WISDEM line beyond λ = 14.5.

        ``clip_negative=False`` keeps negative Cp (braking blades) for rotor dynamics.
        """
        if tsr <= 0.0:
            return 0.0, 0.0
        if tsr <= self.tsr[-1]:
            cp = self._lookup(self.cp, tsr, pitch_deg)
            ct = self._lookup(self.ct, tsr, pitch_deg)
            return (max(cp, 0.0) if clip_negative else cp), max(ct, 0.0)
        edge_cp = self._lookup(self.cp, float(self.tsr[-1]), pitch_deg)
        edge_ct = self._lookup(self.ct, float(self.tsr[-1]), pitch_deg)
        x = np.concatenate(([self.tsr[-1]], self.beyond_tsr))
        cp = float(np.interp(tsr, x, np.concatenate(([edge_cp], self.beyond_cp))))
        ct = float(np.interp(tsr, x, np.concatenate(([edge_ct], self.beyond_ct))))
        return (max(cp, 0.0) if clip_negative else cp), max(ct, 0.0)


@dataclass(frozen=True)
class RotorControl:
    """ROSCO controller and ElastoDyn drivetrain of a reference turbine (SI units)."""

    rated_power_w: float
    rated_torque_nm: float  # generator torque in region 3 (constant-torque mode)
    max_torque_nm: float
    max_torque_rate_nm_s: float
    rated_speed_rad_s: float  # torque-controller reference
    pitch_ref_speed_rad_s: float  # pitch-controller reference
    min_speed_rad_s: float
    rgn2_k_nm_s2: float  # region-2 optimal-torque gain, Q = K·ω²
    vs_kp: float
    vs_ki: float
    generator_efficiency: float  # mechanical → electrical (ROSCO VS_GenEff)
    tsr_opt: float  # region-2 tip-speed-ratio target (ROSCO VS_TSRopt)
    pitch_min_deg: float
    pitch_max_deg: float
    pitch_max_rate_deg_s: float
    gain_schedule_pitch_deg: NDArray[np.float64]
    gain_schedule_kp_s: NDArray[np.float64]  # rad of pitch per rad/s of speed error
    gain_schedule_ki: NDArray[np.float64]  # rad of pitch per rad of integrated error
    min_pitch_wind_ms: NDArray[np.float64]
    min_pitch_deg: NDArray[np.float64]
    yaw_rate_deg_s: float
    yaw_error_threshold_deg: float
    overspeed_shutdown_rpm: float
    speed_filter_corner_rad_s: float  # 2nd-order low-pass on measured speed (F_LPFCornerFreq)
    speed_filter_damping: float
    vs_ref_corner_rad_s: float  # 1st-order low-pass on the TSR speed reference
    setpoint_smoother_corner_rad_s: float  # setpoint smoother (SS_Mode 1)
    setpoint_smoother_vs_gain: float
    setpoint_smoother_pc_gain: float
    gearbox_ratio: float
    generator_inertia_kg_m2: float
    rotor_inertia_kg_m2: float  # blades + hub, rigid (definition report §5.7)
    shaft_stiffness_nm_rad: float
    shaft_damping_nm_s_rad: float
    report: dict[str, Any]
    source: str

    @property
    def total_inertia_kg_m2(self) -> float:
        """Rotor + generator rotor about the shaft (direct drive: no gear-ratio scaling)."""
        return self.rotor_inertia_kg_m2 + self.generator_inertia_kg_m2 * self.gearbox_ratio**2

    def pitch_gains(self, pitch_deg: float) -> tuple[float, float]:
        """Gain-scheduled (Kp [s], Ki [-]) at the current pitch (ROSCO PC_GS_*)."""
        kp = float(np.interp(pitch_deg, self.gain_schedule_pitch_deg, self.gain_schedule_kp_s))
        ki = float(np.interp(pitch_deg, self.gain_schedule_pitch_deg, self.gain_schedule_ki))
        return kp, ki

    def minimum_pitch_deg(self, wind_speed_ms: float) -> float:
        """ROSCO pitch saturation: minimum blade pitch against wind speed (PS_BldPitchMin)."""
        return float(np.interp(wind_speed_ms, self.min_pitch_wind_ms, self.min_pitch_deg))


@cache
def rosco(model_id: str | None = None) -> tuple[RotorSurface, RotorControl]:
    """ROSCO surfaces, controller and drivetrain of a turbine (IEA 15 MW only)."""
    key = model_id or DEFAULT_TURBINE_ID
    path = DATA_DIR / f"{key}_rosco.json"
    if not path.exists():
        raise ValidationError(f"No ROSCO controller data packaged for turbine model '{key}'.")
    data = json.loads(path.read_text(encoding="utf-8"))
    s, c, d = data["performance_surface"], data["controller"], data["drivetrain"]
    t = get_turbine(key)
    tsr_line = t.rotor_rpm * (np.pi / 30.0) * t.rotor_radius_m / t.ws_ms
    beyond = tsr_line > s["tsr"][-1]
    order = np.argsort(tsr_line[beyond])
    surface = RotorSurface(
        tsr=np.asarray(s["tsr"], dtype=np.float64),
        pitch_deg=np.asarray(s["pitch_deg"], dtype=np.float64),
        cp=np.asarray(s["cp"], dtype=np.float64),
        ct=np.asarray(s["ct"], dtype=np.float64),
        cq=np.asarray(s["cq"], dtype=np.float64),
        beyond_tsr=tsr_line[beyond][order],
        beyond_cp=t.cp_aero[beyond][order],
        beyond_ct=t.ct[beyond][order],
        source=s["source"],
    )
    gs, ps = c["pitch_gain_schedule"], c["min_pitch_schedule"]
    report = data["report"]
    control = RotorControl(
        rated_power_w=c["rated_power_w"],
        rated_torque_nm=c["rated_torque_nm"],
        max_torque_nm=c["max_torque_nm"],
        max_torque_rate_nm_s=c["max_torque_rate_nm_s"],
        rated_speed_rad_s=c["rated_speed_rad_s"],
        pitch_ref_speed_rad_s=c["pitch_ref_speed_rad_s"],
        min_speed_rad_s=c["min_speed_rad_s"],
        rgn2_k_nm_s2=c["rgn2_k_nm_s2"],
        vs_kp=c["vs_kp"],
        vs_ki=c["vs_ki"],
        generator_efficiency=c["generator_efficiency"],
        tsr_opt=c["tsr_opt"],
        pitch_min_deg=float(np.degrees(c["pitch_min_rad"])),
        pitch_max_deg=float(np.degrees(c["pitch_max_rad"])),
        pitch_max_rate_deg_s=float(np.degrees(c["pitch_max_rate_rad_s"])),
        gain_schedule_pitch_deg=np.degrees(np.asarray(gs["pitch_rad"], dtype=np.float64)),
        gain_schedule_kp_s=np.asarray(gs["kp_s"], dtype=np.float64),
        gain_schedule_ki=np.asarray(gs["ki"], dtype=np.float64),
        min_pitch_wind_ms=np.asarray(ps["wind_ms"], dtype=np.float64),
        min_pitch_deg=np.degrees(np.asarray(ps["pitch_rad"], dtype=np.float64)),
        yaw_rate_deg_s=float(np.degrees(c["yaw_rate_rad_s"])),
        yaw_error_threshold_deg=float(c["yaw_error_threshold_deg"]),
        overspeed_shutdown_rpm=float(c["overspeed_shutdown_rad_s"] * 30.0 / np.pi),
        speed_filter_corner_rad_s=float(c["speed_filter_corner_rad_s"]),
        speed_filter_damping=float(c["speed_filter_damping"]),
        vs_ref_corner_rad_s=float(c["vs_ref_corner_rad_s"]),
        setpoint_smoother_corner_rad_s=float(c["setpoint_smoother_corner_rad_s"]),
        setpoint_smoother_vs_gain=float(c["setpoint_smoother_vs_gain"]),
        setpoint_smoother_pc_gain=float(c["setpoint_smoother_pc_gain"]),
        gearbox_ratio=float(d["gearbox_ratio"]),
        generator_inertia_kg_m2=float(d["generator_inertia_kg_m2"]),
        rotor_inertia_kg_m2=float(report["rigid_rotor_inertia_kg_m2"]),
        shaft_stiffness_nm_rad=float(d["shaft_stiffness_nm_rad"]),
        shaft_damping_nm_s_rad=float(d["shaft_damping_nm_s_rad"]),
        report=report,
        source=f"{c['source']}; {d['source']}; {report['source']}",
    )
    return surface, control

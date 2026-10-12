# ruff: noqa: E501, N806
"""Audit A1 — turbine speed regulation vs. the official compiled ROSCO controller.

Runs the same wind inputs through
  (a) OffshoreForge's turbine simulator (services/turbine_physics), and
  (b) NREL's compiled ROSCO controller (libdiscon, pip package ``rosco``) with the official
      IEA-15-240-RWT monopile DISCON.IN and Cp/Ct/Cq table, on ROSCO's own 1-DOF rotor
      model (rosco.toolbox.sim), with the same inertia and air density.
Both use a perfectly known hub-height wind (ROSCO WE_Mode = 0) so only the controllers differ.

Needs: pip install rosco==2.10.6 (inputs are downloaded from the matching ROSCO tag).
Run:   cd backend && PYTHONPATH=. python scripts/audit/a1_rosco_overspeed.py
"""

from __future__ import annotations

import re
import tempfile
import urllib.request
from pathlib import Path
from types import SimpleNamespace

import numpy as np

ROSCO_TAG = "v2.10.6"
BASE = (
    f"https://raw.githubusercontent.com/NREL/ROSCO/{ROSCO_TAG}/Examples/Test_Cases/IEA-15-240-RWT"
)
DISCON_URL = f"{BASE}/IEA-15-240-RWT-Monopile/IEA-15-240-RWT-Monopile_DISCON.IN"
CPCT_URL = f"{BASE}/IEA-15-240-RWT/Cp_Ct_Cq.IEA15MW.txt"
TRIP_RPM = 0.95002 * 30 / np.pi  # ROSCO SD_MaxGenSpd = 9.07 rpm
DT = 0.025


def _inputs(workdir: Path, we_mode: int) -> Path:
    cpct = workdir / "Cp_Ct_Cq.IEA15MW.txt"
    if not cpct.exists():
        urllib.request.urlretrieve(CPCT_URL, cpct)
    text = urllib.request.urlopen(DISCON_URL).read().decode()
    text = re.sub(r'"[^"]*Cp_Ct_Cq\.IEA15MW\.txt"', f'"{cpct}"', text)
    text = re.sub(r"^\d+(\s+! WE_Mode)", rf"{we_mode}\1", text, flags=re.M)
    discon = workdir / f"DISCON_we{we_mode}.IN"
    discon.write_text(text)
    return discon


def rosco_run(
    ws: np.ndarray, j_kg_m2: float, radius_m: float, we_mode: int = 0
) -> dict[str, np.ndarray]:
    from rosco import discon_lib_path
    from rosco.toolbox import turbine as rt
    from rosco.toolbox.control_interface import ControllerInterface
    from rosco.toolbox.sim import Sim
    from rosco.toolbox.utilities import load_from_txt

    work = Path(tempfile.mkdtemp())
    discon = _inputs(work, we_mode)
    pitch0, tsr0, cp, _ct, cq = load_from_txt(str(work / "Cp_Ct_Cq.IEA15MW.txt"))
    turb = SimpleNamespace(
        rotor_radius=radius_m,
        Ng=1.0,
        J=j_kg_m2,
        rho=1.225,
        GBoxEff=100.0,
        GenEff=95.756,
        Cp=rt.RotorPerformance(cp, pitch0, tsr0),
        Cq=rt.RotorPerformance(cq, pitch0, tsr0),
    )
    t = np.arange(len(ws)) * DT
    ci = ControllerInterface(
        discon_lib_path, param_filename=str(discon), DT=DT, sim_name=str(work / "a1")
    )
    sim = Sim(turb, ci)
    rpm0 = min(max(9.0 * ws[0] / turb.rotor_radius * 30 / np.pi, 5.0), 7.56)
    sim.sim_ws_series(t, ws, rotor_rpm_init=rpm0, make_plots=False)
    return {
        "rpm": sim.rot_speed * 30 / np.pi,
        "p_mw": sim.gen_power / 1e6,
        "pitch": np.rad2deg(sim.bld_pitch),
    }


def app_run(ws: np.ndarray) -> dict[str, np.ndarray]:
    from app.services.turbine_physics.simulator import SimulationConfig, run_simulation

    r = run_simulation(ws, config=SimulationConfig(dt=DT))
    return {"rpm": np.asarray(r.rotor_speed_rpm), "p_mw": np.asarray(r.electrical_power_mw)}


def cases() -> dict[str, np.ndarray]:
    n = lambda s: round(s / DT)  # noqa: E731
    t = np.arange(n(600)) * DT
    rng = np.random.default_rng(0)
    # Smooth (0.1 Hz band) turbulence, σ = 1.5 m/s around 13 m/s (≈ IEC class B NTM σ1 at 13 m/s)
    white = rng.normal(0, 1, len(t))
    a = np.exp(-DT / 10.0)
    turb = np.zeros_like(t)
    for i in range(1, len(t)):
        turb[i] = a * turb[i - 1] + np.sqrt(1 - a * a) * white[i]
    # IEC 61400-1 Ed.4 §6.3.3.2 EOG at 13 m/s, D = 240 m, class IB (Iref 0.14, Ve1 = 0.8·1.4·Vref, Vref 50)
    v_hub, d, lam1 = 13.0, 240.0, 42.0
    sigma1 = 0.14 * (0.75 * v_hub + 5.6)
    ve1 = 0.8 * 1.4 * 50.0
    v_gust = min(1.35 * (ve1 - v_hub), 3.3 * sigma1 / (1 + 0.1 * d / lam1))
    T = 10.5
    te = np.arange(n(T)) * DT
    eog = v_hub - 0.37 * v_gust * np.sin(3 * np.pi * te / T) * (1 - np.cos(2 * np.pi * te / T))
    return {
        "step 8→14 m/s": np.r_[np.full(n(60), 8.0), np.full(n(120), 14.0)],
        "ramp 8→14 m/s in 10 s": np.r_[
            np.full(n(60), 8.0), np.linspace(8, 14, n(10)), np.full(n(120), 14.0)
        ],
        "step 11→13 m/s": np.r_[np.full(n(60), 11.0), np.full(n(120), 13.0)],
        "step 12→18 m/s": np.r_[np.full(n(60), 12.0), np.full(n(120), 18.0)],
        f"IEC EOG at 13 m/s (Vgust {v_gust:.1f} m/s)": np.r_[
            np.full(n(60), 13.0), eog, np.full(n(60), 13.0)
        ],
        "turbulence 13 ± 1.5 m/s, 600 s": 13.0 + 1.5 * turb,
    }


def main() -> None:
    from app.services.turbine_physics.rotor_dynamics import ROTOR_INERTIA_KG_M2 as J
    from app.services.turbine_physics.simulator import SimulationConfig

    radius = SimulationConfig().spec.rotor_diameter_m / 2.0

    print(
        f"J = {J:.4g} kg·m², R = {radius:.2f} m (same in both), trip limit {TRIP_RPM:.2f} rpm, dt {DT} s\n"
    )
    print(f"{'case':42s} {'app max rpm':>12s} {'ROSCO max rpm':>14s} {'app trips':>10s}")
    for name, ws in cases().items():
        a = app_run(ws)
        r = rosco_run(ws, J, radius)
        print(
            f"{name:42s} {a['rpm'].max():12.2f} {r['rpm'].max():14.2f} {a['rpm'].max() > TRIP_RPM!s:>10s}"
        )


if __name__ == "__main__":
    main()

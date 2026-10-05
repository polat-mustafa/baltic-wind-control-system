"""Fault library — the hypotheses the twin can isolate and identify.

Each entry describes one fault mode by the model parameter it perturbs
(see ``reference_model.FaultParams``; the anemometer gain acts on the
measurement chain), the physical unit of its severity, the search range used
for identification, the advisory text (ISO 13374-1 "advisory generation"
block) and — for progressive faults — the limit used for prognosis
(ISO 13381-1). Limits marked *illustrative* are platform conventions, not
OEM values; a real deployment takes them from the OEM manual.

Expected residual signatures (derived from the reference model, not
hand-tuned; P = power, ω = rotor speed, β = reported pitch, T = gearbox
temperature, v = anemometer vs. neighbours):

  fault                 partial load (λ tracking)   full load (pitch regulated)
  aero efficiency loss  P↓  ω↓  β 0  T↓  v 0        P 0  ω 0  β↓ (varies with v)
  pitch offset          P↓  ω↓  β 0  T↓  v 0        P 0  ω 0  β↓ (≈ −offset, constant)
  power limitation      P 0 below the limit          P↓  ω 0  β↑
  gearbox losses        P↓ (small)  T↑↑              P 0  β↓ (small)  T↑↑
  anemometer gain       P↓  ω↓  v↑                   P 0  β↓  v↑
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

FaultKind = Literal[
    "aero_efficiency",
    "pitch_offset",
    "power_limit",
    "gearbox_loss",
    "anemometer_gain",
]

FAULT_KINDS: tuple[FaultKind, ...] = (
    "aero_efficiency",
    "pitch_offset",
    "power_limit",
    "gearbox_loss",
    "anemometer_gain",
)


@dataclass(frozen=True)
class FaultMode:
    """Static description of one fault hypothesis."""

    kind: FaultKind
    label: str
    category: str  # aerodynamic / control / electrical / mechanical / sensor
    parameter: str  # what the severity number means
    unit: str
    nominal: float  # parameter value of a healthy turbine
    search_min: float  # identification search range
    search_max: float
    advisory: str
    references: tuple[str, ...]
    prognosis_limit: float | None = None  # parameter value treated as end of life
    prognosis_limit_note: str | None = None


FAULT_LIBRARY: dict[FaultKind, FaultMode] = {
    "aero_efficiency": FaultMode(
        kind="aero_efficiency",
        label="Aerodynamic efficiency loss",
        category="aerodynamic",
        parameter="Cp loss",
        unit="%",
        nominal=0.0,
        search_min=0.0,
        search_max=60.0,
        advisory=(
            "Rotor delivers less aerodynamic power than the twin at the same wind. "
            "If ambient temperature is at or below 0 °C with high humidity, treat as "
            "rotor icing: check the ice detection system, apply the site ice-throw "
            "risk procedure before restart. Otherwise schedule a blade inspection "
            "for soiling or leading-edge erosion."
        ),
        references=(
            "IEA Wind TCP Task 19 — International recommendations for ice-throw risk "
            "assessment (2018)",
            "IEC 61400-12-1:2022 — Power performance measurements",
        ),
    ),
    "pitch_offset": FaultMode(
        kind="pitch_offset",
        label="Pitch angle misalignment",
        category="control",
        parameter="blade-angle offset",
        unit="deg",
        nominal=0.0,
        search_min=0.0,  # the Heier Cp surface is defined for β ≥ 0 only
        search_max=10.0,
        advisory=(
            "Actual blade angle differs from the reported angle by a constant offset. "
            "Verify the zero-pitch calibration of all three blades (optical or "
            "photogrammetric pitch-angle check) and the pitch encoder reference."
        ),
        references=("IEC 61400-1:2019 — Design requirements, control and protection system",),
    ),
    "power_limit": FaultMode(
        kind="power_limit",
        label="Uncommanded power limitation",
        category="electrical",
        parameter="active-power limit",
        unit="MW",
        nominal=15.0,
        search_min=5.0,
        search_max=15.0,
        advisory=(
            "Output is capped below rated although no curtailment set-point is active. "
            "Check converter and generator temperature derating, cooling circuit and the "
            "turbine alarm log; confirm with the park controller that no set-point was sent."
        ),
        references=("IEC 61400-25-2:2015 — Information model (WTUR/WCNV/WGEN logical nodes)",),
    ),
    "gearbox_loss": FaultMode(
        kind="gearbox_loss",
        label="Gearbox loss increase",
        category="mechanical",
        parameter="loss factor (1 = nominal 3 %)",
        unit="×",
        nominal=1.0,
        search_min=0.5,
        search_max=4.0,
        advisory=(
            "Gearbox converts more power into heat than the twin expects — typical of "
            "bearing or gear-mesh distress. Take an oil sample (particle count, ferrography), "
            "review drivetrain vibration spectra against ISO 10816-21 zones, and plan an "
            "endoscope inspection."
        ),
        references=(
            "ISO 10816-21:2015 — Vibration of horizontal-axis wind turbines with gearbox",
            "Tautz-Weinert & Watson (2017), IET Renew. Power Gener. 11(4) 382–394",
        ),
        prognosis_limit=2.0,
        prognosis_limit_note=(
            "Illustrative end-of-life criterion: gearbox losses doubled "
            "(≈ +35 K bearing temperature at rated load in this model)."
        ),
    ),
    "anemometer_gain": FaultMode(
        kind="anemometer_gain",
        label="Nacelle anemometer drift",
        category="sensor",
        parameter="gain error",
        unit="%",
        nominal=0.0,
        search_min=-20.0,
        search_max=20.0,
        advisory=(
            "Nacelle anemometer reads differently from neighbouring turbines while the "
            "turbine itself behaves normally. Recalibrate or replace the sensor; power "
            "performance results based on it (IEC 61400-12-2) are invalid until corrected. "
            "Lost-production figures for this turbine use the corrected wind."
        ),
        references=("IEC 61400-12-2:2022 — Power performance based on nacelle anemometry",),
    ),
}


def severity_to_fault_value(kind: FaultKind, severity: float) -> float:
    """Convert a display severity (library unit) to the model parameter value."""
    if kind == "aero_efficiency":
        return 1.0 - severity / 100.0  # Cp factor
    if kind == "anemometer_gain":
        return 1.0 + severity / 100.0  # gain
    return severity

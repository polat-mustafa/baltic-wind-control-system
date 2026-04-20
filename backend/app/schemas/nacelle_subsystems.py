"""Pydantic v2 schemas for Nacelle Subsystems API — A4 (Nacelle Overhaul).

Covers: HPU, gearbox cooling/lubrication, safety systems, cable twist,
and UPS for the Vestas V236-15.0 MW offshore turbine.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── Request schema ────────────────────────────────────────────────────────────


class NacelleSubsystemsRequest(BaseModel):
    """Query parameters for nacelle subsystem state calculation.

    All fields have defaults that represent normal full-load operation
    (15 MW, 15 °C ambient, 7.5 rpm, pitch 5°).
    """

    power_mw: float = Field(
        default=10.0,
        ge=0.0,
        le=15.0,
        description="Current electrical output [MW]. Range: 0–15.",
    )
    ambient_temp_c: float = Field(
        default=15.0,
        ge=-30.0,
        le=50.0,
        description="Ambient air temperature at hub height [°C].",
    )
    rotor_speed_rpm: float = Field(
        default=7.5,
        ge=0.0,
        le=15.0,
        description="Current rotor speed [rpm]. Rated: 8.33 rpm.",
    )
    pitch_deg: float = Field(
        default=5.0,
        ge=0.0,
        le=90.0,
        description=(
            "Current blade pitch angle [°]. "
            "0° = fine pitch (max power), 90° = feathered (parked)."
        ),
    )
    accumulated_yaw_deg: float = Field(
        default=90.0,
        ge=-1260.0,
        le=1260.0,
        description=(
            "Accumulated yaw angle since last cable untwist [°]. "
            "Positive = CW, negative = CCW. Hard limit: ±1260° (±3.5 turns)."
        ),
    )
    is_operating: bool = Field(
        default=True,
        description="True if turbine is in POWER_PRODUCTION or STARTUP state.",
    )
    grid_available: bool = Field(
        default=True,
        description="Grid connection is available (False → UPS switches to battery).",
    )
    battery_soc_pct: float = Field(
        default=98.0,
        ge=0.0,
        le=100.0,
        description="UPS battery state of charge [%]. Nominal: 95–100% during grid operation.",
    )
    vibration_mm_s: float = Field(
        default=1.5,
        ge=0.0,
        le=20.0,
        description=(
            "Main bearing housing vibration velocity RMS [mm/s]. "
            "ISO 10816-21 Zone A: ≤2.3, B: ≤4.5, C: ≤7.1, D: >7.1."
        ),
    )
    ice_detection: bool = Field(
        default=False,
        description="Ice detected on rotor blades (nacelle anemometer deviation > 20%).",
    )
    fire_alarm: bool = Field(
        default=False,
        description="Fire or smoke detected in nacelle.",
    )
    lightning_count: int = Field(
        default=0,
        ge=0,
        description="Cumulative lightning strike count for this turbine.",
    )


# ── Sub-system response schemas ───────────────────────────────────────────────


class HPUStateResponse(BaseModel):
    """Hydraulic Power Unit (HPU) state.

    Supplies hydraulic power to blade pitch cylinders and main shaft brake
    calipers. Normal line pressure: 180–250 bar.
    """

    line_pressure_bar: float = Field(
        description=(
            "HPU line pressure [bar]. Normal: 220 bar. "
            "Alarm < 170 bar. Trip < 140 bar (pre-charge pressure)."
        )
    )
    accumulator_pressure_bar: float = Field(
        description=(
            "Bladder accumulator gas pressure [bar]. "
            "Pre-charge: 140 bar (N₂). Working: 250 bar."
        )
    )
    accumulator_charge_pct: float = Field(
        description="Accumulator charge level [%]. 100% = fully charged at working pressure."
    )
    pitch_cylinder_extension_pct: float = Field(
        description=(
            "Blade pitch cylinder extension [%]. "
            "0% = feathered (90°), 100% = fine pitch (0°)."
        )
    )
    brake_caliper_pressure_bar: float = Field(
        description=(
            "Main shaft brake caliper pressure [bar]. "
            "250 bar = fully clamped (parked). 0 bar = released (operating)."
        )
    )
    pump_running: bool = Field(
        description="HPU pump is running to maintain system pressure."
    )
    iso_cleanliness_code: str = Field(
        description=(
            "ISO 4406:2021 hydraulic oil cleanliness code (e.g. '16/14/11'). "
            "Three digits: particles ≥4 µm / ≥6 µm / ≥14 µm per mL."
        )
    )
    alarm: bool = Field(description="HPU system alarm active (low pressure).")


class CoolingStateResponse(BaseModel):
    """Gearbox oil cooling and lubrication system state.

    Thermal equilibrium model: T_oil = T_amb + Q_loss / UA_cooler.
    Gearbox losses at rated power: 15 MW × 3% = 450 kW.
    """

    oil_temp_c: float = Field(
        description=(
            "Gearbox oil temperature at cooler inlet [°C]. "
            "Nominal: 65°C. Alarm: 75°C. Trip: 85°C → EMERGENCY_SHUTDOWN."
        )
    )
    oil_temp_alarm: bool = Field(
        description="Oil temperature ≥ 75°C alarm threshold."
    )
    oil_temp_trip: bool = Field(
        description="Oil temperature ≥ 85°C trip threshold — initiates emergency shutdown."
    )
    cooler_heat_rejection_kw: float = Field(
        description=(
            "Heat rejected by oil cooler [kW]. "
            "Equals gearbox losses = P_mech × (1 − η_gb). Rated: ~450 kW."
        )
    )
    fan_speed_pct: float = Field(
        description=(
            "Cooling fan speed [% of max]. "
            "Variable speed drive: proportional control to maintain 65°C setpoint."
        )
    )
    ambient_temp_c: float = Field(
        description="Ambient air temperature used for heat balance [°C]."
    )
    viscosity_cst: float = Field(
        description=(
            "ISO VG 320 gear oil kinematic viscosity at current temperature [cSt]. "
            "Walther equation (ASTM D341): 320 cSt @ 40°C, 38 cSt @ 100°C, VI=140."
        )
    )


class SafetyStateResponse(BaseModel):
    """Nacelle safety systems state.

    Monitors: overspeed (IEC 61400-1 §7.4.2), vibration (ISO 10816-21),
    ice detection, fire detection, and lightning strikes.
    """

    rotor_speed_rpm: float = Field(
        description="Current rotor speed [rpm]. Rated: 8.33 rpm."
    )
    overspeed_warning: bool = Field(
        description=(
            "Rotor speed > 110% rated (9.16 rpm). "
            "Electrical trip armed — EMERGENCY_SHUTDOWN initiated."
        )
    )
    overspeed_hardware: bool = Field(
        description=(
            "Rotor speed > 120% rated (10.0 rpm). "
            "Centrifugal mechanical overspeed governor activated."
        )
    )
    vibration_mm_s: float = Field(
        description="Main bearing housing vibration velocity RMS [mm/s]."
    )
    vibration_zone: str = Field(
        description=(
            "ISO 10816-21 vibration zone: "
            "A (≤2.3 mm/s, new equipment acceptance), "
            "B (≤4.5 mm/s, unrestricted operation), "
            "C (≤7.1 mm/s, restricted, schedule maintenance), "
            "D (>7.1 mm/s, risk of damage, emergency stop)."
        )
    )
    vibration_alarm: bool = Field(
        description="Vibration in Zone C or D — alarm active."
    )
    vibration_trip: bool = Field(
        description="Vibration in Zone D — emergency shutdown initiated."
    )
    ice_detection_active: bool = Field(
        description=(
            "Ice detected on rotor blades. "
            "Detected by nacelle anemometer deviation > 20% from met mast."
        )
    )
    fire_alarm: bool = Field(
        description="Fire or smoke detected in nacelle (dry chemical suppression armed)."
    )
    lightning_strike_count: int = Field(
        description=(
            "Cumulative lightning strikes on this turbine. "
            "IEC 62305 LPL I design current: 200 kA."
        )
    )


class CableTwistStateResponse(BaseModel):
    """Cable twist counter state.

    Power and control cables are routed through a twist loop in the tower.
    After ±3.5 turns (±1260°) the nacelle must untwist to prevent cable damage.
    """

    accumulated_yaw_deg: float = Field(
        description=(
            "Total accumulated yaw angle since last untwist [°]. "
            "Positive = CW, negative = CCW. Hard limit: ±1260°."
        )
    )
    twist_turns: float = Field(
        description="Equivalent full nacelle revolutions (accumulated_yaw_deg / 360)."
    )
    soft_limit_reached: bool = Field(
        description="Accumulated yaw ≥ ±630° (±1.75 turns) — untwist scheduled."
    )
    hard_limit_reached: bool = Field(
        description="Accumulated yaw ≥ ±1260° (±3.5 turns) — forced untwist initiated."
    )
    untwist_in_progress: bool = Field(
        description="Cable untwist sequence currently executing."
    )


class UPSStateResponse(BaseModel):
    """Uninterruptible Power Supply state.

    VFI class online double-conversion UPS (IEC 62040-1).
    Supplies: pitch drives, controls, lighting, communications.
    Spec: 6.6 kWh / 15 kW load → 22 min backup at full load.
    """

    battery_soc_pct: float = Field(
        description="Battery state of charge [%]. Normal (grid connected): 95–100%."
    )
    backup_time_min: float = Field(
        description=(
            "Estimated backup duration at current load [min]. "
            "t = E_battery × η_discharge / P_load. Rated: ~22 min at full load."
        )
    )
    charging: bool = Field(
        description="Battery is being actively charged from grid."
    )
    on_battery: bool = Field(
        description="UPS is drawing from battery (grid loss or mains transfer)."
    )
    load_kw: float = Field(
        description="Current UPS load [kW]. Includes pitch, controls, lighting."
    )
    battery_voltage_v: float = Field(
        description="Battery terminal voltage [V]. Nominal: 48 V (float: 54 V)."
    )
    alarm: bool = Field(
        description="UPS fault or low-battery alarm (SOC < 20% or backup < 5 min)."
    )


# ── Aggregate response ────────────────────────────────────────────────────────


class NacelleSubsystemsResponse(BaseModel):
    """Complete nacelle subsystems state snapshot.

    Aggregates HPU, cooling, safety, cable twist, and UPS into a single
    response for dashboard display and educational inspection.
    """

    hpu: HPUStateResponse = Field(description="Hydraulic Power Unit state.")
    cooling: CoolingStateResponse = Field(
        description="Gearbox oil cooling and lubrication state."
    )
    safety: SafetyStateResponse = Field(
        description="Safety systems: overspeed, vibration, ice, fire, lightning."
    )
    cable_twist: CableTwistStateResponse = Field(
        description="Cable twist counter and untwist status."
    )
    ups: UPSStateResponse = Field(
        description="Uninterruptible Power Supply state."
    )
    any_alarm: bool = Field(
        description="True if any subsystem has an active alarm or trip condition."
    )

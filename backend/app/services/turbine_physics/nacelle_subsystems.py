"""Nacelle subsystem physics models — HPU, generator cooling, safety, UPS.

Physics Layer
─────────────
Models the nacelle subsystems around the IEA 15 MW direct drive (no gearbox, so no
gear-oil circuit — the generator and converter are the heat sources):

  1. Hydraulic Power Unit (HPU)   — accumulator pressure, pitch/brake circuits
  2. Cooling System               — generator + converter losses, stator-winding
                                    temperature, fan control
  3. Safety Systems               — overspeed, vibration, ice, fire, lightning
  4. Cable Twist Counter          — yaw revolution tracking, untwist logic
  5. UPS / Battery                — battery SOC, charge/discharge, backup time

Provenance: overspeed (ROSCO SD_MaxGenSpd), generator and converter efficiencies
(Gaertner et al. 2020, Table 5-4; ROSCO VS_GenEff) and the insulation-class limits
(IEC 60085) are sourced. The HPU pressures, accumulator size, cooler, cable-twist
limits and UPS sizing are illustrative values for a 15 MW class nacelle — the
reference turbine does not specify them.

Standards Layer
───────────────
- ISO 4413: Hydraulic fluid power safety
- ISO 4406: Hydraulic fluid cleanliness classification
- IEC 60034-1 / IEC 60085: Rotating machines, thermal classes (B 130 °C, F 155 °C)
- ISO 10816-21: Vibration monitoring zones for wind turbines
- IEC 61400-1 §8.3: Protection functions (overspeed)
- IEC 62305 LPL I: Lightning protection (200 kA design current)
- IEC 62040-1: UPS requirements

Maths Layer
───────────
Generator and converter losses (direct drive):
    P_mech = P_elec / (η_gen · η_conv)
    Q_gen  = P_mech · (1 − η_gen)        ≈ 540 kW at rated (η_gen 96.55 %)
    Q_conv = P_mech · η_gen · (1 − η_conv) ≈ 124 kW at rated (η_conv 99.18 %)

Stator-winding temperature (same thermal model as the digital twin):
    T_wdg = T_amb + ΔT₀ + R_th · Q_gen   (ΔT₀ 10 K, R_th 0.125 K/kW)

Accumulator pressure (adiabatic):
    P × V^γ = const  →  P_work = P_pre × (V_0 / V_1)^γ

ISO 4406 cleanliness number conversion:
    N = 2^(X-1) particles/mL (where X is the ISO code digit)

UPS backup time:
    t_backup = E_battery × η_discharge / P_load

Code Layer
──────────
Pure functions with frozen dataclass outputs.  No side effects, no I/O.
All inputs use SI units internally; outputs use practical engineering units.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.digital_twin.reference_model import DEFAULT_PARAMS
from app.services.turbine_physics.drivetrain import CONVERTER_EFFICIENCY, GENERATOR_EFFICIENCY
from app.services.turbine_physics.rotor_dynamics import (
    MAX_ROTOR_SPEED_RPM,
    OVERSPEED_SHUTDOWN_RPM,
)

# ── IEA 15 MW nacelle subsystem constants ───────────────────────────────────

RATED_POWER_W: float = 15_000_000.0

# Generator + converter losses at rated output (direct drive)
_P_MECH_RATED_W: float = RATED_POWER_W / (GENERATOR_EFFICIENCY * CONVERTER_EFFICIENCY)
GENERATOR_LOSS_AT_RATED_W: float = _P_MECH_RATED_W * (1.0 - GENERATOR_EFFICIENCY)
"""Generator heat at rated [W] ≈ 540 kW (15.66 MW shaft power × 3.45 %)."""

CONVERTER_LOSS_AT_RATED_W: float = (
    _P_MECH_RATED_W * GENERATOR_EFFICIENCY * (1.0 - CONVERTER_EFFICIENCY)
)
"""Converter heat at rated [W] ≈ 124 kW (15.12 MW × 0.82 %)."""

# HPU
HPU_NOMINAL_PRESSURE_BAR: float = 220.0
"""HPU nominal operating pressure [bar]."""

HPU_PRECHARGE_PRESSURE_BAR: float = 140.0
"""Accumulator nitrogen pre-charge pressure [bar]."""

HPU_ACCUMULATOR_VOLUME_L: float = 50.0
"""Single bladder accumulator volume [L]."""

HPU_ADIABATIC_EXPONENT: float = 1.4
"""Adiabatic exponent for N₂ (γ = 1.4)."""

# Stator winding — insulation thermal classes (IEC 60085)
WINDING_ALARM_TEMP_C: float = 130.0
"""Alarm: thermal class B (130 °C) — the usual design target for class-F insulation."""

WINDING_TRIP_TEMP_C: float = 155.0
"""Trip: thermal class F (155 °C) — insulation limit → EMERGENCY_SHUTDOWN."""

# Safety systems (IEC 61400-1 §8.3)
RATED_ROTOR_SPEED_RPM: float = MAX_ROTOR_SPEED_RPM  # 7.56 rpm (ROSCO PC_RefSpd)
OVERSPEED_WARNING_RPM: float = OVERSPEED_SHUTDOWN_RPM  # 9.07 rpm, controller shutdown
OVERSPEED_HARDWARE_RPM: float = RATED_ROTOR_SPEED_RPM * 1.25  # 9.45 rpm, illustrative
"""Independent safety-chain trip — illustrative 125 % of rated, above the controller
shutdown so it only acts if the controller fails (the reference turbine gives none)."""

# ISO 10816-21 vibration zones (velocity RMS, mm/s)
VIBRATION_ZONE_A_MAX_MM_S: float = 2.3  # New equipment acceptance
VIBRATION_ZONE_B_MAX_MM_S: float = 4.5  # Unrestricted long-term operation
VIBRATION_ZONE_C_MAX_MM_S: float = 7.1  # Restricted operation, plan maintenance
# Zone D: above 7.1 → risk of damage, emergency shutdown

# UPS
UPS_BATTERY_CAPACITY_KWH: float = 6.6
"""Installed UPS battery capacity [kWh] (2 × 48 V / 100 Ah strings)."""

UPS_LOAD_POWER_KW: float = 15.0
"""UPS load during normal operation (pitch + controls + lighting) [kW]."""

UPS_DISCHARGE_EFFICIENCY: float = 0.85
"""Battery discharge efficiency (round-trip losses) [dimensionless]."""

# Cable twist
CABLE_TWIST_SOFT_LIMIT_DEG: float = 630.0
"""Yaw angle accumulation before untwist warning [°] (= ±1.75 turns)."""

CABLE_TWIST_HARD_LIMIT_DEG: float = 1260.0
"""Yaw angle accumulation before forced untwist [°] (= ±3.5 turns)."""


# ── Data containers ───────────────────────────────────────────────────────────


@dataclass(frozen=True)
class HPUState:
    """Hydraulic Power Unit state snapshot.

    Attributes
    ----------
    line_pressure_bar : float
        Current HPU line pressure [bar]. Normal: 180–250.
    accumulator_pressure_bar : float
        Current accumulator gas pressure [bar].
    accumulator_charge_pct : float
        Accumulator charge level [%]. 100 % = fully charged at working pressure.
    pitch_cylinder_extension_pct : float
        Blade pitch cylinder extension [%]. 0 % = feathered (90°), 100 % = fine (0°).
    brake_caliper_pressure_bar : float
        Main shaft brake caliper pressure [bar]. 250 bar = fully clamped.
    pump_running : bool
        HPU pump is running to maintain pressure.
    iso_cleanliness_code : str
        ISO 4406:2021 oil cleanliness code (e.g. "16/14/11").
    alarm : bool
        HPU system alarm active.
    """

    line_pressure_bar: float
    accumulator_pressure_bar: float
    accumulator_charge_pct: float
    pitch_cylinder_extension_pct: float
    brake_caliper_pressure_bar: float
    pump_running: bool
    iso_cleanliness_code: str
    alarm: bool


@dataclass(frozen=True)
class CoolingState:
    """Generator / converter cooling system state snapshot.

    Attributes
    ----------
    winding_temp_c : float
        Generator stator-winding temperature [°C].
    winding_temp_alarm : bool
        Winding above thermal class B (130 °C).
    winding_temp_trip : bool
        Winding at thermal class F (155 °C) → emergency stop.
    generator_loss_kw : float
        Generator losses (copper, iron, magnet) [kW].
    converter_loss_kw : float
        Full-power converter losses [kW].
    cooler_heat_rejection_kw : float
        Heat rejected by the liquid/air coolers [kW] (generator + converter).
    fan_speed_pct : float
        Cooling fan speed [% of maximum].
    ambient_temp_c : float
        Ambient air temperature [°C].
    """

    winding_temp_c: float
    winding_temp_alarm: bool
    winding_temp_trip: bool
    generator_loss_kw: float
    converter_loss_kw: float
    cooler_heat_rejection_kw: float
    fan_speed_pct: float
    ambient_temp_c: float


@dataclass(frozen=True)
class SafetyState:
    """Nacelle safety system state snapshot.

    Attributes
    ----------
    rotor_speed_rpm : float
        Current rotor speed [rpm].
    overspeed_warning : bool
        Rotor speed > 120 % rated (9.07 rpm) — controller shutdown (ROSCO SD_MaxGenSpd).
    overspeed_hardware : bool
        Rotor speed > 125 % rated (9.45 rpm, illustrative) — safety chain trips.
    vibration_mm_s : float
        Main bearing housing vibration velocity RMS [mm/s].
    vibration_zone : str
        ISO 10816-21 zone: "A", "B", "C", or "D".
    vibration_alarm : bool
        Vibration in Zone C or D.
    vibration_trip : bool
        Vibration in Zone D — initiates emergency stop.
    ice_detection_active : bool
        Ice detected on rotor (nacelle anemometer reading deviates > 20 % from met mast).
    fire_alarm : bool
        Fire or smoke detected in nacelle.
    lightning_strike_count : int
        Cumulative lightning strikes recorded on this turbine.
    """

    rotor_speed_rpm: float
    overspeed_warning: bool
    overspeed_hardware: bool
    vibration_mm_s: float
    vibration_zone: str
    vibration_alarm: bool
    vibration_trip: bool
    ice_detection_active: bool
    fire_alarm: bool
    lightning_strike_count: int


@dataclass(frozen=True)
class CableTwistState:
    """Cable twist counter state snapshot.

    Attributes
    ----------
    accumulated_yaw_deg : float
        Total accumulated yaw angle since last untwist [°]. Range: -1260° to +1260°.
    twist_turns : float
        Equivalent number of full nacelle revolutions (accumulated_yaw_deg / 360).
    soft_limit_reached : bool
        Accumulated yaw > ±630° (warning — untwist scheduled).
    hard_limit_reached : bool
        Accumulated yaw > ±1260° (forced untwist initiated).
    untwist_in_progress : bool
        Cable untwist sequence currently executing.
    """

    accumulated_yaw_deg: float
    twist_turns: float
    soft_limit_reached: bool
    hard_limit_reached: bool
    untwist_in_progress: bool


@dataclass(frozen=True)
class UPSState:
    """Uninterruptible Power Supply state snapshot.

    Attributes
    ----------
    battery_soc_pct : float
        Battery state of charge [%]. Healthy: 90–100 % during normal operation.
    backup_time_min : float
        Estimated backup duration at current load [min].
    charging : bool
        Battery is being actively charged from grid.
    on_battery : bool
        UPS is drawing from battery (grid loss or transfer).
    load_kw : float
        Current UPS load [kW].
    battery_voltage_v : float
        Battery terminal voltage [V]. Nominal: 48 V per string.
    alarm : bool
        UPS fault or low-battery alarm.
    """

    battery_soc_pct: float
    backup_time_min: float
    charging: bool
    on_battery: bool
    load_kw: float
    battery_voltage_v: float
    alarm: bool


@dataclass(frozen=True)
class NacelleSubsystemsState:
    """Complete nacelle subsystems snapshot."""

    hpu: HPUState
    cooling: CoolingState
    safety: SafetyState
    cable_twist: CableTwistState
    ups: UPSState


# ── Pure physics functions ────────────────────────────────────────────────────


def compute_hpu_state(
    power_mw: float,
    is_operating: bool = True,
    pitch_deg: float = 5.0,
) -> HPUState:
    """Compute HPU state given turbine operating conditions.

    Models the accumulator pressure as a function of pitch activity.
    During normal operation the pump maintains line pressure at 220 bar.
    Higher pitch demand (Region 3, high wind) causes more rapid
    accumulator discharge between pump cycles.

    Args:
        power_mw: Current electrical output [MW]. Used to infer operating region.
        is_operating: True if turbine is in POWER_PRODUCTION state.
        pitch_deg: Current blade pitch angle [°]. 0° = fine, 90° = feather.

    Returns:
        HPUState snapshot.
    """
    # Line pressure: nominal during operation, drops during shutdown
    if is_operating:
        line_pressure = HPU_NOMINAL_PRESSURE_BAR
    else:
        # Accumulator keeping pitch/brake alive without pump
        charge_fraction = max(0.3, 1.0 - pitch_deg / 90.0)
        line_pressure = (
            HPU_PRECHARGE_PRESSURE_BAR
            + (HPU_NOMINAL_PRESSURE_BAR - HPU_PRECHARGE_PRESSURE_BAR) * charge_fraction
        )

    # Accumulator pressure: adiabatic discharge model
    # At 250 bar (working) → 140 bar (pre-charge) represents 0→100% discharge
    p_work = HPU_NOMINAL_PRESSURE_BAR + 30.0  # 250 bar working
    charge_pct = max(
        0.0,
        min(
            100.0,
            (line_pressure - HPU_PRECHARGE_PRESSURE_BAR)
            / (p_work - HPU_PRECHARGE_PRESSURE_BAR)
            * 100.0,
        ),
    )

    # Pitch cylinder extension: 0 % feathered (90°) → 100 % fine (0°)
    extension_pct = max(0.0, min(100.0, 100.0 - pitch_deg / 90.0 * 100.0))

    # Brake caliper: clamped when parked (250 bar), released when operating (0 bar)
    brake_pressure = 0.0 if is_operating else 250.0

    # ISO 4406 cleanliness: degrades with operating hours modelled by power fraction
    # Nominal class 16/14/11; alarm at 18/16/13
    power_fraction = power_mw / 15.0 if is_operating else 0.0
    if power_fraction > 0.95:
        iso_code = "17/15/12"
    elif power_fraction > 0.5:
        iso_code = "16/14/11"
    else:
        iso_code = "15/13/10"

    alarm = line_pressure < 170.0  # Low pressure alarm

    return HPUState(
        line_pressure_bar=round(line_pressure, 1),
        accumulator_pressure_bar=round(
            HPU_PRECHARGE_PRESSURE_BAR + (p_work - HPU_PRECHARGE_PRESSURE_BAR) * charge_pct / 100.0,
            1,
        ),
        accumulator_charge_pct=round(charge_pct, 1),
        pitch_cylinder_extension_pct=round(extension_pct, 1),
        brake_caliper_pressure_bar=brake_pressure,
        pump_running=is_operating,
        iso_cleanliness_code=iso_code,
        alarm=alarm,
    )


def compute_cooling_state(
    power_mw: float,
    ambient_temp_c: float = 15.0,
) -> CoolingState:
    """Compute the generator/converter cooling state at steady operating conditions.

    Direct drive: the heat comes from the PMSG (η 96.55 %) and the full-power
    converter (η 99.18 %); there is no gearbox oil circuit. The stator-winding
    temperature uses the digital twin's thermal model so both agree:

        T_wdg = T_amb + 10 K + 0.125 K/kW · Q_gen   → ≈ 92 °C at rated, 15 °C ambient

    The fan runs in proportion to the heat load (20 % minimum while producing).

    Args:
        power_mw: Current electrical output [MW].
        ambient_temp_c: Ambient air temperature [°C].

    Returns:
        CoolingState snapshot.
    """
    p_elec_w = max(power_mw, 0.0) * 1e6
    p_mech_w = p_elec_w / (GENERATOR_EFFICIENCY * CONVERTER_EFFICIENCY)
    q_gen_w = p_mech_w * (1.0 - GENERATOR_EFFICIENCY)
    q_conv_w = p_mech_w * GENERATOR_EFFICIENCY * (1.0 - CONVERTER_EFFICIENCY)
    q_total_w = q_gen_w + q_conv_w

    winding_c = (
        ambient_temp_c
        + (DEFAULT_PARAMS.generator_temp_offset_k if p_elec_w > 0 else 0.0)
        + DEFAULT_PARAMS.generator_thermal_resistance_k_per_kw * q_gen_w / 1e3
    )
    load = q_total_w / (GENERATOR_LOSS_AT_RATED_W + CONVERTER_LOSS_AT_RATED_W)
    fan_speed_pct = 0.0 if q_total_w <= 0 else min(100.0, max(20.0, 100.0 * load))

    return CoolingState(
        winding_temp_c=round(winding_c, 1),
        winding_temp_alarm=winding_c >= WINDING_ALARM_TEMP_C,
        winding_temp_trip=winding_c >= WINDING_TRIP_TEMP_C,
        generator_loss_kw=round(q_gen_w / 1e3, 1),
        converter_loss_kw=round(q_conv_w / 1e3, 1),
        cooler_heat_rejection_kw=round(q_total_w / 1e3, 1),
        fan_speed_pct=round(fan_speed_pct, 1),
        ambient_temp_c=ambient_temp_c,
    )


def _classify_vibration_zone(vibration_mm_s: float) -> tuple[str, bool, bool]:
    """Classify vibration level per ISO 10816-21.

    Returns:
        (zone, alarm, trip) — zone is "A", "B", "C", or "D".
    """
    if vibration_mm_s <= VIBRATION_ZONE_A_MAX_MM_S:
        return "A", False, False
    if vibration_mm_s <= VIBRATION_ZONE_B_MAX_MM_S:
        return "B", False, False
    if vibration_mm_s <= VIBRATION_ZONE_C_MAX_MM_S:
        return "C", True, False
    return "D", True, True


def compute_safety_state(
    rotor_speed_rpm: float,
    power_mw: float = 0.0,
    vibration_mm_s: float = 1.5,
    ice_detection: bool = False,
    fire_alarm: bool = False,
    lightning_count: int = 0,
) -> SafetyState:
    """Compute safety system state.

    Args:
        rotor_speed_rpm: Current rotor speed [rpm].
        power_mw: Current electrical output [MW] (used to derive expected vibration).
        vibration_mm_s: Main bearing vibration velocity RMS [mm/s].
        ice_detection: Ice detected on rotor blades.
        fire_alarm: Fire/smoke detected in nacelle.
        lightning_count: Cumulative lightning strike count.

    Returns:
        SafetyState snapshot.
    """
    overspeed_warning = rotor_speed_rpm > OVERSPEED_WARNING_RPM
    overspeed_hardware = rotor_speed_rpm > OVERSPEED_HARDWARE_RPM

    # Vibration model: typically 1.5 mm/s at rated power, scales with rotor speed
    effective_vibration = vibration_mm_s * (1.0 + 0.2 * power_mw / 15.0)
    zone, alarm, trip = _classify_vibration_zone(effective_vibration)

    return SafetyState(
        rotor_speed_rpm=round(rotor_speed_rpm, 2),
        overspeed_warning=overspeed_warning,
        overspeed_hardware=overspeed_hardware,
        vibration_mm_s=round(effective_vibration, 2),
        vibration_zone=zone,
        vibration_alarm=alarm,
        vibration_trip=trip,
        ice_detection_active=ice_detection,
        fire_alarm=fire_alarm,
        lightning_strike_count=lightning_count,
    )


def compute_cable_twist_state(
    accumulated_yaw_deg: float,
    untwist_in_progress: bool = False,
) -> CableTwistState:
    """Compute cable twist counter state.

    Args:
        accumulated_yaw_deg: Total accumulated yaw angle since last untwist [°].
            Positive = clockwise (CW), negative = counter-clockwise (CCW).
        untwist_in_progress: Untwist sequence is currently executing.

    Returns:
        CableTwistState snapshot.
    """
    abs_yaw = abs(accumulated_yaw_deg)
    soft_limit = abs_yaw >= CABLE_TWIST_SOFT_LIMIT_DEG
    hard_limit = abs_yaw >= CABLE_TWIST_HARD_LIMIT_DEG

    return CableTwistState(
        accumulated_yaw_deg=round(accumulated_yaw_deg, 1),
        twist_turns=round(accumulated_yaw_deg / 360.0, 2),
        soft_limit_reached=soft_limit,
        hard_limit_reached=hard_limit,
        untwist_in_progress=untwist_in_progress,
    )


def compute_ups_state(
    grid_available: bool = True,
    soc_pct: float = 98.0,
) -> UPSState:
    """Compute UPS state.

    Args:
        grid_available: Grid power is available (normal operation).
        soc_pct: Battery state of charge [%]. Default: 98 % (floating charge).

    Returns:
        UPSState snapshot.
    """
    on_battery = not grid_available
    charging = grid_available and soc_pct < 99.5

    # Backup time: E_battery × η_discharge / P_load
    backup_energy_kwh = UPS_BATTERY_CAPACITY_KWH * soc_pct / 100.0
    backup_kwh_available = backup_energy_kwh * UPS_DISCHARGE_EFFICIENCY
    backup_time_h = backup_kwh_available / UPS_LOAD_POWER_KW
    backup_time_min = backup_time_h * 60.0

    # Battery voltage: 48 V nominal, sags under load
    base_voltage = 54.0  # Float voltage (slightly above nominal)
    if on_battery:
        base_voltage = 48.0 - (100.0 - soc_pct) * 0.05  # Sag with discharge

    low_battery = soc_pct < 20.0
    alarm = low_battery or (on_battery and backup_time_min < 5.0)

    return UPSState(
        battery_soc_pct=round(soc_pct, 1),
        backup_time_min=round(backup_time_min, 1),
        charging=charging,
        on_battery=on_battery,
        load_kw=UPS_LOAD_POWER_KW,
        battery_voltage_v=round(base_voltage, 1),
        alarm=alarm,
    )


def compute_nacelle_subsystems(
    power_mw: float = 10.0,
    ambient_temp_c: float = 15.0,
    rotor_speed_rpm: float = 7.56,
    pitch_deg: float = 5.0,
    accumulated_yaw_deg: float = 90.0,
    is_operating: bool = True,
    grid_available: bool = True,
    battery_soc_pct: float = 98.0,
    vibration_mm_s: float = 1.5,
    ice_detection: bool = False,
    fire_alarm: bool = False,
    lightning_count: int = 0,
) -> NacelleSubsystemsState:
    """Compute complete nacelle subsystems state snapshot.

    Aggregates all subsystem models into a single consistent snapshot.
    All inputs represent current turbine operating conditions.

    Args:
        power_mw: Current electrical output [MW].
        ambient_temp_c: Ambient air temperature [°C].
        rotor_speed_rpm: Current rotor speed [rpm].
        pitch_deg: Current blade pitch angle [°].
        accumulated_yaw_deg: Yaw accumulation since last untwist [°].
        is_operating: Turbine in POWER_PRODUCTION state.
        grid_available: Grid connection available.
        battery_soc_pct: UPS battery state of charge [%].
        vibration_mm_s: Main bearing vibration velocity RMS [mm/s].
        ice_detection: Ice detected on rotor.
        fire_alarm: Fire/smoke alarm active.
        lightning_count: Cumulative lightning strikes.

    Returns:
        NacelleSubsystemsState with all subsystem snapshots.
    """
    return NacelleSubsystemsState(
        hpu=compute_hpu_state(power_mw, is_operating, pitch_deg),
        cooling=compute_cooling_state(power_mw, ambient_temp_c),
        safety=compute_safety_state(
            rotor_speed_rpm, power_mw, vibration_mm_s, ice_detection, fire_alarm, lightning_count
        ),
        cable_twist=compute_cable_twist_state(accumulated_yaw_deg),
        ups=compute_ups_state(grid_available, battery_soc_pct),
    )

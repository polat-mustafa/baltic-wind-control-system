"""Nacelle subsystem physics models — HPU, cooling, lubrication, safety.

Physics Layer
─────────────
Models the six major nacelle subsystems that support drivetrain operation:

  1. Hydraulic Power Unit (HPU)   — accumulator pressure, pitch/brake circuits
  2. Lubrication System           — gearbox oil circuit, temperature, viscosity
  3. Cooling System               — heat balance, radiator capacity, fan control
  4. Safety Systems               — overspeed, vibration, ice, fire, lightning
  5. Cable Twist Counter          — yaw revolution tracking, untwist logic
  6. UPS / Battery                — battery SOC, charge/discharge, backup time

Standards Layer
───────────────
- ISO 4413: Hydraulic fluid power safety
- ISO 4406: Hydraulic fluid cleanliness classification
- ISO 6743-6: Lubricants for gearboxes (ISO VG 320)
- ISO 10816-21: Vibration monitoring zones for wind turbines
- IEC 61400-1 §7.4: Safety system trip thresholds
- IEC 62305 LPL I: Lightning protection (200 kA design current)
- IEC 62040-1: UPS requirements

Maths Layer
───────────
Gearbox oil temperature (thermal equilibrium):
    T_oil = T_amb + Q_loss / (UA_cooler + UA_housing)
    where Q_loss = P_mech × (1 - η_gearbox)

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

import math
from dataclasses import dataclass

# ── V236-15.0 MW nacelle subsystem constants ─────────────────────────────────

# Gearbox
GEARBOX_EFFICIENCY: float = 0.97
"""Gearbox mechanical efficiency [dimensionless]."""

GEARBOX_LOSS_AT_RATED_W: float = 15_000_000.0 * (1.0 - GEARBOX_EFFICIENCY)
"""Gearbox heat dissipation at rated power [W] = 15 MW × 3% = 450 kW."""

# HPU
HPU_NOMINAL_PRESSURE_BAR: float = 220.0
"""HPU nominal operating pressure [bar]."""

HPU_PRECHARGE_PRESSURE_BAR: float = 140.0
"""Accumulator nitrogen pre-charge pressure [bar]."""

HPU_ACCUMULATOR_VOLUME_L: float = 50.0
"""Single bladder accumulator volume [L]."""

HPU_ADIABATIC_EXPONENT: float = 1.4
"""Adiabatic exponent for N₂ (γ = 1.4)."""

# Gearbox lubrication
GEARBOX_OIL_VISCOSITY_INDEX: float = 140.0
"""ISO VG 320 synthetic gear oil viscosity index."""

GEARBOX_OIL_NOMINAL_TEMP_C: float = 65.0
"""Nominal gearbox oil operating temperature [°C]."""

GEARBOX_OIL_ALARM_TEMP_C: float = 75.0
"""Oil high-temperature alarm threshold [°C]."""

GEARBOX_OIL_TRIP_TEMP_C: float = 85.0
"""Oil high-temperature trip threshold [°C] → EMERGENCY_SHUTDOWN."""

# Cooling system
COOLER_UA_W_PER_K: float = 15_000.0
"""Overall heat transfer coefficient × area for oil cooler [W/K]."""

# Safety systems (IEC 61400-1 §7.4.2)
RATED_ROTOR_SPEED_RPM: float = 8.33
OVERSPEED_WARNING_RPM: float = RATED_ROTOR_SPEED_RPM * 1.10  # 9.16 rpm
OVERSPEED_HARDWARE_RPM: float = RATED_ROTOR_SPEED_RPM * 1.20  # 10.0 rpm

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
    """Gearbox cooling system state snapshot.

    Attributes
    ----------
    oil_temp_c : float
        Gearbox oil temperature at cooler inlet [°C].
    oil_temp_alarm : bool
        Oil temperature above alarm threshold (75 °C).
    oil_temp_trip : bool
        Oil temperature above trip threshold (85 °C) → emergency stop.
    cooler_heat_rejection_kw : float
        Heat rejected by oil cooler [kW].
    fan_speed_pct : float
        Cooling fan speed [% of maximum].
    ambient_temp_c : float
        Ambient air temperature [°C].
    viscosity_cst : float
        Oil kinematic viscosity at current temperature [cSt].
    """

    oil_temp_c: float
    oil_temp_alarm: bool
    oil_temp_trip: bool
    cooler_heat_rejection_kw: float
    fan_speed_pct: float
    ambient_temp_c: float
    viscosity_cst: float


@dataclass(frozen=True)
class SafetyState:
    """Nacelle safety system state snapshot.

    Attributes
    ----------
    rotor_speed_rpm : float
        Current rotor speed [rpm].
    overspeed_warning : bool
        Rotor speed > 110 % rated (9.16 rpm) — electrical trip armed.
    overspeed_hardware : bool
        Rotor speed > 120 % rated (10.0 rpm) — centrifugal governor active.
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


def compute_oil_viscosity_cst(temp_c: float) -> float:
    """Compute ISO VG 320 synthetic gear oil kinematic viscosity [cSt].

    Uses the Walther equation (ASTM D341) for viscosity-temperature:
        log log(ν + 0.7) = A - B × log(T_K)

    Constants calibrated for ISO VG 320 synthetic (PAO-based):
        At 40°C: ν ≈ 320 cSt
        At 100°C: ν ≈ 38 cSt
        VI ≈ 140 (high VI synthetic oil)

    Args:
        temp_c: Oil temperature [°C].

    Returns:
        Kinematic viscosity [cSt].
    """
    T_K = temp_c + 273.15
    # Walther constants fitted to ISO VG 320 synthetic (PAO-based):
    #   At 40°C  (313.15 K): log10(log10(320.7)) = 0.3990 = A - B×log10(313.15)
    #   At 100°C (373.15 K): log10(log10( 38.7)) = 0.2008 = A - B×log10(373.15)
    #   → B = 0.1982 / 0.0762 = 2.600;  A = 0.3990 + 2.600×2.4958 = 6.888
    A = 6.888
    B = 2.600
    log_log_nu = A - B * math.log10(T_K)
    nu = 10 ** (10**log_log_nu) - 0.7
    return max(5.0, round(nu, 1))


def compute_cooling_state(
    power_mw: float,
    ambient_temp_c: float = 15.0,
) -> CoolingState:
    """Compute gearbox cooling system state at steady-state operating conditions.

    Thermal equilibrium model:
        T_oil = T_amb + Q_loss / UA_cooler

    Gearbox losses scale with input power:
        Q_loss = P_input × (1 - η_gearbox) = P_mech × 0.03

    Fan speed is controlled to maintain T_oil ≤ 65 °C.

    Args:
        power_mw: Current electrical output [MW].
        ambient_temp_c: Ambient air temperature [°C].

    Returns:
        CoolingState snapshot.
    """
    # Gearbox heat loss: account for drivetrain efficiency (P_mech ≈ P_elec / 0.97 / 0.975)
    eta_total = 0.97 * 0.975
    p_mech_w = (power_mw * 1e6) / eta_total if power_mw > 0 else 0.0
    q_loss_w = p_mech_w * (1.0 - GEARBOX_EFFICIENCY)

    # Steady-state oil temperature
    oil_temp_c = ambient_temp_c + q_loss_w / COOLER_UA_W_PER_K

    # Fan speed: proportional control to maintain 65 °C setpoint
    setpoint_c = GEARBOX_OIL_NOMINAL_TEMP_C
    if oil_temp_c <= ambient_temp_c + 5.0:
        fan_speed_pct = 0.0  # Below minimum thermal load
    elif oil_temp_c < setpoint_c:
        fan_speed_pct = max(
            20.0,
            min(100.0, (oil_temp_c - ambient_temp_c) / (setpoint_c - ambient_temp_c) * 100.0),
        )
    else:
        fan_speed_pct = 100.0

    # Actual heat rejection (with fan running, UA increases)
    fan_factor = 0.6 + 0.4 * fan_speed_pct / 100.0
    ua_effective = COOLER_UA_W_PER_K * fan_factor
    oil_temp_c_actual = ambient_temp_c + q_loss_w / ua_effective

    return CoolingState(
        oil_temp_c=round(oil_temp_c_actual, 1),
        oil_temp_alarm=oil_temp_c_actual >= GEARBOX_OIL_ALARM_TEMP_C,
        oil_temp_trip=oil_temp_c_actual >= GEARBOX_OIL_TRIP_TEMP_C,
        cooler_heat_rejection_kw=round(q_loss_w / 1000.0, 1),
        fan_speed_pct=round(fan_speed_pct, 1),
        ambient_temp_c=ambient_temp_c,
        viscosity_cst=compute_oil_viscosity_cst(oil_temp_c_actual),
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
    rotor_speed_rpm: float = 7.5,
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

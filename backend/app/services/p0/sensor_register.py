"""
Sensor Register Service — static instrument data for Baltic Wind 510 MW.

Returns the full sensor specification register as defined in:
- IEC 61400-12-1 (anemometers)
- ISO 10816-21 (vibration sensors)
- IEC 61869-2/3 (current and voltage transformers)
- IEC 60287 (DTS for dynamic cable rating)
- IEC 61850-7-4 (logical node mapping)
"""

from __future__ import annotations

from app.schemas.sensor_specs import (
    CableSensorGroup,
    OSSBaySensorGroup,
    SensorRegisterResponse,
    SensorSpec,
    TurbineSensorGroup,
)

# ── Per-turbine sensors ────────────────────────────────────────────────────

_TURBINE_SENSORS: list[SensorSpec] = [
    SensorSpec(
        name="Nacelle anemometer",
        quantity_per_location=1,
        signal_type="4-20 mA",
        range="0-50 m/s",
        accuracy="±0.2 m/s (IEC 61400-12-1 Class 1A)",
        standard="IEC 61400-12-1",
        iec_61850_ln="WMET1.WdSpd",
        notes=(
            "Subject to rotor wake distortion (5-15% bias). "
            "Transfer function to free-stream speed derived during power-performance test "
            "per IEC 61400-12-2. Redundant with met-mast/lidar reference."
        ),
    ),
    SensorSpec(
        name="Wind vane (yaw reference)",
        quantity_per_location=1,
        signal_type="4-20 mA",
        range="0-360°",
        accuracy="±2°",
        standard="IEC 61400-12-1",
        iec_61850_ln="WMET1.WdDir",
        notes="Potentiometer type; heated for ice prevention. Used by yaw control algorithm.",
    ),
    SensorSpec(
        name="Main bearing RTD",
        quantity_per_location=1,
        signal_type="PT100 3-wire",
        range="-40 to +120°C",
        accuracy="±0.5°C (IEC 60751 Class B)",
        standard="IEC 60751",
        iec_61850_ln="WTHI1.TmpSv",
        notes=(
            "Alarm threshold: 70°C. Trip threshold: 90°C. "
            "Grease-lubricated bearing; overtemperature indicates lubrication failure "
            "or bearing wear. See ISO 10816-21 §6."
        ),
    ),
    SensorSpec(
        name="Gearbox high-speed (HS) bearing RTD",
        quantity_per_location=1,
        signal_type="PT100 3-wire",
        range="-40 to +120°C",
        accuracy="±0.5°C",
        standard="IEC 60751",
        iec_61850_ln="WTHI1.TmpSv",
        notes="Oil-lubricated. Alarm at 80°C, trip at 100°C. Monitored with oil level sensor.",
    ),
    SensorSpec(
        name="Gearbox low-speed (LS) bearing RTD",
        quantity_per_location=1,
        signal_type="PT100 3-wire",
        range="-40 to +120°C",
        accuracy="±0.5°C",
        standard="IEC 60751",
        iec_61850_ln="WTHI1.TmpSv",
        notes="Grease-lubricated; lower operating temperature than HS bearing.",
    ),
    SensorSpec(
        name="Generator winding RTD",
        quantity_per_location=1,
        signal_type="PT100 3-wire",
        range="-40 to +155°C",
        accuracy="±1.0°C (IEC 60034-1 Class F insulation)",
        standard="IEC 60034-1",
        iec_61850_ln="WGEN1.TmpSv",
        notes=(
            "Class F insulation max 155°C. Alarm at 130°C, trip at 155°C. "
            "Multiple RTDs per winding phase — single highest-reading reported to SCADA."
        ),
    ),
    SensorSpec(
        name="Main bearing accelerometer (CMS)",
        quantity_per_location=1,
        signal_type="IEPE (ICP), 4 mA constant current",
        range="0-1 kHz, 0-50 g pk",
        accuracy="±5% (ISO 10816-21 Class 1)",
        standard="ISO 10816-21",
        iec_61850_ln="WTUR1.VibVl",
        notes=(
            "Sensitivity 50 mV/g. Monitors: outer race defect (BPFO), inner race defect (BPFI), "
            "ball defect (BSF), cage defect. FFT streamed to CMS historian at 20 kHz sample rate; "
            "SCADA receives aggregated RMS and peak-frequency every 10 min."
        ),
    ),
    SensorSpec(
        name="Gearbox accelerometer (CMS)",
        quantity_per_location=1,
        signal_type="IEPE (ICP), 4 mA constant current",
        range="0-5 kHz, 0-100 g pk",
        accuracy="±5% (ISO 10816-21 Class 1)",
        standard="ISO 10816-21",
        iec_61850_ln="WTUR1.VibVl",
        notes=(
            "Sensitivity 100 mV/g (higher frequency range for gear mesh frequencies). "
            "Gearbox mesh frequency ≈ n_LS x Z_teeth. Envelope analysis detects "
            "early-stage pitting at sub-alarm amplitude."
        ),
    ),
    SensorSpec(
        name="Pitch actuator hydraulic pressure",
        quantity_per_location=1,
        signal_type="4-20 mA",
        range="0-300 bar",
        accuracy="±1 bar (±0.3%)",
        standard="IEC 61400-1 §11",
        iec_61850_ln="WPPC1.PtchAnglSetPt",
        notes=(
            "3x sensors per turbine (one per blade). Monitors pitch control hydraulics. "
            "Low pressure alarm prevents blade feathering failure on emergency stop. "
            "Data used to infer blade icing (asymmetric pressure signature)."
        ),
    ),
    SensorSpec(
        name="Rotor absolute encoder",
        quantity_per_location=1,
        signal_type="SSI (Synchronous Serial Interface)",
        range="0-360° (absolute), 0-12 rpm",
        accuracy="±0.1° (16-bit resolution)",
        standard="IEC 61400-1",
        iec_61850_ln="WTUR1.RotSpd",
        notes=(
            "Used by: (1) PLC for rotor speed trip (overspeed at 110% rated ≈ 9.5 rpm), "
            "(2) wake model for power curve correction, "
            "(3) vibration analysis (order-tracking relative to rotation)."
        ),
    ),
]

_TURBINE_SENSOR_GROUP = TurbineSensorGroup(
    sensors=_TURBINE_SENSORS,
    total_per_turbine=len(_TURBINE_SENSORS),
)

# ── Per-OSS bay sensors ────────────────────────────────────────────────────

_OSS_BAY_SENSORS: list[SensorSpec] = [
    SensorSpec(
        name="Current transformer — metering core",
        quantity_per_location=2,
        signal_type="5 A secondary (class 0.5)",
        range="0-1000 A primary, ratio 1000/1",
        accuracy="Class 0.5 per IEC 61869-2 (≤0.5% ratio error at 100% In)",
        standard="IEC 61869-2",
        iec_61850_ln="MMXU1.A",
        notes=(
            "Used for: energy metering (revenue), power factor measurement, load flow monitoring. "
            "Separate from protection core. Burden ≤ 5 VA."
        ),
    ),
    SensorSpec(
        name="Current transformer — protection core",
        quantity_per_location=2,
        signal_type="1 A secondary (class 5P20)",
        range="0-1000 A primary",
        accuracy="Class 5P20 per IEC 61869-2 (≤5% composite error at 20x In)",
        standard="IEC 61869-2",
        iec_61850_ln="MMXU1.A",
        notes=(
            "Used for: overcurrent (ANSI 50/51), differential (ANSI 87T), earth fault (ANSI 51N). "
            "20x accuracy limit factor ensures relay operates during fault conditions. "
            "CT saturation analysis required per IEC 60909."
        ),
    ),
    SensorSpec(
        name="Voltage transformer — metering + protection",
        quantity_per_location=2,
        signal_type="100 V secondary (class 0.5/3P combined)",
        range="66 kV / 100 V, ratio 660/1",
        accuracy="Class 0.5 (metering) / 3P (protection) per IEC 61869-3",
        standard="IEC 61869-3",
        iec_61850_ln="MMXU1.PhV",
        notes=(
            "Capacitive VT (CVT) preferred for 66 kV. "
            "Used for: voltage magnitude/angle measurement, "
            "synchrocheck (ΔV < 5%, Δf < 0.1 Hz, Δφ < 10°) before tie-CB close, "
            "directional overcurrent element polarisation."
        ),
    ),
    SensorSpec(
        name="Digital input module (breaker/disconnector status)",
        quantity_per_location=1,
        signal_type="24 VDC discrete input, 16 channels",
        range="0 V (OPEN) / 24 V (CLOSED)",
        accuracy="Binary state (no analogue error)",
        standard="IEC 61850-8-1 (GOOSE publisher)",
        iec_61850_ln="XCBR1.Pos / XSWI1.Pos",
        notes=(
            "Reads auxiliary contacts from: CB (1x NO + 1x NC for trip supervision), "
            "Disconnector (OPEN/CLOSED/MOVING), Earth switch (OPEN/CLOSED). "
            "Time-stamped at 1 ms resolution for SOE (Sequence of Events) recording."
        ),
    ),
]

_OSS_BAY_SENSOR_GROUP = OSSBaySensorGroup(
    sensors=_OSS_BAY_SENSORS,
    total_per_bay=sum(s.quantity_per_location for s in _OSS_BAY_SENSORS),
)

# ── Export cable sensors ───────────────────────────────────────────────────

_CABLE_SENSORS: list[SensorSpec] = [
    SensorSpec(
        name="DTS fibre — section 1 (0-15 km)",
        quantity_per_location=1,
        signal_type="Optical (Raman backscatter)",
        range="-40 to +120°C, 0-15,000 m",
        accuracy="±0.1°C temperature, 1 m spatial resolution",
        standard="IEC 60287 (thermal model validation)",
        iec_61850_ln=None,
        notes=(
            "Raman OTDR interrogator at OSS. Scan period: 5 min. "
            "Alarm at conductor temperature > 70°C (warning) / 90°C (critical). "
            "J-tube zone (0-200 m at each end) has enhanced zone factor 1.4 in thermal model. "
            "DTS data used for dynamic cable rating (IEC 60853 method)."
        ),
    ),
    SensorSpec(
        name="DTS fibre — section 2 (15-30 km)",
        quantity_per_location=1,
        signal_type="Optical (Raman backscatter)",
        range="-40 to +120°C, 15,000-30,000 m",
        accuracy="±0.1°C temperature, 1 m spatial resolution",
        standard="IEC 60287",
        iec_61850_ln=None,
        notes="Mid-route section. Typical seabed temperature at 40 m depth: 4-12°C seasonal.",
    ),
    SensorSpec(
        name="DTS fibre — section 3 (30-45 km)",
        quantity_per_location=1,
        signal_type="Optical (Raman backscatter)",
        range="-40 to +120°C, 30,000-45,000 m",
        accuracy="±0.1°C temperature, 1 m spatial resolution",
        standard="IEC 60287",
        iec_61850_ln=None,
        notes=(
            "Onshore-transition zone (km 43-45). Higher ambient temperature on land; "
            "separate thermal derating factor applied for burial in soil vs seabed."
        ),
    ),
    SensorSpec(
        name="Joint box temperature monitor — km 15",
        quantity_per_location=1,
        signal_type="PT100 3-wire, cable piggyback signal pair",
        range="0-80°C",
        accuracy="±0.5°C",
        standard="IEC 60840 §14 (joint requirements)",
        iec_61850_ln=None,
        notes=(
            "Factory joint at 15 km. PT100 installed in potted resin inside the joint body. "
            "Temperature alarm at 60°C indicates joint degradation or burial problem. "
            "Signal transmitted via spare conductors in the cable sheath."
        ),
    ),
    SensorSpec(
        name="Joint box temperature monitor — km 30",
        quantity_per_location=1,
        signal_type="PT100 3-wire, cable piggyback signal pair",
        range="0-80°C",
        accuracy="±0.5°C",
        standard="IEC 60840 §14",
        iec_61850_ln=None,
        notes="Factory joint at 30 km. Same specification as km 15 joint monitor.",
    ),
]

_CABLE_SENSOR_GROUP = CableSensorGroup(
    sensors=_CABLE_SENSORS,
    total_cable_instruments=len(_CABLE_SENSORS),
)

# ── Public API ─────────────────────────────────────────────────────────────

_TURBINE_TAGS = _TURBINE_SENSOR_GROUP.total_per_turbine * 34  # 34 turbines
_OSS_TAGS = _OSS_BAY_SENSOR_GROUP.total_per_bay * 6  # 6 bays
_CABLE_TAGS = _CABLE_SENSOR_GROUP.total_cable_instruments

_TOTAL_TAGS = _TURBINE_TAGS + _OSS_TAGS + _CABLE_TAGS


def get_sensor_register() -> SensorRegisterResponse:
    """Return the complete instrument register for Baltic Wind 510 MW.

    Returns
    -------
    SensorRegisterResponse
        Static data — no database query needed.
    """
    return SensorRegisterResponse(
        turbine=_TURBINE_SENSOR_GROUP,
        oss_bay=_OSS_BAY_SENSOR_GROUP,
        export_cable=_CABLE_SENSOR_GROUP,
        total_turbine_locations=34,
        total_oss_bays=6,
        total_instrument_tags=_TOTAL_TAGS,
    )

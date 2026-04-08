"""
Sensor Architecture & Specification Schemas.

Defines the full sensor register for the Baltic Wind 510 MW platform:
- Per-turbine instruments (34 × V236-15.0 MW)
- Offshore substation instruments (6 bays × 5 instruments)
- Export cable instruments (DTS + joint monitors)

Standards
---------
IEC 61400-12-1  — Power performance measurements (anemometer class)
ISO 10816-21    — Vibration measurement on wind turbines
IEC 61869-2     — Current transformers (accuracy class 0.5 / 5P20)
IEC 61869-3     — Voltage transformers (accuracy class 0.5 / 3P)
IEC 61850-7-4   — Logical node names (WMET1, WTHI1, MMXU1, etc.)
IEC 60287       — Current rating (DTS thermal model input)
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SensorSpec(BaseModel):
    """Specification for a single instrument type."""

    name: str = Field(..., description="Instrument name / description")
    quantity_per_location: int = Field(..., description="Number of this sensor per location unit")
    signal_type: str = Field(..., description="Output signal (e.g. 4-20 mA, PT100, IEPE)")
    range: str = Field(..., description="Measurement range with units")
    accuracy: str = Field(..., description="Stated accuracy (e.g. ±0.2 m/s, Class 0.5)")
    standard: str = Field(..., description="Governing IEC/ISO standard")
    iec_61850_ln: str | None = Field(
        None,
        description="IEC 61850-7-4 logical node (WMET1, WTHI1, etc.)",
    )
    notes: str = Field(default="", description="Engineering notes or calibration requirements")


class TurbineSensorGroup(BaseModel):
    """All sensors installed on a single V236-15.0 MW turbine."""

    turbine_model: str = "Vestas V236-15.0 MW"
    sensors: list[SensorSpec]
    total_per_turbine: int


class OSSBaySensorGroup(BaseModel):
    """All primary instrument transformers in one OSS feeder bay."""

    bay_voltage_kv: float = 66.0
    sensors: list[SensorSpec]
    total_per_bay: int


class CableSensorGroup(BaseModel):
    """Export cable monitoring instruments (45 km, 220 kV three-core)."""

    cable_length_km: float = 45.0
    cable_voltage_kv: float = 220.0
    sensors: list[SensorSpec]
    total_cable_instruments: int


class SensorRegisterResponse(BaseModel):
    """
    Complete instrument register for the Baltic Wind 510 MW platform.

    Counts
    ------
    Turbines: 34 × 11 sensors = 374 instrument tags
    OSS bays: 6 × 5 instruments = 30 instrument tags
    Export cable: 5 instruments
    Total: ~409 field instruments (process sensors only)

    Exclusions: smoke/fire detectors, CCTV, met-mast meteorological
    instruments, access-control systems.
    """

    turbine: TurbineSensorGroup
    oss_bay: OSSBaySensorGroup
    export_cable: CableSensorGroup
    total_turbine_locations: int = 34
    total_oss_bays: int = 6
    total_instrument_tags: int
    disclaimer: str = (
        "This register covers primary process sensors. "
        "Quantities exclude ancillary safety systems (fire, gas, CCTV). "
        "Sensor specifications are indicative — final values are vendor-specific."
    )

"""
Pydantic schemas for P3 SCADA & IEC 61850 substation automation.

Request and response models for the IEC 61850 device registry,
logical node queries, GOOSE control blocks, SCL file generation,
and GOOSE fault simulation.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

# ── Enums ──────────────────────────────────────────────────────


class SCLFileType(StrEnum):
    """SCL file types per IEC 61850-6."""

    SSD = "SSD"
    ICD = "ICD"
    SCD = "SCD"


# ── Data Hierarchy Schemas ─────────────────────────────────────


class DataAttributeSchema(BaseModel):
    """API representation of an IEC 61850 Data Attribute."""

    name: str = Field(description="Attribute name per IEC 61850-7-3")
    data_type: str = Field(description="IEC 61850 basic data type")
    fc: str = Field(description="Functional constraint: ST, MX, CO, CF, SP, DC")
    description: str = Field(description="Engineering description")
    unit: str = Field(default="", description="Engineering unit")


class DataObjectSchema(BaseModel):
    """API representation of an IEC 61850 Data Object."""

    name: str = Field(description="DO name per IEC 61850-7-4 (e.g., 'Pos', 'TotW')")
    cdc: str = Field(description="Common Data Class: SPC, DPC, MV, WYE, INS, etc.")
    attributes: list[DataAttributeSchema] = Field(default_factory=list)
    description: str = Field(default="")


class LogicalNodeSchema(BaseModel):
    """API representation of an IEC 61850 Logical Node."""

    class_name: str = Field(description="LN class (e.g., 'XCBR', 'MMXU', 'WTUR')")
    instance: int = Field(description="Instance number")
    full_name: str = Field(description="Class + instance, e.g. 'XCBR1'")
    category: str = Field(description="LN group: P, M, X, G, W, L")
    data_objects: list[DataObjectSchema] = Field(default_factory=list)
    description: str = Field(default="")


class LogicalDeviceSchema(BaseModel):
    """API representation of an IEC 61850 Logical Device."""

    inst: str = Field(description="LD instance name (e.g., 'LD_Protection')")
    logical_nodes: list[LogicalNodeSchema] = Field(default_factory=list)
    description: str = Field(default="")


class PhysicalDeviceSchema(BaseModel):
    """API representation of an IEC 61850 Physical Device (IED)."""

    name: str = Field(description="IED instance name")
    equipment_type: str = Field(description="Device type")
    manufacturer: str = Field(description="IED manufacturer")
    model: str = Field(description="IED model")
    logical_devices: list[LogicalDeviceSchema] = Field(default_factory=list)
    ip_address: str = Field(default="", description="MMS station bus IP")
    description: str = Field(default="")


# ── GOOSE Schemas ──────────────────────────────────────────────


class GOOSEControlBlockSchema(BaseModel):
    """API representation of a GOOSE Control Block."""

    name: str = Field(description="GoCB name")
    app_id: str = Field(description="GOOSE Application ID hex")
    go_id: str = Field(description="GOOSE identifier string")
    dataset_name: str = Field(description="Reference to dataset")
    mac_address: str = Field(description="Multicast destination MAC")
    vlan_id: int = Field(description="VLAN ID for traffic separation")
    min_time_ms: int = Field(description="Minimum retransmission interval [ms]")
    max_time_ms: int = Field(description="Maximum retransmission interval [ms]")
    description: str = Field(default="")


class DatasetMemberSchema(BaseModel):
    """API representation of a Dataset member reference."""

    reference: str = Field(description="Full IEC 61850 object reference")
    fc: str = Field(description="Functional constraint")


class DatasetSchema(BaseModel):
    """API representation of an IEC 61850 Dataset."""

    name: str = Field(description="Dataset name")
    members: list[DatasetMemberSchema] = Field(default_factory=list)
    description: str = Field(default="")


# ── SCL Generation Schemas ─────────────────────────────────────


class SCLGenerateRequest(BaseModel):
    """Request to generate an SCL file."""

    file_type: SCLFileType = Field(description="SSD, ICD, or SCD")
    device_name: str | None = Field(
        default=None,
        description="IED name for ICD files. None for SSD/SCD.",
    )


class SCLFileResponse(BaseModel):
    """Response containing a generated SCL file."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    file_type: str
    name: str
    xml_content: str
    device_name: str | None
    created_at: datetime


# ── Device Registry Schemas ────────────────────────────────────


class IEC61850DeviceResponse(BaseModel):
    """Summary response for an IEC 61850 device."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    equipment_type: str
    manufacturer: str
    model: str
    ip_address: str
    description: str
    created_at: datetime


class SubstationSummaryResponse(BaseModel):
    """Summary of the entire IEC 61850 substation configuration."""

    total_devices: int = Field(description="Total number of IEDs")
    total_logical_nodes: int = Field(description="Total LN count across all devices")
    protection_ieds: int = Field(description="Number of protection IEDs")
    measurement_ieds: int = Field(description="Number of measurement IEDs")
    bay_controllers: int = Field(description="Number of bay controllers")
    wtg_controllers: int = Field(description="Number of WTG controllers")
    goose_control_blocks: int = Field(description="Number of GOOSE publishers")
    devices: list[PhysicalDeviceSchema] = Field(description="All devices")


# ── GOOSE Fault Simulation Schemas ────────────────────────────────


class FaultScenarioRequest(BaseModel):
    """Request to run a GOOSE protection fault simulation."""

    fault_type: str = Field(
        description="Fault type: busbar_overcurrent, transformer_differential, cable_earth_fault"
    )


class ProtectionEventSchema(BaseModel):
    """A single event in the protection fault clearance timeline."""

    event_type: str = Field(description="Event type identifier")
    timestamp_ms: float = Field(description="Time since fault inception [ms]")
    description: str = Field(description="Human-readable event description")
    ied_name: str = Field(default="", description="IED involved in this event")


class GOOSEMessageSchema(BaseModel):
    """API representation of an IEC 61850-8-1 GOOSE PDU."""

    gocb_ref: str = Field(description="GOOSE Control Block reference")
    dat_set: str = Field(description="Dataset reference")
    go_id: str = Field(description="GOOSE identifier string")
    st_num: int = Field(description="State number (increments on state change)")
    sq_num: int = Field(description="Sequence number (increments on retransmission)")
    all_data: dict[str, bool] = Field(description="Trip signal values")
    timestamp: datetime = Field(description="UTC timestamp of state change")
    app_id: str = Field(description="GOOSE Application ID (hex)")
    mac_address: str = Field(description="Multicast destination MAC")
    vlan_id: int = Field(description="VLAN ID for GOOSE traffic")


class ComplianceCheckSchema(BaseModel):
    """IEC compliance verification result."""

    goose_latency_ms: float = Field(description="GOOSE publisher→subscriber latency [ms]")
    goose_max_allowed_ms: float = Field(description="IEC 61850-8-1 maximum [ms]")
    goose_compliant: bool = Field(description="True if latency < 4 ms")
    total_clearance_ms: float = Field(description="Total fault clearance time [ms]")
    clearance_max_allowed_ms: float = Field(description="IEC 62271-100 maximum [ms]")
    clearance_compliant: bool = Field(description="True if clearance < 80 ms")


class FaultSimulationResponse(BaseModel):
    """Complete response from a GOOSE protection fault simulation."""

    fault_type: str = Field(description="Fault type simulated")
    location: str = Field(description="Fault location")
    fault_current_pu: float = Field(description="Fault current [pu of nominal]")
    protection_function: str = Field(description="Primary protection function")
    description: str = Field(description="Scenario description")
    events: list[ProtectionEventSchema] = Field(description="Protection timeline")
    goose_messages: list[GOOSEMessageSchema] = Field(description="GOOSE PDUs published")
    compliance: ComplianceCheckSchema = Field(description="IEC compliance check")
    retransmission_schedule_ms: list[float] = Field(
        description="GOOSE retransmission timestamps [ms] after initial publish"
    )


class RetransmissionRequest(BaseModel):
    """Request to calculate a GOOSE retransmission schedule."""

    min_time_ms: int = Field(default=2, ge=1, description="Minimum retransmission interval [ms]")
    max_time_ms: int = Field(default=1000, ge=1, description="Maximum retransmission interval [ms]")
    num_retransmissions: int = Field(
        default=10, ge=1, le=50, description="Number of retransmissions to calculate"
    )


class RetransmissionResponse(BaseModel):
    """GOOSE retransmission schedule per IEC 61850-8-1 §15.2.2."""

    min_time_ms: int = Field(description="Initial interval T0 [ms]")
    max_time_ms: int = Field(description="Maximum interval [ms]")
    num_retransmissions: int = Field(description="Number of retransmissions")
    schedule_ms: list[float] = Field(description="Cumulative retransmission timestamps [ms]")
    intervals_ms: list[float] = Field(description="Individual interval durations [ms]")


class FaultScenarioSummary(BaseModel):
    """Summary of an available fault scenario."""

    fault_type: str = Field(description="Fault type identifier")
    description: str = Field(description="Scenario description")


# ── Historian Schemas ───────────────────────────────────────────────


class HistorianTagMetaSchema(BaseModel):
    """Engineering metadata for a single SCADA historian tag."""

    tag: str = Field(description="IEC 61400-25 / IEC 61850 tag identifier")
    display_name: str = Field(description="Human-readable label for UI")
    description: str = Field(description="Full engineering description")
    unit: str = Field(description="Engineering unit (MW, MVAR, pu, Hz, etc.)")
    nominal: float = Field(description="Typical operating value")
    range_min: float = Field(description="Physical minimum (hard limit)")
    range_max: float = Field(description="Physical maximum (hard limit)")


class TimeSeriesPointSchema(BaseModel):
    """A single timestamp-value pair."""

    timestamp_iso: str = Field(description="ISO-8601 UTC timestamp")
    value: float = Field(description="Engineering value in tag's unit")


class TagTimeSeriesSchema(BaseModel):
    """Time-series response for one historian tag."""

    tag: str = Field(description="Tag identifier")
    display_name: str = Field(description="Human-readable label")
    unit: str = Field(description="Engineering unit")
    description: str = Field(description="Tag description")
    nominal: float = Field(description="Nominal operating value")
    range_min: float = Field(description="Hard minimum")
    range_max: float = Field(description="Hard maximum")
    resolution: str = Field(description="Sample interval (1min, 5min, 15min, 1hr)")
    points: list[TimeSeriesPointSchema] = Field(description="Ordered time-series data")


class HistorianQueryRequest(BaseModel):
    """Request body for a multi-tag historian query."""

    tags: list[str] = Field(
        description="List of tag identifiers to query",
        min_length=1,
        max_length=10,
    )
    range_hours: int = Field(
        default=4,
        ge=1,
        le=168,
        description="Time window in hours (1, 4, 24, or 168 = 7 days)",
    )
    resolution: str = Field(
        default="5min",
        description="Sample interval: 1min, 5min, 15min, 1hr",
    )
    now_epoch_minutes: int = Field(
        default=0,
        ge=0,
        description=(
            "Minutes from simulation epoch (2026-01-01T00:00:00Z). "
            "Used to shift the data window for 'live' appearance."
        ),
    )


class HistorianQueryResponse(BaseModel):
    """Response for a multi-tag historian query."""

    range_hours: int = Field(description="Requested time window [hours]")
    resolution: str = Field(description="Sample interval used")
    series: list[TagTimeSeriesSchema] = Field(description="One time-series per requested tag")


class HistorianLatestResponse(BaseModel):
    """Latest values snapshot for all historian tags."""

    values: dict[str, float] = Field(
        description="Mapping of tag → current value in engineering units"
    )

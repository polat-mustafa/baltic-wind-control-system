"""
Pydantic schemas for P3 SCADA & IEC 61850 substation automation.

Request and response models for the IEC 61850 device registry,
logical node queries, GOOSE control blocks, and SCL file generation.
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

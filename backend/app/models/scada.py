"""
SCADA and IEC 61850 device registry database models (P3).

Tables
------
iec61850_device : Physical device (IED) registry
iec61850_logical_node : Logical node instances per device
goose_control_block : GOOSE publisher configuration
scl_file : Generated SCL file storage (SSD/ICD/SCD)
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class IEC61850Device(Base):
    """IEC 61850 Physical Device (IED) registry entry.

    One row per IED in the substation. Baltic Wind Alpha has 37 devices:
    2 OSS IEDs (protection + measurement) + 1 bay controller + 34 WTG controllers.
    """

    __tablename__ = "iec61850_device"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        comment="IED instance name, e.g. 'OSS_PROT_IED01', 'WTG_01'",
    )
    equipment_type: Mapped[str] = mapped_column(
        String(30),
        comment="Device type: protection_ied, wtg_controller, etc.",
    )
    manufacturer: Mapped[str] = mapped_column(
        String(50),
        comment="IED manufacturer, e.g. 'ABB', 'Vestas'",
    )
    model: Mapped[str] = mapped_column(
        String(50),
        comment="IED model, e.g. 'REL670', 'V236-15.0'",
    )
    ip_address: Mapped[str] = mapped_column(
        String(15),
        comment="MMS station bus IP address",
    )
    description: Mapped[str] = mapped_column(
        Text,
        default="",
        comment="Human-readable engineering description",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    logical_nodes: Mapped[list[IEC61850LogicalNode]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan",
    )
    goose_control_blocks: Mapped[list[GOOSEControlBlockRecord]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan",
    )


class IEC61850LogicalNode(Base):
    """IEC 61850 Logical Node instance within a device.

    Stores the LN class, instance number, and parent logical device name.
    Data objects are defined in the code model (iec61850_model.py) and
    generated into SCL on demand — they are NOT persisted individually
    to avoid a 10,000+ row explosion.
    """

    __tablename__ = "iec61850_logical_node"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("iec61850_device.id", ondelete="CASCADE"),
    )
    logical_device_inst: Mapped[str] = mapped_column(
        String(30),
        comment="Parent LD instance, e.g. 'LD_Protection', 'LD_Turbine'",
    )
    ln_class: Mapped[str] = mapped_column(
        String(10),
        comment="IEC 61850-7-4 LN class: XCBR, MMXU, WTUR, etc.",
    )
    ln_instance: Mapped[int] = mapped_column(
        Integer,
        comment="Instance number: 1, 2, ...",
    )
    category: Mapped[str] = mapped_column(
        String(5),
        comment="LN group category: P, M, X, G, W, L",
    )
    description: Mapped[str] = mapped_column(
        Text,
        default="",
        comment="Human-readable engineering description",
    )

    # Relationships
    device: Mapped[IEC61850Device] = relationship(back_populates="logical_nodes")


class GOOSEControlBlockRecord(Base):
    """GOOSE Control Block configuration for a device.

    Persists GOOSE publisher settings for each IED. GOOSE operates at
    Layer 2 Ethernet (no IP routing), achieving < 4 ms latency for
    protection trip signals.
    """

    __tablename__ = "goose_control_block"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("iec61850_device.id", ondelete="CASCADE"),
    )
    name: Mapped[str] = mapped_column(
        String(50),
        comment="GoCB name, e.g. 'gcb_trip'",
    )
    app_id: Mapped[str] = mapped_column(
        String(10),
        comment="GOOSE Application ID, e.g. '0x0001'",
    )
    go_id: Mapped[str] = mapped_column(
        String(50),
        comment="GOOSE identifier, e.g. 'OSS_220kV_BB_TRIP'",
    )
    dataset_name: Mapped[str] = mapped_column(
        String(50),
        comment="Reference to dataset name",
    )
    mac_address: Mapped[str] = mapped_column(
        String(17),
        comment="Multicast destination MAC per IEC 61850-8-1",
    )
    vlan_id: Mapped[int] = mapped_column(
        Integer,
        comment="VLAN for GOOSE traffic separation",
    )
    min_time_ms: Mapped[int] = mapped_column(
        Integer,
        default=2,
        comment="Minimum retransmission interval [ms]",
    )
    max_time_ms: Mapped[int] = mapped_column(
        Integer,
        default=1000,
        comment="Maximum retransmission interval [ms]",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    device: Mapped[IEC61850Device] = relationship(
        back_populates="goose_control_blocks",
    )


class SCLFile(Base):
    """Generated SCL file record.

    Stores the file type (SSD/ICD/SCD), the generated XML content,
    and metadata. Typical file sizes: 5-200 KB.
    """

    __tablename__ = "scl_file"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    file_type: Mapped[str] = mapped_column(
        String(3),
        comment="SCL file type: 'SSD', 'ICD', or 'SCD'",
    )
    name: Mapped[str] = mapped_column(
        String(100),
        comment="File name, e.g. 'Baltic_Wind_Alpha.scd'",
    )
    xml_content: Mapped[str] = mapped_column(
        Text,
        comment="Full SCL XML content",
    )
    device_name: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="IED name for ICD files, NULL for SSD/SCD",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

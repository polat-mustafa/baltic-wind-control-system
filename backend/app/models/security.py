"""
SQLAlchemy models for Cybersecurity / IEC 62443 — M07.

Implements Purdue Model (ISA-95) zone segmentation and security event logging.
"""

from __future__ import annotations

import uuid as _uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class SecurityZone(Base):
    """
    IEC 62443 / ISA-95 Purdue Model security zone.

    Levels
    ------
    0  Physical process (turbine mechanical, sensors)
    1  Basic control (bay controllers, protection relays)
    2  Supervisory control (SCADA, HMI, DCS)
    3  Site operations (historian, asset management, engineering workstations)
    4  Business network (enterprise, ERP, remote access)
    5  External network (internet, cloud, remote operations centre)

    Baltic Wind OT/IT boundary: between Level 3 and Level 4.
    DMZ (demilitarised zone) sits between Level 3 and Level 4.
    """

    __tablename__ = "security_zone"

    id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-5 Purdue level
    description: Mapped[str] = mapped_column(Text, nullable=False)
    security_level_target: Mapped[str] = mapped_column(
        String(10), default="SL-2"
    )  # IEC 62443 SL-0 to SL-4
    color: Mapped[str] = mapped_column(String(20), default="#4CAF50")  # UI display color


class SecurityConduit(Base):
    """
    A data path between two security zones (IEC 62443 conduit).

    Each conduit has allowed protocols, encryption requirements,
    and firewall rules. Conduits map to physical/logical connections:
    fiber optic, copper, wireless, VPN tunnel.
    """

    __tablename__ = "security_conduit"

    id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    source_zone_name: Mapped[str] = mapped_column(String(100), nullable=False)
    dest_zone_name: Mapped[str] = mapped_column(String(100), nullable=False)
    allowed_protocols: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # JSON list as text: ["IEC 61850", "OPC-UA"]
    encryption: Mapped[str] = mapped_column(
        String(50), default="TLS 1.3"
    )  # NONE / TLS 1.3 / IPSec / OPC-UA SecureChannel
    firewall_rules: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    bidirectional: Mapped[bool] = mapped_column(Boolean, default=False)
    criticality: Mapped[str] = mapped_column(String(20), default="HIGH")  # LOW/MEDIUM/HIGH


class SecurityEvent(Base):
    """
    Security event log — TimescaleDB hypertable.

    Alembic migration must call:
        SELECT create_hypertable('security_event', 'timestamp_utc');

    Records authentication failures, blocked commands, anomaly detections,
    and simulated attack scenarios.
    """

    __tablename__ = "security_event"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp_utc: Mapped[datetime] = mapped_column(nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # AUTH_FAIL / BLOCKED_CMD / ANOMALY / REPLAY_ATTACK / SCAN / BREACH
    source_zone: Mapped[str] = mapped_column(String(100), nullable=False)
    source_ip: Mapped[str] = mapped_column(String(45), nullable=False)  # IPv4 or IPv6
    target_zone: Mapped[str] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    blocked: Mapped[bool] = mapped_column(Boolean, default=True)
    severity: Mapped[str] = mapped_column(String(10), default="MEDIUM")  # LOW/MEDIUM/HIGH/CRITICAL
    scenario_id: Mapped[str] = mapped_column(
        String(50), nullable=True
    )  # Links to simulated attack scenario


class ComplianceCheck(Base):
    """
    IEC 62443 compliance checklist item.

    One row per requirement; updated manually or by automated scan.
    """

    __tablename__ = "compliance_check"

    id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid.uuid4
    )
    requirement_id: Mapped[str] = mapped_column(
        String(30), nullable=False, unique=True
    )  # e.g. "SR-1.1", "FR-2"
    security_level: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # SL-1 / SL-2 / SL-3 / SL-4
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    compliant: Mapped[bool] = mapped_column(Boolean, default=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=True)
    risk_score: Mapped[float] = mapped_column(Float, default=5.0)  # 1.0 (low) - 10.0 (critical)

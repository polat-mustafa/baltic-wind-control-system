"""P3 IEC 61850 Device Registry & SCADA: iec61850_device,
iec61850_logical_node, goose_control_block, scl_file

Creates the tables for Phase 3 — SCADA & IEC 61850 Substation Automation:
- iec61850_device: Physical device (IED) registry
- iec61850_logical_node: Logical node instances per device
- goose_control_block: GOOSE publisher configuration
- scl_file: Generated SCL file storage (SSD/ICD/SCD)

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-02-25 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4d5e6f7a8b9"
down_revision: str | None = "b3c4d5e6f7a8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create P3 SCADA tables."""
    # ── iec61850_device ──────────────────────────────────────────
    op.create_table(
        "iec61850_device",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "name",
            sa.String(50),
            unique=True,
            nullable=False,
            comment="IED instance name, e.g. 'OSS_PROT_IED01', 'WTG_01'",
        ),
        sa.Column(
            "equipment_type",
            sa.String(30),
            nullable=False,
            comment="Device type: protection_ied, wtg_controller, etc.",
        ),
        sa.Column(
            "manufacturer",
            sa.String(50),
            nullable=False,
            comment="IED manufacturer, e.g. 'ABB', 'Vestas'",
        ),
        sa.Column(
            "model",
            sa.String(50),
            nullable=False,
            comment="IED model, e.g. 'REL670', 'V236-15.0'",
        ),
        sa.Column(
            "ip_address",
            sa.String(15),
            nullable=False,
            comment="MMS station bus IP address",
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=False,
            server_default="",
            comment="Human-readable engineering description",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )

    # ── iec61850_logical_node ────────────────────────────────────
    op.create_table(
        "iec61850_logical_node",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "device_id",
            sa.Uuid(),
            sa.ForeignKey("iec61850_device.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "logical_device_inst",
            sa.String(30),
            nullable=False,
            comment="Parent LD instance, e.g. 'LD_Protection', 'LD_Turbine'",
        ),
        sa.Column(
            "ln_class",
            sa.String(10),
            nullable=False,
            comment="IEC 61850-7-4 LN class: XCBR, MMXU, WTUR, etc.",
        ),
        sa.Column(
            "ln_instance",
            sa.Integer(),
            nullable=False,
            comment="Instance number: 1, 2, ...",
        ),
        sa.Column(
            "category",
            sa.String(5),
            nullable=False,
            comment="LN group category: P, M, X, G, W, L",
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=False,
            server_default="",
            comment="Human-readable engineering description",
        ),
    )

    # ── goose_control_block ──────────────────────────────────────
    op.create_table(
        "goose_control_block",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "device_id",
            sa.Uuid(),
            sa.ForeignKey("iec61850_device.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(50),
            nullable=False,
            comment="GoCB name, e.g. 'gcb_trip'",
        ),
        sa.Column(
            "app_id",
            sa.String(10),
            nullable=False,
            comment="GOOSE Application ID, e.g. '0x0001'",
        ),
        sa.Column(
            "go_id",
            sa.String(50),
            nullable=False,
            comment="GOOSE identifier, e.g. 'OSS_220kV_BB_TRIP'",
        ),
        sa.Column(
            "dataset_name",
            sa.String(50),
            nullable=False,
            comment="Reference to dataset name",
        ),
        sa.Column(
            "mac_address",
            sa.String(17),
            nullable=False,
            comment="Multicast destination MAC per IEC 61850-8-1",
        ),
        sa.Column(
            "vlan_id",
            sa.Integer(),
            nullable=False,
            comment="VLAN for GOOSE traffic separation",
        ),
        sa.Column(
            "min_time_ms",
            sa.Integer(),
            nullable=False,
            server_default="2",
            comment="Minimum retransmission interval [ms]",
        ),
        sa.Column(
            "max_time_ms",
            sa.Integer(),
            nullable=False,
            server_default="1000",
            comment="Maximum retransmission interval [ms]",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )

    # ── scl_file ─────────────────────────────────────────────────
    op.create_table(
        "scl_file",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "file_type",
            sa.String(3),
            nullable=False,
            comment="SCL file type: 'SSD', 'ICD', or 'SCD'",
        ),
        sa.Column(
            "name",
            sa.String(100),
            nullable=False,
            comment="File name, e.g. 'Baltic_Wind_Alpha.scd'",
        ),
        sa.Column(
            "xml_content",
            sa.Text(),
            nullable=False,
            comment="Full SCL XML content",
        ),
        sa.Column(
            "device_name",
            sa.String(50),
            nullable=True,
            comment="IED name for ICD files, NULL for SSD/SCD",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Drop P3 SCADA tables."""
    op.drop_table("scl_file")
    op.drop_table("goose_control_block")
    op.drop_table("iec61850_logical_node")
    op.drop_table("iec61850_device")

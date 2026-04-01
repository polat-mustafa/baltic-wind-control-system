"""
Pydantic schemas for the OPC-UA server REST API — M03.

These schemas expose server status, address-space browsing, and restart
control via HTTP. The actual OPC-UA communication happens on port 4840
using the binary UA protocol (not HTTP).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class OPCUANodeInfo(BaseModel):
    """A single node in the OPC-UA address space."""

    node_id: str = Field(description="OPC-UA NodeId string, e.g. 'ns=2;s=WindFarm.WTG01.Power'")
    browse_name: str = Field(description="Human-readable node name")
    node_class: str = Field(description="Variable / Object / Method")
    data_type: str | None = Field(
        default=None, description="UA data type, e.g. 'Double', 'Boolean'"
    )
    value: float | bool | str | None = Field(default=None, description="Current tag value")
    children: list[OPCUANodeInfo] = Field(default_factory=list)

    model_config = {"arbitrary_types_allowed": True}


class OPCUAStatusResponse(BaseModel):
    """Current OPC-UA server runtime status."""

    running: bool = Field(description="True when the server is accepting connections")
    endpoint: str = Field(
        description="OPC-UA endpoint URL, e.g. 'opc.tcp://0.0.0.0:4840/baltic-wind/'"
    )
    connected_clients: int = Field(description="Number of currently connected UA clients")
    node_count: int = Field(description="Total nodes in the address space")
    started_at: datetime | None = Field(
        default=None, description="UTC time the server last started"
    )
    last_update: datetime | None = Field(
        default=None,
        description="UTC time of last tag-value push into the address space",
    )


class OPCUASubscriptionRequest(BaseModel):
    """Request to create a monitored item subscription (informational schema)."""

    node_ids: list[str] = Field(description="List of NodeId strings to monitor")
    publishing_interval_ms: int = Field(
        default=1000,
        ge=100,
        le=60000,
        description="Publishing interval in ms (100 ms - 60 s)",
    )
    queue_size: int = Field(
        default=10, ge=1, le=100, description="Per-item notification queue depth"
    )


class OPCUAAddressSpaceResponse(BaseModel):
    """Top-level address-space dump as a JSON tree."""

    endpoint: str
    root_nodes: list[OPCUANodeInfo]
    total_nodes: int

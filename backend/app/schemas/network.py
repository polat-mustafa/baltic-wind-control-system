"""
Pydantic schemas for Communication Network Architecture — M15.

IEC 62541 OPC-UA unified architecture:
  Server: OSS SCADA gateway exposes all WTG data as OPC-UA nodes
  Security: SignAndEncrypt, Basic256Sha256 (no None mode in production)
  Namespace: urn:baltic-wind:scada

Communication network layers (IEC 61850-90-5 + NERC CIP):
  Level 0 -- Field (WTG IEC 61850 bay units, bay controllers, protection IEDs)
  Level 1 -- Station (OSS LAN, IEC 61850 GOOSE/MMS, 100 Mbps)
  Level 2 -- Remote (MPLS WAN or microwave, onshore SCADA <- 45 km cable route)
  Level 3 -- Corporate (historian, reporting, DR, MMS connectivity to PSE)

Latency requirements (IEC 61850 performance classes):
  GOOSE (trip): Class P3 -- 4 ms end-to-end
  Measurements: Class P2 -- 100 ms update cycle
  SCADA polling: Class P1 -- 1 s update cycle
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class NetworkLayer(str, Enum):  # noqa: UP042
    """OSI / Purdue network levels in the OT communication hierarchy."""

    FIELD = "FIELD"  # Level 0 -- device bus (IEC 61850 process bus)
    STATION = "STATION"  # Level 1 -- substation LAN (IEC 61850 station bus)
    WAN = "WAN"  # Level 2 -- OSS <-> onshore SCADA
    CORPORATE = "CORPORATE"  # Level 3 -- onshore corporate / PSE interface


class LinkType(str, Enum):  # noqa: UP042
    """Physical or logical link technology."""

    FIBRE_OPTIC = "FIBRE_OPTIC"
    MPLS = "MPLS"
    MICROWAVE = "MICROWAVE"
    ETHERNET = "ETHERNET"


class NetworkNode(BaseModel):
    """A node in the communication network topology."""

    node_id: str
    name: str
    layer: NetworkLayer
    protocol: str = Field(description="Primary protocol (IEC 61850 / OPC-UA / DNP3)")
    redundant: bool = Field(description="True if this node has hot-standby redundancy")
    ip_subnet: str = Field(description="IP subnet (e.g., '10.0.1.0/24')")


class NetworkLink(BaseModel):
    """A communication link between two nodes."""

    link_id: str
    from_node: str
    to_node: str
    link_type: LinkType
    bandwidth_mbps: float
    latency_ms: float
    redundant: bool
    encryption: str = Field(description="TLS 1.3 / IPsec / None")


class NetworkTopologyResponse(BaseModel):
    """Complete communication network topology."""

    nodes: list[NetworkNode]
    links: list[NetworkLink]
    node_count: int
    link_count: int
    assessment: str


class OPCUANodeDetail(BaseModel):
    """Single OPC-UA node in the wind farm address space."""

    node_id: str = Field(description="OPC-UA NodeId (e.g., 'ns=2;i=1001')")
    browse_name: str
    data_type: str
    description: str
    update_interval_ms: int
    turbine_id: str | None = None


class OPCUANamespaceResponse(BaseModel):
    """OPC-UA namespace summary for the wind farm SCADA gateway."""

    server_url: str
    security_policy: str
    namespace_uri: str
    node_count: int
    nodes: list[OPCUANodeDetail]
    performance_class: str = Field(description="IEC 61850 performance class (P1/P2/P3)")


class LatencyBudgetResponse(BaseModel):
    """End-to-end latency budget for a given message path."""

    path_description: str
    performance_class: str
    required_latency_ms: float
    budget_breakdown: dict[str, float] = Field(
        description="Latency components: switch_hop_ms, fibre_propagation_ms, processing_ms",
    )
    total_latency_ms: float
    margin_ms: float
    compliant: bool

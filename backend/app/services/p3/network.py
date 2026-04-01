"""
Communication Network Architecture service — M15.

Architecture overview
---------------------
Baltic Wind Alpha uses a 3-tier OT network following IEC 61850 / IEC 62443:

  Tier 1 — Field Bus (WTGs):
    34 turbines, each with IEC 61850 IED (bay unit + protection relay)
    Ring topology on OSS internal LAN — 100 Mbps managed Ethernet switches
    GOOSE multicast for protection (Class P3: 4 ms), MMS for measurements (P2: 100 ms)

  Tier 2 — Station Bus (OSS):
    Offshore substation LAN: three managed switches (ring) with redundant uplinks
    Protocols: IEC 61850-8-1 MMS, GOOSE, IEC 61850-9-2 sampled values
    OPC-UA server on OSS gateway: exposes all 34 WTGs + 2 transformers as UA nodes
    IEC 62443 Zone 2 (OT critical) — Purdue Level 1/2

  Tier 3 — WAN (OSS to Onshore):
    Primary: OPGW fibre in export cable (dedicated to OT) — 10 Gbps, 2 ms propagation
    Secondary: licensed microwave (MW backup) — 100 Mbps, 0.8 ms
    Protocol: MPLS over fibre, IPsec tunnel
    Onshore firewall (IEC 62443 conduit control) separates OT from IT

  Tier 4 — Corporate/PSE:
    Onshore historian (TimescaleDB) receives SCADA data via OPC-UA publisher
    PSE SCADA access via IEC 61968 MMS (read-only — regulatory requirement)
    ENTSO-E reporting interface via SFTP (daily generation reports)

OPC-UA address space
--------------------
Namespace: urn:baltic-wind:scada
Root nodes:
  - WindFarm (Object)
    - WTG-01 ... WTG-34 (Object, one per turbine)
      - ActivePower (Variable, Double, kW, 100 ms update)
      - ReactivePower (Variable, Double, kVAR, 100 ms)
      - RotorSpeed (Variable, Double, rpm, 200 ms)
      - NacelleTemp (Variable, Double, degC, 60 s)
      - OperationalStatus (Variable, Int32, enum, 1 s)
    - GridMeter (Object)
      - ExportPower (Variable, Double, MW, 100 ms)
      - GridVoltage (Variable, Double, kV, 100 ms)
      - GridFrequency (Variable, Double, Hz, 100 ms)
    - BESS (Object — if BESS installed)
      - SOC (Variable, Double, %, 10 s)
      - PowerMW (Variable, Double, MW, 100 ms)
"""

from __future__ import annotations

from typing import Any

# ── Network topology data ─────────────────────────────────────────────────────

_NODES = [
    # Field layer — turbine IEDs (representative: first 3 + placeholder)
    {
        "node_id": "WTG-IED-01",
        "name": "WTG-01 Bay Unit IED",
        "layer": "FIELD",
        "protocol": "IEC 61850 GOOSE/MMS",
        "redundant": False,
        "ip_subnet": "10.0.1.0/24",
    },
    {
        "node_id": "WTG-IED-17",
        "name": "WTG-17 Bay Unit IED (central turbine)",
        "layer": "FIELD",
        "protocol": "IEC 61850 GOOSE/MMS",
        "redundant": False,
        "ip_subnet": "10.0.1.0/24",
    },
    {
        "node_id": "WTG-IED-34",
        "name": "WTG-34 Bay Unit IED",
        "layer": "FIELD",
        "protocol": "IEC 61850 GOOSE/MMS",
        "redundant": False,
        "ip_subnet": "10.0.1.0/24",
    },
    # Station layer — OSS LAN
    {
        "node_id": "OSS-SW-A",
        "name": "OSS LAN Switch A (primary ring)",
        "layer": "STATION",
        "protocol": "IEC 61850 Station Bus",
        "redundant": True,
        "ip_subnet": "10.0.2.0/24",
    },
    {
        "node_id": "OSS-SW-B",
        "name": "OSS LAN Switch B (secondary ring)",
        "layer": "STATION",
        "protocol": "IEC 61850 Station Bus",
        "redundant": True,
        "ip_subnet": "10.0.2.0/24",
    },
    {
        "node_id": "OSS-GW",
        "name": "OSS SCADA Gateway (OPC-UA server)",
        "layer": "STATION",
        "protocol": "OPC-UA UA-TCP:4840 + IEC 61850 MMS",
        "redundant": True,
        "ip_subnet": "10.0.2.0/24",
    },
    {
        "node_id": "OSS-FW",
        "name": "OSS Firewall (OT/WAN boundary)",
        "layer": "STATION",
        "protocol": "IPsec / stateful L4",
        "redundant": True,
        "ip_subnet": "10.0.2.0/24",
    },
    # WAN layer
    {
        "node_id": "WAN-FIBRE",
        "name": "OPGW Fibre Link (OSS to onshore, 45 km)",
        "layer": "WAN",
        "protocol": "MPLS / IP",
        "redundant": True,
        "ip_subnet": "10.0.3.0/30",
    },
    {
        "node_id": "WAN-MW",
        "name": "Microwave Backup Link",
        "layer": "WAN",
        "protocol": "MPLS / IP",
        "redundant": False,
        "ip_subnet": "10.0.3.4/30",
    },
    # Corporate layer — onshore
    {
        "node_id": "ONS-FW",
        "name": "Onshore Firewall (WAN/IT boundary)",
        "layer": "CORPORATE",
        "protocol": "IPsec / stateful L4",
        "redundant": True,
        "ip_subnet": "10.0.4.0/24",
    },
    {
        "node_id": "ONS-SCADA",
        "name": "Onshore SCADA Server (TimescaleDB historian)",
        "layer": "CORPORATE",
        "protocol": "OPC-UA subscriber + PostgreSQL",
        "redundant": True,
        "ip_subnet": "10.0.4.0/24",
    },
    {
        "node_id": "ONS-PSE",
        "name": "PSE SCADA Interface (IEC 61968 MMS read-only)",
        "layer": "CORPORATE",
        "protocol": "IEC 61968 MMS / ICCP",
        "redundant": False,
        "ip_subnet": "10.0.5.0/30",
    },
]

_LINKS = [
    # Field to Station
    {
        "link_id": "L01",
        "from_node": "WTG-IED-01",
        "to_node": "OSS-SW-A",
        "link_type": "FIBRE_OPTIC",
        "bandwidth_mbps": 100.0,
        "latency_ms": 0.5,
        "redundant": False,
        "encryption": "None (physically secured)",
    },
    {
        "link_id": "L02",
        "from_node": "WTG-IED-17",
        "to_node": "OSS-SW-A",
        "link_type": "FIBRE_OPTIC",
        "bandwidth_mbps": 100.0,
        "latency_ms": 0.3,
        "redundant": False,
        "encryption": "None (physically secured)",
    },
    {
        "link_id": "L03",
        "from_node": "WTG-IED-34",
        "to_node": "OSS-SW-B",
        "link_type": "FIBRE_OPTIC",
        "bandwidth_mbps": 100.0,
        "latency_ms": 0.5,
        "redundant": False,
        "encryption": "None (physically secured)",
    },
    # OSS ring
    {
        "link_id": "L04",
        "from_node": "OSS-SW-A",
        "to_node": "OSS-SW-B",
        "link_type": "ETHERNET",
        "bandwidth_mbps": 1000.0,
        "latency_ms": 0.1,
        "redundant": True,
        "encryption": "MACsec",
    },
    {
        "link_id": "L05",
        "from_node": "OSS-SW-A",
        "to_node": "OSS-GW",
        "link_type": "ETHERNET",
        "bandwidth_mbps": 1000.0,
        "latency_ms": 0.1,
        "redundant": True,
        "encryption": "MACsec",
    },
    {
        "link_id": "L06",
        "from_node": "OSS-GW",
        "to_node": "OSS-FW",
        "link_type": "ETHERNET",
        "bandwidth_mbps": 1000.0,
        "latency_ms": 0.1,
        "redundant": True,
        "encryption": "TLS 1.3",
    },
    # WAN
    {
        "link_id": "L07",
        "from_node": "OSS-FW",
        "to_node": "WAN-FIBRE",
        "link_type": "FIBRE_OPTIC",
        "bandwidth_mbps": 10000.0,
        "latency_ms": 0.225,  # 45 km * 5 us/km propagation delay
        "redundant": True,
        "encryption": "IPsec AES-256",
    },
    {
        "link_id": "L08",
        "from_node": "OSS-FW",
        "to_node": "WAN-MW",
        "link_type": "MICROWAVE",
        "bandwidth_mbps": 100.0,
        "latency_ms": 0.15,
        "redundant": False,
        "encryption": "IPsec AES-256",
    },
    # Onshore
    {
        "link_id": "L09",
        "from_node": "WAN-FIBRE",
        "to_node": "ONS-FW",
        "link_type": "FIBRE_OPTIC",
        "bandwidth_mbps": 10000.0,
        "latency_ms": 0.1,
        "redundant": True,
        "encryption": "IPsec AES-256",
    },
    {
        "link_id": "L10",
        "from_node": "ONS-FW",
        "to_node": "ONS-SCADA",
        "link_type": "ETHERNET",
        "bandwidth_mbps": 1000.0,
        "latency_ms": 0.1,
        "redundant": True,
        "encryption": "TLS 1.3",
    },
    {
        "link_id": "L11",
        "from_node": "ONS-SCADA",
        "to_node": "ONS-PSE",
        "link_type": "FIBRE_OPTIC",
        "bandwidth_mbps": 100.0,
        "latency_ms": 1.0,
        "redundant": False,
        "encryption": "TLS 1.3",
    },
]

# ── OPC-UA address space ──────────────────────────────────────────────────────

_SERVER_URL = "opc.tcp://10.0.2.10:4840/baltic-wind/"
_NAMESPACE_URI = "urn:baltic-wind:scada"
_SECURITY_POLICY = "Basic256Sha256 / SignAndEncrypt"

# Sample nodes: one measurement per turbine category + grid + BESS
_OPCUA_NODES = [
    {
        "node_id": "ns=2;i=1001",
        "browse_name": "WindFarm.WTG01.ActivePower",
        "data_type": "Double",
        "description": "WTG-01 active power output [kW]",
        "update_interval_ms": 100,
        "turbine_id": "WTG-01",
    },
    {
        "node_id": "ns=2;i=1002",
        "browse_name": "WindFarm.WTG01.ReactivePower",
        "data_type": "Double",
        "description": "WTG-01 reactive power output [kVAR]",
        "update_interval_ms": 100,
        "turbine_id": "WTG-01",
    },
    {
        "node_id": "ns=2;i=1003",
        "browse_name": "WindFarm.WTG01.RotorSpeed",
        "data_type": "Double",
        "description": "WTG-01 rotor speed [rpm]",
        "update_interval_ms": 200,
        "turbine_id": "WTG-01",
    },
    {
        "node_id": "ns=2;i=1004",
        "browse_name": "WindFarm.WTG01.NacelleTemp",
        "data_type": "Double",
        "description": "WTG-01 nacelle ambient temperature [degC]",
        "update_interval_ms": 60_000,
        "turbine_id": "WTG-01",
    },
    {
        "node_id": "ns=2;i=1005",
        "browse_name": "WindFarm.WTG01.Status",
        "data_type": "Int32",
        "description": "WTG-01 operational status (IEC 61400-26 enum)",
        "update_interval_ms": 1_000,
        "turbine_id": "WTG-01",
    },
    {
        "node_id": "ns=2;i=2001",
        "browse_name": "WindFarm.GridMeter.ExportPower",
        "data_type": "Double",
        "description": "POC active power export [MW]",
        "update_interval_ms": 100,
        "turbine_id": None,
    },
    {
        "node_id": "ns=2;i=2002",
        "browse_name": "WindFarm.GridMeter.GridVoltage",
        "data_type": "Double",
        "description": "220 kV busbar voltage [kV]",
        "update_interval_ms": 100,
        "turbine_id": None,
    },
    {
        "node_id": "ns=2;i=2003",
        "browse_name": "WindFarm.GridMeter.GridFrequency",
        "data_type": "Double",
        "description": "Grid frequency at POC [Hz]",
        "update_interval_ms": 100,
        "turbine_id": None,
    },
    {
        "node_id": "ns=2;i=3001",
        "browse_name": "WindFarm.BESS.SOC",
        "data_type": "Double",
        "description": "BESS state of charge [%]",
        "update_interval_ms": 10_000,
        "turbine_id": None,
    },
    {
        "node_id": "ns=2;i=3002",
        "browse_name": "WindFarm.BESS.PowerMW",
        "data_type": "Double",
        "description": "BESS active power [MW]; positive = discharge, negative = charge",
        "update_interval_ms": 100,
        "turbine_id": None,
    },
]

# IEC 61850 performance class for OPC-UA updates (P2 = 100 ms for measurements)
_PERF_CLASS = "P2 (100 ms measurement cycle)"

# ── Latency budgets ───────────────────────────────────────────────────────────

_LATENCY_BUDGETS: list[dict[str, Any]] = [
    {
        "path_description": "GOOSE trip: WTG bay IED -> OSS protection relay",
        "performance_class": "P3",
        "required_latency_ms": 4.0,
        "budget_breakdown": {
            "switch_hop_ms": 0.5,
            "fibre_propagation_ms": 0.3,
            "processing_ms": 0.5,
        },
    },
    {
        "path_description": "Measurement update: WTG IED -> OSS SCADA gateway",
        "performance_class": "P2",
        "required_latency_ms": 100.0,
        "budget_breakdown": {
            "switch_hop_ms": 0.5,
            "fibre_propagation_ms": 0.3,
            "processing_ms": 2.0,
        },
    },
    {
        "path_description": "SCADA poll: OSS gateway -> onshore historian (45 km WAN)",
        "performance_class": "P1",
        "required_latency_ms": 1000.0,
        "budget_breakdown": {
            "switch_hop_ms": 2.0,
            "fibre_propagation_ms": 0.225,
            "ipsec_overhead_ms": 1.0,
            "processing_ms": 5.0,
        },
    },
]


# ── Public API ────────────────────────────────────────────────────────────────


def get_network_topology() -> dict[str, Any]:
    """Return the complete communication network topology."""
    total_nodes = len(_NODES)
    total_links = len(_LINKS)
    redundant_links = sum(1 for lnk in _LINKS if lnk["redundant"])
    redundant_nodes = sum(1 for n in _NODES if n["redundant"])

    assessment = (
        f"{total_nodes} nodes, {total_links} links "
        f"({redundant_nodes} redundant nodes, {redundant_links} redundant links). "
        "Primary path: OPGW fibre (OSS->onshore). Backup: licensed microwave. "
        "IEC 62443 SL-2: firewalls at OT/WAN and WAN/IT boundaries."
    )
    return {
        "nodes": _NODES,
        "links": _LINKS,
        "node_count": total_nodes,
        "link_count": total_links,
        "assessment": assessment,
    }


def get_opcua_namespace() -> dict[str, Any]:
    """Return OPC-UA address space summary."""
    # Full farm: 34 turbines x 5 tags + 3 grid + 2 BESS + misc = ~180 nodes
    estimated_total = 34 * 5 + 3 + 2 + 10  # 185 nodes estimated
    return {
        "server_url": _SERVER_URL,
        "security_policy": _SECURITY_POLICY,
        "namespace_uri": _NAMESPACE_URI,
        "node_count": estimated_total,
        "nodes": _OPCUA_NODES,  # sample — not all 185
        "performance_class": _PERF_CLASS,
    }


def get_latency_budget(path_index: int = 0) -> dict[str, Any]:
    """
    Return latency budget for a specific message path.

    path_index: 0=GOOSE, 1=Measurement, 2=SCADA WAN
    """
    path_index = max(0, min(path_index, len(_LATENCY_BUDGETS) - 1))
    budget = _LATENCY_BUDGETS[path_index].copy()
    total = sum(budget["budget_breakdown"].values())
    margin = budget["required_latency_ms"] - total
    budget["total_latency_ms"] = round(total, 3)
    budget["margin_ms"] = round(margin, 3)
    budget["compliant"] = margin >= 0.0
    return budget

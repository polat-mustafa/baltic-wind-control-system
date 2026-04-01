"""
Tests for M15 Communication Network Architecture.

Covers:
- Topology has all required tiers (FIELD/STATION/WAN/CORPORATE)
- Redundant links and nodes identified correctly
- OPC-UA namespace has valid nodes with required fields
- Latency budgets comply with IEC 61850 performance classes
- GOOSE path P3 within 4 ms, WAN path P1 within 1000 ms
"""

from __future__ import annotations

from app.services.p3.network import (
    get_latency_budget,
    get_network_topology,
    get_opcua_namespace,
)

# ── Network Topology ───────────────────────────────────────────────────────────


class TestNetworkTopology:
    """Network node and link validation."""

    def test_topology_has_nodes_and_links(self):
        result = get_network_topology()
        assert result["node_count"] > 0
        assert result["link_count"] > 0

    def test_node_count_matches_list(self):
        result = get_network_topology()
        assert result["node_count"] == len(result["nodes"])

    def test_link_count_matches_list(self):
        result = get_network_topology()
        assert result["link_count"] == len(result["links"])

    def test_all_network_layers_represented(self):
        result = get_network_topology()
        layers = {n["layer"] for n in result["nodes"]}
        assert "FIELD" in layers
        assert "STATION" in layers
        assert "WAN" in layers
        assert "CORPORATE" in layers

    def test_nodes_have_required_fields(self):
        result = get_network_topology()
        for node in result["nodes"]:
            assert "node_id" in node
            assert "name" in node
            assert "layer" in node
            assert "protocol" in node
            assert "redundant" in node
            assert "ip_subnet" in node

    def test_links_have_required_fields(self):
        result = get_network_topology()
        for link in result["links"]:
            assert "link_id" in link
            assert "from_node" in link
            assert "to_node" in link
            assert "bandwidth_mbps" in link
            assert "latency_ms" in link
            assert "redundant" in link
            assert "encryption" in link

    def test_wan_link_exists(self):
        """OPGW fibre or microwave WAN link must exist."""
        result = get_network_topology()
        wan_links = [
            lnk
            for lnk in result["links"]
            if lnk["link_type"] in ("FIBRE_OPTIC", "MICROWAVE")
            and any(
                n["layer"] == "WAN"
                for n in result["nodes"]
                if n["node_id"] in (lnk["from_node"], lnk["to_node"])
            )
        ]
        assert len(wan_links) > 0

    def test_redundant_nodes_exist(self):
        """Critical station and corporate nodes should have redundancy."""
        result = get_network_topology()
        redundant = [n for n in result["nodes"] if n["redundant"]]
        assert len(redundant) > 0

    def test_assessment_non_empty(self):
        result = get_network_topology()
        assert len(result["assessment"]) > 0

    def test_link_latencies_positive(self):
        result = get_network_topology()
        for link in result["links"]:
            assert link["latency_ms"] > 0.0

    def test_wan_link_has_encryption(self):
        """WAN links must use IPsec — IEC 62443 conduit requirement."""
        result = get_network_topology()
        wan_links = [
            lnk
            for lnk in result["links"]
            if "WAN" in (lnk["from_node"], lnk["to_node"])
            or lnk["link_type"] in ("FIBRE_OPTIC", "MPLS", "MICROWAVE")
        ]
        # At least one link should use IPsec
        ipsec_links = [lnk for lnk in wan_links if "IPsec" in lnk.get("encryption", "")]
        assert len(ipsec_links) > 0


# ── OPC-UA Namespace ───────────────────────────────────────────────────────────


class TestOPCUANamespace:
    """OPC-UA address space validation."""

    def test_server_url_non_empty(self):
        result = get_opcua_namespace()
        assert result["server_url"].startswith("opc.tcp://")

    def test_security_policy_specified(self):
        result = get_opcua_namespace()
        assert len(result["security_policy"]) > 0

    def test_namespace_uri_non_empty(self):
        result = get_opcua_namespace()
        assert result["namespace_uri"].startswith("urn:")

    def test_node_count_positive(self):
        result = get_opcua_namespace()
        assert result["node_count"] > 0

    def test_sample_nodes_present(self):
        result = get_opcua_namespace()
        assert len(result["nodes"]) > 0

    def test_nodes_have_required_fields(self):
        result = get_opcua_namespace()
        for node in result["nodes"]:
            assert "node_id" in node
            assert "browse_name" in node
            assert "data_type" in node
            assert "update_interval_ms" in node

    def test_node_ids_use_namespace_2(self):
        """All nodes should be in namespace 2 (urn:baltic-wind:scada)."""
        result = get_opcua_namespace()
        for node in result["nodes"]:
            assert node["node_id"].startswith("ns=2;")

    def test_update_intervals_positive(self):
        result = get_opcua_namespace()
        for node in result["nodes"]:
            assert node["update_interval_ms"] > 0

    def test_performance_class_specified(self):
        result = get_opcua_namespace()
        assert len(result["performance_class"]) > 0


# ── Latency Budgets ────────────────────────────────────────────────────────────


class TestLatencyBudget:
    """IEC 61850 performance class compliance."""

    def test_goose_path_compliant(self):
        """GOOSE (P3): must complete within 4 ms."""
        result = get_latency_budget(0)
        assert result["performance_class"] == "P3"
        assert result["required_latency_ms"] == 4.0
        assert result["compliant"] is True

    def test_measurement_path_compliant(self):
        """Measurement update (P2): must complete within 100 ms."""
        result = get_latency_budget(1)
        assert result["performance_class"] == "P2"
        assert result["required_latency_ms"] == 100.0
        assert result["compliant"] is True

    def test_wan_scada_path_compliant(self):
        """WAN SCADA poll (P1): must complete within 1000 ms."""
        result = get_latency_budget(2)
        assert result["performance_class"] == "P1"
        assert result["required_latency_ms"] == 1000.0
        assert result["compliant"] is True

    def test_total_latency_equals_budget_sum(self):
        """total_latency_ms must equal sum of budget_breakdown values."""
        for path in range(3):
            result = get_latency_budget(path)
            expected = sum(result["budget_breakdown"].values())
            assert abs(result["total_latency_ms"] - expected) < 0.001

    def test_margin_positive_for_compliant_paths(self):
        for path in range(3):
            result = get_latency_budget(path)
            if result["compliant"]:
                assert result["margin_ms"] >= 0.0

    def test_required_fields_present(self):
        result = get_latency_budget(0)
        for field in (
            "path_description",
            "performance_class",
            "required_latency_ms",
            "budget_breakdown",
            "total_latency_ms",
            "margin_ms",
            "compliant",
        ):
            assert field in result

    def test_path_index_clamped(self):
        """Out-of-range path index should not raise — clamp to valid range."""
        result = get_latency_budget(99)
        assert result is not None
        result = get_latency_budget(-1)
        assert result is not None

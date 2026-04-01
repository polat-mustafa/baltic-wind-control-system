/**
 * Communication Network Dashboard — M15.
 *
 * Three sections:
 *   1. Topology summary (12 nodes, 11 links, WAN primary + microwave backup)
 *   2. OPC-UA namespace summary (endpoint, nodes, security)
 *   3. IEC 61850 latency budget breakdown (P3/P2/P1 performance classes)
 *
 * Primary WAN: OPGW fibre 10 Gbps, 0.225 ms.
 * Backup WAN: Microwave 100 Mbps.
 */

import { useEffect } from "react";
import { Network, AlertTriangle } from "lucide-react";

import { useNetworkStore } from "../../store/networkStore";
import { Button } from "../ui/Button";
import LatencyBudgetPanel from "./LatencyBudgetPanel";

const LAYER_COLOR: Record<string, string> = {
  FIELD: "#3ecf6e",
  STATION: "#60a5fa",
  WAN: "#f59e0b",
  CORPORATE: "#a78bfa",
};

const LINK_ICON: Record<string, string> = {
  FIBRE_OPTIC: "🔵",
  MPLS: "🟡",
  MICROWAVE: "🟠",
  ETHERNET: "⚪",
};

export default function NetworkDashboard() {
  const { topology, opcuaNamespace, loading, error, fetchAll, clearError } = useNetworkStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
        Loading network topology…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between">
          <span className="text-status-alarm flex items-center gap-2"><AlertTriangle size={14} /> {error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Communication Network — IEC 61850 / IEC 62351</span>
        </div>
        <Button size="sm" onClick={fetchAll} disabled={loading}>Refresh</Button>
      </div>

      {/* Topology */}
      {topology && (
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Network Topology</h3>
            <div className="flex gap-3 text-xs text-text-muted">
              <span>{topology.node_count} nodes</span>
              <span>{topology.link_count} links</span>
            </div>
          </div>

          {/* Nodes by layer */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {(["FIELD", "STATION", "WAN", "CORPORATE"] as const).map((layer) => {
              const layerNodes = topology.nodes.filter((n) => n.layer === layer);
              return (
                <div key={layer} className="bg-bg-tertiary rounded p-2 text-xs" style={{ borderLeft: `2px solid ${LAYER_COLOR[layer]}` }}>
                  <p className="text-text-muted mb-1">{layer}</p>
                  <p className="font-bold text-text-primary">{layerNodes.length} nodes</p>
                  <p className="text-text-muted truncate">{layerNodes.map((n) => n.protocol).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</p>
                </div>
              );
            })}
          </div>

          {/* Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {topology.links.map((link) => (
              <div key={link.link_id} className="flex items-center gap-2 text-xs bg-bg-tertiary rounded px-2 py-1.5">
                <span>{LINK_ICON[link.link_type] ?? "⚪"}</span>
                <span className="font-mono text-text-secondary flex-1 truncate">{link.from_node} → {link.to_node}</span>
                <span className="text-text-muted">{link.bandwidth_mbps >= 1000 ? `${link.bandwidth_mbps / 1000} Gbps` : `${link.bandwidth_mbps} Mbps`}</span>
                <span className="text-text-muted">{link.latency_ms.toFixed(1)} ms</span>
                {link.encryption && <span className="text-status-success">🔒</span>}
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs text-text-muted">{topology.assessment}</p>
        </div>
      )}

      {/* OPC-UA namespace */}
      {opcuaNamespace && (
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <h3 className="text-sm font-semibold text-text-primary mb-2">OPC-UA Namespace</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Server</p>
              <p className="font-mono text-text-primary text-[10px] break-all">{opcuaNamespace.server_url.replace("opc.tcp://", "")}</p>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Nodes</p>
              <p className="font-mono font-bold text-text-primary">{opcuaNamespace.node_count}</p>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Security</p>
              <p className="text-text-primary text-[10px]">{opcuaNamespace.security_policy}</p>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Perf. class</p>
              <p className="font-mono font-bold text-text-primary">{opcuaNamespace.performance_class}</p>
            </div>
          </div>
        </div>
      )}

      {/* Latency budgets */}
      <LatencyBudgetPanel />
    </div>
  );
}

/**
 * OPC-UA Panel — M03.
 *
 * Server status KPIs (running, clients, nodes, endpoint URL).
 * Collapsible address space tree (top 2 levels only for performance).
 * OPC-UA: opc.tcp://10.0.2.10:4840, Basic256Sha256/SignAndEncrypt.
 * 185 nodes in urn:baltic-wind:scada namespace.
 */

import { useEffect, useState } from "react";
import { Database, ChevronRight, ChevronDown } from "lucide-react";

import { useOPCUAStore } from "../../store/opcuaStore";
import { Button } from "../ui/Button";
import type { OPCUANodeInfo } from "../../types/opcua";

function NodeRow({ node, depth = 0 }: { node: OPCUANodeInfo; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-0.5 px-2 rounded cursor-pointer hover:bg-bg-elevated/30 text-xs ${depth === 0 ? "mt-1" : ""}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => hasChildren && setExpanded((p) => !p)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={10} className="text-text-muted shrink-0" /> : <ChevronRight size={10} className="text-text-muted shrink-0" />
        ) : (
          <span className="w-2.5 shrink-0" />
        )}
        <span className={`font-mono ${depth === 0 ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
          {node.browse_name}
        </span>
        <span className="text-text-muted ml-auto">{node.node_class}</span>
        {node.value != null && (
          <span className="font-mono text-text-muted ml-2">{String(node.value).slice(0, 20)}</span>
        )}
      </div>
      {expanded && hasChildren && node.children.map((child) => (
        <NodeRow key={child.node_id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function OPCUAPanel() {
  const { status, addressSpace, loading, fetchAll } = useOPCUAStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
        Connecting to OPC-UA server…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status KPIs */}
      {status && (
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-accent" />
              <span className="text-sm font-semibold text-text-primary">OPC-UA Server</span>
              <span className={`text-xs px-2 py-0.5 rounded ${status.running ? "bg-status-success/20 text-status-success" : "bg-status-alarm/20 text-status-alarm"}`}>
                {status.running ? "Running" : "Stopped"}
              </span>
            </div>
            <Button size="sm" onClick={fetchAll} disabled={loading}>Refresh</Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Endpoint</p>
              <p className="font-mono text-text-primary truncate" title={status.endpoint}>{status.endpoint.replace("opc.tcp://", "")}</p>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Clients</p>
              <p className="font-mono font-bold text-text-primary">{status.connected_clients}</p>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Nodes</p>
              <p className="font-mono font-bold text-text-primary">{status.node_count}</p>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <p className="text-text-muted">Security</p>
              <p className="font-mono text-text-primary text-xs">Basic256Sha256</p>
            </div>
          </div>
        </div>
      )}

      {/* Address space tree */}
      {addressSpace && (
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text-primary">
              Address Space — {addressSpace.total_nodes} nodes
            </h3>
            <span className="text-xs text-text-muted font-mono">urn:baltic-wind:scada</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {addressSpace.root_nodes.map((node) => (
              <NodeRow key={node.node_id} node={node} depth={0} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

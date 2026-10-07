/**
 * Communication network (M15) — layered OT architecture with links, and the
 * IEC 61850-5 transfer-time budgets.
 *
 * Field (WTG IEDs on 100 Mbit/s string rings) → station bus (OSS switches,
 * gateway, firewall) → WAN (fibre in the export cable, licensed microwave
 * backup) → onshore control centre / corporate. Dashed links are redundant
 * paths; every zone boundary is an IEC 62443 conduit.
 */

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { useNetworkStore } from "../../store/networkStore";
import { useChartPalette } from "../../hooks/useChartPalette";
import type { NetworkLayer, NetworkNode } from "../../types/network";
import { useFarmPlan } from "../../hooks/useFarmPlan";
import LatencyBudgetPanel from "./LatencyBudgetPanel";

const LAYERS: { id: NetworkLayer; label: string }[] = [
  { id: "FIELD", label: "Field · WTG IEDs" },
  { id: "STATION", label: "Station bus · OSS" },
  { id: "WAN", label: "WAN" },
  { id: "CORPORATE", label: "Onshore · control centre / IT" },
];
const W = 1000;
const COL_W = W / LAYERS.length;
const NODE_W = 170;
const NODE_H = 40;
const ROW_H = 64;

const fmtBw = (mbps: number) => (mbps >= 1000 ? `${mbps / 1000} Gbit/s` : `${mbps} Mbit/s`);

export default function NetworkDashboard() {
  const topology = useNetworkStore((s) => s.topology);
  const loading = useNetworkStore((s) => s.loading);
  const error = useNetworkStore((s) => s.error);
  const fetchAll = useNetworkStore((s) => s.fetchAll);
  const clearError = useNetworkStore((s) => s.clearError);
  const c = useChartPalette();
  const exportKm = useFarmPlan().exportKm;

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const pos = new Map<string, { x: number; y: number; node: NetworkNode }>();
  let rows = 1;
  if (topology) {
    LAYERS.forEach((layer, col) => {
      const nodes = topology.nodes.filter((n) => n.layer === layer.id);
      rows = Math.max(rows, nodes.length);
      nodes.forEach((node, i) => pos.set(node.node_id, { x: col * COL_W + COL_W / 2, y: 40 + i * ROW_H + NODE_H / 2, node }));
    });
  }
  const H = 40 + rows * ROW_H;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-text-primary">Communication network · IEC 61850 / IEC 62443</h3>
        <span className="flex-1" />
        <button type="button" onClick={() => void fetchAll()} className="flex items-center gap-1 h-6 px-2 rounded border border-border-primary text-[11px] text-text-secondary hover:bg-bg-hover">
          <RefreshCw size={11} className={loading ? "animate-spin" : undefined} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 rounded border border-status-warning/40 bg-status-warning/10 text-xs text-text-primary">
          <AlertTriangle size={13} className="text-status-warning" /> <span className="flex-1">{error}</span>
          <button type="button" onClick={clearError} className="text-text-muted hover:text-text-primary">Dismiss</button>
        </div>
      )}

      {topology && (
        <section className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <p className="text-[11px] text-text-muted mb-2">{topology.assessment}</p>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[760px]" role="img" aria-label="OT network architecture">
              {LAYERS.map((l, i) => (
                <g key={l.id}>
                  {i > 0 && <line x1={i * COL_W} y1={0} x2={i * COL_W} y2={H} stroke={c.ref} strokeDasharray="2 4" />}
                  <text x={i * COL_W + COL_W / 2} y={18} textAnchor="middle" fontSize={13} fontWeight={600} className="fill-text-secondary">
                    {l.id === "WAN" ? `WAN · ${exportKm.toFixed(0)} km` : l.label}
                  </text>
                </g>
              ))}
              {topology.links.map((l) => {
                const a = pos.get(l.from_node);
                const b = pos.get(l.to_node);
                if (!a || !b) return null;
                const sameCol = a.x === b.x;
                const x1 = sameCol ? a.x + NODE_W / 2 : a.x + (b.x > a.x ? NODE_W / 2 : -NODE_W / 2);
                const x2 = sameCol ? b.x + NODE_W / 2 : b.x + (b.x > a.x ? -NODE_W / 2 : NODE_W / 2);
                const mx = sameCol ? x1 + 18 : (x1 + x2) / 2;
                return (
                  <g key={l.link_id}>
                    <path
                      d={`M${x1} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${x2} ${b.y}`}
                      fill="none"
                      stroke={l.link_type === "MICROWAVE" ? c.orange : c.blue}
                      strokeWidth={l.bandwidth_mbps >= 1000 ? 2.5 : 1.5}
                      strokeDasharray={l.redundant ? "6 4" : undefined}
                    >
                      <title>{`${l.link_id} ${l.from_node} → ${l.to_node}: ${l.link_type}, ${fmtBw(l.bandwidth_mbps)}, ${l.latency_ms} ms, ${l.encryption}`}</title>
                    </path>
                  </g>
                );
              })}
              {[...pos.values()].map(({ x, y, node }) => (
                <g key={node.node_id}>
                  <rect x={x - NODE_W / 2} y={y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={4} fill="var(--color-bg-tertiary)" stroke="var(--color-border-secondary)" />
                  <text x={x} y={y - 3} textAnchor="middle" fontSize={12} fontWeight={600} fontFamily="monospace" className="fill-text-primary">
                    {node.node_id}
                  </text>
                  <text x={x} y={y + 12} textAnchor="middle" fontSize={10} className="fill-text-muted">
                    {node.protocol.length > 28 ? `${node.protocol.slice(0, 27)}…` : node.protocol}
                  </text>
                  <title>{`${node.name} · ${node.ip_subnet}${node.redundant ? " · redundant" : ""}`}</title>
                </g>
              ))}
            </svg>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] text-text-muted mt-1">
            <span className="flex items-center gap-1"><span className="inline-block w-5 h-0.5" style={{ background: c.blue }} /> fibre / Ethernet</span>
            <span className="flex items-center gap-1"><span className="inline-block w-5 h-0.5" style={{ background: c.orange }} /> licensed microwave</span>
            <span>dashed = redundant path · thick = ≥ 1 Gbit/s · hover for details</span>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-[11px]">
              <thead className="text-left text-text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">Link</th>
                  <th className="py-1 pr-3 font-medium">From → to</th>
                  <th className="py-1 pr-3 font-medium">Medium</th>
                  <th className="py-1 pr-3 font-medium text-right">Bandwidth</th>
                  <th className="py-1 pr-3 font-medium text-right">Latency</th>
                  <th className="py-1 font-medium">Protection</th>
                </tr>
              </thead>
              <tbody>
                {topology.links.map((l) => (
                  <tr key={l.link_id} className="border-t border-border-primary/60">
                    <td className="py-1 pr-3 font-mono text-text-muted">{l.link_id}</td>
                    <td className="py-1 pr-3 font-mono text-text-primary whitespace-nowrap">
                      {l.from_node} → {l.to_node}
                    </td>
                    <td className="py-1 pr-3 text-text-secondary">
                      {l.link_type.replace("_", " ").toLowerCase()}
                      {l.redundant ? " · redundant" : ""}
                    </td>
                    <td className="py-1 pr-3 font-mono text-right text-text-secondary">{fmtBw(l.bandwidth_mbps)}</td>
                    <td className="py-1 pr-3 font-mono text-right text-text-secondary">{l.latency_ms} ms</td>
                    <td className="py-1 text-text-muted">{l.encryption}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <LatencyBudgetPanel />
    </div>
  );
}

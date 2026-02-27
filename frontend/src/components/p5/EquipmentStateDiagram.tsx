/**
 * Single-line diagram (SLD) using XYFlow.
 *
 * Renders the 21+ pieces of OSS equipment as nodes positioned in a
 * topology matching the real offshore substation layout:
 *
 *   Onshore 400 kV → Export Cable 220 kV → OSS 220 kV Bus → Transformer
 *   → OSS 66 kV Bus → String Feeders (6 strings of turbines)
 *
 * Each node is colored by its current equipment state using ISA-101 colors:
 *   - Green: energized (closed CB / closed DS)
 *   - Gray: de-energized (open)
 *   - Cyan: earthed (earth switch closed)
 *   - Red: fault (via anomaly injection overlay)
 *
 * Edges represent electrical connections, colored by voltage level.
 * Zoom/pan/selection matches real SCADA HMI interaction patterns.
 */

import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { EQUIPMENT_STATE_COLOR, VOLTAGE_COLOR, SCADA_COLORS } from "../../constants/scadaColors";
import { useCommissioningStore } from "../../store/commissioningStore";
import type { EquipmentState } from "../../types/commissioning";

// ── Node positions — OSS topology layout ───────────────────────

const EQUIPMENT_POSITIONS: Record<string, { x: number; y: number }> = {
  // Onshore side (left)
  "ES-ON-220-01": { x: 50, y: 100 },
  "DS-ON-220-01": { x: 150, y: 100 },
  "CB-ON-220-01": { x: 250, y: 100 },
  // Export cable (middle)
  "ES-OSS-220-01": { x: 450, y: 100 },
  "DS-OSS-220-01": { x: 550, y: 100 },
  "CB-OSS-220-01": { x: 650, y: 100 },
  // Transformer
  "CB-TX-OSS-HV": { x: 750, y: 100 },
  "TX-OSS-01": { x: 850, y: 100 },
  "CB-TX-OSS-LV": { x: 950, y: 100 },
  // 66 kV busbar
  "ES-OSS-66-01": { x: 950, y: 200 },
  // String feeders (bottom row)
  "ES-STR-01": { x: 350, y: 350 },
  "CB-STR-01": { x: 350, y: 280 },
  "ES-STR-02": { x: 500, y: 350 },
  "CB-STR-02": { x: 500, y: 280 },
  "ES-STR-03": { x: 650, y: 350 },
  "CB-STR-03": { x: 650, y: 280 },
  "ES-STR-04": { x: 800, y: 350 },
  "CB-STR-04": { x: 800, y: 280 },
  "ES-STR-05": { x: 950, y: 350 },
  "CB-STR-05": { x: 950, y: 280 },
  "ES-STR-06": { x: 1100, y: 350 },
  "CB-STR-06": { x: 1100, y: 280 },
};

// ── Edge definitions — electrical connections ──────────────────

const EDGE_DEFS: { source: string; target: string; voltage: number }[] = [
  // 220 kV path: Onshore → Export → OSS → Transformer
  { source: "ES-ON-220-01", target: "DS-ON-220-01", voltage: 220 },
  { source: "DS-ON-220-01", target: "CB-ON-220-01", voltage: 220 },
  { source: "CB-ON-220-01", target: "ES-OSS-220-01", voltage: 220 },
  { source: "ES-OSS-220-01", target: "DS-OSS-220-01", voltage: 220 },
  { source: "DS-OSS-220-01", target: "CB-OSS-220-01", voltage: 220 },
  { source: "CB-OSS-220-01", target: "CB-TX-OSS-HV", voltage: 220 },
  { source: "CB-TX-OSS-HV", target: "TX-OSS-01", voltage: 220 },
  // 66 kV path: Transformer LV → Bus → Strings
  { source: "TX-OSS-01", target: "CB-TX-OSS-LV", voltage: 66 },
  { source: "CB-TX-OSS-LV", target: "ES-OSS-66-01", voltage: 66 },
  // String feeders from 66 kV bus
  { source: "ES-OSS-66-01", target: "CB-STR-01", voltage: 66 },
  { source: "ES-OSS-66-01", target: "CB-STR-02", voltage: 66 },
  { source: "ES-OSS-66-01", target: "CB-STR-03", voltage: 66 },
  { source: "ES-OSS-66-01", target: "CB-STR-04", voltage: 66 },
  { source: "ES-OSS-66-01", target: "CB-STR-05", voltage: 66 },
  { source: "ES-OSS-66-01", target: "CB-STR-06", voltage: 66 },
  // String earth switches
  { source: "CB-STR-01", target: "ES-STR-01", voltage: 66 },
  { source: "CB-STR-02", target: "ES-STR-02", voltage: 66 },
  { source: "CB-STR-03", target: "ES-STR-03", voltage: 66 },
  { source: "CB-STR-04", target: "ES-STR-04", voltage: 66 },
  { source: "CB-STR-05", target: "ES-STR-05", voltage: 66 },
  { source: "CB-STR-06", target: "ES-STR-06", voltage: 66 },
];

// ── Type abbreviations for compact node labels ─────────────────

const TYPE_ABBREV: Record<string, string> = {
  circuit_breaker: "CB",
  disconnector: "DS",
  earth_switch: "ES",
  transformer: "TX",
};

// ── Build nodes and edges from equipment state ─────────────────

function buildNodes(equipment: EquipmentState[], anomalyIds: Set<string>): Node[] {
  return equipment
    .filter((eq) => EQUIPMENT_POSITIONS[eq.equipment_id])
    .map((eq) => {
      const pos = EQUIPMENT_POSITIONS[eq.equipment_id];
      const hasAnomaly = anomalyIds.has(eq.equipment_id);
      const color = hasAnomaly
        ? SCADA_COLORS.FAULT
        : EQUIPMENT_STATE_COLOR[eq.state] ?? SCADA_COLORS.DE_ENERGIZED;

      return {
        id: eq.equipment_id,
        position: pos,
        data: {
          label: `${TYPE_ABBREV[eq.equipment_type] ?? eq.equipment_type}\n${eq.equipment_id.split("-").slice(-2).join("-")}\n${eq.state.toUpperCase()}`,
        },
        style: {
          background: color + "22",
          border: `2px solid ${color}`,
          color,
          borderRadius: eq.equipment_type === "transformer" ? "50%" : "8px",
          padding: "8px 12px",
          fontSize: "10px",
          fontFamily: "monospace",
          textAlign: "center" as const,
          whiteSpace: "pre-line" as const,
          width: eq.equipment_type === "transformer" ? 80 : 90,
          height: eq.equipment_type === "transformer" ? 80 : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        type: "default",
      };
    });
}

function buildEdges(): Edge[] {
  return EDGE_DEFS.map((def, i) => ({
    id: `e-${i}`,
    source: def.source,
    target: def.target,
    style: {
      stroke: VOLTAGE_COLOR[def.voltage] ?? SCADA_COLORS.DE_ENERGIZED,
      strokeWidth: 2,
    },
    animated: false,
  }));
}

export default function EquipmentStateDiagram() {
  const { activeProgramme, anomalies } = useCommissioningStore();

  if (!activeProgramme) return null;

  const anomalyIds = new Set(
    anomalies.filter((a) => a.active).map((a) => a.equipment_id),
  );

  const nodes = buildNodes(activeProgramme.equipment_states, anomalyIds);
  const edges = buildEdges();

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Single-Line Diagram</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            OSS Equipment State — {activeProgramme.equipment_states.length} items
          </p>
        </div>
        {/* Legend */}
        <div className="flex gap-3">
          {[
            { label: "Energized", color: SCADA_COLORS.ENERGIZED },
            { label: "De-energized", color: SCADA_COLORS.DE_ENERGIZED },
            { label: "Earthed", color: SCADA_COLORS.EARTHED },
            { label: "Fault", color: SCADA_COLORS.FAULT },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 450 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#334155" gap={20} />
          <Controls
            showInteractive={false}
            style={{ background: "#1e293b", borderColor: "#475569" }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

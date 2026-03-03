/**
 * Single-line diagram (SLD) using XYFlow with IEC 60617 symbols.
 *
 * Renders the 21+ pieces of OSS equipment as proper electrical symbols:
 *   - Circuit Breakers: filled square with cross
 *   - Disconnectors: blade switches
 *   - Earth Switches: blade with ground bars
 *   - Transformer: two overlapping circles (IEC 60617-S00564)
 *   - Busbars: thick horizontal bars
 *
 * Topology: Onshore 400 kV → Export Cable 220 kV → OSS 220 kV Bus →
 *   Transformer → OSS 66 kV Bus → 6 String Feeders
 *
 * Each node is colored by its current equipment state using ISA-101 colors:
 *   - Green (#3ecf6e): energized (closed CB / closed DS)
 *   - Gray (#6b7280): de-energized (open)
 *   - Cyan (#22d3ee): earthed (earth switch closed)
 *   - Red (#ef4444): fault (via anomaly injection overlay)
 *
 * Edges represent electrical connections, colored by voltage level.
 */

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  EQUIPMENT_STATE_COLOR,
  VOLTAGE_COLOR,
  SCADA_COLORS,
} from "../../constants/scadaColors";
import { useCommissioningStore } from "../../store/commissioningStore";
import type { EquipmentState } from "../../types/commissioning";
import {
  CircuitBreakerNode,
  DisconnectorNode,
  EarthSwitchNode,
  TransformerNode,
  BusbarNode,
} from "../sld/SLDNodes";
import { InfoButton } from "../ui/InfoButton";
import { equipmentSldInfo } from "../../constants/panelInfo";

// ── XYFlow node types ──────────────────────────────────────────

const nodeTypes: NodeTypes = {
  circuit_breaker: CircuitBreakerNode,
  disconnector: DisconnectorNode,
  earth_switch: EarthSwitchNode,
  transformer: TransformerNode,
  busbar: BusbarNode,
};

// ── Node positions — OSS topology layout ───────────────────────

const EQUIPMENT_POSITIONS: Record<string, { x: number; y: number }> = {
  // Onshore side (left)
  "ES-ON-220-01": { x: 50, y: 100 },
  "DS-ON-220-01": { x: 170, y: 100 },
  "CB-ON-220-01": { x: 290, y: 100 },
  // Export cable (middle)
  "ES-OSS-220-01": { x: 480, y: 100 },
  "DS-OSS-220-01": { x: 600, y: 100 },
  "CB-OSS-220-01": { x: 720, y: 100 },
  // Transformer
  "CB-TX-OSS-HV": { x: 860, y: 100 },
  "TX-OSS-01": { x: 980, y: 85 },
  "CB-TX-OSS-LV": { x: 1100, y: 100 },
  // 66 kV busbar
  "ES-OSS-66-01": { x: 1100, y: 220 },
  // String feeders (bottom rows)
  "CB-STR-01": { x: 350, y: 310 },
  "ES-STR-01": { x: 350, y: 410 },
  "CB-STR-02": { x: 530, y: 310 },
  "ES-STR-02": { x: 530, y: 410 },
  "CB-STR-03": { x: 710, y: 310 },
  "ES-STR-03": { x: 710, y: 410 },
  "CB-STR-04": { x: 890, y: 310 },
  "ES-STR-04": { x: 890, y: 410 },
  "CB-STR-05": { x: 1070, y: 310 },
  "ES-STR-05": { x: 1070, y: 410 },
  "CB-STR-06": { x: 1250, y: 310 },
  "ES-STR-06": { x: 1250, y: 410 },
};

// ── Busbar definitions (virtual nodes, not in equipment list) ──

const BUSBAR_NODES: Node[] = [
  {
    id: "bb-220kv",
    type: "busbar",
    position: { x: 400, y: 30 },
    data: { label: "220 kV OSS Bus", color: SCADA_COLORS.VOLTAGE_220KV, voltage: 220 },
  },
  {
    id: "bb-66kv",
    type: "busbar",
    position: { x: 600, y: 245 },
    data: { label: "66 kV Array Bus", color: SCADA_COLORS.VOLTAGE_66KV, voltage: 66 },
  },
];

// ── Edge definitions — electrical connections ──────────────────

const EDGE_DEFS: { source: string; target: string; voltage: number }[] = [
  // 220 kV path: Onshore → Export → OSS → Transformer
  { source: "ES-ON-220-01", target: "DS-ON-220-01", voltage: 220 },
  { source: "DS-ON-220-01", target: "CB-ON-220-01", voltage: 220 },
  { source: "CB-ON-220-01", target: "bb-220kv", voltage: 220 },
  { source: "bb-220kv", target: "ES-OSS-220-01", voltage: 220 },
  { source: "ES-OSS-220-01", target: "DS-OSS-220-01", voltage: 220 },
  { source: "DS-OSS-220-01", target: "CB-OSS-220-01", voltage: 220 },
  { source: "CB-OSS-220-01", target: "CB-TX-OSS-HV", voltage: 220 },
  { source: "CB-TX-OSS-HV", target: "TX-OSS-01", voltage: 220 },
  // 66 kV path: Transformer LV → Bus → Strings
  { source: "TX-OSS-01", target: "CB-TX-OSS-LV", voltage: 66 },
  { source: "CB-TX-OSS-LV", target: "bb-66kv", voltage: 66 },
  // String feeders from 66 kV bus
  { source: "bb-66kv", target: "CB-STR-01", voltage: 66 },
  { source: "bb-66kv", target: "CB-STR-02", voltage: 66 },
  { source: "bb-66kv", target: "CB-STR-03", voltage: 66 },
  { source: "bb-66kv", target: "CB-STR-04", voltage: 66 },
  { source: "bb-66kv", target: "CB-STR-05", voltage: 66 },
  { source: "bb-66kv", target: "CB-STR-06", voltage: 66 },
  // String earth switches
  { source: "CB-STR-01", target: "ES-STR-01", voltage: 66 },
  { source: "CB-STR-02", target: "ES-STR-02", voltage: 66 },
  { source: "CB-STR-03", target: "ES-STR-03", voltage: 66 },
  { source: "CB-STR-04", target: "ES-STR-04", voltage: 66 },
  { source: "CB-STR-05", target: "ES-STR-05", voltage: 66 },
  { source: "CB-STR-06", target: "ES-STR-06", voltage: 66 },
];

// ── Map equipment type string to node type ─────────────────────

const EQUIPMENT_TYPE_TO_NODE: Record<string, string> = {
  circuit_breaker: "circuit_breaker",
  disconnector: "disconnector",
  earth_switch: "earth_switch",
  transformer: "transformer",
};

// ── Build nodes and edges from equipment state ─────────────────

function buildNodes(
  equipment: EquipmentState[],
  anomalyIds: Set<string>,
): Node[] {
  const equipNodes = equipment
    .filter((eq) => EQUIPMENT_POSITIONS[eq.equipment_id])
    .map((eq) => {
      const pos = EQUIPMENT_POSITIONS[eq.equipment_id];
      const hasAnomaly = anomalyIds.has(eq.equipment_id);
      const color = hasAnomaly
        ? SCADA_COLORS.FAULT
        : EQUIPMENT_STATE_COLOR[eq.state] ?? SCADA_COLORS.DE_ENERGIZED;

      const nodeType =
        EQUIPMENT_TYPE_TO_NODE[eq.equipment_type] ?? "circuit_breaker";

      // Short label: "CB-ON-220-01" → "ON-220-01"
      const shortLabel = eq.equipment_id.split("-").slice(1).join("-");

      return {
        id: eq.equipment_id,
        type: nodeType,
        position: pos,
        data: {
          label: shortLabel,
          color,
          state: eq.state.toUpperCase(),
          ...(eq.equipment_type === "transformer"
            ? { rating: "220/66 kV\n250 MVA" }
            : {}),
        },
      };
    });

  return [...BUSBAR_NODES, ...equipNodes];
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

// ── Main Component ─────────────────────────────────────────────

export default function EquipmentStateDiagram() {
  const { activeProgramme, anomalies } = useCommissioningStore();

  const graph = useMemo(() => {
    if (!activeProgramme) return { nodes: [], edges: [] };
    const anomalyIds = new Set(
      anomalies.filter((a) => a.active).map((a) => a.equipment_id),
    );
    return {
      nodes: buildNodes(activeProgramme.equipment_states, anomalyIds),
      edges: buildEdges(),
    };
  }, [activeProgramme, anomalies]);

  if (!activeProgramme) return null;

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
      <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary">
              Single-Line Diagram — IEC 60617
            </h3>
            <InfoButton info={equipmentSldInfo} />
          </div>
          <p className="text-[10px] text-text-muted mt-0.5 font-mono">
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
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 500 }}>
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#252a3a" gap={20} />
          <Controls
            showInteractive={false}
            className="!bg-bg-secondary !border-border-primary !rounded [&>button]:!bg-bg-secondary [&>button]:!border-border-primary [&>button]:!text-text-muted [&>button:hover]:!bg-bg-hover"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

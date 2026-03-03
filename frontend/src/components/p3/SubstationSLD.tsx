/**
 * Professional Substation Single-Line Diagram — IEC 60617 + IEC 61850.
 *
 * Live features:
 * - Breaker nodes show OPEN/CLOSED/TRIPPED state dynamically
 * - Fault location highlighted with flashing red
 * - Power flow values on busbar measurement points
 * - Click breaker → toggle OPEN/CLOSE (with RBAC check via store)
 * - Animated edges on energized paths
 *
 * Topology:
 *   400 kV PSE Grid ← CB-DS-TX(400/220)-DS-CB → 220 kV Export
 *   220 kV Export ← CB-DS-TX(220/66)-DS-CB → 66 kV Array Busbar
 *   66 kV Busbar → CB-DS per string → 6 strings × WTG IEDs
 */

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import {
  BusbarNode,
  CircuitBreakerNode,
  DisconnectorNode,
  EarthSwitchNode,
  IEDNode,
  TransformerNode,
} from "../sld/SLDNodes";
import SLDDetailPanel from "../sld/SLDDetailPanel";
import { InfoButton } from "../ui/InfoButton";
import { substationSldInfo } from "../../constants/panelInfo";
import type { BreakerState } from "../../types/scada";

// ── Equipment type → ISA-101 color mapping ───────────────────

const EQUIPMENT_COLOR: Record<string, string> = {
  protection_ied: SCADA_COLORS.FAULT,
  measurement_ied: SCADA_COLORS.VOLTAGE_220KV,
  bay_controller: SCADA_COLORS.ENERGIZED,
  wtg_controller: SCADA_COLORS.EARTHED,
};

// ── XYFlow node types — ALL IEC 60617 symbols registered ─────

const nodeTypes: NodeTypes = {
  ied: IEDNode,
  busbar: BusbarNode,
  cb: CircuitBreakerNode,
  ds: DisconnectorNode,
  es: EarthSwitchNode,
  tx: TransformerNode,
};

// ── Breaker state → color mapping ────────────────────────────

function breakerColor(state: BreakerState): string {
  switch (state) {
    case "CLOSED": return SCADA_COLORS.ENERGIZED;
    case "OPEN": return SCADA_COLORS.DE_ENERGIZED;
    case "TRIPPED": return SCADA_COLORS.FAULT;
    case "RACKING": return SCADA_COLORS.WARNING;
  }
}

// ── Layout builder — full switchgear topology ────────────────

function buildGraph(
  devices: {
    name: string;
    equipment_type: string;
    logical_devices: { logical_nodes: unknown[] }[];
  }[],
  breakerStates: Record<string, BreakerState>,
  faultHighlightNodeId: string | null,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const green = SCADA_COLORS.ENERGIZED;

  // Helper to get breaker state and color
  const cbState = (id: string) => breakerStates[id] ?? "CLOSED";
  const cbColor = (id: string) => breakerColor(cbState(id));

  // ── 400 kV Section ──
  nodes.push({
    id: "bb-400kv",
    type: "busbar",
    position: { x: 300, y: 0 },
    data: { label: "400 kV PSE Grid", color: SCADA_COLORS.VOLTAGE_400KV, voltage: 400 },
  });

  nodes.push({
    id: "cb-400",
    type: "cb",
    position: { x: 360, y: 50 },
    data: {
      label: "CB-400",
      color: cbColor("cb-400"),
      state: cbState("cb-400"),
      highlight: faultHighlightNodeId === "cb-400",
    },
  });
  nodes.push({
    id: "ds-400-1",
    type: "ds",
    position: { x: 360, y: 110 },
    data: { label: "DS-400", color: SCADA_COLORS.VOLTAGE_400KV, state: "CLOSED" },
  });

  // ── 400/220 kV Transformer ──
  nodes.push({
    id: "tx-400-220",
    type: "tx",
    position: { x: 355, y: 170 },
    data: { label: "TX-400/220", color: green, state: "IN SERVICE", rating: "300 MVA" },
  });

  // ES on 400kV side
  nodes.push({
    id: "es-400",
    type: "es",
    position: { x: 240, y: 80 },
    data: { label: "ES-400", color: SCADA_COLORS.EARTHED, state: "OPEN" },
  });

  // ── 220 kV Section ──
  nodes.push({
    id: "ds-220-1",
    type: "ds",
    position: { x: 360, y: 260 },
    data: { label: "DS-220", color: SCADA_COLORS.VOLTAGE_220KV, state: "CLOSED" },
  });
  nodes.push({
    id: "cb-220",
    type: "cb",
    position: { x: 360, y: 320 },
    data: {
      label: "CB-220",
      color: cbColor("cb-220"),
      state: cbState("cb-220"),
      highlight: faultHighlightNodeId === "cb-220",
    },
  });

  nodes.push({
    id: "bb-220kv",
    type: "busbar",
    position: { x: 300, y: 390 },
    data: { label: "220 kV Export Cable (45 km)", color: SCADA_COLORS.VOLTAGE_220KV, voltage: 220 },
  });

  // ── 220/66 kV Transformers (2x parallel) ──
  nodes.push({
    id: "cb-220-a",
    type: "cb",
    position: { x: 260, y: 440 },
    data: {
      label: "CB-220A",
      color: cbColor("cb-220-a"),
      state: cbState("cb-220-a"),
      highlight: faultHighlightNodeId === "cb-220-a",
    },
  });
  nodes.push({
    id: "tx-220-66-a",
    type: "tx",
    position: { x: 255, y: 510 },
    data: { label: "TX-A 220/66", color: green, state: "IN SERVICE", rating: "300 MVA" },
  });
  nodes.push({
    id: "cb-66-a",
    type: "cb",
    position: { x: 260, y: 590 },
    data: {
      label: "CB-66A",
      color: cbColor("cb-66-a"),
      state: cbState("cb-66-a"),
      highlight: faultHighlightNodeId === "cb-66-a",
    },
  });

  nodes.push({
    id: "cb-220-b",
    type: "cb",
    position: { x: 460, y: 440 },
    data: {
      label: "CB-220B",
      color: cbColor("cb-220-b"),
      state: cbState("cb-220-b"),
      highlight: faultHighlightNodeId === "cb-220-b",
    },
  });
  nodes.push({
    id: "tx-220-66-b",
    type: "tx",
    position: { x: 455, y: 510 },
    data: { label: "TX-B 220/66", color: green, state: "IN SERVICE", rating: "300 MVA" },
  });
  nodes.push({
    id: "cb-66-b",
    type: "cb",
    position: { x: 460, y: 590 },
    data: {
      label: "CB-66B",
      color: cbColor("cb-66-b"),
      state: cbState("cb-66-b"),
      highlight: faultHighlightNodeId === "cb-66-b",
    },
  });

  // ── 66 kV Array Busbar ──
  nodes.push({
    id: "bb-66kv",
    type: "busbar",
    position: { x: 300, y: 660 },
    data: { label: "66 kV Array Busbar", color: SCADA_COLORS.VOLTAGE_66KV, voltage: 66 },
  });

  // ── Edges: 400kV section ──
  const e400Color = cbState("cb-400") === "CLOSED" ? SCADA_COLORS.VOLTAGE_400KV : SCADA_COLORS.DE_ENERGIZED;
  edges.push({ id: "e-bb400-cb400", source: "bb-400kv", target: "cb-400", style: { stroke: SCADA_COLORS.VOLTAGE_400KV, strokeWidth: 2 }, animated: cbState("cb-400") === "CLOSED" });
  edges.push({ id: "e-cb400-ds400", source: "cb-400", target: "ds-400-1", style: { stroke: e400Color, strokeWidth: 2 } });
  edges.push({ id: "e-ds400-tx", source: "ds-400-1", target: "tx-400-220", style: { stroke: e400Color, strokeWidth: 2 } });
  edges.push({ id: "e-bb400-es400", source: "bb-400kv", target: "es-400", style: { stroke: SCADA_COLORS.EARTHED, strokeWidth: 1, strokeDasharray: "4 4" } });

  // ── Edges: 220kV section ──
  const e220Color = cbState("cb-220") === "CLOSED" ? SCADA_COLORS.VOLTAGE_220KV : SCADA_COLORS.DE_ENERGIZED;
  edges.push({ id: "e-tx-ds220", source: "tx-400-220", target: "ds-220-1", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-ds220-cb220", source: "ds-220-1", target: "cb-220", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb220-bb220", source: "cb-220", target: "bb-220kv", style: { stroke: e220Color, strokeWidth: 2 }, animated: cbState("cb-220") === "CLOSED" });

  // ── Edges: 220/66 transformers ──
  edges.push({ id: "e-bb220-cb220a", source: "bb-220kv", target: "cb-220-a", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb220a-txa", source: "cb-220-a", target: "tx-220-66-a", style: { stroke: cbState("cb-220-a") === "CLOSED" ? SCADA_COLORS.VOLTAGE_220KV : SCADA_COLORS.DE_ENERGIZED, strokeWidth: 2 } });
  edges.push({ id: "e-txa-cb66a", source: "tx-220-66-a", target: "cb-66-a", style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb66a-bb66", source: "cb-66-a", target: "bb-66kv", style: { stroke: cbState("cb-66-a") === "CLOSED" ? SCADA_COLORS.VOLTAGE_66KV : SCADA_COLORS.DE_ENERGIZED, strokeWidth: 2 } });

  edges.push({ id: "e-bb220-cb220b", source: "bb-220kv", target: "cb-220-b", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb220b-txb", source: "cb-220-b", target: "tx-220-66-b", style: { stroke: cbState("cb-220-b") === "CLOSED" ? SCADA_COLORS.VOLTAGE_220KV : SCADA_COLORS.DE_ENERGIZED, strokeWidth: 2 } });
  edges.push({ id: "e-txb-cb66b", source: "tx-220-66-b", target: "cb-66-b", style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb66b-bb66", source: "cb-66-b", target: "bb-66kv", style: { stroke: cbState("cb-66-b") === "CLOSED" ? SCADA_COLORS.VOLTAGE_66KV : SCADA_COLORS.DE_ENERGIZED, strokeWidth: 2 } });

  // ── Feeder CBs + DS per string off 66 kV busbar ──
  const stringLayout = [6, 6, 6, 6, 5, 5];
  const wtgDevices = devices.filter((d) => d.equipment_type === "wtg_controller");
  const ossDevices = devices.filter((d) => d.equipment_type !== "wtg_controller");
  let wtgIdx = 0;
  const feederStartX = 50;
  const feederY = 740;

  stringLayout.forEach((count, stringNum) => {
    const feederX = feederStartX + stringNum * 140;
    const cbId = `cb-str${stringNum + 1}`;

    nodes.push({
      id: cbId,
      type: "cb",
      position: { x: feederX, y: feederY },
      data: {
        label: `CB-S${stringNum + 1}`,
        color: cbColor(cbId),
        state: cbState(cbId),
        highlight: faultHighlightNodeId === cbId,
      },
    });
    edges.push({
      id: `e-bb66-${cbId}`,
      source: "bb-66kv",
      target: cbId,
      style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 1.5 },
    });

    // String label
    nodes.push({
      id: `label-str${stringNum + 1}`,
      type: "ied",
      position: { x: feederX - 5, y: feederY + 70 },
      data: { label: `String ${stringNum + 1}`, type: "string_label", lns: count, color: SCADA_COLORS.VOLTAGE_66KV },
    });
    edges.push({
      id: `e-${cbId}-label`,
      source: cbId,
      target: `label-str${stringNum + 1}`,
      style: { stroke: cbState(cbId) === "CLOSED" ? SCADA_COLORS.VOLTAGE_66KV : SCADA_COLORS.DE_ENERGIZED, strokeWidth: 1 },
    });

    // WTG IEDs in this string
    for (let j = 0; j < count && wtgIdx < wtgDevices.length; j++) {
      const d = wtgDevices[wtgIdx];
      const lnCount = d.logical_devices.reduce((sum, ld) => sum + ld.logical_nodes.length, 0);
      const color = EQUIPMENT_COLOR[d.equipment_type] ?? SCADA_COLORS.DE_ENERGIZED;
      const nodeId = `ied-${d.name}`;
      nodes.push({
        id: nodeId,
        type: "ied",
        position: { x: feederX - 5, y: feederY + 130 + j * 55 },
        data: { label: d.name, type: d.equipment_type, lns: lnCount, color },
      });
      if (j === 0) {
        edges.push({
          id: `e-label-${d.name}`,
          source: `label-str${stringNum + 1}`,
          target: nodeId,
          style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 1 },
        });
      } else {
        const prevName = wtgDevices[wtgIdx - 1].name;
        edges.push({
          id: `e-chain-${prevName}-${d.name}`,
          source: `ied-${prevName}`,
          target: nodeId,
          style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 1 },
        });
      }
      wtgIdx++;
    }
  });

  // OSS IEDs (protection, measurement, bay controller) — beside 66kV busbar
  ossDevices.forEach((d, i) => {
    const lnCount = d.logical_devices.reduce((sum, ld) => sum + ld.logical_nodes.length, 0);
    const color = EQUIPMENT_COLOR[d.equipment_type] ?? SCADA_COLORS.DE_ENERGIZED;
    const nodeId = `ied-${d.name}`;
    nodes.push({
      id: nodeId,
      type: "ied",
      position: { x: 900 + i * 120, y: 660 },
      data: { label: d.name, type: d.equipment_type, lns: lnCount, color },
    });
    edges.push({
      id: `e-66-${d.name}`,
      source: "bb-66kv",
      target: nodeId,
      style: { stroke: SCADA_COLORS.DE_ENERGIZED, strokeWidth: 1, strokeDasharray: "3 3" },
    });
  });

  return { nodes, edges };
}

// ── Main Component ───────────────────────────────────────────

export default function SubstationSLD() {
  const substationSummary = useScadaStore((s) => s.substationSummary);
  const breakerStates = useScadaStore((s) => s.breakerStates);
  const faultHighlightNodeId = useScadaStore((s) => s.faultHighlightNodeId);
  const toggleBreaker = useScadaStore((s) => s.toggleBreaker);
  const measurements = useScadaStore((s) => s.measurements) ?? [];
  const [selectedNode, setSelectedNode] = useState<{ data: Record<string, unknown>; type: string } | null>(null);

  const graph = useMemo(() => {
    if (!substationSummary?.devices) return { nodes: [], edges: [] };
    return buildGraph(substationSummary.devices, breakerStates, faultHighlightNodeId);
  }, [substationSummary, breakerStates, faultHighlightNodeId]);

  const onInit = useCallback(
    (instance: { fitView: () => void }) => {
      instance.fitView();
    },
    [],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    // If it's a circuit breaker, toggle it
    if (node.type === "cb") {
      toggleBreaker(node.id);
    }
    setSelectedNode({
      data: node.data as Record<string, unknown>,
      type: node.type ?? "ied",
    });
  }, [toggleBreaker]);

  if (!substationSummary) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-6 h-[400px] flex items-center justify-center">
        <p className="text-text-muted">Loading substation configuration...</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden relative h-full">
      <div className="px-3 py-1.5 border-b border-border-primary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-text-primary">
            Substation SLD
          </h3>
          <InfoButton info={substationSldInfo} />
          <p className="text-[9px] text-text-muted font-mono">
            {substationSummary.total_devices} IEDs · IEC 60617 · Click CB to toggle
          </p>
        </div>
        {/* Live measurements */}
        <div className="flex gap-3">
          {measurements.map((m) => (
            <div key={m.nodeId} className="flex items-center gap-1">
              <span className="text-[9px] text-text-muted font-mono">{m.voltageKV}kV:</span>
              <span className="text-[9px] text-text-secondary font-mono tabular-nums">{m.powerMW}MW</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: "calc(100% - 34px)" }}>
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          onNodeClick={onNodeClick}
          fitView
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#252a3a" gap={20} />
          <Controls className="!bg-bg-secondary !border-border-primary !rounded [&>button]:!bg-bg-secondary [&>button]:!border-border-primary [&>button]:!text-text-muted [&>button:hover]:!bg-bg-hover" />
        </ReactFlow>
      </div>

      {/* Equipment detail panel */}
      {selectedNode && (
        <SLDDetailPanel
          nodeData={selectedNode.data}
          nodeType={selectedNode.type}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

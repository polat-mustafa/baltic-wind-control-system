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

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useScadaStore } from "../../store/scadaStore";
import { useLandingStore, selectTurbineSLDMap } from "../../store/landingStore";
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
  turbineMap?: Record<string, { powerOutputMW: number; windSpeedMs: number; status: string }>,
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

  // ── Helper: add power-flow arrow to energized edges ──────────────
  // Arrow direction = source → target (power flow direction in SLD convention)
  const flowArrow = (color: string, energized: boolean) =>
    energized
      ? { type: MarkerType.ArrowClosed as const, color, width: 12, height: 12 }
      : undefined;

  // ── Edges: 400kV section ──
  const cb400Closed = cbState("cb-400") === "CLOSED";
  const e400Color = cb400Closed ? SCADA_COLORS.VOLTAGE_400KV : SCADA_COLORS.DE_ENERGIZED;
  edges.push({ id: "e-bb400-cb400", source: "bb-400kv", target: "cb-400", style: { stroke: SCADA_COLORS.VOLTAGE_400KV, strokeWidth: 2 }, animated: cb400Closed, markerEnd: flowArrow(SCADA_COLORS.VOLTAGE_400KV, cb400Closed) });
  edges.push({ id: "e-cb400-ds400", source: "cb-400", target: "ds-400-1", style: { stroke: e400Color, strokeWidth: 2 } });
  edges.push({ id: "e-ds400-tx", source: "ds-400-1", target: "tx-400-220", style: { stroke: e400Color, strokeWidth: 2 }, markerEnd: flowArrow(e400Color, cb400Closed) });
  edges.push({ id: "e-bb400-es400", source: "bb-400kv", target: "es-400", style: { stroke: SCADA_COLORS.EARTHED, strokeWidth: 1, strokeDasharray: "4 4" } });

  // ── Edges: 220kV section ──
  const cb220Closed = cbState("cb-220") === "CLOSED";
  const e220Color = cb220Closed ? SCADA_COLORS.VOLTAGE_220KV : SCADA_COLORS.DE_ENERGIZED;
  edges.push({ id: "e-tx-ds220", source: "tx-400-220", target: "ds-220-1", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-ds220-cb220", source: "ds-220-1", target: "cb-220", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb220-bb220", source: "cb-220", target: "bb-220kv", style: { stroke: e220Color, strokeWidth: 2 }, animated: cb220Closed, markerEnd: flowArrow(e220Color, cb220Closed) });

  // ── Edges: 220/66 transformers ──
  const cb220aOn = cbState("cb-220-a") === "CLOSED";
  const cb66aOn  = cbState("cb-66-a") === "CLOSED";
  const cb220bOn = cbState("cb-220-b") === "CLOSED";
  const cb66bOn  = cbState("cb-66-b") === "CLOSED";
  edges.push({ id: "e-bb220-cb220a", source: "bb-220kv", target: "cb-220-a", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb220a-txa", source: "cb-220-a", target: "tx-220-66-a", style: { stroke: cb220aOn ? SCADA_COLORS.VOLTAGE_220KV : SCADA_COLORS.DE_ENERGIZED, strokeWidth: 2 }, animated: cb220aOn, markerEnd: flowArrow(SCADA_COLORS.VOLTAGE_220KV, cb220aOn) });
  edges.push({ id: "e-txa-cb66a", source: "tx-220-66-a", target: "cb-66-a", style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb66a-bb66", source: "cb-66-a", target: "bb-66kv", style: { stroke: cb66aOn ? SCADA_COLORS.VOLTAGE_66KV : SCADA_COLORS.DE_ENERGIZED, strokeWidth: 2 }, animated: cb66aOn, markerEnd: flowArrow(SCADA_COLORS.VOLTAGE_66KV, cb66aOn) });

  edges.push({ id: "e-bb220-cb220b", source: "bb-220kv", target: "cb-220-b", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb220b-txb", source: "cb-220-b", target: "tx-220-66-b", style: { stroke: cb220bOn ? SCADA_COLORS.VOLTAGE_220KV : SCADA_COLORS.DE_ENERGIZED, strokeWidth: 2 }, animated: cb220bOn, markerEnd: flowArrow(SCADA_COLORS.VOLTAGE_220KV, cb220bOn) });
  edges.push({ id: "e-txb-cb66b", source: "tx-220-66-b", target: "cb-66-b", style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb66b-bb66", source: "cb-66-b", target: "bb-66kv", style: { stroke: cb66bOn ? SCADA_COLORS.VOLTAGE_66KV : SCADA_COLORS.DE_ENERGIZED, strokeWidth: 2 }, animated: cb66bOn, markerEnd: flowArrow(SCADA_COLORS.VOLTAGE_66KV, cb66bOn) });

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
    const strCbClosed = cbState(cbId) === "CLOSED";
    edges.push({
      id: `e-bb66-${cbId}`,
      source: "bb-66kv",
      target: cbId,
      style: { stroke: strCbClosed ? SCADA_COLORS.VOLTAGE_66KV : SCADA_COLORS.DE_ENERGIZED, strokeWidth: 1.5 },
      animated: strCbClosed,
      markerEnd: strCbClosed ? { type: MarkerType.ArrowClosed as const, color: SCADA_COLORS.VOLTAGE_66KV, width: 10, height: 10 } : undefined,
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

    // WTG IEDs in this string — with live turbine data if available
    for (let j = 0; j < count && wtgIdx < wtgDevices.length; j++) {
      const d = wtgDevices[wtgIdx];
      const lnCount = d.logical_devices.reduce((sum, ld) => sum + ld.logical_nodes.length, 0);
      const color = EQUIPMENT_COLOR[d.equipment_type] ?? SCADA_COLORS.DE_ENERGIZED;
      const nodeId = `ied-${d.name}`;

      // Match WTG device name to turbine ID (e.g. "WTG-01_IED" → "WTG-01")
      const turbineId = d.name.replace(/_IED$/i, "").replace(/_.*$/, "");
      const turbine = turbineMap?.[turbineId];
      const statusColorMap: Record<string, string> = {
        operating: SCADA_COLORS.ENERGIZED,
        curtailed: SCADA_COLORS.WARNING,
        fault: SCADA_COLORS.FAULT,
        offline: SCADA_COLORS.DE_ENERGIZED,
      };

      nodes.push({
        id: nodeId,
        type: "ied",
        position: { x: feederX - 5, y: feederY + 130 + j * 55 },
        data: {
          label: d.name,
          type: d.equipment_type,
          lns: lnCount,
          color,
          ...(turbine && {
            powerMW: turbine.powerOutputMW,
            windMs: turbine.windSpeedMs,
            statusColor: statusColorMap[turbine.status] ?? SCADA_COLORS.DE_ENERGIZED,
          }),
        },
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

  // Start landing simulation so turbine data is available on SCADA page
  const startSimulation = useLandingStore((s) => s.startSimulation);
  const stopSimulation = useLandingStore((s) => s.stopSimulation);
  const turbineSLDMap = useLandingStore(selectTurbineSLDMap);
  useEffect(() => {
    startSimulation();
    return () => stopSimulation();
  }, [startSimulation, stopSimulation]);

  const graph = useMemo(() => {
    if (!substationSummary?.devices) return { nodes: [], edges: [] };
    return buildGraph(substationSummary.devices, breakerStates, faultHighlightNodeId, turbineSLDMap);
  }, [substationSummary, breakerStates, faultHighlightNodeId, turbineSLDMap]);

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

/**
 * Substation single-line diagram — IEC 61850 IED topology.
 *
 * Renders the offshore substation (OSS) as an XYFlow graph showing:
 * - 400 kV grid connection → 220 kV export → OSS transformers → 66 kV busbars
 * - 34 WTG controllers organized in 6 strings
 * - OSS protection, measurement, and bay controller IEDs
 *
 * Colors follow ISA-101 / SCADA_COLORS palette.
 * Node types: protection (red), measurement (blue), bay (green), wtg (cyan).
 */

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";

// ── Equipment type → color mapping ──────────────────────────

const EQUIPMENT_COLOR: Record<string, string> = {
  protection_ied: SCADA_COLORS.FAULT,
  measurement_ied: SCADA_COLORS.VOLTAGE_220KV,
  bay_controller: SCADA_COLORS.ENERGIZED,
  wtg_controller: SCADA_COLORS.EARTHED,
};

// ── Custom Node Component ───────────────────────────────────

function IEDNode({ data }: { data: { label: string; type: string; lns: number } }) {
  const color = EQUIPMENT_COLOR[data.type] ?? SCADA_COLORS.DE_ENERGIZED;
  return (
    <div
      className="rounded border px-2 py-1 text-[10px] font-mono min-w-[90px] text-center"
      style={{ borderColor: color, backgroundColor: "rgba(15,23,42,0.95)" }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500 !w-1.5 !h-1.5" />
      <div style={{ color }} className="font-bold truncate">
        {data.label}
      </div>
      <div className="text-slate-500">{data.lns} LNs</div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !w-1.5 !h-1.5" />
    </div>
  );
}

function BusbarNode({ data }: { data: { label: string; voltage: number } }) {
  const color =
    data.voltage >= 400
      ? SCADA_COLORS.VOLTAGE_400KV
      : data.voltage >= 200
        ? SCADA_COLORS.VOLTAGE_220KV
        : SCADA_COLORS.VOLTAGE_66KV;
  return (
    <div
      className="rounded px-3 py-1.5 text-xs font-bold text-center min-w-[160px]"
      style={{ backgroundColor: color, color: "#fff" }}
    >
      <Handle type="target" position={Position.Top} className="!bg-white !w-2 !h-2" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="!bg-white !w-2 !h-2" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  ied: IEDNode,
  busbar: BusbarNode,
};

// ── Layout builder ──────────────────────────────────────────

function buildGraph(devices: { name: string; equipment_type: string; logical_devices: { logical_nodes: unknown[] }[] }[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Busbar nodes
  nodes.push({
    id: "bb-400kv",
    type: "busbar",
    position: { x: 300, y: 0 },
    data: { label: "400 kV PSE Grid", voltage: 400 },
  });
  nodes.push({
    id: "bb-220kv",
    type: "busbar",
    position: { x: 300, y: 80 },
    data: { label: "220 kV Export Cable (45 km)", voltage: 220 },
  });
  nodes.push({
    id: "bb-66kv",
    type: "busbar",
    position: { x: 300, y: 160 },
    data: { label: "66 kV Array Busbar", voltage: 66 },
  });

  edges.push({
    id: "e-400-220",
    source: "bb-400kv",
    target: "bb-220kv",
    style: { stroke: SCADA_COLORS.VOLTAGE_400KV, strokeWidth: 2 },
    animated: true,
  });
  edges.push({
    id: "e-220-66",
    source: "bb-220kv",
    target: "bb-66kv",
    style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 },
    animated: true,
  });

  // Separate OSS IEDs from WTG controllers
  const ossDevices = devices.filter(
    (d) => d.equipment_type !== "wtg_controller",
  );
  const wtgDevices = devices.filter(
    (d) => d.equipment_type === "wtg_controller",
  );

  // OSS IEDs — spread horizontally above 66 kV busbar
  ossDevices.forEach((d, i) => {
    const lnCount = d.logical_devices.reduce(
      (sum, ld) => sum + ld.logical_nodes.length,
      0,
    );
    const nodeId = `ied-${d.name}`;
    nodes.push({
      id: nodeId,
      type: "ied",
      position: { x: i * 120, y: 250 },
      data: { label: d.name, type: d.equipment_type, lns: lnCount },
    });
    edges.push({
      id: `e-66-${d.name}`,
      source: "bb-66kv",
      target: nodeId,
      style: { stroke: SCADA_COLORS.DE_ENERGIZED, strokeWidth: 1 },
    });
  });

  // WTG controllers — arrange in 6 strings (6, 6, 6, 6, 5, 5)
  const stringLayout = [6, 6, 6, 6, 5, 5];
  let wtgIdx = 0;
  const startY = 370;
  stringLayout.forEach((count, stringNum) => {
    for (let j = 0; j < count && wtgIdx < wtgDevices.length; j++) {
      const d = wtgDevices[wtgIdx];
      const lnCount = d.logical_devices.reduce(
        (sum, ld) => sum + ld.logical_nodes.length,
        0,
      );
      const nodeId = `ied-${d.name}`;
      nodes.push({
        id: nodeId,
        type: "ied",
        position: { x: j * 110, y: startY + stringNum * 65 },
        data: { label: d.name, type: d.equipment_type, lns: lnCount },
      });
      // Connect first WTG in string to 66 kV bus, rest chain
      if (j === 0) {
        edges.push({
          id: `e-str${stringNum}-${d.name}`,
          source: "bb-66kv",
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

  return { nodes, edges };
}

// ── Main Component ──────────────────────────────────────────

export default function SubstationSLD() {
  const { substationSummary } = useScadaStore();

  const graph = useMemo(() => {
    if (!substationSummary) return { nodes: [], edges: [] };
    return buildGraph(substationSummary.devices);
  }, [substationSummary]);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    instance.fitView();
  }, []);

  if (!substationSummary) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 h-[500px] flex items-center justify-center">
        <p className="text-slate-500">Loading substation configuration...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300">
          Substation Single-Line Diagram
        </h3>
        <p className="text-[10px] text-slate-500">
          {substationSummary.total_devices} IEDs &middot;{" "}
          {substationSummary.total_logical_nodes} LNs &middot; IEC 61850
          topology
        </p>
      </div>
      <div className="h-[500px]">
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#334155" gap={20} />
          <Controls className="!bg-slate-700 !border-slate-600 !rounded [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600" />
        </ReactFlow>
      </div>
    </div>
  );
}

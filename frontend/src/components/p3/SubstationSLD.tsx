/**
 * Substation single-line diagram — IEC 61850 IED topology with IEC 60617 symbols.
 *
 * Renders the offshore substation (OSS) as an XYFlow graph showing:
 * - 400 kV PSE grid → 220 kV export cable → OSS transformer → 66 kV busbars
 * - 34 WTG controllers organized in 6 strings (6,6,6,6,5,5)
 * - OSS protection, measurement, and bay controller IEDs
 *
 * Busbars rendered as thick IEC 60617 bars (voltage-colored).
 * IEDs rendered as labeled controller boxes with LN count.
 * Colors follow ISA-101 / SCADA_COLORS palette.
 */

import { useCallback, useMemo } from "react";
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
import { BusbarNode, IEDNode } from "../sld/SLDNodes";
import { InfoButton } from "../ui/InfoButton";
import { substationSldInfo } from "../../constants/panelInfo";

// ── Equipment type → ISA-101 color mapping ───────────────────

const EQUIPMENT_COLOR: Record<string, string> = {
  protection_ied: SCADA_COLORS.FAULT,
  measurement_ied: SCADA_COLORS.VOLTAGE_220KV,
  bay_controller: SCADA_COLORS.ENERGIZED,
  wtg_controller: SCADA_COLORS.EARTHED,
};

// ── XYFlow node types ────────────────────────────────────────

const nodeTypes: NodeTypes = {
  ied: IEDNode,
  busbar: BusbarNode,
};

// ── Layout builder ───────────────────────────────────────────

function buildGraph(
  devices: {
    name: string;
    equipment_type: string;
    logical_devices: { logical_nodes: unknown[] }[];
  }[],
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Busbar nodes — IEC 60617 thick bars
  nodes.push({
    id: "bb-400kv",
    type: "busbar",
    position: { x: 250, y: 0 },
    data: { label: "400 kV PSE Grid", color: SCADA_COLORS.VOLTAGE_400KV, voltage: 400 },
  });
  nodes.push({
    id: "bb-220kv",
    type: "busbar",
    position: { x: 250, y: 90 },
    data: { label: "220 kV Export Cable (45 km)", color: SCADA_COLORS.VOLTAGE_220KV, voltage: 220 },
  });
  nodes.push({
    id: "bb-66kv",
    type: "busbar",
    position: { x: 250, y: 180 },
    data: { label: "66 kV Array Busbar", color: SCADA_COLORS.VOLTAGE_66KV, voltage: 66 },
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

  // OSS IEDs — spread horizontally below 66 kV busbar
  ossDevices.forEach((d, i) => {
    const lnCount = d.logical_devices.reduce(
      (sum, ld) => sum + ld.logical_nodes.length,
      0,
    );
    const color = EQUIPMENT_COLOR[d.equipment_type] ?? SCADA_COLORS.DE_ENERGIZED;
    const nodeId = `ied-${d.name}`;
    nodes.push({
      id: nodeId,
      type: "ied",
      position: { x: i * 130, y: 270 },
      data: { label: d.name, type: d.equipment_type, lns: lnCount, color },
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
  const startY = 390;
  stringLayout.forEach((count, stringNum) => {
    for (let j = 0; j < count && wtgIdx < wtgDevices.length; j++) {
      const d = wtgDevices[wtgIdx];
      const lnCount = d.logical_devices.reduce(
        (sum, ld) => sum + ld.logical_nodes.length,
        0,
      );
      const color = EQUIPMENT_COLOR[d.equipment_type] ?? SCADA_COLORS.DE_ENERGIZED;
      const nodeId = `ied-${d.name}`;
      nodes.push({
        id: nodeId,
        type: "ied",
        position: { x: j * 120, y: startY + stringNum * 65 },
        data: { label: d.name, type: d.equipment_type, lns: lnCount, color },
      });
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

// ── Main Component ───────────────────────────────────────────

export default function SubstationSLD() {
  const { substationSummary } = useScadaStore();

  const graph = useMemo(() => {
    if (!substationSummary) return { nodes: [], edges: [] };
    return buildGraph(substationSummary.devices);
  }, [substationSummary]);

  const onInit = useCallback(
    (instance: { fitView: () => void }) => {
      instance.fitView();
    },
    [],
  );

  if (!substationSummary) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-6 h-[500px] flex items-center justify-center">
        <p className="text-text-muted">Loading substation configuration...</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
      <div className="px-4 py-2 border-b border-border-primary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">
            Substation Single-Line Diagram
          </h3>
          <InfoButton info={substationSldInfo} />
          <p className="text-[10px] text-text-muted font-mono">
            {substationSummary.total_devices} IEDs &middot;{" "}
            {substationSummary.total_logical_nodes} LNs &middot; IEC 61850
            topology
          </p>
        </div>
        {/* IED type legend */}
        <div className="flex gap-3">
          {[
            { label: "Protection", color: SCADA_COLORS.FAULT },
            { label: "Measurement", color: SCADA_COLORS.VOLTAGE_220KV },
            { label: "Bay Ctrl", color: SCADA_COLORS.ENERGIZED },
            { label: "WTG Ctrl", color: SCADA_COLORS.EARTHED },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-text-muted">{label}</span>
            </div>
          ))}
        </div>
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
          <Background color="#252a3a" gap={20} />
          <Controls className="!bg-bg-secondary !border-border-primary !rounded [&>button]:!bg-bg-secondary [&>button]:!border-border-primary [&>button]:!text-text-muted [&>button:hover]:!bg-bg-hover" />
        </ReactFlow>
      </div>
    </div>
  );
}

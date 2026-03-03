/**
 * Professional Substation Single-Line Diagram — IEC 60617 + IEC 61850.
 *
 * Full switchgear topology between voltage levels:
 *   400 kV PSE Grid ← CB-DS-TX(400/220)-DS-CB → 220 kV Export
 *   220 kV Export ← CB-DS-TX(220/66)-DS-CB → 66 kV Array Busbar
 *   66 kV Busbar → CB-DS per string → 6 strings × WTG IEDs
 *
 * All IEC 60617 symbols (CB, DS, ES, TX) are interactive — click opens
 * a detail panel showing status, ratings, and simulated controls.
 *
 * Fault highlighting driven by GOOSE simulation results from scadaStore.
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

// ── Layout builder — full switchgear topology ────────────────

function buildGraph(
  devices: {
    name: string;
    equipment_type: string;
    logical_devices: { logical_nodes: unknown[] }[];
  }[],
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const green = SCADA_COLORS.ENERGIZED;

  // ── 400 kV Section ──
  nodes.push({
    id: "bb-400kv",
    type: "busbar",
    position: { x: 300, y: 0 },
    data: { label: "400 kV PSE Grid", color: SCADA_COLORS.VOLTAGE_400KV, voltage: 400 },
  });

  // CB and DS on 400kV side of transformer
  nodes.push({
    id: "cb-400",
    type: "cb",
    position: { x: 360, y: 50 },
    data: { label: "CB-400", color: SCADA_COLORS.VOLTAGE_400KV, state: "CLOSED" },
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
    data: { label: "CB-220", color: SCADA_COLORS.VOLTAGE_220KV, state: "CLOSED" },
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
    data: { label: "CB-220A", color: SCADA_COLORS.VOLTAGE_220KV, state: "CLOSED" },
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
    data: { label: "CB-66A", color: SCADA_COLORS.VOLTAGE_66KV, state: "CLOSED" },
  });

  nodes.push({
    id: "cb-220-b",
    type: "cb",
    position: { x: 460, y: 440 },
    data: { label: "CB-220B", color: SCADA_COLORS.VOLTAGE_220KV, state: "CLOSED" },
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
    data: { label: "CB-66B", color: SCADA_COLORS.VOLTAGE_66KV, state: "CLOSED" },
  });

  // ── 66 kV Array Busbar ──
  nodes.push({
    id: "bb-66kv",
    type: "busbar",
    position: { x: 300, y: 660 },
    data: { label: "66 kV Array Busbar", color: SCADA_COLORS.VOLTAGE_66KV, voltage: 66 },
  });

  // ── Edges: 400kV section ──
  edges.push({ id: "e-bb400-cb400", source: "bb-400kv", target: "cb-400", style: { stroke: SCADA_COLORS.VOLTAGE_400KV, strokeWidth: 2 }, animated: true });
  edges.push({ id: "e-cb400-ds400", source: "cb-400", target: "ds-400-1", style: { stroke: SCADA_COLORS.VOLTAGE_400KV, strokeWidth: 2 } });
  edges.push({ id: "e-ds400-tx", source: "ds-400-1", target: "tx-400-220", style: { stroke: SCADA_COLORS.VOLTAGE_400KV, strokeWidth: 2 } });
  edges.push({ id: "e-bb400-es400", source: "bb-400kv", target: "es-400", style: { stroke: SCADA_COLORS.EARTHED, strokeWidth: 1, strokeDasharray: "4 4" } });

  // ── Edges: 220kV section ──
  edges.push({ id: "e-tx-ds220", source: "tx-400-220", target: "ds-220-1", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-ds220-cb220", source: "ds-220-1", target: "cb-220", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb220-bb220", source: "cb-220", target: "bb-220kv", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 }, animated: true });

  // ── Edges: 220/66 transformers ──
  edges.push({ id: "e-bb220-cb220a", source: "bb-220kv", target: "cb-220-a", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb220a-txa", source: "cb-220-a", target: "tx-220-66-a", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-txa-cb66a", source: "tx-220-66-a", target: "cb-66-a", style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb66a-bb66", source: "cb-66-a", target: "bb-66kv", style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 2 } });

  edges.push({ id: "e-bb220-cb220b", source: "bb-220kv", target: "cb-220-b", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb220b-txb", source: "cb-220-b", target: "tx-220-66-b", style: { stroke: SCADA_COLORS.VOLTAGE_220KV, strokeWidth: 2 } });
  edges.push({ id: "e-txb-cb66b", source: "tx-220-66-b", target: "cb-66-b", style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 2 } });
  edges.push({ id: "e-cb66b-bb66", source: "cb-66-b", target: "bb-66kv", style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 2 } });

  // ── Feeder CBs + DS per string off 66 kV busbar ──
  const stringLayout = [6, 6, 6, 6, 5, 5];
  const wtgDevices = devices.filter((d) => d.equipment_type === "wtg_controller");
  const ossDevices = devices.filter((d) => d.equipment_type !== "wtg_controller");
  let wtgIdx = 0;
  const feederStartX = 50;
  const feederY = 740;

  stringLayout.forEach((count, stringNum) => {
    const feederX = feederStartX + stringNum * 140;

    // Feeder CB off busbar
    const cbId = `cb-str${stringNum + 1}`;
    nodes.push({
      id: cbId,
      type: "cb",
      position: { x: feederX, y: feederY },
      data: { label: `CB-S${stringNum + 1}`, color: SCADA_COLORS.VOLTAGE_66KV, state: "CLOSED" },
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
      style: { stroke: SCADA_COLORS.VOLTAGE_66KV, strokeWidth: 1 },
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
  const { substationSummary } = useScadaStore();
  const [selectedNode, setSelectedNode] = useState<{ data: Record<string, unknown>; type: string } | null>(null);

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

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode({
      data: node.data as Record<string, unknown>,
      type: node.type ?? "ied",
    });
  }, []);

  if (!substationSummary) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-6 h-[600px] flex items-center justify-center">
        <p className="text-text-muted">Loading substation configuration...</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden relative">
      <div className="px-4 py-2 border-b border-border-primary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">
            Substation Single-Line Diagram
          </h3>
          <InfoButton info={substationSldInfo} />
          <p className="text-[10px] text-text-muted font-mono">
            {substationSummary.total_devices} IEDs &middot;{" "}
            {substationSummary.total_logical_nodes} LNs &middot; IEC 60617 / 61850
          </p>
        </div>
        {/* Equipment type legend */}
        <div className="flex gap-3">
          {[
            { label: "CB", color: SCADA_COLORS.ENERGIZED },
            { label: "DS", color: SCADA_COLORS.ENERGIZED },
            { label: "ES", color: SCADA_COLORS.EARTHED },
            { label: "TX", color: SCADA_COLORS.ENERGIZED },
            { label: "Protection", color: SCADA_COLORS.FAULT },
            { label: "WTG Ctrl", color: SCADA_COLORS.EARTHED },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="h-[600px]">
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

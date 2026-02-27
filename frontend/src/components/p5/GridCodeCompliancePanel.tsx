/**
 * Grid Code Compliance Panel — EON/ION/FON notification pipeline.
 *
 * Uses XYFlow to render a left-to-right node-based diagram showing the
 * three TSO notification stages and their associated compliance tests:
 *
 *   [EON] ──gate──→ [ION] ──gate──→ [FON] ──→ [COD ✓]
 *     │                │                │
 *     ├─ Test 1        ├─ Test 1        ├─ Test 1
 *     ├─ Test 2        ├─ Test 2        ├─ Test 2
 *     └─ ...           └─ ...           └─ ...
 *
 * Colour coding follows ISA-101:
 *   - Green (#00E000): compliant / approved
 *   - Gray (#808080): pending
 *   - Red (#FF0000): non-compliant
 *   - Amber (#FF6600): conditional / submitted
 *
 * Stage gate edges show prerequisites (SAT approved, programme completed).
 * Submit/Approve buttons appear on stage nodes when all tests pass.
 * FON approval triggers the COD celebration state.
 */

import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { useCommissioningStore } from "../../store/commissioningStore";
import type {
  ComplianceCampaign,
  ComplianceVerdict,
  NotificationStage,
  GridCodeTest,
} from "../../types/commissioning";

// ── Verdict colours ────────────────────────────────────────────

const VERDICT_COLORS: Record<ComplianceVerdict, string> = {
  compliant: SCADA_COLORS.ENERGIZED,
  pending: SCADA_COLORS.DE_ENERGIZED,
  non_compliant: SCADA_COLORS.ALARM_CRITICAL,
  conditional: SCADA_COLORS.ALARM_HIGH,
};

const STAGE_LABELS: Record<NotificationStage, string> = {
  eon: "EON",
  ion: "ION",
  fon: "FON",
};

const STAGE_FULL_NAMES: Record<NotificationStage, string> = {
  eon: "Energisation Operational Notification",
  ion: "Interim Operational Notification",
  fon: "Final Operational Notification",
};

const GATE_LABELS: Record<string, string> = {
  "eon-ion": "SAT approved?",
  "ion-fon": "Programme completed?",
};

// ── Layout constants ───────────────────────────────────────────

const STAGE_X: Record<NotificationStage, number> = { eon: 50, ion: 350, fon: 650 };
const STAGE_Y = 30;
const TEST_X_OFFSET = 0;
const TEST_Y_START = 130;
const TEST_Y_GAP = 45;
const COD_X = 950;

// ── Build XYFlow nodes and edges from campaign data ────────────

function buildNodesAndEdges(
  campaign: ComplianceCampaign,
  onSubmit: (stage: NotificationStage) => void,
  onApprove: (stage: NotificationStage) => void,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const stages: NotificationStage[] = ["eon", "ion", "fon"];

  for (const stage of stages) {
    const stageApp = campaign.stages[stage];
    if (!stageApp) continue;

    const allCompliant = stageApp.tests.every(
      (t: GridCodeTest) => t.verdict === "compliant",
    );
    const stageColor = VERDICT_COLORS[stageApp.status];
    const isApproved = stageApp.approved_at !== null;
    const isSubmitted = stageApp.submitted_at !== null;

    // Stage node
    const canSubmit = allCompliant && !isSubmitted;
    const canApprove = allCompliant && isSubmitted && !isApproved;

    let statusLabel = "PENDING";
    if (isApproved) statusLabel = "APPROVED";
    else if (isSubmitted) statusLabel = "SUBMITTED";
    else if (allCompliant) statusLabel = "READY";

    nodes.push({
      id: stage,
      position: { x: STAGE_X[stage], y: STAGE_Y },
      data: {
        label: (
          <div className="text-center">
            <div className="font-bold text-sm">{STAGE_LABELS[stage]}</div>
            <div className="text-[9px] text-slate-400 mt-0.5">
              {STAGE_FULL_NAMES[stage]}
            </div>
            <div
              className="text-[10px] font-bold mt-1 px-2 py-0.5 rounded inline-block"
              style={{ backgroundColor: stageColor, color: "#000" }}
            >
              {statusLabel}
            </div>
            <div className="flex gap-1 mt-1 justify-center">
              {canSubmit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSubmit(stage);
                  }}
                  className="px-2 py-0.5 bg-blue-700 hover:bg-blue-600 rounded text-[10px] text-white"
                >
                  Submit
                </button>
              )}
              {canApprove && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove(stage);
                  }}
                  className="px-2 py-0.5 bg-green-700 hover:bg-green-600 rounded text-[10px] text-white"
                >
                  Approve
                </button>
              )}
            </div>
          </div>
        ),
      },
      style: {
        border: `2px solid ${stageColor}`,
        borderRadius: "8px",
        padding: "8px",
        backgroundColor: "#1e293b",
        width: 200,
        minHeight: 60,
      },
    });

    // Test nodes (children below each stage)
    stageApp.tests.forEach((test: GridCodeTest, i: number) => {
      const testColor = VERDICT_COLORS[test.verdict];
      nodes.push({
        id: test.test_id,
        position: {
          x: STAGE_X[stage] + TEST_X_OFFSET,
          y: TEST_Y_START + i * TEST_Y_GAP,
        },
        data: {
          label: (
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: testColor }}
              />
              <div>
                <div className="text-[10px] font-medium">{test.test_id}</div>
                <div className="text-[9px] text-slate-400 truncate max-w-[150px]">
                  {test.name}
                </div>
              </div>
            </div>
          ),
        },
        style: {
          border: `1px solid ${testColor}`,
          borderRadius: "4px",
          padding: "4px 8px",
          backgroundColor: "#0f172a",
          width: 200,
          fontSize: "10px",
        },
      });

      // Edge from stage to test
      edges.push({
        id: `${stage}-${test.test_id}`,
        source: stage,
        target: test.test_id,
        style: { stroke: testColor, strokeWidth: 1 },
        type: "straight",
      });
    });
  }

  // Inter-stage edges with gate labels
  const stagePairs: [NotificationStage, NotificationStage][] = [
    ["eon", "ion"],
    ["ion", "fon"],
  ];
  for (const [from, to] of stagePairs) {
    const gateKey = `${from}-${to}`;
    edges.push({
      id: gateKey,
      source: from,
      target: to,
      label: GATE_LABELS[gateKey],
      labelStyle: { fontSize: 9, fill: "#94a3b8" },
      labelBgStyle: { fill: "#1e293b", fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
      style: { stroke: "#64748b", strokeWidth: 2 },
      type: "straight",
    });
  }

  // COD node
  const codColor = campaign.cod_achieved
    ? SCADA_COLORS.ENERGIZED
    : SCADA_COLORS.DE_ENERGIZED;
  nodes.push({
    id: "cod",
    position: { x: COD_X, y: STAGE_Y + 10 },
    data: {
      label: (
        <div className="text-center">
          <div className="font-bold text-sm">
            {campaign.cod_achieved ? "COD" : "COD"}
          </div>
          <div className="text-[9px] text-slate-400">
            Commercial Operation Date
          </div>
          {campaign.cod_achieved && campaign.cod_date && (
            <div className="text-[10px] text-green-400 mt-1 font-bold">
              ACHIEVED
            </div>
          )}
        </div>
      ),
    },
    style: {
      border: `2px solid ${codColor}`,
      borderRadius: "8px",
      padding: "8px",
      backgroundColor: campaign.cod_achieved ? "#052e16" : "#1e293b",
      width: 160,
    },
  });

  edges.push({
    id: "fon-cod",
    source: "fon",
    target: "cod",
    markerEnd: { type: MarkerType.ArrowClosed, color: codColor },
    style: { stroke: codColor, strokeWidth: 2 },
    type: "straight",
    label: "FON approved?",
    labelStyle: { fontSize: 9, fill: "#94a3b8" },
    labelBgStyle: { fill: "#1e293b", fillOpacity: 0.9 },
    labelBgPadding: [4, 2] as [number, number],
  });

  return { nodes, edges };
}

// ── Main Panel ─────────────────────────────────────────────────

export default function GridCodeCompliancePanel() {
  const {
    complianceCampaign,
    activeProgramme,
    createComplianceCampaign,
    submitNotification,
    approveNotification,
  } = useCommissioningStore();

  const handleSubmit = (stage: NotificationStage) => {
    if (!activeProgramme) return;
    submitNotification(stage, activeProgramme.pic_name);
  };

  const handleApprove = (stage: NotificationStage) => {
    approveNotification(stage);
  };

  const { nodes, edges } = complianceCampaign
    ? buildNodesAndEdges(complianceCampaign, handleSubmit, handleApprove)
    : { nodes: [], edges: [] };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">
        Grid Code Compliance (EON/ION/FON)
      </h3>

      {!complianceCampaign ? (
        <div className="text-center py-6">
          <p className="text-xs text-slate-500 mb-3">
            No compliance campaign created yet.
          </p>
          <button
            onClick={createComplianceCampaign}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded text-xs font-medium transition-colors"
          >
            Create Compliance Campaign
          </button>
        </div>
      ) : (
        <div className="h-[450px] bg-slate-900 rounded border border-slate-700">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#334155" gap={20} />
            <Controls
              showInteractive={false}
              style={{ backgroundColor: "#1e293b" }}
            />
          </ReactFlow>
        </div>
      )}

      {/* COD celebration */}
      {complianceCampaign?.cod_achieved && (
        <div className="mt-3 p-3 bg-green-900/40 border border-green-700 rounded text-center">
          <p className="text-green-400 font-bold text-sm">
            Commercial Operation Date Achieved
          </p>
          <p className="text-green-300 text-xs mt-1">
            510 MW Baltic Wind Farm — fully commissioned and grid-compliant
          </p>
          {complianceCampaign.cod_date && (
            <p className="text-green-400/70 text-[10px] mt-1">
              COD: {new Date(complianceCampaign.cod_date).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

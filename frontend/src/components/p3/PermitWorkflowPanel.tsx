/**
 * Permit-to-Work workflow panel — 9-state lifecycle visualization.
 *
 * Shows:
 * - PtW 9-step flowchart as XYFlow graph
 * - Create new permit form
 * - Active permit detail with transition controls
 * - Audit trail table
 */

import { useState, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { InfoButton } from "../ui/InfoButton";
import { permitWorkflowInfo } from "../../constants/panelInfo";

// ── PtW 9-state definitions ─────────────────────────────────

const PTW_STATES = [
  { id: "requested", label: "1. Requested", x: 0, y: 0 },
  { id: "risk_assessed", label: "2. Risk Assessed", x: 0, y: 80 },
  { id: "approved", label: "3. Approved", x: 0, y: 160 },
  { id: "issued", label: "4. Issued", x: 0, y: 240 },
  { id: "active", label: "5. Active", x: 0, y: 320 },
  { id: "work_complete", label: "6. Work Complete", x: 0, y: 400 },
  { id: "site_restored", label: "7. Site Restored", x: 0, y: 480 },
  { id: "closed", label: "8. Closed", x: 0, y: 560 },
  { id: "cancelled", label: "9. Cancelled", x: 200, y: 280 },
];

const PTW_TRANSITIONS: [string, string][] = [
  ["requested", "risk_assessed"],
  ["risk_assessed", "approved"],
  ["approved", "issued"],
  ["issued", "active"],
  ["active", "work_complete"],
  ["work_complete", "site_restored"],
  ["site_restored", "closed"],
  ["requested", "cancelled"],
  ["risk_assessed", "cancelled"],
  ["approved", "cancelled"],
];

// ── Custom Node ─────────────────────────────────────────────

function PtWStepNode({
  data,
}: {
  data: { label: string; active: boolean; completed: boolean };
}) {
  const bgColor = data.active
    ? SCADA_COLORS.WARNING
    : data.completed
      ? SCADA_COLORS.ENERGIZED
      : "#475569";
  return (
    <div
      className="rounded px-3 py-1.5 text-xs font-mono text-center min-w-[140px] border"
      style={{
        backgroundColor: `${bgColor}22`,
        borderColor: bgColor,
        color: bgColor,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-500 !w-1.5 !h-1.5"
      />
      {data.label}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-500 !w-1.5 !h-1.5"
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  ptw_step: PtWStepNode,
};

// ── Main Component ──────────────────────────────────────────

export default function PermitWorkflowPanel() {
  const {
    activePermit,
    permitList,
    selectedRoleLevel,
    createPermit,
    transitionPermit,
    roles,
  } = useScadaStore();

  const [workDesc, setWorkDesc] = useState(
    "Replace CT secondary wiring on OSS 66 kV busbar",
  );
  const [equipmentId, setEquipmentId] = useState("OSS_PROT_IED01");
  const [requestedBy, setRequestedBy] = useState("Control Engineer");

  // Build flowchart nodes/edges based on active permit state
  const graph = useMemo(() => {
    const currentStatus = activePermit?.status;
    const currentStep = activePermit?.current_step_number ?? 0;

    const nodes: Node[] = PTW_STATES.map((s) => {
      const stepNum = PTW_STATES.indexOf(s) + 1;
      return {
        id: s.id,
        type: "ptw_step",
        position: { x: s.x, y: s.y },
        data: {
          label: s.label,
          active: s.id === currentStatus,
          completed: currentStep > 0 && stepNum < currentStep,
        },
      };
    });

    const edges: Edge[] = PTW_TRANSITIONS.map(([from, to]) => ({
      id: `e-${from}-${to}`,
      source: from,
      target: to,
      style: {
        stroke:
          to === "cancelled"
            ? SCADA_COLORS.FAULT
            : SCADA_COLORS.DE_ENERGIZED,
        strokeWidth: 1,
      },
      animated: from === currentStatus,
    }));

    return { nodes, edges };
  }, [activePermit]);

  const handleCreate = useCallback(async () => {
    await createPermit({
      work_description: workDesc,
      equipment_id: equipmentId,
      requested_by: requestedBy,
    });
  }, [createPermit, workDesc, equipmentId, requestedBy]);

  const handleTransition = useCallback(
    async (targetStatus: string) => {
      if (!activePermit) return;
      const currentRole = roles.find((r) => r.level === selectedRoleLevel);
      await transitionPermit(activePermit.ptw_number, {
        target_status: targetStatus,
        performed_by: currentRole?.name ?? "Unknown",
        user_level: selectedRoleLevel,
      });
    },
    [activePermit, roles, selectedRoleLevel, transitionPermit],
  );

  const onInit = useCallback((instance: { fitView: () => void }) => {
    instance.fitView();
  }, []);

  return (
    <div className="space-y-4">
      {/* Flowchart + permit form side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 9-state flowchart */}
        <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
          <div className="px-4 py-2 border-b border-border-primary flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              PtW 9-State Lifecycle
            </h3>
            <InfoButton info={permitWorkflowInfo} />
          </div>
          <div className="h-[400px]">
            <ReactFlow
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              onInit={onInit}
              fitView
              minZoom={0.5}
              maxZoom={1.2}
              nodesDraggable={false}
              nodesConnectable={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#334155" gap={20} />
            </ReactFlow>
          </div>
        </div>

        {/* Permit control panel */}
        <div className="space-y-4">
          {/* Create permit form */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Create New Permit
            </h3>
            <div className="space-y-2">
              <input
                type="text"
                value={workDesc}
                onChange={(e) => setWorkDesc(e.target.value)}
                placeholder="Work description"
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
              />
              <input
                type="text"
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                placeholder="Equipment ID"
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
              />
              <input
                type="text"
                value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value)}
                placeholder="Requested by"
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleCreate}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold transition-colors"
              >
                Create Permit
              </button>
            </div>
          </div>

          {/* Active permit detail */}
          {activePermit && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {activePermit.ptw_number}
              </h3>
              <div className="space-y-1 text-xs mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span
                    className="font-mono font-bold"
                    style={{ color: SCADA_COLORS.WARNING }}
                  >
                    {activePermit.status.toUpperCase()} (Step{" "}
                    {activePermit.current_step_number})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Equipment</span>
                  <span className="text-slate-300 font-mono">
                    {activePermit.equipment_id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested by</span>
                  <span className="text-slate-300">
                    {activePermit.requested_by}
                  </span>
                </div>
              </div>

              {/* Transition buttons */}
              {activePermit.next_allowed_transitions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase">
                    Available Transitions
                  </p>
                  {activePermit.next_allowed_transitions.map((t) => (
                    <button
                      key={t.target_status}
                      onClick={() => handleTransition(t.target_status)}
                      className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors text-left px-3"
                    >
                      <span className="text-slate-300">
                        {t.target_status.replace(/_/g, " ")}
                      </span>
                      <span className="text-slate-500 ml-2">
                        ({t.required_permission})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent permits */}
          {permitList && permitList.permits.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Recent Permits ({permitList.total})
              </h3>
              <div className="space-y-1 max-h-[120px] overflow-y-auto">
                {permitList.permits.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between text-xs py-1 border-b border-slate-700/50"
                  >
                    <span className="text-slate-400 font-mono">
                      {p.ptw_number}
                    </span>
                    <span className="text-slate-500">{p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit trail */}
      {activePermit && activePermit.transition_log.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300">
              Audit Trail — {activePermit.ptw_number}
            </h3>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left px-3 py-1.5 text-slate-500">Time</th>
                <th className="text-left px-3 py-1.5 text-slate-500">From</th>
                <th className="text-left px-3 py-1.5 text-slate-500">To</th>
                <th className="text-left px-3 py-1.5 text-slate-500">By</th>
                <th className="text-left px-3 py-1.5 text-slate-500">Level</th>
                <th className="text-left px-3 py-1.5 text-slate-500">Notes</th>
              </tr>
            </thead>
            <tbody>
              {activePermit.transition_log.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30"
                >
                  <td className="px-3 py-1 font-mono text-slate-400">
                    {new Date(t.created_at).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-1 text-slate-400">{t.from_status}</td>
                  <td className="px-3 py-1 text-slate-300">{t.to_status}</td>
                  <td className="px-3 py-1 text-slate-300">
                    {t.performed_by}
                  </td>
                  <td className="px-3 py-1 font-mono text-slate-400">
                    L{t.user_level}
                  </td>
                  <td className="px-3 py-1 text-slate-500">
                    {t.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * LOTO (Lock-Out / Tag-Out) tracker.
 *
 * Displays a grid of padlock icons for each isolation point:
 *   - Gray padlock: not_applied (ready for locking)
 *   - Red padlock: applied (locked, danger tag attached)
 *   - Green padlock: removed (lock released after work complete)
 *
 * Each padlock has an apply/remove button. LOTO is a safety-critical
 * procedure per IEC 61936-1 §7.7: "Before work on or near live parts,
 * the installation shall be made dead and earthed, with safety locks
 * and danger tags applied."
 *
 * In real substations, each LOTO point has a physical padlock keyed to
 * the authorised person. This simulator mirrors the logical workflow.
 */

import { SCADA_COLORS } from "../../constants/scadaColors";
import { useCommissioningStore } from "../../store/commissioningStore";
import type { LOTOPoint } from "../../types/commissioning";

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  not_applied: { color: SCADA_COLORS.DE_ENERGIZED, icon: "🔓", label: "Ready" },
  applied: { color: SCADA_COLORS.FAULT, icon: "🔒", label: "Locked" },
  removed: { color: SCADA_COLORS.ENERGIZED, icon: "🔓", label: "Released" },
};

function LOTOPointCard({ point }: { point: LOTOPoint }) {
  const { applyLOTO, removeLOTO, activeProgramme } = useCommissioningStore();
  const config = STATUS_CONFIG[point.status] ?? STATUS_CONFIG.not_applied;
  const picName = activeProgramme?.pic_name ?? "PiC";

  return (
    <div
      className="bg-slate-700/50 rounded-lg p-3 border flex flex-col items-center gap-2"
      style={{ borderColor: config.color + "66" }}
    >
      {/* Padlock icon */}
      <div
        className="text-3xl w-12 h-12 flex items-center justify-center rounded-full"
        style={{ backgroundColor: config.color + "22" }}
      >
        {config.icon}
      </div>

      {/* Point info */}
      <div className="text-center">
        <div className="text-xs font-mono font-medium" style={{ color: config.color }}>
          {point.point_id}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          {point.equipment_id}
        </div>
        <div className="text-[10px] text-slate-500">
          Tag: {point.tag_number}
        </div>
      </div>

      {/* Status badge */}
      <span
        className="text-[10px] px-2 py-0.5 rounded font-medium"
        style={{ backgroundColor: config.color + "33", color: config.color }}
      >
        {config.label}
      </span>

      {/* Action buttons */}
      <div className="w-full">
        {point.status === "not_applied" && (
          <button
            onClick={() => applyLOTO(point.point_id, picName)}
            className="w-full py-1.5 bg-red-700 hover:bg-red-600 rounded text-[10px] font-medium transition-colors"
          >
            Apply Lock
          </button>
        )}
        {point.status === "applied" && (
          <div>
            <div className="text-[10px] text-slate-400 text-center mb-1">
              By: {point.locked_by}
            </div>
            <button
              onClick={() => removeLOTO(point.point_id, picName)}
              className="w-full py-1.5 bg-green-700 hover:bg-green-600 rounded text-[10px] font-medium transition-colors"
            >
              Remove Lock
            </button>
          </div>
        )}
        {point.status === "removed" && (
          <div className="text-[10px] text-slate-400 text-center">
            By: {point.removed_by}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LOTOTracker() {
  const { lotoSet } = useCommissioningStore();

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">LOTO Tracker</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Lock-Out / Tag-Out Isolation Points
          </p>
        </div>
        {lotoSet && (
          <div className="flex gap-2">
            {lotoSet.all_applied && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-600/20 text-red-400 font-medium">
                All Locked
              </span>
            )}
            {lotoSet.all_removed && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-green-600/20 text-green-400 font-medium">
                All Released
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        {!lotoSet || lotoSet.points.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-4">
            No LOTO points available
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {lotoSet.points.map((point) => (
              <LOTOPointCard key={point.point_id} point={point} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

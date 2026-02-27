/**
 * Commissioning dashboard — CSS Grid layout composing all 7 panels.
 *
 * Layout (desktop):
 * ┌─────────────────────────┬──────────────────┐
 * │   Equipment SLD (wide)  │  PiC Decision    │
 * ├─────────────────────────┤  Panel           │
 * │   Switching Programme   │──────────────────│
 * │   Viewer (wide)         │  Anomaly         │
 * │                         │  Injection       │
 * ├────────────┬────────────┼──────────────────│
 * │ LOTO       │ Audit      │  FAT/SAT         │
 * │ Tracker    │ Trail      │  Tracker          │
 * └────────────┴────────────┴──────────────────┘
 *
 * Polls the active programme every 2 seconds via the store's
 * refresh actions to keep all panels synchronized.
 */

import { useCallback, useEffect } from "react";

import { usePolling } from "../../hooks/usePolling";
import { useCommissioningStore } from "../../store/commissioningStore";
import AnomalyInjection from "./AnomalyInjection";
import AuditTrail from "./AuditTrail";
import EquipmentStateDiagram from "./EquipmentStateDiagram";
import FATSATTracker from "./FATSATTracker";
import LOTOTracker from "./LOTOTracker";
import PiCDecisionPanel from "./PiCDecisionPanel";
import SwitchingProgrammeViewer from "./SwitchingProgrammeViewer";

const POLL_INTERVAL_MS = 2000;

export default function CommissioningDashboard() {
  const {
    activeProgramme,
    error,
    refreshActiveProgramme,
    fetchLOTO,
    fetchAuditTrail,
    fetchFATCampaigns,
    fetchSATCampaign,
    clearError,
  } = useCommissioningStore();

  // Initial data load
  useEffect(() => {
    fetchLOTO();
    fetchAuditTrail();
    fetchFATCampaigns();
    fetchSATCampaign();
  }, [fetchLOTO, fetchAuditTrail, fetchFATCampaigns, fetchSATCampaign]);

  // Poll active programme state every 2s
  const pollFn = useCallback(async () => {
    await refreshActiveProgramme();
    await fetchAuditTrail();
    return null;
  }, [refreshActiveProgramme, fetchAuditTrail]);

  usePolling(pollFn, POLL_INTERVAL_MS, !!activeProgramme);

  if (!activeProgramme) return null;

  return (
    <div className="space-y-4">
      {/* Title bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{activeProgramme.title}</h2>
          <p className="text-xs text-slate-400">
            PiC: {activeProgramme.pic_name} · Programme:{" "}
            {activeProgramme.programme_id}
          </p>
        </div>
        <button
          onClick={() => useCommissioningStore.setState({ activeProgramme: null })}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium transition-colors"
        >
          Back to List
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm flex justify-between">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-200 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left column (2/3 width on xl) */}
        <div className="xl:col-span-2 space-y-4">
          <EquipmentStateDiagram />
          <SwitchingProgrammeViewer />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LOTOTracker />
            <AuditTrail />
          </div>
        </div>

        {/* Right column (1/3 width on xl) */}
        <div className="space-y-4">
          <PiCDecisionPanel />
          <AnomalyInjection />
          <FATSATTracker />
        </div>
      </div>
    </div>
  );
}

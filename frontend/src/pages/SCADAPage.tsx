/**
 * SCADA & IEC 61850 page — route /scada.
 *
 * Loads substation data on mount. Shows fault scenario selector,
 * role selector, and "Run Simulation" button. Renders SCADADashboard
 * with SLD, GOOSE timeline, alarms, PtW, and RBAC panels.
 */

import { useEffect } from "react";

import SCADADashboard from "../components/p3/SCADADashboard";
import { useScadaStore } from "../store/scadaStore";

const ROLE_OPTIONS = [
  { value: 1, label: "Viewer (L1)" },
  { value: 2, label: "Operator (L2)" },
  { value: 3, label: "Senior Operator (L3)" },
  { value: 4, label: "Engineer (L4)" },
  { value: 5, label: "Admin (L5)" },
] as const;

export default function SCADAPage() {
  const {
    substationSummary,
    faultScenarios,
    selectedFaultType,
    selectedRoleLevel,
    loading,
    error,
    dataLoaded,
    setSelectedFaultType,
    setSelectedRoleLevel,
    fetchInitialData,
    runGooseSimulation,
    clearError,
  } = useScadaStore();

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">P3 · SCADA & IEC 61850</h2>
        <p className="text-xs text-slate-400 mt-1">
          {substationSummary
            ? `${substationSummary.total_devices} IEDs · ${substationSummary.total_logical_nodes} LNs · IEC 61850-7-4 · GOOSE 8-1 · IEC 62443 RBAC`
            : "Loading substation configuration..."}
        </p>
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

      {/* Main grid: controls on right, dashboard on left */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left: Dashboard (2/3 width) */}
        <div className="xl:col-span-2">
          {dataLoaded ? (
            <SCADADashboard />
          ) : (
            <div className="flex items-center justify-center h-96 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-center">
                {loading ? (
                  <span className="flex items-center justify-center gap-2 text-slate-400">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading SCADA configuration...
                  </span>
                ) : (
                  <>
                    <p className="text-slate-400 text-lg mb-2">
                      SCADA HMI loading...
                    </p>
                    <p className="text-slate-500 text-sm">
                      IEC 61850 device registry, GOOSE configuration, RBAC
                      matrix
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Controls (1/3 width) */}
        <div className="space-y-4">
          {/* Fault scenario selector */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Fault Scenario
            </h3>
            <div className="space-y-2">
              {faultScenarios.map((s) => (
                <label
                  key={s.fault_type}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="faultType"
                    value={s.fault_type}
                    checked={selectedFaultType === s.fault_type}
                    onChange={() => setSelectedFaultType(s.fault_type)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-slate-300">
                    {s.description}
                  </span>
                </label>
              ))}
              {faultScenarios.length === 0 && (
                <p className="text-xs text-slate-500">
                  Loading scenarios...
                </p>
              )}
            </div>
          </div>

          {/* Role selector */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Active Role (IEC 62443)
            </h3>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={selectedRoleLevel === opt.value}
                    onChange={() => setSelectedRoleLevel(opt.value)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-slate-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Run Simulation button */}
          <button
            onClick={runGooseSimulation}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running Simulation...
              </span>
            ) : (
              "Run GOOSE Simulation"
            )}
          </button>

          {/* Reference box */}
          <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3">
            <p className="text-xs text-slate-500">
              <strong>Standards:</strong> IEC 61850-7-4 (LN classes), IEC
              61850-8-1 (GOOSE), IEC 62443 (RBAC), ISA-18.2 (alarms)
            </p>
            <p className="text-xs text-slate-500 mt-1">
              <strong>Simulation:</strong> Deterministic fault clearance with
              GOOSE retransmission per §15.2.2
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

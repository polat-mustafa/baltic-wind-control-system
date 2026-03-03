/**
 * SCADA & IEC 61850 page — route /scada.
 *
 * Loads substation data on mount. Shows fault scenario selector,
 * role selector, and "Run Simulation" button. Renders SCADADashboard
 * with SLD, GOOSE timeline, alarms, PtW, and RBAC panels.
 */

import { useEffect } from "react";
import { Monitor } from "lucide-react";

import SCADADashboard from "../components/p3/SCADADashboard";
import { useScadaStore } from "../store/scadaStore";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";

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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          P3 · SCADA & IEC 61850
        </h2>
        <p className="text-xs text-text-muted mt-1 font-mono">
          {substationSummary
            ? `${substationSummary.total_devices} IEDs · ${substationSummary.total_logical_nodes} LNs · IEC 61850-7-4 · GOOSE 8-1 · IEC 62443 RBAC`
            : "Loading substation configuration..."}
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between items-center">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Main grid: controls on right, dashboard on left */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: Dashboard (2/3 width) */}
        <div className="xl:col-span-2">
          {dataLoaded ? (
            <SCADADashboard />
          ) : (
            <div className="flex items-center justify-center h-96 rounded-lg border border-border-primary bg-bg-secondary shadow-lg shadow-black/20">
              <div className="text-center">
                {loading ? (
                  <span className="flex items-center justify-center gap-2 text-text-secondary">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading SCADA configuration...
                  </span>
                ) : (
                  <>
                    <div className="flex justify-center mb-4">
                      <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                        <Monitor size={24} className="text-accent" />
                      </div>
                    </div>
                    <p className="text-text-secondary text-base mb-2">
                      SCADA HMI loading...
                    </p>
                    <p className="text-text-muted text-sm">
                      IEC 61850 device registry, GOOSE configuration, RBAC matrix
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
          <Card>
            <CardHeader>
              <CardTitle>Fault Scenario</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {faultScenarios.map((s) => (
                  <label
                    key={s.fault_type}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name="faultType"
                      value={s.fault_type}
                      checked={selectedFaultType === s.fault_type}
                      onChange={() => setSelectedFaultType(s.fault_type)}
                      className="accent-accent"
                    />
                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                      {s.description}
                    </span>
                  </label>
                ))}
                {faultScenarios.length === 0 && (
                  <p className="text-xs text-text-muted">Loading scenarios...</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Role selector */}
          <Card>
            <CardHeader>
              <CardTitle>Active Role (IEC 62443)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ROLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name="role"
                      value={opt.value}
                      checked={selectedRoleLevel === opt.value}
                      onChange={() => setSelectedRoleLevel(opt.value)}
                      className="accent-accent"
                    />
                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Run Simulation button */}
          <Button
            onClick={runGooseSimulation}
            disabled={loading}
            className="w-full py-3"
            size="lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running Simulation...
              </span>
            ) : (
              "Run GOOSE Simulation"
            )}
          </Button>

          {/* Reference box */}
          <div className="rounded-lg border border-border-primary bg-bg-tertiary p-3">
            <p className="text-xs text-text-muted">
              <span className="font-medium text-text-secondary">Standards:</span>{" "}
              IEC 61850-7-4, IEC 61850-8-1 (GOOSE), IEC 62443 (RBAC), ISA-18.2
            </p>
            <p className="text-xs text-text-muted mt-1">
              <span className="font-medium text-text-secondary">Simulation:</span>{" "}
              Deterministic fault clearance with GOOSE retransmission per &sect;15.2.2
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

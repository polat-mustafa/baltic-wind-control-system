/**
 * SCADA KPI strip — system-level status tiles (Level-1 supplement).
 *
 * Per ISA-101, color appears only when the operator must look. Tiles
 * default to grayscale "normal" priority and shift to warning/alarm
 * priority when their value leaves its normal band.
 *
 * Tiles: Total IEDs, Logical Nodes, Active Permits, GOOSE Compliance,
 * Protection Events.
 */

import { useScadaStore } from "../../store/scadaStore";
import { InfoTile, type TilePriority } from "../ui/InfoTile";

export default function SCADAKPIHeader() {
  const substationSummary = useScadaStore((s) => s.substationSummary);
  const simulationResult = useScadaStore((s) => s.simulationResult);
  const permitList = useScadaStore((s) => s.permitList);

  if (!substationSummary) return null;

  const activePermits =
    permitList?.permits.filter(
      (p) => p.status === "active" || p.status === "issued",
    ).length ?? 0;

  const gooseCompliant = simulationResult?.compliance.goose_compliant;
  const clearanceCompliant = simulationResult?.compliance.clearance_compliant;
  const compliancePass = gooseCompliant && clearanceCompliant;

  const criticalEvents =
    simulationResult?.events.filter(
      (e) =>
        e.event_type === "relay_trip" || e.event_type === "breaker_open",
    ).length ?? 0;

  const compliancePriority: TilePriority =
    gooseCompliant === undefined
      ? "normal"
      : compliancePass
        ? "normal"
        : "alarm";

  const eventsPriority: TilePriority =
    criticalEvents === 0 ? "normal" : "warning";

  const permitsPriority: TilePriority =
    activePermits === 0 ? "normal" : activePermits > 5 ? "alarm" : "info";

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border-primary">
      <InfoTile
        label="Total IEDs"
        value={substationSummary.total_devices}
        unit="devices"
        subtitle={`${substationSummary.protection_ieds} prot · ${substationSummary.wtg_controllers} WTG`}
      />
      <InfoTile
        label="Logical Nodes"
        value={substationSummary.total_logical_nodes}
        unit="LN"
        subtitle="IEC 61850-7-4"
      />
      <InfoTile
        label="Active Permits"
        value={activePermits}
        unit="PtW"
        subtitle={`${permitList?.total ?? 0} total in system`}
        priority={permitsPriority}
        normalBand={[0, 5]}
      />
      <InfoTile
        label="GOOSE Compliance"
        value={gooseCompliant === undefined ? "—" : compliancePass ? "PASS" : "FAIL"}
        subtitle={
          simulationResult
            ? `${simulationResult.compliance.goose_latency_ms.toFixed(1)} ms latency`
            : "Run simulation"
        }
        priority={compliancePriority}
      />
      <InfoTile
        label="Protection Events"
        value={criticalEvents}
        unit="alerts"
        subtitle={
          simulationResult
            ? `${simulationResult.events.length} total events`
            : "No simulation run"
        }
        priority={eventsPriority}
        normalBand={[0, 0]}
      />
    </div>
  );
}

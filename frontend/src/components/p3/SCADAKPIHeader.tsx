/**
 * KPI summary cards — top-level SCADA metrics.
 *
 * Displays: Total IEDs, Logical Nodes, Active Permits, GOOSE Compliance, Alerts.
 * Color-coded per ISA-101: green = normal, amber = warning, red = fault.
 */

import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";

interface KPICardProps {
  label: string;
  value: string;
  unit: string;
  color?: string;
  subtitle?: string;
}

function KPICard({ label, value, unit, color, subtitle }: KPICardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p
        className="text-2xl font-bold mt-1"
        style={color ? { color } : undefined}
      >
        {value}
        <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
      </p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function SCADAKPIHeader() {
  const { substationSummary, simulationResult, permitList } = useScadaStore();

  if (!substationSummary) return null;

  const activePermits =
    permitList?.permits.filter(
      (p) => p.status === "active" || p.status === "issued",
    ).length ?? 0;

  const gooseCompliant = simulationResult?.compliance.goose_compliant;
  const clearanceCompliant = simulationResult?.compliance.clearance_compliant;

  const complianceColor =
    gooseCompliant === undefined
      ? SCADA_COLORS.DE_ENERGIZED
      : gooseCompliant && clearanceCompliant
        ? SCADA_COLORS.ENERGIZED
        : SCADA_COLORS.FAULT;

  const criticalEvents =
    simulationResult?.events.filter(
      (e) =>
        e.event_type === "relay_trip" || e.event_type === "breaker_open",
    ).length ?? 0;

  const alertColor =
    criticalEvents > 0 ? SCADA_COLORS.ALARM_CRITICAL : SCADA_COLORS.ENERGIZED;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KPICard
        label="Total IEDs"
        value={String(substationSummary.total_devices)}
        unit="devices"
        color={SCADA_COLORS.ENERGIZED}
        subtitle={`${substationSummary.protection_ieds} prot + ${substationSummary.wtg_controllers} WTG`}
      />
      <KPICard
        label="Logical Nodes"
        value={String(substationSummary.total_logical_nodes)}
        unit="LNs"
        color={SCADA_COLORS.VOLTAGE_220KV}
        subtitle="IEC 61850-7-4 hierarchy"
      />
      <KPICard
        label="Active Permits"
        value={String(activePermits)}
        unit="PtW"
        color={
          activePermits > 0 ? SCADA_COLORS.WARNING : SCADA_COLORS.ENERGIZED
        }
        subtitle={`${permitList?.total ?? 0} total in system`}
      />
      <KPICard
        label="GOOSE Compliance"
        value={
          gooseCompliant === undefined
            ? "---"
            : gooseCompliant && clearanceCompliant
              ? "PASS"
              : "FAIL"
        }
        unit=""
        color={complianceColor}
        subtitle={
          simulationResult
            ? `${simulationResult.compliance.goose_latency_ms.toFixed(1)} ms latency`
            : "Run simulation first"
        }
      />
      <KPICard
        label="Protection Events"
        value={String(criticalEvents)}
        unit="alerts"
        color={alertColor}
        subtitle={
          simulationResult
            ? `${simulationResult.events.length} total events`
            : "No simulation run"
        }
      />
    </div>
  );
}

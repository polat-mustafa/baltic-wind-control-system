/**
 * Slide-out detail panel for SLD equipment.
 *
 * Shows context-appropriate information when a node is clicked:
 *   - Circuit Breaker: status, trip count, last operation, operate button
 *   - Transformer: MVA, tap position, temperatures, load, cooling
 *   - Disconnector/Earth Switch: status, operate button
 *   - IED: logical nodes, comms status, firmware
 */

import { X } from "lucide-react";

import { SCADA_COLORS } from "../../constants/scadaColors";

interface SLDDetailPanelProps {
  nodeData: Record<string, unknown>;
  nodeType: string;
  onClose: () => void;
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-[#6b7490]">{label}</span>
      <span className="text-[11px] font-mono tabular-nums font-medium" style={{ color: color ?? "#e8eaf0" }}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 border-b" style={{ borderColor: "#1e2231" }}>
      <div className="text-[10px] text-[#6b7490] uppercase tracking-wider mb-1">{title}</div>
      {children}
    </div>
  );
}

function CBDetail({ data }: { data: Record<string, unknown> }) {
  const state = (data.state as string) ?? "CLOSED";
  const color = state === "CLOSED" ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.DE_ENERGIZED;
  return (
    <>
      <Section title="Circuit Breaker">
        <Row label="Status" value={state} color={color} />
        <Row label="Trip Count" value="0" />
        <Row label="Last Operation" value="—" />
        <Row label="Rated Current" value="2000 A" />
        <Row label="Breaking Capacity" value="40 kA" />
      </Section>
      <Section title="Control (Simulated)">
        <div className="flex gap-2 mt-1">
          <button className="flex-1 text-[10px] py-1 rounded border text-center" style={{ borderColor: SCADA_COLORS.ENERGIZED, color: SCADA_COLORS.ENERGIZED }}>
            CLOSE
          </button>
          <button className="flex-1 text-[10px] py-1 rounded border text-center" style={{ borderColor: SCADA_COLORS.FAULT, color: SCADA_COLORS.FAULT }}>
            TRIP
          </button>
        </div>
      </Section>
    </>
  );
}

function TXDetail({ data }: { data: Record<string, unknown> }) {
  return (
    <Section title="Transformer">
      <Row label="Rating" value={(data.rating as string) ?? "300 MVA"} />
      <Row label="Status" value={(data.state as string) ?? "IN SERVICE"} />
      <Row label="Tap Position" value="0 / 17" />
      <Row label="Oil Temperature" value="52.1 °C" />
      <Row label="HV Winding" value="62.3 °C" />
      <Row label="LV Winding" value="58.1 °C" />
      <Row label="Load" value="78.2 %" />
      <Row label="Cooling" value="ONAF-1" />
    </Section>
  );
}

function DSDetail({ data }: { data: Record<string, unknown> }) {
  const state = (data.state as string) ?? "CLOSED";
  const color = state === "CLOSED" ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.DE_ENERGIZED;
  return (
    <Section title="Disconnector">
      <Row label="Status" value={state} color={color} />
      <Row label="Rated Voltage" value="66 kV" />
      <Row label="Rated Current" value="1250 A" />
    </Section>
  );
}

function ESDetail({ data }: { data: Record<string, unknown> }) {
  const state = (data.state as string) ?? "OPEN";
  const color = state === "CLOSED" ? SCADA_COLORS.EARTHED : SCADA_COLORS.DE_ENERGIZED;
  return (
    <Section title="Earth Switch">
      <Row label="Status" value={state} color={color} />
      <Row label="Type" value="Fast-acting" />
    </Section>
  );
}

function IEDDetail({ data }: { data: Record<string, unknown> }) {
  return (
    <Section title="IED Details">
      <Row label="Type" value={(data.type as string) ?? "—"} />
      <Row label="Logical Nodes" value={String(data.lns ?? 0)} />
      <Row label="Comms Status" value="Online" color={SCADA_COLORS.ENERGIZED} />
      <Row label="Protocol" value="IEC 61850 MMS" />
      <Row label="Firmware" value="v4.2.1" />
    </Section>
  );
}

export default function SLDDetailPanel({ nodeData, nodeType, onClose }: SLDDetailPanelProps) {
  const label = (nodeData.label as string) ?? "Equipment";

  return (
    <div
      className="absolute right-4 top-12 z-50 rounded-lg shadow-2xl shadow-black/50 border overflow-hidden"
      style={{ backgroundColor: "#0f1117", borderColor: "#2a3040", width: 260 }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: "#2a3040" }}>
        <span className="text-sm font-semibold text-[#e8eaf0] font-mono">{label}</span>
        <button onClick={onClose} className="text-[#6b7490] hover:text-[#e8eaf0] transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Context-specific content */}
      {nodeType === "cb" && <CBDetail data={nodeData} />}
      {nodeType === "tx" && <TXDetail data={nodeData} />}
      {nodeType === "ds" && <DSDetail data={nodeData} />}
      {nodeType === "es" && <ESDetail data={nodeData} />}
      {nodeType === "ied" && <IEDDetail data={nodeData} />}
      {nodeType === "busbar" && (
        <Section title="Busbar">
          <Row label="Voltage" value={`${nodeData.voltage ?? "—"} kV`} />
          <Row label="Status" value="Energized" color={SCADA_COLORS.ENERGIZED} />
        </Section>
      )}
    </div>
  );
}

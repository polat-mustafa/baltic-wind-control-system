/**
 * STATCOM detail panel.
 *
 * ABB SVC Light / Siemens SVC Plus reactive power compensator at the
 * Offshore Substation. Reports live Q, capability headroom, control mode,
 * MMC valve module status, control loop coefficients per ENTSO-E NC RfG.
 *
 * Q sign convention: +ve = injecting (capacitive, leading), −ve = absorbing
 * (inductive, lagging). Rated ±120 MVAr static + 50 MVAr shunt reactor.
 */

import { useMemo } from "react";

import { X, Waves } from "lucide-react";

import { selectKPIs, useLandingStore } from "../../store/landingStore";
import { SCADA_COLORS } from "../../constants/scadaColors";

interface STATCOMDetailPanelProps {
  onClose: () => void;
}

const RATED_MVAR = 120;
const SHUNT_REACTOR_MVAR = 50;

function Row({
  label,
  value,
  color = "var(--color-text-primary)",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span
        className="text-[11px] font-mono tabular-nums font-medium"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2 border-t border-bg-tertiary">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

export default function STATCOMDetailPanel({
  onClose,
}: STATCOMDetailPanelProps) {
  const kpis = useLandingStore(selectKPIs);

  // Q derived from total power (same formula as the marker icon).
  const reactiveQ = useMemo(() => {
    const raw = ((255 - kpis.totalOutputMW) / 510) * 90;
    return Math.round(Math.max(-120, Math.min(120, raw)));
  }, [kpis.totalOutputMW]);

  const isInjecting = reactiveQ > 5;
  const isAbsorbing = reactiveQ < -5;
  const liveColor = isInjecting
    ? SCADA_COLORS.WARNING
    : isAbsorbing
      ? SCADA_COLORS.ALARM_MEDIUM
      : "var(--color-text-secondary)";
  const mode = isInjecting
    ? "INJECT (capacitive)"
    : isAbsorbing
      ? "ABSORB (inductive)"
      : "STANDBY";
  const headroomMVAr = RATED_MVAR - Math.abs(reactiveQ);
  const utilization = (Math.abs(reactiveQ) / RATED_MVAR) * 100;

  // 6 IGBT MMC submodule strings — colour by load
  const mmcModules = Array.from({ length: 6 }).map((_, i) => {
    const stress = Math.min(
      1,
      (Math.abs(reactiveQ) / RATED_MVAR) * (0.85 + i * 0.05),
    );
    return { id: `MMC-${i + 1}`, stress };
  });

  // V-Q droop slope per ENTSO-E NC RfG Type D (typical ±5% voltage band).
  const droopPct = 4.0;

  return (
    <div
      className="absolute rounded-lg shadow-2xl shadow-black/50 border border-border-primary bg-bg-primary overflow-hidden"
      style={{
        zIndex: 1100,
        width: 340,
        right: 16,
        top: 80,
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-primary flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-text-primary flex items-center gap-2">
            STATCOM · OSS-1
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-bold"
              style={{ backgroundColor: `${liveColor}22`, color: liveColor }}
            >
              {isInjecting ? "INJECT" : isAbsorbing ? "ABSORB" : "STANDBY"}
            </span>
          </div>
          <div className="text-[10px] text-text-muted">
            SVC Plus MMC · ±120 MVAr · IEC 62927
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-tertiary"
          aria-label="Close STATCOM panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Live Q + capability bar */}
      <div className="px-3 py-2 border-b border-border-primary">
        <div className="flex items-baseline justify-between mb-1.5">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-text-muted">
              Reactive Power
            </div>
            <div
              className="text-2xl font-bold tabular-nums"
              style={{ color: liveColor }}
            >
              {reactiveQ >= 0 ? "+" : ""}
              {reactiveQ}
              <span className="text-xs text-text-muted ml-1 font-normal">
                MVAr
              </span>
            </div>
          </div>
          <div className="text-right text-[10px] text-text-muted font-mono">
            <div>
              Headroom{" "}
              <span className="text-text-secondary font-bold">
                {headroomMVAr}
              </span>{" "}
              MVAr
            </div>
            <div>
              Utilization{" "}
              <span className="text-text-secondary font-bold">
                {utilization.toFixed(0)}
              </span>{" "}
              %
            </div>
          </div>
        </div>
        {/* Centre-zero ±120 MVAr bar */}
        <div className="relative h-3 bg-bg-primary border border-border-primary rounded-sm overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-px bg-border-secondary"
            style={{ left: "50%" }}
          />
          {reactiveQ > 0 && (
            <div
              className="absolute top-0 bottom-0 transition-all duration-700"
              style={{
                left: "50%",
                width: `${(Math.abs(reactiveQ) / RATED_MVAR) * 50}%`,
                backgroundColor: liveColor,
                opacity: 0.85,
              }}
            />
          )}
          {reactiveQ < 0 && (
            <div
              className="absolute top-0 bottom-0 transition-all duration-700"
              style={{
                right: "50%",
                width: `${(Math.abs(reactiveQ) / RATED_MVAR) * 50}%`,
                backgroundColor: liveColor,
                opacity: 0.85,
              }}
            />
          )}
        </div>
        <div className="flex justify-between text-[8px] text-text-muted font-mono mt-0.5">
          <span>−120 absorb</span>
          <span>0</span>
          <span>+120 inject</span>
        </div>
      </div>

      {/* Mode / setpoints */}
      <Section title="Control Mode">
        <Row label="Mode" value={mode} color={liveColor} />
        <Row
          label="Q Setpoint"
          value={`${reactiveQ >= 0 ? "+" : ""}${reactiveQ} MVAr`}
        />
        <Row label="V Setpoint (POI)" value="220.0 kV" />
        <Row label="V-Q Droop" value={`${droopPct.toFixed(1)} %`} />
        <Row label="Response Time (1-step)" value="< 5 s" />
      </Section>

      {/* MMC Valve module status */}
      <Section title="MMC Valve Modules">
        <div className="flex items-end gap-1 mt-1 mb-0.5 h-12">
          {mmcModules.map((m) => (
            <div
              key={m.id}
              className="flex-1 flex flex-col items-center gap-0.5"
              title={`${m.id}: ${(m.stress * 100).toFixed(0)} %`}
            >
              <div className="w-full h-full bg-bg-primary border border-border-primary rounded-sm overflow-hidden flex items-end">
                <div
                  className="w-full transition-all duration-700"
                  style={{
                    height: `${Math.max(8, m.stress * 100)}%`,
                    backgroundColor:
                      m.stress > 0.85
                        ? SCADA_COLORS.FAULT
                        : m.stress > 0.6
                          ? SCADA_COLORS.WARNING
                          : SCADA_COLORS.ALARM_MEDIUM,
                    opacity: 0.9,
                  }}
                />
              </div>
              <span className="text-[7px] text-text-muted font-mono">
                {m.id.replace("MMC-", "")}
              </span>
            </div>
          ))}
        </div>
        <Row
          label="IGBT Junction Temp (max)"
          value={`${(78 + utilization * 0.4).toFixed(0)} °C`}
        />
        <Row label="DC-link Voltage" value="32.4 kV" />
        <Row label="Switching Frequency" value="950 Hz" />
      </Section>

      {/* Companion plant */}
      <Section title="Companion Plant">
        <Row
          label="Shunt Reactor"
          value={`${SHUNT_REACTOR_MVAR} MVAr (always-on)`}
        />
        <Row label="Coupling Transformer" value="35/22 kV · Ynd11" />
        <Row label="Filter Branch" value="2nd + 5th harmonic, 8 MVAr" />
        <Row label="DC Capacitor Bank" value="Σ 280 µF · 3.3 MJ" />
      </Section>

      {/* Compliance footer */}
      <div className="px-3 py-2 border-t border-bg-tertiary bg-bg-primary">
        <div className="flex items-center gap-2 text-[10px] text-text-muted">
          <Waves size={11} />
          <span>
            ENTSO-E NC RfG Type D · IEEE 1547 voltage support compliant
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-text-muted">Status</span>
          <span
            className="text-[10px] font-bold"
            style={{ color: SCADA_COLORS.ENERGIZED }}
          >
            ● HEALTHY · 0 ALARMS
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * STATCOM detail panel — ±120 MVAr VSC (MMC) at the OSS 220 kV busbar.
 *
 * Centrepiece is the reactive power balance it closes: 2 × 45 km export
 * cables generate ~260 MVAr, 3 × 80 MVAr shunt reactors (N+1) absorb the
 * bulk, transformer/cable I²X losses absorb more as output rises, and the
 * STATCOM trims the remainder so Q ≈ 0 at the grid connection.
 *
 * Q sign convention (domain rule 4): generating/injecting positive.
 */

import { useNavigate } from "react-router-dom";

import { AudioWaveform } from "lucide-react";

import { selectKPIs, useLandingStore } from "../../store/landingStore";
import { useStatcomQ } from "../../store/liveGridStore";
import {
  REACTOR_COUNT,
  REACTOR_UNIT_MVAR,
  STATCOM_RATING_MVAR,
  reactiveBalance,
} from "../../utils/landingPhysics";
import {
  DataRow,
  EquipmentPanel,
  HeroValue,
  LevelBar,
  PanelSection,
} from "./EquipmentPanel";

const INJECT_COLOR = "#f5a623";
const ABSORB_COLOR = "#4FC3D8";
const IDLE_COLOR = "#9ba3b8";
const NORMAL_COLOR = "#3ecf6e";
/** Full scale of the balance bars [MVAr]. */
const BALANCE_SCALE = 300;

const signed = (q: number) => `${q > 0 ? "+" : q < 0 ? "−" : ""}${Math.abs(q).toFixed(0)}`;

function BalanceRow({ label, q, color }: { label: string; q: number; color: string }) {
  return (
    <div className="grid grid-cols-[1fr_96px_52px] items-center gap-2 py-[3px]">
      <span className="text-xs text-text-secondary">{label}</span>
      <LevelBar value={q} min={-BALANCE_SCALE} max={BALANCE_SCALE} color={color} height={6} />
      <span className="text-right font-mono text-xs tabular-nums" style={{ color }}>
        {signed(q)}
      </span>
    </div>
  );
}

export default function STATCOMDetailPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const kpis = useLandingStore(selectKPIs);
  const b = reactiveBalance(kpis.totalOutputMW);
  // Hero value = the same Q as map and ribbon (pandapower when solved); the
  // balance rows below stay the simplified textbook breakdown.
  const statcom = useStatcomQ(kpis.totalOutputMW);
  const q = Math.round(statcom.q);

  const mode = q > 5 ? "INJECTING" : q < -5 ? "ABSORBING" : "FLOATING";
  const modeColor = q > 5 ? INJECT_COLOR : q < -5 ? ABSORB_COLOR : IDLE_COLOR;
  const utilisationPct = (Math.abs(q) / STATCOM_RATING_MVAR) * 100;
  const net = b.cableMVAr + b.reactorsMVAr + b.seriesLossMVAr + b.statcomMVAr;

  return (
    <EquipmentPanel
      icon={AudioWaveform}
      tag="STATCOM-OSS-01"
      subtitle="VSC · modular multilevel · ±120 MVAr · OSS 220 kV busbar"
      status={{ label: "In service", color: NORMAL_COLOR }}
      onClose={onClose}
      action={{ label: "Open HV Grid · STATCOM sizing", onClick: () => navigate("/hv-grid") }}
      footnote={
        statcom.source === "pandapower"
          ? "IEC 62927 · ENTSO-E NC RfG Type D · PSE IRiESP — Q from the live pandapower load flow; balance rows are the simplified model"
          : "IEC 62927 · ENTSO-E NC RfG Type D · PSE IRiESP — simplified live model (backend load flow not reachable)"
      }
    >
      {/* Live Q + capability */}
      <div className="px-4 py-3 border-b border-border-primary/60">
        <div className="flex items-end justify-between">
          <HeroValue caption="Reactive power" value={signed(q)} unit="MVAr" color={modeColor} />
          <div className="pb-1 text-right">
            <div className="text-[11px] font-bold tracking-wider" style={{ color: modeColor }}>
              {mode}
            </div>
            <div className="font-mono text-[11px] text-text-muted tabular-nums">
              {utilisationPct.toFixed(0)} % of rating
            </div>
          </div>
        </div>
        <div className="mt-2.5">
          <LevelBar value={q} min={-STATCOM_RATING_MVAR} max={STATCOM_RATING_MVAR} color={modeColor} />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-text-muted">
            <span>−120 absorb</span>
            <span>0</span>
            <span>inject +120</span>
          </div>
        </div>
      </div>

      <PanelSection title="Reactive balance · OSS 220 kV" aside="MVAr">
        <BalanceRow label="Export cable charging" q={b.cableMVAr} color={INJECT_COLOR} />
        <BalanceRow
          label={`Shunt reactors (${b.reactorsInService}/${REACTOR_COUNT})`}
          q={b.reactorsMVAr}
          color={ABSORB_COLOR}
        />
        <BalanceRow label="Series I²X losses" q={b.seriesLossMVAr} color={ABSORB_COLOR} />
        <BalanceRow label="STATCOM" q={b.statcomMVAr} color={modeColor} />
        <div className="mt-1.5 flex items-baseline justify-between border-t border-border-primary/60 pt-1.5">
          <span className="text-xs font-medium text-text-primary">Net at grid connection</span>
          <span className="font-mono text-xs font-semibold tabular-nums" style={{ color: NORMAL_COLOR }}>
            {signed(net)} MVAr
          </span>
        </div>
      </PanelSection>

      <PanelSection title={`Shunt reactors · ${REACTOR_COUNT} × ${REACTOR_UNIT_MVAR} MVAr (N+1)`}>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: REACTOR_COUNT }, (_, i) => {
            const inService = i < b.reactorsInService;
            return (
              <div
                key={i}
                className="rounded-lg border px-2 py-1.5 text-center"
                style={{
                  borderColor: inService ? `${ABSORB_COLOR}66` : "var(--color-border-primary)",
                  backgroundColor: inService ? `${ABSORB_COLOR}12` : "transparent",
                }}
              >
                <div className="font-mono text-xs font-semibold text-text-primary">R{i + 1}</div>
                <div
                  className="text-[10px] font-medium"
                  style={{ color: inService ? ABSORB_COLOR : "var(--color-text-muted)" }}
                >
                  {inService ? "In service" : "Standby"}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-text-muted">
          One reactor is switched out near rated output, when I²X losses would
          otherwise push the STATCOM past +60 MVAr.
        </p>
      </PanelSection>

      <PanelSection title="Control">
        <DataRow label="Mode" value="Voltage control (V–Q droop)" />
        <DataRow label="Voltage setpoint" value="1.000 pu" unit="220 kV" />
        <DataRow label="Droop" value="4.0" unit="%" hint="ΔV for full ±120 MVAr" />
        <DataRow label="Headroom" value={`±${STATCOM_RATING_MVAR - Math.abs(q)}`} unit="MVAr" />
        <DataRow label="Step response (90 %)" value="< 5" unit="s" />
        <DataRow
          label="IGBT junction, hottest valve"
          value={(45 + utilisationPct * 0.5).toFixed(0)}
          unit="°C"
        />
      </PanelSection>
    </EquipmentPanel>
  );
}

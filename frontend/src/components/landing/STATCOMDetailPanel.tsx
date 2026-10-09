/**
 * STATCOM detail panel — VSC (MMC) at the OSS 220 kV busbar of the live fleet
 * (SB-510: ±120 MVAr).
 *
 * Centrepiece is the reactive power balance it closes: the export cables
 * generate their charging power (SB-510: 2 × 108 km ≈ 624 MVAr), the shunt
 * reactors (SB-510: 4 × 180 MVAr, one per export circuit at each end) absorb the bulk, transformer/cable I²X
 * losses absorb more as output rises, and the STATCOM trims the remainder so
 * Q ≈ 0 at the grid connection.
 *
 * Q sign convention (domain rule 4): generating/injecting positive.
 */

import { useNavigate } from "react-router-dom";

import { AudioWaveform } from "lucide-react";

import { useFleet } from "../../lib/fleet";
import { selectKPIs, useLandingStore } from "../../store/landingStore";
import { usePlantSnapshot } from "../../store/liveGridStore";
import {
  plantNet,
  reactiveBalance,
} from "../../utils/landingPhysics";
import {
  DataRow,
  EquipmentPanel,
  HeroValue,
  LevelBar,
  PanelSection,
} from "./EquipmentPanel";

const INJECT_COLOR = "#f0b13e";
const ABSORB_COLOR = "#4FC3D8";
const IDLE_COLOR = "#a3b6c8";
const NORMAL_COLOR = "#4cc38a";
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
  const pn = plantNet(useFleet());
  const rating = pn.statcomMVAr;
  // Hero value, reactors in service and STATCOM row = the same as map, ribbon and
  // SLD (pandapower when solved); cable charging and I²X stay the textbook estimate.
  const plant = usePlantSnapshot();
  const est = reactiveBalance(kpis.totalOutputMW, pn);
  const b = {
    ...est,
    reactorsInService: plant.reactorsInService,
    reactorsMVAr: -plant.reactorsInService * pn.reactorUnitMVAr,
    statcomMVAr: plant.statcomMVAr,
  };
  const statcom = { q: plant.statcomMVAr, source: plant.source };
  const q = Math.round(statcom.q);

  const mode = q > 5 ? "INJECTING" : q < -5 ? "ABSORBING" : "FLOATING";
  const modeColor = q > 5 ? INJECT_COLOR : q < -5 ? ABSORB_COLOR : IDLE_COLOR;
  const utilisationPct = (Math.abs(q) / rating) * 100;
  // load flow: what really reaches PSE; estimate: the rows close to 0 by construction
  const net = plant.source === "pandapower" ? plant.pocMVAr : b.cableMVAr + b.reactorsMVAr + b.seriesLossMVAr + b.statcomMVAr;

  return (
    <EquipmentPanel
      icon={AudioWaveform}
      tag="STATCOM-OSS-01"
      subtitle={`VSC · modular multilevel · ±${rating} MVAr · OSS 220 kV busbar`}
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
            <div className="text-xs font-bold tracking-wider" style={{ color: modeColor }}>
              {mode}
            </div>
            <div className="font-mono text-xs text-text-muted tabular-nums">
              {utilisationPct.toFixed(0)} % of rating
            </div>
          </div>
        </div>
        <div className="mt-2.5">
          <LevelBar value={q} min={-rating} max={rating} color={modeColor} />
          <div className="mt-1 flex justify-between font-mono text-xs text-text-muted">
            <span>−{rating} absorb</span>
            <span>0</span>
            <span>inject +{rating}</span>
          </div>
        </div>
      </div>

      <PanelSection title="Reactive balance · OSS 220 kV" aside="MVAr">
        <BalanceRow label="Export cable charging" q={b.cableMVAr} color={INJECT_COLOR} />
        <BalanceRow
          label={`Shunt reactors (${b.reactorsInService}/${pn.reactorCount})`}
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

      {pn.reactorCount > 0 && (
      <PanelSection title={`Shunt reactors · ${pn.reactorCount} × ${pn.reactorUnitMVAr} MVAr (onshore + OSS)`}>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: pn.reactorCount }, (_, i) => {
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
                  className="text-xs font-medium"
                  style={{ color: inService ? ABSORB_COLOR : "var(--color-text-muted)" }}
                >
                  {inService ? "In service" : "Standby"}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-snug text-text-muted">
          One reactor per export circuit at each cable end, so each end carries
          about half of the charging current. Reactors are switched out as output
          rises, when I²X losses would otherwise push the STATCOM past +{rating / 2} MVAr.
        </p>
      </PanelSection>
      )}

      <PanelSection title="Control">
        <DataRow label="Mode" value="Voltage control (V–Q droop)" />
        <DataRow label="Voltage setpoint" value="1.000 pu" unit="220 kV" />
        <DataRow label="Droop" value="4.0" unit="%" hint={`ΔV for full ±${rating} MVAr`} />
        <DataRow label="Headroom" value={`±${rating - Math.abs(q)}`} unit="MVAr" />
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

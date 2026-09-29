/**
 * Export cable detail panel — 2 × 45 km 220 kV XLPE submarine circuits.
 *
 * Live values come from the shared cable model (utils/landingPhysics):
 * per-circuit current = active current + half the charging current in
 * quadrature, steady-state conductor temperature against the 90 °C XLPE
 * limit, I²R losses, and the capacitive charging that sizes the reactors.
 */

import { Cable } from "lucide-react";

import { selectKPIs, useLandingStore } from "../../store/landingStore";
import type { CableData } from "../../types/landing";
import { EXPORT_CABLE, exportCableState } from "../../utils/landingPhysics";
import { DataRow, EquipmentPanel, HeroValue, LevelBar, PanelSection } from "./EquipmentPanel";

interface CableDetailPanelProps {
  cable: CableData;
  onClose: () => void;
  onNavigate: () => void;
}

const NORMAL = "#3ecf6e";
const WARN = "#f5a623";
const ALARM = "#ef4444";

const levelColor = (v: number, warn: number, alarm: number) => (v >= alarm ? ALARM : v >= warn ? WARN : NORMAL);

export default function CableDetailPanel({ cable, onClose, onNavigate }: CableDetailPanelProps) {
  const kpis = useLandingStore(selectKPIs);
  const s = exportCableState(kpis.totalOutputMW);
  const loadColor = levelColor(s.loadingPct, 80, 100);
  const tempColor = levelColor(s.conductorC, 80, EXPORT_CABLE.maxConductorC);

  return (
    <EquipmentPanel
      icon={Cable}
      tag="EXP-CBL-01/02"
      subtitle={`2 × ${cable.lengthKm} km · ${cable.voltageRatingKV} kV · 3-core ${cable.crossSectionMm2} mm² XLPE submarine`}
      status={{ label: "Energised", color: NORMAL }}
      onClose={onClose}
      action={{ label: "Open HV Grid · cable loading & DTS", onClick: onNavigate }}
      footnote="IEC 60287 rating · IEC 60840 cable system · simplified live model; full load flow in P2"
    >
      <div className="border-b border-border-primary/60 px-4 py-3">
        <div className="flex items-end justify-between">
          <HeroValue caption="Current per circuit" value={s.currentA.toFixed(0)} unit="A" color={loadColor} />
          <div className="pb-1 text-right font-mono text-[11px] tabular-nums text-text-muted">
            <span className="text-text-primary">{s.loadingPct.toFixed(0)} %</span> of {cable.currentRatingA} A
          </div>
        </div>
        <div className="mt-2.5">
          <LevelBar value={s.loadingPct} max={120} color={loadColor} marks={[{ at: 100, color: ALARM }]} />
        </div>
      </div>

      <PanelSection title="Thermal" aside={`XLPE limit ${EXPORT_CABLE.maxConductorC} °C`}>
        <div className="grid grid-cols-[1fr_120px_56px] items-center gap-2 py-[3px]">
          <span className="text-xs text-text-secondary">Conductor (steady state)</span>
          <LevelBar
            value={s.conductorC}
            max={100}
            color={tempColor}
            height={6}
            marks={[{ at: EXPORT_CABLE.maxConductorC, color: `${ALARM}aa` }]}
          />
          <span className="text-right font-mono text-xs tabular-nums" style={{ color: tempColor }}>
            {s.conductorC.toFixed(0)} °C
          </span>
        </div>
        <DataRow label="Seabed ambient" value={EXPORT_CABLE.seabedC} unit="°C" />
        <DataRow label="Burial depth" value={cable.burialDepthM} unit="m" />
        <p className="mt-1.5 text-[11px] leading-snug text-text-muted">
          Temperature follows I²: at 73 % current the conductor sits near 55 °C, leaving margin for
          dynamic rating (see DTS in P2).
        </p>
      </PanelSection>

      <PanelSection title="Electrical">
        <DataRow
          label="Charging per circuit"
          value={s.chargingMVArPerCircuit.toFixed(0)}
          unit="MVAr"
          hint="Q = ωCV²L — why the OSS needs shunt reactors"
        />
        <DataRow label="I²R losses (both circuits)" value={s.lossesMW.toFixed(2)} unit="MW" />
        <DataRow label="R / X / C per km" value={`${EXPORT_CABLE.rOhmPerKm} Ω · ${EXPORT_CABLE.xOhmPerKm} Ω · ${EXPORT_CABLE.cNfPerKm} nF`} />
        <DataRow label="Insulation" value="XLPE" />
        <DataRow label="Supplier (reference)" value={cable.manufacturer} />
      </PanelSection>
    </EquipmentPanel>
  );
}

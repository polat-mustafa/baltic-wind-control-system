/**
 * Export cable detail panel — the live fleet's 220 kV XLPE circuits. SB-510:
 * 2 × 108 km, 79.3 km subsea (OSS → round Ławica Słupska → Darłówko-Wschodnie landfall) +
 * 28.7 km land cable to the onshore SS; an own project: n × its export length
 * (route not surveyed).
 *
 * Live values come from the shared cable model (utils/landingPhysics):
 * per-circuit current = active current + half the charging current in
 * quadrature, steady-state conductor temperature against the 90 °C XLPE
 * limit, I²R losses, and the capacitive charging that sizes the reactors.
 */

import { Cable } from "lucide-react";

import { useFleet } from "../../lib/fleet";
import { selectKPIs, useLandingStore } from "../../store/landingStore";
import type { CableData } from "../../types/landing";
import { EXPORT_CABLE, exportCableState, plantNet } from "../../utils/landingPhysics";
import { DataRow, EquipmentPanel, HeroValue, LevelBar, PanelSection } from "./EquipmentPanel";

interface CableDetailPanelProps {
  cable: CableData;
  onClose: () => void;
  onNavigate: () => void;
}

const NORMAL = "#4cc38a";
const WARN = "#f0b13e";
const ALARM = "#f25c54";

const levelColor = (v: number, warn: number, alarm: number) => (v >= alarm ? ALARM : v >= warn ? WARN : NORMAL);

export default function CableDetailPanel({ cable, onClose, onNavigate }: CableDetailPanelProps) {
  const kpis = useLandingStore(selectKPIs);
  const fleet = useFleet();
  const net = plantNet(fleet);
  const sb510 = fleet.source === "sb510";
  const s = exportCableState(kpis.totalOutputMW, net);
  const loadColor = levelColor(s.loadingPct, 80, 100);
  const tempColor = levelColor(s.conductorC, 80, EXPORT_CABLE.maxConductorC);

  return (
    <EquipmentPanel
      icon={Cable}
      tag={["EXP-CBL-01", "EXP-CBL-01/02"][net.circuits - 1] ?? `EXP-CBL-01…0${net.circuits}`}
      subtitle={`${net.circuits} × ${cable.lengthKm.toFixed(0)} km${sb510 ? " (79.3 subsea + 28.7 land)" : ""} · ${cable.voltageRatingKV} kV · ${cable.crossSectionMm2} mm² XLPE`}
      status={{ label: "Energised", color: NORMAL }}
      onClose={onClose}
      action={{ label: "Open HV Grid · cable loading & DTS", onClick: onNavigate }}
      footnote="IEC 60287 rating · IEC 60840 cable system · simplified live model; full load flow in P2"
    >
      <div className="border-b border-border-primary/60 px-4 py-3">
        <div className="flex items-end justify-between">
          <HeroValue caption="Current per circuit" value={s.currentA.toFixed(0)} unit="A" color={loadColor} />
          <div className="pb-1 text-right font-mono text-xs tabular-nums text-text-muted">
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
        <DataRow label="Route" value={sb510 ? "OSS → Darłówko (HDD) → Krzemienica" : "OSS → grid node (not yet surveyed)"} />
        <p className="mt-1.5 text-xs leading-snug text-text-muted">
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
        <DataRow label={["I²R losses", "I²R losses (both circuits)"][net.circuits - 1] ?? "I²R losses (all circuits)"} value={s.lossesMW.toFixed(2)} unit="MW" />
        <DataRow label="R / X / C per km" value={`${EXPORT_CABLE.rOhmPerKm} Ω · ${EXPORT_CABLE.xOhmPerKm} Ω · ${EXPORT_CABLE.cNfPerKm} nF`} />
        <DataRow label="Insulation" value="XLPE" />
        <DataRow label="Supplier (reference)" value={cable.manufacturer} />
      </PanelSection>
    </EquipmentPanel>
  );
}

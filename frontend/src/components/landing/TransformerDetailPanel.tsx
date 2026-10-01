/**
 * Transformer detail panel — two identical units in parallel per substation
 * (OSS 66/220 kV, onshore 220/400 kV; 2 × 300 MVA, N-1).
 *
 * Shows loading against installed capacity, what an N-1 unit trip would cost,
 * top-oil / hot-spot temperatures against alarm limits (IEC 60076-7),
 * OLTC position, cooling stage and protection/condition (Buchholz, DGA).
 */

import { Zap } from "lucide-react";

import {
  OSS_BUSBAR_SECTION,
  TURBINE_POSITIONS,
} from "../../constants/windFarmLayout";
import { useLandingStore } from "../../store/landingStore";
import type { TransformerData } from "../../types/landing";
import {
  DataRow,
  EquipmentPanel,
  HeroValue,
  LevelBar,
  PanelSection,
} from "./EquipmentPanel";

interface TransformerDetailPanelProps {
  transformer: TransformerData;
  onClose: () => void;
  onNavigate: () => void;
  navLabel: string;
}

const NORMAL = "#3ecf6e";
const WARN = "#f5a623";
const ALARM = "#ef4444";
const COOLING_STAGES: TransformerData["coolingStatus"][] = [
  "ONAN",
  "ONAF-1",
  "ONAF-2",
];

function levelColor(value: number, warn: number, alarm: number): string {
  return value >= alarm ? ALARM : value >= warn ? WARN : NORMAL;
}

function conditionColor(status: string): string {
  return status === "Normal" ? NORMAL : status === "Trip" ? ALARM : WARN;
}

function TempRow({
  label,
  value,
  warn,
  alarm,
}: {
  label: string;
  value: number;
  warn: number;
  alarm: number;
}) {
  const color = levelColor(value, warn, alarm);
  return (
    <div className="grid grid-cols-[1fr_110px_56px] items-center gap-2 py-[3px]">
      <span className="text-xs text-text-secondary">{label}</span>
      <LevelBar
        value={value}
        max={120}
        color={color}
        height={6}
        marks={[
          { at: warn, color: `${WARN}aa` },
          { at: alarm, color: `${ALARM}aa` },
        ]}
      />
      <span
        className="text-right font-mono text-xs tabular-nums"
        style={{ color }}
      >
        {value.toFixed(1)} °C
      </span>
    </div>
  );
}

const STRING_NUMBERS = [1, 2, 3, 4, 5, 6];

/**
 * OSS 66 kV switchboard: six string feeders, strings 1–3 on section A
 * (TX-OSS-01), 4–6 on section B (TX-OSS-02), bus coupler normally open —
 * so each OSS transformer carries its own section's strings.
 */
function Switchboard66({ stringMW }: { stringMW: number[] }) {
  const fault = useLandingStore((s) => s.arrayFault);
  return (
    <PanelSection title="66 kV switchboard" aside="coupler BAY-OSS-66-08 open">
      <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-3 gap-y-[3px] font-mono text-[11px] tabular-nums">
        {STRING_NUMBERS.map((n) => {
          const open = fault?.stringNumber === n && fault.stage === "tripped";
          const wtg = TURBINE_POSITIONS.filter(
            (t) => t.stringNumber === n,
          ).length;
          return (
            <div key={n} className="contents">
              <span className="text-text-secondary">BAY-OSS-66-0{n}</span>
              <span className="text-text-muted">
                S{n} · {wtg} WTG · {OSS_BUSBAR_SECTION[n]}
              </span>
              <span className="text-right text-text-primary">
                {stringMW[n - 1].toFixed(1)} MW
              </span>
              <span style={{ color: open ? ALARM : NORMAL }}>
                {open ? "OPEN" : "CLOSED"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-text-muted">
        Feeder protection 50/51 + 51N per string. Platform: topside with
        helideck (CAP 437) for access when seas exceed the vessel limits.
      </p>
    </PanelSection>
  );
}

export default function TransformerDetailPanel({
  transformer: tx,
  onClose,
  onNavigate,
  navLabel,
}: TransformerDetailPanelProps) {
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const isOss = tx.lvKV === 66;
  const stringMW = STRING_NUMBERS.map((n) =>
    TURBINE_POSITIONS.filter((t) => t.stringNumber === n).reduce(
      (sum, t) => sum + (turbineMap[t.id]?.powerOutputMW ?? 0),
      0,
    ),
  );
  // OSS: each unit carries its own 66 kV section (WTGs at ≈ unity pf, so
  // MVA ≈ MW); onshore: the two units share the export equally.
  const sectionMW = (unit: number) =>
    STRING_NUMBERS.filter(
      (n) => OSS_BUSBAR_SECTION[n] === (unit === 0 ? "A" : "B"),
    ).reduce((sum, n) => sum + stringMW[n - 1], 0);
  const installedMVA = tx.units * tx.ratingMVA;
  const throughputMVA = (tx.loadPercent / 100) * installedMVA;
  // N-1: the surviving unit carries at most its own rating; the rest is curtailed.
  const n1CurtailMW = Math.max(0, throughputMVA - tx.ratingMVA);
  const loadColor = levelColor(tx.loadPercent, 85, 100);
  const tapRange = (tx.totalTaps - 1) / 2;
  const base = tx.name.replace(/-\d+\/\d+$/, "");
  const worst = [tx.buchholzStatus, tx.dgaStatus].find((s) => s !== "Normal");

  return (
    <EquipmentPanel
      icon={Zap}
      tag={tx.name}
      subtitle={`${tx.units} × ${tx.ratingMVA} MVA · ${tx.lvKV}/${tx.hvKV} kV · ${tx.type}`}
      status={
        worst
          ? { label: worst, color: conditionColor(worst) }
          : { label: "Energised", color: NORMAL }
      }
      onClose={onClose}
      action={{ label: navLabel, onClick: onNavigate }}
      footnote="IEC 60076-7 thermal limits · IEC 60599 DGA · simplified live model"
    >
      <div className="px-4 py-3 border-b border-border-primary/60">
        <div className="flex items-end justify-between">
          <HeroValue
            caption="Loading"
            value={tx.loadPercent.toFixed(1)}
            unit="%"
            color={loadColor}
          />
          <div className="pb-1 text-right font-mono text-[11px] tabular-nums text-text-muted">
            <span className="text-text-primary">
              {throughputMVA.toFixed(0)}
            </span>{" "}
            / {installedMVA} MVA
          </div>
        </div>
        <div className="mt-2.5">
          <LevelBar
            value={tx.loadPercent}
            max={120}
            color={loadColor}
            marks={[{ at: 100, color: ALARM }]}
          />
        </div>
      </div>

      <PanelSection
        title={
          isOss
            ? "Units · one per 66 kV section"
            : "Units · parallel, equal sharing"
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: tx.units }, (_, i) => {
            const unitMVA = isOss ? sectionMW(i) : throughputMVA / tx.units;
            const unitPct = (unitMVA / tx.ratingMVA) * 100;
            return (
              <div
                key={i}
                className="rounded-lg border border-border-primary bg-bg-secondary/60 px-2.5 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-text-primary">
                    {base}-{String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: NORMAL }}
                  />
                </div>
                <div className="mt-0.5 text-[10px] text-text-muted">
                  {isOss
                    ? `66 kV section ${String.fromCharCode(65 + i)} · S${i === 0 ? "1–3" : "4–6"}`
                    : `Circuit ${i + 1}`}
                </div>
                <div
                  className="mt-1 font-mono text-sm tabular-nums"
                  style={{ color: levelColor(unitPct, 85, 100) }}
                >
                  {unitPct.toFixed(0)} %
                  <span className="ml-1 text-[10px] text-text-muted">
                    {unitMVA.toFixed(0)} MVA
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <DataRow
          label="If one unit trips (N-1)"
          value={
            n1CurtailMW > 0
              ? `curtail ${n1CurtailMW.toFixed(0)} MW`
              : "no curtailment"
          }
          color={n1CurtailMW > 0 ? WARN : NORMAL}
          hint={`The remaining unit carries at most ${tx.ratingMVA} MVA`}
        />
      </PanelSection>

      {isOss && <Switchboard66 stringMW={stringMW} />}

      <PanelSection title="Temperatures" aside="limits: warn · alarm">
        <TempRow
          label="Top oil"
          value={tx.oilTemperatureC}
          warn={70}
          alarm={85}
        />
        <TempRow
          label="Hot-spot HV"
          value={tx.windingTempHVC}
          warn={80}
          alarm={95}
        />
        <TempRow
          label="Hot-spot LV"
          value={tx.windingTempLVC}
          warn={80}
          alarm={95}
        />
      </PanelSection>

      <PanelSection title="Tap changer & cooling">
        <DataRow
          label="OLTC position"
          value={`${tx.tapPosition > 0 ? "+" : ""}${tx.tapPosition}`}
          unit={`of ±${tapRange}`}
        />
        <div className="mt-1 mb-3 flex gap-[2px]">
          {Array.from({ length: tx.totalTaps }, (_, i) => {
            const pos = i - tapRange;
            return (
              <div
                key={pos}
                className="h-2 flex-1 rounded-[1px]"
                style={{
                  backgroundColor:
                    pos === tx.tapPosition
                      ? "var(--color-accent)"
                      : pos === 0
                        ? "var(--color-border-secondary)"
                        : "var(--color-bg-tertiary)",
                }}
              />
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-bg-tertiary p-0.5">
          {COOLING_STAGES.map((stage) => (
            <div
              key={stage}
              className="rounded-md py-1 text-center font-mono text-[11px]"
              style={
                stage === tx.coolingStatus
                  ? {
                      backgroundColor: "var(--color-bg-elevated)",
                      color: "var(--color-text-primary)",
                    }
                  : { color: "var(--color-text-muted)" }
              }
            >
              {stage}
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Protection & condition">
        <DataRow
          label="Buchholz relay"
          value={tx.buchholzStatus}
          color={conditionColor(tx.buchholzStatus)}
        />
        <DataRow
          label="Dissolved gas (DGA)"
          value={tx.dgaStatus}
          color={conditionColor(tx.dgaStatus)}
        />
        <DataRow
          label="Operating hours"
          value={tx.operatingHours.toLocaleString("en-US")}
          unit="h"
        />
      </PanelSection>
    </EquipmentPanel>
  );
}

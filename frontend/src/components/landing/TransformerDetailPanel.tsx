/**
 * Transformer detail panel — two identical units in parallel per substation
 * (OSS 66/220 kV, onshore 220/400 kV; 2 × 300 MVA, N-1).
 *
 * Shows loading against installed capacity, a live single-line diagram of
 * the OSS (strings → split 66 kV board → transformers → 220 kV busbar →
 * export circuits), what an N-1 unit trip would cost, top-oil / hot-spot
 * temperatures with the insulation ageing rate (IEC 60076-7), OLTC position,
 * cooling stage and protection/condition (Buchholz, DGA). Each section ends
 * with one line on why the quantity matters.
 */

import type { ReactNode } from "react";

import { Zap } from "lucide-react";

import { type Fleet, sectionOf, stringsOn, useFleet } from "../../lib/fleet";
import { useLandingStore } from "../../store/landingStore";
import type { TransformerData } from "../../types/landing";
import { ageingRate } from "../../utils/landingPhysics";
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

const NORMAL = "#4cc38a";
const WARN = "#f0b13e";
const ALARM = "#f25c54";
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

/** One line under a section: why the quantity matters. */
function Why({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs leading-snug text-text-muted">{children}</p>;
}

/** "S1–3" for strings 0..2 (0-based in, 1-based out). */
const stringRange = (ids: number[]) =>
  ids.length > 1 ? `S${ids[0] + 1}–${ids[ids.length - 1] + 1}` : ids.length ? `S${ids[0] + 1}` : "—";

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

const V66 = "var(--color-voltage-66kv)";
const V220 = "var(--color-voltage-220kv)";
const INK = "var(--color-text-secondary)";
const MUTED = "var(--color-text-muted)";
/** Theme-aware level colour for SVG text (inline fills skip the light-theme overrides). */
const levelVar = (v: number) =>
  `var(--color-status-${v >= 100 ? "alarm" : v >= 85 ? "warning" : "normal"})`;

/**
 * Live single-line diagram of the OSS: one feeder per string on the split
 * 66 kV board (section A strings feed TX-OSS-01, section B TX-OSS-02, bus
 * coupler normally open), the two transformers, the 220 kV busbar with the
 * STATCOM, and one export circuit per cable with its OSS-end shunt reactor.
 * Energised feeders march towards the busbar (power-flow direction).
 */
function OssSld({ fleet, stringMW, unitPct }: { fleet: Fleet; stringMW: number[]; unitPct: number[] }) {
  const fault = useLandingStore((s) => s.arrayFault);
  const W = 328;
  const MID = W / 2;
  const BUS220 = 44;
  const BUS66 = 112;
  const sections = (["A", "B"] as const).map((sec, k) => {
    const ids = stringsOn(fleet, sec);
    const x0 = k === 0 ? 8 : MID + 10;
    const x1 = k === 0 ? MID - 10 : W - 8;
    const step = (x1 - x0) / Math.max(1, ids.length);
    return { ids, x0, x1, xs: ids.map((_, j) => x0 + step * (j + 0.5)), tx: (x0 + x1) / 2 };
  });
  const circuits = fleet.net.num_export_cables;
  // One reactor per export circuit at each cable end → the OSS holds one per circuit
  const reactors = fleet.net.num_reactors >= 2 * circuits;
  const cx = (i: number) => MID + (i - (circuits - 1) / 2) * 56;

  return (
    <svg viewBox={`0 0 ${W} 196`} className="w-full" role="img" aria-label="OSS single-line diagram">
      {/* Export circuits to shore, each with its OSS-end shunt reactor */}
      {Array.from({ length: circuits }, (_, i) => (
        <g key={i}>
          <line x1={cx(i)} y1={6} x2={cx(i)} y2={BUS220} stroke={V220} strokeWidth={2} />
          {reactors && (
            <>
              <line x1={cx(i)} y1={24} x2={cx(i) + 12} y2={24} stroke={V220} strokeWidth={1.5} />
              <path d={`M${cx(i) + 12} 18 a6 6 0 1 1 0 12`} fill="none" stroke={V220} strokeWidth={1.5} />
            </>
          )}
          <text x={cx(i) - 5} y={16} textAnchor="end" fontSize={12} fill={MUTED}>
            C{i + 1}
          </text>
        </g>
      ))}
      <text x={8} y={16} fontSize={12} fill={MUTED}>
        to shore ↑
      </text>
      {/* 220 kV busbar + STATCOM */}
      <line x1={sections[0].tx - 24} y1={BUS220} x2={W - 30} y2={BUS220} stroke={V220} strokeWidth={3} />
      <text x={8} y={BUS220 + 4} fontSize={12} fill={V220} fontWeight={600}>
        220 kV
      </text>
      <line x1={W - 30} y1={BUS220} x2={W - 30} y2={BUS220 - 14} stroke={V220} strokeWidth={1.5} />
      <rect x={W - 58} y={BUS220 - 31} width={56} height={17} rx={2} fill="none" stroke={V220} strokeWidth={1.2} />
      <text x={W - 30} y={BUS220 - 18} textAnchor="middle" fontSize={11} fill={INK}>
        STATCOM
      </text>
      {/* Transformers: HV winding over LV winding */}
      {sections.map((sec, k) => (
        <g key={k}>
          <line x1={sec.tx} y1={BUS220} x2={sec.tx} y2={58} stroke={V220} strokeWidth={2} />
          <circle cx={sec.tx} cy={68} r={10} fill="none" stroke={V220} strokeWidth={1.8} />
          <circle cx={sec.tx} cy={81} r={10} fill="none" stroke={V66} strokeWidth={1.8} />
          <line x1={sec.tx} y1={91} x2={sec.tx} y2={BUS66} stroke={V66} strokeWidth={2} />
          <text x={sec.tx + 16} y={72} fontSize={12} fill={INK} fontWeight={600}>
            TX-{String(k + 1).padStart(2, "0")}
          </text>
          <text x={sec.tx + 16} y={87} fontSize={12} fill={levelVar(unitPct[k] ?? 0)}>
            {(unitPct[k] ?? 0).toFixed(0)} %
          </text>
        </g>
      ))}
      {/* Split 66 kV board, bus coupler normally open */}
      {sections.map((sec, k) => (
        <line key={k} x1={sec.x0} y1={BUS66} x2={sec.x1} y2={BUS66} stroke={V66} strokeWidth={3} />
      ))}
      <rect x={MID - 5} y={BUS66 - 5} width={10} height={10} fill="var(--color-bg-primary)" stroke={INK} strokeWidth={1.2} />
      <text x={sections[0].x0} y={BUS66 - 7} fontSize={12} fill={V66} fontWeight={600}>
        66 kV A
      </text>
      <text x={sections[1].x1} y={BUS66 - 7} textAnchor="end" fontSize={12} fill={V66} fontWeight={600}>
        B
      </text>
      {/* Feeders: one per string; CB filled = closed */}
      {sections.flatMap((sec) =>
        sec.ids.map((i, j) => {
          const x = sec.xs[j];
          const open = fault?.stringNumber === i + 1 && fault.stage === "tripped";
          const mw = stringMW[i] ?? 0;
          const flowing = !open && mw > 0.5;
          return (
            <g key={i}>
              <line
                x1={x}
                y1={164}
                x2={x}
                y2={BUS66}
                stroke={open ? MUTED : V66}
                strokeWidth={1.8}
                strokeDasharray={open ? "3 3" : flowing ? "6 2" : undefined}
                className={flowing ? "dwg-flow" : undefined}
              />
              <rect
                x={x - 5}
                y={BUS66 + 12}
                width={10}
                height={10}
                fill={open ? "var(--color-bg-primary)" : V66}
                stroke={open ? "var(--color-status-alarm)" : V66}
                strokeWidth={1.5}
              />
              <text x={x} y={178} textAnchor="middle" fontSize={12} fill={INK} fontWeight={600}>
                S{i + 1}
              </text>
              <text x={x} y={192} textAnchor="middle" fontSize={11} fill={open ? "var(--color-status-alarm)" : MUTED}>
                {open ? "OPEN" : `${mw.toFixed(0)} MW`}
              </text>
            </g>
          );
        }),
      )}
    </svg>
  );
}

export default function TransformerDetailPanel({
  transformer: tx,
  onClose,
  onNavigate,
  navLabel,
}: TransformerDetailPanelProps) {
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const fleet = useFleet();
  const isOss = tx.lvKV === 66;
  const stringMW = fleet.strings.map((ids) =>
    ids.reduce((sum, id) => sum + (turbineMap[id]?.powerOutputMW ?? 0), 0),
  );
  // OSS: each unit carries its own 66 kV section (WTGs at ≈ unity pf, so
  // MVA ≈ MW); onshore: the two units share the export equally.
  const sectionMW = (unit: number) =>
    stringMW.filter((_, i) => sectionOf(fleet, i) === (unit === 0 ? "A" : "B")).reduce((sum, mw) => sum + mw, 0);
  const installedMVA = tx.units * tx.ratingMVA;
  const throughputMVA = (tx.loadPercent / 100) * installedMVA;
  const unitMVA = Array.from({ length: tx.units }, (_, i) => (isOss ? sectionMW(i) : throughputMVA / tx.units));
  const unitPct = unitMVA.map((mva) => (mva / tx.ratingMVA) * 100);
  // N-1: the surviving unit carries at most its own rating; the rest is curtailed.
  const n1CurtailMW = Math.max(0, throughputMVA - tx.ratingMVA);
  const n1CarriedShare = throughputMVA > 0 ? Math.min(1, tx.ratingMVA / throughputMVA) : 1;
  const loadColor = levelColor(tx.loadPercent, 85, 100);
  const tapRange = (tx.totalTaps - 1) / 2;
  const base = tx.name.replace(/-\d+\/\d+$/, "");
  const worst = [tx.buchholzStatus, tx.dgaStatus].find((s) => s !== "Normal");
  const hotSpot = Math.max(tx.windingTempHVC, tx.windingTempLVC);
  const ageing = ageingRate(hotSpot);

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
      footnote="IEC 60076-7 thermal limits and ageing · IEC 60599 DGA · simplified live model"
    >
      <div className="px-4 py-3 border-b border-border-primary/60">
        <div className="flex items-end justify-between">
          <HeroValue
            caption="Loading"
            value={tx.loadPercent.toFixed(1)}
            unit="%"
            color={loadColor}
          />
          <div className="pb-1 text-right font-mono text-xs tabular-nums text-text-muted">
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
        <Why>
          Apparent power S = √(P² + Q²). The turbines run near unity power factor, so MVA ≈ MW here.
        </Why>
      </div>

      {isOss ? (
        <PanelSection title="How power flows through the OSS" aside="live">
          <OssSld fleet={fleet} stringMW={stringMW} unitPct={unitPct} />
          <Why>
            Each string has its own feeder breaker (50/51 + 51N). The 66 kV board is split in two with the
            coupler open, so a fault on one section only takes out half the farm.
          </Why>
        </PanelSection>
      ) : (
        <PanelSection title="Units · parallel, equal sharing">
          <div className="grid grid-cols-2 gap-2">
            {unitMVA.map((mva, i) => (
              <div key={i} className="rounded border border-border-primary bg-bg-secondary/60 px-2.5 py-2">
                <div className="font-mono text-xs font-semibold text-text-primary">
                  {base}-{String(i + 1).padStart(2, "0")}
                </div>
                <div className="mt-0.5 text-xs text-text-muted">Circuit {i + 1}</div>
                <div className="mt-1 font-mono text-sm tabular-nums" style={{ color: levelColor(unitPct[i], 85, 100) }}>
                  {unitPct[i].toFixed(0)} %<span className="ml-1 text-xs text-text-muted">{mva.toFixed(0)} MVA</span>
                </div>
              </div>
            ))}
          </div>
        </PanelSection>
      )}

      <PanelSection title="If one unit trips (N-1)" aside={n1CurtailMW > 0 ? `curtail ${n1CurtailMW.toFixed(0)} MW` : "no curtailment"}>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
          <div style={{ width: `${n1CarriedShare * 100}%`, backgroundColor: NORMAL }} />
          <div style={{ width: `${(1 - n1CarriedShare) * 100}%`, backgroundColor: WARN }} />
        </div>
        <div className="mt-1 font-mono text-xs tabular-nums text-text-muted">
          {`healthy unit carries ${Math.min(throughputMVA, tx.ratingMVA).toFixed(0)} of ${throughputMVA.toFixed(0)} MVA`}
        </div>
        <Why>
          {isOss
            ? `The coupler closes and the healthy unit picks up both sections (${stringRange(stringsOn(fleet, "A"))} + ${stringRange(stringsOn(fleet, "B"))}), but only up to its own ${tx.ratingMVA} MVA — the rest must be curtailed.`
            : `The healthy unit carries the whole export, but only up to its own ${tx.ratingMVA} MVA — the rest must be curtailed.`}
        </Why>
      </PanelSection>

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
        <DataRow
          label="Insulation ageing rate"
          value={`× ${ageing < 0.1 ? ageing.toFixed(2) : ageing.toFixed(1)}`}
          color={ageing > 1 ? WARN : undefined}
          hint="IEC 60076-7: V = 2^((θh − 98)/6), non-upgraded paper"
        />
        <Why>
          Paper insulation sets the transformer's life: its ageing doubles for every 6 K of hot spot above 98 °C
          (× 1 = normal life).
        </Why>
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
        <div className="grid grid-cols-3 gap-1 rounded bg-bg-tertiary p-0.5">
          {COOLING_STAGES.map((stage) => (
            <div
              key={stage}
              className="rounded-sm py-1 text-center font-mono text-xs"
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
        <Why>
          {`The on-load tap changer shifts the turns ratio to hold the ${tx.lvKV} kV bus voltage as the grid side moves. ONAN = oil and air by natural convection; ONAF stages switch fans on as the oil heats up.`}
        </Why>
      </PanelSection>

      <PanelSection title="Protection & condition">
        <DataRow
          label="Buchholz relay"
          value={tx.buchholzStatus}
          color={conditionColor(tx.buchholzStatus)}
          hint="Catches gas or an oil surge from an internal fault"
        />
        <DataRow
          label="Dissolved gas (DGA)"
          value={tx.dgaStatus}
          color={conditionColor(tx.dgaStatus)}
          hint="IEC 60599: gas ratios point to overheating, partial discharge or arcing"
        />
        <DataRow
          label="Operating hours"
          value={tx.operatingHours.toLocaleString("en-US")}
          unit="h"
        />
        <Why>
          Buchholz trips on a sudden internal fault; DGA finds slow ones months earlier.
        </Why>
        {isOss && <Why>The topside has a helideck (CAP 437) for access when seas exceed vessel limits.</Why>}
      </PanelSection>
    </EquipmentPanel>
  );
}

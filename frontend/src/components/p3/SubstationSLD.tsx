/**
 * Single-line diagram of the export system — IEC 60617 symbols, ISA-101 colours.
 *
 * Topology and energisation come from utils/scadaTopology for the live fleet
 * (2 × onshore and 2 × OSS transformers, n export cables, split 66 kV
 * switchboard with one feeder per string — SB-510: 2 × 76.5 km, 6 strings).
 * Flows are computed from the live farm: string MW from the turbines,
 * section → transformer loading, cable current with half the charging
 * current in quadrature. Operating a breaker is select-before-operate
 * (IEC 61850-7-2 SBO): click selects, Execute operates — after the RBAC and
 * interlock checks in the store.
 */

import { useMemo, useState } from "react";

import { useScadaStore } from "../../store/scadaStore";
import { useLandingStore } from "../../store/landingStore";
import { usePlantSnapshot } from "../../store/liveGridStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { InfoButton } from "../ui/InfoButton";
import { substationSldInfo } from "../../constants/panelInfo";
import { sectionOf, stringsOn, useFleet } from "../../lib/fleet";
import {
  breakers as breakersOf,
  energisation,
  type BreakerId,
} from "../../utils/scadaTopology";
import type { BreakerState } from "../../types/scada";
import {
  EXPORT_CABLE,
  arrayCableCurrentA,
  exportCableState,
  plantNet,
} from "../../utils/landingPhysics";
import { cn } from "../../lib/utils";

const DEAD = SCADA_COLORS.DE_ENERGIZED;
const V400 = SCADA_COLORS.VOLTAGE_400KV;
const V220 = SCADA_COLORS.VOLTAGE_220KV;
const V66 = SCADA_COLORS.VOLTAGE_66KV;

// Column x of transformer bays 1 / 2 (export cables spread around them), busbar y levels.
// Feeders sit 120 apart on their section; more than 3 per section widens the drawing.
const X1 = 390;
const X2 = 610;
const FEEDER_DX = 120;
const cableX = (i: number, n: number) => 500 + (i - (n - 1) / 2) * (n <= 3 ? 220 : 160);
const Y = {
  b400: 50, cb400: 88, txOns: 140, b220on: 195, cbOnsE: 230, cbOssE: 352,
  b220oss: 390, cbOssT: 428, txOss: 482, cb66: 537, b66: 578, cbStr: 620, str: 662,
} as const;

/** Fault zones of the GOOSE scenarios, drawn as a dashed red rectangle. */
const FAULT_ZONE: Record<string, { x: number; y: number; w: number; h: number }> = {
  busbar_overcurrent: { x: 140, y: Y.b220oss - 14, w: 720, h: 28 },
  transformer_differential: { x: X1 - 34, y: Y.cbOssT - 16, w: 68, h: Y.cb66 - Y.cbOssT + 32 },
  cable_earth_fault: { x: X1 - 34, y: Y.cbOnsE - 16, w: 68, h: Y.cbOssE - Y.cbOnsE + 32 },
};

function Wire({ x1, y1, x2, y2, live, color, w = 2 }: { x1: number; y1: number; x2: number; y2: number; live: boolean; color: string; w?: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={live ? color : DEAD} strokeWidth={w} />;
}

function Busbar({ x1, x2, y, live, color, label }: { x1: number; x2: number; y: number; live: boolean; color: string; label: string }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={live ? color : DEAD} strokeWidth={6} strokeLinecap="square" />
      <text x={x1} y={y - 9} className="fill-text-secondary" fontSize={13} fontWeight={600}>
        {label}
      </text>
    </g>
  );
}

/** Two-winding transformer: two overlapping circles (IEC 60617-06-09-01). */
function Transformer({ x, y, hv, lv, liveHv, liveLv, label, loadPct, mva }: {
  x: number; y: number; hv: string; lv: string; liveHv: boolean; liveLv: boolean; label: string; loadPct: number; mva: number;
}) {
  const over = loadPct > 100;
  return (
    <g>
      <circle cx={x} cy={y - 10} r={15} fill="none" stroke={liveHv ? hv : DEAD} strokeWidth={2} />
      <circle cx={x} cy={y + 10} r={15} fill="none" stroke={liveLv ? lv : DEAD} strokeWidth={2} />
      <text x={x + 24} y={y - 3} className="fill-text-primary" fontSize={13} fontWeight={600}>{label}</text>
      <text x={x + 24} y={y + 13} fontSize={13} fontFamily="monospace" className={over ? "fill-status-alarm" : "fill-text-secondary"}>
        {liveLv ? `${loadPct.toFixed(0)} % of ${mva} MVA` : "out of service"}
      </text>
    </g>
  );
}

interface BreakerProps {
  id: BreakerId;
  label: string;
  x: number;
  y: number;
  color: string;
  live: boolean;
  horizontal?: boolean;
  state: BreakerState;
  selected: boolean;
  onSelect: (id: BreakerId) => void;
}

/** Circuit breaker (IEC 60617-07-13-05): filled = closed, hollow = open, red = tripped. */
function Breaker({ id, label, x, y, color, live, horizontal = false, state, selected, onSelect }: BreakerProps) {
  const closed = state === "CLOSED";
  const tripped = state === "TRIPPED";
  const stroke = tripped ? SCADA_COLORS.FAULT : live || closed ? color : DEAD;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${label} ${state}`}
      className="cursor-pointer focus:outline-none"
      onClick={() => onSelect(id)}
      onKeyDown={(ev) => ev.key === "Enter" && onSelect(id)}
    >
      {selected && (
        <rect x={x - 15} y={y - 15} width={30} height={30} rx={3} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="4 2" />
      )}
      <rect
        x={x - 9}
        y={y - 9}
        width={18}
        height={18}
        rx={1.5}
        fill={closed ? stroke : "var(--color-bg-secondary)"}
        stroke={stroke}
        strokeWidth={2}
        className={tripped ? "animate-pulse" : undefined}
      />
      <text
        x={horizontal ? x : x + 15}
        y={horizontal ? y + 24 : y + 4}
        textAnchor={horizontal ? "middle" : "start"}
        fontSize={12}
        fontFamily="monospace"
        className={tripped ? "fill-status-alarm" : "fill-text-muted"}
      >
        {label}
        {tripped ? " TRIP" : !closed ? " OPEN" : ""}
      </text>
    </g>
  );
}

export default function SubstationSLD() {
  const breakers = useScadaStore((s) => s.breakerStates);
  const faultZone = useScadaStore((s) => s.faultHighlightNodeId);
  const operateBreaker = useScadaStore((s) => s.operateBreaker);
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const plant = usePlantSnapshot();
  const fleet = useFleet();
  const BREAKERS = breakersOf(fleet);
  const net = plantNet(fleet);
  const [selected, setSelected] = useState<BreakerId | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const e = useMemo(() => energisation(breakers, fleet), [breakers, fleet]);

  // ── Layout for this fleet: section A feeders from the left, B mirrored from the right ──
  const onA = stringsOn(fleet, "A");
  const onB = stringsOn(fleet, "B");
  const W = 1000 + 2 * FEEDER_DX * Math.max(0, Math.max(onA.length, onB.length) - 3);
  const dx = (W - 1000) / 2;
  const stringX = fleet.strings.map((_, i) =>
    sectionOf(fleet, i) === "A" ? 110 + onA.indexOf(i) * FEEDER_DX : W - 110 - (onB.length - 1 - onB.indexOf(i)) * FEEDER_DX,
  );
  const cables = Array.from({ length: net.circuits }, (_, i) => ({ x: cableX(i, net.circuits), i }));
  const busX: [number, number] = [Math.min(280, cables[0].x - 40), Math.max(720, cables[cables.length - 1].x + 40)];

  // GOOSE fault zone; cable 1 sits wherever this fleet's circuits put it
  const zone = faultZone && FAULT_ZONE[faultZone]
    ? faultZone === "cable_earth_fault" ? { ...FAULT_ZONE[faultZone], x: cables[0].x - 34 } : FAULT_ZONE[faultZone]
    : null;

  // ── Flows from the live farm ──
  const stringMW = fleet.strings.map((ids, i) =>
    e.strings[i] ? ids.reduce((sum, id) => sum + (turbineMap[id]?.powerOutputMW ?? 0), 0) : 0,
  );
  const sectionMW = (strings: number[]) => strings.reduce((sum, i) => sum + stringMW[i], 0);
  const mwA = sectionMW(onA);
  const mwB = sectionMW(onB);
  const coupled = breakers["cb-66-bc"] === "CLOSED";
  // With the coupler closed one incomer is open (interlock): it carries both sections
  const txMW: [number, number] = coupled
    ? e.txOss[0] && breakers["cb-66-a"] === "CLOSED" ? [mwA + mwB, 0] : [0, mwA + mwB]
    : [mwA, mwB];
  const total = mwA + mwB;
  const liveCables = e.cable.filter(Boolean).length;
  const chargingHalfA = exportCableState(0, net).currentA; // I_C/2 per circuit
  const cablePct = (i: number) => {
    if (!e.cable[i]) return 0;
    const iActive = (total * 1e6) / (Math.sqrt(3) * EXPORT_CABLE.kV * 1e3 * liveCables);
    return (Math.hypot(iActive, chargingHalfA) / EXPORT_CABLE.ratedA) * 100;
  };
  const onsInService = (["cb-400-1", "cb-400-2"] as const).filter((id) => breakers[id] === "CLOSED").length;
  const onsPct = onsInService ? (total / (onsInService * net.onsTxMVA)) * 100 : 0;

  const sel = selected ? BREAKERS[selected] : null;
  const selState = selected ? breakers[selected] : null;
  const nReactors = plant.reactorsInService;
  const bp = (id: BreakerId) => ({
    id,
    label: BREAKERS[id].label,
    state: breakers[id],
    selected: selected === id,
    onSelect: (b: BreakerId) => {
      setSelected(b);
      setBlocked(null);
    },
  });

  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-b border-border-primary shrink-0">
        <h3 className="text-xs font-semibold text-text-primary">Single-Line Diagram</h3>
        <InfoButton info={substationSldInfo} />
        <span className="text-[10px] text-text-muted font-mono">
          IEC 60617 · click a breaker to select, then execute (SBO)
        </span>
        <span className="ml-auto flex items-center gap-3 text-[10px] font-mono text-text-muted">
          {([["400 kV", V400], ["220 kV", V220], ["66 kV", V66], ["dead", DEAD]] as const).map(([l, c]) => (
            <span key={l} className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5" style={{ background: c }} />
              {l}
            </span>
          ))}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <svg viewBox={`0 0 ${W} 740`} className="w-full h-full" style={{ minWidth: W * 0.72 }} preserveAspectRatio="xMidYMin meet" role="img" aria-label="Export system single-line diagram">
          <g transform={`translate(${dx} 0)`}>
          {zone && (
            <rect {...{ x: zone.x, y: zone.y, width: zone.w, height: zone.h }}
              fill={SCADA_COLORS.FAULT} fillOpacity={0.12} stroke={SCADA_COLORS.FAULT} strokeDasharray="6 3" strokeWidth={1.5} className="animate-pulse" />
          )}

          {/* ── PSE 400 kV ── */}
          <Busbar x1={busX[0]} x2={busX[1]} y={Y.b400} live color={V400} label="PSE 400 kV · connection point" />
          <g fontFamily="monospace" fontSize={13}>
            <text x={busX[1] + 15} y={Y.b400 - 8} className="fill-text-primary">P {plant.pocMW.toFixed(1)} MW</text>
            <text x={busX[1] + 15} y={Y.b400 + 10} className="fill-text-secondary">Q {plant.pocMVAr >= 0 ? "+" : "−"}{Math.abs(plant.pocMVAr).toFixed(0)} MVAr · U {plant.pocKV.toFixed(1)} kV</text>
          </g>

          {/* ── Onshore transformer bays ── */}
          {([[X1, "cb-400-1", "TX-ONS-01"], [X2, "cb-400-2", "TX-ONS-02"]] as const).map(([x, cb, name]) => {
            const on = breakers[cb] === "CLOSED";
            return (
              <g key={cb}>
                <Wire x1={x} y1={Y.b400} x2={x} y2={Y.cb400 - 9} live color={V400} />
                <Breaker {...bp(cb)} x={x} y={Y.cb400} color={V400} live />
                <Wire x1={x} y1={Y.cb400 + 9} x2={x} y2={Y.txOns - 25} live={on} color={V400} />
                <Transformer x={x} y={Y.txOns} hv={V400} lv={V220} liveHv={on} liveLv={on && e.onshore220} label={`${name} 220/400 kV`} loadPct={on ? onsPct : 0} mva={net.onsTxMVA} />
                <Wire x1={x} y1={Y.txOns + 25} x2={x} y2={Y.b220on} live={on} color={V220} />
              </g>
            );
          })}
          <Busbar x1={busX[0]} x2={busX[1]} y={Y.b220on} live={e.onshore220} color={V220} label="Onshore 220 kV" />

          {/* ── Export cables ── */}
          {cables.map(({ x, i }) => {
            const cbOn = `cb-ons-e${i + 1}`;
            const cbOff = `cb-oss-e${i + 1}`;
            const live = e.cable[i];
            const pct = cablePct(i);
            return (
              <g key={cbOn}>
                <Wire x1={x} y1={Y.b220on} x2={x} y2={Y.cbOnsE - 9} live={e.onshore220} color={V220} />
                <Breaker {...bp(cbOn)} x={x} y={Y.cbOnsE} color={V220} live={e.onshore220} />
                <Wire x1={x} y1={Y.cbOnsE + 9} x2={x} y2={Y.cbOssE - 9} live={live} color={V220} w={3} />
                {/* onshore line reactor of this cable (cable side of the breaker, switched with it) */}
                {net.reactorCount > 0 && (
                  <g>
                    <Wire x1={x} y1={Y.cbOnsE + 24} x2={x - 24} y2={Y.cbOnsE + 24} live={live} color={V220} />
                    <path d={`M${x - 24} ${Y.cbOnsE + 24} q 8 4 0 8 q 8 4 0 8 q 8 4 0 8`} fill="none" stroke={live ? V220 : DEAD} strokeWidth={2} />
                    <line x1={x - 30} y1={Y.cbOnsE + 52} x2={x - 18} y2={Y.cbOnsE + 52} stroke={live ? V220 : DEAD} strokeWidth={2} />
                  </g>
                )}
                {/* cable sheath marks */}
                <ellipse cx={x} cy={(Y.cbOnsE + Y.cbOssE) / 2} rx={7} ry={3} fill="none" stroke={live ? V220 : DEAD} strokeWidth={1.5} />
                <text x={x + 14} y={(Y.cbOnsE + Y.cbOssE) / 2 - 4} fontSize={13} className="fill-text-primary" fontWeight={600}>Export cable {i + 1}</text>
                <text x={x + 14} y={(Y.cbOnsE + Y.cbOssE) / 2 + 12} fontSize={12} fontFamily="monospace" className={pct > 100 ? "fill-status-alarm" : "fill-text-secondary"}>
                  {live ? `${pct.toFixed(0)} % of ${EXPORT_CABLE.ratedA} A` : "dead"} · {net.exportKm.toFixed(0)} km
                </text>
                <Breaker {...bp(cbOff)} x={x} y={Y.cbOssE} color={V220} live={e.oss220} />
                <Wire x1={x} y1={Y.cbOssE + 9} x2={x} y2={Y.b220oss} live={e.oss220} color={V220} />
              </g>
            );
          })}
          <Busbar x1={Math.min(140, busX[0])} x2={Math.max(860, busX[1])} y={Y.b220oss} live={e.oss220} color={V220} label="OSS 220 kV" />

          {/* OSS shunt reactors (left) and STATCOM (right) on the OSS 220 kV busbar; the
              onshore line reactors sit on the cables above */}
          <g>
            <Wire x1={200} y1={Y.b220oss} x2={200} y2={Y.b220oss + 30} live={e.oss220} color={V220} />
            <path d={`M200 ${Y.b220oss + 30} q 8 4 0 8 q 8 4 0 8 q 8 4 0 8 q 8 4 0 8`} fill="none" stroke={e.oss220 ? V220 : DEAD} strokeWidth={2} />
            <text x={212} y={Y.b220oss + 44} fontSize={13} className="fill-text-primary" fontWeight={600}>Shunt reactors</text>
            <text x={212} y={Y.b220oss + 60} fontSize={12} fontFamily="monospace" className="fill-text-secondary">
              {!e.oss220
                ? "dead"
                : net.reactorCount
                  ? `${net.reactorCount / 2} OSS + ${net.reactorCount / 2} onshore × ${net.reactorUnitMVAr} · ${nReactors} in = −${nReactors * net.reactorUnitMVAr} MVAr`
                  : "none (short export)"}
            </text>
            <Wire x1={800} y1={Y.b220oss} x2={800} y2={Y.b220oss + 30} live={e.oss220} color={V220} />
            <rect x={784} y={Y.b220oss + 30} width={32} height={22} rx={2} fill="none" stroke={e.oss220 ? V220 : DEAD} strokeWidth={2} />
            <text x={800} y={Y.b220oss + 45} textAnchor="middle" fontSize={11} fontFamily="monospace" className="fill-text-secondary">=/~</text>
            <text x={824} y={Y.b220oss + 44} fontSize={13} className="fill-text-primary" fontWeight={600}>STATCOM</text>
            <text x={824} y={Y.b220oss + 60} fontSize={12} fontFamily="monospace" className="fill-text-secondary">
              {e.oss220 ? `${plant.statcomMVAr >= 0 ? "+" : "−"}${Math.abs(plant.statcomMVAr).toFixed(0)} / ±${net.statcomMVAr} MVAr` : "dead"}
            </text>
          </g>

          {/* ── OSS transformer bays ── */}
          {([[X1, 0, "cb-oss-t1", "cb-66-a", "TX-OSS-01"], [X2, 1, "cb-oss-t2", "cb-66-b", "TX-OSS-02"]] as const).map(([x, i, hv, lv, name]) => {
            const on = e.txOss[i];
            return (
              <g key={hv}>
                <Wire x1={x} y1={Y.b220oss} x2={x} y2={Y.cbOssT - 9} live={e.oss220} color={V220} />
                <Breaker {...bp(hv)} x={x} y={Y.cbOssT} color={V220} live={e.oss220} />
                <Wire x1={x} y1={Y.cbOssT + 9} x2={x} y2={Y.txOss - 25} live={on} color={V220} />
                <Transformer x={x} y={Y.txOss} hv={V220} lv={V66} liveHv={on} liveLv={on} label={`${name} 66/220 kV`} loadPct={(txMW[i] / net.ossTxMVA) * 100} mva={net.ossTxMVA} />
                <Wire x1={x} y1={Y.txOss + 25} x2={x} y2={Y.cb66 - 9} live={on} color={V66} />
                <Breaker {...bp(lv)} x={x} y={Y.cb66} color={V66} live={on} />
                <Wire x1={x} y1={Y.cb66 + 9} x2={x} y2={Y.b66} live={i === 0 ? e.sectionA : e.sectionB} color={V66} />
              </g>
            );
          })}

          </g>

          {/* ── 66 kV switchboard: sections A/B + bus coupler ── */}
          <Busbar x1={60} x2={440 + dx} y={Y.b66} live={e.sectionA} color={V66} label="66 kV section A" />
          <Busbar x1={560 + dx} x2={W - 60} y={Y.b66} live={e.sectionB} color={V66} label="66 kV section B" />
          <Wire x1={440 + dx} y1={Y.b66} x2={491 + dx} y2={Y.b66} live={e.sectionA} color={V66} />
          <Wire x1={509 + dx} y1={Y.b66} x2={560 + dx} y2={Y.b66} live={e.sectionB} color={V66} />
          <Breaker {...bp("cb-66-bc")} x={500 + dx} y={Y.b66} color={V66} live={e.sectionA || e.sectionB} horizontal />

          {/* ── String feeders ── */}
          {stringX.map((x, i) => {
            const id = `cb-str${i + 1}`;
            const sectionLive = sectionOf(fleet, i) === "A" ? e.sectionA : e.sectionB;
            const live = e.strings[i];
            const mw = stringMW[i];
            return (
              <g key={id}>
                <Wire x1={x} y1={Y.b66} x2={x} y2={Y.cbStr - 9} live={sectionLive} color={V66} />
                <Breaker {...bp(id)} x={x} y={Y.cbStr} color={V66} live={sectionLive} />
                <Wire x1={x} y1={Y.cbStr + 9} x2={x} y2={Y.str} live={live} color={V66} />
                <rect x={x - 52} y={Y.str} width={104} height={58} rx={3} fill="var(--color-bg-tertiary)" stroke={live ? V66 : DEAD} strokeWidth={1.5} />
                <text x={x} y={Y.str + 17} textAnchor="middle" fontSize={13} fontWeight={600} className="fill-text-primary">
                  String {i + 1}
                </text>
                <text x={x} y={Y.str + 34} textAnchor="middle" fontSize={13} fontFamily="monospace" className="fill-text-primary">
                  {live ? `${mw.toFixed(1)} MW` : "de-energised"}
                </text>
                <text x={x} y={Y.str + 50} textAnchor="middle" fontSize={12} fontFamily="monospace" className="fill-text-muted">
                  {fleet.strings[i].length} WTG{live ? ` · ${arrayCableCurrentA(mw).toFixed(0)} A` : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Select-before-operate panel ── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-border-primary bg-bg-tertiary text-xs shrink-0 min-h-11">
        {sel && selected && selState ? (
          <>
            <span className="font-mono font-semibold text-text-primary">{sel.label}</span>
            <span className="text-text-muted">{sel.bay} · {sel.kV} kV</span>
            <span className={cn("font-mono", selState === "TRIPPED" ? "text-status-alarm" : "text-text-secondary")}>{selState}</span>
            <span className="flex-1" />
            {blocked && <span className="text-status-warning">{blocked}</span>}
            <button
              type="button"
              onClick={async () => setBlocked(await operateBreaker(selected))}
              className="h-7 px-3 rounded bg-accent text-white font-medium hover:opacity-90"
            >
              Execute {selState === "CLOSED" ? "OPEN" : "CLOSE"}
            </button>
            <button type="button" onClick={() => setSelected(null)} className="h-7 px-3 rounded border border-border-primary text-text-secondary hover:bg-bg-hover">
              Cancel
            </button>
          </>
        ) : (
          <span className="text-text-muted">
            No breaker selected · Σ strings {total.toFixed(1)} MW · TX-OSS-01 {txMW[0].toFixed(0)} MW · TX-OSS-02 {txMW[1].toFixed(0)} MW · bus coupler {coupled ? "CLOSED" : "OPEN (normal)"}
          </span>
        )}
      </div>
    </div>
  );
}

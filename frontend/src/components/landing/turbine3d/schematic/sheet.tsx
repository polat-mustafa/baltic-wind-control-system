/**
 * Drawing sheet: ISO 5457-style frame with grid-reference zones (1–8 / A–F),
 * an ISO 7200-style title block and the line styles shared by all sheets.
 * A 1200 × 720 viewBox scales to any panel size without reflowing text.
 */

import type { ReactNode } from "react";
import { useFleet } from "../../../../lib/fleet";

const VB_W = 1200;
const VB_H = 720;
const M = 12; // outer margin
const Z = 14; // zone strip width
const COLS = 8;
const ROWS = "ABCDEF";

export type WireKind =
  | "mv" // 66 kV
  | "lv" // generator / converter AC and 400 V auxiliaries
  | "dc"
  | "shaft"
  | "hyd" // hydraulic pressure
  | "hydRet" // hydraulic return
  | "glycol" // water-glycol cooling
  | "signal" // ISA electric signal
  | "data"; // ISA data link / fieldbus

const WIRE: Record<WireKind, { stroke: string; width: number; dash?: string; label: string }> = {
  mv: { stroke: "var(--color-voltage-66kv, #b91c1c)", width: 3, label: "MV 66 kV" },
  lv: { stroke: "currentColor", width: 2.2, label: "AC < 66 kV (generator, converter, aux)" },
  dc: { stroke: "currentColor", width: 2.2, dash: "10 3 2 3", label: "DC link" },
  shaft: { stroke: "currentColor", width: 6, label: "Shaft" },
  hyd: { stroke: "#ea580c", width: 2.4, label: "Hydraulic pressure (P)" },
  hydRet: { stroke: "#ea580c", width: 1.6, dash: "7 4", label: "Hydraulic return (T)" },
  glycol: { stroke: "#0891b2", width: 2.4, label: "Water-glycol" },
  signal: { stroke: "currentColor", width: 1, dash: "6 3", label: "Electric signal (ISA)" },
  data: { stroke: "var(--color-accent)", width: 1.2, dash: "1.5 3.5", label: "Data link / fieldbus" },
};

/**
 * A line on the sheet in its own style; `flow` adds a thin marching overlay
 * in the drawing direction (energised / flowing), so the line type itself
 * stays readable.
 */
export function Wire({ d, kind, flow = false, arrow = false }: { d: string; kind: WireKind; flow?: boolean; arrow?: boolean }) {
  const w = WIRE[kind];
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={w.stroke}
        strokeWidth={w.width}
        strokeDasharray={w.dash}
        strokeLinecap={kind === "data" ? "round" : "butt"}
        strokeLinejoin="round"
        markerEnd={arrow ? "url(#dwg-arrow)" : undefined}
      />
      {flow && (
        <path d={d} fill="none" stroke="var(--color-bg-primary)" strokeWidth={Math.max(1, w.width * 0.45)}
          strokeDasharray="3 13" strokeLinecap="round" className="dwg-flow" />
      )}
    </g>
  );
}

export function Legend({ kinds, x, y }: { kinds: WireKind[]; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <text fontSize={11} fontWeight={800} fill="currentColor">LEGEND</text>
      {kinds.map((k, i) => (
        <g key={k} transform={`translate(0 ${16 + i * 15})`}>
          <path d="M 0 0 L 34 0" fill="none" stroke={WIRE[k].stroke} strokeWidth={Math.min(WIRE[k].width, 3.5)} strokeDasharray={WIRE[k].dash} />
          <text x={42} y={4} fontSize={10.5} fontWeight={600} fill="currentColor">{WIRE[k].label}</text>
        </g>
      ))}
    </g>
  );
}

export function Sheet({
  title, subtitle, dwg, sheet, standard, children,
}: {
  title: string; subtitle: string; dwg: string; sheet: string; standard: string; children: ReactNode;
}) {
  const inner = { x: M + Z, y: M + Z, w: VB_W - 2 * (M + Z), h: VB_H - 2 * (M + Z) };
  const cw = (VB_W - 2 * M) / COLS;
  const rh = (VB_H - 2 * M) / ROWS.length;
  const fleet = useFleet();
  const tb = { x: VB_W - M - Z - 372, y: VB_H - M - Z - 78, w: 372, h: 78 };
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      style={{ color: "var(--color-text-primary)", fontFamily: "Inter, ui-sans-serif, sans-serif" }}
      role="img"
      aria-label={`${title} — ${subtitle}`}
    >
      <defs>
        <marker id="dwg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
        <pattern id="dwg-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.35" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="var(--color-bg-primary)" />
      {/* frame + zones */}
      <rect x={M} y={M} width={VB_W - 2 * M} height={VB_H - 2 * M} fill="none" stroke="currentColor" strokeWidth={1} />
      <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} fill="none" stroke="currentColor" strokeWidth={2} />
      {Array.from({ length: COLS }, (_, i) => (
        <g key={`c${i}`} fontSize={9} fontWeight={700} fill="currentColor" textAnchor="middle">
          {i > 0 && <line x1={M + i * cw} x2={M + i * cw} y1={M} y2={M + Z} stroke="currentColor" strokeWidth={0.8} />}
          {i > 0 && <line x1={M + i * cw} x2={M + i * cw} y1={VB_H - M - Z} y2={VB_H - M} stroke="currentColor" strokeWidth={0.8} />}
          <text x={M + (i + 0.5) * cw} y={M + 10}>{i + 1}</text>
          <text x={M + (i + 0.5) * cw} y={VB_H - M - 4}>{i + 1}</text>
        </g>
      ))}
      {ROWS.split("").map((r, i) => (
        <g key={r} fontSize={9} fontWeight={700} fill="currentColor" textAnchor="middle">
          {i > 0 && <line x1={M} x2={M + Z} y1={M + i * rh} y2={M + i * rh} stroke="currentColor" strokeWidth={0.8} />}
          {i > 0 && <line x1={VB_W - M - Z} x2={VB_W - M} y1={M + i * rh} y2={M + i * rh} stroke="currentColor" strokeWidth={0.8} />}
          <text x={M + Z / 2} y={M + (i + 0.5) * rh + 3}>{r}</text>
          <text x={VB_W - M - Z / 2} y={M + (i + 0.5) * rh + 3}>{r}</text>
        </g>
      ))}
      {children}
      {/* title block */}
      <g transform={`translate(${tb.x} ${tb.y})`} fill="currentColor">
        <rect width={tb.w} height={tb.h} fill="var(--color-bg-primary)" stroke="currentColor" strokeWidth={1.6} />
        <line x1={0} x2={tb.w} y1={22} y2={22} stroke="currentColor" strokeWidth={0.8} />
        <line x1={0} x2={tb.w} y1={56} y2={56} stroke="currentColor" strokeWidth={0.8} />
        <line x1={236} x2={236} y1={56} y2={tb.h} stroke="currentColor" strokeWidth={0.8} />
        <line x1={300} x2={300} y1={56} y2={tb.h} stroke="currentColor" strokeWidth={0.8} />
        <text x={8} y={15} fontSize={10.5} fontWeight={800}>
          {fleet.source === "sb510" ? "SB-510 CASE STUDY" : fleet.name.toUpperCase()} · {fleet.turbines.length} × 15 MW (IEA 15 MW) MW · {fleet.net.total_capacity_mw.toFixed(0)} MW
        </text>
        <text x={8} y={38} fontSize={13} fontWeight={800}>{title}</text>
        <text x={8} y={51} fontSize={10} fontWeight={600} fillOpacity={0.8}>{subtitle}</text>
        <text x={8} y={69} fontSize={9.5} fontWeight={600}>Dwg <tspan fontWeight={800}>{dwg}</tspan> · {standard}</text>
        <text x={244} y={69} fontSize={9.5} fontWeight={600}>Rev <tspan fontWeight={800}>B</tspan></text>
        <text x={308} y={69} fontSize={9.5} fontWeight={600}>Sheet <tspan fontWeight={800}>{sheet}</tspan></text>
      </g>
      <text x={inner.x + 8} y={VB_H - M - Z - 8} fontSize={9.5} fontWeight={600} fill="currentColor" fillOpacity={0.7}>
        EDUCATIONAL SCHEMATIC · not for construction · values live from the farm simulation
      </text>
    </svg>
  );
}

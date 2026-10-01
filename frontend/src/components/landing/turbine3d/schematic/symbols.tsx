/**
 * Drawing symbols for the nacelle schematics, each authored around (0, 0)
 * and placed with a translate:
 *
 *   electrical  IEC 60617 — generator, converter (rectifier / inverter),
 *               capacitor, circuit breaker, disconnector, earthing switch,
 *               two-winding transformer, current / voltage transformer,
 *               cable end, motor, battery, protection relay (ANSI codes)
 *   process     ISA-5.1 / ISO 10628 — instrument bubble, pump, tank, filter,
 *               check / relief valve, accumulator, cylinder, heat exchanger,
 *               fan, brake caliper
 *   mechanical  ISO 3952 style — rolling bearing, coupling, gear stage
 *
 * Ink is `currentColor` (the sheet sets the theme text colour); fills use
 * the paper colour so symbols mask the lines they sit on.
 */

import type { ReactNode } from "react";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";

const PAPER = "var(--color-bg-primary)";
const SW = 1.6; // stroke width of symbol outlines

// ── selectable wrapper ────────────────────────────────────────────────

export function Sym({
  x, y, part, selected, onSelect, title, children, box = [-36, -36, 72, 72],
}: {
  x: number; y: number; part?: TurbinePartId; selected?: TurbinePartId | null;
  onSelect?: (p: TurbinePartId) => void; title?: string; children: ReactNode; box?: [number, number, number, number];
}) {
  const active = !!part && selected === part;
  return (
    <g
      transform={`translate(${x} ${y})`}
      data-testid={part ? `sym-${part}` : undefined}
      onClick={part && onSelect ? () => onSelect(part) : undefined}
      style={{ cursor: part ? "pointer" : undefined }}
    >
      {title && <title>{title}</title>}
      {part && (
        <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={6} fill="transparent"
          stroke={active ? "var(--color-accent)" : "transparent"} strokeWidth={2.2} strokeDasharray={active ? "5 3" : undefined} />
      )}
      {children}
    </g>
  );
}

/** Designation + description next to a symbol (IEC 81346 style "-G1"). */
export function Label({ x, y, tag, text, anchor = "middle" }: { x: number; y: number; tag?: string; text?: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={11} fill="currentColor">
      {tag && <tspan fontWeight={800}>{tag} </tspan>}
      {text && <tspan fontWeight={600} fillOpacity={0.8}>{text}</tspan>}
    </text>
  );
}

/** Live-value callout: small framed box with monospace lines. */
export function Reading({ x, y, lines, tone = "var(--color-accent)", anchor = "start" }: {
  x: number; y: number; lines: string[]; tone?: string; anchor?: "start" | "end";
}) {
  const w = Math.max(...lines.map((l) => l.length)) * 6.7 + 12;
  const h = lines.length * 13 + 6;
  const x0 = anchor === "start" ? x : x - w;
  return (
    <g>
      <rect x={x0} y={y} width={w} height={h} rx={3} fill={PAPER} stroke={tone} strokeWidth={1.2} />
      {lines.map((l, i) => (
        <text key={l} x={x0 + 6} y={y + 14 + i * 13} fontSize={11} fontWeight={700} fontFamily="ui-monospace, monospace" fill="currentColor">
          {l}
        </text>
      ))}
    </g>
  );
}

// ── electrical (IEC 60617) ────────────────────────────────────────────

export const Generator = () => (
  <g>
    <circle r={28} fill={PAPER} stroke="currentColor" strokeWidth={SW} />
    <text y={-2} textAnchor="middle" fontSize={17} fontWeight={800} fill="currentColor">G</text>
    <text y={15} textAnchor="middle" fontSize={11} fontWeight={700} fill="currentColor">3~</text>
  </g>
);

export const Motor = ({ r = 13 }: { r?: number }) => (
  <g>
    <circle r={r} fill={PAPER} stroke="currentColor" strokeWidth={SW} />
    <text y={4.5} textAnchor="middle" fontSize={r} fontWeight={800} fill="currentColor">M</text>
  </g>
);

/** Static converter: box with a diagonal, `from` top-left, `to` bottom-right. */
export const Converter = ({ from, to }: { from: "~" | "="; to: "~" | "=" }) => (
  <g>
    <rect x={-26} y={-26} width={52} height={52} fill={PAPER} stroke="currentColor" strokeWidth={SW} />
    <line x1={-26} y1={26} x2={26} y2={-26} stroke="currentColor" strokeWidth={1.1} />
    <text x={-13} y={-7} textAnchor="middle" fontSize={15} fontWeight={800} fill="currentColor">{from}</text>
    <text x={13} y={19} textAnchor="middle" fontSize={15} fontWeight={800} fill="currentColor">{to}</text>
  </g>
);

/** Capacitor across a vertical branch (plates horizontal). */
export const Capacitor = () => (
  <g stroke="currentColor" strokeWidth={SW}>
    <line x1={-12} y1={-4} x2={12} y2={-4} strokeWidth={2.4} />
    <line x1={-12} y1={4} x2={12} y2={4} strokeWidth={2.4} />
  </g>
);

/** Circuit breaker in a horizontal line (IEC 60617 07-13-05): blade + ×. */
export const Breaker = ({ closed = true }: { closed?: boolean }) => (
  <g stroke="currentColor" strokeWidth={SW} fill="none">
    <line x1={-22} y1={0} x2={-12} y2={0} />
    <line x1={-12} y1={0} x2={12} y2={closed ? 0 : -12} />
    <path d="M 8 -4 L 16 4 M 8 4 L 16 -4" />
    <line x1={12} y1={0} x2={22} y2={0} />
  </g>
);

/** Disconnector (07-13-06): blade + bar at the fixed contact. */
export const Disconnector = ({ closed = true }: { closed?: boolean }) => (
  <g stroke="currentColor" strokeWidth={SW} fill="none">
    <line x1={-22} y1={0} x2={-12} y2={0} />
    <line x1={-12} y1={0} x2={12} y2={closed ? 0 : -12} />
    <line x1={12} y1={-6} x2={12} y2={6} />
    <line x1={12} y1={0} x2={22} y2={0} />
  </g>
);

/** Earthing switch, hanging down from (0, 0). */
export const EarthSwitch = ({ closed = false }: { closed?: boolean }) => (
  <g stroke="currentColor" strokeWidth={SW} fill="none">
    <line x1={0} y1={0} x2={0} y2={8} />
    <line x1={0} y1={8} x2={closed ? 0 : 9} y2={24} />
    <line x1={0} y1={24} x2={0} y2={28} />
    <line x1={-9} y1={28} x2={9} y2={28} />
    <line x1={-6} y1={32} x2={6} y2={32} />
    <line x1={-3} y1={36} x2={3} y2={36} />
  </g>
);

/** Two-winding transformer, horizontal (07-15-01). */
export const Transformer = () => (
  <g fill="none" stroke="currentColor" strokeWidth={SW}>
    <circle cx={-12} r={20} fill={PAPER} fillOpacity={0.6} />
    <circle cx={12} r={20} />
  </g>
);

/** Current transformer on a horizontal line. */
export const CT = () => (
  <g fill="none" stroke="currentColor" strokeWidth={1.3}>
    <circle r={8} />
    <circle cx={0} cy={-8} r={1.6} fill="currentColor" />
  </g>
);

/** Voltage transformer hanging below a line. */
export const VT = () => (
  <g fill="none" stroke="currentColor" strokeWidth={1.3}>
    <line x1={0} y1={0} x2={0} y2={10} />
    <circle cy={18} r={8} fill={PAPER} />
    <circle cy={29} r={8} />
  </g>
);

/** Cable termination (sealing end) pointing right. */
export const CableEnd = () => (
  <g stroke="currentColor" strokeWidth={SW} fill={PAPER}>
    <path d="M -8 -9 L 8 0 L -8 9 Z" />
  </g>
);

export const Battery = () => (
  <g stroke="currentColor" strokeWidth={SW}>
    <line x1={-12} y1={-5} x2={12} y2={-5} strokeWidth={2.6} />
    <line x1={-7} y1={3} x2={7} y2={3} />
    <line x1={-12} y1={10} x2={12} y2={10} strokeWidth={2.6} />
    <line x1={-7} y1={18} x2={7} y2={18} />
  </g>
);

/** Protection / control device: box with ANSI function numbers. */
export const Relay = ({ codes, w = 92 }: { codes: string; w?: number }) => (
  <g>
    <rect x={-w / 2} y={-14} width={w} height={28} rx={3} fill={PAPER} stroke="currentColor" strokeWidth={SW} />
    <text y={4} textAnchor="middle" fontSize={10.5} fontWeight={700} fontFamily="ui-monospace, monospace" fill="currentColor">{codes}</text>
  </g>
);

// ── process (ISA-5.1 / ISO 10628) ─────────────────────────────────────

/** Instrument bubble: letters over number; `panel` adds the board line. */
export const Bubble = ({ letters, num, panel = false, alarm = false }: { letters: string; num: string; panel?: boolean; alarm?: boolean }) => (
  <g>
    <circle r={15} fill={PAPER} stroke={alarm ? "var(--color-status-alarm)" : "currentColor"} strokeWidth={alarm ? 2.4 : SW} />
    {panel && <line x1={-15} y1={0} x2={15} y2={0} stroke="currentColor" strokeWidth={1} />}
    <text y={-2.5} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="currentColor">{letters}</text>
    <text y={10} textAnchor="middle" fontSize={9} fontWeight={700} fill="currentColor">{num}</text>
  </g>
);

export const Pump = ({ running = true }: { running?: boolean }) => (
  <g stroke="currentColor" strokeWidth={SW}>
    <circle r={14} fill={running ? "var(--color-status-normal)" : PAPER} fillOpacity={running ? 0.22 : 1} />
    <path d="M -9 -10 L 14 0 L -9 10" fill="none" />
  </g>
);

export const Tank = ({ w = 90, h = 50, level = 0.6 }: { w?: number; h?: number; level?: number }) => (
  <g stroke="currentColor" strokeWidth={SW}>
    <rect x={-w / 2} y={-h / 2 + h * (1 - level)} width={w} height={h * level} fill="#f59e0b" fillOpacity={0.18} stroke="none" />
    <path d={`M ${-w / 2} ${-h / 2} L ${-w / 2} ${h / 2} L ${w / 2} ${h / 2} L ${w / 2} ${-h / 2}`} fill="none" />
  </g>
);

export const Filter = () => (
  <g stroke="currentColor" strokeWidth={SW}>
    <path d="M 0 -12 L 12 0 L 0 12 L -12 0 Z" fill={PAPER} />
    <line x1={-8} y1={-4} x2={8} y2={4} strokeDasharray="2 2" />
  </g>
);

/** Two-way valve body (bow-tie) on a horizontal line. */
const Bowtie = () => <path d="M -11 -8 L 11 8 L 11 -8 L -11 8 Z" fill={PAPER} stroke="currentColor" strokeWidth={SW} />;

export const CheckValve = () => (
  <g>
    <Bowtie />
    <path d="M -4 -13 L 6 -13" stroke="currentColor" strokeWidth={1.2} markerEnd="url(#dwg-arrow)" />
  </g>
);

export const ReliefValve = () => (
  <g stroke="currentColor" strokeWidth={SW} fill="none">
    <Bowtie />
    <path d="M 0 -8 L 0 -12 L -5 -15 L 5 -19 L -5 -23 L 5 -27 L 0 -30" />
  </g>
);

/** Proportional (servo) valve: two envelopes with an arrow. */
export const ProportionalValve = () => (
  <g stroke="currentColor" strokeWidth={SW}>
    <rect x={-20} y={-9} width={20} height={18} fill={PAPER} />
    <rect x={0} y={-9} width={20} height={18} fill={PAPER} />
    <path d="M -24 12 L 24 -12" fill="none" strokeWidth={1.1} markerEnd="url(#dwg-arrow)" />
  </g>
);

/** Bladder accumulator standing on the line. */
export const Accumulator = ({ charge = 0.7 }: { charge?: number }) => (
  <g stroke="currentColor" strokeWidth={SW}>
    <rect x={-11} y={-44} width={22} height={40} rx={11} fill={PAPER} />
    <line x1={-11} y1={-44 + 40 * (1 - charge)} x2={11} y2={-44 + 40 * (1 - charge)} strokeDasharray="3 2" />
    <line x1={0} y1={-4} x2={0} y2={0} />
  </g>
);

/** Double-acting cylinder, rod to the right. */
export const Cylinder = ({ ext = 0.5 }: { ext?: number }) => (
  <g stroke="currentColor" strokeWidth={SW}>
    <rect x={-26} y={-11} width={44} height={22} fill={PAPER} />
    <line x1={-18 + 28 * ext} y1={-11} x2={-18 + 28 * ext} y2={11} strokeWidth={3} />
    <line x1={-18 + 28 * ext} y1={0} x2={30} y2={0} strokeWidth={3} />
  </g>
);

export const HeatExchanger = () => (
  <g stroke="currentColor" strokeWidth={SW}>
    <circle r={20} fill={PAPER} />
    <path d="M -20 0 L -10 -9 L 0 9 L 10 -9 L 20 0" fill="none" />
  </g>
);

export const Fan = ({ spin = 0 }: { spin?: number }) => (
  <g stroke="currentColor" strokeWidth={SW}>
    <circle r={13} fill={PAPER} />
    <g transform={`rotate(${spin})`}>
      {[0, 90, 180, 270].map((a) => (
        <path key={a} transform={`rotate(${a})`} d="M 0 0 Q 6 -3 9 -9 Q 2 -8 0 0" fill="currentColor" fillOpacity={0.5} strokeWidth={0.8} />
      ))}
    </g>
  </g>
);

/** Brake disc (vertical) with a caliper. */
export const BrakeCaliper = ({ applied = false }: { applied?: boolean }) => (
  <g stroke="currentColor" strokeWidth={SW}>
    <line x1={0} y1={-26} x2={0} y2={26} strokeWidth={4} />
    <rect x={applied ? -9 : -12} y={-30} width={7} height={14} fill={applied ? "var(--color-status-alarm)" : PAPER} fillOpacity={applied ? 0.6 : 1} />
    <rect x={applied ? 2 : 5} y={-30} width={7} height={14} fill={applied ? "var(--color-status-alarm)" : PAPER} fillOpacity={applied ? 0.6 : 1} />
  </g>
);

// ── mechanical ────────────────────────────────────────────────────────

/** Rolling bearing on a horizontal shaft (box with rolling element). */
export const Bearing = () => (
  <g stroke="currentColor" strokeWidth={SW}>
    <rect x={-13} y={-24} width={26} height={12} fill={PAPER} />
    <circle cy={-18} r={4} fill="none" />
    <rect x={-13} y={12} width={26} height={12} fill={PAPER} />
    <circle cy={18} r={4} fill="none" />
  </g>
);

export const Coupling = () => (
  <g stroke="currentColor" strokeWidth={SW} fill="none">
    <line x1={-5} y1={-18} x2={-5} y2={18} strokeWidth={3} />
    <line x1={5} y1={-18} x2={5} y2={18} strokeWidth={3} />
    <path d="M -5 -18 Q 0 -24 5 -18 M -5 18 Q 0 24 5 18" />
  </g>
);

export const GearStage = ({ name, ratio }: { name: string; ratio: string }) => (
  <g>
    <rect x={-40} y={-44} width={80} height={88} rx={3} fill={PAPER} stroke="currentColor" strokeWidth={SW} />
    {/* ring, planets, sun */}
    <circle r={30} fill="none" stroke="currentColor" strokeWidth={1.1} />
    {[0, 120, 240].map((a) => (
      <circle key={a} cx={18 * Math.cos((a * Math.PI) / 180)} cy={18 * Math.sin((a * Math.PI) / 180)} r={9} fill="none" stroke="currentColor" strokeWidth={1.1} />
    ))}
    <circle r={7} fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeWidth={1.1} />
    <text y={-50} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="currentColor">{name}</text>
    <text y={60} textAnchor="middle" fontSize={11} fontWeight={800} fontFamily="ui-monospace, monospace" fill="currentColor">{ratio}</text>
  </g>
);

/** Off-sheet connector (continuation arrow) with a reference. */
export const OffSheet = ({ text }: { text: string }) => (
  <g>
    <path d="M 0 -10 L 60 -10 L 72 0 L 60 10 L 0 10 Z" fill={PAPER} stroke="currentColor" strokeWidth={SW} />
    <text x={32} y={4} textAnchor="middle" fontSize={10} fontWeight={800} fill="currentColor">{text}</text>
  </g>
);

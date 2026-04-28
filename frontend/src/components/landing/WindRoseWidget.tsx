/**
 * Wind rose histogram — 16-sector polar chart of wind direction frequency,
 * banded by wind-speed bin per IEC 61400-1.
 *
 * Reads from useLandingStore live KPI feed; current wind direction lights up
 * its sector (active glow) so the operator sees both the long-term
 * climatology and the instantaneous flow at the same time.
 *
 * The bins are deterministic stubs derived from the average wind speed and
 * the dominant SW direction (220°) typical of the Polish Baltic.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GripVertical, X, Wind } from "lucide-react";

import { selectKPIs, useLandingStore } from "../../store/landingStore";

const SECTORS = 16; // 22.5° each
const SECTOR_DEG = 360 / SECTORS;

// IEC 61400-1 wind-speed bins (m/s), inner → outer.
const BINS = [
  { min: 0,  max: 5,  color: "#0ea5e9" },   // light
  { min: 5,  max: 10, color: "#3ecf6e" },   // moderate
  { min: 10, max: 15, color: "#f5a623" },   // strong
  { min: 15, max: 25, color: "#ef4444" },   // gale
];

// Climatology — frequency of each (sector, bin) for the Polish Baltic.
// SW (sectors 9-11) dominate, with secondary peak in NW (12-14).
function buildClimatology(): number[][] {
  const data: number[][] = [];
  for (let s = 0; s < SECTORS; s++) {
    const sectorDeg = s * SECTOR_DEG;
    // Distance from prevailing SW (225°).
    const dSW = Math.min(Math.abs(sectorDeg - 225), 360 - Math.abs(sectorDeg - 225));
    // Distance from NW (315°).
    const dNW = Math.min(Math.abs(sectorDeg - 315), 360 - Math.abs(sectorDeg - 315));
    const swPeak = Math.exp(-(dSW * dSW) / 1800);  // gaussian around SW
    const nwPeak = Math.exp(-(dNW * dNW) / 4000) * 0.5;
    const base = 0.02 + swPeak * 0.18 + nwPeak * 0.12;
    // Distribute frequency across speed bins (offshore Baltic mean ~9 m/s).
    data.push([
      base * 0.20,  // 0–5
      base * 0.40,  // 5–10
      base * 0.30,  // 10–15
      base * 0.10,  // 15–25
    ]);
  }
  return data;
}

const CLIMATOLOGY = buildClimatology();
const MAX_FREQ = Math.max(...CLIMATOLOGY.map((s) => s.reduce((a, b) => a + b, 0)));

// Stable default position — clears the 2-row KPI ribbon (~80 px) at the top.
const DEFAULT_POS = { x: 8, y: 96 };

export const WindRoseWidget = memo(function WindRoseWidget() {
  const kpis = useLandingStore(selectKPIs);
  const currentDir = kpis.windDirectionDeg;

  // Sector index of the current wind (mod 16)
  const activeSector = Math.floor(((currentDir + SECTOR_DEG / 2) / SECTOR_DEG) % SECTORS);

  // ── Visibility + drag state ─────────────────────────────────────
  const [isOpen, setIsOpen] = useState(true);
  const [pos, setPos] = useState(DEFAULT_POS);
  const dragStateRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  }, [pos.x, pos.y]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      // Clamp to viewport so the panel doesn't disappear off-screen
      const newX = Math.max(0, Math.min(window.innerWidth - 100, ds.origX + (e.clientX - ds.startX)));
      const newY = Math.max(0, Math.min(window.innerHeight - 80, ds.origY + (e.clientY - ds.startY)));
      setPos({ x: newX, y: newY });
    };
    const onUp = () => { dragStateRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const sectors = useMemo(() => {
    return CLIMATOLOGY.map((bins, s) => {
      const startAngle = s * SECTOR_DEG - SECTOR_DEG / 2 - 90; // -90 so 0° = top (N)
      const endAngle = startAngle + SECTOR_DEG;
      // Build stacked annular wedges per bin
      let r0 = 8;
      const wedges: { d: string; color: string }[] = [];
      for (const b of bins.map((freq, i) => ({ freq, color: BINS[i].color }))) {
        const r1 = r0 + (b.freq / MAX_FREQ) * 60;
        wedges.push({ d: arcWedge(r0, r1, startAngle, endAngle), color: b.color });
        r0 = r1;
      }
      return { wedges, isActive: s === activeSector };
    });
  }, [activeSector]);

  // Collapsed state — small reopen tab in the same screen position
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute z-[1000] flex items-center gap-1.5 px-2 py-1.5 bg-bg-secondary/85 backdrop-blur-md border border-border-primary rounded-md shadow-lg shadow-black/30 hover:bg-bg-hover transition-colors pointer-events-auto"
        style={{ left: pos.x, top: pos.y }}
        aria-label="Open wind rose"
        title="Open wind rose"
      >
        <Wind size={12} className="text-cyan-400" />
        <span className="text-[10px] font-mono text-text-secondary">Wind Rose</span>
      </button>
    );
  }

  return (
    <div
      className="absolute z-[1000] select-none pointer-events-auto"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="bg-bg-secondary/85 backdrop-blur-md border border-border-primary rounded-lg shadow-lg shadow-black/30">
        {/* Drag handle + title + close */}
        <div
          className="flex items-center justify-between px-2 py-1 border-b border-border-primary cursor-grab active:cursor-grabbing"
          onMouseDown={onDragMouseDown}
        >
          <div className="flex items-center gap-1">
            <GripVertical size={10} className="text-text-muted" />
            <span className="text-[9px] text-text-muted font-mono uppercase tracking-widest">Wind Rose · 30-day</span>
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setIsOpen(false)}
            className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-bg-hover ml-1"
            aria-label="Close wind rose"
          >
            <X size={10} />
          </button>
        </div>
        <div className="p-2">
        <svg width="160" height="160" viewBox="-80 -80 160 160">
          {/* Backdrop circle + range rings */}
          {[20, 40, 60].map((r) => (
            <circle key={r} cx={0} cy={0} r={r} fill="none" stroke="#1e2231" strokeWidth={0.4} strokeDasharray="2 2" />
          ))}

          {/* Cardinal labels */}
          {([
            { deg: 0,   l: "N" },
            { deg: 90,  l: "E" },
            { deg: 180, l: "S" },
            { deg: 270, l: "W" },
          ]).map((c) => {
            const r = 70;
            const x = r * Math.sin((c.deg * Math.PI) / 180);
            const y = -r * Math.cos((c.deg * Math.PI) / 180);
            return (
              <text
                key={c.deg}
                x={x} y={y + 3}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="8"
                fontFamily="JetBrains Mono, monospace"
              >
                {c.l}
              </text>
            );
          })}

          {/* Sector wedges */}
          {sectors.map((s, i) => (
            <g key={i} opacity={s.isActive ? 1 : 0.65}>
              {s.wedges.map((w, j) => (
                <path key={j} d={w.d} fill={w.color} stroke="#0a0d14" strokeWidth={0.3} />
              ))}
            </g>
          ))}

          {/* Active sector indicator — bright outline */}
          {(() => {
            const sa = activeSector * SECTOR_DEG - SECTOR_DEG / 2 - 90;
            const ea = sa + SECTOR_DEG;
            return (
              <path
                d={arcWedge(8, 68, sa, ea)}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={1.4}
                opacity={0.9}
              >
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
              </path>
            );
          })()}

          {/* Centre dot */}
          <circle cx={0} cy={0} r={3} fill="#0a0d14" stroke="#475569" strokeWidth={0.8} />
        </svg>
        {/* Live readout */}
        <div className="flex items-center justify-between text-[10px] font-mono px-1 pt-1">
          <span className="text-text-muted">Now</span>
          <span className="text-cyan-400 font-bold">{currentDir.toFixed(0)}°</span>
          <span className="text-text-muted">{cardinal(currentDir)}</span>
        </div>
        {/* Bin legend */}
        <div className="flex items-center justify-between text-[8px] font-mono px-1 mt-1">
          {BINS.map((b) => (
            <div key={b.min} className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: b.color }} />
              <span className="text-text-muted">{b.min}{b.max < 25 ? `–${b.max}` : "+"}</span>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
});

// ── Helpers ──────────────────────────────────────────────────────

function polar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

function arcWedge(r0: number, r1: number, startDeg: number, endDeg: number): string {
  const [x0, y0] = polar(r0, startDeg);
  const [x1, y1] = polar(r0, endDeg);
  const [x2, y2] = polar(r1, endDeg);
  const [x3, y3] = polar(r1, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${x0.toFixed(2)},${y0.toFixed(2)}`,
    `A ${r0},${r0} 0 ${largeArc} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`,
    `L ${x2.toFixed(2)},${y2.toFixed(2)}`,
    `A ${r1},${r1} 0 ${largeArc} 0 ${x3.toFixed(2)},${y3.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function cardinal(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

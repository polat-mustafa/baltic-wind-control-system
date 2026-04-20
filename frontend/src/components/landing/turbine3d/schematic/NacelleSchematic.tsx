/**
 * 2D isometric technical schematic of the nacelle interior.
 *
 * Acts as a "clarity mode" — when realism isn't what the user needs, they
 * switch here to read every component as a labelled box in an engineering
 * drawing. The selected-part state is shared with the 3D view, so clicking
 * in the schematic also flies the 3D camera to that part, and vice-versa.
 *
 * Phase 6.1 additions:
 *   • Visible × close button, header, and hint
 *   • Hover tooltip card with component title, rated spec, standards
 *   • Wheel zoom + drag pan (scale 0.5–3.0, clamped)
 *   • Left-side layer toggle strip (Labels / Hatching / Thermal / Sensors / Power / Connections)
 *   • P&ID connection bezier curves (hydraulic / coolant / electrical / data)
 *   • Double-click or R key to reset view
 *
 * Rendering is pure SVG — zero GPU cost. Overlays atop the faded 3D canvas.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { X, Tag, Grid3x3, Thermometer, Radio, Zap, GitBranch, ExternalLink, Focus } from "lucide-react";

import {
  selectTurbinePart,
  selectThermalOverlay,
  selectSensorMarkers,
  selectPowerFlow,
  useLandingStore,
} from "../../../../store/landingStore";
import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { TURBINE_PART_EDUCATION } from "../../../../constants/turbinePartEducation";

import {
  NACELLE_SCHEMATIC_PARTS,
  NACELLE_CONNECTIONS,
  CONNECTION_STYLES,
  TONE_STYLES,
  FOCUS_MODES,
  type FocusModeId,
  type SchematicPart,
} from "./schematicData";

interface NacelleSchematicProps {
  turbineId: string;
}

const VIEWBOX_W = 1200;
const VIEWBOX_H = 700;

/** Isometric skew — 30° around Y, 15° around X. */
const ISO = { a: 0.94, b: 0.15, c: -0.52, d: 0.82, e: 280, f: 40 };
const ISO_TRANSFORM = `matrix(${ISO.a}, ${ISO.b}, ${ISO.c}, ${ISO.d}, ${ISO.e}, ${ISO.f})`;

function isoProject(x: number, y: number): { x: number; y: number } {
  return { x: ISO.a * x + ISO.c * y + ISO.e, y: ISO.b * x + ISO.d * y + ISO.f };
}

interface View { tx: number; ty: number; scale: number }
const DEFAULT_VIEW: View = { tx: 0, ty: 0, scale: 1 };

export const NacelleSchematic = memo(function NacelleSchematic({ turbineId }: NacelleSchematicProps) {
  const selected = useLandingStore(selectTurbinePart);
  const setSelected = useLandingStore((s) => s.setSelectedTurbinePart);
  const setInteriorView = useLandingStore((s) => s.setInteriorView);
  const showThermal = useLandingStore(selectThermalOverlay);
  const showSensors = useLandingStore(selectSensorMarkers);
  const showPower = useLandingStore(selectPowerFlow);
  const setShowThermal = useLandingStore((s) => s.setShowThermalOverlay);
  const setShowSensors = useLandingStore((s) => s.setShowSensorMarkers);
  const setShowPowerFlow = useLandingStore((s) => s.setShowPowerFlow);

  const [showLabels, setShowLabels] = useState(true);
  const [showHatching, setShowHatching] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [focusMode, setFocusMode] = useState<FocusModeId>("all");

  const activeGroups = useMemo(() => {
    const mode = FOCUS_MODES.find((m) => m.id === focusMode);
    return mode?.groups ?? null;
  }, [focusMode]);

  const isPartInFocus = useCallback(
    (part: SchematicPart) => {
      if (!activeGroups) return true;
      if (!part.groups || part.groups.length === 0) return false;
      return part.groups.some((g) => (activeGroups as readonly string[]).includes(g));
    },
    [activeGroups],
  );

  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [hoveredId, setHoveredId] = useState<TurbinePartId | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const parts = NACELLE_SCHEMATIC_PARTS;

  // Map screen event to viewBox coords (accounts for preserveAspectRatio).
  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEWBOX_W,
      y: ((clientY - rect.top) / rect.height) * VIEWBOX_H,
    };
  }, []);

  // Native wheel listener — React's synthetic onWheel is passive:true, so
  // e.preventDefault() logs a warning. Attach manually with passive:false.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = toViewBox(e.clientX, e.clientY);
      setView((v) => {
        const next = Math.max(0.5, Math.min(3, v.scale * (e.deltaY < 0 ? 1.12 : 0.89)));
        const k = next / v.scale;
        return { scale: next, tx: x - k * (x - v.tx), ty: y - k * (y - v.ty) };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toViewBox]);

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    setCursor({ x: e.clientX, y: e.clientY });
    // Deref once — the updater callback runs later and the ref may be nulled
    // by pointerUp before the callback executes (Strict Mode / concurrent replay).
    const drag = dragRef.current;
    if (!drag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - drag.x) / rect.width)  * VIEWBOX_W;
    const dy = ((e.clientY - drag.y) / rect.height) * VIEWBOX_H;
    setView((v) => ({ ...v, tx: drag.tx + dx, ty: drag.ty + dy }));
  };
  const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = null;
    try { (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId); } catch { /* no-op */ }
  };

  const resetView = useCallback(() => setView(DEFAULT_VIEW), []);

  const hoveredPart = useMemo(
    () => (hoveredId ? parts.find((p) => p.id === hoveredId) ?? null : null),
    [hoveredId, parts],
  );

  const selectedPart = useMemo(
    () => (selected ? parts.find((p) => p.id === selected) ?? null : null),
    [selected, parts],
  );

  const contentTransform = `translate(${view.tx} ${view.ty}) scale(${view.scale})`;

  return (
    <div className="absolute inset-0 pointer-events-auto bg-black/40 backdrop-blur-[1px]">
      {/* Header bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-3 pointer-events-auto">
        <div className="bg-bg-secondary/85 border border-border-primary rounded px-3 py-1.5 backdrop-blur-sm">
          <div className="text-[11px] font-mono font-bold text-text-primary tracking-wider">
            V236 · NACELLE INTERIOR · {turbineId}
          </div>
          <div className="text-[9px] font-mono text-text-muted">
            Isometric schematic · press S or click × to return to 3D
          </div>
        </div>
        <button
          onClick={() => setInteriorView("3d")}
          className="flex items-center gap-1.5 bg-red-900/40 hover:bg-red-800/60 border border-red-700/60 text-red-200 rounded px-3 py-1.5 text-[11px] font-mono backdrop-blur-sm transition-colors"
          title="Return to 3D view (S or Esc)"
        >
          <X size={14} />
          <span>Close schematic</span>
        </button>
      </div>

      {/* Layer toggle strip (left side) */}
      <div className="absolute top-20 left-3 z-10 flex flex-col gap-1 pointer-events-auto">
        <LayerToggle active={showLabels}      onClick={() => setShowLabels(v => !v)}      icon={<Tag size={11} />}       label="Labels"      />
        <LayerToggle active={showHatching}    onClick={() => setShowHatching(v => !v)}    icon={<Grid3x3 size={11} />}   label="Hatching"    />
        <LayerToggle active={showConnections} onClick={() => setShowConnections(v => !v)} icon={<GitBranch size={11} />} label="Connections" />
        <LayerToggle active={showThermal}     onClick={() => setShowThermal(!showThermal)}    icon={<Thermometer size={11} />} label="Thermal" />
        <LayerToggle active={showSensors}     onClick={() => setShowSensors(!showSensors)}    icon={<Radio size={11} />}       label="Sensors" />
        <LayerToggle active={showPower}       onClick={() => setShowPowerFlow(!showPower)}    icon={<Zap size={11} />}         label="Power"   />
        {/* Focus dropdown — dims parts outside the selected functional group */}
        <div className="mt-1 flex items-center gap-1.5 rounded px-2 py-1 border border-border-primary bg-bg-secondary/80 backdrop-blur-sm">
          <Focus size={11} className="text-text-muted" />
          <select
            value={focusMode}
            onChange={(e) => setFocusMode(e.target.value as FocusModeId)}
            className="bg-transparent text-[10px] font-mono text-text-primary outline-none cursor-pointer"
            title="Focus the schematic on a functional group"
          >
            {FOCUS_MODES.map((m) => (
              <option key={m.id} value={m.id} className="bg-bg-secondary text-text-primary">
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reset view hint */}
      <div className="absolute bottom-3 right-3 z-10 bg-bg-secondary/75 border border-border-primary rounded px-2 py-1 text-[9px] font-mono text-text-muted pointer-events-auto">
        Wheel: zoom · Drag: pan · <button className="underline" onClick={resetView}>Reset</button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full select-none cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={resetView}
      >
        {/* Defs */}
        <defs>
          <pattern id="blueprint-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e3a5f" strokeWidth="0.4" opacity="0.45" />
          </pattern>
          <pattern id="hatch-metal" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#334155" strokeWidth="1" />
          </pattern>
          <pattern id="hatch-winding" width="5" height="5" patternUnits="userSpaceOnUse">
            <line x1="0" y1="2.5" x2="5" y2="2.5" stroke="#c2410c" strokeWidth="0.8" />
          </pattern>
          <filter id="selected-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="arrow-power" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" />
          </marker>
        </defs>

        {/* Paper background */}
        <rect width={VIEWBOX_W} height={VIEWBOX_H} fill="#050a13" />
        <rect width={VIEWBOX_W} height={VIEWBOX_H} fill="url(#blueprint-grid)" />

        {/* Title block (stays fixed — outside pan/zoom) */}
        <g transform={`translate(${VIEWBOX_W - 290}, ${VIEWBOX_H - 90})`}>
          <rect width="280" height="70" fill="#0c1828" stroke="#64748b" strokeWidth="1" />
          <text x="10" y="20" className="fill-slate-300" fontSize="11" fontFamily="monospace" fontWeight="700">
            V236-15.0 MW — NACELLE INTERIOR
          </text>
          <text x="10" y="36" className="fill-slate-400" fontSize="9" fontFamily="monospace">
            ISO VIEW · SCALE 1:60 · {turbineId}
          </text>
          <text x="10" y="52" className="fill-slate-500" fontSize="8" fontFamily="monospace">
            DWG-NAC-001 · REV A · 2026-04-17
          </text>
          <text x="10" y="64" className="fill-slate-500" fontSize="8" fontFamily="monospace">
            BALTIC WIND ALPHA · EDUCATIONAL
          </text>
        </g>

        {/* Connections legend (also fixed) */}
        {showConnections && (
          <g transform="translate(16, 148)">
            <rect width="200" height="92" fill="#0c1828" stroke="#475569" strokeWidth="1" opacity="0.92" />
            <text x="10" y="16" className="fill-slate-200" fontSize="10" fontFamily="monospace" fontWeight="700">
              P&amp;ID CONNECTIONS
            </text>
            {Object.entries(CONNECTION_STYLES).map(([kind, style], i) => (
              <g key={kind} transform={`translate(10, ${28 + i * 12})`}>
                <line x1="0" y1="4" x2="18" y2="4" stroke={style.stroke} strokeWidth="2" strokeDasharray="4 2" />
                <text x="24" y="7" className="fill-slate-400" fontSize="8.5" fontFamily="monospace">{style.label}</text>
              </g>
            ))}
          </g>
        )}

        {/* Pan/zoom group */}
        <g transform={contentTransform}>
          {/* Nacelle outline (housing) */}
          <g transform={ISO_TRANSFORM}>
            <rect x="0" y="60" width="1000" height="500" fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="6 4" opacity="0.85" />
            <text x="500" y="50" textAnchor="middle" className="fill-slate-400" fontSize="11" fontFamily="monospace">
              NACELLE ENCLOSURE · 20 m × 8 m × 9 m
            </text>

            {/* Driveline centerline */}
            <line x1="0" y1="330" x2="1000" y2="330" stroke="#475569" strokeWidth="0.8" strokeDasharray="2 3" />

            {/* Connections (under parts) */}
            {showConnections && (
              <g opacity={0.85}>
                {NACELLE_CONNECTIONS.map((c, i) => (
                  <ConnectionCurve key={`conn-${i}`} connection={c} parts={parts} />
                ))}
              </g>
            )}

            {/* Parts */}
            {parts.map((p) => (
              <SchematicPartRect
                key={p.id}
                part={p}
                selected={selected === p.id}
                hovered={hoveredId === p.id}
                inFocus={isPartInFocus(p)}
                onSelect={() => setSelected(p.id)}
                onHover={setHoveredId}
                overlayThermal={showThermal}
                overlaySensors={showSensors}
                overlayPower={showPower}
                showHatching={showHatching}
                showInlineLabel={showLabels}
              />
            ))}

            {/* Power-flow arrows */}
            {showPower && <PowerFlowArrows parts={parts} />}
          </g>

          {/* Leader-line labels (screen-space, still inside pan/zoom) */}
          {showLabels && parts.map((p) => (
            <PartLabel key={`lbl-${p.id}`} part={p} selected={selected === p.id} />
          ))}
        </g>

        {/* Click hint (fixed) */}
        <text
          x={VIEWBOX_W / 2}
          y={VIEWBOX_H - 14}
          textAnchor="middle"
          className="fill-slate-500"
          fontSize="9"
          fontFamily="monospace"
        >
          Click any component — selection syncs with the 3D view.
        </text>
      </svg>

      {/* Hover tooltip (HTML, follows cursor) */}
      {hoveredPart && (
        <HoverTooltip part={hoveredPart} x={cursor.x} y={cursor.y} />
      )}

      {/* Detail panel — persistent, right side, when a part is selected */}
      {selectedPart && (
        <DetailPanel
          part={selectedPart}
          onClose={() => setSelected(null)}
          onOpenIn3D={() => {
            // Switch back to 3D, then clear + re-set the selection after one
            // frame so the 3D canvas has refreshed matrixWorld on all meshes
            // before useCameraFlyTo reads bounds via resolvePartCameraTarget.
            const partId = selectedPart.id;
            setInteriorView("3d");
            setSelected(null);
            requestAnimationFrame(() => setSelected(partId));
          }}
        />
      )}
    </div>
  );
});

// ── Layer toggle pill ──────────────────────────────────────────────

function LayerToggle({
  active, onClick, icon, label,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-1.5 rounded px-2 py-1 border backdrop-blur-sm text-[10px] font-mono transition-colors " +
        (active
          ? "bg-accent/20 border-accent/40 text-accent"
          : "bg-bg-secondary/80 border-border-primary text-text-muted hover:text-text-primary")
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ── Single part rectangle ──────────────────────────────────────────

interface PartRectProps {
  part: SchematicPart;
  selected: boolean;
  hovered: boolean;
  inFocus: boolean;
  onSelect: () => void;
  onHover: (id: TurbinePartId | null) => void;
  overlayThermal: boolean;
  overlaySensors: boolean;
  overlayPower: boolean;
  showHatching: boolean;
  showInlineLabel: boolean;
}

function SchematicPartRect({
  part, selected, hovered, inFocus, onSelect, onHover,
  overlayThermal, overlaySensors, showHatching, showInlineLabel,
}: PartRectProps) {
  const style = TONE_STYLES[part.tone];
  const hatchFill =
    !showHatching                ? null :
    part.tone === "metal"        ? "url(#hatch-metal)"   :
    part.tone === "winding"      ? "url(#hatch-winding)" :
    null;

  const hotParts: TurbinePartId[] = ["gearbox", "generator", "converter", "transformer"];
  const isHot = hotParts.includes(part.id);

  // Dim parts outside the active focus group (but never dim the selected one).
  const dimmed = !inFocus && !selected;

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseEnter={() => onHover(part.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: "pointer" }}
      filter={selected ? "url(#selected-glow)" : undefined}
      opacity={dimmed ? 0.3 : 1}
    >
      <rect x={part.x} y={part.y} width={part.w} height={part.h} fill={style.fill} opacity={0.85} />
      {hatchFill && (
        <rect x={part.x} y={part.y} width={part.w} height={part.h} fill={hatchFill} opacity={0.35} />
      )}
      {overlayThermal && isHot && (
        <rect x={part.x} y={part.y} width={part.w} height={part.h} fill="#f97316" opacity={0.22} />
      )}
      <rect
        x={part.x} y={part.y} width={part.w} height={part.h}
        fill="none"
        stroke={selected ? "#60a5fa" : hovered ? "#93c5fd" : style.stroke}
        strokeWidth={selected ? 2.5 : hovered ? 1.8 : 1.2}
      />
      {showInlineLabel && (
        <text
          x={part.x + part.w / 2}
          y={part.y + part.h / 2 + 3}
          textAnchor="middle"
          className="fill-slate-200"
          fontSize="8.5"
          fontFamily="monospace"
          pointerEvents="none"
        >
          {part.label.split(" ")[0]}
        </text>
      )}
      {overlaySensors && (
        <>
          <circle cx={part.x + 8}          cy={part.y + 8}          r="2.2" fill="#22c55e" />
          <circle cx={part.x + part.w - 8} cy={part.y + part.h - 8} r="2.2" fill="#22c55e" />
        </>
      )}
    </g>
  );
}

// ── Leader-line label ──────────────────────────────────────────────

function PartLabel({ part, selected }: { part: SchematicPart; selected: boolean }) {
  const tip = isoProject(part.x + part.w / 2, part.y + part.h / 2);
  const labelX = part.callout?.x ?? tip.x + 40;
  const labelY = part.callout?.y ?? tip.y - 20;
  const stroke = selected ? "#60a5fa" : "#64748b";
  const text = selected ? "#93c5fd" : "#cbd5e1";

  return (
    <g pointerEvents="none" opacity={selected ? 1 : 0.75}>
      <line x1={tip.x} y1={tip.y} x2={labelX} y2={labelY} stroke={stroke} strokeWidth={selected ? 1.3 : 0.8} />
      <circle cx={tip.x} cy={tip.y} r="2" fill={stroke} />
      <text x={labelX + 4} y={labelY} fill={text} fontSize="9.5" fontFamily="monospace" fontWeight={selected ? 700 : 400}>
        {part.label}
      </text>
      {part.sublabel && (
        <text x={labelX + 4} y={labelY + 10} fill="#64748b" fontSize="8" fontFamily="monospace">
          {part.sublabel}
        </text>
      )}
    </g>
  );
}

// ── P&ID connection bezier ─────────────────────────────────────────

function ConnectionCurve({
  connection, parts,
}: { connection: { from: TurbinePartId; to: TurbinePartId; kind: keyof typeof CONNECTION_STYLES }; parts: SchematicPart[] }) {
  const from = parts.find((p) => p.id === connection.from);
  const to   = parts.find((p) => p.id === connection.to);
  if (!from || !to) return null;
  const x1 = from.x + from.w / 2, y1 = from.y + from.h / 2;
  const x2 = to.x + to.w / 2,     y2 = to.y + to.h / 2;
  const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
  const bend = 0.35 * Math.max(dx, dy);
  const cx1 = x1 + (x2 > x1 ? bend : -bend);
  const cy1 = y1;
  const cx2 = x2 - (x2 > x1 ? bend : -bend);
  const cy2 = y2;
  const style = CONNECTION_STYLES[connection.kind];
  return (
    <path
      d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
      fill="none"
      stroke={style.stroke}
      strokeWidth={1.6}
      strokeDasharray="6 4"
      opacity={0.85}
    />
  );
}

// ── Power-flow arrows through the driveline ────────────────────────

function PowerFlowArrows({ parts }: { parts: SchematicPart[] }) {
  const chain: TurbinePartId[] = ["hub", "shaft", "gearbox", "generator", "converter", "transformer"];
  const nodes = useMemo(
    () =>
      chain
        .map((id) => parts.find((p) => p.id === id))
        .filter((p): p is SchematicPart => !!p)
        .map((p) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 })),
    [parts],
  );

  return (
    <g opacity="0.75">
      {nodes.slice(0, -1).map((a, i) => {
        const b = nodes[i + 1];
        return (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#22d3ee" strokeWidth="2" strokeDasharray="8 6" markerEnd="url(#arrow-power)">
            <animate attributeName="stroke-dashoffset" from="28" to="0" dur="1.6s" repeatCount="indefinite" />
          </line>
        );
      })}
    </g>
  );
}

// ── Hover tooltip card (HTML, follows cursor) ──────────────────────

function HoverTooltip({ part, x, y }: { part: SchematicPart; x: number; y: number }) {
  const education = TURBINE_PART_EDUCATION.find((e) => e.partId === part.id);
  return (
    <div
      className="absolute z-30 pointer-events-none bg-bg-secondary/95 border border-border-primary rounded-md px-3 py-2 backdrop-blur-md shadow-xl max-w-[280px]"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="text-[11px] font-mono font-bold text-text-primary">{part.label}</div>
      {part.sublabel && <div className="text-[9px] font-mono text-text-muted mt-0.5">{part.sublabel}</div>}
      {education && (
        <>
          <div className="mt-1.5 text-[9px] text-text-muted leading-snug">
            {education.simpleExplanation ?? education.overview?.slice(0, 140)}
          </div>
          {education.standards?.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {education.standards.slice(0, 3).map((s: string) => (
                <span key={s} className="text-[8px] font-mono px-1 py-0.5 bg-accent/10 text-accent rounded">{s}</span>
              ))}
            </div>
          ) : null}
        </>
      )}
      {part.cite?.length ? (
        <div className="mt-1.5 text-[8px] font-mono text-text-muted border-t border-border-primary/50 pt-1">
          Sources: {part.cite.map((c) => c.source).join(" · ")}
        </div>
      ) : null}
      <div className="mt-1.5 text-[8px] font-mono text-text-muted italic">Click for details · opens in 3D from panel</div>
    </div>
  );
}

// ── Detail panel (right side, persistent while a part is selected) ───

function DetailPanel({
  part, onClose, onOpenIn3D,
}: { part: SchematicPart; onClose: () => void; onOpenIn3D: () => void }) {
  const education = TURBINE_PART_EDUCATION.find((e) => e.partId === part.id);
  return (
    <div className="absolute top-20 right-3 z-20 w-[300px] max-h-[calc(100%-8rem)] overflow-y-auto bg-bg-secondary/95 border border-border-primary rounded-md backdrop-blur-md shadow-xl pointer-events-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
        <div>
          <div className="text-[11px] font-mono font-bold text-text-primary">{part.label}</div>
          {part.sublabel && <div className="text-[9px] font-mono text-text-muted">{part.sublabel}</div>}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-bg-hover rounded" title="Deselect">
          <X size={12} className="text-text-muted" />
        </button>
      </div>

      <div className="p-3 space-y-2.5 text-[10px] font-mono text-text-muted leading-snug">
        {education?.simpleExplanation && (
          <div>
            <div className="text-[9px] text-text-muted/70 uppercase tracking-wider mb-0.5">Overview</div>
            <div className="text-text-primary text-[10.5px]">{education.simpleExplanation}</div>
          </div>
        )}

        {education?.overview && education.overview !== education.simpleExplanation && (
          <div>
            <div className="text-[9px] text-text-muted/70 uppercase tracking-wider mb-0.5">Technical</div>
            <div>{education.overview}</div>
          </div>
        )}

        {education?.standards?.length ? (
          <div>
            <div className="text-[9px] text-text-muted/70 uppercase tracking-wider mb-1">Standards</div>
            <div className="flex flex-wrap gap-1">
              {education.standards.map((s: string) => (
                <span key={s} className="text-[8.5px] px-1.5 py-0.5 bg-accent/10 text-accent rounded">{s}</span>
              ))}
            </div>
          </div>
        ) : null}

        {part.cite?.length ? (
          <div>
            <div className="text-[9px] text-text-muted/70 uppercase tracking-wider mb-1">References</div>
            <ul className="space-y-1">
              {part.cite.map((c) => (
                <li key={c.url}>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-1 text-accent/90 hover:text-accent underline"
                  >
                    <ExternalLink size={9} className="mt-[2px] shrink-0" />
                    <span className="text-[9.5px] leading-snug">{c.source}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="px-3 py-2 border-t border-border-primary flex items-center justify-between">
        <button
          onClick={onOpenIn3D}
          className="text-[10px] font-mono text-accent hover:underline"
          title="Close schematic and fly 3D camera to this part"
        >
          Open in 3D →
        </button>
        <span className="text-[8px] font-mono text-text-muted">Esc to close</span>
      </div>
    </div>
  );
}

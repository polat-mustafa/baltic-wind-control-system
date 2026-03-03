/**
 * Main SVG canvas — interactive wind farm overview map with zoom/pan.
 *
 * Features:
 * - d3-zoom for smooth pan/zoom (scroll wheel + drag)
 * - Zoom controls (+/- buttons, reset)
 * - Compass rose showing north
 * - Wind direction indicator
 * - Scale bar
 * - Click navigation to P1/P2/P3
 *
 * Layout: left side = open sea with turbines in 6 strings.
 * Right side = coastline and onshore infrastructure.
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import {
  BATHYMETRY_CONTOURS,
  COASTLINE_PATH,
  LAT_LON_GRID,
  OSS_POSITION,
  SEA_BOUNDARY_X,
  SHIPPING_LANE,
  STRING_COLLECTION_POINTS,
  SVG_VIEWBOX,
  TURBINE_POSITIONS,
} from "../../constants/windFarmLayout";
import { cn } from "../../lib/utils";
import { selectCable, selectTransformer, selectTurbine, useLandingStore } from "../../store/landingStore";

import CableDetailPanel from "./CableDetailPanel";
import ExportCableRoute from "./ExportCableRoute";
import MapLegend from "./MapLegend";
import OffshoreSubstation from "./OffshoreSubstation";
import OnshoreSubstation from "./OnshoreSubstation";
import TransformerDetailPanel from "./TransformerDetailPanel";
import TurbineIcon from "./TurbineIcon";
import TurbineTooltip from "./TurbineTooltip";

// ── Connected sub-components (read from store per-item) ─────────

/** Each turbine icon reads its own data from the Zustand store. */
const ConnectedTurbineIcon = memo(function ConnectedTurbineIcon({
  turbineId,
  x,
  y,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  turbineId: string;
  x: number;
  y: number;
  onMouseEnter: (id: string, e: React.MouseEvent<SVGGElement>) => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  if (!turbine) return null;
  return (
    <TurbineIcon
      turbineId={turbineId}
      x={x}
      y={y}
      status={turbine.status}
      powerOutputMW={turbine.powerOutputMW}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    />
  );
});

/** Tooltip reads live data from store by turbine ID. */
function ConnectedTooltip({
  turbineId,
  position,
}: {
  turbineId: string;
  position: { x: number; y: number };
}) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  if (!turbine) return null;
  return <TurbineTooltip turbine={turbine} position={position} />;
}

// ── Main Component ──────────────────────────────────────────────

interface WindFarmMapProps {
  totalPowerMW: number;
}

type DetailPanel = "oss" | "onshore" | "cable" | null;

export default function WindFarmMap({ totalPowerMW }: WindFarmMapProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hoveredTurbineId, setHoveredTurbineId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activePanel, setActivePanel] = useState<DetailPanel>(null);

  // Equipment data from store
  const ossTx = useLandingStore(selectTransformer("OSS-TX1"));
  const onsTx = useLandingStore(selectTransformer("ONS-TX1"));
  const cable = useLandingStore(selectCable);

  // Initialize d3-zoom
  useEffect(() => {
    const svg = svgRef.current;
    const g = gRef.current;
    if (!svg || !g) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 5])
      .on("zoom", (event) => {
        select(g).attr("transform", event.transform.toString());
        setZoomLevel(event.transform.k);
      });

    select(svg).call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  const handleZoomIn = useCallback(() => {
    const svg = svgRef.current;
    const zb = zoomRef.current;
    if (!svg || !zb) return;
    select(svg).transition().duration(300).call(zb.scaleBy, 1.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    const svg = svgRef.current;
    const zb = zoomRef.current;
    if (!svg || !zb) return;
    select(svg).transition().duration(300).call(zb.scaleBy, 0.67);
  }, []);

  const handleZoomReset = useCallback(() => {
    const svg = svgRef.current;
    const zb = zoomRef.current;
    if (!svg || !zb) return;
    select(svg).transition().duration(400).call(zb.transform, zoomIdentity);
  }, []);

  const handleTurbineHover = useCallback(
    (turbineId: string, e: React.MouseEvent<SVGGElement>) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setHoveredTurbineId(turbineId);
    },
    [],
  );

  const handleTurbineLeave = useCallback(() => {
    setHoveredTurbineId(null);
  }, []);

  const handleTurbineClick = useCallback(() => {
    navigate("/wind-resource");
  }, [navigate]);

  // Simulated wind direction (SW ~225 deg)
  const windDirDeg = 225;

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-lg overflow-hidden border border-border-primary bg-bg-secondary shadow-lg shadow-black/20"
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_VIEWBOX.width} ${SVG_VIEWBOX.height}`}
        className="w-full h-auto cursor-grab active:cursor-grabbing"
        style={{ minHeight: 400, maxHeight: 600 }}
      >
        <defs>
          <linearGradient id="seaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0a1628" />
            <stop offset="40%" stopColor="#0d2040" />
            <stop offset="100%" stopColor="#112a4a" />
          </linearGradient>
          <linearGradient id="landGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#162416" />
            <stop offset="100%" stopColor="#1a3018" />
          </linearGradient>
          {/* Grid pattern for sea */}
          <pattern id="seaGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(59,130,246,0.04)" strokeWidth="0.5" />
          </pattern>
          {/* Wave animation pattern */}
          <pattern id="wavePattern" width="60" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-15)">
            <path d="M 0,5 Q 15,0 30,5 Q 45,10 60,5" fill="none" stroke="rgba(59,130,246,0.06)" strokeWidth="0.8">
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0 0"
                to="-60 0"
                dur="8s"
                repeatCount="indefinite"
              />
            </path>
          </pattern>
          {/* Shipping lane dashes */}
          <pattern id="shippingDash" width="20" height="6" patternUnits="userSpaceOnUse">
            <rect x="0" y="2" width="10" height="2" fill="rgba(251,191,36,0.15)" rx="1" />
          </pattern>
          {/* Sand / beach gradient at coastline */}
          <linearGradient id="beachGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(194,178,128,0.08)" />
            <stop offset="100%" stopColor="rgba(194,178,128,0)" />
          </linearGradient>
        </defs>

        {/* Zoomable group — all map content lives here */}
        <g ref={gRef}>
          {/* Sea background */}
          <rect x={0} y={0} width={SEA_BOUNDARY_X} height={SVG_VIEWBOX.height} fill="url(#seaGradient)" />
          <rect x={0} y={0} width={SEA_BOUNDARY_X} height={SVG_VIEWBOX.height} fill="url(#seaGrid)" />
          {/* Animated wave overlay */}
          <rect x={0} y={0} width={SEA_BOUNDARY_X} height={SVG_VIEWBOX.height} fill="url(#wavePattern)" />

          {/* Bathymetry contour lines */}
          {BATHYMETRY_CONTOURS.map((contour) => (
            <g key={`bathy-${contour.depth}`}>
              <path
                d={contour.path}
                fill="none"
                stroke="rgba(59,130,246,0.12)"
                strokeWidth={0.8}
                strokeDasharray="6 4"
              />
              <text
                x={contour.label.x}
                y={contour.label.y}
                fill="rgba(59,130,246,0.2)"
                fontSize={7}
                fontFamily="JetBrains Mono, monospace"
              >
                {contour.depth}m
              </text>
            </g>
          ))}

          {/* Lat/lon grid overlay */}
          {LAT_LON_GRID.latLines.map((line) => (
            <g key={`lat-${line.y}`}>
              <line
                x1={0} y1={line.y} x2={SVG_VIEWBOX.width} y2={line.y}
                stroke="rgba(148,163,184,0.06)"
                strokeWidth={0.5}
                strokeDasharray="2 8"
              />
              <text x={SVG_VIEWBOX.width - 45} y={line.y - 3} fill="rgba(148,163,184,0.2)" fontSize={6} fontFamily="JetBrains Mono, monospace">
                {line.label}
              </text>
            </g>
          ))}
          {LAT_LON_GRID.lonLines.map((line) => (
            <g key={`lon-${line.x}`}>
              <line
                x1={line.x} y1={0} x2={line.x} y2={SVG_VIEWBOX.height}
                stroke="rgba(148,163,184,0.06)"
                strokeWidth={0.5}
                strokeDasharray="2 8"
              />
              <text x={line.x + 2} y={12} fill="rgba(148,163,184,0.2)" fontSize={6} fontFamily="JetBrains Mono, monospace">
                {line.label}
              </text>
            </g>
          ))}

          {/* Shipping lane (TSS corridor) */}
          {SHIPPING_LANE.map((seg, i) => (
            <line
              key={`ship-${i}`}
              x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
              stroke="rgba(251,191,36,0.12)"
              strokeWidth={18}
              strokeLinecap="round"
            />
          ))}
          {SHIPPING_LANE.map((seg, i) => (
            <line
              key={`ship-dash-${i}`}
              x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
              stroke="rgba(251,191,36,0.2)"
              strokeWidth={0.5}
              strokeDasharray="8 6"
            />
          ))}
          <text x={460} y={58} fill="rgba(251,191,36,0.25)" fontSize={7} fontFamily="JetBrains Mono, monospace">
            TSS — Shipping Lane
          </text>

          {/* Land background */}
          <rect x={SEA_BOUNDARY_X} y={0} width={SVG_VIEWBOX.width - SEA_BOUNDARY_X} height={SVG_VIEWBOX.height} fill="url(#landGradient)" />

          {/* Beach / sand strip at coast */}
          <rect x={SEA_BOUNDARY_X - 15} y={0} width={30} height={SVG_VIEWBOX.height} fill="url(#beachGradient)" />

          {/* Coastline with glow */}
          <path d={COASTLINE_PATH} fill="none" stroke="#2a4a25" strokeWidth={6} opacity={0.2} />
          <path d={COASTLINE_PATH} fill="none" stroke="#3a6335" strokeWidth={3} opacity={0.4} />
          <path d={COASTLINE_PATH} fill="none" stroke="#5a9a50" strokeWidth={1.5} opacity={0.7} />

          {/* Land features — roads */}
          <path d="M 890,300 L 950,310 L 1050,300 L 1150,290" fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth={1.5} />
          <path d="M 920,150 L 930,350 L 940,550" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth={1} />

          {/* Coastal city labels */}
          <circle cx={898} cy={175} r={2.5} fill="rgba(148,163,184,0.3)" />
          <text x={908} y={178} fill="#4a6458" fontSize={9} fontFamily="Inter, sans-serif" opacity={0.7}>Ustka</text>
          <circle cx={925} cy={495} r={2.5} fill="rgba(148,163,184,0.3)" />
          <text x={935} y={498} fill="#4a6458" fontSize={9} fontFamily="Inter, sans-serif" opacity={0.7}>Koszalin</text>
          <circle cx={1050} cy={295} r={1.5} fill="rgba(148,163,184,0.2)" />
          <text x={1058} y={298} fill="#4a6458" fontSize={7} fontFamily="Inter, sans-serif" opacity={0.5}>Słupsk</text>

          {/* Wind farm exclusion zone boundary */}
          <polygon
            points="50,80 610,110 610,540 50,560"
            fill="none"
            stroke="rgba(59,130,246,0.15)"
            strokeWidth={1}
            strokeDasharray="10 5"
          />
          <text x={55} y={75} fill="rgba(59,130,246,0.2)" fontSize={7} fontFamily="JetBrains Mono, monospace">
            Exclusion Zone — Baltic Wind Alpha
          </text>

          {/* 66 kV array cables */}
          {STRING_COLLECTION_POINTS.map((cp) => {
            const stringTurbines = TURBINE_POSITIONS.filter(
              (t) => t.stringNumber === cp.stringNumber,
            );
            return (
              <g key={`string-${cp.stringNumber}`}>
                {stringTurbines.map((t, i) => {
                  if (i === 0) return null;
                  const prev = stringTurbines[i - 1];
                  return (
                    <line
                      key={`cable-${t.id}`}
                      x1={prev.x} y1={prev.y + 10}
                      x2={t.x} y2={t.y - 8}
                      stroke={SCADA_COLORS.VOLTAGE_66KV}
                      strokeWidth={1} opacity={0.25}
                    />
                  );
                })}
                <line
                  x1={cp.x} y1={cp.y}
                  x2={OSS_POSITION.x} y2={OSS_POSITION.y}
                  stroke={SCADA_COLORS.VOLTAGE_66KV}
                  strokeWidth={1.5} opacity={0.2}
                  strokeDasharray="4 4"
                />
                {/* String label */}
                <text
                  x={stringTurbines[0].x}
                  y={stringTurbines[0].y - 20}
                  fill="#6b7490" fontSize={8}
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                >
                  S{cp.stringNumber}
                </text>
              </g>
            );
          })}

          <ExportCableRoute onClick={() => setActivePanel("cable")} />
          <OnshoreSubstation onClick={() => setActivePanel("onshore")} />
          <OffshoreSubstation powerThroughMW={totalPowerMW} onClick={() => setActivePanel("oss")} />

          {/* Turbine icons — each reads its own data from the store */}
          {TURBINE_POSITIONS.map((pos) => (
            <ConnectedTurbineIcon
              key={pos.id}
              turbineId={pos.id}
              x={pos.x}
              y={pos.y}
              onMouseEnter={handleTurbineHover}
              onMouseLeave={handleTurbineLeave}
              onClick={handleTurbineClick}
            />
          ))}

          {/* Map title */}
          <text x={20} y={30} fill="#e8eaf0" fontSize={13} fontWeight="600" fontFamily="Inter, sans-serif">
            Baltic Wind Alpha — 510 MW Overview
          </text>
          <text x={20} y={48} fill="#6b7490" fontSize={10} fontFamily="JetBrains Mono, monospace">
            34 × V236-15.0 MW | 66 kV Array | 220 kV Export | 400 kV PSE Grid
          </text>

          {/* Compass rose */}
          <g transform="translate(1130, 60)">
            <circle cx={0} cy={0} r={22} fill="rgba(15,17,23,0.7)" stroke="#3d4560" strokeWidth={1} />
            <text x={0} y={-10} fill="#e8eaf0" fontSize={9} fontWeight="600" textAnchor="middle" fontFamily="Inter, sans-serif">N</text>
            <text x={0} y={18} fill="#6b7490" fontSize={7} textAnchor="middle" fontFamily="Inter, sans-serif">S</text>
            <text x={12} y={4} fill="#6b7490" fontSize={7} textAnchor="middle" fontFamily="Inter, sans-serif">E</text>
            <text x={-12} y={4} fill="#6b7490" fontSize={7} textAnchor="middle" fontFamily="Inter, sans-serif">W</text>
            <line x1={0} y1={-5} x2={0} y2={5} stroke="#6b7490" strokeWidth={1} />
            <line x1={-5} y1={0} x2={5} y2={0} stroke="#6b7490" strokeWidth={1} />
          </g>

          {/* Wind direction indicator */}
          <g transform="translate(1130, 120)">
            <circle cx={0} cy={0} r={16} fill="rgba(15,17,23,0.7)" stroke="#3d4560" strokeWidth={1} />
            <g transform={`rotate(${windDirDeg})`}>
              <line x1={0} y1={8} x2={0} y2={-8} stroke="#3b82f6" strokeWidth={1.5} />
              <polygon points="0,-10 -3,-5 3,-5" fill="#3b82f6" />
            </g>
            <text x={0} y={28} fill="#6b7490" fontSize={7} textAnchor="middle" fontFamily="JetBrains Mono, monospace">
              SW 10.2 m/s
            </text>
          </g>

          {/* Scale bar */}
          <g transform="translate(20, 670)">
            <line x1={0} y1={0} x2={80} y2={0} stroke="#6b7490" strokeWidth={1.5} />
            <line x1={0} y1={-4} x2={0} y2={4} stroke="#6b7490" strokeWidth={1} />
            <line x1={80} y1={-4} x2={80} y2={4} stroke="#6b7490" strokeWidth={1} />
            <text x={40} y={-6} fill="#6b7490" fontSize={8} textAnchor="middle" fontFamily="JetBrains Mono, monospace">
              5 km
            </text>
          </g>
        </g>
      </svg>

      {/* Zoom controls overlay */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-md",
            "bg-bg-secondary/90 border border-border-primary backdrop-blur-sm",
            "text-text-muted hover:text-text-primary hover:bg-bg-hover",
            "transition-colors duration-150",
          )}
          aria-label="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-md",
            "bg-bg-secondary/90 border border-border-primary backdrop-blur-sm",
            "text-text-muted hover:text-text-primary hover:bg-bg-hover",
            "transition-colors duration-150",
          )}
          aria-label="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleZoomReset}
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-md",
            "bg-bg-secondary/90 border border-border-primary backdrop-blur-sm",
            "text-text-muted hover:text-text-primary hover:bg-bg-hover",
            "transition-colors duration-150",
          )}
          aria-label="Reset zoom"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Zoom level indicator */}
      <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-bg-secondary/90 border border-border-primary backdrop-blur-sm">
        <span className="text-[10px] font-mono text-text-muted tabular-nums">
          {Math.round(zoomLevel * 100)}%
        </span>
      </div>

      {/* Legend overlay */}
      <MapLegend />

      {/* Tooltip overlay — reads live data from store by ID */}
      {hoveredTurbineId && (
        <ConnectedTooltip turbineId={hoveredTurbineId} position={tooltipPos} />
      )}

      {/* Equipment detail panels */}
      {activePanel === "oss" && ossTx && (
        <TransformerDetailPanel
          transformer={ossTx}
          onClose={() => setActivePanel(null)}
          onNavigate={() => navigate("/scada")}
          navLabel="Open SCADA Dashboard"
        />
      )}
      {activePanel === "onshore" && onsTx && (
        <TransformerDetailPanel
          transformer={onsTx}
          onClose={() => setActivePanel(null)}
          onNavigate={() => navigate("/hv-grid")}
          navLabel="Open HV Grid Dashboard"
        />
      )}
      {activePanel === "cable" && cable && (
        <CableDetailPanel
          cable={cable}
          onClose={() => setActivePanel(null)}
          onNavigate={() => navigate("/hv-grid")}
        />
      )}
    </div>
  );
}

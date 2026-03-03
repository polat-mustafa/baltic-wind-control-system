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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import {
  COASTLINE_PATH,
  OSS_POSITION,
  SEA_BOUNDARY_X,
  STRING_COLLECTION_POINTS,
  SVG_VIEWBOX,
  TURBINE_POSITIONS,
} from "../../constants/windFarmLayout";
import type { TurbineData } from "../../types/landing";
import { cn } from "../../lib/utils";

import ExportCableRoute from "./ExportCableRoute";
import MapLegend from "./MapLegend";
import OffshoreSubstation from "./OffshoreSubstation";
import OnshoreSubstation from "./OnshoreSubstation";
import TurbineIcon from "./TurbineIcon";
import TurbineTooltip from "./TurbineTooltip";

interface WindFarmMapProps {
  turbines: TurbineData[];
  totalPowerMW: number;
}

export default function WindFarmMap({ turbines, totalPowerMW }: WindFarmMapProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hoveredTurbine, setHoveredTurbine] = useState<TurbineData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);

  const turbineMap = useMemo(
    () => new Map(turbines.map((t) => [t.id, t])),
    [turbines],
  );

  const turbineMapRef = useRef(turbineMap);
  turbineMapRef.current = turbineMap;

  // Initialize d3-zoom
  useEffect(() => {
    const svg = svgRef.current;
    const g = gRef.current;
    if (!svg || !g) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
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
      const turbine = turbineMapRef.current.get(turbineId);
      if (!turbine) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setHoveredTurbine(turbine);
    },
    [],
  );

  const handleTurbineLeave = useCallback(() => {
    setHoveredTurbine(null);
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
        </defs>

        {/* Zoomable group — all map content lives here */}
        <g ref={gRef}>
          {/* Sea background */}
          <rect x={0} y={0} width={SEA_BOUNDARY_X} height={SVG_VIEWBOX.height} fill="url(#seaGradient)" />
          <rect x={0} y={0} width={SEA_BOUNDARY_X} height={SVG_VIEWBOX.height} fill="url(#seaGrid)" />

          {/* Land background */}
          <rect x={SEA_BOUNDARY_X} y={0} width={SVG_VIEWBOX.width - SEA_BOUNDARY_X} height={SVG_VIEWBOX.height} fill="url(#landGradient)" />

          {/* Coastline with glow */}
          <path d={COASTLINE_PATH} fill="none" stroke="#3a6335" strokeWidth={4} opacity={0.3} />
          <path d={COASTLINE_PATH} fill="none" stroke="#4a7a42" strokeWidth={2} opacity={0.6} />

          {/* Coastal city labels */}
          <text x={895} y={180} fill="#4a5568" fontSize={9} fontFamily="Inter, sans-serif" opacity={0.6}>Ustka</text>
          <text x={920} y={500} fill="#4a5568" fontSize={9} fontFamily="Inter, sans-serif" opacity={0.6}>Koszalin</text>

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

          <ExportCableRoute />
          <OnshoreSubstation />
          <OffshoreSubstation powerThroughMW={totalPowerMW} />

          {/* Turbine icons */}
          {TURBINE_POSITIONS.map((pos) => {
            const turbine = turbineMap.get(pos.id);
            if (!turbine) return null;
            return (
              <TurbineIcon
                key={pos.id}
                turbineId={pos.id}
                x={pos.x} y={pos.y}
                status={turbine.status}
                powerOutputMW={turbine.powerOutputMW}
                onMouseEnter={handleTurbineHover}
                onMouseLeave={handleTurbineLeave}
                onClick={handleTurbineClick}
              />
            );
          })}

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

      {/* Tooltip overlay */}
      {hoveredTurbine && (
        <TurbineTooltip turbine={hoveredTurbine} position={tooltipPos} />
      )}
    </div>
  );
}

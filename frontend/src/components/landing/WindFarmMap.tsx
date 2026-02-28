/**
 * Main SVG canvas — the interactive wind farm overview map.
 *
 * Composites: sea gradient background, coastline, 34 turbine icons,
 * 66 kV array cables, OSS, 220 kV export cable, onshore substation.
 *
 * Layout philosophy: left side = open sea with turbines arranged in
 * 6 strings. Right side = coastline and onshore infrastructure.
 * This mirrors a real SCADA geographic overview (ABB Ability, Siemens DEOP).
 */

import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredTurbine, setHoveredTurbine] = useState<TurbineData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleTurbineHover = useCallback(
    (turbine: TurbineData, e: React.MouseEvent<SVGGElement>) => {
      // Get position relative to the map container
      const container = svgRef.current?.parentElement;
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

  // Build turbine lookup for fast access
  const turbineMap = new Map(turbines.map((t) => [t.id, t]));

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_VIEWBOX.width} ${SVG_VIEWBOX.height}`}
        className="w-full h-auto"
        style={{ minHeight: 400, maxHeight: 550 }}
      >
        <defs>
          {/* Sea gradient — dark blue to lighter blue */}
          <linearGradient id="seaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0c1929" />
            <stop offset="50%" stopColor="#0f2847" />
            <stop offset="100%" stopColor="#132e4a" />
          </linearGradient>

          {/* Land gradient */}
          <linearGradient id="landGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1a2e1a" />
            <stop offset="100%" stopColor="#1e3a1e" />
          </linearGradient>
        </defs>

        {/* Sea background */}
        <rect
          x={0}
          y={0}
          width={SEA_BOUNDARY_X}
          height={SVG_VIEWBOX.height}
          fill="url(#seaGradient)"
        />

        {/* Land background */}
        <rect
          x={SEA_BOUNDARY_X}
          y={0}
          width={SVG_VIEWBOX.width - SEA_BOUNDARY_X}
          height={SVG_VIEWBOX.height}
          fill="url(#landGradient)"
        />

        {/* Coastline */}
        <path
          d={COASTLINE_PATH}
          fill="none"
          stroke="#4a6741"
          strokeWidth={3}
          opacity={0.7}
        />

        {/* 66 kV array cables (string connections to OSS) */}
        {STRING_COLLECTION_POINTS.map((cp) => {
          // Draw line from each turbine in the string to the next, then to OSS
          const stringTurbines = TURBINE_POSITIONS.filter(
            (t) => t.stringNumber === cp.stringNumber,
          );

          return (
            <g key={`string-${cp.stringNumber}`}>
              {/* Inter-turbine cables within string */}
              {stringTurbines.map((t, i) => {
                if (i === 0) return null;
                const prev = stringTurbines[i - 1];
                return (
                  <line
                    key={`cable-${t.id}`}
                    x1={prev.x}
                    y1={prev.y + 10}
                    x2={t.x}
                    y2={t.y - 8}
                    stroke={SCADA_COLORS.VOLTAGE_66KV}
                    strokeWidth={1}
                    opacity={0.3}
                  />
                );
              })}
              {/* String-to-OSS cable (from last turbine) */}
              <line
                x1={cp.x}
                y1={cp.y}
                x2={OSS_POSITION.x}
                y2={OSS_POSITION.y}
                stroke={SCADA_COLORS.VOLTAGE_66KV}
                strokeWidth={1.5}
                opacity={0.25}
                strokeDasharray="4 4"
              />
            </g>
          );
        })}

        {/* Export cable (220 kV, animated) */}
        <ExportCableRoute />

        {/* Onshore substation */}
        <OnshoreSubstation />

        {/* Offshore substation */}
        <OffshoreSubstation powerThroughMW={totalPowerMW} />

        {/* Turbine icons */}
        {TURBINE_POSITIONS.map((pos) => {
          const turbine = turbineMap.get(pos.id);
          if (!turbine) return null;
          return (
            <TurbineIcon
              key={pos.id}
              x={pos.x}
              y={pos.y}
              status={turbine.status}
              powerOutputMW={turbine.powerOutputMW}
              onMouseEnter={(e) => handleTurbineHover(turbine, e)}
              onMouseLeave={handleTurbineLeave}
              onClick={handleTurbineClick}
            />
          );
        })}

        {/* Map title */}
        <text x={20} y={30} fill="#94a3b8" fontSize={14} fontWeight="bold">
          Baltic Wind Alpha — 510 MW Overview
        </text>
        <text x={20} y={48} fill="#64748b" fontSize={10}>
          34 × V236-15.0 MW | 66 kV Array | 220 kV Export | 400 kV PSE Grid
        </text>
      </svg>

      {/* Legend overlay */}
      <MapLegend />

      {/* Tooltip overlay */}
      {hoveredTurbine && (
        <TurbineTooltip turbine={hoveredTurbine} position={tooltipPos} />
      )}
    </div>
  );
}

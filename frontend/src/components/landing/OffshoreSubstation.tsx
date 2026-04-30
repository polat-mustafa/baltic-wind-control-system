/**
 * Offshore Substation (OSS) — IEC 60617 transformer SVG icon.
 *
 * Represents the 66/220 kV step-up transformer platform where all 6 array
 * strings collect into the export cable. Click navigates to /scada.
 *
 * Single-line elements (top → bottom):
 *   • Conservator tank   (oil expansion vessel, IEC 60076-1)
 *   • Buchholz relay     (oil-flow gas detection)
 *   • LTC motor          (on-load tap changer)
 *   • Tank rectangle     (cast steel housing)
 *   • Cooling radiators  (4 × ONAF radiator stacks)
 *   • Two-circle core    (Dyn11 winding symbol — Δ HV / Y LV)
 *   • HV + LV bushings   (porcelain insulators with skirts)
 *
 * Status colour follows ISA-101: ENERGIZED green.
 */

import { memo } from "react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { OSS_POSITION } from "../../constants/windFarmLayout";

interface OffshoreSubstationProps {
  powerThroughMW: number;
  /** Top oil temperature, °C — drives ONAF cooling colour overlay (optional). */
  oilTempC?: number;
  onClick?: () => void;
}

function OffshoreSubstation({ powerThroughMW, oilTempC = 55, onClick }: OffshoreSubstationProps) {
  const { x, y } = OSS_POSITION;

  // Oil-temp tint per IEC 60076-7: <60 nominal, 60–75 warm, >75 hot.
  const oilTint =
    oilTempC > 75 ? "#ef4444" : oilTempC > 60 ? "#f59e0b" : "#22c55e";

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      className="cursor-pointer"
      role="button"
      aria-label={`Offshore Substation — ${powerThroughMW.toFixed(0)} MW, oil ${oilTempC}°C`}
    >
      {/* Platform deck outline */}
      <rect x={-26} y={-26} width={52} height={52} rx={3} fill="#0f172a" stroke={SCADA_COLORS.ENERGIZED} strokeWidth={1.5} />

      {/* Conservator (oil expansion tank) — small horizontal cylinder on top */}
      <ellipse cx={0} cy={-21} rx={8} ry={2.2} fill="#1e293b" stroke={oilTint} strokeWidth={0.8} />

      {/* Buchholz relay — small bell glyph between conservator and tank */}
      <rect x={-2} y={-18.5} width={4} height={2.5} fill={oilTint} opacity={0.6} />

      {/* Connecting pipe conservator → tank */}
      <line x1={0} y1={-18.5} x2={0} y2={-13} stroke="#475569" strokeWidth={0.8} />

      {/* LTC motor box (top tap changer drive) */}
      <rect x={-15} y={-17} width={5} height={4} fill="#1e293b" stroke="#94a3b8" strokeWidth={0.6} />
      <text x={-12.5} y={-13.5} textAnchor="middle" fill="#cbd5e1" fontSize={3.5} fontFamily="monospace">T7</text>

      {/* Main tank — cast steel housing */}
      <rect x={-13} y={-13} width={26} height={20} rx={1.5} fill="#1e293b" stroke="#94a3b8" strokeWidth={1} />

      {/* Cooling radiator fins — 4 vertical fin stacks on each long side (port/starboard) */}
      {([-13, 13] as number[]).map((fx) => (
        <g key={fx}>
          {[-9, -4, 1, 6].map((fy) => (
            <rect
              key={fy}
              x={fx + (fx < 0 ? -3 : 0)} y={fy}
              width={3} height={3.5}
              fill={oilTint}
              opacity={0.55}
              stroke="#475569"
              strokeWidth={0.3}
            />
          ))}
        </g>
      ))}

      {/* Transformer winding symbol — two interlocking circles (Δ HV / Y LV) */}
      <circle cx={-4} cy={-3} r={4} fill="none" stroke={SCADA_COLORS.VOLTAGE_66KV} strokeWidth={1.2} />
      <circle cx={4} cy={-3} r={4} fill="none" stroke={SCADA_COLORS.VOLTAGE_220KV} strokeWidth={1.2} />

      {/* HV bushing (220 kV, taller, glazed porcelain) — top-left */}
      <line x1={-7} y1={-13} x2={-7} y2={-19} stroke="#cbd5e1" strokeWidth={1.4} />
      <line x1={-8} y1={-15} x2={-6} y2={-15} stroke="#cbd5e1" strokeWidth={0.5} />
      <line x1={-8} y1={-17} x2={-6} y2={-17} stroke="#cbd5e1" strokeWidth={0.5} />

      {/* LV bushing (66 kV, shorter) — top-right */}
      <line x1={7} y1={-13} x2={7} y2={-17.5} stroke="#a16207" strokeWidth={1.4} />
      <line x1={8} y1={-15.5} x2={6} y2={-15.5} stroke="#a16207" strokeWidth={0.5} />

      {/* Label: OSS */}
      <text x={0} y={-29} textAnchor="middle" fill={SCADA_COLORS.ENERGIZED} fontSize={9} fontWeight="bold">
        OSS
      </text>

      {/* Voltage label */}
      <text x={0} y={18} textAnchor="middle" fill="#94a3b8" fontSize={6.5} fontFamily="monospace">
        66/220 kV
      </text>

      {/* Power readout */}
      <text x={0} y={26} textAnchor="middle" fill="#e2e8f0" fontSize={7.5} fontWeight="bold" fontFamily="monospace">
        {powerThroughMW.toFixed(0)} MW
      </text>

      {/* Hit area */}
      <rect x={-28} y={-30} width={56} height={62} fill="transparent" />
    </g>
  );
}

export default memo(OffshoreSubstation);

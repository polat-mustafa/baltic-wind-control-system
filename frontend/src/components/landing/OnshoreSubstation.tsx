/**
 * Onshore substation — 220/400 kV transformer + PSE grid connection.
 *
 * Same IEC 60617 detail pattern as OffshoreSubstation, but with the higher
 * voltages (220 → 400 kV) and a visible busbar feeding the PSE national grid.
 *
 * Click navigates to /hv-grid.
 */

import { memo } from "react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { ONSHORE_POSITION } from "../../constants/windFarmLayout";

interface OnshoreSubstationProps {
  /** Top oil temperature, °C — drives ONAF cooling colour overlay (optional). */
  oilTempC?: number;
  onClick?: () => void;
}

function OnshoreSubstation({ oilTempC = 50, onClick }: OnshoreSubstationProps) {
  const { x, y } = ONSHORE_POSITION;

  const oilTint =
    oilTempC > 75 ? "#ef4444" : oilTempC > 60 ? "#f59e0b" : "#22c55e";

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      className="cursor-pointer"
      role="button"
      aria-label={`Onshore Substation — 220/400 kV, oil ${oilTempC}°C`}
    >
      {/* Building outline */}
      <rect x={-26} y={-26} width={52} height={52} rx={3} fill="#0f172a" stroke={SCADA_COLORS.VOLTAGE_400KV} strokeWidth={1.5} />

      {/* Conservator (oil expansion tank) */}
      <ellipse cx={0} cy={-21} rx={8} ry={2.2} fill="#1e293b" stroke={oilTint} strokeWidth={0.8} />

      {/* Buchholz relay */}
      <rect x={-2} y={-18.5} width={4} height={2.5} fill={oilTint} opacity={0.6} />
      <line x1={0} y1={-18.5} x2={0} y2={-13} stroke="#475569" strokeWidth={0.8} />

      {/* LTC motor box with tap label */}
      <rect x={-15} y={-17} width={5} height={4} fill="#1e293b" stroke="#94a3b8" strokeWidth={0.6} />
      <text x={-12.5} y={-13.5} textAnchor="middle" fill="#cbd5e1" fontSize={3.5} fontFamily="monospace">T9</text>

      {/* Tank */}
      <rect x={-13} y={-13} width={26} height={20} rx={1.5} fill="#1e293b" stroke="#94a3b8" strokeWidth={1} />

      {/* Cooling radiator fins — both sides */}
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

      {/* Two-circle winding symbol — Δ HV / Y LV */}
      <circle cx={-4} cy={-3} r={4} fill="none" stroke={SCADA_COLORS.VOLTAGE_220KV} strokeWidth={1.2} />
      <circle cx={4} cy={-3} r={4} fill="none" stroke={SCADA_COLORS.VOLTAGE_400KV} strokeWidth={1.2} />

      {/* HV bushing (400 kV, tallest) */}
      <line x1={-7} y1={-13} x2={-7} y2={-20} stroke="#cbd5e1" strokeWidth={1.5} />
      {[-15.5, -17.5, -19].map((sy) => (
        <line key={sy} x1={-8} y1={sy} x2={-6} y2={sy} stroke="#cbd5e1" strokeWidth={0.5} />
      ))}

      {/* LV bushing (220 kV) */}
      <line x1={7} y1={-13} x2={7} y2={-18} stroke="#a16207" strokeWidth={1.4} />
      {[-15, -17].map((sy) => (
        <line key={sy} x1={8} y1={sy} x2={6} y2={sy} stroke="#a16207" strokeWidth={0.5} />
      ))}

      {/* Label */}
      <text x={0} y={-29} textAnchor="middle" fill={SCADA_COLORS.VOLTAGE_400KV} fontSize={9} fontWeight="bold">
        Onshore SS
      </text>
      <text x={0} y={18} textAnchor="middle" fill="#94a3b8" fontSize={6.5} fontFamily="monospace">
        220/400 kV
      </text>

      {/* PSE grid connection — 3-wire busbar (3-phase) */}
      <g>
        {[-2, 0, 2].map((dy) => (
          <line key={dy} x1={26} y1={dy} x2={50} y2={dy} stroke={SCADA_COLORS.VOLTAGE_400KV} strokeWidth={1.5} opacity={0.85} />
        ))}
        {/* CB symbol — small filled square at midspan = closed breaker */}
        <rect x={36} y={-1.5} width={3} height={3} fill={SCADA_COLORS.VOLTAGE_400KV} />
        {/* Disconnector blade */}
        <line x1={42} y1={2} x2={47} y2={-2} stroke={SCADA_COLORS.VOLTAGE_400KV} strokeWidth={1} />
        <circle cx={42} cy={2} r={1} fill={SCADA_COLORS.VOLTAGE_400KV} />
      </g>
      <text x={70} y={4} textAnchor="middle" fill={SCADA_COLORS.VOLTAGE_400KV} fontSize={9} fontWeight="bold">
        PSE Grid
      </text>

      {/* Hit area */}
      <rect x={-28} y={-30} width={120} height={62} fill="transparent" />
    </g>
  );
}

export default memo(OnshoreSubstation);

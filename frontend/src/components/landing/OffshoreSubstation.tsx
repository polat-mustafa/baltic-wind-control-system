/**
 * Offshore Substation (OSS) SVG icon.
 *
 * Represents the 66/220 kV transformer platform where all 6 array
 * strings collect into the export cable. Click navigates to /scada.
 *
 * ISA-101: energized equipment in green (SCADA_COLORS.ENERGIZED).
 */

import { memo } from "react";
import { useNavigate } from "react-router-dom";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { OSS_POSITION } from "../../constants/windFarmLayout";

interface OffshoreSubstationProps {
  powerThroughMW: number;
}

function OffshoreSubstation({ powerThroughMW }: OffshoreSubstationProps) {
  const navigate = useNavigate();
  const { x, y } = OSS_POSITION;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => navigate("/scada")}
      className="cursor-pointer"
      role="button"
      aria-label="Offshore Substation — click to open SCADA"
    >
      {/* Platform base */}
      <rect
        x={-20}
        y={-16}
        width={40}
        height={32}
        rx={3}
        fill="#1e293b"
        stroke={SCADA_COLORS.ENERGIZED}
        strokeWidth={2}
      />

      {/* Transformer symbol (two overlapping circles) */}
      <circle cx={-5} cy={0} r={8} fill="none" stroke={SCADA_COLORS.VOLTAGE_66KV} strokeWidth={1.5} />
      <circle cx={5} cy={0} r={8} fill="none" stroke={SCADA_COLORS.VOLTAGE_220KV} strokeWidth={1.5} />

      {/* Label: OSS */}
      <text
        x={0}
        y={-22}
        textAnchor="middle"
        fill={SCADA_COLORS.ENERGIZED}
        fontSize={10}
        fontWeight="bold"
      >
        OSS
      </text>

      {/* Voltage label */}
      <text x={0} y={28} textAnchor="middle" fill="#94a3b8" fontSize={8}>
        66/220 kV
      </text>

      {/* Power readout */}
      <text x={0} y={38} textAnchor="middle" fill="#e2e8f0" fontSize={8} fontWeight="bold">
        {powerThroughMW.toFixed(0)} MW
      </text>

      {/* Hit area */}
      <rect x={-25} y={-25} width={50} height={70} fill="transparent" />
    </g>
  );
}

export default memo(OffshoreSubstation);

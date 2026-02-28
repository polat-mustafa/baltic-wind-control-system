/**
 * Onshore substation SVG icon — 220/400 kV transformer + PSE grid connection.
 *
 * Represents the shore-end of the export cable where 220 kV is
 * stepped up to 400 kV for connection to the PSE national grid.
 * Click navigates to /hv-grid.
 */

import { memo } from "react";
import { useNavigate } from "react-router-dom";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { ONSHORE_POSITION } from "../../constants/windFarmLayout";

function OnshoreSubstation() {
  const navigate = useNavigate();
  const { x, y } = ONSHORE_POSITION;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => navigate("/hv-grid")}
      className="cursor-pointer"
      role="button"
      aria-label="Onshore Substation — click to open HV Grid"
    >
      {/* Substation building */}
      <rect
        x={-22}
        y={-18}
        width={44}
        height={36}
        rx={3}
        fill="#1e293b"
        stroke={SCADA_COLORS.VOLTAGE_400KV}
        strokeWidth={2}
      />

      {/* Transformer symbol */}
      <circle cx={-6} cy={0} r={8} fill="none" stroke={SCADA_COLORS.VOLTAGE_220KV} strokeWidth={1.5} />
      <circle cx={6} cy={0} r={8} fill="none" stroke={SCADA_COLORS.VOLTAGE_400KV} strokeWidth={1.5} />

      {/* Labels */}
      <text x={0} y={-24} textAnchor="middle" fill={SCADA_COLORS.VOLTAGE_400KV} fontSize={10} fontWeight="bold">
        Onshore SS
      </text>
      <text x={0} y={30} textAnchor="middle" fill="#94a3b8" fontSize={8}>
        220/400 kV
      </text>

      {/* PSE grid connection indicator */}
      <line x1={22} y1={0} x2={50} y2={0} stroke={SCADA_COLORS.VOLTAGE_400KV} strokeWidth={3} />
      <text x={70} y={4} textAnchor="middle" fill={SCADA_COLORS.VOLTAGE_400KV} fontSize={10} fontWeight="bold">
        PSE Grid
      </text>

      {/* Hit area */}
      <rect x={-25} y={-28} width={120} height={65} fill="transparent" />
    </g>
  );
}

export default memo(OnshoreSubstation);

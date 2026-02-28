/**
 * 220 kV export cable route — animated SVG path from OSS to onshore substation.
 *
 * Uses a dashed stroke with CSS animation to create a "particle flow"
 * effect showing power flowing from offshore to onshore. The cable
 * is colored in IEC voltage blue (SCADA_COLORS.VOLTAGE_220KV).
 *
 * Click navigates to /hv-grid dashboard.
 */

import { memo } from "react";
import { useNavigate } from "react-router-dom";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { EXPORT_CABLE_PATH } from "../../constants/windFarmLayout";

function ExportCableRoute() {
  const navigate = useNavigate();

  // Build SVG path string from waypoints
  const pathData = EXPORT_CABLE_PATH.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    return `${acc} L ${point.x} ${point.y}`;
  }, "");

  return (
    <g
      onClick={() => navigate("/hv-grid")}
      className="cursor-pointer"
      role="button"
      aria-label="220 kV Export Cable — click to open HV Grid"
    >
      {/* Cable background (solid, slightly wider) */}
      <path
        d={pathData}
        fill="none"
        stroke={SCADA_COLORS.VOLTAGE_220KV}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.3}
      />

      {/* Cable foreground (animated dashes = particle flow) */}
      <path
        d={pathData}
        fill="none"
        stroke={SCADA_COLORS.VOLTAGE_220KV}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="8 12"
        opacity={0.9}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-40"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </path>

      {/* Cable label */}
      <text
        x={EXPORT_CABLE_PATH[2].x + 10}
        y={EXPORT_CABLE_PATH[2].y - 15}
        fill={SCADA_COLORS.VOLTAGE_220KV}
        fontSize={9}
        fontWeight="bold"
      >
        220 kV Export (45 km)
      </text>

      {/* Wider invisible hit area for click */}
      <path d={pathData} fill="none" stroke="transparent" strokeWidth={20} />
    </g>
  );
}

export default memo(ExportCableRoute);

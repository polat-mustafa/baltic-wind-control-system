/**
 * Hover tooltip for turbine icons — shows WTG ID, power output,
 * wind speed, and operational status.
 *
 * Positioned as an HTML overlay on top of the SVG canvas using
 * absolute positioning relative to the map container.
 */

import { SCADA_COLORS } from "../../constants/scadaColors";
import type { TurbineData, TurbineStatus } from "../../types/landing";

interface TurbineTooltipProps {
  turbine: TurbineData;
  /** Screen-relative position for the tooltip */
  position: { x: number; y: number };
}

const STATUS_COLOR: Record<TurbineStatus, string> = {
  operating: SCADA_COLORS.ENERGIZED,
  curtailed: SCADA_COLORS.WARNING,
  fault: SCADA_COLORS.FAULT,
  offline: SCADA_COLORS.DE_ENERGIZED,
};

const STATUS_LABEL: Record<TurbineStatus, string> = {
  operating: "Operating",
  curtailed: "Curtailed",
  fault: "Fault",
  offline: "Offline",
};

export default function TurbineTooltip({ turbine, position }: TurbineTooltipProps) {
  return (
    <div
      className="absolute z-50 pointer-events-none bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs"
      style={{
        left: position.x + 16,
        top: position.y - 20,
      }}
    >
      <div className="font-bold text-white text-sm mb-1">{turbine.id}</div>
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ backgroundColor: STATUS_COLOR[turbine.status] }}
        />
        <span style={{ color: STATUS_COLOR[turbine.status] }}>
          {STATUS_LABEL[turbine.status]}
        </span>
      </div>
      <div className="text-slate-300">
        Power: <span className="text-white font-medium">{turbine.powerOutputMW.toFixed(1)} MW</span>
      </div>
      <div className="text-slate-300">
        Wind: <span className="text-white font-medium">{turbine.windSpeedMs.toFixed(1)} m/s</span>
      </div>
      <div className="text-slate-500 text-[10px] mt-1">String {turbine.stringNumber}</div>
    </div>
  );
}

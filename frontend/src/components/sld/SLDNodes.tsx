/**
 * IEC 60617 compliant single-line diagram node components for XYFlow.
 *
 * Each node renders the standard electrical symbol as inline SVG:
 *   - Circuit Breaker (CB): filled square between contacts
 *   - Disconnector (DS): open blade switch
 *   - Earth Switch (ES): blade with earth/ground bars
 *   - Transformer (TX): two overlapping circles
 *   - Busbar: thick horizontal bar
 *   - IED: protection/measurement controller box
 *
 * Colors follow ISA-101 / SCADA_COLORS for equipment state:
 *   energized (#3ecf6e), de-energized (#6b7280), earthed (#22d3ee), fault (#ef4444)
 */

import { Handle, Position } from "@xyflow/react";

// ── Circuit Breaker Node ─────────────────────────────────────
// IEC 60617: filled rectangle between two connection points

interface CBNodeData {
  label: string;
  color: string;
  state: string;
}

export function CircuitBreakerNode({ data }: { data: CBNodeData }) {
  const { label, color, state } = data;
  return (
    <div className="flex flex-col items-center" style={{ width: 80 }}>
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5" style={{ background: color }} />
      <svg width={40} height={40} viewBox="0 0 40 40">
        {/* Top contact line */}
        <line x1={20} y1={0} x2={20} y2={12} stroke={color} strokeWidth={2} />
        {/* CB symbol — filled square */}
        <rect x={12} y={12} width={16} height={16} fill={color + "33"} stroke={color} strokeWidth={2} rx={1} />
        {/* Cross inside square (IEC standard for CB) */}
        <line x1={14} y1={14} x2={26} y2={26} stroke={color} strokeWidth={1.5} />
        <line x1={26} y1={14} x2={14} y2={26} stroke={color} strokeWidth={1.5} />
        {/* Bottom contact line */}
        <line x1={20} y1={28} x2={20} y2={40} stroke={color} strokeWidth={2} />
      </svg>
      <div className="text-center mt-0.5">
        <div className="text-[9px] font-mono font-bold" style={{ color }}>{label}</div>
        <div className="text-[8px] font-mono" style={{ color: color + "99" }}>{state}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5" style={{ background: color }} />
    </div>
  );
}

// ── Disconnector Node ────────────────────────────────────────
// IEC 60617: open blade (line at angle from pivot point)

interface DSNodeData {
  label: string;
  color: string;
  state: string;
}

export function DisconnectorNode({ data }: { data: DSNodeData }) {
  const { label, color, state } = data;
  const isOpen = state === "OPEN";
  return (
    <div className="flex flex-col items-center" style={{ width: 80 }}>
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5" style={{ background: color }} />
      <svg width={40} height={40} viewBox="0 0 40 40">
        {/* Bottom contact (fixed) */}
        <line x1={20} y1={40} x2={20} y2={26} stroke={color} strokeWidth={2} />
        <circle cx={20} cy={26} r={2} fill={color} />
        {/* Blade (rotates open/closed) */}
        {isOpen ? (
          <line x1={20} y1={26} x2={10} y2={8} stroke={color} strokeWidth={2} strokeLinecap="round" />
        ) : (
          <line x1={20} y1={26} x2={20} y2={8} stroke={color} strokeWidth={2} strokeLinecap="round" />
        )}
        {/* Top contact (fixed) */}
        <circle cx={20} cy={8} r={2} fill="none" stroke={color} strokeWidth={1.5} />
        <line x1={20} y1={0} x2={20} y2={6} stroke={color} strokeWidth={2} />
      </svg>
      <div className="text-center mt-0.5">
        <div className="text-[9px] font-mono font-bold" style={{ color }}>{label}</div>
        <div className="text-[8px] font-mono" style={{ color: color + "99" }}>{state}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5" style={{ background: color }} />
    </div>
  );
}

// ── Earth Switch Node ────────────────────────────────────────
// IEC 60617: blade switch with earth (3 horizontal bars below)

interface ESNodeData {
  label: string;
  color: string;
  state: string;
}

export function EarthSwitchNode({ data }: { data: ESNodeData }) {
  const { label, color, state } = data;
  const isClosed = state === "CLOSED";
  return (
    <div className="flex flex-col items-center" style={{ width: 80 }}>
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5" style={{ background: color }} />
      <svg width={40} height={48} viewBox="0 0 40 48">
        {/* Top connection */}
        <line x1={20} y1={0} x2={20} y2={8} stroke={color} strokeWidth={2} />
        <circle cx={20} cy={8} r={2} fill="none" stroke={color} strokeWidth={1.5} />
        {/* Blade */}
        {isClosed ? (
          <line x1={20} y1={8} x2={20} y2={24} stroke={color} strokeWidth={2} strokeLinecap="round" />
        ) : (
          <line x1={20} y1={8} x2={12} y2={22} stroke={color} strokeWidth={2} strokeLinecap="round" />
        )}
        {/* Pivot */}
        <circle cx={20} cy={24} r={2} fill={color} />
        {/* Earth symbol — 3 decreasing horizontal bars */}
        <line x1={12} y1={30} x2={28} y2={30} stroke={color} strokeWidth={2} />
        <line x1={14} y1={34} x2={26} y2={34} stroke={color} strokeWidth={1.5} />
        <line x1={17} y1={38} x2={23} y2={38} stroke={color} strokeWidth={1} />
      </svg>
      <div className="text-center mt-0.5">
        <div className="text-[9px] font-mono font-bold" style={{ color }}>{label}</div>
        <div className="text-[8px] font-mono" style={{ color: color + "99" }}>{state}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5" style={{ background: color }} />
    </div>
  );
}

// ── Transformer Node ─────────────────────────────────────────
// IEC 60617: two overlapping circles

interface TXNodeData {
  label: string;
  color: string;
  state: string;
  rating?: string;
}

export function TransformerNode({ data }: { data: TXNodeData }) {
  const { label, color, state, rating } = data;
  return (
    <div className="flex flex-col items-center" style={{ width: 90 }}>
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5" style={{ background: color }} />
      <svg width={50} height={56} viewBox="0 0 50 56">
        {/* Top connection */}
        <line x1={25} y1={0} x2={25} y2={12} stroke={color} strokeWidth={2} />
        {/* HV winding (top circle) */}
        <circle cx={25} cy={22} r={10} fill={color + "11"} stroke={color} strokeWidth={2} />
        {/* LV winding (bottom circle, overlapping) */}
        <circle cx={25} cy={34} r={10} fill={color + "11"} stroke={color} strokeWidth={2} />
        {/* Bottom connection */}
        <line x1={25} y1={44} x2={25} y2={56} stroke={color} strokeWidth={2} />
      </svg>
      <div className="text-center mt-0.5">
        <div className="text-[9px] font-mono font-bold" style={{ color }}>{label}</div>
        {rating && <div className="text-[7px] font-mono" style={{ color: color + "bb" }}>{rating}</div>}
        <div className="text-[8px] font-mono" style={{ color: color + "99" }}>{state}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5" style={{ background: color }} />
    </div>
  );
}

// ── Busbar Node ──────────────────────────────────────────────
// IEC 60617: thick horizontal bar

interface BusbarNodeData {
  label: string;
  color: string;
  voltage: number;
}

export function BusbarNode({ data }: { data: BusbarNodeData }) {
  const { label, color } = data;
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 200 }}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: color }} />
      <svg width={200} height={16} viewBox="0 0 200 16">
        {/* Thick busbar */}
        <rect x={0} y={4} width={200} height={8} rx={2} fill={color} opacity={0.9} />
        {/* End caps */}
        <rect x={0} y={2} width={4} height={12} rx={1} fill={color} />
        <rect x={196} y={2} width={4} height={12} rx={1} fill={color} />
      </svg>
      <div className="text-[10px] font-mono font-bold mt-1" style={{ color }}>
        {label}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: color }} />
    </div>
  );
}

// ── IED Node ─────────────────────────────────────────────────
// Protection / measurement / bay controller with LN count

interface IEDNodeData {
  label: string;
  color: string;
  type: string;
  lns: number;
  /** Live turbine data (only for WTG controllers) */
  powerMW?: number;
  windMs?: number;
  statusColor?: string;
}

export function IEDNode({ data }: { data: IEDNodeData }) {
  const { label, color, lns, powerMW, windMs, statusColor } = data;
  const hasLiveData = powerMW !== undefined;
  const powerFraction = hasLiveData ? Math.min((powerMW ?? 0) / 15, 1) : 0;

  return (
    <div
      className="rounded border px-2 py-1.5 text-center font-mono"
      style={{
        borderColor: color,
        backgroundColor: "#161924",
        minWidth: hasLiveData ? 100 : 90,
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5" style={{ background: color }} />
      <div className="flex items-center justify-center gap-1">
        {statusColor && (
          <span
            className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
            style={{ backgroundColor: statusColor }}
          />
        )}
        <div className="text-[10px] font-bold truncate" style={{ color }}>
          {label}
        </div>
      </div>
      <div className="text-[8px]" style={{ color: "#6b7490" }}>{lns} LNs</div>

      {/* Live turbine data block */}
      {hasLiveData && (
        <div className="mt-1 pt-1 border-t" style={{ borderColor: color + "33" }}>
          <div className="flex justify-between text-[8px]">
            <span style={{ color: "#6b7490" }}>Power</span>
            <span className="tabular-nums font-medium" style={{ color: statusColor ?? "#e8eaf0" }}>
              {(powerMW ?? 0).toFixed(1)} MW
            </span>
          </div>
          <div className="flex justify-between text-[8px]">
            <span style={{ color: "#6b7490" }}>Wind</span>
            <span className="tabular-nums font-medium" style={{ color: "#e8eaf0" }}>
              {(windMs ?? 0).toFixed(1)} m/s
            </span>
          </div>
          {/* Mini power bar */}
          <div className="w-full h-1 bg-bg-tertiary rounded-full mt-0.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${powerFraction * 100}%`, backgroundColor: statusColor ?? "#3ecf6e" }}
            />
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5" style={{ background: color }} />
    </div>
  );
}

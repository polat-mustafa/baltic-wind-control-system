/**
 * SVG flow-line layer for the Plant Mimic.
 *
 * Six string rows on the left collect into a vertical 66 kV bus, which
 * feeds the OSS. The OSS steps to 220 kV and runs out to the Onshore
 * substation; the onshore yard steps to 400 kV and connects to the
 * PSE grid.
 *
 * Energised paths animate with marching dashes; deenergised paths
 * are flat grey. Voltage level encoded by stroke colour AND width
 * (ISA-101 — read by line weight, not just colour).
 */

import { cn } from "../../lib/utils";
import { MIMIC_LAYOUT } from "../../constants/mimicLayout";

interface MimicFlowLinesProps {
  /** Per-string energisation: any operating turbine in the string ⇒ true */
  stringEnergised: boolean[];
  /** OSS → Onshore 220 kV cable energised */
  exportEnergised: boolean;
  /** Onshore → PSE grid 400 kV connection energised */
  gridEnergised: boolean;
  className?: string;
}

const COLOR_DEEN = "var(--color-text-faint, #7C7E81)";
const COLOR_66KV  = "var(--color-voltage-66kv, #B07B3E)";
const COLOR_220KV = "var(--color-voltage-220kv, #4A6FA5)";
const COLOR_400KV = "var(--color-voltage-400kv, #B0413E)";

export default function MimicFlowLines({
  stringEnergised,
  exportEnergised,
  gridEnergised,
  className,
}: MimicFlowLinesProps) {
  const L = MIMIC_LAYOUT;

  // y-coord of each string row (vertical centre)
  const stringY = (row: number) =>
    L.stringStartY + row * (L.cellH + L.rowGapY) + L.cellH / 2;

  // right edge of the last cell in each string
  // strings 1–4 have 6 turbines; strings 5–6 have 5 turbines (34 total)
  const stringRightX = (row: number) => {
    const cellsInRow = row >= 4 ? 5 : 6;
    return L.stringStartX + cellsInRow * L.cellW + (cellsInRow - 1) * L.cellGapX;
  };

  // bus segment vertical extents
  const busTop = stringY(0);
  const busBottom = stringY(5);

  // OSS connection points
  const ossLeftX = L.ossX;
  const ossLeftY = L.ossY + L.ossH / 2;
  const ossBottomX = L.ossX + L.ossW / 2;
  const ossBottomY = L.ossY + L.ossH;

  // Onshore connection points
  const onshoreTopX = L.onshoreX + L.onshoreW / 2;
  const onshoreTopY = L.onshoreY;
  const onshoreBottomX = L.onshoreX + L.onshoreW / 2;
  const onshoreBottomY = L.onshoreY + L.onshoreH;

  // Grid connection point
  const gridTopX = L.gridX + L.gridW / 2;
  const gridTopY = L.gridY;

  return (
    <svg
      className={cn("absolute inset-0 pointer-events-none", className)}
      width={L.width}
      height={L.height}
      viewBox={`0 0 ${L.width} ${L.height}`}
      role="presentation"
      aria-hidden
    >
      {/* String 1..6 → bus laterals (66 kV) */}
      {stringEnergised.map((live, i) => (
        <g key={`str-${i}`}>
          <path
            d={`M ${stringRightX(i)} ${stringY(i)} L ${L.busX} ${stringY(i)}`}
            stroke={live ? COLOR_66KV : COLOR_DEEN}
            strokeWidth={live ? 1.5 : 1}
            fill="none"
            className={live ? "mimic-flow-66kv" : undefined}
          />
        </g>
      ))}

      {/* Vertical 66 kV bus */}
      <line
        x1={L.busX}
        x2={L.busX}
        y1={busTop}
        y2={busBottom}
        stroke={stringEnergised.some(Boolean) ? COLOR_66KV : COLOR_DEEN}
        strokeWidth="2"
      />

      {/* Bus → OSS lateral */}
      <path
        d={`M ${L.busX} ${ossLeftY} L ${ossLeftX} ${ossLeftY}`}
        stroke={stringEnergised.some(Boolean) ? COLOR_66KV : COLOR_DEEN}
        strokeWidth="2"
        fill="none"
      />

      {/* Voltage label — 66 kV */}
      <text
        x={L.busX + 8}
        y={busTop - 6}
        className="font-mono"
        fontSize="9"
        fill={COLOR_66KV}
      >
        66 kV
      </text>

      {/* OSS → Onshore — 220 kV export cable (animated when energised) */}
      <path
        d={`M ${ossBottomX} ${ossBottomY} L ${onshoreTopX} ${onshoreTopY}`}
        stroke={exportEnergised ? COLOR_220KV : COLOR_DEEN}
        strokeWidth={exportEnergised ? 2.5 : 1.5}
        fill="none"
        className={exportEnergised ? "mimic-flow-220kv" : undefined}
      />
      <text
        x={ossBottomX + 8}
        y={(ossBottomY + onshoreTopY) / 2}
        className="font-mono"
        fontSize="9"
        fill={exportEnergised ? COLOR_220KV : COLOR_DEEN}
      >
        220 kV · 45 km
      </text>

      {/* Arrowhead on energised 220 kV path */}
      {exportEnergised && (
        <polygon
          points={`${onshoreTopX - 4},${onshoreTopY - 8} ${onshoreTopX + 4},${onshoreTopY - 8} ${onshoreTopX},${onshoreTopY - 1}`}
          fill={COLOR_220KV}
        />
      )}

      {/* Onshore → Grid — 400 kV (animated when energised) */}
      <path
        d={`M ${onshoreBottomX} ${onshoreBottomY} L ${gridTopX} ${gridTopY}`}
        stroke={gridEnergised ? COLOR_400KV : COLOR_DEEN}
        strokeWidth={gridEnergised ? 3 : 1.5}
        fill="none"
        className={gridEnergised ? "mimic-flow-400kv" : undefined}
      />
      <text
        x={onshoreBottomX + 8}
        y={(onshoreBottomY + gridTopY) / 2}
        className="font-mono"
        fontSize="9"
        fill={gridEnergised ? COLOR_400KV : COLOR_DEEN}
      >
        400 kV
      </text>

      {gridEnergised && (
        <polygon
          points={`${gridTopX - 4},${gridTopY - 8} ${gridTopX + 4},${gridTopY - 8} ${gridTopX},${gridTopY - 1}`}
          fill={COLOR_400KV}
        />
      )}
    </svg>
  );
}

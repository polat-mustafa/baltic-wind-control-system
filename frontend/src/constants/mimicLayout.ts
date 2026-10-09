/**
 * Fixed-pixel layout for the SCADA Plant Mimic.
 *
 * Industrial HMIs use deterministic coordinates so flow lines, equipment
 * tiles, and labels align predictably regardless of viewport. The mimic
 * canvas is wrapped in a scroll container so smaller screens stay usable.
 *
 * One row of turbine cells per string; the 66 kV bus runs right of the
 * longest row and the OSS / onshore / grid tiles to the right of it — so
 * SB-510 (6 strings of ≤ 6) gets 1052 × 580 and a larger farm a larger canvas.
 * cellW must match the TurbineCell width (w-[112px]).
 */

const CELL = { cellW: 112, cellH: 64, cellGapX: 4, rowGapY: 18, stringStartX: 10, stringStartY: 14 } as const;

export type MimicLayout = ReturnType<typeof mimicLayout>;

export function mimicLayout(stringLengths: number[]) {
  const { cellW, cellH, cellGapX, rowGapY, stringStartX, stringStartY } = CELL;
  const longest = Math.max(1, ...stringLengths);
  const rowRight = (n: number) => stringStartX + n * cellW + (n - 1) * cellGapX;
  const busX = rowRight(longest) + 40;
  const tileX = busX + 50;
  const rowsBottom = stringStartY + stringLengths.length * (cellH + rowGapY);
  return {
    ...CELL,
    width: tileX + 210 + 50,
    height: Math.max(580, rowsBottom + 20),

    // vertical 66 kV bus running along right edge of strings
    busX,

    // OSS / Onshore / Grid tiles (top-left anchor)
    ossX: tileX,
    ossY: 60,
    ossW: 210,
    ossH: 150,

    onshoreX: tileX,
    onshoreY: 270,
    onshoreW: 210,
    onshoreH: 150,

    gridX: tileX,
    gridY: 470,
    gridW: 210,
    gridH: 100,

    /** Vertical centre of string row i. */
    stringY: (row: number) => stringStartY + row * (cellH + rowGapY) + cellH / 2,
    /** Right edge of the last cell of string row i. */
    stringRightX: (row: number) => rowRight(stringLengths[row]),
  };
}

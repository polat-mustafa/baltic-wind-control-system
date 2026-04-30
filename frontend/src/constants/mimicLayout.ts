/**
 * Fixed-pixel layout for the SCADA Plant Mimic.
 *
 * Industrial HMIs use deterministic coordinates so flow lines, equipment
 * tiles, and labels align predictably regardless of viewport. The mimic
 * canvas is wrapped in a scroll container so smaller screens stay usable.
 */

export const MIMIC_LAYOUT = {
  width: 980,
  height: 580,

  // strings: 6 rows × up-to-6 cells, top-left of first cell, row spacing
  stringStartX: 10,
  stringStartY: 14,
  cellW: 100,
  cellH: 64,
  cellGapX: 4,
  rowGapY: 18,

  // vertical 66 kV bus running along right edge of strings
  busX: 670,

  // OSS / Onshore / Grid tiles (top-left anchor)
  ossX:      720,
  ossY:       60,
  ossW:      210,
  ossH:      150,

  onshoreX: 720,
  onshoreY: 270,
  onshoreW: 210,
  onshoreH: 150,

  gridX:    720,
  gridY:    470,
  gridW:    210,
  gridH:    100,
} as const;

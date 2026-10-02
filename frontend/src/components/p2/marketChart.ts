/** Shared bits of the market charts: hourly step x-axis and negative-price bands. */

import { DARK_PLOTLY_LAYOUT } from "../../constants/plotlyDefaults";
import type { ChartPalette } from "../../hooks/useChartPalette";
import type { MarketHour } from "../../types/market";

/** Period h covers [h, h+1): step lines need the closing point at 24. */
export const stepX = (hours: MarketHour[]) => [...hours.map((h) => h.hour), 24];
export const stepY = (v: number[]) => [...v, v[v.length - 1]];
/** Bars sit in the middle of their period. */
export const barX = (hours: MarketHour[]) => hours.map((h) => h.hour + 0.5);

export const hourAxis = {
  ...DARK_PLOTLY_LAYOUT.xaxis,
  title: { text: "Delivery hour", font: { size: 12 } },
  range: [0, 24],
  dtick: 3,
  ticksuffix: ":00",
};

export const negativeBands = (hours: MarketHour[], c: ChartPalette) =>
  hours
    .filter((h) => h.da_price_pln_mwh < 0)
    .map((h) => ({
      type: "rect" as const,
      xref: "x" as const,
      yref: "paper" as const,
      x0: h.hour,
      x1: h.hour + 1,
      y0: 0,
      y1: 1,
      fillcolor: c.band,
      line: { width: 0 },
      layer: "below" as const,
    }));

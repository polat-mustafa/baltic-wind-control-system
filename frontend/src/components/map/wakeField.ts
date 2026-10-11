/**
 * Wake field raster for the maps: u/u₀ on a 100 m grid around the farm
 * (utils/wakeModel.wakeSpeedRatio — the same Gaussian deficits and Katic sum
 * as the per-turbine losses), drawn as copper whose opacity grows with the
 * deficit. Free stream stays transparent. Replaces the old wake cones, whose
 * hard edges and stacked transparency matched neither the Gaussian model nor
 * the superposition.
 */

import { M_PER_DEG_LAT, M_PER_DEG_LON, toLocalM, wakeSpeedRatio } from "../../utils/wakeModel";

// Wakes run on past the outer rows: ≈ 7.5 % deficit 4 km behind a rotor, ≈ 2.5 % at 8 km
const MARGIN_M = 8000;
/** Copper: the colour of energy lost, as on the project site. */
export const WAKE_RGB = [196, 105, 59] as const;
/** Below this deficit the field is clear (no tint over the whole sea), at FULL_DEFICIT fully drawn. */
const MIN_DEFICIT = 0.02;
const FULL_DEFICIT = 0.25;

export interface WakeField {
  image: HTMLCanvasElement;
  /** [west, south, east, north] for deck.gl's BitmapLayer */
  bounds: [number, number, number, number];
}

/** The field for one wind direction and thrust; null where canvas is unavailable (tests). */
export function wakeField(
  turbines: readonly { lat: number; lon: number }[],
  windFromDeg: number,
  ct: number,
  /** grid step [m]: 100 on the control room, coarser where turbines are dragged */
  cellM = 100,
): WakeField | null {
  if (turbines.length === 0) return null;
  const lat0 = Math.min(...turbines.map((t) => t.lat)) - MARGIN_M / M_PER_DEG_LAT;
  const lon0 = Math.min(...turbines.map((t) => t.lon)) - MARGIN_M / M_PER_DEG_LON;
  const rotors = turbines.map((t) => {
    const [e, n] = toLocalM(t.lat, t.lon, lat0, lon0);
    return { e, n };
  });
  const widthM = Math.max(...rotors.map((r) => r.e)) + MARGIN_M;
  const heightM = Math.max(...rotors.map((r) => r.n)) + MARGIN_M;
  const cols = Math.ceil(widthM / cellM);
  const rows = Math.ceil(heightM / cellM);

  const image = document.createElement("canvas");
  image.width = cols;
  image.height = rows;
  const ctx = image.getContext("2d");
  if (!ctx) return null;
  const px = ctx.createImageData(cols, rows);
  for (let j = 0; j < rows; j++) {
    const n = heightM - (j + 0.5) * cellM; // row 0 is the north edge
    for (let i = 0; i < cols; i++) {
      const deficit = 1 - wakeSpeedRatio((i + 0.5) * cellM, n, rotors, windFromDeg, ct);
      if (deficit < MIN_DEFICIT) continue;
      const k = (j * cols + i) * 4;
      px.data[k] = WAKE_RGB[0];
      px.data[k + 1] = WAKE_RGB[1];
      px.data[k + 2] = WAKE_RGB[2];
      px.data[k + 3] = Math.round(Math.min(1, (deficit - MIN_DEFICIT) / (FULL_DEFICIT - MIN_DEFICIT)) * 235);
    }
  }
  ctx.putImageData(px, 0, 0);
  return {
    image,
    bounds: [lon0, lat0, lon0 + widthM / M_PER_DEG_LON, lat0 + heightM / M_PER_DEG_LAT],
  };
}

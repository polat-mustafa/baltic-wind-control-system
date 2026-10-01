/**
 * Live site weather from Open-Meteo (free, no API key, CORS enabled).
 *
 * - Forecast API (DWD ICON / ECMWF IFS blend): current 10 m wind, gusts,
 *   air temperature, MSL pressure, cloud cover, visibility; hourly 100 m wind.
 * - Marine API: significant wave height, mean period, direction, SST.
 *
 * Hub-height wind (150 m) = u100 · (150/100)^α with the offshore shear
 * exponent α = 0.1 used across the landing sim (utils/landingPhysics).
 * Data: Open-Meteo.com, CC BY 4.0 — attribution shown in the UI.
 */

import { HUB_HEIGHT_M, SHEAR_ALPHA } from "../utils/landingPhysics";

/** Site centre (array centroid), WGS84. */
export const SITE_LATLON = { lat: 54.797, lon: 16.397 };

export interface LiveWeather {
  fetchedAt: number;
  /** Observation/analysis time (UTC, ISO) */
  time: string;
  wind10Ms: number;
  windDir10Deg: number;
  gust10Ms: number;
  wind100Ms: number;
  windDir100Deg: number;
  hubWindMs: number;
  airTempC: number;
  pressureHpa: number;
  cloudPct: number;
  visibilityKm: number;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  waveDirDeg: number | null;
  seaTempC: number | null;
}

interface ForecastResponse {
  current: {
    time: string;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
    temperature_2m: number;
    pressure_msl: number;
    cloud_cover: number;
    visibility: number;
  };
  hourly: { time: string[]; wind_speed_100m: number[]; wind_direction_100m: number[] };
}

interface MarineResponse {
  current: {
    wave_height: number | null;
    wave_period: number | null;
    wave_direction: number | null;
    sea_surface_temperature: number | null;
  };
}

/** Linear interpolation of an hourly series at an ISO time (UTC). */
function atTime(times: string[], values: number[], iso: string): number {
  const t = Date.parse(`${iso}Z`);
  for (let i = 1; i < times.length; i++) {
    const t1 = Date.parse(`${times[i]}Z`);
    if (t <= t1) {
      const t0 = Date.parse(`${times[i - 1]}Z`);
      return values[i - 1] + ((values[i] - values[i - 1]) * (t - t0)) / (t1 - t0);
    }
  }
  return values[values.length - 1];
}

/** Circular interpolation for directions [deg]. */
function atTimeDir(times: string[], values: number[], iso: string): number {
  const s = atTime(times, values.map((d) => Math.sin((d * Math.PI) / 180)), iso);
  const c = atTime(times, values.map((d) => Math.cos((d * Math.PI) / 180)), iso);
  return ((Math.atan2(s, c) * 180) / Math.PI + 360) % 360;
}

export async function fetchLiveWeather(signal?: AbortSignal): Promise<LiveWeather> {
  const { lat, lon } = SITE_LATLON;
  const q = `latitude=${lat}&longitude=${lon}&timezone=GMT`;
  const [fc, mar] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?${q}&wind_speed_unit=ms&forecast_days=2` +
        "&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,pressure_msl,cloud_cover,visibility" +
        "&hourly=wind_speed_100m,wind_direction_100m",
      { signal },
    ).then((r) => {
      if (!r.ok) throw new Error(`Open-Meteo forecast HTTP ${r.status}`);
      return r.json() as Promise<ForecastResponse>;
    }),
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?${q}` +
        "&current=wave_height,wave_period,wave_direction,sea_surface_temperature",
      { signal },
    )
      .then((r) => (r.ok ? (r.json() as Promise<MarineResponse>) : null))
      .catch(() => null),
  ]);

  const c = fc.current;
  const wind100 = atTime(fc.hourly.time, fc.hourly.wind_speed_100m, c.time);
  return {
    fetchedAt: Date.now(),
    time: c.time,
    wind10Ms: c.wind_speed_10m,
    windDir10Deg: c.wind_direction_10m,
    gust10Ms: c.wind_gusts_10m,
    wind100Ms: wind100,
    windDir100Deg: atTimeDir(fc.hourly.time, fc.hourly.wind_direction_100m, c.time),
    hubWindMs: wind100 * (HUB_HEIGHT_M / 100) ** SHEAR_ALPHA,
    airTempC: c.temperature_2m,
    pressureHpa: c.pressure_msl,
    cloudPct: c.cloud_cover,
    visibilityKm: c.visibility / 1000,
    waveHeightM: mar?.current.wave_height ?? null,
    wavePeriodS: mar?.current.wave_period ?? null,
    waveDirDeg: mar?.current.wave_direction ?? null,
    seaTempC: mar?.current.sea_surface_temperature ?? null,
  };
}

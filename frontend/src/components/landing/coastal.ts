/**
 * Measured wind at the IMGW coastal SYNOP stations (Kołobrzeg, Ustka, Łeba,
 * Hel) through the backend (GET /api/v1/wind/coastal-stations, cached 10 min):
 * hourly 10 m wind on the shore, the check that the live weather is real.
 */

import { useEffect, useState } from "react";

import { request } from "../../services/apiClient";

export interface CoastalStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  time_utc: string;
  wind_ms: number | null;
  wind_dir_deg: number | null;
  air_temp_c: number | null;
  pressure_hpa: number | null;
  humidity_pct: number | null;
}

interface CoastalResponse {
  stations: CoastalStation[];
  source: string;
  height_m: number;
}

const REFRESH_MS = 10 * 60 * 1000; // SYNOP is hourly; the backend caches 10 min

/** The latest observation per station while `on`; empty when off or unreachable. */
export function useCoastalStations(on: boolean): CoastalStation[] {
  const [stations, setStations] = useState<CoastalStation[]>([]);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    const load = () =>
      request<CoastalResponse>("/api/v1/wind/coastal-stations")
        .then((d) => alive && setStations(d.stations))
        .catch(() => alive && setStations([]));
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [on]);
  return on ? stations : [];
}

/** "Ustka · 5 m/s from 190° at 10 m · 10.7 °C · 21:00 UTC". */
export const stationLine = (s: CoastalStation): string =>
  [
    s.name,
    s.wind_ms == null ? "no wind reading" : `${s.wind_ms.toFixed(0)} m/s${s.wind_dir_deg == null ? "" : ` from ${s.wind_dir_deg.toFixed(0)}°`} at 10 m`,
    s.air_temp_c == null ? "" : `${s.air_temp_c.toFixed(1)} °C`,
    `${s.time_utc.slice(11, 16)} UTC`,
  ]
    .filter(Boolean)
    .join(" · ");

import { useEffect } from "react";

import { useFleet } from "../lib/fleet";
import { fetchLiveWeather, SITE_LATLON } from "../services/openMeteoApi";
import { LIVE_MAX_AGE_MS, useLandingStore } from "../store/landingStore";

const LIVE_REFRESH_MS = 15 * 60 * 1000; // Open-Meteo "current" updates every 15 min

/**
 * Keeps the live plant on Open-Meteo weather at the farm (SB-510's centroid or
 * the own project's OSS) while the live source is chosen — app-wide, so the
 * control room, SCADA and the 3D viewer all run on the same reading. A failed
 * fetch keeps a reading younger than LIVE_MAX_AGE_MS; older ones are dropped
 * and the plant falls back to the simulation (shown as such).
 */
export function useLiveWeather(): void {
  const source = useLandingStore((s) => s.weatherSource);
  const fleet = useFleet();
  const lat = fleet.source === "sb510" ? SITE_LATLON.lat : fleet.oss.lat;
  const lon = fleet.source === "sb510" ? SITE_LATLON.lon : fleet.oss.lon;
  useEffect(() => {
    if (source !== "live") return;
    const { setLiveWeather, setLiveError } = useLandingStore.getState();
    const ctl = new AbortController();
    const load = () =>
      fetchLiveWeather({ lat, lon }, ctl.signal)
        .then((w) => {
          setLiveWeather(w);
          setLiveError(null);
        })
        .catch((e: unknown) => {
          if (ctl.signal.aborted) return;
          setLiveError(e instanceof Error ? e.message : "fetch failed");
          const last = useLandingStore.getState().liveWeather;
          if (last && Date.now() - last.fetchedAt >= LIVE_MAX_AGE_MS) setLiveWeather(null);
        });
    load();
    const id = setInterval(load, LIVE_REFRESH_MS);
    return () => {
      ctl.abort();
      clearInterval(id);
    };
  }, [source, lat, lon]);
}

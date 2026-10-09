/**
 * Compact environment / sea-state info panel.
 *
 * Reads from the landing store's `environment` slice and displays:
 *   - Beaufort scale badge + description
 *   - Significant wave height (Hs) and peak period (Tp)
 *   - Air & sea temperature
 *   - Visibility, cloud cover, barometric pressure
 *   - Simulated time-of-day clock
 *
 * Positioned bottom-left above the alarm ticker. ISA-101 dark theme.
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchLiveWeather } from "../../services/openMeteoApi";
import { selectEnvironment, useLandingStore } from "../../store/landingStore";

const LIVE_REFRESH_MS = 15 * 60 * 1000; // Open-Meteo "current" updates every 15 min

/** Fetches Open-Meteo while the LIVE source is selected. */
function useLiveWeatherFeed(): string | null {
  const source = useLandingStore((s) => s.weatherSource);
  const setLive = useLandingStore((s) => s.setLiveWeather);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (source !== "live") return;
    const ctl = new AbortController();
    const load = () =>
      fetchLiveWeather(ctl.signal)
        .then((w) => {
          setLive(w);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!ctl.signal.aborted)
            setError(e instanceof Error ? e.message : "fetch failed");
        });
    load();
    const id = setInterval(load, LIVE_REFRESH_MS);
    return () => {
      ctl.abort();
      clearInterval(id);
    };
  }, [source, setLive]);
  return error;
}

/** Beaufort colour scale: 0-3 green, 4-6 cyan, 7-9 amber, 10+ red */
function beaufortColor(scale: number): string {
  if (scale <= 3) return "#22c55e";
  if (scale <= 6) return "#06b6d4";
  if (scale <= 9) return "#f59e0b";
  return "#f25c54";
}

function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function EnvironmentPanel() {
  const env = useLandingStore(selectEnvironment);
  const source = useLandingStore((s) => s.weatherSource);
  const setSource = useLandingStore((s) => s.setWeatherSource);
  const live = useLandingStore((s) => s.liveWeather);
  const error = useLiveWeatherFeed();
  const isLive = source === "live" && !!live;
  const bColor = beaufortColor(env.beaufortScale);
  // Collapsed to its header on phones (it would cover a quarter of the map)
  const [open, setOpen] = useState(() => window.innerWidth >= 640);

  return (
    <div
      className="pointer-events-auto rounded-lg border overflow-hidden"
      style={{
        backgroundColor: "rgba(10,21,32,0.92)",
        borderColor: "#1f3448",
        minWidth: 180,
      }}
    >
      {/* Header with simulated clock */}
      <div
        className="flex items-center justify-between px-2.5 py-1 border-b"
        style={{ borderColor: "#1f3448" }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1 text-xs font-semibold tracking-wider uppercase text-text-muted"
        >
          Environment
          <span className="sm:hidden">{open ? <ChevronDown size={11} /> : <ChevronUp size={11} />}</span>
        </button>
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: "#94a3b8" }}
          >
            {isLive
              ? `${live.time.slice(11, 16)} UTC`
              : `${formatHour(env.simulatedHour)} UTC`}
          </span>
          <div
            className="flex overflow-hidden rounded border"
            style={{ borderColor: "#2c4760" }}
            role="group"
            aria-label="Weather source"
          >
            {(["sim", "live"] as const).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setSource(src)}
                aria-pressed={source === src}
                className="px-1.5 text-xs font-semibold uppercase"
                style={{
                  backgroundColor:
                    source === src
                      ? src === "live"
                        ? "#16a34a"
                        : "#45c8d9"
                      : "transparent",
                  color: source === src ? "#fff" : "#94a3b8",
                }}
                title={
                  src === "live"
                    ? "Live site weather from Open-Meteo (ICON/IFS + marine)"
                    : "Time-compressed simulation"
                }
              >
                {src}
              </button>
            ))}
          </div>
        </div>
      </div>

      {open && (
        <>
          {/* Beaufort badge */}
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 border-b"
            style={{ borderColor: "#1f3448" }}
          >
            <span
              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: bColor + "22",
                color: bColor,
                border: `1px solid ${bColor}44`,
              }}
            >
              {env.beaufortScale}
            </span>
            <div>
              <div className="text-xs font-medium" style={{ color: bColor }}>
                Bft {env.beaufortScale} — {env.beaufortDesc}
              </div>
            </div>
          </div>

          {/* Sea state */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-2.5 py-1.5 text-xs">
            <Row label="Hs" value={`${env.significantWaveHeightM.toFixed(1)} m`} />
            <Row
              label={isLive ? "Tm" : "Tp"}
              value={`${env.wavePeriodS.toFixed(1)} s`}
            />
            <Row label="Air" value={`${env.airTemperatureC.toFixed(1)} °C`} />
            <Row label="Sea" value={`${env.seaTemperatureC.toFixed(1)} °C`} />
            <Row label="Vis" value={`${env.visibilityKm.toFixed(0)} km`} />
            <Row label="Cloud" value={`${env.cloudCoverPct}%`} />
            <Row label="Press" value={`${env.pressureHpa.toFixed(0)} hPa`} />
            {isLive && (
              <Row label="Hub" value={`${live.hubWindMs.toFixed(1)} m/s`} />
            )}
          </div>
          {source === "live" && (
            <div
              className="border-t px-2.5 py-1 text-xs leading-snug text-text-muted"
              style={{ borderColor: "#1f3448" }}
            >
              {error
                ? `Open-Meteo unavailable (${error}) — using simulation`
                : live
                  ? `Open-Meteo (CC BY 4.0) · 10 m ${live.wind10Ms.toFixed(1)} m/s ${Math.round(live.windDir10Deg)}° · 100 m ${live.wind100Ms.toFixed(1)} m/s → hub 150 m (α 0.1)`
                  : "loading Open-Meteo…"}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary font-mono tabular-nums">{value}</span>
    </div>
  );
}

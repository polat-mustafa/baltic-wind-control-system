/**
 * Live AIS traffic around the site — real vessels only.
 *
 * Polls the backend proxy GET /api/v1/info/ais every 15 s (aisstream.io,
 * needs AISSTREAM_API_KEY on the backend). Without a key, or with the
 * backend down, the layer shows a small status note and no ships: we never
 * draw invented traffic. Colours follow the usual chart-plotter convention
 * by ITU-R M.1371 ship-type code.
 */

import { useEffect, useState } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";

import { request } from "../../services/apiClient";

interface AisVessel {
  mmsi: number;
  name: string;
  lat: number;
  lon: number;
  sog_kn: number | null;
  cog_deg: number | null;
  heading_deg: number | null;
  ship_type: number | null;
  updated: number;
}
interface AisResponse {
  enabled: boolean;
  vessels: AisVessel[];
  status: { connected: boolean; error: string };
}

/** ITU-R M.1371 ship type → (label, colour). */
function shipClass(code: number | null): [string, string] {
  if (code === null) return ["unknown type", "#94a3b8"];
  if (code >= 70 && code <= 79) return ["cargo", "#22c55e"];
  if (code >= 80 && code <= 89) return ["tanker", "#ef4444"];
  if (code >= 60 && code <= 69) return ["passenger", "#3b82f6"];
  if (code === 30) return ["fishing", "#fb923c"];
  if (code === 31 || code === 32 || code === 52) return ["towing / tug", "#06b6d4"];
  if (code === 36 || code === 37) return ["sailing / pleasure", "#d946ef"];
  if (code >= 50 && code <= 59) return ["special craft", "#06b6d4"];
  return ["other", "#94a3b8"];
}

function aisIcon(color: string, deg: number): L.DivIcon {
  return L.divIcon({
    html: `<svg width="14" height="14" viewBox="0 0 14 14" style="transform:rotate(${deg}deg)"><path d="M7 1 11.5 12.5 7 10 2.5 12.5Z" fill="${color}" stroke="#0a0e15" stroke-width="1"/></svg>`,
    className: "leaflet-ais",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function AisTraffic() {
  const [data, setData] = useState<AisResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      request<AisResponse>("/api/v1/info/ais")
        .then((d) => {
          if (!alive) return;
          setData(d);
          setErr(null);
        })
        .catch(() => alive && setErr("backend not reachable"));
    load();
    const id = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const note = err
    ? `AIS: ${err}`
    : data && !data.enabled
      ? "AIS off — set AISSTREAM_API_KEY on the backend (free key: aisstream.io)"
      : data && !data.status.connected
        ? `AIS: connecting… ${data.status.error}`
        : data && data.vessels.length === 0
          ? "AIS live — no vessel reports yet (shore-receiver coverage off Słupsk is sparse)"
          : null;

  return (
    <>
      {note && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 z-1000 -translate-x-1/2 rounded border border-border-primary bg-bg-primary/85 px-2 py-0.5 text-[10px] text-text-muted">
          {note}
        </div>
      )}
      {data?.vessels.map((v) => {
        const [kind, color] = shipClass(v.ship_type);
        const deg = v.heading_deg ?? v.cog_deg ?? 0;
        const age = Math.round((Date.now() / 1000 - v.updated) / 60);
        return (
          <Marker key={v.mmsi} position={[v.lat, v.lon]} icon={aisIcon(color, deg)} zIndexOffset={1100}>
            <Tooltip direction="top" offset={[0, -6]}>
              {v.name || `MMSI ${v.mmsi}`} · {kind} · {v.sog_kn?.toFixed(1) ?? "–"} kn · COG{" "}
              {v.cog_deg?.toFixed(0) ?? "–"}° · {age} min ago (AIS)
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

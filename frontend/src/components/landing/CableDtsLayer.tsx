/**
 * Export cable DTS layer — conductor temperature along the 76.5 km route
 * (IEC 60287 model shared with backend services/p2/cable_dts.py through
 * utils/landingPhysics.dtsTempC), coloured every 0.5 km, with the two
 * physical hotspots labelled: the OSS J-tube and the HDD landfall.
 * Current per circuit from the live export (exportCableState), ambient = sea
 * temperature from the environment (sim or Open-Meteo marine).
 */

import { memo } from "react";
import { Marker, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";

import { EXPORT_CABLE_GEO } from "../../constants/windFarmLayout";
import { selectEnvironment, selectKPIs, useLandingStore } from "../../store/landingStore";
import { DTS_ZONES, dtsTempC, dtsZoneName, exportCableState } from "../../utils/landingPhysics";

type P = [number, number];
const STEP_KM = 0.5;

/** Route resampled every STEP_KM, as [start, end, kmMid] slices. */
const SLICES: { pts: P[]; km: number }[] = (() => {
  const pts = EXPORT_CABLE_GEO.map((p) => L.latLng(p.lat, p.lon));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i - 1].distanceTo(pts[i]) / 1000);
  const total = cum[cum.length - 1];
  const at = (km: number): P => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < km) i++;
    const f = (km - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * f, pts[i - 1].lng + (pts[i].lng - pts[i - 1].lng) * f];
  };
  const out: { pts: P[]; km: number }[] = [];
  for (let km = 0; km < total; km += STEP_KM) {
    const end = Math.min(total, km + STEP_KM);
    out.push({ pts: [at(km), at(end)], km: (km + end) / 2 });
  }
  return out;
})();

/** 20 °C blue → 50 green → 70 amber (DTS alarm) → 90 red (limit). */
function tempColor(t: number): string {
  if (t < 35) return "#38bdf8";
  if (t < 55) return "#3ecf6e";
  if (t < 70) return "#facc15";
  if (t < 85) return "#f97316";
  return "#ef4444";
}

const label = (text: string, anchor: [number, number] = [-8, 8]) =>
  L.divIcon({
    html: `<span style="font:600 10px/1 'JetBrains Mono',monospace;background:rgba(10,14,21,.85);color:#fda4af;padding:2px 4px;border-radius:3px;border:1px solid #fb718566;white-space:nowrap">${text}</span>`,
    className: "leaflet-dts-label",
    iconSize: [0, 0],
    iconAnchor: anchor,
  });

function CableDtsLayer() {
  const kpis = useLandingStore(selectKPIs);
  const env = useLandingStore(selectEnvironment);
  // Round to 5 A / 0.5 °C so the 90 slices only redraw on real changes
  const currentA = Math.round(exportCableState(kpis.totalOutputMW).currentA / 5) * 5;
  const ambient = Math.round(env.seaTemperatureC * 2) / 2;
  const jTube = dtsTempC(0.1, currentA, ambient);
  const hddKm = (DTS_ZONES.hddStartKm + DTS_ZONES.hddEndKm) / 2;
  const hdd = dtsTempC(hddKm, currentA, ambient);
  const hddSlice = SLICES.reduce((a, b) => (Math.abs(b.km - hddKm) < Math.abs(a.km - hddKm) ? b : a));

  return (
    <>
      {SLICES.map((s) => {
        const t = dtsTempC(s.km, currentA, ambient);
        return (
          <Polyline
            key={s.km}
            positions={s.pts}
            pathOptions={{ color: tempColor(t), weight: 6, opacity: 0.85, lineCap: "butt" }}
          >
            <Tooltip sticky>
              km {s.km.toFixed(1)} · {t.toFixed(1)} °C · {dtsZoneName(s.km)} · {currentA} A/circuit · ambient{" "}
              {ambient} °C
            </Tooltip>
          </Polyline>
        );
      })}
      <Marker position={SLICES[0].pts[0]} icon={label(`J-tube ${jTube.toFixed(0)} °C`, [115, -16])} interactive={false} />
      <Marker position={hddSlice.pts[0]} icon={label(`HDD landfall ${hdd.toFixed(0)} °C`)} interactive={false} />
    </>
  );
}

export default memo(CableDtsLayer);

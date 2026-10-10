/**
 * Context and marine layers of the Control Room map (deck.gl), split from
 * ControlRoomMap so the plant layers stay readable there:
 *
 *  under the plant   bathymetry, planned OWF areas + SwePol HVDC, 500 m safety
 *                    zones, foundations, OT fibre, export cable DTS
 *  over the plant    navigation lights + cardinal marks, AIS, O&M vessels,
 *                    repair crews, fault passage indicators
 *
 * Every pickable object carries a `tip` string the map shows as its tooltip.
 * Positions are sourced in constants/windFarmLayout; the physics (DTS,
 * weather limits) is shared with the backend through utils/landingPhysics.
 */

import type { Layer } from "@deck.gl/core";
import { PathStyleExtension } from "@deck.gl/extensions";
import { IconLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";

import {
  BATHYMETRY_CONTOURS_GEO,
  CARDINAL_MARKS,
  EXPORT_CABLE_GEO,
  NEIGHBOUR_OWF_AREAS,
  ONSHORE_GEO,
  PERIPHERY_RING,
  SAFETY_ZONE_M,
  SPS_TURBINES,
  SWEPOL_GEO,
} from "../../constants/windFarmLayout";
import { cableTree, distanceM } from "../../lib/arrayCables";
import type { Fleet } from "../../lib/fleet";
import type { ArrayCableFault, RepairJob } from "../../store/landingStore";
import type { LayerVisibility, MapTheme } from "../../store/layerStore";
import type { TurbineData } from "../../types/landing";
import { DTS_ZONES, dtsTempC, dtsZoneName } from "../../utils/landingPhysics";

import { AIS_ICON, FAULT_LABEL, cardinalIcon, crewIcon, shipClass, svgIcon, vesselIcon, type AisVessel, type OmVessel } from "./maritime";

export type RGBA = [number, number, number, number];

/**
 * Map palettes: Baltic Night (control room) and storybook paper. Saturated on
 * purpose: the street map underneath is busy, so equipment, cables and zones
 * need strong hues to read at a glance.
 */
export const PALETTES = {
  hmi: {
    land: "#101c27",
    sea: "#0a1622",
    coast: "#22384d",
    boundary: "#a5b4fc",
    turbine: [255, 255, 255, 255] as RGBA,
    hollow: [10, 21, 32, 255] as RGBA,
    offline: [120, 150, 180, 255] as RGBA,
    warn: [255, 184, 28, 255] as RGBA,
    alarm: [255, 77, 77, 255] as RGBA,
    accent: [34, 226, 245, 255] as RGBA,
    comms: [232, 121, 249, 255] as RGBA,
    depth: [86, 156, 214, 255] as RGBA,
    zone: [192, 132, 252, 255] as RGBA,
    v66: [255, 176, 46, 255] as RGBA,
    v220: [96, 165, 250, 255] as RGBA,
    v400: [255, 99, 99, 255] as RGBA,
    text: [203, 221, 238, 255] as RGBA,
    muted: [150, 176, 202, 255] as RGBA,
    label: [228, 236, 243, 255] as RGBA,
    labelBg: [15, 29, 43, 230] as RGBA,
    ink: "#e4ecf3",
  },
  storybook: {
    land: "#e8d8b0",
    sea: "#3f8d86",
    coast: "#2b2118",
    boundary: "#4338ca",
    turbine: [30, 24, 18, 255] as RGBA,
    hollow: [255, 250, 235, 255] as RGBA,
    offline: [107, 98, 87, 255] as RGBA,
    warn: [217, 119, 6, 255] as RGBA,
    alarm: [220, 38, 38, 255] as RGBA,
    accent: [246, 238, 219, 255] as RGBA,
    comms: [162, 28, 175, 255] as RGBA,
    depth: [22, 70, 66, 255] as RGBA,
    zone: [124, 58, 237, 255] as RGBA,
    v66: [234, 108, 0, 255] as RGBA,
    v220: [29, 78, 216, 255] as RGBA,
    v400: [220, 38, 38, 255] as RGBA,
    text: [43, 33, 24, 255] as RGBA,
    muted: [74, 62, 50, 255] as RGBA,
    label: [43, 33, 24, 255] as RGBA,
    labelBg: [247, 237, 212, 235] as RGBA,
    ink: "#2b2118",
  },
};
export type Palette = (typeof PALETTES)["hmi"];

export const alpha = (c: RGBA, a: number): RGBA => [c[0], c[1], c[2], a];
const ll = (p: [number, number]): [number, number] => [p[1], p[0]];
const DASH = [new PathStyleExtension({ dash: true })];
const MONO = "IBM Plex Mono, monospace";

// ── Static geometry (module level, so deck.gl never re-uploads it) ──

const BATHY = BATHYMETRY_CONTOURS_GEO.map((c) => ({
  depth: c.depth,
  path: c.points.map(ll),
  mid: ll(c.points[Math.floor(c.points.length / 2)]),
  tip: `${c.depth} m isobath (EMODnet bathymetry)`,
}));
const OWF = NEIGHBOUR_OWF_AREAS.map((a) => {
  const ring = a.ring.map(ll);
  const n = ring.length;
  return {
    name: a.name,
    polygon: ring,
    path: [...ring, ring[0]],
    centre: [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n] as [number, number],
    tip: `${a.name} · planned OWF area${a.mw ? ` · ${a.mw} MW` : ""}\n(Polish maritime spatial plan, EMODnet)`,
  };
});
const SWEPOL = [
  {
    path: SWEPOL_GEO.map(ll),
    tip: "HVDC SwePol · 450 kV DC · 600 MW · Stärnö (SE) ↔ Słupsk-Wierzbięcino (PL)\nexisting PL–SE interconnector, grid context only — not part of the wind farm (OSM)",
  },
];
const CARDINALS = CARDINAL_MARKS.map((m) => ({
  position: [m.lon, m.lat] as [number, number],
  icon: cardinalIcon(m.kind),
  text: `${m.kind} · ${m.light}`,
  tip: `${m.kind} cardinal mark · IALA Region A · light ${m.light}\nsafe water lies to its ${m.kind} side`,
}));

/** Export route resampled every 0.5 km for the DTS colouring (SB-510's surveyed route). */
const DTS_SLICES = (() => {
  const pts = EXPORT_CABLE_GEO.map((p) => [p.lat, p.lon] as [number, number]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distanceM(pts[i - 1], pts[i]) / 1000);
  const total = cum[cum.length - 1];
  const at = (km: number): [number, number] => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < km) i++;
    const f = (km - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f, pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f];
  };
  const out: { path: [number, number][]; km: number }[] = [];
  for (let km = 0; km < total; km += 0.5) {
    const end = Math.min(total, km + 0.5);
    out.push({ path: [at(km), at(end)], km: (km + end) / 2 });
  }
  return out;
})();

/** 20 °C cool → 55 normal → 70 DTS alarm (amber) → 85 near the 90 °C limit (red). */
function tempColor(t: number, pal: Palette): RGBA {
  if (t < 35) return alpha(pal.v220, 230);
  if (t < 55) return alpha(pal.accent, 230);
  if (t < 70) return alpha(pal.v66, 240);
  if (t < 85) return alpha(pal.warn, 255);
  return pal.alarm;
}

/** Small marine light beside a peripheral turbine (yellow, IALA G1162); SPS ringed. */
const NAV_LIGHT = {
  sps: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="38" cy="38" r="8" fill="none" stroke="#e5c84a" stroke-width="2.5"/><circle cx="38" cy="38" r="4.5" fill="#e5c84a"/></svg>`),
  ips: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="38" cy="38" r="4.5" fill="#e5c84a"/></svg>`),
};
/** Fault passage indicator flag (lit). */
const FPI_ICON = svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="36" viewBox="0 0 16 18"><path d="M3 17V2" stroke="#0a1520" stroke-width="1.6"/><path d="M3 2 14 5 3 8Z" fill="#f0b13e" stroke="#0a1520" stroke-width="1"/></svg>`, 32, 36, 34);

export interface ContextInput {
  layers: LayerVisibility;
  pal: Palette;
  theme: MapTheme;
  fleet: Fleet;
  sb510: boolean;
  zoom: number;
  turbineMap: Record<string, TurbineData>;
  fault: ArrayCableFault | null;
  repairs: Record<string, RepairJob>;
  ais: AisVessel[];
  vessels: OmVessel[];
  /** Export current per circuit [A] and sea temperature [°C], for the DTS. */
  dts: { currentA: number; ambientC: number };
  now: number;
}

/** Layers drawn below the array cables and turbines. */
export function underLayers(c: ContextInput): Layer[] {
  const { layers, pal, fleet, sb510, zoom } = c;
  const out: (Layer | false)[] = [
    layers.bathymetry &&
      new PathLayer({
        id: "bathymetry",
        data: BATHY,
        getPath: (d: (typeof BATHY)[number]) => d.path,
        getColor: (d: (typeof BATHY)[number]) => alpha(pal.depth, 150 + d.depth * 2),
        getWidth: 1.6,
        widthUnits: "pixels",
        getDashArray: [6, 4],
        extensions: DASH,
        pickable: true,
        updateTriggers: { getColor: pal },
      }),
    layers.bathymetry &&
      new TextLayer({
        id: "bathymetry-labels",
        data: BATHY,
        getPosition: (d: (typeof BATHY)[number]) => d.mid,
        getText: (d: (typeof BATHY)[number]) => `${d.depth} m`,
        getColor: alpha(pal.muted, 220),
        getSize: 12,
        fontFamily: MONO,
        characterSet: "auto",
        updateTriggers: { getColor: pal },
      }),
    layers.gridContext &&
      new PolygonLayer({
        id: "owf-areas",
        data: OWF,
        getPolygon: (d: (typeof OWF)[number]) => d.polygon,
        getFillColor: alpha(pal.zone, 38),
        stroked: false,
        pickable: true,
        updateTriggers: { getFillColor: pal },
      }),
    layers.gridContext &&
      new PathLayer({
        id: "owf-outlines",
        data: OWF,
        getPath: (d: (typeof OWF)[number]) => d.path,
        getColor: alpha(pal.zone, 230),
        getWidth: 1.8,
        widthUnits: "pixels",
        getDashArray: [6, 4],
        extensions: DASH,
        updateTriggers: { getColor: pal },
      }),
    layers.gridContext &&
      zoom >= 8.5 &&
      new TextLayer({
        id: "owf-names",
        data: OWF,
        getPosition: (d: (typeof OWF)[number]) => d.centre,
        getText: (d: (typeof OWF)[number]) => d.name,
        getColor: alpha(pal.zone, 255),
        getSize: 12,
        fontFamily: MONO,
        characterSet: "auto",
        updateTriggers: { getColor: pal },
      }),
    layers.gridContext &&
      new PathLayer({
        id: "swepol",
        data: SWEPOL,
        getPath: (d: (typeof SWEPOL)[number]) => d.path,
        getColor: alpha(pal.v400, 230),
        getWidth: 2.5,
        widthUnits: "pixels",
        getDashArray: [10, 4, 2, 4],
        extensions: DASH,
        pickable: true,
        updateTriggers: { getColor: pal },
      }),
    layers.safetyZones &&
      new ScatterplotLayer({
        id: "safety-zones",
        data: [...fleet.turbines, fleet.oss],
        getPosition: (d: { lat: number; lon: number }) => [d.lon, d.lat],
        getRadius: SAFETY_ZONE_M,
        radiusUnits: "meters",
        filled: false,
        stroked: true,
        getLineColor: alpha(pal.muted, 120),
        getLineWidth: 1,
        lineWidthUnits: "pixels",
        updateTriggers: { getLineColor: pal },
      }),
    layers.foundations &&
      zoom >= 13 &&
      new ScatterplotLayer({
        id: "foundations",
        data: fleet.turbines,
        getPosition: (d: { lat: number; lon: number }) => [d.lon, d.lat],
        getRadius: 13,
        radiusUnits: "pixels",
        filled: true,
        stroked: true,
        getFillColor: alpha(pal.hollow, 150),
        getLineColor: alpha(pal.offline, 200),
        getLineWidth: 1.5,
        lineWidthUnits: "pixels",
        updateTriggers: { getFillColor: pal, getLineColor: pal },
      }),
  ];

  // OT fibre: in every array cable (daisy-chained WTG IEDs) and the export cable, microwave backup
  if (layers.fibreComms) {
    const tree = cableTree(fleet);
    const fibre: { path: [number, number][]; tip?: string }[] = tree.segments.map((seg) => ({ path: tree.path(seg).map(ll) }));
    if (sb510) {
      fibre.push({
        path: EXPORT_CABLE_GEO.map((p) => [p.lon, p.lat]),
        tip: "Fibre in the export cable (OT only) · 10 Gbps\nMPLS over fibre + IPsec · OSS ↔ onshore",
      });
    }
    out.push(
      new PathLayer({
        id: "fibre",
        data: fibre,
        getPath: (d: (typeof fibre)[number]) => d.path,
        getColor: alpha(pal.comms, 230),
        getWidth: 1.3,
        widthUnits: "pixels",
        getDashArray: [1, 4],
        extensions: DASH,
        pickable: true,
        updateTriggers: { getColor: pal },
      }),
    );
    if (sb510) {
      out.push(
        new PathLayer({
          id: "microwave",
          data: [{ path: [[fleet.oss.lon, fleet.oss.lat], [ONSHORE_GEO.lon, ONSHORE_GEO.lat]], tip: "Licensed microwave backup link · 100 Mbps · OSS ↔ onshore" }],
          getPath: (d: { path: [number, number][] }) => d.path,
          getColor: alpha(pal.comms, 140),
          getWidth: 1,
          widthUnits: "pixels",
          getDashArray: [8, 8],
          extensions: DASH,
          pickable: true,
          updateTriggers: { getColor: pal },
        }),
      );
    }
  }

  // Export cable DTS: conductor temperature every 0.5 km (IEC 60287, same model as the backend)
  if (layers.cableDts && sb510) {
    const { currentA, ambientC } = c.dts;
    const temp = (km: number) => dtsTempC(km, currentA, ambientC);
    const hddKm = (DTS_ZONES.hddStartKm + DTS_ZONES.hddEndKm) / 2;
    const hdd = DTS_SLICES.reduce((a, b) => (Math.abs(b.km - hddKm) < Math.abs(a.km - hddKm) ? b : a));
    out.push(
      new PathLayer({
        id: "dts",
        data: DTS_SLICES,
        getPath: (d: (typeof DTS_SLICES)[number]) => d.path,
        getColor: (d: (typeof DTS_SLICES)[number]) => tempColor(temp(d.km), pal),
        getWidth: 6,
        widthUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: [currentA, ambientC, pal] },
      }),
      new TextLayer({
        id: "dts-labels",
        data: [
          // J-tube sits at the OSS: below its two labels
          { position: DTS_SLICES[0].path[0], text: `J-tube ${temp(0.1).toFixed(0)} °C`, offset: [16, 34] },
          { position: hdd.path[0], text: `HDD landfall ${temp(hddKm).toFixed(0)} °C`, offset: [12, 14] },
        ],
        getPosition: (d: { position: [number, number] }) => d.position,
        getText: (d: { text: string }) => d.text,
        getColor: pal.label,
        getSize: 12,
        fontFamily: MONO,
        characterSet: "auto",
        getTextAnchor: "start",
        getPixelOffset: (d: { offset: [number, number] }) => d.offset,
        background: true,
        getBackgroundColor: pal.labelBg,
        backgroundPadding: [4, 2],
        updateTriggers: { getColor: pal, getBackgroundColor: pal },
      }),
    );
  }
  return out.filter((l): l is Layer => !!l);
}

/** Layers drawn above the turbines. */
export function overLayers(c: ContextInput): Layer[] {
  const { layers, pal, theme, fleet, sb510, zoom, turbineMap, fault, repairs, ais, vessels, now } = c;
  const storybook = theme === "storybook";
  const pos = new Map(fleet.turbines.map((t) => [t.id, [t.lon, t.lat] as [number, number]]));
  const out: (Layer | false)[] = [];

  if (layers.navAids && sb510) {
    const lights = fleet.turbines
      .filter((t) => PERIPHERY_RING.includes(t.id))
      .map((t) => {
        const sps = SPS_TURBINES.includes(t.id);
        return {
          position: [t.lon, t.lat] as [number, number],
          sps,
          tip: `${t.id} · ${sps ? "SPS — yellow Fl, synchronised, ≥ 5 NM" : "IPS — yellow Fl, ≥ 2 NM"} (IALA G1162)`,
        };
      });
    out.push(
      new IconLayer({
        id: "nav-lights",
        data: lights,
        getPosition: (d: (typeof lights)[number]) => d.position,
        getIcon: (d: (typeof lights)[number]) => (d.sps ? NAV_LIGHT.sps : NAV_LIGHT.ips),
        getSize: 24,
        sizeUnits: "pixels",
        pickable: true,
      }),
      new IconLayer({
        id: "cardinals",
        data: CARDINALS,
        getPosition: (d: (typeof CARDINALS)[number]) => d.position,
        getIcon: (d: (typeof CARDINALS)[number]) => d.icon,
        getSize: 26,
        sizeUnits: "pixels",
        pickable: true,
      }),
      zoom >= 11 &&
        new TextLayer({
          id: "cardinal-labels",
          data: CARDINALS,
          getPosition: (d: (typeof CARDINALS)[number]) => d.position,
          getText: (d: (typeof CARDINALS)[number]) => d.text,
          getColor: pal.muted,
          getSize: 12,
          fontFamily: MONO,
          characterSet: "auto",
          getTextAnchor: "start",
          getPixelOffset: [10, -12],
          updateTriggers: { getColor: pal },
        }),
    );
  }

  if (ais.length > 0) {
    const targets = ais.map((v) => {
      const [kind, rgb] = shipClass(v.ship_type);
      const age = Math.round((now / 1000 - v.updated) / 60);
      return {
        position: [v.lon, v.lat] as [number, number],
        angle: -(v.heading_deg ?? v.cog_deg ?? 0),
        color: [...rgb, 235] as RGBA,
        tip: `${v.name || `MMSI ${v.mmsi}`} · ${kind}\n${v.sog_kn?.toFixed(1) ?? "–"} kn · COG ${v.cog_deg?.toFixed(0) ?? "–"}° · ${age} min ago (AIS)`,
      };
    });
    out.push(
      new IconLayer({
        id: "ais",
        data: targets,
        getPosition: (d: (typeof targets)[number]) => d.position,
        getIcon: () => AIS_ICON,
        getAngle: (d: (typeof targets)[number]) => d.angle,
        getColor: (d: (typeof targets)[number]) => d.color,
        getSize: 15,
        sizeUnits: "pixels",
        pickable: true,
      }),
    );
  }

  if (layers.vessels) {
    if (vessels.length > 0) {
      const icons = { SOV: vesselIcon("SOV", storybook), CTV: vesselIcon("CTV", storybook) };
      out.push(
        new IconLayer({
          id: "om-vessels",
          data: vessels,
          getPosition: (d: OmVessel) => d.position,
          getIcon: (d: OmVessel) => icons[d.kind],
          getAngle: (d: OmVessel) => -d.heading,
          getSize: 24,
          sizeUnits: "pixels",
          pickable: true,
          updateTriggers: { getIcon: storybook },
        }),
        // Tags once zoomed in: at the farm view the SOV's DP hold sits on the OSS label
        zoom >= 12 &&
          new TextLayer({
            id: "om-vessel-tags",
            data: vessels,
            getPosition: (d: OmVessel) => d.position,
            getText: (d: OmVessel) => d.tag,
            getColor: pal.text,
            getSize: 12,
            fontFamily: MONO,
            characterSet: "auto",
            getTextAnchor: "start",
            getPixelOffset: [14, 0],
            background: true,
            getBackgroundColor: alpha(pal.labelBg, 200),
            backgroundPadding: [4, 2],
            updateTriggers: { getColor: pal, getBackgroundColor: pal },
          }),
      );
    }
    const crews = Object.entries(repairs)
      .filter(([id]) => pos.has(id))
      .map(([id, job]) => {
        const what = FAULT_LABEL[turbineMap[id]?.faultType ?? ""] ?? "Repair";
        const pct = Math.min(100, Math.max(0, ((now - job.startedAt) / job.durationMs) * 100));
        return { position: pos.get(id)!, text: `${what} · ${job.crew} · ${pct.toFixed(0)} %`, tip: `${id} · ${what} by ${job.crew} (simulated)` };
      });
    if (crews.length > 0) {
      out.push(
        new IconLayer({
          id: "crews",
          data: crews,
          getPosition: (d: (typeof crews)[number]) => d.position,
          getIcon: () => crewIcon(storybook),
          getSize: 22,
          sizeUnits: "pixels",
          getPixelOffset: [-26, 0],
          pickable: true,
          updateTriggers: { getIcon: storybook },
        }),
        new TextLayer({
          id: "crew-labels",
          data: crews,
          getPosition: (d: (typeof crews)[number]) => d.position,
          getText: (d: (typeof crews)[number]) => d.text,
          getColor: pal.warn,
          getSize: 12,
          fontFamily: MONO,
          characterSet: "auto",
          getPixelOffset: [0, 26],
          background: true,
          getBackgroundColor: pal.labelBg,
          backgroundPadding: [4, 2],
          updateTriggers: { getColor: pal, getBackgroundColor: pal },
        }),
      );
    }
  }

  // Fault passage indicators: the switchgear the fault current flowed through shows a flag;
  // the faulted section lies just beyond the last lit one
  if (fault) {
    const flags = fault.litIds
      .filter((id) => pos.has(id))
      .map((id) => ({ position: pos.get(id)!, tip: `${id} · fault passage indicator lit\nfault current flowed through this switchgear` }));
    out.push(
      new IconLayer({
        id: "fpi",
        data: flags,
        getPosition: (d: (typeof flags)[number]) => d.position,
        getIcon: () => FPI_ICON,
        getSize: 18,
        sizeUnits: "pixels",
        getPixelOffset: [12, -10],
        pickable: true,
      }),
    );
  }
  return out.filter((l): l is Layer => !!l);
}

/** Tooltip text for the DTS slices (needs the live current). */
export function dtsTip(km: number, dts: ContextInput["dts"]): string {
  const t = dtsTempC(km, dts.currentA, dts.ambientC);
  return `Export cable DTS · km ${km.toFixed(1)} · ${t.toFixed(1)} °C\n${dtsZoneName(km)} · ${dts.currentA} A per circuit · sea ${dts.ambientC} °C`;
}

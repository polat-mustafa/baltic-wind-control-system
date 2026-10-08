/**
 * Maritime and grid-context layers for the landing map — all positions are
 * sourced (see constants/windFarmLayout):
 *
 *  - SafetyZones   500 m around every turbine and the OSS (UNCLOS Art. 60(5))
 *  - NavAids       IALA G1162 lights on the periphery (SPS / IPS) and IALA
 *                  Region A cardinal marks around the site
 *  - Vessels       SOV (walk-to-work) + CTV from Port Ustka, limited by the
 *                  simulated sea state with the P1 weather-window limits
 *                  (CTV Hs ≤ 1.5 m, SOV Hs ≤ 2.5 m); track time ×20
 *  - GridContext   SwePol HVDC (OSM) and neighbouring planned OWF areas
 *                  (EMODnet, Polish maritime spatial plan)
 */

import { memo, useEffect, useMemo, useRef } from "react";
import {
  Circle,
  Marker,
  Polygon,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import { useFleet } from "../../lib/fleet";

import {
  CARDINAL_MARKS,
  CTV_ROUTE_GEO,
  NEIGHBOUR_OWF_AREAS,
  PERIPHERY_RING,
  SAFETY_ZONE_M,
  SPS_TURBINES,
  SWEPOL_GEO,
  TURBINE_POSITIONS,
  USTKA_PORT_GEO,
} from "../../constants/windFarmLayout";
import {
  SITE_VISIT_FAULTS,
  useLandingStore,
  type RepairJob,
} from "../../store/landingStore";
import { useLayerStore } from "../../store/layerStore";

// ── Safety zones ─────────────────────────────────────────────────

const ZONE_STYLE = {
  color: "#f59e0b",
  weight: 1,
  opacity: 0.35,
  dashArray: "3 4",
  fillColor: "#f59e0b",
  fillOpacity: 0.03,
  interactive: false,
};

export const SafetyZones = memo(function SafetyZones() {
  const fleet = useFleet();
  return (
    <>
      {[...fleet.turbines, { id: "OSS", ...fleet.oss }].map((p) => (
        <Circle
          key={`sz-${p.id}`}
          center={[p.lat, p.lon]}
          radius={SAFETY_ZONE_M}
          pathOptions={ZONE_STYLE}
        />
      ))}
    </>
  );
});

// ── Navigation aids ──────────────────────────────────────────────

/** Yellow marine light at the turbine's transition piece (below the icon). */
function navLightIcon(sps: boolean): L.DivIcon {
  return L.divIcon({
    html: `<span class="nav-light ${sps ? "nav-light--sps" : "nav-light--ips"}"></span>`,
    className: "leaflet-nav-light",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}
const SPS_ICON = navLightIcon(true);
const IPS_ICON = navLightIcon(false);

/** IALA Region A cardinal buoy: body bands + double-cone topmark. */
function cardinalSvg(kind: "N" | "E" | "S" | "W"): string {
  const B = "#111827";
  const Y = "#facc15";
  const up = (y: number) =>
    `<path d="M4.5 ${y + 3} 7 ${y} 9.5 ${y + 3}Z" fill="${B}"/>`;
  const down = (y: number) =>
    `<path d="M4.5 ${y} 7 ${y + 3} 9.5 ${y}Z" fill="${B}"/>`;
  const top = {
    N: up(0) + up(3.5),
    S: down(0) + down(3.5),
    E: up(0) + down(3.5),
    W: down(0) + up(3.5),
  }[kind];
  const bands = {
    N: [B, Y, Y],
    S: [Y, Y, B],
    E: [B, Y, B],
    W: [Y, B, Y],
  }[kind];
  const body = bands
    .map(
      (c, i) =>
        `<rect x="4" y="${9 + i * 3.5}" width="6" height="3.6" fill="${c}"/>`,
    )
    .join("");
  return `<svg width="14" height="22" viewBox="0 0 14 22"><path d="M7 7v2" stroke="${B}" stroke-width="1"/>${top}${body}<path d="M2.5 19.5h9" stroke="#94a3b8" stroke-width="1.2"/></svg>`;
}

const CARDINAL_ICONS = Object.fromEntries(
  CARDINAL_MARKS.map((m) => [
    m.id,
    L.divIcon({
      html: `<div class="cardinal-mark">${cardinalSvg(m.kind)}<span>${m.kind} · ${m.light}</span></div>`,
      className: "leaflet-cardinal-mark",
      iconSize: [14, 22],
      iconAnchor: [7, 20],
    }),
  ]),
);

const PERIPHERY = TURBINE_POSITIONS.filter((t) =>
  PERIPHERY_RING.includes(t.id),
);

export const NavAids = memo(function NavAids() {
  return (
    <>
      {PERIPHERY.map((t) => {
        const sps = SPS_TURBINES.includes(t.id);
        return (
          <Marker
            key={`nav-${t.id}`}
            position={[t.lat, t.lon]}
            icon={sps ? SPS_ICON : IPS_ICON}
            zIndexOffset={-500}
          >
            <Tooltip direction="left" offset={[-10, 0]}>
              {t.id} ·{" "}
              {sps
                ? "SPS — yellow Fl, synchronised, ≥ 5 NM"
                : "IPS — yellow Fl, ≥ 2 NM"}{" "}
              (IALA G1162)
            </Tooltip>
          </Marker>
        );
      })}
      {CARDINAL_MARKS.map((m) => (
        <Marker
          key={`card-${m.id}`}
          position={[m.lat, m.lon]}
          icon={CARDINAL_ICONS[m.id]}
          zIndexOffset={-400}
        >
          <Tooltip direction="right" offset={[8, -10]}>
            {m.kind} cardinal mark · IALA Region A · light {m.light} — safe
            water lies to its {m.kind} side
          </Tooltip>
        </Marker>
      ))}
    </>
  );
});

// ── Grid & sea-use context ───────────────────────────────────────

export const GridContext = memo(function GridContext() {
  return (
    <>
      {NEIGHBOUR_OWF_AREAS.map((a) => (
        <Polygon
          key={a.name}
          positions={a.ring}
          pathOptions={{
            color: "#94a3b8",
            weight: 1,
            opacity: 0.5,
            dashArray: "6 4",
            fillColor: "#94a3b8",
            fillOpacity: 0.05,
          }}
        >
          <Tooltip sticky>
            {a.name} · planned OWF area{a.mw ? ` · ${a.mw} MW` : ""} (Polish
            maritime spatial plan, EMODnet)
          </Tooltip>
        </Polygon>
      ))}
      <Polyline
        positions={SWEPOL_GEO}
        pathOptions={{
          color: "#a78bfa",
          weight: 2.2,
          opacity: 0.8,
          dashArray: "10 4 2 4",
        }}
      >
        <Tooltip sticky>
          HVDC SwePol · 450 kV DC · 600 MW · Stärnö (SE) ↔ Słupsk-Wierzbięcino
          (OSM)
        </Tooltip>
      </Polyline>
    </>
  );
});

// ── O&M vessels & repair crews ───────────────────────────────────

/** Weather-window limits, same as backend services/p1/weather_window.py. */
const HS_LIMIT = { CTV: 1.5, SOV: 2.5 } as const;
/** Wind limits [m/s at 10 m], same source. */
const VW_LIMIT = { CTV: 10, SOV: 15 } as const;
/** Service speeds [kn] and the track time compression. */
const SPEED_KN = { CTV: 25, SOV: 12 } as const;
const TIME_X = 20;
const KN = 0.5144; // m/s per knot
/**
 * A component repair (e.g. pitch actuator swap) takes ~4–6 h on site; the
 * demo shows it in 45 s. Routine service calls last 25 / 40 s.
 */
export const REPAIR_MS = 45_000;

type LatLon = [number, number];
type Plan = {
  path: LatLon[];
  state: string;
  dwellS: number;
  /** Turbine the crew works on while dwelling (fault repair). */
  jobId?: string;
  then: (pos: LatLon) => Plan;
};

function distM(a: LatLon, b: LatLon): number {
  return L.latLng(a).distanceTo(b);
}
function bearingDeg(a: LatLon, b: LatLon): number {
  const [la1, lo1, la2, lo2] = [a[0], a[1], b[0], b[1]].map(
    (d) => (d * Math.PI) / 180,
  );
  const y = Math.sin(lo2 - lo1) * Math.cos(la2);
  const x =
    Math.cos(la1) * Math.sin(la2) -
    Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
/** Point ~70 m south-west of a turbine (boat landing side, downwind of SW seas). */
function alongside(id: string): LatLon {
  const t = TURBINE_POSITIONS.find((p) => p.id === id)!;
  return [t.lat - 0.0005, t.lon - 0.0006];
}

function vesselIcon(kind: "SOV" | "CTV", storybook: boolean): L.DivIcon {
  let hull: string;
  if (storybook) {
    const ink = 'stroke="#2b2118" stroke-width="1.1" stroke-linejoin="round"';
    hull =
      kind === "SOV"
        ? // ship: hull, bridge, walk-to-work gangway, crew in orange hats
          `<path d="M12 1 17 8 17 23 7 23 7 8Z" fill="#b5532b" ${ink}/><rect x="9" y="12" width="6" height="6" rx="1" fill="#f1e4c3" ${ink}/><path d="M12 12 12 5" stroke="#2b2118" stroke-width="1.4"/><circle cx="10" cy="20.5" r="1.2" fill="#f59e0b" ${ink}/><circle cx="14" cy="20.5" r="1.2" fill="#f59e0b" ${ink}/>`
        : // catamaran CTV: twin hulls, cabin, two technicians
          `<path d="M8.5 5 10.5 9 10.5 21 7 21 7 9Z" fill="#f1e4c3" ${ink}/><path d="M15.5 5 17 9 17 21 13.5 21 13.5 9Z" fill="#f1e4c3" ${ink}/><rect x="8.5" y="10" width="7" height="7" rx="1.5" fill="#e3b33a" ${ink}/><circle cx="10.5" cy="19" r="1.2" fill="#f59e0b" ${ink}/><circle cx="13.5" cy="19" r="1.2" fill="#f59e0b" ${ink}/>`;
    return L.divIcon({
      html: `<div class="vessel"><svg class="vessel-hull" width="24" height="24" viewBox="0 0 24 24">${hull}</svg><span class="vessel-tag"></span></div>`,
      className: "leaflet-vessel",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }
  hull =
    kind === "SOV"
      ? `<path d="M9 1 13 7v10H5V7Z" fill="#7dd3fc" stroke="#0a0e15" stroke-width="1"/><rect x="7" y="9" width="4" height="4" fill="#0a0e15" opacity="0.5"/>`
      : `<path d="M9 3 12 8v8H6V8Z" fill="#fcd34d" stroke="#0a0e15" stroke-width="1"/>`;
  return L.divIcon({
    html: `<div class="vessel"><svg class="vessel-hull" width="18" height="18" viewBox="0 0 18 18">${hull}</svg><span class="vessel-tag"></span></div>`,
    className: "leaflet-vessel",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/** Too rough for this vessel? (Hs and 10 m wind, P1 weather-window limits) */
function weatherBlocks(kind: "SOV" | "CTV"): boolean {
  const { environment, kpis } = useLandingStore.getState();
  const u10 = kpis.freestreamWindMs * (10 / 150) ** 0.1;
  return (
    environment.significantWaveHeightM > HS_LIMIT[kind] || u10 > VW_LIMIT[kind]
  );
}

/**
 * One vessel: a tiny state machine stepped in rAF. The marker is moved with
 * setLatLng (no React re-render); tag text is written only when it changes.
 * Arriving at a faulted turbine starts a repair job in the store; bad
 * weather makes the crew stop and leave (the fault stays).
 */
function useVessel(
  kind: "SOV" | "CTV",
  label: string,
  plan: (pos: LatLon) => Plan,
  start: LatLon,
) {
  const map = useMap();
  const storybook = useLayerStore((s) => s.mapTheme) === "storybook";
  const markerRef = useRef<L.Marker | null>(null);
  const uiRef = useRef({ lastTag: "", lastHeading: -1 });

  useEffect(() => {
    const marker = L.marker(start, {
      icon: vesselIcon(kind, false),
      zIndexOffset: 1200,
      keyboard: false,
    }).addTo(map);
    markerRef.current = marker;
    marker.bindTooltip("", { direction: "top", offset: [0, -8] });
    let pos: LatLon = start;
    let current = plan(pos);
    let leg = 0;
    let dwell = 0;
    let heading = 0;
    let working = false;
    let last = performance.now();
    let raf = 0;
    const ui = uiRef.current;

    const leave = () => {
      if (working && current.jobId)
        useLandingStore.getState().cancelRepair(current.jobId);
      working = false;
    };

    const speed = SPEED_KN[kind] * KN * TIME_X; // m per wall-clock second
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      const blocked = weatherBlocks(kind);
      // Weather above the vessel limit: CTV heads home, SOV to DP standby.
      if (
        blocked &&
        !current.state.startsWith("weather") &&
        current.state !== "in port"
      ) {
        leave();
        current = plan(pos);
        leg = 0;
        dwell = 0;
      }
      if (leg < current.path.length) {
        const target = current.path[leg];
        const d = distM(pos, target);
        const move = speed * dt;
        if (d <= move) {
          pos = target;
          leg++;
        } else {
          heading = bearingDeg(pos, target);
          const f = move / d;
          pos = [
            pos[0] + (target[0] - pos[0]) * f,
            pos[1] + (target[1] - pos[1]) * f,
          ];
        }
        marker.setLatLng(pos);
      } else {
        if (!working && current.jobId && dwell === 0) {
          const t = useLandingStore.getState().turbineMap[current.jobId];
          if (t?.status === "fault") {
            useLandingStore
              .getState()
              .startRepair(current.jobId, label, current.dwellS * 1000);
            working = true;
          }
        }
        if ((dwell += dt) >= current.dwellS) {
          if (working && current.jobId)
            useLandingStore.getState().completeRepair(current.jobId);
          working = false;
          current = current.then(pos);
          leg = 0;
          dwell = 0;
        }
      }

      const moving = leg < current.path.length;
      const tag = `${label} · ${moving ? "under way" : current.state}`;
      const el = marker.getElement();
      if (el && tag !== ui.lastTag) {
        ui.lastTag = tag;
        const span = el.querySelector(".vessel-tag");
        if (span) span.textContent = tag;
        const { environment } = useLandingStore.getState();
        marker.setTooltipContent(
          `${label} · ${kind === "SOV" ? "Service Operation Vessel (walk-to-work)" : "Crew Transfer Vessel"} · ${SPEED_KN[kind]} kn · ` +
            `limits Hs ≤ ${HS_LIMIT[kind]} m, U10 ≤ ${VW_LIMIT[kind]} m/s (now Hs ${environment.significantWaveHeightM.toFixed(1)} m) · ` +
            `track time ×${TIME_X}, repairs shown in ${REPAIR_MS / 1000} s (simulated)`,
        );
      }
      if (el && Math.abs(heading - ui.lastHeading) > 1) {
        ui.lastHeading = heading;
        el.querySelector<SVGElement>(".vessel-hull")?.style.setProperty(
          "transform",
          `rotate(${heading.toFixed(0)}deg)`,
        );
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      leave();
      marker.remove();
      markerRef.current = null;
    };
    // plan/start are module-level constants for each vessel
  }, [map, kind, label, plan, start]);

  // Theme switch: swap the sprite in place (keeps position and job)
  useEffect(() => {
    markerRef.current?.setIcon(vesselIcon(kind, storybook));
    uiRef.current.lastTag = "";
    uiRef.current.lastHeading = -1;
  }, [kind, storybook]);
}

/**
 * Next job: a turbine with a fault that needs a site visit (and no crew yet),
 * otherwise routine service walking through the array.
 */
let _jobIdx = 0;
function nextJob(): { id: string; repair: boolean } {
  const { turbineMap, repairs } = useLandingStore.getState();
  const fault = Object.values(turbineMap).find(
    (t) =>
      t.status === "fault" &&
      t.faultType &&
      SITE_VISIT_FAULTS.includes(t.faultType) &&
      !repairs[t.id],
  );
  if (fault) return { id: fault.id, repair: true };
  _jobIdx = (_jobIdx + 7) % TURBINE_POSITIONS.length; // stride through strings
  return { id: TURBINE_POSITIONS[_jobIdx].id, repair: false };
}

const PORT: LatLon = [USTKA_PORT_GEO.lat, USTKA_PORT_GEO.lon];
const SOV_STANDBY: LatLon = [55.018, 16.455]; // DP hold near the OSS

/** Back along the CTV route from wherever the boat is, to its berth. */
function routeHome(pos: LatLon): LatLon[] {
  let i = 0;
  CTV_ROUTE_GEO.forEach((p, k) => {
    if (distM(pos, p) < distM(pos, CTV_ROUTE_GEO[i])) i = k;
  });
  return CTV_ROUTE_GEO.slice(0, i + 1).reverse();
}

function ctvPlan(pos: LatLon): Plan {
  const inPort = distM(pos, PORT) < 50;
  if (weatherBlocks("CTV")) {
    return {
      path: inPort ? [] : routeHome(pos),
      state: "in port",
      dwellS: 10,
      then: ctvPlan,
    };
  }
  const job = nextJob();
  return {
    path: [...(inPort ? CTV_ROUTE_GEO.slice(1) : []), alongside(job.id)],
    state: job.repair ? `repair ${job.id}` : `service ${job.id}`,
    dwellS: job.repair ? REPAIR_MS / 1000 : 25,
    jobId: job.repair ? job.id : undefined,
    then: (p) => ({
      path: routeHome(p),
      state: "in port",
      dwellS: 15,
      then: ctvPlan,
    }),
  };
}

function sovPlan(): Plan {
  if (weatherBlocks("SOV")) {
    return {
      path: [SOV_STANDBY],
      state: "weather · DP standby",
      dwellS: 10,
      then: sovPlan,
    };
  }
  const job = nextJob();
  return {
    path: [alongside(job.id)],
    state: job.repair ? `W2W repair ${job.id}` : `W2W service ${job.id}`,
    dwellS: job.repair ? REPAIR_MS / 1000 : 40,
    jobId: job.repair ? job.id : undefined,
    then: sovPlan,
  };
}

export function Vessels() {
  useVessel("SOV", "SOV", sovPlan, SOV_STANDBY);
  useVessel("CTV", "CTV-01", ctvPlan, PORT);
  return null;
}

// ── Technicians at work ──────────────────────────────────────────

/** Technician in hard hat + hi-vis with a swinging wrench (original drawing). */
function technicianSvg(storybook: boolean): string {
  const ink = storybook
    ? 'stroke="#2b2118" stroke-width="1"'
    : 'stroke="#0a0e15" stroke-width="0.8"';
  return `<svg width="18" height="22" viewBox="0 0 18 22">
    <path d="M5.5 7 Q9 2.5 12.5 7 Z" fill="#f59e0b" ${ink}/>
    <circle cx="9" cy="8.6" r="2.6" fill="#f3d9b1" ${ink}/>
    <path d="M5 21 L5.6 12.4 Q9 10.6 12.4 12.4 L13 21 Z" fill="#f97316" ${ink}/>
    <path d="M5.4 15 L12.6 15" stroke="#fde68a" stroke-width="1.2"/>
    <g class="crew-arm"><path d="M12.2 13 L16.4 9.4" stroke="${storybook ? "#2b2118" : "#cbd5e1"}" stroke-width="1.6" stroke-linecap="round"/><circle cx="16.6" cy="9.1" r="1.2" fill="none" ${ink}/></g>
  </svg>`;
}

const FAULT_LABEL: Partial<Record<string, string>> = {
  PITCH_CONTROL_FAULT: "Pitch repair",
  BEARING_OVERTEMP: "Main bearing inspection",
  GENERATOR_WINDING_TEMP: "Generator inspection",
};

const RepairCrew = memo(function RepairCrew({
  turbineId,
  crew,
  startedAt,
  durationMs,
}: { turbineId: string } & RepairJob) {
  const storybook = useLayerStore((s) => s.mapTheme) === "storybook";
  const faultType = useLandingStore((s) => s.turbineMap[turbineId]?.faultType);
  const pos = useFleet().turbines.find((t) => t.id === turbineId);
  const icon = useMemo(() => {
    const elapsed = Date.now() - startedAt;
    const what = (faultType && FAULT_LABEL[faultType]) ?? "Repair";
    return L.divIcon({
      html: `<div class="crew-badge">${technicianSvg(storybook)}${technicianSvg(storybook)}<span class="crew-badge__label">${what} · ${crew}</span><span class="crew-badge__bar"><i style="animation: crew-progress ${durationMs}ms linear forwards; animation-delay: -${elapsed}ms"></i></span></div>`,
      className: "leaflet-crew",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }, [storybook, faultType, crew, startedAt, durationMs]);
  if (!pos) return null;
  return (
    <Marker
      position={[pos.lat, pos.lon]}
      icon={icon}
      interactive={false}
      zIndexOffset={1150}
    />
  );
});

export function RepairCrews() {
  const repairs = useLandingStore((s) => s.repairs);
  return (
    <>
      {Object.entries(repairs).map(([id, job]) => (
        <RepairCrew key={id} turbineId={id} {...job} />
      ))}
    </>
  );
}

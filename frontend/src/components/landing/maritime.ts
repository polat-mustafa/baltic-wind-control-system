/**
 * Sea traffic for the Control Room map — the data and simulations behind the
 * deck.gl layers (all positions sourced, see constants/windFarmLayout):
 *
 *  - useAis        live AIS around the site, real vessels only (backend proxy
 *                  of aisstream.io, needs AISSTREAM_API_KEY); never invented
 *  - useOmVessels  SOV (walk-to-work) + CTV from Port Ustka, limited by the
 *                  simulated sea state with the P1 weather-window limits
 *                  (CTV Hs ≤ 1.5 m, SOV Hs ≤ 2.5 m); track time ×20. Arriving
 *                  at a faulted turbine starts a repair job in the store.
 *  - cardinal marks (IALA Region A) and the technician sprite as SVG icons
 */

import { useEffect, useState } from "react";

import { CTV_ROUTE_GEO, TURBINE_POSITIONS, USTKA_PORT_GEO } from "../../constants/windFarmLayout";
import { distanceM } from "../../lib/arrayCables";
import { request } from "../../services/apiClient";
import { SITE_VISIT_FAULTS, useLandingStore } from "../../store/landingStore";

// ── AIS ──────────────────────────────────────────────────────────

export interface AisVessel {
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

/** ITU-R M.1371 ship type → (label, colour); chart-plotter hues, muted for the dark map. */
export function shipClass(code: number | null): [string, [number, number, number]] {
  if (code === null) return ["unknown type", [138, 155, 176]];
  if (code >= 70 && code <= 79) return ["cargo", [127, 174, 140]];
  if (code >= 80 && code <= 89) return ["tanker", [208, 122, 110]];
  if (code >= 60 && code <= 69) return ["passenger", [127, 176, 216]];
  if (code === 30) return ["fishing", [208, 160, 106]];
  if (code === 31 || code === 32 || code === 52) return ["towing / tug", [111, 184, 192]];
  if (code === 36 || code === 37) return ["sailing / pleasure", [176, 138, 192]];
  if (code >= 50 && code <= 59) return ["special craft", [111, 184, 192]];
  return ["other", [138, 155, 176]];
}

/** Polls GET /api/v1/info/ais every 15 s while `on`; `note` explains an empty layer. */
export function useAis(on: boolean): { vessels: AisVessel[]; note: string | null } {
  const [data, setData] = useState<AisResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!on) return;
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
  }, [on]);
  const note = err
    ? `AIS: ${err}`
    : data && !data.enabled
      ? "AIS off — set AISSTREAM_API_KEY on the backend (free key: aisstream.io)"
      : data && !data.status.connected
        ? `AIS: connecting… ${data.status.error}`
        : data && data.vessels.length === 0
          ? "AIS live — no vessel reports yet (shore-receiver coverage off Słupsk is sparse)"
          : null;
  return { vessels: on ? (data?.vessels ?? []) : [], note: on ? note : null };
}

// ── O&M vessels ──────────────────────────────────────────────────

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
const REPAIR_MS = 45_000;

type LatLon = [number, number];
type Kind = "SOV" | "CTV";
type Plan = {
  path: LatLon[];
  state: string;
  dwellS: number;
  /** Turbine the crew works on while dwelling (fault repair). */
  jobId?: string;
  then: (pos: LatLon) => Plan;
};

function bearingDeg(a: LatLon, b: LatLon): number {
  const [la1, lo1, la2, lo2] = [a[0], a[1], b[0], b[1]].map((d) => (d * Math.PI) / 180);
  const y = Math.sin(lo2 - lo1) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
/** Point ~70 m south-west of a turbine (boat landing side, downwind of SW seas). */
function alongside(id: string): LatLon {
  const t = TURBINE_POSITIONS.find((p) => p.id === id)!;
  return [t.lat - 0.0005, t.lon - 0.0006];
}

/** Too rough for this vessel? (Hs and 10 m wind, P1 weather-window limits) */
function weatherBlocks(kind: Kind): boolean {
  const { environment, kpis } = useLandingStore.getState();
  const u10 = kpis.freestreamWindMs * (10 / 150) ** 0.1;
  return environment.significantWaveHeightM > HS_LIMIT[kind] || u10 > VW_LIMIT[kind];
}

/**
 * Next job: a turbine with a fault that needs a site visit (and no crew yet),
 * otherwise routine service walking through the array.
 */
let _jobIdx = 0;
function nextJob(): { id: string; repair: boolean } {
  const { turbineMap, repairs } = useLandingStore.getState();
  const fault = Object.values(turbineMap).find(
    (t) => t.status === "fault" && t.faultType && SITE_VISIT_FAULTS.includes(t.faultType) && !repairs[t.id],
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
    if (distanceM(pos, p) < distanceM(pos, CTV_ROUTE_GEO[i])) i = k;
  });
  return CTV_ROUTE_GEO.slice(0, i + 1).reverse();
}

function ctvPlan(pos: LatLon): Plan {
  const inPort = distanceM(pos, PORT) < 50;
  if (weatherBlocks("CTV")) return { path: inPort ? [] : routeHome(pos), state: "in port", dwellS: 10, then: ctvPlan };
  const job = nextJob();
  return {
    path: [...(inPort ? CTV_ROUTE_GEO.slice(1) : []), alongside(job.id)],
    state: job.repair ? `repair ${job.id}` : `service ${job.id}`,
    dwellS: job.repair ? REPAIR_MS / 1000 : 25,
    jobId: job.repair ? job.id : undefined,
    then: (p) => ({ path: routeHome(p), state: "in port", dwellS: 15, then: ctvPlan }),
  };
}

function sovPlan(): Plan {
  if (weatherBlocks("SOV")) return { path: [SOV_STANDBY], state: "weather · DP standby", dwellS: 10, then: sovPlan };
  const job = nextJob();
  return {
    path: [alongside(job.id)],
    state: job.repair ? `W2W repair ${job.id}` : `W2W service ${job.id}`,
    dwellS: job.repair ? REPAIR_MS / 1000 : 40,
    jobId: job.repair ? job.id : undefined,
    then: sovPlan,
  };
}

export interface OmVessel {
  kind: Kind;
  label: string;
  /** [lon, lat] */
  position: [number, number];
  /** Course over ground, degrees clockwise from north. */
  heading: number;
  tag: string;
  tooltip: string;
}

/**
 * One vessel: a tiny state machine. Bad weather makes the crew stop and leave
 * (the fault stays); the repair job is cancelled when the layer goes away.
 */
function vesselSim(kind: Kind, label: string, plan: (pos: LatLon) => Plan, start: LatLon) {
  let pos = start;
  let current = plan(pos);
  let leg = 0;
  let dwell = 0;
  let heading = 0;
  let working = false;
  const speed = SPEED_KN[kind] * KN * TIME_X; // m per wall-clock second
  const store = () => useLandingStore.getState();
  const leave = () => {
    if (working && current.jobId) store().cancelRepair(current.jobId);
    working = false;
  };
  return {
    leave,
    step(dt: number) {
      // Weather above the vessel limit: CTV heads home, SOV to DP standby.
      if (weatherBlocks(kind) && !current.state.startsWith("weather") && current.state !== "in port") {
        leave();
        current = plan(pos);
        leg = 0;
        dwell = 0;
      }
      if (leg < current.path.length) {
        const target = current.path[leg];
        const d = distanceM(pos, target);
        const move = speed * dt;
        if (d <= move) {
          pos = target;
          leg++;
        } else {
          heading = bearingDeg(pos, target);
          const f = move / d;
          pos = [pos[0] + (target[0] - pos[0]) * f, pos[1] + (target[1] - pos[1]) * f];
        }
      } else {
        if (!working && current.jobId && dwell === 0 && store().turbineMap[current.jobId]?.status === "fault") {
          store().startRepair(current.jobId, label, current.dwellS * 1000);
          working = true;
        }
        if ((dwell += dt) >= current.dwellS) {
          if (working && current.jobId) store().completeRepair(current.jobId);
          working = false;
          current = current.then(pos);
          leg = 0;
          dwell = 0;
        }
      }
    },
    view(): OmVessel {
      const hs = store().environment.significantWaveHeightM;
      return {
        kind,
        label,
        position: [pos[1], pos[0]],
        heading,
        tag: `${label} · ${leg < current.path.length ? "under way" : current.state}`,
        tooltip:
          `${label} · ${kind === "SOV" ? "Service Operation Vessel (walk-to-work)" : "Crew Transfer Vessel"} · ${SPEED_KN[kind]} kn\n` +
          `limits Hs ≤ ${HS_LIMIT[kind]} m, U10 ≤ ${VW_LIMIT[kind]} m/s (now Hs ${hs.toFixed(1)} m)\n` +
          `track time ×${TIME_X}, repairs shown in ${REPAIR_MS / 1000} s (simulated)`,
      };
    },
  };
}

/** The SOV and CTV-01, stepped every frame and published ~10 times a second. */
export function useOmVessels(on: boolean): OmVessel[] {
  const [vessels, setVessels] = useState<OmVessel[]>([]);
  useEffect(() => {
    if (!on) return setVessels([]);
    const sims = [vesselSim("SOV", "SOV", sovPlan, SOV_STANDBY), vesselSim("CTV", "CTV-01", ctvPlan, PORT)];
    let last = performance.now();
    let published = 0;
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      sims.forEach((s) => s.step(dt));
      if (now - published > 100) {
        published = now;
        setVessels(sims.map((s) => s.view()));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      sims.forEach((s) => s.leave());
    };
  }, [on]);
  return vessels;
}

// ── Icons ────────────────────────────────────────────────────────

/** SVG → deck.gl IconLayer icon definition. */
export function svgIcon(svg: string, width = 48, height = 48, anchorY = height / 2) {
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width, height, anchorY };
}

/** IALA Region A cardinal buoy: body bands + double-cone topmark (anchored at its foot). */
export function cardinalIcon(kind: "N" | "E" | "S" | "W") {
  const B = "#111827";
  const Y = "#e5c84a";
  const up = (y: number) => `<path d="M4.5 ${y + 3} 7 ${y} 9.5 ${y + 3}Z" fill="${B}"/>`;
  const down = (y: number) => `<path d="M4.5 ${y} 7 ${y + 3} 9.5 ${y}Z" fill="${B}"/>`;
  const top = { N: up(0) + up(3.5), S: down(0) + down(3.5), E: up(0) + down(3.5), W: down(0) + up(3.5) }[kind];
  const bands = { N: [B, Y, Y], S: [Y, Y, B], E: [B, Y, B], W: [Y, B, Y] }[kind];
  const body = bands.map((c, i) => `<rect x="4" y="${9 + i * 3.5}" width="6" height="3.6" fill="${c}" stroke="#8a9bb0" stroke-width="0.3"/>`).join("");
  return svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="44" viewBox="0 0 14 22"><path d="M7 7v2" stroke="${B}" stroke-width="1"/>${top}${body}<path d="M2.5 19.5h9" stroke="#8a9bb0" stroke-width="1.2"/></svg>`,
    28,
    44,
    40,
  );
}

/** Vessel top view, bow up (rotated by the layer). */
export function vesselIcon(kind: Kind, storybook: boolean) {
  const ink = storybook ? "#2b2118" : "#0a1520";
  const hull =
    kind === "SOV"
      ? `<path d="M12 1 17 8 17 23 7 23 7 8Z" fill="${storybook ? "#b5532b" : "#a3b6c8"}" stroke="${ink}" stroke-width="1.1" stroke-linejoin="round"/><rect x="9" y="12" width="6" height="6" rx="1" fill="${storybook ? "#f1e4c3" : "#0f1d2b"}"/>`
      : `<path d="M8.5 5 10.5 9 10.5 21 7 21 7 9Z" fill="${storybook ? "#f1e4c3" : "#e5b567"}" stroke="${ink}" stroke-width="1"/><path d="M15.5 5 17 9 17 21 13.5 21 13.5 9Z" fill="${storybook ? "#f1e4c3" : "#e5b567"}" stroke="${ink}" stroke-width="1"/><rect x="8.5" y="10" width="7" height="7" rx="1.5" fill="${storybook ? "#e3b33a" : "#0f1d2b"}" stroke="${ink}" stroke-width="1"/>`;
  return svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">${hull}</svg>`);
}

/** AIS target: a chevron, bow up, tinted by ship type (mask icon). */
export const AIS_ICON = {
  ...svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 14 14"><path d="M7 1 11.5 12.5 7 10 2.5 12.5Z" fill="#fff"/></svg>`),
  mask: true,
};

/** Two technicians in hard hats + hi-vis (original drawing). */
export function crewIcon(storybook: boolean) {
  const ink = storybook ? 'stroke="#2b2118" stroke-width="1"' : 'stroke="#0a1520" stroke-width="0.8"';
  const tech = (x: number) =>
    `<g transform="translate(${x} 0)"><path d="M5.5 7 Q9 2.5 12.5 7 Z" fill="#f0b13e" ${ink}/><circle cx="9" cy="8.6" r="2.6" fill="#f3d9b1" ${ink}/><path d="M5 21 L5.6 12.4 Q9 10.6 12.4 12.4 L13 21 Z" fill="#e39a5b" ${ink}/><path d="M5.4 15 L12.6 15" stroke="#fde68a" stroke-width="1.2"/></g>`;
  return svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="44" viewBox="0 0 32 22">${tech(0)}${tech(13)}</svg>`, 64, 44, 44);
}

export const FAULT_LABEL: Partial<Record<string, string>> = {
  PITCH_CONTROL_FAULT: "Pitch repair",
  BEARING_OVERTEMP: "Main bearing inspection",
  GENERATOR_WINDING_TEMP: "Generator inspection",
};

/**
 * Live grid solution from the backend (pandapower) for the landing farm.
 *
 * The browser owns the farm simulation (wind, wakes, yaw, faults); every
 * POLL_MS it sends the live fleet's turbine powers (SB-510: 34; the own
 * project's farm via the X-Farm header) to POST /grid/live-load-flow and the
 * backend returns P/Q at the PSE connection point, bus voltages, losses and
 * equipment loadings from a Newton-Raphson load flow with STATCOM dispatch.
 * Request/response polling fits this split (the client holds the state);
 * a WebSocket push becomes the right tool once the simulation itself moves
 * to the backend.
 *
 * `result` stays null while the backend is unreachable, so every consumer
 * falls back to its browser estimate and labels it as such.
 */

import { useEffect } from "react";
import { create } from "zustand";

import { runLiveLoadFlow, type LiveLoadFlow } from "../services/gridApi";
import { liveFleet, useFleetStore } from "../lib/fleet";
import { exportCableState, plantNet, reactiveBalance } from "../utils/landingPhysics";
import { useLandingStore } from "./landingStore";

const POLL_MS = 10_000;

interface LiveGridState {
  result: LiveLoadFlow | null;
  error: string | null;
  /** Epoch ms of the last successful solve. */
  at: number | null;
}

export const useLiveGridStore = create<LiveGridState>(() => ({ result: null, error: null, at: null }));

// A solution belongs to one fleet: drop it when the plant changes
useFleetStore.subscribe((s, prev) => {
  if (s.fleet !== prev.fleet) useLiveGridStore.setState({ result: null, at: null });
});

/** WTG powers in fleet order, string by string (the backend's WTG_01 … WTG_n). */
export function farmPowerVector(): number[] {
  const map = useLandingStore.getState().turbineMap;
  return liveFleet().turbines.map((t) => Math.min(15, Math.max(0, map[t.id]?.powerOutputMW ?? 0)));
}

/**
 * STATCOM reactive power [MVAr, generating +] for every consumer (map marker,
 * KPI ribbon, STATCOM panel): pandapower when solved, else the browser's
 * reactive-balance estimate — one number everywhere.
 */
export function useStatcomQ(totalMW: number): { q: number; source: "pandapower" | "estimate" } {
  const grid = useLiveGridStore((s) => s.result);
  return grid?.converged
    ? { q: grid.statcom_q_mvar, source: "pandapower" }
    : { q: reactiveBalance(totalMW).statcomMVAr, source: "estimate" };
}

/** Mount once (LandingPage): polls while the page is open. */
export function useLiveGridPolling(): void {
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const fleet = liveFleet();
      try {
        const result = await runLiveLoadFlow(farmPowerVector());
        if (alive && liveFleet() === fleet) useLiveGridStore.setState({ result, error: null, at: Date.now() });
      } catch (e) {
        if (alive) useLiveGridStore.setState({ result: null, error: e instanceof Error ? e.message : "unreachable" });
      }
    };
    void run();
    const id = setInterval(run, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
}

/** SB-510 iron losses of the 4 × 300 MVA transformers [MW] (backend PFE 60 kW each). */
const NO_LOAD_LOSS_MW = 0.24;
/** SB-510 series losses at rated output [MW]: P2 load flow 10.1 MW total at 510 MW (108 km, reactors at both ends). */
const SERIES_LOSS_AT_RATED_MW = 9.86;

export interface PlantSnapshot {
  /** Sum of the turbine outputs [MW]. */
  genMW: number;
  /** Active power delivered at the PSE 400 kV connection point [MW]. */
  pocMW: number;
  /** Reactive power at the POC [MVAr], generating positive (rule 4). */
  pocMVAr: number;
  lossMW: number;
  /** POC busbar voltage [kV]. */
  pocKV: number;
  statcomMVAr: number;
  reactorsInService: number;
  ossTrafoPct: number;
  onshoreTrafoPct: number;
  exportCablePct: number;
  frequencyHz: number;
  turbinesOnline: number;
  /** "pandapower" when the backend load flow converged, else browser estimate. */
  source: "pandapower" | "estimate";
}

/**
 * One plant state for every SCADA display (overview bar, mimic, SLD): the
 * browser farm simulation for turbines/frequency, the backend load flow for
 * everything downstream of the 66 kV busbar.
 */
export function usePlantSnapshot(): PlantSnapshot {
  const kpis = useLandingStore((s) => s.kpis);
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const grid = useLiveGridStore((s) => s.result);
  const genMW = kpis.totalOutputMW;
  const turbinesOnline = Object.values(turbineMap).filter(
    (t) => t.status === "operating" || t.status === "curtailed",
  ).length;
  const common = { genMW, frequencyHz: kpis.gridFrequencyHz, turbinesOnline };

  if (grid?.converged) {
    return {
      ...common,
      pocMW: grid.poc_p_mw,
      pocMVAr: grid.poc_q_mvar,
      lossMW: grid.total_loss_mw,
      pocKV: grid.v_poc_pu * 400,
      statcomMVAr: grid.statcom_q_mvar,
      reactorsInService: grid.reactors_in_service,
      ossTrafoPct: grid.oss_trafo_loading_pct,
      onshoreTrafoPct: grid.onshore_trafo_loading_pct,
      exportCablePct: grid.export_cable_loading_pct,
      source: "pandapower",
    };
  }
  const net = plantNet();
  const p = Math.min(1, Math.max(0, genMW / net.ratedMW));
  // ponytail: SB-510 losses scaled with capacity (equipment sized ∝ capacity) until the load flow answers
  const scale = net.ratedMW / 510;
  const lossMW = scale * (genMW > 0 ? NO_LOAD_LOSS_MW + SERIES_LOSS_AT_RATED_MW * p * p : NO_LOAD_LOSS_MW);
  const rb = reactiveBalance(genMW);
  return {
    ...common,
    pocMW: Math.max(0, genMW - lossMW),
    pocMVAr: 0,
    lossMW,
    pocKV: 400,
    statcomMVAr: rb.statcomMVAr,
    reactorsInService: rb.reactorsInService,
    ossTrafoPct: (genMW / (2 * net.ossTxMVA)) * 100,
    onshoreTrafoPct: (genMW / (2 * net.onsTxMVA)) * 100,
    exportCablePct: exportCableState(genMW).loadingPct,
    source: "estimate",
  };
}

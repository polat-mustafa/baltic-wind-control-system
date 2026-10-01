/**
 * Live grid solution from the backend (pandapower) for the landing farm.
 *
 * The browser owns the farm simulation (wind, wakes, yaw, faults); every
 * POLL_MS it sends the 34 turbine powers to POST /grid/live-load-flow and the
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
import { reactiveBalance } from "../utils/landingPhysics";
import { useLandingStore } from "./landingStore";

const POLL_MS = 10_000;

interface LiveGridState {
  result: LiveLoadFlow | null;
  error: string | null;
  /** Epoch ms of the last successful solve. */
  at: number | null;
}

export const useLiveGridStore = create<LiveGridState>(() => ({ result: null, error: null, at: null }));

/** 34 WTG powers in WTG-01 … WTG-34 order (the backend's WTG_01 … WTG_34). */
export function farmPowerVector(): number[] {
  const map = useLandingStore.getState().turbineMap;
  return Array.from({ length: 34 }, (_, i) => {
    const p = map[`WTG-${String(i + 1).padStart(2, "0")}`]?.powerOutputMW ?? 0;
    return Math.min(15, Math.max(0, p));
  });
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
      try {
        const result = await runLiveLoadFlow(farmPowerVector());
        if (alive) useLiveGridStore.setState({ result, error: null, at: Date.now() });
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

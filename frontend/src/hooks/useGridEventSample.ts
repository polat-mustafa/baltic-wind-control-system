import { useEffect, useState } from "react";

import { useLandingStore } from "../store/landingStore";
import { sampleAt, type GridSample } from "../utils/gridEvents";

/** Current sample of the running grid event (≈ 15 Hz), or null. */
export function useGridEventSample(): { s: GridSample; tS: number; done: boolean } | null {
  const ev = useLandingStore((st) => st.gridEvent);
  const [, force] = useState(0);
  useEffect(() => {
    if (!ev) return;
    const id = setInterval(() => force((n) => n + 1), 66);
    return () => clearInterval(id);
  }, [ev]);
  if (!ev) return null;
  const tS = (Date.now() - ev.startedAt) / 1000 / ev.slowMo;
  const end = ev.traj[ev.traj.length - 1].t;
  return { s: sampleAt(ev.traj, Math.min(tS, end)), tS, done: tS >= end };
}

/**
 * Ring buffer hook — stores last 20 data points for sparkline rendering.
 *
 * Updates whenever powerOutputMW or windSpeedMs change (every 3s tick).
 * Uses useRef for the buffer so it doesn't cause extra re-renders —
 * the parent already re-renders on each tick via store subscription.
 *
 * Buffer size 20 × 3s tick = ~60 seconds of visible history.
 */

import { useEffect, useRef } from "react";

const BUFFER_SIZE = 20;

interface TurbineHistory {
  powerHistory: number[];
  windHistory: number[];
}

export function useTurbineHistory(
  powerOutputMW: number,
  windSpeedMs: number,
): TurbineHistory {
  const powerBuf = useRef<number[]>([]);
  const windBuf = useRef<number[]>([]);

  useEffect(() => {
    const pb = powerBuf.current;
    pb.push(powerOutputMW);
    if (pb.length > BUFFER_SIZE) pb.shift();

    const wb = windBuf.current;
    wb.push(windSpeedMs);
    if (wb.length > BUFFER_SIZE) wb.shift();
  }, [powerOutputMW, windSpeedMs]);

  return {
    powerHistory: powerBuf.current,
    windHistory: windBuf.current,
  };
}

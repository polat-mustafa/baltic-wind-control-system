/**
 * Cp(λ) mini-plot — compact canvas widget.
 *
 * Plots the Cp–λ curve of the SB-510 rotor (IEA 15 MW) at the current pitch from
 * the official ROSCO performance table (Cp_Ct_Cq.IEA15MW.txt, CCBlade, λ 2–14.5,
 * β 0–30°), fetched once from GET /api/v1/turbine-physics/cp-surface and
 * interpolated bilinearly — the same table the backend simulator uses:
 *   - Cp_max = 0.469 at λ_opt = 9 (ROSCO VS_TSRopt), β = 0°
 *   - Betz dashed line at 16/27 = 0.593
 *   - Red dot = current operating point (λ = ωR/V, Cp) from wind / rpm / pitch
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import { getCpSurface, type CpSurfaceResponse } from "../../../../services/turbinePhysicsApi";
import { useLandingStore, selectTurbine } from "../../../../store/landingStore";
import { ROTOR_RADIUS } from "../model/layout";

interface CpLambdaWidgetProps {
  turbineId: string;
  windMs: number;
  onClose: () => void;
}

let surfaceCache: Promise<CpSurfaceResponse | null> | null = null;
const loadSurface = () => (surfaceCache ??= getCpSurface().catch(() => null));

/** Linear interpolation index + weight of x in an ascending grid (clamped). */
function locate(grid: number[], x: number): [number, number] {
  const v = Math.min(grid[grid.length - 1], Math.max(grid[0], x));
  let i = 0;
  while (i < grid.length - 2 && v > grid[i + 1]) i++;
  return [i, (v - grid[i]) / (grid[i + 1] - grid[i])];
}

/** Bilinear Cp(λ, β) from the table; 0 outside λ ∈ [2, 14.5]. */
function cpAt(s: CpSurfaceResponse, lambda: number, betaDeg: number): number {
  const L = s.tip_speed_ratios;
  if (lambda < L[0] || lambda > L[L.length - 1]) return 0;
  const [i, u] = locate(L, lambda);
  const [j, w] = locate(s.pitch_angles_deg, betaDeg);
  const c = s.cp_matrix; // [β][λ]
  return (
    (1 - u) * (1 - w) * c[j][i] + u * (1 - w) * c[j][i + 1] + (1 - u) * w * c[j + 1][i] + u * w * c[j + 1][i + 1]
  );
}

export function CpLambdaWidget({ turbineId, windMs, onClose }: CpLambdaWidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const turbine = useLandingStore(selectTurbine(turbineId));
  const [surface, setSurface] = useState<CpSurfaceResponse | null>(null);
  useEffect(() => {
    let alive = true;
    loadSurface().then((s) => alive && setSurface(s));
    return () => {
      alive = false;
    };
  }, []);

  const rpm = turbine?.rotorSpeedRpm ?? 0;
  const pitch = turbine?.pitchAngleDeg ?? 0;
  const omega = (rpm * 2 * Math.PI) / 60;
  const tipSpeed = omega * ROTOR_RADIUS;
  const lambda = windMs > 0.5 ? tipSpeed / windMs : 0;
  const cp = surface ? cpAt(surface, lambda, pitch) : 0;

  const curve = useMemo(() => {
    const pts: Array<[number, number]> = [];
    if (!surface) return pts;
    for (let l = 2; l <= 14.5; l += 0.1) pts.push([l, cpAt(surface, l, pitch)]);
    return pts;
  }, [surface, pitch]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const W = cvs.width;
    const H = cvs.height;
    ctx.clearRect(0, 0, W, H);

    const pad = { l: 30, r: 8, t: 10, b: 22 };
    const xMin = 0, xMax = 15;
    const yMin = 0, yMax = 0.6;
    const xToPx = (x: number) => pad.l + ((x - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
    const yToPx = (y: number) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);

    // Axes
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, H - pad.b);
    ctx.lineTo(W - pad.r, H - pad.b);
    ctx.stroke();

    // Ticks & labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px monospace";
    for (let x = 0; x <= 14; x += 2) {
      const px = xToPx(x);
      ctx.beginPath();
      ctx.moveTo(px, H - pad.b);
      ctx.lineTo(px, H - pad.b + 3);
      ctx.stroke();
      ctx.fillText(String(x), px - 4, H - pad.b + 12);
    }
    for (let y = 0; y <= 0.6; y += 0.2) {
      const py = yToPx(y);
      ctx.beginPath();
      ctx.moveTo(pad.l - 3, py);
      ctx.lineTo(pad.l, py);
      ctx.stroke();
      ctx.fillText(y.toFixed(1), 6, py + 3);
    }
    ctx.fillText("λ (tip-speed ratio)", W / 2 - 40, H - 4);
    ctx.save();
    ctx.translate(10, H / 2 + 10);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Cp", 0, 0);
    ctx.restore();

    // Betz limit dashed
    ctx.strokeStyle = "#f59e0b";
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    const betz = yToPx(16 / 27);
    ctx.beginPath();
    ctx.moveTo(pad.l, betz);
    ctx.lineTo(W - pad.r, betz);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("Betz 0.593", W - pad.r - 52, betz - 2);

    // Cp curve
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    curve.forEach(([l, c], i) => {
      const px = xToPx(l);
      const py = yToPx(c);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Operating point
    if (lambda > 0 && cp > 0) {
      const px = xToPx(lambda);
      const py = yToPx(cp);
      ctx.fillStyle = "#ef4444";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [curve, lambda, cp]);

  return (
    <div className="absolute bottom-2 right-2 z-20 bg-bg-secondary/95 backdrop-blur-sm border border-border-primary rounded-md shadow-lg pointer-events-auto">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border-primary">
        <span className="text-[10px] font-semibold text-text-primary">
          Cp(λ) · β = {pitch.toFixed(1)}°
        </span>
        <button onClick={onClose} className="p-0.5 hover:bg-bg-hover rounded" title="Close">
          <X size={11} className="text-text-muted" />
        </button>
      </div>
      <canvas ref={canvasRef} width={220} height={150} className="block" />
      <div className="px-2 pb-1.5 text-[9px] font-mono text-text-muted">
        λ = {lambda.toFixed(2)} · Cp = {cp.toFixed(3)}
      </div>
    </div>
  );
}

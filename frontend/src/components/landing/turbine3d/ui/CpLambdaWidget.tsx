/**
 * Cp(λ) mini-plot — compact canvas widget.
 *
 * Plots the classic Cp–λ curve with:
 *   - Cp_max ≈ 0.48 at λ_opt ≈ 8.1 (V236-like)
 *   - Betz dashed line at 16/27 = 0.593
 *   - Red dot = current operating point (λ, Cp) from wind/rpm
 *
 * We don't hit the backend for every frame — the Cp curve is a reasonable
 * analytical approximation following Heier's exponential form:
 *     Cp(λ, β) = c1·(c2/λ_i − c3·β − c4)·exp(−c5/λ_i) + c6·λ
 *     1/λ_i    = 1/(λ + 0.08β) − 0.035/(β³+1)
 */

import { useMemo, useRef, useEffect } from "react";
import { X } from "lucide-react";

import { useLandingStore, selectTurbine } from "../../../../store/landingStore";

const ROTOR_RADIUS = 118;

interface CpLambdaWidgetProps {
  turbineId: string;
  windMs: number;
  onClose: () => void;
}

function cpHeier(lambda: number, betaDeg: number): number {
  if (lambda <= 0) return 0;
  const beta = betaDeg;
  const invLi = 1 / (lambda + 0.08 * beta) - 0.035 / (beta ** 3 + 1);
  if (invLi <= 0) return 0;
  const c1 = 0.5176, c2 = 116, c3 = 0.4, c4 = 5, c5 = 21, c6 = 0.0068;
  const cp = c1 * (c2 * invLi - c3 * beta - c4) * Math.exp(-c5 * invLi) + c6 * lambda;
  return Math.max(0, cp);
}

export function CpLambdaWidget({ turbineId, windMs, onClose }: CpLambdaWidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const turbine = useLandingStore(selectTurbine(turbineId));

  const rpm = turbine?.rotorSpeedRpm ?? 0;
  const pitch = turbine?.pitchAngleDeg ?? 0;
  const omega = (rpm * 2 * Math.PI) / 60;
  const tipSpeed = omega * ROTOR_RADIUS;
  const lambda = windMs > 0.5 ? tipSpeed / windMs : 0;
  const cp = cpHeier(lambda, pitch);

  const curve = useMemo(() => {
    const pts: Array<[number, number]> = [];
    for (let l = 0.5; l <= 14; l += 0.1) {
      pts.push([l, cpHeier(l, pitch)]);
    }
    return pts;
  }, [pitch]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const W = cvs.width;
    const H = cvs.height;
    ctx.clearRect(0, 0, W, H);

    const pad = { l: 30, r: 8, t: 10, b: 22 };
    const xMin = 0, xMax = 14;
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

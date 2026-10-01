/**
 * The forecast pipeline as a node graph: data → features → three models in
 * parallel → forecast → ensemble. Curved (cubic Bézier) links shaded from
 * the source stage's colour to the target's; particles flow along the links
 * that feed the stage currently running; each node carries a progress ring.
 */

import { memo } from "react";

import type { TrainingStage, TrainingStageKey } from "../../../types/forecast";
import { STAGE_TONE } from "./stages";

const W = 960;
const H = 300;
const NW = 156;
const NH = 66;

const NODES: Record<TrainingStageKey, { x: number; y: number; title: string; sub: string }> = {
  data: { x: 92, y: 150, title: "SCADA data", sub: "34 WTG · 10-min" },
  features: { x: 270, y: 150, title: "Features", sub: "causal · NWP" },
  xgboost: { x: 480, y: 52, title: "XGBoost", sub: "boosted trees" },
  lstm: { x: 480, y: 150, title: "LSTM", sub: "recurrent net" },
  tft: { x: 480, y: 248, title: "TFT", sub: "attention" },
  predict: { x: 690, y: 150, title: "Forecast", sub: "P10 · P50 · P90" },
  ensemble: { x: 868, y: 150, title: "Ensemble", sub: "+ physics" },
};

const EDGES: [TrainingStageKey, TrainingStageKey][] = [
  ["data", "features"],
  ["features", "xgboost"],
  ["features", "lstm"],
  ["features", "tft"],
  ["xgboost", "predict"],
  ["lstm", "predict"],
  ["tft", "predict"],
  ["predict", "ensemble"],
];

function edgePath(a: TrainingStageKey, b: TrainingStageKey) {
  const x1 = NODES[a].x + NW / 2;
  const y1 = NODES[a].y;
  const x2 = NODES[b].x - NW / 2;
  const y2 = NODES[b].y;
  const dx = (x2 - x1) * 0.55;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** SVG arc for a progress ring of radius r, fraction f. */
function arc(cx: number, cy: number, r: number, f: number) {
  const a = Math.min(0.9999, Math.max(0, f)) * 2 * Math.PI;
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x} ${y}`;
}

export const PipelineGraph = memo(function PipelineGraph({ stages }: { stages: TrainingStage[] }) {
  const byKey = new Map(stages.map((s) => [s.key, s]));
  const statusOf = (k: TrainingStageKey) => byKey.get(k)?.status ?? "pending";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Forecast pipeline with live stage status">
      <defs>
        {EDGES.map(([a, b]) => (
          <linearGradient key={`g-${a}-${b}`} id={`g-${a}-${b}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: STAGE_TONE[a] }} />
            <stop offset="1" style={{ stopColor: STAGE_TONE[b] }} />
          </linearGradient>
        ))}
        <filter id="pg-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* links */}
      {EDGES.map(([a, b]) => {
        const d = edgePath(a, b);
        const flowing = statusOf(b) === "running" && statusOf(a) === "done";
        const done = statusOf(b) === "done";
        return (
          <g key={`${a}-${b}`}>
            <path d={d} fill="none" stroke={`url(#g-${a}-${b})`} strokeWidth={done || flowing ? 3.2 : 1.8} strokeOpacity={done || flowing ? 0.95 : 0.35} strokeLinecap="round" />
            {flowing &&
              [0, 0.5, 1].map((delay) => (
                <circle key={delay} r={4} style={{ fill: "var(--color-accent)" }}>
                  <animateMotion dur="1.6s" begin={`${delay}s`} repeatCount="indefinite" path={d} />
                </circle>
              ))}
          </g>
        );
      })}

      {/* nodes */}
      {(Object.keys(NODES) as TrainingStageKey[]).map((k) => {
        const n = NODES[k];
        const st = byKey.get(k);
        const status = st?.status ?? "pending";
        const tone = STAGE_TONE[k];
        const x = n.x - NW / 2;
        const y = n.y - NH / 2;
        return (
          <g key={k} opacity={status === "pending" ? 0.6 : 1}>
            {status === "running" && (
              <rect x={x - 4} y={y - 4} width={NW + 8} height={NH + 8} rx={16} style={{ fill: tone }} opacity={0.45} filter="url(#pg-glow)">
                <animate attributeName="opacity" values="0.15;0.55;0.15" dur="1.8s" repeatCount="indefinite" />
              </rect>
            )}
            <rect x={x} y={y} width={NW} height={NH} rx={12} style={{ fill: "var(--color-bg-primary)", stroke: tone }} strokeWidth={status === "pending" ? 1.2 : 2.2} />
            {/* progress ring */}
            <circle cx={x + 26} cy={n.y} r={15} fill="none" style={{ stroke: "var(--color-border-primary)" }} strokeWidth={3} />
            {status !== "pending" && (
              <path d={arc(x + 26, n.y, 15, status === "done" ? 1 : (st?.fraction ?? 0))} fill="none" style={{ stroke: tone }} strokeWidth={3.5} strokeLinecap="round" />
            )}
            <text x={x + 26} y={n.y + 4} textAnchor="middle" fontSize={status === "done" ? 13 : 9.5} fontWeight={800} style={{ fill: tone }}>
              {status === "done" ? "✓" : status === "running" ? `${Math.round((st?.fraction ?? 0) * 100)}` : "·"}
            </text>
            <text x={x + 50} y={n.y - 6} fontSize={14} fontWeight={800} style={{ fill: "var(--color-text-primary)" }}>
              {n.title}
            </text>
            <text x={x + 50} y={n.y + 11} fontSize={10.5} fontWeight={600} style={{ fill: "var(--color-text-muted)" }}>
              {n.sub}
            </text>
            {st?.detail && status !== "pending" && (
              <text x={n.x} y={y + NH + 14} textAnchor="middle" fontSize={9.5} style={{ fill: "var(--color-text-secondary)" }}>
                {st.detail.length > 44 ? `${st.detail.slice(0, 43)}…` : st.detail}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
});

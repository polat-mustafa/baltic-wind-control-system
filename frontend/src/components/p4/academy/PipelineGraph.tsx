/**
 * The forecast pipeline as an engineering block diagram: data → features →
 * three models in parallel → forecast → ensemble. Each block has a header
 * strip with its stage number and a status LED (grey pending, amber running,
 * green done), ports on both sides and a progress bar; orthogonal connectors
 * with arrowheads carry a marching dash while data flows into a running stage.
 */

import { memo } from "react";

import type { TrainingStage, TrainingStageKey } from "../../../types/forecast";
import { STAGE_TONE } from "./stages";

const W = 980;
const H = 316;
const NW = 168;
const NH = 74;
const HEAD = 18;

const NODES: Record<TrainingStageKey, { x: number; y: number; code: string; title: string; sub: string }> = {
  data: { x: 96, y: 158, code: "S1 · DATA", title: "SCADA data", sub: "reference set · 34 WTG" },
  features: { x: 284, y: 158, code: "S2 · FEATURES", title: "Feature engineering", sub: "causal lags · NWP" },
  xgboost: { x: 500, y: 54, code: "S3 · MODEL", title: "XGBoost", sub: "gradient-boosted trees" },
  lstm: { x: 500, y: 158, code: "S4 · MODEL", title: "LSTM", sub: "recurrent network" },
  tft: { x: 500, y: 262, code: "S5 · MODEL", title: "TFT", sub: "temporal attention" },
  predict: { x: 708, y: 158, code: "S6 · FORECAST", title: "Quantile forecast", sub: "P10 · P50 · P90" },
  ensemble: { x: 890, y: 158, code: "S7 · ENSEMBLE", title: "Ensemble", sub: "skill-weighted + physics" },
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

const LED = { pending: "#6b7280", running: "#f59e0b", done: "#22c55e", error: "#ef4444" } as const;

/** Orthogonal connector with rounded bends: right from a, vertical at mid-x, right into b. */
function edgePath(a: TrainingStageKey, b: TrainingStageKey) {
  const x1 = NODES[a].x + NW / 2 + 4;
  const y1 = NODES[a].y;
  const x2 = NODES[b].x - NW / 2 - 6;
  const y2 = NODES[b].y;
  if (Math.abs(y2 - y1) < 1) return `M ${x1} ${y1} H ${x2}`;
  const mx = (x1 + x2) / 2;
  const r = Math.min(10, Math.abs(y2 - y1) / 2);
  const s = y2 > y1 ? 1 : -1;
  return `M ${x1} ${y1} H ${mx - r} Q ${mx} ${y1} ${mx} ${y1 + s * r} V ${y2 - s * r} Q ${mx} ${y2} ${mx + r} ${y2} H ${x2}`;
}

export const PipelineGraph = memo(function PipelineGraph({ stages }: { stages: TrainingStage[] }) {
  const byKey = new Map(stages.map((s) => [s.key, s]));
  const statusOf = (k: TrainingStageKey) => byKey.get(k)?.status ?? "pending";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Forecast pipeline with live stage status">
      <defs>
        <pattern id="pg-grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" style={{ fill: "var(--color-border-primary)" }} />
        </pattern>
        <marker id="pg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: "var(--color-text-muted)" }} />
        </marker>
        <marker id="pg-arrow-live" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: "var(--color-accent)" }} />
        </marker>
      </defs>
      <rect width={W} height={H} fill="url(#pg-grid)" />

      {/* connectors */}
      {EDGES.map(([a, b]) => {
        const d = edgePath(a, b);
        const flowing = statusOf(b) === "running" && statusOf(a) === "done";
        const done = statusOf(b) === "done";
        return (
          <path
            key={`${a}-${b}`}
            d={d}
            fill="none"
            style={{ stroke: flowing ? "var(--color-accent)" : "var(--color-text-muted)" }}
            strokeWidth={flowing ? 2.2 : done ? 1.8 : 1.2}
            strokeOpacity={flowing || done ? 0.95 : 0.45}
            strokeDasharray={flowing ? "7 5" : done ? undefined : "3 4"}
            markerEnd={flowing ? "url(#pg-arrow-live)" : "url(#pg-arrow)"}
          >
            {flowing && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.7s" repeatCount="indefinite" />}
          </path>
        );
      })}

      {/* blocks */}
      {(Object.keys(NODES) as TrainingStageKey[]).map((k) => {
        const n = NODES[k];
        const st = byKey.get(k);
        const status = (st?.status ?? "pending") as keyof typeof LED;
        const tone = STAGE_TONE[k];
        const x = n.x - NW / 2;
        const y = n.y - NH / 2;
        const frac = status === "done" ? 1 : status === "running" ? (st?.fraction ?? 0) : 0;
        return (
          <g key={k} opacity={status === "pending" ? 0.7 : 1}>
            <rect x={x} y={y} width={NW} height={NH} rx={4} style={{ fill: "var(--color-bg-primary)", stroke: status === "running" ? tone : "var(--color-border-secondary)" }} strokeWidth={status === "running" ? 2 : 1.2} />
            {/* header strip */}
            <path d={`M ${x} ${y + 4} Q ${x} ${y} ${x + 4} ${y} H ${x + NW - 4} Q ${x + NW} ${y} ${x + NW} ${y + 4} V ${y + HEAD} H ${x} Z`} style={{ fill: tone }} opacity={0.22} />
            <text x={x + 8} y={y + 12.5} fontSize={9} fontWeight={700} letterSpacing={0.6} fontFamily="ui-monospace, monospace" style={{ fill: "var(--color-text-secondary)" }}>
              {n.code}
            </text>
            <circle cx={x + NW - 10} cy={y + HEAD / 2} r={4} style={{ fill: LED[status] ?? LED.pending }}>
              {status === "running" && <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />}
            </circle>
            {/* body */}
            <text x={x + 8} y={y + HEAD + 18} fontSize={13} fontWeight={700} style={{ fill: "var(--color-text-primary)" }}>
              {n.title}
            </text>
            <text x={x + 8} y={y + HEAD + 33} fontSize={10} style={{ fill: "var(--color-text-muted)" }}>
              {n.sub}
            </text>
            {/* progress bar */}
            <rect x={x + 8} y={y + NH - 9} width={NW - 16} height={3} rx={1.5} style={{ fill: "var(--color-border-primary)" }} />
            <rect x={x + 8} y={y + NH - 9} width={(NW - 16) * frac} height={3} rx={1.5} style={{ fill: status === "done" ? LED.done : tone }} />
            {/* ports */}
            {k !== "data" && <circle cx={x} cy={n.y} r={3} style={{ fill: "var(--color-bg-primary)", stroke: "var(--color-text-muted)" }} />}
            {k !== "ensemble" && <circle cx={x + NW} cy={n.y} r={3} style={{ fill: "var(--color-bg-primary)", stroke: "var(--color-text-muted)" }} />}
            {st?.detail && status !== "pending" && (
              <text x={n.x} y={y + NH + 13} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" style={{ fill: "var(--color-text-secondary)" }}>
                {st.detail.length > 46 ? `${st.detail.slice(0, 45)}…` : st.detail}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
});

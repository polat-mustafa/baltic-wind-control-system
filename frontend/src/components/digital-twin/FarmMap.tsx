/**
 * Fleet map at true geometry (WGS84 → local km), coloured by turbine state.
 *
 * Normal turbines stay neutral; alert/alarm carry colour and a word in the
 * tooltip; a ring marks turbines with an identified fault (latched even when
 * the fault is not observable at the current wind). Click to open a turbine.
 */

import { useMemo } from "react";

import { useFarmPlan } from "../../hooks/useFarmPlan";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { FAULT_SHORT, STATUS_LABEL } from "./twinFormat";

const KM_PER_DEG_LAT = 110.57;

/** Local km around (lat0, lon0), north up. */
function projector(lat0: number, lon0: number) {
  const kmPerDegLon = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  return (lat: number, lon: number) => ({ x: (lon - lon0) * kmPerDegLon, y: -(lat - lat0) * KM_PER_DEG_LAT });
}

const FILL = {
  normal: "var(--color-bg-elevated)",
  alert: "var(--color-status-warning)",
  alarm: "var(--color-status-alarm)",
} as const;

export default function FarmMap() {
  const analysis = useDigitalTwinStore((s) => s.analysis);
  const selected = useDigitalTwinStore((s) => s.selectedTurbineId);
  const selectTurbine = useDigitalTwinStore((s) => s.selectTurbine);
  const farm = useFarmPlan();

  const geo = useMemo(() => {
    const [lon0, lat0] = farm.oss;
    const project = projector(lat0, lon0);
    // SB-510 keeps its WTG ids; an own project's register row i is the twin's WTG-(i+1)
    const name = (id: string, i: number) => (farm.source === "sb510" ? id : `WTG-${String(i + 1).padStart(2, "0")}`);
    const pts = farm.turbines.map((t, i) => ({ id: name(t.id, i), stringNumber: t.string, ...project(t.lat, t.lon) }));
    const oss = project(lat0, lon0);
    const xs = [...pts.map((p) => p.x), oss.x];
    const ys = [...pts.map((p) => p.y), oss.y];
    const pad = 0.9;
    return {
      pts,
      oss,
      box: {
        x: Math.min(...xs) - pad,
        y: Math.min(...ys) - pad,
        w: Math.max(...xs) - Math.min(...xs) + 2 * pad,
        h: Math.max(...ys) - Math.min(...ys) + 2 * pad + 0.6,
      },
    };
  }, [farm]);

  if (!analysis) return null;
  const byName = new Map(analysis.turbines.map((t) => [t.name, t]));
  const strings = farm.strings.map((_, i) => geo.pts.filter((p) => p.stringNumber === i + 1)).filter((s) => s.length);
  const r = 0.33;

  return (
    <ChartWrapper
      title="Fleet state"
      footer={`${farm.source === "project" ? "Your layout" : "Real layout"} (${farm.strings.length} strings). Ring = fault identified. Click a turbine for its analysis.`}
    >
      <svg
        viewBox={`${geo.box.x} ${geo.box.y} ${geo.box.w} ${geo.box.h}`}
        className="w-full h-auto max-h-[460px]"
        role="img"
        aria-label="Wind farm layout coloured by turbine health state"
      >
        {strings.map((s, i) => (
          <polyline
            key={i}
            points={s.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--color-border-secondary)"
            strokeWidth={0.05}
            strokeDasharray="0.15 0.12"
          />
        ))}
        {strings.map((s, i) => (
          <text
            key={`l${i}`}
            x={s[0].x}
            y={Math.min(...s.map((p) => p.y)) - 0.55}
            textAnchor="middle"
            fontSize={0.26}
            fill="var(--color-text-muted)"
          >
            S{i + 1}
          </text>
        ))}

        <g>
          <rect
            x={geo.oss.x - 0.22}
            y={geo.oss.y - 0.22}
            width={0.44}
            height={0.44}
            fill="var(--color-bg-tertiary)"
            stroke="var(--color-text-secondary)"
            strokeWidth={0.04}
          />
          <text x={geo.oss.x} y={geo.oss.y + 0.55} textAnchor="middle" fontSize={0.24} fill="var(--color-text-muted)">
            OSS
          </text>
        </g>

        {geo.pts.map((p) => {
          const t = byName.get(p.id);
          if (!t) return null;
          const isSel = selected === t.turbine_id;
          const faulty = t.diagnosis?.kind != null;
          const num = p.id.replace("WTG-", "");
          const tip = `${t.name} — ${STATUS_LABEL[t.status]}, HI ${t.health_index.toFixed(0)}${
            faulty && t.diagnosis?.kind ? ` · ${FAULT_SHORT[t.diagnosis.kind]}` : ""
          }`;
          return (
            <g
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={tip}
              onClick={() => selectTurbine(t.turbine_id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") selectTurbine(t.turbine_id);
              }}
              className="cursor-pointer focus:outline-none"
            >
              <title>{tip}</title>
              {faulty && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r + 0.13}
                  fill="none"
                  stroke="var(--color-status-warning)"
                  strokeWidth={0.06}
                />
              )}
              {isSel && (
                <circle cx={p.x} cy={p.y} r={r + 0.25} fill="none" stroke="var(--color-accent)" strokeWidth={0.07} />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={FILL[t.status]}
                stroke="var(--color-text-secondary)"
                strokeWidth={0.035}
              />
              <text
                x={p.x}
                y={p.y + 0.09}
                textAnchor="middle"
                fontSize={0.26}
                fontWeight={600}
                fill={t.status === "normal" ? "var(--color-text-primary)" : "#fff"}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {num}
              </text>
            </g>
          );
        })}

        {/* scale bar 2 km + north arrow */}
        <g transform={`translate(${geo.box.x + 0.4} ${geo.box.y + geo.box.h - 0.35})`}>
          <line x1={0} y1={0} x2={2} y2={0} stroke="var(--color-text-secondary)" strokeWidth={0.05} />
          <line x1={0} y1={-0.1} x2={0} y2={0.1} stroke="var(--color-text-secondary)" strokeWidth={0.05} />
          <line x1={2} y1={-0.1} x2={2} y2={0.1} stroke="var(--color-text-secondary)" strokeWidth={0.05} />
          <text x={1} y={-0.15} textAnchor="middle" fontSize={0.22} fill="var(--color-text-muted)">
            2 km
          </text>
        </g>
        <g transform={`translate(${geo.box.x + geo.box.w - 0.45} ${geo.box.y + 0.55})`}>
          <path d="M0,-0.35 L0.14,0.1 L0,0.02 L-0.14,0.1 Z" fill="var(--color-text-secondary)" />
          <text x={0} y={0.38} textAnchor="middle" fontSize={0.22} fill="var(--color-text-muted)">
            N
          </text>
        </g>
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-text-secondary">
        {(["normal", "alert", "alarm"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden>
              <circle cx="6" cy="6" r="5" fill={FILL[s]} stroke="var(--color-text-secondary)" strokeWidth="1" />
            </svg>
            {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden>
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--color-status-warning)" strokeWidth="1.5" />
          </svg>
          Fault identified
        </span>
      </div>
    </ChartWrapper>
  );
}

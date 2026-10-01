/**
 * Concept map of the forecasting course — like Obsidian's graph view.
 *
 * A small force-directed layout (repulsion between all nodes, springs along
 * links, gentle pull to the centre, damping) runs in requestAnimationFrame
 * until it settles; dragging a node re-heats it. Links are quadratic curves
 * shaded from one concept's colour to the other's; hovering a concept dims
 * everything that is not directly connected; clicking opens its lesson.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { useForecastStore } from "../../../store/forecastStore";
import { CONCEPTS, LINKS, type Lang } from "./academyContent";

const W = 960;
const H = 560;
const GROUP_TONE: Record<string, string> = {
  data: "var(--viz-1)",
  ml: "var(--viz-3)",
  model: "var(--viz-2)",
  eval: "var(--color-accent)",
  ops: "var(--color-status-warning)",
};
const GROUP_LABEL: Record<string, Record<Lang, string>> = {
  data: { en: "data", tr: "veri" },
  ml: { en: "learning", tr: "öğrenme" },
  model: { en: "models", tr: "modeller" },
  eval: { en: "evaluation", tr: "değerlendirme" },
  ops: { en: "grid & operation", tr: "şebeke & işletme" },
};

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default function ConceptMap({ lang }: { lang: Lang }) {
  const openChapter = useForecastStore((s) => s.openChapter);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const [a, b] of LINKS) {
      d.set(a, (d.get(a) ?? 0) + 1);
      d.set(b, (d.get(b) ?? 0) + 1);
    }
    return d;
  }, []);
  const neighbours = useMemo(() => {
    const n = new Map<string, Set<string>>();
    for (const [a, b] of LINKS) {
      if (!n.has(a)) n.set(a, new Set());
      if (!n.has(b)) n.set(b, new Set());
      n.get(a)!.add(b);
      n.get(b)!.add(a);
    }
    return n;
  }, []);
  const pos = useRef<Map<string, P>>(
    new Map(
      CONCEPTS.map((c, i) => {
        const a = (i / CONCEPTS.length) * 2 * Math.PI;
        return [c.id, { x: W / 2 + 220 * Math.cos(a), y: H / 2 + 180 * Math.sin(a), vx: 0, vy: 0 }];
      }),
    ),
  );
  const [, setFrame] = useState(0);
  const heat = useRef(1);
  const drag = useRef<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      const ps = pos.current;
      const ids = [...ps.keys()];
      if (heat.current > 0.004) {
        for (let i = 0; i < ids.length; i++) {
          const a = ps.get(ids[i])!;
          for (let j = i + 1; j < ids.length; j++) {
            const b = ps.get(ids[j])!;
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d2 = Math.max(dx * dx + dy * dy, 400);
            const f = 5200 / d2;
            const d = Math.sqrt(d2);
            a.vx += (f * dx) / d;
            a.vy += (f * dy) / d;
            b.vx -= (f * dx) / d;
            b.vy -= (f * dy) / d;
          }
        }
        for (const [s, t] of LINKS) {
          const a = ps.get(s)!;
          const b = ps.get(t)!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.max(Math.hypot(dx, dy), 1);
          const f = 0.03 * (d - 125);
          a.vx += (f * dx) / d;
          a.vy += (f * dy) / d;
          b.vx -= (f * dx) / d;
          b.vy -= (f * dy) / d;
        }
        let energy = 0;
        for (const id of ids) {
          const p = ps.get(id)!;
          p.vx += (W / 2 - p.x) * 0.0025;
          p.vy += (H / 2 - p.y) * 0.004;
          p.vx *= 0.82;
          p.vy *= 0.82;
          if (id !== drag.current) {
            p.x = Math.max(60, Math.min(W - 60, p.x + p.vx * heat.current));
            p.y = Math.max(30, Math.min(H - 30, p.y + p.vy * heat.current));
          }
          energy += p.vx * p.vx + p.vy * p.vy;
        }
        heat.current = Math.max(0, heat.current * 0.995 - (energy < 2 ? 0.01 : 0));
        setFrame((f) => f + 1);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toSvg = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const lit = (id: string) => !hover || id === hover || neighbours.get(hover)?.has(id);
  const ps = pos.current;

  return (
    <div className="bw-viz rounded-lg border border-border-primary bg-bg-secondary p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-text-primary">
          {lang === "tr" ? "Kavram haritası — bir kavrama tıklayın, dersi açılsın" : "Concept map — click a concept to open its lesson"}
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-text-muted">
          {Object.keys(GROUP_TONE).map((g) => (
            <span key={g} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: GROUP_TONE[g] }} />
              {GROUP_LABEL[g][lang]}
            </span>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="Concept map of the forecasting course"
        onPointerMove={(e) => {
          if (!drag.current) return;
          const p = ps.get(drag.current)!;
          const { x, y } = toSvg(e);
          p.x = x;
          p.y = y;
          heat.current = Math.max(heat.current, 0.6);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <defs>
          <filter id="cm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          {LINKS.map(([a, b]) => {
            const ga = CONCEPTS.find((c) => c.id === a)!.group;
            const gb = CONCEPTS.find((c) => c.id === b)!.group;
            const pa = ps.get(a)!;
            const pb = ps.get(b)!;
            return (
              <linearGradient key={`${a}-${b}`} id={`cm-${a}-${b}`} gradientUnits="userSpaceOnUse" x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}>
                <stop offset="0" style={{ stopColor: GROUP_TONE[ga] }} />
                <stop offset="1" style={{ stopColor: GROUP_TONE[gb] }} />
              </linearGradient>
            );
          })}
        </defs>
        {LINKS.map(([a, b]) => {
          const pa = ps.get(a)!;
          const pb = ps.get(b)!;
          const mx = (pa.x + pb.x) / 2;
          const my = (pa.y + pb.y) / 2;
          const nx = -(pb.y - pa.y) * 0.18;
          const ny = (pb.x - pa.x) * 0.18;
          const on = !hover || a === hover || b === hover;
          return (
            <path
              key={`${a}-${b}`}
              d={`M ${pa.x} ${pa.y} Q ${mx + nx} ${my + ny} ${pb.x} ${pb.y}`}
              fill="none"
              stroke={`url(#cm-${a}-${b})`}
              strokeWidth={on && hover ? 2.6 : 1.5}
              strokeOpacity={on ? 0.75 : 0.08}
              style={{ transition: "stroke-opacity 300ms, stroke-width 300ms" }}
            />
          );
        })}
        {CONCEPTS.map((c) => {
          const p = ps.get(c.id)!;
          const r = 7 + 2.2 * Math.min(6, degree.get(c.id) ?? 1);
          const on = lit(c.id);
          return (
            <g
              key={c.id}
              transform={`translate(${p.x} ${p.y})`}
              style={{ cursor: "pointer", transition: "opacity 300ms", opacity: on ? 1 : 0.18 }}
              onPointerDown={(e) => {
                e.stopPropagation();
                drag.current = c.id;
              }}
              onPointerEnter={() => setHover(c.id)}
              onPointerLeave={() => setHover(null)}
              onClick={() => openChapter(c.chapter)}
            >
              <title>{`${c.label[lang]} — ${lang === "tr" ? "dersi aç" : "open lesson"}`}</title>
              <circle r={r + 6} style={{ fill: GROUP_TONE[c.group] }} opacity={hover === c.id ? 0.55 : 0.22} filter="url(#cm-glow)" />
              <circle r={r} style={{ fill: GROUP_TONE[c.group], stroke: "var(--color-bg-secondary)" }} strokeWidth={2} />
              <text y={r + 14} textAnchor="middle" fontSize={hover === c.id ? 13 : 11.5} fontWeight={hover === c.id ? 800 : 650} style={{ fill: "var(--color-text-primary)", paintOrder: "stroke", stroke: "var(--color-bg-secondary)", strokeWidth: 3 }}>
                {c.label[lang]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

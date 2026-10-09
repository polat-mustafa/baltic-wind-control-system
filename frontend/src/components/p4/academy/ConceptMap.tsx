/**
 * Concept map of the forecasting course — like Obsidian's graph view.
 *
 * A small force-directed layout (repulsion between all nodes, springs along
 * links, gentle pull to the centre, damping) runs in requestAnimationFrame
 * until it settles; dragging a node re-heats it. Links are soft curves that
 * light up (with a moving dash) around the concept in focus. Hover shows a
 * short summary card; click opens the detail panel — summary, related
 * concepts, and the lesson that explains it.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { useForecastStore } from "../../../store/forecastStore";
import { BookOpen, X } from "lucide-react";

import { CHAPTERS, CONCEPT_SUMMARY, CONCEPTS, LINKS, type Lang } from "./academyContent";

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
  const [selected, setSelected] = useState<string | null>(null);
  const focus = hover ?? selected;
  const moved = useRef(false);

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
  const lit = (id: string) => !focus || id === focus || neighbours.get(focus)?.has(id);
  const byId = useMemo(() => new Map(CONCEPTS.map((c) => [c.id, c])), []);
  const ps = pos.current;

  return (
    <div className="bw-viz rounded-lg border border-border-primary bg-bg-secondary p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="relative min-w-0">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-text-primary">
          {lang === "tr" ? "Kavram haritası — üzerine gelin: özet · tıklayın: ayrıntı" : "Concept map — hover for a summary, click for details"}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-text-muted">
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
        onClick={(e) => e.target === e.currentTarget && setSelected(null)}
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
          // soft S-curve: control points a third of the way along, nudged sideways
          const dx = pb.x - pa.x;
          const dy = pb.y - pa.y;
          const k = 0.12;
          const d = `M ${pa.x} ${pa.y} C ${pa.x + dx / 3 - dy * k} ${pa.y + dy / 3 + dx * k}, ${pa.x + (2 * dx) / 3 - dy * k} ${pa.y + (2 * dy) / 3 + dx * k}, ${pb.x} ${pb.y}`;
          const on = !focus || a === focus || b === focus;
          const hot = !!focus && (a === focus || b === focus);
          return (
            <path
              key={`${a}-${b}`}
              d={d}
              fill="none"
              stroke={`url(#cm-${a}-${b})`}
              strokeWidth={hot ? 2.2 : 1.1}
              strokeOpacity={on ? (hot ? 0.95 : 0.45) : 0.06}
              strokeLinecap="round"
              strokeDasharray={hot ? "6 5" : undefined}
              style={{ transition: "stroke-opacity 300ms, stroke-width 300ms" }}
            >
              {hot && <animate attributeName="stroke-dashoffset" from="22" to="0" dur="0.9s" repeatCount="indefinite" />}
            </path>
          );
        })}
        {CONCEPTS.map((c) => {
          const p = ps.get(c.id)!;
          const r = 7 + 2.2 * Math.min(6, degree.get(c.id) ?? 1);
          const on = lit(c.id);
          const isFocus = focus === c.id;
          const label = c.label[lang];
          const lw = label.length * 6.4 + 12;
          return (
            <g
              key={c.id}
              transform={`translate(${p.x} ${p.y})`}
              style={{ cursor: "pointer", transition: "opacity 300ms", opacity: on ? 1 : 0.18 }}
              onPointerDown={(e) => {
                e.stopPropagation();
                drag.current = c.id;
                moved.current = false;
              }}
              onPointerMove={() => {
                if (drag.current === c.id) moved.current = true;
              }}
              onPointerEnter={() => setHover(c.id)}
              onPointerLeave={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (!moved.current) setSelected((v) => (v === c.id ? null : c.id));
              }}
            >
              <circle r={r + 7} style={{ fill: GROUP_TONE[c.group] }} opacity={isFocus ? 0.5 : 0.16} filter="url(#cm-glow)" />
              <circle r={r} style={{ fill: GROUP_TONE[c.group], stroke: selected === c.id ? "var(--color-text-primary)" : "var(--color-bg-secondary)" }} strokeWidth={selected === c.id ? 3 : 2} />
              <rect x={-lw / 2} y={r + 4} width={lw} height={17} rx={8.5} style={{ fill: "var(--color-bg-primary)", stroke: isFocus ? GROUP_TONE[c.group] : "var(--color-border-primary)" }} strokeWidth={1} opacity={0.92} />
              <text y={r + 16} textAnchor="middle" fontSize={isFocus ? 11.5 : 10.5} fontWeight={isFocus ? 800 : 600} style={{ fill: "var(--color-text-primary)" }}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && hover !== selected && <HoverCard id={hover} p={ps.get(hover)!} lang={lang} group={byId.get(hover)!.group} />}
      </div>
      <ConceptPanel id={selected} lang={lang} onSelect={setSelected} onOpen={openChapter} neighbours={neighbours} />
      </div>
    </div>
  );
}

function HoverCard({ id, p, lang, group }: { id: string; p: P; lang: Lang; group: string }) {
  const left = (p.x / W) * 100;
  const top = (p.y / H) * 100;
  const c = CONCEPTS.find((x) => x.id === id)!;
  return (
    <div
      className="pointer-events-none absolute z-10 w-64 rounded-md border border-border-primary bg-bg-primary/95 p-2.5 text-[12px] shadow-lg backdrop-blur"
      style={{ left: `${left}%`, top: `${top}%`, transform: `translate(${left > 60 ? "-105%" : "5%"}, ${top > 60 ? "-105%" : "8%"})` }}
    >
      <div className="mb-0.5 flex items-center gap-1.5 font-semibold text-text-primary">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: GROUP_TONE[group] }} />
        {c.label[lang]}
      </div>
      <p className="leading-snug text-text-secondary">{CONCEPT_SUMMARY[id]?.[lang]}</p>
      <p className="mt-1 text-xs text-text-muted">{lang === "tr" ? "Ayrıntı için tıklayın" : "Click for details"}</p>
    </div>
  );
}

function ConceptPanel({
  id,
  lang,
  onSelect,
  onOpen,
  neighbours,
}: {
  id: string | null;
  lang: Lang;
  onSelect: (id: string | null) => void;
  onOpen: (chapter: string) => void;
  neighbours: Map<string, Set<string>>;
}) {
  const c = id ? CONCEPTS.find((x) => x.id === id) : null;
  if (!c) {
    return (
      <aside className="flex items-center justify-center rounded-md border border-dashed border-border-primary p-4 text-center text-[12px] text-text-muted">
        {lang === "tr"
          ? "Bir kavrama tıklayın: özeti, bağlı kavramları ve onu anlatan ders burada açılır."
          : "Click a concept: its summary, related concepts and the lesson that explains it open here."}
      </aside>
    );
  }
  const chapter = CHAPTERS.find((ch) => ch.id === c.chapter);
  const related = [...(neighbours.get(c.id) ?? [])].map((r) => CONCEPTS.find((x) => x.id === r)).filter((x) => x !== undefined);
  return (
    <aside className="space-y-2.5 rounded-md border border-border-primary bg-bg-primary p-3 text-[12px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-bg-primary" style={{ background: GROUP_TONE[c.group] }}>
            {GROUP_LABEL[c.group][lang]}
          </span>
          <h4 className="mt-1.5 text-base font-semibold text-text-primary">{c.label[lang]}</h4>
        </div>
        <button type="button" onClick={() => onSelect(null)} aria-label="Close" className="text-text-muted hover:text-text-primary">
          <X size={14} />
        </button>
      </div>
      <p className="leading-relaxed text-text-secondary">{CONCEPT_SUMMARY[c.id]?.[lang]}</p>
      {related.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{lang === "tr" ? "Bağlı kavramlar" : "Related concepts"}</div>
          <div className="flex flex-wrap gap-1">
            {related.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelect(r.id)}
                className="rounded-full border border-border-primary px-2 py-0.5 text-xs text-text-secondary hover:border-accent hover:text-text-primary"
              >
                {r.label[lang]}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => onOpen(c.chapter)}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-ink hover:bg-accent-hover"
      >
        <BookOpen size={13} /> {lang === "tr" ? "Dersi aç" : "Open the lesson"}
        {chapter ? `: ${chapter.title[lang]}` : ""}
      </button>
    </aside>
  );
}

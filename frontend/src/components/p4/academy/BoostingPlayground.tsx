/**
 * Gradient boosting you can play with (the idea inside XGBoost), trained in
 * the browser on a toy wind → power problem (academy/boosting.ts).
 *
 * Left: the data, the true V236 power curve and the model after k trees; the
 * thin lines are the residuals the next tree will try to learn. Right: the
 * error on training data vs unseen test data as trees are added — with a big
 * learning rate and deep trees the test error turns up again: over-fitting.
 */

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import { boost, makeData, powerCurve, predictBoosted, treeRules } from "./boosting";

const TRAIN = makeData(120, 11);
const TEST = makeData(120, 23);
const M = 150;
const W = 560;
const H = 290;
const ML = 40;
const MB = 30;
const x = (u: number) => ML + (u / 25) * (W - ML - 10);
const y = (p: number) => 10 + (1 - (p + 1) / 17) * (H - MB - 10);

export default function BoostingPlayground({ lang }: { lang: "en" | "tr" }) {
  const [eta, setEta] = useState(0.3);
  const [depth, setDepth] = useState(2);
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { model, history } = useMemo(() => boost(TRAIN, TEST, M, eta, depth), [eta, depth]);

  // one tree every 110 ms while playing; stops itself at M
  const running = playing && k < M;
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setK((v) => Math.min(M, v + 1)), 110);
    return () => clearTimeout(id);
  }, [running, k]);

  const grid = useMemo(() => Array.from({ length: 251 }, (_, i) => i / 10), []);
  const fit = grid.map((u) => `${u ? "L" : "M"}${x(u).toFixed(1)},${y(predictBoosted(model, u, k)).toFixed(1)}`).join("");
  const truth = grid.map((u) => `${u ? "L" : "M"}${x(u).toFixed(1)},${y(powerCurve(u)).toFixed(1)}`).join("");
  // log scale: the first trees remove most of the error, the interesting
  // part (test error turning up = over-fitting) happens at small values
  const logs = history.flatMap((h) => [Math.log10(Math.max(h.train, 1e-3)), Math.log10(Math.max(h.test, 1e-3))]);
  const lo = Math.min(...logs) - 0.05;
  const hi = Math.max(...logs) + 0.05;
  const hx = (i: number) => 36 + (i / M) * (300 - 46);
  const hy = (v: number) => 18 + (1 - (Math.log10(Math.max(v, 1e-3)) - lo) / (hi - lo)) * (H - MB - 18);
  const line = (key: "train" | "test") => history.map((h, i) => `${i ? "L" : "M"}${hx(i).toFixed(1)},${hy(h[key]).toFixed(1)}`).join("");
  const rules = k > 0 ? treeRules(model.trees[k - 1], eta) : [];
  const t = (en: string, tr: string) => (lang === "tr" ? tr : en);

  return (
    <div className="bw-viz rounded-lg border border-border-primary bg-bg-primary p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            if (k >= M) setK(0);
            setPlaying(!running);
          }}
          className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 font-semibold text-accent-ink hover:bg-accent-hover"
        >
          {running ? <Pause size={13} /> : <Play size={13} />} {running ? t("Pause", "Duraklat") : t("Add trees", "Ağaç ekle")}
        </button>
        <button type="button" onClick={() => (setPlaying(false), setK(0))} className="rounded-md border border-border-primary p-1 hover:bg-bg-hover" aria-label="Reset">
          <RotateCcw size={13} />
        </button>
        <label className="flex items-center gap-1.5">
          {t("trees", "ağaç")}
          <input type="range" min={0} max={M} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-36 accent-accent" />
          <span className="w-8 font-mono font-bold tabular-nums">{k}</span>
        </label>
        <label className="flex items-center gap-1">
          {t("learning rate η", "öğrenme oranı η")}
          <select value={eta} onChange={(e) => setEta(Number(e.target.value))} className="rounded border border-border-primary bg-bg-secondary px-1 py-0.5">
            {[0.05, 0.1, 0.3, 1].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          {t("tree depth", "ağaç derinliği")}
          <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="rounded border border-border-primary bg-bg-secondary px-1 py-0.5">
            {[1, 2, 3, 5].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Boosted model fitting the wind-to-power data">
          {[0, 5, 10, 15].map((p) => (
            <g key={p}>
              <line x1={ML} x2={W - 10} y1={y(p)} y2={y(p)} style={{ stroke: "var(--color-border-primary)" }} strokeOpacity={0.35} />
              <text x={ML - 4} y={y(p) + 3} fontSize={10} textAnchor="end" style={{ fill: "var(--color-text-muted)" }}>{p}</text>
            </g>
          ))}
          {[0, 5, 10, 15, 20, 25].map((u) => (
            <text key={u} x={x(u)} y={H - 14} fontSize={10} textAnchor="middle" style={{ fill: "var(--color-text-muted)" }}>{u}</text>
          ))}
          <text x={W - 10} y={H - 2} fontSize={10} textAnchor="end" style={{ fill: "var(--color-text-muted)" }}>
            {t("wind speed u [m/s]", "rüzgâr hızı u [m/s]")}
          </text>
          <text x={4} y={12} fontSize={10} style={{ fill: "var(--color-text-muted)" }}>P [MW]</text>
          {/* residuals the next tree will learn */}
          {TRAIN.map((s, i) => (
            <line key={`r${i}`} x1={x(s.u)} x2={x(s.u)} y1={y(s.p)} y2={y(predictBoosted(model, s.u, k))} style={{ stroke: "var(--viz-2)" }} strokeOpacity={0.35} />
          ))}
          {TRAIN.map((s, i) => (
            <circle key={i} cx={x(s.u)} cy={y(s.p)} r={2.6} style={{ fill: "var(--color-text-secondary)" }} opacity={0.75} />
          ))}
          <path d={truth} fill="none" style={{ stroke: "var(--color-text-muted)" }} strokeWidth={1.5} strokeDasharray="5 4" />
          <path d={fit} fill="none" style={{ stroke: "var(--viz-2)" }} strokeWidth={2.6} />
          <text x={x(15)} y={y(5.5)} fontSize={11} fontWeight={700} style={{ fill: "var(--viz-2)" }}>
            {k === 0 ? t("start: the mean of all samples", "başlangıç: tüm örneklerin ortalaması") : t(`model after ${k} trees`, `${k} ağaçtan sonra model`)}
          </text>
          <text x={x(15)} y={y(4)} fontSize={10} style={{ fill: "var(--color-text-muted)" }}>
            {t("dashed = true power curve", "kesikli = gerçek güç eğrisi")}
          </text>
        </svg>

        <div className="space-y-2">
          <svg viewBox={`0 0 300 ${H}`} className="w-full" role="img" aria-label="Training and test error as trees are added">
            <text x={36} y={10} fontSize={10.5} fontWeight={700} style={{ fill: "var(--color-text-primary)" }}>
              {t("error (MSE, MW², log scale) vs number of trees", "hata (MSE, MW², log ölçek) — ağaç sayısına göre")}
            </text>
            <path d={line("train")} fill="none" style={{ stroke: "var(--viz-1)" }} strokeWidth={2} />
            <path d={line("test")} fill="none" style={{ stroke: "var(--viz-3)" }} strokeWidth={2} strokeDasharray="5 3" />
            <line x1={hx(k)} x2={hx(k)} y1={14} y2={H - MB} style={{ stroke: "var(--color-text-secondary)" }} />
            <text x={hx(k) + 3} y={30} fontSize={10} style={{ fill: "var(--color-text-secondary)" }}>
              {history[k].train.toFixed(2)} / {history[k].test.toFixed(2)}
            </text>
            <text x={36} y={H - 14} fontSize={10} style={{ fill: "var(--color-text-muted)" }}>0</text>
            <text x={290} y={H - 14} fontSize={10} textAnchor="end" style={{ fill: "var(--color-text-muted)" }}>{M}</text>
            <g fontSize={10.5} fontWeight={600}>
              <line x1={150} x2={170} y1={H - 2} y2={H - 2} style={{ stroke: "var(--viz-1)" }} strokeWidth={2} />
              <text x={174} y={H + 1} style={{ fill: "var(--color-text-secondary)" }}>{t("train", "eğitim")}</text>
              <line x1={210} x2={230} y1={H - 2} y2={H - 2} style={{ stroke: "var(--viz-3)" }} strokeWidth={2} strokeDasharray="5 3" />
              <text x={234} y={H + 1} style={{ fill: "var(--color-text-secondary)" }}>{t("unseen test", "görülmemiş test")}</text>
            </g>
          </svg>
          <div className="rounded border border-border-primary bg-bg-secondary p-2 font-mono text-xs leading-relaxed text-text-secondary">
            <div className="mb-0.5 font-sans text-xs font-semibold text-text-primary">
              {k === 0 ? t("No tree yet", "Henüz ağaç yok") : t(`Tree #${k} (adds η × leaf):`, `Ağaç #${k} (η × yaprak ekler):`)}
            </div>
            {rules.slice(0, 8).map((r) => (
              <div key={r}>{r}</div>
            ))}
            {rules.length > 8 && <div>… {rules.length - 8} more</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

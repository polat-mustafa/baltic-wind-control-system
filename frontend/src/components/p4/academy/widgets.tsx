/**
 * Illustrations for the AI Academy chapters — each is a small, honest
 * computation (no screenshots, no invented "results"):
 *
 *   WhyViz        one day of power vs a forecast vs persistence; imbalance
 *                 energy and its cost at an illustrative imbalance spread
 *   TimeSplitViz  TimeSeriesSplit (expanding window) vs shuffled K-fold
 *   LeakageViz    what the model may know at forecast time; skill before /
 *                 after the fix (the platform's measured numbers)
 *   LSTMCellViz   a one-unit LSTM with fixed weights reading a wind ramp and
 *                 a gust: gate activations and the cell state, step by step
 *   AttentionViz  softmax attention over the last 48 h (recent + same hour
 *                 yesterday + similar wind) — illustrative weights
 *   QuantileViz   pinball loss: the τ-quantile of noisy outcomes
 *   EnsembleViz   this run's model comparison and the horizon weights
 */

import { useEffect, useMemo, useState } from "react";
import { useFleet } from "../../../lib/fleet";

import { useForecastStore } from "../../../store/forecastStore";
import { rng } from "./boosting";
import { PipelineGraph } from "./PipelineGraph";
import type { TrainingStage } from "../../../types/forecast";

type Lang = "en" | "tr";
const tt = (lang: Lang) => (en: string, tr: string) => (lang === "tr" ? tr : en);
const box = "bw-viz rounded-lg border border-border-primary bg-bg-primary p-3";
const ink = { fill: "var(--color-text-primary)" };
const muted = { fill: "var(--color-text-muted)" };
const grid = { stroke: "var(--color-border-primary)", strokeOpacity: 0.35 };

function useTicker(period: number, n: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % n), period);
    return () => clearInterval(id);
  }, [period, n]);
  return i;
}

// ── 1. Why forecast ─────────────────────────────────────────────────

export function WhyViz({ lang }: { lang: Lang }) {
  const farmN = useFleet().turbines.length;
  const t = tt(lang);
  const N = 144; // 10-min steps in a day
  const data = useMemo(() => {
    const r = rng(5);
    const actual = Array.from({ length: N }, (_, i) => {
      const h = i / 6;
      const base = 7 + 5 * Math.sin((h - 5) / 3.8) + (h > 14 && h < 17 ? -(h - 14) * 3.2 : 0) + (h >= 17 ? -9.6 + (h - 17) * 1.5 : 0);
      return Math.min(15, Math.max(0, base + (r() - 0.5) * 1.6));
    });
    const forecast = actual.map((a, i) => Math.min(15, Math.max(0, a + Math.sin(i / 9) * 0.9 + (r() - 0.5) * 1.2)));
    const persistence = actual.map((_, i) => actual[Math.max(0, i - 6)]); // value 1 h ago
    return { actual, forecast, persistence };
  }, []);
  const W = 640;
  const H = 230;
  const x = (i: number) => 40 + (i / (N - 1)) * (W - 50);
  const y = (p: number) => 12 + (1 - p / 16) * (H - 42);
  const path = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const band = (a: number[]) =>
    `${path(a)} ${data.actual.map((_, i) => `L${x(N - 1 - i).toFixed(1)},${y(data.actual[N - 1 - i]).toFixed(1)}`).join(" ")} Z`;
  const price = 30; // €/MWh imbalance spread (illustrative)
  const mwh = (a: number[]) => a.reduce((s, v, i) => s + Math.abs(v - data.actual[i]) / 6, 0);
  const costP = mwh(data.persistence) * price * farmN;
  const costF = mwh(data.forecast) * price * farmN;
  return (
    <div className={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="One day: actual power, forecast and persistence">
        {[0, 5, 10, 15].map((p) => (
          <g key={p}>
            <line x1={40} x2={W - 10} y1={y(p)} y2={y(p)} style={grid} />
            <text x={34} y={y(p) + 3} fontSize={10} textAnchor="end" style={muted}>{p}</text>
          </g>
        ))}
        {[0, 6, 12, 18, 24].map((h) => (
          <text key={h} x={x(h * 6 - (h === 24 ? 1 : 0))} y={H - 14} fontSize={10} textAnchor="middle" style={muted}>{`${h}:00`}</text>
        ))}
        <path d={band(data.persistence)} style={{ fill: "var(--color-status-alarm)" }} opacity={0.12} />
        <path d={band(data.forecast)} style={{ fill: "var(--viz-1)" }} opacity={0.18} />
        <path d={path(data.persistence)} fill="none" style={{ stroke: "var(--color-status-alarm)" }} strokeWidth={1.6} strokeDasharray="5 4" />
        <path d={path(data.forecast)} fill="none" style={{ stroke: "var(--viz-1)" }} strokeWidth={2} />
        <path d={path(data.actual)} fill="none" style={{ stroke: "var(--color-text-primary)" }} strokeWidth={2.2} />
        <g fontSize={10.5} fontWeight={600}>
          <text x={48} y={22} style={ink}>— {t("actual power [MW]", "gerçek güç [MW]")}</text>
          <text x={210} y={22} style={{ fill: "var(--viz-1)" }}>— {t("forecast", "tahmin")}</text>
          <text x={300} y={22} style={{ fill: "var(--color-status-alarm)" }}>┄ {t("persistence (value 1 h ago)", "persistence (1 saat önceki değer)")}</text>
        </g>
        <text x={W - 10} y={H - 2} fontSize={10} textAnchor="end" style={muted}>
          {t("one turbine, one day · shaded = imbalance energy", "bir türbin, bir gün · taralı = dengesizlik enerjisi")}
        </text>
      </svg>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm">
        <div className="rounded-md border border-status-alarm/40 p-2">
          <div className="text-xs text-text-muted">{t(`persistence · farm (${farmN} WTG)`, `persistence · santral (${farmN} WTG)`)}</div>
          <div className="font-mono text-lg font-bold">{Math.round(costP).toLocaleString()} €/day</div>
        </div>
        <div className="rounded-md border border-accent/40 p-2">
          <div className="text-xs text-text-muted">{t("with a forecast", "tahmin ile")}</div>
          <div className="font-mono text-lg font-bold">{Math.round(costF).toLocaleString()} €/day</div>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-text-muted">
        {t(
          `Illustrative: |error| × ${price} €/MWh imbalance spread, scaled to ${farmN} turbines with the same profile.`,
          `Örnek hesap: |hata| × ${price} €/MWh dengesizlik farkı, aynı profil ile ${farmN} türbine ölçeklenmiş.`,
        )}
      </p>
    </div>
  );
}

// ── 2. TimeSeriesSplit ──────────────────────────────────────────────

export function TimeSplitViz({ lang }: { lang: Lang }) {
  const t = tt(lang);
  const active = useTicker(1600, 5);
  const W = 640;
  const blocks = 12;
  const bw = (W - 110) / blocks;
  const r = useMemo(() => rng(3), []);
  const shuffledTest = useMemo(() => [1, 4, 7, 10].map((b) => b + Math.floor(r() * 2) - (b > 10 ? 1 : 0)), [r]);
  return (
    <div className={box}>
      <svg viewBox={`0 0 ${W} 300`} className="w-full" role="img" aria-label="TimeSeriesSplit folds versus shuffled K-fold">
        <text x={0} y={14} fontSize={12} fontWeight={800} style={ink}>TimeSeriesSplit (5 folds) — {t("what we use", "kullandığımız")}</text>
        {[0, 1, 2, 3, 4].map((f) => {
          const trainEnd = 2 + f * 2;
          return (
            <g key={f} transform={`translate(0 ${26 + f * 30})`} opacity={f === active ? 1 : 0.45}>
              <text x={0} y={16} fontSize={11} fontWeight={700} style={ink}>fold {f + 1}</text>
              {Array.from({ length: blocks }, (_, b) => {
                const kind = b < trainEnd ? "train" : b < trainEnd + 2 ? "test" : "unused";
                return (
                  <rect
                    key={b}
                    x={70 + b * bw}
                    y={2}
                    width={bw - 3}
                    height={20}
                    rx={3}
                    style={{ fill: kind === "train" ? "var(--viz-1)" : kind === "test" ? "var(--viz-2)" : "var(--color-bg-tertiary)" }}
                  />
                );
              })}
            </g>
          );
        })}
        <text x={0} y={196} fontSize={12} fontWeight={800} style={{ fill: "var(--color-status-alarm)" }}>
          {t("Shuffled K-fold — wrong for time series", "Karıştırılmış K-fold — zaman serisi için yanlış")}
        </text>
        <g transform="translate(0 206)">
          {Array.from({ length: blocks }, (_, b) => (
            <rect key={b} x={70 + b * bw} y={2} width={bw - 3} height={20} rx={3} style={{ fill: shuffledTest.includes(b) ? "var(--viz-2)" : "var(--viz-1)" }} />
          ))}
          {shuffledTest.map((b) => (
            <path key={b} d={`M ${70 + (b + 1.4) * bw} 34 q ${-bw * 0.6} 22 ${-bw * 1.2} 0`} fill="none" style={{ stroke: "var(--color-status-alarm)" }} strokeWidth={1.5} markerEnd="url(#leak-arrow)" />
          ))}
        </g>
        <defs>
          <marker id="leak-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" style={{ fill: "var(--color-status-alarm)" }} />
          </marker>
        </defs>
        <text x={70} y={282} fontSize={10.5} style={muted}>
          {t(
            "→ time · blue = train · orange = test · red arrows: the future leaks into training",
            "→ zaman · mavi = eğitim · turuncu = test · kırmızı oklar: gelecek eğitime sızıyor",
          )}
        </text>
      </svg>
    </div>
  );
}

// ── 3. Leakage ──────────────────────────────────────────────────────

export function LeakageViz({ lang }: { lang: Lang }) {
  const t = tt(lang);
  const W = 640;
  const cell = (x: number, label: string, sub: string) => (
    <g transform={`translate(${x} 40)`}>
      <rect width={92} height={46} rx={8} style={{ fill: "var(--color-bg-secondary)", stroke: "var(--color-border-primary)" }} />
      <text x={46} y={20} textAnchor="middle" fontSize={12} fontWeight={800} style={ink}>{label}</text>
      <text x={46} y={36} textAnchor="middle" fontSize={10} style={muted}>{sub}</text>
    </g>
  );
  return (
    <div className={box}>
      <svg viewBox={`0 0 ${W} 300`} className="w-full" role="img" aria-label="Which information the model may use at forecast time">
        <text x={0} y={16} fontSize={12} fontWeight={800} style={ink}>{t("What can the model know when it forecasts P(t)?", "Model P(t)'yi tahmin ederken neyi bilebilir?")}</text>
        {cell(20, "t − 2", t("measured", "ölçülmüş"))}
        {cell(130, "t − 1", t("measured", "ölçülmüş"))}
        {cell(300, "t", t("the future", "gelecek"))}
        <line x1={250} x2={250} y1={30} y2={100} style={{ stroke: "var(--color-text-muted)" }} strokeDasharray="4 3" />
        <text x={254} y={34} fontSize={10} style={muted}>{t("forecast time", "tahmin anı")}</text>
        {/* model */}
        <g transform="translate(470 120)">
          <rect width={140} height={50} rx={10} style={{ fill: "var(--color-bg-secondary)", stroke: "var(--color-accent)" }} strokeWidth={2} />
          <text x={70} y={22} textAnchor="middle" fontSize={13} fontWeight={800} style={ink}>{t("model", "model")}</text>
          <text x={70} y={38} textAnchor="middle" fontSize={10} style={muted}>→ P(t)</text>
        </g>
        <path d="M 176 86 C 260 150, 380 150, 470 145" fill="none" style={{ stroke: "var(--color-status-normal)" }} strokeWidth={2.5} />
        <text x={210} y={150} fontSize={10.5} fontWeight={700} style={{ fill: "var(--color-status-normal)" }}>✔ {t("wind, power… at t−1", "t−1'deki rüzgâr, güç…")}</text>
        <path d="M 346 86 C 380 110, 430 120, 470 132" fill="none" style={{ stroke: "var(--color-status-alarm)" }} strokeWidth={2.5} strokeDasharray="6 4" />
        <text x={360} y={104} fontSize={10.5} fontWeight={700} style={{ fill: "var(--color-status-alarm)" }}>✘ {t("measured wind at t (leak)", "t'deki ölçülen rüzgâr (sızıntı)")}</text>
        <path d="M 346 212 C 400 200, 440 175, 470 162" fill="none" style={{ stroke: "var(--viz-1)" }} strokeWidth={2.5} />
        <g transform="translate(300 192)">
          <rect width={92} height={40} rx={8} style={{ fill: "var(--color-bg-secondary)", stroke: "var(--viz-1)" }} />
          <text x={46} y={17} textAnchor="middle" fontSize={11} fontWeight={800} style={ink}>NWP(t)</text>
          <text x={46} y={31} textAnchor="middle" fontSize={9.5} style={muted}>{t("weather forecast", "hava tahmini")}</text>
        </g>
        <text x={400} y={232} fontSize={10.5} fontWeight={700} style={{ fill: "var(--viz-1)" }}>✔ {t("allowed: issued in advance", "izinli: önceden yayımlanır")}</text>
        {/* skill bars */}
        <g transform="translate(20 222)">
          <text x={0} y={0} fontSize={11} fontWeight={800} style={ink}>{t("XGBoost skill vs persistence", "XGBoost skill (persistence'a karşı)")}</text>
          {[
            [t("leaky", "sızıntılı"), 0.996, "var(--color-status-alarm)"],
            [t("causal (fixed)", "nedensel (düzeltilmiş)"), 0.15, "var(--color-status-normal)"],
          ].map(([label, v, c], i) => (
            <g key={String(label)} transform={`translate(0 ${12 + i * 30})`}>
              <rect x={0} y={0} width={150 * (v as number)} height={18} rx={3} style={{ fill: c as string }} />
              <text x={150 * (v as number) + 6} y={13} fontSize={11} fontWeight={700} style={ink}>
                {(v as number).toFixed(v === 0.15 ? 2 : 3)} · {label as string}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

// ── 4. LSTM cell ────────────────────────────────────────────────────

const sig = (z: number) => 1 / (1 + Math.exp(-z));

/** One-unit LSTM with hand-set weights: remembers a slow ramp, ignores a short gust. */
function runLSTM(xs: number[]) {
  let h = 0;
  let c = 0;
  return xs.map((x) => {
    const f = sig(2.5 - 2.2 * Math.abs(x - h)); // forget less when input is consistent with memory
    const i = sig(-1 + 1.6 * x);
    const g = Math.tanh(1.2 * x - 0.3);
    const o = sig(0.5 + 0.8 * x);
    c = f * c + i * g;
    h = o * Math.tanh(c);
    return { x, f, i, g, o, c, h };
  });
}

export function LSTMCellViz({ lang }: { lang: Lang }) {
  const t = tt(lang);
  const N = 48;
  const xs = useMemo(
    () => Array.from({ length: N }, (_, k) => Math.min(1, 0.15 + (k > 10 ? (k - 10) * 0.025 : 0)) + (k >= 30 && k < 33 ? 0.6 : 0)),
    [],
  );
  const steps = useMemo(() => runLSTM(xs.map((v) => Math.min(1.4, v))), [xs]);
  const k = useTicker(260, N);
  const s = steps[k];
  const W = 640;
  const gate = (cx: number, cy: number, name: string, v: number, color: string) => (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={22} style={{ fill: "var(--color-bg-secondary)", stroke: color }} strokeWidth={2} />
      <circle r={22 * v} style={{ fill: color }} opacity={0.35} />
      <text y={-2} textAnchor="middle" fontSize={11} fontWeight={800} style={ink}>{name}</text>
      <text y={12} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" style={ink}>{v.toFixed(2)}</text>
    </g>
  );
  const sx = (i: number) => 30 + (i / (N - 1)) * (W - 50);
  const strip = (key: "x" | "c" | "h", y0: number, scale = 1) =>
    steps.map((p, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${(y0 - (p[key] as number) * 34 * scale).toFixed(1)}`).join("");
  return (
    <div className={box}>
      <svg viewBox={`0 0 ${W} 330`} className="w-full" role="img" aria-label="LSTM cell gates over a wind sequence">
        {/* cell state highway */}
        <path d="M 40 40 L 600 40" style={{ stroke: "var(--viz-1)" }} strokeWidth={6} strokeOpacity={0.35 + 0.4 * Math.min(1, Math.abs(s.c))} />
        <text x={40} y={26} fontSize={11} fontWeight={800} style={{ fill: "var(--viz-1)" }}>
          {t("cell state c — the memory belt", "hücre durumu c — hafıza bandı")} = {s.c.toFixed(2)}
        </text>
        {gate(170, 110, t("forget", "unut"), s.f, "var(--color-status-alarm)")}
        {gate(290, 110, t("input", "giriş"), s.i, "var(--viz-3)")}
        {gate(400, 110, "tanh", (s.g + 1) / 2, "var(--viz-2)")}
        {gate(520, 110, t("output", "çıkış"), s.o, "var(--color-status-warning)")}
        {[170, 290, 400].map((x) => (
          <line key={x} x1={x} x2={x} y1={88} y2={44} style={{ stroke: "var(--color-text-muted)" }} strokeDasharray="3 3" />
        ))}
        <text x={30} y={170} fontSize={10.5} style={muted}>
          c = f·c + i·g · h = o·tanh(c) · {t("each gate σ(·) ∈ [0, 1]", "her kapı σ(·) ∈ [0, 1]")}
        </text>
        {/* time strips */}
        <path d={strip("x", 240)} fill="none" style={{ stroke: "var(--color-text-secondary)" }} strokeWidth={1.8} />
        <path d={strip("c", 300, 0.8)} fill="none" style={{ stroke: "var(--viz-1)" }} strokeWidth={2.2} />
        <line x1={sx(k)} x2={sx(k)} y1={190} y2={318} style={{ stroke: "var(--color-accent)" }} strokeWidth={1.5} />
        <text x={30} y={196} fontSize={10.5} fontWeight={700} style={ink}>{t("input: wind ramp + a 30-min gust", "girdi: rüzgâr rampası + 30 dk'lık hamle")}</text>
        <text x={30} y={256} fontSize={10.5} fontWeight={700} style={{ fill: "var(--viz-1)" }}>{t("memory c: follows the ramp, barely reacts to the gust", "hafıza c: rampayı izler, hamleye zar zor tepki verir")}</text>
      </svg>
    </div>
  );
}

// ── 5. Attention ────────────────────────────────────────────────────

export function AttentionViz({ lang }: { lang: Lang }) {
  const t = tt(lang);
  const N = 48;
  const [now, setNow] = useState(47);
  const wind = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: N + 1 }, (_, h) => 8 + 3 * Math.sin((2 * Math.PI * (h - 4)) / 24) + 1.5 * Math.sin(h / 7) + (r() - 0.5));
  }, []);
  const weights = useMemo(() => {
    const scores = Array.from({ length: now }, (_, j) => {
      const lag = now - j;
      return 2.2 * Math.exp(-lag / 3) + 1.6 * Math.max(0, Math.cos((2 * Math.PI * lag) / 24)) ** 6 - 0.35 * Math.abs(wind[j] - wind[now]);
    });
    const m = Math.max(...scores);
    const e = scores.map((s) => Math.exp((s - m) / 0.45));
    const z = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / z);
  }, [now, wind]);
  const W = 640;
  const x = (j: number) => 30 + (j / N) * (W - 50);
  const wmax = Math.max(...weights);
  return (
    <div className={box}>
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className="font-semibold">{t("forecast hour", "tahmin saati")}</span>
        <input type="range" min={26} max={48} value={now} onChange={(e) => setNow(Number(e.target.value))} className="w-48 accent-accent" />
        <span className="font-mono">t = {now} h</span>
      </div>
      <svg viewBox={`0 0 ${W} 200`} className="w-full" role="img" aria-label="Attention weights over the past 48 hours">
        {weights.map((w, j) => (
          <rect key={j} x={x(j) - 5} y={20} width={10} height={130} style={{ fill: "var(--viz-3)" }} opacity={0.08 + 0.85 * (w / wmax)}>
            <title>{`${now - j} h ago: weight ${(w * 100).toFixed(1)} %`}</title>
          </rect>
        ))}
        <path
          d={wind.slice(0, now + 1).map((v, j) => `${j ? "L" : "M"}${x(j).toFixed(1)},${(150 - (v - 2) * 10).toFixed(1)}`).join("")}
          fill="none"
          style={{ stroke: "var(--color-text-primary)" }}
          strokeWidth={2}
        />
        <circle cx={x(now)} cy={150 - (wind[now] - 2) * 10} r={5} style={{ fill: "var(--color-accent)" }} />
        <text x={x(now)} y={14} textAnchor="end" fontSize={10.5} fontWeight={700} style={{ fill: "var(--color-accent)" }}>{t("now", "şimdi")}</text>
        <text x={30} y={172} fontSize={10.5} style={muted}>
          {t(
            "column brightness = attention weight (softmax, sums to 100 %) · line = wind [m/s] · illustrative weights",
            "sütun parlaklığı = dikkat ağırlığı (softmax, toplam %100) · çizgi = rüzgâr [m/s] · örnek ağırlıklar",
          )}
        </text>
        <text x={30} y={190} fontSize={10.5} style={muted}>
          {t("bright: the last hours and the same hour yesterday", "parlak: son saatler ve dünkü aynı saat")}
        </text>
      </svg>
    </div>
  );
}

// ── 6. Quantiles / pinball ──────────────────────────────────────────

export function QuantileViz({ lang }: { lang: Lang }) {
  const t = tt(lang);
  const [tau, setTau] = useState(0.9);
  const ys = useMemo(() => {
    const r = rng(4);
    // skewed outcomes around a 9 MW forecast (power cannot exceed 15 MW)
    return Array.from({ length: 160 }, () => Math.min(15, Math.max(0, 9 + 2.2 * (r() + r() + r() - 1.5) * (r() < 0.25 ? 2 : 1))));
  }, []);
  const pinball = (q: number) => ys.reduce((s, y) => s + (y >= q ? tau * (y - q) : (1 - tau) * (q - y)), 0) / ys.length;
  const qs = Array.from({ length: 151 }, (_, i) => i / 10);
  const best = qs.reduce((b, q) => (pinball(q) < pinball(b) ? q : b), 0);
  const below = ys.filter((y) => y < best).length / ys.length;
  const W = 640;
  const xv = (v: number) => 40 + (v / 15) * (W - 60);
  const losses = qs.map(pinball);
  const lmax = Math.max(...losses);
  const r = useMemo(() => rng(8), []);
  const jitter = useMemo(() => ys.map(() => r()), [ys, r]);
  return (
    <div className={box}>
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className="font-semibold">τ</span>
        {[0.1, 0.5, 0.9].map((v) => (
          <button key={v} type="button" onClick={() => setTau(v)} className={`rounded-md border px-2 py-0.5 font-semibold ${tau === v ? "border-accent bg-accent text-accent-ink" : "border-border-primary hover:bg-bg-hover"}`}>
            P{Math.round(v * 100)}
          </button>
        ))}
        <span className="ml-auto font-mono">
          q* = {best.toFixed(1)} MW · {(below * 100).toFixed(0)} % {t("of outcomes below", "sonuç altında")}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} 230`} className="w-full" role="img" aria-label="Pinball loss and the learned quantile">
        {ys.map((y, i) => (
          <circle key={i} cx={xv(y)} cy={30 + jitter[i] * 50} r={2.6} style={{ fill: y < best ? "var(--viz-1)" : "var(--viz-2)" }} opacity={0.75} />
        ))}
        <line x1={xv(best)} x2={xv(best)} y1={20} y2={200} style={{ stroke: "var(--color-accent)" }} strokeWidth={2.5} />
        <path d={qs.map((q, i) => `${i ? "L" : "M"}${xv(q).toFixed(1)},${(200 - (losses[i] / lmax) * 100).toFixed(1)}`).join("")} fill="none" style={{ stroke: "var(--color-text-primary)" }} strokeWidth={2} />
        <text x={xv(best) + 6} y={110} fontSize={11} fontWeight={700} style={{ fill: "var(--color-accent)" }}>
          {t("minimum of the pinball loss", "pinball kaybının minimumu")}
        </text>
        {[0, 5, 10, 15].map((v) => (
          <text key={v} x={xv(v)} y={218} textAnchor="middle" fontSize={10} style={muted}>{v} MW</text>
        ))}
        <text x={40} y={14} fontSize={10.5} style={muted}>
          {t(
            `dots = possible outcomes of P(t) · curve = average pinball loss of a guess q · under-forecasting costs ${tau} × error, over-forecasting ${(1 - tau).toFixed(1)} × error`,
            `noktalar = P(t)'nin olası sonuçları · eğri = q tahmininin ortalama pinball kaybı · düşük tahmin ${tau} × hata, yüksek tahmin ${(1 - tau).toFixed(1)} × hata`,
          )}
        </text>
      </svg>
    </div>
  );
}

// ── 7. Ensemble + this run's numbers ────────────────────────────────

const HORIZON_WEIGHTS = [
  ["< 6 h", 0.5, 0.3, 0.2],
  ["6–24 h", 0.2, 0.4, 0.4],
  ["24–48 h", 0.1, 0.3, 0.6],
] as const;

export function EnsembleViz({ lang }: { lang: Lang }) {
  const t = tt(lang);
  const cmp = useForecastStore((s) => s.modelComparison);
  const rows = cmp?.model_metrics ?? [];
  const max = Math.max(1, ...rows.map((m) => m.rmse_mw));
  return (
    <div className={`${box} grid grid-cols-1 gap-4 lg:grid-cols-2`}>
      <div>
        <div className="mb-1 text-sm font-semibold">{t("Base weights by lead time (before skill gating)", "Ufka göre taban ağırlıklar (skill elemesi öncesi)")}</div>
        {HORIZON_WEIGHTS.map(([h, xg, ls, tf]) => (
          <div key={h} className="mb-1.5 flex items-center gap-2 text-xs">
            <span className="w-14 font-mono">{h}</span>
            <div className="flex h-5 flex-1 overflow-hidden rounded">
              <div style={{ width: `${xg * 100}%`, background: "var(--viz-2)" }} title="XGBoost" />
              <div style={{ width: `${ls * 100}%`, background: "var(--viz-1)" }} title="LSTM" />
              <div style={{ width: `${tf * 100}%`, background: "var(--viz-3)" }} title="TFT" />
            </div>
          </div>
        ))}
        <div className="flex gap-3 text-xs text-text-muted">
          <span><span className="mr-1 inline-block h-2 w-2" style={{ background: "var(--viz-2)" }} />XGBoost</span>
          <span><span className="mr-1 inline-block h-2 w-2" style={{ background: "var(--viz-1)" }} />LSTM</span>
          <span><span className="mr-1 inline-block h-2 w-2" style={{ background: "var(--viz-3)" }} />TFT</span>
        </div>
      </div>
      <div>
        <div className="mb-1 text-sm font-semibold">{t("Your last run (out-of-sample)", "Son çalıştırmanız (örneklem dışı)")}</div>
        {rows.length === 0 ? (
          <div className="rounded border border-dashed border-border-primary p-3 text-xs text-text-muted">
            {t("Run a forecast to see RMSE and skill of each model here.", "Her modelin RMSE ve skill değerini burada görmek için bir tahmin çalıştırın.")}
          </div>
        ) : (
          rows.map((m) => (
            <div key={m.model_name} className="mb-1 flex items-center gap-2 text-xs">
              <span className="w-24 truncate font-semibold">{m.model_name}</span>
              <div className="h-3 flex-1 rounded bg-bg-tertiary">
                <div className="h-3 rounded" style={{ width: `${(m.rmse_mw / max) * 100}%`, background: "var(--color-text-secondary)" }} />
              </div>
              <span className="w-36 text-right font-mono tabular-nums">
                {m.rmse_mw.toFixed(2)} MW · SS {m.skill_score.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── 8. Pipeline (static) ────────────────────────────────────────────

const ALL_DONE: TrainingStage[] = (["data", "features", "xgboost", "lstm", "tft", "predict", "ensemble"] as const).map((key) => ({
  key,
  label: key,
  status: "done",
  fraction: 1,
  detail: "",
}));

export function PipelineViz({ lang }: { lang: Lang }) {
  const t = tt(lang);
  const setTab = useForecastStore((s) => s.setTab);
  return (
    <div className={box}>
      <PipelineGraph stages={ALL_DONE} />
      <button type="button" onClick={() => setTab("monitor")} className="mt-2 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover">
        {t("Open the live training monitor →", "Canlı eğitim monitörünü aç →")}
      </button>
    </div>
  );
}

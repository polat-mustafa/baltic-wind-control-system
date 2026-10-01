/**
 * Training monitor — watch the forecast models being built, live.
 *
 * Fed by the backend tracker (services/p4/training_progress) through the
 * ensemble status poll: every stage of the pipeline, the cross-validation
 * fold and epoch each neural network is on, its training / validation loss
 * and an event log. Turns a 30-minute "Running…" into something a student
 * can follow — and shows why the cache matters (seconds instead of minutes).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Clock, Database, Layers, Volume2, VolumeX } from "lucide-react";

import { useForecastStore } from "../../../store/forecastStore";
import type { EpochPoint, FoldResult, TrainingLive, TrainingStage, TrainingStageKey } from "../../../types/forecast";
import { useNarrator, type NarrationLang } from "../../../hooks/useNarrator";
import { PipelineGraph } from "./PipelineGraph";
import { STAGE_TONE, STAGE_WEIGHT } from "./stages";

const SAY: Record<NarrationLang, Record<TrainingStageKey, [string, string]>> = {
  en: {
    data: ["Generating two months of synthetic ten-minute SCADA data and filtering bad samples.", "Data ready."],
    features: ["Building causal features: everything measured is taken one step in the past.", "Features ready."],
    xgboost: ["Training XGBoost: hundreds of small decision trees, each correcting the previous ones.", "XGBoost finished."],
    lstm: ["Training the LSTM neural network. Watch the validation loss fall, epoch by epoch.", "LSTM finished."],
    tft: ["Training the Temporal Fusion Transformer, which learns where to pay attention in the past.", "Transformer finished."],
    predict: ["Forecasting with all three models, including uncertainty bands.", "Forecasts ready."],
    ensemble: ["Combining the models and enforcing the turbine's physical limits.", "Done. The models are cached for a week."],
  },
  tr: {
    data: ["İki aylık sentetik on dakikalık SCADA verisi üretiliyor ve hatalı örnekler ayıklanıyor.", "Veri hazır."],
    features: ["Nedensel özellikler oluşturuluyor: ölçülen her şey bir adım geçmişten alınıyor.", "Özellikler hazır."],
    xgboost: ["XGBoost eğitiliyor: her biri öncekilerin hatasını düzelten yüzlerce küçük karar ağacı.", "XGBoost tamamlandı."],
    lstm: ["LSTM sinir ağı eğitiliyor. Doğrulama kaybının epoch epoch düşüşünü izleyin.", "LSTM tamamlandı."],
    tft: ["Temporal Fusion Transformer eğitiliyor; geçmişte nereye dikkat edeceğini öğreniyor.", "Transformer tamamlandı."],
    predict: ["Üç modelle, belirsizlik bantlarıyla birlikte tahmin yapılıyor.", "Tahminler hazır."],
    ensemble: ["Modeller birleştiriliyor ve türbinin fiziksel sınırları uygulanıyor.", "Bitti. Modeller bir hafta önbellekte."],
  },
};

const CACHED_STAGES: TrainingStage[] = (["data", "features", "xgboost", "lstm", "tft", "predict", "ensemble"] as const).map(
  (key) => ({ key, label: key, status: "done", fraction: 1, detail: "from cache" }),
);

const fmtDuration = (s: number | null | undefined) => {
  if (s === null || s === undefined) return "—";
  const m = Math.floor(s / 60);
  return m >= 1 ? `${m} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`;
};

export default function TrainingMonitor() {
  const live = useForecastStore((s) => s.live);
  const loading = useForecastStore((s) => s.loading);
  const progress = useForecastStore((s) => s.progress);
  const progressMessage = useForecastStore((s) => s.progressMessage);
  const runFullAnalysis = useForecastStore((s) => s.runFullAnalysis);
  const fetchTrainingProgress = useForecastStore((s) => s.fetchTrainingProgress);
  const { supported, speak, stop } = useNarrator();
  const [voice, setVoice] = useState(false);
  const [lang, setLang] = useState<NarrationLang>("en");

  // Outside a run, show the last build (or a build started elsewhere)
  useEffect(() => {
    if (loading) return;
    void fetchTrainingProgress();
    const id = setInterval(() => void fetchTrainingProgress(), 5000);
    return () => clearInterval(id);
  }, [loading, fetchTrainingProgress]);

  // Narrate stage transitions
  const prev = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!live) return;
    for (const st of live.stages) {
      const before = prev.current[st.key];
      if (voice && before && before !== st.status && st.status !== "pending") {
        speak(SAY[lang][st.key][st.status === "running" ? 0 : 1], lang);
      }
      prev.current[st.key] = st.status;
    }
  }, [live, voice, lang, speak]);

  const analysisRun = useForecastStore((s) => s.analysisRun);
  // Models served from the cache (no build since the server started): show
  // the pipeline as complete instead of "pending".
  const fromCache = !live?.active && !live?.last_build_s && analysisRun;
  const stages = fromCache ? CACHED_STAGES : (live?.stages ?? []);
  const status = live?.active ? "training" : loading ? "loading cache" : live?.last_build_s || fromCache ? "cached" : "idle";

  return (
    <div className="bw-viz space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-primary bg-bg-secondary p-4">
        <Activity size={18} className="text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-text-primary">Training monitor</div>
          <div className="text-xs text-text-muted">
            XGBoost + LSTM + TFT · 5-fold TimeSeriesSplit · live from the backend trainers
          </div>
        </div>
        <StatusChip status={status} />
        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <Clock size={13} />
          {live?.active ? (
            <span className="font-mono tabular-nums">
              {fmtDuration(live.elapsed_s)} elapsed · ETA {fmtDuration(live.eta_s)}
            </span>
          ) : (
            <span className="font-mono tabular-nums">last build {fmtDuration(live?.last_build_s)}</span>
          )}
        </div>
        {supported && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (voice) stop();
                setVoice((v) => !v);
              }}
              aria-pressed={voice}
              title="Narrate the training steps"
              className="flex items-center gap-1 rounded-md border border-border-primary px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-bg-hover"
            >
              {voice ? <Volume2 size={13} /> : <VolumeX size={13} />} Narrate
            </button>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as NarrationLang)}
              className="rounded-md border border-border-primary bg-bg-tertiary px-1 py-1 text-xs"
              aria-label="Narration language"
            >
              <option value="en">EN</option>
              <option value="tr">TR</option>
            </select>
          </div>
        )}
      </div>

      {/* Overall progress, one segment per stage */}
      <SegmentedProgress live={live} loading={loading} progress={progress} message={progressMessage} />

      {/* Pipeline */}
      <div className="rounded-lg border border-border-primary bg-bg-secondary p-3">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Layers size={15} /> Pipeline
          <span className="text-xs font-normal text-text-muted">
            data flows left → right · the three models train in parallel · cyan particles = active stage
          </span>
        </div>
        <PipelineGraph stages={stages} />
      </div>

      {/* Live learning curves */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <LossChart title="LSTM — loss per epoch (MSE, normalised)" points={live?.curves.lstm ?? []} tone="var(--viz-1)" />
        <LossChart title="TFT — loss per epoch (pinball, normalised)" points={live?.curves.tft ?? []} tone="var(--viz-3)" />
        <FoldChart folds={live?.folds ?? {}} />
      </div>

      {/* Log + why */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <LogConsole log={live?.log ?? []} />
        <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 text-sm text-text-secondary">
          <div className="mb-2 flex items-center gap-2 font-semibold text-text-primary">
            <Database size={15} /> Why a training monitor?
          </div>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Training 3 models × 5 cross-validation folds (≤ 100 epochs each) takes about half an hour on a CPU server. A
              bar that only says "Running…" for 30 minutes looks broken.
            </li>
            <li>
              The <b>loss curves</b> show learning as it happens: falling = the model is improving; flat = converged; rising
              validation loss = over-fitting, which early stopping cuts off (patience 10 epochs).
            </li>
            <li>
              <b>Fold RMSE</b> comes from data the model never saw, always later in time than its training data — the honest
              test of a forecast.
            </li>
            <li>
              The finished models are <b>cached for a week</b>: the next "Run" takes seconds. That is why the first run is
              slow and the second is not.
            </li>
          </ul>
          {!loading && (
            <button
              type="button"
              onClick={() => void runFullAnalysis()}
              className="mt-3 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
            >
              Run forecast
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "training"
      ? "border-status-warning text-status-warning"
      : status === "cached"
        ? "border-status-normal text-status-normal"
        : "border-border-primary text-text-muted";
  return (
    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${tone}`}>
      {status === "training" && <span className="h-2 w-2 animate-pulse rounded-full bg-current" />}
      {status}
    </span>
  );
}

function SegmentedProgress({
  live,
  loading,
  progress,
  message,
}: {
  live: TrainingLive | null;
  loading: boolean;
  progress: number;
  message: string;
}) {
  const stages: TrainingStage[] = live?.stages ?? [];
  const total = Object.values(STAGE_WEIGHT).reduce((a, b) => a + b, 0);
  const pct = live?.active ? Math.round(live.overall * 100) : loading ? progress : live?.last_build_s ? 100 : 0;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-text-primary">{loading || live?.active ? message || "Training…" : "Ready"}</span>
        <span className="font-mono text-lg font-bold tabular-nums text-text-primary">{pct} %</span>
      </div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-bg-tertiary">
        {(stages.length ? stages : (Object.keys(STAGE_WEIGHT) as TrainingStageKey[]).map((key) => ({ key, fraction: 0 }))).map(
          (st) => (
            <div
              key={st.key}
              className="relative h-full bg-bg-primary/40"
              style={{ width: `${(STAGE_WEIGHT[st.key] / total) * 100}%` }}
              title={st.key}
            >
              <div
                className="h-full transition-all duration-700 ease-out"
                style={{ width: `${(live?.active || !loading ? st.fraction : 0) * 100}%`, background: STAGE_TONE[st.key] }}
              />
            </div>
          ),
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-text-muted">
        {(Object.keys(STAGE_WEIGHT) as TrainingStageKey[]).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: STAGE_TONE[k] }} />
            {k} · {Math.round((STAGE_WEIGHT[k] / total) * 100)} % of the time
          </span>
        ))}
      </div>
    </div>
  );
}

const CW = 360;
const CH = 170;
const ML = 40;
const MB = 22;

/** Train (dashed) and validation (solid) loss over all epochs, fold by fold. */
function LossChart({ title, points, tone }: { title: string; points: EpochPoint[]; tone: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const max = Math.max(...points.flatMap((p) => [p.train, p.val])) * 1.05;
    const x = (i: number) => ML + (i / (points.length - 1)) * (CW - ML - 8);
    const y = (v: number) => 8 + (1 - v / max) * (CH - MB - 8);
    const line = (k: "train" | "val") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
    const foldStarts = points.map((p, i) => (i > 0 && p.fold !== points[i - 1].fold ? i : -1)).filter((i) => i > 0);
    return { max, x, y, train: line("train"), val: line("val"), foldStarts };
  }, [points]);
  const cur = hover !== null ? points[hover] : points.at(-1);
  return (
    <figure className="rounded-lg border border-border-primary bg-bg-secondary p-3">
      <figcaption className="mb-1 flex justify-between text-sm font-semibold text-text-primary">
        <span>{title}</span>
        {cur && (
          <span className="font-mono text-xs font-normal tabular-nums text-text-secondary">
            fold {cur.fold + 1} · ep {cur.epoch} · val {cur.val.toFixed(4)}
          </span>
        )}
      </figcaption>
      {geo ? (
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          className="w-full"
          onMouseMove={(e) => {
            const b = e.currentTarget.getBoundingClientRect();
            const i = Math.round((((e.clientX - b.left) / b.width) * CW - ML) / ((CW - ML - 8) / (points.length - 1)));
            setHover(i >= 0 && i < points.length ? i : null);
          }}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`${title}: ${points.length} epochs`}
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={ML} x2={CW - 8} y1={geo.y(f * geo.max)} y2={geo.y(f * geo.max)} style={{ stroke: "var(--color-border-primary)" }} strokeOpacity={0.35} />
              <text x={ML - 4} y={geo.y(f * geo.max) + 3} fontSize={9} textAnchor="end" style={{ fill: "var(--color-text-muted)" }}>
                {(f * geo.max).toFixed(2)}
              </text>
            </g>
          ))}
          {geo.foldStarts.map((i) => (
            <line key={i} x1={geo.x(i)} x2={geo.x(i)} y1={8} y2={CH - MB} style={{ stroke: "var(--color-text-muted)" }} strokeDasharray="2 3" strokeWidth={0.8} />
          ))}
          <path d={geo.train} fill="none" style={{ stroke: tone }} strokeWidth={1.4} strokeDasharray="4 3" opacity={0.7} />
          <path d={geo.val} fill="none" style={{ stroke: tone }} strokeWidth={2} />
          {hover !== null && <line x1={geo.x(hover)} x2={geo.x(hover)} y1={8} y2={CH - MB} style={{ stroke: "var(--color-text-secondary)" }} />}
          <text x={ML} y={CH - 6} fontSize={9.5} style={{ fill: "var(--color-text-muted)" }}>
            epochs (folds separated by dotted lines) · solid = validation · dashed = training
          </text>
        </svg>
      ) : (
        <EmptyChart text="Appears while the network trains (or after a fresh build)." />
      )}
    </figure>
  );
}

/** Out-of-sample RMSE per fold for the three models. */
function FoldChart({ folds }: { folds: Partial<Record<"xgboost" | "lstm" | "tft", FoldResult[]>> }) {
  const models = (["xgboost", "lstm", "tft"] as const).filter((m) => folds[m]?.length);
  const max = Math.max(1, ...models.flatMap((m) => folds[m]!.map((f) => f.rmse_mw))) * 1.1;
  const nFold = 5;
  const gw = (CW - ML - 8) / nFold;
  const bw = gw / 4;
  const y = (v: number) => 8 + (1 - v / max) * (CH - MB - 8);
  const tone = { xgboost: "var(--viz-2)", lstm: "var(--viz-1)", tft: "var(--viz-3)" };
  return (
    <figure className="rounded-lg border border-border-primary bg-bg-secondary p-3">
      <figcaption className="mb-1 flex justify-between text-sm font-semibold text-text-primary">
        <span>Out-of-sample RMSE per fold [MW]</span>
        <span className="flex gap-2 text-[11px] font-normal text-text-muted">
          {(["xgboost", "lstm", "tft"] as const).map((m) => (
            <span key={m} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: tone[m] }} />
              {m}
            </span>
          ))}
        </span>
      </figcaption>
      {models.length ? (
        <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" role="img" aria-label="RMSE per cross-validation fold">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={ML} x2={CW - 8} y1={y(f * max)} y2={y(f * max)} style={{ stroke: "var(--color-border-primary)" }} strokeOpacity={0.35} />
              <text x={ML - 4} y={y(f * max) + 3} fontSize={9} textAnchor="end" style={{ fill: "var(--color-text-muted)" }}>
                {(f * max).toFixed(1)}
              </text>
            </g>
          ))}
          {(["xgboost", "lstm", "tft"] as const).map((m, mi) =>
            (folds[m] ?? []).map((f) => (
              <rect
                key={`${m}${f.fold}`}
                x={ML + f.fold * gw + bw * (mi + 0.5)}
                y={y(f.rmse_mw)}
                width={bw - 2}
                height={CH - MB - y(f.rmse_mw)}
                rx={2}
                style={{ fill: tone[m] }}
              >
                <title>{`${m} fold ${f.fold + 1}: ${f.rmse_mw.toFixed(3)} MW${f.epochs ? ` (${f.epochs} epochs)` : ""}`}</title>
              </rect>
            )),
          )}
          {Array.from({ length: nFold }, (_, i) => (
            <text key={i} x={ML + (i + 0.5) * gw} y={CH - 6} fontSize={9.5} textAnchor="middle" style={{ fill: "var(--color-text-muted)" }}>
              fold {i + 1}
            </text>
          ))}
        </svg>
      ) : (
        <EmptyChart text="Each fold tests on a later, unseen month — bars appear as folds finish." />
      )}
    </figure>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-[150px] items-center justify-center rounded border border-dashed border-border-primary px-4 text-center text-xs text-text-muted">
      {text}
    </div>
  );
}

function LogConsole({ log }: { log: { t: number; msg: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight; // follow the newest line
  }, [log.length]);
  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary p-3">
      <div className="mb-1 text-sm font-semibold text-text-primary">Event log</div>
      <div ref={ref} className="h-48 overflow-y-auto rounded bg-bg-primary p-2 font-mono text-[11.5px] leading-relaxed text-text-secondary">
        {log.length === 0 ? (
          <span className="text-text-muted">No build has run since the server started — the models may come from the cache.</span>
        ) : (
          log.map((l, i) => (
            <div key={i}>
              <span className="text-text-muted">[{fmtDuration(l.t).padStart(9, " ")}]</span> {l.msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

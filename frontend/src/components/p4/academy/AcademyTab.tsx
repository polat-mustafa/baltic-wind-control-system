/**
 * AI Academy — the forecasting course next to the live models.
 *
 * Eleven chapters from "why forecast" to the full pipeline, each with an
 * interactive illustration computed in the browser, key take-aways and
 * narration (Web Speech API) in the app language (header EN/TR). The concept map and the
 * training monitor link into it, so theory and the running system stay one.
 */

import { lazy, Suspense, useEffect } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Lightbulb, Square, Volume2 } from "lucide-react";

import { useForecastStore } from "../../../store/forecastStore";
import { useNarrator } from "../../../hooks/useNarrator";
import { useLangStore } from "../../../lib/i18n";
import { cn } from "../../../lib/utils";
import { CHAPTERS, type Lang, type Widget } from "./academyContent";
import BoostingPlayground from "./BoostingPlayground";
import { AttentionViz, EnsembleViz, LeakageViz, LSTMCellViz, PipelineViz, QuantileViz, TimeSplitViz, WhyViz } from "./widgets";

// three.js scene only when its chapter opens
const GradientDescent3D = lazy(() => import("./GradientDescent3D"));

function WidgetView({ widget, lang }: { widget: Widget; lang: Lang }) {
  switch (widget) {
    case "why":
      return <WhyViz lang={lang} />;
    case "descent3d":
      return (
        <Suspense fallback={<div className="h-[340px] animate-pulse rounded-lg bg-bg-tertiary" />}>
          <GradientDescent3D lang={lang} />
        </Suspense>
      );
    case "boosting":
      return <BoostingPlayground lang={lang} />;
    case "timesplit":
      return <TimeSplitViz lang={lang} />;
    case "leakage":
      return <LeakageViz lang={lang} />;
    case "lstm":
      return <LSTMCellViz lang={lang} />;
    case "attention":
      return <AttentionViz lang={lang} />;
    case "quantile":
      return <QuantileViz lang={lang} />;
    case "ensemble":
      return <EnsembleViz lang={lang} />;
    case "pipeline":
      return <PipelineViz lang={lang} />;
    default:
      return null;
  }
}

export default function AcademyTab() {
  const chapterId = useForecastStore((s) => s.chapter);
  const openChapter = useForecastStore((s) => s.openChapter);
  // Chapters carry their own English and Turkish text: they follow the app language
  // (English for any other), not the DOM translator.
  const appLang = useLangStore((s) => s.lang);
  const lang: Lang = appLang === "tr" ? "tr" : "en";
  const { supported, speaking, speak, stop } = useNarrator();
  const idx = Math.max(0, CHAPTERS.findIndex((c) => c.id === chapterId));
  const ch = CHAPTERS[idx];

  // stop talking when the chapter changes
  useEffect(() => stop(), [chapterId, stop]);

  const narration = [ch.title[lang], ch.lead[lang], ...ch.body.map((b) => b[lang]), ...ch.takeaways.map((k) => k[lang])].join(" ");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      {/* Chapter list */}
      <nav className="rounded-lg border border-border-primary bg-bg-secondary p-2" aria-label="Academy chapters">
        <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-sm font-semibold text-text-primary">
          <BookOpen size={15} /> AI Academy
        </div>
        <ol className="space-y-0.5">
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => openChapter(c.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                  c.id === ch.id ? "bg-accent/15 font-semibold text-text-primary" : "text-text-secondary hover:bg-bg-hover",
                )}
                aria-current={c.id === ch.id ? "page" : undefined}
              >
                <span className="mt-0.5 w-5 shrink-0 font-mono text-xs text-text-muted">{c.n}</span>
                <span>{c.title[lang]}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* Chapter */}
      <article className="space-y-4 rounded-lg border border-border-primary bg-bg-secondary p-5">
        <header className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">
              {lang === "tr" ? "Bölüm" : "Chapter"} {ch.n} / {CHAPTERS.length}
            </div>
            <h3 className="mt-0.5 text-xl font-semibold text-text-primary">{ch.title[lang]}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {supported && (
              <button
                type="button"
                onClick={() => (speaking ? stop() : speak(narration, lang))}
                className="flex items-center gap-1.5 rounded-md border border-border-primary px-2.5 py-1 text-xs font-semibold hover:bg-bg-hover"
                title={lang === "tr" ? "Bölümü sesli dinle" : "Listen to this chapter"}
              >
                {speaking ? <Square size={12} /> : <Volume2 size={13} />}
                {speaking ? (lang === "tr" ? "Durdur" : "Stop") : lang === "tr" ? "Dinle" : "Listen"}
              </button>
            )}
          </div>
        </header>

        <p className="text-[15px] font-medium leading-relaxed text-text-primary">{ch.lead[lang]}</p>
        {ch.body.map((b, i) => (
          <p key={i} className="text-sm leading-relaxed text-text-secondary">
            {b[lang]}
          </p>
        ))}

        <WidgetView widget={ch.widget} lang={lang} />

        <aside className="rounded-lg border border-accent/40 bg-accent/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
            <Lightbulb size={14} /> {lang === "tr" ? "Akılda kalsın" : "Key take-aways"}
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-text-secondary">
            {ch.takeaways.map((k, i) => (
              <li key={i}>{k[lang]}</li>
            ))}
          </ul>
        </aside>

        <footer className="flex justify-between">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => openChapter(CHAPTERS[idx - 1].id)}
            className="flex items-center gap-1 rounded-md border border-border-primary px-3 py-1.5 text-xs font-semibold hover:bg-bg-hover disabled:opacity-40"
          >
            <ChevronLeft size={14} /> {idx > 0 ? CHAPTERS[idx - 1].title[lang] : ""}
          </button>
          <button
            type="button"
            disabled={idx === CHAPTERS.length - 1}
            onClick={() => openChapter(CHAPTERS[idx + 1].id)}
            className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-40"
          >
            {idx < CHAPTERS.length - 1 ? CHAPTERS[idx + 1].title[lang] : ""} <ChevronRight size={14} />
          </button>
        </footer>
      </article>
    </div>
  );
}

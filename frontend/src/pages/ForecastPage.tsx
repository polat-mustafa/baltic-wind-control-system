/**
 * AI Forecasting page — route /forecast.
 *
 * Three views of one forecasting system, all on real data:
 *   Day-ahead (real data)  measured Baltic offshore output forecast from the previous day's
 *                          NWP: XGBoost, LSTM, TFT, ensemble vs persistence, climatology,
 *                          a physics-only power curve and the TSO's own forecast
 *   AI Academy             the course: from "why forecast" to XGBoost, LSTM, TFT,
 *                          with interactive illustrations and narration (EN/TR)
 *   Concept map            how the ideas connect; click → lesson
 */

import { BookOpen, Brain, Database, Network } from "lucide-react";

import AcademyTab from "../components/p4/academy/AcademyTab";
import ConceptMap from "../components/p4/academy/ConceptMap";
import RealDataPanel from "../components/p4/RealDataPanel";
import { useForecastStore, type ForecastTab } from "../store/forecastStore";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import { useLangStore } from "../lib/i18n";
import { p4Guide } from "../constants/trainingGuideContent";
import { PageHeader } from "../components/layout/PageHeader";

const TABS: { id: ForecastTab; label: string; Icon: typeof Brain }[] = [
  { id: "real", label: "Day-ahead (real data)", Icon: Database },
  { id: "academy", label: "AI Academy", Icon: BookOpen },
  { id: "map", label: "Concept map", Icon: Network },
];

export default function ForecastPage() {
  const tab = useForecastStore((s) => s.tab);
  const setTab = useForecastStore((s) => s.setTab);
  const lang = useLangStore((s) => (s.lang === "tr" ? "tr" : "en"));

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Forecasting"
        description="Day-ahead wind power forecasts trained and scored on measured Baltic offshore output (Energinet DK2, 977 MW, or one farm from ENTSO-E) with the ECMWF / ICON forecasts issued the day before — no synthetic data."
        meta="XGBoost + LSTM + TFT · 5-fold TimeSeriesSplit · CRPS, reliability, skill vs persistence, climatology and the TSO"
        actions={<TrainingGuide guide={p4Guide} />}
      />

      <div className="flex flex-wrap gap-1 border-b border-border-primary" role="tablist" aria-label="Forecast views" data-tour="page-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tab === id ? "border-accent text-text-primary" : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "real" && <RealDataPanel />}
      {/* The course carries its own English and Turkish text: the DOM translator leaves it alone */}
      {(tab === "academy" || tab === "map") && (
        <div translate="no" lang={lang}>
          {tab === "academy" ? <AcademyTab /> : <ConceptMap lang={lang} />}
        </div>
      )}
    </div>
  );
}

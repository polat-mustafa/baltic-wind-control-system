/**
 * Header "Tour" button: lists every tour by lifecycle stage, marks the
 * completed ones and starts the chosen tour.
 */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Compass } from "lucide-react";

import { useTourStore } from "./tourStore";
import { TOURS } from "./tours";
import type { TourStage } from "./types";

const STAGES: TourStage[] = ["Start", "Develop", "Design", "Build & Commission", "Operate", "Decommission", "Learn"];

export default function TourMenu() {
  const [open, setOpen] = useState(false);
  const completed = useTourStore((s) => s.progress.completed);
  const start = useTourStore((s) => s.start);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-tour="tour-button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Guided tours"
        className="flex items-center gap-1.5 rounded-md border border-border-primary bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover"
      >
        <Compass size={13} />
        <span className="hidden sm:inline">Tour</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Guided tours"
          className="absolute right-0 top-full mt-1 w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-border-primary bg-bg-secondary p-1.5 shadow-2xl"
          style={{ zIndex: 2100 }}
        >
          <p className="px-2 pb-1 pt-0.5 text-xs text-text-muted">
            {completed.length} of {TOURS.length} tours completed
          </p>
          {STAGES.map((stage) => {
            const tours = TOURS.filter((t) => t.stage === stage);
            if (tours.length === 0) return null;
            return (
              <div key={stage} className="py-1">
                <div className="px-2 pb-0.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {stage}
                </div>
                {tours.map((t) => {
                  const done = completed.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        start(t.id);
                      }}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-bg-hover"
                    >
                      {done ? (
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-status-normal" aria-label="Completed" />
                      ) : (
                        <Circle size={14} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
                      )}
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-text-primary">{t.title}</span>
                        <span className="block text-xs text-text-muted">{t.summary}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

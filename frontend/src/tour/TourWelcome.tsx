/**
 * First-visit dialog: offer the control-room tour. "Later" hides it for
 * this browser session, "Don't show again" for good (the header Tour menu
 * stays available either way).
 */

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Compass } from "lucide-react";

import { useTourStore } from "./tourStore";

/** Small animated turbine for the dialog header (static with reduced motion). */
function TurbineMark({ spin }: { spin: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
      <path d="M30.5 30 L29 60 H35 L33.5 30 Z" fill="var(--color-text-muted)" />
      <motion.g
        style={{ originX: "32px", originY: "26px" }}
        animate={spin ? { rotate: 360 } : undefined}
        transition={spin ? { repeat: Infinity, duration: 6, ease: "linear" } : undefined}
      >
        {[0, 120, 240].map((a) => (
          <path
            key={a}
            d="M32 26 C30 18 30.5 8 32 2 C33.5 8 34 18 32 26 Z"
            fill="var(--color-accent)"
            transform={`rotate(${a} 32 26)`}
          />
        ))}
      </motion.g>
      <circle cx="32" cy="26" r="3" fill="var(--color-text-primary)" />
    </svg>
  );
}

export default function TourWelcome() {
  const open = useTourStore((s) => s.welcomeOpen && s.activeTourId === null);
  const start = useTourStore((s) => s.start);
  const dismiss = useTourStore((s) => s.dismissWelcome);
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    startRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-3" style={{ zIndex: 10000 }}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-xl border border-border-primary bg-bg-secondary p-5 text-text-primary shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <TurbineMark spin={!reduced} />
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              Welcome to OffshoreForge
            </h2>
            <p className="text-xs text-text-muted">Offshore wind engineering, from site to operation</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-text-secondary">
          Would you like a short guided tour? It takes about three minutes and shows you the control room, how to
          open a turbine, and where each stage of a wind farm's life lives in the app.
        </p>
        <ul className="mt-3 space-y-1 text-[13px] text-text-secondary">
          <li>· Spotlights and arrows point at each part of the screen.</li>
          <li>· Some steps ask you to try something yourself.</li>
          <li>· "Watch out" notes flag the mistakes engineers make in practice.</li>
        </ul>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="rounded-md px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary"
          >
            Don't show again
          </button>
          <button
            type="button"
            onClick={() => dismiss(false)}
            className="rounded-md border border-border-primary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover"
          >
            Later
          </button>
          <button
            ref={startRef}
            type="button"
            onClick={() => start("control-room")}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
          >
            <Compass size={14} /> Start the tour
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/**
 * After the welcome / first tour: work on the SB-510 reference case study or
 * on an own project (store/modeStore.ts). Shown until a choice is made; the
 * header project menu switches later.
 */

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { BookOpen, FolderPlus } from "lucide-react";

import { switchMode } from "../../lib/project/library";
import { useModeStore } from "../../store/modeStore";
import { useTourStore } from "../../tour/tourStore";

export default function ProjectChooser() {
  const unset = useModeStore((s) => s.mode === null);
  const idle = useTourStore((s) => !s.welcomeOpen && s.activeTourId === null);
  const open = unset && idle;
  const navigate = useNavigate();
  const titleId = useId();
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const card = "flex w-full items-start gap-3 rounded-lg border border-border-primary bg-bg-tertiary p-3 text-left hover:border-accent hover:bg-bg-hover";
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-3" style={{ zIndex: 10000 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-border-primary bg-bg-secondary p-5 text-text-primary shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          How do you want to work?
        </h2>
        <p className="mt-1 text-xs text-text-muted">You can switch at any time from the project menu in the header.</p>
        <div className="mt-4 space-y-2">
          <button ref={firstRef} type="button" className={card} onClick={() => switchMode("reference")}>
            <BookOpen size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>
              <span className="block text-sm font-semibold">Explore SB-510</span>
              <span className="block text-[12px] text-text-secondary">
                The reference case study, a fictional 510 MW farm on the real Baltic site 44.E.1 (permit: PGE, 2023). Every module is open and filled.
              </span>
            </span>
          </button>
          <button
            type="button"
            className={card}
            onClick={() => {
              switchMode("own");
              navigate("/develop");
            }}
          >
            <FolderPlus size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>
              <span className="block text-sm font-semibold">Build my own project</span>
              <span className="block text-[12px] text-text-secondary">
                Start from an empty sea: pick a site, get the permit, lay out the farm. Each module opens when the stage before it is
                done.
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

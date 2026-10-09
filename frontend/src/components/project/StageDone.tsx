/** Own project: mark a lifecycle stage complete, which opens the next modules (lib/project/progress.ts). */

import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { useLandingStore } from "../../store/landingStore";
import { useLifecycleStore, type Milestone } from "../../store/lifecycleStore";
import { useModeStore } from "../../store/modeStore";
import { Button } from "../ui/Button";

interface Props {
  milestone: Milestone;
  /** Stage name, e.g. "Construction". */
  title: string;
  /** What has to be done before the stage can be marked; null = ready. */
  need: string | null;
  next: { path: string; label: string };
}

export function StageDone({ milestone, title, need, next }: Props) {
  const own = useModeStore((s) => s.mode === "own");
  const done = useLifecycleStore((s) => s.done.includes(milestone));
  const complete = useLifecycleStore((s) => s.complete);
  if (!own) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-[12px]">
      {done ? (
        <>
          <span className="flex items-center gap-1.5 text-status-normal">
            <CheckCircle2 size={14} aria-hidden /> {title} complete in your project — {next.label} is open.
          </span>
          <Link to={next.path} className="flex items-center gap-1 text-accent underline">
            Go to {next.label} <ArrowRight size={13} aria-hidden />
          </Link>
        </>
      ) : (
        <>
          <span className="text-text-secondary">{need ?? `Your project: mark ${title.toLowerCase()} complete to open ${next.label}.`}</span>
          <Button
            size="sm"
            onClick={() => {
              complete(milestone);
              // Commissioning done: the plant is energised — the Commissioning page replays it from the grid down
              if (milestone === "commissioning") useLandingStore.getState().playEnergisation();
            }}
            disabled={need !== null}
          >
            Mark {title.toLowerCase()} complete
          </Button>
        </>
      )}
    </div>
  );
}

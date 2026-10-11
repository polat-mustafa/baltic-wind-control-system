/**
 * "Start here" for a first visit: one line under the Control Room header pointing at what
 * already exists — the control-room tour, the Academy's first track and the Develop stage.
 * It disappears once the learner has finished a tour or opened a lesson (no new course
 * system: learner paths were left out on purpose).
 */

import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

import { useAcademyStore } from "../../store/academyStore";
import { useTourStore } from "../../tour/tourStore";

export default function StartHereStrip() {
  const toursDone = useTourStore((s) => s.progress.completed.length);
  const start = useTourStore((s) => s.start);
  const academy = useAcademyStore((s) => s.lessons.length + s.attempts.length);
  if (toursDone > 0 || academy > 0) return null;
  return (
    <div
      data-tour="start-here"
      className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-accent/40 bg-accent-muted/40 px-3 py-1.5 text-[12px] text-text-primary"
    >
      <Compass size={14} className="text-accent" aria-hidden />
      <span className="font-semibold">New here?</span>
      <button type="button" onClick={() => start("control-room")} className="font-semibold text-accent underline">
        Take the control-room tour
      </button>
      <span className="text-text-muted">·</span>
      <Link to="/academy" className="text-accent underline">
        Start the Academy (Develop track)
      </Link>
      <span className="text-text-muted">·</span>
      <Link to="/develop" className="text-accent underline">
        Plan your own farm
      </Link>
    </div>
  );
}

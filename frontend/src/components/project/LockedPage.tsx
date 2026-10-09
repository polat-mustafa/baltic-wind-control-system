/** Shown instead of a module the learner's own project has not reached yet (lib/project/progress.ts). */

import { Link } from "react-router-dom";
import { ArrowRight, Lock as LockIcon } from "lucide-react";

import type { Lock } from "../../lib/project/progress";
import { confirmReference, switchMode } from "../../lib/project/library";
import { Button } from "../ui/Button";

export function LockedPage({ title, lock }: { title: string; lock: Lock }) {
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-xl border border-border-primary bg-bg-secondary p-5 sm:mt-12" role="status">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
        <LockIcon size={18} className="text-text-muted" aria-hidden /> {title} is locked in your project
      </h2>
      <p className="mt-2 text-sm text-text-secondary">Each stage opens when the one before it is done, as in a real project.</p>
      <p className="mt-3 rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary">
        <span className="font-semibold">First:</span> {lock.need}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          to={lock.go}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-accent px-3 text-xs font-medium text-accent-ink hover:bg-accent-hover"
        >
          Go to {lock.label} <ArrowRight size={13} aria-hidden />
        </Link>
        <Button variant="secondary" size="sm" onClick={() => confirmReference() && switchMode("reference")}>
          See it in SB-510
        </Button>
      </div>
      <p className="mt-3 text-xs text-text-muted">
        SB-510 is the reference case study with every module open. Your project stays in this browser; switch back from the project menu
        in the header.
      </p>
    </div>
  );
}

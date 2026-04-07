/**
 * EducationButton — graduation-cap trigger that opens the EducationPanel
 * drawer for a single dashboard component.
 *
 * Drop-in replacement for InfoButton in panel headers. Same hit-area as the
 * legacy info icon (h-6 w-6) so it slots into existing CardHeader actions
 * without layout shift. Uses lucide GraduationCap to visually distinguish
 * from the legacy Info icon and to match the page-level TrainingGuide trigger.
 *
 * Accepts either an EducationContent (rich) or a legacy InfoContent (shallow,
 * auto-promoted by EducationPanel). Migration is therefore incremental — a
 * panel can swap its InfoButton for an EducationButton with no content
 * authoring required, then deepen the content later.
 */

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { cn } from "../../lib/utils";
import { EducationPanel } from "./EducationPanel";
import type { EducationContent } from "../../types/education";
import type { InfoContent } from "./InfoButton";

interface EducationButtonProps {
  content: EducationContent | InfoContent;
  className?: string;
}

export function EducationButton({ content, className }: EducationButtonProps) {
  const [open, setOpen] = useState(false);
  const label = "title" in content ? content.title : "Learn more";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full",
          "text-text-muted hover:text-accent hover:bg-accent/10",
          "transition-colors duration-150",
          className,
        )}
        aria-label={`Learn about ${label}`}
        title={`Learn about ${label}`}
      >
        <GraduationCap size={14} />
      </button>

      <EducationPanel content={content} open={open} onOpenChange={setOpen} />
    </>
  );
}

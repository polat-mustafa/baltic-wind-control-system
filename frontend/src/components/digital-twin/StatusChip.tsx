/**
 * Status chip — word + icon + colour (never colour alone, ISA-101 / WCAG 1.4.1).
 */

import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";

import { cn } from "../../lib/utils";
import type { HealthStatus } from "../../services/digitalTwinApi";
import { STATUS_CLASS, STATUS_LABEL } from "./twinFormat";

const ICON = { normal: CheckCircle2, alert: AlertTriangle, alarm: OctagonAlert } as const;

export function StatusChip({
  status,
  className,
  compact = false,
}: {
  status: HealthStatus;
  className?: string;
  compact?: boolean;
}) {
  const Icon = ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border font-medium uppercase tracking-wide",
        compact ? "px-1.5 py-0 text-xs" : "px-2 py-0.5 text-xs",
        STATUS_CLASS[status].chip,
        className,
      )}
    >
      <Icon size={compact ? 10 : 12} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

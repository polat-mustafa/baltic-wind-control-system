import { cn } from "../../lib/utils";

type Status = "normal" | "warning" | "alarm" | "offline" | "maintenance" | "comms-loss";

const statusColors: Record<Status, string> = {
  normal: "bg-status-normal",
  warning: "bg-status-warning",
  alarm: "bg-status-alarm",
  offline: "bg-status-offline",
  maintenance: "bg-status-maintenance",
  "comms-loss": "bg-status-comms-loss",
};

const statusPulse: Record<Status, boolean> = {
  normal: true,
  warning: false,
  alarm: true,
  offline: false,
  maintenance: false,
  "comms-loss": true,
};

interface StatusIndicatorProps {
  status: Status;
  label?: string;
  className?: string;
}

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  const color = statusColors[status];
  const pulse = statusPulse[status];

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex h-2.5 w-2.5">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              color,
            )}
          />
        )}
        <span
          className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", color)}
        />
      </span>
      {label && (
        <span className="text-xs font-medium text-text-secondary">{label}</span>
      )}
    </span>
  );
}

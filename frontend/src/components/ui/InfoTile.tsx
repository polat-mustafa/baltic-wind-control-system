import { type ReactNode } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "../../lib/utils";
import { Sparkline } from "./Sparkline";

export type TilePriority = "normal" | "warning" | "alarm" | "info";

interface InfoTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  subtitle?: ReactNode;
  sparkline?: number[];
  normalBand?: [number, number];
  priority?: TilePriority;
  trend?: "up" | "down" | "flat";
  icon?: ReactNode;
  className?: string;
  size?: "sm" | "md";
}

const PRIORITY_BORDER: Record<TilePriority, string> = {
  normal: "border-border-primary",
  info: "border-status-info",
  warning: "border-status-warning",
  alarm: "border-status-alarm",
};

const PRIORITY_VALUE_COLOR: Record<TilePriority, string> = {
  normal: "text-text-primary",
  info: "text-text-primary",
  warning: "text-status-warning",
  alarm: "text-status-alarm",
};

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

export function InfoTile({
  label,
  value,
  unit,
  subtitle,
  sparkline,
  normalBand,
  priority = "normal",
  trend,
  icon,
  className,
  size = "md",
}: InfoTileProps) {
  const TrendIcon = trend ? TREND_ICON[trend] : null;
  const valueClass = PRIORITY_VALUE_COLOR[priority];
  const showLeftBorder = priority !== "normal";

  return (
    <div
      className={cn(
        "relative bg-bg-secondary border border-border-primary",
        PRIORITY_BORDER[priority],
        showLeftBorder && "border-l-[3px]",
        size === "md" ? "p-3" : "p-2",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "font-medium text-text-muted uppercase tracking-wider",
            size === "md" ? "text-[10px]" : "text-[9px]",
          )}
        >
          {label}
        </span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "font-mono font-semibold tabular-nums leading-none",
            size === "md" ? "text-2xl" : "text-lg",
            valueClass,
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-text-muted">{unit}</span>
        )}
        {TrendIcon && (
          <TrendIcon
            size={12}
            className={cn(
              "ml-1",
              priority === "alarm"
                ? "text-status-alarm"
                : priority === "warning"
                  ? "text-status-warning"
                  : "text-text-muted",
            )}
          />
        )}
      </div>

      {(subtitle || sparkline) && (
        <div className="flex items-end justify-between gap-2 mt-1.5 min-h-[18px]">
          {subtitle ? (
            <span className="text-[10px] text-text-muted truncate flex-1">
              {subtitle}
            </span>
          ) : (
            <span className="flex-1" />
          )}
          {sparkline && sparkline.length >= 2 && (
            <Sparkline
              points={sparkline}
              band={normalBand}
              width={size === "md" ? 64 : 48}
              height={18}
            />
          )}
        </div>
      )}
    </div>
  );
}

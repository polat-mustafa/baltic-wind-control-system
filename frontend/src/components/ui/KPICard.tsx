import { type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Trend = "up" | "down" | "flat";

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: Trend;
  trendValue?: string;
  icon?: ReactNode;
  className?: string;
}

const trendConfig: Record<Trend, { icon: typeof TrendingUp; color: string }> = {
  up: { icon: TrendingUp, color: "text-status-normal" },
  down: { icon: TrendingDown, color: "text-status-alarm" },
  flat: { icon: Minus, color: "text-text-muted" },
};

export function KPICard({
  label,
  value,
  unit,
  trend,
  trendValue,
  icon,
  className,
}: KPICardProps) {
  const TrendIcon = trend ? trendConfig[trend].icon : null;
  const trendColor = trend ? trendConfig[trend].color : "";

  return (
    <div
      className={cn(
        "rounded-lg border border-border-primary bg-bg-secondary p-4",
        "shadow-md shadow-black/15",
        "transition-all duration-200 hover:border-border-secondary",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold font-mono text-text-primary tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-text-muted">{unit}</span>
        )}
      </div>

      {trend && trendValue && TrendIcon && (
        <div className={cn("flex items-center gap-1 mt-2", trendColor)}>
          <TrendIcon size={14} />
          <span className="text-xs font-medium">{trendValue}</span>
        </div>
      )}
    </div>
  );
}

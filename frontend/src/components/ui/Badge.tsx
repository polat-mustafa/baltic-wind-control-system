import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        normal:
          "bg-status-normal/15 text-status-normal border border-status-normal/30",
        warning:
          "bg-status-warning/15 text-status-warning border border-status-warning/30",
        alarm:
          "bg-status-alarm/15 text-status-alarm border border-status-alarm/30",
        info: "bg-status-info/15 text-status-info border border-status-info/30",
        offline:
          "bg-status-offline/15 text-status-offline border border-status-offline/30",
        maintenance:
          "bg-status-maintenance/15 text-status-maintenance border border-status-maintenance/30",
        neutral:
          "bg-bg-elevated text-text-secondary border border-border-primary",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, variant, className }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}

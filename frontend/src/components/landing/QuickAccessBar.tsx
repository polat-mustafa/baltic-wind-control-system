/**
 * Quick-access navigation buttons for P3/P4/P5 dashboards.
 *
 * These projects aren't directly clickable on the map (turbines -> P1,
 * cable/substations -> P2), so we provide icon buttons for direct access.
 */

import { useNavigate } from "react-router-dom";
import { Monitor, Brain, ClipboardCheck, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface QuickLink {
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
}

const QUICK_LINKS: QuickLink[] = [
  {
    label: "P3 · SCADA",
    path: "/scada",
    description: "IEC 61850 automation",
    icon: Monitor,
  },
  {
    label: "P4 · Forecast",
    path: "/forecast",
    description: "AI wind prediction",
    icon: Brain,
  },
  {
    label: "P5 · Commissioning",
    path: "/commissioning",
    description: "Switching programme",
    icon: ClipboardCheck,
  },
];

export default function QuickAccessBar() {
  const navigate = useNavigate();

  return (
    <div className="flex gap-2">
      {QUICK_LINKS.map((link) => {
        const Icon = link.icon;
        return (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-2.5 text-left min-w-[160px]",
              "border border-border-primary bg-bg-secondary",
              "hover:bg-bg-hover hover:border-border-secondary",
              "shadow-md shadow-black/15",
              "transition-all duration-200 group",
            )}
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-accent/10 group-hover:bg-accent/20 transition-colors">
              <Icon size={16} className="text-accent" />
            </div>
            <div>
              <div className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                {link.label}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                {link.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

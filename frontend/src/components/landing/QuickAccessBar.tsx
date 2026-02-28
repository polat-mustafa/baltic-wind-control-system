/**
 * Quick-access navigation buttons for P3/P4/P5 dashboards.
 *
 * These projects aren't directly clickable on the map (turbines → P1,
 * cable/substations → P2), so we provide icon buttons for direct access.
 */

import { useNavigate } from "react-router-dom";

interface QuickLink {
  label: string;
  shortLabel: string;
  path: string;
  description: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    label: "P3 · SCADA",
    shortLabel: "P3",
    path: "/scada",
    description: "IEC 61850 automation",
  },
  {
    label: "P4 · Forecast",
    shortLabel: "P4",
    path: "/forecast",
    description: "AI wind prediction",
  },
  {
    label: "P5 · Commissioning",
    shortLabel: "P5",
    path: "/commissioning",
    description: "Switching programme",
  },
];

export default function QuickAccessBar() {
  const navigate = useNavigate();

  return (
    <div className="flex gap-2">
      {QUICK_LINKS.map((link) => (
        <button
          key={link.path}
          onClick={() => navigate(link.path)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-left hover:bg-slate-700 hover:border-slate-500 transition-colors group min-w-[150px]"
        >
          <div className="text-xs text-slate-400 group-hover:text-slate-300">
            {link.label}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {link.description}
          </div>
        </button>
      ))}
    </div>
  );
}

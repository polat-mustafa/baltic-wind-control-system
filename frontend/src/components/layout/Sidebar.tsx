/**
 * Navigation sidebar — Overview home link + P1-P5 project links.
 */

import { NavLink } from "react-router-dom";

interface NavItem {
  label: string;
  path: string;
  enabled: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", path: "/", enabled: true },
  { label: "P1 · Wind Resource", path: "/wind-resource", enabled: true },
  { label: "P2 · HV Grid", path: "/hv-grid", enabled: true },
  { label: "P3 · SCADA", path: "/scada", enabled: true },
  { label: "P4 · AI Forecast", path: "/forecast", enabled: true },
  { label: "P5 · Commissioning", path: "/commissioning", enabled: true },
];

export default function Sidebar() {
  return (
    <nav className="w-56 bg-slate-800 border-r border-slate-700 flex flex-col py-4 shrink-0">
      <div className="px-4 mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Dashboards
        </span>
      </div>
      <ul className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.path}>
            {item.enabled ? (
              <NavLink
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600/20 text-blue-400"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-500 cursor-not-allowed">
                <span>{item.label}</span>
                <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Application shell — dark SCADA theme layout.
 *
 * Structure: fixed top bar + sidebar + scrollable content area.
 * The content area renders the active route via React Router's <Outlet />.
 *
 * The dark background (slate-900) matches real SCADA HMI design practice:
 * operators work in dimmed control rooms where a dark UI reduces eye strain
 * and makes ISA-101 color-coded equipment states more visible.
 */

import { Link, Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";

export default function AppShell() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Top bar */}
      <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 shrink-0">
        <Link to="/" className="font-bold text-lg tracking-tight">
          Baltic Wind Alpha
        </Link>
        <span className="ml-3 text-xs text-slate-400">
          510 MW HV Control Simulation
        </span>
      </header>

      {/* Main area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * Navigation sidebar, grouped by project lifecycle stage (constants/navigation).
 *
 * md and up: a 56 px icon rail by default — each icon names its page in a
 * tooltip — that the user can widen to a labelled list; the choice is kept in
 * this browser (`of.nav.expanded`). Below md: an off-canvas drawer with labels,
 * opened from the header menu button. Modules the own project has not reached
 * yet carry a lock (lib/project/progress.ts).
 */

import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, Lock, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useLocks } from "../../lib/project/progress";
import { readStored, writeStored } from "../../lib/storage";
import { NAV_GROUPS } from "../../constants/navigation";

const EXPANDED_KEY = "of.nav.expanded";

interface SidebarProps {
  /** Drawer state below md (the sidebar is off-canvas there). */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const isMd = useMediaQuery("(min-width: 768px)");
  const [userExpanded, setUserExpanded] = useState(() => readStored(EXPANDED_KEY) === "1");
  // The drawer below md always shows the labels.
  const expanded = !isMd || userExpanded;
  const locks = useLocks();

  const toggle = () => {
    setUserExpanded(!userExpanded);
    writeStored(EXPANDED_KEY, userExpanded ? "0" : "1");
  };

  return (
    <nav
      aria-label="Main navigation"
      data-tour="nav"
      data-expanded={expanded}
      inert={!isMd && !mobileOpen}
      className={cn(
        "flex flex-col border-r border-border-primary bg-bg-secondary shrink-0",
        "transition-[width,transform] duration-200 ease-out",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[2000] max-md:w-72 max-md:max-w-[85vw] max-md:overflow-y-auto max-md:shadow-2xl",
        mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
        expanded ? "md:w-56" : "md:w-14",
      )}
    >
      {!isMd && (
        <div className="flex items-center justify-end border-b border-border-primary px-2 py-2">
          <button
            type="button"
            onClick={onMobileClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg-hover hover:text-text-secondary"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className={cn("flex flex-1 flex-col py-2", expanded ? "px-2" : "items-center px-1.5")}>
        {NAV_GROUPS.map((group, gi) => (
          <section key={group.label} aria-labelledby={`nav-group-${gi}`} className={cn("w-full", gi > 0 && "mt-2")}>
            {expanded ? (
              <h2 id={`nav-group-${gi}`} className="px-2.5 pb-1 pt-1 text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
                {group.label}
              </h2>
            ) : (
              <>
                {gi > 0 && <div className="mx-auto mb-2 w-6 border-t border-border-primary" aria-hidden />}
                <h2 id={`nav-group-${gi}`} className="sr-only">
                  {group.label}
                </h2>
              </>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const lock = locks[item.path];
                const name = `${item.label}${lock ? " (locked)" : ""}`;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/" || item.path === "/develop" || item.path === "/build"}
                      onClick={onMobileClose}
                      aria-label={expanded && !lock ? undefined : name}
                      title={lock ? `${item.label} — locked. First: ${lock.need}` : expanded ? item.description : undefined}
                      className={({ isActive }) =>
                        cn(
                          "group relative flex items-center gap-3 rounded-md text-sm transition-colors duration-150",
                          expanded ? "h-9 px-2.5" : "h-10 w-10 justify-center",
                          isActive
                            ? "bg-accent-muted text-accent"
                            : "text-text-muted hover:bg-bg-hover hover:text-text-primary",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span aria-hidden className="absolute -left-1.5 top-2 h-6 w-0.5 rounded-full bg-accent" />
                          )}
                          <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                          {expanded ? (
                            <span className={cn("min-w-0 flex-1 truncate font-medium", !isActive && "text-text-secondary group-hover:text-text-primary")}>
                              {item.label}
                            </span>
                          ) : (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute left-full top-1/2 z-[1500] ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-border-secondary bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-primary opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
                            >
                              {item.label}
                            </span>
                          )}
                          {lock && (
                            <Lock
                              size={expanded ? 12 : 10}
                              aria-hidden
                              className={cn("shrink-0 text-text-muted", !expanded && "absolute bottom-1 right-1")}
                            />
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {isMd && (
        <div className={cn("border-t border-border-primary py-2", expanded ? "px-2" : "flex justify-center px-1.5")}>
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "flex items-center gap-3 rounded-md text-xs text-text-muted hover:bg-bg-hover hover:text-text-secondary",
              expanded ? "h-8 w-full px-2.5" : "h-8 w-10 justify-center",
            )}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            title={expanded ? "Collapse to icons" : "Show page names"}
          >
            {expanded ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
            {expanded && <span>Collapse</span>}
          </button>
        </div>
      )}
    </nav>
  );
}

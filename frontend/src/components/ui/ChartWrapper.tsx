/**
 * ChartWrapper — container for Plotly charts with fullscreen toggle.
 *
 * Provides:
 * - Responsive height via CSS `max(350px, 28vh)`
 * - Fullscreen expand/collapse button
 * - Consistent dark SCADA card styling
 *
 * Fullscreen: uses flex-col layout so the chart (children) stretches
 * to fill available height. A CSS rule in index.css forces Plotly's
 * inner containers to `height: 100%` when inside `[data-chart-fs]`.
 */

import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils";

interface ChartWrapperProps {
  /** Chart title shown in the header */
  title: string;
  /** Optional right-side header element (e.g. InfoButton) */
  headerRight?: React.ReactNode;
  /** Footer text below the chart */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function ChartWrapper({ title, headerRight, footer, children }: ChartWrapperProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync React state with Fullscreen API (handles Escape key, etc.)
  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {
        // Fallback: just toggle the CSS class
        setIsFullscreen((prev) => !prev);
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  return (
    <div
      ref={containerRef}
      data-chart-fs={isFullscreen ? "" : undefined}
      className={cn(
        "relative bg-bg-secondary rounded-lg p-4 border border-border-primary",
        isFullscreen && "fixed inset-0 z-[9000] rounded-none flex flex-col overflow-auto",
      )}
    >
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        <div className="flex items-center gap-2">
          {headerRight}
          {/* Normal mode: inline expand button */}
          {!isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="text-text-muted hover:text-text-primary transition-colors p-0.5"
              aria-label="Fullscreen"
            >
              <Maximize2 size={16} />
            </button>
          )}
        </div>
      </div>
      <div className={cn(isFullscreen && "flex-1 min-h-0")}>
        {children}
      </div>
      {footer && (
        <p className="text-xs text-text-muted mt-1 text-center shrink-0">{footer}</p>
      )}

      {/* Fullscreen mode: floating exit button — bottom-right to avoid blocking chart data */}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="fixed bottom-6 right-6 z-[9001] flex items-center gap-2 rounded-lg px-4 py-2.5 bg-bg-elevated border border-border-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover shadow-lg shadow-black/40 transition-colors"
          aria-label="Exit fullscreen"
        >
          <Minimize2 size={16} />
          <span className="text-xs font-medium">Exit</span>
        </button>
      )}
    </div>
  );
}

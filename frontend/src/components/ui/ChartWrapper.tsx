/**
 * ChartWrapper — container for Plotly charts with fullscreen toggle.
 *
 * Provides:
 * - Responsive height via CSS `max(350px, 28vh)`
 * - Fullscreen expand/collapse button
 * - Consistent dark SCADA card styling
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
      className={cn(
        "bg-bg-secondary rounded-lg p-4 border border-border-primary",
        isFullscreen && "fixed inset-0 z-[9000] rounded-none overflow-auto",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <div className="flex items-center gap-2">
          {headerRight}
          <button
            onClick={toggleFullscreen}
            className="text-text-muted hover:text-text-primary transition-colors p-0.5"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>
      {children}
      {footer && (
        <p className="text-xs text-text-muted mt-1 text-center">{footer}</p>
      )}
    </div>
  );
}

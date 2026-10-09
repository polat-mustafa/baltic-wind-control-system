/**
 * Shown when WebGL is not available in the user's browser.
 *
 * Renders a short notice as a graceful fallback (the power-train diagram in the
 * turbine detail panel still works without WebGL).
 */

import type { TurbineData } from "../../../../types/landing";

interface WebGLFallbackProps {
  turbine: TurbineData;
}

export default function WebGLFallback({ turbine }: WebGLFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-bg-secondary rounded-lg border border-border-primary gap-3 p-4">
      <div className="text-text-muted text-xs font-mono text-center max-w-[260px]">
        <div className="text-[13px] text-text-primary font-medium mb-1">3D viewer unavailable</div>
        Your browser does not support WebGL. The interactive 3D turbine viewer
        requires WebGL 2.0 (supported in all modern browsers).
      </div>
      <div className="text-xs text-text-muted opacity-60">
        {turbine.id} · {turbine.status} · {turbine.powerOutputMW.toFixed(1)} MW
      </div>
    </div>
  );
}

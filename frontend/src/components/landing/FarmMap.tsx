/**
 * The Control Room map (MapLibre + deck.gl, ControlRoomMap), loaded lazily.
 * It needs WebGL: without it, or when the GPU context fails at runtime, a
 * plain note says so instead of a broken canvas.
 */

import { Component, lazy, Suspense, type ReactNode } from "react";

import type { FarmMapProps } from "./ControlRoomMap";

const ControlRoomMap = lazy(() => import("./ControlRoomMap"));

let webgl: boolean | null = null;
/** WebGL available (checked once). */
function hasWebGL(): boolean {
  if (webgl === null) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
      webgl = !!gl;
      // free the probe: browsers cap the number of live WebGL contexts per page
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

class Fallback extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function NoMap({ why }: { why: string }) {
  return (
    <div className="flex h-full min-h-[450px] w-full items-center justify-center rounded border border-border-primary bg-bg-secondary p-6 text-center text-sm text-text-muted">
      {why} The plant itself is still live in SCADA, the KPIs above and every page.
    </div>
  );
}

export default function FarmMap(props: FarmMapProps) {
  if (!hasWebGL()) return <NoMap why="The map needs WebGL, which this browser does not offer." />;
  return (
    <Suspense fallback={<div className="h-full w-full rounded border border-border-primary bg-bg-secondary" />}>
      <Fallback fallback={<NoMap why="The map's graphics context failed (GPU reset or driver issue) — reload the page to try again." />}>
        <ControlRoomMap {...props} />
      </Fallback>
    </Suspense>
  );
}

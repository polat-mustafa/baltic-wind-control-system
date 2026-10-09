/**
 * The Control Room map: the MapLibre + deck.gl map (ControlRoomMap) where the
 * browser has WebGL, the classic Leaflet map otherwise — or when the user
 * opens it for a layer that has not moved over yet (layerStore.classicMap).
 * A WebGL failure at runtime also falls back to the classic map.
 */

import { Component, lazy, Suspense, type ReactNode } from "react";

import { useLayerStore } from "../../store/layerStore";
import type { FarmMapProps } from "./ControlRoomMap";

const ControlRoomMap = lazy(() => import("./ControlRoomMap"));
const LeafletWindFarmMap = lazy(() => import("./LeafletWindFarmMap"));

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

export default function FarmMap(props: FarmMapProps) {
  const classic = useLayerStore((s) => s.classicMap);
  const setClassicMap = useLayerStore((s) => s.setClassicMap);
  const leaflet = <LeafletWindFarmMap {...props} />;
  return (
    <Suspense fallback={<div className="h-full w-full rounded border border-border-primary bg-bg-secondary" />}>
      {classic || !hasWebGL() ? (
        <div className="relative h-full w-full">
          {leaflet}
          {classic && hasWebGL() && (
            <button
              type="button"
              onClick={() => setClassicMap(false)}
              className="absolute bottom-3 left-1/2 z-[1100] -translate-x-1/2 rounded-md border border-border-secondary bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-primary shadow-lg hover:bg-bg-hover"
            >
              Back to the new map
            </button>
          )}
        </div>
      ) : (
        <Fallback fallback={leaflet}>
          <ControlRoomMap {...props} />
        </Fallback>
      )}
    </Suspense>
  );
}

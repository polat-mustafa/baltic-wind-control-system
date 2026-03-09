/**
 * Bathymetry contour layer for the Leaflet wind farm map.
 *
 * Renders isobaths (20 m, 30 m, 40 m, 50 m) as semi-transparent
 * polylines with depth labels at each contour's midpoint.
 * Darker blue = deeper water.  Typical Baltic shelf profile.
 */

import { Polyline, Tooltip } from "react-leaflet";

import { BATHYMETRY_CONTOURS_GEO } from "../../constants/windFarmLayout";

// Depth-based colour ramp (shallow → deep)
const DEPTH_COLORS: Record<number, string> = {
  20: "#4a90c4",
  30: "#2e6f9e",
  40: "#1e5080",
  50: "#0f3460",
};

export default function BathymetryLayer() {
  return (
    <>
      {BATHYMETRY_CONTOURS_GEO.map((contour) => {
        const color = DEPTH_COLORS[contour.depth] ?? "#1e3a5f";

        return (
          <Polyline
            key={`bathy-${contour.depth}`}
            positions={contour.points}
            pathOptions={{
              color,
              weight: 1.5,
              opacity: 0.45,
              dashArray: "6 4",
              interactive: false,
            }}
          >
            <Tooltip
              permanent
              direction="center"
              offset={[0, 0]}
              className="leaflet-bathy-label"
            >
              <span
                style={{
                  color,
                  fontSize: 9,
                  fontFamily: "JetBrains Mono, monospace",
                  fontWeight: 600,
                  background: "rgba(15,17,23,0.7)",
                  padding: "1px 4px",
                  borderRadius: 3,
                }}
              >
                {contour.depth} m
              </span>
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}

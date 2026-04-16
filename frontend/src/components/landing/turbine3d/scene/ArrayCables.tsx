/**
 * Schematic 66 kV array cables radiating from the monopile base.
 *
 * The viewer shows a single turbine at world origin — geographic cable
 * positions (900 m apart) are off-screen at this camera distance.
 * Instead, three schematic lines fan out from the tower base (y=2, sea level)
 * representing the three string directions (strings 1-2, 3-4, 5-6).
 *
 * Uses @react-three/drei Line — import aliased to avoid any SVG Line conflicts.
 */
import { Line } from "@react-three/drei";

const CABLE_LENGTH = 160; // metres — schematic, not geographic scale
// Fan bearings (degrees from scene +Z). Matches string layout: SW / S / SE
const BEARINGS_DEG = [-55, 0, 55] as const;

export function ArrayCables() {
  return (
    <group>
      {BEARINGS_DEG.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const far: [number, number, number] = [
          Math.sin(rad) * CABLE_LENGTH,
          2, // y=2: sits just above the sea plane at y=0
          Math.cos(rad) * CABLE_LENGTH,
        ];
        return (
          <Line
            key={i}
            points={[[0, 2, 0], far]}
            color="#f59e0b"
            lineWidth={2}
          />
        );
      })}
    </group>
  );
}

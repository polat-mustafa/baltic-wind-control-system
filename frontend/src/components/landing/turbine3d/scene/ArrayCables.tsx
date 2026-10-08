/**
 * 66 kV array cables on the seabed (−40 m) along the real radial strings —
 * each turbine is looped to the next one in its string and the string head to
 * the offshore substation (same topology as the map and the P2 network
 * model) — plus the OSS itself: four-legged jacket, two-deck topside with
 * the 66/220 kV transformers, helideck and crane.
 *
 * Positions and the cable tree come from the live fleet (lib/fleet) via
 * model/farm (world frame).
 */

import { useMemo } from "react";
import { Line } from "@react-three/drei";

import { arraySegments, useFleet } from "../../../../lib/fleet";
import { farmAround, worldAround } from "../model/farm";

const SEABED_Y = -39.4;

export function ArrayCables({ turbineId }: { turbineId: string }) {
  const fleet = useFleet();
  const { segments, oss } = useMemo(() => {
    const byId = new Map(farmAround(turbineId, fleet).map((t) => [t.id, [t.x, t.z] as [number, number]]));
    const ossPos = worldAround(turbineId, fleet.oss, fleet);
    const segs = arraySegments(fleet).map((s) => ({
      key: `${s.fromId}-${s.toId}`,
      a: byId.get(s.fromId)!,
      b: s.toId === "OSS" ? ossPos : byId.get(s.toId)!,
      mine: s.fromId === turbineId || s.toId === turbineId,
    }));
    return { segments: segs, oss: ossPos };
  }, [turbineId, fleet]);

  return (
    <group>
      {segments.map((sg) => (
        <Line
          key={sg.key}
          points={[
            [sg.a[0], SEABED_Y, sg.a[1]],
            [sg.b[0], SEABED_Y, sg.b[1]],
          ]}
          color={sg.mine ? "#f59e0b" : "#b45309"}
          lineWidth={sg.mine ? 2.5 : 1.2}
          transparent
          opacity={sg.mine ? 0.9 : 0.55}
        />
      ))}
      <OffshoreSubstation x={oss[0]} z={oss[1]} />
    </group>
  );
}

/** OSS: jacket (4 legs, X-braced), topside decks, transformer bays, helideck. */
function OffshoreSubstation({ x, z }: { x: number; z: number }) {
  const legs: [number, number][] = [[-14, -11], [14, -11], [14, 11], [-14, 11]];
  return (
    <group position={[x, 0, z]}>
      {legs.map(([lx, lz]) => (
        <mesh key={`${lx}${lz}`} position={[lx, -8, lz]}>
          <cylinderGeometry args={[1.1, 1.3, 64, 12]} />
          <meshStandardMaterial color="#f2b705" roughness={0.5} />
        </mesh>
      ))}
      {/* cellar deck, main deck and weather deck */}
      <mesh position={[0, 26, 0]}>
        <boxGeometry args={[40, 3, 30]} />
        <meshStandardMaterial color="#9aa1a6" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, 35, 0]}>
        <boxGeometry args={[38, 15, 28]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.55} />
      </mesh>
      {/* two 300 MVA 66/220 kV transformer bays (open-sided, radiators) */}
      {[-9, 9].map((bx) => (
        <mesh key={bx} position={[bx, 33, 14.2]}>
          <boxGeometry args={[12, 9, 0.6]} />
          <meshStandardMaterial color="#374151" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 43.2, 0]}>
        <boxGeometry args={[40, 1.4, 30]} />
        <meshStandardMaterial color="#9aa1a6" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* helideck (D = 22 m) with the H marking area */}
      <mesh position={[8, 45, -2]}>
        <cylinderGeometry args={[11, 11, 0.6, 32]} />
        <meshStandardMaterial color="#2f6f3e" roughness={0.8} />
      </mesh>
      {/* pedestal crane */}
      <mesh position={[-15, 50, 10]}>
        <cylinderGeometry args={[0.8, 0.8, 12, 12]} />
        <meshStandardMaterial color="#f2b705" roughness={0.5} />
      </mesh>
      <mesh position={[-9, 56, 10]} rotation={[0, 0, -1.1]}>
        <boxGeometry args={[1, 16, 1]} />
        <meshStandardMaterial color="#f2b705" roughness={0.5} />
      </mesh>
    </group>
  );
}

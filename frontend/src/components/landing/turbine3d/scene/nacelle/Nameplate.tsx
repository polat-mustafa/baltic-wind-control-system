/**
 * Engineering nameplate — small painted metal plate + drei <Text>.
 *
 * Used to label hero subsystems (HPU, UPS, transformer, converter, …) with
 * their rated values, producing a recognisable field-inspection look.
 *
 * The plate faces +Z by default; rotate the parent group to orient.
 */

import { memo } from "react";
import { Text } from "@react-three/drei";

export interface NameplateProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  title: string;
  lines?: string[];
  /** Plate width in metres. */
  width?: number;
  /** Plate height in metres. */
  height?: number;
  /** Plate base colour — defaults to RAL 7035 light grey. */
  plateColor?: string;
}

export const Nameplate = memo(function Nameplate({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  title,
  lines = [],
  width = 0.8,
  height = 0.35,
  plateColor = "#d1d5db",
}: NameplateProps) {
  const titleSize = Math.min(0.075, height * 0.22);
  const lineSize = Math.min(0.055, height * 0.16);
  const lineGap = lineSize * 1.35;

  return (
    <group position={position} rotation={rotation}>
      {/* Plate body */}
      <mesh>
        <boxGeometry args={[width, height, 0.012]} />
        <meshStandardMaterial color={plateColor} metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Thin dark frame */}
      <mesh position={[0, 0, 0.0065]}>
        <boxGeometry args={[width - 0.02, height - 0.02, 0.002]} />
        <meshStandardMaterial color="#0f172a" metalness={0.2} roughness={0.65} />
      </mesh>

      <Text
        position={[0, height / 2 - titleSize * 1.1, 0.012]}
        fontSize={titleSize}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.005}
        outlineColor="#0f172a"
        maxWidth={width * 0.9}
      >
        {title}
      </Text>

      {lines.slice(0, 3).map((line, i) => (
        <Text
          key={i}
          position={[0, height / 2 - titleSize * 2.4 - i * lineGap, 0.012]}
          fontSize={lineSize}
          color="#cbd5e1"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.003}
          outlineColor="#0f172a"
          maxWidth={width * 0.9}
        >
          {line}
        </Text>
      ))}
    </group>
  );
});

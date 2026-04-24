/**
 * D1 — Thermal Overlay Mode
 *
 * Renders semi-transparent coloured discs at key nacelle hot spots.
 * Temperature is derived from the turbine's live power output using
 * the same steady-state thermal model as the backend nacelle_subsystems.py:
 *
 *   T_component = T_nominal + ΔT_max × (P / P_rated)
 *
 * Colour scale (IEC-style, matches industrial IR cameras):
 *   ≤ 20 °C  → blue    (#3b82f6)
 *   40 °C    → cyan    (#22d3ee)
 *   60 °C    → green   (#22c55e)
 *   80 °C    → yellow  (#eab308)
 *   100 °C   → red     (#ef4444)
 *   155 °C   → crimson (#7f1d1d)   — IEC 60034-1 Class F insulation limit
 *   180 °C+  → magenta (#86198f)   — Class H reserve / trip
 *
 * The colour gradient saturates at 155 °C (Class F) so that readings on
 * generator windings, converter, and transformer never appear cooler than
 * their actual thermal class headroom. 180 °C represents the IEEE trip point.
 *
 * Components monitored:
 *   Main bearing (nominal 45 °C, alarm 65 °C)
 *   Gearbox HS bearing (nominal 65 °C, alarm 85 °C)
 *   Generator windings (nominal 80 °C, alarm 105 °C) — IEC 60034-1 Class F
 *   Converter (nominal 55 °C, alarm 80 °C)
 *   Transformer (nominal 70 °C, alarm 90 °C)
 *   Oil cooler inlet (nominal 65 °C, alarm 75 °C)
 */

import { useMemo } from "react";
import * as THREE from "three";

import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import {
  selectNacelleData,
  useNacelleSubsystemsStore,
} from "../../../../store/nacelleSubsystemsStore";

interface ThermalOverlayProps {
  turbineId: string;
}

/** Lerp through a 7-stop temperature → hex colour gradient (Class F-aware). */
function tempToHex(tempC: number): string {
  const stops: [number, number, number, number][] = [
    // [threshold, R, G, B]  (0-255 per channel)
    [20,   59, 130, 246],  // blue
    [40,   34, 211, 238],  // cyan
    [60,   34, 197,  94],  // green
    [80,  234, 179,   8],  // yellow
    [100, 239,  68,  68],  // red
    [155, 127,  29,  29],  // crimson — Class F insulation limit
    [180, 134,  25, 143],  // magenta — Class H reserve / trip
  ];

  const t = Math.max(stops[0][0], Math.min(tempC, stops[stops.length - 1][0]));

  for (let i = 0; i < stops.length - 1; i++) {
    const [tLow, rLow, gLow, bLow] = stops[i];
    const [tHigh, rHigh, gHigh, bHigh] = stops[i + 1];
    if (t <= tHigh) {
      const f = (t - tLow) / (tHigh - tLow);
      const r = Math.round(rLow + f * (rHigh - rLow));
      const g = Math.round(gLow + f * (gHigh - gLow));
      const b = Math.round(bLow + f * (bHigh - bLow));
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
  }
  return "#ef4444";
}

interface HotSpot {
  label: string;
  position: [number, number, number];
  /** Steady-state temperature at zero load [°C] */
  tMin: number;
  /** Rise above tMin at rated load (15 MW) [°C] */
  tRise: number;
  radius: number;
}

const HOT_SPOTS: HotSpot[] = [
  {
    label: "Main Bearing",
    position: [0, 150, 1.5],
    tMin: 20,
    tRise: 25,
    radius: 1.4,
  },
  {
    label: "Gearbox HS Bearing",
    position: [0, 150, -1.8],
    tMin: 25,
    tRise: 40,
    radius: 1.2,
  },
  {
    label: "Generator Windings",
    position: [0, 150, -5.2],
    tMin: 30,
    tRise: 50,
    radius: 2.0,
  },
  {
    label: "Converter (Port)",
    position: [-3.5, 149, -3.0],
    tMin: 25,
    tRise: 30,
    radius: 0.9,
  },
  {
    label: "Converter (Stbd)",
    position: [3.5, 149, -3.0],
    tMin: 25,
    tRise: 30,
    radius: 0.9,
  },
  {
    label: "Transformer",
    position: [0, 148.5, -11.0],
    tMin: 30,
    tRise: 45,
    radius: 1.3,
  },
  {
    label: "Oil Cooler Inlet",
    position: [4.6, 151.5, -3.0],
    tMin: 20,
    tRise: 45,
    radius: 0.8,
  },
];

const RATED_POWER_MW = 15.0;

export function ThermalOverlay({ turbineId }: ThermalOverlayProps) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const liveData = useNacelleSubsystemsStore(selectNacelleData(turbineId));
  const powerFraction = turbine ? Math.max(0, turbine.powerOutputMW / RATED_POWER_MW) : 0.5;

  const spots = useMemo(() => {
    const oilTempLive = liveData?.cooling?.oil_temp_c;
    return HOT_SPOTS.map((hs) => {
      // Backend supplies oil temp; gearbox HS bearing tracks oil + ~5 °C and
      // the cooler-inlet circle reflects the same live temperature.
      if (oilTempLive !== undefined) {
        if (hs.label === "Oil Cooler Inlet") return { ...hs, tempC: oilTempLive };
        if (hs.label === "Gearbox HS Bearing") return { ...hs, tempC: oilTempLive + 5 };
      }
      return { ...hs, tempC: hs.tMin + hs.tRise * powerFraction };
    });
  }, [powerFraction, liveData]);

  return (
    <group name="thermal-overlay">
      {spots.map((hs) => {
        const colour = tempToHex(hs.tempC);
        return (
          <mesh
            key={hs.label}
            position={hs.position}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[hs.radius, 32]} />
            <meshStandardMaterial
              color={colour}
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthWrite={false}
              emissive={colour}
              emissiveIntensity={0.3}
            />
          </mesh>
        );
      })}

      {/* Temperature labels (HTML-in-3D via sprite trick — use text encoded as canvas texture) */}
      {spots.map((hs) => (
        <TempLabel
          key={`lbl-${hs.label}`}
          position={[hs.position[0], hs.position[1] + hs.radius + 0.5, hs.position[2]]}
          tempC={hs.tempC}
          label={hs.label}
        />
      ))}
    </group>
  );
}

/** A tiny billboard showing "65 °C" above each hot spot. */
function TempLabel({
  position,
  tempC,
  label,
}: {
  position: [number, number, number];
  tempC: number;
  label: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 192, 64);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.roundRect(4, 4, 184, 56, 6);
    ctx.fill();
    ctx.fillStyle = tempToHex(tempC);
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(tempC)} °C`, 96, 26);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "14px sans-serif";
    ctx.fillText(label, 96, 48);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, [tempC, label]);

  return (
    <sprite position={position} scale={[3, 1, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </sprite>
  );
}

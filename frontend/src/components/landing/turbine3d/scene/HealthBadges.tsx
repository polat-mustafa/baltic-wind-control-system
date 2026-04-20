/**
 * D4 — Component Health Badges
 *
 * Small coloured disc badges overlaid on each monitored component.
 * Visible in cutaway and exploded modes.
 *
 * Health Index (HI) derivation:
 *   Main bearing:  HI = 100 − max(0, (T_bearing − 45°C) / 0.6) %
 *   Gearbox:       HI = 100 − max(0, (T_oil     − 65°C) / 0.5) %
 *   Generator:     HI = 100 − max(0, (T_gen     − 80°C) / 0.4) %
 *   Converter:     Fixed 95 % (no direct temperature in store — nominal)
 *
 * Alarm thresholds (IEC 61400-1 / ISO 10816-21):
 *   HI 80–100 → green  (#22c55e)
 *   HI 60–80  → yellow (#eab308)
 *   HI 30–60  → amber  (#f97316)
 *   HI  0–30  → red    (#ef4444)
 */

import * as THREE from "three";
import { useMemo } from "react";

import { selectTurbine, useLandingStore } from "../../../../store/landingStore";

interface HealthBadgesProps {
  turbineId: string;
}

function hiToColour(hi: number): string {
  if (hi >= 80) return "#22c55e";
  if (hi >= 60) return "#eab308";
  if (hi >= 30) return "#f97316";
  return "#ef4444";
}

function clamp(val: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, val));
}

interface Badge {
  label: string;
  position: [number, number, number];
  hi: number;
}

export function HealthBadges({ turbineId }: HealthBadgesProps) {
  const turbine = useLandingStore(selectTurbine(turbineId));

  const badges: Badge[] = useMemo(() => {
    const bearingTempC = turbine?.bearingTempC ?? 45;
    const powerMw      = turbine?.powerOutputMW ?? 0;

    // Derive thermal proxies for components not directly in store
    const gearboxOilTempC = 25 + 40 * (powerMw / 15.0);  // matches cooling model
    const genTempC        = 30 + 50 * (powerMw / 15.0);   // matches thermal model

    const bearingHI  = clamp(100 - Math.max(0, (bearingTempC   - 45) / 0.6), 0, 100);
    const gearboxHI  = clamp(100 - Math.max(0, (gearboxOilTempC - 65) / 0.5), 0, 100);
    const generatorHI = clamp(100 - Math.max(0, (genTempC       - 80) / 0.4), 0, 100);
    const converterHI = 95; // no direct trip data available — nominal

    return [
      { label: "Main Bearing",  position: [ 1.2, 151.5,  1.8],  hi: bearingHI   },
      { label: "Gearbox",       position: [ 1.5, 151.5, -1.5],  hi: gearboxHI   },
      { label: "Generator",     position: [ 2.5, 151.5, -5.2],  hi: generatorHI },
      { label: "Converter (P)", position: [-3.5, 150.5, -2.2],  hi: converterHI },
      { label: "Converter (S)", position: [ 3.5, 150.5, -2.2],  hi: converterHI },
    ];
  }, [turbine]);

  return (
    <group name="health-badges">
      {badges.map((b) => (
        <HealthBadge key={b.label} badge={b} />
      ))}
    </group>
  );
}

function HealthBadge({ badge }: { badge: Badge }) {
  const colour = hiToColour(badge.hi);

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;

    // Background circle
    ctx.beginPath();
    ctx.arc(48, 48, 44, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fill();

    // Coloured ring
    ctx.beginPath();
    ctx.arc(48, 48, 44, 0, Math.PI * 2);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 8;
    ctx.stroke();

    // HI number
    ctx.fillStyle = colour;
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(badge.hi)}`, 48, 40);

    // "HI" label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px sans-serif";
    ctx.fillText("HI", 48, 64);

    return new THREE.CanvasTexture(canvas);
  }, [badge.hi, colour]);

  return (
    <sprite position={badge.position} scale={[0.9, 0.9, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={0.92}
        depthWrite={false}
      />
    </sprite>
  );
}

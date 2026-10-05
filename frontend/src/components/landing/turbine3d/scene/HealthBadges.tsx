/**
 * D4 — Component Health Badges
 *
 * Small coloured disc badges overlaid on each monitored component.
 * Visible in cutaway and exploded modes.
 *
 * Health Index (HI) from the thermal margin (model/nacelleThermal, the same
 * temperatures as the thermal overlay): 100 at or below the part's rated
 * temperature on a 15 °C day, 0 at its trip limit, linear in between.
 *   Main bearing — simulated PT100 · Gearbox — live sump oil (backend)
 *   Generator / converter — load-loss model
 *
 *   HI 80–100 → green  (#22c55e)
 *   HI 60–80  → yellow (#eab308)
 *   HI 30–60  → amber  (#f97316)
 *   HI  0–30  → red    (#ef4444)
 */

import * as THREE from "three";
import { useEffect, useMemo } from "react";

import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import { selectNacelleData, useNacelleSubsystemsStore } from "../../../../store/nacelleSubsystemsStore";
import { onShaft, PARTS, SHAFT_Z } from "../model/layout";
import { nacelleTemperatures, thermalHealthIndex } from "../model/nacelleThermal";

interface HealthBadgesProps {
  turbineId: string;
}

function hiToColour(hi: number): string {
  if (hi >= 80) return "#22c55e";
  if (hi >= 60) return "#eab308";
  if (hi >= 30) return "#f97316";
  return "#ef4444";
}

interface Badge {
  label: string;
  position: [number, number, number];
  hi: number;
}

export function HealthBadges({ turbineId }: HealthBadgesProps) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const airC = useLandingStore((s) => s.environment.airTemperatureC);
  const oilC = useNacelleSubsystemsStore(selectNacelleData(turbineId))?.cooling?.oil_temp_c;

  const badges: Badge[] = useMemo(() => {
    const t = nacelleTemperatures({
      powerMW: turbine?.powerOutputMW ?? 0,
      airC,
      bearingC: turbine?.bearingTempC,
      oilC,
    });
    const hi = (id: keyof typeof t) => thermalHealthIndex(id, t[id].tempC);
    return [
      { label: "Main Bearing", position: onShaft(SHAFT_Z.bearingUnit, 1.5, 2.6), hi: hi("mainBearing") },
      { label: "Gearbox", position: onShaft(SHAFT_Z.gearbox, 1.5, 2.6), hi: Math.min(hi("gearboxOil"), hi("hsBearing")) },
      { label: "Generator", position: onShaft(SHAFT_Z.generator, 1.5, 2.8), hi: hi("generator") },
      { label: "Converter", position: [PARTS.converter[0], PARTS.converter[1] + 2.0, PARTS.converter[2]], hi: hi("converter") },
    ];
  }, [turbine?.powerOutputMW, turbine?.bearingTempC, airC, oilC]);

  return (
    <group name="health-badges">
      {badges.map((b) => (
        <HealthBadge key={b.label} badge={b} />
      ))}
    </group>
  );
}

function HealthBadge({ badge }: { badge: Badge }) {
  const hi = Math.round(badge.hi);
  const colour = hiToColour(hi);

  // 2× canvas for crisp text; the ring fills with the HI like a gauge.
  const texture = useMemo(() => {
    const S = 192;
    const c = S / 2;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d")!;

    ctx.beginPath();
    ctx.arc(c, c, 88, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(10,16,28,0.82)";
    ctx.fill();

    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(c, c, 78, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, 78, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.max(0.01, hi)) / 100);
    ctx.strokeStyle = colour;
    ctx.stroke();

    ctx.fillStyle = colour;
    ctx.font = "bold 56px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${hi}`, c, c - 10);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("HI", c, c + 36);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [hi, colour]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={badge.position} scale={[0.9, 0.9, 1]}>
      <spriteMaterial map={texture} transparent opacity={0.95} depthWrite={false} />
    </sprite>
  );
}

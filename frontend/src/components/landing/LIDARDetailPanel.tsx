/**
 * Floating LIDAR (FLS) detail panel — independent wind reference for the
 * wind resource assessment, separate from turbine SCADA anemometry.
 *
 * The vertical profile spans the whole V236 rotor disk (hub 150 m, tips at
 * 32–268 m) and reports the rotor-equivalent wind speed (REWS): the speed
 * that carries the same kinetic energy flux through the disk as the sheared
 * profile, REWS = (Σ Aᵢ·Uᵢ³ / A)^⅓.
 */

import { useNavigate } from "react-router-dom";

import { Radar } from "lucide-react";

import { LIDAR_GEO } from "../../constants/windFarmLayout";
import { selectKPIs, useLandingStore } from "../../store/landingStore";
import {
  HUB_HEIGHT_M,
  ROTOR_DIAMETER_M,
  SHEAR_ALPHA,
  gustMs,
  turbulenceIntensity,
  windAtHeight,
} from "../../utils/landingPhysics";
import { DataRow, EquipmentPanel, HeroValue, PanelSection } from "./EquipmentPanel";

const NORMAL = "#3ecf6e";
const PROFILE_COLOR = "#4FC3D8";
const R = ROTOR_DIAMETER_M / 2;
const TIP_LOW = HUB_HEIGHT_M - R;
const TIP_HIGH = HUB_HEIGHT_M + R;
/** Range gates the LIDAR reports [m]. */
const GATES = [40, 80, 120, 150, 200, 250];

/** REWS over the rotor disk, 40 horizontal slices weighted by chord area. */
function rotorEquivalentWind(hubWindMs: number): number {
  const slices = 40;
  const dz = ROTOR_DIAMETER_M / slices;
  let areaSum = 0;
  let fluxSum = 0;
  for (let i = 0; i < slices; i++) {
    const z = TIP_LOW + (i + 0.5) * dz;
    const area = 2 * Math.sqrt(R * R - (z - HUB_HEIGHT_M) ** 2) * dz;
    areaSum += area;
    fluxSum += area * windAtHeight(hubWindMs, z) ** 3;
  }
  return Math.cbrt(fluxSum / areaSum);
}

/** Height (y) vs wind speed (x) with the rotor disk shaded. */
function ProfileChart({ hubWindMs }: { hubWindMs: number }) {
  const W = 328;
  const H = 170;
  const pad = { l: 34, r: 44, t: 8, b: 20 };
  const zMax = 300;
  // x-axis spans the profile itself (not from 0) so shear is visible.
  const uMin = Math.max(0, Math.floor(windAtHeight(hubWindMs, 10)) - 1);
  const uMax = Math.ceil(windAtHeight(hubWindMs, zMax)) + 1;
  const x = (u: number) => pad.l + ((u - uMin) / (uMax - uMin)) * (W - pad.l - pad.r);
  const y = (z: number) => H - pad.b - (z / zMax) * (H - pad.t - pad.b);
  const curve = Array.from({ length: 30 }, (_, i) => {
    const z = 10 + (i / 29) * (zMax - 10);
    return `${i ? "L" : "M"}${x(windAtHeight(hubWindMs, z)).toFixed(1)},${y(z).toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Vertical wind profile">
      {/* Rotor disk band */}
      <rect x={pad.l} y={y(TIP_HIGH)} width={W - pad.l - pad.r} height={y(TIP_LOW) - y(TIP_HIGH)} fill="#3b82f6" opacity={0.08} />
      <text x={W - pad.r + 4} y={y(TIP_HIGH) + 9} fontSize={9} fill="#6b7490">tip {TIP_HIGH} m</text>
      <text x={W - pad.r + 4} y={y(TIP_LOW) - 2} fontSize={9} fill="#6b7490">tip {TIP_LOW} m</text>
      {/* Hub line */}
      <line x1={pad.l} x2={W - pad.r} y1={y(HUB_HEIGHT_M)} y2={y(HUB_HEIGHT_M)} stroke="#6b7490" strokeDasharray="3 3" />
      <text x={W - pad.r + 4} y={y(HUB_HEIGHT_M) + 3} fontSize={9} fill="#9ba3b8">hub</text>
      {/* Axes */}
      {[0, 100, 200, 300].map((z) => (
        <text key={z} x={pad.l - 6} y={y(z) + 3} fontSize={9} fill="#6b7490" textAnchor="end" fontFamily="JetBrains Mono, monospace">
          {z}
        </text>
      ))}
      {[uMin, Math.round((uMin + uMax) / 2), uMax].map((u) => (
        <text key={u} x={x(u)} y={H - 6} fontSize={9} fill="#6b7490" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
          {u}
        </text>
      ))}
      <text x={pad.l - 6} y={pad.t + 2} fontSize={8} fill="#6b7490" textAnchor="end">m</text>
      <text x={W - pad.r} y={H - 6} fontSize={8} fill="#6b7490" textAnchor="start" dx={4}>m/s</text>
      {/* Profile + range gates */}
      <path d={curve} fill="none" stroke={PROFILE_COLOR} strokeWidth={1.75} />
      {GATES.map((z) => (
        <circle key={z} cx={x(windAtHeight(hubWindMs, z))} cy={y(z)} r={z === HUB_HEIGHT_M ? 3.5 : 2.5} fill={z === HUB_HEIGHT_M ? "#e8eaf0" : PROFILE_COLOR} />
      ))}
    </svg>
  );
}

export default function LIDARDetailPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const kpis = useLandingStore(selectKPIs);
  // Upstream reference → undisturbed freestream, not the waked farm average
  const windMs = kpis.freestreamWindMs;
  const valid = windMs > 0.5;
  const rews = rotorEquivalentWind(windMs);

  return (
    <EquipmentPanel
      icon={Radar}
      tag="LIDAR-MM-01"
      subtitle="Floating LiDAR buoy · ZX 300M · independent wind reference"
      status={valid ? { label: "Valid", color: NORMAL } : { label: "Standby", color: "#9ba3b8" }}
      onClose={onClose}
      action={{ label: "Open Wind Resource (P1)", onClick: () => navigate("/wind-resource") }}
      footnote="Carbon Trust OWA FLS roadmap · IEC 61400-50-2 — reference for P50 / P90 yield"
    >
      <div className="px-4 py-3 border-b border-border-primary/60">
        <div className="flex items-end justify-between">
          <HeroValue caption={`Hub height · ${HUB_HEIGHT_M} m`} value={windMs.toFixed(1)} unit="m/s" color={valid ? PROFILE_COLOR : "#9ba3b8"} />
          <div className="pb-1 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Direction</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-text-primary">
              {kpis.windDirectionDeg.toFixed(0)}°
            </div>
          </div>
        </div>
      </div>

      <PanelSection title="Vertical profile" aside={`power law α = ${SHEAR_ALPHA.toFixed(2)}`}>
        <ProfileChart hubWindMs={windMs} />
        <div className="mt-2 grid grid-cols-6 gap-1 text-center">
          {GATES.map((z) => (
            <div key={z}>
              <div className="font-mono text-[10px] text-text-muted">{z} m</div>
              <div className="font-mono text-[11px] tabular-nums text-text-primary">
                {windAtHeight(windMs, z).toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Derived (10-min)">
        <DataRow
          label="Rotor-equivalent wind (REWS)"
          value={rews.toFixed(2)}
          unit="m/s"
          hint="Speed with the same kinetic-energy flux through the rotor as the sheared profile"
        />
        <DataRow label="Turbulence intensity" value={(turbulenceIntensity(windMs) * 100).toFixed(1)} unit="%" />
        <DataRow label="3-s gust" value={gustMs(windMs).toFixed(1)} unit="m/s" hint="U · (1 + 3·TI)" />
        <DataRow label="Speed difference, lower → upper tip" value={(windAtHeight(windMs, TIP_HIGH) - windAtHeight(windMs, TIP_LOW)).toFixed(1)} unit="m/s" />
      </PanelSection>

      <PanelSection title="System health">
        <DataRow label="Data availability (30 d)" value="99.7" unit="%" color={NORMAL} />
        <DataRow label="Motion compensation" value="Active (IMU)" color={NORMAL} />
        <DataRow label="Power (solar + wind + fuel cell)" value="98" unit="%" color={NORMAL} />
        <DataRow label="Pre-deployment verification" value="2025-11-04" hint="Side-by-side check against a reference met mast" />
        <DataRow label="Scan" value="CW, conical 30°" />
        <DataRow label="Position" value={`${LIDAR_GEO.lat.toFixed(3)}° N  ${LIDAR_GEO.lon.toFixed(3)}° E`} />
      </PanelSection>
    </EquipmentPanel>
  );
}

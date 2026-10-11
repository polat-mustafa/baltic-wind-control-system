/**
 * Schematic view of one turbine — the live 2D side view next to the realistic
 * 3D model and the engineering drawings (style board, artboard "Turbine 3D").
 *
 * Side view: the inflow profile (power law, α = SHEAR_ALPHA) from the lower to
 * the upper blade tip, the turbine to scale (hub 150 m, D 241.35 m, shaft
 * tilt), and this rotor's wake as iso-deficit contours of the Bastankhah
 * Gaussian model with Ct(v) of the IEA 15 MW — the same wake the farm map and
 * the yield use. Downstream distance is compressed (ticks in D).
 *
 * Panel: yaw (wind from, nacelle heading, error and its last 10 minutes),
 * inflow (shear across the rotor, α, TI) and the turbines this wake reaches,
 * with what it costs them at the current wind.
 */

import { memo, useMemo } from "react";

import { REFERENCE_TURBINE } from "../../../../utils/turbineCurves";
import { useFleet } from "../../../../lib/fleet";
import { selectKPIs, selectTurbine, useLandingStore } from "../../../../store/landingStore";
import {
  HUB_HEIGHT_M,
  ROTOR_DIAMETER_M,
  SHEAR_ALPHA,
  turbineThrustCoefficient,
  turbulenceIntensity,
  v236PowerChain,
  wakePowerLossPct,
  windAtHeight,
} from "../../../../utils/landingPhysics";
import { K_STAR, velocityDeficit, wakeSigma } from "../../../../utils/wakeModel";
import { useTurbineHistory } from "../hooks/useTurbineHistory";
import { SHAFT_TILT } from "../model/layout";

const R = ROTOR_DIAMETER_M / 2;
const D = ROTOR_DIAMETER_M;
const TILT_RAD = SHAFT_TILT; // shaft tilt [rad] (model/layout)

// ── Drawing scales (viewBox 1000 × 600) ──
const PX_M = 1.5; // vertical: px per metre
const Y_SEA = 540;
const y = (z: number) => Y_SEA - z * PX_M;
const X_ROTOR = 330;
const WAKE_D = 8; // downstream extent [D]
const HX = (980 - X_ROTOR) / (WAKE_D * D); // horizontal: px per metre (compressed)
const xs = (xm: number) => X_ROTOR + xm * HX;
const ARROW_PX_PER_MS = 13;

const LEVELS = [0.4, 0.3, 0.2, 0.1, 0.05];
const YAW_BAND = 8; // ± yaw band shown on the trend [°]

/**
 * Iso-deficit contour of the Gaussian wake: half-width r(x) [m] where Δu/u = level.
 * The Gaussian is a far-wake form, undefined in the first diameter or so
 * (1 − Ct/(8(σ/D)²) < 0); the contour starts at the rotor tips and joins it
 * where it is defined. Computed to 20 D, drawn to WAKE_D.
 */
function contour(level: number, ct: number): { x: number; r: number }[] {
  const pts: { x: number; r: number }[] = [{ x: 0, r: R }];
  for (let i = 1; i <= 400; i++) {
    const x = (i / 400) * 20 * D;
    const sig = wakeSigma(x, ct);
    const arg = 1 - ct / (8 * (sig / D) ** 2);
    if (arg < 0) continue; // near wake: not described by the Gaussian
    const c = 1 - Math.sqrt(arg);
    if (c <= level) break;
    pts.push({ x, r: sig * Math.sqrt(2 * Math.log(c / level)) });
  }
  return pts;
}

const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

export const TurbineSideView = memo(function TurbineSideView({ turbineId }: { turbineId: string }) {
  const t = useLandingStore(selectTurbine(turbineId));
  const kpis = useLandingStore(selectKPIs);
  const fleet = useFleet();
  const { samples } = useTurbineHistory(turbineId);

  const wind = t?.windSpeedMs ?? kpis.averageWindSpeedMs;
  const free = kpis.freestreamWindMs;
  const windFrom = kpis.windDirectionDeg;
  const heading = t?.nacellePositionDeg ?? windFrom;
  const yawErr = wrap180(heading - windFrom);
  const ct = turbineThrustCoefficient(wind);
  const chain = v236PowerChain(t?.powerOutputMW ?? 0, wind, t?.rotorSpeedRpm ?? 0);
  const uTop = windAtHeight(wind, HUB_HEIGHT_M + R);
  const uBottom = windAtHeight(wind, HUB_HEIGHT_M - R);
  const ti = turbulenceIntensity(wind);
  const aboveRated = free >= REFERENCE_TURBINE.ratedMs;

  // Contours at a quantised Ct so they redraw only on a real change
  const ctKey = Math.round(ct * 50) / 50;
  const contours = useMemo(
    () => LEVELS.map((level) => ({ level, pts: contour(level, ctKey) })).filter((c) => c.pts.length > 1),
    [ctKey],
  );

  // The turbines this rotor's wake reaches (hub-height point value, as the farm wake model)
  const downstream = useMemo(() => {
    const me = fleet.turbines.find((x) => x.id === turbineId);
    if (!me) return [];
    const down = ((windFrom + 180) * Math.PI) / 180;
    const mLat = 111_320;
    const mLon = 111_320 * Math.cos((me.lat * Math.PI) / 180);
    return fleet.turbines
      .filter((o) => o.id !== turbineId)
      .map((o) => {
        const dN = (o.lat - me.lat) * mLat;
        const dE = (o.lon - me.lon) * mLon;
        const along = dN * Math.cos(down) + dE * Math.sin(down);
        const cross = -dN * Math.sin(down) + dE * Math.cos(down);
        const deficit = along > 0 ? velocityDeficit(along, Math.abs(cross), ctKey, K_STAR) : 0;
        return { id: o.id, distD: Math.hypot(along, cross) / D, offAxis: (Math.atan2(Math.abs(cross), along) * 180) / Math.PI, deficit };
      })
      .filter((o) => o.deficit >= 0.005)
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 4);
  }, [fleet, turbineId, windFrom, ctKey]);

  const tipTop = { x: X_ROTOR + Math.sin(TILT_RAD) * R * PX_M, y: y(HUB_HEIGHT_M + Math.cos(TILT_RAD) * R) };
  const tipBottom = { x: X_ROTOR - Math.sin(TILT_RAD) * R * PX_M, y: y(HUB_HEIGHT_M - Math.cos(TILT_RAD) * R) };
  const profileZ = [HUB_HEIGHT_M - R, HUB_HEIGHT_M - R / 2, HUB_HEIGHT_M, HUB_HEIGHT_M + R / 2, HUB_HEIGHT_M + R];

  const yawSeries = samples.map((s) => s.yawErrDeg);
  const yawMean = yawSeries.length ? yawSeries.reduce((a, b) => a + b, 0) / yawSeries.length : yawErr;

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-auto bg-bg-primary p-2 lg:flex-row">
      <div className="relative min-h-[320px] min-w-0 flex-1 rounded-md border border-border-primary bg-bg-secondary">
        {/* Readings */}
        <dl className="absolute left-2 top-2 z-10 flex gap-4 rounded-md border border-border-primary bg-bg-primary/90 px-3 py-1.5">
          {[
            ["Power", (t?.powerOutputMW ?? 0).toFixed(1), "MW"],
            ["Rotor", (t?.rotorSpeedRpm ?? 0).toFixed(2), "rpm"],
            ["Pitch", (t?.pitchAngleDeg ?? 0).toFixed(1), "°"],
            ["Yaw error", `${yawErr >= 0 ? "+" : ""}${yawErr.toFixed(1)}`, "°"],
            ["Cp", chain.cp.toFixed(2), ""],
            ["Ct", ct.toFixed(2), ""],
          ].map(([k, v, u]) => (
            <div key={k}>
              <dt className="text-xs text-text-muted">{k}</dt>
              <dd className="font-mono text-base text-text-primary">
                {v}
                {u && <span className="ml-0.5 text-xs text-text-muted">{u}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <svg viewBox="0 0 1000 660" className="h-full w-full" role="img" aria-label={`${turbineId} side view: inflow shear, rotor and wake`}>
          <defs>
            <clipPath id="above-sea">
              <rect x={0} y={0} width={xs(WAKE_D * D)} height={Y_SEA} />
            </clipPath>
          </defs>

          {/* Sea, seabed */}
          <rect x={0} y={Y_SEA} width={1000} height={660 - Y_SEA} fill="var(--color-bg-tertiary)" />
          <line x1={0} x2={1000} y1={Y_SEA} y2={Y_SEA} stroke="var(--color-border-secondary)" />
          <text x={990} y={Y_SEA - 6} textAnchor="end" fontSize={12} className="fill-text-muted">sea level</text>
          <line x1={0} x2={1000} y1={y(-45)} y2={y(-45)} stroke="var(--color-border-primary)" strokeDasharray="6 4" />
          <text x={990} y={y(-45) - 6} textAnchor="end" fontSize={12} className="fill-text-muted">seabed ≈ 45 m</text>

          {/* Wake: filled iso-deficit bands, dashed contour lines labelled at their tips */}
          <g clipPath="url(#above-sea)">
            {contours.map(({ level, pts }) => {
              // Starts at the blade tips (rotor plane tilted with the shaft); the edge along the
              // rotor is not stroked, or it reads as a second, untilted blade.
              const pt = (p: { x: number; r: number }, sign: 1 | -1) =>
                p.x === 0 ? `${(sign > 0 ? tipTop : tipBottom).x.toFixed(1)},${(sign > 0 ? tipTop : tipBottom).y.toFixed(1)}` : `${xs(p.x).toFixed(1)},${y(HUB_HEIGHT_M + sign * p.r).toFixed(1)}`;
              const upper = pts.map((p) => pt(p, 1));
              const lower = [...pts].reverse().map((p) => pt(p, -1));
              return (
                <g key={level}>
                  <polygon points={[...upper, ...lower].join(" ")} fill="var(--color-accent)" fillOpacity={0.07} />
                  <polyline points={upper.join(" ")} fill="none" stroke="var(--color-accent)" strokeOpacity={0.55} strokeDasharray="5 4" />
                  <polyline points={lower.join(" ")} fill="none" stroke="var(--color-accent)" strokeOpacity={0.55} strokeDasharray="5 4" />
                </g>
              );
            })}
          </g>
          {contours.map(({ level, pts }) => {
            const tipX = Math.min(xs(pts[pts.length - 1].x) + 4, xs(WAKE_D * D) - 44);
            if (pts[pts.length - 1].x > WAKE_D * D) return null; // reaches past the drawn range: no tip to label
            return (
              <text key={level} x={tipX} y={y(HUB_HEIGHT_M) + 4} fontSize={12} fontFamily="IBM Plex Mono, monospace" fill="var(--color-accent)">
                −{(level * 100).toFixed(0)} %
              </text>
            );
          })}

          {/* Downstream distance */}
          {Array.from({ length: WAKE_D }, (_, i) => i + 1).map((k) => (
            <g key={k}>
              <line x1={xs(k * D)} x2={xs(k * D)} y1={Y_SEA} y2={Y_SEA + 8} stroke="var(--color-text-muted)" />
              <text x={xs(k * D)} y={Y_SEA + 22} textAnchor="middle" fontSize={12} className="fill-text-muted font-mono">
                {k} D
              </text>
            </g>
          ))}
          <text x={990} y={Y_SEA + 40} textAnchor="end" fontSize={12} className="fill-text-muted">
            downstream distance compressed ×{(PX_M / HX).toFixed(1)} · heights to scale
          </text>

          {/* Inflow profile: arrow length ∝ U(z) */}
          <line x1={60} x2={60} y1={y(HUB_HEIGHT_M + R)} y2={y(HUB_HEIGHT_M - R)} stroke="var(--color-border-secondary)" />
          {profileZ.map((z) => {
            const u = windAtHeight(wind, z);
            const x2 = 60 + u * ARROW_PX_PER_MS;
            const label = z === HUB_HEIGHT_M ? `${u.toFixed(1)} m/s hub` : z === profileZ[0] || z === profileZ[4] ? u.toFixed(1) : "";
            return (
              <g key={z}>
                <line x1={60} x2={x2} y1={y(z)} y2={y(z)} stroke="var(--color-text-secondary)" strokeWidth={1.5} />
                <path d={`M${x2} ${y(z)} l-7 -4 v8 z`} fill="var(--color-text-secondary)" />
                {label && (
                  <text x={x2 + 8} y={y(z) + 4} fontSize={12} fontFamily="IBM Plex Mono, monospace" className="fill-text-primary">
                    {label}
                  </text>
                )}
              </g>
            );
          })}
          <polyline
            points={profileZ.map((z) => `${60 + windAtHeight(wind, z) * ARROW_PX_PER_MS},${y(z)}`).join(" ")}
            fill="none"
            stroke="var(--color-text-primary)"
            strokeWidth={1.5}
          />

          {/* Foundation (jacket), tower, nacelle, hub, rotor edge-on with the shaft tilt */}
          <g stroke="var(--color-text-secondary)" fill="none" strokeWidth={1.5}>
            <path d={`M${X_ROTOR + 4} ${y(-45)} L${X_ROTOR + 14} ${y(18)} M${X_ROTOR + 44} ${y(-45)} L${X_ROTOR + 34} ${y(18)} M${X_ROTOR + 6} ${y(-20)} L${X_ROTOR + 40} ${y(5)} M${X_ROTOR + 42} ${y(-20)} L${X_ROTOR + 8} ${y(5)}`} />
          </g>
          <rect x={X_ROTOR + 10} y={y(22)} width={28} height={6} fill="var(--color-text-muted)" />
          <path d={`M${X_ROTOR + 16} ${y(22)} L${X_ROTOR + 19} ${y(HUB_HEIGHT_M - 4)} L${X_ROTOR + 29} ${y(HUB_HEIGHT_M - 4)} L${X_ROTOR + 32} ${y(22)} Z`} fill="var(--color-text-secondary)" />
          <rect x={X_ROTOR + 4} y={y(HUB_HEIGHT_M + 5)} width={34} height={11} rx={2} fill="var(--color-text-primary)" />
          <circle cx={X_ROTOR} cy={y(HUB_HEIGHT_M)} r={5} fill="var(--color-text-primary)" />
          <line x1={tipBottom.x} y1={tipBottom.y} x2={tipTop.x} y2={tipTop.y} stroke="var(--color-text-primary)" strokeWidth={3} strokeLinecap="round" />
          <text x={X_ROTOR - 12} y={tipTop.y - 8} textAnchor="end" fontSize={12} className="fill-text-muted">
            tip {(HUB_HEIGHT_M + R).toFixed(0)} m
          </text>
          <text x={X_ROTOR - 12} y={tipBottom.y + 16} textAnchor="end" fontSize={12} className="fill-text-muted">
            tip {(HUB_HEIGHT_M - R).toFixed(0)} m
          </text>
          <text x={X_ROTOR + 46} y={y(HUB_HEIGHT_M) - 10} fontSize={12} className="fill-text-muted">
            hub {HUB_HEIGHT_M} m · shaft tilt {((TILT_RAD * 180) / Math.PI).toFixed(0)}°
          </text>
        </svg>
      </div>

      <aside className="w-full shrink-0 space-y-3 rounded-md border border-border-primary bg-bg-secondary p-3 text-sm lg:w-72">
        <section aria-label="Yaw">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-muted">Yaw</h3>
          <div className="flex items-center gap-3">
            <svg viewBox="-60 -60 120 120" className="h-28 w-28 shrink-0" role="img" aria-label={`Wind from ${windFrom.toFixed(0)}°, nacelle ${heading.toFixed(0)}°`}>
              <circle r={50} fill="none" stroke="var(--color-border-secondary)" />
              <text y={-53} textAnchor="middle" fontSize={10} className="fill-text-muted">N</text>
              {/* rotor axis along the nacelle heading, rotor disc across it */}
              <g transform={`rotate(${heading})`}>
                <line y1={-40} y2={14} stroke="var(--color-text-primary)" strokeWidth={3} />
                <line x1={-26} x2={26} y1={-34} y2={-34} stroke="var(--color-text-primary)" strokeWidth={3} strokeLinecap="round" />
              </g>
              {/* wind arrow: from the wind bearing toward the centre */}
              <g transform={`rotate(${windFrom})`}>
                <line y1={-58} y2={-20} stroke="var(--color-accent)" strokeWidth={2} />
                <path d="M0 -16 l-5 -9 h10 z" fill="var(--color-accent)" />
              </g>
            </svg>
            <dl className="space-y-1 font-mono text-xs">
              <div>
                <dt className="font-sans text-text-muted">Wind from</dt>
                <dd className="text-text-primary">{windFrom.toFixed(0)}°</dd>
              </div>
              <div>
                <dt className="font-sans text-text-muted">Nacelle heading</dt>
                <dd className="text-text-primary">{heading.toFixed(0)}°</dd>
              </div>
              <div>
                <dt className="font-sans text-text-muted">Yaw error</dt>
                <dd className={Math.abs(yawErr) > YAW_BAND ? "text-status-warning" : "text-text-primary"}>
                  {yawErr >= 0 ? "+" : ""}
                  {yawErr.toFixed(1)}°
                </dd>
              </div>
            </dl>
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-text-muted">
              <span>Yaw error, last 10 min</span>
              <span className="font-mono">mean {yawMean >= 0 ? "+" : ""}{yawMean.toFixed(1)}°</span>
            </div>
            <svg viewBox="0 0 240 44" className="mt-1 w-full" role="img" aria-label="Yaw error trend">
              <rect x={0} y={4} width={240} height={36} fill="var(--color-accent-muted)" />
              <line x1={0} x2={240} y1={22} y2={22} stroke="var(--color-border-secondary)" strokeDasharray="2 3" />
              {yawSeries.length > 1 && (
                <polyline
                  points={yawSeries
                    .map((v, i) => `${(240 * i) / (yawSeries.length - 1)},${22 - Math.max(-1.2, Math.min(1.2, v / YAW_BAND)) * 18}`)
                    .join(" ")}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={1.5}
                />
              )}
            </svg>
            <div className="flex justify-between text-xs text-text-muted">
              <span>±{YAW_BAND}° band</span>
              <span>now</span>
            </div>
          </div>
        </section>

        <section aria-label="Inflow" className="border-t border-border-primary pt-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-muted">Inflow</h3>
          <dl className="grid grid-cols-3 gap-2 font-mono">
            <div>
              <dt className="font-sans text-xs text-text-muted">Shear Δu</dt>
              <dd className="text-text-primary">
                {(uTop - uBottom).toFixed(1)} <span className="text-xs text-text-muted">m/s</span>
              </dd>
            </div>
            <div>
              <dt className="font-sans text-xs text-text-muted">α</dt>
              <dd className="text-text-primary">{SHEAR_ALPHA.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="font-sans text-xs text-text-muted">TI</dt>
              <dd className="text-text-primary">
                {(ti * 100).toFixed(0)} <span className="text-xs text-text-muted">%</span>
              </dd>
            </div>
          </dl>
        </section>

        <section aria-label="This rotor's wake" className="border-t border-border-primary pt-3">
          <div className="mb-2 flex flex-wrap justify-between gap-x-2">
            <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">This rotor's wake</h3>
            <span className="font-mono text-xs text-text-muted">
              Ct {ct.toFixed(2)} · k* {K_STAR}
            </span>
          </div>
          {downstream.length === 0 ? (
            <p className="text-xs text-text-muted">At {windFrom.toFixed(0)}° this wake reaches no other turbine within the farm.</p>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="text-left font-sans text-text-muted">
                  <th className="font-medium">Turbine</th>
                  <th className="font-medium">Dist.</th>
                  <th className="font-medium">Off axis</th>
                  <th className="text-right font-medium">Wind</th>
                </tr>
              </thead>
              <tbody>
                {downstream.map((d) => (
                  <tr key={d.id} className="text-text-primary">
                    <td className="py-0.5">{d.id}</td>
                    <td>{d.distD.toFixed(1)} D</td>
                    <td>{d.offAxis.toFixed(0)}°</td>
                    <td className="text-right">−{(d.deficit * 100).toFixed(1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {downstream.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              {aboveRated
                ? `At ${free.toFixed(1)} m/s the farm is above rated (${REFERENCE_TURBINE.ratedMs.toFixed(2)} m/s): a waked rotor can still reach 15 MW, so this wake costs no power now. Below rated the same deficit costs about three times as much in power.`
                : `At ${free.toFixed(1)} m/s (below rated) a ${(downstream[0].deficit * 100).toFixed(1)} % wind deficit costs ${downstream[0].id} about ${wakePowerLossPct(free, downstream[0].deficit).toFixed(1)} % of its power.`}
            </p>
          )}
          <p className="mt-1 text-xs text-text-muted">Bastankhah Gaussian wake · Katić sum · hub-height point value</p>
        </section>
      </aside>
    </div>
  );
});

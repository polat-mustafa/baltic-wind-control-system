/**
 * Day/night tint overlay for the Control Room map.
 *
 * A semi-transparent div over the map base, under the deck.gl layers. The
 * tint colour and opacity follow a compressed day cycle (24 h in ~300 s
 * simulation time).
 *
 * Timeline:
 *   06-08  dawn (amber tint, low opacity)
 *   08-17  day (no tint)
 *   17-19  dusk (amber tint, low opacity)
 *   19-06  night (blue tint, moderate opacity)
 */

import { selectEnvironment, useLandingStore } from "../../store/landingStore";

/** Compute tint RGBA from simulated hour. */
function getTint(hour: number): { color: string; opacity: number } {
  // Night core (22-04): deep blue
  if (hour >= 22 || hour < 4) {
    return { color: "10, 15, 40", opacity: 0.35 };
  }
  // Late night (04-06): fading blue
  if (hour < 6) {
    const t = (hour - 4) / 2; // 0→1
    return { color: "10, 15, 40", opacity: 0.35 * (1 - t) };
  }
  // Dawn (06-08): warm amber
  if (hour < 8) {
    const t = (hour - 6) / 2; // 0→1
    return { color: "180, 120, 40", opacity: 0.08 * (1 - t) };
  }
  // Day (08-17): transparent
  if (hour < 17) {
    return { color: "0, 0, 0", opacity: 0 };
  }
  // Dusk (17-19): warm amber
  if (hour < 19) {
    const t = (hour - 17) / 2; // 0→1
    return { color: "180, 100, 30", opacity: t * 0.1 };
  }
  // Evening (19-22): transitioning to night blue
  const t = (hour - 19) / 3; // 0→1
  return { color: "10, 15, 40", opacity: t * 0.35 };
}

export default function DayNightOverlay() {
  const env = useLandingStore(selectEnvironment);
  const { color, opacity } = getTint(env.simulatedHour);

  // Skip rendering when fully transparent (day)
  if (opacity < 0.005) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[-1]"
      style={{ backgroundColor: `rgba(${color}, ${opacity})`, transition: "background-color 2s ease" }}
    />
  );
}

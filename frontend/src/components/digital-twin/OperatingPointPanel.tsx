/**
 * Check one SCADA reading against the twin: enter a 10-min mean (wind, power, rotor
 * speed, pitch) and get the expected values, the residuals and their z-scores — the
 * same standardisation (Phase I σ per wind bin) the fleet detector runs on, but for a
 * single point, without the EWMA memory and the 1 h persistence that raise an event.
 */

import { useState } from "react";

import { checkOperatingPoint, type OperatingPointResult } from "../../services/digitalTwinApi";
import { Button } from "../ui/Button";

const input =
  "bg-bg-tertiary border border-border-secondary rounded-md px-2 py-1.5 text-sm font-mono text-right text-text-primary w-24 focus:outline-none focus:ring-1 focus:ring-accent";

function zClass(z: number | null): string {
  if (z === null) return "text-text-muted";
  const a = Math.abs(z);
  return a > 3 ? "text-status-alarm" : a > 2 ? "text-status-warning" : "text-text-primary";
}

export default function OperatingPointPanel() {
  const [wind, setWind] = useState(9.0);
  const [power, setPower] = useState(9.0);
  const [rpm, setRpm] = useState(6.4);
  const [pitch, setPitch] = useState(0.0);
  const [res, setRes] = useState<OperatingPointResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setRes(await checkOperatingPoint({ wind_speed_ms: wind, power_mw: power, rotor_speed_rpm: rpm, pitch_deg: pitch }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: number, set: (v: number) => void, step: number) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => set(Number(e.target.value))} className={input} />
    </label>
  );

  const rows = res
    ? [
        { name: "Power [MW]", measured: power, expected: res.expected_power_mw, residual: res.power_residual_mw, z: res.power_z },
        { name: "Rotor speed [rpm]", measured: rpm, expected: res.expected_rotor_speed_rpm, residual: res.rotor_speed_residual_rpm, z: res.rotor_speed_z },
        { name: "Pitch [deg]", measured: pitch, expected: res.expected_pitch_deg, residual: res.pitch_residual_deg, z: res.pitch_z },
      ]
    : [];

  return (
    <section className="bg-bg-secondary rounded-lg border border-border-primary p-4 space-y-3">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Check one SCADA reading against the twin</h3>
        <p className="text-sm text-text-secondary mt-1 max-w-3xl">
          Enter a 10-minute mean. The twin gives what a healthy turbine does at that wind, and the
          z-score says how far the reading sits from the fault-free scatter of its wind bin.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {field("Wind [m/s]", wind, setWind, 0.1)}
        {field("Power [MW]", power, setPower, 0.1)}
        {field("Rotor [rpm]", rpm, setRpm, 0.01)}
        {field("Pitch [deg]", pitch, setPitch, 0.1)}
        <Button size="sm" onClick={() => void run()} disabled={busy} className="h-[34px] px-4">
          {busy ? "Checking..." : "Check"}
        </Button>
      </div>
      {error && <p className="text-sm text-status-alarm">{error}</p>}
      {res && (
        <>
          <p className="text-sm text-text-secondary">
            <span>Control region:</span> <span className="text-text-primary">{res.region}</span>
          </p>
          <table className="text-sm">
            <thead>
              <tr className="text-text-muted">
                <th className="text-left font-medium px-2 py-1">Channel</th>
                <th className="text-right font-medium px-2 py-1">Measured</th>
                <th className="text-right font-medium px-2 py-1">Twin</th>
                <th className="text-right font-medium px-2 py-1">Residual</th>
                <th className="text-right font-medium px-2 py-1">z</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-border-primary tabular-nums">
                  <td className="px-2 py-1">{r.name}</td>
                  <td className="px-2 py-1 text-right">{r.measured.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right">{r.expected.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right">{r.residual === null ? "—" : r.residual.toFixed(2)}</td>
                  <td className={`px-2 py-1 text-right font-semibold ${zClass(r.z)}`}>{r.z === null ? "—" : r.z.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-text-muted max-w-3xl">
            |z| ≤ 2 is inside the healthy scatter, above 3 a reading a healthy turbine almost never
            gives. One reading does not raise an event: the fleet detector smooths z with an EWMA and
            needs it past its limit for an hour, so a single gust or a sensor spike passes.
          </p>
        </>
      )}
    </section>
  );
}

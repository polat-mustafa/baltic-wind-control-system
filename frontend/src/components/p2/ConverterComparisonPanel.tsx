/**
 * GFL vs GFM converter comparison panel.
 *
 * Side-by-side comparison table showing stability, voltage deviation,
 * settling time, and frequency deviation for each converter type.
 * Educational summary from backend gfm_advantage field.
 */

import { useGridStore } from "../../store/gridStore";
import { SCADA_COLORS } from "../../constants/scadaColors";

function MetricRow({
  label,
  gflValue,
  gfmValue,
  unit,
}: {
  label: string;
  gflValue: string;
  gfmValue: string;
  unit: string;
}) {
  return (
    <tr className="border-b border-slate-700">
      <td className="py-2 px-3 text-xs text-slate-400">{label}</td>
      <td className="py-2 px-3 text-sm text-center font-mono">{gflValue} {unit}</td>
      <td className="py-2 px-3 text-sm text-center font-mono">{gfmValue} {unit}</td>
    </tr>
  );
}

export default function ConverterComparisonPanel() {
  const { converterComparison } = useGridStore();

  if (!converterComparison) return null;

  const { gfl_result: gfl, gfm_result: gfm, gfm_advantage } = converterComparison;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">
        Converter Comparison — {converterComparison.scenario.replace("_", " ")} (SCR = {gfl.scr})
      </h3>

      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-600">
            <th className="py-2 px-3 text-xs text-slate-400 font-semibold">Metric</th>
            <th className="py-2 px-3 text-xs text-center font-semibold" style={{ color: SCADA_COLORS.WARNING }}>
              GFL (PLL)
            </th>
            <th className="py-2 px-3 text-xs text-center font-semibold" style={{ color: SCADA_COLORS.ENERGIZED }}>
              GFM (VSM)
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-700">
            <td className="py-2 px-3 text-xs text-slate-400">Stable</td>
            <td className="py-2 px-3 text-sm text-center">
              <span
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{
                  backgroundColor: gfl.stable ? "rgba(0,255,0,0.12)" : "rgba(255,0,0,0.12)",
                  color: gfl.stable ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.FAULT,
                }}
              >
                {gfl.stable ? "YES" : "NO"}
              </span>
            </td>
            <td className="py-2 px-3 text-sm text-center">
              <span
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{
                  backgroundColor: gfm.stable ? "rgba(0,255,0,0.12)" : "rgba(255,0,0,0.12)",
                  color: gfm.stable ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.FAULT,
                }}
              >
                {gfm.stable ? "YES" : "NO"}
              </span>
            </td>
          </tr>
          <MetricRow
            label="Voltage Deviation"
            gflValue={gfl.voltage_deviation_pu.toFixed(4)}
            gfmValue={gfm.voltage_deviation_pu.toFixed(4)}
            unit="pu"
          />
          <MetricRow
            label="Settling Time"
            gflValue={gfl.settling_time_s.toFixed(3)}
            gfmValue={gfm.settling_time_s.toFixed(3)}
            unit="s"
          />
          <MetricRow
            label="Frequency Deviation"
            gflValue={gfl.frequency_deviation_hz.toFixed(4)}
            gfmValue={gfm.frequency_deviation_hz.toFixed(4)}
            unit="Hz"
          />
        </tbody>
      </table>

      {/* Educational summary */}
      <div className="mt-3 p-3 bg-slate-900/50 rounded border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
          GFM Advantage
        </p>
        <p className="text-xs text-slate-300 leading-relaxed">
          {gfm_advantage}
        </p>
      </div>
    </div>
  );
}

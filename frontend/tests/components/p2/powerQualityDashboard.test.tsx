/**
 * Power Quality tab — requests follow the controls, KPIs show the backend's verdicts.
 */

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PowerQualityDashboard from "../../../src/components/p2/PowerQualityDashboard";
import * as api from "../../../src/services/powerQualityApi";
import { TYPICAL_EMISSION, usePowerQualityStore } from "../../../src/store/powerQualityStore";
import type { HarmonicAnalysisResponse, ResonanceScanResponse } from "../../../src/types/powerQuality";

vi.mock("../../../src/services/powerQualityApi");
vi.mock("react-plotly.js", () => ({ default: () => null }));

const harmonics: HarmonicAnalysisResponse = {
  thd_voltage_pct: 1.82,
  thd_current_pct: 1.6,
  dominant_harmonic_order: 17,
  dominant_harmonic_pct: 1.49,
  harmonics: [
    { order: 17, frequency_hz: 850, current_pct: 0.5, magnitude_pct: 1.49, voltage_66kv_pct: 1.49, impedance_ohm: 296, limit_pct: 1.2, utilisation_pct: 124, exceeds_limit: true },
  ],
  compliant: false,
  voltage_level: "HV",
  bus: "OSS 66 kV",
  thd_limit_pct: 3,
  worst_utilisation_pct: 124,
  violations: ["H17: 1.49 % > 1.20 %"],
  assessment: "FAIL",
};
const resonance: ResonanceScanResponse = {
  frequencies_hz: [50, 870, 900],
  impedances_ohm: [2.6, 1294, 300],
  resonance_points: [{ frequency_hz: 870, impedance_ohm: 1294, harmonic_order: 17.4, amplification: 28.5, risk_level: "HIGH" }],
  cable_resonant_freq_hz: 165,
  critical_harmonics: [17],
  viewpoint: "OSS 66 kV",
  assessment: "HIGH — h17 sit near a weakly damped resonance",
};

beforeEach(() => {
  vi.clearAllMocks();
  usePowerQualityStore.setState({ bus: 66, emissionScale: 2, gridSscMva: 10000, harmonics: null, resonance: null, flicker: null });
  vi.mocked(api.analyzeHarmonics).mockResolvedValue(harmonics);
  vi.mocked(api.runResonanceScan).mockResolvedValue(resonance);
  vi.mocked(api.computeFlicker).mockResolvedValue({
    pst: 0.0017, plt: 0.0017, pst_limit: 0.8, plt_limit: 0.6, pst_compliant: true, plt_compliant: true,
    pst_continuous: 0.0017, pst_switching: 0.0003, flicker_coefficient: 0.18, switching_coefficient: 0.037,
    dominant_source: "CONTINUOUS_OPERATION", assessment: "PASS",
  });
  vi.mocked(api.designFilter).mockResolvedValue({
    harmonic_order: 17, tuned_frequency_hz: 824.5, capacitor_mvar: 10, capacitor_uf: 7.3, reactor_mh: 5.1,
    reactor_resistance_ohm: 0.53, quality_factor: 50, insertion_loss_db: 44.9, reactive_contribution_mvar: 10,
    estimated_loss_kw: 4, network_impedance_ohm: 296, assessment: "GOOD",
  });
});

describe("PowerQualityDashboard", () => {
  it("scales the emission, assesses the chosen bus and shows the verdicts", async () => {
    vi.useFakeTimers();
    render(<PowerQualityDashboard />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    vi.useRealTimers();
    const req = vi.mocked(api.analyzeHarmonics).mock.calls[0][0];
    expect(req.voltage_kv).toBe(66);
    expect(req.harmonic_magnitudes[17]).toBeCloseTo(TYPICAL_EMISSION[17] * 2);
    expect(screen.getAllByText("h17").length).toBeGreaterThan(0);
    expect(screen.getByText(/124 % of the planning level/)).toBeTruthy();
    expect(screen.getByText(/amplification ×29/)).toBeTruthy();
  });
});

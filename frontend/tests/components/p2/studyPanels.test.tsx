/**
 * Converter-stability and earth-fault panels: the request follows the controls
 * (debounced), and the verdict, margins, THD table and method text are shown.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ConverterStabilityPanel from "../../../src/components/p2/ConverterStabilityPanel";
import EarthFaultPanel from "../../../src/components/p2/EarthFaultPanel";
import * as pq from "../../../src/services/powerQualityApi";
import * as prot from "../../../src/services/protectionApi";
import type { ConverterStabilityResponse } from "../../../src/types/powerQuality";
import type { EarthFaultStudy } from "../../../src/types/protection";

vi.mock("../../../src/services/powerQualityApi");
vi.mock("../../../src/services/protectionApi");
vi.mock("react-plotly.js", () => ({ default: () => null }));

const stability: ConverterStabilityResponse = {
  lcl_resonance_hz: 1450.2,
  non_passive_from_hz: 830,
  damping_r_pu: 0.0244,
  standalone_stable: true,
  standalone_vector_margin: 0.61,
  stable: true,
  unstable_poles: 0,
  vector_margin: 0.42,
  vector_margin_hz: 1210,
  phase_margin_deg: 38,
  phase_margin_hz: 980,
  loci_hz: [100, 1000],
  loci_min_distance: [0.9, 0.42],
  thd_norton_pct: { "PSE 400 kV (POC)": 0.8, "OSS 66 kV A": 2.4 },
  thd_ideal_sources_pct: { "PSE 400 kV (POC)": 0.6, "OSS 66 kV A": 3.1 },
  thd_limit_pct: { "PSE 400 kV (POC)": 2, "OSS 66 kV A": 3 },
  harmonics: [],
  assumptions: ["PLL and the 50 Hz resonant controller omitted (valid from ~100 Hz up)", "Converter: typical values"],
};

const earth: EarthFaultStudy = {
  fault_location: "string_feeder",
  fault_type: "1ph",
  fault_resistance_ohm: 0,
  ik1_max_ka: 0.42,
  ik1_min_ka: 0.38,
  fault_current_a: 380,
  ner_ohm: 100,
  relay_sequence: [
    { relay_id: "PTOC-01N", relay_location: "String feeder", role: "main", trip_time_ms: 230, clearance_time_ms: 290, fault_current_multiple: 0, operated: true },
    { relay_id: "PTOC-02N", relay_location: "Incomer", role: "backup", trip_time_ms: 630, clearance_time_ms: 690, fault_current_multiple: 0, operated: true },
  ],
  settings: [
    { setting_id: "PTOC-01N", description: "String feeder earth fault — core-balance CT, 60 A, DT 0.2 s", pickup_a: 60, time_delay_s: 0.2, location: "String feeder" },
    { setting_id: "PTOC-02N", description: "NER / incomer earth fault (backup) — 120 A, DT 0.6 s", pickup_a: 120, time_delay_s: 0.6, location: "Incomer" },
  ],
  healthy_feeder_capacitive_a: [40.1, 45.2],
  no_sympathetic_trip: true,
  backup_margin_ms: 400,
  selective: true,
  ner_within_rating: true,
  max_detectable_resistance_ohm: 520,
  assessment: "PASS",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(pq.runConverterStability).mockResolvedValue(stability);
  vi.mocked(prot.getEarthFaultStudy).mockResolvedValue(earth);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ConverterStabilityPanel", () => {
  it("runs the study after the debounce and shows verdict, margins, THD and assumptions", async () => {
    render(<ConverterStabilityPanel />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(pq.runConverterStability).toHaveBeenCalledWith({ f_sw_hz: 2500, bandwidth_hz: 250, c_filter_pu: 0.08 });
    expect(screen.getByText("stable")).toBeTruthy();
    expect(screen.getByText("0.42")).toBeTruthy();
    expect(screen.getByText("OSS 66 kV A")).toBeTruthy();
    expect(screen.getByText("3.10")).toBeTruthy();
    expect(screen.getByText("Converter: typical values")).toBeTruthy();
  });

  it("switching the damping resistor off sends damping_r_pu = 0", async () => {
    render(<ConverterStabilityPanel />);
    fireEvent.click(screen.getByLabelText("Damping resistor off"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(pq.runConverterStability).toHaveBeenCalledTimes(1);
    expect(pq.runConverterStability).toHaveBeenLastCalledWith({ f_sw_hz: 2500, bandwidth_hz: 250, c_filter_pu: 0.08, damping_r_pu: 0 });
  });
});

describe("EarthFaultPanel", () => {
  it("shows the 51N stages and the checks", async () => {
    render(<EarthFaultPanel />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(prot.getEarthFaultStudy).toHaveBeenCalledWith(0);
    expect(screen.getByText("PASS")).toBeTruthy();
    expect(screen.getByText("String feeder earth fault — core-balance CT, 60 A, DT 0.2 s")).toBeTruthy();
    expect(screen.getByText("NER cleared within its 10 s short-time rating")).toBeTruthy();
  });

  it("shows the backend's error instead of the results", async () => {
    vi.mocked(prot.getEarthFaultStudy).mockRejectedValue(new Error("Bad Gateway"));
    render(<EarthFaultPanel />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByRole("alert").textContent).toContain("Bad Gateway");
  });
});

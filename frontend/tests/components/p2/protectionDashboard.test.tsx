/**
 * Protection tab — the study request follows the controls, the verdict
 * panel reflects the backend's checks, and a TMS change is PUT first.
 */

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProtectionDashboard from "../../../src/components/p2/ProtectionDashboard";
import * as api from "../../../src/services/protectionApi";
import { useProtectionStore } from "../../../src/store/protectionStore";
import type { CoordinationStudyResponse } from "../../../src/types/protection";

vi.mock("../../../src/services/protectionApi");
vi.mock("react-plotly.js", () => ({ default: () => null }));

const study: CoordinationStudyResponse = {
  study_id: "s1",
  fault_location: "string_feeder",
  fault_current_ka: 21.42,
  fault_current_description: "66 kV string feeder (OSS end) — 21.4 kA 3-phase",
  relay_sequence: [
    { relay_id: "PTOC-01", relay_location: "String feeder", role: "main", trip_time_ms: 235.9, clearance_time_ms: 295.9, fault_current_multiple: 17.85, operated: true },
    { relay_id: "PTOC-02", relay_location: "Incomer", role: "backup", trip_time_ms: 578.3, clearance_time_ms: 638.3, fault_current_multiple: 5.95, operated: true },
  ],
  first_relay: "PTOC-01",
  first_relay_time_ms: 235.9,
  main_relay: "PTOC-01",
  main_clearance_ms: 295.9,
  backup_margin_ms: 342.4,
  position_pct: null,
  fault_type: "3ph",
  voltage_kv: 66,
  selective: true,
  fast_enough: true,
  time_limit_s: 28.5,
  time_criterion: "head-cable I²t withstand",
  fully_graded: true,
  grading_results: [
    { pair_id: "GP-001", downstream_id: "PTOC-01", upstream_id: "PTOC-02", downstream_delay_s: 0.236, upstream_delay_s: 0.578, actual_margin_ms: 342.4, required_margin_ms: 300, selective: true },
  ],
  grading_violations: 0,
  tcc_data: null,
  assessment: "PASS",
  created_at: "2026-10-02T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  useProtectionStore.setState({ study: null, relays: [], faultLocation: "export_cable", positionPct: 70, faultType: "3ph" });
  vi.mocked(api.getRelays).mockResolvedValue([]);
  vi.mocked(api.runCoordinationStudy).mockResolvedValue(study);
  vi.mocked(api.updateRelaySettings).mockResolvedValue({} as Awaited<ReturnType<typeof api.updateRelaySettings>>);
});

describe("ProtectionDashboard", () => {
  it("requests the study for the chosen location and shows the verdict", async () => {
    vi.useFakeTimers();
    render(<ProtectionDashboard />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    vi.useRealTimers();
    expect(api.runCoordinationStudy).toHaveBeenCalledWith(
      expect.objectContaining({ fault_location: "export_cable", position_pct: 70, fault_type: "3ph" }),
    );
    expect(screen.getByText("✓ Protection adequate")).toBeTruthy();
    expect(screen.getByText(/Backup 342 ms behind/)).toBeTruthy();
    expect(screen.getByText(/Head cable withstands 28.5 s/)).toBeTruthy();
  });

  it("a TMS change is sent to the relay before re-running the study", async () => {
    await useProtectionStore.getState().setTms("PTOC-02", 0.05);
    expect(api.updateRelaySettings).toHaveBeenCalledWith("PTOC-02", { tms: 0.05 });
    expect(api.runCoordinationStudy).toHaveBeenCalled();
  });
});

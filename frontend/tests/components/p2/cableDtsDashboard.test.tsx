/**
 * Cable DTS tab — requests follow the controls and the KPIs show the
 * backend's verdicts (route rating, N-1 time to 90 °C).
 */

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CableDTSDashboard from "../../../src/components/p2/CableDTSDashboard";
import * as api from "../../../src/services/cableDtsApi";
import { useCableDTSStore } from "../../../src/store/cableDtsStore";

vi.mock("../../../src/services/cableDtsApi");
vi.mock("react-plotly.js", () => ({ default: () => null }));

const zone = (name: string, start: number, end: number, rating: number) => ({
  name,
  start_km: start,
  end_km: end,
  r_ext_k_m_per_w: 2.92,
  max_conductor_c: 56.1,
  max_fibre_c: 50.3,
  rating_a: rating,
});

beforeEach(() => {
  vi.clearAllMocks();
  useCableDTSStore.setState({ currentA: 760, ambientC: 15, emergencyA: 1355, profile: null, transient: null });
  vi.mocked(api.getDTSProfile).mockResolvedValue({
    current_a: 760,
    ambient_temp_c: 15,
    cable_length_km: 45,
    profile: [{ distance_km: 0.05, zone: "OSS J-tube", fibre_temp_c: 50.3, conductor_temp_c: 56.1 }],
    zones: [zone("OSS J-tube", 0, 0.3, 856), zone("Subsea burial", 0.3, 31, 1099)],
    max_conductor_c: 56.1,
    max_location_km: 0.05,
    alarm_length_km: 0,
    joule_loss_w_per_m: 11.3,
    dielectric_loss_w_per_m: 0.96,
    static_rating_a: 825,
    rating_at_ambient_a: 856,
    limiting_zone: "OSS J-tube",
    export_capability_mva: 724,
    rating_curve: { ambient_c: [0, 30], zones: [{ name: "OSS J-tube", rating_a: [1040, 840] }] },
    assessment: "NORMAL — hottest 56.1 °C in the OSS J-tube (0.1 km)",
  });
  vi.mocked(api.simTransient).mockResolvedValue({
    prefault_current_a: 760,
    emergency_current_a: 1355,
    ambient_temp_c: 15,
    time_h: [0, 24],
    zones: [{ name: "OSS J-tube", tau_ext_h: 20, conductor_temp_c: [56.1, 150], minutes_to_limit: 471.5, steady_state_c: 228 }],
    allowed_minutes: 471.5,
    limiting_zone: "OSS J-tube",
    assessment: "OSS J-tube reaches 90 °C after 472 min at 1355 A — curtail before then",
  });
});

describe("CableDTSDashboard", () => {
  it("runs both studies and shows the verdicts", async () => {
    vi.useFakeTimers();
    render(<CableDTSDashboard />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    vi.useRealTimers();

    expect(api.getDTSProfile).toHaveBeenCalledWith(760, 15);
    expect(vi.mocked(api.simTransient).mock.calls[0][0]).toEqual({ prefault_current_a: 760, emergency_current_a: 1355, ambient_temp_c: 15 });
    expect(screen.getByText("56.1")).toBeTruthy();
    expect(screen.getByText("724")).toBeTruthy();
    expect(screen.getByText("7 h 52 min")).toBeTruthy();
    expect(screen.getByText("set by the OSS J-tube · 825 A at 20 °C (datasheet)")).toBeTruthy();
  });
});

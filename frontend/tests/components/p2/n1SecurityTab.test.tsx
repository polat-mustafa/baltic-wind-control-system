/**
 * N-1 Security tab — the request follows the output slider and the KPIs show
 * the backend's study.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdvancedAnalysisTab from "../../../src/components/p2/AdvancedAnalysisTab";
import * as apiClient from "../../../src/services/apiClient";
import { elementName, useN1Store } from "../../../src/store/n1SecurityStore";
import type { N1State } from "../../../src/types/n1Security";

vi.mock("react-plotly.js", () => ({ default: () => null }));

const state = (loading: number, output: number, el = "Export_220kV"): N1State => ({
  limiting_element: el,
  loading_pct: loading,
  v_min_pu: 0.998,
  v_max_pu: 1.004,
  output_mw: output,
  export_mw: output - 6,
  statcom_q_mvar: 50,
  secure: loading <= 100,
});

beforeEach(() => {
  vi.restoreAllMocks();
  useN1Store.setState({ generation_fraction: 1, study: null, error: null });
  vi.spyOn(apiClient, "post").mockResolvedValue({
    generation_fraction: 1,
    grid_ssc_mva: 10000,
    base_case: state(87.5, 510, "Array_S1_T1"),
    contingencies: [
      { id: "string_1", label: "String 1 (6 WTGs)", kind: "preventive", converged: true, immediate: state(86.8, 420), after_action: state(86.8, 420), lost_mw: 90, runback_mw: 0, runback_s: 0, secure: true, output_scale: 1 },
      { id: "export_circuit", label: "Export circuit 1", kind: "corrective", converged: true, immediate: state(142.6, 510), after_action: state(99.6, 342.7), lost_mw: 0, runback_mw: 167.3, runback_s: 16.4, secure: true, output_scale: 0.67 },
    ],
    n1_secure: true,
    firm_output_mw: 342.7,
    runback_mw_per_s: 10.2,
    voltage_band_pu: [0.95, 1.05],
  });
});

const flush = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
};

describe("N-1 Security tab", () => {
  it("runs the study and follows the output slider", async () => {
    vi.useFakeTimers();
    render(<AdvancedAnalysisTab />);
    await flush();

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/grid/security/n1", { generation_fraction: 1, grid_ssc_mva: 10000 });
    expect(screen.getByText("Secure")).toBeTruthy();
    expect(screen.getByText("343")).toBeTruthy();
    expect(screen.getByText("167")).toBeTruthy();

    fireEvent.change(screen.getByRole("slider"), { target: { value: "0.5" } });
    await flush();
    vi.useRealTimers();
    expect(vi.mocked(apiClient.post).mock.lastCall?.[1]).toMatchObject({ generation_fraction: 0.5 });
  });

  it("names the pandapower elements", () => {
    expect(elementName("Array_S2_T1")).toBe("string 2 head cable");
    expect(elementName("Trafo_66_220kV")).toBe("OSS transformer");
  });
});

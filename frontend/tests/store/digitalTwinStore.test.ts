/**
 * Tests for the Digital Twin store: defaults, run → detail chaining,
 * stale-response handling and error reporting (API mocked).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../src/services/digitalTwinApi";
import type { AnalyzeResponse, TurbineDetail, TurbineSummary } from "../../src/services/digitalTwinApi";
import { useDigitalTwinStore } from "../../src/store/digitalTwinStore";

vi.mock("../../src/services/digitalTwinApi");
const mockApi = vi.mocked(api);

function turbine(id: number, hi: number): TurbineSummary {
  return {
    turbine_id: id,
    name: `WTG-${String(id + 1).padStart(2, "0")}`,
    status: hi < 40 ? "alarm" : hi < 70 ? "alert" : "normal",
    health_index: hi,
    channel_health: { power: hi, rotor_speed: 100, pitch: 100, gearbox_temp: 100, anemometer: 100 },
    worst_channel: "power",
    event_count: 0,
    active_event_count: 0,
    first_detection: null,
    last_evidence: null,
    diagnosis: null,
    prognosis: null,
    actual_energy_mwh: 100,
    potential_energy_mwh: 100,
    lost_energy_mwh: 0,
  };
}

function analysis(seed = 42): AnalyzeResponse {
  return {
    scenario: "combined",
    title: "Combined faults",
    duration_days: 7,
    seed,
    start: 1_736_726_400,
    sample_period_s: 600,
    num_samples: 1008,
    farm: {
      fleet_health_index: 90,
      min_health_index: 30,
      normal_count: 2,
      alert_count: 0,
      alarm_count: 1,
      diagnosed_count: 1,
      active_events: 1,
      total_events: 1,
      actual_energy_mwh: 300,
      potential_energy_mwh: 310,
      lost_energy_mwh: 10,
      energy_performance_pct: 96.8,
    },
    turbines: [turbine(0, 95), turbine(1, 30), turbine(2, 88)],
    events: [],
    health_trend: { timestamps: [], health: [] },
    ambient: { timestamps: [], temperature_c: [], humidity_pct: [], farm_wind_ms: [] },
    validation: { rows: [], injected: 0, detected: 0, isolated: 0, false_events: 0, mean_delay_hours: null },
  };
}

function detail(id: number): TurbineDetail {
  return {
    turbine: turbine(id, 50),
    timestamps: [],
    wind_ms: [],
    channels: [],
    health: [],
    in_event: [],
    severity_trend: [],
    truth: [],
    power_curve_wind_ms: [],
    power_curve_mw: [],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  useDigitalTwinStore.setState({
    farm: "sb510", // farmKey() without an own project
    analysis: null,
    detail: null,
    scenario: "combined",
    durationDays: 7,
    seed: 42,
    tab: "fleet",
    selectedTurbineId: null,
    loading: false,
    detailLoading: false,
    error: null,
  });
});

describe("defaults", () => {
  it("starts on the combined 7-day case, fleet tab", () => {
    const s = useDigitalTwinStore.getState();
    expect(s.scenario).toBe("combined");
    expect(s.durationDays).toBe(7);
    expect(s.seed).toBe(42);
    expect(s.tab).toBe("fleet");
    expect(s.analysis).toBeNull();
  });

  it("sanitises the seed", () => {
    useDigitalTwinStore.getState().setSeed(-3.7);
    expect(useDigitalTwinStore.getState().seed).toBe(0);
    useDigitalTwinStore.getState().setSeed(Number.NaN);
    expect(useDigitalTwinStore.getState().seed).toBe(0);
    useDigitalTwinStore.getState().setSeed(12.4);
    expect(useDigitalTwinStore.getState().seed).toBe(12);
  });
});

describe("runAnalysis", () => {
  it("runs with the current parameters and opens the worst turbine's detail", async () => {
    mockApi.postAnalyze.mockResolvedValue(analysis());
    mockApi.postTurbineDetail.mockImplementation(async ({ turbine_id }) => detail(turbine_id));
    useDigitalTwinStore.getState().setDurationDays(14);

    await useDigitalTwinStore.getState().runAnalysis();

    expect(mockApi.postAnalyze).toHaveBeenCalledWith({ scenario: "combined", duration_days: 14, seed: 42 });
    const s = useDigitalTwinStore.getState();
    expect(s.loading).toBe(false);
    expect(s.selectedTurbineId).toBe(1); // lowest health index
    expect(s.tab).toBe("fleet"); // auto-selection does not switch tabs
    expect(s.detail?.turbine.turbine_id).toBe(1);
  });

  it("keeps a turbine the user already selected", async () => {
    mockApi.postAnalyze.mockResolvedValue(analysis());
    mockApi.postTurbineDetail.mockImplementation(async ({ turbine_id }) => detail(turbine_id));
    useDigitalTwinStore.setState({ selectedTurbineId: 2 });

    await useDigitalTwinStore.getState().runAnalysis();
    expect(useDigitalTwinStore.getState().detail?.turbine.turbine_id).toBe(2);
  });

  it("drops a selection that is not in the new farm", async () => {
    mockApi.postAnalyze.mockResolvedValue(analysis());
    mockApi.postTurbineDetail.mockImplementation(async ({ turbine_id }) => detail(turbine_id));
    useDigitalTwinStore.setState({ selectedTurbineId: 20 });

    await useDigitalTwinStore.getState().runAnalysis();
    expect(useDigitalTwinStore.getState().detail?.turbine.turbine_id).toBe(1); // worst of 3
  });

  it("clears the run and model card of another farm", async () => {
    mockApi.getModelCard.mockResolvedValue({} as never);
    mockApi.getReferenceCurve.mockResolvedValue({} as never);
    useDigitalTwinStore.setState({ farm: "another-farm", analysis: analysis(), selectedTurbineId: 2, modelCard: {} as never });

    await useDigitalTwinStore.getState().loadModel();
    const s = useDigitalTwinStore.getState();
    expect(s).toMatchObject({ farm: "sb510", analysis: null, selectedTurbineId: null });
    expect(mockApi.getModelCard).toHaveBeenCalled(); // refetched for this farm
  });

  it("reports API errors", async () => {
    mockApi.postAnalyze.mockRejectedValue(new Error("backend down"));
    await useDigitalTwinStore.getState().runAnalysis();
    const s = useDigitalTwinStore.getState();
    expect(s.error).toBe("backend down");
    expect(s.loading).toBe(false);
  });
});

describe("selectTurbine", () => {
  it("drops a detail response that arrives after a newer selection", async () => {
    useDigitalTwinStore.setState({ analysis: analysis() });
    let releaseFirst: (d: TurbineDetail) => void = () => undefined;
    mockApi.postTurbineDetail
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockImplementationOnce(async () => detail(2));

    const first = useDigitalTwinStore.getState().selectTurbine(0);
    await useDigitalTwinStore.getState().selectTurbine(2);
    releaseFirst(detail(0));
    await first;

    const s = useDigitalTwinStore.getState();
    expect(s.selectedTurbineId).toBe(2);
    expect(s.detail?.turbine.turbine_id).toBe(2);
    expect(s.tab).toBe("turbine");
  });
});

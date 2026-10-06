/**
 * Academy page: course map, mission deep link, the energisation sequence
 * end to end, and the diagnosis mission graded against the ground truth.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as twinApi from "../../../src/services/digitalTwinApi";
import AcademyPage from "../../../src/pages/AcademyPage";
import { ENERGISATION } from "../../../src/academy/sequence";
import { MISSIONS } from "../../../src/academy/courses";
import { useAcademyStore } from "../../../src/store/academyStore";

vi.mock("../../../src/services/digitalTwinApi", async (orig) => ({
  ...(await orig<typeof import("../../../src/services/digitalTwinApi")>()),
  postAnalyze: vi.fn(),
}));
vi.mock("../../../src/services/windResourceApi", () => ({ computeWindRose: vi.fn(() => Promise.reject(new Error("offline"))) }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AcademyPage />
    </MemoryRouter>,
  );

function twinRun(): twinApi.AnalyzeResponse {
  const health = { power: 100, rotor_speed: 100, pitch: 100, gearbox_temp: 100, anemometer: 100 };
  const turbine = (id: number, h = health) => ({
    turbine_id: id,
    name: `WTG-${String(id).padStart(2, "0")}`,
    status: "normal",
    health_index: Math.min(...Object.values(h)),
    channel_health: h,
    worst_channel: "power",
    event_count: 0,
    active_event_count: 0,
    first_detection: null,
    last_evidence: null,
    diagnosis: null,
    prognosis: null,
    actual_energy_mwh: 0,
    potential_energy_mwh: 0,
    lost_energy_mwh: 0,
  });
  return {
    scenario: "gearbox_degradation",
    title: "Gearbox degradation",
    turbines: [turbine(11), turbine(12, { ...health, gearbox_temp: 0 })],
    events: [{ turbine_id: 12, turbine_name: "WTG-12", channel: "gearbox_temp", level: "alarm", direction: "high" }],
    ambient: { timestamps: [0], temperature_c: [8], humidity_pct: [80], farm_wind_ms: [9] },
    validation: {
      rows: [{ turbine_name: "WTG-12", injected_kind: "gearbox_loss" }],
      injected: 1,
      detected: 1,
      isolated: 1,
      false_events: 0,
      mean_delay_hours: 20,
    },
  } as unknown as twinApi.AnalyzeResponse;
}

describe("AcademyPage", () => {
  beforeEach(() => {
    localStorage.clear();
    useAcademyStore.getState().reset();
  });

  it("shows the four tracks with every mission", () => {
    renderAt("/academy");
    for (const t of ["Develop", "Design", "Build", "Operate"]) expect(screen.getAllByText(new RegExp(t)).length).toBeGreaterThan(0);
    for (const m of MISSIONS) expect(screen.getByRole("button", { name: new RegExp(m.title) })).toBeTruthy();
  });

  it("marks a lesson as opened", () => {
    renderAt("/academy");
    fireEvent.click(screen.getAllByRole("button", { name: /Weibull/i })[0]);
    expect(useAcademyStore.getState().lessons.length).toBe(1);
  });

  it("runs the energisation sequence and records the score", () => {
    renderAt("/academy?mission=energisation-sequence");
    expect(screen.getByRole("heading", { name: "First energisation" })).toBeTruthy();
    // one wrong pick first
    fireEvent.click(screen.getByRole("button", { name: ENERGISATION[3].title }));
    expect(screen.getByRole("alert").textContent).toMatch(/Not yet/);
    for (const s of ENERGISATION) fireEvent.click(screen.getByRole("button", { name: s.title }));
    const a = useAcademyStore.getState().attempts.at(-1)!;
    expect(a).toMatchObject({ mission: "energisation-sequence", score: 85 });
  });

  it("grades a diagnosis against the injected fault", async () => {
    vi.mocked(twinApi.postAnalyze).mockResolvedValue(twinRun());
    renderAt("/academy?mission=twin-diagnosis");
    fireEvent.click(screen.getByRole("button", { name: /Start a case/ }));
    await waitFor(() => screen.getByLabelText("Flag WTG-12"));
    fireEvent.click(screen.getByLabelText("Flag WTG-12"));
    fireEvent.change(screen.getByLabelText("Fault on WTG-12"), { target: { value: "gearbox_loss" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit diagnosis/ }));
    const card = screen.getAllByRole("status").at(-1)!;
    expect(within(card).getByText("100")).toBeTruthy();
    expect(useAcademyStore.getState().attempts.at(-1)).toMatchObject({ mission: "twin-diagnosis", score: 100 });
  });

  it("asks for a site before grading the site mission", () => {
    renderAt("/academy?mission=site-selection");
    expect(screen.getByRole("link", { name: /Open Site & Permits/ }).getAttribute("href")).toBe("/develop");
  });

  it("prints the training record view", () => {
    useAcademyStore.getState().record({ mission: "frt-compliance", score: 80, detail: "4 of 5 verdicts right" });
    renderAt("/academy?view=record");
    expect(screen.getByText(/not a certificate of competence/)).toBeTruthy();
    expect(screen.getByText(/4 of 5 verdicts right/)).toBeTruthy();
  });
});

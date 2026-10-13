/**
 * Support structure panel: f1 against the OpenFAST reference, the DNV margins and the verdict.
 */

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SupportStructurePanel from "../../../src/components/turbine-physics/SupportStructurePanel";
import * as api from "../../../src/services/turbinePhysicsApi";
import type { SupportStructure } from "../../../src/types/turbinePhysics";

vi.mock("../../../src/services/turbinePhysicsApi");
vi.mock("react-plotly.js", () => ({ default: () => null }));

const modes: SupportStructure = {
  frequencies_hz: [0.2188, 0.2195, 0.95],
  first_bending_hz: 0.2188,
  reference_hz: 0.221,
  band_1p_hz: [0.0833, 0.126],
  band_3p_hz: [0.25, 0.378],
  wave_band_hz: [0.0625, 0.1],
  hs50_m: 7.9,
  soft_stiff_ok: true,
  margin_to_1p: 0.736,
  margin_to_3p: 0.125,
  required_margin: 0.1,
  source: "3D Euler-Bernoulli frame FE; reference 0.221 Hz from DEME's OpenFAST free decay",
  foundation: [
    { case: "Legs clamped at the mudline (reference model)", first_bending_hz: 0.2236, change_pct: 0, margin_to_1p: 0.775, margin_to_3p: 0.106, soft_stiff_ok: true },
    { case: "Piles in dense sand, p-y and t-z springs", first_bending_hz: 0.2383, change_pct: 6.57, margin_to_1p: 0.891, margin_to_3p: 0.047, soft_stiff_ok: false },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getSupportStructure).mockResolvedValue(modes);
});

describe("SupportStructurePanel", () => {
  it("shows f1, the margins in % and the soft-stiff verdict", async () => {
    render(<SupportStructurePanel />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(await screen.findByText("soft-stiff: margins met")).toBeTruthy();
    expect(screen.getByText("0.219")).toBeTruthy();
    expect(screen.getByText("73.6")).toBeTruthy();
    expect(screen.getByText("12.5")).toBeTruthy();
    expect(screen.getByText("0.221 Hz (-1.0 %)")).toBeTruthy();
    expect(screen.getByText(modes.source)).toBeTruthy();
  });

  it("lists the foundation cases and flags a 3P margin below the required one", async () => {
    render(<SupportStructurePanel />);
    expect(await screen.findByText("Piles in dense sand, p-y and t-z springs")).toBeTruthy();
    expect(screen.getByText("4.7").className).toContain("text-status-alarm");
    expect(screen.getByText("10.6").className).not.toContain("text-status-alarm");
  });
});

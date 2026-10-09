/**
 * Schematic side view: the inflow profile across the rotor and the turbines
 * this rotor's wake reaches, from the farm wake model.
 *
 * Hand check (SB-510, wind from 227°): WTG-14 lies ≈ 12 D downstream of WTG-09,
 * ≈ 6° off the wake axis; at Ct ≈ 0.45 the Bastankhah hub-height deficit there
 * is ≈ 1–2 %.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TurbineSideView } from "../../../../src/components/landing/turbine3d/schematic/TurbineSideView";
import { useLandingStore } from "../../../../src/store/landingStore";

describe("TurbineSideView", () => {
  it("lists the downstream turbines the wake reaches at the current wind direction", () => {
    const s = useLandingStore.getState();
    useLandingStore.setState({ kpis: { ...s.kpis, windDirectionDeg: 227, freestreamWindMs: 12.3 } });
    render(<TurbineSideView turbineId="WTG-09" />);
    const wake = screen.getByRole("region", { name: "This rotor's wake" });
    const row = within(wake).getByText("WTG-14").closest("tr")!;
    const [, dist, off, deficit] = [...row.querySelectorAll("td")].map((td) => td.textContent ?? "");
    expect(parseFloat(dist)).toBeCloseTo(12.2, 0);
    expect(parseFloat(off)).toBeLessThan(10);
    expect(parseFloat(deficit.replace("−", ""))).toBeGreaterThan(0.5);
    expect(parseFloat(deficit.replace("−", ""))).toBeLessThan(3);
    expect(within(wake).getByText(/above rated/)).toBeDefined();
  });

  it("shows the shear across the rotor from the power law", () => {
    render(<TurbineSideView turbineId="WTG-09" />);
    const inflow = screen.getByRole("region", { name: "Inflow" });
    expect(within(inflow).getByText("0.10")).toBeDefined(); // α
    expect(screen.getByRole("img", { name: /WTG-09 side view/ })).toBeDefined();
  });
});

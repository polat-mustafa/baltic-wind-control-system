/**
 * One farm on every page: the badge shows the live fleet (own project or SB-510) in the same
 * words as the control room, the reference scope always shows SB-510, and every module page
 * that models a farm carries it in its header.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FarmBadge } from "../../../src/components/project/FarmBadge";
import { fleetFromPlan, SB510_FLEET, SB510_NETWORK, useFleetStore } from "../../../src/lib/fleet";
import { farmPlan } from "../../../src/lib/lifecycle/farm";

const OSS: [number, number] = [16.4, 54.8];
const TURBINES = Array.from({ length: 8 }, (_, i) => ({ id: `T${i + 1}`, lon: 16.37 + (i % 4) * 0.022, lat: 54.79 + Math.floor(i / 4) * 0.013 }));

afterEach(() => useFleetStore.setState({ fleet: SB510_FLEET }));

describe("FarmBadge", () => {
  it("shows SB-510 by default", () => {
    render(<FarmBadge scope="live" />);
    expect(screen.getByTestId("farm-badge").textContent).toBe("SB-510 reference · 34 × 15 MW = 510 MW");
  });

  it("follows the own project's name and size, and the reference scope stays SB-510", () => {
    const plan = farmPlan({ turbines: TURBINES, oss: OSS, name: "Bałtyk Test" }, { site: null, report: null });
    const net = { ...SB510_NETWORK, source: "project" as const, name: "Bałtyk Test", num_turbines: 8, total_capacity_mw: 120 };
    useFleetStore.setState({ fleet: fleetFromPlan(plan, net, "own") });
    render(
      <>
        <FarmBadge scope="live" />
        <FarmBadge scope="reference" />
      </>,
    );
    const [live, ref] = screen.getAllByTestId("farm-badge").map((b) => b.textContent);
    expect(live).toBe("Bałtyk Test · 8 × 15 MW = 120 MW");
    expect(ref).toBe("SB-510 reference · 34 × 15 MW = 510 MW");
    expect(plan.name).toBe("Bałtyk Test"); // lifecycle pages (FarmSource) use the same name
  });

  it("is on the header of every page that models a farm", () => {
    const pages: [string, string][] = [
      ["HVGridPage", "live"],
      ["CommissioningPage", "live"],
      ["DigitalTwinPage", "live"],
      ["ConstructionPage", "live"],
      ["HandoverPage", "live"],
      ["DecommissioningPage", "live"],
      ["WindResourcePage", "live"],
    ];
    for (const [page, scope] of pages) {
      const src = readFileSync(resolve(__dirname, `../../../src/pages/${page}.tsx`), "utf-8");
      expect(src, page).toContain(`farm="${scope}"`);
    }
  });
});

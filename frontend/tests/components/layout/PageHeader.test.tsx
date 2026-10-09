/**
 * The shared page template: header facts as chips, tabs with arrow keys, and
 * the breadcrumb's lifecycle trail.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageHeader } from "../../../src/components/layout/PageHeader";
import { PageTabs } from "../../../src/components/layout/PageTabs";
import { NAV_GROUPS, navTrail } from "../../../src/constants/navigation";

describe("PageHeader", () => {
  it("renders the title as the page heading and each fact as a chip", () => {
    render(<PageHeader title="HV Grid Integration" meta="SB-510 · 510 MW · 66/220/400 kV" actions={<button>Run</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "HV Grid Integration" })).toBeDefined();
    const facts = screen.getByRole("list", { name: "Key facts" });
    expect([...facts.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["SB-510", "510 MW", "66/220/400 kV"]);
    expect(screen.getByRole("button", { name: "Run" })).toBeDefined();
  });
});

describe("PageTabs", () => {
  it("marks the selected tab and moves with the arrow keys, wrapping round", () => {
    const onChange = vi.fn();
    const tabs = [
      { id: "a", label: "Load flow" },
      { id: "b", label: "FRT" },
    ] as const;
    render(<PageTabs tabs={tabs} value="b" onChange={onChange} />);
    expect(screen.getByRole("tab", { name: "FRT" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("a");
  });
});

describe("navTrail", () => {
  it("names the lifecycle group of every menu page", () => {
    expect(navTrail("/scada")).toEqual({ group: "Operate", label: "SCADA" });
    expect(navTrail("/develop/layout")).toEqual({ group: "Develop", label: "Layout" });
    expect(navTrail("/not-a-page")).toBeNull();
    const paths = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.path));
    expect(new Set(paths).size).toBe(paths.length);
  });
});

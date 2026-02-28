/**
 * Tests for the OffshoreSubstation component.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OffshoreSubstation from "../../../src/components/landing/OffshoreSubstation";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

describe("OffshoreSubstation", () => {
  it("renders inside SVG", () => {
    const { container } = render(
      <svg>
        <OffshoreSubstation powerThroughMW={350} />
      </svg>,
    );
    const group = container.querySelector('[role="button"]');
    expect(group).toBeDefined();
  });

  it("displays OSS label", () => {
    const { container } = render(
      <svg>
        <OffshoreSubstation powerThroughMW={350} />
      </svg>,
    );
    const texts = container.querySelectorAll("text");
    const ossText = Array.from(texts).find((t) => t.textContent === "OSS");
    expect(ossText).toBeDefined();
  });

  it("displays power readout", () => {
    const { container } = render(
      <svg>
        <OffshoreSubstation powerThroughMW={350} />
      </svg>,
    );
    const texts = container.querySelectorAll("text");
    const powerText = Array.from(texts).find(
      (t) => t.textContent === "350 MW",
    );
    expect(powerText).toBeDefined();
  });

  it("displays voltage label", () => {
    const { container } = render(
      <svg>
        <OffshoreSubstation powerThroughMW={350} />
      </svg>,
    );
    const texts = container.querySelectorAll("text");
    const voltageText = Array.from(texts).find(
      (t) => t.textContent === "66/220 kV",
    );
    expect(voltageText).toBeDefined();
  });

  it("has correct aria-label", () => {
    const { container } = render(
      <svg>
        <OffshoreSubstation powerThroughMW={350} />
      </svg>,
    );
    const group = container.querySelector('[role="button"]');
    expect(group?.getAttribute("aria-label")).toBe(
      "Offshore Substation — click to open SCADA",
    );
  });
});

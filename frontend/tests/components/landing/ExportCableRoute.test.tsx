/**
 * Tests for the ExportCableRoute component.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExportCableRoute from "../../../src/components/landing/ExportCableRoute";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

describe("ExportCableRoute", () => {
  it("renders inside SVG", () => {
    const { container } = render(
      <svg>
        <ExportCableRoute />
      </svg>,
    );
    const group = container.querySelector('[role="button"]');
    expect(group).toBeDefined();
  });

  it("has correct aria-label", () => {
    const { container } = render(
      <svg>
        <ExportCableRoute />
      </svg>,
    );
    const group = container.querySelector('[role="button"]');
    expect(group?.getAttribute("aria-label")).toBe(
      "220 kV Export Cable — click to open HV Grid",
    );
  });

  it("renders cable label text", () => {
    const { container } = render(
      <svg>
        <ExportCableRoute />
      </svg>,
    );
    const texts = container.querySelectorAll("text");
    const label = Array.from(texts).find((t) =>
      t.textContent?.includes("220 kV Export"),
    );
    expect(label).toBeDefined();
  });

  it("renders path elements for the cable", () => {
    const { container } = render(
      <svg>
        <ExportCableRoute />
      </svg>,
    );
    const paths = container.querySelectorAll("path");
    // Background + foreground + hit area = 3 paths
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });
});

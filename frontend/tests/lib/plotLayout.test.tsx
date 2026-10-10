/**
 * lib/Plot hands Plotly its own layout copy: never the caller's (shared) objects,
 * the same copy while the content is unchanged (Plotly's autorange result
 * survives a re-render), a new copy with a new datarevision when it changes.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const seen: Record<string, unknown>[] = [];
vi.mock("plotly.js-dist-min", () => ({ default: { newPlot: () => undefined } }));
vi.mock("react-plotly.js/factory", () => ({
  default: () => (props: { layout: Record<string, unknown> }) => {
    seen.push(props.layout);
    return null;
  },
}));

const { default: Plot } = await import("../../src/lib/Plot");

describe("Plot layout handling", () => {
  it("copies the layout, keeps the copy across equal re-renders, renews it on change", () => {
    const shared = { gridcolor: "#123" };
    const make = (title: string) => ({ xaxis: shared, yaxis: { title: { text: title } } });
    const { rerender } = render(<Plot data={[]} layout={make("a")} />);
    rerender(<Plot data={[]} layout={make("a")} />); // new object, same content
    rerender(<Plot data={[]} layout={make("b")} />);
    const [first, second, third] = seen.slice(-3);
    expect(first.xaxis).not.toBe(shared); // Plotly may write into its copy, not the shared axis
    expect(second).toBe(first); // its written-back autorange range survives
    expect(third).not.toBe(first);
    expect(third.datarevision).not.toBe(first.datarevision); // forces a full recalculation
  });
});

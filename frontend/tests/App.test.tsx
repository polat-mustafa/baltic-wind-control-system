import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import App from "../src/App";

vi.mock("react-plotly.js", () => ({ default: () => null }));

test("renders the landing page heading", () => {
  render(<App />);
  const headings = screen.getAllByText("OffshoreForge");
  expect(headings.length).toBeGreaterThanOrEqual(1);
});

test("displays the wind farm specification", async () => {
  render(<App />);
  // The Control Room header names the farm and its capacity once the page chunk loads
  const matches = await screen.findAllByText(/510 MW/, undefined, { timeout: 5000 });
  expect(matches.length).toBeGreaterThanOrEqual(1);
});

import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "../src/App";

test("renders the landing page heading", () => {
  render(<App />);
  const headings = screen.getAllByText("Baltic Wind Alpha");
  expect(headings.length).toBeGreaterThanOrEqual(1);
});

test("displays the wind farm specification", () => {
  render(<App />);
  const matches = screen.getAllByText(/510 MW/);
  expect(matches.length).toBeGreaterThanOrEqual(1);
});

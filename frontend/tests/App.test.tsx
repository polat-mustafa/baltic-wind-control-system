import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "../src/App";

test("renders the landing page heading", () => {
  render(<App />);
  expect(screen.getByText("Baltic Wind Alpha")).toBeDefined();
});

test("displays the wind farm specification", () => {
  render(<App />);
  expect(
    screen.getByText(/510 MW Offshore Wind HV Control/),
  ).toBeDefined();
});

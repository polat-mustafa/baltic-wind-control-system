import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import AcademyTab from "../../../src/components/p4/academy/AcademyTab";
import ConceptMap from "../../../src/components/p4/academy/ConceptMap";
import { CHAPTERS, CONCEPTS, LINKS } from "../../../src/components/p4/academy/academyContent";
import { useForecastStore } from "../../../src/store/forecastStore";
describe("P4 AI Academy", () => {
  beforeEach(() => useForecastStore.setState({ chapter: "why", tab: "academy", real: null }));

  it("has a consistent course: every concept points at a chapter, every link at concepts", () => {
    const chapterIds = new Set(CHAPTERS.map((c) => c.id));
    const conceptIds = new Set(CONCEPTS.map((c) => c.id));
    expect(CONCEPTS.every((c) => chapterIds.has(c.chapter))).toBe(true);
    expect(LINKS.every(([a, b]) => conceptIds.has(a) && conceptIds.has(b))).toBe(true);
    expect(CHAPTERS.every((c) => c.body.every((b) => b.en && b.tr))).toBe(true);
  });

  it("walks the chapters and switches to Turkish", () => {
    render(<AcademyTab />);
    expect(screen.getByRole("heading", { name: CHAPTERS[0].title.en })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Decision trees and XGBoost/ }));
    expect(screen.getByRole("heading", { name: "Decision trees and XGBoost" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "TR" }));
    expect(screen.getByRole("heading", { name: "Karar ağaçları ve XGBoost" })).toBeDefined();
  });

  it("shows a clicked concept's summary, then opens its lesson", () => {
    render(<ConceptMap lang="en" />);
    fireEvent.click(screen.getByText("Attention"));
    expect(screen.getByText(/weight which past moments matter/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Open the lesson/ }));
    expect(useForecastStore.getState().chapter).toBe("tft");
    expect(useForecastStore.getState().tab).toBe("academy");
  });
});

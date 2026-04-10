/**
 * Tests for the AnnotationDetailPopup component.
 *
 * This is a pure HTML component (no R3F Canvas required) so it can be
 * rendered directly with @testing-library/react.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { AnnotationDetailPopup } from "../../../../src/components/landing/turbine3d/ui/AnnotationDetailPopup";
import type {
  Annotation,
  AnnotationCategory,
} from "../../../../src/components/landing/turbine3d/data/annotationCatalog";

function mkAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "test-ann",
    kind: "component",
    category: "kinematic" as AnnotationCategory,
    anchor: [0, 150, 0],
    label: "Test Label",
    detail: {
      title: "Test Title",
      value: "42",
      unit: "MW",
      source: "Test source",
    },
    ...overrides,
  };
}

describe("AnnotationDetailPopup", () => {
  it("renders title, value, and unit", () => {
    const onClose = vi.fn();
    render(
      <AnnotationDetailPopup annotation={mkAnnotation()} onClose={onClose} />,
    );
    expect(screen.getByText("Test Title")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("MW")).toBeDefined();
  });

  it("renders formula when present", () => {
    const onClose = vi.fn();
    render(
      <AnnotationDetailPopup
        annotation={mkAnnotation({
          detail: {
            title: "T",
            value: "V",
            source: "S",
            formula: "P = ½ρAv³",
          },
        })}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("P = ½ρAv³")).toBeDefined();
  });

  it("renders description when present", () => {
    const onClose = vi.fn();
    render(
      <AnnotationDetailPopup
        annotation={mkAnnotation({
          detail: {
            title: "T",
            value: "V",
            source: "S",
            description: "Some educational text",
          },
        })}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Some educational text")).toBeDefined();
  });

  it("renders source text", () => {
    const onClose = vi.fn();
    render(
      <AnnotationDetailPopup annotation={mkAnnotation()} onClose={onClose} />,
    );
    expect(screen.getByText("Test source")).toBeDefined();
  });

  it("clicking × fires onClose", () => {
    const onClose = vi.fn();
    render(
      <AnnotationDetailPopup annotation={mkAnnotation()} onClose={onClose} />,
    );
    const closeBtn = screen.getByTitle("Close");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("pressing Escape fires onClose", () => {
    const onClose = vi.fn();
    render(
      <AnnotationDetailPopup annotation={mkAnnotation()} onClose={onClose} />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders SVG leader line with arrowhead", () => {
    const onClose = vi.fn();
    const { container } = render(
      <AnnotationDetailPopup annotation={mkAnnotation()} onClose={onClose} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
    const line = svg?.querySelector("line");
    expect(line).toBeDefined();
    // Verify marker (arrowhead) is defined
    const marker = svg?.querySelector("marker");
    expect(marker).toBeDefined();
  });

  it("supports dynamic value via function", () => {
    const onClose = vi.fn();
    render(
      <AnnotationDetailPopup
        annotation={mkAnnotation({
          detail: {
            title: "T",
            value: () => "dynamic-99",
            source: "S",
          },
        })}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("dynamic-99")).toBeDefined();
  });
});

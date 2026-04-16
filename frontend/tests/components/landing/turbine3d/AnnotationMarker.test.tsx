/**
 * Tests for AnnotationMarkerContent — the pure HTML portion of AnnotationMarker.
 *
 * AnnotationMarker wraps this in drei <Html> which requires a Canvas context.
 * By testing the extracted content component we verify visual behaviour
 * without needing WebGL.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { AnnotationMarkerContent } from "../../../../src/components/landing/turbine3d/scene/AnnotationMarker";
import type {
  Annotation,
  AnnotationCategory,
} from "../../../../src/components/landing/turbine3d/data/annotationCatalog";

function mkAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "test-marker",
    kind: "component",
    category: "kinematic" as AnnotationCategory,
    anchor: [0, 150, 0],
    label: "Test Part",
    detail: { title: "T", value: "V", source: "S" },
    ...overrides,
  };
}

describe("AnnotationMarkerContent", () => {
  it("renders the label text", () => {
    render(
      <AnnotationMarkerContent
        annotation={mkAnnotation()}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText("Test Part")).toBeDefined();
  });

  it("circle background matches category color", () => {
    const { container } = render(
      <AnnotationMarkerContent
        annotation={mkAnnotation({ category: "electrical" })}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    const circle = container.querySelector("[data-testid='marker-circle']") as HTMLElement;
    // jsdom normalises hex to rgb()
    expect(circle.style.background).toBe("rgb(34, 197, 94)");
  });

  it("clicking fires onClick with the annotation", () => {
    const onClick = vi.fn();
    const ann = mkAnnotation();
    const { container } = render(
      <AnnotationMarkerContent
        annotation={ann}
        isSelected={false}
        onClick={onClick}
      />,
    );
    const wrapper = container.querySelector(".annotation-marker") as HTMLElement;
    fireEvent.click(wrapper);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(ann);
  });

  it("isSelected=true applies white border on the circle", () => {
    const { container } = render(
      <AnnotationMarkerContent
        annotation={mkAnnotation()}
        isSelected={true}
        onClick={vi.fn()}
      />,
    );
    const circle = container.querySelector("[data-testid='marker-circle']") as HTMLElement;
    expect(circle.style.border).toContain("white");
  });

  it("telemetry kind gets annotation-pulse class", () => {
    const { container } = render(
      <AnnotationMarkerContent
        annotation={mkAnnotation({ kind: "telemetry" })}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    const circle = container.querySelector("[data-testid='marker-circle']") as HTMLElement;
    expect(circle.className).toContain("annotation-pulse");
  });

  it("non-telemetry kind does NOT get annotation-pulse class", () => {
    const { container } = render(
      <AnnotationMarkerContent
        annotation={mkAnnotation({ kind: "dimension" })}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    const circle = container.querySelector("[data-testid='marker-circle']") as HTMLElement;
    expect(circle.className).not.toContain("annotation-pulse");
  });

  it("supports dynamic label via function", () => {
    render(
      <AnnotationMarkerContent
        annotation={mkAnnotation({ label: () => "Dynamic Label" })}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText("Dynamic Label")).toBeDefined();
  });
});

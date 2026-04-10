/**
 * Integrity tests for the 3D annotation catalog.
 *
 * Ensures every static annotation has valid IDs, categories, anchors,
 * and related part references. Catches data entry errors early.
 */

import { describe, expect, it } from "vitest";
import {
  STATIC_ANNOTATIONS,
  ANNOTATION_CATEGORY_COLOR,
  type AnnotationCategory,
} from "../../../../src/components/landing/turbine3d/data/annotationCatalog";
import { PART_EDUCATION_MAP } from "../../../../src/constants/turbinePartEducation";

const VALID_CATEGORIES = Object.keys(ANNOTATION_CATEGORY_COLOR) as AnnotationCategory[];
const VALID_MODES = ["normal", "cutaway", "exploded"] as const;
const VALID_PART_IDS = new Set(Object.keys(PART_EDUCATION_MAP));

describe("annotationCatalog integrity", () => {
  it("has at least 5 static annotations", () => {
    expect(STATIC_ANNOTATIONS.length).toBeGreaterThanOrEqual(5);
  });

  it("every annotation has a unique id", () => {
    const ids = STATIC_ANNOTATIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every category is in ANNOTATION_CATEGORY_COLOR", () => {
    for (const a of STATIC_ANNOTATIONS) {
      expect(VALID_CATEGORIES).toContain(a.category);
    }
  });

  it("every anchor has 3 finite numbers in a reasonable scene range", () => {
    for (const a of STATIC_ANNOTATIONS) {
      expect(a.anchor).toHaveLength(3);
      for (const v of a.anchor) {
        expect(Number.isFinite(v)).toBe(true);
      }
      // y should be within the scene bounds (-50 below seabed to 300 above blade tip)
      expect(a.anchor[1]).toBeGreaterThanOrEqual(-50);
      expect(a.anchor[1]).toBeLessThanOrEqual(300);
    }
  });

  it("every visibleInModes entry is a valid viewer mode", () => {
    for (const a of STATIC_ANNOTATIONS) {
      if (!a.visibleInModes) continue;
      expect(a.visibleInModes.length).toBeGreaterThan(0);
      for (const m of a.visibleInModes) {
        expect(VALID_MODES).toContain(m);
      }
    }
  });

  it("every relatedPartId is a valid TurbinePartId", () => {
    for (const a of STATIC_ANNOTATIONS) {
      if (!a.relatedPartId) continue;
      expect(VALID_PART_IDS.has(a.relatedPartId)).toBe(true);
    }
  });

  it("dimension annotations have arrowFrom and arrowTo", () => {
    const dims = STATIC_ANNOTATIONS.filter((a) => a.kind === "dimension");
    expect(dims.length).toBeGreaterThanOrEqual(3);
    for (const a of dims) {
      expect(a.arrowFrom).toBeDefined();
      expect(a.arrowTo).toBeDefined();
      expect(a.arrowFrom).toHaveLength(3);
      expect(a.arrowTo).toHaveLength(3);
    }
  });
});

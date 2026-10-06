/**
 * Tour layout maths: card placement around the spotlight and the node arrow.
 */

import { describe, expect, it } from "vitest";

import { inflate, nearestPoint, nodeArrow, placeCard } from "../../src/tour/geometry";

const VIEW = { w: 1440, h: 900 };
const CARD = { w: 360, h: 240 };

describe("placeCard", () => {
  it("centres the card when there is no target", () => {
    const p = placeCard(null, CARD, VIEW);
    expect(p.side).toBe("center");
    expect(p.x).toBe((1440 - 360) / 2);
  });

  it("prefers the right of a small target", () => {
    const p = placeCard({ x: 100, y: 300, w: 200, h: 40 }, CARD, VIEW);
    expect(p.side).toBe("right");
    expect(p.x).toBe(316);
  });

  it("falls back to the left near the right edge", () => {
    const p = placeCard({ x: 1300, y: 300, w: 120, h: 40 }, CARD, VIEW);
    expect(p.side).toBe("bottom");
    const q = placeCard({ x: 1300, y: 300, w: 120, h: 560 }, CARD, VIEW);
    expect(q.side).toBe("left");
    expect(q.x + CARD.w).toBeLessThanOrEqual(1300);
  });

  it("goes inside a target that fills the screen", () => {
    const p = placeCard({ x: 0, y: 0, w: 1440, h: 900 }, CARD, VIEW);
    expect(p.side).toBe("inside");
    expect(p.x + CARD.w).toBeLessThanOrEqual(1440 - 12);
    expect(p.y + CARD.h).toBeLessThanOrEqual(900 - 12);
  });

  it("is a bottom sheet on phones", () => {
    const p = placeCard({ x: 10, y: 10, w: 50, h: 50 }, { w: 366, h: 300 }, { w: 390, h: 844 });
    expect(p.side).toBe("sheet");
    expect(p.y).toBe(844 - 300 - 12);
  });

  it("keeps the card on screen", () => {
    for (const t of [
      { x: 5, y: 5, w: 30, h: 30 },
      { x: 1400, y: 860, w: 30, h: 30 },
      { x: 700, y: 0, w: 40, h: 900 },
    ]) {
      const p = placeCard(t, CARD, VIEW);
      expect(p.x).toBeGreaterThanOrEqual(12);
      expect(p.y).toBeGreaterThanOrEqual(12);
      expect(p.x + CARD.w).toBeLessThanOrEqual(VIEW.w - 12);
      expect(p.y + CARD.h).toBeLessThanOrEqual(VIEW.h - 12);
    }
  });
});

describe("nodeArrow", () => {
  it("runs from the target edge to the card edge", () => {
    const a = nodeArrow({ x: 100, y: 100, w: 100, h: 100 }, { x: 400, y: 100, w: 300, h: 100 });
    expect(a).not.toBeNull();
    expect(a!.start).toEqual({ x: 200, y: 150 });
    expect(a!.end).toEqual({ x: 400, y: 150 });
    expect(a!.d.startsWith("M 200.0 150.0 C")).toBe(true);
  });

  it("starts at the target centre when the card sits inside it", () => {
    const a = nodeArrow({ x: 0, y: 0, w: 1000, h: 800 }, { x: 600, y: 500, w: 300, h: 200 });
    expect(a!.start).toEqual({ x: 500, y: 400 });
    expect(a!.end).toEqual({ x: 600, y: 500 });
  });

  it("draws nothing when target and card touch", () => {
    expect(nodeArrow({ x: 0, y: 0, w: 100, h: 100 }, { x: 105, y: 0, w: 100, h: 100 })).toBeNull();
  });
});

describe("helpers", () => {
  it("inflates and clamps", () => {
    expect(inflate({ x: 10, y: 10, w: 20, h: 20 }, 5)).toEqual({ x: 5, y: 5, w: 30, h: 30 });
    expect(nearestPoint({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5 })).toEqual({ x: 10, y: 5 });
  });
});

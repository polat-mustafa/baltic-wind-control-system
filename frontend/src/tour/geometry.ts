/**
 * Pure layout maths for the tour overlay: where the card goes relative to
 * the spotlighted element, and the curved "node arrow" between them.
 * Kept free of DOM access so it can be unit-tested.
 */

import type { Rect, Size } from "./types";

export type Side = "right" | "left" | "bottom" | "top" | "inside" | "center" | "sheet";

export interface Placement {
  x: number;
  y: number;
  side: Side;
}

/** Below this viewport width the card is a bottom sheet. */
export const SHEET_BREAKPOINT = 640;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Grow a rect by `pad` on every side. */
export function inflate(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad };
}

/**
 * Place a card of `card` size next to `target` inside `view`.
 *
 * Tries right, bottom, left, top (in that order) with a `gap`; if the
 * target is too large for any of them (e.g. the map fills the screen) the
 * card goes inside it, bottom-right. Without a target the card is centred.
 * Narrow viewports always get a bottom sheet.
 */
export function placeCard(target: Rect | null, card: Size, view: Size, gap = 16, margin = 12): Placement {
  if (view.w < SHEET_BREAKPOINT) {
    return { x: margin, y: Math.max(margin, view.h - card.h - margin), side: "sheet" };
  }
  if (!target) {
    return { x: (view.w - card.w) / 2, y: Math.max(margin, (view.h - card.h) / 2), side: "center" };
  }
  const cy = clamp(target.y + target.h / 2 - card.h / 2, margin, view.h - card.h - margin);
  const cx = clamp(target.x + target.w / 2 - card.w / 2, margin, view.w - card.w - margin);
  const candidates: Placement[] = [
    { x: target.x + target.w + gap, y: cy, side: "right" },
    { x: cx, y: target.y + target.h + gap, side: "bottom" },
    { x: target.x - gap - card.w, y: cy, side: "left" },
    { x: cx, y: target.y - gap - card.h, side: "top" },
  ];
  const fits = (p: Placement) =>
    p.x >= margin && p.y >= margin && p.x + card.w <= view.w - margin && p.y + card.h <= view.h - margin;
  const best = candidates.find(fits);
  if (best) return best;
  // Target covers most of the screen: sit inside it, bottom-right.
  return {
    x: clamp(target.x + target.w - card.w - gap, margin, view.w - card.w - margin),
    y: clamp(target.y + target.h - card.h - gap, margin, view.h - card.h - margin),
    side: "inside",
  };
}

export interface Point {
  x: number;
  y: number;
}

/** Closest point of rect `r` to point `p` (p itself when inside). */
export function nearestPoint(r: Rect, p: Point): Point {
  return { x: clamp(p.x, r.x, r.x + r.w), y: clamp(p.y, r.y, r.y + r.h) };
}

export interface Arrow {
  /** SVG path data (cubic Bézier). */
  d: string;
  start: Point;
  end: Point;
}

/**
 * Curved arrow from the target ("node") to the card.
 *
 * It starts at the target's centre when the card sits inside the target,
 * otherwise at the target edge facing the card, and ends on the card edge
 * facing the start. Returns null when the two touch (nothing to draw).
 */
export function nodeArrow(target: Rect, card: Rect, minLength = 24): Arrow | null {
  const cardCentre = { x: card.x + card.w / 2, y: card.y + card.h / 2 };
  const targetCentre = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
  const cardInside =
    cardCentre.x > target.x &&
    cardCentre.x < target.x + target.w &&
    cardCentre.y > target.y &&
    cardCentre.y < target.y + target.h;
  const start = cardInside ? targetCentre : nearestPoint(target, cardCentre);
  const end = nearestPoint(card, start);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < minLength) return null;
  // Bend the curve sideways by a fraction of its length.
  const bend = Math.min(80, length * 0.3);
  const nx = -dy / length;
  const ny = dx / length;
  const c1 = { x: start.x + dx * 0.25 + nx * bend, y: start.y + dy * 0.25 + ny * bend };
  const c2 = { x: start.x + dx * 0.75 + nx * bend * 0.5, y: start.y + dy * 0.75 + ny * bend * 0.5 };
  const f = (v: number) => v.toFixed(1);
  return {
    d: `M ${f(start.x)} ${f(start.y)} C ${f(c1.x)} ${f(c1.y)}, ${f(c2.x)} ${f(c2.y)}, ${f(end.x)} ${f(end.y)}`,
    start,
    end,
  };
}

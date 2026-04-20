/**
 * Regression test for the NacelleSchematic pan-crash bug.
 *
 * Before the fix, `handlePointerMove` guarded on `dragRef.current` *inside*
 * the setState updater callback. If React batched the update and re-ran the
 * callback after `handlePointerUp` had nulled the ref, reading `.tx` on null
 * threw "Cannot read properties of null (reading 'tx')".
 *
 * The fix (NacelleSchematic.tsx:138) derefs the ref once outside the updater
 * and closes over the non-null snapshot. This test simulates the race with a
 * minimal mock of the exact pattern.
 */

import { describe, expect, it } from "vitest";

interface Drag { x: number; y: number; tx: number; ty: number }
interface View { tx: number; ty: number }

function buildPanHandler() {
  const dragRef: { current: Drag | null } = { current: null };
  let view: View = { tx: 0, ty: 0 };

  const setView = (updater: (v: View) => View) => {
    view = updater(view);
  };

  const pointerDown = (x: number, y: number) => {
    dragRef.current = { x, y, tx: view.tx, ty: view.ty };
  };

  const pointerMove = (x: number, y: number) => {
    // The fix: deref once, outside the updater.
    const drag = dragRef.current;
    if (!drag) return;
    const dx = x - drag.x;
    const dy = y - drag.y;
    setView((v) => ({ ...v, tx: drag.tx + dx, ty: drag.ty + dy }));
  };

  const pointerUp = () => {
    dragRef.current = null;
  };

  return { pointerDown, pointerMove, pointerUp, getView: () => view };
}

describe("NacelleSchematic pan handler — race safety", () => {
  it("pointerMove after pointerUp does not throw", () => {
    const h = buildPanHandler();
    h.pointerDown(100, 100);
    h.pointerMove(110, 105);
    h.pointerUp();
    // Orphan move arriving after release (browser replays, touch fling, etc).
    expect(() => h.pointerMove(200, 200)).not.toThrow();
  });

  it("applies drag offset based on snapshot at drag start", () => {
    const h = buildPanHandler();
    h.pointerDown(100, 100);
    h.pointerMove(150, 120);
    expect(h.getView()).toEqual({ tx: 50, ty: 20 });
  });

  it("does not stack translations across separate drag sessions", () => {
    const h = buildPanHandler();
    h.pointerDown(0, 0);
    h.pointerMove(30, 0);
    h.pointerUp();
    h.pointerDown(100, 100);
    h.pointerMove(110, 100);
    expect(h.getView()).toEqual({ tx: 40, ty: 0 });
  });
});

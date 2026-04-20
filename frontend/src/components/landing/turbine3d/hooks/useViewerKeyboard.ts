/**
 * Keyboard shortcuts for the 3D viewer.
 *
 *   F          Fit / re-frame selected part
 *   R          Reset camera to overview
 *   1 / 2 / 3  Normal / Cutaway / Exploded mode
 *   S          Toggle 3D ↔ Schematic interior view
 *   Esc        Clear selection
 *   + / =      Zoom in
 *   - / _      Zoom out
 *
 * Arrow keys are left to OrbitControls (its internal keyboard handling is enabled
 * by default on three.js r170+). We only intercept letter/digit/symbol keys.
 *
 * The hook only fires when the 3D canvas (or its container) is focused, to avoid
 * hijacking keys from form inputs elsewhere on the page.
 */

import { useEffect } from "react";
import type { RefObject } from "react";

import { useLandingStore } from "../../../../store/landingStore";

interface UseViewerKeyboardOptions {
  containerRef: RefObject<HTMLElement | null>;
  onFit: () => void;
  onReset: () => void;
  onZoom: (delta: number) => void;
}

export function useViewerKeyboard({
  containerRef,
  onFit,
  onReset,
  onZoom,
}: UseViewerKeyboardOptions) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // The container needs tabindex to receive keyboard focus.
    if (el.tabIndex < 0) el.tabIndex = 0;

    const handler = (e: KeyboardEvent) => {
      // Don't steal keys when a form input is the active element.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const store = useLandingStore.getState();

      switch (e.key.toLowerCase()) {
        case "f":
          onFit();
          e.preventDefault();
          break;
        case "r":
          onReset();
          e.preventDefault();
          break;
        case "1":
          store.setViewerMode("normal");
          e.preventDefault();
          break;
        case "2":
          store.setViewerMode("cutaway");
          e.preventDefault();
          break;
        case "3":
          store.setViewerMode("exploded");
          e.preventDefault();
          break;
        case "s":
          store.setInteriorView(store.interiorView === "3d" ? "schematic" : "3d");
          e.preventDefault();
          break;
        case "escape":
          // In schematic mode, Esc closes the overlay first; otherwise clears selection.
          if (store.interiorView === "schematic") {
            store.setInteriorView("3d");
          } else {
            store.setSelectedTurbinePart(null);
          }
          e.preventDefault();
          break;
        case "+":
        case "=":
          onZoom(-1);
          e.preventDefault();
          break;
        case "-":
        case "_":
          onZoom(1);
          e.preventDefault();
          break;
      }
    };

    el.addEventListener("keydown", handler);
    return () => { el.removeEventListener("keydown", handler); };
  }, [containerRef, onFit, onReset, onZoom]);
}

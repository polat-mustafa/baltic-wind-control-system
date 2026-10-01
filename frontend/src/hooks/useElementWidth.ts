import { useEffect, useState } from "react";

/**
 * Content-box width [px] of an element, kept live with a ResizeObserver.
 * Returns `[callbackRef, width]`; width is 0 until measured (and in jsdom).
 * A callback ref (not useRef) so the observer follows the element when the
 * parent swaps it for another one.
 */
export function useElementWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

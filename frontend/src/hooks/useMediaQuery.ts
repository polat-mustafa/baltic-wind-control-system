import { useSyncExternalStore } from "react";

/**
 * Live CSS media query match, e.g. `useMediaQuery("(min-width: 768px)")`.
 * Use it only where CSS alone cannot do the job (different component tree or
 * initial state per screen size); prefer Tailwind breakpoints otherwise.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

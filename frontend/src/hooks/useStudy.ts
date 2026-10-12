/**
 * One backend study a panel fetches for itself: re-requested `delayMs` after the
 * last change of `deps` (debounce for sliders), the previous result kept on screen
 * while the next one runs, and a late answer to an old request dropped.
 */

import { useEffect, useState, type DependencyList } from "react";

export interface StudyState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useStudy<T>(load: () => Promise<T>, deps: DependencyList, delayMs = 0): StudyState<T> {
  const [state, setState] = useState<StudyState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    const id = setTimeout(async () => {
      try {
        const data = await load();
        if (live) setState({ data: data ?? null, error: null, loading: false });
      } catch (e) {
        if (live) setState((s) => ({ data: s.data, error: e instanceof Error ? e.message : String(e), loading: false }));
      }
    }, delayMs);
    return () => {
      live = false;
      clearTimeout(id);
    };
    // `load` is a fresh closure every render; `deps` says when it asks something new
  }, deps);

  return state;
}

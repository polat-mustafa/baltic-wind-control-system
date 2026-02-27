/**
 * Generic interval polling hook.
 *
 * Calls `fetchFn` immediately on mount, then every `intervalMs` milliseconds.
 * Stops polling when the component unmounts or when `enabled` is false.
 *
 * Returns the latest data, any error, and a loading flag (true only for the
 * initial fetch — subsequent polls don't set loading to avoid UI flicker).
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface UsePollingResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs: number,
  enabled: boolean = true,
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstFetch = useRef(true);

  const stableFetch = useCallback(fetchFn, [fetchFn]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function poll() {
      try {
        const result = await stableFetch();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled && isFirstFetch.current) {
          setIsLoading(false);
          isFirstFetch.current = false;
        }
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [stableFetch, intervalMs, enabled]);

  return { data, error, isLoading };
}

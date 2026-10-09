/**
 * Pages open with results, not an empty "Run" screen: run the page's analysis
 * once, as soon as `ready` (no result yet, nothing running, no error). The
 * Run / Re-run button stays for new inputs.
 */

import { useEffect, useRef } from "react";

export function useAutoRun(ready: boolean, run: () => unknown): void {
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void run();
  }, [ready, run]);
}

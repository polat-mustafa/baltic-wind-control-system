import { useEffect } from "react";

import { useLandingStore } from "../store/landingStore";
import { useLifecycleStore } from "../store/lifecycleStore";
import { useModeStore } from "../store/modeStore";

/**
 * The live plant is energised only once it has been commissioned: SB-510 is
 * an operating farm; an own project stays dead (0 MW, rotors parked, no
 * power flow) until its commissioning stage is marked complete.
 */
export function useEnergisationGate(): void {
  const reference = useModeStore((s) => s.mode !== "own");
  const commissioned = useLifecycleStore((s) => s.done.includes("commissioning"));
  const energised = reference || commissioned;
  useEffect(() => useLandingStore.getState().setCommissioned(energised), [energised]);
}

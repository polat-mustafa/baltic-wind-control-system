/**
 * Fault synchronization hook — bridges the unified fault bus
 * to both landingStore and scadaStore.
 *
 * Called once in AppShell. Subscribes to faultBus events and
 * propagates faults across stores while respecting source
 * origin to prevent infinite loops.
 *
 * Flow:
 *   faultBus "add" from "landing" → scadaStore.injectTurbineFaultFromBus()
 *   faultBus "add" from "scada"   → landingStore.setTurbineFault()
 *   faultBus "remove" from "landing" → scadaStore.transitionAlarmToRTN()
 *   faultBus "remove" from "scada"   → landingStore.clearTurbineFault()
 */

import { useEffect } from "react";

import { useFaultBus } from "../store/faultBus";
import { useLandingStore } from "../store/landingStore";
import { useScadaStore } from "../store/scadaStore";
import type { FaultAction, FaultEvent } from "../store/faultBus";

export function useFaultSync(): void {
  useEffect(() => {
    const unsubscribe = useFaultBus.getState().subscribe(
      (action: FaultAction, event: FaultEvent) => {
        if (action === "add") {
          if (event.source === "landing") {
            // Landing created fault → inject alarm into SCADA (no re-publish)
            useScadaStore.getState().injectTurbineFaultFromBus(event.turbineId, event.faultType);
          } else if (event.source === "scada") {
            // SCADA created fault → set turbine to fault on landing map
            useLandingStore.getState().setTurbineFault(event.turbineId, event.faultType);
          }
        } else if (action === "remove") {
          if (event.source === "landing") {
            // Landing cleared fault → transition SCADA alarm to RTN
            useScadaStore.getState().transitionAlarmToRTN(event.turbineId);
          } else if (event.source === "scada") {
            // SCADA cleared fault → clear turbine fault on landing map
            useLandingStore.getState().clearTurbineFault(event.turbineId);
          }
        }
      },
    );

    return unsubscribe;
  }, []);
}

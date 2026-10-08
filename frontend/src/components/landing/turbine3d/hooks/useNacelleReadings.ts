import { useMemo } from "react";

import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import { selectNacelleData, useNacelleSubsystemsStore } from "../../../../store/nacelleSubsystemsStore";
import { nacelleTemperatures, type ThermalId, type ThermalReading } from "../model/nacelleThermal";

/** Live component temperatures of one turbine. */
export function useNacelleReadings(turbineId: string): Record<ThermalId, ThermalReading> {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const airC = useLandingStore((s) => s.environment.airTemperatureC);
  const windingC = useNacelleSubsystemsStore(selectNacelleData(turbineId))?.cooling?.winding_temp_c;
  return useMemo(
    () =>
      nacelleTemperatures({
        powerMW: turbine?.powerOutputMW ?? 0,
        airC,
        bearingC: turbine?.bearingTempC,
        windingC,
      }),
    [turbine?.powerOutputMW, turbine?.bearingTempC, airC, windingC],
  );
}

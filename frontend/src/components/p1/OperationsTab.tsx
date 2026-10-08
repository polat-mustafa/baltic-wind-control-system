/**
 * Availability & O&M tab — where the "availability" line of the AEP cascade
 * comes from.
 *
 *   IEC 61400-26 fleet availability (TBA / EBA / PBA, downtime breakdown)
 *   Weather windows: monthly access probability per vessel type
 *   Maintenance & logistics cost (bottom-up)
 *   Repair window: next access and cost of one repair, from the farm's O&M port
 */

import { useEffect } from "react";

import { useWeatherWindowStore } from "../../store/weatherWindowStore";
import AvailabilityDashboard from "./AvailabilityDashboard";
import OAMCostPanel from "./OAMCostPanel";
import RepairWindowPanel from "./RepairWindowPanel";
import WeatherWindowPanel from "./WeatherWindowPanel";

export default function OperationsTab() {
  const { fetchAll, error } = useWeatherWindowStore();

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary max-w-4xl">
        The AEP cascade assumes 95 % availability. This tab shows where that number comes from: how
        often turbines are down (IEC 61400-26), when technicians can physically reach them (wave and
        wind limits per vessel), and what keeping them running costs.
      </p>
      <AvailabilityDashboard />
      {error && <p className="text-sm text-status-alarm">Weather-window data failed to load: {error}</p>}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <WeatherWindowPanel />
        <OAMCostPanel />
      </div>
      <RepairWindowPanel />
    </div>
  );
}

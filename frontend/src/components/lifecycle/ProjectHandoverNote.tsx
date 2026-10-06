/** One-line note on an operation page when the learner has their own layout project. */

import { Link } from "react-router-dom";

import { useFarmPlan } from "../../hooks/useFarmPlan";

export default function ProjectHandoverNote({ what }: { what: string }) {
  const farm = useFarmPlan();
  if (farm.source !== "project") return null;
  return (
    <p className="rounded-md border border-border-primary bg-bg-secondary px-3 py-2 text-[12px] text-text-secondary">
      Your project: {farm.turbines.length} turbines ({farm.capacityMW} MW) on {farm.strings.length} feeder bays. {what}{" "}
      <Link to="/build/handover" className="text-accent underline">
        Hand-over package
      </Link>
    </p>
  );
}

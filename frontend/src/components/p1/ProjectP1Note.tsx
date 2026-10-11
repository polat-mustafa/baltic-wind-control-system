/**
 * Own project on the Wind Resource page: this page studies SB-510's reference layouts
 * (named layouts on the backend); the own layout's energy yield is computed on the
 * Layout page from its own turbine positions. Says so instead of showing SB-510
 * numbers as if they were the project's.
 */

import { Link } from "react-router-dom";

import { useFleet } from "../../lib/fleet";

export default function ProjectP1Note() {
  const fleet = useFleet();
  if (fleet.source !== "project") return null;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-[12px] text-text-secondary">
      <span className="font-semibold text-text-primary">This page studies the SB-510 reference farm.</span>{" "}
      <span>The energy yield, wake loss and cost of your own layout are worked out from its turbine positions on the Layout page.</span>{" "}
      <Link to="/develop/layout" className="text-accent hover:underline">
        Open the Layout page
      </Link>
    </div>
  );
}

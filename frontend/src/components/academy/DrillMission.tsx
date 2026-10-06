/**
 * Control-room drill launcher: the drill runs on the live farm map
 * (route /, ScenarioCenter); its score is recorded here when it ends.
 */

import { Link } from "react-router-dom";
import { Play } from "lucide-react";

import type { Mission } from "../../academy/courses";
import { SCENARIOS } from "../../training/scenarios";

export default function DrillMission({ mission }: { mission: Mission }) {
  const sc = SCENARIOS.find((s) => s.id === mission.scenario);
  return (
    <div className="space-y-2 text-[13px] text-text-secondary">
      <p>
        This drill runs on the live farm map in the control room, with narration (mute it in the Scenarios panel). Wrong actions and
        answers cost 15 points each, every 10 s over the {sc?.parS ?? "?"} s par costs one. The score comes back to your record when
        the drill ends.
      </p>
      <Link
        to={`/?drill=${mission.scenario}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover"
      >
        <Play size={13} /> Start the drill in the control room
      </Link>
    </div>
  );
}

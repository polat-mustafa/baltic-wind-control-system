/**
 * Construction (route /build): install the learner's farm — or SB-510 —
 * in Baltic weather windows. The campaign is simulated over many synthetic
 * weather years (backend POST /api/v1/lifecycle/campaign) and reported as
 * P10 / P50 / P90 dates, waiting on weather and vessel cost.
 */

import { Link } from "react-router-dom";
import { ArrowRight, HardHat, Play } from "lucide-react";

import { useFarmPlan } from "../hooks/useFarmPlan";
import { campaignRequest } from "../lib/lifecycle/farm";
import { limitList, requestSignature, useLifecycleStore } from "../store/lifecycleStore";
import { Button } from "../components/ui/Button";
import { WatchOut } from "../components/site/Stages";
import CampaignControls from "../components/lifecycle/CampaignControls";
import { CampaignResultPanels } from "../components/lifecycle/CampaignResults";
import FarmSource from "../components/lifecycle/FarmSource";

export default function ConstructionPage() {
  const farm = useFarmPlan();
  const { build, setBuild, setLimit, run, results, resultFor, running, error, clearError } = useLifecycleStore();
  const req = campaignRequest(farm, { mode: "install", start_date: build.start, alpha: build.alpha, runs: build.runs, limits: limitList(build.limits) });
  const result = results.build;
  const stale = result != null && resultFor.build !== requestSignature(req);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2" data-tour="page-header">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
            <HardHat size={20} className="text-accent" aria-hidden />
            Construction
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Install the offshore substation, foundations, cables and turbines in Baltic weather windows. Every operation waits for sea states
            below its limit; the campaign is run over {build.runs} weather years to give P10 / P50 / P90 dates and the vessel bill.
          </p>
        </div>
        <Link to="/build/handover" className="flex items-center gap-1 text-[12px] text-accent underline">
          Hand-over package <ArrowRight size={13} aria-hidden />
        </Link>
      </div>

      <FarmSource farm={farm} />
      <CampaignControls
        value={build}
        vessels={["HLV", "CLV", "WTIV", "CTV"]}
        onChange={setBuild}
        onLimit={(v, l) => setLimit("build", v, l)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void run("build", req)} disabled={running.build}>
          <Play size={13} className="mr-1" /> {running.build ? "Simulating…" : "Simulate the campaign"}
        </Button>
        {stale && <span className="text-[12px] text-status-warning">Inputs changed since this result — run again.</span>}
      </div>
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-status-alarm/30 bg-status-alarm/10 p-3 text-sm">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {result ? (
        <div className={stale ? "opacity-60" : undefined}>
          <CampaignResultPanels result={result} finalId="cod" finalLabel="Full operation" />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border-primary p-4 text-[12px] text-text-secondary">
          <p className="font-semibold text-text-primary">How the campaign is built</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Heavy-lift vessel: offshore substation, then the foundations (four monopiles or two jackets per port trip).</li>
            <li>Cable-lay vessel: export cable first, then one array section behind each new foundation.</li>
            <li>Jack-up vessel: one turbine on each finished foundation, four turbine sets per port trip.</li>
            <li>Commissioning teams: energise the export system (the P5 switching programme), then string by string.</li>
          </ol>
        </div>
      )}

      <WatchOut text="Start dates matter more than vessel speed: a campaign that runs into the Baltic winter waits weeks for every window. Plan on P90, not on the median, when you fix a grid connection date." />
    </div>
  );
}

/**
 * P2 Grid · Advanced Analysis tab.
 *
 * Surfaces 8 backend endpoints that were previously orphaned from the UI:
 *   /dynamic-compliance, /frequency-response, /sso-analysis, /andes-network,
 *   /opf, /scopf, /dc-power-flow, /dc-contingency-screening.
 *
 * Each card uses the generic EndpointRunnerCard so the user can edit
 * request bodies and inspect raw responses — sufficient for an educational
 * "every line of code is explainable" simulation platform.
 */

import { useState, useCallback } from "react";

import { EndpointRunnerCard } from "./EndpointRunnerCard";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import {
  DEFAULTS,
  postDynamicCompliance,
  postFrequencyResponse,
  postSSOAnalysis,
  postOPF,
  postSCOPF,
  postDCPowerFlow,
  postDCContingency,
  getAndesNetwork,
} from "../../services/gridAdvancedApi";

export default function AdvancedAnalysisTab() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <EndpointRunnerCard
        title="Dynamic Compliance Assessment"
        description="Full ENTSO-E NC RfG Type D dynamic assessment: FRT, frequency response, SSO."
        standard="ENTSO-E NC RfG Type D · ANDES TDS"
        defaultBody={DEFAULTS.dynamicCompliance}
        runner={postDynamicCompliance}
      />
      <EndpointRunnerCard
        title="Frequency Response (FSM/LFSM)"
        description="Active power vs frequency droop response — FSM, LFSM-O, LFSM-U modes."
        standard="ENTSO-E NC RfG · droop %, deadband ±200 mHz"
        defaultBody={DEFAULTS.frequencyResponse}
        runner={postFrequencyResponse}
      />
      <EndpointRunnerCard
        title="Sub-Synchronous Oscillation (SSO) Screening"
        description="Eigenvalue screening for converter/cable interactions (15–60 Hz risk band)."
        standard="IEC TR 63227 · NERC-style SSO assessment"
        defaultBody={DEFAULTS.ssoAnalysis}
        runner={postSSOAnalysis}
      />
      <ANDESNetworkCard />
      <EndpointRunnerCard
        title="Optimal Power Flow (OPF)"
        description="Least-cost dispatch using AC nonlinear or DC linearised OPF."
        standard="Pandapower OPF · IEC 60909 limits"
        defaultBody={DEFAULTS.opf}
        runner={postOPF}
      />
      <EndpointRunnerCard
        title="Security-Constrained OPF (SCOPF)"
        description="OPF with N-1 contingency constraints — preventive dispatch."
        standard="ENTSO-E SOGL N-1 criterion"
        defaultBody={DEFAULTS.scopf}
        runner={postSCOPF}
      />
      <EndpointRunnerCard
        title="DC Power Flow (Linearised)"
        description="Fast DC approximation for screening — bus angles + line MW flows."
        standard="MATPOWER-style DC PF · θ-formulation"
        defaultBody={DEFAULTS.dcPowerFlow}
        runner={postDCPowerFlow}
      />
      <EndpointRunnerCard
        title="DC Contingency Screening"
        description="N-1 screening of all string outages using DC PF — fast overload sweep."
        standard="ENTSO-E SOGL · Bender's-style screening"
        defaultBody={DEFAULTS.dcContingency}
        runner={postDCContingency}
      />
    </div>
  );
}

/** Read-only fetch card for ANDES network spec (GET, no body). */
function ANDESNetworkCard() {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAndesNetwork());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader
        action={
          <Button size="sm" onClick={handleFetch} disabled={loading}>
            {loading ? "Fetching…" : "Fetch"}
          </Button>
        }
      >
        <CardTitle>ANDES Network Spec</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-text-secondary">
          Returns the ANDES dynamic network description used for time-domain
          simulations (buses, lines, generators, exciters, governors).
        </p>
        {error && (
          <div className="p-2 bg-status-alarm/10 border border-status-alarm/30 rounded text-xs text-status-alarm">
            {error}
          </div>
        )}
        {data !== null && (
          <pre className="font-mono text-[11px] bg-bg-tertiary border border-border-primary rounded p-2 text-text-primary overflow-auto max-h-80">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

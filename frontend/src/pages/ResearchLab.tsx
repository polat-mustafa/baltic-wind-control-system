/**
 * Research Lab — surfaces 8 P1 advanced wind-resource endpoints that were
 * previously orphaned from the UI (audit 2026-04-20).
 *
 * Notebook-style cards: each runs one POST /api/v1/wind/<tool> call with an
 * editable JSON body and a JSON response viewer. Reuses the generic
 * EndpointRunnerCard pattern from the P2 Grid Advanced tab.
 *
 * Kept as a separate route (/research-lab) so production-flow operators on
 * P1 dashboards aren't distracted by experimental research tools.
 */

import { FlaskConical } from "lucide-react";

import { EndpointRunnerCard } from "../components/p2/EndpointRunnerCard";
import {
  RESEARCH_DEFAULTS,
  postHelixControl,
  postDynamicFlow,
  postCFDSimulation,
  postSimultaneousOpt,
  postAdjointSensitivities,
  postTwoStageStochastic,
  postMGA,
  postGaussianFlowers,
} from "../services/p1ResearchApi";

export default function ResearchLab() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-accent/15 flex items-center justify-center">
          <FlaskConical size={18} className="text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            Research Lab — Advanced Wind Resource Tools
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Experimental P1 endpoints — wake mitigation, dynamic flow,
            stochastic optimisation, CFD. Each card is a deterministic
            backend simulation; edit the JSON body, click Run.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <EndpointRunnerCard
          title="Helix Wake Control"
          description="Individual pitch control (helix forcing) to redirect wakes — net farm gain."
          standard="van der Hoek 2022 · helix amplitude / frequency"
          defaultBody={RESEARCH_DEFAULTS.helixControl}
          runner={postHelixControl}
        />
        <EndpointRunnerCard
          title="Dynamic Wake Flow"
          description="Time-resolved wake advection: ramp rates, variability, settling time."
          standard="DWM (Dynamic Wake Meandering) — Larsen 2008"
          defaultBody={RESEARCH_DEFAULTS.dynamicFlow}
          runner={postDynamicFlow}
        />
        <EndpointRunnerCard
          title="CFD Simulation"
          description="RANS k-ω SST simulation of farm flow — TKE, thrust, mesh convergence."
          standard="OpenFOAM SOWFA · IEC 61400-1 Annex E"
          defaultBody={RESEARCH_DEFAULTS.cfdSimulation}
          runner={postCFDSimulation}
        />
        <EndpointRunnerCard
          title="Simultaneous Layout + Control Opt."
          description="Joint optimisation of turbine positions AND yaw/pitch control."
          standard="Stanley & Ning 2019 · WPGNN gradient method"
          defaultBody={RESEARCH_DEFAULTS.simultaneousOpt}
          runner={postSimultaneousOpt}
        />
        <EndpointRunnerCard
          title="Adjoint Sensitivities"
          description="Per-turbine AEP gradient — identifies highest-impact micro-siting moves."
          standard="Continuous-adjoint method · Gebraad 2017"
          defaultBody={RESEARCH_DEFAULTS.adjointSensitivity}
          runner={postAdjointSensitivities}
        />
        <EndpointRunnerCard
          title="Two-Stage Stochastic Optimisation"
          description="Robust layout under wind-resource scenario uncertainty (VSS metric)."
          standard="Birge & Louveaux · L-shaped method"
          defaultBody={RESEARCH_DEFAULTS.twoStageStochastic}
          runner={postTwoStageStochastic}
        />
        <EndpointRunnerCard
          title="Modelling-to-Generate-Alternatives (MGA)"
          description="Find diverse near-optimal layouts within an AEP slack — robust planning."
          standard="Brill et al. 1982 · diversity-weighted search"
          defaultBody={RESEARCH_DEFAULTS.mga}
          runner={postMGA}
        />
        <EndpointRunnerCard
          title="Gaussian-FLOWERS AEP"
          description="Fast Fourier-mode AEP — Gaussian wake comparison vs Jensen baseline."
          standard="Bay et al. 2022 · FLOWERS analytical AEP"
          defaultBody={RESEARCH_DEFAULTS.gaussianFlowers}
          runner={postGaussianFlowers}
        />
      </div>
    </div>
  );
}

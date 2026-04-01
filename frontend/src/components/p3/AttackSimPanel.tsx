/**
 * Attack Simulation Panel — M07 Cybersecurity.
 *
 * 5 attack scenarios (REPLAY_ATTACK, MITM_GOOSE, CREDENTIAL_BRUTE_FORCE,
 *   ROGUE_DEVICE, RANSOMWARE_IT_LATERAL).
 * Step-by-step narrative cards: each step shows action, result, detection, and mitigating control.
 * Educational only — no real hardware effect.
 */

import { useSecurityStore } from "../../store/securityStore";
import { Button } from "../ui/Button";
import type { AttackScenarioId } from "../../types/security";

const SCENARIOS: { id: AttackScenarioId; label: string; vector: string }[] = [
  { id: "REPLAY_ATTACK", label: "Replay Attack", vector: "GOOSE/SV frames" },
  { id: "MITM_GOOSE", label: "MITM — GOOSE", vector: "Layer 2 intercept" },
  { id: "CREDENTIAL_BRUTE_FORCE", label: "Credential Brute Force", vector: "Engineering WS" },
  { id: "ROGUE_DEVICE", label: "Rogue Device", vector: "Field network" },
  { id: "RANSOMWARE_IT_LATERAL", label: "IT Lateral / Ransomware", vector: "IT → OT pivot" },
];

export default function AttackSimPanel() {
  const {
    selectedScenario,
    attackResult,
    attackLoading,
    setSelectedScenario,
    simulateAttack,
  } = useSecurityStore();

  return (
    <div className="space-y-3">
      {/* Scenario selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value as AttackScenarioId)}
          className="text-xs bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-text-secondary flex-1"
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>{s.label} — {s.vector}</option>
          ))}
        </select>
        <Button size="sm" onClick={simulateAttack} disabled={attackLoading}>
          {attackLoading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Simulating…
            </span>
          ) : "Run Scenario"}
        </Button>
      </div>

      {/* Results */}
      {attackResult && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex items-center justify-between bg-bg-tertiary rounded-lg p-3 text-xs">
            <div>
              <p className="text-text-muted">Scenario</p>
              <p className="font-semibold text-text-primary">{attackResult.scenario_name}</p>
            </div>
            <div>
              <p className="text-text-muted">Target zone</p>
              <p className="font-mono text-text-primary">{attackResult.targeted_zone}</p>
            </div>
            <span className={`px-2 py-1 rounded font-semibold ${attackResult.overall_blocked ? "bg-status-success/20 text-status-success" : "bg-status-alarm/20 text-status-alarm"}`}>
              {attackResult.overall_blocked ? "Blocked" : "Breached"}
            </span>
          </div>

          {/* Step-by-step */}
          <div className="space-y-2">
            {attackResult.steps.map((step) => (
              <div key={step.step} className={`rounded-lg border p-2.5 text-xs ${step.detected ? "border-status-success/30 bg-status-success/5" : "border-status-alarm/30 bg-status-alarm/5"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-text-muted">Step {step.step}</span>
                  <span className={step.detected ? "text-status-success" : "text-status-alarm"}>
                    {step.detected ? "Detected ✓" : "Undetected ✗"}
                  </span>
                </div>
                <p className="text-text-primary mb-1"><span className="text-text-muted">Action: </span>{step.action}</p>
                <p className="text-text-secondary mb-1"><span className="text-text-muted">Result: </span>{step.result}</p>
                <p className="text-status-success"><span className="text-text-muted">Control: </span>{step.mitigating_control}</p>
              </div>
            ))}
          </div>

          {/* Lessons learned */}
          {attackResult.lessons_learned.length > 0 && (
            <div className="bg-bg-tertiary rounded-lg p-3 text-xs space-y-1">
              <p className="text-text-secondary font-semibold mb-1.5">Lessons learned</p>
              {attackResult.lessons_learned.map((lesson, i) => (
                <p key={i} className="text-text-muted">• {lesson}</p>
              ))}
              <p className="text-text-muted mt-2 font-mono">{attackResult.iec62443_references.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

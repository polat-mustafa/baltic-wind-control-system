/**
 * Commissioning page — route /commissioning.
 *
 * Loads the programme list on mount. If no programmes exist, shows a
 * "Create Programme" form. Once a programme is selected, renders the
 * full CommissioningDashboard.
 */

import { useEffect, useState } from "react";
import { Play, FolderOpen } from "lucide-react";

import CommissioningDashboard from "../components/p5/CommissioningDashboard";
import { useCommissioningStore } from "../store/commissioningStore";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

export default function CommissioningPage() {
  const {
    programmes,
    activeProgramme,
    error,
    loading,
    fetchProgrammes,
    createProgramme,
    selectProgramme,
    startProgramme,
    clearError,
  } = useCommissioningStore();

  const [picName, setPicName] = useState("");

  useEffect(() => {
    fetchProgrammes();
  }, [fetchProgrammes]);

  if (activeProgramme) {
    return <CommissioningDashboard />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          P5 · HV Commissioning Simulator
        </h2>
        <p className="text-xs text-text-muted mt-1 font-mono">
          30-step switching programme · LOTO isolation · SAT verification
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between items-center">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Create programme form */}
      <Card>
        <CardHeader>
          <CardTitle>Create Switching Programme</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary mb-4">
            Create a 30-step OSS first energisation programme. Enter the Person in
            Control (PiC) name to begin.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!picName.trim()) return;
              await createProgramme(picName.trim());
              setPicName("");
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              placeholder="PiC name (e.g. Jan Kowalski)"
              className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-md text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <Button
              type="submit"
              disabled={loading || !picName.trim()}
            >
              {loading ? "Creating..." : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Programme list */}
      {programmes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Programmes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {programmes.map((prog) => (
                <div
                  key={prog.programme_id}
                  className="flex items-center justify-between p-3 rounded-md border border-border-primary bg-bg-tertiary hover:border-border-secondary transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {prog.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-text-muted">
                        PiC: {prog.pic_name}
                      </span>
                      <Badge
                        variant={
                          prog.status === "completed"
                            ? "normal"
                            : prog.status === "in_progress"
                              ? "info"
                              : "neutral"
                        }
                      >
                        {prog.status}
                      </Badge>
                      <span className="text-xs text-text-muted font-mono">
                        {prog.completed_steps}/{prog.total_steps}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {prog.status === "created" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => startProgramme(prog.programme_id)}
                      >
                        <Play size={12} />
                        Start
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => selectProgramme(prog.programme_id)}
                    >
                      <FolderOpen size={12} />
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

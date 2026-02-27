/**
 * Commissioning page — route /commissioning.
 *
 * Loads the programme list on mount. If no programmes exist, shows a
 * "Create Programme" form. Once a programme is selected, renders the
 * full CommissioningDashboard.
 */

import { useEffect, useState } from "react";

import CommissioningDashboard from "../components/p5/CommissioningDashboard";
import { useCommissioningStore } from "../store/commissioningStore";

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

  // Active programme selected → show dashboard
  if (activeProgramme) {
    return <CommissioningDashboard />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">
        P5 · HV Commissioning Simulator
      </h2>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-200 ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Create programme form */}
      <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">
          Create Switching Programme
        </h3>
        <p className="text-sm text-slate-400 mb-4">
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
            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !picName.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </form>
      </div>

      {/* Programme list */}
      {programmes.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Existing Programmes</h3>
          <div className="space-y-2">
            {programmes.map((prog) => (
              <div
                key={prog.programme_id}
                className="flex items-center justify-between p-3 bg-slate-700/50 rounded border border-slate-600"
              >
                <div>
                  <div className="text-sm font-medium">{prog.title}</div>
                  <div className="text-xs text-slate-400">
                    PiC: {prog.pic_name} · Status:{" "}
                    <span className="uppercase">{prog.status}</span> ·{" "}
                    {prog.completed_steps}/{prog.total_steps} steps
                  </div>
                </div>
                <div className="flex gap-2">
                  {prog.status === "created" && (
                    <button
                      onClick={() => startProgramme(prog.programme_id)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs font-medium transition-colors"
                    >
                      Start
                    </button>
                  )}
                  <button
                    onClick={() => selectProgramme(prog.programme_id)}
                    className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-xs font-medium transition-colors"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

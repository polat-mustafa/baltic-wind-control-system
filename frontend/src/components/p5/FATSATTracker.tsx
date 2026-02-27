/**
 * FAT/SAT test campaign tracker.
 *
 * Tabbed view showing Factory Acceptance Tests (FAT) and Site Acceptance
 * Tests (SAT). Each tab displays:
 * - Test specifications table with IEC standard references
 * - Recorded results with pass/fail/pending coloring
 * - Record result and approve campaign actions
 *
 * Standards:
 * - IEC 60076 (transformer tests), IEC 62271-100 (CB tests)
 * - IEC 61850-10 (communication conformance)
 * - FAT happens at manufacturer's factory before shipping
 * - SAT happens on-site after installation, linked to the switching programme
 */

import { useState } from "react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { useCommissioningStore } from "../../store/commissioningStore";
import type { FATCampaign, SATCampaign, TestSpecification, TestResult } from "../../types/commissioning";

const VERDICT_COLORS: Record<string, string> = {
  pass: SCADA_COLORS.ENERGIZED,
  fail: SCADA_COLORS.FAULT,
  not_tested: SCADA_COLORS.DE_ENERGIZED,
  conditional_pass: SCADA_COLORS.WARNING,
};

function TestTable({
  specs,
  results,
  onRecord,
  canRecord,
}: {
  specs: TestSpecification[];
  results: TestResult[];
  onRecord: (testId: string, value: number, notes: string) => void;
  canRecord: boolean;
}) {
  const [recording, setRecording] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const resultMap = new Map(results.map((r) => [r.test_id, r]));

  return (
    <div className="overflow-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-700/50">
          <tr>
            <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Test ID</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Name</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Standard</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Range</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Result</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Verdict</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Action</th>
          </tr>
        </thead>
        <tbody>
          {specs.map((spec) => {
            const result = resultMap.get(spec.test_id);
            const isRecording = recording === spec.test_id;

            return (
              <tr key={spec.test_id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                <td className="px-3 py-2 text-xs font-mono">{spec.test_id}</td>
                <td className="px-3 py-2 text-xs" title={spec.description}>{spec.name}</td>
                <td className="px-3 py-2 text-[10px] text-slate-400">{spec.standard}</td>
                <td className="px-3 py-2 text-[10px] text-slate-400">
                  {spec.min_value}–{spec.max_value} {spec.unit}
                </td>
                <td className="px-3 py-2 text-xs font-mono">
                  {result ? `${result.measured_value} ${spec.unit}` : "—"}
                </td>
                <td className="px-3 py-2">
                  {result ? (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase"
                      style={{
                        backgroundColor: (VERDICT_COLORS[result.verdict] ?? SCADA_COLORS.DE_ENERGIZED) + "33",
                        color: VERDICT_COLORS[result.verdict] ?? SCADA_COLORS.DE_ENERGIZED,
                      }}
                    >
                      {result.verdict}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">Pending</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {canRecord && !result && !isRecording && (
                    <button
                      onClick={() => setRecording(spec.test_id)}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-[10px] font-medium transition-colors"
                    >
                      Record
                    </button>
                  )}
                  {isRecording && (
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Value"
                        className="w-16 px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-[10px] text-white focus:outline-none"
                        autoFocus
                        step="any"
                      />
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes"
                        className="w-20 px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-[10px] text-white focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          if (value) {
                            onRecord(spec.test_id, parseFloat(value), notes);
                            setRecording(null);
                            setValue("");
                            setNotes("");
                          }
                        }}
                        disabled={!value}
                        className="px-1.5 py-0.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 rounded text-[10px] transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setRecording(null); setValue(""); setNotes(""); }}
                        className="px-1.5 py-0.5 bg-slate-600 hover:bg-slate-500 rounded text-[10px] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FATTab() {
  const {
    fatCampaigns,
    createFATCampaign,
    recordFATResult,
    approveFATCampaign,
    activeProgramme,
  } = useCommissioningStore();

  const [equipmentTag, setEquipmentTag] = useState("");
  const picName = activeProgramme?.pic_name ?? "PiC";

  return (
    <div className="space-y-4">
      {/* Create FAT campaign */}
      <div className="flex gap-2">
        <input
          type="text"
          value={equipmentTag}
          onChange={(e) => setEquipmentTag(e.target.value)}
          placeholder="Equipment tag (e.g. TX-OSS-01)"
          className="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => { if (equipmentTag.trim()) { createFATCampaign(equipmentTag.trim()); setEquipmentTag(""); } }}
          disabled={!equipmentTag.trim()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
        >
          Create FAT
        </button>
      </div>

      {/* FAT campaigns */}
      {fatCampaigns.map((campaign: FATCampaign) => (
        <div key={campaign.campaign_id} className="border border-slate-600 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-slate-700/50 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium">{campaign.equipment_tag}</span>
              <span className="text-[10px] text-slate-400 ml-2">
                {campaign.campaign_id}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase"
                style={{
                  backgroundColor: campaign.status === "approved" ? SCADA_COLORS.ENERGIZED + "33" : SCADA_COLORS.WARNING + "33",
                  color: campaign.status === "approved" ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.WARNING,
                }}
              >
                {campaign.status}
              </span>
              {campaign.all_passed && campaign.status !== "approved" && (
                <button
                  onClick={() => approveFATCampaign(campaign.campaign_id, picName)}
                  className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-[10px] font-medium transition-colors"
                >
                  Approve
                </button>
              )}
            </div>
          </div>
          <TestTable
            specs={campaign.specs}
            results={campaign.results}
            onRecord={(testId, val, notes) => recordFATResult(campaign.campaign_id, testId, val, picName, notes)}
            canRecord={campaign.status !== "approved"}
          />
        </div>
      ))}

      {fatCampaigns.length === 0 && (
        <div className="text-center text-sm text-slate-500 py-4">
          No FAT campaigns created yet
        </div>
      )}
    </div>
  );
}

function SATTab() {
  const {
    satCampaign,
    createSATCampaign,
    recordSATResult,
    approveSATCampaign,
    activeProgramme,
  } = useCommissioningStore();

  const picName = activeProgramme?.pic_name ?? "PiC";

  if (!satCampaign) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-400 mb-4">
          No SAT campaign for this programme
        </p>
        <button
          onClick={() => createSATCampaign(false)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
        >
          Create SAT Campaign
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400">Campaign: </span>
          <span className="text-xs font-mono">{satCampaign.campaign_id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase"
            style={{
              backgroundColor: satCampaign.status === "approved" ? SCADA_COLORS.ENERGIZED + "33" : SCADA_COLORS.WARNING + "33",
              color: satCampaign.status === "approved" ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.WARNING,
            }}
          >
            {(satCampaign as SATCampaign).status}
          </span>
          {satCampaign.all_passed && satCampaign.status !== "approved" && (
            <button
              onClick={() => approveSATCampaign(picName)}
              className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-[10px] font-medium transition-colors"
            >
              Approve
            </button>
          )}
        </div>
      </div>
      <TestTable
        specs={satCampaign.specs}
        results={satCampaign.results}
        onRecord={(testId, val, notes) => recordSATResult(testId, val, picName, notes)}
        canRecord={satCampaign.status !== "approved"}
      />
    </div>
  );
}

export default function FATSATTracker() {
  const [activeTab, setActiveTab] = useState<"fat" | "sat">("fat");

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Tab header */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab("fat")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "fat"
              ? "bg-slate-700 text-white border-b-2 border-blue-500"
              : "text-slate-400 hover:text-white hover:bg-slate-700/50"
          }`}
        >
          FAT — Factory Acceptance
        </button>
        <button
          onClick={() => setActiveTab("sat")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "sat"
              ? "bg-slate-700 text-white border-b-2 border-blue-500"
              : "text-slate-400 hover:text-white hover:bg-slate-700/50"
          }`}
        >
          SAT — Site Acceptance
        </button>
      </div>

      <div className="p-4">
        {activeTab === "fat" ? <FATTab /> : <SATTab />}
      </div>
    </div>
  );
}

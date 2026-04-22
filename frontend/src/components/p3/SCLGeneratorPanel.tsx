/**
 * SCL Generator Panel — IEC 61850-6 configuration files.
 *
 * Surfaces POST /api/v1/scada/scl-generate (previously orphaned from UI).
 * User selects SSD / ICD / SCD; for ICD an IED device name is required.
 * Generated XML can be inspected and downloaded as a .scd / .icd / .ssd file.
 */

import { useState, useCallback } from "react";
import { Download, FileCode, AlertTriangle } from "lucide-react";

import { generateSCL } from "../../services/sclApi";
import type { SCLFileResponse, SCLFileType } from "../../services/sclApi";
import { Button } from "../ui/Button";

const FILE_TYPES: { value: SCLFileType; label: string; help: string }[] = [
  { value: "SSD", label: "SSD", help: "Substation Specification Description — voltage levels & bays" },
  { value: "ICD", label: "ICD", help: "IED Capability Description — single device's logical nodes (requires device name)" },
  { value: "SCD", label: "SCD", help: "Substation Configuration Description — full substation, all IEDs combined" },
];

const EXAMPLE_DEVICES = [
  "OSS_BUSBAR_PROT",
  "OSS_TX_PROT_1",
  "OSS_BAY_CTRL_F1",
  "WTG_01_BCU",
  "WTG_02_BCU",
];

export default function SCLGeneratorPanel() {
  const [fileType, setFileType] = useState<SCLFileType>("SCD");
  const [deviceName, setDeviceName] = useState<string>(EXAMPLE_DEVICES[0]);
  const [result, setResult] = useState<SCLFileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateSCL({
        file_type: fileType,
        device_name: fileType === "ICD" ? deviceName : null,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [fileType, deviceName]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.xml_content], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.name}.${result.file_type.toLowerCase()}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <div className="space-y-3">
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode size={14} className="text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">
              SCL Generator (IEC 61850-6)
            </h3>
            <span className="text-[10px] text-text-muted font-mono uppercase tracking-wide">
              POST /scada/scl-generate
            </span>
          </div>
          <Button size="sm" onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating…" : "Generate"}
          </Button>
        </div>

        <p className="text-xs text-text-secondary">
          Produces an XML configuration file (SSD / ICD / SCD) for the offshore
          substation per IEC 61850-6, used by IED engineering tools (Helinks
          STS, ABB IET600) to configure protection and control devices.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {FILE_TYPES.map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer rounded border px-3 py-2 transition-colors ${
                fileType === opt.value
                  ? "border-accent bg-accent/10"
                  : "border-border-primary hover:border-border-secondary"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scl-type"
                  value={opt.value}
                  checked={fileType === opt.value}
                  onChange={() => setFileType(opt.value)}
                  className="accent-accent"
                />
                <span className="font-mono text-xs font-bold text-text-primary">
                  {opt.label}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-text-muted leading-snug">
                {opt.help}
              </p>
            </label>
          ))}
        </div>

        {fileType === "ICD" && (
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text-muted block mb-1">
              IED Device Name
            </label>
            <input
              list="scl-devices"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full font-mono text-xs bg-bg-tertiary border border-border-primary rounded px-2 py-1.5 text-text-primary"
            />
            <datalist id="scl-devices">
              {EXAMPLE_DEVICES.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
        )}

        {error && (
          <div className="p-2 bg-status-alarm/10 border border-status-alarm/30 rounded text-xs text-status-alarm flex items-center gap-2">
            <AlertTriangle size={12} /> {error}
          </div>
        )}
      </div>

      {result && (
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-secondary">
              <span className="font-mono text-text-primary">{result.name}</span>
              <span className="ml-2 text-text-muted">
                · {result.file_type} · {(result.xml_content.length / 1024).toFixed(1)} KB
              </span>
            </div>
            <Button size="sm" variant="secondary" onClick={handleDownload}>
              <Download size={11} />
              Download
            </Button>
          </div>
          <pre className="font-mono text-[10px] bg-bg-tertiary border border-border-primary rounded p-2 text-text-primary overflow-auto max-h-96">
            {result.xml_content}
          </pre>
        </div>
      )}
    </div>
  );
}

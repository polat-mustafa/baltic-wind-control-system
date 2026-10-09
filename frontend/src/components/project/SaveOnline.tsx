/**
 * Save the project online and share it by link (store/projectSync.ts).
 * Shows the auto-save state and, after a conflict, which copy to keep.
 */

import { useState } from "react";
import { Check, Cloud, CloudOff, Link2, Loader2, TriangleAlert, Trash2 } from "lucide-react";

import { shareLink, useProjectSync, type SyncState } from "../../store/projectSync";
import { Button } from "../ui/Button";

const STATE: Record<SyncState, { label: string; icon: typeof Check; tone: string }> = {
  saved: { label: "Saved online", icon: Check, tone: "text-status-normal" },
  saving: { label: "Saving…", icon: Loader2, tone: "text-text-secondary" },
  offline: {
    label: "Offline — will save when back online",
    icon: CloudOff,
    tone: "text-status-warning",
  },
  conflict: {
    label: "Changed elsewhere",
    icon: TriangleAlert,
    tone: "text-status-warning",
  },
  error: { label: "Not saved", icon: TriangleAlert, tone: "text-status-alarm" },
};

export const PRIVACY_NOTE =
  "Anyone with the link can open and edit this project. Do not enter personal data. Projects not opened for 12 months are deleted.";

export function SaveOnline() {
  const s = useProjectSync();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!s.id) return;
    try {
      await navigator.clipboard.writeText(shareLink(s.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy the project link:", shareLink(s.id));
    }
  };

  if (!s.id)
    return (
      <div className="flex flex-col items-end gap-1">
        <Button variant="ghost" size="sm" onClick={() => void s.saveOnline()} disabled={s.sync === "saving"} title={PRIVACY_NOTE}>
          <Cloud size={13} className="mr-1" /> {s.sync === "saving" ? "Saving…" : "Save online"}
        </Button>
        {s.error && (
          <span role="alert" className="text-xs text-status-alarm">
            {s.error}
          </span>
        )}
      </div>
    );

  const st = STATE[s.sync ?? "saving"];
  const Icon = st.icon;
  return (
    <div className="flex max-w-md flex-col items-end gap-1 text-xs">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span className={`flex items-center gap-1 ${st.tone}`} role="status">
          <Icon size={12} className={s.sync === "saving" ? "animate-spin" : undefined} aria-hidden /> {st.label}
        </span>
        <Button variant="ghost" size="sm" onClick={() => void copy()}>
          <Link2 size={13} className="mr-1" /> {copied ? "Link copied" : "Copy link"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm("Delete the online copy? This browser keeps the project.")) void s.remove();
          }}
          aria-label="Delete the online copy"
          title="Delete the online copy"
        >
          <Trash2 size={13} />
        </Button>
      </div>
      {s.sync === "conflict" && (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="text-text-secondary">{s.error ?? "The project was changed elsewhere."}</span>
          <Button variant="secondary" size="sm" onClick={() => void s.resolve("saved")}>
            Load saved copy
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void s.resolve("mine")}>
            Keep mine
          </Button>
        </div>
      )}
      {s.sync === "error" && s.error && (
        <span role="alert" className="text-status-alarm">
          {s.error}
        </span>
      )}
      <span className="text-text-muted">{PRIVACY_NOTE}</span>
    </div>
  );
}

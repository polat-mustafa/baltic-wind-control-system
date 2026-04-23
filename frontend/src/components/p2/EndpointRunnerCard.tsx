/**
 * Generic endpoint-runner card.
 *
 * Used to surface 18+ backend endpoints that previously had no UI.
 * Renders a header (title + standard tag), an editable JSON request body
 * pre-filled with sensible defaults, a "Run" button, and a JSON viewer
 * for the response. Runtime errors surface in a red banner.
 *
 * The runner is deliberately schema-agnostic — each card receives a
 * `runner: (body) => Promise<unknown>` callback and a typed default body,
 * so new endpoints can be wired in <10 lines of code.
 */

import { useState, useCallback } from "react";
import { Play, BookOpen } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";

interface EndpointRunnerCardProps<TBody extends object> {
  /** Display title (short — appears in card header) */
  title: string;
  /** One-line description below the title */
  description: string;
  /** Standards or tools, displayed as a small tag (optional) */
  standard?: string;
  /** Default request body (deep-cloned per render) */
  defaultBody: TBody;
  /** Async callback that submits the request */
  runner: (body: TBody) => Promise<unknown>;
  /** Optional custom result renderer; defaults to JSON viewer */
  renderResult?: (result: unknown) => React.ReactNode;
}

export function EndpointRunnerCard<TBody extends object>({
  title,
  description,
  standard,
  defaultBody,
  runner,
  renderResult,
}: EndpointRunnerCardProps<TBody>) {
  const [bodyText, setBodyText] = useState(() => JSON.stringify(defaultBody, null, 2));
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const parsed = JSON.parse(bodyText) as TBody;
      const response = await runner(parsed);
      setResult(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setRunning(false);
    }
  }, [bodyText, runner]);

  const handleReset = useCallback(() => {
    setBodyText(JSON.stringify(defaultBody, null, 2));
    setResult(null);
    setError(null);
  }, [defaultBody]);

  return (
    <Card>
      <CardHeader
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={running}
            >
              Reset
            </Button>
            <Button size="sm" onClick={handleRun} disabled={running}>
              {running ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running…
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Play size={11} />
                  Run
                </span>
              )}
            </Button>
          </div>
        }
      >
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs text-text-secondary">{description}</p>
          {standard && (
            <p className="text-[10px] text-text-muted flex items-center gap-1">
              <BookOpen size={10} />
              {standard}
            </p>
          )}
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wide text-text-muted block mb-1">
            Request Body (JSON)
          </label>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            spellCheck={false}
            rows={Math.min(10, Math.max(4, bodyText.split("\n").length))}
            className="w-full font-mono text-[11px] bg-bg-tertiary border border-border-primary rounded p-2 text-text-primary focus:outline-none focus:border-accent"
          />
        </div>

        {error && (
          <div className="p-2 bg-status-alarm/10 border border-status-alarm/30 rounded text-xs text-status-alarm">
            {error}
          </div>
        )}

        {result !== null && (
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text-muted block mb-1">
              Response
            </label>
            {renderResult ? (
              renderResult(result)
            ) : (
              <pre className="font-mono text-[11px] bg-bg-tertiary border border-border-primary rounded p-2 text-text-primary overflow-auto max-h-80">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

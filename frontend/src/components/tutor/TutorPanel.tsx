/**
 * AI tutor — a chat panel on every page.
 *
 * Bring your own key: pick an OpenAI-compatible provider and paste a key, or "Sign in with
 * OpenRouter". The key goes once to the backend and stays in its memory for the session
 * (HttpOnly cookie); nothing is stored in this browser. The tutor sees the page you are on
 * (its title, text and numbers) and answers numeric questions with the platform's own
 * calculators — each answer lists the tools it ran. The microphone uses the browser's
 * Web Speech API where available.
 */

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Mic, MessageCircleQuestion, Send, X } from "lucide-react";

import * as api from "../../services/tutorApi";

const TutorMarkdown = lazy(() => import("./TutorMarkdown"));

type Msg = api.TutorTurn & { tools?: api.TutorToolCall[]; truncated?: boolean };

const TOOL_TITLES: Record<string, string> = {
  plant_facts: "Plant facts",
  turbine_operating_point: "Turbine operating point",
  export_cable: "Export cable",
  short_circuit: "Short circuit",
};

/** Unit from the last word of a result key (`rated_ms` → m/s); the backend names keys this way. */
const UNITS: Record<string, string> = {
  ms: "m/s", kw: "kW", mw: "MW", km: "km", m: "m", kv: "kV", ka: "kA", mva: "MVA", mvar: "Mvar",
  kn: "kN", knm: "kN·m", rpm: "rpm", deg: "°", pu: "pu", pct: "%", hz: "Hz",
};

const round = (x: number) => Number(x.toPrecision(5));

function fmt(v: unknown): string {
  if (typeof v === "number") return String(round(v));
  if (v && typeof v === "object") return JSON.stringify(v, (_, x) => (typeof x === "number" ? round(x) : x));
  return String(v);
}

/** One tool result as label / value rows: `rotor_diameter_m: 241.35` → ["rotor diameter", "241.35 m"]. */
function resultRows(result: Record<string, unknown>): [string, string][] {
  return Object.entries(result).map(([key, v]) => {
    const words = key.split("_");
    const unit = words.length > 1 ? UNITS[words[words.length - 1]] : undefined;
    return [(unit ? words.slice(0, -1) : words).join(" "), unit ? `${fmt(v)} ${unit}` : fmt(v)];
  });
}

function ToolCalls({ tools, shown }: { tools: api.TutorToolCall[]; shown: Set<string> }) {
  return (
    <details className="mt-2 rounded-md border border-border-primary text-xs text-text-muted">
      <summary className="cursor-pointer px-2 py-1">
        Calculated with{" "}
        {tools.map((t, j) => (
          <span key={j}>
            {j > 0 && " · "}
            {TOOL_TITLES[t.name] ?? t.name}
          </span>
        ))}
      </summary>
      {tools.map((t, j) => {
        const id = `${t.name}${t.arguments ?? ""}${JSON.stringify(t.result)}`;
        const repeat = shown.has(id);
        shown.add(id);
        return (
          <div key={j} className="border-t border-border-primary px-2 py-1.5">
            <div className="font-mono text-[11px]" translate="no">
              {t.name}({t.arguments && t.arguments !== "{}" ? t.arguments : ""})
            </div>
            {repeat ? (
              <div className="italic">Same result as above.</div>
            ) : (
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5" translate="no">
                {resultRows(t.result).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-text-muted">{k}</dt>
                    <dd className="break-words font-mono text-text-primary">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
    </details>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function speechRecognition(): SpeechCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** What the learner sees: route, page title, and the text and numbers of the page. */
function pageContext(route: string) {
  const main = document.querySelector("main");
  return {
    route,
    title: main?.querySelector("h1")?.textContent?.trim() ?? document.title,
    text: (main?.innerText || main?.textContent || "").replace(/\s+\n/g, "\n").slice(0, 8000),
  };
}

const input = "w-full rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1.5 text-sm text-text-primary";

function ConnectForm({ onConnected }: { onConnected: (s: api.TutorStatus) => void }) {
  const [providers, setProviders] = useState<api.TutorProvider[]>([]);
  const [provider, setProvider] = useState("openrouter");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.getProviders().then(setProviders).catch(() => setProviders([]));
  }, []);
  const p = providers.find((x) => x.id === provider);

  async function submit() {
    setError(null);
    try {
      onConnected(await api.connect(provider, key, model));
      setKey("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function openRouter() {
    try {
      sessionStorage.setItem("of.tutor.return", window.location.pathname);
    } catch {
      /* return to the start page instead */
    }
    try {
      const { auth_url } = await api.openRouterStart(`${window.location.origin}/tutor/callback`);
      window.location.assign(auth_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-3 p-3 text-sm text-text-secondary">
      <p>
        The tutor uses a language model you choose, with your own key. Cheap models work: it answers numeric questions
        with this platform&apos;s calculators.
      </p>
      <button type="button" onClick={() => void openRouter()} className="w-full rounded-md bg-accent px-3 py-2 font-semibold text-accent-ink hover:bg-accent-hover">
        Sign in with OpenRouter
      </button>
      <div className="text-center text-xs text-text-muted">or paste a key</div>
      <label className="block">
        <span className="text-xs">Provider</span>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className={input}>
          {providers.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs">Model id</span>
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={p?.default_model || "e.g. the provider's small model"} className={input} />
      </label>
      <label className="block">
        <span className="text-xs">API key</span>
        <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} className={input} />
      </label>
      {p && (
        <a href={p.keys_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
          Get a {p.title} key →
        </a>
      )}
      <button type="button" disabled={!key} onClick={() => void submit()} className="w-full rounded-md border border-border-secondary px-3 py-2 font-semibold text-text-primary hover:bg-bg-hover disabled:opacity-50">
        Connect
      </button>
      {error && <p className="text-xs text-status-alarm">{error}</p>}
      <p className="text-xs text-text-muted">
        Your key goes to the OffshoreForge server and stays in its memory for this session (8 h); it is never saved in
        this browser. Chat subscriptions (ChatGPT, Claude, Gemini apps) do not give API keys — OpenRouter reaches most
        models with one key.
      </p>
    </div>
  );
}

export default function TutorPanel() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<api.TutorStatus | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const Speech = speechRecognition();
  const shown = new Set<string>(); // tool results already shown in this conversation (filled while rendering)

  useEffect(() => {
    if (open) api.getStatus().then(setStatus).catch(() => setStatus({ connected: false, provider: "", provider_title: "", model: "" }));
  }, [open]);
  useEffect(() => end.current?.scrollIntoView?.({ block: "end" }), [msgs, busy]);

  async function send() {
    const q = question.trim();
    if (!q || busy) return;
    setQuestion("");
    setError(null);
    const history = msgs.map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const r = await api.ask(q, history, pageContext(pathname));
      setMsgs((m) => [...m, { role: "assistant", content: r.answer, tools: r.tools, truncated: r.truncated }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    if (!Speech) return;
    const rec = new Speech();
    rec.lang = navigator.language || "en-GB";
    rec.interimResults = false;
    rec.onresult = (e) => setQuestion((q) => `${q} ${e.results[0][0].transcript}`.trim());
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the AI tutor"
        className="fixed bottom-4 right-4 z-[1500] flex items-center gap-1.5 rounded-full bg-accent px-3 py-2 text-sm font-semibold text-accent-ink shadow-lg hover:bg-accent-hover max-sm:bottom-3 max-sm:right-3 max-sm:h-11 max-sm:w-11 max-sm:justify-center max-sm:p-0 print:hidden"
      >
        {/* phone: a round icon button, so it covers as little of the page as possible */}
        <MessageCircleQuestion size={18} /> <span className="max-sm:sr-only">Tutor</span>
      </button>
    );

  return (
    <section
      role="dialog"
      aria-label="AI tutor"
      className="fixed inset-x-2 bottom-2 z-[1500] flex h-[75vh] flex-col rounded-lg border border-border-primary bg-bg-secondary shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[420px] print:hidden"
    >
      <header className="flex items-center gap-2 border-b border-border-primary px-3 py-2">
        <MessageCircleQuestion size={16} className="text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text-primary">AI tutor</div>
          {status?.connected && (
            <div className="truncate text-xs text-text-muted">
              {status.provider_title} · {status.model}
            </div>
          )}
        </div>
        {status?.connected && (
          <button type="button" onClick={() => void api.disconnect().then(setStatus)} className="text-xs text-text-muted hover:text-text-primary">
            Disconnect
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} aria-label="Close the tutor" className="text-text-muted hover:text-text-primary">
          <X size={16} />
        </button>
      </header>

      {status && !status.connected ? (
        <div className="flex-1 overflow-auto">
          <ConnectForm onConnected={setStatus} />
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-auto p-3 text-sm">
            {msgs.length === 0 && (
              <p className="text-text-muted">
                Ask about anything on this page — e.g. “why does the export cable need reactors?” or “what does one
                turbine make at 9 m/s?”. Numbers come from the platform&apos;s calculators.
              </p>
            )}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-8 whitespace-pre-wrap rounded-md bg-bg-tertiary p-2 text-text-primary" translate="no">
                  {m.content}
                </div>
              ) : (
                <div key={i} className="text-text-secondary">
                  {/* the model already answers in the learner's language: keep the page translator off it */}
                  <div translate="no">
                    <Suspense fallback={<div className="whitespace-pre-wrap">{m.content}</div>}>
                      <TutorMarkdown text={m.content} />
                    </Suspense>
                  </div>
                  {m.truncated && (
                    <p className="mt-1 text-xs text-status-warning">The answer hit the length limit and was cut off — ask “continue”.</p>
                  )}
                  {m.tools && m.tools.length > 0 && <ToolCalls tools={m.tools} shown={shown} />}
                </div>
              ),
            )}
            {busy && <p className="text-text-muted">Thinking…</p>}
            {error && <p className="text-xs text-status-alarm">{error}</p>}
            <div ref={end} />
          </div>
          <form
            className="flex items-end gap-1.5 border-t border-border-primary p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Ask the tutor…"
              aria-label="Your question"
              className={`${input} resize-none`}
            />
            {Speech && (
              <button type="button" onClick={listen} aria-label="Speak your question" className={`rounded-md p-2 ${listening ? "bg-status-warning text-white" : "text-text-muted hover:text-text-primary"}`}>
                <Mic size={16} />
              </button>
            )}
            <button type="submit" disabled={busy || !question.trim()} aria-label="Send" className="rounded-md bg-accent p-2 text-accent-ink disabled:opacity-50">
              <Send size={16} />
            </button>
          </form>
        </>
      )}
    </section>
  );
}

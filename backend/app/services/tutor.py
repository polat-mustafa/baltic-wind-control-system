"""
AI tutor: an OpenAI-compatible chat model, brought by the learner, that answers with the
platform's own calculators as tools.

Keys (bring your own key)
-------------------------
The learner's API key lives only in this process's memory, under a random session id kept in
an HttpOnly cookie — never in the browser's storage, never in a log line, never in a response.
Sessions expire after ``SESSION_TTL_S``; a restart forgets every key. "Sign in with
OpenRouter" (OAuth PKCE) creates a key in the learner's own OpenRouter account and hands it to
this server directly. Consumer chat subscriptions (ChatGPT, Claude, Gemini apps) do not issue
API keys, so they cannot be linked; OpenRouter can route to most models with one key.

Only the providers in ``PROVIDERS`` can be called (fixed HTTPS base URLs), so a request cannot
make this server fetch an arbitrary URL.

Answers
-------
The page the learner is on (route, title, the text and numbers on screen) is the context. A
question that needs a number is answered by calling a tool — the same backend functions the
modules use — and the answer shows which tools ran, with their inputs and outputs.
"""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

import httpx

SESSION_TTL_S = 8 * 3600
MAX_SESSIONS = 1000
RATE_LIMIT = (30, 600.0)  # requests per window [s], per session
MAX_TOOL_ROUNDS = 4
MAX_PAGE_CHARS = 4000
MAX_HISTORY = 12

#: OpenAI-compatible chat endpoints a learner can bring a key for (fixed HTTPS base URLs).
PROVIDERS: dict[str, dict[str, str]] = {
    "openrouter": {
        "title": "OpenRouter (one key, many models)",
        "base_url": "https://openrouter.ai/api/v1",
        "default_model": "openrouter/auto",
        "keys_url": "https://openrouter.ai/keys",
    },
    "openai": {
        "title": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "default_model": "",
        "keys_url": "https://platform.openai.com/api-keys",
    },
    "groq": {
        "title": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "",
        "keys_url": "https://console.groq.com/keys",
    },
    "deepseek": {
        "title": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "default_model": "deepseek-chat",
        "keys_url": "https://platform.deepseek.com/api_keys",
    },
    "mistral": {
        "title": "Mistral",
        "base_url": "https://api.mistral.ai/v1",
        "default_model": "",
        "keys_url": "https://console.mistral.ai/api-keys",
    },
    "gemini": {
        "title": "Google Gemini (OpenAI-compatible endpoint)",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "default_model": "",
        "keys_url": "https://aistudio.google.com/apikey",
    },
}

OPENROUTER_AUTH = "https://openrouter.ai/auth"
OPENROUTER_KEY_EXCHANGE = "https://openrouter.ai/api/v1/auth/keys"


class TutorError(Exception):
    """A problem to show the learner (never contains the key)."""


@dataclass
class Session:
    provider: str = ""
    model: str = ""
    api_key: str = field(default="", repr=False)
    created: float = field(default_factory=time.time)
    pkce_verifier: str = field(default="", repr=False)
    pkce_state: str = ""
    calls: deque[float] = field(default_factory=deque)

    @property
    def connected(self) -> bool:
        return bool(self.api_key)


_SESSIONS: dict[str, Session] = {}


def get_session(sid: str | None) -> Session | None:
    s = _SESSIONS.get(sid or "")
    if s is not None and time.time() - s.created > SESSION_TTL_S:
        _SESSIONS.pop(sid or "", None)
        return None
    return s


def new_session() -> tuple[str, Session]:
    if len(_SESSIONS) >= MAX_SESSIONS:  # drop the oldest
        _SESSIONS.pop(min(_SESSIONS, key=lambda k: _SESSIONS[k].created))
    sid = secrets.token_urlsafe(32)
    _SESSIONS[sid] = Session()
    return sid, _SESSIONS[sid]


def drop_session(sid: str | None) -> None:
    _SESSIONS.pop(sid or "", None)


def connect(session: Session, provider: str, api_key: str, model: str) -> None:
    if provider not in PROVIDERS:
        raise TutorError(f"Unknown provider {provider!r}")
    model = model.strip() or PROVIDERS[provider]["default_model"]
    if not model:
        raise TutorError("Choose a model id for this provider")
    if not api_key.strip():
        raise TutorError("The API key is empty")
    session.provider, session.model, session.api_key = provider, model, api_key.strip()


# ── OpenRouter OAuth PKCE ────────────────────────────────────────────


def openrouter_start(session: Session, callback_url: str) -> str:
    """Authorisation URL; the verifier stays here, the challenge goes to OpenRouter."""
    if not callback_url.startswith(("http://", "https://")):
        raise TutorError("The callback URL must be http(s)")
    session.pkce_verifier = secrets.token_urlsafe(48)
    session.pkce_state = secrets.token_urlsafe(16)
    digest = hashlib.sha256(session.pkce_verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    q = httpx.QueryParams(
        callback_url=callback_url,
        code_challenge=challenge,
        code_challenge_method="S256",
        state=session.pkce_state,
        key_label="OffshoreForge tutor",
    )
    return f"{OPENROUTER_AUTH}?{q}"


def openrouter_finish(
    session: Session, code: str, state: str, client: httpx.Client | None = None
) -> None:
    if not session.pkce_verifier or not secrets.compare_digest(state, session.pkce_state):
        raise TutorError("Sign-in expired or was started elsewhere; try again")
    with client or httpx.Client(timeout=30) as c:
        r = c.post(
            OPENROUTER_KEY_EXCHANGE,
            json={
                "code": code,
                "code_verifier": session.pkce_verifier,
                "code_challenge_method": "S256",
            },
        )
    session.pkce_verifier = session.pkce_state = ""
    if r.status_code != 200 or not r.json().get("key"):
        raise TutorError(f"OpenRouter did not issue a key (HTTP {r.status_code})")
    connect(session, "openrouter", r.json()["key"], PROVIDERS["openrouter"]["default_model"])


# ── Tools: the platform's own calculators ────────────────────────────


def _turbine_at(wind_speed_ms: float) -> dict[str, Any]:
    from app.services.p1.turbine_models import get_turbine

    t = get_turbine()
    v = float(wind_speed_ms)
    if not 0 <= v <= 50:
        raise ValueError("wind_speed_ms must be 0–50")
    out: dict[str, Any] = {
        "turbine": t.name,
        "wind_speed_ms": v,
        "power_kw": round(float(t.power_curve_kw(v)), 1),
        "cut_in_rated_cut_out_ms": [t.cut_in_ms, t.rated_ms, t.cut_out_ms],
    }
    if not t.cut_in_ms <= v <= t.cut_out_ms:  # rule 1: no production, blades feathered
        return out | {"state": "stopped (below cut-in or above cut-out)"}
    op = t.operating_point(v)
    return out | {"state": "producing"} | {k: round(float(x), 4) for k, x in op.items()}


def _export_cable(length_km: float) -> dict[str, Any]:
    from app.services.p2.network_model import (
        EXPORT_KV,
        export_charging_mvar,
        export_circuit_capacity_mw,
    )
    from app.services.p2.statcom_sizing import ferranti_rise_pu

    km = float(length_km)
    if not 1 <= km <= 300:
        raise ValueError("length_km must be 1–300")
    return {
        "voltage_kv": EXPORT_KV,
        "length_km": km,
        "charging_mvar_per_circuit": round(export_charging_mvar(km), 1),
        "open_end_ferranti_rise_pct": round(100 * ferranti_rise_pu(km), 2),
        "capacity_mw_per_circuit_unity_pf": round(export_circuit_capacity_mw(km), 1),
        "formula": "Q = ωCV²L (rule 7, capacitive Q positive); rise = 1/cos βl − 1",
    }


def _short_circuit(case: str = "max") -> dict[str, Any]:
    from app.services.p2.short_circuit import calc_short_circuit

    if case not in ("max", "min"):
        raise ValueError("case must be 'max' or 'min'")
    r = calc_short_circuit(case=case)
    return {
        "standard": "IEC 60909 via pandapower calc_sc",
        "case": r.case,
        "voltage_factor_c": r.voltage_factor_c,
        "max_ikss_ka": round(r.max_ikss_ka, 2),
        "max_ikss_bus": r.max_ikss_bus,
        "buses": [
            {k: v for k, v in b.model_dump().items() if k in ("bus_name", "vn_kv", "ikss_ka")}
            for b in r.bus_results[:12]
        ],
    }


def _plant_facts() -> dict[str, Any]:
    from app.services.plant_facts import plant_facts

    return plant_facts()


TOOLS: dict[str, tuple[Any, dict[str, Any]]] = {
    "plant_facts": (
        _plant_facts,
        {
            "description": "SB-510 design numbers: turbines, MW, export cable, reactors, "
            "STATCOM, turbine speeds and limits, FRT profile, commissioning steps.",
            "parameters": {"type": "object", "properties": {}},
        },
    ),
    "turbine_operating_point": (
        _turbine_at,
        {
            "description": "IEA 15 MW turbine at a hub-height wind speed: power, Cp, thrust, "
            "torque, rotor rpm, pitch (official tables + ROSCO).",
            "parameters": {
                "type": "object",
                "properties": {"wind_speed_ms": {"type": "number", "description": "m/s"}},
                "required": ["wind_speed_ms"],
            },
        },
    ),
    "export_cable": (
        _export_cable,
        {
            "description": "One 220 kV 1000 mm² export circuit of a given length: charging "
            "Mvar (ωCV²L), Ferranti rise, carrying capacity.",
            "parameters": {
                "type": "object",
                "properties": {"length_km": {"type": "number", "description": "km"}},
                "required": ["length_km"],
            },
        },
    ),
    "short_circuit": (
        _short_circuit,
        {
            "description": "IEC 60909 short-circuit currents of the SB-510 network "
            "(pandapower), maximum or minimum case.",
            "parameters": {
                "type": "object",
                "properties": {"case": {"type": "string", "enum": ["max", "min"]}},
            },
        },
    ),
}


def run_tool(name: str, arguments: str) -> dict[str, Any]:
    if name not in TOOLS:
        return {"error": f"unknown tool {name}"}
    try:
        args = json.loads(arguments or "{}")
        return dict(TOOLS[name][0](**args))
    except Exception as e:  # the model sees the error and can correct its call
        return {"error": f"{type(e).__name__}: {e}"}


# ── Chat ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the tutor of OffshoreForge, an offshore wind engineering training \
platform. Its case study is SB-510: 510 MW, 34 turbines modelled with the IEA 15 MW reference \
turbine, 66 kV array, two 220 kV export circuits of 108 km to the PSE grid in Poland.

Rules:
- Explain clearly and briefly for an engineering student; use SI units and state them.
- For any SB-510 or turbine number, call a tool instead of recalling it. Never invent a number,
  a standard clause or a source. If no tool covers it, say what you are unsure about.
- Use the page context below: it is what the learner sees right now.
- Answer in the learner's language."""


def _page_block(page: dict[str, Any]) -> str:
    text = str(page.get("text", ""))[:MAX_PAGE_CHARS]
    return (
        f"\n\nPage context — route {page.get('route', '?')}, "
        f"title {page.get('title', '?')!r}:\n{text}"
    )


def _rate_limit(session: Session) -> None:
    n, window = RATE_LIMIT
    now = time.time()
    while session.calls and now - session.calls[0] > window:
        session.calls.popleft()
    if len(session.calls) >= n:
        raise TutorError("Too many questions in a short time; wait a few minutes")
    session.calls.append(now)


def chat(
    session: Session,
    history: list[dict[str, str]],
    question: str,
    page: dict[str, Any],
    client: httpx.Client | None = None,
) -> dict[str, Any]:
    """One answer, after up to MAX_TOOL_ROUNDS rounds of tool calls."""
    if not session.connected:
        raise TutorError("Connect a provider first")
    if not question.strip():
        raise TutorError("Ask a question")
    _rate_limit(session)
    p = PROVIDERS[session.provider]
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT + _page_block(page)},
        *[
            {"role": m["role"], "content": str(m["content"])[:4000]}
            for m in history[-MAX_HISTORY:]
            if m.get("role") in ("user", "assistant")
        ],
        {"role": "user", "content": question[:4000]},
    ]
    tools = [
        {"type": "function", "function": {"name": n, **spec}} for n, (_, spec) in TOOLS.items()
    ]
    headers = {"Authorization": f"Bearer {session.api_key}"}
    if session.provider == "openrouter":
        headers |= {"HTTP-Referer": "https://offshoreforge.app", "X-Title": "OffshoreForge"}
    trace: list[dict[str, Any]] = []
    with client or httpx.Client(timeout=90) as c:
        for _ in range(MAX_TOOL_ROUNDS + 1):
            r = c.post(
                f"{p['base_url']}/chat/completions",
                headers=headers,
                json={
                    "model": session.model,
                    "messages": messages,
                    "tools": tools,
                    "temperature": 0.2,
                    "max_tokens": 900,
                },
            )
            if r.status_code != 200:
                try:  # OpenAI-style {"error": {"message": ...}}
                    detail = str(r.json()["error"]["message"])[:300]
                except Exception:
                    detail = r.text[:300]
                detail = detail.replace(session.api_key, "***")
                raise TutorError(f"{p['title']} answered HTTP {r.status_code}: {detail}")
            msg = r.json()["choices"][0]["message"]
            calls = msg.get("tool_calls") or []
            if not calls:
                return {"answer": msg.get("content") or "", "tools": trace, "model": session.model}
            messages.append(
                {"role": "assistant", "content": msg.get("content"), "tool_calls": calls}
            )
            for call in calls:
                fn = call["function"]
                result = run_tool(fn["name"], fn.get("arguments", "{}"))
                trace.append(
                    {"name": fn["name"], "arguments": fn.get("arguments"), "result": result}
                )
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": json.dumps(result, default=float)[:6000],
                    }
                )
    raise TutorError("The model kept calling tools without answering; ask more specifically")

"""AI tutor: key handling, provider allowlist, OpenRouter PKCE, tool loop (fake provider)."""

from __future__ import annotations

import base64
import hashlib
import json
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import tutor

KEY = "sk-test-0123456789"


def _connected() -> tutor.Session:
    _, s = tutor.new_session()
    tutor.connect(s, "openrouter", KEY, "")
    return s


def test_connect_keeps_the_key_server_side_in_an_httponly_cookie() -> None:
    client = TestClient(app)
    r = client.post("/api/v1/tutor/connect", json={"provider": "deepseek", "api_key": KEY})
    assert r.status_code == 200
    assert KEY not in r.text
    assert r.json() == {
        "connected": True,
        "provider": "deepseek",
        "provider_title": "DeepSeek",
        "model": "deepseek-chat",
    }
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie
    assert KEY not in client.get("/api/v1/tutor/status").text
    assert client.post("/api/v1/tutor/disconnect").json()["connected"] is False
    assert client.get("/api/v1/tutor/status").json()["connected"] is False


def test_only_listed_providers_and_a_model_are_accepted() -> None:
    client = TestClient(app)
    bad = client.post("/api/v1/tutor/connect", json={"provider": "evil", "api_key": KEY})
    assert bad.status_code == 422
    no_model = client.post("/api/v1/tutor/connect", json={"provider": "openai", "api_key": KEY})
    assert no_model.status_code == 422  # OpenAI has no default model here
    assert all(p["base_url"].startswith("https://") for p in tutor.PROVIDERS.values())
    assert TestClient(app).post("/api/v1/tutor/chat", json={"question": "hi"}).status_code == 401


def test_tool_loop_answers_with_the_backend_calculator() -> None:
    """The fake model asks for export_cable(108 km), then answers from the tool result."""
    seen: list[dict] = []

    def provider(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append(body)
        assert request.headers["authorization"] == f"Bearer {KEY}"
        if len(seen) == 1:
            assert {t["function"]["name"] for t in body["tools"]} >= {"export_cable", "plant_facts"}
            assert "route /hv-grid" in body["messages"][0]["content"]
            call = {
                "id": "c1",
                "type": "function",
                "function": {"name": "export_cable", "arguments": '{"length_km": 108}'},
            }
            return httpx.Response(200, json={"choices": [{"message": {"tool_calls": [call]}}]})
        tool_msg = body["messages"][-1]
        assert tool_msg["role"] == "tool" and tool_msg["tool_call_id"] == "c1"
        q = json.loads(tool_msg["content"])["charging_mvar_per_circuit"]
        return httpx.Response(
            200, json={"choices": [{"message": {"content": f"About {q:.0f} Mvar per circuit."}}]}
        )

    out = tutor.chat(
        _connected(),
        [],
        "How much reactive power does one export cable make?",
        {"route": "/hv-grid", "title": "Grid Integration", "text": "STATCOM ±120 Mvar"},
        client=httpx.Client(transport=httpx.MockTransport(provider)),
    )
    assert out["answer"] == "About 312 Mvar per circuit."
    assert out["tools"][0]["result"]["charging_mvar_per_circuit"] == pytest.approx(312.0)
    assert len(seen) == 2


def test_provider_errors_never_echo_the_key() -> None:
    def provider(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, text=f"invalid key {KEY}")

    with pytest.raises(tutor.TutorError) as e:
        tutor.chat(
            _connected(), [], "hi", {}, client=httpx.Client(transport=httpx.MockTransport(provider))
        )
    assert KEY not in str(e.value) and "HTTP 401" in str(e.value)


def test_rate_limit_per_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(tutor, "RATE_LIMIT", (2, 600.0))

    def provider(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    s = _connected()
    c = httpx.Client(transport=httpx.MockTransport(provider))
    tutor.chat(s, [], "a", {}, client=c)
    tutor.chat(s, [], "b", {}, client=httpx.Client(transport=httpx.MockTransport(provider)))
    with pytest.raises(tutor.TutorError, match="Too many"):
        tutor.chat(s, [], "c", {}, client=httpx.Client(transport=httpx.MockTransport(provider)))


def test_tools_refuse_bad_input_and_respect_cut_out() -> None:
    assert "error" in tutor.run_tool("export_cable", '{"length_km": -5}')
    assert "error" in tutor.run_tool("nope", "{}")
    stopped = tutor.run_tool("turbine_operating_point", '{"wind_speed_ms": 30}')
    assert stopped["power_kw"] == 0.0 and stopped["state"].startswith("stopped")  # rule 1
    rated = tutor.run_tool("turbine_operating_point", '{"wind_speed_ms": 12}')
    assert rated["power_kw"] == pytest.approx(15000.0)


def test_openrouter_pkce_round_trip() -> None:
    _, s = tutor.new_session()
    url = tutor.openrouter_start(s, "http://localhost:5173/tutor/callback")
    q = parse_qs(urlparse(url).query)
    digest = hashlib.sha256(s.pkce_verifier.encode()).digest()
    assert q["code_challenge"] == [base64.urlsafe_b64encode(digest).rstrip(b"=").decode()]
    assert q["code_challenge_method"] == ["S256"] and q["state"] == [s.pkce_state]

    with pytest.raises(tutor.TutorError, match="expired"):
        tutor.openrouter_finish(s, "code", "wrong-state")

    def exchange(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert body["code"] == "abc" and body["code_verifier"]
        return httpx.Response(200, json={"key": "sk-or-new"})

    tutor.openrouter_start(s, "http://localhost:5173/tutor/callback")
    tutor.openrouter_finish(
        s, "abc", s.pkce_state, client=httpx.Client(transport=httpx.MockTransport(exchange))
    )
    assert s.connected and s.provider == "openrouter" and s.pkce_verifier == ""


def test_eval_set_is_runnable_and_its_scorer_works() -> None:
    """scripts/tutor_eval.json: every tool and expected field exists; the scorer accepts
    kW↔MW and rejects a wrong number (the real-model run needs a key, see the script)."""
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "scripts" / "tutor_eval.py"
    spec = importlib.util.spec_from_file_location("tutor_eval", path)
    assert spec is not None and spec.loader is not None
    ev = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ev)

    cases = json.loads(ev.EVAL.read_text(encoding="utf-8"))["cases"]
    assert len(cases) >= 12 and len({c["id"] for c in cases}) == len(cases)
    for c in cases:
        assert c.get("tool") in (None, *tutor.TOOLS)
        assert c.get("expect") or c.get("contains_any")
        ev.expected_values(c)  # raises if a tool, argument or field is wrong

    power = next(c for c in cases if c["id"] == "power-9ms")
    p_kw = ev.expected_values(power)[0][0]
    good = {
        "answer": f"About {p_kw / 1000:.2f} MW.",
        "tools": [{"name": "turbine_operating_point"}],
    }
    assert ev.score(power, good) == []
    bad = {"answer": "About 12 MW.", "tools": []}
    assert len(ev.score(power, bad)) == 2

"""AI tutor router: connect a provider key (or sign in with OpenRouter), then ask.

The key stays in server memory under an HttpOnly session cookie (services/tutor.py).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool

from app.schemas.tutor import (
    TutorChatRequest,
    TutorChatResponse,
    TutorConnectRequest,
    TutorOAuthFinish,
    TutorOAuthStart,
    TutorStatus,
)
from app.services import tutor
from app.services.tutor import PROVIDERS, TutorError

router = APIRouter(prefix="/api/v1/tutor", tags=["AI tutor"])
COOKIE = "of_tutor"


def _session(request: Request, response: Response, create: bool = False) -> tutor.Session:
    s = tutor.get_session(request.cookies.get(COOKIE))
    if s is not None:
        return s
    if not create:
        raise HTTPException(status_code=401, detail="No tutor session; connect a provider first")
    sid, s = tutor.new_session()
    response.set_cookie(
        COOKIE,
        sid,
        max_age=tutor.SESSION_TTL_S,
        httponly=True,
        samesite="strict",
        secure=request.url.scheme == "https",
        path="/api/v1/tutor",
    )
    return s


def _status(s: tutor.Session | None) -> TutorStatus:
    if s is None or not s.connected:
        return TutorStatus(connected=False)
    return TutorStatus(
        connected=True,
        provider=s.provider,
        provider_title=PROVIDERS[s.provider]["title"],
        model=s.model,
    )


@router.get("/providers")
async def providers() -> list[dict[str, Any]]:
    """Providers a learner can bring a key for, with their key pages and default models."""
    return [
        {"id": k, **{f: v[f] for f in ("title", "default_model", "keys_url")}}
        for k, v in PROVIDERS.items()
    ]


@router.get("/status", response_model=TutorStatus)
async def status(request: Request) -> TutorStatus:
    return _status(tutor.get_session(request.cookies.get(COOKIE)))


@router.post("/connect", response_model=TutorStatus)
async def connect(body: TutorConnectRequest, request: Request, response: Response) -> TutorStatus:
    s = _session(request, response, create=True)
    try:
        tutor.connect(s, body.provider, body.api_key, body.model)
    except TutorError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    return _status(s)


@router.post("/disconnect", response_model=TutorStatus)
async def disconnect(request: Request, response: Response) -> TutorStatus:
    tutor.drop_session(request.cookies.get(COOKIE))
    response.delete_cookie(COOKIE, path="/api/v1/tutor")
    return TutorStatus(connected=False)


@router.post("/openrouter/start")
async def openrouter_start(
    body: TutorOAuthStart, request: Request, response: Response
) -> dict[str, str]:
    """Begin "Sign in with OpenRouter" (OAuth PKCE); the browser opens the returned URL."""
    s = _session(request, response, create=True)
    try:
        return {"auth_url": tutor.openrouter_start(s, body.callback_url)}
    except TutorError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None


@router.post("/openrouter/finish", response_model=TutorStatus)
async def openrouter_finish(
    body: TutorOAuthFinish, request: Request, response: Response
) -> TutorStatus:
    """Exchange the one-time code for a key; the key never reaches the browser."""
    s = _session(request, response)
    try:
        await run_in_threadpool(tutor.openrouter_finish, s, body.code, body.state)
    except TutorError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    return _status(s)


@router.post("/chat", response_model=TutorChatResponse)
async def chat(body: TutorChatRequest, request: Request, response: Response) -> TutorChatResponse:
    s = _session(request, response)
    try:
        out = await run_in_threadpool(
            tutor.chat,
            s,
            [m.model_dump() for m in body.history],
            body.question,
            body.page.model_dump(),
        )
    except TutorError as e:
        raise HTTPException(
            status_code=502 if "answered HTTP" in str(e) else 422, detail=str(e)
        ) from None
    return TutorChatResponse(**out)

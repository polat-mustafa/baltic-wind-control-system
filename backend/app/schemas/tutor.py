"""Pydantic schemas for the AI tutor (bring-your-own-key, OpenAI-compatible providers)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class TutorConnectRequest(BaseModel):
    provider: str = Field(description="Key of PROVIDERS, e.g. 'openrouter'")
    api_key: str = Field(min_length=1, max_length=400, description="Kept in server memory only")
    model: str = Field(default="", max_length=200, description="Empty = the provider default")


class TutorStatus(BaseModel):
    connected: bool
    provider: str = ""
    provider_title: str = ""
    model: str = ""


class TutorOAuthStart(BaseModel):
    callback_url: str = Field(max_length=500)


class TutorOAuthFinish(BaseModel):
    code: str = Field(min_length=1, max_length=500)
    state: str = Field(min_length=1, max_length=200)


class TutorMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class TutorPage(BaseModel):
    route: str = Field(default="", max_length=200)
    title: str = Field(default="", max_length=300)
    text: str = Field(default="", max_length=20000, description="Text and numbers on screen")


class TutorChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    history: list[TutorMessage] = Field(default_factory=list, max_length=40)
    page: TutorPage = Field(default_factory=TutorPage)


class TutorToolCall(BaseModel):
    name: str
    arguments: str | None = None
    result: dict[str, Any]


class TutorChatResponse(BaseModel):
    answer: str
    model: str
    tools: list[TutorToolCall] = Field(description="Calculators the model ran, with results")

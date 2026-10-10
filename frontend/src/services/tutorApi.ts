/**
 * AI tutor API (backend/app/routers/tutor.py). The provider key is sent once to /connect and
 * then lives in server memory behind an HttpOnly cookie — it is never stored in the browser.
 */

import { post, request } from "./apiClient";

const BASE = "/api/v1/tutor";

export interface TutorProvider {
  id: string;
  title: string;
  default_model: string;
  keys_url: string;
}

export interface TutorStatus {
  connected: boolean;
  provider: string;
  provider_title: string;
  model: string;
}

export interface TutorToolCall {
  name: string;
  arguments: string | null;
  result: Record<string, unknown>;
}

export interface TutorAnswer {
  answer: string;
  model: string;
  tools: TutorToolCall[];
}

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
}

export const getProviders = () => request<TutorProvider[]>(`${BASE}/providers`);
export const getStatus = () => request<TutorStatus>(`${BASE}/status`);
export const connect = (provider: string, api_key: string, model: string) =>
  post<TutorStatus>(`${BASE}/connect`, { provider, api_key, model });
export const disconnect = () => post<TutorStatus>(`${BASE}/disconnect`, {});
export const openRouterStart = (callback_url: string) =>
  post<{ auth_url: string }>(`${BASE}/openrouter/start`, { callback_url });
export const openRouterFinish = (code: string, state: string) =>
  post<TutorStatus>(`${BASE}/openrouter/finish`, { code, state });
export const ask = (question: string, history: TutorTurn[], page: { route: string; title: string; text: string }) =>
  post<TutorAnswer>(`${BASE}/chat`, { question, history, page });

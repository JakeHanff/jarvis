"use client";

/** Thin fetch wrapper + a tiny cache-invalidation bus so widgets stay in sync. */

const TOKEN_KEY = "jarvis.accessToken";

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, body });
  } catch {
    throw new ApiError(0, "Can't reach JARVIS. Is the backend running?");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data as { detail?: unknown })?.detail;
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    if (typeof detail === "string") message = detail;
    else if (detail && typeof detail === "object" && "message" in detail) {
      message = String((detail as { message: string }).message);
      code = (detail as { code?: string }).code;
    } else if (Array.isArray(detail)) message = detail.map((d) => d.msg).join("; ");
    if (res.status === 401) code = "unauthorized";
    if (res.status >= 500 && res.status !== 502 && res.status !== 503 && !code) message = "JARVIS backend error. Is the backend running?";
    throw new ApiError(res.status, message, code);
  }
  return data as T;
}

/** Append the access token to a file URL (img/CSS can't send headers). */
export function fileUrl(url: string): string {
  if (!url.startsWith("/api/files/")) return url;
  const t = getToken();
  return t ? `${url}?token=${encodeURIComponent(t)}` : url;
}

type Listener = (prefix: string) => void;
const listeners = new Set<Listener>();

export function onInvalidate(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Tell every hook whose path starts with any of the prefixes to refetch. */
export function invalidate(...prefixes: string[]) {
  for (const p of prefixes) listeners.forEach((l) => l(p));
}

export function localTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

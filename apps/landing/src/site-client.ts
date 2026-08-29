import type { SiteEditResult, SiteGeneration, SiteLocale, SiteSpec } from "./site-spec.js";

type ApiError = { error?: { message?: string } };
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as ApiError;
      if (body.error?.message) message = body.error.message;
    } catch {
      // Keep the status fallback.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function sitePath(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

export function studioPath(username: string, intent = ""): string {
  const query = intent ? `?intent=${encodeURIComponent(intent)}` : "";
  return `/studio/${encodeURIComponent(username)}${query}`;
}

export function portfolioDataPath(username: string): string {
  return `/portfolio/${encodeURIComponent(username)}`;
}

export async function fetchSite(username: string, intent = "", locale: SiteLocale = "en", signal?: AbortSignal): Promise<SiteGeneration> {
  const params = new URLSearchParams();
  if (intent) params.set("intent", intent);
  params.set("locale", locale);
  return requestJson<SiteGeneration>(`${API_BASE}/api/site/${encodeURIComponent(username)}?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
}

export async function generateSite(username: string, intent: string, locale: SiteLocale, signal?: AbortSignal): Promise<SiteGeneration> {
  return requestJson<SiteGeneration>(`${API_BASE}/api/site/generate`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, intent, locale, ai: true }),
  });
}

export async function editSite(username: string, spec: SiteSpec, instruction: string, locale: SiteLocale, signal?: AbortSignal): Promise<SiteEditResult> {
  return requestJson<SiteEditResult>(`${API_BASE}/api/site/edit`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, spec, instruction, locale }),
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeSiteSpec(spec: SiteSpec): string {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(spec)));
}

export function decodeSiteSpec(value: string): SiteSpec | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64ToBytes(value))) as SiteSpec;
  } catch {
    return null;
  }
}

export function draftShareUrl(username: string, spec: SiteSpec): string {
  const url = new URL(sitePath(username), window.location.origin);
  url.hash = `draft=${encodeSiteSpec(spec)}`;
  return url.toString();
}

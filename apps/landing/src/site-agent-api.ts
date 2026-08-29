import { applyDeterministicEdit, createSiteSpec, isSiteSpec, repairSiteSpec, validateSiteSpec } from "./site-spec.js";
import type { SiteEditResult, SiteGeneration, SiteLocale, SiteSpec } from "./site-spec.js";
import { portfolioApi } from "./portfolio-api.js";
import type { DeveloperPortfolio } from "./portfolio.js";

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const MAX_BODY_BYTES = 48 * 1024;
const MAX_INSTRUCTION = 800;

export type SiteAgentEnv = {
  GITHUB_TOKEN?: string;
  AGENT_MODEL_API_KEY?: string;
  AGENT_MODEL_BASE_URL?: string;
  AGENT_MODEL?: string;
  /** Paid model calls stay opt-in. Deterministic agent behavior is always public. */
  AGENT_PUBLIC_AI_ENABLED?: string;
};

type GenerateBody = {
  username?: string;
  intent?: string;
  locale?: SiteLocale;
  ai?: boolean;
};

type EditBody = {
  username?: string;
  instruction?: string;
  locale?: SiteLocale;
  spec?: unknown;
};

function json(value: unknown, status = 200, cache = "no-store"): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function error(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

async function readJson<T>(request: Request): Promise<T | null> {
  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return null;
  try {
    const text = await request.text();
    if (!text || text.length > MAX_BODY_BYTES) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function normalizeLocale(value: unknown): SiteLocale {
  return value === "zh" ? "zh" : "en";
}

function normalizeIntent(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_INSTRUCTION) : "";
}

function modelReady(env: SiteAgentEnv): boolean {
  return env.AGENT_PUBLIC_AI_ENABLED === "1" && Boolean(env.AGENT_MODEL_API_KEY);
}

function modelName(env: SiteAgentEnv): string {
  return env.AGENT_MODEL?.trim() || "gpt-5-mini";
}

async function reserveAiSlot(request: Request, env: SiteAgentEnv): Promise<boolean> {
  if (!modelReady(env)) return false;
  const cache = (caches as unknown as { default: Cache }).default;
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-real-ip") ?? "local";
  const key = new Request(`https://site-agent-rate.invalid/${encodeURIComponent(ip)}`);
  if (await cache.match(key)) return false;
  await cache.put(key, new Response("1", { headers: { "Cache-Control": "public, max-age=5" } }));
  return true;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function compactPortfolio(portfolio: DeveloperPortfolio): unknown {
  return {
    profile: portfolio.profile,
    stats: portfolio.stats,
    languages: portfolio.languages,
    projects: portfolio.projects.slice(0, 16),
    contributions: portfolio.contributions.slice(0, 30),
  };
}

async function askForSpec(env: SiteAgentEnv, args: {
  base: SiteSpec;
  portfolio: DeveloperPortfolio;
  intent: string;
  locale: SiteLocale;
  instruction?: string;
}): Promise<SiteSpec | null> {
  if (!modelReady(env)) return null;
  const base = (env.AGENT_MODEL_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const instruction = args.instruction?.trim();
  const system = instruction
    ? "You edit a developer personal-site SiteSpec. Follow the user's instruction while preserving truthful GitHub references. Never invent projects, PRs, employers, metrics, or experience. Return the complete SiteSpec as JSON only."
    : "You are a senior personal-site editor for software engineers. Improve the supplied SiteSpec using only the provided GitHub evidence. Make the hierarchy and copy specific rather than generic. Never invent facts. Return the complete SiteSpec as JSON only.";
  const prompt = instruction
    ? `Language: ${args.locale}\nUser instruction: ${instruction}\nGitHub evidence: ${JSON.stringify(compactPortfolio(args.portfolio))}\nCurrent SiteSpec: ${JSON.stringify(args.base)}`
    : `Language: ${args.locale}\nGoal: ${args.intent || "General personal website"}\nGitHub evidence: ${JSON.stringify(compactPortfolio(args.portfolio))}\nBaseline SiteSpec: ${JSON.stringify(args.base)}`;

  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AGENT_MODEL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName(env),
        temperature: instruction ? 0.1 : 0.2,
        max_tokens: 2200,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(stripCodeFence(content)) as unknown;
    if (!isSiteSpec(parsed)) return null;
    const candidate = repairSiteSpec(parsed, args.portfolio);
    return validateSiteSpec(candidate, args.portfolio).length ? null : candidate;
  } catch {
    return null;
  }
}

async function portfolioOrResponse(request: Request, env: SiteAgentEnv, username: string): Promise<{ portfolio: DeveloperPortfolio } | { response: Response }> {
  if (!USERNAME_RE.test(username)) return { response: error("invalid_username", "Invalid GitHub username", 400) };
  try {
    const origin = new URL(request.url).origin;
    const portfolioRequest = new Request(`${origin}/api/portfolio/${encodeURIComponent(username)}`, { headers: { Accept: "application/json" } });
    const response = await portfolioApi(portfolioRequest, env, username);
    if (!response.ok) {
      if (response.status === 404) return { response: error("github_user_not_found", "GitHub user not found", 404) };
      return { response: error("github_unavailable", "GitHub data is temporarily unavailable", 502) };
    }
    const portfolio = await response.json() as DeveloperPortfolio;
    return { portfolio };
  } catch {
    return { response: error("github_unavailable", "GitHub data is temporarily unavailable", 502) };
  }
}

function generation(portfolio: DeveloperPortfolio, spec: SiteSpec, mode: "deterministic" | "ai", env: SiteAgentEnv): SiteGeneration {
  return {
    version: 1,
    spec,
    portfolio,
    agent: {
      mode,
      ...(mode === "ai" ? { model: modelName(env) } : {}),
      steps: ["collect", "understand", "curate", "compose", "validate"],
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function siteGetApi(request: Request, env: SiteAgentEnv, username: string): Promise<Response> {
  if (!USERNAME_RE.test(username)) return error("invalid_username", "Invalid GitHub username", 400);
  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const intent = normalizeIntent(url.searchParams.get("intent"));
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const result = await portfolioOrResponse(request, env, username);
  if ("response" in result) return result.response;
  const spec = createSiteSpec(result.portfolio, intent, locale);
  const response = json(generation(result.portfolio, spec, "deterministic", env), 200, "public, max-age=180, s-maxage=900, stale-while-revalidate=1800");
  await cache.put(cacheKey, response.clone());
  return response;
}

export async function siteGenerateApi(request: Request, env: SiteAgentEnv): Promise<Response> {
  const body = await readJson<GenerateBody>(request);
  const username = body?.username?.trim() ?? "";
  if (!body || !USERNAME_RE.test(username)) return error("invalid_request", "A valid GitHub username is required", 400);
  const locale = normalizeLocale(body.locale);
  const intent = normalizeIntent(body.intent);
  const result = await portfolioOrResponse(request, env, username);
  if ("response" in result) return result.response;

  const baseline = createSiteSpec(result.portfolio, intent, locale);
  const canUseAi = body.ai ? await reserveAiSlot(request, env) : false;
  const aiSpec = canUseAi ? await askForSpec(env, { base: baseline, portfolio: result.portfolio, intent, locale }) : null;
  return json(generation(result.portfolio, aiSpec ?? baseline, aiSpec ? "ai" : "deterministic", env));
}

export async function siteEditApi(request: Request, env: SiteAgentEnv): Promise<Response> {
  const body = await readJson<EditBody>(request);
  const username = body?.username?.trim() ?? "";
  const instruction = normalizeIntent(body?.instruction);
  if (!body || !USERNAME_RE.test(username) || !instruction || instruction.length > MAX_INSTRUCTION) {
    return error("invalid_request", "username, SiteSpec, and a short edit instruction are required", 400);
  }
  const locale = normalizeLocale(body.locale);
  const result = await portfolioOrResponse(request, env, username);
  if ("response" in result) return result.response;
  if (!isSiteSpec(body.spec)) return error("invalid_spec", "SiteSpec payload is invalid", 400);

  const current = repairSiteSpec(body.spec, result.portfolio);
  if (validateSiteSpec(current, result.portfolio).length) return error("invalid_spec", "SiteSpec references unsupported GitHub evidence", 400);

  const canUseAi = await reserveAiSlot(request, env);
  const aiSpec = canUseAi ? await askForSpec(env, { base: current, portfolio: result.portfolio, intent: current.meta.intent, locale, instruction }) : null;
  if (aiSpec) {
    const response: SiteEditResult = {
      spec: aiSpec,
      changes: [locale === "zh" ? "AI Agent 已按你的指令重新编辑页面。" : "AI agent applied your instruction."],
      mode: "ai",
    };
    return json(response);
  }

  return json(applyDeterministicEdit(current, result.portfolio, instruction, locale));
}

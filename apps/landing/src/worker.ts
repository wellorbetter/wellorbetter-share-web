import { portfolioApi } from "./portfolio-api.js";
import { siteEditApi, siteGenerateApi, siteGetApi } from "./site-agent-api.js";
import type { SiteAgentEnv } from "./site-agent-api.js";

type LandingEnv = SiteAgentEnv & {
  ASSETS: { fetch: (input: Request) => Promise<Response> };
};

function apiNotFound(): Response {
  return Response.json({ error: { code: "not_found", message: "API route not found" } }, { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function invalidUsername(): Response {
  return Response.json({ error: { code: "invalid_username", message: "Invalid GitHub username" } }, { status: 400, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function decodedSegment(value: string): string | null { try { return decodeURIComponent(value); } catch { return null; } }

export default {
  async fetch(request: Request, env: LandingEnv): Promise<Response> {
    const url = new URL(request.url);
    const portfolioMatch = url.pathname.match(/^\/api\/portfolio\/([^/]+)$/);
    if (portfolioMatch && request.method === "GET") {
      const username = decodedSegment(portfolioMatch[1]!);
      return username ? portfolioApi(request, env, username) : invalidUsername();
    }
    const siteMatch = url.pathname.match(/^\/api\/site\/([^/]+)$/);
    if (siteMatch && request.method === "GET") {
      const username = decodedSegment(siteMatch[1]!);
      return username ? siteGetApi(request, env, username) : invalidUsername();
    }
    if (url.pathname === "/api/site/generate" && request.method === "POST") return siteGenerateApi(request, env);
    if (url.pathname === "/api/site/edit" && request.method === "POST") return siteEditApi(request, env);
    if (url.pathname.startsWith("/api/")) return apiNotFound();
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
    return env.ASSETS.fetch(new Request(new URL("/", request.url).toString(), request));
  },
};

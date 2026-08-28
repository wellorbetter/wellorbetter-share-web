import { portfolioApi } from "./portfolio-api.js";

type LandingEnv = {
  ASSETS: { fetch: (input: Request) => Promise<Response> };
  /** Optional: enables GitHub GraphQL contribution calendar/activity. */
  GITHUB_TOKEN?: string;
};

function apiNotFound(): Response {
  return Response.json(
    { error: { code: "not_found", message: "API route not found" } },
    { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}

export default {
  async fetch(request: Request, env: LandingEnv): Promise<Response> {
    const url = new URL(request.url);

    const portfolioMatch = url.pathname.match(/^\/api\/portfolio\/([^/]+)$/);
    if (portfolioMatch && request.method === "GET") {
      let username: string;
      try {
        username = decodeURIComponent(portfolioMatch[1]!);
      } catch {
        return Response.json(
          { error: { code: "invalid_username", message: "Invalid GitHub username" } },
          { status: 400, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
        );
      }
      return portfolioApi(request, env, username);
    }

    if (url.pathname.startsWith("/api/")) return apiNotFound();

    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;

    // SPA fallback keeps /u/:username refreshable.
    return env.ASSETS.fetch(new Request(new URL("/", request.url).toString(), request));
  },
};

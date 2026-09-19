import { portfolioApi } from "./portfolio-api.js";
import { resolveRoute, routeMeta } from "./routes.js";
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

/**
 * HTMLRewriter 的最小声明。
 *
 * 没有装 @cloudflare/workers-types：这个 workspace 的 tsconfig 带 DOM lib，
 * workers-types 会重新定义 Request/Response 一族，两者放一起是一堆类型冲突。
 * 只用到 setAttribute/setInnerContent/on/transform，手写这几行比为此重排整个
 * tsconfig 便宜得多。
 */
interface RewriterElement {
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string): void;
}
declare class HTMLRewriter {
  on(selector: string, handler: { element(element: RewriterElement): void }): HTMLRewriter;
  transform(response: Response): Response;
}

/**
 * 按路由改写 SPA 外壳的 <title>/<meta>/<html lang>。
 *
 * 这是唯一能让链接预览和爬虫看对的地方 —— 它们不执行 JS，所以客户端设
 * document.title 对它们等于没设。index.html 里那一份写死的 meta 以前是所有
 * 路由共用的，于是不管访客打开的是 wellorbetter 的站还是某个人生成的主页，
 * 分享出去都显示 "Personal Site Agent"。
 *
 * username 是从 URL 里来的，所以转义这件事必须说清楚：HTMLRewriter 自己会转
 * 义，这里不需要手工处理。但它在属性里只转 " 和 &，不转 < >，所以 curl 出来
 * 的原始字节会长这样：content="&quot;><script>alert(1)</script>" —— 看着像注
 * 入，其实不是：开头那个引号已经变成 &quot;，属性值没法被提前闭合，双引号属
 * 性里的 < > 只是字面字符，浏览器不会据此建标签。用 headless Chrome 验过：
 * /u/%22%3E%3Cscript%3E... 解析完 head 里只有 bundle 一个 script 元素。
 * 别看到那串字节就改成手工 escape —— 双重转义会把正常用户名显示成乱码。
 */
function withRouteMeta(response: Response, pathname: string): Response {
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  const meta = routeMeta(resolveRoute(pathname));
  return new HTMLRewriter()
    .on("html", { element(el) { el.setAttribute("lang", meta.lang); } })
    .on("title", { element(el) { el.setInnerContent(meta.title); } })
    .on('meta[name="description"]', { element(el) { el.setAttribute("content", meta.description); } })
    .on('meta[property="og:title"]', { element(el) { el.setAttribute("content", meta.ogTitle); } })
    .on('meta[property="og:description"]', { element(el) { el.setAttribute("content", meta.ogDescription); } })
    .transform(response);
}

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
    if (asset.status !== 404) return withRouteMeta(asset, url.pathname);
    const shell = await env.ASSETS.fetch(new Request(new URL("/", request.url).toString(), request));
    // 未知路径落到 SPA 外壳，但 meta 按「访客请求的那个路径」改写，不是按 "/"。
    return withRouteMeta(shell, url.pathname);
  },
};

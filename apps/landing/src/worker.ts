import { portfolioApi } from "./portfolio-api.js";
import type { DeferredContext } from "./portfolio-api.js";
import { PROJECTS_FEED_URL, orderedCards, parseProjectCards, projectsScriptTag } from "./projects.js";
import type { LandingCard } from "./projects.js";
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
  append(content: string, options: { html: boolean }): void;
}
declare class HTMLRewriter {
  on(selector: string, handler: { element(element: RewriterElement): void }): HTMLRewriter;
  transform(response: Response): Response;
}
/** 同上，手写这个也是为了不引 workers-types。（DeferredContext 在 portfolio-api 里。） */
declare const caches: { default: { match(key: string): Promise<Response | undefined>; put(key: string, response: Response): Promise<void> } };

/**
 * 在边缘取一份 share 的作品列表。
 *
 * ── 为什么不是直接 fetch ──────────────────────────────────────────────────
 * 直接 await 一个跨服务的 fetch，落地页的 TTFB 就被 share 的 API 绑住了。实测过：
 * 本地 wrangler dev 下 `curl /` 从 12ms 变成 240–660ms，而且每次都付 —— 边缘缓存
 * 只在 Cloudflare 网络里生效，更要紧的是个人站流量本来就低，命中率高不到哪去。
 *
 * 所以改成 stale-while-revalidate：
 *   - 缓存里有，就直接用（不管新旧），TTFB 不含任何跨服务请求；
 *   - 用完发现它超过 5 分钟了，顺手在 waitUntil 里刷一遍，下一个访客就是新的；
 *   - 缓存里没有（刚部署、被清掉），这次渲染快照，同时后台去取。
 *
 * 结果是 fetch 的耗时永远不出现在 HTML 的响应路径上。同一台机器上实测：第一个
 * 请求 16ms（渲染快照，后台去取），之后 3–6ms 且是真数据 —— 对比直接 await 的
 * 240–660ms。代价是数据最多旧 5 分钟，以及冷启动后第一个访客看到快照 —— 快照就
 * 是同一批作品，这个代价是划算的。
 */
const FEED_CACHE_KEY = "https://landing.wellorbetterai.internal/projects-feed";
/** 超过这个时间就在后台刷。作品不会五分钟发一个。 */
const FEED_FRESH_MS = 300_000;
/**
 * 缓存条目自己的 max-age 给足 —— 过期判断由上面那个常量做。
 * 交给 Cache-Control 的话，条目一过期 match 就返回 null，我们连「旧数据」都没有，
 * 只能退快照；而低流量站点几乎每次访问都在 300s 之外，那等于永远用不上真数据。
 */
const FEED_CACHE_HEADERS = { "Content-Type": "application/json", "Cache-Control": "max-age=604800" };
const FEED_STAMP_HEADER = "X-Fetched-At";

/** 抓一份新的塞进边缘缓存。失败就什么都不做 —— 旧的/快照继续用。 */
async function refreshFeed(): Promise<void> {
  try {
    const response = await fetch(PROJECTS_FEED_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return;
    const body = await response.text();
    // 解析不出来就不写缓存：宁可继续用旧的，也不要把一份坏数据缓存 7 天。
    if (!parseProjectCards(JSON.parse(body) as unknown)) return;
    await caches.default.put(
      FEED_CACHE_KEY,
      new Response(body, { headers: { ...FEED_CACHE_HEADERS, [FEED_STAMP_HEADER]: String(Date.now()) } }),
    );
  } catch {
    // 后台任务，没人在等它。
  }
}

async function shareProjects(ctx: DeferredContext): Promise<LandingCard[] | null> {
  let cached: Response | undefined;
  try {
    cached = await caches.default.match(FEED_CACHE_KEY);
  } catch {
    cached = undefined;
  }
  if (!cached) {
    ctx.waitUntil(refreshFeed());
    return null;
  }
  const stampedAt = Number(cached.headers.get(FEED_STAMP_HEADER) ?? 0);
  if (!Number.isFinite(stampedAt) || Date.now() - stampedAt > FEED_FRESH_MS) ctx.waitUntil(refreshFeed());
  try {
    return parseProjectCards(await cached.json());
  } catch {
    return null;
  }
}

/**
 * 按路由改写 SPA 外壳的 <title>/<meta>/<html lang>，并把作品数据注进 <head>。
 *
 * 这是唯一能让链接预览和爬虫看对的地方 —— 它们不执行 JS，所以客户端设
 * document.title 对它们等于没设。index.html 里那一份写死的 meta 以前是所有
 * 路由共用的，于是不管访客打开的是 wellorbetter 的站还是某个人生成的主页，
 * 分享出去都显示 "Personal Site Agent"。
 *
 * 作品数据走注入而不是客户端 fetch，是为了让第一次 render 就有真数据：没有
 * loading 态、没有请求瀑布、没有卡片撑开时的布局跳动。同一份数据顺便把
 * meta description 里那句项目名单也变成真的（见 routes.ts 的 labMeta）。
 *
 * username 是从 URL 里来的，所以转义这件事必须说清楚：HTMLRewriter 自己会转
 * 义，这里不需要手工处理。但它在属性里只转 " 和 &，不转 < >，所以 curl 出来
 * 的原始字节会长这样：content="&quot;><script>alert(1)</script>" —— 看着像注
 * 入，其实不是：开头那个引号已经变成 &quot;，属性值没法被提前闭合，双引号属
 * 性里的 < > 只是字面字符，浏览器不会据此建标签。用 headless Chrome 验过：
 * /u/%22%3E%3Cscript%3E... 解析完 head 里只有 bundle 一个 script 元素。
 * 别看到那串字节就改成手工 escape —— 双重转义会把正常用户名显示成乱码。
 *
 * 注入的那段 JSON 不经过 HTMLRewriter 的转义（append 的 html: true 是原样写
 * 入），所以它自己负责转义，见 projects.ts 的 projectsScriptTag。
 */
function withRouteMeta(
  response: Response,
  pathname: string,
  cards: readonly LandingCard[] | null,
): Response {
  // 顺序跟页面上一致（有封面的在前），不是 API 的返回顺序 —— 见 orderedCards。
  const titles = cards ? orderedCards(cards).map((card) => card.title) : undefined;
  const meta = routeMeta(resolveRoute(pathname), titles);
  const rewriter = new HTMLRewriter()
    .on("html", { element(el) { el.setAttribute("lang", meta.lang); } })
    .on("title", { element(el) { el.setInnerContent(meta.title); } })
    .on('meta[name="description"]', { element(el) { el.setAttribute("content", meta.description); } })
    .on('meta[property="og:title"]', { element(el) { el.setAttribute("content", meta.ogTitle); } })
    .on('meta[property="og:description"]', { element(el) { el.setAttribute("content", meta.ogDescription); } });
  if (cards) {
    const tag = projectsScriptTag(cards);
    rewriter.on("head", { element(el) { el.append(tag, { html: true }); } });
  }
  return rewriter.transform(response);
}

/**
 * HTML 响应的收尾：只有根域名那个站要作品数据，其它路由（包括每一个静态资源）
 * 不该为此多打一次子请求。
 *
 * 判断顺序很重要：先看 content-type 再看路由。resolveRoute 把**未知路径**也归到
 * lab（那是 SPA fallback 的目标），所以 /assets/index-abc.js 的 kind 也是 "lab" ——
 * 只按路由判断的话，每个 JS、CSS、字体请求都会去拉一遍作品列表。
 */
async function finishHtml(response: Response, pathname: string, ctx: DeferredContext): Promise<Response> {
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  const cards = resolveRoute(pathname).kind === "lab" ? await shareProjects(ctx) : null;
  return withRouteMeta(response, pathname, cards);
}

export default {
  async fetch(request: Request, env: LandingEnv, ctx: DeferredContext): Promise<Response> {
    const url = new URL(request.url);
    const portfolioMatch = url.pathname.match(/^\/api\/portfolio\/([^/]+)$/);
    if (portfolioMatch && request.method === "GET") {
      const username = decodedSegment(portfolioMatch[1]!);
      return username ? portfolioApi(env, username, ctx) : invalidUsername();
    }
    const siteMatch = url.pathname.match(/^\/api\/site\/([^/]+)$/);
    if (siteMatch && request.method === "GET") {
      const username = decodedSegment(siteMatch[1]!);
      return username ? siteGetApi(request, env, username, ctx) : invalidUsername();
    }
    if (url.pathname === "/api/site/generate" && request.method === "POST") return siteGenerateApi(request, env, ctx);
    if (url.pathname === "/api/site/edit" && request.method === "POST") return siteEditApi(request, env, ctx);
    if (url.pathname.startsWith("/api/")) return apiNotFound();
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return finishHtml(asset, url.pathname, ctx);
    const shell = await env.ASSETS.fetch(new Request(new URL("/", request.url).toString(), request));
    // 未知路径落到 SPA 外壳，但 meta 按「访客请求的那个路径」改写，不是按 "/"。
    return finishHtml(shell, url.pathname, ctx);
  },
};

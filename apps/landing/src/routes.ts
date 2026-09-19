/**
 * 这个域名上「哪个路径是谁」的唯一定义。
 *
 * 之前这套映射是 main.tsx 里一条 if/else 链，只有浏览器跑得到。于是有两个
 * 后果：一是根路径服务的是 Personal Site Agent 的英文 SaaS 落地页，而
 * wellorbetter 自己的站在 /lab —— 访客输入这个域名，落到的是产品页不是人；
 * 二是 index.html 里的 <title> 和 og: 标签是写死的一份，所有路由共用，爬虫和
 * 链接预览永远只看到 "Personal Site Agent"。
 *
 * 所以把映射提出来做成纯函数：
 * - main.tsx 用它决定渲染哪个组件
 * - worker.ts 用它在响应里改写 <title>/<meta>/<html lang>（爬虫拿不到客户端
 *   设的 document.title，这是唯一能让链接预览正确的地方）
 *
 * 不依赖 DOM、不依赖 React —— worker 的 bundle 里也要能进。
 */

/** Personal Site Agent 落地页的路径。根路径让给 wellorbetter 自己之后它搬到这里。 */
export const SITE_AGENT_PATH = "/site-agent";

export type Route =
  /** wellorbetter 自己的站（vibe coding lab）。根路径就是这个。 */
  | { kind: "lab" }
  /** Personal Site Agent 的产品落地页。 */
  | { kind: "site-agent" }
  /** 某个用户生成出来的公开主页。 */
  | { kind: "site"; username: string }
  /** 那个主页的 Agent 编辑器。 */
  | { kind: "studio"; username: string }
  /** 从 GitHub 读出来的作品集页。 */
  | { kind: "portfolio"; username: string }
  /** 只讲开源贡献的那一页：上游 PR 按仓库分组 + 按月的时间流。 */
  | { kind: "contributions"; username: string };

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 去掉结尾的斜杠，但保留根路径的那一个。 */
function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function resolveRoute(pathname: string): Route {
  const path = normalize(pathname);

  const siteMatch = path.match(/^\/u\/([^/]+)$/);
  if (siteMatch) return { kind: "site", username: decodeSegment(siteMatch[1]!) };

  const studioMatch = path.match(/^\/studio\/([^/]+)$/);
  if (studioMatch) return { kind: "studio", username: decodeSegment(studioMatch[1]!) };

  const portfolioMatch = path.match(/^\/portfolio\/([^/]+)$/);
  if (portfolioMatch) return { kind: "portfolio", username: decodeSegment(portfolioMatch[1]!) };

  const contributionsMatch = path.match(/^\/contributions\/([^/]+)$/);
  if (contributionsMatch) return { kind: "contributions", username: decodeSegment(contributionsMatch[1]!) };

  if (path === SITE_AGENT_PATH) return { kind: "site-agent" };

  // /lab 继续可用：它被分享过、被链接过，换成 301 只是把坏链接换成一次跳转。
  if (path === "/lab") return { kind: "lab" };

  // 其余全部落到 lab —— 这同时是 SPA fallback 的目标，所以未知路径给的是
  // wellorbetter 自己的站，而不是一个产品落地页。
  return { kind: "lab" };
}

export interface RouteMeta {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  /** <html lang>。lab 页默认中文（App.tsx 的 locale 默认 zh）。 */
  lang: string;
}

/** 作品列表取不到时的兜底。名单是手写的，所以它一定会过期 —— 见 labMeta。 */
const LAB_META: RouteMeta = {
  title: "wellorbetter — 把脑子里的小想法，做成真的能用的工具",
  description:
    "wellorbetter 的 vibe coding lab：TimeTrace、cxs、Window Stats 等等 —— 每个项目从一个具体痛点开始，能开源的开源，能本地跑的不依赖云。",
  ogTitle: "wellorbetter · Vibe Coding Lab",
  ogDescription: "把脑子里的小想法，做成真的能用的工具。",
  lang: "zh-CN",
};

const SITE_AGENT_META: RouteMeta = {
  title: "Personal Site Agent — GitHub to personal website",
  description: "Personal Site Agent — give it a GitHub profile, get an editable personal website.",
  ogTitle: "Personal Site Agent",
  ogDescription: "Drop your GitHub. Your personal site builds itself.",
  lang: "en",
};

/**
 * lab 页的 meta。projectTitles 给了就用真的作品名，没给就用写死的那份。
 *
 * 这句 description 是链接预览和搜索结果里唯一会被读到的介绍，以前里面那串
 * 「TimeTrace、cxs、Window Stats」是第三份手写的作品名单（另两份在 App.tsx 的
 * copy.zh/copy.en 里）。worker 本来就为了注入卡片在边缘取了作品列表，顺手把这
 * 句也换成真的，名单就不会再单独漂移。
 *
 * 只取前四个：description 超过 ~160 字符会被搜索结果截断。
 */
export function labMeta(projectTitles: readonly string[] = []): RouteMeta {
  const named = projectTitles.slice(0, 4).join("、");
  return {
    ...LAB_META,
    description: named
      ? `wellorbetter 的 vibe coding lab：${named} 等等 —— 每个项目从一个具体痛点开始，能开源的开源，能本地跑的不依赖云。`
      : LAB_META.description,
  };
}

export function routeMeta(route: Route, projectTitles?: readonly string[]): RouteMeta {
  switch (route.kind) {
    case "lab":
      return labMeta(projectTitles);
    case "site-agent":
      return SITE_AGENT_META;
    case "site":
      return {
        title: `${route.username} — personal site`,
        description: `${route.username}'s personal website, generated from their public GitHub work.`,
        ogTitle: `${route.username} — personal site`,
        ogDescription: `Built from @${route.username}'s public GitHub work.`,
        lang: "en",
      };
    case "studio":
      return {
        title: `${route.username} — Site Studio`,
        description: `Edit @${route.username}'s generated personal site in plain language.`,
        ogTitle: "Personal Site Agent — Studio",
        ogDescription: SITE_AGENT_META.ogDescription,
        lang: "en",
      };
    case "portfolio":
      return {
        title: `${route.username} — portfolio`,
        description: `${route.username}'s projects and open-source contributions, read from public GitHub.`,
        ogTitle: `${route.username} — portfolio`,
        ogDescription: `Projects and contributions by @${route.username}.`,
        lang: "en",
      };
    case "contributions":
      // lang 跟着组件的默认 locale 走（zh），不跟着 portfolio 那条。portfolio 的
      // meta 写的是 en 而 PortfolioPage 默认渲染中文 —— 那个不一致不值得复制一份。
      return {
        title: `${route.username} 的开源贡献 — wellorbetter`,
        description: `@${route.username} 提给别人仓库的 Pull Request：按上游项目分组，按月排出节奏，merged / open / 未被接受都如实标注。`,
        ogTitle: `${route.username} 的开源贡献`,
        ogDescription: `@${route.username} 的上游 PR 轨迹，全部可点回原始 PR。`,
        lang: "zh-CN",
      };
  }
}

import { describe, expect, it } from "vitest";
import { SITE_AGENT_PATH, resolveRoute, routeMeta } from "../routes.js";
import { contributionsPath, portfolioPath } from "../portfolio.js";
import html from "../../index.html?raw";

/**
 * 这个域名「根路径是谁」以前没有任何测试。
 *
 * 映射是 main.tsx 里一条 if/else 链，只有浏览器跑得到，而 apps/landing 整个
 * workspace 一个测试都没有（scripts/test-all.mjs 会把它列在「没有 test
 * script — 未验证」里，那一行是诚实的）。搞错的后果不是某个组件难看，是整个
 * 域名服务错东西 —— 所以这是最该有测试的一处。
 */
describe("landing routes", () => {
  it("serves wellorbetter's own site at the root", () => {
    // 这条是这次改动的全部意义：访客输入域名，落到的是人，不是产品落地页。
    expect(resolveRoute("/")).toEqual({ kind: "lab" });
  });

  it("keeps /lab working", () => {
    // /lab 被分享过、被链接过。改成 301 只是把坏链接换成一次跳转。
    expect(resolveRoute("/lab")).toEqual({ kind: "lab" });
    expect(resolveRoute("/lab/")).toEqual({ kind: "lab" });
  });

  it("serves Personal Site Agent at its own path", () => {
    expect(resolveRoute(SITE_AGENT_PATH)).toEqual({ kind: "site-agent" });
    expect(resolveRoute(`${SITE_AGENT_PATH}/`)).toEqual({ kind: "site-agent" });
  });

  it("routes the site-agent product pages by username", () => {
    expect(resolveRoute("/u/wellorbetter")).toEqual({ kind: "site", username: "wellorbetter" });
    expect(resolveRoute("/studio/wellorbetter")).toEqual({ kind: "studio", username: "wellorbetter" });
    expect(resolveRoute("/portfolio/wellorbetter")).toEqual({ kind: "portfolio", username: "wellorbetter" });
    expect(resolveRoute("/contributions/wellorbetter")).toEqual({ kind: "contributions", username: "wellorbetter" });
  });

  it("tolerates a trailing slash on username routes", () => {
    expect(resolveRoute("/u/wellorbetter/")).toEqual({ kind: "site", username: "wellorbetter" });
  });

  it("percent-decodes the username segment", () => {
    expect(resolveRoute("/u/a%20b")).toEqual({ kind: "site", username: "a b" });
    // 坏的转义序列不能抛 —— 路径是访客给的。
    expect(resolveRoute("/u/%E0%A4%A")).toEqual({ kind: "site", username: "%E0%A4%A" });
  });

  it("falls unknown paths back to wellorbetter, not to the product page", () => {
    // SPA fallback 的目标。以前未知路径给的是英文 SaaS 落地页。
    for (const path of ["/whatever", "/u", "/u/a/b", "/studio", "/portfolio", "/contributions"]) {
      expect(resolveRoute(path), path).toEqual({ kind: "lab" });
    }
  });
});

/**
 * worker.ts 按路由改写 <title>/og:/<html lang>。爬虫和链接预览不执行 JS，
 * 所以这是唯一能让它们看对的地方 —— 以前所有路由共用 index.html 里写死的
 * 一份，不管分享的是谁的页面，预览都显示 "Personal Site Agent"。
 */
describe("landing route meta", () => {
  it("gives the root a wellorbetter title in Chinese", () => {
    const meta = routeMeta(resolveRoute("/"));
    expect(meta.title).toContain("wellorbetter");
    expect(meta.title).not.toContain("Personal Site Agent");
    // App.tsx 的 locale 默认 zh，所以外壳的 lang 也要是 zh-CN。
    expect(meta.lang).toBe("zh-CN");
  });

  it("keeps the product page's own English identity", () => {
    const meta = routeMeta(resolveRoute(SITE_AGENT_PATH));
    expect(meta.title).toContain("Personal Site Agent");
    expect(meta.lang).toBe("en");
  });

  it("names the user on generated pages instead of the product", () => {
    for (const path of ["/u/octocat", "/portfolio/octocat", "/contributions/octocat"]) {
      expect(routeMeta(resolveRoute(path)).title, path).toContain("octocat");
    }
  });

  /**
   * 生成路径的 helper 必须能被 resolveRoute 解回同一种页面。
   *
   * portfolioPath 以前返回 `/u/<name>` —— 那是**生成主页**的路由，不是作品集。唯一
   * 的调用点是作品集页上的用户名表单，于是在作品集页搜一个人会把你带去另一种页面，
   * 而两个路由都存在、都能渲染，所以全程不报错。一个 helper 和一个 resolveRoute 对
   * 不上，正是这类 bug 的形状。
   */
  it("round-trips its own path helpers", () => {
    expect(resolveRoute(portfolioPath("octocat"))).toEqual({ kind: "portfolio", username: "octocat" });
    expect(resolveRoute(contributionsPath("octocat"))).toEqual({ kind: "contributions", username: "octocat" });
    // 用户名是访客给的，helper 编码、resolveRoute 解码，来回要还原。
    expect(resolveRoute(contributionsPath("a b"))).toEqual({ kind: "contributions", username: "a b" });
  });

  it("never leaves a field empty", () => {
    for (const path of ["/", SITE_AGENT_PATH, "/u/x", "/studio/x", "/portfolio/x", "/contributions/x", "/nope"]) {
      const meta = routeMeta(resolveRoute(path));
      for (const [key, value] of Object.entries(meta)) {
        expect(value, `${path} → ${key}`).toBeTruthy();
      }
    }
  });

  it("matches index.html's static defaults for the root", () => {
    // 静态那份是兜底：改写失败时兜到的必须还是这个域名真正的主人。两边漂开
    // 就会出现「worker 挂了之后首页突然变成产品落地页」这种只在故障时暴露的
    // 不一致。
    const meta = routeMeta({ kind: "lab" });
    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toContain(`<title>${meta.title}</title>`);
    expect(html).toContain(`content="${meta.ogTitle}"`);
    expect(html).toContain(`content="${meta.ogDescription}"`);
    expect(html).toContain(`content="${meta.description}"`);
  });
});

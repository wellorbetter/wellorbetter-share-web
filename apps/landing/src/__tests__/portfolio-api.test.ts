/**
 * /api/portfolio/:username 的缓存行为。
 *
 * ── 为什么需要这个文件 ──────────────────────────────────────────────────────
 * 这个 BFF 之前一条测试都没有，而它的失效方式偏偏是「偶尔」：落地页上「Live
 * example」那两个链接指向 /u/wellorbetter，线上连着探三次拿到 502 / 200 / 200。
 * 原因是未认证的 GitHub API 配额（core 60 次/小时、按机房出口 IP 共用；search 更
 * 紧，10 次/分钟）撞上一份不保留旧数据的缓存 —— Workers 的 Cache API 不实现
 * stale-while-revalidate，条目一过 s-maxage 就从 match 里彻底消失。
 *
 * 所以这里钉的全是「只在 GitHub 不配合时才看得见」的分支：
 *   1. 有缓存就不碰 GitHub（配额是共享的，省一次就是多一个访客不抽奖）；
 *   2. 缓存过期 → 先返回旧的，刷新在 waitUntil 里（TTFB 不含跨服务请求）；
 *   3. GitHub 全挂但缓存里有东西 → 仍然 200。**这条就是这次修的东西**；
 *   4. 半残的数据（只有 search 被限流）不许进缓存 —— 否则一份「0 个 PR、0 个仓库」
 *      的主页会在边缘待满有效期，比 502 更难发现。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { portfolioApi } from "../portfolio-api.js";
import type { DeveloperPortfolio } from "../portfolio.js";

/** 从 api.github.com 真实响应里裁下来的形状，只留 build() 读的字段。 */
const USER = {
  login: "wellorbetter",
  name: null,
  avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
  html_url: "https://github.com/wellorbetter",
  bio: "Android Systems Engineer & Builder",
  company: "@bytedance",
  location: null,
  blog: "wellorbetterai.com",
  public_repos: 60,
  followers: 12,
  created_at: "2019-03-01T00:00:00Z",
};

const REPOS = [
  {
    name: "timetrace",
    full_name: "wellorbetter/timetrace",
    html_url: "https://github.com/wellorbetter/timetrace",
    description: "Local-first activity tracking",
    fork: false,
    archived: false,
    stargazers_count: 15,
    forks_count: 1,
    language: "Rust",
    topics: ["rust", "local-first"],
    homepage: null,
    updated_at: "2026-09-10T00:00:00Z",
    pushed_at: "2026-09-10T00:00:00Z",
    open_issues_count: 0,
    license: { spdx_id: "MIT" },
  },
];

const PULLS = {
  total_count: 1,
  items: [
    {
      number: 7,
      title: "fix: stop dropping the last frame",
      html_url: "https://github.com/microsoft/mxc/pull/7",
      repository_url: "https://api.github.com/repos/microsoft/mxc",
      state: "closed" as const,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-02T00:00:00Z",
      pull_request: { merged_at: "2026-08-02T00:00:00Z" },
    },
  ],
};

/**
 * 一个手动放行的闸门。
 *
 * 「后台做」这件事没法靠「调用次数」证明：waitUntil(f()) 里的 f 是同步开始执行的，
 * 请求确实立刻发出去了 —— 关键在于**响应没有在等它**。所以让替身卡住，看响应能不
 * 能先回来。第一版测试就是数调用次数，于是两条都红了，而代码是对的。
 */
function gate() {
  let release!: () => void;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { opened, release };
}

/** Cache API 的最小替身：只有 match/put，键按 URL 存。 */
class FakeCache {
  readonly entries = new Map<string, { body: string; headers: Headers }>();
  /** 设上之后 put 会卡住，直到闸门放行。 */
  hold: Promise<void> | null = null;

  async match(key: Request | string): Promise<Response | undefined> {
    const hit = this.entries.get(typeof key === "string" ? key : key.url);
    return hit ? new Response(hit.body, { headers: hit.headers }) : undefined;
  }

  async put(key: Request | string, response: Response): Promise<void> {
    const body = await response.text();
    if (this.hold) await this.hold;
    this.entries.set(typeof key === "string" ? key : key.url, {
      body,
      headers: new Headers(response.headers),
    });
  }

  /** 唯一那条缓存的内容 + 写入时间戳。 */
  only(): { portfolio: DeveloperPortfolio; fetchedAt: number } | null {
    const [entry] = [...this.entries.values()];
    if (!entry) return null;
    return {
      portfolio: JSON.parse(entry.body) as DeveloperPortfolio,
      fetchedAt: Number(entry.headers.get("X-Fetched-At")),
    };
  }
}

/** 按 URL 分派的 GitHub 替身。status 给非 200 就是「这条被限流了」。 */
function githubStub(status: { user?: number; repos?: number; search?: number } = {}, hold?: Promise<void>) {
  const calls: string[] = [];
  const reply = (code: number, body: unknown): Response =>
    code === 200
      ? Response.json(body)
      : // 403 + 这个 body 就是未认证配额用尽时 GitHub 真正返回的东西。
        Response.json({ message: "API rate limit exceeded for 1.2.3.4." }, { status: code });

  const fetchImpl = vi.fn(async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    if (hold) await hold;
    if (url.includes("/search/issues")) return reply(status.search ?? 200, PULLS);
    if (url.includes("/repos?")) return reply(status.repos ?? 200, REPOS);
    if (url.includes("/users/")) return reply(status.user ?? 200, USER);
    throw new Error(`预期外的 GitHub 请求：${url}`);
  });
  return { calls, fetchImpl };
}

/** 收集 waitUntil 的后台任务，测试里手动 await —— 不然断言会跑在写缓存之前。 */
function deferred() {
  const tasks: Promise<unknown>[] = [];
  return {
    ctx: { waitUntil: (promise: Promise<unknown>) => void tasks.push(promise) },
    settle: () => Promise.all(tasks),
    get count() {
      return tasks.length;
    },
  };
}

let cache: FakeCache;

beforeEach(() => {
  cache = new FakeCache();
  vi.stubGlobal("caches", { default: cache });
  // GraphQL 那条在没有 GITHUB_TOKEN 时根本不会发（activity 开头就 return null），
  // 所以整个文件都用 env = {} —— 这也正是线上的状态。
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function call(fetchImpl: typeof fetch, ctx: { waitUntil: (p: Promise<unknown>) => void }, username = "wellorbetter") {
  vi.stubGlobal("fetch", fetchImpl);
  return portfolioApi({}, username, ctx);
}

describe("冷缓存", () => {
  it("取一次 GitHub，返回真数据，并把它留给下一个访客", async () => {
    const { fetchImpl, calls } = githubStub();
    const d = deferred();
    const g = gate();
    cache.hold = g.opened;
    const response = await call(fetchImpl as unknown as typeof fetch, d.ctx);

    expect(response.status).toBe(200);
    const portfolio = (await response.json()) as DeveloperPortfolio;
    expect(portfolio.profile.login).toBe("wellorbetter");
    expect(portfolio.stats.externalMergedPullRequests).toBe(1);
    expect(calls).toHaveLength(3);

    // 写缓存卡在闸门上，而响应已经完整读完了 —— 它不在响应路径上。
    expect(cache.entries.size).toBe(0);
    expect(d.count).toBe(1);
    g.release();
    await d.settle();
    expect(cache.only()?.portfolio.profile.login).toBe("wellorbetter");
  });

  it("GitHub 挂了、缓存又是空的，这时才 502", async () => {
    // 这是唯一剩下的失败窗口：某个机房还没成功取过一次。只能靠 GITHUB_TOKEN 收窄。
    const { fetchImpl } = githubStub({ user: 403, repos: 403, search: 403 });
    const response = await call(fetchImpl as unknown as typeof fetch, deferred().ctx);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "github_unavailable" } });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("用户不存在是 404，不是 502", async () => {
    const { fetchImpl } = githubStub({ user: 404 });
    const response = await call(fetchImpl as unknown as typeof fetch, deferred().ctx);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "github_user_not_found" } });
    expect(cache.entries.size).toBe(0);
  });

  it("非法用户名直接挡掉，一次 GitHub 都不发", async () => {
    // 配额是整个机房共享的，所以「先校验再发请求」不只是礼貌问题。
    const { fetchImpl, calls } = githubStub();
    for (const bad of ["", "-lead", "trail-", "a".repeat(40), "has space", "semi;colon"]) {
      const response = await call(fetchImpl as unknown as typeof fetch, deferred().ctx, bad);
      expect(response.status, bad).toBe(400);
    }
    expect(calls).toEqual([]);
  });
});

describe("热缓存", () => {
  it("新鲜的时候完全不碰 GitHub", async () => {
    const first = githubStub();
    const warm = deferred();
    await call(first.fetchImpl as unknown as typeof fetch, warm.ctx);
    await warm.settle();

    const second = githubStub();
    const d = deferred();
    const response = await call(second.fetchImpl as unknown as typeof fetch, d.ctx);

    expect(response.status).toBe(200);
    expect((await response.json() as DeveloperPortfolio).profile.login).toBe("wellorbetter");
    expect(second.calls).toEqual([]);
    expect(d.count).toBe(0);
  });

  it("用户名大小写不同也算同一份缓存", async () => {
    const first = githubStub();
    const warm = deferred();
    await call(first.fetchImpl as unknown as typeof fetch, warm.ctx);
    await warm.settle();

    // 以前缓存键是 request.url，于是 /WellOrBetter 是另一份缓存、另抽一次奖，
    // 而且要再花一份本来就不够的配额。GitHub 的用户名本身是大小写不敏感的。
    const second = githubStub();
    const response = await call(second.fetchImpl as unknown as typeof fetch, deferred().ctx, "WellOrBetter");
    expect(response.status).toBe(200);
    expect(second.calls).toEqual([]);
  });

  it("过期了也先把旧的返回，刷新扔到后台", async () => {
    vi.useFakeTimers();
    const first = githubStub();
    const warm = deferred();
    await call(first.fetchImpl as unknown as typeof fetch, warm.ctx);
    await warm.settle();
    const stampedAt = cache.only()!.fetchedAt;

    vi.advanceTimersByTime(900_001);
    const g = gate();
    const second = githubStub({}, g.opened);
    const d = deferred();
    const response = await call(second.fetchImpl as unknown as typeof fetch, d.ctx);

    // GitHub 还卡在闸门上，旧数据已经返回了 —— 这就是「TTFB 里没有 GitHub」的意思。
    expect(response.status).toBe(200);
    expect((await response.json() as DeveloperPortfolio).profile.login).toBe("wellorbetter");
    expect(d.count).toBe(1);
    expect(cache.only()!.fetchedAt).toBe(stampedAt);

    g.release();
    await d.settle();
    expect(second.calls).toHaveLength(3);
    expect(cache.only()!.fetchedAt).toBeGreaterThan(stampedAt);
  });

  it("过期 + GitHub 挂了 = 继续用旧的，不降级成错误页", async () => {
    // 这条是这次改动的全部意义。改之前：条目过了 s-maxage 就从 match 里消失，
    // 于是这个场景必然 502，访客看到 site-error-screen。
    vi.useFakeTimers();
    const first = githubStub();
    const warm = deferred();
    await call(first.fetchImpl as unknown as typeof fetch, warm.ctx);
    await warm.settle();

    vi.advanceTimersByTime(30 * 24 * 3600_000);
    const down = githubStub({ user: 403, repos: 403, search: 403 });
    const d = deferred();
    const response = await call(down.fetchImpl as unknown as typeof fetch, d.ctx);

    expect(response.status).toBe(200);
    expect((await response.json() as DeveloperPortfolio).profile.login).toBe("wellorbetter");

    // 后台刷失败了，但旧数据必须还在 —— 刷新不能把缓存清空。
    await d.settle();
    expect(cache.only()?.portfolio.profile.login).toBe("wellorbetter");
  });

  it("缓存里是上个版本写的坏形状就当没缓存", async () => {
    await cache.put(new Request("https://portfolio.cache.invalid/v2/wellorbetter"), new Response('{"version":2}'));
    const { fetchImpl, calls } = githubStub();
    const d = deferred();
    const response = await call(fetchImpl as unknown as typeof fetch, d.ctx);
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(3);
  });
});

describe("半残的数据不许进缓存", () => {
  it("只有 search 被限流：照样返回，但不留下来", async () => {
    // /search/issues 走的是搜索配额（未认证 10 次/分钟），比 core 更容易先撞上。
    // 撞上之后 /users/:u 往往还是好的，于是页面渲染成功但 PR 数字全是 0。把这个
    // 缓存下来，它会在边缘待满有效期 —— 我自己就被它骗过，把「这个用户没什么
    // 仓库」记成了待办。
    const { fetchImpl } = githubStub({ search: 403 });
    const d = deferred();
    const response = await call(fetchImpl as unknown as typeof fetch, d.ctx);

    expect(response.status).toBe(200);
    const portfolio = (await response.json()) as DeveloperPortfolio;
    expect(portfolio.stats.pullRequests).toBe(0);
    expect(portfolio.contributions).toEqual([]);
    // 仓库那条是好的，所以这不是一个「空」页面，只是缺了一块 —— 更难被发现。
    expect(portfolio.stats.sourceRepos).toBe(1);

    await d.settle();
    expect(cache.entries.size, "半残的数据被缓存了").toBe(0);
  });

  it("只有仓库列表被限流：同样不留", async () => {
    const { fetchImpl } = githubStub({ repos: 403 });
    const d = deferred();
    const response = await call(fetchImpl as unknown as typeof fetch, d.ctx);
    expect(response.status).toBe(200);
    expect((await response.json() as DeveloperPortfolio).stats.sourceRepos).toBe(0);
    await d.settle();
    expect(cache.entries.size).toBe(0);
  });

  it("后台刷新拿到半残的，不会覆盖掉好的那份", async () => {
    vi.useFakeTimers();
    const first = githubStub();
    const warm = deferred();
    await call(first.fetchImpl as unknown as typeof fetch, warm.ctx);
    await warm.settle();
    const good = cache.only()!;

    vi.advanceTimersByTime(900_001);
    const partial = githubStub({ search: 403 });
    const d = deferred();
    await call(partial.fetchImpl as unknown as typeof fetch, d.ctx);
    await d.settle();

    expect(cache.only()!.portfolio.stats.pullRequests).toBe(good.portfolio.stats.pullRequests);
    expect(cache.only()!.fetchedAt).toBe(good.fetchedAt);
  });
});

import type { DeveloperPortfolio, PortfolioActivity, PortfolioContribution, PortfolioProject } from "./portfolio.js";

const GITHUB_API = "https://api.github.com";
const GITHUB_GRAPHQL = "https://api.github.com/graphql";
const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

type PortfolioEnv = {
  GITHUB_TOKEN?: string;
};

/**
 * ExecutionContext 上只用到 waitUntil。
 *
 * 没装 @cloudflare/workers-types（这个 workspace 的 tsconfig 带 DOM lib，两者的
 * Request/Response 会打架，见 worker.ts 上面那段），所以手写。放在这个文件里导出
 * 是因为它是需要 waitUntil 的那一层 —— worker.ts 和 site-agent-api.ts 从这儿引，
 * 免得三个文件各声明一遍同一个接口。
 */
export interface DeferredContext {
  waitUntil(promise: Promise<unknown>): void;
}

type GitHubUser = {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string;
  public_repos: number;
  followers: number;
  created_at: string;
};

type GitHubRepo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics?: string[];
  homepage: string | null;
  updated_at: string;
  pushed_at: string;
  open_issues_count: number;
  license: { spdx_id?: string | null } | null;
};

type GitHubPull = {
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  pull_request?: { merged_at?: string | null };
};

type SearchResponse<T> = { total_count: number; items: T[] };

type GraphqlActivity = {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionYears: number[];
        startedAt: string;
        endedAt: string;
        restrictedContributionsCount: number;
        totalCommitContributions: number;
        totalIssueContributions: number;
        totalPullRequestContributions: number;
        totalPullRequestReviewContributions: number;
        totalRepositoriesWithContributedCommits: number;
        totalRepositoriesWithContributedIssues: number;
        totalRepositoriesWithContributedPullRequests: number;
        totalRepositoriesWithContributedPullRequestReviews: number;
        contributionCalendar: {
          totalContributions: number;
          weeks: Array<{
            contributionDays: Array<{ date: string; contributionCount: number; contributionLevel: string }>;
          }>;
        };
        commitContributionsByRepository: Array<{
          repository: { nameWithOwner: string; url: string };
          contributions: { totalCount: number };
        }>;
      };
    } | null;
  };
  errors?: unknown[];
};

const CONTRIBUTION_QUERY = `
query PortfolioActivity($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionYears
      startedAt
      endedAt
      restrictedContributionsCount
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalRepositoriesWithContributedCommits
      totalRepositoriesWithContributedIssues
      totalRepositoriesWithContributedPullRequests
      totalRepositoriesWithContributedPullRequestReviews
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
      commitContributionsByRepository(maxRepositories: 12) {
        repository { nameWithOwner url }
        contributions { totalCount }
      }
    }
  }
}`;

/**
 * 取 token，顺手 trim。
 *
 * trim 不是洁癖：secret 是粘进 stdin 的，末尾多一个换行的话
 * `new Headers({ Authorization: "Bearer ghp_x\n" })` 会直接抛（HTTP 头里不允许换
 * 行），于是四个请求一起炸，对外的表现是「配了 token 反而每次都 502」—— 比不配
 * token 更糟，而且错误信息里完全看不出跟 token 有关。
 */
function githubToken(env: PortfolioEnv): string | null {
  const value = env.GITHUB_TOKEN?.trim();
  return value ? value : null;
}

function headers(env: PortfolioEnv): Headers {
  const value = new Headers({
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "wellorbetter-portfolio/2.0",
  });
  const token = githubToken(env);
  if (token) value.set("Authorization", `Bearer ${token}`);
  return value;
}

/**
 * 上游一次请求的结果。
 *
 * limit/remaining 是 GitHub 回的配额计数；tokenRejected 表示「带 token 那次被 401
 * 了、这个结果是退回未认证拿到的」。两个都只用于 unavailable 的诊断输出。
 */
type GithubResult<T> = {
  status: number;
  data: T | null;
  limit: string | null;
  remaining: string | null;
  tokenRejected: boolean;
};

/**
 * 带 token 取；token 被拒就退回未认证再来一次。
 *
 * GitHub 对坏 token 回 401（过期、被撤销、粘错、粘进了多余的字符）。带着一个坏
 * token 比不带更糟：未认证只是配额紧（60 次/小时，偶尔失败），坏 token 是**每次
 * 都**失败。而 token 会过期 —— fine-grained token 默认就有有效期 —— 所以这不是
 * 假想的场景，是「某天这个站会自己坏掉，且看不出为什么」。
 *
 * 退回之后的行为跟没配 token 完全一样，也就是这个 PR 之前的线上状态：靠缓存里的
 * 旧数据撑住可用性。少的只有 contributions 那一块（GraphQL 强制认证）。
 */
async function githubJson<T>(env: PortfolioEnv, url: string): Promise<GithubResult<T>> {
  let response = await fetch(url, { headers: headers(env) });
  let tokenRejected = false;
  if (response.status === 401 && githubToken(env)) {
    console.error("github_token_rejected", { url, status: 401 });
    tokenRejected = true;
    response = await fetch(url, { headers: headers({}) });
  }
  const limit = response.headers.get("X-RateLimit-Limit");
  const remaining = response.headers.get("X-RateLimit-Remaining");
  if (!response.ok) return { status: response.status, data: null, limit, remaining, tokenRejected };
  return { status: response.status, data: (await response.json()) as T, limit, remaining, tokenRejected };
}

async function activity(env: PortfolioEnv, username: string): Promise<PortfolioActivity | null> {
  const token = githubToken(env);
  // GraphQL 接口强制认证，没有 token 这一块就是没有 —— 不是错误。
  if (!token) return null;
  try {
    const response = await fetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "wellorbetter-portfolio/2.0",
      },
      body: JSON.stringify({ query: CONTRIBUTION_QUERY, variables: { login: username } }),
    });
    if (response.status === 401) console.error("github_token_rejected", { url: GITHUB_GRAPHQL, status: 401 });
    if (!response.ok) return null;
    const payload = (await response.json()) as GraphqlActivity;
    if (payload.errors?.length) return null;
    const collection = payload.data?.user?.contributionsCollection;
    if (!collection) return null;
    return {
      period: { from: collection.startedAt, to: collection.endedAt },
      years: collection.contributionYears,
      totalContributions: collection.contributionCalendar.totalContributions,
      restrictedContributions: collection.restrictedContributionsCount,
      commits: collection.totalCommitContributions,
      issues: collection.totalIssueContributions,
      pullRequests: collection.totalPullRequestContributions,
      reviews: collection.totalPullRequestReviewContributions,
      repositories: {
        commits: collection.totalRepositoriesWithContributedCommits,
        issues: collection.totalRepositoriesWithContributedIssues,
        pullRequests: collection.totalRepositoriesWithContributedPullRequests,
        reviews: collection.totalRepositoriesWithContributedPullRequestReviews,
      },
      calendar: collection.contributionCalendar.weeks.flatMap((week) =>
        week.contributionDays.map((day) => ({ date: day.date, count: day.contributionCount, level: day.contributionLevel })),
      ),
      topCommitRepositories: collection.commitContributionsByRepository
        .map((item) => ({ repository: item.repository.nameWithOwner, url: item.repository.url, commits: item.contributions.totalCount }))
        .sort((a, b) => b.commits - a.commits),
    };
  } catch {
    return null;
  }
}

function repoFromApi(value: string): string {
  try {
    const pathname = new URL(value).pathname;
    const marker = "/repos/";
    const index = pathname.indexOf(marker);
    return index < 0 ? "unknown/unknown" : pathname.slice(index + marker.length);
  } catch {
    return "unknown/unknown";
  }
}

function website(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function projects(repos: GitHubRepo[]): PortfolioProject[] {
  return repos
    .filter((repo) => !repo.fork && !repo.archived)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
    .slice(0, 16)
    .map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      homepage: repo.homepage || null,
      language: repo.language,
      topics: repo.topics ?? [],
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      license: repo.license?.spdx_id ?? null,
      updatedAt: repo.updated_at,
    }));
}

function languages(repos: GitHubRepo[]): Array<{ name: string; repos: number }> {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (repo.fork || repo.archived || !repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, repos: count }))
    .sort((a, b) => b.repos - a.repos || a.name.localeCompare(b.name))
    .slice(0, 10);
}

function contributions(username: string, items: GitHubPull[]): PortfolioContribution[] {
  const owner = username.toLowerCase();
  return items
    .map((item) => {
      const repository = repoFromApi(item.repository_url);
      const repositoryOwner = repository.split("/")[0] ?? "unknown";
      return {
        repository,
        repositoryOwner,
        number: item.number,
        title: item.title,
        url: item.html_url,
        state: item.state,
        merged: Boolean(item.pull_request?.merged_at),
        external: repositoryOwner.toLowerCase() !== owner,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      } satisfies PortfolioContribution;
    })
    .sort((a, b) => Number(b.external) - Number(a.external) || Number(b.merged) - Number(a.merged) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 60);
}

/**
 * 一次构建的结果。
 *
 * complete = 四个 GitHub 请求里「会影响内容」的那几个都成功了。这个字段存在的
 * 理由见下面 writeCache 上面那段：半残的结果照样返回，但不许进缓存。
 */
type BuildResult = {
  status: number;
  portfolio: DeveloperPortfolio | null;
  complete: boolean;
  /** 失败时报给调用方的诊断信息，见 unavailable。 */
  limit?: string | null;
  remaining?: string | null;
  tokenRejected?: boolean;
};

async function build(env: PortfolioEnv, username: string): Promise<BuildResult> {
  const encoded = encodeURIComponent(username);
  const search = new URL(`${GITHUB_API}/search/issues`);
  search.searchParams.set("q", `author:${username} type:pr`);
  search.searchParams.set("per_page", "100");
  search.searchParams.set("sort", "updated");
  search.searchParams.set("order", "desc");

  const [userResult, repoResult, pullResult, contributionActivity] = await Promise.all([
    githubJson<GitHubUser>(env, `${GITHUB_API}/users/${encoded}`),
    githubJson<GitHubRepo[]>(env, `${GITHUB_API}/users/${encoded}/repos?per_page=100&sort=updated&type=owner`),
    githubJson<SearchResponse<GitHubPull>>(env, search.toString()),
    activity(env, username),
  ]);

  if (userResult.status === 404) return { status: 404, portfolio: null, complete: false };
  if (!userResult.data) {
    return {
      status: userResult.status || 502,
      portfolio: null,
      complete: false,
      limit: userResult.limit,
      remaining: userResult.remaining,
      tokenRejected: userResult.tokenRejected,
    };
  }

  const user = userResult.data;
  const repos = repoResult.data ?? [];
  const pullSearch = pullResult.data ?? { total_count: 0, items: [] };
  const normalized = contributions(user.login, pullSearch.items);
  const source = repos.filter((repo) => !repo.fork && !repo.archived);

  return {
    status: 200,
    // activity 不算：没有 GITHUB_TOKEN 时它**永远**是 null（见 activity 开头那行），
    // 把它算进来等于这个站从来没有一份「完整」数据可缓存。
    complete: Boolean(repoResult.data) && Boolean(pullResult.data),
    portfolio: {
      version: 2,
      profile: {
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
        githubUrl: user.html_url,
        bio: user.bio,
        company: user.company,
        location: user.location,
        website: website(user.blog),
        joinedAt: user.created_at,
      },
      stats: {
        publicRepos: user.public_repos,
        sourceRepos: source.length,
        stars: source.reduce((sum, repo) => sum + repo.stargazers_count, 0),
        followers: user.followers,
        pullRequests: pullSearch.total_count,
        mergedPullRequests: normalized.filter((item) => item.merged).length,
        externalPullRequests: normalized.filter((item) => item.external).length,
        externalMergedPullRequests: normalized.filter((item) => item.external && item.merged).length,
      },
      languages: languages(repos),
      projects: projects(repos),
      contributions: normalized,
      activity: contributionActivity,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * ── 为什么这份缓存要自己记时间戳 ──────────────────────────────────────────────
 * 以前这里把要返回给浏览器的那个响应原封不动塞进 Cache API，于是缓存条目的寿命
 * 就等于响应头里的 s-maxage=1800。而 Workers 的 Cache API **不实现**
 * stale-while-revalidate：条目一过 s-maxage，cache.match 直接返回 undefined ——
 * 「旧数据」不是被降级使用，是彻底没了。
 *
 * 于是每 30 分钟就有一个访客要现场去问 GitHub，而这里问的是**未认证**的 GitHub
 * API：60 次/小时，配额按出口 IP 算，也就是整个 Cloudflare 机房共用一份。落地页
 * 上「Live example」那两个链接指向 /u/wellorbetter，所以这一发硬币就是产品演示
 * 本身。线上连着探三次：502 / 200 / 200 —— 502 那次访客看到的是 site-error-screen
 * （「这个主页暂时生成失败」）。
 *
 * 改成条目自己给足 7 天、新鲜与否由 X-Fetched-At 判断：过期了先把旧的返回，同时
 * 在 waitUntil 里刷一遍。GitHub 被限流从此只影响数据新鲜度，不影响可用性 ——
 * 只剩「这个机房还没成功取过一次」那一发仍可能 502，那个只能靠 GITHUB_TOKEN。
 */
const CACHE_ORIGIN = "https://portfolio.cache.invalid";
/** 条目自己的寿命给足，过期判断交给 STAMP_HEADER。 */
const CACHE_HEADERS = { "Content-Type": "application/json", "Cache-Control": "max-age=604800" };
const STAMP_HEADER = "X-Fetched-At";
/** 超过这个时间就在后台刷。一个人的 GitHub 不会 15 分钟变一次。 */
const FRESH_MS = 900_000;

function edgeCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}

/**
 * GitHub 用户名大小写不敏感，所以键要归一化。
 *
 * 以前的键是 request.url，于是 /api/portfolio/WellOrBetter 和 /wellorbetter 是两份
 * 缓存、各自抛一次硬币，而且都要各花一份本来就不够的 GitHub 配额。
 */
function cacheKey(username: string): Request {
  return new Request(`${CACHE_ORIGIN}/v2/${encodeURIComponent(username.toLowerCase())}`);
}

async function readCache(username: string): Promise<{ portfolio: DeveloperPortfolio; fetchedAt: number } | null> {
  try {
    const hit = await edgeCache().match(cacheKey(username));
    if (!hit) return null;
    const portfolio = (await hit.json()) as DeveloperPortfolio;
    // 形状不对就当没缓存。缓存里躺着的是上一个版本的代码写进去的东西，字段可能
    // 已经改了 —— 宁可多问 GitHub 一次，也不要把半个对象喂给 SiteSpec 的校验器。
    if (typeof portfolio?.version !== "number" || !portfolio.profile?.login) return null;
    const stamp = Number(hit.headers.get(STAMP_HEADER) ?? 0);
    return { portfolio, fetchedAt: Number.isFinite(stamp) ? stamp : 0 };
  } catch {
    return null;
  }
}

/**
 * 只有完整的数据才写缓存。
 *
 * build 里那四个 GitHub 请求是并行发的，而 /search/issues 走的是**搜索**配额：
 * 未认证 10 次/分钟，比 core 的 60 次/小时更容易先撞上。撞上之后 /users/:u 那条
 * 往往还是好的，于是页面照常渲染，只是 PR 相关的数字全是 0、仓库列表是空的 ——
 * 把这种半残的结果缓存下来，它会在边缘待满有效期，比直接 502 更难发现（我自己
 * 就被它骗过一次，把「这个用户没什么仓库」记成了待办）。
 *
 * 所以：残的照样返回（比报错强，而且下一个请求会重试），但不留。
 */
async function writeCache(username: string, portfolio: DeveloperPortfolio): Promise<void> {
  try {
    await edgeCache().put(
      cacheKey(username),
      new Response(JSON.stringify(portfolio), { headers: { ...CACHE_HEADERS, [STAMP_HEADER]: String(Date.now()) } }),
    );
  } catch {
    // 写不进去不是错误路径：这次要返回的东西已经在手上了。
  }
}

/** 后台刷新。拿不到、或者只拿到半残的，就什么都不做 —— 旧的继续用。 */
async function refresh(env: PortfolioEnv, username: string): Promise<void> {
  try {
    const result = await build(env, username);
    if (result.portfolio && result.complete) await writeCache(username, result.portfolio);
  } catch {
    // 后台任务，没人在等它。
  }
}

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": status === 200 ? "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600" : "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

/**
 * 上游失败时把 GitHub 的状态码和配额计数带出来。
 *
 * 原来所有失败都塌成同一句「GitHub data is temporarily unavailable」，于是线上出问
 * 题时完全分不清是哪种失败，而它们的处置方式正好不一样：
 *   - tokenRejected = token 被 401 了（过期、撤销、粘错），等到天荒地老都不会好；
 *   - 403 + limit 60 = 走的是未认证配额（按机房 IP 共用）—— 要么没配 token，要么
 *     配了但被拒之后退回了未认证，靠 tokenRejected 区分这两种；
 *   - 403 + limit 5000 = token 生效了，是真的把认证配额用完了；
 *   - 0 = 请求没发出去（Headers 构造失败、网络层报错）。
 * `X-RateLimit-Limit` 是 GitHub 自己回的，这一个数字就能区分「配了 token」和
 * 「token 生效了」—— 这两件事不是一回事，我就是在这儿卡了两轮。都不是秘密。
 *
 * tokenConfigured 是第三个必要的信息：上面那些全是「GitHub 怎么看这个请求」，都
 * 无法区分「worker 里根本没有 token」和「有 token 但没起作用」。`wrangler secret
 * list` 说得出 secret 绑着，说不出**运行时 env 里到底有没有**，而这两件事真的会不
 * 一致。只报布尔值，不碰 token 本身。
 */
function unavailable(upstream: { status: number; limit?: string | null; remaining?: string | null; tokenRejected?: boolean; tokenConfigured?: boolean }): Response {
  return jsonResponse(
    {
      error: {
        code: "github_unavailable",
        message: "GitHub data is temporarily unavailable",
        upstreamStatus: upstream.status,
        tokenConfigured: Boolean(upstream.tokenConfigured),
        ...(upstream.tokenRejected ? { tokenRejected: true } : {}),
        ...(upstream.limit ? { rateLimit: { limit: Number(upstream.limit), remaining: Number(upstream.remaining ?? 0) } } : {}),
      },
    },
    502,
  );
}

export async function portfolioApi(env: PortfolioEnv, username: string, ctx: DeferredContext): Promise<Response> {
  if (!USERNAME_RE.test(username)) return jsonResponse({ error: { code: "invalid_username", message: "Invalid GitHub username" } }, 400);

  const cached = await readCache(username);
  if (cached) {
    if (Date.now() - cached.fetchedAt > FRESH_MS) ctx.waitUntil(refresh(env, username));
    return jsonResponse(cached.portfolio);
  }

  const tokenConfigured = Boolean(githubToken(env));
  try {
    const result = await build(env, username);
    if (!result.portfolio) {
      if (result.status === 404) return jsonResponse({ error: { code: "github_user_not_found", message: "GitHub user not found" } }, 404);
      return unavailable({ status: result.status, limit: result.limit, remaining: result.remaining, tokenRejected: result.tokenRejected, tokenConfigured });
    }
    // waitUntil 而不是 await：写缓存是给下一个访客的，这个访客没必要等。
    if (result.complete) ctx.waitUntil(writeCache(username, result.portfolio));
    return jsonResponse(result.portfolio);
  } catch (error) {
    console.error("portfolio_bff_failed", { username, error: String(error) });
    // 0 = 请求本身就没发出去（比如 Headers 构造失败、网络层报错），区别于上游给了状态码。
    return unavailable({ status: 0, tokenConfigured });
  }
}

import type { DeveloperPortfolio, PortfolioContribution } from "./portfolio.js";

/**
 * 贡献 feed 的数据整形。
 *
 * 这里全是纯函数,一个 React 依赖都没有 —— 因为这个 feed 的全部难点都在**排序和
 * 分组**上,而那是可以钉死的东西。渲染层只负责把结果画出来。
 *
 * ── 为什么不是纯时间流 ──────────────────────────────────────────────────────
 * 真实数据（50 条 external PR）的时间分布是这样的:
 *
 *   2026-03   8
 *   2026-04  32   ← 其中 17 条是同一个仓库（LawnchairLauncher/lawnchair）
 *   2026-05   2
 *   2026-08   1
 *   2026-09   7
 *
 * 按时间倒序平铺的结果是:开头 8 条 9 月的,然后连续掉进 32 条四月的块,里面十几条
 * 是同一个仓库的 `fix:` 标题。那读起来是 changelog,不是 feed。
 *
 * 更要紧的是,这份数据里有一条真实的转向 —— 前 42 条是 Android / launcher 内核
 * （lawnchair、platform_frameworks_libs_systemui、FossifyOrg/Clock…）,后 8 条是 AI
 * agent 基础设施（microsoft/mxc、google/artemis、huggingface/funes、NVIDIA-NeMo/
 * Switchyard…）。条数少但识别度高一个量级。平铺的话读者得自己去数月份才能看出来。
 *
 * 所以提供两种视图,让页面先讲「被哪些项目接受了」（仓库分组),再讲「节奏」（时间
 * 流）。两个都从同一份数据算,不存在哪个是"真相"的问题。
 */

/** merged 和 closed 是两件事:closed 没 merged = 提了但没被接受。 */
export type ContributionStatus = "merged" | "open" | "closed";

export function contributionStatus(item: PortfolioContribution): ContributionStatus {
  if (item.merged) return "merged";
  return item.state === "open" ? "open" : "closed";
}

export type RepositoryGroup = {
  /** "LawnchairLauncher/lawnchair" */
  repository: string;
  owner: string;
  name: string;
  /** 仓库主页。从 PR 链接反推,见 repositoryUrl。 */
  url: string;
  total: number;
  merged: number;
  open: number;
  /** 关了但没合 —— 提了没被接受。 */
  closed: number;
  /** 最早 / 最晚一条 PR 的创建日期（YYYY-MM-DD)。 */
  firstAt: string;
  lastAt: string;
  /** 这个仓库下的 PR,新的在前。 */
  items: PortfolioContribution[];
};

export type MonthBucket = {
  /** "2026-04" */
  month: string;
  items: PortfolioContribution[];
};

export type FeedSummary = {
  total: number;
  merged: number;
  open: number;
  closed: number;
  repositories: number;
  /** 最早 / 最晚（YYYY-MM-DD),没有数据时是 null。 */
  from: string | null;
  to: string | null;
};

/**
 * 从 PR 链接反推仓库主页。
 *
 * contributions[] 里没有仓库 URL —— 上游那条是 `repository_url`（api.github.com 的
 * 那种),已经在 BFF 里被拆成 "owner/name" 了。而 PR 的 html_url 一定是
 * https://github.com/<owner>/<name>/pull/<n>,所以砍掉 /pull/... 就是仓库页。
 *
 * 拿不到就退回 https://github.com/<repository> —— repository 本身就是 owner/name。
 */
export function repositoryUrl(item: PortfolioContribution): string {
  const match = item.url.match(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\/pull\/\d+/);
  return match ? match[1]! : `https://github.com/${item.repository}`;
}

/** 只要别人仓库里的。自己仓库里的 PR 不是"贡献"叙事的一部分。 */
export function externalContributions(portfolio: DeveloperPortfolio): PortfolioContribution[] {
  return portfolio.contributions.filter((item) => item.external);
}

/**
 * 取日期的年月,**按字符串切,不经过 Date**。
 *
 * createdAt 是 ISO UTC。`new Date(x).getMonth()` 用的是**本地时区**,于是一条
 * 2026-04-01T02:00:00Z 的 PR 对 UTC-5 的访客会落进 3 月 —— 同一个页面在不同时区
 * 的月份分组不一样,而且没有任何地方会报错。切字符串就没这个问题。
 */
function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** 新的在前。同一天的用 PR 号兜底,保证顺序是确定的（快照测试才有意义)。 */
function newestFirst(a: PortfolioContribution, b: PortfolioContribution): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.number - a.number;
}

/**
 * 按上游仓库分组,按分量排。
 *
 * 排序键的顺序是刻意的:**先 merged 数,再总数**。一个"提了 7 条合了 3 条"的仓库
 * 排在"提了 3 条合了 0 条"的前面 —— 被接受过比提得多更能说明问题。最后用最近活动
 * 时间兜底,再用仓库名保证确定性。
 */
export function groupByRepository(items: PortfolioContribution[]): RepositoryGroup[] {
  const groups = new Map<string, PortfolioContribution[]>();
  for (const item of items) {
    const bucket = groups.get(item.repository);
    if (bucket) bucket.push(item);
    else groups.set(item.repository, [item]);
  }

  return [...groups.entries()]
    .map(([repository, bucket]) => {
      // bucket 一定非空:它只在遇到第一条 item 时被创建。下面几个 `!` 都是这个原因。
      const sorted = [...bucket].sort(newestFirst);
      const days = bucket.map((item) => dayOf(item.createdAt)).sort();
      const [owner = repository, name = ""] = repository.split("/");
      return {
        repository,
        owner,
        name,
        url: repositoryUrl(sorted[0]!),
        total: bucket.length,
        merged: bucket.filter((item) => contributionStatus(item) === "merged").length,
        open: bucket.filter((item) => contributionStatus(item) === "open").length,
        closed: bucket.filter((item) => contributionStatus(item) === "closed").length,
        firstAt: days[0]!,
        lastAt: days[days.length - 1]!,
        items: sorted,
      } satisfies RepositoryGroup;
    })
    .sort(
      (a, b) =>
        b.merged - a.merged ||
        b.total - a.total ||
        Date.parse(b.lastAt) - Date.parse(a.lastAt) ||
        a.repository.localeCompare(b.repository),
    );
}

/**
 * 按月分桶,新的月份在前。
 *
 * 空月份**不补** —— 数据里 6、7 月是空的,而那个空白本身是真实信息（从 Android 转
 * 到 AI 基础设施之间的那段）。补成 0 会把它画成一条没有意义的零线；直接让两个月份
 * 标题挨在一起,读者自己就看见跳了。
 */
export function groupByMonth(items: PortfolioContribution[]): MonthBucket[] {
  const buckets = new Map<string, PortfolioContribution[]>();
  for (const item of items) {
    const key = monthOf(item.createdAt);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  return [...buckets.entries()]
    .map(([month, bucket]) => ({ month, items: [...bucket].sort(newestFirst) }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * 顶部那几个数字。
 *
 * closed（提了没被接受）照样算进去并显示出来:一个只显示 merged 的贡献页看起来就是
 * 精选,而"提了 50 个、合了 26 个、5 个被拒"才是真实的开源参与样貌。而且每条都能点
 * 回原 PR,藏也藏不住。
 */
export function feedSummary(items: PortfolioContribution[]): FeedSummary {
  const days = items.map((item) => dayOf(item.createdAt)).sort();
  return {
    total: items.length,
    merged: items.filter((item) => contributionStatus(item) === "merged").length,
    open: items.filter((item) => contributionStatus(item) === "open").length,
    closed: items.filter((item) => contributionStatus(item) === "closed").length,
    repositories: new Set(items.map((item) => item.repository)).size,
    from: days[0] ?? null,
    to: days[days.length - 1] ?? null,
  };
}

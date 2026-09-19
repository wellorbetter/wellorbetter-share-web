import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { icon } from "@wellorbetter/design";
import { contributionsPath, fetchPortfolio, portfolioPath } from "./portfolio.js";
import type { DeveloperPortfolio, PortfolioContribution } from "./portfolio.js";
import {
  contributionStatus,
  externalContributions,
  feedSummary,
  groupByMonth,
  groupByRepository,
} from "./contribution-feed.js";
import type { ContributionStatus, RepositoryGroup } from "./contribution-feed.js";
import { useThemeToggle } from "./theme.js";

/**
 * 开源贡献页。
 *
 * 作品集页（/portfolio/:username）里 PR 只是一个 section，最多 12 条，剩下的看不见。
 * 这一页只讲贡献，而且全都给:两个视图，一份数据 —— 先「被哪些项目接受了」（按上游
 * 仓库分组、按 merged 数排），再「什么节奏」（按月的时间流）。
 *
 * 排序和分组的规则全在 contribution-feed.ts,那边有测试。这个文件只管画。
 *
 * 复用 portfolio.css 的外壳（topbar / state / section / stats），因为它们是同一个
 * --lab-* 家族、同一种页面。别往这里引 --psa-* 或 --site-* —— presentation.css 开头
 * 那段注释解释了为什么串家族的 bug 是看不见的。
 */

type Locale = "zh" | "en";

const text = {
  zh: {
    back: "返回 wellorbetter",
    input: "输入 GitHub 用户名",
    build: "看贡献",
    loading: "正在读取公开 GitHub 数据…",
    failed: "这个贡献列表暂时读不出来",
    retry: "重试",
    portfolio: "完整 Portfolio",
    heroEyebrow: "OPEN SOURCE",
    heroTitle: "提给别人仓库的 Pull Request",
    heroSub: "全部来自公开 GitHub。每一条都能点回原始 PR —— 好看的和不好看的都在。",
    total: "上游 PR",
    merged: "已合并",
    open: "进行中",
    unmerged: "未合并",
    repositories: "上游仓库",
    span: "时间跨度",
    reposEyebrow: "WHERE",
    reposTitle: "被哪些项目接受了",
    reposSub: "按「合并数」排，不是按「提交数」—— 提得多不如被接受过。条形是这个仓库里已合并 / 进行中 / 未合并的比例。",
    timelineEyebrow: "WHEN",
    timelineTitle: "节奏",
    timelineSub: "按月倒序。空掉的月份不补零 —— 那段空白本身是真的。",
    statusMerged: "MERGED",
    statusOpen: "OPEN",
    statusClosed: "未合并",
    prCount: (n: number) => `${n} 条`,
    mergedCount: (n: number) => `合并 ${n}`,
    monthCount: (n: number) => `${n} 条`,
    empty: "这个账号在别人的仓库里还没有公开 PR",
    footer: "数据来自公开 GitHub · 服务端缓存 30 分钟",
  },
  en: {
    back: "Back to wellorbetter",
    input: "GitHub username",
    build: "Show work",
    loading: "Reading public GitHub data…",
    failed: "These contributions could not be loaded",
    retry: "Retry",
    portfolio: "Full portfolio",
    heroEyebrow: "OPEN SOURCE",
    heroTitle: "Pull requests sent to other people's repositories",
    heroSub: "All from public GitHub. Every row links back to the original PR — the flattering ones and the rest.",
    total: "Upstream PRs",
    merged: "Merged",
    open: "Open",
    unmerged: "Not merged",
    repositories: "Upstream repos",
    span: "Span",
    reposEyebrow: "WHERE",
    reposTitle: "Which projects accepted the work",
    reposSub: "Ranked by merged count, not by volume — being accepted says more than submitting a lot. The bar is merged / open / not merged within that repo.",
    timelineEyebrow: "WHEN",
    timelineTitle: "Rhythm",
    timelineSub: "Newest month first. Empty months are not padded with zeros — the gaps are real.",
    statusMerged: "MERGED",
    statusOpen: "OPEN",
    statusClosed: "NOT MERGED",
    prCount: (n: number) => `${n} PRs`,
    mergedCount: (n: number) => `${n} merged`,
    monthCount: (n: number) => `${n} PRs`,
    empty: "No public pull requests to other people's repositories yet",
    footer: "Public GitHub data · server-cached for 30 minutes",
  },
} as const;

const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-04" → "2026 年 4 月" / "Apr 2026"。
 *
 * 跟 contribution-feed.ts 里的 monthOf 一样**不经过 Date**:`new Date("2026-04")`
 * 按 UTC 解析但 getMonth() 按本地时区读，于是 UTC-5 的访客会看到标题写 3 月、里面
 * 装的是 4 月的 PR。切字符串就不会。
 */
function monthLabel(month: string, locale: Locale): string {
  const [year, mm] = month.split("-");
  const index = Number(mm) - 1;
  if (locale === "en") return `${MONTH_NAMES_EN[index] ?? mm} ${year}`;
  return `${year} 年 ${Number(mm)} 月`;
}

function statusLabel(status: ContributionStatus, locale: Locale): string {
  const t = text[locale];
  if (status === "merged") return t.statusMerged;
  return status === "open" ? t.statusOpen : t.statusClosed;
}

function PullRequestRow({ item, locale }: { item: PortfolioContribution; locale: Locale }) {
  const status = contributionStatus(item);
  return (
    <a className="feed-pr" href={item.url} target="_blank" rel="noreferrer">
      <div className="feed-pr-main">
        <div className="feed-pr-meta">
          <span className="feed-pr-repo">{item.repository}</span>
          <span>#{item.number}</span>
          <time dateTime={item.createdAt}>{item.createdAt.slice(0, 10)}</time>
        </div>
        <h3>{item.title}</h3>
      </div>
      <span className={`feed-status is-${status}`}>{statusLabel(status, locale)}</span>
    </a>
  );
}

function RepositoryRow({ group, locale, maxTotal }: { group: RepositoryGroup; locale: Locale; maxTotal: number }) {
  const t = text[locale];
  return (
    <a className="feed-repo" href={group.url} target="_blank" rel="noreferrer">
      <div className="feed-repo-name">
        <b>{group.name}</b>
        <span>{group.owner}</span>
      </div>
      {/* 条形有两层，因为它要同时说两件事:
          - 外层轨道满宽，内层 fill 的宽度 = 这个仓库的条数 / 最多的那个仓库，所以
            **长度是量**。第一版只有内层，于是提了 1 条的 microsoft/mxc 和提了 17 条的
            lawnchair 画出来一样长 —— 旁边的数字没说谎，但眼睛先看到的是条形。
          - fill 里面的分段用 flex-grow = 条数，所以**分段比例是构成**（合并/进行中/
            未合并）。count 为 0 的段不渲染，否则 min-width 会画出一条不存在的 3px。 */}
      <div className="feed-bar" aria-hidden="true">
        <div className="feed-bar-fill" style={{ width: `${(group.total / maxTotal) * 100}%` }}>
          {group.merged > 0 ? <i className="is-merged" style={{ flexGrow: group.merged }} /> : null}
          {group.open > 0 ? <i className="is-open" style={{ flexGrow: group.open }} /> : null}
          {group.closed > 0 ? <i className="is-closed" style={{ flexGrow: group.closed }} /> : null}
        </div>
      </div>
      {/* 这三个是 .feed-repo 的直接子元素而不是包在一个 div 里:行是 subgrid，各列的
          宽度由整个列表统一决定，所以它们在所有行里对齐。包起来就只有外层那一列对齐，
          里面的数字和日期还是每行自己排 —— 那是第一版看起来歪掉的原因。 */}
      <b className="feed-count-merged">{t.mergedCount(group.merged)}</b>
      <span className="feed-count-total">{t.prCount(group.total)}</span>
      <span className="feed-repo-span">
        {group.firstAt === group.lastAt ? group.firstAt : `${group.firstAt} → ${group.lastAt}`}
      </span>
      <span className="feed-arrow">↗</span>
    </a>
  );
}

export default function ContributionsPage({ username }: { username: string }) {
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem("wb_locale") === "en" ? "en" : "zh"));
  const { dark, toggle: toggleDark } = useThemeToggle();
  const [query, setQuery] = useState(username);
  const [portfolio, setPortfolio] = useState<DeveloperPortfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const t = text[locale];

  useEffect(() => {
    localStorage.setItem("wb_locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    const controller = new AbortController();
    setPortfolio(null);
    setError(null);
    fetchPortfolio(username, controller.signal)
      .then(setPortfolio)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [username, reloadKey]);

  const items = useMemo(() => (portfolio ? externalContributions(portfolio) : []), [portfolio]);
  const summary = useMemo(() => feedSummary(items), [items]);
  const repositories = useMemo(() => groupByRepository(items), [items]);
  const months = useMemo(() => groupByMonth(items), [items]);
  // 条形长度的分母。repositories 已经排过序，但排序键是合并数不是总数，所以最大值
  // 不一定在第一位 —— 得真的取 max。为 0 时用 1，避免除零（空数据那条分支不渲染
  // 这一节，但一个只在别处成立的前提不该写进算式里）。
  const maxTotal = useMemo(() => Math.max(1, ...repositories.map((group) => group.total)), [repositories]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    window.location.assign(contributionsPath(value));
  }

  return (
    <div className="portfolio-page contributions-page">
      <header className="portfolio-topbar">
        <a href="/" className="portfolio-brand">
          <span dangerouslySetInnerHTML={{ __html: icon("logo", 22) }} />
          <span>{t.back}</span>
        </a>
        <form className="portfolio-search" onSubmit={submit}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t.input} placeholder={t.input} />
          <button type="submit">{t.build}</button>
        </form>
        <div className="portfolio-top-actions">
          <a className="feed-portfolio-link" href={portfolioPath(username)}>{t.portfolio}</a>
          <button type="button" onClick={toggleDark} aria-label="theme" dangerouslySetInnerHTML={{ __html: icon(dark ? "sun" : "moon", 17) }} />
          <button type="button" onClick={() => setLocale((value) => (value === "zh" ? "en" : "zh"))}>{locale === "zh" ? "EN" : "中"}</button>
        </div>
      </header>

      {!portfolio && !error ? (
        <main className="portfolio-state"><span className="portfolio-loader" /> <p>{t.loading}</p></main>
      ) : error ? (
        <main className="portfolio-state portfolio-state--error">
          <h1>{t.failed}</h1>
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>{t.retry}</button>
        </main>
      ) : (
        <main className="portfolio-shell">
          <section className="feed-hero">
            <p className="feed-eyebrow">{t.heroEyebrow}</p>
            <h1>{t.heroTitle}</h1>
            <p className="feed-hero-sub">
              @{portfolio?.profile.login ?? username} · {t.heroSub}
            </p>
            <div className="portfolio-stats">
              {[
                { label: t.total, value: String(summary.total) },
                { label: t.merged, value: String(summary.merged) },
                { label: t.open, value: String(summary.open) },
                { label: t.unmerged, value: String(summary.closed) },
                { label: t.repositories, value: String(summary.repositories) },
                // 唯一一个不是数字的格子。28px 的数字字号装不下 "2026-03 → 2026-09"，
                // 窄屏上会折成两行还压住标签，所以单独给它一档小字号。
                {
                  label: t.span,
                  value: summary.from && summary.to ? `${summary.from.slice(0, 7)} → ${summary.to.slice(0, 7)}` : "—",
                  modifier: " is-range",
                },
              ].map(({ label, value, modifier }) => (
                <div className={`portfolio-stat${modifier ?? ""}`} key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>

          {items.length === 0 ? (
            <section className="portfolio-section"><p className="feed-empty">{t.empty}</p></section>
          ) : (
            <>
              <section className="portfolio-section">
                <div className="portfolio-section-heading">
                  <p>{t.reposEyebrow}</p>
                  <h2>{t.reposTitle}</h2>
                  <span>{t.reposSub}</span>
                </div>
                <div className="feed-repo-list">
                  {repositories.map((group) => (
                    <RepositoryRow group={group} locale={locale} maxTotal={maxTotal} key={group.repository} />
                  ))}
                </div>
              </section>

              <section className="portfolio-section">
                <div className="portfolio-section-heading">
                  <p>{t.timelineEyebrow}</p>
                  <h2>{t.timelineTitle}</h2>
                  <span>{t.timelineSub}</span>
                </div>
                <div className="feed-timeline">
                  {months.map((bucket) => (
                    <div className="feed-month" key={bucket.month}>
                      <div className="feed-month-head">
                        <h3>{monthLabel(bucket.month, locale)}</h3>
                        <span>{t.monthCount(bucket.items.length)}</span>
                      </div>
                      <div className="feed-pr-list">
                        {bucket.items.map((item) => (
                          <PullRequestRow item={item} locale={locale} key={`${item.repository}#${item.number}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <footer className="portfolio-footer">
            <span>{t.footer}</span>
            <form className="portfolio-footer-generator" onSubmit={submit}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.input} aria-label={t.input} />
              <button type="submit">{t.build} →</button>
            </form>
          </footer>
        </main>
      )}
    </div>
  );
}

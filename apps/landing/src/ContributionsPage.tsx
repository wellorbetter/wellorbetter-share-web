import { Fragment, useEffect, useMemo, useState } from "react";
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
import type { ContributionStatus } from "./contribution-feed.js";
import { useThemeToggle } from "./theme.js";

/**
 * 开源贡献页。
 *
 * 作品集页（/portfolio/:username）里 PR 只是一个 section，最多 12 条。这一页只讲贡献，
 * 而且全都给：一条单列的时间流。
 *
 * 排序和分组的规则全在 contribution-feed.ts，那边有测试。这个文件只管画。
 *
 * ── 为什么不复用 portfolio.css 的正文外壳 ──────────────────────────────────────
 * 第一版直接套了 .portfolio-shell / .portfolio-section / .portfolio-stats，结果很难看，
 * 原因是那套壳的尺寸是为**另一种内容**定的：
 *
 * - .portfolio-shell 是 1180px 宽。一个列表撑到 1180px，于是每行左边是仓库名、右边是
 *   状态，中间留出上千像素的空洞 —— 一张被拉到 27 寸屏上的电子表格。
 * - .portfolio-stats 是 3 列网格、每格 min-height 102px。六个数字于是变成六个巨大的
 *   空盒子，还折成两行，底部糊成一块灰板。
 * - .portfolio-section-heading 是 `120px | 1fr | 420px` 的 align-items:end 网格，为 52px
 *   的大标题设计。放一个小标题进去，eyebrow 就掉到标题左下角、描述被甩到右边一千多
 *   像素处，看起来像布局 bug。
 *
 * 所以正文自己开一个 760px 的阅读列。topbar 和 loading / error 态继续复用 —— 那两个
 * 本来就是页面级的壳，尺寸上没有冲突。
 *
 * 别往这里引 --psa-* 或 --site-*，presentation.css 开头那段注释解释了为什么串家族的
 * bug 是看不见的。
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
    repositories: "个上游仓库",
    statusMerged: "已合并",
    statusOpen: "进行中",
    statusClosed: "未合并",
    reposHint: "被接受得最多的排在前面（已合并 / 提交）",
    monthCount: (n: number) => `${n} 条`,
    overview: (merged: number, open: number, closed: number) =>
      `已合并 ${merged}、进行中 ${open}、未合并 ${closed}`,
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
    total: "upstream PRs",
    merged: "merged",
    open: "open",
    unmerged: "not merged",
    repositories: "upstream repos",
    statusMerged: "MERGED",
    statusOpen: "OPEN",
    // 不是 "NOT MERGED":状态是 meta 行的第一个词，靠 min-width:5em 对成一列，而
    // "NOT MERGED" 有 10 个字符会撑破那个宽度，让那几行的仓库名单独往右挪。
    statusClosed: "UNMERGED",
    reposHint: "Most-accepted first (merged / submitted)",
    monthCount: (n: number) => `${n} PRs`,
    overview: (merged: number, open: number, closed: number) =>
      `${merged} merged, ${open} open, ${closed} not merged`,
    empty: "No public pull requests to other people's repositories yet",
    footer: "Public GitHub data · server-cached for 30 minutes",
  },
} as const;

const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-04" → "2026 年 4 月" / "Apr 2026"。
 *
 * 跟 contribution-feed.ts 里的 monthOf 一样**不经过 Date**：`new Date("2026-04")`
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

function FeedItem({ item, locale }: { item: PortfolioContribution; locale: Locale }) {
  const status = contributionStatus(item);
  return (
    // 状态既是 rail 上那个点的颜色（is-merged / is-open / is-closed），也是 meta 行里
    // 的一个词。只靠颜色编码对色盲不成立，只靠词就失去了扫一眼看出节奏的能力。
    <a className={`feed-item is-${status}`} href={item.url} target="_blank" rel="noreferrer">
      <p className="feed-item-meta">
        {/* 状态在最前面，不在行尾。理由写在 contributions.css 的 .feed-item-status 上：
            顶到行尾就又是一段空洞，而这里放着能和 rail 上那个点对成一列。 */}
        <span className="feed-item-status">{statusLabel(status, locale)}</span>
        <span className="feed-item-repo">{item.repository}</span>
        <span>#{item.number}</span>
        {/* 只到「月-日」。年份由上面的月份分隔器给，重复一遍只是噪音。 */}
        <time dateTime={item.createdAt}>{item.createdAt.slice(5, 10)}</time>
      </p>
      <h3>{item.title}</h3>
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
        <main className="feed-shell">
          <section className="feed-hero">
            <p className="feed-eyebrow">{t.heroEyebrow}</p>
            <h1>{t.heroTitle}</h1>
            <p className="feed-hero-sub">@{portfolio?.profile.login ?? username} · {t.heroSub}</p>

            {items.length > 0 ? (
              <>
                {/* 六个数字排成一行，不是六个盒子。第一版用 .portfolio-stats 的 3 列
                    网格，每格 102px 高装一个两位数 —— 九成是空纸。
                    每个数字连同它的标签包在一个 span 里，因为它们必须是同一个 flex
                    item：分开的话窄屏上会断在中间，"18" 留在行尾、"个上游仓库" 掉到
                    下一行开头。 */}
                <p className="feed-summary">
                  <span><b>{summary.total}</b> {t.total}</span>
                  <span><b>{summary.merged}</b> {t.merged}</span>
                  <span><b>{summary.open}</b> {t.open}</span>
                  <span><b>{summary.closed}</b> {t.unmerged}</span>
                  <span><b>{summary.repositories}</b> {t.repositories}</span>
                  {summary.from && summary.to ? (
                    <em>{summary.from.slice(0, 7)} → {summary.to.slice(0, 7)}</em>
                  ) : null}
                </p>

                {/* 全站唯一一条比例条。之前每个仓库一条（18 条），那是排行榜的画法；
                    这里只需要一眼看出三类的盘子有多大，所以一条就够。 */}
                <div
                  className="feed-overview"
                  role="img"
                  aria-label={t.overview(summary.merged, summary.open, summary.closed)}
                >
                  {summary.merged > 0 ? <i className="is-merged" style={{ flexGrow: summary.merged }} /> : null}
                  {summary.open > 0 ? <i className="is-open" style={{ flexGrow: summary.open }} /> : null}
                  {summary.closed > 0 ? <i className="is-closed" style={{ flexGrow: summary.closed }} /> : null}
                </div>

                {/* 仓库从 18 行表格压成一行会换行的小药丸。「被哪些项目接受了」这个信息
                    值得留，但它不该占掉半屏、也不该抢在时间流前面当主角。 */}
                <div className="feed-repos">
                  {repositories.map((group) => (
                    <a
                      className={`feed-repo-pill${group.merged === 0 ? " is-none" : ""}`}
                      href={group.url}
                      target="_blank"
                      rel="noreferrer"
                      title={group.repository}
                      key={group.repository}
                    >
                      <span>{group.name}</span>
                      <b>{group.merged}/{group.total}</b>
                    </a>
                  ))}
                </div>
                <p className="feed-repos-hint">{t.reposHint}</p>
              </>
            ) : null}
          </section>

          {items.length === 0 ? (
            <p className="feed-empty">{t.empty}</p>
          ) : (
            <section className="feed-stream">
              {months.map((bucket) => (
                <Fragment key={bucket.month}>
                  <h2 className="feed-month">
                    <span>{monthLabel(bucket.month, locale)}</span>
                    <i>{t.monthCount(bucket.items.length)}</i>
                  </h2>
                  {bucket.items.map((item) => (
                    <FeedItem item={item} locale={locale} key={`${item.repository}#${item.number}`} />
                  ))}
                </Fragment>
              ))}
            </section>
          )}

          <footer className="feed-footer">
            <span>{t.footer}</span>
            <form onSubmit={submit}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.input} aria-label={t.input} />
              <button type="submit">{t.build} →</button>
            </form>
          </footer>
        </main>
      )}
    </div>
  );
}

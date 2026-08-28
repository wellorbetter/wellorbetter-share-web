import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { icon } from "@wellorbetter/design";
import { fetchPortfolio, portfolioPath } from "./portfolio.js";
import type { DeveloperPortfolio, PortfolioContribution } from "./portfolio.js";

type Locale = "zh" | "en";

type EngineeringStory = {
  project: string;
  title: string;
  status: string;
  url: string;
  problem: string;
  root: string;
  fix: string;
  tags: string[];
};

const text = {
  zh: {
    back: "返回 wellorbetter",
    input: "输入 GitHub 用户名",
    build: "生成 Portfolio",
    loading: "正在读取公开 GitHub 数据…",
    failed: "这个 Portfolio 暂时生成失败",
    retry: "重试",
    recruiter: "求职视图",
    full: "完整视图",
    recruiterHint: "只保留招聘者最值得看的工程证据",
    projects: "代表项目",
    projectsSub: "按公开原创仓库的 stars 与最近活跃度排序；求职视图只保留前 6 个。",
    oss: "Open Source Contributions",
    ossSub: "优先展示提交到别人仓库的 PR。Merged 是强证据，Open/Closed 也如实保留。",
    activity: "GitHub Activity",
    activitySub: "来自 GitHub 官方 ContributionsCollection 的真实贡献轨迹，不用前端伪造绿色方块。",
    activityUnavailable: "当前快照没有 GraphQL Activity；项目和 PR 仍来自公开 GitHub 数据。",
    totalActivity: "贡献",
    commits: "Commits",
    issues: "Issues",
    reviews: "Reviews",
    activeRepos: "活跃仓库",
    privateCount: "GitHub 公开的私有贡献计数",
    stories: "Engineering Stories",
    storiesSub: "不只看 PR 标题：问题是什么、根因在哪里、最后怎样验证。",
    problem: "问题",
    root: "根因",
    fix: "修复 / 验证",
    languages: "主要技术栈",
    publicRepos: "公开仓库",
    sourceRepos: "原创仓库",
    stars: "累计 Stars",
    followers: "Followers",
    prs: "Pull Requests",
    external: "外部 PR",
    mergedExternal: "Merged 外部 PR",
    merged: "MERGED",
    open: "OPEN",
    closed: "CLOSED",
    own: "OWN REPO",
    upstream: "UPSTREAM",
    empty: "暂无可展示数据",
    github: "GitHub Profile",
    generated: "数据来自公开 GitHub · 服务端缓存 30 分钟",
  },
  en: {
    back: "Back to wellorbetter",
    input: "GitHub username",
    build: "Build portfolio",
    loading: "Reading public GitHub data…",
    failed: "This portfolio could not be generated",
    retry: "Retry",
    recruiter: "Recruiter view",
    full: "Full view",
    recruiterHint: "Keep the strongest engineering evidence in view",
    projects: "Selected projects",
    projectsSub: "Ranked from public source repositories by stars and recent activity; recruiter view keeps the top six.",
    oss: "Open Source Contributions",
    ossSub: "Upstream pull requests are shown first. Merged work is strong evidence, while open/closed collaboration stays truthful.",
    activity: "GitHub Activity",
    activitySub: "A real contribution trail from GitHub ContributionsCollection rather than decorative frontend squares.",
    activityUnavailable: "GraphQL activity is unavailable in this snapshot; projects and PRs are still verified from public GitHub data.",
    totalActivity: "Contributions",
    commits: "Commits",
    issues: "Issues",
    reviews: "Reviews",
    activeRepos: "Active repos",
    privateCount: "Private contribution count shared by GitHub",
    stories: "Engineering Stories",
    storiesSub: "More than PR titles: the failure, the root cause, and how the fix was validated.",
    problem: "Problem",
    root: "Root cause",
    fix: "Fix / evidence",
    languages: "Primary stack",
    publicRepos: "Public repos",
    sourceRepos: "Source repos",
    stars: "Total stars",
    followers: "Followers",
    prs: "Pull requests",
    external: "Upstream PRs",
    mergedExternal: "Merged upstream",
    merged: "MERGED",
    open: "OPEN",
    closed: "CLOSED",
    own: "OWN REPO",
    upstream: "UPSTREAM",
    empty: "No public data to show yet",
    github: "GitHub Profile",
    generated: "Public GitHub data · server-cached for 30 minutes",
  },
} as const;

const engineeringStories: Record<Locale, EngineeringStory[]> = {
  zh: [
    {
      project: "sinelaw/fresh",
      title: "Windows IME 多字节 UTF-8 输入被静默丢弃",
      status: "MERGED · #1541",
      url: "https://github.com/sinelaw/fresh/pull/1541",
      problem: "Windows 11 下中文、日韩文和 emoji 的键盘输入进入终端编辑器后消失，但粘贴正常。",
      root: "Win32 输入层已经拿到 Unicode；真正丢数据的是 parser：它只处理 ESC 序列和单字节 ASCII，多字节 UTF-8 直接落到 Invalid。",
      fix: "补齐 2/3/4-byte UTF-8 解码和跨 batch 缓冲，覆盖非法 continuation 与 overlong encoding；新增 8 个单测并完成 Windows IME 实机验证。",
      tags: ["Rust", "Windows", "UTF-8", "Parser", "Testing"],
    },
    {
      project: "LawnchairLauncher/lawnchair",
      title: "把 Cromite 接进 Launcher Quick Search Bar",
      status: "MERGED · #6558",
      url: "https://github.com/LawnchairLauncher/lawnchair/pull/6558",
      problem: "使用 Cromite 的 Android 用户无法把它选成 Lawnchair 搜索栏 Provider。",
      root: "QSB provider registry、Activity 跳转与 themed icon / 未安装 fallback 都没有 Cromite 对应实现。",
      fix: "沿用 Launcher 既有 browser-provider 约束接入 Cromite SearchActivity、图标与 fallback，并按上游测试流程验证后合并。",
      tags: ["Android", "Kotlin", "Launcher", "Integration"],
    },
    {
      project: "NVIDIA-NeMo/Switchyard",
      title: "Codex launcher 在 native Windows 启动前连续踩中平台差异",
      status: "CLOSED UPSTREAM PR · #441",
      url: "https://github.com/NVIDIA-NeMo/Switchyard/pull/441",
      problem: "官方 Windows wheel 可以安装，但 `switchyard launch codex` 在 Codex 真正启动之前就失败。",
      root: "不是一个 bug：Unix-only fcntl/pty import、npm POSIX shim、cp936 catalog 解码、loopback 被系统代理截获连续形成四个确定性 blocker。",
      fix: "拆分 POSIX/Windows console path，解析 `codex.cmd`，统一 UTF-8，并补 localhost proxy bypass；focused tests 7 passed，最后用 native Codex + OpenAI-compatible backend 做端到端 smoke。PR 未合并状态也保留，不包装成成功案例。",
      tags: ["Python", "Windows", "Codex", "Process", "Networking"],
    },
  ],
  en: [
    {
      project: "sinelaw/fresh",
      title: "Multi-byte UTF-8 input disappeared on Windows IME",
      status: "MERGED · #1541",
      url: "https://github.com/sinelaw/fresh/pull/1541",
      problem: "Chinese, CJK and emoji keyboard input vanished in the terminal editor on Windows 11 while paste remained fine.",
      root: "The Win32 input layer already delivered Unicode. The parser only handled ESC sequences and single-byte ASCII, so multi-byte UTF-8 fell through as Invalid.",
      fix: "Added 2/3/4-byte decoding and cross-batch buffering, covered invalid continuation and overlong encodings, added eight tests, and manually verified Windows IME input.",
      tags: ["Rust", "Windows", "UTF-8", "Parser", "Testing"],
    },
    {
      project: "LawnchairLauncher/lawnchair",
      title: "Integrated Cromite into the Launcher quick-search provider system",
      status: "MERGED · #6558",
      url: "https://github.com/LawnchairLauncher/lawnchair/pull/6558",
      problem: "Android users on Cromite could not select it as a Lawnchair QSB provider.",
      root: "The provider registry, activity routing, themed assets and not-installed fallback had no Cromite implementation.",
      fix: "Followed the existing browser-provider contract, wired Cromite SearchActivity, icons and fallback behavior, then validated with the upstream test flow before merge.",
      tags: ["Android", "Kotlin", "Launcher", "Integration"],
    },
    {
      project: "NVIDIA-NeMo/Switchyard",
      title: "Native Windows Codex launch exposed four platform blockers in sequence",
      status: "CLOSED UPSTREAM PR · #441",
      url: "https://github.com/NVIDIA-NeMo/Switchyard/pull/441",
      problem: "The official Windows wheel installed, but `switchyard launch codex` failed before Codex could actually start.",
      root: "It was a chain: Unix-only fcntl/pty imports, an npm POSIX shim, cp936 catalog decoding, then loopback traffic intercepted by a system proxy.",
      fix: "Separated POSIX/Windows console paths, resolved `codex.cmd`, forced UTF-8, added localhost proxy bypass, passed seven focused tests, and completed an end-to-end native Codex smoke. The PR is explicitly shown as closed, not misrepresented as merged.",
      tags: ["Python", "Windows", "Codex", "Process", "Networking"],
    },
  ],
};

function ContributionRow({ item, locale }: { item: PortfolioContribution; locale: Locale }) {
  const t = text[locale];
  const status = item.merged ? t.merged : item.state === "open" ? t.open : t.closed;
  return (
    <a className="portfolio-contribution" href={item.url} target="_blank" rel="noreferrer">
      <div className="portfolio-contribution-main">
        <div className="portfolio-contribution-meta">
          <span className={`contribution-scope${item.external ? " is-upstream" : ""}`}>{item.external ? t.upstream : t.own}</span>
          <span>{item.repository}</span>
          <span>#{item.number}</span>
        </div>
        <h3>{item.title}</h3>
      </div>
      <span className={`contribution-status ${item.merged ? "is-merged" : item.state === "open" ? "is-open" : ""}`}>{status}</span>
    </a>
  );
}

function Calendar({ portfolio }: { portfolio: DeveloperPortfolio }) {
  const activity = portfolio.activity;
  if (!activity) return null;
  return (
    <div className="portfolio-calendar-wrap">
      <div className="portfolio-calendar" aria-label="GitHub contribution calendar">
        {activity.calendar.map((day, index) => {
          const style = {
            gridColumnStart: Math.floor(index / 7) + 1,
            gridRowStart: new Date(`${day.date}T00:00:00Z`).getUTCDay() + 1,
          } satisfies CSSProperties;
          const level = day.level.toLowerCase().replaceAll("_", "-");
          return <span key={day.date} className={`portfolio-day level-${level}`} style={style} title={`${day.date}: ${day.count}`} />;
        })}
      </div>
      <div className="portfolio-calendar-legend" aria-hidden="true">
        <span>Less</span><i className="level-none" /><i className="level-first-quartile" /><i className="level-second-quartile" /><i className="level-third-quartile" /><i className="level-fourth-quartile" /><span>More</span>
      </div>
    </div>
  );
}

export default function PortfolioPage({ username }: { username: string }) {
  const [locale, setLocale] = useState<Locale>(() => localStorage.getItem("wb_locale") === "en" ? "en" : "zh");
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("wb_dark");
    if (saved === "1") return true;
    if (saved === "0") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [recruiterMode, setRecruiterMode] = useState(() => new URLSearchParams(window.location.search).get("view") === "recruiter");
  const [query, setQuery] = useState(username);
  const [portfolio, setPortfolio] = useState<DeveloperPortfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const t = text[locale];

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("wb_dark", dark ? "1" : "0");
  }, [dark]);

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

  const upstream = useMemo(() => portfolio?.contributions.filter((item) => item.external) ?? [], [portfolio]);
  const own = useMemo(() => portfolio?.contributions.filter((item) => !item.external) ?? [], [portfolio]);
  const contributions = useMemo(() => {
    if (recruiterMode) return upstream.slice(0, 12);
    return upstream.length > 0 ? [...upstream, ...own.slice(0, 12)] : own;
  }, [own, recruiterMode, upstream]);
  const projects = recruiterMode ? portfolio?.projects.slice(0, 6) ?? [] : portfolio?.projects ?? [];
  const isWellorbetter = username.toLowerCase() === "wellorbetter";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    window.location.assign(portfolioPath(value));
  }

  function toggleRecruiter() {
    setRecruiterMode((value) => {
      const next = !value;
      const url = new URL(window.location.href);
      if (next) url.searchParams.set("view", "recruiter");
      else url.searchParams.delete("view");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      return next;
    });
  }

  return (
    <div className={`portfolio-page${recruiterMode ? " is-recruiter" : ""}`}>
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
          <button type="button" className={`portfolio-recruiter-toggle${recruiterMode ? " is-active" : ""}`} onClick={toggleRecruiter} title={t.recruiterHint}>{recruiterMode ? t.full : t.recruiter}</button>
          <button type="button" onClick={() => setDark((value) => !value)} aria-label="theme" dangerouslySetInnerHTML={{ __html: icon(dark ? "sun" : "moon", 17) }} />
          <button type="button" onClick={() => setLocale((value) => value === "zh" ? "en" : "zh")}>{locale === "zh" ? "EN" : "中"}</button>
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
      ) : portfolio ? (
        <main className="portfolio-shell">
          <section className="portfolio-hero">
            <div className="portfolio-person">
              <img src={portfolio.profile.avatarUrl} alt="" />
              <div>
                <div className="portfolio-handle-row">
                  <p className="portfolio-handle">@{portfolio.profile.login}</p>
                  {recruiterMode ? <span className="portfolio-recruiter-badge">RECRUITER VIEW</span> : null}
                </div>
                <h1>{portfolio.profile.name ?? portfolio.profile.login}</h1>
                {portfolio.profile.bio ? <p className="portfolio-bio">{portfolio.profile.bio}</p> : null}
                <div className="portfolio-profile-links">
                  {portfolio.profile.location ? <span>{portfolio.profile.location}</span> : null}
                  {portfolio.profile.company ? <span>{portfolio.profile.company}</span> : null}
                  {portfolio.profile.website ? <a href={portfolio.profile.website} target="_blank" rel="noreferrer">Website ↗</a> : null}
                  <a href={portfolio.profile.githubUrl} target="_blank" rel="noreferrer">{t.github} ↗</a>
                </div>
              </div>
            </div>
            <div className="portfolio-stats">
              {[
                [t.publicRepos, portfolio.stats.publicRepos],
                [t.sourceRepos, portfolio.stats.sourceRepos],
                [t.stars, portfolio.stats.stars],
                [t.followers, portfolio.stats.followers],
                [t.external, portfolio.stats.externalPullRequests],
                [t.mergedExternal, portfolio.stats.externalMergedPullRequests],
              ].map(([label, value]) => (
                <div className="portfolio-stat" key={String(label)}><strong>{value}</strong><span>{label}</span></div>
              ))}
            </div>
          </section>

          <section className="portfolio-section portfolio-stack-section">
            <div className="portfolio-section-heading"><p>STACK</p><h2>{t.languages}</h2></div>
            <div className="portfolio-language-list">
              {portfolio.languages.length ? portfolio.languages.map((language) => (
                <span key={language.name}><b>{language.name}</b><small>{language.repos} repos</small></span>
              )) : <p>{t.empty}</p>}
            </div>
          </section>

          <section className="portfolio-section">
            <div className="portfolio-section-heading"><p>BUILD</p><h2>{t.projects}</h2><span>{t.projectsSub}</span></div>
            <div className="portfolio-project-grid">
              {projects.length ? projects.map((project) => (
                <a className="portfolio-project" href={project.url} target="_blank" rel="noreferrer" key={project.fullName}>
                  <div className="portfolio-project-head">
                    <span>{project.language ?? "Project"}</span>
                    <span>↗</span>
                  </div>
                  <h3>{project.name}</h3>
                  <p>{project.description ?? project.fullName}</p>
                  <div className="portfolio-project-footer">
                    <span>★ {project.stars}</span><span>⑂ {project.forks}</span><span>{project.license ?? "Open source"}</span>
                  </div>
                </a>
              )) : <p>{t.empty}</p>}
            </div>
          </section>

          {isWellorbetter ? (
            <section className="portfolio-section portfolio-stories-section">
              <div className="portfolio-section-heading"><p>DEBUG / DESIGN / SHIP</p><h2>{t.stories}</h2><span>{t.storiesSub}</span></div>
              <div className="portfolio-story-list">
                {engineeringStories[locale].map((story, index) => (
                  <a className="portfolio-story" href={story.url} target="_blank" rel="noreferrer" key={story.url}>
                    <div className="portfolio-story-index">0{index + 1}</div>
                    <div className="portfolio-story-main">
                      <div className="portfolio-story-meta"><span>{story.project}</span><b>{story.status}</b></div>
                      <h3>{story.title}</h3>
                      <div className="portfolio-story-flow">
                        <div><span>{t.problem}</span><p>{story.problem}</p></div>
                        <div><span>{t.root}</span><p>{story.root}</p></div>
                        <div><span>{t.fix}</span><p>{story.fix}</p></div>
                      </div>
                      <div className="portfolio-story-tags">{story.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                    </div>
                    <span className="portfolio-story-arrow">↗</span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section className="portfolio-section portfolio-activity-section">
            <div className="portfolio-section-heading"><p>ACTIVITY</p><h2>{t.activity}</h2><span>{t.activitySub}</span></div>
            {portfolio.activity ? (
              <>
                <div className="portfolio-activity-stats">
                  {[
                    [t.totalActivity, portfolio.activity.totalContributions],
                    [t.commits, portfolio.activity.commits],
                    [t.issues, portfolio.activity.issues],
                    [t.prs, portfolio.activity.pullRequests],
                    [t.reviews, portfolio.activity.reviews],
                    [t.activeRepos, portfolio.activity.repositories.commits],
                  ].map(([label, value]) => <div key={String(label)}><strong>{value}</strong><span>{label}</span></div>)}
                </div>
                <Calendar portfolio={portfolio} />
                {portfolio.activity.restrictedContributions > 0 ? <p className="portfolio-private-count">+ {portfolio.activity.restrictedContributions} {t.privateCount}</p> : null}
                {!recruiterMode && portfolio.activity.topCommitRepositories.length ? (
                  <div className="portfolio-active-repos">
                    {portfolio.activity.topCommitRepositories.map((repo) => <a href={repo.url} target="_blank" rel="noreferrer" key={repo.repository}><span>{repo.repository}</span><b>{repo.commits} commits</b></a>)}
                  </div>
                ) : null}
              </>
            ) : <div className="portfolio-activity-unavailable">{t.activityUnavailable}</div>}
          </section>

          <section className="portfolio-section portfolio-oss-section">
            <div className="portfolio-section-heading"><p>CONTRIBUTE</p><h2>{t.oss}</h2><span>{t.ossSub}</span></div>
            <div className="portfolio-contributions">
              {contributions.length ? contributions.map((item) => <ContributionRow item={item} locale={locale} key={`${item.repository}-${item.number}`} />) : <p>{t.empty}</p>}
            </div>
          </section>

          <footer className="portfolio-footer">
            <span>{t.generated}</span>
            <form className="portfolio-footer-generator" onSubmit={submit}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.input} aria-label={t.input} />
              <button type="submit">{t.build} →</button>
            </form>
          </footer>
        </main>
      ) : null}
    </div>
  );
}

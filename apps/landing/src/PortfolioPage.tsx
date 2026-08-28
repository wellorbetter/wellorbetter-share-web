import { FormEvent, useEffect, useMemo, useState } from "react";
import { icon } from "@wellorbetter/design";
import { fetchPortfolio, portfolioPath } from "./portfolio.js";
import type { DeveloperPortfolio, PortfolioContribution } from "./portfolio.js";

type Locale = "zh" | "en";

const text = {
  zh: {
    back: "返回 wellorbetter",
    input: "输入 GitHub 用户名",
    build: "生成 Portfolio",
    loading: "正在读取公开 GitHub 数据…",
    failed: "这个 Portfolio 暂时生成失败",
    retry: "重试",
    projects: "代表项目",
    projectsSub: "按公开仓库的 stars 与最近活跃度排序。",
    oss: "Open Source Contributions",
    ossSub: "优先展示提交到别人仓库的 PR。Merged 是最强证据，但开放中的真实协作同样有价值。",
    languages: "主要技术栈",
    publicRepos: "公开仓库",
    sourceRepos: "原创仓库",
    stars: "累计 Stars",
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
    generated: "数据来自公开 GitHub · 30 分钟缓存",
  },
  en: {
    back: "Back to wellorbetter",
    input: "GitHub username",
    build: "Build portfolio",
    loading: "Reading public GitHub data…",
    failed: "This portfolio could not be generated",
    retry: "Retry",
    projects: "Selected projects",
    projectsSub: "Ranked from public source repositories by stars and recent activity.",
    oss: "Open Source Contributions",
    ossSub: "Upstream pull requests are shown first. Merged work is strongest evidence, while active collaboration still matters.",
    languages: "Primary stack",
    publicRepos: "Public repos",
    sourceRepos: "Source repos",
    stars: "Total stars",
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
    generated: "Public GitHub data · cached for 30 minutes",
  },
} as const;

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

export default function PortfolioPage({ username }: { username: string }) {
  const [locale, setLocale] = useState<Locale>(() => localStorage.getItem("wb_locale") === "en" ? "en" : "zh");
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("wb_dark");
    if (saved === "1") return true;
    if (saved === "0") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
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
  const contributions = upstream.length > 0 ? [...upstream, ...own.slice(0, 8)] : own;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    window.location.assign(portfolioPath(value));
  }

  return (
    <div className="portfolio-page">
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
                <p className="portfolio-handle">@{portfolio.profile.login}</p>
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
                [t.prs, portfolio.stats.pullRequests],
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
              {portfolio.projects.length ? portfolio.projects.map((project) => (
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

import type { CSSProperties, ReactNode } from "react";
import type { DeveloperPortfolio, PortfolioContribution, PortfolioProject } from "./portfolio.js";
import type { SiteGeneration, SiteSectionType, SiteSpec } from "./site-spec.js";

type Props = {
  generation: SiteGeneration;
  spec?: SiteSpec;
  studio?: boolean;
};

const copy = {
  en: { source: "View source", live: "Live", stars: "stars", merged: "MERGED", open: "OPEN", closed: "CLOSED", profile: "GitHub profile", website: "Website", activityFallback: "Activity details become richer when the server has GitHub GraphQL access.", contributions: "contributions", commits: "commits", issues: "issues", reviews: "reviews", repos: "repos", built: "Generated from public GitHub evidence" },
  zh: { source: "查看源码", live: "在线", stars: "stars", merged: "已合并", open: "进行中", closed: "已关闭", profile: "GitHub 主页", website: "个人网站", activityFallback: "服务端配置 GitHub GraphQL 后会展示更完整的活动信息。", contributions: "贡献", commits: "commits", issues: "issues", reviews: "reviews", repos: "仓库", built: "根据公开 GitHub 证据自动生成" },
} as const;

function projectByName(portfolio: DeveloperPortfolio, fullName: string): PortfolioProject | undefined { return portfolio.projects.find((item) => item.fullName === fullName); }
function contributionByKey(portfolio: DeveloperPortfolio, key: string): PortfolioContribution | undefined { return portfolio.contributions.find((item) => `${item.repository}#${item.number}` === key); }
function status(item: PortfolioContribution, locale: SiteSpec["locale"]): string { const t = copy[locale]; return item.merged ? t.merged : item.state === "open" ? t.open : t.closed; }

function SectionShell({ id, eyebrow, title, subtitle, children }: { id: string; eyebrow: string; title: string; subtitle?: string; children: ReactNode }) {
  return <section id={id} className="generated-section"><div className="generated-section-heading"><span>{eyebrow}</span><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div></div>{children}</section>;
}

function Hero({ spec, portfolio }: { spec: SiteSpec; portfolio: DeveloperPortfolio }) {
  const t = copy[spec.locale];
  const stats = [[portfolio.stats.sourceRepos, spec.locale === "zh" ? "原创仓库" : "source repos"], [portfolio.stats.stars, spec.locale === "zh" ? "累计 stars" : "total stars"], [portfolio.stats.externalMergedPullRequests, spec.locale === "zh" ? "merged 外部 PR" : "merged upstream"]] as const;
  return <section id="hero" className="generated-hero"><div className="generated-hero-copy"><div className="generated-eyebrow"><i />{spec.identity.eyebrow}</div><h1>{spec.identity.headline}</h1><p>{spec.identity.summary}</p><div className="generated-actions"><a className="generated-primary" href={portfolio.profile.githubUrl} target="_blank" rel="noreferrer">{t.profile} ↗</a>{portfolio.profile.website ? <a className="generated-secondary" href={portfolio.profile.website} target="_blank" rel="noreferrer">{t.website} ↗</a> : null}</div></div><aside className="generated-person-card"><img src={portfolio.profile.avatarUrl} alt="" /><div className="generated-person-head"><div><strong>{spec.identity.displayName}</strong><span>@{portfolio.profile.login}</span></div><em>{spec.identity.role}</em></div><div className="generated-stat-grid">{stats.map(([value, label]) => <div key={String(label)}><strong>{value}</strong><span>{label}</span></div>)}</div><div className="generated-person-meta">{portfolio.profile.location ? <span>⌖ {portfolio.profile.location}</span> : null}{portfolio.profile.company ? <span>◫ {portfolio.profile.company}</span> : null}</div></aside></section>;
}

function Projects({ spec, portfolio, title, subtitle }: { spec: SiteSpec; portfolio: DeveloperPortfolio; title: string; subtitle?: string }) {
  const t = copy[spec.locale];
  return <SectionShell id="projects" eyebrow="01 / BUILD" title={title} subtitle={subtitle}><div className="generated-project-grid">{spec.projects.map((entry) => { const project = projectByName(portfolio, entry.fullName); if (!project) return null; return <article className={`generated-project-card is-${entry.emphasis}`} key={entry.fullName}><div className="generated-project-top"><span>{project.language ?? "PROJECT"}</span><a href={project.url} target="_blank" rel="noreferrer">↗</a></div><div className="generated-project-body"><h3>{entry.title}</h3><p>{entry.summary}</p><div className="generated-tags">{entry.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="generated-project-foot"><span>★ {project.stars} {t.stars}</span><span>⑂ {project.forks}</span>{project.homepage ? <a href={project.homepage} target="_blank" rel="noreferrer">{t.live} ↗</a> : <a href={project.url} target="_blank" rel="noreferrer">{t.source} ↗</a>}</div></article>; })}</div></SectionShell>;
}

function Contributions({ spec, portfolio, title, subtitle }: { spec: SiteSpec; portfolio: DeveloperPortfolio; title: string; subtitle?: string }) {
  return <SectionShell id="contributions" eyebrow="02 / CONTRIBUTE" title={title} subtitle={subtitle}><div className="generated-contribution-list">{spec.contributions.map((entry) => { const item = contributionByKey(portfolio, entry.key); if (!item) return null; return <a href={item.url} target="_blank" rel="noreferrer" className="generated-contribution" key={entry.key}><div><div className="generated-contribution-meta"><span>{item.repository}</span><span>#{item.number}</span><b className={item.merged ? "is-merged" : item.state === "open" ? "is-open" : ""}>{status(item, spec.locale)}</b></div><h3>{entry.headline}</h3><p>{entry.whyItMatters}</p></div><span className="generated-contribution-arrow">↗</span></a>; })}</div></SectionShell>;
}

function Activity({ spec, portfolio, title, subtitle }: { spec: SiteSpec; portfolio: DeveloperPortfolio; title: string; subtitle?: string }) {
  const t = copy[spec.locale]; const activity = portfolio.activity;
  return <SectionShell id="activity" eyebrow="03 / ACTIVITY" title={title} subtitle={subtitle}>{activity ? <div className="generated-activity-card"><div className="generated-activity-stats"><div><strong>{activity.totalContributions}</strong><span>{t.contributions}</span></div><div><strong>{activity.commits}</strong><span>{t.commits}</span></div><div><strong>{activity.issues}</strong><span>{t.issues}</span></div><div><strong>{activity.reviews}</strong><span>{t.reviews}</span></div></div><div className="generated-calendar" aria-label="GitHub activity calendar">{activity.calendar.slice(-364).map((day) => <i key={day.date} className={`level-${day.level.toLowerCase().replaceAll("_", "-")}`} title={`${day.date}: ${day.count}`} />)}</div><div className="generated-active-repos">{activity.topCommitRepositories.slice(0, 5).map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.repository}><span>{item.repository}</span><b>{item.commits} {t.commits}</b></a>)}</div></div> : <div className="generated-activity-fallback"><p>{t.activityFallback}</p><div>{portfolio.languages.slice(0, 8).map((item) => <span key={item.name}><b>{item.name}</b><small>{item.repos} {t.repos}</small></span>)}</div></div>}</SectionShell>;
}

function About({ spec, portfolio, title, subtitle }: { spec: SiteSpec; portfolio: DeveloperPortfolio; title: string; subtitle?: string }) { return <SectionShell id="about" eyebrow="04 / ABOUT" title={title} subtitle={subtitle}><div className="generated-about-grid"><div className="generated-about-copy"><p>{portfolio.profile.bio ?? spec.identity.summary}</p><strong>{spec.identity.role}</strong></div><div className="generated-language-cloud">{portfolio.languages.map((item) => <span key={item.name}><b>{item.name}</b><small>{item.repos}</small></span>)}</div></div></SectionShell>; }
function Contact({ spec, portfolio, title, subtitle }: { spec: SiteSpec; portfolio: DeveloperPortfolio; title: string; subtitle?: string }) { const t = copy[spec.locale]; return <SectionShell id="contact" eyebrow="05 / CONTACT" title={title} subtitle={subtitle}><div className="generated-contact-card"><div><span>@{portfolio.profile.login}</span><h3>{spec.locale === "zh" ? "看看源码，或者聊聊下一件想做的东西。" : "See the work, or start a conversation about what comes next."}</h3></div><div><a href={portfolio.profile.githubUrl} target="_blank" rel="noreferrer">{t.profile} ↗</a>{portfolio.profile.website ? <a href={portfolio.profile.website} target="_blank" rel="noreferrer">{t.website} ↗</a> : null}</div></div></SectionShell>; }

function renderSection(type: SiteSectionType, spec: SiteSpec, portfolio: DeveloperPortfolio, title: string, subtitle?: string): ReactNode {
  if (type === "hero") return null;
  if (type === "projects") return <Projects spec={spec} portfolio={portfolio} title={title} subtitle={subtitle} />;
  if (type === "contributions") return <Contributions spec={spec} portfolio={portfolio} title={title} subtitle={subtitle} />;
  if (type === "activity") return <Activity spec={spec} portfolio={portfolio} title={title} subtitle={subtitle} />;
  if (type === "about") return <About spec={spec} portfolio={portfolio} title={title} subtitle={subtitle} />;
  return <Contact spec={spec} portfolio={portfolio} title={title} subtitle={subtitle} />;
}

export default function SiteRenderer({ generation, spec: override, studio = false }: Props) {
  const spec = override ?? generation.spec; const portfolio = generation.portfolio; const t = copy[spec.locale];
  const style = { "--site-accent-name": spec.visual.accent } as CSSProperties;
  return <div className={`generated-site mood-${spec.visual.mood} density-${spec.visual.density} accent-${spec.visual.accent} surface-${spec.visual.surface}${studio ? " is-studio-preview" : ""}`} style={style}><header className="generated-nav"><a className="generated-brand" href="#hero"><span>{spec.identity.displayName}</span><small>{spec.identity.role}</small></a><nav>{spec.navigation.map((item) => <a key={`${item.label}-${item.target}`} href={item.target}>{item.label}</a>)}</nav><a className="generated-github" href={portfolio.profile.githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a></header><main className="generated-shell"><Hero spec={spec} portfolio={portfolio} />{spec.sections.filter((section) => section.visible && section.type !== "hero").map((section) => <div key={section.id}>{renderSection(section.type, spec, portfolio, section.title, section.subtitle)}</div>)}</main><footer className="generated-footer"><span>{t.built}</span><a href="/">Personal Site Agent</a></footer></div>;
}

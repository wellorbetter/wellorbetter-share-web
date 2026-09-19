import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, SyntheticEvent } from "react";
import { icon } from "@wellorbetter/design";
import {
  PROJECT_SNAPSHOT,
  injectedProjectCards,
  toLandingProjects,
} from "./projects.js";
import type { LandingProject, Locale } from "./projects.js";
import { useThemeToggle } from "./theme.js";

const copy = {
  zh: {
    nav: { projects: "项目", principles: "做法", github: "GitHub" },
    heroEyebrow: "VIBE CODING LAB · 2026",
    heroTitle: "把脑子里的小想法，\n做成真的能用的工具。",
    heroSub:
      "不追求完美开局。先解决一个烦人的问题，再把原型一路打磨到能下载、能运行、能复用。",
    heroPrimary: "看最近作品",
    heroSecondary: "逛 GitHub",
    signalLabel: "最近在做",
    stack: ["Rust", "Flutter", "React", "TypeScript", "AI Agents", "Local-first", "Open Source"],
    projectEyebrow: "RECENT SHIPS",
    projectTitle: "不是 demo 墙，是我真的在用的东西。",
    projectSub: "每个项目都从一个具体痛点开始。能开源的尽量开源，能本地跑的尽量不依赖云。",
    principleEyebrow: "HOW I BUILD",
    principleTitle: "先做成，再做对，再做好看。",
    principles: [
      ["01", "找痛点", "从自己每天会遇到的麻烦开始，不为“项目感”硬造需求。"],
      ["02", "做原型", "把任务拆小，让 AI 快速覆盖样板代码，我负责约束、边界和取舍。"],
      ["03", "跑起来", "能构建、能安装、能真实操作，比截图里的完成度更重要。"],
      ["04", "继续磨", "把卡顿、暗色、空状态、错误处理这些小问题一个个消掉。"],
    ],
    footer: "Built by wellorbetter · tools, experiments, and things I wanted to exist.",
    themeLabel: "切换深浅色",
    localeLabel: "Switch to English",
  },
  en: {
    nav: { projects: "Projects", principles: "Process", github: "GitHub" },
    heroEyebrow: "VIBE CODING LAB · 2026",
    heroTitle: "Small ideas.\nReal tools. Shipped.",
    heroSub:
      "I start with an annoying problem, prototype fast, then keep polishing until the thing is actually useful, runnable, and reusable.",
    heroPrimary: "See recent work",
    heroSecondary: "Explore GitHub",
    signalLabel: "Building lately",
    stack: ["Rust", "Flutter", "React", "TypeScript", "AI Agents", "Local-first", "Open Source"],
    projectEyebrow: "RECENT SHIPS",
    projectTitle: "Not a demo wall. Things I actually use.",
    projectSub: "Each project starts from a concrete pain point. I keep it open source when I can, and local-first whenever that makes sense.",
    principleEyebrow: "HOW I BUILD",
    principleTitle: "Make it exist. Make it right. Make it nice.",
    principles: [
      ["01", "Find friction", "Start from a problem I hit often instead of inventing a project-shaped requirement."],
      ["02", "Prototype", "Break the work into small constraints. AI handles boilerplate; I own boundaries and trade-offs."],
      ["03", "Run it", "A build that installs and survives real interaction matters more than a polished screenshot."],
      ["04", "Refine", "Keep removing the tiny papercuts: lag, dark mode, empty states, errors, and awkward flows."],
    ],
    footer: "Built by wellorbetter · tools, experiments, and things I wanted to exist.",
    themeLabel: "Toggle color theme",
    localeLabel: "切换到中文",
  },
} as const;

function ProjectVisual({ project }: { project: LandingProject }) {
  if (project.visual === "terminal") {
    return (
      <div className="terminal-preview" aria-hidden="true">
        <div className="terminal-chrome">
          <span />
          <span />
          <span />
          <em>cxs · local</em>
        </div>
        <div className="terminal-body">
          <p><span className="terminal-prompt">$</span> cxs -s</p>
          <p><b>1</b> ACTIVE &nbsp; improve landing UI</p>
          <p><b>2</b> IDLE &nbsp;&nbsp; audit agent sessions</p>
          <p><b>3</b> IDLE &nbsp;&nbsp; fix dark mode</p>
          <p className="terminal-dim">→ cxs resume 1</p>
        </div>
      </div>
    );
  }

  return (
    <div className="project-image-wrap">
      {project.cover ? (
        <img
          className="project-image"
          src={project.cover.url}
          // 封面是作品自己的截图，卡片上已经有标题和描述，重复一遍对读屏器是噪音。
          alt=""
          width={project.cover.width}
          height={project.cover.height}
          loading="lazy"
          decoding="async"
          onError={(event: SyntheticEvent<HTMLImageElement>) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <div className="project-image-grid" aria-hidden="true" />
    </div>
  );
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem("wb_locale");
    return saved === "en" ? "en" : "zh";
  });
  const { dark, toggle: toggleDark } = useThemeToggle();
  const landingRef = useRef<HTMLDivElement | null>(null);

  /**
   * 作品数据来自 worker 注进 <head> 的那份（见 projects.ts）。
   *
   * 在 useState 的初始化函数里读，而不是模块顶层：模块顶层只会执行一次，测试就
   * 没法在两个 case 之间换掉注入的内容。拿不到就用快照 —— vite dev 不经过
   * worker，走的就是这条路。
   */
  const [cards] = useState(() => injectedProjectCards(document) ?? PROJECT_SNAPSHOT);
  const projects = useMemo(() => toLandingProjects(cards, locale), [cards, locale]);

  useEffect(() => {
    localStorage.setItem("wb_locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const t = copy[locale];

  const toggleLocale = useCallback(() => setLocale((value) => (value === "zh" ? "en" : "zh")), []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const root = landingRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    root.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    root.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  }, []);

  return (
    <div className="landing" ref={landingRef} onPointerMove={handlePointerMove}>
      <div className="page-grid" aria-hidden="true" />
      <header className="landing-nav-shell">
        <div className="landing-nav">
          <a className="landing-brand" href="#top" aria-label="wellorbetter home">
            <span className="brand-mark" dangerouslySetInnerHTML={{ __html: icon("logo", 24) }} />
            <span className="brand-text">wellorbetter</span>
            <span className="brand-lab">/ lab</span>
          </a>

          <nav className="landing-links" aria-label="Primary navigation">
            <a href="#projects">{t.nav.projects}</a>
            <a href="#principles">{t.nav.principles}</a>
            <a href="https://github.com/wellorbetter" target="_blank" rel="noreferrer">
              {t.nav.github}
            </a>
          </nav>

          <div className="landing-actions">
            <button
              type="button"
              className="nav-action icon-action"
              aria-label={t.themeLabel}
              onClick={toggleDark}
              dangerouslySetInnerHTML={{ __html: icon(dark ? "sun" : "moon", 17) }}
            />
            <button type="button" className="nav-action locale-action" aria-label={t.localeLabel} onClick={toggleLocale}>
              {locale === "zh" ? "EN" : "中"}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero section-shell">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              {t.heroEyebrow}
            </div>
            <h1>
              {t.heroTitle.split("\n").map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h1>
            <p className="hero-sub">{t.heroSub}</p>
            <div className="hero-actions">
              <a className="primary-btn" href="#projects">
                {t.heroPrimary}
                <span aria-hidden="true">↓</span>
              </a>
              <a className="secondary-btn" href="https://github.com/wellorbetter" target="_blank" rel="noreferrer">
                {t.heroSecondary}
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          <aside className="signal-card" aria-label={t.signalLabel}>
            <div className="signal-card-head">
              <span>{t.signalLabel}</span>
              <span className="signal-live"><i /> LIVE</span>
            </div>
            <div className="signal-list">
              {/* 「最近在做」以前是第三份手写的作品名单。现在就是作品库里最新的三个。 */}
              {projects.slice(0, 3).map((project, index) => (
                <a key={project.slug} href="#projects" className="signal-item">
                  <span className="signal-index">0{index + 1}</span>
                  <span className="signal-copy">
                    <strong>{project.name}</strong>
                    <small>{project.kicker || project.tags.join(" · ")}</small>
                  </span>
                  <span className="signal-arrow" aria-hidden="true">↘</span>
                </a>
              ))}
            </div>
            <div className="signal-footer">
              <span className="signal-wave" aria-hidden="true">
                {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
              </span>
              <span>ship → test → refine</span>
            </div>
          </aside>
        </section>

        <div className="stack-strip" aria-label="Technology stack">
          <div className="stack-track">
            {[...t.stack, ...t.stack].map((item, index) => (
              <span key={`${item}-${index}`}>
                {item}
                <i aria-hidden="true">✦</i>
              </span>
            ))}
          </div>
        </div>

        <section id="projects" className="projects-section section-shell">
          <div className="section-heading">
            <div>
              <p className="section-eyebrow">{t.projectEyebrow}</p>
              <h2>{t.projectTitle}</h2>
            </div>
            <p>{t.projectSub}</p>
          </div>

          <div className="projects-grid">
            {projects.map((project) => (
              <a
                className={`project-card project-card--${project.size} project-card--${project.visual}`}
                href={project.href}
                target="_blank"
                rel="noreferrer"
                key={project.slug}
              >
                <ProjectVisual project={project} />
                <div className="project-content">
                  <div className="project-meta-row">
                    <span className="project-status"><i /> {project.status}</span>
                    <span className="project-open" aria-hidden="true">↗</span>
                  </div>
                  {project.kicker ? <p className="project-kicker">{project.kicker}</p> : null}
                  <h3>{project.name}</h3>
                  <p className="project-desc">{project.desc}</p>
                  <div className="project-tags">
                    {project.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="principles" className="principles-section section-shell">
          <div className="principles-heading">
            <p className="section-eyebrow">{t.principleEyebrow}</p>
            <h2>{t.principleTitle}</h2>
          </div>
          <div className="principles-grid">
            {t.principles.map(([index, title, body]) => (
              <article className="principle-card" key={index}>
                <span>{index}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer section-shell">
        <span className="footer-mark" dangerouslySetInnerHTML={{ __html: icon("logo", 20) }} />
        <p>{t.footer}</p>
        <a href="#top">↑ TOP</a>
      </footer>
    </div>
  );
}

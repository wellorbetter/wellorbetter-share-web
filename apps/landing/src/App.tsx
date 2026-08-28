import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent, SyntheticEvent } from "react";
import { icon } from "@wellorbetter/design";

type Locale = "zh" | "en";
type Visual = "image" | "terminal" | "upload";
type Size = "wide" | "compact";

type Project = {
  readonly name: string;
  readonly kicker: string;
  readonly desc: string;
  readonly status: string;
  readonly href: string;
  readonly tags: readonly string[];
  readonly visual: Visual;
  readonly size: Size;
  readonly image?: string;
  readonly imageAlt?: string;
};

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
    signalItems: [
      ["TimeTrace", "本地优先 · Windows"],
      ["cxs", "Codex session CLI"],
      ["Window Stats", "DeepSeek Harness plugin"],
    ],
    stack: ["Rust", "Flutter", "React", "TypeScript", "AI Agents", "Local-first", "Open Source"],
    projectEyebrow: "RECENT SHIPS",
    projectTitle: "不是 demo 墙，是我真的在用的东西。",
    projectSub: "每个项目都从一个具体痛点开始。能开源的尽量开源，能本地跑的尽量不依赖云。",
    projects: [
      {
        name: "TimeTrace",
        kicker: "本地使用统计 + 日记",
        desc: "Rust 核心 + Flutter UI。记录应用活跃时长、日历与回顾，所有数据只留在本机。",
        status: "已发布",
        href: "https://github.com/wellorbetter/timetrace",
        tags: ["Rust", "Flutter", "SQLite"],
        visual: "image",
        size: "wide",
        image: "https://raw.githubusercontent.com/wellorbetter/timetrace/main/docs/screenshots/dashboard-bar.png",
        imageAlt: "TimeTrace dashboard",
      },
      {
        name: "AI 进程管家",
        kicker: "Coding agent session manager",
        desc: "把 Codex、Claude、Gemini、OpenCode 等 agent 的进程和本地会话整理成一个可读、可恢复的桌面工具。",
        status: "已发布",
        href: "https://github.com/wellorbetter/ai-process-manager",
        tags: ["Rust", "Flutter", "Windows"],
        visual: "image",
        size: "compact",
        image: "https://raw.githubusercontent.com/wellorbetter/ai-process-manager/master/docs/screenshots/main.png",
        imageAlt: "AI Process Manager",
      },
      {
        name: "Amadeus",
        kicker: "本地优先 AI 桌宠",
        desc: "Flutter + Live2D 的 Windows AI 陪伴桌宠，可选择读取 TimeTrace 本地数据，让角色感知你正在做什么。",
        status: "实验中",
        href: "https://github.com/wellorbetter/amadeus-desktop",
        tags: ["Flutter", "Live2D", "AI"],
        visual: "image",
        size: "compact",
        image: "https://raw.githubusercontent.com/wellorbetter/amadeus-desktop/main/assets/docs/screenshots/pet.png",
        imageAlt: "Amadeus desktop pet",
      },
      {
        name: "cxs",
        kicker: "Zero-token Codex session finder",
        desc: "只读扫描本地 Codex 元数据，快速找到“刚才哪个会话在做这件事”，然后安全交给原生 Codex resume。",
        status: "Alpha",
        href: "https://github.com/wellorbetter/cxs",
        tags: ["Rust", "CLI", "Local-only"],
        visual: "terminal",
        size: "wide",
      },
      {
        name: "Window Stats",
        kicker: "DeepSeek Harness plugin",
        desc: "跨会话查看运行状态、token、上下文占用、耗时和成本，再下钻到单个 session 的趋势和热力图。",
        status: "Plugin",
        href: "https://github.com/wellorbetter/dsh-plugin-window-stats",
        tags: ["TypeScript", "Analytics", "Plugin"],
        visual: "image",
        size: "wide",
        image: "https://raw.githubusercontent.com/wellorbetter/dsh-plugin-window-stats/main/assets/window-stats.png",
        imageAlt: "Window Stats overview",
      },
      {
        name: "File Share",
        kicker: "轻量文件分享",
        desc: "React + Cloudflare 的文件分享小工具，也是这套个人站点和设计系统最早落地的一块。",
        status: "在线",
        href: "https://share.wellorbetterai.com",
        tags: ["React", "Cloudflare", "R2"],
        visual: "upload",
        size: "compact",
      },
    ] satisfies readonly Project[],
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
    signalItems: [
      ["TimeTrace", "local-first · Windows"],
      ["cxs", "Codex session CLI"],
      ["Window Stats", "DeepSeek Harness plugin"],
    ],
    stack: ["Rust", "Flutter", "React", "TypeScript", "AI Agents", "Local-first", "Open Source"],
    projectEyebrow: "RECENT SHIPS",
    projectTitle: "Not a demo wall. Things I actually use.",
    projectSub: "Each project starts from a concrete pain point. I keep it open source when I can, and local-first whenever that makes sense.",
    projects: [
      {
        name: "TimeTrace",
        kicker: "Local activity tracking + journal",
        desc: "A Rust core with a Flutter UI for app activity, calendar views and recaps, with all personal data staying on-device.",
        status: "Shipped",
        href: "https://github.com/wellorbetter/timetrace",
        tags: ["Rust", "Flutter", "SQLite"],
        visual: "image",
        size: "wide",
        image: "https://raw.githubusercontent.com/wellorbetter/timetrace/main/docs/screenshots/dashboard-bar.png",
        imageAlt: "TimeTrace dashboard",
      },
      {
        name: "AI Process Manager",
        kicker: "Coding agent session manager",
        desc: "A desktop view over Codex, Claude, Gemini, OpenCode and other coding-agent processes and their local sessions.",
        status: "Shipped",
        href: "https://github.com/wellorbetter/ai-process-manager",
        tags: ["Rust", "Flutter", "Windows"],
        visual: "image",
        size: "compact",
        image: "https://raw.githubusercontent.com/wellorbetter/ai-process-manager/master/docs/screenshots/main.png",
        imageAlt: "AI Process Manager",
      },
      {
        name: "Amadeus",
        kicker: "Local-first AI desktop companion",
        desc: "A Flutter + Live2D Windows companion that can optionally read local TimeTrace data and react to what is happening on your desktop.",
        status: "Experiment",
        href: "https://github.com/wellorbetter/amadeus-desktop",
        tags: ["Flutter", "Live2D", "AI"],
        visual: "image",
        size: "compact",
        image: "https://raw.githubusercontent.com/wellorbetter/amadeus-desktop/main/assets/docs/screenshots/pet.png",
        imageAlt: "Amadeus desktop pet",
      },
      {
        name: "cxs",
        kicker: "Zero-token Codex session finder",
        desc: "A read-only local CLI that finds the Codex session doing a specific job and delegates resume back to native Codex.",
        status: "Alpha",
        href: "https://github.com/wellorbetter/cxs",
        tags: ["Rust", "CLI", "Local-only"],
        visual: "terminal",
        size: "wide",
      },
      {
        name: "Window Stats",
        kicker: "DeepSeek Harness plugin",
        desc: "Cross-session observability for progress, tokens, context pressure, duration and cost, with drill-down analytics for a single session.",
        status: "Plugin",
        href: "https://github.com/wellorbetter/dsh-plugin-window-stats",
        tags: ["TypeScript", "Analytics", "Plugin"],
        visual: "image",
        size: "wide",
        image: "https://raw.githubusercontent.com/wellorbetter/dsh-plugin-window-stats/main/assets/window-stats.png",
        imageAlt: "Window Stats overview",
      },
      {
        name: "File Share",
        kicker: "Lightweight file sharing",
        desc: "A small React + Cloudflare file-sharing tool, and the first live piece of this personal site and design system.",
        status: "Live",
        href: "https://share.wellorbetterai.com",
        tags: ["React", "Cloudflare", "R2"],
        visual: "upload",
        size: "compact",
      },
    ] satisfies readonly Project[],
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

function ProjectVisual({ project }: { project: Project }) {
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

  if (project.visual === "upload") {
    return (
      <div className="upload-preview" aria-hidden="true">
        <div className="upload-orbit upload-orbit--one" />
        <div className="upload-orbit upload-orbit--two" />
        <div className="upload-drop">
          <span dangerouslySetInnerHTML={{ __html: icon("upload", 28) }} />
          <strong>drop / share</strong>
          <small>share.wellorbetterai.com</small>
        </div>
      </div>
    );
  }

  return (
    <div className="project-image-wrap">
      {project.image ? (
        <img
          className="project-image"
          src={project.image}
          alt={project.imageAlt ?? ""}
          loading="lazy"
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
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("wb_dark");
    if (saved === "1") return true;
    if (saved === "0") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const landingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("wb_dark", dark ? "1" : "0");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("wb_locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const t = copy[locale];

  const toggleDark = useCallback(() => setDark((value) => !value), []);
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
              {t.signalItems.map(([name, meta], index) => (
                <a key={name} href="#projects" className="signal-item">
                  <span className="signal-index">0{index + 1}</span>
                  <span className="signal-copy">
                    <strong>{name}</strong>
                    <small>{meta}</small>
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
            {t.projects.map((project) => (
              <a
                className={`project-card project-card--${project.size} project-card--${project.visual}`}
                href={project.href}
                target="_blank"
                rel="noreferrer"
                key={project.name}
              >
                <ProjectVisual project={project} />
                <div className="project-content">
                  <div className="project-meta-row">
                    <span className="project-status"><i /> {project.status}</span>
                    <span className="project-open" aria-hidden="true">↗</span>
                  </div>
                  <p className="project-kicker">{project.kicker}</p>
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

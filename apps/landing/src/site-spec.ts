import type { DeveloperPortfolio, PortfolioContribution, PortfolioProject } from "./portfolio.js";

export type SiteLocale = "en" | "zh";
export type SiteSectionType = "hero" | "projects" | "contributions" | "activity" | "about" | "contact";
export type SiteMood = "editorial" | "technical" | "minimal" | "playful" | "professional";
export type SiteDensity = "airy" | "balanced" | "dense";
export type SiteAccent = "violet" | "blue" | "lime" | "coral" | "amber" | "mono";
export type SiteSurface = "warm" | "cool" | "dark" | "paper";

export type SiteSpec = {
  version: 1;
  owner: string;
  locale: SiteLocale;
  identity: {
    displayName: string;
    eyebrow: string;
    headline: string;
    summary: string;
    role: string;
  };
  navigation: Array<{ label: string; target: string }>;
  sections: Array<{
    id: string;
    type: SiteSectionType;
    title: string;
    subtitle?: string;
    visible: boolean;
  }>;
  projects: Array<{
    fullName: string;
    title: string;
    summary: string;
    emphasis: "hero" | "featured" | "normal";
    tags: string[];
  }>;
  contributions: Array<{
    key: string;
    headline: string;
    summary: string;
    whyItMatters: string;
  }>;
  visual: {
    mood: SiteMood;
    density: SiteDensity;
    accent: SiteAccent;
    surface: SiteSurface;
  };
  meta: {
    rationale: string[];
    generatedBy: "personal-site-agent";
    intent: string;
    updatedAt: string;
  };
};

export type SiteGeneration = {
  version: 1;
  spec: SiteSpec;
  portfolio: DeveloperPortfolio;
  agent: {
    mode: "deterministic" | "ai";
    model?: string;
    steps: string[];
    generatedAt: string;
  };
};

export type SiteEditResult = {
  spec: SiteSpec;
  changes: string[];
  mode: "deterministic" | "ai";
};

const sectionTypes = new Set<SiteSectionType>(["hero", "projects", "contributions", "activity", "about", "contact"]);
const moods = new Set<SiteMood>(["editorial", "technical", "minimal", "playful", "professional"]);
const densities = new Set<SiteDensity>(["airy", "balanced", "dense"]);
const accents = new Set<SiteAccent>(["violet", "blue", "lime", "coral", "amber", "mono"]);
const surfaces = new Set<SiteSurface>(["warm", "cool", "dark", "paper"]);

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown, max: number): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((item) => typeof item === "string");
}

export function isSiteSpec(value: unknown): value is SiteSpec {
  if (!record(value) || value.version !== 1 || typeof value.owner !== "string" || (value.locale !== "en" && value.locale !== "zh")) return false;
  if (!record(value.identity) || typeof value.identity.displayName !== "string" || typeof value.identity.eyebrow !== "string" || typeof value.identity.headline !== "string" || typeof value.identity.summary !== "string" || typeof value.identity.role !== "string") return false;
  if (!Array.isArray(value.navigation) || value.navigation.length > 8 || !value.navigation.every((item) => record(item) && typeof item.label === "string" && typeof item.target === "string")) return false;
  if (!Array.isArray(value.sections) || value.sections.length < 3 || value.sections.length > 8 || !value.sections.every((item) => record(item) && typeof item.id === "string" && typeof item.type === "string" && sectionTypes.has(item.type as SiteSectionType) && typeof item.title === "string" && (item.subtitle === undefined || typeof item.subtitle === "string") && typeof item.visible === "boolean")) return false;
  if (!Array.isArray(value.projects) || value.projects.length > 8 || !value.projects.every((item) => record(item) && typeof item.fullName === "string" && typeof item.title === "string" && typeof item.summary === "string" && (item.emphasis === "hero" || item.emphasis === "featured" || item.emphasis === "normal") && stringArray(item.tags, 6))) return false;
  if (!Array.isArray(value.contributions) || value.contributions.length > 10 || !value.contributions.every((item) => record(item) && typeof item.key === "string" && typeof item.headline === "string" && typeof item.summary === "string" && typeof item.whyItMatters === "string")) return false;
  if (!record(value.visual) || typeof value.visual.mood !== "string" || !moods.has(value.visual.mood as SiteMood) || typeof value.visual.density !== "string" || !densities.has(value.visual.density as SiteDensity) || typeof value.visual.accent !== "string" || !accents.has(value.visual.accent as SiteAccent) || typeof value.visual.surface !== "string" || !surfaces.has(value.visual.surface as SiteSurface)) return false;
  if (!record(value.meta) || !stringArray(value.meta.rationale, 12) || value.meta.generatedBy !== "personal-site-agent" || typeof value.meta.intent !== "string" || typeof value.meta.updatedAt !== "string") return false;
  return true;
}

function projectText(project: PortfolioProject): string {
  return `${project.fullName} ${project.name} ${project.description ?? ""} ${project.language ?? ""} ${project.topics.join(" ")}`.toLowerCase();
}

function contributionKey(item: PortfolioContribution): string {
  return `${item.repository}#${item.number}`;
}

function scoreProject(project: PortfolioProject, intent: string): number {
  const text = projectText(project);
  const goal = intent.toLowerCase();
  let score = Math.log2(project.stars + 2) * 3 + Math.min(project.forks, 20) * 0.15;
  const updated = Date.parse(project.updatedAt);
  if (Number.isFinite(updated)) score += Math.max(0, 4 - (Date.now() - updated) / (1000 * 60 * 60 * 24 * 180));
  const rules: Array<[RegExp, RegExp, number]> = [
    [/android|launcher|aosp|system/i, /android|launcher|aosp|kotlin|systemui|mobile/i, 10],
    [/ai|agent|llm|codex|coding/i, /ai|agent|llm|codex|claude|opencode|deepseek|model/i, 10],
    [/rust|systems|cli|infra/i, /rust|cli|terminal|system|infra|native/i, 8],
    [/flutter|cross.?platform/i, /flutter|dart|desktop|cross.?platform/i, 8],
    [/web|frontend|react/i, /react|typescript|web|frontend|cloudflare/i, 7],
    [/open.?source|oss/i, /open.?source|plugin|tool|cli/i, 4],
  ];
  for (const [goalPattern, projectPattern, boost] of rules) if (goalPattern.test(goal) && projectPattern.test(text)) score += boost;
  return score;
}

function rankProjects(portfolio: DeveloperPortfolio, intent: string): PortfolioProject[] {
  return [...portfolio.projects].sort((a, b) => scoreProject(b, intent) - scoreProject(a, intent)).slice(0, 6);
}

function rankContributions(portfolio: DeveloperPortfolio, intent: string): PortfolioContribution[] {
  const goal = intent.toLowerCase();
  return [...portfolio.contributions]
    .filter((item) => item.external)
    .sort((a, b) => {
      const textA = `${a.repository} ${a.title}`.toLowerCase();
      const textB = `${b.repository} ${b.title}`.toLowerCase();
      const match = (text: string) => {
        let score = Number(text.length > 0) + (text.includes("lawnchair") && /android|launcher|aosp/.test(goal) ? 8 : 0) + (/(ai|agent|codex|llm)/.test(text) && /(ai|agent|codex|llm)/.test(goal) ? 8 : 0);
        score += 5;
        return score;
      };
      return Number(b.merged) - Number(a.merged) || match(textB) - match(textA) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    })
    .slice(0, 8);
}

function inferRole(portfolio: DeveloperPortfolio, intent: string): string {
  const corpus = `${intent} ${portfolio.profile.bio ?? ""} ${portfolio.languages.map((item) => item.name).join(" ")} ${portfolio.projects.map(projectText).join(" ")}`.toLowerCase();
  if (/android|launcher|aosp|systemui/.test(corpus)) return "Android Systems Engineer & Builder";
  if (/(ai|agent|codex|llm)/.test(corpus) && /(rust|system|cli|tool)/.test(corpus)) return "Developer Tools & AI Systems Builder";
  if (/rust|systems|terminal|cli|native/.test(corpus)) return "Systems & Developer Tools Engineer";
  if (/flutter|dart|cross.?platform/.test(corpus)) return "Cross-platform Product Engineer";
  if (/react|typescript|frontend|web/.test(corpus)) return "Product Engineer & Builder";
  return "Software Engineer & Builder";
}

function chooseVisual(intent: string, portfolio: DeveloperPortfolio): SiteSpec["visual"] {
  const text = `${intent} ${portfolio.profile.bio ?? ""} ${portfolio.languages.map((item) => item.name).join(" ")}`.toLowerCase();
  if (/minimal|极简|simple|clean/.test(text)) return { mood: "minimal", density: "airy", accent: "mono", surface: "paper" };
  if (/dark|深色|technical|技术|systems|rust|cli|terminal/.test(text)) return { mood: "technical", density: "balanced", accent: "violet", surface: "dark" };
  if (/creative|design|设计|playful/.test(text)) return { mood: "editorial", density: "airy", accent: "coral", surface: "warm" };
  return { mood: "professional", density: "balanced", accent: "blue", surface: "paper" };
}

function tags(project: PortfolioProject): string[] {
  return [project.language, ...project.topics].filter((value): value is string => Boolean(value)).filter((value, index, array) => array.indexOf(value) === index).slice(0, 6);
}

function localized(locale: SiteLocale) {
  return locale === "zh" ? {
    work: "作品", oss: "开源", about: "关于", selected: "代表作品", selectedSub: "Agent 根据你的目标，从公开 GitHub 项目中筛出的重点。", contributions: "开源贡献", contributionsSub: "优先展示在其他代码库里的真实协作。", activity: "GitHub 动态", aboutTitle: "关于", contact: "联系", merged: "已合并到上游", open: "正在上游协作", closed: "公开的上游工作", evidence: "真实工程证据，可直接打开原始 PR 验证。",
  } : {
    work: "Work", oss: "Open Source", about: "About", selected: "Selected Work", selectedSub: "What the agent thinks is worth seeing first, based on your goal and public GitHub work.", contributions: "Open Source", contributionsSub: "Real work in other codebases, with upstream evidence kept visible.", activity: "GitHub Activity", aboutTitle: "About", contact: "Contact", merged: "Merged upstream", open: "Active upstream collaboration", closed: "Public upstream work", evidence: "Public engineering evidence with the original PR one click away.",
  };
}

export function createSiteSpec(portfolio: DeveloperPortfolio, intent = "", locale: SiteLocale = "en"): SiteSpec {
  const text = localized(locale);
  const projects = rankProjects(portfolio, intent);
  const contributions = rankContributions(portfolio, intent);
  const role = inferRole(portfolio, intent);
  const displayName = portfolio.profile.name ?? portfolio.profile.login;
  const theme = projects[0]?.language ?? portfolio.languages[0]?.name ?? (locale === "zh" ? "软件" : "software");
  const headline = locale === "zh" ? `围绕 ${theme}，把真实问题做成能用的东西。` : `Building useful things around ${theme}.`;
  const summary = portfolio.profile.bio?.trim() || (locale === "zh" ? "从公开 GitHub 工作中自动策展出的个人主页：项目、开源贡献和持续构建的轨迹。" : "A personal site curated from public GitHub work: projects, upstream contributions, and the things that keep getting built.");
  const projectEntries = projects.map((project, index) => ({
    fullName: project.fullName,
    title: project.name,
    summary: project.description ?? (locale === "zh" ? `${project.language ?? "软件"} 项目。` : `${project.language ?? "Software"} project.`),
    emphasis: index === 0 ? "hero" as const : index < 3 ? "featured" as const : "normal" as const,
    tags: tags(project),
  }));
  const contributionEntries = contributions.map((item) => ({
    key: contributionKey(item),
    headline: item.title,
    summary: `${item.repository} #${item.number}`,
    whyItMatters: item.merged ? text.merged : item.state === "open" ? text.open : text.evidence,
  }));
  const contributionFirst = /open.?source|oss|开源|contribut/i.test(intent);
  const sectionOrder: SiteSpec["sections"] = [
    { id: "hero", type: "hero", title: displayName, visible: true },
    ...(contributionFirst ? [
      { id: "contributions", type: "contributions" as const, title: text.contributions, subtitle: text.contributionsSub, visible: contributionEntries.length > 0 },
      { id: "projects", type: "projects" as const, title: text.selected, subtitle: text.selectedSub, visible: projectEntries.length > 0 },
    ] : [
      { id: "projects", type: "projects" as const, title: text.selected, subtitle: text.selectedSub, visible: projectEntries.length > 0 },
      { id: "contributions", type: "contributions" as const, title: text.contributions, subtitle: text.contributionsSub, visible: contributionEntries.length > 0 },
    ]),
    { id: "activity", type: "activity", title: text.activity, visible: true },
    { id: "about", type: "about", title: text.aboutTitle, visible: true },
    { id: "contact", type: "contact", title: text.contact, visible: true },
  ];
  return {
    version: 1,
    owner: portfolio.profile.login,
    locale,
    identity: {
      displayName,
      eyebrow: `${role} · ${portfolio.stats.externalMergedPullRequests} ${locale === "zh" ? "个 merged 外部 PR" : "merged upstream PRs"}`,
      headline,
      summary,
      role,
    },
    navigation: [
      { label: text.work, target: "#projects" },
      ...(contributionEntries.length ? [{ label: text.oss, target: "#contributions" }] : []),
      { label: text.about, target: "#about" },
    ],
    sections: sectionOrder,
    projects: projectEntries,
    contributions: contributionEntries,
    visual: chooseVisual(intent, portfolio),
    meta: {
      rationale: [
        locale === "zh" ? "优先展示原创且有公开信号的项目。" : "Prioritize source projects with public adoption or recent work.",
        locale === "zh" ? "优先展示外部仓库贡献，merged 项目靠前。" : "Prefer upstream contributions, keeping merged evidence first.",
        intent ? (locale === "zh" ? `当前策展目标：${intent}` : `Current curation goal: ${intent}`) : (locale === "zh" ? "当前为通用个人主页。" : "General-purpose personal site."),
      ],
      generatedBy: "personal-site-agent",
      intent,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function validateSiteSpec(spec: SiteSpec, portfolio: DeveloperPortfolio): string[] {
  const issues: string[] = [];
  if (spec.owner.toLowerCase() !== portfolio.profile.login.toLowerCase()) issues.push("SiteSpec owner does not match GitHub profile");
  const projectIds = new Set(portfolio.projects.map((item) => item.fullName));
  const contributionIds = new Set(portfolio.contributions.map(contributionKey));
  for (const item of spec.projects) if (!projectIds.has(item.fullName)) issues.push(`Unknown project: ${item.fullName}`);
  for (const item of spec.contributions) if (!contributionIds.has(item.key)) issues.push(`Unknown contribution: ${item.key}`);
  const seen = new Set<string>();
  for (const section of spec.sections) {
    if (seen.has(section.id)) issues.push(`Duplicate section id: ${section.id}`);
    seen.add(section.id);
  }
  if (!spec.sections.some((item) => item.type === "hero" && item.visible)) issues.push("A visible hero section is required");
  if (!spec.sections.some((item) => item.type === "projects" && item.visible)) issues.push("A visible projects section is required");
  return issues;
}

export function repairSiteSpec(spec: SiteSpec, portfolio: DeveloperPortfolio): SiteSpec {
  const projectIds = new Set(portfolio.projects.map((item) => item.fullName));
  const contributionIds = new Set(portfolio.contributions.map(contributionKey));
  const seen = new Set<string>();
  const sections = spec.sections.filter((section) => {
    if (seen.has(section.id)) return false;
    seen.add(section.id);
    return true;
  });
  if (!sections.some((item) => item.type === "hero" && item.visible)) sections.unshift({ id: "hero", type: "hero", title: spec.identity.displayName, visible: true });
  if (!sections.some((item) => item.type === "projects" && item.visible)) sections.push({ id: "projects", type: "projects", title: spec.locale === "zh" ? "代表作品" : "Selected Work", visible: true });
  return {
    ...spec,
    owner: portfolio.profile.login,
    sections,
    projects: spec.projects.filter((item) => projectIds.has(item.fullName)).slice(0, 8),
    contributions: spec.contributions.filter((item) => contributionIds.has(item.key)).slice(0, 10),
    meta: { ...spec.meta, generatedBy: "personal-site-agent", updatedAt: new Date().toISOString() },
  };
}

function moveSection(spec: SiteSpec, type: SiteSectionType, before: SiteSectionType): SiteSpec {
  const sections = [...spec.sections];
  const from = sections.findIndex((item) => item.type === type);
  const to = sections.findIndex((item) => item.type === before);
  if (from < 0 || to < 0 || from === to) return spec;
  const [item] = sections.splice(from, 1);
  if (!item) return spec;
  const target = sections.findIndex((section) => section.type === before);
  sections.splice(Math.max(0, target), 0, item);
  return { ...spec, sections };
}

function projectMention(instruction: string, portfolio: DeveloperPortfolio): PortfolioProject | undefined {
  const lower = instruction.toLowerCase();
  return portfolio.projects.find((project) => lower.includes(project.name.toLowerCase()) || lower.includes(project.fullName.toLowerCase()));
}

export function applyDeterministicEdit(spec: SiteSpec, portfolio: DeveloperPortfolio, instruction: string, locale: SiteLocale): SiteEditResult {
  const lower = instruction.toLowerCase();
  let next = structuredClone(spec);
  const changes: string[] = [];
  const say = (en: string, zh: string) => changes.push(locale === "zh" ? zh : en);

  if (/minimal|极简|简洁|clean/.test(lower)) {
    next.visual.mood = "minimal";
    next.visual.density = "airy";
    say("Made the visual direction more minimal and airy.", "视觉方向已改得更极简、更留白。");
  }
  if (/dark|深色|黑色|night/.test(lower)) {
    next.visual.surface = "dark";
    say("Switched the site to a dark surface.", "页面已切换到深色表面。");
  }
  if (/technical|techy|技术感|工程感|terminal/.test(lower)) {
    next.visual.mood = "technical";
    if (next.visual.accent === "mono") next.visual.accent = "violet";
    say("Made the presentation more technical.", "页面表达已加强技术感。");
  }
  if (/warm|暖色|纸张/.test(lower)) next.visual.surface = "warm";
  if (/blue|蓝色/.test(lower)) next.visual.accent = "blue";
  if (/violet|purple|紫色/.test(lower)) next.visual.accent = "violet";
  if (/lime|green|绿色|荧光/.test(lower)) next.visual.accent = "lime";
  if (/coral|橙|珊瑚/.test(lower)) next.visual.accent = "coral";
  if (/amber|黄色|琥珀/.test(lower)) next.visual.accent = "amber";

  const mentioned = projectMention(instruction, portfolio);
  if (mentioned && /(first|top|第一|最前|优先)/.test(lower)) {
    const index = next.projects.findIndex((item) => item.fullName === mentioned.fullName);
    if (index >= 0) {
      const [item] = next.projects.splice(index, 1);
      if (item) {
        next.projects.unshift(item);
        next.projects = next.projects.map((entry, entryIndex) => ({ ...entry, emphasis: entryIndex === 0 ? "hero" : entryIndex < 3 ? "featured" : "normal" }));
        say(`Moved ${mentioned.name} to the first project slot.`, `已把 ${mentioned.name} 放到项目第一位。`);
      }
    }
  }
  if (mentioned && /(hide|remove|隐藏|不展示|删掉)/.test(lower)) {
    next.projects = next.projects.filter((item) => item.fullName !== mentioned.fullName);
    say(`Removed ${mentioned.name} from the visible project list.`, `已从页面中隐藏 ${mentioned.name}。`);
  }

  if (/open.?source|oss|开源|贡献/.test(lower) && /(focus|highlight|重点|突出|优先)/.test(lower)) {
    next = moveSection(next, "contributions", "projects");
    say("Moved open-source evidence ahead of projects.", "已把开源贡献提前到项目之前。");
  }

  if (/(ai|agent|codex|llm)/.test(lower) && /(focus|highlight|重点|突出|优先|showcase)/.test(lower)) {
    const score = (item: SiteSpec["projects"][number]) => /(ai|agent|codex|claude|llm|opencode|deepseek|amadeus|cxs)/i.test(`${item.fullName} ${item.title} ${item.summary} ${item.tags.join(" ")}`) ? 1 : 0;
    next.projects = [...next.projects].sort((a, b) => score(b) - score(a)).map((item, index) => ({ ...item, emphasis: index === 0 ? "hero" : index < 3 ? "featured" : "normal" }));
    say("Reordered projects to emphasize AI and agent work.", "已重排项目，优先展示 AI / Agent 相关工作。");
  }

  if (/(android|launcher|aosp|系统)/.test(lower) && /(focus|highlight|job|role|重点|突出|求职|岗位|优先)/.test(lower)) {
    const score = (item: SiteSpec["projects"][number]) => /(android|launcher|aosp|kotlin|mobile)/i.test(`${item.fullName} ${item.title} ${item.summary} ${item.tags.join(" ")}`) ? 1 : 0;
    next.projects = [...next.projects].sort((a, b) => score(b) - score(a)).map((item, index) => ({ ...item, emphasis: index === 0 ? "hero" : index < 3 ? "featured" : "normal" }));
    next.identity.role = "Android Systems Engineer & Builder";
    say("Shifted the site toward Android systems work.", "已把页面重心切到 Android / 系统方向。");
  }

  if (/(shorter|short|concise|简短|短一点|精简文案)/.test(lower)) {
    const shorten = (text: string, max: number) => text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
    next.identity.summary = shorten(next.identity.summary, locale === "zh" ? 70 : 120);
    next.projects = next.projects.map((item) => ({ ...item, summary: shorten(item.summary, locale === "zh" ? 48 : 90) }));
    say("Shortened the main copy.", "已精简主要文案。");
  }

  if (!changes.length) {
    say("That instruction needs the full AI editor; I kept the current page unchanged for now.", "这条指令需要完整 AI 编辑器；当前未改动页面。配置服务端模型后会自动支持。" );
  }

  next.locale = locale;
  next.meta = { ...next.meta, updatedAt: new Date().toISOString() };
  next = repairSiteSpec(next, portfolio);
  return { spec: next, changes, mode: "deterministic" };
}

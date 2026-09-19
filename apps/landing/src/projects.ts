/**
 * 落地页 #projects 的数据来源：share 的作品库。
 *
 * ── 为什么要这个文件 ──────────────────────────────────────────────────────
 * 同一批作品以前在三个地方各写了一份：share 的数据库（访客在 share 上看到的）、
 * App.tsx 里 copy.zh.projects / copy.en.projects 两个写死的数组（访客在根域名上
 * 看到的）、还有 routes.ts 里 og:description 那句「TimeTrace、cxs、Window
 * Stats 等等」。三份会各自漂移，而且没有任何测试会因为它们不一致而红。
 *
 * 现在只有一份真相：share 的 `GET /api/projects?feed=latest`。worker 在边缘拿
 * 到它、注入进 HTML（见 projectsScriptTag），App.tsx 第一次 render 就有真数据 ——
 * 没有 loading 态、没有第二次请求、没有布局跳动。
 *
 * ── 代价（明说）──────────────────────────────────────────────────────────
 * 「以 share 为准」意味着 share 里没发布的东西，根域名上就没有。落地页原来手写
 * 的 AI 进程管家 / Amadeus / File Share 三张卡因此消失了 —— 修法是去 share 发布
 * 它们，不是把它们再抄回代码里。反过来，share 里新发一个作品，这边不用改代码。
 */

import type { ProjectCard } from "@wellorbetter/shared";

/**
 * 落地页真正用到的那几个字段。
 *
 * 用 Pick 而不是重新声明一遍：字段名或类型在 shared 里改了，这里立刻 typecheck
 * 报错，而不是安静地渲染 undefined。反过来 API 加字段也不会影响这边。
 */
export type LandingCard = Pick<
  ProjectCard,
  "slug" | "title" | "summary" | "tags" | "coverUrl" | "coverWidth" | "coverHeight" | "publishedAt"
>;

export type Locale = "zh" | "en";
/**
 * 卡片顶部那块视觉。
 *
 * placeholder = 这个作品在 share 里还没上传封面。它不是错误状态，是「去 share 补
 * 一张截图」的提示 —— 补了之后自动变 image，这边不用改代码。
 */
export type Visual = "image" | "terminal" | "placeholder";
/** 12 列栅格：wide=7、compact=5 正好一行；full=12 给落单的最后一张。 */
export type Size = "wide" | "compact" | "full";

export type LandingProject = {
  readonly slug: string;
  readonly name: string;
  readonly kicker: string;
  readonly desc: string;
  readonly status: string;
  readonly href: string;
  readonly tags: readonly string[];
  readonly visual: Visual;
  readonly size: Size;
  readonly cover: { readonly url: string; readonly width?: number; readonly height?: number } | null;
};

/** share 的作品页。卡片点进去到 share，而不是各自散落的 GitHub 链接。 */
const SHARE_ORIGIN = "https://share.wellorbetterai.com";

/** worker 在边缘请求的地址。limit 给 12：栅格一行两张，六行足够长了。 */
export const PROJECTS_FEED_URL = "https://api.wellorbetterai.com/api/projects?feed=latest&limit=12";

/** 注入的 <script> 的 id。worker 写、App.tsx 读，所以是常量而不是字面量。 */
export const PROJECTS_SCRIPT_ID = "wb-projects";

/**
 * API 给不出、但落地页要显示的东西，按 slug 补。
 *
 * 只有两类：英文文案（作品库里只存中文 summary），和少数几张没有封面截图的卡
 * 该画什么。**这是增强，不是门槛** —— slug 不在这张表里的作品照样渲染，只是
 * 英文版沿用中文 summary、视觉退化成空网格底。所以 share 里新发一个作品，这边
 * 不改代码也能上；想让它英文版好看，再来加一行。
 *
 * 真正的修法是让 API 存一份英文 summary，那天到了就删掉这张表。
 */
const PROJECT_COPY: Record<
  string,
  { kickerZh: string; kickerEn: string; summaryEn: string; visual?: Visual }
> = {
  timetrace: {
    kickerZh: "本地使用统计 + 日记",
    kickerEn: "Local activity tracking + journal",
    summaryEn:
      "Local-first Windows activity tracking and journaling, Rust core with a Flutter UI. No account, no cloud, no telemetry.",
  },
  cxs: {
    kickerZh: "Codex 会话定位 CLI",
    kickerEn: "Zero-token Codex session finder",
    summaryEn:
      "Finds the Codex session that was doing a specific job by reading local metadata only — zero tokens — then hands resume back to native Codex.",
    visual: "terminal",
  },
  "window-stats": {
    kickerZh: "DeepSeek Harness 插件",
    kickerEn: "DeepSeek Harness plugin",
    summaryEn:
      "Cross-session observability for tokens, cost, context pressure and duration, with drill-down analytics for a single session.",
  },
  "input-history": {
    kickerZh: "DeepSeek Harness 插件",
    kickerEn: "DeepSeek Harness plugin",
    summaryEn:
      "Arrow-key recall, grouped browsing and draft recovery for the DeepSeek Harness input box.",
  },
  ai: {
    kickerZh: "从调研到发布的闭环",
    kickerEn: "Research to release, closed loop",
    summaryEn:
      "An AI-native delivery loop: research, PRD and OpenSpec through parallel implementation, review, testing and a release audit.",
  },
};

/**
 * 收录的技术标签：认得出的技术名 → 展示写法。
 *
 * 这张表有两个作用，而且是同一个意思的两面：**收录过 = 这是个技术名**。
 *   - 展示：标签在作品库里是小写 slug（rust、dsh-plugin），直接显示很糙；
 *   - 排序：一张卡只放三个标签，收录过的排前面。
 *
 * 所以 rust / flutter / react 这些「机械首字母大写也能对」的也要在表里 —— 它们
 * 在这儿不是为了大小写，是为了排在 agent-team、product-workflow 这类领域标签
 * 前面。删掉它们不会让大小写变错，只会让卡片上显示的三个标签变没用（第一版就
 * 是这么写的，测试逮住了）。
 *
 * 表里没有的按 "-" 拆开首字母大写（agent-team → Agent Team）。
 */
const TAG_LABELS: Record<string, string> = {
  ai: "AI",
  "ai-native": "AI Native",
  api: "API",
  cli: "CLI",
  cloudflare: "Cloudflare",
  dart: "Dart",
  deepseek: "DeepSeek",
  "deepseek-harness": "DeepSeek Harness",
  dsh: "DSH",
  "dsh-plugin": "DSH Plugin",
  flutter: "Flutter",
  go: "Go",
  java: "Java",
  javascript: "JavaScript",
  kotlin: "Kotlin",
  "local-first": "Local-first",
  python: "Python",
  r2: "R2",
  react: "React",
  rust: "Rust",
  sqlite: "SQLite",
  swift: "Swift",
  tauri: "Tauri",
  typescript: "TypeScript",
  ui: "UI",
  wasm: "WebAssembly",
  windows: "Windows",
};

export function tagLabel(tag: string): string {
  return (
    TAG_LABELS[tag] ??
    tag
      .split("-")
      .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
      .join(" ")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * 一条 unknown → LandingCard，形状不对就 null（这一条丢掉，其余照常渲染）。
 *
 * 逐条校验而不是整体 `as`：API 是另一个仓库部署的，某天多返回一条 summary 为
 * null 的记录，整页不该因此白屏。
 */
function toCard(value: unknown): LandingCard | null {
  if (!isRecord(value)) return null;
  const { slug, title, summary, tags, coverUrl } = value;
  if (typeof slug !== "string" || !slug) return null;
  if (typeof title !== "string" || !title) return null;
  if (typeof summary !== "string") return null;
  return {
    slug,
    title,
    summary,
    tags: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [],
    coverUrl: typeof coverUrl === "string" && coverUrl ? coverUrl : null,
    coverWidth: optionalNumber(value.coverWidth),
    coverHeight: optionalNumber(value.coverHeight),
    publishedAt: optionalNumber(value.publishedAt),
  };
}

/**
 * `{ items: [...] }`（API 的响应体）→ 卡片数组。
 *
 * 一条都没有就返回 null，调用方会退回快照。空数组和「拿不到」在这里是同一种
 * 结果，因为对个人主页来说，一个空的 RECENT SHIPS 区块比几张旧卡片更难看。
 */
export function parseProjectCards(payload: unknown): LandingCard[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.items)) return null;
  const cards = payload.items.map(toCard).filter((card): card is LandingCard => card !== null);
  return cards.length > 0 ? cards : null;
}

/**
 * 注入进 <head> 的那个 <script type="application/json">。
 *
 * 一个 `</script>` 出现在 JSON 字符串里会把标签提前闭合，所以每个 `<` 都换成
 * 反斜杠 u003c —— 这在 JSON 里是合法转义，JSON.parse 回来还是 `<`。顺带也挡住
 * 了 `<!--`。这不是理论问题：summary 和标签都是用户自己填的。
 */
export function projectsScriptTag(cards: readonly LandingCard[]): string {
  const json = JSON.stringify(cards).replace(/</g, "\\u003c");
  return `<script type="application/json" id="${PROJECTS_SCRIPT_ID}">${json}</script>`;
}

/** 读回 worker 注入的那份。没有（vite dev、注入失败）就 null。 */
export function injectedProjectCards(doc: Document): LandingCard[] | null {
  const text = doc.getElementById(PROJECTS_SCRIPT_ID)?.textContent;
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;
    const cards = parsed.map(toCard).filter((card): card is LandingCard => card !== null);
    return cards.length > 0 ? cards : null;
  } catch {
    return null;
  }
}

/** 已发布月份，mono 小字那一行。API 只返回 published 的，所以基本都有值。 */
function publishedLabel(publishedAt: number | null, locale: Locale): string {
  if (publishedAt === null) return locale === "zh" ? "已发布" : "Shipped";
  const date = new Date(publishedAt);
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * 栅格里的第几张该用多宽。
 *
 * 12 列，wide(7) + compact(5) 铺满一行，逐行交替起手，视觉节奏跟原来手写的六张
 * 一致。张数是奇数时最后一张占满整行 —— 否则那行会留一个 5 列的空洞。
 */
function sizeAt(index: number, total: number): Size {
  if (index === total - 1 && total % 2 === 1) return "full";
  const wideFirst = Math.floor(index / 2) % 2 === 0;
  const isFirstOfRow = index % 2 === 0;
  return isFirstOfRow === wideFirst ? "wide" : "compact";
}

/** 有封面的排前面：一张真截图比空网格底强，而空的那些沉到后面不打断节奏。 */
function byCoverThenRecency(a: LandingCard, b: LandingCard): number {
  const cover = Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl));
  return cover !== 0 ? cover : (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
}

/**
 * 卡片的展示顺序。栅格和 meta description 都用它 —— 这两处不能各排一遍。
 *
 * 不排的话 description 里会是 API 的返回顺序（最新的在前），于是那句介绍开头是
 * 两个连封面都没有的作品；页面上第一眼看到的却是另外三个。同一个页面，两个顺序。
 */
export function orderedCards(cards: readonly LandingCard[]): LandingCard[] {
  return [...cards].sort(byCoverThenRecency);
}

/** 标签取前三个，收录过的技术名优先 —— 见 TAG_LABELS 上面那段。 */
function displayTags(tags: readonly string[]): string[] {
  return [...tags]
    .sort((a, b) => Number(b in TAG_LABELS) - Number(a in TAG_LABELS))
    .slice(0, 3)
    .map(tagLabel);
}

export function toLandingProjects(
  cards: readonly LandingCard[],
  locale: Locale,
): LandingProject[] {
  const ordered = orderedCards(cards);
  return ordered.map((card, index) => {
    const copy = PROJECT_COPY[card.slug];
    return {
      slug: card.slug,
      name: card.title,
      // 没有英文文案就留空，而不是把中文 kicker 塞进英文版 —— 中文 summary 已经
      // 在 desc 上兜底了，这里再来一句中文只是提示「这条没翻译」，没有信息量。
      kicker: copy ? (locale === "zh" ? copy.kickerZh : copy.kickerEn) : "",
      desc: locale === "en" ? (copy?.summaryEn ?? card.summary) : card.summary,
      status: publishedLabel(card.publishedAt, locale),
      href: `${SHARE_ORIGIN}/p/${encodeURIComponent(card.slug)}`,
      tags: displayTags(card.tags),
      visual: card.coverUrl ? "image" : (copy?.visual ?? "placeholder"),
      size: sizeAt(index, ordered.length),
      cover: card.coverUrl
        ? {
            url: card.coverUrl,
            ...(card.coverWidth ? { width: card.coverWidth } : {}),
            ...(card.coverHeight ? { height: card.coverHeight } : {}),
          }
        : null,
    };
  });
}

/**
 * share 的 API 拿不到时用的快照。
 *
 * 刻意跟线上是同一批作品、同一个形状（LandingCard[]），所以渲染只有一条代码
 * 路径 —— 兜底走的是别的形状的话，那条路径会烂掉而没人发现。
 *
 * 会过期，这是知情的取舍：过期的封面截图比空区块好。刷新它：
 *
 *     curl -s 'https://api.wellorbetterai.com/api/projects?feed=latest&limit=12' \
 *       | python3 -m json.tool
 *
 * 最后一次取：2026-09-19。
 */
export const PROJECT_SNAPSHOT: readonly LandingCard[] = [
  {
    slug: "timetrace",
    title: "TimeTrace",
    summary: "本地优先的 Windows 使用统计与日记应用：Rust + Flutter，无账号、无云端、无遥测。",
    tags: ["activity-tracker", "desktop-app", "flutter", "journal", "local-first", "privacy", "productivity", "rust"],
    coverUrl: "https://api.wellorbetterai.com/api/project-media/b437a780-4ef4-4bf9-a89e-9a1e2f08f3c9",
    coverWidth: 1272,
    coverHeight: 947,
    publishedAt: 1787524756759,
  },
  {
    slug: "window-stats",
    title: "Window Stats",
    summary: "为 DeepSeek Harness 提供跨会话 Token、成本、上下文与耗时分析的一站式可观测面板。",
    tags: ["analytics", "deepseek", "deepseek-harness", "dsh", "dsh-plugin", "javascript", "observability", "token-analytics"],
    coverUrl: "https://api.wellorbetterai.com/api/project-media/83b0e3a2-1f8b-498d-9490-008aecbffad6",
    coverWidth: 3000,
    coverHeight: 1800,
    publishedAt: 1787525033135,
  },
  {
    slug: "input-history",
    title: "Input History",
    summary: "为 DeepSeek Harness 补齐方向键召回、分组浏览与草稿恢复的高效输入历史体验。",
    tags: ["dsh-plugin", "javascript"],
    coverUrl: "https://api.wellorbetterai.com/api/project-media/ce0e764a-dc79-4399-8049-1e9cbed6d266",
    coverWidth: 1120,
    coverHeight: 1120,
    publishedAt: 1787525080571,
  },
  {
    slug: "ai",
    title: "AI 原生产品交付工作流",
    summary: "从调研、PRD、OpenSpec 到并行开发、评审、测试和发布审计的 AI 原生交付闭环。",
    tags: ["agent-team", "ai-native", "claude-skill", "deepseek-harness", "dsh-plugin", "multi-agent", "product-workflow", "skills"],
    coverUrl: null,
    coverWidth: null,
    coverHeight: null,
    publishedAt: 1787525107075,
  },
  {
    slug: "cxs",
    title: "CXS",
    summary: "零 Token、本地只读地定位 Codex 会话意图、状态与结果，并安全交给原生 Codex 恢复。",
    tags: ["rust"],
    coverUrl: null,
    coverWidth: null,
    coverHeight: null,
    publishedAt: 1787525129827,
  },
];

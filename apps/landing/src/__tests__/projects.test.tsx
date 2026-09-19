// @vitest-environment jsdom
/**
 * 落地页作品卡片：以 share 的作品库为唯一真相源。
 *
 * ── 为什么需要这个文件 ──────────────────────────────────────────────────────
 * 同一批作品以前在三个地方各写了一份（share 的数据库、App.tsx 的 copy.zh/copy.en
 * 两个数组、routes.ts 的 og:description），而没有任何测试会因为它们不一致而红。
 * 事实上它们已经漂了：落地页手写的 6 张卡里有 3 个作品库里根本没有，作品库里有
 * 2 个落地页上看不到。
 *
 * 所以这里钉的是「不一致会静默发生」的那几处：
 *   1. 数据链路：API 响应 → 注入的 <script> → 客户端读回来，中间任何一环断掉都
 *      要退回快照，不能白屏，也不能渲染 undefined；
 *   2. 注入的 JSON 不能被作品描述里的 </script> 提前闭合（summary 是用户填的）；
 *   3. 栅格铺得满（张数变化时不留空洞）；
 *   4. App.tsx 里不能再出现写死的作品名单 —— 这条是防回归的主力。
 */

import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import App from "../App.js";
import appSource from "../App.tsx?raw";
import wranglerConfig from "../../wrangler.toml?raw";
import {
  PROJECTS_SCRIPT_ID,
  PROJECT_SNAPSHOT,
  injectedProjectCards,
  orderedCards,
  parseProjectCards,
  projectsScriptTag,
  tagLabel,
  toLandingProjects,
} from "../projects.js";
import type { LandingCard } from "../projects.js";
import { labMeta } from "../routes.js";

/**
 * 从线上 `GET /api/projects?feed=latest` 抄下来的真实响应（2026-09-19），只留了
 * 两条：一条有封面、一条没有。手写一个「我以为 API 长这样」的 fixture 是这类
 * 测试最常见的失效方式 —— 它会跟着我的误解一起绿。
 */
const API_RESPONSE = {
  items: [
    {
      id: "c862567a-2c94-48ae-8f4e-beb88eb616cb",
      slug: "timetrace",
      title: "TimeTrace",
      summary: "本地优先的 Windows 使用统计与日记应用：Rust + Flutter，无账号、无云端、无遥测。",
      authorId: "u_ea728a7d-eac5-4d72-870b-b5dc698c4401",
      authorName: "wellorbetter",
      coverUrl: "https://api.wellorbetterai.com/api/project-media/b437a780-4ef4-4bf9-a89e-9a1e2f08f3c9",
      githubStars: null,
      coverWidth: 1272,
      coverHeight: 947,
      tags: ["flutter", "local-first", "rust"],
      status: "published",
      publishedAt: 1787524756759,
      createdAt: 1787523583488,
      updatedAt: 1787524756759,
    },
    {
      id: "6e9fdd57-a22d-4373-8922-a4f8e0ec998d",
      slug: "cxs",
      title: "CXS",
      summary: "零 Token、本地只读地定位 Codex 会话意图、状态与结果，并安全交给原生 Codex 恢复。",
      authorId: "u_ea728a7d-eac5-4d72-870b-b5dc698c4401",
      authorName: "wellorbetter",
      coverUrl: null,
      githubStars: null,
      coverWidth: null,
      coverHeight: null,
      tags: ["rust"],
      status: "published",
      publishedAt: 1787525129827,
      createdAt: 1787525128448,
      updatedAt: 1787525129827,
    },
  ],
  nextCursor: null,
};

const card = (over: Partial<LandingCard> = {}): LandingCard => ({
  slug: "x",
  title: "X",
  summary: "s",
  tags: [],
  coverUrl: null,
  coverWidth: null,
  coverHeight: null,
  publishedAt: 1787525129827,
  ...over,
});

describe("解析 API 响应", () => {
  it("认得线上真实的响应体", () => {
    const cards = parseProjectCards(API_RESPONSE);
    expect(cards?.map((c) => c.slug)).toEqual(["timetrace", "cxs"]);
    expect(cards?.[0]).toMatchObject({ title: "TimeTrace", coverWidth: 1272, coverHeight: 947 });
    // 没封面的那条三个字段都要是 null，而不是 undefined —— 后面要靠它分支。
    expect(cards?.[1]).toMatchObject({ coverUrl: null, coverWidth: null, coverHeight: null });
  });

  it("形状不对就返回 null，让调用方退回快照", () => {
    for (const payload of [null, undefined, 42, "items", {}, { items: null }, { items: {} }, { items: [] }]) {
      expect(parseProjectCards(payload), JSON.stringify(payload) ?? "undefined").toBeNull();
    }
  });

  it("只丢掉坏的那几条，不是整页白掉", () => {
    // API 是另一个仓库部署的。某天多返回一条 summary 为 null 的记录，落地页不该
    // 因此空掉 —— 好的那条照常渲染。
    const cards = parseProjectCards({
      items: [
        { slug: "ok", title: "OK", summary: "" },
        { slug: "", title: "无 slug", summary: "x" },
        { slug: "no-title", summary: "x" },
        { slug: "null-summary", title: "T", summary: null },
        "不是对象",
        null,
      ],
    });
    expect(cards?.map((c) => c.slug)).toEqual(["ok"]);
  });

  it("标签里混进非字符串不会传到渲染层", () => {
    const cards = parseProjectCards({
      items: [{ slug: "a", title: "A", summary: "s", tags: ["rust", 7, null, "cli"] }],
    });
    expect(cards?.[0]?.tags).toEqual(["rust", "cli"]);
  });

  it("快照本身是合法输入", () => {
    // 快照会手工更新，所以它自己也可能被改坏。这条让「改坏了」变成红的。
    expect(parseProjectCards({ items: PROJECT_SNAPSHOT })).toHaveLength(PROJECT_SNAPSHOT.length);
  });
});

describe("注入 HTML 的那段 JSON", () => {
  it("作品描述里的 </script> 不会把标签提前闭合", () => {
    // summary、title、标签都是用户自己在 share 上填的，所以这不是理论问题。
    const evil = card({ slug: "p", title: "</script><script>alert(1)</script>", summary: "<!--x-->" });
    const tag = projectsScriptTag([evil]);

    // 整段里只允许出现一个 "</script"，就是结尾那个闭合标签。
    expect([...tag.matchAll(/<\/script/g)]).toHaveLength(1);
    expect(tag).not.toContain("<!--");
    expect(tag.endsWith("</script>")).toBe(true);
  });

  it("转义过的 JSON 还能原样解析回来", () => {
    // 转义得过头（比如手工 HTML escape）会把标题变成 &lt;script&gt; 那种乱码，
    // 所以要验的是「既没提前闭合，又没改内容」。
    const evil = card({ title: "</script>", summary: "a < b && c > d" });
    const inner = projectsScriptTag([evil]).replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
    expect(JSON.parse(inner)).toEqual([evil]);
  });

  it("浏览器真的能把注入的那段读回来", () => {
    // 这一条走的是完整链路：worker 生成的字符串 → 真的 HTML 解析 → 客户端读取。
    // 只对字符串做断言的话，一个非法的 script 标签照样能过。
    document.head.innerHTML = projectsScriptTag([card({ slug: "roundtrip", title: "</script>" })]);
    expect(document.getElementById(PROJECTS_SCRIPT_ID)?.getAttribute("type")).toBe("application/json");
    expect(injectedProjectCards(document)?.[0]).toMatchObject({ slug: "roundtrip", title: "</script>" });
    document.head.innerHTML = "";
  });

  it("没有注入、或者注入的是垃圾，都返回 null", () => {
    // vite dev 不经过 worker，走的就是第一条。
    expect(injectedProjectCards(document)).toBeNull();
    for (const body of ["", "not json", "{}", "[]", '[{"slug":""}]']) {
      document.head.innerHTML = `<script type="application/json" id="${PROJECTS_SCRIPT_ID}">${body}</script>`;
      expect(injectedProjectCards(document), body).toBeNull();
    }
    document.head.innerHTML = "";
  });
});

describe("投影成卡片", () => {
  const cards = parseProjectCards(API_RESPONSE)!;

  it("卡片点进去到 share 的作品页，而不是散落的 GitHub 链接", () => {
    // 「以 share 为准」的一半意义在这里：链接也只有一个来源。
    expect(toLandingProjects(cards, "zh").map((p) => p.href)).toEqual([
      "https://share.wellorbetterai.com/p/timetrace",
      "https://share.wellorbetterai.com/p/cxs",
    ]);
  });

  it("slug 会被转义，不会拼出一个坏 URL", () => {
    expect(toLandingProjects([card({ slug: "a b/c" })], "zh")[0]?.href).toBe(
      "https://share.wellorbetterai.com/p/a%20b%2Fc",
    );
  });

  it("中文版用作品库里的 summary，英文版用补的英文文案", () => {
    const zh = toLandingProjects(cards, "zh");
    const en = toLandingProjects(cards, "en");
    expect(zh[0]?.desc).toBe(cards[0]!.summary);
    expect(en[0]?.desc).not.toBe(cards[0]!.summary);
    expect(en[0]?.desc).toMatch(/Local-first/);
    // 标题和状态跟语言无关，两边必须一致 —— 它们是数据，不是文案。
    expect(en.map((p) => p.name)).toEqual(zh.map((p) => p.name));
    expect(en.map((p) => p.status)).toEqual(zh.map((p) => p.status));
  });

  it("补充文案表里没有的作品照样渲染", () => {
    // 这条是「share 里新发一个作品，这边不用改代码」的保证。
    const fresh = card({ slug: "brand-new", title: "Brand New", summary: "刚发的" });
    for (const locale of ["zh", "en"] as const) {
      const [project] = toLandingProjects([fresh], locale);
      expect(project?.name, locale).toBe("Brand New");
      expect(project?.desc, locale).toBe("刚发的");
      expect(project?.kicker, locale).toBe("");
    }
  });

  it("状态显示发布年月", () => {
    expect(toLandingProjects([card({ publishedAt: Date.UTC(2026, 8, 19) })], "zh")[0]?.status).toBe("2026.09");
    expect(toLandingProjects([card({ publishedAt: null })], "zh")[0]?.status).toBe("已发布");
    expect(toLandingProjects([card({ publishedAt: null })], "en")[0]?.status).toBe("Shipped");
  });

  it("有封面的排前面，并且带上原始像素尺寸", () => {
    const [first, second] = toLandingProjects(cards, "zh");
    expect(first?.cover).toEqual({ url: cards[0]!.coverUrl, width: 1272, height: 947 });
    expect(second?.cover).toBeNull();
    // 没有封面时退化成 copy 表里声明的视觉（cxs 是终端 mock）。
    expect(second?.visual).toBe("terminal");
    // 既没封面、copy 表里也没声明 → placeholder，CSS 靠这个类决定整行宽的卡不画
    // 那块空网格底（见 styles.css 的 .project-card--full.project-card--placeholder）。
    expect(toLandingProjects([card()], "zh")[0]?.visual).toBe("placeholder");
  });

  it("标签取前三个，小写 slug 变成认得出的技术名", () => {
    expect(tagLabel("dsh-plugin")).toBe("DSH Plugin");
    expect(tagLabel("javascript")).toBe("JavaScript");
    // 表里没有的按 "-" 拆开首字母大写，而不是原样显示小写 slug。
    expect(tagLabel("agent-team")).toBe("Agent Team");
    const many = card({ tags: ["agent-team", "ai-native", "product-workflow", "rust"] });
    const tags = toLandingProjects([many], "zh")[0]?.tags;
    expect(tags).toHaveLength(3);
    // 收录过的技术名优先 —— 按字母序取前三会把 rust 挤掉。第一版把 rust 漏在了
    // TAG_LABELS 外面（它的机械大写本来就对），于是这条红了，那是对的。
    expect(tags).toContain("Rust");
  });
});

describe("栅格铺满", () => {
  const SPAN = { wide: 7, compact: 5, full: 12 } as const;

  it("任意张数都不留空洞、也不溢出 12 列", () => {
    // 作品数跟着 share 变，所以布局不能只在「刚好六张」时对。
    for (let total = 1; total <= 12; total += 1) {
      const projects = toLandingProjects(
        Array.from({ length: total }, (_, i) => card({ slug: `s${i}` })),
        "zh",
      );
      let row = 0;
      for (const project of projects) {
        row += SPAN[project.size];
        expect(row, `${total} 张时第 ${projects.indexOf(project) + 1} 张溢出了`).toBeLessThanOrEqual(12);
        if (row === 12) row = 0;
      }
      expect(row, `${total} 张时最后一行只填了 ${row}/12`).toBe(0);
    }
  });

  it("保留原来手写六张时的宽窄节奏", () => {
    // wide/compact 逐行交替起手是设计过的视觉节奏，不是随便排的。
    const projects = toLandingProjects(
      Array.from({ length: 6 }, (_, i) => card({ slug: `s${i}` })),
      "zh",
    );
    expect(projects.map((p) => p.size)).toEqual(["wide", "compact", "compact", "wide", "wide", "compact"]);
  });
});

describe("落地页渲染", () => {
  function render(injected: readonly LandingCard[] | null): HTMLElement {
    document.head.innerHTML = injected ? projectsScriptTag(injected) : "";
    const host = document.createElement("div");
    document.body.appendChild(host);
    act(() => {
      createRoot(host).render(<App />);
    });
    return host;
  }

  const cardTitles = (host: HTMLElement): string[] =>
    [...host.querySelectorAll(".projects-grid .project-card h3")].map((el) => el.textContent ?? "");

  it("优先用 worker 注入的那份数据", () => {
    const host = render([card({ slug: "only", title: "Injected Only" })]);
    expect(cardTitles(host)).toEqual(["Injected Only"]);
    // 快照里的东西不该同时出现 —— 那说明两个来源被拼在了一起。
    expect(host.textContent).not.toContain("TimeTrace");
  });

  it("没注入就退回快照，而不是一个空的 RECENT SHIPS", () => {
    const host = render(null);
    // 顺序由 toLandingProjects 决定（有封面的排前面），所以按集合比。
    expect([...cardTitles(host)].sort()).toEqual([...PROJECT_SNAPSHOT.map((c) => c.title)].sort());
  });

  it("每张卡都链到 share，并且封面带 width/height", () => {
    const host = render(null);
    const links = [...host.querySelectorAll<HTMLAnchorElement>(".projects-grid .project-card")];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\/share\.wellorbetterai\.com\/p\//);
    }
    for (const img of host.querySelectorAll<HTMLImageElement>(".project-image")) {
      // 封面是外部 URL、尺寸差别很大（实测有一张 3000×1800），没有这两个属性
      // 浏览器就不知道留多大的框。作品库已经存了原始尺寸，白拿的东西不要浪费。
      expect(img.getAttribute("width"), img.src).toBeTruthy();
      expect(img.getAttribute("height"), img.src).toBeTruthy();
      expect(img.getAttribute("loading")).toBe("lazy");
    }
  });

  it("「最近在做」那张卡也是真数据", () => {
    // 它以前是第三份手写名单，跟下面的作品网格各说各话。
    const host = render([
      card({ slug: "a", title: "First" }),
      card({ slug: "b", title: "Second" }),
      card({ slug: "c", title: "Third" }),
      card({ slug: "d", title: "Fourth" }),
    ]);
    const signals = [...host.querySelectorAll(".signal-item strong")].map((el) => el.textContent);
    expect(signals).toEqual(["First", "Second", "Third"]);
  });

  it("App.tsx 里不再有写死的作品名单", () => {
    // 这条是防回归的主力：上面所有断言都能在「有人又把六张卡抄回代码里」的情况
    // 下继续绿，只要那份副本没被渲染。所以直接对源码断言。
    expect(appSource).not.toContain("raw.githubusercontent.com");
    // 具体仓库链接（带斜杠）才算副本；导航栏那个 github.com/wellorbetter 是主页。
    expect(appSource).not.toMatch(/github\.com\/wellorbetter\//);
    expect(appSource).not.toContain("TimeTrace");
  });
});

describe("根路径必须真的经过 worker", () => {
  it("wrangler.toml 里 run_worker_first 覆盖 /", () => {
    // 这条是全文件里唯一能逮住那个坑的断言，所以单独一组写清楚：资源命中时
    // Workers Assets 默认**不执行 worker**，于是 / 直接吐 dist/index.html ——
    // 注入的 <script> 和改写过的 meta 全都不会出现，而所有单元测试照样绿（它们
    // 测的是纯函数），线上也不报错，只是安静地少了一块。实测过：加这行之前
    // curl / 拿不到 wb-projects，加了之后拿到 5 张卡。
    const line = wranglerConfig.split("\n").find((l) => l.trim().startsWith("run_worker_first"));
    expect(line, "wrangler.toml 里没有 run_worker_first").toBeTruthy();
    expect(line).toMatch(/"\/"/);
  });
});

describe("meta description 也跟着真数据走", () => {
  it("有作品列表时列真的作品名", () => {
    const meta = labMeta(["甲", "乙", "丙", "丁", "戊"]);
    expect(meta.description).toContain("甲、乙、丙、丁");
    // 只取前四个：超过 ~160 字符会被搜索结果截断。
    expect(meta.description).not.toContain("戊");
  });

  it("名单顺序和页面上的卡片顺序是同一个", () => {
    // worker 取到的是 API 顺序（最新在前），而栅格按「有封面的在前」重排。各排一遍
    // 的话，那句介绍开头是两个连封面都没有的作品，页面第一眼看到的却是另外几个。
    const cards = parseProjectCards(API_RESPONSE)!;
    const rendered = toLandingProjects(cards, "zh").map((p) => p.name);
    const named = orderedCards(cards).map((c) => c.title);
    expect(named).toEqual(rendered);
    expect(labMeta(named).description).toContain(rendered.slice(0, 4).join("、"));
  });

  it("拿不到列表时退回写死的那份", () => {
    // index.html 里的静态 meta 是同一份（routes.test.ts 钉了这个等式），所以
    // 边缘改写失败时兜到的还是这个域名真正的主人。
    expect(labMeta().description).toBe(labMeta([]).description);
    expect(labMeta().description).toContain("TimeTrace");
  });
});

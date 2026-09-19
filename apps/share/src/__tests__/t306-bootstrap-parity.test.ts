import { describe, it, expect, beforeEach } from "vitest";
import htmlSource from "../../index.html?raw";
import bootSource from "../../public/theme-boot.js?raw";
import appearanceSource from "../lib/appearance.ts?raw";
import themeSource from "../../../../packages/design/src/theme.ts?raw";
import { BACKGROUND_PRESETS } from "../lib/appearance";

/**
 * T306 follow-up: pin the no-flash bootstrap to its source of truth.
 *
 * theme-boot.js duplicates the preset gradients as literal strings because it
 * runs before the bundle exists and cannot import them. If the two copies drift,
 * the bootstrap paints the OLD gradient on first load and React then swaps it —
 * a flash of the *wrong* background, which is the exact thing the bootstrap
 * exists to prevent. Worse, it only shows on a cold load with a non-default
 * preset already stored, so no screenshot of the running app would catch it.
 *
 * The duplication is load-bearing and cannot just be deleted, so it is pinned
 * here instead. Edit a preset in appearance.ts and this test names which literal
 * in theme-boot.js to update.
 *
 * Sources are pulled in with Vite's `?raw` rather than node:fs — this workspace
 * typechecks with `types: ["vite/client"]` and no node types.
 */
describe("T306 background preset bootstrap parity", () => {
  const mapBlock = bootSource.match(/var map = \{([\s\S]*?)\n\s*\};/);
  const scriptMap: Record<string, string> = {};
  for (const m of (mapBlock?.[1] ?? "").matchAll(/(\w+):\s*\n?\s*"([^"]*)"/g)) {
    const [, id, css] = m;
    if (id !== undefined && css !== undefined) scriptMap[id] = css;
  }

  const presets = BACKGROUND_PRESETS.filter((p) => p.css !== "none");

  it("locates the bootstrap preset map in theme-boot.js", () => {
    expect(mapBlock, "could not find `var map = {...}` in theme-boot.js").not.toBeNull();
    expect(Object.keys(scriptMap).length).toBeGreaterThan(0);
  });

  it("bootstrap covers exactly the non-default presets", () => {
    expect(Object.keys(scriptMap).sort()).toEqual(presets.map((p) => p.id).sort());
  });

  for (const preset of presets) {
    it(`${preset.id}: theme-boot.js literal matches appearance.ts exactly`, () => {
      expect(scriptMap[preset.id]).toBe(preset.css);
    });
  }

  it("bootstrap reads the same keys its sources of truth write", () => {
    // wb-theme 的主人搬去了 packages/design（四个站共用的 cookie），
    // wb-bg 还是 share 自己的。两个名字都得在 bootstrap 里出现，否则它读的是
    // 别人没写的东西 —— 而那种错法不会报错，只会让首屏闪回默认值。
    expect(themeSource, 'packages/design/src/theme.ts should own the "wb-theme" key').toContain(
      '"wb-theme"',
    );
    expect(appearanceSource, 'appearance.ts should own the "wb-bg" key').toContain('"wb-bg"');
    for (const key of ["wb-theme", "wb-bg"]) {
      expect(bootSource, `theme-boot.js should read "${key}"`).toContain(`"${key}"`);
    }
  });
});

/**
 * bootstrap 现在自己解析 cookie（因为 import 不了 design 那份），所以光对比
 * 字面量已经不够了 —— 逻辑也会漂。下面这组把它**真的跑一遍**。
 *
 * 不需要造假的 document / localStorage：这个 workspace 的 vitest 跑在 jsdom
 * 里，document.cookie 和 localStorage 都是真的，boot 用的也正是这两个全局。
 */
describe("theme-boot.js 的实际行为", () => {
  function runBoot(): void {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(bootSource)();
  }

  beforeEach(() => {
    for (const pair of document.cookie.split(";")) {
      const name = pair.split("=")[0]?.trim();
      if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
    }
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("--app-bg-image");
  });

  it("读跨子域 cookie —— 这是整件事的目的", () => {
    document.cookie = "wb-theme=dark; Path=/";
    runBoot();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("cookie 赢 localStorage（上次可能是在博客上改的）", () => {
    localStorage.setItem("wb-theme", "light");
    document.cookie = "wb-theme=dark; Path=/";
    runBoot();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("只有 localStorage 时仍然认 —— 老访客的选择不能被这次发布清空", () => {
    localStorage.setItem("wb-theme", "dark");
    runBoot();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("名字不能是包含匹配", () => {
    document.cookie = "my-wb-theme=dark; Path=/";
    runBoot();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("system / 没选过 / 垃圾值都不写属性", () => {
    // 属性没写才等于跟随系统。写一个此刻算出来的具体值，访客在页面开着的时候
    // 切系统主题就不跟了 —— 这正是搬到 cookie 之前的旧行为。
    for (const value of ["system", "sepia"]) {
      document.documentElement.setAttribute("data-theme", "dark"); // 脏状态
      document.cookie = `wb-theme=${value}; Path=/`;
      runBoot();
      expect(document.documentElement.hasAttribute("data-theme"), value).toBe(false);
    }
    document.cookie = "wb-theme=; Path=/; Max-Age=0";
    document.documentElement.setAttribute("data-theme", "dark");
    runBoot();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("背景预设也在首屏就写上", () => {
    localStorage.setItem("wb-bg", "aurora");
    runBoot();
    const preset = BACKGROUND_PRESETS.find((p) => p.id === "aurora")!;
    expect(document.documentElement.style.getPropertyValue("--app-bg-image")).toBe(preset.css);
  });
});

/**
 * 上面那组测试全绿了很久，而 bootstrap 一次都没有执行过。
 *
 * index.html 自己用 <meta> 声明了 `script-src 'self'`，不带 'unsafe-inline'，
 * 而 bootstrap 当时是内联的 —— 浏览器静默拦掉，只在 console 留一条
 * `script-src-elem` 违规。页面看起来是好的（React 挂载后会补上主题），所以
 * 唯一的症状是深色用户每次打开先闪一下浅色，正好是这段代码存在的唯一目的。
 *
 * 教训是：验内容的测试不会告诉你这段内容根本没跑。下面这组钉的是「能不能
 * 跑」，不是「写了什么」。
 */
describe("T306 bootstrap is executable under the page's own CSP", () => {
  const csp = htmlSource.match(/http-equiv="Content-Security-Policy"\s*\n?\s*content="([^"]*)"/)?.[1];
  const scriptSrc = csp?.match(/script-src ([^;]*)/)?.[1]?.trim();

  it("index.html declares a script-src", () => {
    expect(csp, "could not find the CSP meta tag in index.html").toBeDefined();
    expect(scriptSrc, "could not find script-src in the CSP").toBeDefined();
  });

  it("index.html contains no inline <script> while script-src lacks 'unsafe-inline'", () => {
    if (scriptSrc?.includes("'unsafe-inline'")) return; // 放宽了的话这条就不适用
    // `<script>` 或 `<script >`（无属性）= 内联。有 src= 的是外部脚本。
    const inline = [...htmlSource.matchAll(/<script(\s[^>]*)?>/g)].filter(
      (m) => !/\bsrc=/.test(m[1] ?? ""),
    );
    expect(
      inline,
      "内联脚本会被这个页面自己的 CSP 静默拦掉 —— 放进 public/ 当外部文件",
    ).toHaveLength(0);
  });

  it("loads the bootstrap as a same-origin script, before the bundle", () => {
    const bootAt = htmlSource.indexOf('src="/theme-boot.js"');
    expect(bootAt, "index.html 没有引用 /theme-boot.js").toBeGreaterThan(-1);

    const moduleAt = htmlSource.search(/<script type="module"/);
    expect(moduleAt).toBeGreaterThan(-1);
    expect(bootAt, "bootstrap 必须排在 bundle 前面，否则它防不住闪烁").toBeLessThan(moduleAt);
  });

  it("does not defer the bootstrap past first paint", () => {
    const tag = htmlSource.match(/<script[^>]*src="\/theme-boot\.js"[^>]*>/)?.[0] ?? "";
    // defer/async 都会让它排到绘制之后，那就等于没有这个文件。
    expect(tag).not.toMatch(/\bdefer\b/);
    expect(tag).not.toMatch(/\basync\b/);
    expect(tag).not.toMatch(/type="module"/); // module 隐含 defer
  });
});

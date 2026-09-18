import { describe, it, expect } from "vitest";
import htmlSource from "../../index.html?raw";
import bootSource from "../../public/theme-boot.js?raw";
import appearanceSource from "../lib/appearance.ts?raw";
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

  it("bootstrap reads the same localStorage keys the module writes", () => {
    for (const key of ["wb-theme", "wb-bg"]) {
      expect(appearanceSource, `appearance.ts should own the "${key}" key`).toContain(`"${key}"`);
      expect(bootSource, `theme-boot.js should read "${key}"`).toContain(`"${key}"`);
    }
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

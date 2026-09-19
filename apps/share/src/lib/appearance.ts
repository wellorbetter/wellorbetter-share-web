/**
 * 外观：背景预设（T306）+ 明暗选择的转发层。
 *
 * ── 明暗不在这里了 ─────────────────────────────────────────────────────────
 * 明暗选择搬到了 packages/design/src/theme.ts，因为它跨四个站：落地页、
 * vibecoding、share、blog 共用一个 `wb-theme` cookie（Domain=.wellorbetterai.com）。
 * 原来存在 localStorage 里，而 localStorage 按 origin 隔离 —— 访客在 share 上
 * 选了深色，翻到 blog.wellorbetterai.com 又变回浅色。那不是 bug，是
 * localStorage 的定义。博客那边在服务端读同一个 cookie 直接渲进 <html>。
 *
 * 背景预设留在这里：它只有 share 有，落地页和博客没有这个概念。
 *
 * ── 首屏不闪 ───────────────────────────────────────────────────────────────
 * public/theme-boot.js 在 bundle 之前跑，把主题和背景先写上。它在 public/ 而
 * 不是内联在 index.html 里，是因为页面自己声明了 `script-src 'self'`（没有
 * 'unsafe-inline'）—— 内联的时候它被静默拦掉，从来没执行过。见
 * __tests__/t306-bootstrap-parity.test.ts。
 */

import {
  applyThemeChoice,
  readThemeChoice,
  writeThemeChoice,
  type ThemeChoice,
} from "@wellorbetter/design";

export type { ThemeChoice };

export interface BackgroundPreset {
  id: string;
  label: string;
  /** CSS value for --app-bg-image (background-image). */
  css: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "none", label: "默认", css: "none" },
  {
    id: "aurora",
    label: "极光",
    css:
      "radial-gradient(1200px 600px at 10% -10%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 60%)," +
      "radial-gradient(1000px 500px at 110% 20%, color-mix(in srgb, var(--secondary) 18%, transparent), transparent 55%)",
  },
  {
    id: "mesh",
    label: "网格",
    css:
      "radial-gradient(600px 400px at 85% 15%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 55%)," +
      "radial-gradient(700px 500px at 15% 85%, color-mix(in srgb, var(--success) 10%, transparent), transparent 55%)," +
      "radial-gradient(500px 400px at 60% 110%, color-mix(in srgb, var(--warning) 10%, transparent), transparent 50%)",
  },
  {
    id: "veil",
    label: "轻纱",
    css:
      "linear-gradient(180deg, color-mix(in srgb, var(--primary) 8%, transparent), transparent 40%)",
  },
];

const BG_KEY = "wb-bg";

/** 明暗选择的读取入口。cookie 优先、localStorage 迁移兜底，都在 design 里。 */
export const readStoredTheme = readThemeChoice;

export function readStoredBackground(): string {
  try {
    const v = localStorage.getItem(BG_KEY);
    if (v && BACKGROUND_PRESETS.some((p) => p.id === v)) return v;
  } catch {
    /* ignore */
  }
  return "none";
}

/**
 * Apply theme attribute + background token to the document.
 *
 * theme 为 "system" 时会**删掉** data-theme —— tokens.ts 的契约是属性没写才
 * 等于跟随系统。以前这里写的是 `prefersDark ? "dark" : "light"`，等于把「跟随
 * 系统」锁死在页面加载那一刻的系统值。
 */
export function applyAppearance(theme: ThemeChoice, backgroundId: string): void {
  applyThemeChoice(theme);

  const preset = BACKGROUND_PRESETS.find((p) => p.id === backgroundId) ?? BACKGROUND_PRESETS[0]!;
  document.documentElement.style.setProperty("--app-bg-image", preset.css);
}

export function persistAppearance(theme: ThemeChoice, backgroundId: string): void {
  writeThemeChoice(theme);
  try {
    localStorage.setItem(BG_KEY, backgroundId);
  } catch {
    /* storage unavailable — appearance still applies for this session */
  }
}

/**
 * 落地页的明暗切换。
 *
 * 选择本身存在 packages/design 那份跨子域 cookie 里（`wb-theme`,
 * Domain=.wellorbetterai.com），四个站共用：落地页、vibecoding、share、blog。
 * 这个文件只做两件落地页自己的事。
 *
 * ── 一、从 wb_dark 迁移 ─────────────────────────────────────────────────────
 * 落地页以前用自己的 key：`wb_dark`，值是 "1"/"0"，没有「跟随系统」这一档。
 * 直接换成新 key 等于把老访客的选择静默清空一次，所以第一次加载时把它翻译成
 * 新的选择再删掉。只在**完全没有**新选择时才迁移 —— 新的赢，否则「上次在博客
 * 上选的深色」会被一个躺了半年的 wb_dark 顶掉。
 *
 * ── 二、两态按钮 ───────────────────────────────────────────────────────────
 * 落地页导航栏是一个太阳/月亮图标按钮，不是三档分段控件（share 那边才是）。
 * 所以状态用 ThemeChoice 存，但**显示**看的是 resolvedAppearance() ——
 * "system" 时画的是系统当前那一边，点下去翻到另一边并写成明确选择。
 *
 * 首次渲染不写任何东西：没点过的访客保持 "system"（<html> 上不写 data-theme），
 * 这样他的系统主题变了页面会跟，博客那边也仍然当他没选过。
 */

import { useCallback, useEffect, useState } from "react";
import {
  THEME_KEY,
  applyThemeChoice,
  parseThemeCookie,
  readThemeChoice,
  resolvedAppearance,
  writeThemeChoice,
  type ThemeChoice,
} from "@wellorbetter/design";

const LEGACY_KEY = "wb_dark";

/** 把老的 wb_dark 翻译成新选择。没有新选择时才做，做完删掉老 key。 */
export function migrateLegacyDarkKey(): void {
  try {
    if (parseThemeCookie(document.cookie) !== undefined) return;
    if (localStorage.getItem(THEME_KEY) !== null) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== "1" && legacy !== "0") return;
    writeThemeChoice(legacy === "1" ? "dark" : "light");
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage 不可用 —— 没什么可迁移的 */
  }
}

/** 页面挂载前把存好的选择落到 <html>。所有路由都要，不只是有按钮的那两个。 */
export function bootstrapTheme(): void {
  migrateLegacyDarkKey();
  applyThemeChoice(readThemeChoice());
}

/**
 * 两态切换按钮的状态。`dark` 是**当前显示**的是不是深色（"system" 时看系统），
 * `toggle` 翻到另一边并持久化。
 */
export function useThemeToggle(): { dark: boolean; toggle: () => void } {
  const [choice, setChoice] = useState<ThemeChoice>(() => readThemeChoice());

  useEffect(() => {
    applyThemeChoice(choice);
  }, [choice]);

  const dark = resolvedAppearance(choice) === "dark";

  const toggle = useCallback(() => {
    // 在 setState 之外算 next：从 "system" 翻的时候要看系统现在是哪一边。
    const next: ThemeChoice = dark ? "light" : "dark";
    setChoice(next);
    writeThemeChoice(next);
  }, [dark]);

  return { dark, toggle };
}

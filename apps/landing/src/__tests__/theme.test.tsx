// @vitest-environment jsdom
/**
 * 落地页的明暗切换：从 wb_dark 迁移，以及两态按钮怎么处理 "system"。
 *
 * 选择本身的存储契约在 packages/design/src/theme.test.ts。这里只钉落地页
 * 特有的两件事，它们的失败方式都是安静的：迁移漏了 = 老访客的选择被清空；
 * 两态按钮从 "system" 翻错方向 = 点一下颜色没变。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { THEME_KEY, parseThemeCookie } from "@wellorbetter/design";
import { bootstrapTheme, migrateLegacyDarkKey, useThemeToggle } from "../theme.js";

function clearCookies(): void {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

beforeEach(() => {
  clearCookies();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
});

describe("migrateLegacyDarkKey", () => {
  it('把 wb_dark="1" 翻译成 dark 并删掉老 key', () => {
    localStorage.setItem("wb_dark", "1");
    migrateLegacyDarkKey();
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(parseThemeCookie(document.cookie)).toBe("dark");
    expect(localStorage.getItem("wb_dark")).toBeNull();
  });

  it('wb_dark="0" 翻译成 light', () => {
    localStorage.setItem("wb_dark", "0");
    migrateLegacyDarkKey();
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("已经有新选择时不动它 —— 老 key 不能顶掉刚在博客上选的", () => {
    document.cookie = "wb-theme=dark; Path=/";
    localStorage.setItem("wb_dark", "0");
    migrateLegacyDarkKey();
    expect(parseThemeCookie(document.cookie)).toBe("dark");
    expect(localStorage.getItem("wb_dark")).toBe("0");
  });

  it("新 key 在 localStorage 里也算已有选择", () => {
    localStorage.setItem(THEME_KEY, "dark");
    localStorage.setItem("wb_dark", "0");
    migrateLegacyDarkKey();
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("没有老 key 时什么都不写 —— 没点过的访客要保持 system", () => {
    migrateLegacyDarkKey();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(document.cookie).not.toContain("wb-theme");
  });

  it("老 key 是垃圾值时也不写", () => {
    localStorage.setItem("wb_dark", "yes");
    migrateLegacyDarkKey();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });
});

describe("bootstrapTheme", () => {
  it("把 cookie 里的选择落到 <html> —— 没按钮的那三个路由也要生效", () => {
    document.cookie = "wb-theme=dark; Path=/";
    bootstrapTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("没选过就不写属性，让 color-scheme 跟随系统", () => {
    bootstrapTheme();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

/** 挂一个只用 useThemeToggle 的组件，把 dark 和 toggle 暴露出来。 */
function mountToggle(): { dark: () => boolean; click: () => void } {
  let dark = false;
  let toggle = (): void => {};
  function Probe() {
    const state = useThemeToggle();
    dark = state.dark;
    toggle = state.toggle;
    return null;
  }
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<Probe />));
  return { dark: () => dark, click: () => act(() => toggle()) };
}

describe("useThemeToggle", () => {
  it("首次渲染不持久化 —— 没点过的访客保持 system", () => {
    mountToggle();
    expect(document.cookie).not.toContain("wb-theme");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("从 system（系统浅色）点一下变深色", () => {
    const t = mountToggle();
    expect(t.dark()).toBe(false);
    t.click();
    expect(t.dark()).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(parseThemeCookie(document.cookie)).toBe("dark");
  });

  it("从 system（系统深色）点一下变浅色，而不是又变深一次", () => {
    // 这是两态按钮最容易错的地方：拿一个初始为 false 的布尔取反，
    // 系统本来是深色的访客点一下会得到 dark —— 看起来什么都没发生。
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const t = mountToggle();
    expect(t.dark()).toBe(true);
    t.click();
    expect(t.dark()).toBe(false);
    expect(parseThemeCookie(document.cookie)).toBe("light");
  });

  it("读得到别的子域写的选择", () => {
    document.cookie = "wb-theme=dark; Path=/";
    const t = mountToggle();
    expect(t.dark()).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("来回点两下回到原样，并且是明确选择不是 system", () => {
    const t = mountToggle();
    t.click();
    t.click();
    expect(t.dark()).toBe(false);
    expect(parseThemeCookie(document.cookie)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

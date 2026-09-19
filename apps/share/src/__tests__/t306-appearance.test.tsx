/**
 * T306 外观管理。
 *
 * 明暗选择本身的契约（cookie 优先、localStorage 迁移、"system" 不写属性）由
 * packages/design/src/theme.test.ts 钉住 —— 那是四个站共用的那一份。这里只管
 * share 自己这一层：背景预设，以及两者组合起来落到 document 上的结果。
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import {
  BACKGROUND_PRESETS,
  applyAppearance,
  persistAppearance,
  readStoredBackground,
  readStoredTheme,
} from "../lib/appearance.js";
import { ThemeToggle } from "../components/ThemeToggle.js";

const matchMediaMock = vi.fn().mockReturnValue({ matches: false });

beforeEach(() => {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--app-bg-image");
  vi.stubGlobal("matchMedia", matchMediaMock);
});

describe("readStoredTheme / readStoredBackground", () => {
  it("defaults to system/none when nothing stored", () => {
    expect(readStoredTheme()).toBe("system");
    expect(readStoredBackground()).toBe("none");
  });

  it("reads valid stored values", () => {
    // wb-theme 走的是 design 那份（cookie 优先、localStorage 迁移兜底），
    // 这里只确认 share 这层转发没断。
    localStorage.setItem("wb-theme", "dark");
    localStorage.setItem("wb-bg", "aurora");
    expect(readStoredTheme()).toBe("dark");
    expect(readStoredBackground()).toBe("aurora");
  });

  it("rejects invalid stored values", () => {
    localStorage.setItem("wb-theme", "sepia");
    localStorage.setItem("wb-bg", "not-a-preset");
    expect(readStoredTheme()).toBe("system");
    expect(readStoredBackground()).toBe("none");
  });
});

describe("applyAppearance", () => {
  it("sets data-theme and background token", () => {
    applyAppearance("dark", "mesh");
    expect(document.documentElement.dataset.theme).toBe("dark");
    const preset = BACKGROUND_PRESETS.find((p) => p.id === "mesh")!;
    expect(document.documentElement.style.getPropertyValue("--app-bg-image")).toBe(preset.css);
  });

  it("system 删掉 data-theme，而不是写一个猜出来的值", () => {
    // 旧行为是 `prefersDark ? "dark" : "light"`：等于把「跟随系统」锁死在页面
    // 加载那一刻的系统值，访客开着页面切系统主题就不跟了。tokens.ts 的契约是
    // 属性没写才等于跟随。
    matchMediaMock.mockReturnValue({ matches: true });
    applyAppearance("dark", "none");
    applyAppearance("system", "none");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("falls back to first preset for unknown background id", () => {
    applyAppearance("light", "bogus");
    expect(document.documentElement.style.getPropertyValue("--app-bg-image")).toBe("none");
  });
});

describe("persistAppearance", () => {
  it("writes both keys", () => {
    persistAppearance("light", "veil");
    expect(localStorage.getItem("wb-theme")).toBe("light");
    expect(localStorage.getItem("wb-bg")).toBe("veil");
  });

  it("主题同时写成跨子域 cookie —— 不写的话博客读不到", () => {
    persistAppearance("dark", "none");
    expect(document.cookie).toContain("wb-theme=dark");
  });
});

describe("ThemeToggle", () => {
  it("renders segmented theme options and reflects active choice", () => {
    render(<ThemeToggle />);
    const dark = screen.getByRole("radio", { name: "深色" });
    expect(dark.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(dark);
    expect(dark.getAttribute("aria-checked")).toBe("true");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("wb-theme")).toBe("dark");
    expect(document.cookie).toContain("wb-theme=dark");
    cleanup();
  });

  it("changes background preset via select", () => {
    render(<ThemeToggle />);
    const select = screen.getByLabelText("背景") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "aurora" } });
    expect(localStorage.getItem("wb-bg")).toBe("aurora");
    const preset = BACKGROUND_PRESETS.find((p) => p.id === "aurora")!;
    expect(document.documentElement.style.getPropertyValue("--app-bg-image")).toBe(preset.css);
    cleanup();
  });
});

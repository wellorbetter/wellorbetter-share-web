/**
 * Tests for T306 appearance management:
 *  - resolveThemeAttr light/dark/system resolution
 *  - readStoredTheme / readStoredBackground with/without storage
 *  - applyAppearance writes data-theme and --app-bg-image
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import {
  BACKGROUND_PRESETS,
  applyAppearance,
  persistAppearance,
  readStoredBackground,
  readStoredTheme,
  resolveThemeAttr,
} from "../lib/appearance.js";
import { ThemeToggle } from "../components/ThemeToggle.js";

const matchMediaMock = vi.fn().mockReturnValue({ matches: false });

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--app-bg-image");
  vi.stubGlobal("matchMedia", matchMediaMock);
});

describe("resolveThemeAttr", () => {
  it("resolves explicit light/dark directly", () => {
    expect(resolveThemeAttr("light", true)).toBe("light");
    expect(resolveThemeAttr("dark", false)).toBe("dark");
  });

  it("resolves system to the OS preference", () => {
    expect(resolveThemeAttr("system", true)).toBe("dark");
    expect(resolveThemeAttr("system", false)).toBe("light");
  });
});

describe("readStoredTheme / readStoredBackground", () => {
  it("defaults to system/none when nothing stored", () => {
    expect(readStoredTheme()).toBe("system");
    expect(readStoredBackground()).toBe("none");
  });

  it("reads valid stored values", () => {
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

  it("resolves system theme via matchMedia", () => {
    matchMediaMock.mockReturnValue({ matches: true });
    applyAppearance("system", "none");
    expect(document.documentElement.dataset.theme).toBe("dark");
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

import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  THEME_KEY,
  applyThemeChoice,
  parseThemeCookie,
  readThemeChoice,
  resolvedAppearance,
  themeCookieString,
  writeThemeChoice,
} from "./theme.js";

/**
 * 明暗选择的存储契约。
 *
 * 这套东西的失败方式是「看起来对，但跨站不生效」：本地点一下有反应，测试也绿，
 * 而访客换个子域就发现选择没跟过去。所以这里钉的是 cookie 串的**每个属性**、
 * cookie 与 localStorage 的**优先级**，以及 "system" 到底有没有写属性。
 */

/** jsdom 的 document.cookie 会累积，每条测试之前要清干净。 */
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
  vi.unstubAllGlobals();
});

describe("parseThemeCookie", () => {
  it("认三个合法值", () => {
    expect(parseThemeCookie("wb-theme=light")).toBe("light");
    expect(parseThemeCookie("wb-theme=dark")).toBe("dark");
    expect(parseThemeCookie("wb-theme=system")).toBe("system");
  });

  it("没有 / 认不出来返回 undefined，而不是硬塞一个默认值", () => {
    // 返回 undefined 才能让调用方区分「没选过」和「选了 system」——
    // 前者要继续去 localStorage 里找老访客的选择，后者不用。
    expect(parseThemeCookie(null)).toBeUndefined();
    expect(parseThemeCookie("")).toBeUndefined();
    expect(parseThemeCookie("wb-theme=sepia")).toBeUndefined();
    expect(parseThemeCookie("wb-theme=")).toBeUndefined();
    expect(parseThemeCookie("other=dark")).toBeUndefined();
  });

  it("能从一堆 cookie 里挑出来，空格不算", () => {
    expect(parseThemeCookie("a=1; wb-theme=dark; b=2")).toBe("dark");
    expect(parseThemeCookie("a=1;wb-theme=dark")).toBe("dark");
    expect(parseThemeCookie(" wb-theme = dark ")).toBe("dark");
  });

  it("名字必须整个对上，不是包含", () => {
    // 经典错法：includes / startsWith 会被下面这三条骗过去。
    expect(parseThemeCookie("my-wb-theme=dark")).toBeUndefined();
    expect(parseThemeCookie("wb-theme-old=dark")).toBeUndefined();
    expect(parseThemeCookie("xwb-theme=dark; wb-theme=light")).toBe("light");
  });

  it("名字常量没被改掉", () => {
    // 博客那边（managed-blog-platform/packages/web/src/theme.ts）在服务端读
    // 同一个名字。改这里不改那边，跨站就悄悄断了。
    expect(THEME_KEY).toBe("wb-theme");
  });
});

describe("themeCookieString", () => {
  it("自己的子域上带 Domain，才能跨子域", () => {
    const cookie = themeCookieString("dark", "share.wellorbetterai.com", "https:");
    expect(cookie).toContain("wb-theme=dark");
    expect(cookie).toContain("Domain=.wellorbetterai.com");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=31536000");
  });

  it("裸域也算自己家", () => {
    expect(themeCookieString("light", "wellorbetterai.com", "https:")).toContain(
      "Domain=.wellorbetterai.com",
    );
  });

  it("localhost 不加 Domain 也不加 Secure，否则本地整条被丢掉", () => {
    const cookie = themeCookieString("dark", "localhost", "http:");
    expect(cookie).not.toContain("Domain=");
    expect(cookie).not.toContain("Secure");
    expect(cookie).toContain("wb-theme=dark");
  });

  it("长得像的域名拿不到我们的 Domain", () => {
    // endsWith(".wellorbetterai.com") 而不是 includes：下面两个都得落空。
    expect(themeCookieString("dark", "wellorbetterai.com.attacker.example", "https:")).not.toContain(
      "Domain=",
    );
    expect(themeCookieString("dark", "notwellorbetterai.com", "https:")).not.toContain("Domain=");
  });

  it("https 才加 Secure", () => {
    expect(themeCookieString("dark", "wellorbetterai.com", "http:")).not.toContain("Secure");
  });
});

describe("readThemeChoice", () => {
  it("什么都没有就是 system", () => {
    expect(readThemeChoice()).toBe("system");
  });

  it("只有 localStorage 时读它 —— 老访客的选择不能在这次发布里被清空", () => {
    localStorage.setItem(THEME_KEY, "dark");
    expect(readThemeChoice()).toBe("dark");
  });

  it("cookie 赢 localStorage —— 只有 cookie 可能被别的子域改过", () => {
    localStorage.setItem(THEME_KEY, "light");
    document.cookie = "wb-theme=dark; Path=/";
    expect(readThemeChoice()).toBe("dark");
  });

  it("cookie 是垃圾值时退回 localStorage，而不是直接 system", () => {
    localStorage.setItem(THEME_KEY, "dark");
    document.cookie = "wb-theme=sepia; Path=/";
    expect(readThemeChoice()).toBe("dark");
  });

  it("localStorage 也是垃圾值就 system", () => {
    localStorage.setItem(THEME_KEY, "sepia");
    expect(readThemeChoice()).toBe("system");
  });
});

describe("writeThemeChoice", () => {
  it("两边都写：cookie 跨子域，localStorage 兜底", () => {
    writeThemeChoice("dark");
    expect(parseThemeCookie(document.cookie)).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("写完立刻能被 readThemeChoice 读回来", () => {
    writeThemeChoice("light");
    expect(readThemeChoice()).toBe("light");
  });

  it("localStorage 抛错也要把 cookie 写出去", () => {
    // 隐私模式下 setItem 会抛。cookie 是主路径，不能被它带崩。
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(() => writeThemeChoice("dark")).not.toThrow();
    expect(parseThemeCookie(document.cookie)).toBe("dark");
    spy.mockRestore();
  });
});

describe("applyThemeChoice", () => {
  it("light / dark 写属性", () => {
    applyThemeChoice("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    applyThemeChoice("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("system 把属性**删掉**，不是写一个猜出来的值", () => {
    // tokens.ts 的契约：属性没写才等于跟随系统。写一个页面加载那刻算出来的
    // 具体值，访客在页面开着的时候切系统主题就不跟了。
    applyThemeChoice("dark");
    applyThemeChoice("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

describe("resolvedAppearance", () => {
  it("明确的选择直接返回", () => {
    expect(resolvedAppearance("light")).toBe("light");
    expect(resolvedAppearance("dark")).toBe("dark");
  });

  it("system 看系统偏好", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(resolvedAppearance("system")).toBe("dark");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    expect(resolvedAppearance("system")).toBe("light");
  });

  it("没有 matchMedia 时当浅色，而不是炸掉", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(resolvedAppearance("system")).toBe("light");
  });
});

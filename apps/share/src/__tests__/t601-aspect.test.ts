import { describe, expect, it } from "vitest";
import { pickAspect } from "../lib/aspect.js";
import { hashToHsl, placeholderInk } from "../lib/colors.js";

describe("T601 masonry aspect selection", () => {
  it("prefers valid cover dimensions", () => {
    expect(pickAspect("same-slug", 1200, 800)).toBe(1.5);
  });

  it("is deterministic for the same slug", () => {
    expect(pickAspect("stable-project")).toBe(pickAspect("stable-project"));
  });

  it("keeps fallback ratios within the supported range", () => {
    for (let i = 0; i < 100; i++) {
      expect(pickAspect(`project-${i}`)).toBeGreaterThanOrEqual(0.75);
      expect(pickAspect(`project-${i}`)).toBeLessThanOrEqual(2.1);
    }
  });

  it("falls back for invalid dimensions", () => {
    expect(pickAspect("invalid", 0, 100)).toBe(pickAspect("invalid"));
    expect(pickAspect("invalid", 100, null)).toBe(pickAspect("invalid"));
  });

  it("creates a stable two-color placeholder gradient", () => {
    const colors = hashToHsl("stable-project");
    expect(colors).toHaveLength(2);
    expect(colors).toEqual(hashToHsl("stable-project"));
  });

  // 这条以前断言 colors[0] 含 "color-mix"，那是实现细节：换个同样正确的写法
  // 就会红。真正需要锁住的是「占位图不会跑出品牌色」—— 之前 hue = hash % 360
  // 能产生青绿，而这是没有封面的作品的主视觉。
  it("keeps placeholder hues inside the brand's warm band", () => {
    for (let i = 0; i < 500; i++) {
      for (const stop of hashToHsl(`project-${i}`)) {
        const hues = [...stop.matchAll(/oklch\([\d.]+ [\d.]+ (\d+)\)/g)].map((m) => Number(m[1]));
        expect(hues).toHaveLength(2); // light-dark() 两个分支都要有
        for (const hue of hues) {
          expect(hue).toBeGreaterThanOrEqual(28);
          expect(hue).toBeLessThan(92); // 28 + 64，不碰 --success 的 ~148（苔绿=已发布）
        }
      }
    }
  });

  // 两个分支的亮度必须分得开，否则 light-dark() 白写了 —— 浅色页要浅瓦片、
  // 深色页要深瓦片。
  it("gives light and dark modes different lightness", () => {
    for (const stop of hashToHsl("stable-project")) {
      const ls = [...stop.matchAll(/oklch\(([\d.]+) /g)].map((m) => Number(m[1]));
      expect(ls).toHaveLength(2);
      expect(ls[0]! - ls[1]!).toBeGreaterThan(0.2);
    }
  });

  it("inks the placeholder initial against its own mode", () => {
    const ink = placeholderInk("stable-project");
    expect(ink).toBe(placeholderInk("stable-project"));
    const ls = [...ink.matchAll(/oklch\(([\d.]+) /g)].map((m) => Number(m[1]));
    // 浅色模式深字、深色模式浅字。旧实现两边都用白字，浅瓦片上约 2:1。
    expect(ls[0]!).toBeLessThan(0.45);
    expect(ls[1]!).toBeGreaterThan(0.85);
  });
});

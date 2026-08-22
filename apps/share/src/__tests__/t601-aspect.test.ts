import { describe, expect, it } from "vitest";
import { pickAspect } from "../lib/aspect.js";
import { hashToHsl } from "../lib/colors.js";

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
    expect(colors[0]).toContain("color-mix");
  });
});

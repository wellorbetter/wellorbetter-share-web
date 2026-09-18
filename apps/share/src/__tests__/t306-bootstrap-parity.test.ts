import { describe, it, expect } from "vitest";
import htmlSource from "../../index.html?raw";
import appearanceSource from "../lib/appearance.ts?raw";
import { BACKGROUND_PRESETS } from "../lib/appearance";

/**
 * T306 follow-up: pin the no-flash bootstrap to its source of truth.
 *
 * index.html duplicates the preset gradients as literal strings because it runs
 * before the bundle exists and cannot import them. If the two copies drift, the
 * bootstrap paints the OLD gradient on first load and React then swaps it — a
 * flash of the *wrong* background, which is the exact thing the bootstrap exists
 * to prevent. Worse, it only shows on a cold load with a non-default preset
 * already stored, so no screenshot of the running app would catch it.
 *
 * The duplication is load-bearing and cannot just be deleted, so it is pinned
 * here instead. Edit a preset in appearance.ts and this test names which literal
 * in index.html to update.
 *
 * Sources are pulled in with Vite's `?raw` rather than node:fs — this workspace
 * typechecks with `types: ["vite/client"]` and no node types.
 */
describe("T306 background preset bootstrap parity", () => {
  const mapBlock = htmlSource.match(/var map = \{([\s\S]*?)\n\s*\};/);
  const scriptMap: Record<string, string> = {};
  for (const m of (mapBlock?.[1] ?? "").matchAll(/(\w+):\s*\n?\s*"([^"]*)"/g)) {
    const [, id, css] = m;
    if (id !== undefined && css !== undefined) scriptMap[id] = css;
  }

  const presets = BACKGROUND_PRESETS.filter((p) => p.css !== "none");

  it("locates the bootstrap preset map in index.html", () => {
    expect(mapBlock, "could not find `var map = {...}` in index.html").not.toBeNull();
    expect(Object.keys(scriptMap).length).toBeGreaterThan(0);
  });

  it("bootstrap covers exactly the non-default presets", () => {
    expect(Object.keys(scriptMap).sort()).toEqual(presets.map((p) => p.id).sort());
  });

  for (const preset of presets) {
    it(`${preset.id}: index.html literal matches appearance.ts exactly`, () => {
      expect(scriptMap[preset.id]).toBe(preset.css);
    });
  }

  it("bootstrap reads the same localStorage keys the module writes", () => {
    for (const key of ["wb-theme", "wb-bg"]) {
      expect(appearanceSource, `appearance.ts should own the "${key}" key`).toContain(`"${key}"`);
      expect(htmlSource, `index.html bootstrap should read "${key}"`).toContain(`"${key}"`);
    }
  });
});

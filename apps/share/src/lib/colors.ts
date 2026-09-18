/**
 * Deterministic cover placeholders for projects without an uploaded cover.
 *
 * These are not decoration — for a project with no cover the placeholder *is*
 * the card's entire visual, so whatever hue it picks is what the feed looks like.
 * The old version was `hue = hash % 360`: the full colour wheel at 62% saturation,
 * which put acid greens and cyans on a warm-neutral page. Two of five live
 * projects had no cover, so the feed's dominant colour was a hue the brand does
 * not contain.
 *
 * Now the hue is confined to the brand's warm band and the lightness comes from
 * `light-dark()`, so a placeholder reads as a member of the palette in both
 * modes instead of a random tile.
 */

/** Hue band, degrees. Spans the brand's own warm hues:
 *  --primary 42–45 (terracotta) → --warning 72–85 (amber/ochre).
 *  Deliberately excludes --success (~148, moss): moss means "published /
 *  online" in this system, and a cover that happens to be green would read as
 *  a status. */
const HUE_START = 28;
const HUE_SPAN = 64;

/** Second stop sits a short way further along the band, never outside it. */
const STOP_SHIFT = 18;

function hash(seed: string): number {
  let value = 5381;
  for (let i = 0; i < seed.length; i++) value = Math.imul(value, 33) ^ seed.charCodeAt(i);
  return value >>> 0;
}

/**
 * Two gradient stops for a project placeholder, keyed off the slug so a project
 * always looks the same.
 *
 * Each stop is a `light-dark()` pair rather than one colour: a tile tuned to sit
 * under a light page is too bright to sit under a dark one. Chroma stays near
 * the palette's own (primary is 0.125–0.135) so these don't out-saturate the
 * accent they sit next to.
 */
export function hashToHsl(seed: string): readonly [string, string] {
  const value = hash(seed);
  const hue = HUE_START + (value % HUE_SPAN);
  const secondHue = HUE_START + ((value % HUE_SPAN) + STOP_SHIFT) % HUE_SPAN;
  // Small deterministic lightness jitter so two same-hue covers still differ.
  const jitter = ((value >>> 8) % 5) * 0.012;
  return [
    `light-dark(oklch(${(0.80 - jitter).toFixed(3)} 0.075 ${hue}), oklch(${(0.40 + jitter).toFixed(3)} 0.055 ${hue}))`,
    `light-dark(oklch(${(0.68 - jitter).toFixed(3)} 0.105 ${secondHue}), oklch(${(0.28 + jitter).toFixed(3)} 0.075 ${secondHue}))`,
  ];
}

/**
 * Ink for the initial drawn on top of that gradient. Dark in light mode, light
 * in dark mode — the old code always used white, which on a light tile is the
 * kind of ~2:1 text that only survives review because the glyph is decorative.
 */
export function placeholderInk(seed: string): string {
  const hue = HUE_START + (hash(seed) % HUE_SPAN);
  return `light-dark(oklch(0.30 0.045 ${hue}), oklch(0.93 0.020 ${hue}))`;
}

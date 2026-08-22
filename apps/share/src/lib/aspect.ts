const FALLBACK_ASPECTS = [0.8, 0.8, 0.8, 1, 1, 0.75, 0.75, 1.6, 2.1] as const;

function fnv1a(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Stable width/height ratio for masonry cards. */
export function pickAspect(
  slug: string,
  coverWidth?: number | null,
  coverHeight?: number | null,
): number {
  if (
    typeof coverWidth === "number" &&
    typeof coverHeight === "number" &&
    Number.isFinite(coverWidth) &&
    Number.isFinite(coverHeight) &&
    coverWidth > 0 &&
    coverHeight > 0
  ) {
    return coverWidth / coverHeight;
  }
  return FALLBACK_ASPECTS[fnv1a(slug) % FALLBACK_ASPECTS.length]!;
}

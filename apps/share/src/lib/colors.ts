function hash(seed: string): number {
  let value = 5381;
  for (let i = 0; i < seed.length; i++) value = Math.imul(value, 33) ^ seed.charCodeAt(i);
  return value >>> 0;
}

/** Deterministic, theme-friendly gradient colors for a project placeholder. */
export function hashToHsl(seed: string): readonly [string, string] {
  const value = hash(seed);
  const hue = value % 360;
  const secondHue = (hue + 36 + ((value >>> 8) % 52)) % 360;
  return [
    `color-mix(in srgb, hsl(${hue} 62% 54%) 68%, var(--surface-container-highest))`,
    `color-mix(in srgb, hsl(${secondHue} 70% 42%) 76%, var(--surface-container-high))`,
  ];
}

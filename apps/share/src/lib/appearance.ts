/**
 * Theme & background management (T306).
 *
 * - Theme: light / dark / system, persisted to localStorage, applied via
 *   `data-theme` on <html> (manual choice overrides prefers-color-scheme,
 *   matching packages/design tokens).
 * - Background: replaceable app background via the `--app-bg-image` token.
 *   Presets are pure CSS gradients — no copyrighted assets. "none" resets.
 * - No-flash bootstrap: index.html inlines applyThemeFromStorage() before
 *   the bundle loads; this hook keeps React state in sync with it.
 */

export type ThemeChoice = "light" | "dark" | "system";

export interface BackgroundPreset {
  id: string;
  label: string;
  /** CSS value for --app-bg-image (background-image). */
  css: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "none", label: "默认", css: "none" },
  {
    id: "aurora",
    label: "极光",
    css:
      "radial-gradient(1200px 600px at 10% -10%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 60%)," +
      "radial-gradient(1000px 500px at 110% 20%, color-mix(in srgb, var(--secondary) 18%, transparent), transparent 55%)",
  },
  {
    id: "mesh",
    label: "网格",
    css:
      "radial-gradient(600px 400px at 85% 15%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 55%)," +
      "radial-gradient(700px 500px at 15% 85%, color-mix(in srgb, var(--success) 10%, transparent), transparent 55%)," +
      "radial-gradient(500px 400px at 60% 110%, color-mix(in srgb, var(--warning) 10%, transparent), transparent 50%)",
  },
  {
    id: "veil",
    label: "轻纱",
    css:
      "linear-gradient(180deg, color-mix(in srgb, var(--primary) 8%, transparent), transparent 40%)",
  },
];

const THEME_KEY = "wb-theme";
const BG_KEY = "wb-bg";

/** Resolve a stored theme choice to the concrete attribute value. */
export function resolveThemeAttr(choice: ThemeChoice, prefersDark: boolean): "light" | "dark" {
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice;
}

export function readStoredTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage unavailable — default below */
  }
  return "system";
}

export function readStoredBackground(): string {
  try {
    const v = localStorage.getItem(BG_KEY);
    if (v && BACKGROUND_PRESETS.some((p) => p.id === v)) return v;
  } catch {
    /* ignore */
  }
  return "none";
}

/** Apply theme attribute + background token to the document. */
export function applyAppearance(theme: ThemeChoice, backgroundId: string): void {
  const prefersDark =
    typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = resolveThemeAttr(theme, prefersDark);

  const preset = BACKGROUND_PRESETS.find((p) => p.id === backgroundId) ?? BACKGROUND_PRESETS[0]!;
  document.documentElement.style.setProperty("--app-bg-image", preset.css);
}

export function persistAppearance(theme: ThemeChoice, backgroundId: string): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(BG_KEY, backgroundId);
  } catch {
    /* storage unavailable — appearance still applies for this session */
  }
}

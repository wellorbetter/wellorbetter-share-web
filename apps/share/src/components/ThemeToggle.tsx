/**
 * ThemeToggle — light / dark / system switcher + background preset picker.
 *
 * Compact control for the app header. Applies appearance immediately and
 * persists to localStorage. Respects system preference when set to "system".
 */
import { useCallback, useEffect, useState } from "react";
import {
  BACKGROUND_PRESETS,
  applyAppearance,
  persistAppearance,
  readStoredBackground,
  readStoredTheme,
  type ThemeChoice,
} from "../lib/appearance.js";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>(() => readStoredTheme());
  const [bg, setBg] = useState<string>(() => readStoredBackground());

  // Keep document in sync (also catches system-preference changes).
  useEffect(() => {
    applyAppearance(theme, bg);
  }, [theme, bg]);

  const handleTheme = useCallback((next: ThemeChoice) => {
    setTheme(next);
    persistAppearance(next, readStoredBackground());
  }, []);

  const handleBg = useCallback((id: string) => {
    setBg(id);
    persistAppearance(readStoredTheme(), id);
  }, []);

  const options: Array<{ value: ThemeChoice; label: string }> = [
    { value: "light", label: "浅色" },
    { value: "dark", label: "深色" },
    { value: "system", label: "系统" },
  ];

  return (
    <div className="appearance-controls">
      <div className="segmented" role="radiogroup" aria-label="主题">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={theme === o.value}
            className={theme === o.value ? "segment is-active" : "segment"}
            onClick={() => handleTheme(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <label className="bg-select">
        <span className="visually-hidden">背景</span>
        <select value={bg} onChange={(e) => handleBg(e.target.value)} aria-label="背景样式">
          {BACKGROUND_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              背景：{p.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

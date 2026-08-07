/**
 * Material 3 设计系统：CSS 变量（light/dark）+ 品牌资产。
 * 基于蓝色种子色生成 M3 调色板，保留旧变量名兼容既有组件。
 */

/** 品牌资产 */
export const BRAND = {
  accent: "#445E91",
  accentHover: "#3A5180",
};

/** M3 完整 CSS 变量（light + dark，手动切换优先于系统偏好） */
export const cssVariables = `
:root {
  /* 语义色 */
  --primary: #445E91;
  --on-primary: #FFFFFF;
  --primary-container: #D9E2FF;
  --on-primary-container: #001A41;
  --secondary: #575E71;
  --on-secondary: #FFFFFF;
  --secondary-container: #DBE2F9;
  --on-secondary-container: #141B2C;
  --error: #BA1A1A;
  --on-error: #FFFFFF;
  --error-container: #FFDAD6;
  --on-error-container: #410002;
  --success: #2E7D32;
  --success-container: #B7F0B0;
  --on-success-container: #002107;

  /* 表面与层级 */
  --bg: #F9F9FF;
  --surface: #F3F3FA;
  --surface-container-low: #F3F3FA;
  --surface-container: #EDEDF4;
  --surface-container-high: #E7E8EF;
  --surface-container-highest: #E1E2E9;
  --surface-variant: #E0E2EC;
  --on-surface-variant: #44474F;
  --text: #191C20;
  --text-muted: #44474F;

  /* 描边与分割 */
  --border: #C4C6D0;
  --outline: #74777F;
  --outline-variant: #C4C6D0;

  /* 反向与状态层 */
  --inverse-surface: #2E3036;
  --inverse-on-surface: #F0F0F7;
  --inverse-primary: #B1C5FF;
  --state-hover: rgba(68, 94, 145, 0.08);
  --state-pressed: rgba(68, 94, 145, 0.12);
  --state-focus: rgba(68, 94, 145, 0.12);

  /* 形状 */
  --radius: 16px;
  --radius-sm: 12px;
  --radius-xs: 8px;
  --shape-pill: 999px;

  /* 排版 */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  /* 阴影（M3 elevation） */
  --elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
  --elevation-2: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);
  --elevation-3: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3);
}
@media (prefers-color-scheme: dark) {
  :root {
    --primary: #B1C5FF;
    --on-primary: #002E69;
    --primary-container: #29458C;
    --on-primary-container: #D9E2FF;
    --secondary: #BFC6DC;
    --on-secondary: #293041;
    --secondary-container: #3F4759;
    --on-secondary-container: #DBE2F9;
    --error: #FFB4AB;
    --on-error: #690005;
    --error-container: #93000A;
    --on-error-container: #FFDAD6;
    --success: #81C995;
    --success-container: #27632E;
    --on-success-container: #B7F0B0;

    --bg: #111318;
    --surface: #191C21;
    --surface-container-low: #191C21;
    --surface-container: #1D2025;
    --surface-container-high: #282A30;
    --surface-container-highest: #33353B;
    --surface-variant: #44474F;
    --on-surface-variant: #C4C6D0;
    --text: #E2E2E9;
    --text-muted: #C4C6D0;

    --border: #44474F;
    --outline: #8E9099;
    --outline-variant: #44474F;

    --inverse-surface: #E2E2E9;
    --inverse-on-surface: #2E3036;
    --inverse-primary: #445E91;
    --state-hover: rgba(177, 197, 255, 0.08);
    --state-pressed: rgba(177, 197, 255, 0.12);
    --state-focus: rgba(177, 197, 255, 0.12);

    --elevation-1: 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 3px 1px rgba(0, 0, 0, 0.3);
    --elevation-2: 0 1px 2px rgba(0, 0, 0, 0.5), 0 2px 6px 2px rgba(0, 0, 0, 0.3);
    --elevation-3: 0 4px 8px 3px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.5);
  }
}
/* 手动切换优先于系统偏好（[data-theme] 特异性更高） */
:root[data-theme="dark"] {
  --primary: #B1C5FF;
  --on-primary: #002E69;
  --primary-container: #29458C;
  --on-primary-container: #D9E2FF;
  --secondary: #BFC6DC;
  --on-secondary: #293041;
  --secondary-container: #3F4759;
  --on-secondary-container: #DBE2F9;
  --error: #FFB4AB;
  --on-error: #690005;
  --error-container: #93000A;
  --on-error-container: #FFDAD6;
  --success: #81C995;
  --success-container: #27632E;
  --on-success-container: #B7F0B0;
  --bg: #111318;
  --surface: #191C21;
  --surface-container-low: #191C21;
  --surface-container: #1D2025;
  --surface-container-high: #282A30;
  --surface-container-highest: #33353B;
  --surface-variant: #44474F;
  --on-surface-variant: #C4C6D0;
  --text: #E2E2E9;
  --text-muted: #C4C6D0;
  --border: #44474F;
  --outline: #8E9099;
  --outline-variant: #44474F;
  --inverse-surface: #E2E2E9;
  --inverse-on-surface: #2E3036;
  --inverse-primary: #445E91;
  --state-hover: rgba(177, 197, 255, 0.08);
  --state-pressed: rgba(177, 197, 255, 0.12);
  --state-focus: rgba(177, 197, 255, 0.12);
  --elevation-1: 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 3px 1px rgba(0, 0, 0, 0.3);
  --elevation-2: 0 1px 2px rgba(0, 0, 0, 0.5), 0 2px 6px 2px rgba(0, 0, 0, 0.3);
  --elevation-3: 0 4px 8px 3px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.5);
}
:root[data-theme="light"] {
  --primary: #445E91;
  --on-primary: #FFFFFF;
  --primary-container: #D9E2FF;
  --on-primary-container: #001A41;
  --secondary: #575E71;
  --on-secondary: #FFFFFF;
  --secondary-container: #DBE2F9;
  --on-secondary-container: #141B2C;
  --error: #BA1A1A;
  --on-error: #FFFFFF;
  --error-container: #FFDAD6;
  --on-error-container: #410002;
  --success: #2E7D32;
  --success-container: #B7F0B0;
  --on-success-container: #002107;
  --bg: #F9F9FF;
  --surface: #F3F3FA;
  --surface-container-low: #F3F3FA;
  --surface-container: #EDEDF4;
  --surface-container-high: #E7E8EF;
  --surface-container-highest: #E1E2E9;
  --surface-variant: #E0E2EC;
  --on-surface-variant: #44474F;
  --text: #191C20;
  --text-muted: #44474F;
  --border: #C4C6D0;
  --outline: #74777F;
  --outline-variant: #C4C6D0;
  --inverse-surface: #2E3036;
  --inverse-on-surface: #F0F0F7;
  --inverse-primary: #B1C5FF;
  --state-hover: rgba(68, 94, 145, 0.08);
  --state-pressed: rgba(68, 94, 145, 0.12);
  --state-focus: rgba(68, 94, 145, 0.12);
  --elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
  --elevation-2: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);
  --elevation-3: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3);
}
`;

/** 通用样式基元（reset + 常用类） */
export const baseStyles = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
button {
  font-family: inherit;
  cursor: pointer;
}
input, select, textarea { font-family: inherit; }
:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
::selection { background: var(--primary-container); color: var(--on-primary-container); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

/** 极简 reset + 主题注入（落地页与分享页通用） */
export const themeStyle = cssVariables + "\n" + baseStyles;

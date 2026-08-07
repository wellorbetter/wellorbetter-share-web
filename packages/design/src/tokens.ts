/**
 * 设计系统：CSS 变量（light/dark）+ 品牌资产。
 * 用法：前端把 cssVariables 字符串注入 <style> 或直接 import。
 */

/** 品牌蓝 */
export const BRAND = {
  accent: "#2563EB",
  accentHover: "#1D4ED8",
};

/** 完整 CSS 变量（light + dark，主按钮暗色下保持 #2563EB 白字以达 AA 对比度） */
export const cssVariables = `
:root {
  --bg: #FFFFFF;
  --surface: #F6F7F9;
  --border: #E4E7EC;
  --text: #111418;
  --text-muted: #6B7280;
  --accent: #2563EB;
  --accent-hover: #1D4ED8;
  --danger: #DC2626;
  --success: #16A34A;
  --radius: 12px;
  --radius-sm: 8px;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0F1115;
    --surface: #16191F;
    --border: #262B33;
    --text: #E8EAED;
    --text-muted: #9AA3AE;
    --accent: #2563EB;
    --accent-hover: #1D4ED8;
    --danger: #F87171;
    --success: #4ADE80;
  }
}
/* 手动切换优先于系统偏好（[data-theme] 特异性更高） */
:root[data-theme="dark"] {
  --bg: #0F1115;
  --surface: #16191F;
  --border: #262B33;
  --text: #E8EAED;
  --text-muted: #9AA3AE;
  --accent: #2563EB;
  --accent-hover: #1D4ED8;
  --danger: #F87171;
  --success: #4ADE80;
}
:root[data-theme="light"] {
  --bg: #FFFFFF;
  --surface: #F6F7F9;
  --border: #E4E7EC;
  --text: #111418;
  --text-muted: #6B7280;
  --accent: #2563EB;
  --accent-hover: #1D4ED8;
  --danger: #DC2626;
  --success: #16A34A;
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
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
button {
  font-family: inherit;
  cursor: pointer;
}
input, select, textarea { font-family: inherit; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

/** 极简 reset + 主题注入（落地页与分享页通用） */
export const themeStyle = cssVariables + "\n" + baseStyles;
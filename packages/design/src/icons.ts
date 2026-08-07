/**
 * 内联 SVG 图标（不依赖图标库）。
 * 所有图标统一 24x24 viewBox，stroke 风格（feather-like）。
 */

export type IconName =
  | "logo"
  | "upload"
  | "list"
  | "logout"
  | "copy"
  | "check"
  | "lock"
  | "eye"
  | "eye-off"
  | "moon"
  | "sun"
  | "trash"
  | "download"
  | "link"
  | "file"
  | "users"
  | "spinner";

const paths: Record<IconName, string> = {
  logo: '<rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor"/><path d="M8 12h8M12 8v8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  upload: '<path d="M12 16V4m0 0L7 9m5-5l5 5M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14l5-5-5-5m5 5H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2" fill="none"/>',
  check: '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="2" fill="none"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/>',
  "eye-off": '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  sun: '<circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  trash: '<path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  download: '<path d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="2" fill="none"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  spinner: '<path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>',
};

/** 渲染图标为 SVG 字符串 */
export function icon(name: IconName, size = 20, className = ""): string {
  const cls = className ? ` class="${className}"` : "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"${cls}>${paths[name]}</svg>`;
}

/** 文件类型 → 图标名映射（含降级：统一返回 file 图标） */
export function fileTypeIcon(_fileName: string): IconName {
  return "file";
}

/** 文件类型 → emoji 映射（下载/列表展示，含降级） */
const TYPE_EMOJI: Array<[RegExp, string]> = [
  [/\.pdf$/i, "📕"],
  [/\.(docx?|odt|rtf)$/i, "📘"],
  [/\.(xlsx?|csv|ods|tsv)$/i, "📗"],
  [/\.(pptx?|odp|key)$/i, "📙"],
  [/\.(jpe?g|png|gif|webp|bmp|heic|avif)$/i, "🖼️"],
  [/\.(svg)$/i, "📐"],
  [/\.(zip|rar|7z|tar|gz|bz2|xz|tgz)$/i, "🗜️"],
  [/\.(mp3|wav|flac|aac|ogg|m4a|opus)$/i, "🎵"],
  [/\.(mp4|mkv|avi|mov|webm|flv|wmv)$/i, "🎬"],
  [/\.(txt|md|log|json|xml|yaml|yml|toml|ini|conf)$/i, "📄"],
  [/\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|cs|rb|php|sh|sql|html|css|swift|kt)$/i, "💻"],
];

export function fileTypeEmoji(fileName: string): string {
  for (const [re, emoji] of TYPE_EMOJI) {
    if (re.test(fileName)) return emoji;
  }
  return "📄";
}
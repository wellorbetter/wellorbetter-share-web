/**
 * 全局常量与限制（唯一来源，worker 与前端共享）。
 * 注意：这里不能依赖 Cloudflare 运行时 API，必须是纯 TS。
 */

/** 上传大小上限（字节）：MVP 单次 PUT 直传 100MB */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** 文件名最长长度（清洗后） */
export const MAX_FILENAME_LENGTH = 200;

/** 过期时间选项（秒）：1 天 / 7 天 / 30 天 / 永久 */
export const EXPIRY_OPTIONS_SECONDS = [
  { label: "1 天", value: 24 * 60 * 60 },
  { label: "7 天", value: 7 * 24 * 60 * 60 },
  { label: "30 天", value: 30 * 24 * 60 * 60 },
  { label: "永久", value: null },
] as const;

/** 默认过期：7 天（秒） */
export const DEFAULT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/** JWT 会话有效期：7 天（秒） */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** 下载一次性票有效期：60 秒 */
export const TICKET_TTL_SECONDS = 60;

/** 预签名 URL 有效期：5 分钟 */
export const PRESIGNED_URL_TTL_SECONDS = 5 * 60;

/** 上传 pending 状态最长等待：15 分钟 */
export const PENDING_TTL_SECONDS = 15 * 60;

/** 登录失败锁定阈值与窗口 */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_SECONDS = 5 * 60;

/** 分享 ID 字节数（≥16） */
export const SHARE_ID_BYTES = 16;

/** 可执行扩展名黑名单 */
export const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "scr", "ps1", "dll", "msi", "jar", "apk", "sh",
  "com", "vbs", "js", "jse", "wsf", "hta", "reg", "inf",
]);

/** Content-Type 白名单（按前缀/精确匹配） */
export const ALLOWED_CONTENT_TYPES = [
  "image/", "text/", "application/pdf", "application/json", "application/xml",
  "application/zip", "application/x-zip-compressed", "application/gzip",
  "application/x-tar", "application/x-7z-compressed", "application/x-rar-compressed",
  "application/msword", "application/vnd.openxmlformats-officedocument.",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.",
  "application/octet-stream", "audio/", "video/", "font/",
] as const;

/** 明确禁止的 Content-Type（优先于白名单，防 HTML/SVG 等被内联展示带来 XSS 面） */
export const DENIED_CONTENT_TYPES = new Set([
  "text/html",
  "text/xhtml+xml",
  "application/xhtml+xml",
  "image/svg+xml",
]);

/** 分页大小 */
export const PAGE_SIZE = 20;
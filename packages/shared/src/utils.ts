import { BLOCKED_EXTENSIONS, ALLOWED_CONTENT_TYPES, DENIED_CONTENT_TYPES, MAX_FILENAME_LENGTH } from "./config.js";

/**
 * 纯工具函数（无运行时依赖，worker 与前端共享）。
 */
export type ShareState =
  | "active"
  | "expired"
  | "over_limit"
  | "deleted"
  | "not_found";

/** 生成高熵随机 ID（base64url，≥16 字节） */
export function randomId(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

/** base64url 编码（无 padding） */
export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url 解码 */
export function base64UrlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 清洗文件名：去路径、去控制字符、截断 */
export function sanitizeFileName(raw: string): string {
  let name = raw.replace(/\\/g, "/").split("/").pop() ?? "";
  name = name.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!name) throw new Error("invalid file name");
  const dot = name.lastIndexOf(".");
  if (name.length > MAX_FILENAME_LENGTH) {
    if (dot > 0) {
      const ext = name.slice(dot);
      name = name.slice(0, MAX_FILENAME_LENGTH - ext.length) + ext;
    } else {
      name = name.slice(0, MAX_FILENAME_LENGTH);
    }
  }
  return name;
}

/** 取扩展名（小写，不含点） */
export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

/** 扩展名是否在黑名单 */
export function isBlockedExtension(fileName: string): boolean {
  const ext = getExtension(fileName);
  return BLOCKED_EXTENSIONS.has(ext);
}

/** Content-Type 是否在白名单 */
export function isAllowedContentType(contentType: string): boolean {
  const t = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (DENIED_CONTENT_TYPES.has(t)) return false;
  return ALLOWED_CONTENT_TYPES.some((allowed) =>
    allowed.endsWith("/") || allowed.endsWith(".")
      ? t.startsWith(allowed)
      : t === allowed,
  );
}

/** 计算分享状态（按当前时间） */
export function computeShareState(args: {
  status: string;
  expiresAt: number | null;
  downloadCount: number;
  maxDownloads: number | null;
  deletedAt: number | null;
  now?: number;
}): ShareState {
  const now = args.now ?? Date.now();
  if (args.deletedAt !== null || args.status === "deleted") return "deleted";
  if (args.status === "pending") return "deleted";
  if (args.expiresAt !== null && args.expiresAt <= now) return "expired";
  if (args.maxDownloads !== null && args.downloadCount >= args.maxDownloads)
    return "over_limit";
  return "active";
}

/** 人类可读文件大小 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(1)} ${units[i]}`;
}

/** 剩余时间描述 */
export function formatRemaining(expiresAt: number | null, now = Date.now()): string {
  if (expiresAt === null) return "永久";
  const diff = expiresAt - now;
  if (diff <= 0) return "已过期";
  const days = Math.ceil(diff / 86_400_000);
  if (days > 1) return `${days} 天`;
  const hours = Math.ceil(diff / 3_600_000);
  if (hours > 1) return `${hours} 小时`;
  const mins = Math.max(1, Math.ceil(diff / 60_000));
  return `${mins} 分钟`;
}

/** RFC 5987 UTF-8 filename* 编码（用于 Content-Disposition） */
export function encodeRFC5987(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}